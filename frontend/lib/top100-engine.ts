import { formatNumber } from "@/lib/formatNumber";

/**
 * BOGA AI Top 100 Tracker — paylaşılan hesaplama motoru.
 * Admin'in "ticker ekle" anlık seed çağrısı VE saatlik bot pipeline'ı (Faz 6)
 * aynı `computeTop100Snapshot()` fonksiyonunu çağırır — paralel bir mekanizma yok.
 */

export interface Top100SnapshotResult {
  ticker: string;
  company: string;
  price: number;
  volume: number;
  change_pct: number;
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macd: number;
  adx: number;
  pattern: string;
  signal: string; // "AL" | "SAT" | "İzle" | "Bekle"
  character: "investment" | "swing";
}

async function yf(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function safeArr(arr: any[] | null | undefined): number[] {
  return (arr ?? []).filter((v: any) => v != null && isFinite(v)) as number[];
}

// ── EMA / RSI / SMA (watchlist-data/route.ts ile aynı formüller — sinyal sözlüğü tutarlılığı için) ──

function calcEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
  return ema;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

function calcSMA(closes: number[], period: number): number {
  const arr = closes.slice(-period);
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function calcRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macdLine = closes.map((_, i) => ema12[i] - ema26[i]);
  const signalSeries = emaSeries(macdLine.slice(25), 9);
  const macd = macdLine.at(-1) ?? 0;
  const signal = signalSeries.at(-1) ?? 0;
  return { macd, signal, histogram: macd - signal };
}

function calcADX(highs: number[], lows: number[], closes: number[], period = 14): number {
  const n = highs.length;
  if (n < period * 2) return 20;
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [0];
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  const smooth = (arr: number[]): number[] => {
    const out: number[] = [];
    let sum = arr.slice(1, period + 1).reduce((s, v) => s + v, 0);
    out[period] = sum;
    for (let i = period + 1; i < arr.length; i++) {
      sum = sum - arr[i - period] + arr[i];
      out[i] = sum;
    }
    return out;
  };
  const trS = smooth(tr);
  const plusS = smooth(plusDM);
  const minusS = smooth(minusDM);
  const dx: number[] = [];
  for (let i = period; i < n; i++) {
    const trv = trS[i] || 1e-9;
    const plusDI = (100 * plusS[i]) / trv;
    const minusDI = (100 * minusS[i]) / trv;
    const sum = plusDI + minusDI || 1e-9;
    dx.push((100 * Math.abs(plusDI - minusDI)) / sum);
  }
  if (dx.length === 0) return 20;
  const tail = dx.slice(-period);
  return tail.reduce((s, v) => s + v, 0) / tail.length;
}

function calcATRPct(highs: number[], lows: number[], closes: number[], price: number, period = 14): number {
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }
  if (trs.length === 0 || price <= 0) return 0;
  const atr = trs.slice(-period).reduce((s, v) => s + v, 0) / Math.min(period, trs.length);
  return (atr / price) * 100;
}

// ── EMA Status / Pattern / Sinyal (watchlist-data/route.ts'ten birebir port) ──

function getEMAStatus(price: number, ema20: number, ema50: number, ema200: number): string {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return "Bullish";
  if (price > ema20 && ema20 > ema50 && ema50 <= ema200) return "Yükseliş";
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return "Bearish";
  if (price < ema20 && ema20 < ema50 && ema50 >= ema200) return "Düşüş";
  return "Nötr";
}

function detectCandlePattern(closes: number[], opens: number[], highs: number[], lows: number[]): string {
  if (closes.length < 3) return "Yetersiz Veri";
  const n = closes.length;
  const curr = { open: opens[n - 2], close: closes[n - 2], high: highs[n - 2], low: lows[n - 2] };
  const prev = { open: opens[n - 3], close: closes[n - 3], high: highs[n - 3], low: lows[n - 3] };
  const prev2 = n >= 4 ? { open: opens[n - 4], close: closes[n - 4] } : null;

  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low || 0.0001;
  const lower_wick = Math.min(curr.close, curr.open) - curr.low;
  const upper_wick = curr.high - Math.max(curr.close, curr.open);
  const bullish = curr.close > curr.open;
  const prev_bullish = prev.close > prev.open;
  const prev_body = Math.abs(prev.close - prev.open);

  const recentBodies: number[] = [];
  for (let i = Math.max(0, n - 12); i < n - 2; i++) recentBodies.push(Math.abs(closes[i] - opens[i]));
  const avgBody = recentBodies.length > 0 ? recentBodies.reduce((a, b) => a + b, 0) / recentBodies.length : body;

  if (body < avgBody * 0.15 && body < range * 0.08) {
    if (lower_wick > range * 0.6 && upper_wick < range * 0.1) return "Dragonfly Doji";
    if (upper_wick > range * 0.6 && lower_wick < range * 0.1) return "Gravestone Doji";
    return "Doji";
  }

  if (bullish && !prev_bullish && curr.open <= prev.close && curr.close >= prev.open && body > prev_body * 0.9) return "Bullish Engulfing";
  if (!bullish && prev_bullish && curr.open >= prev.close && curr.close <= prev.open && body > prev_body * 0.9) return "Bearish Engulfing";

  if (lower_wick < body * 0.05 && upper_wick < body * 0.05) return bullish ? "Bullish Marubozu" : "Bearish Marubozu";

  if (body > range * 0.15) {
    if (lower_wick > body * 2.5 && upper_wick < body * 0.4) return bullish ? "Hammer" : "Hanging Man";
    if (upper_wick > body * 2.5 && lower_wick < body * 0.4) return bullish ? "Inv. Hammer" : "Shooting Star";
  }

  if (curr.high < prev.high && curr.low > prev.low) return "Inside Bar";
  if (curr.high > prev.high && curr.low < prev.low) return bullish ? "Outside Bar ↑" : "Outside Bar ↓";

  if (body < range * 0.25 && lower_wick > range * 0.2 && upper_wick > range * 0.2) return bullish ? "Spinning Top ↑" : "Spinning Top ↓";

  if (prev2) {
    const prev2_bullish = prev2.close > prev2.open;
    const prev2_body = Math.abs(prev2.close - prev2.open);
    if (!prev2_bullish && prev_body < prev2_body * 0.4 && bullish && body > prev2_body * 0.5 && curr.close > (prev2.open + prev2.close) / 2) return "Morning Star";
    if (prev2_bullish && prev_body < prev2_body * 0.4 && !bullish && body > prev2_body * 0.5 && curr.close < (prev2.open + prev2.close) / 2) return "Evening Star";
    if (bullish && prev_bullish && prev2_bullish && curr.close > prev.close && prev.close > prev2.close && curr.open > prev.open && prev.open > prev2.open) return "3 Asker ↑";
    if (!bullish && !prev_bullish && !prev2_bullish && curr.close < prev.close && prev.close < prev2.close && curr.open < prev.open && prev.open < prev2.open) return "3 Karga ↓";
  }

  const bodyRatio = body / range;
  if (bullish) {
    if (bodyRatio > 0.65) return "Güçlü ↑";
    if (upper_wick > lower_wick * 2) return "Üst Fitil ↑";
    return "Yeşil Mum ↑";
  } else {
    if (bodyRatio > 0.65) return "Güçlü ↓";
    if (lower_wick > upper_wick * 2) return "Alt Fitil ↓";
    return "Kırmızı Mum ↓";
  }
}

function calculateSignal(emaStatus: string, rsi: number, pattern: string, volumeRatio: number): string {
  const bullishPatterns = ["Hammer", "Bullish Engulfing", "Inv. Hammer"];
  const bearishPatterns = ["Shooting Star", "Bearish Engulfing", "Hanging Man"];

  const isBullishEMA = ["Bullish", "Yükseliş"].includes(emaStatus);
  const isBearishEMA = ["Bearish", "Düşüş"].includes(emaStatus);
  const hasGoodRSI = rsi >= 50 && rsi <= 70;
  const hasBadRSI = rsi < 45;
  const hasGoodVolume = volumeRatio >= 0.8;

  if (isBullishEMA && hasGoodRSI && bullishPatterns.includes(pattern) && hasGoodVolume) return "AL";
  if (isBearishEMA && hasBadRSI && bearishPatterns.includes(pattern)) return "SAT";

  const bullishConditions = [isBullishEMA, hasGoodRSI, bullishPatterns.includes(pattern), hasGoodVolume].filter(Boolean).length;
  if (bullishConditions >= 2 || bullishPatterns.includes(pattern)) return "İzle";

  return "Bekle";
}

// ── Karakter sınıflandırması (Karar D: Weinstein stage + ATR/RVOL kalıcılığı, kaynaktan bağımsız) ──

function weinsteinStage(closes: number[]): number {
  if (closes.length < 40) return 1;
  const sma30 = calcSMA(closes, 30);
  const sma30Prev = calcSMA(closes.slice(0, -10), 30);
  const slope = sma30 - sma30Prev;
  const price = closes.at(-1)!;
  if (price > sma30 && slope > sma30 * 0.001) return 2;
  if (price > sma30 && slope <= sma30 * 0.001) return 3;
  if (price < sma30 && slope < 0) return 4;
  return 1;
}

function calcRvolPersistence(vols: number[], avgVol: number, lookback = 10): number {
  const recent = vols.slice(-lookback);
  if (recent.length === 0 || avgVol <= 0) return 0;
  const spikes = recent.filter((v) => v > avgVol * 1.3).length;
  return spikes / recent.length;
}

function classifyCharacter(params: { stage: number; atrPct: number; rvolPersistence: number }): "investment" | "swing" {
  const { stage, atrPct, rvolPersistence } = params;
  if (stage === 2 && atrPct < 4 && rvolPersistence < 0.3) return "investment";
  if (atrPct >= 4 || rvolPersistence >= 0.3) return "swing";
  return stage === 2 ? "investment" : "swing";
}

// ── Ana hesaplama fonksiyonu ──────────────────────────────────────────────────

export async function computeTop100Snapshot(ticker: string): Promise<Top100SnapshotResult | null> {
  const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
  const [rDaily, rHourly] = await Promise.all([
    yf(`${BASE}/${ticker}?range=1y&interval=1d`),
    yf(`${BASE}/${ticker}?range=10d&interval=1h`),
  ]);

  if (!rDaily?.chart?.result?.[0]) return null;

  const meta = rDaily.chart.result[0].meta ?? {};
  const qDaily = rDaily.chart.result[0].indicators?.quote?.[0] ?? {};
  const qHourly = rHourly?.chart?.result?.[0]?.indicators?.quote?.[0] ?? {};

  const closesD = safeArr(qDaily.close);
  const highsD = safeArr(qDaily.high);
  const lowsD = safeArr(qDaily.low);
  const volsD = safeArr(qDaily.volume);
  if (closesD.length < 20) return null;

  const closesH = safeArr(qHourly.close);
  const opensH = safeArr(qHourly.open);
  const highsH = safeArr(qHourly.high);
  const lowsH = safeArr(qHourly.low);
  const volsH = safeArr(qHourly.volume);

  const price = meta.regularMarketPrice ?? closesD.at(-1)!;
  const prevClose = meta.previousClose ?? closesD.at(-2) ?? price;
  const change_pct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  const volume = meta.regularMarketVolume ?? volsD.at(-1) ?? 0;
  const avgVol30 = volsD.length > 0 ? volsD.slice(-30).reduce((s, v) => s + v, 0) / Math.min(30, volsD.length) : volume;

  let ema20 = 0, ema50 = 0, ema200 = 0, rsi = 50, pattern = "—", signal = "Bekle";

  if (closesH.length >= 20) {
    ema20 = calcEMA(closesH, 20);
    ema50 = calcEMA(closesH, Math.min(50, closesH.length));
    ema200 = calcEMA(closesH.slice(-Math.min(120, closesH.length)), Math.min(120, closesH.length));
    rsi = calcRSI(closesH, 14);
    pattern = detectCandlePattern(closesH, opensH, highsH, lowsH);
    const avgVolH = volsH.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, volsH.length || 1);
    const volumeRatio = avgVolH > 0 ? (volsH.at(-1) ?? 0) / avgVolH : 1;
    const emaStatus = getEMAStatus(closesH.at(-1)!, ema20, ema50, ema200);
    signal = calculateSignal(emaStatus, rsi, pattern, volumeRatio);
  } else {
    ema20 = calcEMA(closesD, 20);
    ema50 = calcEMA(closesD, Math.min(50, closesD.length));
    ema200 = calcEMA(closesD.slice(-Math.min(200, closesD.length)), Math.min(200, closesD.length));
    rsi = calcRSI(closesD, 14);
  }

  const useHourlyForMomentum = closesH.length >= 30;
  const macdResult = calcMACD(useHourlyForMomentum ? closesH : closesD);
  const adx = calcADX(
    useHourlyForMomentum ? highsH : highsD,
    useHourlyForMomentum ? lowsH : lowsD,
    useHourlyForMomentum ? closesH : closesD
  );

  const stage = weinsteinStage(closesD);
  const atrPct = calcATRPct(highsD, lowsD, closesD, price);
  const rvolPersistence = calcRvolPersistence(volsD, avgVol30);
  const character = classifyCharacter({ stage, atrPct, rvolPersistence });

  return {
    ticker,
    company: meta.shortName || meta.longName || ticker,
    price: +formatNumber(price, 2),
    volume,
    change_pct: +formatNumber(change_pct, 2),
    ema20: +formatNumber(ema20, 2),
    ema50: +formatNumber(ema50, 2),
    ema200: +formatNumber(ema200, 2),
    rsi: +formatNumber(rsi, 1),
    macd: +formatNumber(macdResult.macd, 3),
    adx: +formatNumber(adx, 1),
    pattern,
    signal,
    character,
  };
}
