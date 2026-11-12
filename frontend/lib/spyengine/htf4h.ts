/**
 * 4 saatlik (4h) mum okuması — saf, izomorfik. Tüm motorlarda (SPY/QQQ/IWM/hisseler) aynı.
 *
 * Mumlar seans hizalı RTH 4h mumlarıdır (09:30–13:30 ve 13:30–16:00, bkz. mtfPivots.pivotFrames). Yalnız KAPANMIŞ mumlar sayılır:
 * oluşmakta olan 4h mum yön vermez (kapanışı belli değil). 4h GENEL yönelimi gösterir — işlem tetiği değildir; Takip Sistemi
 * (tracker.ts, 45 seansta kalibre) 4h'e göre değiştirilmedi. 4h burada yön teyidi / uyarı olarak okunur:
 * 15m yönü 4h ile uyumluysa "UYUMLU", tersse "TERS" (ters yönde işlemde daha dikkatli ol).
 *
 * Skor (−4…+4): son kapanış EMA20'nin üstü/altı · EMA20 > / < EMA50 · son kapanış önceki kapanıştan yüksek/düşük ·
 * son mum yönü ve kapanış konumu (mumun üst/alt %33'ünde kapanış). |skor| ≥ 2 → yön; aksi YATAY.
 */

import { nyClock, nyDateTimeToEpoch, nyParts, r2, type Bar } from "./core";
import { fmtVol, type CandleComment, type Tone } from "./openingMap";
import type { PivotFrames } from "./mtfPivots";

export type Dir4h = "UP" | "DOWN" | "FLAT";

export interface Htf4hRead {
  dir: Dir4h;
  /** −4…+4 */
  score: number;
  /** son kapanmış 4h mum */
  last: { time: number; open: number; high: number; low: number; close: number } | null;
  prevClose: number | null;
  ema20: number | null;
  ema50: number | null;
  /** EMA200 (4h) — yeterli geçmiş (≥200 mum) yoksa null */
  ema200: number | null;
  /** kapanış konumu 0..1 (0 = dip, 1 = tepe) */
  closePos: number | null;
  /** kısa açıklama */
  text: string;
  /** madde madde gerekçe */
  reasons: string[];
  /** kapanmış 4h mum sayısı */
  count: number;
}

function emaLast(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}

/** `t` anında kapanmış 4h mumlar (zaman sıralı) */
export function closed4h(fr: PivotFrames, t: number): Bar[] {
  const out: Bar[] = [];
  for (const b of fr.h4) {
    const close = nyDateTimeToEpoch(nyParts(b.time).ymd, 16 * 60);
    if (Math.min(b.time + 240 * 60, close) <= t) out.push(b);
  }
  return out;
}

export function read4h(fr: PivotFrames, price: number | null, t: number): Htf4hRead | null {
  const cl = closed4h(fr, t);
  if (cl.length < 3) return null;
  const closes = cl.map((b) => b.close);
  const last = cl[cl.length - 1];
  const prev = cl[cl.length - 2];
  const ema20 = emaLast(closes, 20);
  const ema50 = emaLast(closes, 50);
  const ema200 = emaLast(closes, 200);
  const range = last.high - last.low;
  const closePos = range > 0 ? (last.close - last.low) / range : null;

  let score = 0;
  const reasons: string[] = [];
  if (ema20 != null) {
    if (last.close > ema20) { score += 1; reasons.push(`kapanış EMA20 (${r2(ema20)}) üstünde`); }
    else { score -= 1; reasons.push(`kapanış EMA20 (${r2(ema20)}) altında`); }
  }
  if (ema20 != null && ema50 != null) {
    if (ema20 > ema50) { score += 1; reasons.push("EMA20 > EMA50"); }
    else { score -= 1; reasons.push("EMA20 < EMA50"); }
  }
  if (last.close > prev.close) { score += 1; reasons.push(`önceki 4h kapanıştan yüksek (${r2(prev.close)})`); }
  else if (last.close < prev.close) { score -= 1; reasons.push(`önceki 4h kapanıştan düşük (${r2(prev.close)})`); }
  if (closePos != null) {
    if (last.close > last.open && closePos >= 0.67) { score += 1; reasons.push("yeşil mum, tepeye yakın kapanış"); }
    else if (last.close < last.open && closePos <= 0.33) { score -= 1; reasons.push("kırmızı mum, dibe yakın kapanış"); }
  }
  if (ema200 != null && price != null) reasons.push(price >= ema200 ? `fiyat 4h EMA200 (${r2(ema200)}) üstünde` : `fiyat 4h EMA200 (${r2(ema200)}) altında`);

  const dir: Dir4h = score >= 2 ? "UP" : score <= -2 ? "DOWN" : "FLAT";
  const text = `4h ${dir === "UP" ? "YUKARI" : dir === "DOWN" ? "AŞAĞI" : "YATAY"} (${score > 0 ? "+" : ""}${score}) — son kapanış ${r2(last.close)}`;
  return {
    dir, score, last: { time: last.time, open: last.open, high: last.high, low: last.low, close: last.close },
    prevClose: prev.close, ema20, ema50, ema200, closePos, text, reasons, count: cl.length,
  };
}

/** 15m/harita yönü ile 4h uyumu */
export function align4h(mapDir: Dir4h, h4: Htf4hRead | null): "UYUMLU" | "TERS" | "NÖTR" | null {
  if (!h4) return null;
  if (mapDir === "FLAT" || h4.dir === "FLAT") return "NÖTR";
  return mapDir === h4.dir ? "UYUMLU" : "TERS";
}

// ── 4h mum yorumları (bilgi, karar vermez) ─────────────────────────────

const f2 = (v: number) => v.toFixed(2);
const sg = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;

/**
 * Kapanmış 4h mumların yorumları (en yeni üstte). Biçim, 5m/15m yorumlarıyla aynıdır (CandleComment) — aynı kart çizer.
 * VWAP 4h için anlamlı olmadığından yok; yerine 4h EMA20/EMA50 ve önceki 4h kapanış kıyası kullanılır.
 */
export function comment4h(fr: PivotFrames, t: number, limit = 12): CandleComment[] {
  const cl = closed4h(fr, t);
  const closes = cl.map((b) => b.close);
  const out: CandleComment[] = [];
  for (let i = cl.length - 1; i >= Math.max(1, cl.length - limit); i--) {
    const b = cl[i], prev = cl[i - 1];
    const upper = b.high - Math.max(b.open, b.close);
    const lower = Math.min(b.open, b.close) - b.low;
    const range = b.high - b.low;
    const closePos = range > 0 ? (b.close - b.low) / range : 0.5;
    const body = Math.abs(b.close - b.open);
    const color: Tone = b.close > b.open ? "bull" : b.close < b.open ? "bear" : "neutral";
    const ema20 = emaLast(closes.slice(0, i + 1), 20);
    const ema50 = emaLast(closes.slice(0, i + 1), 50);
    const lines: string[] = [];
    let score = 0;

    lines.push(`Gövde ${f2(body)} · aralık ${f2(range)} · önceki 4h kapanış ${f2(prev.close)} → ${sg(b.close - prev.close)}.`);
    if (b.close > prev.close) score += 1; else if (b.close < prev.close) score -= 1;

    if (closePos >= 0.75) { lines.push(`Kapanış aralığın üst %${Math.round((1 - closePos) * 100)}'lik diliminde → alıcılar kontrolde.`); score += 1; }
    else if (closePos <= 0.25) { lines.push(`Kapanış aralığın alt %${Math.round(closePos * 100)}'lik diliminde → satıcılar kontrolde.`); score -= 1; }
    else lines.push(`Kapanış aralığın ortasında (%${Math.round(closePos * 100)}) → net üstünlük yok.`);

    if (range > 0 && upper / range >= 0.4) lines.push("Uzun üst fitil → yukarıda satış baskısı / ret.");
    if (range > 0 && lower / range >= 0.4) lines.push("Uzun alt fitil → aşağıda alım ilgisi / tepki.");

    if (ema20 != null) {
      const d = b.close - ema20;
      lines.push(`EMA20 (${f2(ema20)}) ${d >= 0 ? "üstünde" : "altında"} (${sg(d)}).`);
      score += d >= 0 ? 1 : -1;
    }
    if (ema50 != null) {
      const d = b.close - ema50;
      lines.push(`EMA50 (${f2(ema50)}) ${d >= 0 ? "üstünde" : "altında"} (${sg(d)})${ema20 != null ? `; EMA20 ${ema20 > ema50 ? ">" : "<"} EMA50` : ""}.`);
      score += d >= 0 ? 0.5 : -0.5;
    }
    const vols = cl.slice(Math.max(0, i - 10), i).map((x) => x.volume || 0).filter((v) => v > 0);
    const avg = vols.length >= 3 ? vols.reduce((a, x) => a + x, 0) / vols.length : 0;
    const volRatio = avg > 0 ? (b.volume || 0) / avg : null;
    if (volRatio != null) lines.push(`Hacim ${fmtVol(b.volume || 0)} (önceki ort. ${fmtVol(avg)}, ${volRatio.toFixed(2)}×)${volRatio >= 1.5 ? " → yüksek: hareket teyitli." : volRatio <= 0.6 ? " → zayıf: güvenilir değil." : "."}`);
    else lines.push(`Hacim ${fmtVol(b.volume || 0)}.`);

    const tone: Tone = score >= 2 ? "bull" : score <= -2 ? "bear" : "neutral";
    const colorTxt = color === "bull" ? "Yeşil 4h mum" : color === "bear" ? "Kırmızı 4h mum" : "Doji 4h mum";
    const ymd = nyParts(b.time).ymd;
    const closeSec = Math.min(b.time + 240 * 60, nyDateTimeToEpoch(ymd, 16 * 60));
    out.push({
      tf: "4h", time: b.time, clock: `${ymd.slice(5)} ${nyClock(closeSec)}`, tone, forming: false, close: b.close,
      vwap: null, vwapSide: null, upperWick: upper, lowerWick: lower, closePos, volume: b.volume || 0, volRatio, lines,
      headline: `${colorTxt} → ${tone === "bull" ? "alıcı lehine" : tone === "bear" ? "satıcı lehine" : "nötr / kararsız"}`,
    });
  }
  return out;
}

/** Son kapanmış 4h mumun hacminin önceki ≤10 mum ortalamasına oranı (kıyas yoksa null) */
export function lastVolRatio4h(fr: PivotFrames, t: number): number | null {
  const cl = closed4h(fr, t);
  if (cl.length < 4) return null;
  const last = cl[cl.length - 1];
  const vols = cl.slice(Math.max(0, cl.length - 11), cl.length - 1).map((x) => x.volume || 0).filter((v) => v > 0);
  if (vols.length < 3) return null;
  const avg = vols.reduce((a, x) => a + x, 0) / vols.length;
  return avg > 0 ? (last.volume || 0) / avg : null;
}
