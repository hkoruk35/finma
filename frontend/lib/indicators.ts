// Server-side technical indicator math for the BOGA Chart Engine.
// Pure functions only — no I/O. Computed in app/api/chart-data so the
// math itself never ships to the client.

export interface Bar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SRLevel {
  price: number;
  time_range: [number, number];
  type: "support" | "resistance";
}

// NaN-padded so the output array stays index-aligned with the input bars.
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (prev == null) {
      // seed with SMA of the first `period` values once enough data exists
      if (i >= period - 1) {
        const slice = values.slice(i - period + 1, i + 1);
        prev = slice.reduce((a, b) => a + b, 0) / period;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );

  // signal = EMA of macdLine, computed only over the defined (non-null) tail
  const firstValid = macdLine.findIndex((v) => v != null);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  if (firstValid !== -1) {
    const tail = macdLine.slice(firstValid) as number[];
    const signalTail = ema(tail, signalPeriod);
    for (let i = 0; i < signalTail.length; i++) signal[firstValid + i] = signalTail[i];
  }

  const histogram: (number | null)[] = values.map((_, i) =>
    macdLine[i] != null && signal[i] != null ? (macdLine[i] as number) - (signal[i] as number) : null
  );

  return { macd: macdLine, signal, histogram };
}

export function bollingerBands(
  values: number[],
  period = 20,
  stdDevMult = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const middle: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    middle[i] = mean;
    upper[i] = mean + stdDevMult * sd;
    lower[i] = mean - stdDevMult * sd;
  }
  return { upper, middle, lower };
}

// Resets every time the calendar day (America/New_York) changes — only
// meaningful on intraday bars, per the spec ("gün bitiminde sıfırlanır").
export function vwap(bars: Bar[]): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  let cumPV = 0;
  let cumVol = 0;
  let currentDay = "";

  const nyDay = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleDateString("en-US", { timeZone: "America/New_York" });

  for (let i = 0; i < bars.length; i++) {
    const day = nyDay(bars[i].time);
    if (day !== currentDay) {
      currentDay = day;
      cumPV = 0;
      cumVol = 0;
    }
    const typicalPrice = (bars[i].high + bars[i].low + bars[i].close) / 3;
    cumPV += typicalPrice * bars[i].volume;
    cumVol += bars[i].volume;
    out[i] = cumVol > 0 ? cumPV / cumVol : null;
  }
  return out;
}

// Fractal-based pivot detection: a bar is a pivot high/low if it is the
// extreme point within `lookback` bars on either side. Nearby pivots
// (within 0.5% of price) are merged into a single support/resistance level.
export function pivotSupportResistance(bars: Bar[], lookback = 5): SRLevel[] {
  type RawPivot = { price: number; time: number; type: "support" | "resistance" };
  const raw: RawPivot[] = [];

  for (let i = lookback; i < bars.length - lookback; i++) {
    const window = bars.slice(i - lookback, i + lookback + 1);
    const isHigh = window.every((b) => b.high <= bars[i].high);
    const isLow = window.every((b) => b.low >= bars[i].low);
    if (isHigh) raw.push({ price: bars[i].high, time: bars[i].time, type: "resistance" });
    if (isLow) raw.push({ price: bars[i].low, time: bars[i].time, type: "support" });
  }

  const merged: SRLevel[] = [];
  for (const pivot of raw) {
    const existing = merged.find(
      (level) => level.type === pivot.type && Math.abs(level.price - pivot.price) / pivot.price < 0.005
    );
    if (existing) {
      existing.price = (existing.price + pivot.price) / 2;
      existing.time_range[0] = Math.min(existing.time_range[0], pivot.time);
      existing.time_range[1] = Math.max(existing.time_range[1], pivot.time);
    } else {
      merged.push({ price: pivot.price, time_range: [pivot.time, pivot.time], type: pivot.type });
    }
  }
  return merged;
}

// Resamples bars into fixed-size buckets (e.g. 4 x 60m bars -> one 4h bar).
// Used because Yahoo Finance has no native 4h interval.
export function resampleBars(bars: Bar[], bucketSeconds: number): Bar[] {
  if (bars.length === 0) return [];
  const out: Bar[] = [];
  let bucket: Bar | null = null;
  let bucketStart = -1;

  for (const bar of bars) {
    const start = Math.floor(bar.time / bucketSeconds) * bucketSeconds;
    if (start !== bucketStart) {
      if (bucket) out.push(bucket);
      bucketStart = start;
      bucket = { ...bar, time: start };
    } else if (bucket) {
      bucket.high = Math.max(bucket.high, bar.high);
      bucket.low = Math.min(bucket.low, bar.low);
      bucket.close = bar.close;
      bucket.volume += bar.volume;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}
