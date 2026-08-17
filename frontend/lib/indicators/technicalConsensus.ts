// TradingView'in kamuya açık "Teknik Özet" (Technical Summary) metodolojisiyle
// aynı yapıda: 11 osilatör + 15 hareketli ortalama, GERÇEK günlük mum verisi
// üzerinden hesaplanır. Hiçbir değer rastgele/mock üretilmez — girdi yetersizse
// (bar sayısı az) ilgili gösterge "neutral" döner, asla uydurulmaz.
//
// bkz. lib/indicators.ts (ema/rsi/sma/macd zaten var, burada onları kullanır
// ve eksik olanları — stochastic, CCI, ADX, AO, Momentum, StochRSI, Williams %R,
// Bull/Bear Power, Ultimate Oscillator, VWMA, Hull MA, Ichimoku Base Line — ekler).

import { ema, rsi as rsiSeries, sma, macd as macdCalc } from "@/lib/indicators";

export type Verdict = "buy" | "sell" | "neutral";

export interface IndicatorResult {
  key: string;
  label: string;
  value: number | null;
  verdict: Verdict;
}

export interface TechnicalConsensusResult {
  oscillators: IndicatorResult[];
  movingAverages: IndicatorResult[];
  oscPos: number; oscNeu: number; oscNeg: number;
  maPos: number; maNeu: number; maNeg: number;
  pos: number; neu: number; neg: number;
}

function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as T;
  return null;
}
function at<T>(arr: (T | null)[], idx: number): T | null {
  return idx >= 0 && idx < arr.length ? arr[idx] : null;
}

function wma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j] * (period - j);
    out[i] = sum / denom;
  }
  return out;
}

/** Hull Moving Average: WMA(2*WMA(n/2) - WMA(n), sqrt(n)) */
function hullMa(values: number[], period: number): (number | null)[] {
  const half = Math.max(1, Math.round(period / 2));
  const sqrtP = Math.max(1, Math.round(Math.sqrt(period)));
  const wmaHalf = wma(values, half);
  const wmaFull = wma(values, period);
  const raw: number[] = values.map((_, i) => {
    const h = wmaHalf[i], f = wmaFull[i];
    return h != null && f != null ? 2 * h - f : NaN;
  });
  const firstValid = raw.findIndex((v) => !Number.isNaN(v));
  if (firstValid === -1) return new Array(values.length).fill(null);
  const tail = raw.slice(firstValid);
  const tailWma = wma(tail, sqrtP);
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < tailWma.length; i++) out[firstValid + i] = tailWma[i];
  return out;
}

/** Hacim ağırlıklı hareketli ortalama */
function vwma(closes: number[], volumes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let pv = 0, v = 0;
    for (let j = 0; j < period; j++) {
      pv += closes[i - j] * (volumes[i - j] || 0);
      v += volumes[i - j] || 0;
    }
    out[i] = v > 0 ? pv / v : null;
  }
  return out;
}

/** Ichimoku Taban Çizgisi (Kijun-sen): (period yüksek + period düşük) / 2 */
function ichimokuBaseLine(highs: number[], lows: number[], period = 26): (number | null)[] {
  const out: (number | null)[] = new Array(highs.length).fill(null);
  for (let i = period - 1; i < highs.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    out[i] = (hh + ll) / 2;
  }
  return out;
}

function stochasticK(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    out[i] = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
  }
  return out;
}

function cci(highs: number[], lows: number[], closes: number[], period = 20): (number | null)[] {
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = tp.slice(i - period + 1, i + 1);
    const meanTp = slice.reduce((a, b) => a + b, 0) / period;
    const meanDev = slice.reduce((a, b) => a + Math.abs(b - meanTp), 0) / period;
    out[i] = meanDev === 0 ? 0 : (tp[i] - meanTp) / (0.015 * meanDev);
  }
  return out;
}

/** Wilder ADX + yönlü endeksler (+DI/-DI) */
function adx(highs: number[], lows: number[], closes: number[], period = 14): { adx: (number | null)[]; plusDI: (number | null)[]; minusDI: (number | null)[] } {
  const n = closes.length;
  const tr: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  const smooth = (arr: number[]): number[] => {
    const out = new Array(n).fill(0);
    let sum = arr.slice(1, period + 1).reduce((a, b) => a + b, 0);
    out[period] = sum;
    for (let i = period + 1; i < n; i++) {
      sum = sum - sum / period + arr[i];
      out[i] = sum;
    }
    return out;
  };
  const trSmooth = smooth(tr);
  const plusDMSmooth = smooth(plusDM);
  const minusDMSmooth = smooth(minusDM);
  const plusDI: (number | null)[] = new Array(n).fill(null);
  const minusDI: (number | null)[] = new Array(n).fill(null);
  const dx: (number | null)[] = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    const pDI = trSmooth[i] === 0 ? 0 : (plusDMSmooth[i] / trSmooth[i]) * 100;
    const mDI = trSmooth[i] === 0 ? 0 : (minusDMSmooth[i] / trSmooth[i]) * 100;
    plusDI[i] = pDI;
    minusDI[i] = mDI;
    dx[i] = pDI + mDI === 0 ? 0 : (Math.abs(pDI - mDI) / (pDI + mDI)) * 100;
  }
  const adxOut: (number | null)[] = new Array(n).fill(null);
  const dxValid = dx.slice(period).filter((v): v is number => v != null);
  if (dxValid.length >= period) {
    let firstAdx = dxValid.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let idx = period + period;
    adxOut[idx] = firstAdx;
    let prevAdx = firstAdx;
    for (let i = idx + 1; i < n; i++) {
      const dxi = dx[i];
      if (dxi == null) continue;
      prevAdx = (prevAdx * (period - 1) + dxi) / period;
      adxOut[i] = prevAdx;
    }
  }
  return { adx: adxOut, plusDI, minusDI };
}

function awesomeOscillator(highs: number[], lows: number[]): (number | null)[] {
  const median = highs.map((h, i) => (h + lows[i]) / 2);
  const sma5 = sma(median, 5);
  const sma34 = sma(median, 34);
  return median.map((_, i) => (sma5[i] != null && sma34[i] != null ? (sma5[i] as number) - (sma34[i] as number) : null));
}

function momentum(closes: number[], period = 10): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) out[i] = closes[i] - closes[i - period];
  return out;
}

function williamsR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const hh = Math.max(...highs.slice(i - period + 1, i + 1));
    const ll = Math.min(...lows.slice(i - period + 1, i + 1));
    out[i] = hh === ll ? -50 : ((hh - closes[i]) / (hh - ll)) * -100;
  }
  return out;
}

function ultimateOscillator(highs: number[], lows: number[], closes: number[]): (number | null)[] {
  const n = closes.length;
  const bp: number[] = new Array(n).fill(0);
  const tr: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    bp[i] = closes[i] - Math.min(lows[i], closes[i - 1]);
    tr[i] = Math.max(highs[i], closes[i - 1]) - Math.min(lows[i], closes[i - 1]);
  }
  const sumSlice = (arr: number[], end: number, len: number) => arr.slice(end - len + 1, end + 1).reduce((a, b) => a + b, 0);
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 28; i < n; i++) {
    const avg7 = sumSlice(tr, i, 7) === 0 ? 0 : sumSlice(bp, i, 7) / sumSlice(tr, i, 7);
    const avg14 = sumSlice(tr, i, 14) === 0 ? 0 : sumSlice(bp, i, 14) / sumSlice(tr, i, 14);
    const avg28 = sumSlice(tr, i, 28) === 0 ? 0 : sumSlice(bp, i, 28) / sumSlice(tr, i, 28);
    out[i] = (100 * (4 * avg7 + 2 * avg14 + avg28)) / 7;
  }
  return out;
}

function classifyThreshold(value: number | null, buyBelow: number, sellAbove: number): Verdict {
  if (value == null) return "neutral";
  if (value < buyBelow) return "buy";
  if (value > sellAbove) return "sell";
  return "neutral";
}
function classifyVsLevel(price: number | null, level: number | null): Verdict {
  if (price == null || level == null) return "neutral";
  if (price > level) return "buy";
  if (price < level) return "sell";
  return "neutral";
}

export interface OhlcvSeries {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

/**
 * 26 göstergenin tamamını GERÇEK günlük bar verisinden hesaplar.
 * En az ~210 günlük bar (SMA200/EMA200 için) önerilir; daha azsa o göstergeler
 * "neutral" (yetersiz veri) döner — asla tahmini bir sayı üretilmez.
 */
export function computeTechnicalConsensus(series: OhlcvSeries): TechnicalConsensusResult {
  const { closes, highs, lows, volumes } = series;
  const price = closes[closes.length - 1];

  // ── Osilatörler (11) ──────────────────────────────────────────────
  const rsiVal = last(rsiSeries(closes, 14));
  const rsiVerdict = classifyThreshold(rsiVal, 30, 70);

  const stochK = stochasticK(highs, lows, closes, 14);
  const stochKSmooth = sma(stochK.map((v) => v ?? NaN), 3).map((v) => (v != null && !Number.isNaN(v) ? v : null));
  const stochVal = last(stochKSmooth);
  const stochVerdict = classifyThreshold(stochVal, 20, 80);

  const cciVal = last(cci(highs, lows, closes, 20));
  const cciVerdict = classifyThreshold(cciVal, -100, 100);

  const adxRes = adx(highs, lows, closes, 14);
  const adxVal = last(adxRes.adx);
  const plusDIVal = last(adxRes.plusDI);
  const minusDIVal = last(adxRes.minusDI);
  const adxVerdict: Verdict = adxVal != null && adxVal > 25 && plusDIVal != null && minusDIVal != null
    ? (plusDIVal > minusDIVal ? "buy" : plusDIVal < minusDIVal ? "sell" : "neutral")
    : "neutral";

  const aoSeries = awesomeOscillator(highs, lows);
  const aoVal = last(aoSeries);
  const aoVerdict: Verdict = aoVal == null ? "neutral" : aoVal > 0 ? "buy" : aoVal < 0 ? "sell" : "neutral";

  const mtmVal = last(momentum(closes, 10));
  const mtmVerdict: Verdict = mtmVal == null ? "neutral" : mtmVal > 0 ? "buy" : mtmVal < 0 ? "sell" : "neutral";

  const macdRes = macdCalc(closes, 12, 26, 9);
  const macdLineVal = last(macdRes.macd);
  const macdSignalVal = last(macdRes.signal);
  const macdVerdict: Verdict = macdLineVal != null && macdSignalVal != null
    ? (macdLineVal > macdSignalVal ? "buy" : macdLineVal < macdSignalVal ? "sell" : "neutral")
    : "neutral";

  // Stochastic RSI Fast: RSI(14) serisi üzerine Stochastic(14,3,3) uygulanır
  const rsiSer = rsiSeries(closes, 14).map((v) => (v != null ? v : NaN));
  const rsiValid = rsiSer.filter((v) => !Number.isNaN(v));
  let stochRsiVal: number | null = null;
  if (rsiValid.length >= 14) {
    const stochRsiRaw: (number | null)[] = new Array(rsiValid.length).fill(null);
    for (let i = 13; i < rsiValid.length; i++) {
      const hh = Math.max(...rsiValid.slice(i - 13, i + 1));
      const ll = Math.min(...rsiValid.slice(i - 13, i + 1));
      stochRsiRaw[i] = hh === ll ? 50 : ((rsiValid[i] - ll) / (hh - ll)) * 100;
    }
    const smoothed = sma(stochRsiRaw.map((v) => v ?? NaN), 3).map((v) => (v != null && !Number.isNaN(v) ? v : null));
    stochRsiVal = last(smoothed);
  }
  const stochRsiVerdict = classifyThreshold(stochRsiVal, 20, 80);

  const wrVal = last(williamsR(highs, lows, closes, 14));
  const wrVerdict = classifyThreshold(wrVal, -80, -20);

  const ema13 = ema(closes, 13);
  const bullPowerSeries = highs.map((h, i) => (ema13[i] != null ? h - (ema13[i] as number) : null));
  const bearPowerSeries = lows.map((l, i) => (ema13[i] != null ? l - (ema13[i] as number) : null));
  const bullPowerVal = last(bullPowerSeries);
  const bearPowerVal = last(bearPowerSeries);
  const ema13Val = last(ema13);
  const ema13Prev = at(ema13, ema13.length - 2);
  const bearPowerPrev = at(bearPowerSeries, bearPowerSeries.length - 2);
  const bullPowerPrev = at(bullPowerSeries, bullPowerSeries.length - 2);
  let bullBearVerdict: Verdict = "neutral";
  if (ema13Val != null && ema13Prev != null && bearPowerVal != null && bearPowerPrev != null && ema13Val > ema13Prev && bearPowerVal < 0 && bearPowerVal > bearPowerPrev) {
    bullBearVerdict = "buy";
  } else if (ema13Val != null && ema13Prev != null && bullPowerVal != null && bullPowerPrev != null && ema13Val < ema13Prev && bullPowerVal > 0 && bullPowerVal < bullPowerPrev) {
    bullBearVerdict = "sell";
  }

  const uoVal = last(ultimateOscillator(highs, lows, closes));
  const uoVerdict = classifyThreshold(uoVal, 30, 70);

  const oscillators: IndicatorResult[] = [
    { key: "rsi14", label: "RSI (14)", value: rsiVal, verdict: rsiVerdict },
    { key: "stoch14_3_3", label: "Stochastic %K (14,3,3)", value: stochVal, verdict: stochVerdict },
    { key: "cci20", label: "CCI (20)", value: cciVal, verdict: cciVerdict },
    { key: "adx14", label: "ADX (14)", value: adxVal, verdict: adxVerdict },
    { key: "ao", label: "Awesome Oscillator", value: aoVal, verdict: aoVerdict },
    { key: "mtm10", label: "Momentum (10)", value: mtmVal, verdict: mtmVerdict },
    { key: "macd", label: "MACD Level (12,26)", value: macdLineVal, verdict: macdVerdict },
    { key: "stochrsi", label: "Stochastic RSI Fast", value: stochRsiVal, verdict: stochRsiVerdict },
    { key: "williamsr", label: "Williams %R", value: wrVal, verdict: wrVerdict },
    { key: "bullbear", label: "Bull/Bear Power (13)", value: bullPowerVal, verdict: bullBearVerdict },
    { key: "uo", label: "Ultimate Oscillator", value: uoVal, verdict: uoVerdict },
  ];

  // ── Hareketli Ortalamalar (15) ────────────────────────────────────
  const maPeriods = [10, 20, 30, 50, 100, 200];
  const movingAverages: IndicatorResult[] = [];
  for (const p of maPeriods) {
    const emaVal = last(ema(closes, p));
    movingAverages.push({ key: `ema${p}`, label: `EMA${p}`, value: emaVal, verdict: classifyVsLevel(price, emaVal) });
    const smaVal = last(sma(closes, p));
    movingAverages.push({ key: `sma${p}`, label: `SMA${p}`, value: smaVal, verdict: classifyVsLevel(price, smaVal) });
  }
  const baseLineVal = last(ichimokuBaseLine(highs, lows, 26));
  movingAverages.push({ key: "ichimoku_base", label: "Ichimoku Taban Çizgisi", value: baseLineVal, verdict: classifyVsLevel(price, baseLineVal) });
  const vwmaVal = last(vwma(closes, volumes, 20));
  movingAverages.push({ key: "vwma20", label: "VWMA (20)", value: vwmaVal, verdict: classifyVsLevel(price, vwmaVal) });
  const hullVal = last(hullMa(closes, 9));
  movingAverages.push({ key: "hullma9", label: "Hull MA (9)", value: hullVal, verdict: classifyVsLevel(price, hullVal) });

  const count = (list: IndicatorResult[], v: Verdict) => list.filter((x) => x.verdict === v).length;
  const oscPos = count(oscillators, "buy"), oscNeg = count(oscillators, "sell"), oscNeu = oscillators.length - oscPos - oscNeg;
  const maPos = count(movingAverages, "buy"), maNeg = count(movingAverages, "sell"), maNeu = movingAverages.length - maPos - maNeg;

  return {
    oscillators,
    movingAverages,
    oscPos, oscNeu, oscNeg,
    maPos, maNeu, maNeg,
    pos: oscPos + maPos,
    neu: oscNeu + maNeu,
    neg: oscNeg + maNeg,
  };
}
