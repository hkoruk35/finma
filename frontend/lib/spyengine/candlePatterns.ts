/**
 * SPY Engine V8.0 — Mum Formasyonu + Hacim Dedektörleri (saf, izomorfik).
 *
 * 5m ANA KARAR katmanının en güçlü tetikleyicisi: mum formasyonu + hacim
 * birlikteliği. 15m'de aynı fonksiyonlar YÖN TEYİDİ bağlamında (daha az
 * ağırlıkla) kullanılır. Hiçbir fonksiyon "karar" vermez — yalnızca
 * gözlenen formasyonu ve gücünü (0-1) döndürür; yön/eşik/skor mantığı
 * strategy.ts'te birleştirilir.
 *
 * Girdi her zaman KAPANMIŞ mumlardır (non-repainting) — çağıran taraf
 * son (oluşmakta olan) mumu asla vermez.
 */

import type { Bar } from "./core";

export type PatternDirection = "LONG" | "SHORT";

export interface CandlePatternHit {
  key: string;
  label: string;
  direction: PatternDirection;
  /** 0-1 arası formasyon gücü — hacim teyidiyle artar */
  strength: number;
  detail: string;
}

const body = (b: Bar) => Math.abs(b.close - b.open);
const range = (b: Bar) => Math.max(1e-9, b.high - b.low);
const upperWick = (b: Bar) => b.high - Math.max(b.open, b.close);
const lowerWick = (b: Bar) => Math.min(b.open, b.close) - b.low;
const isGreen = (b: Bar) => b.close > b.open;
const isRed = (b: Bar) => b.close < b.open;

/** Son N (kapanmış) barın ortalama hacmi — mevcut bar dahil değil. */
function avgVolume(bars: Bar[], idx: number, lookback = 10): number | null {
  const start = idx - lookback;
  if (start < 0) return null;
  let sum = 0;
  for (let i = start; i < idx; i++) sum += bars[i].volume || 0;
  return sum / lookback;
}

// ── 1-2. Yutan Mum (Engulfing) ───────────────────────────────────────

function bullishEngulfing(bars: Bar[], idx: number, avgVol: number | null): CandlePatternHit | null {
  if (idx < 1) return null;
  const prev = bars[idx - 1], cur = bars[idx];
  if (!isRed(prev) || !isGreen(cur)) return null;
  if (!(cur.open <= prev.close && cur.close >= prev.open)) return null;
  const volBoost = avgVol != null && avgVol > 0 ? (cur.volume || 0) / avgVol : null;
  if (volBoost == null || volBoost < 1.0) return null;
  return {
    key: "bullish_engulfing", label: "Boğa Yutan Mum", direction: "LONG",
    strength: Math.min(1, 0.55 + Math.min(0.45, (volBoost - 1) * 0.3)),
    detail: `önceki kırmızıyı tamamen sardı, hacim ${volBoost.toFixed(2)}×`,
  };
}

function bearishEngulfing(bars: Bar[], idx: number, avgVol: number | null): CandlePatternHit | null {
  if (idx < 1) return null;
  const prev = bars[idx - 1], cur = bars[idx];
  if (!isGreen(prev) || !isRed(cur)) return null;
  if (!(cur.open >= prev.close && cur.close <= prev.open)) return null;
  const volBoost = avgVol != null && avgVol > 0 ? (cur.volume || 0) / avgVol : null;
  if (volBoost == null || volBoost < 1.0) return null;
  return {
    key: "bearish_engulfing", label: "Ayı Yutan Mum", direction: "SHORT",
    strength: Math.min(1, 0.55 + Math.min(0.45, (volBoost - 1) * 0.3)),
    detail: `önceki yeşili tamamen sardı, hacim ${volBoost.toFixed(2)}×`,
  };
}

// ── 3-4. Çekiç / Yıldız (Hammer / Shooting Star) ─────────────────────

function hammer(bars: Bar[], idx: number, lookback = 10): CandlePatternHit | null {
  const b = bars[idx];
  const r = range(b);
  const bd = body(b);
  const lw = lowerWick(b);
  const uw = upperWick(b);
  if (bd > r * 0.35 || lw < bd * 2 || lw < r * 0.5 || uw > r * 0.15) return null;
  const start = Math.max(0, idx - lookback);
  const recentLow = Math.min(...bars.slice(start, idx + 1).map((x) => x.low));
  const nearSupport = b.low <= recentLow * 1.001;
  if (!nearSupport) return null;
  return {
    key: "hammer", label: "Çekiç (Hammer)", direction: "LONG",
    strength: 0.6,
    detail: `destek bölgesinde uzun alt fitil (gövde/aralık ${(bd / r * 100).toFixed(0)}%)`,
  };
}

function shootingStar(bars: Bar[], idx: number, lookback = 10): CandlePatternHit | null {
  const b = bars[idx];
  const r = range(b);
  const bd = body(b);
  const uw = upperWick(b);
  const lw = lowerWick(b);
  if (bd > r * 0.35 || uw < bd * 2 || uw < r * 0.5 || lw > r * 0.15) return null;
  const start = Math.max(0, idx - lookback);
  const recentHigh = Math.max(...bars.slice(start, idx + 1).map((x) => x.high));
  const nearResistance = b.high >= recentHigh * 0.999;
  if (!nearResistance) return null;
  return {
    key: "shooting_star", label: "Yıldız (Shooting Star)", direction: "SHORT",
    strength: 0.6,
    detail: `direnç bölgesinde uzun üst fitil (gövde/aralık ${(bd / r * 100).toFixed(0)}%)`,
  };
}

// ── 5. Doji ───────────────────────────────────────────────────────────

function doji(bars: Bar[], idx: number): CandlePatternHit | null {
  if (idx < 1) return null;
  const b = bars[idx];
  const r = range(b);
  if (body(b) > r * 0.12) return null;
  const prevDir = isGreen(bars[idx - 1]) ? "LONG" : isRed(bars[idx - 1]) ? "SHORT" : null;
  // Doji tek başına yön vermez — sonraki mumun onayı gerekir; burada sadece
  // "kararsızlık" bilgisi taşınır, yönü önceki trendin TERSİ olası kabul edilir
  // (zayıf sinyal, düşük ağırlık).
  if (!prevDir) return null;
  const dir: PatternDirection = prevDir === "LONG" ? "SHORT" : "LONG";
  return {
    key: "doji", label: "Doji / Kararsızlık", direction: dir,
    strength: 0.25,
    detail: "gövde çok küçük — sonraki mum onayı olmadan zayıf sinyal",
  };
}

// ── 6. İç Mum (Inside Bar) ────────────────────────────────────────────

function insideBar(bars: Bar[], idx: number, avgVol: number | null): CandlePatternHit | null {
  if (idx < 1) return null;
  const prev = bars[idx - 1], cur = bars[idx];
  if (!(cur.high <= prev.high && cur.low >= prev.low)) return null;
  const volBoost = avgVol != null && avgVol > 0 ? (cur.volume || 0) / avgVol : null;
  const dir: PatternDirection = isGreen(cur) ? "LONG" : "SHORT";
  return {
    key: "inside_bar", label: "İç Mum (Inside Bar)", direction: dir,
    strength: volBoost != null && volBoost >= 1.2 ? 0.45 : 0.3,
    detail: `önceki mumun içinde sıkıştı — kırılım yönü izlenir`,
  };
}

// ── 7-8. Kırılım+Retest / Başarısız Kırılım ─────────────────────────

function breakoutRetest(bars: Bar[], idx: number, lookback = 10): CandlePatternHit | null {
  if (idx < 2) return null;
  const start = Math.max(0, idx - lookback);
  const window = bars.slice(start, idx);
  if (window.length < 3) return null;
  const avgVol = avgVolume(bars, idx, lookback);
  if (avgVol == null || avgVol <= 0) return null;
  const priorHigh = Math.max(...window.map((b) => b.high));
  const priorLow = Math.min(...window.map((b) => b.low));

  // Son 1-3 barda yüksek hacimli kırılım var mıydı?
  for (let k = idx - 1; k >= Math.max(start, idx - 3); k--) {
    const brk = bars[k];
    const brkVol = brk.volume || 0;
    if (brkVol < avgVol * 1.4) continue;
    const cur = bars[idx];
    const curVol = cur.volume || 0;
    if (brk.close > priorHigh && cur.low <= brk.close * 1.001 && cur.close >= priorHigh && curVol < avgVol) {
      return {
        key: "breakout_retest", label: "Kırılım + Retest (Yukarı)", direction: "LONG",
        strength: 0.55, detail: "yüksek hacimli kırılım sonrası düşük hacimli retest, seviye korunuyor",
      };
    }
    if (brk.close < priorLow && cur.high >= brk.close * 0.999 && cur.close <= priorLow && curVol < avgVol) {
      return {
        key: "breakout_retest", label: "Kırılım + Retest (Aşağı)", direction: "SHORT",
        strength: 0.55, detail: "yüksek hacimli kırılım sonrası düşük hacimli retest, seviye korunuyor",
      };
    }
  }
  return null;
}

function failedBreakout(bars: Bar[], idx: number, lookback = 10): CandlePatternHit | null {
  if (idx < 2) return null;
  const start = Math.max(0, idx - lookback);
  const window = bars.slice(start, idx - 1);
  if (window.length < 3) return null;
  const avgVol = avgVolume(bars, idx, lookback);
  if (avgVol == null || avgVol <= 0) return null;
  const priorHigh = Math.max(...window.map((b) => b.high));
  const priorLow = Math.min(...window.map((b) => b.low));
  const brk = bars[idx - 1];
  const cur = bars[idx];
  const brkVol = brk.volume || 0;
  if (brkVol < avgVol * 1.4) return null;

  if (brk.high > priorHigh && cur.close < priorHigh) {
    return {
      key: "failed_breakout", label: "Başarısız Kırılım (Bull Trap)", direction: "SHORT",
      strength: 0.6, detail: "yüksek hacimli üst kırılım geri geldi — tuzak, ters yönde işlem",
    };
  }
  if (brk.low < priorLow && cur.close > priorLow) {
    return {
      key: "failed_breakout", label: "Başarısız Kırılım (Bear Trap)", direction: "LONG",
      strength: 0.6, detail: "yüksek hacimli alt kırılım geri geldi — tuzak, ters yönde işlem",
    };
  }
  return null;
}

// ── 9. Hacim Doruğu (Volume Climax) ──────────────────────────────────

function volumeClimax(bars: Bar[], idx: number, lookback = 10): CandlePatternHit | null {
  const avgVol = avgVolume(bars, idx, lookback);
  if (avgVol == null || avgVol <= 0) return null;
  const cur = bars[idx];
  const volRatio = (cur.volume || 0) / avgVol;
  if (volRatio < 2.5) return null;
  const start = Math.max(0, idx - lookback);
  const window = bars.slice(start, idx);
  const recentHigh = Math.max(...window.map((b) => b.high), cur.high);
  const recentLow = Math.min(...window.map((b) => b.low), cur.low);
  if (cur.high >= recentHigh * 0.999 && isRed(cur)) {
    return {
      key: "volume_climax", label: "Hacim Doruğu (Tepe)", direction: "SHORT",
      strength: 0.65, detail: `zirve ekstrem hacimle (${volRatio.toFixed(1)}×) ret aldı`,
    };
  }
  if (cur.low <= recentLow * 1.001 && isGreen(cur)) {
    return {
      key: "volume_climax", label: "Hacim Doruğu (Dip)", direction: "LONG",
      strength: 0.65, detail: `dip ekstrem hacimle (${volRatio.toFixed(1)}×) toparladı`,
    };
  }
  return null;
}

// ── 10. Düşük Hacimli Konsolidasyon → Kırılım ────────────────────────

function lowVolConsolidationBreak(bars: Bar[], idx: number, lookback = 8): CandlePatternHit | null {
  if (idx < lookback + 1) return null;
  const consolStart = idx - lookback;
  const consol = bars.slice(consolStart, idx);
  const consolAvgVol = consol.reduce((s, b) => s + (b.volume || 0), 0) / consol.length;
  const consolRange = Math.max(...consol.map((b) => b.high)) - Math.min(...consol.map((b) => b.low));
  const consolMid = consol.reduce((s, b) => s + b.close, 0) / consol.length;
  if (consolMid <= 0 || consolRange / consolMid > 0.006) return null; // yeterince dar değil

  const cur = bars[idx];
  const curVol = cur.volume || 0;
  if (consolAvgVol <= 0 || curVol < consolAvgVol * 1.4) return null;

  const consolHigh = Math.max(...consol.map((b) => b.high));
  const consolLow = Math.min(...consol.map((b) => b.low));
  if (cur.close > consolHigh) {
    return {
      key: "low_vol_break", label: "Düşük Hacimli Konsolidasyon → Yukarı Kırılım", direction: "LONG",
      strength: 0.5, detail: `dar aralık sonrası hacim artışıyla (${(curVol / consolAvgVol).toFixed(1)}×) yukarı kırıldı`,
    };
  }
  if (cur.close < consolLow) {
    return {
      key: "low_vol_break", label: "Düşük Hacimli Konsolidasyon → Aşağı Kırılım", direction: "SHORT",
      strength: 0.5, detail: `dar aralık sonrası hacim artışıyla (${(curVol / consolAvgVol).toFixed(1)}×) aşağı kırıldı`,
    };
  }
  return null;
}

/**
 * Verilen bardaki (idx, KAPANMIŞ) tüm formasyonları tarar ve bulunanları
 * döndürür (0'dan fazla olabilir — ör. inside bar + doji aynı anda). Çağıran
 * taraf yöne göre en güçlüsünü seçer.
 */
export function detectCandlePatterns(bars: Bar[], idx: number, lookback = 10): CandlePatternHit[] {
  if (idx < 0 || idx >= bars.length) return [];
  const avgVol = avgVolume(bars, idx, lookback);
  const hits: (CandlePatternHit | null)[] = [
    bullishEngulfing(bars, idx, avgVol),
    bearishEngulfing(bars, idx, avgVol),
    hammer(bars, idx, lookback),
    shootingStar(bars, idx, lookback),
    doji(bars, idx),
    insideBar(bars, idx, avgVol),
    breakoutRetest(bars, idx, lookback),
    failedBreakout(bars, idx, lookback),
    volumeClimax(bars, idx, lookback),
    lowVolConsolidationBreak(bars, idx, Math.min(lookback, 8)),
  ];
  return hits.filter((h): h is CandlePatternHit => h != null);
}

/** Bir yön için, o barda bulunan formasyonlar arasından en güçlüsü. */
export function strongestPatternFor(hits: CandlePatternHit[], direction: PatternDirection): CandlePatternHit | null {
  const matching = hits.filter((h) => h.direction === direction);
  if (!matching.length) return null;
  return matching.reduce((best, h) => (h.strength > best.strength ? h : best));
}
