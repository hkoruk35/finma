/**
 * SPY Engine V9.0 — Açılış Rejimi · Canlı Yön · Mum Yorumları · Tahmin Haritası
 * (saf, izomorfik — DOM/ağ yok).
 *
 * Motorun giriş/çıkış kurallarına (strategy.ts) DOKUNMAZ; yalnızca sunum
 * katmanıdır. Hepsi KAPANMIŞ mumlardan üretilir (non-repainting). VWAP,
 * mumun kendi zaman diliminde (5m için 5m, 15m için 15m) 09:30 ET'den
 * başlayarak hesaplanır — premarket VWAP'a karışmaz.
 *
 * Tahmin haritası bir TAHMİNDİR (ölçüm değil): seviyeler ölçülü veriden gelir
 * (levels.ts), yolculuğun zamanlaması ortalama saatlik hareketten türetilir.
 */

import {
  nyParts, nyClock, nyDateTimeToEpoch, isRthBar, r2, ema,
  RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar,
} from "./core";
import { detectCandlePatterns } from "./candlePatterns";
import type { LevelRead, CloseForecast } from "./levels";

export type Tf = "5m" | "15m";
export type VwapSide = "ABOVE" | "BELOW" | "AT";

const SPAN: Record<Tf, number> = { "5m": 300, "15m": 900 };
const AT_EPS = 0.02;

const sideOf = (close: number, vwap: number | null): VwapSide | null =>
  vwap == null ? null : Math.abs(close - vwap) <= AT_EPS ? "AT" : close > vwap ? "ABOVE" : "BELOW";

const fmt = (n: number, d = 2) => n.toFixed(d);
const sgn = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;

// ── Seans mumları + VWAP ─────────────────────────────────────────────

export interface DaySeries {
  bars: Bar[];
  vwap: (number | null)[];
}

/**
 * Bugünün (ymd) KAPANMIŞ RTH mumları + 09:30'dan kümülatif VWAP.
 *
 * Kapanış kuralı (veri güdümlü): mumun bitiş anı geçmiş VE 1m akışında bitişten
 * sonraki bir dakika mumu görülmüş olmalı (`lastM1Time >= bitiş`). Böylece
 * mum, son 1m verisi kesinleşir kesinleşmez — ne bir dakika erken ne geç —
 * kapanmış sayılır.
 */
export function daySeries(all: Bar[], tf: Tf, ymd: string, nowSec: number, lastM1Time: number | null): DaySeries {
  const bars = all.filter((b) => {
    if (!isRthBar(b) || nyParts(b.time).ymd !== ymd) return false;
    const end = b.time + SPAN[tf];
    return end <= nowSec && (lastM1Time == null || lastM1Time >= end);
  });
  let pv = 0, vol = 0;
  const vwap = bars.map((b) => {
    const v = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vol += v;
    return vol > 0 ? pv / vol : null;
  });
  return { bars, vwap };
}

/** Oluşmakta olan (henüz kapanmamış) dahil, çizim için RTH VWAP */
export function liveVwap(all: Bar[], ymd: string): number | null {
  let pv = 0, vol = 0;
  for (const b of all) {
    if (!isRthBar(b) || nyParts(b.time).ymd !== ymd) continue;
    const v = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vol += v;
  }
  return vol > 0 ? pv / vol : null;
}

// ── Mum yorumu ───────────────────────────────────────────────────────

export type Tone = "bull" | "bear" | "neutral";

export interface CandleComment {
  tf: Tf;
  time: number;
  clock: string;
  tone: Tone;
  /** Oluşmakta olan (henüz kapanmamış) mum */
  forming: boolean;
  /** Tek satır sonuç: "Yeşil mum · VWAP üstünde → alıcı lehine" */
  headline: string;
  close: number;
  vwap: number | null;
  vwapSide: VwapSide | null;
  /** Fitil uzunlukları (puan) */
  upperWick: number;
  lowerWick: number;
  /** Kapanışın mum aralığındaki konumu: 0 = dip, 1 = tepe */
  closePos: number;
  volume: number;
  /** Önceki ≤10 kapanmış mum ortalamasına oran (kıyas yoksa null) */
  volRatio: number | null;
  lines: string[];
}

/**
 * EMA20 haritası (mum zamanı → EMA). Tüm akış (önceki günler + pre/post)
 * üzerinden hesaplanır — seansın ilk mumlarında da ısınmış değer olur. EMA,
 * i. mumda yalnızca ≤ i mumlarına bağlı olduğundan kapanmış mumlar için
 * değer sabittir (repaint yok); oluşan mumun değeri canlıdır.
 */
export type EmaMap = Map<number, number>;
export const EMA_PERIOD = 20;

export function emaByTime(all: Bar[], period = EMA_PERIOD): EmaMap {
  const out: EmaMap = new Map();
  const e = ema(all.map((b) => b.close), period);
  all.forEach((b, i) => { if (e[i] != null) out.set(b.time, e[i] as number); });
  return out;
}

export const fmtVol = (v: number): string =>
  v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(Math.round(v));

/**
 * Tek mumun yorumu. `priorVols` kıyas için önceki KAPANMIŞ mumların hacmi;
 * `elapsedFrac` yalnızca oluşan mumda (0-1) hacmi tempo olarak yıllandırır.
 */
function analyseCandle(
  b: Bar, v: number | null, prev: Bar | null, pv: number | null,
  priorVols: number[], tf: Tf, forming: boolean, elapsedFrac: number,
  e: number | null = null,
): CandleComment {
  const range = Math.max(0.01, b.high - b.low);
  const body = Math.abs(b.close - b.open);
  const bodyPct = body / range;
  const upW = b.high - Math.max(b.open, b.close);
  const loW = Math.min(b.open, b.close) - b.low;
  const upPct = upW / range, loPct = loW / range;
  const closePos = (b.close - b.low) / range;
  const color: "bull" | "bear" | "doji" = bodyPct < 0.15 ? "doji" : b.close > b.open ? "bull" : "bear";
  const kap = forming ? "Fiyat" : "Kapanış";

  const lines: string[] = [];
  let score = color === "bull" ? 1 : color === "bear" ? -1 : 0;

  // — gövde —
  if (color === "doji") lines.push("Kararsızlık mumu (doji) — alıcı/satıcı dengede.");
  else if (bodyPct >= 0.7) lines.push(`Güçlü gövdeli ${color === "bull" ? "yeşil" : "kırmızı"} mum — ${color === "bull" ? "alıcılar" : "satıcılar"} baskın (gövde %${Math.round(bodyPct * 100)}).`);
  else lines.push(`${color === "bull" ? "Yeşil" : "Kırmızı"} mum, normal gövde (%${Math.round(bodyPct * 100)}).`);

  // — fitiller —
  const wickTxt = `Fitil: üst ${fmt(upW)} (%${Math.round(upPct * 100)}) · alt ${fmt(loW)} (%${Math.round(loPct * 100)})`;
  if (loPct >= 0.4 && loPct > upPct * 1.5) { lines.push(`${wickTxt} → uzun alt fitil: dip satışı geri alındı, alıcı tepkisi.`); score += 0.75; }
  else if (upPct >= 0.4 && upPct > loPct * 1.5) { lines.push(`${wickTxt} → uzun üst fitil: tepe reddedildi, satıcı baskısı.`); score -= 0.75; }
  else if (upPct >= 0.3 && loPct >= 0.3) lines.push(`${wickTxt} → iki yönlü fitil: iki taraf da denedi, kararsız.`);
  else lines.push(`${wickTxt} → fitiller kısa, hareket temiz.`);

  // — kapanış / fiyat konumu —
  if (closePos >= 0.75) { lines.push(`${kap} aralığın üst %${Math.round((1 - closePos) * 100)}'lik diliminde (tepeye yakın) → alıcılar kontrolde.`); score += 0.75; }
  else if (closePos <= 0.25) { lines.push(`${kap} aralığın alt %${Math.round(closePos * 100)}'lik diliminde (dibe yakın) → satıcılar kontrolde.`); score -= 0.75; }
  else lines.push(`${kap} aralığın ortasında (%${Math.round(closePos * 100)}) → net üstünlük yok.`);

  // — VWAP konumu (en önemli) —
  const side = sideOf(b.close, v);
  const prevSide = prev ? sideOf(prev.close, pv) : null;
  if (v == null || side == null) lines.push("VWAP verisi yok.");
  else {
    const d = b.close - v;
    if (prevSide === "BELOW" && side === "ABOVE") { lines.push(`VWAP'ı (${fmt(v)}) yukarı kesip üstünde ${forming ? "seyrediyor" : "kapattı"} (${sgn(d)}) → alıcı kontrolü ele geçirdi.`); score += 2; }
    else if (prevSide === "ABOVE" && side === "BELOW") { lines.push(`VWAP'ın (${fmt(v)}) altına ${forming ? "sarktı" : "kapandı"} (${sgn(d)}) → satıcı kontrolü ele geçirdi.`); score -= 2; }
    else if (side === "ABOVE") {
      if (b.low <= v) lines.push(`VWAP'a (${fmt(v)}) değdi ve üstünde ${forming ? "tutunuyor" : "kapattı"} (${sgn(d)}) → VWAP destek olarak tuttu.`);
      else lines.push(`VWAP üstünde ${forming ? "seyir" : "kapanış"} (${fmt(v)}, ${sgn(d)}) → yükseliş yapısı sürüyor.`);
      score += 1.5;
    } else if (side === "BELOW") {
      if (b.high >= v) lines.push(`VWAP'a (${fmt(v)}) değdi ama altında ${forming ? "kalıyor" : "kapattı"} (${sgn(d)}) → VWAP direnç oldu, reddedildi.`);
      else lines.push(`VWAP altında ${forming ? "seyir" : "kapanış"} (${fmt(v)}, ${sgn(d)}) → düşüş yapısı sürüyor.`);
      score -= 1.5;
    } else lines.push(`VWAP'ın (${fmt(v)}) tam üzerinde → yön kararsız.`);
  }

  // — EMA20 konumu (VWAP ile aynı taraf = teyit, ters taraf = çelişki) —
  if (e != null) {
    const d = b.close - e;
    const eSide: VwapSide = Math.abs(d) <= AT_EPS ? "AT" : d > 0 ? "ABOVE" : "BELOW";
    const where = eSide === "ABOVE" ? "üstünde" : eSide === "BELOW" ? "altında" : "üzerinde";
    const agree = side != null && side !== "AT" && eSide !== "AT" ? (side === eSide ? " — VWAP ile aynı taraf, teyit" : " — VWAP'ın tersi, çelişki: momentum zayıflıyor") : "";
    lines.push(`EMA20 (${fmt(e)}) ${where} (${sgn(d)})${agree}.`);
    score += eSide === "ABOVE" ? 0.5 : eSide === "BELOW" ? -0.5 : 0;
  }

  // — hacim (mutlak + kıyas + tempo) —
  let volRatio: number | null = null;
  const avg = priorVols.length >= 3 ? priorVols.reduce((a, x) => a + x, 0) / priorVols.length : 0;
  const vol = b.volume || 0;
  const pace = forming && elapsedFrac >= 0.1 ? vol / elapsedFrac : vol; // mum sonundaki tahmini hacim
  if (avg > 0) {
    volRatio = pace / avg;
    const prevVol = prev ? prev.volume || 0 : 0;
    const vsPrev = prevVol > 0 ? ` · önceki muma göre ${pace >= prevVol ? "+" : "−"}%${Math.round(Math.abs(pace / prevVol - 1) * 100)}` : "";
    const head = forming
      ? `Canlı hacim ${fmtVol(vol)} (tempo → mum sonu ≈ ${fmtVol(pace)}, ort. ${fmtVol(avg)}, ${fmt(volRatio, 1)}×${vsPrev})`
      : `Hacim ${fmtVol(vol)} (ort. ${fmtVol(avg)}, ${fmt(volRatio, 1)}×${vsPrev})`;
    const dirTxt = color === "bull" ? "alım" : color === "bear" ? "satış" : "iki yön";
    if (volRatio >= 1.5) { lines.push(`${head} → hacim yüksek: ${dirTxt} hareketi teyitli.`); score += color === "bull" ? 0.5 : color === "bear" ? -0.5 : 0; }
    else if (volRatio <= 0.6) lines.push(`${head} → hacim zayıf: hareket güvenilir değil.`);
    else lines.push(`${head} → normal hacim.`);
  } else lines.push(`${forming ? "Canlı hacim" : "Hacim"} ${fmtVol(vol)} (kıyas için henüz yeterli mum yok).`);

  const tone: Tone = score >= 2 ? "bull" : score <= -2 ? "bear" : "neutral";
  const colorTxt = color === "bull" ? "Yeşil mum" : color === "bear" ? "Kırmızı mum" : "Doji";
  const vwapTxt = side == null ? "VWAP yok" : side === "ABOVE" ? "VWAP üstünde" : side === "BELOW" ? "VWAP altında" : "VWAP'ta";
  const meaning = tone === "bull" ? "alıcı lehine" : tone === "bear" ? "satıcı lehine" : "nötr / kararsız";

  return {
    tf, time: b.time, clock: nyClock(b.time), tone, forming, close: b.close, vwap: v, vwapSide: side,
    upperWick: upW, lowerWick: loW, closePos, volume: vol, volRatio, lines,
    headline: `${colorTxt} · ${vwapTxt} → ${meaning}`,
  };
}

export function commentCandle(s: DaySeries, i: number, tf: Tf, emaMap?: EmaMap): CandleComment {
  const priorVols = s.bars.slice(Math.max(0, i - 10), i).map((x) => x.volume || 0);
  const c = analyseCandle(
    s.bars[i], s.vwap[i], i > 0 ? s.bars[i - 1] : null, i > 0 ? s.vwap[i - 1] : null, priorVols, tf, false, 1,
    emaMap?.get(s.bars[i].time) ?? null,
  );
  // formasyon (yalnızca kapanmış mumlarda)
  const hits = detectCandlePatterns(s.bars, i);
  if (hits.length) {
    const top = hits.reduce((a, x) => (x.strength >= a.strength ? x : a));
    c.lines.push(`Formasyon: ${top.label} — ${top.detail}.`);
  }
  return c;
}

/**
 * Oluşmakta olan mumun CANLI yorumu (kapanmamış — karar mumu DEĞİL, bilgi).
 * VWAP, oluşan mum dahil kümülatif hesaplanır; hacim tempo olarak yıllandırılır.
 */
export function commentForming(all: Bar[], s: DaySeries, tf: Tf, ymd: string, nowSec: number, emaMap?: EmaMap): CandleComment | null {
  const span = SPAN[tf];
  const cur = all.find((b) => isRthBar(b) && nyParts(b.time).ymd === ymd && b.time <= nowSec && b.time + span > nowSec);
  if (!cur || (s.bars.length && cur.time <= s.bars[s.bars.length - 1].time)) return null;
  let pv = 0, vol = 0;
  for (const b of s.bars) { const v = b.volume || 0; pv += ((b.high + b.low + b.close) / 3) * v; vol += v; }
  pv += ((cur.high + cur.low + cur.close) / 3) * (cur.volume || 0);
  vol += cur.volume || 0;
  const vw = vol > 0 ? pv / vol : null;
  const n = s.bars.length;
  const prior = s.bars.slice(Math.max(0, n - 10)).map((x) => x.volume || 0);
  const elapsed = Math.min(1, Math.max(0, (nowSec - cur.time) / span));
  return analyseCandle(cur, vw, n ? s.bars[n - 1] : null, n ? s.vwap[n - 1] : null, prior, tf, true, elapsed, emaMap?.get(cur.time) ?? null);
}

/** Bugünün tüm kapanmış mumları için yorum — EN YENİ başta */
export function commentAll(s: DaySeries, tf: Tf, limit = 40, emaMap?: EmaMap): CandleComment[] {
  const out: CandleComment[] = [];
  for (let i = s.bars.length - 1; i >= 0 && out.length < limit; i--) out.push(commentCandle(s, i, tf, emaMap));
  return out;
}

// ── Açılış rejimi (09:30 → 09:45-10:00 kararı) ───────────────────────

export type OpeningSide = "UP" | "DOWN" | "UNCERTAIN";

export interface OpeningRegime {
  /** WAITING: 09:45'ten önce · FORMING: 09:45-10:00 (her 5m kapanışta güncellenir) · LOCKED: 10:00 sonrası sabit */
  status: "WAITING" | "FORMING" | "LOCKED";
  side: OpeningSide | null;
  label: string;
  summary: string;
  /** 09:30'dan itibaren her 5m kapanışın VWAP konumu */
  closes5: { clock: string; side: VwapSide | null; close: number }[];
  closes15: { clock: string; side: VwapSide | null; close: number }[];
}

const OPEN_WINDOW_END = 10 * 60; // 10:00

export function openingRegime(m5: DaySeries, m15: DaySeries): OpeningRegime {
  const win5 = m5.bars
    .map((b, i) => ({ b, v: m5.vwap[i] }))
    .filter((x) => nyParts(x.b.time).minutes < OPEN_WINDOW_END);
  const win15 = m15.bars
    .map((b, i) => ({ b, v: m15.vwap[i] }))
    .filter((x) => nyParts(x.b.time).minutes < OPEN_WINDOW_END);

  const closes5 = win5.map((x) => ({ clock: nyClock(x.b.time), side: sideOf(x.b.close, x.v), close: x.b.close }));
  const closes15 = win15.map((x) => ({ clock: nyClock(x.b.time), side: sideOf(x.b.close, x.v), close: x.b.close }));

  const base = { closes5, closes15 };
  if (win5.length < 3) {
    return {
      ...base, status: "WAITING", side: null, label: "BEKLENİYOR",
      summary: `İlk 3 adet 5m kapanış (09:30·09:35·09:40) ve 15m 09:30 kapanışı bekleniyor — karar 09:45 ET'de başlar (${win5.length}/3 mum kapandı).`,
    };
  }

  const above = closes5.filter((c) => c.side === "ABOVE").length;
  const below = closes5.filter((c) => c.side === "BELOW").length;
  const n = closes5.length;
  const lastSide = closes5[n - 1].side;
  const side15 = closes15.length ? closes15[closes15.length - 1].side : null;

  let side: OpeningSide = "UNCERTAIN";
  if (above / n >= 0.8 && lastSide === "ABOVE" && side15 === "ABOVE") side = "UP";
  else if (below / n >= 0.8 && lastSide === "BELOW" && side15 === "BELOW") side = "DOWN";

  const status: OpeningRegime["status"] = n >= 6 ? "LOCKED" : "FORMING";
  const label = side === "UP" ? "YÜKSELİŞ" : side === "DOWN" ? "DÜŞÜŞ" : "BELİRSİZ";

  const why =
    side === "UP" ? `${n} 5m kapanışın ${above}'i VWAP üstünde, son kapanış VWAP üstünde, 15m kapanış VWAP üstünde.`
    : side === "DOWN" ? `${n} 5m kapanışın ${below}'i VWAP altında, son kapanış VWAP altında, 15m kapanış VWAP altında.`
    : `${n} 5m kapanış: ${above} VWAP üstü / ${below} VWAP altı${side15 ? `, 15m kapanış VWAP ${side15 === "ABOVE" ? "üstünde" : side15 === "BELOW" ? "altında" : "üzerinde"}` : ""} — kapanışlar tek yönde toplanmadı (VWAP etrafında gidip geliyor).`;

  return {
    ...base, status, side, label,
    summary: `${status === "LOCKED" ? "10:00 kararı (kilitli): " : "Oluşuyor — 10:00'a kadar her 5m kapanışta güncellenir: "}${why}`,
  };
}

// ── Canlı yön (her kapanan 5m + 15m mumla güncellenir) ───────────────

export interface LiveDirection {
  dir: "UP" | "DOWN" | "MIXED";
  strength: "GÜÇLÜ" | "ZAYIF" | "ÇELİŞKİ";
  side5: VwapSide | null;
  side15: VwapSide | null;
  /** Aynı VWAP tarafında üst üste kapanan mum sayısı */
  streak5: number;
  streak15: number;
  asOf5: string;
  asOf15: string | null;
  /** Yön VWAP ile teyitli mi (5m ve 15m aynı tarafta) */
  aligned: boolean;
  text: string;
}

function streakOf(s: DaySeries): { side: VwapSide | null; count: number; crossed: boolean } {
  const n = s.bars.length;
  if (!n) return { side: null, count: 0, crossed: false };
  const side = sideOf(s.bars[n - 1].close, s.vwap[n - 1]);
  let count = 0;
  for (let i = n - 1; i >= 0 && sideOf(s.bars[i].close, s.vwap[i]) === side; i--) count++;
  const prev = n - count - 1 >= 0 ? sideOf(s.bars[n - count - 1].close, s.vwap[n - count - 1]) : null;
  const crossed = count === 1 && prev != null && prev !== "AT" && side != null && side !== "AT" && prev !== side;
  return { side, count, crossed };
}

/**
 * Yön, HER kapanan 5m ve 15m mumun VWAP konumundan okunur (sabit mum sayısı
 * yok). Açılışta karar için 3×5m + 15m beklenir (openingRegime) — bu
 * fonksiyon açılış rejimi oluştuktan sonra çağrılır.
 */
export function liveDirection(s5: DaySeries, s15: DaySeries): LiveDirection | null {
  if (!s5.bars.length) return null;
  const a = streakOf(s5);
  const b = streakOf(s15);
  const asOf5 = nyClock(s5.bars[s5.bars.length - 1].time);
  const asOf15 = s15.bars.length ? nyClock(s15.bars[s15.bars.length - 1].time) : null;

  const up5 = a.side === "ABOVE", dn5 = a.side === "BELOW";
  const up15 = b.side === "ABOVE", dn15 = b.side === "BELOW";
  let dir: LiveDirection["dir"] = "MIXED";
  let strength: LiveDirection["strength"] = "ÇELİŞKİ";
  if (up5 && up15) dir = "UP";
  else if (dn5 && dn15) dir = "DOWN";
  const aligned = dir !== "MIXED";
  if (aligned) strength = a.count >= 2 ? "GÜÇLÜ" : "ZAYIF";

  const nm = (side: VwapSide | null) => (side === "ABOVE" ? "VWAP üstünde" : side === "BELOW" ? "VWAP altında" : side === "AT" ? "VWAP'ta" : "VWAP yok");
  const t5 = `5m (${asOf5}): ${nm(a.side)}${a.count > 1 ? `, ${a.count} mumdur üst üste` : a.crossed ? ", VWAP'ı yeni kesti" : ""}`;
  const t15 = asOf15 ? `15m (${asOf15}): ${nm(b.side)}${b.count > 1 ? `, ${b.count} mumdur üst üste` : b.crossed ? ", VWAP'ı yeni kesti" : ""}` : "15m: henüz kapanış yok";
  const verdict =
    dir === "UP" ? (strength === "GÜÇLÜ" ? "İki zaman dilimi de yukarı — yön teyitli." : "Yeni kesişim — bir sonraki 5m kapanışı teyit etmeli.")
    : dir === "DOWN" ? (strength === "GÜÇLÜ" ? "İki zaman dilimi de aşağı — yön teyitli." : "Yeni kesişim — bir sonraki 5m kapanışı teyit etmeli.")
    : "5m ve 15m farklı tarafta / VWAP'ta — yön yok, bekle.";

  return { dir, strength, side5: a.side, side15: b.side, streak5: a.count, streak15: b.count, asOf5, asOf15, aligned, text: `${t5} · ${t15}. ${verdict}` };
}

// ── Tahmin haritası ──────────────────────────────────────────────────

export interface MapLevel {
  price: number;
  label: string;
}

export interface PathPoint {
  t: number;
  price: number;
  label: string;
}

export interface ForecastMapData {
  bias: "UP" | "DOWN" | "FLAT";
  biasText: string;
  price: number;
  vwap: number | null;
  supports: MapLevel[];
  resistances: MapLevel[];
  path: PathPoint[];
  closeExpect: number;
  closeLow: number;
  closeHigh: number;
  steps: string[];
  alt: string[];
}

const DEFAULT_HOURLY = 1.0;

export function buildForecastMap(input: {
  price: number;
  vwap: number | null;
  date: string;
  nowSec: number;
  opening: OpeningRegime;
  live: LiveDirection | null;
  levels: LevelRead | null;
  forecast: CloseForecast | null;
}): ForecastMapData | null {
  const { price, vwap, date, nowSec, opening, live, levels, forecast } = input;
  if (!Number.isFinite(price)) return null;

  const closeSec = nyDateTimeToEpoch(date, RTH_CLOSE_MIN);
  const openSec = nyDateTimeToEpoch(date, RTH_OPEN_MIN);
  const t0 = Math.min(Math.max(nowSec, openSec), closeSec);

  // — bias —
  let bias: ForecastMapData["bias"] = "FLAT";
  let biasText = "Yön belirsiz — fiyat VWAP etrafında; aralık senaryosu.";
  if (opening.side === "UP" || opening.side === "DOWN") {
    bias = opening.side;
    biasText = `Açılış rejimi ${opening.label} → gün yönü ${bias === "UP" ? "yukarı" : "aşağı"} eğilimli.`;
  } else if (vwap != null && live && live.aligned && live.strength === "GÜÇLÜ" && opening.status !== "WAITING") {
    bias = live.dir as "UP" | "DOWN";
    biasText = `Açılış rejimi ${opening.label}; ancak 5m ve 15m kapanışlar VWAP ${bias === "UP" ? "üstünde" : "altında"} teyitli → kısa vadeli ${bias === "UP" ? "yukarı" : "aşağı"} eğilim.`;
  }

  // — seviyeler (yalnızca ölçülmüş veriden) —
  const cand: MapLevel[] = [];
  const add = (p: number | null | undefined, label: string) => {
    if (p != null && Number.isFinite(p)) cand.push({ price: r2(p), label });
  };
  if (levels) {
    add(levels.prevClose, "Dünkü kapanış");
    add(levels.premarket.high, "Premarket zirvesi");
    add(levels.premarket.low, "Premarket dibi");
    add(levels.rth.high, "Gün zirvesi");
    add(levels.rth.low, "Gün dibi");
    add(levels.support?.price, levels.support ? `Destek (${levels.support.source})` : "");
    add(levels.resistance?.price, levels.resistance ? `Direnç (${levels.resistance.source})` : "");
    add(levels.projectedHigh, "ATR zirve projeksiyonu");
    add(levels.projectedLow, "ATR dip projeksiyonu");
  }
  add(vwap, "VWAP");
  const whole = Math.floor(price);
  add(whole, `${whole} yuvarlak`);
  add(whole + 1, `${whole + 1} yuvarlak`);

  const uniq: MapLevel[] = [];
  for (const c of cand.sort((a, b) => a.price - b.price)) {
    const last = uniq[uniq.length - 1];
    if (last && Math.abs(last.price - c.price) < 0.15) {
      // yakın seviyeleri birleştir; VWAP etiketini koru
      if (c.label === "VWAP" || (!last.label.startsWith("VWAP") && c.label.length < last.label.length)) uniq[uniq.length - 1] = c;
    } else uniq.push(c);
  }
  const MIN_DIST = 0.12;
  const supports = uniq.filter((l) => l.price < price - MIN_DIST).sort((a, b) => b.price - a.price).slice(0, 3);
  const resistances = uniq.filter((l) => l.price > price + MIN_DIST).sort((a, b) => a.price - b.price).slice(0, 3);

  // — yolculuk —
  const hr = Math.max(0.3, levels?.hourlyRange ?? DEFAULT_HOURLY);
  const minLeft = Math.max(0, (closeSec - t0) / 60);
  const travel = (dist: number) => Math.min(Math.max(10, Math.round((Math.abs(dist) / hr) * 60)), Math.max(10, minLeft * 0.4));
  const at = (mins: number) => Math.min(closeSec, t0 + mins * 60);

  const s1 = supports[0] ?? { price: r2(price - hr * 0.5), label: "ATR desteği (tahmini)" };
  const r1 = resistances[0] ?? { price: r2(price + hr * 0.5), label: "ATR direnci (tahmini)" };

  const path: PathPoint[] = [{ t: t0, price: r2(price), label: "Şimdi" }];
  const steps: string[] = [];
  const alt: string[] = [];
  let closeExpect: number;

  if (bias === "DOWN") {
    const m1 = travel(price - s1.price);
    const bounceRef = vwap != null && vwap > s1.price ? vwap : r1.price;
    const bounce = r2(s1.price + (bounceRef - s1.price) * 0.5);
    path.push({ t: at(m1), price: s1.price, label: `Destek ${fmt(s1.price)}` });
    path.push({ t: at(m1 + 45), price: bounce, label: `Tepki ${fmt(bounce)}` });
    closeExpect = r2((s1.price + bounce) / 2);
    steps.push(`Fiyat ${fmt(price)}'ten ilk desteğe — ${fmt(s1.price)} (${s1.label}) — doğru iner (~${m1} dk).`);
    steps.push(`Destek tutarsa ${fmt(bounce)} civarına tepki yükselişi gelir (VWAP/direnç yarı mesafe).`);
    steps.push(`Gün sonu kapanış beklentisi ≈ ${fmt(closeExpect)}.`);
    alt.push(`İptal: 5m kapanış VWAP'ın${vwap != null ? ` (${fmt(vwap)})` : ""} üstüne çıkarsa düşüş senaryosu bozulur → hedef ${fmt(r1.price)}.`);
    alt.push(`Destek ${fmt(s1.price)} aşağı kırılırsa${supports[1] ? ` sıradaki durak ${fmt(supports[1].price)} (${supports[1].label})` : " yeni dip aranır"}.`);
  } else if (bias === "UP") {
    const m1 = travel(r1.price - price);
    const pullRef = vwap != null && vwap < r1.price ? vwap : s1.price;
    const pull = r2(r1.price - (r1.price - pullRef) * 0.5);
    path.push({ t: at(m1), price: r1.price, label: `Direnç ${fmt(r1.price)}` });
    path.push({ t: at(m1 + 45), price: pull, label: `Geri çekilme ${fmt(pull)}` });
    closeExpect = r2((r1.price + pull) / 2);
    steps.push(`Fiyat ${fmt(price)}'ten ilk dirence — ${fmt(r1.price)} (${r1.label}) — doğru yükselir (~${m1} dk).`);
    steps.push(`Direnç aşılamazsa ${fmt(pull)} civarına geri çekilme gelir (VWAP/destek yarı mesafe).`);
    steps.push(`Gün sonu kapanış beklentisi ≈ ${fmt(closeExpect)}.`);
    alt.push(`İptal: 5m kapanış VWAP'ın${vwap != null ? ` (${fmt(vwap)})` : ""} altına inerse yükseliş senaryosu bozulur → hedef ${fmt(s1.price)}.`);
    alt.push(`Direnç ${fmt(r1.price)} yukarı kırılırsa${resistances[1] ? ` sıradaki durak ${fmt(resistances[1].price)} (${resistances[1].label})` : " yeni zirve aranır"}.`);
  } else {
    const m1 = travel(Math.min(price - s1.price, r1.price - price));
    const center = vwap ?? price;
    path.push({ t: at(m1), price: r2(center), label: `VWAP ${fmt(center)}` });
    closeExpect = r2((center + price) / 2);
    steps.push(`Yön belirsiz: fiyat ${fmt(s1.price)} – ${fmt(r1.price)} aralığında VWAP (${fmt(center)}) etrafında dolaşır.`);
    steps.push(`Gün sonu kapanış beklentisi ≈ ${fmt(closeExpect)} (aralık ortası).`);
    alt.push(`Yön netleşmesi: 5m kapanış ${fmt(r1.price)} üstüne çıkarsa yükseliş, ${fmt(s1.price)} altına inerse düşüş senaryosu başlar.`);
  }

  // Kapanış noktası: tahmin bandıyla sınırlı (band = ölçülmüş |kapanış−fiyat| kantili)
  let closeLow = r2(closeExpect - hr * 0.5);
  let closeHigh = r2(closeExpect + hr * 0.5);
  if (forecast) {
    closeLow = forecast.low;
    closeHigh = forecast.high;
    closeExpect = r2(Math.min(forecast.high, Math.max(forecast.low, closeExpect)));
  }
  path.push({ t: closeSec, price: closeExpect, label: `Kapanış ≈ ${fmt(closeExpect)}` });

  return { bias, biasText, price, vwap, supports, resistances, path, closeExpect, closeLow, closeHigh, steps, alt };
}

// ── 15m yapı stopu (trend taşıma) ─────────────────────────────────────

export interface StopZone {
  side: "LONG" | "SHORT";
  /** Dayanak mumun saati ve seviyesi (LONG: son kapanmış 15m dibi · SHORT: zirvesi) */
  anchorClock: string;
  anchor: number;
  /** ATR₁₅ × çarpan (asgari 0,10) */
  buffer: number;
  /** Stop seviyesi: LONG dip − tampon · SHORT zirve + tampon */
  stop: number;
  /** SL alanı: dip/zirve ile stop arasındaki bölge */
  zoneLo: number;
  zoneHi: number;
  /** Bir önceki kapanmış 15m mumun stopu ve değişim yönü ("UP" = stop trend yönünde çekilmeli) */
  prevStop: number | null;
  move: "UP" | "DOWN" | "SAME" | null;
}

export interface StopZones {
  long: StopZone | null;
  short: StopZone | null;
  buffer: number;
  atr15: number | null;
  mult: number;
}

/**
 * Tampon = ATR₁₅ × çarpan — motorun stop kuralıyla aynı (normal 0,25 ·
 * yüksek oynaklık 0,40 · veri/FOMC günü 0,50). Yalnızca KAPANMIŞ 15m mumlardan.
 */
export function stopZones(s15: DaySeries, atr15: number | null, mult: number): StopZones {
  const buffer = Math.max(0.1, r2((atr15 ?? 0) * mult));
  const n = s15.bars.length;
  if (!n) return { long: null, short: null, buffer, atr15, mult };
  const last = s15.bars[n - 1];
  const prev = n > 1 ? s15.bars[n - 2] : null;
  const clock = nyClock(last.time);

  const long: StopZone = {
    side: "LONG", anchorClock: clock, anchor: last.low, buffer,
    stop: r2(last.low - buffer), zoneLo: r2(last.low - buffer), zoneHi: last.low,
    prevStop: prev ? r2(prev.low - buffer) : null, move: null,
  };
  const short: StopZone = {
    side: "SHORT", anchorClock: clock, anchor: last.high, buffer,
    stop: r2(last.high + buffer), zoneLo: last.high, zoneHi: r2(last.high + buffer),
    prevStop: prev ? r2(prev.high + buffer) : null, move: null,
  };
  // LONG: stop yukarı çıktıysa çek · SHORT: stop aşağı indiyse çek (trend yönünde)
  if (long.prevStop != null) long.move = long.stop > long.prevStop ? "UP" : long.stop < long.prevStop ? "DOWN" : "SAME";
  if (short.prevStop != null) short.move = short.stop < short.prevStop ? "UP" : short.stop > short.prevStop ? "DOWN" : "SAME";
  return { long, short, buffer, atr15, mult };
}

// ── Karar desteği (her kapanan 5m/15m mumda yeniden okunur) ───────────

export type Dir3 = "UP" | "DOWN" | "FLAT";

export interface ReadFactor {
  /** Kısa başlık: "VWAP", "EMA20", "EMA20 eğimi", "Yapı", "Hacim akışı", "Son mum" */
  label: string;
  /** Okuma: "üstünde +0.32" */
  value: string;
  /** +1 alıcı lehine · −1 satıcı lehine · 0 nötr */
  vote: -1 | 0 | 1;
}

export interface TfRead {
  tf: Tf;
  time: number;
  clock: string;
  close: number;
  /** −6..+6 (6 faktörün oy toplamı) */
  score: number;
  dir: Dir3;
  /** "GÜÇLÜ YUKARI" / "YUKARI" / "YATAY · alıcı önde" … */
  label: string;
  vwap: number | null;
  ema: number | null;
  /** Son 6 mumda tahmini alıcı hacmi payı (kapanış konumu ağırlıklı, 0-1) */
  buyShare: number | null;
  /** Son mum hacmi / önceki ≤10 mum ortalaması */
  volRatio: number | null;
  factors: ReadFactor[];
}

export const FACTOR_MAX = 6;
const FLOW_BARS = 6;

/**
 * Bir zaman diliminin i. KAPANMIŞ mumundaki yön okuması. Altı faktör oy
 * verir: VWAP konumu, EMA20 konumu, EMA20 eğimi, mum yapısı (yükselen/
 * alçalan tepe-dip), hacim akışı (alıcı/satıcı payı) ve son mumun hacimle
 * teyidi. ≥ +3 YUKARI, ≤ −3 AŞAĞI, arası YATAY.
 *
 * Alıcı/satıcı hacmi tick verisi olmadan ölçülemez; her mumun hacmi
 * kapanışın aralıktaki konumuyla (dipte 0 → tepede 1) bölüştürülür
 * ("close location value" yaklaşımı). Tahmindir, emir defteri değildir.
 */
export function tfRead(s: DaySeries, tf: Tf, emaMap: EmaMap, i = s.bars.length - 1): TfRead | null {
  if (i < 0 || i >= s.bars.length) return null;
  const b = s.bars[i];
  const v = s.vwap[i];
  const e = emaMap.get(b.time) ?? null;
  const factors: ReadFactor[] = [];
  const where = (sd: VwapSide | null) => (sd === "ABOVE" ? "üstünde" : sd === "BELOW" ? "altında" : "üzerinde");

  // 1) VWAP
  const vs = sideOf(b.close, v);
  factors.push({
    label: "VWAP",
    value: v == null ? "veri yok" : `${where(vs)} ${sgn(b.close - v)}`,
    vote: vs === "ABOVE" ? 1 : vs === "BELOW" ? -1 : 0,
  });

  // 2) EMA20 konumu
  const es = sideOf(b.close, e);
  factors.push({
    label: "EMA20",
    value: e == null ? "ısınıyor" : `${where(es)} ${sgn(b.close - e)}`,
    vote: es === "ABOVE" ? 1 : es === "BELOW" ? -1 : 0,
  });

  // 3) EMA20 eğimi (3 mum önceye göre)
  const ePrev = emaMap.get(b.time - 3 * SPAN[tf]) ?? null;
  const slopeEps = tf === "5m" ? 0.03 : 0.05;
  const slope = e != null && ePrev != null ? e - ePrev : null;
  factors.push({
    label: "EMA20 eğimi",
    value: slope == null ? "—" : `${slope > slopeEps ? "yükseliyor" : slope < -slopeEps ? "düşüyor" : "yatay"} (${sgn(slope)} / 3 mum)`,
    vote: slope == null ? 0 : slope > slopeEps ? 1 : slope < -slopeEps ? -1 : 0,
  });

  // 4) Yapı: son 3 mumda tepe/dip dizilimi
  if (i >= 2) {
    const a0 = s.bars[i - 2], a1 = s.bars[i - 1];
    const hh = a1.high > a0.high && b.high > a1.high, hl = a1.low > a0.low && b.low > a1.low;
    const lh = a1.high < a0.high && b.high < a1.high, ll = a1.low < a0.low && b.low < a1.low;
    const up = hh && hl, dn = lh && ll;
    const upSoft = !up && !dn && (hh || hl) && b.close > a1.close;
    const dnSoft = !up && !dn && (lh || ll) && b.close < a1.close;
    factors.push({
      label: "Yapı (3 mum)",
      value: up ? "yükselen tepe + yükselen dip" : dn ? "alçalan tepe + alçalan dip" : upSoft ? "yukarı eğilimli" : dnSoft ? "aşağı eğilimli" : "karışık / sıkışma",
      vote: up || upSoft ? 1 : dn || dnSoft ? -1 : 0,
    });
  } else factors.push({ label: "Yapı (3 mum)", value: "yetersiz mum", vote: 0 });

  // 5) Hacim akışı: son ≤6 mumda alıcı payı
  let buy = 0, tot = 0;
  for (let k = Math.max(0, i - FLOW_BARS + 1); k <= i; k++) {
    const x = s.bars[k];
    const vol = x.volume || 0;
    const rg = x.high - x.low;
    buy += vol * (rg > 0 ? (x.close - x.low) / rg : 0.5);
    tot += vol;
  }
  const buyShare = tot > 0 ? buy / tot : null;
  factors.push({
    label: "Hacim akışı",
    value: buyShare == null ? "veri yok" : `alıcı %${Math.round(buyShare * 100)} · satıcı %${Math.round((1 - buyShare) * 100)}`,
    vote: buyShare == null ? 0 : buyShare >= 0.58 ? 1 : buyShare <= 0.42 ? -1 : 0,
  });

  // 6) Son mum + hacim teyidi
  const prior = s.bars.slice(Math.max(0, i - 10), i).map((x) => x.volume || 0);
  const avg = prior.length >= 3 ? prior.reduce((a, x) => a + x, 0) / prior.length : 0;
  const volRatio = avg > 0 ? (b.volume || 0) / avg : null;
  const bodyPct = Math.abs(b.close - b.open) / Math.max(0.01, b.high - b.low);
  const col: -1 | 0 | 1 = bodyPct < 0.15 ? 0 : b.close > b.open ? 1 : -1;
  const strongVol = volRatio != null && volRatio >= 1.2;
  factors.push({
    label: "Son mum",
    value: `${col > 0 ? "yeşil" : col < 0 ? "kırmızı" : "doji"} · hacim ${volRatio == null ? fmtVol(b.volume || 0) : `${volRatio.toFixed(1)}×`}${col !== 0 ? (strongVol ? " → hacimle teyitli" : " → hacim teyidi yok") : ""}`,
    vote: col !== 0 && strongVol ? col : 0,
  });

  const score = factors.reduce((a, f) => a + f.vote, 0);
  const dir: Dir3 = score >= 3 ? "UP" : score <= -3 ? "DOWN" : "FLAT";
  const label =
    score >= 5 ? "GÜÇLÜ YUKARI" : score >= 3 ? "YUKARI"
    : score <= -5 ? "GÜÇLÜ AŞAĞI" : score <= -3 ? "AŞAĞI"
    : score > 0 ? "YATAY · alıcı önde" : score < 0 ? "YATAY · satıcı önde" : "YATAY · denge";

  return { tf, time: b.time, clock: nyClock(b.time), close: b.close, score, dir, label, vwap: v, ema: e, buyShare, volRatio, factors };
}

export interface PlanSide {
  /** 5m KAPANIŞ bu seviyenin ötesinde olursa giriş */
  trigger: number;
  stop: number | null;
  target: number | null;
  targetLabel: string | null;
  /** (hedef − tetik) / (tetik − stop) */
  rr: number | null;
}

export interface DecisionRead {
  r5: TfRead | null;
  r15: TfRead | null;
  /** Bir önceki kapanmış 5m mumun skoru (değişim yönü için) */
  prev5: number | null;
  /** Son ≤12 kapanmış 5m mumun skor geçmişi (eskiden yeniye) */
  history5: { clock: string; score: number }[];
  day: {
    open: number;
    high: number;
    low: number;
    /** Fiyatın gün aralığındaki konumu 0 (dip) – 1 (tepe) */
    rangePos: number | null;
    vsOpen: number;
    vsVwap: number | null;
    /** Seans boyu tahmini alıcı hacmi payı */
    buyShare: number | null;
    dir: Dir3;
    text: string;
  };
  action: "LONG" | "SHORT" | "BEKLE";
  /** BEKLE iken hangi tarafa yatkın */
  lean: "LONG" | "SHORT" | null;
  title: string;
  why: string[];
  /** Bir sonraki kapanışta neye bakılacağı */
  watch: string[];
  long: PlanSide;
  short: PlanSide;
}

/**
 * Tek bakışta karar: 5m (karar mumu) + 15m (yön teyidi) + gün geneli.
 * Motorun giriş kurallarına (strategy.ts) dokunmaz — sunum katmanıdır;
 * tetik/stop/hedef seviyeleri ekrandaki ölçülmüş seviyelerden türetilir
 * (tetik: son kapanmış 5m tepe/dibi, VWAP ve EMA20'nin ötesi · stop: Trend
 * Stop Bölgesi · hedef: tahmin haritasındaki ilk direnç/destek).
 */
export function decisionRead(input: {
  s5: DaySeries;
  s15: DaySeries;
  ema5: EmaMap;
  ema15: EmaMap;
  price: number | null;
  vwapNow: number | null;
  opening: OpeningRegime;
  stops: StopZones | null;
  supports: MapLevel[];
  resistances: MapLevel[];
}): DecisionRead | null {
  const { s5, s15, ema5, ema15, price, vwapNow, opening, stops, supports, resistances } = input;
  const n5 = s5.bars.length;
  if (!n5) return null;
  const r5 = tfRead(s5, "5m", ema5);
  const r15 = tfRead(s15, "15m", ema15);
  const history5: DecisionRead["history5"] = [];
  for (let i = Math.max(0, n5 - 12); i < n5; i++) {
    const r = tfRead(s5, "5m", ema5, i);
    if (r) history5.push({ clock: r.clock, score: r.score });
  }
  const prev5 = history5.length >= 2 ? history5[history5.length - 2].score : null;

  // — gün geneli —
  const px = price ?? s5.bars[n5 - 1].close;
  const open = s5.bars[0].open;
  let high = px, low = px, buy = 0, tot = 0;
  for (const x of s5.bars) {
    high = Math.max(high, x.high);
    low = Math.min(low, x.low);
    const rg = x.high - x.low;
    buy += (x.volume || 0) * (rg > 0 ? (x.close - x.low) / rg : 0.5);
    tot += x.volume || 0;
  }
  const rangePos = high > low ? (px - low) / (high - low) : null;
  const vsOpen = px - open;
  const vsVwap = vwapNow != null ? px - vwapNow : null;
  const dayBuy = tot > 0 ? buy / tot : null;
  let dv = 0;
  dv += vsOpen > 0.05 ? 1 : vsOpen < -0.05 ? -1 : 0;
  dv += vsVwap == null ? 0 : vsVwap > AT_EPS ? 1 : vsVwap < -AT_EPS ? -1 : 0;
  dv += dayBuy == null ? 0 : dayBuy >= 0.55 ? 1 : dayBuy <= 0.45 ? -1 : 0;
  dv += opening.side === "UP" ? 1 : opening.side === "DOWN" ? -1 : 0;
  const dayDir: Dir3 = dv >= 2 ? "UP" : dv <= -2 ? "DOWN" : "FLAT";
  const dayText =
    `Açılışa göre ${sgn(vsOpen)}, VWAP'a göre ${vsVwap == null ? "—" : sgn(vsVwap)}, gün aralığında %${rangePos == null ? "—" : Math.round(rangePos * 100)} konumda` +
    `${dayBuy == null ? "" : `, seans alıcı hacmi %${Math.round(dayBuy * 100)}`} · açılış rejimi ${opening.label}.`;

  // — karar —
  const d5 = r5?.dir ?? "FLAT", d15 = r15?.dir ?? "FLAT";
  const why: string[] = [];
  const watch: string[] = [];
  let action: DecisionRead["action"] = "BEKLE";
  let lean: DecisionRead["lean"] = null;
  let title: string;
  const tr = (d: Dir3) => (d === "UP" ? "YUKARI" : d === "DOWN" ? "AŞAĞI" : "YATAY");
  const sc = (x: number) => `${x > 0 ? "+" : ""}${x}/${FACTOR_MAX}`;

  if (r5 && r15 && d5 !== "FLAT" && d5 === d15) {
    action = d5 === "UP" ? "LONG" : "SHORT";
    title = `${action} TARAFI — 5m ve 15m birlikte ${tr(d5)}`;
    why.push(`5m skor ${sc(r5.score)} ve 15m skor ${sc(r15.score)} aynı yönde.`);
    if (dayDir === d5) why.push("Gün geneli de aynı yönde — trend günü lehine.");
    else if (dayDir !== "FLAT") why.push(`Dikkat: gün geneli ${tr(dayDir)} — ana trende karşı işlem, hedefi kısa tut.`);
    watch.push(`Giriş: 5m mum ${action === "LONG" ? "LONG tetiğinin üstünde" : "SHORT tetiğinin altında"} kapanırsa. Ters yönde 5m kapanış VWAP/EMA20'nin ${action === "LONG" ? "altına" : "üstüne"} inerse senaryo zayıflar.`);
  } else if (d15 !== "FLAT" && d5 === "FLAT") {
    lean = d15 === "UP" ? "LONG" : "SHORT";
    title = `BEKLE — 15m ${tr(d15)}, 5m dinleniyor (${lean} yatkın)`;
    why.push(`Ana yön (15m) ${tr(d15)}; 5m kararsız → geri çekilme ya da sıkışma.`);
    watch.push(`5m mum ${lean === "LONG" ? "LONG tetiğinin üstünde" : "SHORT tetiğinin altında"} kapanırsa ${lean} teyit olur.`);
  } else if (d15 !== "FLAT" && d5 !== "FLAT" && d5 !== d15) {
    lean = d15 === "UP" ? "LONG" : "SHORT";
    title = `BEKLE — 15m ${tr(d15)} ama 5m ${tr(d5)} (geri çekilme)`;
    why.push("5m ana yönün (15m) tersine dönmüş — geri çekilme ya da dönüş başlangıcı.");
    watch.push(`5m, EMA20/VWAP'ta tutunup ${lean === "LONG" ? "yeşil" : "kırmızı"} kapanırsa ${lean} fırsatı; 15m de ${tr(d5)} dönerse yön değişti demektir.`);
  } else if (d15 === "FLAT" && d5 !== "FLAT") {
    lean = d5 === "UP" ? "LONG" : "SHORT";
    title = `BEKLE — yalnızca 5m ${tr(d5)}, 15m teyidi yok`;
    why.push("Kısa vadeli hareket var ama 15m henüz katılmadı — hareket erken ya da zayıf.");
    watch.push(`Bir sonraki 15m kapanış VWAP + EMA20 ${d5 === "UP" ? "üstünde" : "altında"} olursa ${lean} teyitli olur.`);
  } else {
    title = "BEKLE — 5m ve 15m yatay, net yön yok";
    why.push("İki zaman dilimi de kararsız: fiyat VWAP/EMA20 etrafında gidip geliyor.");
    watch.push("Aralık kırılımını bekle: 5m kapanış LONG ya da SHORT tetiğinin ötesine geçmeli.");
  }

  // hacim / momentum uyarıları
  if (r5?.buyShare != null) {
    if (d5 === "UP" && r5.buyShare < 0.45) why.push(`Uyarı: fiyat yukarı ama son ${FLOW_BARS} mumda hacim satıcı ağırlıklı (%${Math.round((1 - r5.buyShare) * 100)}) — yükseliş zayıf.`);
    if (d5 === "DOWN" && r5.buyShare > 0.55) why.push(`Uyarı: fiyat aşağı ama son ${FLOW_BARS} mumda hacim alıcı ağırlıklı (%${Math.round(r5.buyShare * 100)}) — düşüş zayıf, dip alımı olabilir.`);
  }
  if (r5?.volRatio != null && r5.volRatio <= 0.6) why.push("Son 5m mumun hacmi ortalamanın çok altında — hareket inandırıcı değil.");
  if (prev5 != null && r5) {
    const dlt = r5.score - prev5;
    if (dlt >= 2) why.push(`Momentum alıcıya dönüyor: 5m skor ${prev5} → ${r5.score}.`);
    else if (dlt <= -2) why.push(`Momentum satıcıya dönüyor: 5m skor ${prev5} → ${r5.score}.`);
  }

  // — plan (tetik / stop / hedef) —
  const last5 = s5.bars[n5 - 1];
  const v5 = s5.vwap[n5 - 1];
  const e5 = ema5.get(last5.time) ?? null;
  const ups = [last5.high, v5, e5].filter((x): x is number => x != null);
  const dns = [last5.low, v5, e5].filter((x): x is number => x != null);
  const longTrig = r2(Math.max(...ups) + 0.01);
  const shortTrig = r2(Math.min(...dns) - 0.01);
  const pick = (list: MapLevel[], beyond: number, up: boolean) =>
    list
      .filter((l) => (up ? l.price > beyond + 0.1 : l.price < beyond - 0.1))
      .sort((a, b) => (up ? a.price - b.price : b.price - a.price))[0] ?? null;
  const tL = pick(resistances, longTrig, true);
  const tS = pick(supports, shortTrig, false);
  const sL = stops?.long && stops.long.stop < longTrig ? stops.long.stop : null;
  const sS = stops?.short && stops.short.stop > shortTrig ? stops.short.stop : null;
  const long: PlanSide = {
    trigger: longTrig, stop: sL, target: tL?.price ?? null, targetLabel: tL?.label ?? null,
    rr: tL && sL != null ? r2((tL.price - longTrig) / (longTrig - sL)) : null,
  };
  const short: PlanSide = {
    trigger: shortTrig, stop: sS, target: tS?.price ?? null, targetLabel: tS?.label ?? null,
    rr: tS && sS != null ? r2((shortTrig - tS.price) / (sS - shortTrig)) : null,
  };
  const side = action !== "BEKLE" ? action : lean;
  const plan = side === "LONG" ? long : side === "SHORT" ? short : null;
  if (plan?.rr != null && plan.rr < 1) watch.push(`Risk/ödül zayıf (${plan.rr.toFixed(1)}R): hedef stoba göre yakın — girişi geri çekilmeye sakla ya da pas geç.`);

  return {
    r5, r15, prev5, history5,
    day: { open, high, low, rangePos, vsOpen: r2(vsOpen), vsVwap: vsVwap == null ? null : r2(vsVwap), buyShare: dayBuy, dir: dayDir, text: dayText },
    action, lean, title, why, watch, long, short,
  };
}
