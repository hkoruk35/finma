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

// Heikin Ashi candle transform — a display style, not a proprietary
// indicator, so it's computed client-side in BogaChartEngine rather than
// piped through the API.
export function heikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  let prevOpen = 0;
  let prevClose = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(b.high, haOpen, haClose);
    const haLow = Math.min(b.low, haOpen, haClose);
    out.push({ time: b.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: b.volume });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return out;
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

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += values[i - j];
    out[i] = sum / period;
  }
  return out;
}

export function trueRange(bars: Bar[]): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;
  out[0] = bars[0].high - bars[0].low;
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevClose = bars[i - 1].close;
    out[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  return out;
}

export function atr(bars: Bar[], period = 14): (number | null)[] {
  const tr = trueRange(bars);
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length < period) return out;
  
  let trSum = 0;
  for (let i = 0; i < period; i++) trSum += tr[i]!;
  out[period - 1] = trSum / period;
  
  for (let i = period; i < bars.length; i++) {
    out[i] = (out[i - 1]! * (period - 1) + tr[i]!) / period;
  }
  return out;
}

export function supertrend(bars: Bar[], atrPeriod = 10, multiplier = 3): { supertrend: (number | null)[]; direction: (number | null)[] } {
  const atrValues = atr(bars, atrPeriod);
  const st: (number | null)[] = new Array(bars.length).fill(null);
  const dir: (number | null)[] = new Array(bars.length).fill(null);
  
  let finalUpperBand = 0;
  let finalLowerBand = 0;
  let supertrend = 0;
  let direction = 1;

  for (let i = atrPeriod - 1; i < bars.length; i++) {
    const atrVal = atrValues[i]!;
    const basicUpperBand = (bars[i].high + bars[i].low) / 2 + multiplier * atrVal;
    const basicLowerBand = (bars[i].high + bars[i].low) / 2 - multiplier * atrVal;

    if (i === atrPeriod - 1) {
      finalUpperBand = basicUpperBand;
      finalLowerBand = basicLowerBand;
      direction = 1;
    } else {
      finalUpperBand = basicUpperBand < finalUpperBand || bars[i - 1].close > finalUpperBand ? basicUpperBand : finalUpperBand;
      finalLowerBand = basicLowerBand > finalLowerBand || bars[i - 1].close < finalLowerBand ? basicLowerBand : finalLowerBand;
      
      if (direction === -1 && bars[i].close > finalUpperBand) direction = 1;
      else if (direction === 1 && bars[i].close < finalLowerBand) direction = -1;
    }
    
    supertrend = direction === 1 ? finalLowerBand : finalUpperBand;
    st[i] = supertrend;
    dir[i] = direction;
  }
  return { supertrend: st, direction: dir };
}

export function obv(bars: Bar[]): (number | null)[] {
  const out: (number | null)[] = new Array(bars.length).fill(null);
  if (bars.length === 0) return out;
  
  let currentObv = 0;
  out[0] = currentObv;
  
  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) {
      currentObv += bars[i].volume;
    } else if (bars[i].close < bars[i - 1].close) {
      currentObv -= bars[i].volume;
    }
    out[i] = currentObv;
  }
  return out;
}

export function volatility(closes: number[], period = 20): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  
  const returns: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    returns[i] = Math.log(closes[i] / closes[i - 1]);
  }
  
  for (let i = period; i < closes.length; i++) {
    const slice = returns.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (period - 1 || 1);
    const stdDev = Math.sqrt(variance);
    out[i] = stdDev * Math.sqrt(252) * 100; // Annualized percentage
  }
  return out;
}

// --- NEW AUTOMATED INDICATORS ---

export interface FVGZone {
  start_time: number;
  top: number;
  bottom: number;
  type: "bullish" | "bearish";
}

export function fvg(bars: Bar[]): FVGZone[] {
  const zones: FVGZone[] = [];
  for (let i = 2; i < bars.length; i++) {
    const b1 = bars[i - 2];
    const b2 = bars[i - 1];
    const b3 = bars[i];
    
    // Bullish FVG: b1.high < b3.low
    if (b1.high < b3.low && b2.close > b2.open) {
      zones.push({ start_time: b2.time, top: b3.low, bottom: b1.high, type: "bullish" });
    }
    // Bearish FVG: b1.low > b3.high
    else if (b1.low > b3.high && b2.close < b2.open) {
      zones.push({ start_time: b2.time, top: b1.low, bottom: b3.high, type: "bearish" });
    }
  }
  return zones.slice(-10); // Return up to 10 recent FVGs
}

export interface SDZone {
  start_time: number;
  top: number;
  bottom: number;
  type: "supply" | "demand";
}

export function supplyDemand(bars: Bar[]): SDZone[] {
  const zones: SDZone[] = [];
  const ATR = atr(bars, 14);
  
  for (let i = 4; i < bars.length; i++) {
    const currentAtr = ATR[i - 1];
    if (currentAtr == null) continue;
    
    const move = Math.abs(bars[i].close - bars[i].open);
    if (move > currentAtr * 1.5) { // Impulse move
      const baseCandle = bars[i - 1];
      const baseMove = Math.abs(baseCandle.close - baseCandle.open);
      
      if (baseMove < currentAtr * 0.8) {
        if (bars[i].close > bars[i].open) {
          zones.push({
            start_time: baseCandle.time,
            top: Math.max(baseCandle.open, baseCandle.close),
            bottom: baseCandle.low,
            type: "demand"
          });
        } else {
          zones.push({
            start_time: baseCandle.time,
            top: baseCandle.high,
            bottom: Math.min(baseCandle.open, baseCandle.close),
            type: "supply"
          });
        }
      }
    }
  }
  return zones.slice(-10);
}

export interface CandlePattern {
  time: number;
  name: string;
  type: "bullish" | "bearish" | "neutral";
}

export function candlestickPatterns(bars: Bar[]): CandlePattern[] {
  const patterns: CandlePattern[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prev = bars[i - 1];
    
    const body = Math.abs(b.close - b.open);
    const range = b.high - b.low;
    const upperWick = b.high - Math.max(b.close, b.open);
    const lowerWick = Math.min(b.close, b.open) - b.low;
    
    // Doji
    if (body <= range * 0.1 && range > 0) {
      patterns.push({ time: b.time, name: "Doji", type: "neutral" });
      continue;
    }
    
    // Hammer
    if (lowerWick >= body * 2 && upperWick <= range * 0.1) {
      patterns.push({ time: b.time, name: "Hammer", type: "bullish" });
    }
    
    // Engulfing
    if (b.close > b.open && prev.close < prev.open && b.close > prev.open && b.open < prev.close) {
      patterns.push({ time: b.time, name: "Engulfing", type: "bullish" });
    } else if (b.close < b.open && prev.close > prev.open && b.close < prev.open && b.open > prev.close) {
      patterns.push({ time: b.time, name: "Engulfing", type: "bearish" });
    }
  }
  return patterns;
}

export interface ChartPattern {
  name: string;
  points: { time: number, price: number }[];
  type: "bullish" | "bearish";
}

function findPivots(bars: Bar[], window = 5) {
  const pivots = [];
  for (let i = window; i < bars.length - window; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= window; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
    }
    if (isHigh) pivots.push({ time: bars[i].time, price: bars[i].high, type: 'high' as const, index: i });
    if (isLow) pivots.push({ time: bars[i].time, price: bars[i].low, type: 'low' as const, index: i });
  }
  return pivots;
}

export function chartPatterns(bars: Bar[]): ChartPattern[] {
  const pivots = findPivots(bars, 10);
  const patterns: ChartPattern[] = [];
  
  const highs = pivots.filter(p => p.type === 'high');
  for (let i = 0; i < highs.length - 2; i++) {
    const h1 = highs[i];
    const h2 = highs[i + 1];
    const h3 = highs[i + 2];
    
    // Head & Shoulders
    if (h2.price > h1.price && h2.price > h3.price) {
      const diff = Math.abs(h1.price - h3.price) / h1.price;
      if (diff < 0.05) {
        patterns.push({
          name: "Head & Shoulders",
          type: "bearish",
          points: [h1, h2, h3].map(p => ({ time: p.time, price: p.price }))
        });
        i += 2;
      }
    }
  }
  
  const lows = pivots.filter(p => p.type === 'low');
  for (let i = 0; i < lows.length - 2; i++) {
    const l1 = lows[i];
    const l2 = lows[i + 1];
    const l3 = lows[i + 2];
    
    // Inverse Head & Shoulders
    if (l2.price < l1.price && l2.price < l3.price) {
      const diff = Math.abs(l1.price - l3.price) / l1.price;
      if (diff < 0.05) {
        patterns.push({
          name: "Inverse H&S",
          type: "bullish",
          points: [l1, l2, l3].map(p => ({ time: p.time, price: p.price }))
        });
        i += 2;
      }
    }
  }
  
  return patterns.slice(-2);
}

export interface FibonacciZone {
  start_time: number;
  end_time: number;
  levels: { price: number, level: number }[];
  high: number;
  low: number;
}

export function fibonacci(bars: Bar[]): FibonacciZone | null {
  if (bars.length < 50) return null;
  const window = bars.slice(-100);
  let highest = window[0];
  let lowest = window[0];
  for (let b of window) {
    if (b.high > highest.high) highest = b;
    if (b.low < lowest.low) lowest = b;
  }
  
  const diff = highest.high - lowest.low;
  const isUp = highest.time > lowest.time;
  
  const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const fibLevels = levels.map(l => ({
    level: l,
    price: isUp ? highest.high - diff * l : lowest.low + diff * l
  }));
  
  return {
    start_time: Math.min(highest.time, lowest.time),
    end_time: bars[bars.length - 1].time,
    levels: fibLevels,
    high: highest.high,
    low: lowest.low
  };
}

export interface TrendLine {
  start_time: number;
  start_price: number;
  end_time: number;
  end_price: number;
  type: "support" | "resistance";
}

export function trendLine(bars: Bar[]): TrendLine[] {
  const pivots = findPivots(bars, 10);
  const lines: TrendLine[] = [];
  
  const highs = pivots.filter(p => p.type === 'high');
  const lows = pivots.filter(p => p.type === 'low');
  
  if (highs.length >= 2) {
    const h1 = highs[highs.length - 2];
    const h2 = highs[highs.length - 1];
    lines.push({
      start_time: h1.time, start_price: h1.price,
      end_time: h2.time, end_price: h2.price,
      type: "resistance"
    });
  }
  
  if (lows.length >= 2) {
    const l1 = lows[lows.length - 2];
    const l2 = lows[lows.length - 1];
    lines.push({
      start_time: l1.time, start_price: l1.price,
      end_time: l2.time, end_price: l2.price,
      type: "support"
    });
  }
  return lines;
}
e x p o r t   i n t e r f a c e   H o r i z o n t a l L i n e   {   p r i c e :   n u m b e r ;   t y p e :   ' s u p p o r t '   |   ' r e s i s t a n c e ' ;   }  
 e x p o r t   f u n c t i o n   h o r i z o n t a l L i n e ( b a r s :   B a r [ ] ) :   H o r i z o n t a l L i n e [ ]   {   i f   ( b a r s . l e n g t h   <   5 0 )   r e t u r n   [ ] ;   c o n s t   p i v o t s   =   p i v o t S u p p o r t R e s i s t a n c e ( b a r s ,   2 0 ) ;   c o n s t   h i g h s   =   p i v o t s . f i l t e r ( ( p )   = >   p . t y p e   = = =   ' r e s i s t a n c e ' ) . s o r t ( ( a ,   b )   = >   b . p r i c e   -   a . p r i c e ) ;   c o n s t   l o w s   =   p i v o t s . f i l t e r ( ( p )   = >   p . t y p e   = = =   ' s u p p o r t ' ) . s o r t ( ( a ,   b )   = >   a . p r i c e   -   b . p r i c e ) ;   c o n s t   l i n e s :   H o r i z o n t a l L i n e [ ]   =   [ ] ;   i f   ( h i g h s [ 0 ] )   l i n e s . p u s h ( {   p r i c e :   h i g h s [ 0 ] . p r i c e ,   t y p e :   ' r e s i s t a n c e '   } ) ;   i f   ( l o w s [ 0 ] )   l i n e s . p u s h ( {   p r i c e :   l o w s [ 0 ] . p r i c e ,   t y p e :   ' s u p p o r t '   } ) ;   r e t u r n   l i n e s ;   }  
 