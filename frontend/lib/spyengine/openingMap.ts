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

export type Tf = "5m" | "15m" | "30m";
export type VwapSide = "ABOVE" | "BELOW" | "AT";

const SPAN: Record<Tf, number> = { "5m": 300, "15m": 900, "30m": 1800 };
const AT_EPS = 0.02;

const sideOf = (close: number, vwap: number | null): VwapSide | null =>
  vwap == null ? null : Math.abs(close - vwap) <= AT_EPS ? "AT" : close > vwap ? "ABOVE" : "BELOW";

const fmt = (n: number, d = 2) => n.toFixed(d);
const num2 = (n: number) => n.toFixed(2);
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

export interface OpeningVote {
  label: string;
  value: string;
  /** Ağırlıklı oy: + yükseliş · − düşüş */
  vote: number;
}

export type StageDir = "UP" | "DOWN" | "MIXED";

/** Açılış aşaması — 09:35'ten 10:00'a her kapanışta neyin bilindiği (şeffaf) */
export interface OpeningStage {
  /** "09:35" … "10:00" — aşamanın tamamlandığı an (mum kapanışı) */
  clock: string;
  title: string;
  /** null: henüz kapanmadı · MIXED: zaman dilimleri uyuşmuyor */
  dir: StageDir | null;
  detail: string;
  /** Ölçülmüş isabet (59 seans, 60 dk sonra / kapanışta); günlük kayıtla güncellenir */
  hit60: number;
  hitClose: number;
  /** Bu aşama kararı belirleyen aşama mı */
  decisive: boolean;
  /** Atlandı (önceki aşama kararı verdi) */
  skipped?: boolean;
}

/** Aşamaların ölçülmüş isabetleri (2026-07 → 10, 59 seans). Günlük kayıt N≥20 olunca bunların yerine geçer. */
export const STAGE_BASE: Record<string, { hit60: number; hitClose: number }> = {
  "09:35": { hit60: 39, hitClose: 44 },
  "09:40": { hit60: 45, hitClose: 45 },
  "09:45": { hit60: 47, hitClose: 47 },
  "09:50": { hit60: 54, hitClose: 54 },
  "09:55": { hit60: 47, hitClose: 59 },
  "10:00": { hit60: 83, hitClose: 50 },
  EMA: { hit60: 60, hitClose: 40 },
};

export interface OpeningRegime {
  /** WAITING: 09:35'ten önce · FORMING: 09:35–09:55 (09:55 kararsızsa 10:00'a kadar) · LOCKED: karar verildi */
  status: "WAITING" | "FORMING" | "LOCKED";
  side: OpeningSide | null;
  /** FORMING iken son aşamanın geçici yönü (işlem kararı değil) */
  provisional: StageDir | null;
  /** Kural tam sağlanmadıysa EMA20 tarafından gelen yön (side bununla doldurulur, weak = true) */
  lean: "UP" | "DOWN" | null;
  weak: boolean;
  strength: "GÜÇLÜ" | "NORMAL" | "ZAYIF" | null;
  /** Kararı veren aşama */
  decidedAt: "09:55" | "10:00" | "EMA" | null;
  /** Açılış gap'i (09:30 açılış − dünkü kapanış) ve karar yönüyle uyumu — dünkü kapanış verilmediyse null */
  gap: { pts: number; agree: boolean } | null;
  /** 10:00 kuralının (30m + 15m 09:45 + ≥4/6 5m) bugünkü okuması — 09:55 kararı verilmiş olsa da hesaplanır */
  check10: "AYNI" | "TERS" | "YOK" | null;
  /** 09:55'te netlik yetersiz (kural teyitsiz ya da yok) → 10:00 30m kapanışı beklenmeli */
  waitFor10: boolean;
  /** İlk 2–3 saat güveni: kararın tipine göre ölçülmüş okuma (yön DEĞİŞTİRMEZ) */
  dayHold: { level: "YÜKSEK" | "ORTA" | "DÜŞÜK"; text: string } | null;
  stages: OpeningStage[];
  label: string;
  summary: string;
  score: number;
  maxScore: number;
  votes: OpeningVote[];
  closes5: { clock: string; side: VwapSide | null; close: number }[];
  closes15: { clock: string; side: VwapSide | null; close: number }[];
}

const OPEN_WINDOW_END = 10 * 60; // 10:00

/**
 * Açılış rejimi — kullanıcının aşamalı okuması (59 seansla ölçüldü):
 *   09:35  ilk 5m kapanışı VWAP'a göre            → izleme (%39 — tek başına TERS çalışıyor)
 *   09:40  2×5m aynı tarafta mı                    → izleme (%45)
 *   09:45  15m kapanışı VWAP'a göre                → izleme (%47)
 *   09:50  15m + 5m 09:50 aynı mı                  → güçlenen okuma (%54)
 *   09:55  15m + 5m 09:50 + 09:55 aynı → KARAR     (kapanışta %59, +0,64 puan)
 *   10:00  09:55 kararsızsa: 30m + son 15m + 6×5m'nin ≥4'ü aynı → KARAR (60 dk %83, n=12)
 *          o da yoksa EMA20 tarafı (ZAYIF, 60 dk %60)
 * Teyit (yalnız 09:55): 5m EMA20 ve hacim aynı yöndeyse GÜÇLÜ.
 * İsabetler `stageStats` ile (günlük kayıttan) güncellenebilir.
 */
export function openingRegime(
  m5: DaySeries, m15: DaySeries, ema5?: EmaMap | null, m30?: DaySeries | null,
  stageStats?: Record<string, { hit60: number; hitClose: number }> | null,
  prevClose?: number | null,
): OpeningRegime {
  const win5 = m5.bars.map((b, i) => ({ b, v: m5.vwap[i] })).filter((x) => nyParts(x.b.time).minutes < OPEN_WINDOW_END);
  const win15 = m15.bars.map((b, i) => ({ b, v: m15.vwap[i] })).filter((x) => nyParts(x.b.time).minutes < OPEN_WINDOW_END);
  const c30 = m30?.bars.length && nyParts(m30.bars[0].time).minutes === 9 * 60 + 30 ? { b: m30.bars[0], v: m30.vwap[0] } : null;

  const closes5 = win5.map((x) => ({ clock: nyClock(x.b.time), side: sideOf(x.b.close, x.v), close: x.b.close }));
  const closes15 = win15.map((x) => ({ clock: nyClock(x.b.time), side: sideOf(x.b.close, x.v), close: x.b.close }));
  const base = { closes5, closes15 };
  const dOf = (s: VwapSide | null) => (s === "ABOVE" ? 1 : s === "BELOW" ? -1 : 0);
  const sd5 = (i: number) => (closes5[i] ? dOf(closes5[i].side) : null);
  const sd15 = (i: number) => (closes15[i] ? dOf(closes15[i].side) : null);
  const same = (...xs: (number | null)[]): number | null => (xs.some((x) => x == null) ? null : xs.every((x) => x !== 0 && x === xs[0]) ? (xs[0] as number) : 0);
  const asDir = (x: number | null): StageDir | null => (x == null ? null : x > 0 ? "UP" : x < 0 ? "DOWN" : "MIXED");
  const where = (x: number | null) => (x == null ? "bekleniyor" : x > 0 ? "VWAP üstü" : x < 0 ? "VWAP altı" : "VWAP'ta");
  const st = (k: string) => stageStats?.[k] ?? STAGE_BASE[k];

  // — aşamalar —
  const s1 = sd5(0), s2 = same(sd5(0), sd5(1)), s3 = sd15(0), s4 = same(sd15(0), sd5(3)), s5 = same(sd15(0), sd5(3), sd5(4));
  const six = [0, 1, 2, 3, 4, 5].map(sd5);
  const up6 = six.filter((x) => x === 1).length, dn6 = six.filter((x) => x === -1).length;
  const s30 = c30 ? dOf(sideOf(c30.b.close, c30.v)) : null;
  const s6 = six.some((x) => x == null) || s30 == null || sd15(1) == null ? null
    : s30 !== 0 && s30 === sd15(1) && ((s30 > 0 && up6 >= 4) || (s30 < 0 && dn6 >= 4)) ? s30 : 0;
  const ruleDecided = s5 != null && s5 !== 0;

  const stages: OpeningStage[] = [
    { clock: "09:35", title: "İlk 5m", dir: asDir(s1), detail: `09:30 mumu ${where(s1)}`, ...st("09:35"), decisive: false },
    { clock: "09:40", title: "2×5m", dir: asDir(s2), detail: `09:30 ${where(sd5(0))} · 09:35 ${where(sd5(1))}`, ...st("09:40"), decisive: false },
    { clock: "09:45", title: "15m", dir: asDir(s3), detail: `15m (09:30–09:45) ${where(s3)}`, ...st("09:45"), decisive: false },
    { clock: "09:50", title: "15m + 5m", dir: asDir(s4), detail: `15m ${where(s3)} · 5m 09:45 ${where(sd5(3))}`, ...st("09:50"), decisive: false },
    { clock: "09:55", title: "Büyük resim", dir: asDir(s5), detail: `15m ${where(s3)} · 5m 09:50 ${where(sd5(3))} · 5m 09:55 ${where(sd5(4))}`, ...st("09:55"), decisive: ruleDecided },
    {
      clock: "10:00", title: "30m teyidi", dir: ruleDecided ? null : asDir(s6), skipped: ruleDecided,
      detail: ruleDecided ? "09:55 kararı verildi — gerekmedi" : `30m ${where(s30)} · 15m 09:45 ${where(sd15(1))} · 6×5m ${up6} üst / ${dn6} alt`,
      ...st("10:00"), decisive: !ruleDecided && s6 != null && s6 !== 0,
    },
  ];

  if (!closes5.length) {
    return {
      ...base, status: "WAITING", side: null, provisional: null, lean: null, weak: false, strength: null, decidedAt: null, gap: null, dayHold: null, check10: null, waitFor10: false, stages,
      label: "BEKLENİYOR", score: 0, maxScore: 3, votes: [],
      summary: "09:35'te ilk 5m kapanışıyla okuma başlar; 09:45 15m, 09:55 büyük resim (karar), gerekirse 10:00 30m teyidi.",
    };
  }

  // teyitler (09:55 kararı için)
  const last = win5[win5.length - 1].b;
  const e = ema5?.get(last.time) ?? null;
  const dE = e == null ? 0 : Math.sign(last.close - e);
  const recent = win5.slice(3).map((x) => x.b);
  const volDir = Math.sign(recent.reduce((a, b) => a + (b.close > b.open ? b.volume : b.close < b.open ? -b.volume : 0), 0));

  let side: OpeningSide = "UNCERTAIN";
  let status: OpeningRegime["status"] = "FORMING";
  let decidedAt: OpeningRegime["decidedAt"] = null;
  let strength: OpeningRegime["strength"] = null;
  let weak = false;
  let lean: OpeningRegime["lean"] = null;

  // açılış gap'i: 09:30 açılışı − dünkü kapanış
  const open0 = m5.bars.length ? m5.bars[0].open : null;
  const gapPts = open0 != null && prevClose != null && Number.isFinite(prevClose) ? Math.round((open0 - prevClose) * 100) / 100 : null;
  const gapDir = gapPts == null ? null : Math.sign(gapPts);

  if (ruleDecided) {
    side = s5! > 0 ? "UP" : "DOWN";
    status = "LOCKED";
    decidedAt = "09:55";
    // GÜÇLÜ = EMA20 + hacim + gap aynı yönde (gap bilinmiyorsa eskisi gibi EMA + hacim).
    // 58 seans: bu üçlü teyitle 3 saat sonra yönde %80 (ort. +2,0, iki yarıda da olumlu);
    // teyidi eksik 09:55 kararları 2 saatte %44.
    strength = dE === s5 && volDir === s5 && (gapDir == null || gapDir === s5) ? "GÜÇLÜ" : "NORMAL";
  } else if (s5 === 0 && dE !== 0) {
    // 09:55 belirsiz: EMA20 tarafı ZAYIF yön olarak hemen verilir (erken pozisyon için);
    // 10:00'da 30m teyidi aynıysa NORMAL'e yükselir, net TERS ise yön çevrilir.
    // 60 seans: bu sıra +31,9 puan; 10:00'ı beklemek +22,9; 30m'yi yalnız uyarı yapmak +32,5.
    side = dE > 0 ? "UP" : "DOWN";
    status = "LOCKED";
    weak = true;
    lean = side;
    decidedAt = "EMA";
    strength = "ZAYIF";
    if (s6 != null && s6 !== 0) {
      side = s6 > 0 ? "UP" : "DOWN";
      weak = false;
      lean = null;
      decidedAt = "10:00";
      strength = "NORMAL";
    }
  } else if (s6 != null) {
    status = "LOCKED";
    if (s6 !== 0) {
      side = s6 > 0 ? "UP" : "DOWN";
      decidedAt = "10:00";
      strength = "NORMAL";
    } else if (dE !== 0) {
      side = dE > 0 ? "UP" : "DOWN";
      lean = side;
      weak = true;
      decidedAt = "EMA";
      strength = "ZAYIF";
    }
  }

  // geçici yön: en son tamamlanan aşamanın yönü
  const done = stages.filter((s) => s.dir != null && !s.skipped);
  const provisional = status === "FORMING" && done.length ? (done[done.length - 1].dir as StageDir) : null;

  const votes: OpeningVote[] = [
    { label: "15m 09:45 / VWAP", value: where(s3), vote: s3 ?? 0 },
    { label: "5m 09:50 / VWAP", value: where(sd5(3)), vote: sd5(3) ?? 0 },
    { label: "5m 09:55 / VWAP", value: where(sd5(4)), vote: sd5(4) ?? 0 },
    { label: "EMA20 (5m)", value: e == null ? "—" : `${dE > 0 ? "üstünde" : dE < 0 ? "altında" : "üzerinde"} (${fmt(e)})`, vote: dE },
  ];
  if (recent.length) votes.push({ label: "Hacim (09:45 sonrası)", value: volDir > 0 ? "alıcı ağır" : volDir < 0 ? "satıcı ağır" : "dengede", vote: volDir });

  const word = side === "UP" ? "YÜKSELİŞ" : side === "DOWN" ? "DÜŞÜŞ" : "BELİRSİZ";
  const provWord = provisional === "UP" ? "yukarı" : provisional === "DOWN" ? "aşağı" : "karışık";
  const label = status === "FORMING" ? `ÖN OKUMA · ${provWord}` : weak ? `${word} (EMA20)` : word;
  const nextStage = stages.find((s) => s.dir == null && !s.skipped);
  const summary =
    status === "LOCKED"
      ? decidedAt === "09:55"
        ? `09:55 kararı: 15m + 5m 09:50 + 09:55 VWAP'ın ${s5! > 0 ? "üstünde" : "altında"} → ${word}${strength === "GÜÇLÜ" ? " · EMA20 ve hacim de teyit ediyor (GÜÇLÜ)" : ""}.`
        : decidedAt === "10:00"
          ? `09:55'te belirsizdi (EMA20 ${dE > 0 ? "yukarı" : dE < 0 ? "aşağı" : "nötr"}); 10:00 30m + 15m + 6×5m VWAP'ın ${side === "UP" ? "üstünde" : "altında"} → ${word}${dE !== 0 && dE !== (side === "UP" ? 1 : -1) ? " (yön ÇEVRİLDİ)" : " (teyit edildi)"}.`
          : decidedAt === "EMA"
            ? s6 == null
              ? `09:55 belirsiz → şimdilik EMA20 tarafı: ${word} (ZAYIF). 10:00 30m kapanışı teyit edecek ya da çevirecek.`
              : `09:55 ve 10:00 aşamaları yön vermedi → EMA20 tarafı: ${word} (ZAYIF).`
            : "09:55 ve 10:00 aşamaları yön vermedi, fiyat EMA20 üzerinde — yönsüz açılış."
      : `Ön okuma (${done.length ? done[done.length - 1].clock : "—"}): ${provWord}. ${nextStage ? `Sonraki aşama ${nextStage.clock} (${nextStage.title}).` : ""} Erken aşamalar tek başına güvenilir değil — karar 09:55'te${s5 === 0 ? ", bugün 10:00 30m teyidi bekleniyor" : ""}.`;

  // — 10:00 kuralı her gün okunur (09:55 kararı verilmiş olsa da) —
  const r10 = six.some((x) => x == null) || s30 == null || sd15(1) == null ? null
    : s30 !== 0 && s30 === sd15(1) && ((s30 > 0 && up6 >= 4) || (s30 < 0 && dn6 >= 4)) ? s30 : 0;
  const sideN = side === "UP" ? 1 : side === "DOWN" ? -1 : 0;
  const check10: OpeningRegime["check10"] = r10 == null || sideN === 0 ? null : r10 === 0 ? "YOK" : r10 === sideN ? "AYNI" : "TERS";
  // 09:55'te yeterli netlik = kural + EMA20 + hacim + gap (GÜÇLÜ). Değilse 10:00 30m kapanışı beklenir.
  const waitFor10 = closes5.length >= 5 && !(decidedAt === "09:55" && strength === "GÜÇLÜ") && r10 == null;

  // — ilk 2–3 saat güveni (yön değiştirmez; hedef ufku karardan sonraki 2–3 saat, sonrası seans içinde yeniden yön) —
  // 58 seans, 5m: karar fiyatından +2s / +3s yönde kapanış ve "önce +1,5 mi −1,5 mi geldi"
  const gap = gapPts != null && sideN !== 0 ? { pts: gapPts, agree: gapDir === sideN } : null;
  const missing: string[] = [];
  if (sideN !== 0) {
    if (dE !== sideN) missing.push("EMA20 ters/nötr");
    if (volDir !== sideN) missing.push("hacim ters/dengede");
    if (gapDir != null && gapDir !== sideN) missing.push("gap ters");
  }
  let dayHold: OpeningRegime["dayHold"] = null;
  if (waitFor10) {
    dayHold = { level: "ORTA", text: decidedAt === "09:55"
      ? `09:55 kuralı oluştu ama teyitsiz (eksik: ${missing.join(", ") || "—"}) → NETLİK YETERSİZ: 10:00 30m kapanışını bekle. Geçmişte bu günlerde 09:55'te girmek 2 saatte %44, önce −1,5 puan %56.`
      : "09:55'te netlik yok → 10:00 30m kapanışını bekle. 10:00 kuralı (30m + 15m + 6×5m aynı taraf) oluşursa geçmişte 2 saatte yönde %72, önce −1,5 puan yalnız %22 (18 gün)." };
  } else if (status === "LOCKED" && sideN !== 0) {
    if (decidedAt === "09:55" && strength === "GÜÇLÜ")
      dayHold = { level: "YÜKSEK", text: `09:55 NET: kural + EMA20 + hacim + gap aynı yönde → 10:00'ı beklemek gerekmez. Geçmişte 3 saat sonra yönde %80 (ort. +2,0 puan), önce +1,5 %70 / önce −1,5 %30 (10 gün).${check10 === "TERS" ? " ⚠ 10:00 kuralı TERS okuyor — stopu sıkılaştır." : ""}` };
    else if (decidedAt === "09:55" && check10 === "TERS")
      dayHold = { level: "DÜŞÜK", text: "09:55 kuralı teyitsizdi ve 10:00 30m TERS okuyor → ÇELİŞKİ: açılış yönü yok say, gün içi bacak tetiğini bekle." };
    else if (decidedAt === "09:55")
      dayHold = { level: "ORTA", text: `09:55 kuralı teyitsiz${check10 === "AYNI" ? ", 10:00 aynı yönü gösterdi" : ", 10:00 kuralı oluşmadı"} → dikkat: geçmişte bu günlerde 10:00 teyidi isabeti artırmadı (2 saatte %47, önce −1,5 puan %60; 15 gün). Küçük pozisyon, VWAP/EMA20 geri çekilmesinde gir, ilk hedefte kâr al.` };
    else if (decidedAt === "10:00")
      dayHold = { level: "YÜKSEK", text: "10:00 KARARI: 09:55'te netlik yoktu, 30m + 15m + 6×5m aynı tarafta kapandı → geçmişte 2 saat sonra yönde %72, önce −1,5 puan yalnız %22 (18 gün). Hedef 2–3 saat içinde." };
    else
      dayHold = { level: "DÜŞÜK", text: "Yön yalnız EMA20 tarafından (09:55 ve 10:00 kuralı oluşmadı) → geçmişte 2 saat sonra yönde %50, 3 saatte %38 (16 gün). Yön yok say; gün içi bacak tetiğini bekle." };
  }

  return {
    ...base, status, side, provisional, lean, weak, strength, decidedAt, gap, dayHold, check10, waitFor10, stages, label,
    score: votes.reduce((a, v) => a + v.vote, 0), maxScore: votes.length, votes, summary,
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
  /** 30m + 15m birlikte aynı yöndeyse gün içi gidişat — açılış rejiminden önceliklidir */
  trend?: "UP" | "DOWN" | null;
  /** Ek ölçülmüş seviyeler (POC/VAH/VAL, süpürülmemiş likidite havuzları) */
  extra?: MapLevel[];
  /** Seans oyun planının yönü (karar paneliyle aynı) — verilirse diğer yön kaynaklarından önceliklidir */
  playBias?: { bias: "UP" | "DOWN" | "FLAT"; text: string; alt?: string[] } | null;
  /** Gün ortası aralık dilimi (10:30–14:00, trend günü değil): harita aralık / VWAP'a dönüş senaryosu çizer */
  rangeMode?: boolean;
  /** Erken uyarı (flow.ts) — başlamış/biriken hareketin yönü */
  early?: { side: "LONG" | "SHORT" | null; level: "STARTED" | "BUILDING" | "NONE"; headline: string } | null;
}): ForecastMapData | null {
  const { price, vwap, date, nowSec, opening, live, levels, forecast, trend, extra, early, rangeMode, playBias } = input;
  if (!Number.isFinite(price)) return null;

  const closeSec = nyDateTimeToEpoch(date, RTH_CLOSE_MIN);
  const openSec = nyDateTimeToEpoch(date, RTH_OPEN_MIN);
  const t0 = Math.min(Math.max(nowSec, openSec), closeSec);

  // — bias —
  let bias: ForecastMapData["bias"] = "FLAT";
  let biasText = "Yön belirsiz — fiyat VWAP etrafında; aralık senaryosu.";
  if (playBias) {
    bias = playBias.bias;
    biasText = playBias.text;
  } else if (rangeMode) {
    biasText = "Gün ortası aralık dilimi (10:30–14:00): fiyat VWAP etrafında salınır — uçlardan VWAP'a dönüş senaryosu.";
  } else if (trend) {
    bias = trend;
    biasText = `30m ve 15m gidişat ${trend === "UP" ? "yukarı" : "aşağı"} (açılış rejimi ${opening.label}) → ${trend === "UP" ? "yükseliş" : "düşüş"} senaryosu.`;
  } else if (early?.side && early.level !== "NONE") {
    bias = early.side === "LONG" ? "UP" : "DOWN";
    biasText = `Erken uyarı: ${early.headline} → ${bias === "UP" ? "yukarı" : "aşağı"} senaryo (30m henüz teyit etmedi).`;
  } else if ((opening.side === "UP" || opening.side === "DOWN") && nyParts(nowSec).minutes < 11 * 60 + 30) {
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
  // ek seviyeler yalnızca yakın çevrede (uzak bir havuz ölçeği germesin)
  const reach = Math.max(4, (levels?.hourlyRange ?? DEFAULT_HOURLY) * 4);
  // opsiyon duvarları / max pain daha geniş çevrede hedef olabilir (8 puan ≈ %1)
  for (const l of extra ?? []) {
    const isOpt = /duvarı|Max pain/.test(l.label);
    if (Math.abs(l.price - price) <= (isOpt ? Math.max(reach, 8) : reach)) add(l.price, l.label);
  }
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

  // senaryo takibi varsa iptal/bozulma koşulları O sistemin (15m kapanış) koşullarıdır — eski 5m-VWAP iptali değil
  const altOut = playBias?.alt && playBias.alt.length ? playBias.alt : alt;
  return { bias, biasText, price, vwap, supports, resistances, path, closeExpect, closeLow, closeHigh, steps, alt: altOut };
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
  const slopeEps = tf === "5m" ? 0.03 : tf === "15m" ? 0.05 : 0.08;
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
  /** Tetikten hedefe tahmini süre (dk) — ortalama saatlik hareketten (haritanın yolculuk hesabıyla aynı) */
  etaMin: number | null;
  /** Sıkı stop: son 2 kapanmış 5m mumun dibi/tepesi ± 0,05 (agresif giriş için) */
  tightStop: number;
  rrTight: number | null;
}

/**
 * Seans dilimi — 18 seanslık geriye dönük ölçümle (2026-09-08 → 10-01, 5 dk
 * adım, 30/60 dk ileri getiri) belirlendi:
 *   - Sabah: açılış rejimi yönü işe yarıyor AMA kovalamak değil, geri çekilmede
 *     girmek (5m ters/yatay ya da fiyat VWAP'ın yanlış tarafında: %55-60,
 *     +0,4-0,6 puan / 60 dk). Kovalamak %50.
 *   - Öğlen (11:30-14:00): trend sinyalleri TERS çalışıyor (5m yönü %40, VWAP
 *     %42, değer alanı dışı %37) → ortalamaya dönüş: VWAP'tan ≥1 ATR₅ ya da
 *     değer alanı dışı → VWAP/POC'a doğru (%60-63). Aralık içinde işlem yok.
 *   - Öğleden sonra (14:00+): momentum geri geliyor — fiyat VWAP ve POC'un aynı
 *     tarafındaysa o yönde (%56, +0,19 puan / 30 dk).
 * Örneklem küçüktür (18 gün); kurallar bilinen gün içi davranışla (açılış
 * itkisi, öğle ortalamaya dönüşü, kapanış trendi) uyumlu olduğu için seçildi.
 */
/**
 * 09:55–14:00 açılış yönü (kullanıcı kuralı) taşınır · yön bozulursa 10:30
 * sonrası ortalamaya dönüş · 14:00+ kapanış trendi.
 * 60 seans: +32,5 puan; ayar görmemiş 42 gün +15,1, ayar verisi 18 gün +17,3.
 */
export const OPEN_TREND_END = 14 * 60;
/** Açılış yönü bozulursa bu saatten sonra ortalamaya dönüş moduna geçilir (öncesi BEKLE) */
const RANGE_FALLBACK_START = 10 * 60 + 30;
export const CLOSE_TREND_START = 14 * 60;

export type SessionMode = "OPEN_TREND" | "OPEN_FREE" | "MIDDAY_RANGE" | "CLOSE_TREND";

export const SESSION_MODE_LABEL: Record<SessionMode, string> = {
  OPEN_TREND: "GÜN YÖNÜ · 09:55 kuralı (14:00'e kadar)",
  OPEN_FREE: "AÇILIŞ · ön okuma / yönsüz",
  MIDDAY_RANGE: "GÜN ORTASI · aralık / ortalamaya dönüş",
  CLOSE_TREND: "ÖĞLEDEN SONRA · trend",
};

/**
 * Seans dilimi — karar paneli VE tahmin haritası aynı fonksiyonu kullanır
 * (ikisi farklı yön göstermesin diye). minsNow: son kapanmış 5m mumun bitişi.
 */
export function sessionModeOf(input: { opening: OpeningRegime; s5: DaySeries; price: number; minsNow: number }): {
  mode: SessionMode;
  orHi: number | null;
  orLo: number | null;
  /** Açılış yönü açılış aralığının karşı ucu geçilerek bozuldu */
  broken: boolean;
} {
  const { opening, s5, price, minsNow } = input;
  const freeToRange = (): SessionMode => (minsNow >= RANGE_FALLBACK_START && minsNow < CLOSE_TREND_START ? "MIDDAY_RANGE" : "OPEN_FREE");
  let mode: SessionMode =
    minsNow < OPEN_TREND_END ? (opening.status === "LOCKED" && (opening.side === "UP" || opening.side === "DOWN") ? "OPEN_TREND" : "OPEN_FREE")
    : minsNow < CLOSE_TREND_START ? "MIDDAY_RANGE" : "CLOSE_TREND";
  if (mode === "OPEN_FREE") mode = freeToRange();
  const orB = s5.bars.slice(0, 3);
  const orHi = orB.length ? Math.max(...orB.map((x) => x.high)) : null;
  const orLo = orB.length ? Math.min(...orB.map((x) => x.low)) : null;
  let broken = false;
  if (mode === "OPEN_TREND" && orHi != null && orLo != null && (opening.side === "UP" ? price < orLo : price > orHi)) {
    broken = true;
    mode = freeToRange();
  }
  return { mode, orHi, orLo, broken };
}

export interface DecisionRead {
  r5: TfRead | null;
  r15: TfRead | null;
  /** 30m — genel gidişat */
  r30: TfRead | null;
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
  /** Günün ilk senaryosu takip ediliyor: yeni giriş planı devre dışı, mesaj senaryo takibinden gelir */
  tracking: boolean;
  /** Seans dilimi oyun planı */
  mode: SessionMode;
  modeLabel: string;
  modeText: string;
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
  s30?: DaySeries;
  ema5: EmaMap;
  ema15: EmaMap;
  ema30?: EmaMap;
  /** Davranış temelli gün tipi (dayType.ts): TREND günlerinde trendin tersine ortalamaya-dönüş işlemi üretilmez */
  dayKind?: { kind: string; side: "UP" | "DOWN" | null } | null;
  /**
   * Günün çapa senaryosunun takip durumu (scenarioTrack.ts). Verilirse ve senaryo
   * bozulmadıysa karar = senaryoyu TAŞI (yeni giriş / ortalamaya dönüş üretilmez).
   */
  track?: {
    status: string;
    dir: "UP" | "DOWN";
    clock: string;
    title: string;
    lines: string[];
    watch: string[];
    ifNotIn: string | null;
    /** Trend değişimi seviyesi (15m kapanış bu seviyenin ötesinde → senaryo bozulur) */
    changeLevel?: number | null;
  } | null;
  /** Ortalama saatlik hareket (levels.hourlyRange) — hedefe tahmini süre için */
  hourlyRange?: number | null;
  /** ATR(14) — kapanmış 5m mumlardan; öğlen ortalamaya dönüş mesafesi bununla ölçülür */
  atr5?: number | null;
  /** Hacim profili (flow.ts) */
  profile?: { poc: number; vah: number; val: number } | null;
  /** false: seans dilimi oyun planını kapat (yalnızca kıyas/test için) */
  playbook?: boolean;
  /** flow.ts erken uyarısı (yapısal tip — döngüsel import yok) */
  warning?: { level: "STARTED" | "BUILDING" | "NONE"; side: "LONG" | "SHORT" | null; headline: string } | null;
  price: number | null;
  vwapNow: number | null;
  opening: OpeningRegime;
  stops: StopZones | null;
  supports: MapLevel[];
  resistances: MapLevel[];
}): DecisionRead | null {
  const { s5, s15, s30, ema5, ema15, ema30, warning, price, vwapNow, opening, stops, supports, resistances, atr5, profile } = input;
  const n5 = s5.bars.length;
  if (!n5) return null;
  const r5 = tfRead(s5, "5m", ema5);
  const r15 = tfRead(s15, "15m", ema15);
  const r30 = s30 && ema30 ? tfRead(s30, "30m", ema30) : null;
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
  const d5 = r5?.dir ?? "FLAT", d15 = r15?.dir ?? "FLAT", d30 = r30?.dir ?? "FLAT";
  const why: string[] = [];
  const watch: string[] = [];
  let action: DecisionRead["action"] = "BEKLE";
  let lean: DecisionRead["lean"] = null;
  let title: string;
  const tr = (d: Dir3) => (d === "UP" ? "YUKARI" : d === "DOWN" ? "AŞAĞI" : "YATAY");
  const sc = (x: number) => `${x > 0 ? "+" : ""}${x}/${FACTOR_MAX}`;
  const sideOfDir = (d: Dir3) => (d === "UP" ? "LONG" : "SHORT") as "LONG" | "SHORT";
  const dirOfSide = (x: "LONG" | "SHORT"): Dir3 => (x === "LONG" ? "UP" : "DOWN");
  const opp = (d: Dir3) => (d === "UP" ? "DOWN" : d === "DOWN" ? "UP" : "FLAT");
  const scores = `5m ${r5 ? sc(r5.score) : "—"} · 15m ${r15 ? sc(r15.score) : "—"} · 30m ${r30 ? sc(r30.score) : "—"}`;
  const entryWatch = (x: "LONG" | "SHORT") =>
    `Giriş: 5m mum ${x === "LONG" ? "LONG tetiğinin üstünde" : "SHORT tetiğinin altında"} kapanırsa. 5m kapanış VWAP + EMA20'nin ${x === "LONG" ? "altına" : "üstüne"} dönerse senaryo zayıflar.`;
  const ewDir = warning?.side ? dirOfSide(warning.side) : "FLAT";

  // erken uyarı: hareket başladı — öne alınır; 30m karşıysa 15m'nin de dönmüş olması gerekir (ana gidişata karşı gürültüyü süzer)
  // geçmiş ölçüm: erken uyarı yalnızca 14:00 sonrasında pozitif (sabah/öğlen %40) — öncesinde karara karışmaz
  const afterClose = nyParts(s5.bars[n5 - 1].time + 300).minutes >= CLOSE_TREND_START;
  const ewOk = afterClose && warning?.level === "STARTED" && !!warning.side && d15 !== opp(ewDir) && (d30 !== opp(ewDir) || d15 === ewDir);
  if (ewOk && warning?.side) {
    action = warning.side;
    title = `${action} — HAREKET BAŞLADI (erken uyarı)`;
    why.push(`${warning.headline}. Skorlar: ${scores}.`);
    if (d15 !== ewDir) why.push(`15m henüz ${tr(d15)} — erken giriş; pozisyonu küçük tut, 15m kapanışı teyit etmeli.`);
    watch.push(entryWatch(action));
  } else if (r5 && r15 && d5 !== "FLAT" && d5 === d15) {
    action = sideOfDir(d5);
    title = `${action} TARAFI — 5m ve 15m birlikte ${tr(d5)}`;
    why.push(`Skorlar: ${scores}.`);
    if (d30 === d5) why.push("30m genel gidişat da aynı yönde — trend teyitli, geri çekilmeler alım/satım fırsatı.");
    else if (d30 !== "FLAT") why.push(`Dikkat: 30m ${tr(d30)} — ana gidişata karşı işlem, hedefi kısa tut.`);
    watch.push(entryWatch(action));
  } else if (d15 !== "FLAT" && d15 === d30 && d5 === "FLAT") {
    action = sideOfDir(d15);
    title = `${action} TARAFI — 30m + 15m ${tr(d15)}, 5m dinleniyor (tetikte gir)`;
    why.push(`Ana gidişat (30m + 15m) ${tr(d15)}; 5m sıkışma/geri çekilme. Skorlar: ${scores}.`);
    watch.push(entryWatch(action));
  } else if (d5 !== "FLAT" && d5 === d30 && d15 === "FLAT") {
    action = sideOfDir(d5);
    title = `${action} TARAFI — 5m + 30m ${tr(d5)}, 15m geride`;
    why.push(`5m ve 30m aynı yönde; 15m henüz dönmedi (genelde bir sonraki 15m kapanışta yetişir). Skorlar: ${scores}.`);
    watch.push(entryWatch(action));
  } else if (d15 !== "FLAT" && d5 === "FLAT") {
    lean = sideOfDir(d15);
    title = `BEKLE — 15m ${tr(d15)}, 5m dinleniyor (${lean} yatkın)`;
    why.push(`Ana yön (15m) ${tr(d15)}; 5m kararsız → geri çekilme ya da sıkışma. Skorlar: ${scores}.`);
    watch.push(`5m mum ${lean === "LONG" ? "LONG tetiğinin üstünde" : "SHORT tetiğinin altında"} kapanırsa ${lean} teyit olur.`);
  } else if (d15 !== "FLAT" && d5 !== "FLAT" && d5 !== d15) {
    lean = sideOfDir(d30 !== "FLAT" ? d30 : d15);
    title = `BEKLE — 15m ${tr(d15)} ama 5m ${tr(d5)} (${d30 === d5 ? "dönüş başlıyor olabilir" : "geri çekilme"})`;
    why.push(`5m, 15m'nin tersine dönmüş. Skorlar: ${scores}.`);
    watch.push(`5m, EMA20/VWAP'ta tutunup ${lean === "LONG" ? "yeşil" : "kırmızı"} kapanırsa ${lean} fırsatı; 15m de ${tr(d5)} dönerse yön değişti demektir.`);
  } else if (d15 === "FLAT" && d5 !== "FLAT") {
    lean = sideOfDir(d5);
    title = `BEKLE — yalnızca 5m ${tr(d5)}, 15m teyidi yok`;
    why.push(`Kısa vadeli hareket var ama 15m henüz katılmadı. Skorlar: ${scores}.`);
    watch.push(`Bir sonraki 15m kapanış VWAP + EMA20 ${d5 === "UP" ? "üstünde" : "altında"} olursa ${lean} teyitli olur.`);
  } else {
    if (d30 !== "FLAT") lean = sideOfDir(d30);
    title = d30 !== "FLAT" ? `BEKLE — 5m/15m yatay, 30m ${tr(d30)} (${lean} yatkın)` : "BEKLE — 5m, 15m ve 30m yatay, net yön yok";
    why.push(`Fiyat VWAP/EMA20 etrafında gidip geliyor. Skorlar: ${scores}.`);
    watch.push("Aralık kırılımını bekle: 5m kapanış LONG ya da SHORT tetiğinin ötesine geçmeli.");
  }

  // — seans dilimi oyun planı (yukarıdaki genel okumayı dilime göre düzeltir) —
  const minsNow = nyParts(s5.bars[n5 - 1].time + 300).minutes;
  const sm = sessionModeOf({ opening, s5, price: px, minsNow });
  const mode: SessionMode = sm.mode;
  let modeText = "";
  const orHi = sm.orHi ?? px, orLo = sm.orLo ?? px;
  // ikinci bozulma: 10:30 sonrası son 15m + son 2 adet 5m kapanış VWAP ve EMA20'nin TERS tarafında
  const oDir = opening.side === "UP" ? 1 : opening.side === "DOWN" ? -1 : 0;
  const against = (b: Bar, v: number | null, e: number | null) => v != null && e != null && Math.sign(b.close - v) === -oDir && Math.sign(b.close - e) === -oDir;
  const n15b = s15.bars.length;
  const flipped =
    oDir !== 0 && minsNow >= RANGE_FALLBACK_START && n5 >= 2 && n15b >= 1 &&
    against(s5.bars[n5 - 1], s5.vwap[n5 - 1], ema5.get(s5.bars[n5 - 1].time) ?? null) &&
    against(s5.bars[n5 - 2], s5.vwap[n5 - 2], ema5.get(s5.bars[n5 - 2].time) ?? null) &&
    against(s15.bars[n15b - 1], s15.vwap[n15b - 1], ema15.get(s15.bars[n15b - 1].time) ?? null);
  // NOT: bu durumda yönü otomatik çevirmek 60 seansta sonucu kötüleştirdi (+32,5 → +15,5) —
  // yön korunur, yalnızca belirgin uyarı verilir.
  if (sm.broken) {
    modeText = `Açılış yönü ${opening.label} bozuldu: fiyat açılış aralığının ${opening.side === "UP" ? `dibinin (${fmt(orLo)}) altına` : `tepesinin (${fmt(orHi)}) üstüne`} geçti.`;
  }
  let fade: { side: "LONG" | "SHORT"; target: number } | null = null;
  const vwC = s5.vwap[n5 - 1];
  const d5s = d5 === "UP" ? 1 : d5 === "DOWN" ? -1 : 0;
  if (input.playbook !== false) {
    if (mode === "OPEN_TREND") {
      const o = opening.side === "UP" ? 1 : -1;
      const oSide: "LONG" | "SHORT" = o > 0 ? "LONG" : "SHORT";
      {
        const vS = vwC != null ? Math.sign(px - vwC) : 0;
        const pull = d5s === -o || d5s === 0 || vS === -o;
        modeText = `Gün yönü (09:55 kuralı): ${opening.label}${opening.strength ? ` · ${opening.strength}` : ""} → 14:00'e kadar ${oSide} tarafı. Yeni giriş geri çekilmede (VWAP/EMA20'ye dönüş), açık pozisyon taşınır. Bozulma: fiyat açılış aralığının ${o > 0 ? `dibi ${fmt(orLo)} altına` : `tepesi ${fmt(orHi)} üstüne`} geçerse.`;
        why.length = 0;
        watch.length = 0;
        if (opening.weak && minsNow < 10 * 60) {
          // 09:55 kuralı oluşmadı, yön yalnızca EMA20 tarafından: 10:00 30m teyidi gelmeden "giriş alanı" önerilmez
          action = oSide;
          lean = null;
          title = `${oSide} (ZAYIF · yalnız EMA20) — 09:55 kuralı oluşmadı; 10:00'da 30m teyit edecek ya da çevirecek`;
          why.push(`15m ile 5m kapanışlar VWAP'ın aynı tarafında değil; yön yalnızca fiyatın EMA20 tarafından geliyor (geçmişte zayıf). Skorlar: ${scores}.`);
          watch.push("Teyitten önce büyük giriş yok. 10:00 kapanışında 30m + 15m + 6×5m VWAP tarafı aynıysa yön NORMAL'e yükselir; ters çıkarsa yön çevrilir.");
        } else if (pull) {
          action = oSide;
          lean = null;
          title = `${oSide} — açılış ${opening.label} trendi, geri çekilme bölgesi (giriş alanı)`;
          why.push(`5m ${tr(d5)}${vS === -o ? `, fiyat VWAP'ın ${o > 0 ? "altında" : "üstünde"}` : ""} → trend yönüne karşı soluklanma; giriş için uygun bölge. Skorlar: ${scores}.`);
          watch.push(`Giriş: 5m mum ${oSide === "LONG" ? "LONG tetiğinin üstünde" : "SHORT tetiğinin altında"} kapanınca (trend yeniden başlıyor). İptal: açılış aralığının ${o > 0 ? `dibi ${fmt(orLo)} altında` : `tepesi ${fmt(orHi)} üstünde`} 5m kapanış.`);
        } else {
          // trend kendi yönünde ilerliyor: pozisyon TAŞINIR (BEKLE demek kazanan pozisyondan çıkmak olurdu); yeni giriş kovalanmaz
          action = oSide;
          lean = null;
          title = `${oSide} — ${opening.label} trendi sürüyor: pozisyonu taşı, yeni giriş için kovalama`;
          why.push(`5m trend yönünde uzamış — açık pozisyon taşınır; yeni giriş buradan geç kalmış olur. Skorlar: ${scores}.`);
          watch.push(`Yeni giriş: 5m mum ${o > 0 ? "kırmızı kapanır ya da VWAP/EMA20'ye inerse" : "yeşil kapanır ya da VWAP/EMA20'ye çıkarsa"} geri çekilme bölgesi açılır. İptal: açılış aralığının ${o > 0 ? `dibi ${fmt(orLo)} altında` : `tepesi ${fmt(orHi)} üstünde`} 5m kapanış.`);
        }
      }
    } else if (mode === "MIDDAY_RANGE") {
      modeText = "Öğlen dilimi (11:30–14:00): geçmiş ölçümde trend sinyalleri bu saatte TERS çalışıyor (%37–42) — ortalamaya dönüş oynanır, VWAP çevresinde işlem yapılmaz.";
      why.length = 0;
      watch.length = 0;
      if (vwC != null && atr5 != null && atr5 > 0) {
        const z = (px - vwC) / atr5;
        const outVA = profile ? (px > profile.vah ? 1 : px < profile.val ? -1 : 0) : 0;
        const pb2 = n5 >= 2 ? s5.bars[n5 - 2] : null, pv2 = n5 >= 2 ? s5.vwap[n5 - 2] : null;
        const zPrev = pb2 && pv2 != null ? (pb2.close - pv2) / atr5 : 0;
        // histerezis: tetik ±1 ATR'de açılır, fiyat VWAP'a ±0,3 ATR yaklaşana kadar sürer
        const stretch =
          Math.abs(z) >= 1 || outVA !== 0 ? Math.sign(z || outVA)
          : Math.abs(zPrev) >= 1 && Math.abs(z) >= 0.3 && Math.sign(zPrev) === Math.sign(z) ? Math.sign(z) : 0;
        const trendDay =
          (!!r30 && stretch !== 0 && Math.sign(r30.score) === stretch && Math.abs(r30.score) >= 5) ||
          (stretch !== 0 && input.dayKind?.kind === "TREND" && input.dayKind.side === (stretch > 0 ? "UP" : "DOWN"));
        if (stretch && !trendDay) {
          const fs: "LONG" | "SHORT" = stretch > 0 ? "SHORT" : "LONG";
          action = fs;
          lean = null;
          // hedef: fiyatın dönüş yönündeki en yakın denge seviyesi (VWAP ya da POC); POC ters taraftaysa VWAP
          const inDir = (lvl: number) => (fs === "LONG" ? lvl > px : lvl < px);
          const tgt = profile && inDir(profile.poc) && Math.abs(profile.poc - px) < Math.abs(vwC - px) ? profile.poc : vwC;
          fade = { side: fs, target: r2(tgt) };
          title = `${fs} — öğlen ortalamaya dönüş: fiyat VWAP'tan ${Math.abs(z).toFixed(1)}×ATR ${stretch > 0 ? "yukarıda" : "aşağıda"}, hedef ${fmt(tgt)}`;
          why.push(`VWAP ${fmt(vwC)}, ATR₅ ${fmt(atr5)}${profile ? `, değer alanı ${fmt(profile.val)} – ${fmt(profile.vah)}` : ""}${outVA ? " (fiyat değer alanı DIŞINDA)" : ""}. Skorlar: ${scores}.`);
          watch.push(`Giriş: 5m mum ${fs === "LONG" ? "son mumun tepesi üstünde" : "son mumun dibi altında"} kapanınca (dönüş teyidi). Hedef ${fmt(tgt)}; fiyat VWAP'a ±0,3 ATR yaklaşınca çık.`);
        } else if (trendDay) {
          action = "BEKLE";
          lean = stretch > 0 ? "LONG" : "SHORT";
          title = `BEKLE — öğlen ama güçlü trend günü (30m ${r30!.score > 0 ? "+" : ""}${r30!.score}/6): ters işlem yok`;
          why.push(`30m güçlü ${tr(r30!.dir)} — ortalamaya dönüş trend günlerinde tutmaz. Skorlar: ${scores}.`);
          watch.push(`Trend yönünde (${lean}) yalnızca VWAP/EMA20'ye geri çekilmede bak.`);
        } else {
          action = "BEKLE";
          lean = null;
          title = `BEKLE — öğlen aralığı: fiyat VWAP çevresinde (${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(1)}×ATR)`;
          why.push(`Fiyat VWAP'a 1 ATR'den yakın — bu saatte buradan yön işlemi isabetsiz (%45). Skorlar: ${scores}.`);
          watch.push(`Fiyat VWAP'tan 1 ATR uzaklaşırsa (${fmt(vwC + atr5)} üstü / ${fmt(vwC - atr5)} altı) ya da değer alanı dışına çıkarsa ters yönde ortalamaya dönüş fırsatı.`);
        }
      } else {
        action = "BEKLE";
        lean = null;
        title = "BEKLE — öğlen aralığı (ATR/VWAP verisi bekleniyor)";
      }
    } else if (mode === "CLOSE_TREND") {
      modeText = "Öğleden sonra dilimi (14:00+): momentum geri geliyor — fiyat VWAP ve POC'un aynı tarafındaysa o yönde (geçmiş isabet %56); erken uyarı da bu saatte pozitif.";
      if (vwC != null && profile) {
        // ölü bölge: VWAP'a ATR₅'in 0,15'inden yakın fiyat taraf değiştirmiş sayılmaz (çizgi etrafında gidip gelme)
        const aS = Math.sign(px - vwC), bS = Math.sign(px - profile.poc);
        why.length = 0;
        watch.length = 0;
        if (aS && aS === bS) {
          const cs: "LONG" | "SHORT" = aS > 0 ? "LONG" : "SHORT";
          action = cs;
          lean = null;
          title = `${cs} — öğleden sonra trendi: fiyat VWAP (${fmt(vwC)}) ve POC'un (${fmt(profile.poc)}) ${aS > 0 ? "üstünde" : "altında"}`;
          why.push(`Kabul ${aS > 0 ? "yukarıda" : "aşağıda"}: iki denge seviyesi de arkada kaldı. Skorlar: ${scores}.`);
          watch.push(`İptal: 5m kapanış VWAP'ın ${aS > 0 ? "altına" : "üstüne"} dönerse.`);
        } else if (warning?.level === "STARTED" && warning.side) {
          action = warning.side;
          lean = null;
          title = `${warning.side} — öğleden sonra erken uyarı: hareket başladı`;
          why.push(`${warning.headline}. Fiyat VWAP ile POC arasında — teyit için birini geçmeli. Skorlar: ${scores}.`);
          watch.push(`5m kapanış ${warning.side === "LONG" ? `${fmt(Math.max(vwC, profile.poc))} üstünde` : `${fmt(Math.min(vwC, profile.poc))} altında`} olursa teyitli.`);
        } else {
          action = "BEKLE";
          lean = null;
          title = `BEKLE — fiyat VWAP (${fmt(vwC)}) ile POC (${fmt(profile.poc)}) arasında, yön yok`;
          why.push(`Skorlar: ${scores}.`);
          watch.push(`5m kapanış ${fmt(Math.max(vwC, profile.poc))} üstünde → LONG · ${fmt(Math.min(vwC, profile.poc))} altında → SHORT.`);
        }
      }
    }
  }
  // 5m erken dönüş işaretleri: trend yönündeki pozisyona karşı ilk uyarılar (15m teyidinden önce)
  // senaryo takibi varken (bozulmadıysa) işaretler ÇAPA yönüne göre aranır; ortalamaya dönüş planı kapanır
  const trackLive = !!input.track && input.track.status !== "DEĞİŞTİ" && input.playbook !== false;
  if (trackLive) {
    action = input.track!.dir === "UP" ? "LONG" : "SHORT";
    lean = null;
    fade = null;
  }
  const actDir = action === "LONG" ? 1 : action === "SHORT" ? -1 : 0;
  if (input.playbook !== false && actDir !== 0 && (trackLive || mode === "OPEN_TREND" || mode === "CLOSE_TREND") && !(mode === "OPEN_TREND" && flipped && !trackLive) && n5 >= 2) {
    const c = s5.bars[n5 - 1], p = s5.bars[n5 - 2];
    const rg = Math.max(0.01, c.high - c.low);
    const pos = (c.close - c.low) / rg;
    const loW = Math.min(c.open, c.close) - c.low, upW = c.high - Math.max(c.open, c.close);
    const signs: string[] = [];
    if (actDir < 0 && loW / rg >= 0.5 && pos >= 0.5) signs.push(`uzun alt fitil reddi (${fmt(c.low)} altı alınmadı)`);
    if (actDir > 0 && upW / rg >= 0.5 && pos <= 0.5) signs.push(`uzun üst fitil reddi (${fmt(c.high)} üstü tutunamadı)`);
    const eC = ema5.get(c.time) ?? null, eP = ema5.get(p.time) ?? null;
    if (eC != null && eP != null && Math.sign(c.close - eC) === -actDir && Math.sign(p.close - eP) === actDir)
      signs.push(`5m EMA20'nin (${fmt(eC)}) ${actDir < 0 ? "üstüne" : "altına"} kapandı`);
    const pBody = p.close - p.open, cBody = c.close - c.open;
    if (Math.sign(pBody) === actDir && Math.sign(cBody) === -actDir && Math.abs(cBody) > Math.abs(pBody) &&
        Math.max(c.open, c.close) >= Math.max(p.open, p.close) && Math.min(c.open, c.close) <= Math.min(p.open, p.close))
      signs.push(`${actDir < 0 ? "yükselen" : "düşen"} yutan mum`);
    const vC = s5.vwap[n5 - 1];
    if (eC != null && vC != null && Math.sign(c.close - eC) === -actDir && Math.sign(c.close - vC) === -actDir)
      signs.push(`fiyat VWAP (${fmt(vC)}) ve EMA20'nin ${actDir < 0 ? "üstünde" : "altında"}`);
    if (r5 && Math.sign(r5.score) === -actDir && Math.abs(r5.score) >= 4)
      signs.push(`5m skor ${r5.score > 0 ? "+" : ""}${r5.score}/${FACTOR_MAX} (ters yönde güçlü)`);
    if (signs.length) {
      const n15c = s15.bars.length;
      const e15 = n15c ? ema15.get(s15.bars[n15c - 1].time) ?? null : null;
      const v15 = n15c ? s15.vwap[n15c - 1] : null;
      const lv = [e15, v15].filter((x): x is number => x != null);
      const conf = lv.length ? (actDir < 0 ? Math.max(...lv) : Math.min(...lv)) : null;
      const confTxt = conf != null ? ` Dönüş teyidi: 15m kapanış ${fmt(conf)} ${actDir < 0 ? "üstünde" : "altında"} (15m EMA20/VWAP).` : "";
      if (signs.length >= 2) {
        title = `${action} — gün yönü korunuyor, ama 5m dönüş işaretleri: yeni giriş yok, stopu sıkılaştır`;
        // "geri çekilmede gir" önerisi bu durumda geçersiz
        for (let k = why.length - 1; k >= 0; k--) if (why[k].includes("uygun bölge")) why.splice(k, 1);
        watch.length = 0;
        watch.push(`Dönüş teyidi: 15m kapanış${conf != null ? ` ${fmt(conf)} ${actDir < 0 ? "üstünde" : "altında"}` : " 15m EMA20/VWAP'ın ters tarafında"}. Teyit gelmeden yön değiştirme; işaretler kaybolursa (5m tekrar EMA20'nin ${actDir < 0 ? "altına" : "üstüne"} kapanırsa) gün yönü devam eder.`);
        if (trackLive && input.track!.status === "TREND ONAYLI") {
          // trend ONAYLI günde 5m dönüş işaretleri çoğunlukla sağlıklı geri çekilmedir — panik değil, seviyeye bak
          const cl = input.track!.changeLevel;
          why.unshift(`⚡ 5m geri çekilme işaretleri (${nyClock(c.time)}): ${signs.join(" + ")} — trend onaylı günde bu çoğu zaman sağlıklı geri çekilmedir. Senaryo yalnızca 15m kapanış ${cl != null ? fmt(cl) + " " : "son 15m dip/zirvenin "}${actDir > 0 ? "altına" : "üstüne"} geçerse bozulur; taşımaya devam, yeni giriş yok.`);
        } else {
          why.unshift(`⚡ ERKEN DÖNÜŞ İŞARETİ (5m ${nyClock(c.time)}): ${signs.join(" + ")} — ${actDir < 0 ? "düşüş" : "yükseliş"} ivmesi kesiliyor; yeni giriş yapma, stopu sıkılaştır.${confTxt}`);
        }
      } else {
        why.push(`5m dikkat (${nyClock(c.time)}): ${signs[0]}.${confTxt}`);
      }
    }
  }
  if (input.playbook !== false && mode === "OPEN_TREND" && flipped) {
    title = `${action} — gün yönü (${opening.label}) korunuyor, ama güçlü karşı hareket: yeni giriş yok, stopu sıkılaştır`;
    why.unshift(`⚠ DİKKAT: son 15m ve 2×5m kapanış VWAP + EMA20'nin ${oDir > 0 ? "ALTINDA" : "ÜSTÜNDE"} — gün yönüne karşı güçlü ${oDir > 0 ? "düşüş" : "toparlanma"}. Sistem yönü korur (otomatik çevirmek geçmişte kaybettirdi); yeni giriş yapma, açık pozisyonda stopu sıkılaştır.`);
  }
  // 09:55 öncesi ön okuma ya da 10:30'dan önce bozulan açılış yönü: yön işlemi yok
  // (60 seansta bu dilimde genel okuma −6,4 puan / %44'tü)
  if (input.playbook !== false && mode === "OPEN_FREE") {
    action = "BEKLE";
    lean = opening.side === "UP" ? "LONG" : opening.side === "DOWN" ? "SHORT" : opening.lean === "UP" ? "LONG" : opening.lean === "DOWN" ? "SHORT" : null;
    title =
      opening.status !== "LOCKED" ? `ÖN OKUMA — ${opening.label}; gün yönü 09:55'te (5m 09:50 + 09:55 teyidi)`
      : opening.side === "UNCERTAIN" ? "BEKLE — açılış kararsız, fiyat EMA20 üzerinde: 10:30'da ortalamaya dönüş planı başlar"
      : "BEKLE — açılış yönü bozuldu: 10:30'da ortalamaya dönüş planı başlar";
    why.length = 0;
    why.push(`Skorlar: ${scores}.`);
    watch.length = 0;
    watch.push(opening.status !== "LOCKED" ? "09:50 ve 09:55 5m kapanışları 15m ile aynı VWAP tarafındaysa gün yönü kilitlenir; değilse EMA20 tarafı (zayıf)." : "10:30'dan sonra aralık planı (VWAP ±1 ATR'den ortalamaya dönüş) devreye girer.");
  }
  if (!modeText && mode === "OPEN_FREE")
    modeText = opening.status !== "LOCKED"
      ? "09:45–09:55 ön okuma: 15m kapanışı görüldü, 5m teyitleri bekleniyor."
      : "Açılış yönü yok/bozuldu: 10:30'a kadar yön işlemi geçmişte zarar ettirdi — beklenir, sonra ortalamaya dönüş.";

  // erken uyarı hazırlığı (henüz başlamadı) — karar dışı bilgi
  if (warning?.level === "BUILDING" && warning.side && mode === "CLOSE_TREND") {
    if (action === "BEKLE") {
      lean = lean ?? warning.side;
      watch.unshift(`Erken uyarı: ${warning.headline}.`);
    } else if (warning.side !== action) why.push(`Uyarı: akış ters yönde hazırlık gösteriyor — ${warning.headline}. Stopu sık tut.`);
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
  // hedef: tetiğin en az 0,30 ötesindeki ilk ölçülmüş seviye — yuvarlak sayılar yalnızca başka seviye yoksa
  const pick = (list: MapLevel[], beyond: number, up: boolean) => {
    const c = list
      .filter((l) => (up ? l.price > beyond + 0.3 : l.price < beyond - 0.3))
      .sort((a, b) => (up ? a.price - b.price : b.price - a.price));
    return c.find((l) => !l.label.includes("yuvarlak")) ?? c[0] ?? null;
  };
  const tL = pick(resistances, longTrig, true);
  const tS = pick(supports, shortTrig, false);
  // stop, fiyatın zaten ötesindeyse (aşılmış) geçersiz sayılır
  const sL = stops?.long && stops.long.stop < longTrig && stops.long.stop < px ? stops.long.stop : null;
  const sS = stops?.short && stops.short.stop > shortTrig && stops.short.stop > px ? stops.short.stop : null;
  const prev5b = n5 >= 2 ? s5.bars[n5 - 2] : last5;
  const tightL = r2(Math.min(Math.min(last5.low, prev5b.low) - 0.05, longTrig - 0.25));
  const tightS = r2(Math.max(Math.max(last5.high, prev5b.high) + 0.05, shortTrig + 0.25));
  const long: PlanSide = {
    trigger: longTrig, stop: sL, target: tL?.price ?? null, targetLabel: tL?.label ?? null,
    rr: tL && sL != null ? r2((tL.price - longTrig) / (longTrig - sL)) : null,
    etaMin: null,
    tightStop: tightL, rrTight: tL ? r2((tL.price - longTrig) / (longTrig - tightL)) : null,
  };
  const short: PlanSide = {
    trigger: shortTrig, stop: sS, target: tS?.price ?? null, targetLabel: tS?.label ?? null,
    rr: tS && sS != null ? r2((shortTrig - tS.price) / (sS - shortTrig)) : null,
    etaMin: null,
    tightStop: tightS, rrTight: tS ? r2((shortTrig - tS.price) / (tightS - shortTrig)) : null,
  };
  if (fade) {
    // ortalamaya dönüş: tetik = son mumun tepesi/dibi (dönüş teyidi), hedef = VWAP/POC, stop = son 2 mumun ucu
    const p = fade.side === "LONG" ? long : short;
    p.trigger = fade.side === "LONG" ? r2(last5.high + 0.01) : r2(last5.low - 0.01);
    p.target = fade.target;
    p.targetLabel = "VWAP/POC (ortalamaya dönüş)";
    p.stop = p.tightStop;
    const risk = fade.side === "LONG" ? p.trigger - p.tightStop : p.tightStop - p.trigger;
    const rew = fade.side === "LONG" ? fade.target - p.trigger : p.trigger - fade.target;
    p.rr = risk > 0 && rew > 0 ? r2(rew / risk) : null;
    p.rrTight = p.rr;
  }
  const hr = Math.max(0.3, input.hourlyRange ?? 1);
  for (const p of [long, short]) p.etaMin = p.target != null ? Math.max(5, Math.round((Math.abs(p.target - p.trigger) / hr) * 60 / 5) * 5) : null;
  const side = action !== "BEKLE" ? action : lean;
  const plan = side === "LONG" ? long : side === "SHORT" ? short : null;
  if (plan) {
    const best = Math.max(plan.rr ?? -1, plan.rrTight ?? -1);
    if (best >= 0 && best < 1) watch.push(`Risk/ödül zayıf (en iyi ${best.toFixed(1)}R): hedef stoba göre yakın — girişi geri çekilmeye sakla ya da pas geç.`);
    else if (plan.rr != null && plan.rr < 1 && plan.rrTight != null && plan.rrTight >= 1)
      watch.push(`15m yapı stobu uzak (${plan.rr.toFixed(1)}R); 5m sıkı stopla (${num2(plan.tightStop)}) ${plan.rrTight.toFixed(1)}R — küçük pozisyon.`);
  }

  // — 09:55 netlik yetersizse 10:00 30m kapanışına kadar başlık "bekle" der (aksiyon değişmez; panel ölçümü aynı) —
  if (opening.waitFor10 && input.playbook !== false && !input.track) {
    title = `ÖN KARAR ${opening.side === "UP" ? "▲ yukarı" : opening.side === "DOWN" ? "▼ aşağı" : "—"} — 09:55'te netlik yetersiz: 10:00 30m kapanışını bekle`;
    watch.unshift("10:00'da 30m + 15m (09:45–10:00) + 6×5m'nin ≥4'ü VWAP'ın aynı tarafında kapanırsa yön kesinleşir; erken pozisyon alma.");
  }
  // — Senaryo takibi: günün ilk senaryosu varsa karar ONU TAŞIMAKTIR (yeniden üretmek değil) —
  let tracking = false;
  let modeLabelOut: string = SESSION_MODE_LABEL[mode];
  let modeTextOut = modeText;
  const tr0 = input.track;
  if (tr0 && input.playbook !== false) {
    const tAct: "LONG" | "SHORT" = tr0.dir === "UP" ? "LONG" : "SHORT";
    // erken dönüş / dikkat satırları (5m) takip mesajının ALTINDA korunur
    const keep = why.filter((w) => w.startsWith("⚡") || w.startsWith("5m dikkat") || w.startsWith("Uyarı:"));
    if (tr0.status !== "DEĞİŞTİ") {
      tracking = true;
      action = tAct;
      lean = null;
      title = tr0.title;
      why.length = 0;
      why.push(...tr0.lines, ...keep);
      watch.length = 0;
      watch.push(...tr0.watch);
      if (tr0.ifNotIn) watch.push(tr0.ifNotIn);
      modeLabelOut = "SENARYO TAKİBİ";
      modeTextOut = `Güncel bacak (${tr0.clock}: ${tr0.dir === "UP" ? "yukarı" : "aşağı"}) takip ediliyor — dakikada bir yeniden üretilmez. Bacak sürdükçe yeni giriş değil, taşıma/kâr alma; trend değişirse bacak biter ve yeni bacak tetiği aranır (Senaryo Takibi).`;
    } else {
      // bozuldu: eski yönde sinyal VERİLMEZ; ters yön ancak genel mantık kendi koşullarıyla üretirse görünür
      modeLabelOut = "SENARYO BOZULDU";
      modeTextOut = `${tr0.clock} bacağı bitti. Eski yönde yeni giriş yok; yeni bacak tetiği: 2×5m kapanış VWAP + EMA20 aynı tarafta ve 15m kapanış VWAP + EMA20(15m) aynı tarafta.`;
      const prevTitle = title;
      const prevWhy = why.slice();
      if (action === tAct) { action = "BEKLE"; lean = null; }
      if (action === "BEKLE") {
        title = tr0.title;
        why.length = 0;
        why.push(...tr0.lines, ...keep);
        watch.length = 0;
        watch.push(...tr0.watch);
      } else {
        // genel mantık TERS yönde kendi koşullarıyla sinyal üretti: yeni yön, ama eski senaryonun bozulduğu açıkça yazılır
        title = `${action} (YENİ YÖN) — ${tr0.clock} senaryosu bozuldu · ${prevTitle}`;
        why.length = 0;
        why.push(...tr0.lines.slice(0, 2), ...prevWhy);
        watch.unshift(...tr0.watch.slice(0, 1));
      }
    }
  }

  return {
    r5, r15, r30, prev5, history5,
    day: { open, high, low, rangePos, vsOpen: r2(vsOpen), vsVwap: vsVwap == null ? null : r2(vsVwap), buyShare: dayBuy, dir: dayDir, text: dayText },
    action, lean, tracking, mode, modeLabel: modeLabelOut, modeText: modeTextOut, title, why, watch, long, short,
  };
}
