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

import { nyDateTimeToEpoch, nyParts, r2, type Bar } from "./core";
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
