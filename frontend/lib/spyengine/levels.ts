/**
 * SPY Engine V4 — Seviye Takibi ve Gün Kapanış Tahmini (saf, izomorfik).
 *
 * İkisi de yalnızca ÖLÇÜLEN veriden üretilir; hiçbir seviye ya da tahmin
 * modelden/interpolasyondan gelmez. Veri yoksa alan `null` döner ve arayüz
 * "veri yok" gösterir.
 */

import {
  ema, bollinger, sessionVwap, atr, nyParts, nyDateTimeToEpoch, isRthBar,
  PRE_OPEN_MIN, RTH_OPEN_MIN, RTH_CLOSE_MIN, POST_CLOSE_MIN, r2, type Bar,
} from "./core";

export interface LevelRange {
  high: number | null;
  low: number | null;
}

/** Fiyatın altındaki/üstündeki en yakın anlamlı seviye ve nereden geldiği */
export interface ActiveLevel {
  price: number;
  source: string;
  /** Fiyata uzaklık (puan) */
  distance: number;
}

export interface LevelRead {
  prevClose: number | null;
  /** Önceki seansın after-hours'ı + bu seansın premarket'i (spec §3 "gece") */
  overnight: LevelRange;
  premarket: LevelRange;
  session: LevelRange;
  rth: LevelRange;
  support: ActiveLevel | null;
  resistance: ActiveLevel | null;
  /** ATR tabanlı gün dibi/zirvesi projeksiyonu */
  projectedHigh: number | null;
  projectedLow: number | null;
  /** Projeksiyonun dayandığı ortalama saatlik hareket (puan) */
  hourlyRange: number | null;
  /** Grafikte yatay çizgi olarak çizilecek seviyeler */
  lines: { price: number; label: string; color: string }[];
}

const hiOf = (bs: Bar[]) => (bs.length ? Math.max(...bs.map((b) => b.high)) : null);
const loOf = (bs: Bar[]) => (bs.length ? Math.min(...bs.map((b) => b.low)) : null);

/** Pivot: kendi ±n mumunun en yükseği/en düşüğü olan mum */
function pivots(bars: Bar[], n = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = [], lows: number[] = [];
  for (let i = n; i < bars.length - n; i++) {
    const w = bars.slice(i - n, i + n + 1);
    if (bars[i].high === Math.max(...w.map((b) => b.high))) highs.push(bars[i].high);
    if (bars[i].low === Math.min(...w.map((b) => b.low))) lows.push(bars[i].low);
  }
  return { highs, lows };
}

/**
 * Aktif destek/direnç: fiyatın altındaki/üstündeki adayların EN YAKINI.
 * Adaylar (spec §3): son 2 saatin swing dip/zirveleri + 1m EMA21 +
 * BB alt/üst bandı + VWAP.
 */
function nearest(
  candidates: { price: number; source: string }[],
  price: number,
  below: boolean,
  minDistance: number,
): ActiveLevel | null {
  // ASGARİ MESAFE ŞART: son 2 saatin pivotları arasında fiyatın 3-4 sent
  // yanında olanlar da var. Böyle bir "seviye" gürültüdür — destek/direnç
  // diye göstermek yanıltıcı olur. Bu yüzden anlamlı bir uzaklık aranır.
  const side = candidates.filter((c) =>
    Number.isFinite(c.price) &&
    (below ? c.price < price : c.price > price) &&
    Math.abs(price - c.price) >= minDistance);
  if (!side.length) return null;
  const best = side.reduce((a, b) =>
    Math.abs(price - a.price) <= Math.abs(price - b.price) ? a : b);
  return { price: r2(best.price), source: best.source, distance: r2(Math.abs(price - best.price)) };
}

export interface LevelInput {
  /** Seans günü mumları (04:00–20:00 ET) */
  sessionM1: Bar[];
  /** Tüm mumlar (önceki seansın after-hours'ı için gerekli) */
  allM1: Bar[];
  date: string;
  prevClose: number | null;
  /** Değerlendirme anı (unix sn) */
  nowSec: number;
}

export function readLevels(input: LevelInput): LevelRead {
  const { sessionM1, allM1, date, prevClose, nowSec } = input;
  const empty: LevelRead = {
    prevClose, overnight: { high: null, low: null }, premarket: { high: null, low: null },
    session: { high: null, low: null }, rth: { high: null, low: null },
    support: null, resistance: null, projectedHigh: null, projectedLow: null,
    hourlyRange: null, lines: [],
  };
  if (!sessionM1.length) return empty;

  const pre = sessionM1.filter((b) => {
    const p = nyParts(b.time);
    return p.minutes >= PRE_OPEN_MIN && p.minutes < RTH_OPEN_MIN;
  });
  const rth = sessionM1.filter(isRthBar);

  // "Gece" = önceki seansın 16:00–20:00'ı + bu seansın 04:00–09:30'u
  const preOpenEpoch = nyDateTimeToEpoch(date, PRE_OPEN_MIN);
  const prevPost = allM1.filter((b) => {
    if (b.time >= preOpenEpoch) return false;
    const p = nyParts(b.time);
    return p.minutes >= RTH_CLOSE_MIN && p.minutes < POST_CLOSE_MIN;
  });
  // Yalnızca EN SON after-hours seansı (bir önceki gün)
  const lastPostDay = prevPost.length ? nyParts(prevPost[prevPost.length - 1].time).ymd : null;
  const overnightBars = [
    ...prevPost.filter((b) => lastPostDay && nyParts(b.time).ymd === lastPostDay),
    ...pre,
  ];

  const closes = sessionM1.map((b) => b.close);
  const price = closes[closes.length - 1];
  const e21 = ema(closes, 21);
  const bb = bollinger(closes, 20, 2);
  const vw = sessionVwap(sessionM1);
  const last = <T,>(a: (T | null)[]) => (a.length ? a[a.length - 1] : null);

  // Son 2 saatin pivotları
  const recent = sessionM1.filter((b) => b.time >= nowSec - 2 * 3600);
  const pv = pivots(recent.length >= 20 ? recent : sessionM1.slice(-120));

  const emaNow = last(e21), bbLow = last(bb.lower), bbUp = last(bb.upper), vwapNow = last(vw);
  const candidates: { price: number; source: string }[] = [];
  for (const p of pv.lows) candidates.push({ price: p, source: "swing dip" });
  for (const p of pv.highs) candidates.push({ price: p, source: "swing zirve" });
  if (emaNow != null) candidates.push({ price: emaNow, source: "EMA21" });
  if (bbLow != null) candidates.push({ price: bbLow, source: "BB alt" });
  if (bbUp != null) candidates.push({ price: bbUp, source: "BB üst" });
  if (vwapNow != null) candidates.push({ price: vwapNow, source: "VWAP" });

  // Asgari mesafe: saatlik hareketin çeyreği (en az 10 sent). Seviye,
  // fiyatın normal nefes alma aralığının DIŞINDA olmalı ki anlam taşısın.
  const aPre = atr(sessionM1, 14);
  const atrPre = aPre.length ? aPre[aPre.length - 1] : null;
  const minDist = Math.max(0.10, (atrPre ?? 0.1) * Math.sqrt(60) * 0.25);
  const support = nearest(candidates, price, true, minDist);
  const resistance = nearest(candidates, price, false, minDist);

  // ATR tabanlı gün dibi/zirvesi projeksiyonu (spec §3 son satır)
  const atrNow = atrPre;
  const rthClose = nyDateTimeToEpoch(date, RTH_CLOSE_MIN);
  const remainingMin = Math.max(0, Math.round((rthClose - nowSec) / 60));
  // Ortalama saatlik hareket = 1m ATR × 60 mumun karekökü (rassal yürüyüş ölçeği)
  const hourlyRange = atrNow != null ? r2(atrNow * Math.sqrt(60)) : null;
  const projSpan = hourlyRange != null ? hourlyRange * Math.sqrt(remainingMin / 60) : null;

  const sessionHigh = hiOf(sessionM1), sessionLow = loOf(sessionM1);
  const rthHigh = hiOf(rth), rthLow = loOf(rth);

  const projectedHigh = projSpan != null
    ? r2(Math.max(rthHigh ?? price, price + projSpan)) : null;
  const projectedLow = projSpan != null
    ? r2(Math.min(rthLow ?? price, price - projSpan)) : null;

  const lines: LevelRead["lines"] = [];
  const push = (p: number | null, label: string, color: string) => {
    if (p != null && Number.isFinite(p)) lines.push({ price: r2(p), label, color });
  };
  push(prevClose, "Dünkü kapanış", "#94a3b8");
  push(hiOf(pre), "Premarket zirve", "#38bdf8");
  push(loOf(pre), "Premarket dip", "#38bdf8");
  push(rthHigh, "Seans zirve", "#a855f7");
  push(rthLow, "Seans dip", "#a855f7");
  if (resistance) push(resistance.price, `Direnç · ${resistance.source}`, "#ef4444");
  if (support) push(support.price, `Destek · ${support.source}`, "#22c55e");

  return {
    prevClose,
    overnight: { high: hiOf(overnightBars), low: loOf(overnightBars) },
    premarket: { high: hiOf(pre), low: loOf(pre) },
    session: { high: sessionHigh, low: sessionLow },
    rth: { high: rthHigh, low: rthLow },
    support, resistance,
    projectedHigh, projectedLow, hourlyRange,
    lines,
  };
}

// ── Gün kapanış tahmini ───────────────────────────────────────────

/**
 * ÖLÇÜLMÜŞ bant yarıçapları (SPY puanı).
 *
 * scratch/forecast_calib.ts, 20 seans: her kalan-süre kovası için
 * |kapanış − o anki fiyat| dağılımının %60 kantili. Yani bant "fiyat ±
 * yarıçap" olarak kurulduğunda tarihsel isabet oranı TANIMI GEREĞİ %60'tır
 * — güven skoru buradan gelir, uydurulmaz.
 *
 * Rejime göre AYRI yarıçap kullanılmıyor: aynı ölçümde TREND ve SIKIŞMA
 * kantilleri tutarlı bir fark göstermedi (kimi kovada trend, kimisinde
 * sıkışma daha genişti). Doğrulanmamış bir ayrımı koda gömmek yerine tek
 * eğri kullanılıyor.
 */
const BAND_P60: [number, number][] = [
  [30, 0.41], [60, 0.66], [90, 0.82], [120, 0.71],
  [180, 0.75], [240, 1.16], [300, 1.34], [390, 1.75],
];

/** Bandın tarihsel isabet oranı — yarıçap %60 kantilinden geldiği için sabit */
export const FORECAST_CONFIDENCE = 60;

function bandRadius(remainingMin: number): number {
  for (const [limit, r] of BAND_P60) if (remainingMin <= limit) return r;
  return BAND_P60[BAND_P60.length - 1][1];
}

export interface CloseForecast {
  /** Tahmin aralığı */
  low: number;
  high: number;
  mid: number;
  /** Tarihsel isabet oranı (%) */
  confidence: number;
  remainingMin: number;
  /** Gap: dünkü kapanışa göre açılış farkı (puan) — bağlam olarak gösterilir */
  gap: number | null;
  /** Premarket aralığının neresinde kapandığı (0=dip, 1=zirve) */
  premarketClosePos: number | null;
  note: string;
}

export function forecastClose(input: {
  sessionM1: Bar[];
  date: string;
  nowSec: number;
  prevClose: number | null;
  regime: "TREND" | "CHOP" | "UNCERTAIN";
}): CloseForecast | null {
  const { sessionM1, date, nowSec, prevClose, regime } = input;
  if (!sessionM1.length) return null;
  const price = sessionM1[sessionM1.length - 1].close;
  const rthClose = nyDateTimeToEpoch(date, RTH_CLOSE_MIN);
  const remainingMin = Math.max(0, Math.round((rthClose - nowSec) / 60));

  const radius = bandRadius(remainingMin);

  const pre = sessionM1.filter((b) => {
    const p = nyParts(b.time);
    return p.minutes >= PRE_OPEN_MIN && p.minutes < RTH_OPEN_MIN;
  });
  const preHi = hiOf(pre), preLo = loOf(pre);
  const preLast = pre.length ? pre[pre.length - 1].close : null;
  const premarketClosePos =
    preHi != null && preLo != null && preLast != null && preHi > preLo
      ? r2((preLast - preLo) / (preHi - preLo)) : null;

  const rthBars = sessionM1.filter(isRthBar);
  const open = rthBars.length ? rthBars[0].open : null;
  const gap = open != null && prevClose != null ? r2(open - prevClose) : null;

  const note = remainingMin <= 0
    ? "Seans kapandı — tahmin penceresi bitti."
    : `Bant, 20 seansta ölçülen |kapanış − fiyat| dağılımının %60 kantilinden geliyor (kalan ${remainingMin} dk için ±${radius.toFixed(2)}). `
      + `Rejim (${regime}) bant genişliğini DEĞİŞTİRMİYOR: ölçümde trend/sıkışma ayrımı tutarlı bir fark vermedi.`;

  return {
    low: r2(price - radius),
    high: r2(price + radius),
    mid: r2(price),
    confidence: FORECAST_CONFIDENCE,
    remainingMin,
    gap,
    premarketClosePos,
    note,
  };
}
