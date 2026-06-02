import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Import ticker-to-sector mapping from theme data
// This ensures 559+ tickers have accurate sector information
let TICKER_SECTOR_MAP: Record<string, string> = {};
try {
  const mappingPath = path.join(process.cwd(), "lib", "sectorMapping.ts");
  if (fs.existsSync(mappingPath)) {
    // Note: In runtime, we'd need to parse this, but for now we'll handle it inline
    const mappingContent = fs.readFileSync(mappingPath, "utf-8");
    const mapMatch = mappingContent.match(/export const TICKER_SECTOR_MAP.*?\{([\s\S]*?)\};/);
    if (mapMatch) {
      // Parse the mapping entries
      const entries = mapMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [ticker, sector] = entry.match(/"([^"]+)"/g) || [];
          if (ticker && sector) {
            TICKER_SECTOR_MAP[ticker.replace(/"/g, '')] = sector.replace(/"/g, '');
          }
        });
      }
    }
  }
} catch {}
// Fallback: Inline the most critical tickers if file loading fails
if (Object.keys(TICKER_SECTOR_MAP).length === 0) {
  TICKER_SECTOR_MAP = {
    "AAPL": "Technology", "MSFT": "Technology", "GOOGL": "Technology", "META": "Technology",
    "NVDA": "Technology", "AMD": "Technology", "AVGO": "Technology", "INTC": "Technology",
    "JPM": "Financials", "BAC": "Financials", "WFC": "Financials", "GS": "Financials",
    "JNJ": "Healthcare", "PFE": "Healthcare", "ABBV": "Healthcare", "MRK": "Healthcare",
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy", "EOG": "Energy",
    "JCI": "Industrials", "BA": "Industrials", "GE": "Industrials", "HON": "Industrials",
    "PG": "Consumer Staples", "KO": "Consumer Staples", "PEP": "Consumer Staples", "MO": "Consumer Staples",
    "TSLA": "Consumer Discretionary", "AMZN": "Consumer Discretionary", "HD": "Consumer Discretionary",
    "DIS": "Communication Services", "CMCSA": "Communication Services", "VZ": "Communication Services",
    "SPG": "Real Estate", "AMT": "Real Estate", "PLD": "Real Estate"
  };
}

// Recurse to find the local python fallback or JSON files
const DATA_ROOT = process.env.FINMA_DATA_PATH
  ? path.resolve(process.env.FINMA_DATA_PATH)
  : path.resolve(process.cwd(), "..", "transfer");

export const runtime = "nodejs";
export const maxDuration = 30;

// ── In-Memory Cache for Yahoo Finance data (5 min TTL) ──────────────────────
const YAHOO_CACHE: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedYahooData(ticker: string) {
  const cached = YAHOO_CACHE[ticker];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCachedYahooData(ticker: string, data: any) {
  YAHOO_CACHE[ticker] = { data, timestamp: Date.now() };
}

// ── Tracker-specific calculations ────────────────────────────────────────────

function getEMAStatus(price: number, ema20: number, ema50: number, ema200: number): string {
  if (price > ema20 && ema20 > ema50 && ema50 > ema200) return "Bullish";
  if (price > ema20 && ema20 > ema50 && ema50 <= ema200) return "Yükseliş";
  if (price < ema20 && ema20 < ema50 && ema50 < ema200) return "Bearish";
  if (price < ema20 && ema20 < ema50 && ema50 >= ema200) return "Düşüş";
  return "Nötr";
}

function detectCandlePattern(
  closes: number[],
  opens: number[],
  highs: number[],
  lows: number[]
): string {
  if (closes.length < 2) return "Yetersiz Veri";

  const curr = { open: opens[opens.length - 1], close: closes[closes.length - 1], high: highs[highs.length - 1], low: lows[lows.length - 1] };
  const prev = { open: opens[opens.length - 2], close: closes[closes.length - 2], high: highs[highs.length - 2], low: lows[lows.length - 2] };
  const prev2 = closes.length >= 3 ? { open: opens[opens.length - 3], close: closes[closes.length - 3] } : null;

  const body = Math.abs(curr.close - curr.open);
  const range = curr.high - curr.low || 0.0001;
  const midPrice = (curr.high + curr.low) / 2;
  const lower_wick = Math.min(curr.close, curr.open) - curr.low;
  const upper_wick = curr.high - Math.max(curr.close, curr.open);
  const bullish = curr.close > curr.open;
  const prev_bullish = prev.close > prev.open;
  const prev_body = Math.abs(prev.close - prev.open);

  // ── Doji: gövde fiyatın %0.3'ünden az (range değil, price bazlı) ─────────
  const bodyPct = midPrice > 0 ? body / midPrice : 0;
  if (bodyPct < 0.003) {
    if (lower_wick > range * 0.6 && upper_wick < range * 0.1) return "Dragonfly Doji";
    if (upper_wick > range * 0.6 && lower_wick < range * 0.1) return "Gravestone Doji";
    return "Doji";
  }

  // ── Engulfing ────────────────────────────────────────────
  if (bullish && !prev_bullish && curr.open <= prev.close && curr.close >= prev.open && body > prev_body * 0.9) return "Bullish Engulfing";
  if (!bullish && prev_bullish && curr.open >= prev.close && curr.close <= prev.open && body > prev_body * 0.9) return "Bearish Engulfing";

  // ── Marubozu: neredeyse hiç fitil yok ────────────────────
  if (lower_wick < body * 0.05 && upper_wick < body * 0.05) {
    return bullish ? "Bullish Marubozu" : "Bearish Marubozu";
  }

  // ── Hammer / Star: uzun fitil, kısa gövde ────────────────
  // Gövde range'in en az %15'i olmalı (gerçek anlamlı gövde)
  if (body > range * 0.15) {
    if (lower_wick > body * 2.5 && upper_wick < body * 0.4) {
      return bullish ? "Hammer" : "Hanging Man";
    }
    if (upper_wick > body * 2.5 && lower_wick < body * 0.4) {
      return bullish ? "Inv. Hammer" : "Shooting Star";
    }
  }

  // ── Inside / Outside Bar ─────────────────────────────────
  if (curr.high < prev.high && curr.low > prev.low) return "Inside Bar";
  if (curr.high > prev.high && curr.low < prev.low) return bullish ? "Outside Bar ↑" : "Outside Bar ↓";

  // ── Spinning Top: gövde küçük, her iki fitil de var ──────
  if (bodyPct < 0.008 && lower_wick > range * 0.2 && upper_wick > range * 0.2) {
    return bullish ? "Spinning Top ↑" : "Spinning Top ↓";
  }

  // ── 3 Mum Paternleri ─────────────────────────────────────
  if (prev2) {
    const prev2_bullish = prev2.close > prev2.open;
    const prev2_body = Math.abs(prev2.close - prev2.open);
    // Morning Star: büyük kırmızı → küçük gövde → büyük yeşil
    if (!prev2_bullish && prev_body < prev2_body * 0.4 && bullish && body > prev2_body * 0.5 && curr.close > (prev2.open + prev2.close) / 2) {
      return "Morning Star";
    }
    // Evening Star: büyük yeşil → küçük gövde → büyük kırmızı
    if (prev2_bullish && prev_body < prev2_body * 0.4 && !bullish && body > prev2_body * 0.5 && curr.close < (prev2.open + prev2.close) / 2) {
      return "Evening Star";
    }
    // Three White Soldiers: 3 ardışık yükselen yeşil mum
    if (bullish && prev_bullish && prev2_bullish &&
        curr.close > prev.close && prev.close > prev2.close &&
        curr.open > prev.open && prev.open > prev2.open) {
      return "3 Asker ↑";
    }
    // Three Black Crows: 3 ardışık alçalan kırmızı mum
    if (!bullish && !prev_bullish && !prev2_bullish &&
        curr.close < prev.close && prev.close < prev2.close &&
        curr.open < prev.open && prev.open < prev2.open) {
      return "3 Karga ↓";
    }
  }

  // ── Fallback: Gövde büyüklüğüne göre basit etiket ────────
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

function calculateSignal(
  emaStatus: string,
  rsi: number,
  pattern: string,
  volumeRatio: number
): string {
  const bullishPatterns = ["Hammer", "Bullish Engulfing", "Inv. Hammer"];
  const bearishPatterns = ["Shooting Star", "Bearish Engulfing", "Hanging Man"];

  const isBullishEMA = ["Bullish", "Yükseliş"].includes(emaStatus);
  const isBearishEMA = ["Bearish", "Düşüş"].includes(emaStatus);
  const hasGoodRSI = rsi >= 50 && rsi <= 70;
  const hasBadRSI = rsi < 45;
  const hasGoodVolume = volumeRatio >= 0.8;

  // AL: Bullish EMA + RSI 50-70 + bullish pattern + good volume
  if (isBullishEMA && hasGoodRSI && bullishPatterns.includes(pattern) && hasGoodVolume) {
    return "AL";
  }

  // SAT: Bearish EMA + RSI < 45 + bearish pattern
  if (isBearishEMA && hasBadRSI && bearishPatterns.includes(pattern)) {
    return "SAT";
  }

  // İzle: 2/3 conditions met
  const bullishConditions = [isBullishEMA, hasGoodRSI, bullishPatterns.includes(pattern), hasGoodVolume].filter(Boolean).length;
  if (bullishConditions >= 2 || bullishPatterns.includes(pattern)) {
    return "İzle";
  }

  // Bekle: everything else
  return "Bekle";
}

// ── Original calculations ────────────────────────────────────────────────────

function calcEMA(prices: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
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

function calculateSupportResistance1h(
  closes1d: number[],
  highs1d: number[],
  lows1d: number[],
  closes1h: number[] | null,
  highs1h: number[] | null,
  lows1h: number[] | null,
  opens1h: number[] | null,
  volumes1h: number[] | null,
  currentPrice: number
) {
  const period = 14;
  const trs: number[] = [];
  for (let i = 1; i < closes1d.length; i++) {
    const hl = highs1d[i] - lows1d[i];
    const hc = Math.abs(highs1d[i] - closes1d[i - 1]);
    const lc = Math.abs(lows1d[i] - closes1d[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  let sum = 0;
  for (let i = Math.max(0, trs.length - period); i < trs.length; i++) {
    sum += trs[i];
  }
  const atr_1d = trs.length > 0 ? (sum / Math.min(period, trs.length)) : currentPrice * 0.03;
  const atr_pct = (atr_1d / currentPrice) * 100;

  const macro_support = Math.min(...lows1d.slice(-10));
  const macro_resist = Math.max(...highs1d.slice(-15));

  let support_1h = macro_support;
  let resist_1h = macro_resist;

  let entry_valid = false;
  let entry_type = "WAITING_FOR_VOLUME_OR_SWEEP";
  let entry_confidence = 0;

  if (closes1h && closes1h.length >= 20 && highs1h && lows1h && opens1h && volumes1h) {
    const curr_c = closes1h[closes1h.length - 1];
    const curr_o = opens1h[opens1h.length - 1];
    const curr_h = highs1h[highs1h.length - 1];
    const curr_l = lows1h[lows1h.length - 1];
    const curr_v = volumes1h[volumes1h.length - 1];
    const prev_c = closes1h[closes1h.length - 2];
    const prev_o = opens1h[opens1h.length - 2];

    const pivot_lows: number[] = [];
    const pivot_highs: number[] = [];
    for (let i = 2; i < lows1h.length - 2; i++) {
      if (lows1h[i] < lows1h[i-1] && lows1h[i] < lows1h[i+1]) pivot_lows.push(lows1h[i]);
      if (highs1h[i] > highs1h[i-1] && highs1h[i] > highs1h[i+1]) pivot_highs.push(highs1h[i]);
    }

    const supports_below = pivot_lows.filter(p => p < currentPrice - (atr_1d * 0.4));
    if (supports_below.length > 0) {
      support_1h = Math.max(Math.max(...supports_below), macro_support);
    }
    const resists_above = pivot_highs.filter(p => p > currentPrice + (atr_1d * 0.5));
    if (resists_above.length > 0) {
      resist_1h = Math.min(Math.min(...resists_above), macro_resist);
    }

    const vol_slice = volumes1h.slice(-20);
    const vol_avg_20 = vol_slice.reduce((a, b) => a + b, 0) / 20;
    const is_green_candle = curr_c > curr_o;
    const volume_spike_breakout = (curr_v > vol_avg_20 * 1.3) && is_green_candle;
    const volume_spike_sweep = (curr_v > vol_avg_20 * 1.8) && is_green_candle;

    const body = Math.abs(curr_c - curr_o);
    const lower_wick = Math.min(curr_c, curr_o) - curr_l;
    const upper_wick = curr_h - Math.max(curr_c, curr_o);

    const is_pinbar = (lower_wick > body * 2.0) && (upper_wick < body * 0.5);
    const is_bullish_engulfing = is_green_candle && (prev_c < prev_o) && (curr_c > prev_o) && (curr_o < prev_c);
    const is_liquidity_sweep = (curr_l < support_1h) && (curr_c > support_1h);
    
    const recent_high_slice = highs1h.slice(-11, -1);
    const recent_local_high = recent_high_slice.length > 0 ? Math.max(...recent_high_slice) : Math.max(...highs1h.slice(0, -1));
    const is_bos = (curr_c > recent_local_high) && volume_spike_breakout;
    const is_pullback = (curr_l >= support_1h && curr_l <= support_1h + (atr_1d * 0.3));

    const ema20_1h = calcEMA(closes1h, 20);
    const roc_1h = prev_c > 0 ? ((curr_c - prev_c) / prev_c) * 100 : 0.0;
    const is_early_momentum = (curr_c > ema20_1h) && (roc_1h > 0.8) && (curr_v > vol_avg_20 * 1.15);

    if (is_liquidity_sweep && (is_pinbar || volume_spike_sweep)) {
      entry_valid = true;
      entry_type = "REVERSAL (Liquidity Sweep)";
      entry_confidence = 95;
    } else if (is_bos) {
      entry_valid = true;
      entry_type = "BREAKOUT (BOS)";
      entry_confidence = 85;
    } else if (is_early_momentum) {
      entry_valid = true;
      entry_type = "EARLY MOMENTUM";
      entry_confidence = 80;
    } else if (is_pullback && (is_pinbar || is_bullish_engulfing) && volume_spike_breakout) {
      entry_valid = true;
      entry_type = "PULLBACK";
      entry_confidence = 80;
    }
  }

  if ((currentPrice - support_1h) < (atr_1d * 0.6)) {
    support_1h = currentPrice - (atr_1d * 0.8);
  }

  const is_momentum_entry = entry_valid && ["BREAKOUT (BOS)", "REVERSAL (Liquidity Sweep)"].includes(entry_type);

  let buy_zone_low = 0;
  let buy_zone_high = 0;

  if (is_momentum_entry) {
    buy_zone_low = currentPrice - (atr_1d * 0.25);
    buy_zone_high = currentPrice + (atr_1d * 0.15);
  } else {
    buy_zone_low = support_1h + (atr_1d * 0.2);
    buy_zone_high = currentPrice + (atr_1d * 0.1);
  }

  if (buy_zone_low >= buy_zone_high) {
    buy_zone_low = buy_zone_high - (atr_1d * 0.3);
  }

  const stop_high = support_1h - (atr_1d * 0.5);
  const stop_low = stop_high - (atr_1d * 0.2);

  const avg_entry = entry_valid ? (currentPrice * 0.995) : ((buy_zone_low + buy_zone_high) / 2);
  const risk = Math.max(avg_entry - stop_high, atr_1d * 1.0);
  const structural_reward = resist_1h - avg_entry;
  let reward = structural_reward > 0 ? Math.max(risk * 2.0, structural_reward) : risk * 2.5;

  const rr_cap = 4.0;
  if (reward > risk * rr_cap) {
    reward = risk * rr_cap;
  }

  const sell_zone_low = avg_entry + reward * 0.85;
  const sell_zone_high = avg_entry + reward;

  const actual_risk = avg_entry - stop_high;
  const actual_reward = sell_zone_high - avg_entry;
  const rr_ratio = actual_risk > 0 ? actual_reward / actual_risk : 0.0;

  return {
    entry_engine: { valid: entry_valid, type: entry_type, confidence: entry_confidence },
    buy_zone: { low: Number(buy_zone_low.toFixed(2)), high: Number(buy_zone_high.toFixed(2)) },
    sell_zone: { low: Number(sell_zone_low.toFixed(2)), high: Number(sell_zone_high.toFixed(2)) },
    stop_zone: { low: Number(stop_low.toFixed(2)), high: Number(stop_high.toFixed(2)) },
    support_1h: Number(support_1h.toFixed(2)),
    resist_1h: Number(resist_1h.toFixed(2)),
    atr_1d: Number(atr_1d.toFixed(2)),
    atr_pct: Number(atr_pct.toFixed(2)),
    rr_ratio: Number(rr_ratio.toFixed(2)),
    risk_usd: Number(actual_risk.toFixed(2)),
    reward_usd: Number(actual_reward.toFixed(2))
  };
}

function check15mMicroTrend(
  closes15m: number[] | null,
  opens15m: number[] | null,
  highs15m: number[] | null
) {
  if (!closes15m || !opens15m || !highs15m || closes15m.length < 8) {
    return { is_valid: true, score_bonus: 0.0, msg: "⚠️ 15m veri yetersiz (nötr)" };
  }

  // Get last 8 candles (recent 2 hours)
  const c = closes15m.slice(-8);
  const o = opens15m.slice(-8);
  const h = highs15m.slice(-8);

  const net_change_pct = ((c[7] - c[0]) / c[0]) * 100;
  let green_candles = 0;
  for (let i = 0; i < 8; i++) {
    if (c[i] > o[i]) green_candles++;
  }

  // Lower highs check: h[7] < h[5] and h[5] < h[2]
  const is_bleeding = (h[7] < h[5]) && (h[5] < h[2]);

  if (net_change_pct < -1.0 && green_candles <= 3 && is_bleeding) {
    return { is_valid: false, score_bonus: -10.0, msg: "🚨 15m KANAMA: Son 2 saatte yoğun dağıtım (İptal)" };
  }

  if (net_change_pct > 0.5 && green_candles >= 5) {
    return { is_valid: true, score_bonus: 4.0, msg: `🔥 15m ONAY: Son 2 saat net trend (+${net_change_pct.toFixed(2)}%)` };
  }

  if (net_change_pct < 0 && green_candles < 4) {
    return { is_valid: true, score_bonus: -2.0, msg: "⚠️ 15m Uyarı: Son 2 saat yön aşağı" };
  }

  return { is_valid: true, score_bonus: 1.0, msg: "⚖️ 15m Yatay/Sıkışma: Gürültü yok" };
}

async function fetchYahooLive(ticker: string) {
  try {
    // Check cache first to avoid rate limiting
    const cached = getCachedYahooData(ticker);
    if (cached) {
      console.log(`[watchlist-data] ${ticker}: Using cached data (5min TTL)`);
      return cached;
    }

    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=252d&interval=1d`;
    const chart1hUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10d&interval=1h`;
    const chart15mUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=15m`;
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,assetProfile,financialData,defaultKeyStatistics`;
    // Fast profile-only fetch for reliable sector data
    const profileUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=assetProfile`;

    const [chartRes, chart1hRes, chart15mRes, quoteRes, profileRes] = await Promise.all([
      fetch(chartUrl, { signal: AbortSignal.timeout(10000) }),
      fetch(chart1hUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null),
      fetch(chart15mUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null),
      fetch(quoteUrl, { signal: AbortSignal.timeout(10000) }).catch(() => ({ ok: false, json: async () => ({}) } as Response)),
      fetch(profileUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null),
    ]).catch(err => {
      console.error(`[watchlist-data] ${ticker}: Promise.all error:`, err);
      throw err;
    });

    if (!chartRes.ok) {
      console.error(`[watchlist-data] ${ticker}: Chart API failed (${chartRes.status}) - ${chartRes.statusText}`);
      return null;
    }

    let chartData;
    try {
      chartData = await chartRes.json();
    } catch (e) {
      console.error(`[watchlist-data] ${ticker}: Failed to parse chart JSON:`, e);
      return null;
    }

    const result = chartData?.chart?.result?.[0];
    if (!result) {
      console.warn(`[watchlist-data] ${ticker}: No chart result returned from Yahoo`);
      return null;
    }

    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    
    const rawCloses = quote.close || [];
    const rawOpens = quote.open || [];
    const rawHighs = quote.high || [];
    const rawLows = quote.low || [];
    const rawVolumes = quote.volume || [];

    const closes: number[] = [];
    const opens: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];

    for (let i = 0; i < rawCloses.length; i++) {
      if (rawCloses[i] !== null && rawOpens[i] !== null && rawHighs[i] !== null && rawLows[i] !== null) {
        closes.push(rawCloses[i]);
        opens.push(rawOpens[i]);
        highs.push(rawHighs[i]);
        lows.push(rawLows[i]);
        volumes.push(rawVolumes[i] || 0);
      }
    }

    if (closes.length < 10) {
      console.warn(`[watchlist-data] ${ticker}: Insufficient data - only ${closes.length} bars`);
      return null;
    }

    const currentPrice = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2] || currentPrice;
    const changePct = ((currentPrice - prevClose) / prevClose) * 100;

    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const emaStackBullish = (ema20 > ema50) && (ema50 > ema200);

    const rsi14 = calcRSI(closes, 14);

    const last5dVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const last30dVol = volumes.slice(-30).reduce((a, b) => a + b, 0) / 30;
    const rvol = last30dVol > 0 ? last5dVol / last30dVol : 1.0;

    const high52w = Math.max(...highs);
    const low52w = Math.min(...lows);

    let closes1h: number[] | null = null;
    let highs1h: number[] | null = null;
    let lows1h: number[] | null = null;
    let opens1h: number[] | null = null;
    let volumes1h: number[] | null = null;

    // Hourly bars for heat map — indexed by HOUR_SLOTS = ["09:15","10:00",..."16:15"]
    const HOUR_SLOTS = ["09:15","10:00","11:00","12:00","13:00","14:00","15:00","16:00","16:15"];
    const hourlyBars: { time: string; price: number | null; change_pct: number | null; volume: number | null; volume_ratio: number | null }[]
      = HOUR_SLOTS.map(t => ({ time: t, price: null, change_pct: null, volume: null, volume_ratio: null }));

    if (chart1hRes && chart1hRes.ok) {
      try {
        const c1hData = await chart1hRes.json();
        const res1h = c1hData?.chart?.result?.[0];
        if (res1h) {
          const q1h = res1h.indicators?.quote?.[0] || {};
          const rCl1h = q1h.close || [];
          const rOp1h = q1h.open || [];
          const rHi1h = q1h.high || [];
          const rLo1h = q1h.low || [];
          const rVo1h = q1h.volume || [];
          const timestamps1h: number[] = res1h.timestamp || [];

          closes1h = [];
          highs1h = [];
          lows1h = [];
          opens1h = [];
          volumes1h = [];

          for (let i = 0; i < rCl1h.length; i++) {
            if (rCl1h[i] !== null && rOp1h[i] !== null && rHi1h[i] !== null && rLo1h[i] !== null) {
              closes1h.push(rCl1h[i]);
              opens1h.push(rOp1h[i]);
              highs1h.push(rHi1h[i]);
              lows1h.push(rLo1h[i]);
              volumes1h.push(rVo1h[i] || 0);
            }
          }

          // ── Build today's hourly bars for the heat map ──────────────────────
          // Get today's date string in NY timezone
          const nyNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
          const todayNY = `${nyNow.getFullYear()}-${String(nyNow.getMonth()+1).padStart(2,"0")}-${String(nyNow.getDate()).padStart(2,"0")}`;

          // Compute avg volume from today's bars for volume_ratio
          const todayVols: number[] = [];
          for (let i = 0; i < timestamps1h.length; i++) {
            if (rCl1h[i] === null) continue;
            const d = new Date(timestamps1h[i] * 1000);
            const dNY = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
            const dStr = `${dNY.getFullYear()}-${String(dNY.getMonth()+1).padStart(2,"0")}-${String(dNY.getDate()).padStart(2,"0")}`;
            if (dStr === todayNY && rVo1h[i]) todayVols.push(rVo1h[i]);
          }
          const avgVol = todayVols.length > 0 ? todayVols.reduce((a,b)=>a+b,0)/todayVols.length : 0;

          // Prev day close for change_pct reference
          let prevDayClose: number | null = null;
          for (let i = 0; i < timestamps1h.length; i++) {
            if (rCl1h[i] === null) continue;
            const d = new Date(timestamps1h[i] * 1000);
            const dNY = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
            const dStr = `${dNY.getFullYear()}-${String(dNY.getMonth()+1).padStart(2,"0")}-${String(dNY.getDate()).padStart(2,"0")}`;
            if (dStr < todayNY) prevDayClose = rCl1h[i];
          }

          for (let i = 0; i < timestamps1h.length; i++) {
            if (rCl1h[i] === null) continue;
            const d = new Date(timestamps1h[i] * 1000);
            const dNY = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
            const dStr = `${dNY.getFullYear()}-${String(dNY.getMonth()+1).padStart(2,"0")}-${String(dNY.getDate()).padStart(2,"0")}`;
            if (dStr !== todayNY) continue;

            const hh = String(dNY.getHours()).padStart(2,"0");
            const mm = String(dNY.getMinutes()).padStart(2,"0");
            const slotKey = `${hh}:${mm}`;

            // Map bar start time to nearest HOUR_SLOT
            // 09:30 → "09:15", 10:00 → "10:00", etc.
            let matchSlot: string | null = null;
            if (slotKey >= "09:15" && slotKey < "10:00") matchSlot = "09:15";
            else if (slotKey >= "10:00" && slotKey < "11:00") matchSlot = "10:00";
            else if (slotKey >= "11:00" && slotKey < "12:00") matchSlot = "11:00";
            else if (slotKey >= "12:00" && slotKey < "13:00") matchSlot = "12:00";
            else if (slotKey >= "13:00" && slotKey < "14:00") matchSlot = "13:00";
            else if (slotKey >= "14:00" && slotKey < "15:00") matchSlot = "14:00";
            else if (slotKey >= "15:00" && slotKey < "16:00") matchSlot = "15:00";
            else if (slotKey >= "16:00" && slotKey < "16:15") matchSlot = "16:00";
            else if (slotKey >= "16:15") matchSlot = "16:15";

            if (!matchSlot) continue;
            const slotIdx = HOUR_SLOTS.indexOf(matchSlot);
            if (slotIdx === -1) continue;

            const barClose = rCl1h[i];
            const ref = prevDayClose ?? barClose;
            const changePct = ref > 0 ? ((barClose - ref) / ref) * 100 : 0;
            const vol = rVo1h[i] || null;
            const volRatio = avgVol > 0 && vol ? vol / avgVol : null;

            // Keep last bar of the slot (overwrite with later bar in same slot)
            hourlyBars[slotIdx] = {
              time: matchSlot,
              price: Number(barClose.toFixed(2)),
              change_pct: Number(changePct.toFixed(2)),
              volume: vol,
              volume_ratio: volRatio !== null ? Number(volRatio.toFixed(2)) : null,
            };

            prevDayClose = barClose; // rolling ref: each bar's change vs previous bar
          }
        }
      } catch {}
    }

    // 15-Minute micro-direction calculation
    let closes15m: number[] | null = null;
    let opens15m: number[] | null = null;
    let highs15m: number[] | null = null;

    if (chart15mRes && chart15mRes.ok) {
      try {
        const c15mData = await chart15mRes.json();
        const res15m = c15mData?.chart?.result?.[0];
        if (res15m) {
          const q15m = res15m.indicators?.quote?.[0] || {};
          const rCl15m = q15m.close || [];
          const rOp15m = q15m.open || [];
          const rHi15m = q15m.high || [];

          closes15m = [];
          opens15m = [];
          highs15m = [];

          for (let i = 0; i < rCl15m.length; i++) {
            if (rCl15m[i] !== null && rOp15m[i] !== null && rHi15m[i] !== null) {
              closes15m.push(rCl15m[i]);
              opens15m.push(rOp15m[i]);
              highs15m.push(rHi15m[i]);
            }
          }
        }
      } catch (err) {
        console.error("15m chart parse error:", err);
      }
    }

    const timing = calculateSupportResistance1h(
      closes,
      highs,
      lows,
      closes1h,
      highs1h,
      lows1h,
      opens1h,
      volumes1h,
      currentPrice
    );

    const micro15 = check15mMicroTrend(closes15m, opens15m, highs15m);

    // ── 1H Technical Analysis for Tracker ────────────────────────────────────
    let ema20_1h = 0;
    let ema50_1h = 0;
    let ema200_1h = 0;
    let rsi_1h = 0;
    let candlePattern_1h = "—";
    let emaStatus_1h = "Nötr";
    let volumeRatio_1h = 1.0;
    let signal = "Bekle";
    let change_pct_1h = 0;

    if (closes1h && closes1h.length >= 20 && opens1h && highs1h && lows1h && volumes1h) {
      ema20_1h = calcEMA(closes1h, 20);
      ema50_1h = calcEMA(closes1h, 50);
      ema200_1h = Math.min(120, closes1h.length) > 0 ? calcEMA(closes1h.slice(-120), 120) : ema50_1h;
      rsi_1h = calcRSI(closes1h, 14);
      candlePattern_1h = detectCandlePattern(closes1h, opens1h, highs1h, lows1h);
      emaStatus_1h = getEMAStatus(closes1h[closes1h.length - 1], ema20_1h, ema50_1h, ema200_1h);

      // Volume ratio: last 1H / 20-bar average
      const vol20Avg = volumes1h.slice(-20).reduce((a, b) => a + b, 0) / 20;
      volumeRatio_1h = vol20Avg > 0 ? volumes1h[volumes1h.length - 1] / vol20Avg : 1.0;

      // 1H change: last bar close vs previous bar close
      const lastClose1h = closes1h[closes1h.length - 1];
      const prevClose1h = closes1h[closes1h.length - 2];
      change_pct_1h = prevClose1h > 0 ? ((lastClose1h - prevClose1h) / prevClose1h) * 100 : 0;

      signal = calculateSignal(emaStatus_1h, rsi_1h, candlePattern_1h, volumeRatio_1h);
    }

    const quoteSummary = await quoteRes.json().catch(() => ({}));
    const qResult = quoteSummary?.quoteSummary?.result?.[0] || {};
    const sumDetail = qResult.summaryDetail || {};
    const finData = qResult.financialData || {};
    const stats = qResult.defaultKeyStatistics || {};

    // Priority 1: Check our comprehensive theme-based sector mapping (559+ tickers)
    let detectedSector = TICKER_SECTOR_MAP[ticker.toUpperCase()] || "";
    let assetProfile = qResult.assetProfile || {};

    // Priority 2: Try Yahoo Finance API responses
    if (!detectedSector) {
      if (!assetProfile.sector && profileRes) {
        try {
          const profileData = await profileRes.json().catch(() => ({}));
          const pResult = profileData?.quoteSummary?.result?.[0] || {};
          if (pResult.assetProfile?.sector) assetProfile = pResult.assetProfile;
        } catch {}
      }
      detectedSector = assetProfile.sector || "";
    }

    // Priority 3: Intelligent fallback detection from industry data
    if (!detectedSector) {
      const industry = assetProfile.industry || "";

      // Industry-based sector mapping (high confidence)
      const sectorMap: Record<string, string> = {
        "Bank": "Financials",
        "Insurance": "Financials",
        "Financial": "Financials",
        "Investment": "Financials",
        "Real Estate": "Real Estate",
        "Hospital": "Healthcare",
        "Pharma": "Healthcare",
        "Biotech": "Healthcare",
        "Health": "Healthcare",
        "Medical": "Healthcare",
        "Software": "Technology",
        "Tech": "Technology",
        "Semiconductor": "Technology",
        "Computer": "Technology",
        "Internet": "Technology",
        "Digital": "Technology",
        "Retail": "Consumer Discretionary",
        "Restaurant": "Consumer Discretionary",
        "Apparel": "Consumer Discretionary",
        "Clothing": "Consumer Discretionary",
        "Leisure": "Consumer Discretionary",
        "Luxury": "Consumer Discretionary",
        "Grocery": "Consumer Staples",
        "Food": "Consumer Staples",
        "Beverage": "Consumer Staples",
        "Staples": "Consumer Staples",
        "Energy": "Energy",
        "Oil": "Energy",
        "Gas": "Energy",
        "Petroleum": "Energy",
        "Metal": "Materials",
        "Mining": "Materials",
        "Chemical": "Materials",
        "Materials": "Materials",
        "Utility": "Utilities",
        "Telecom": "Communication Services",
        "Communication": "Communication Services",
        "Media": "Communication Services",
        "Entertainment": "Communication Services",
        "Broadcasting": "Communication Services",
        "Industrial": "Industrials",
        "Equipment": "Industrials",
        "Aerospace": "Industrials",
        "Manufacturing": "Industrials"
      };

      for (const [key, sector] of Object.entries(sectorMap)) {
        if (industry.includes(key)) {
          detectedSector = sector;
          break;
        }
      }
    }

    const marketCap = sumDetail.marketCap?.raw || 0;
    const peRatio = sumDetail.trailingPE?.raw || 0;
    const pbRatio = stats.priceToBook?.raw || 0;
    const grossMargin = finData.grossMargins?.raw || 0;
    const operatingMargin = finData.operatingMargins?.raw || 0;
    const netMargin = finData.profitMargins?.raw || 0;
    const revenueGrowth = finData.revenueGrowth?.raw || 0;
    const fcf = finData.freeCashflow?.raw || 0;
    const fcfYield = (fcf && marketCap) ? fcf / marketCap : 0;
    const debtToEquity = stats.debtToEquity?.raw || 0;

    let cmf = 0.05;
    let mfi = 55;
    try {
      const posMF: number[] = [];
      const negMF: number[] = [];
      for (let i = 1; i < closes.length; i++) {
        const prevC = closes[i-1];
        const currC = closes[i];
        const currH = highs[i];
        const currL = lows[i];
        const currV = volumes[i];
        const tp = (currH + currL + currC) / 3;
        const prevTP = (highs[i-1] + lows[i-1] + closes[i-1]) / 3;
        const mf = tp * currV;
        if (tp > prevTP) {
          posMF.push(mf);
          negMF.push(0);
        } else {
          posMF.push(0);
          negMF.push(mf);
        }
      }
      let sumMFV = 0;
      let sumVol = 0;
      for (let i = closes.length - 20; i < closes.length; i++) {
        const prevC = closes[i-1] || closes[i];
        const currC = closes[i];
        const currH = highs[i];
        const currL = lows[i];
        const currV = volumes[i];
        const trueH = Math.max(currH, prevC);
        const trueL = Math.min(currL, prevC);
        const trueRange = trueH - trueL;
        const mf_mult = trueRange > 0 ? ((currC - trueL) - (trueH - currC)) / trueRange : 0;
        sumMFV += mf_mult * currV;
        sumVol += currV;
      }
      cmf = sumVol > 0 ? sumMFV / sumVol : 0.05;

      const last14Pos = posMF.slice(-14).reduce((a, b) => a + b, 0);
      const last14Neg = negMF.slice(-14).reduce((a, b) => a + b, 0);
      mfi = last14Neg > 0 ? (100 - 100 / (1 + (last14Pos / last14Neg))) : 50;
    } catch {}

    const recent_ret = (currentPrice - closes[closes.length - 10]) / closes[closes.length - 10];
    const recent_5d = (currentPrice - closes[closes.length - 6]) / closes[closes.length - 6];
    let risingScore = 0;
    let risingPattern = "Flat Trend";
    if (recent_ret >= 0.0 || recent_5d >= 0.01) {
      if (recent_5d > 0 && recent_ret > 0) {
        const accel = recent_5d / recent_ret;
        if (accel >= 0.55) {
          risingScore += 2.5;
          risingPattern = "Accelerating";
        } else if (accel < 0.20) {
          risingScore -= 1.0;
          risingPattern = "Decelerating";
        }
      }
      if (recent_ret > 0.15) {
        risingScore -= 2.0;
        risingPattern = "High Momentum Leader";
      } else if (recent_ret > 0.08) {
        risingScore += 1.0;
        risingPattern = "Mature Trend";
      } else if (recent_ret > 0.02) {
        risingScore += 4.0;
        risingPattern = "Fresh Breakout";
      } else {
        risingScore += 1.0;
        risingPattern = "Mild Uptrend";
      }
    }

    let smScore = 0;
    if (cmf > 0.15) smScore += 6.0;
    else if (cmf > 0.05) smScore += 3.2;
    else if (cmf < -0.10) smScore -= 3.2;

    if (mfi > 60) smScore += 4.0;
    else if (mfi < 30) smScore -= 2.0;

    let tScore = 30;
    if (currentPrice > ema20) tScore += 15;
    if (currentPrice > ema50) tScore += 15;
    if (currentPrice > ema200) tScore += 15;
    if (emaStackBullish) tScore += 15;
    if (rsi14 >= 45 && rsi14 <= 65) tScore += 10;
    else if (rsi14 < 30) tScore += 10;
    if (rvol > 1.3) tScore += 5;
    tScore = Math.max(10, Math.min(100, tScore));

    let healthScore = 0;
    if (grossMargin > 0.35) healthScore += 2.0;
    if (operatingMargin > 0.15) healthScore += 2.0;
    if (netMargin > 0.10) healthScore += 2.0;
    if (revenueGrowth > 0.10) healthScore += 3.0;
    else if (revenueGrowth > 0.05) healthScore += 1.5;
    if (debtToEquity > 0 && debtToEquity < 1.5) healthScore += 1.5;
    if (fcfYield > 0.03) healthScore += 2.0;
    else if (fcfYield < 0) healthScore -= 4.0;
    if (netMargin < 0) healthScore -= 4.0;
    healthScore = Math.max(-10, Math.min(15, healthScore));

    let fScore = 50 + (healthScore * 3.3);
    fScore = Math.max(10, Math.min(100, fScore));

    let mScore = 50 + (risingScore * 6);
    if (rvol > 1.2) mScore += 10;
    mScore = Math.max(10, Math.min(100, mScore));

    // Composite master score using exact swing117 weights + 15m trend score bonus!
    let compositeScore = (tScore * 0.40) + (fScore * 0.25) + (mScore * 0.20) + (50 + smScore * 4) * 0.15;
    compositeScore += micro15.score_bonus;
    
    let finalMaster = Math.max(10, Math.min(100, Math.round(compositeScore)));

    // Hard Reject handling if toxic distribution
    if (!micro15.is_valid) {
      finalMaster = Math.min(35, finalMaster);
    }

    let signalType = "NEUTRAL";
    if (finalMaster >= 70) signalType = "STRONG_BUY";
    else if (finalMaster >= 58) signalType = "BUY";
    else if (finalMaster <= 42) signalType = "STRONG_SELL";
    else if (finalMaster <= 49) signalType = "SELL";

    const tickerData = {
      ticker: ticker.toUpperCase(),
      company: meta.longName || stats.longName || `${ticker.toUpperCase()} Corp.`,
      date: new Date().toISOString().split("T")[0],
      generated_at: new Date().toISOString(),
      sector: detectedSector || "Unknown",
      industry: assetProfile?.industry || "Unknown",
      price: {
        current: currentPrice,
        open: opens[opens.length - 1],
        high: highs[highs.length - 1],
        low: lows[lows.length - 1],
        prev_close: prevClose,
        change_pct: changePct,
        change_pct_1w: recent_5d * 100,
        change_pct_1m: recent_ret * 100,
        change_pct_1y: ((currentPrice - closes[0]) / closes[0]) * 100,
        volume: volumes[volumes.length - 1],
        avg_volume_30d: last30dVol * 30
      },
      scores: {
        master_score: finalMaster,
        technical_score: tScore,
        fundamental_score: fScore,
        momentum_score: mScore,
        sentiment_score: 70,
        signal_type: signalType,
        score_type: finalMaster >= 70 ? "HIGH_CONVICTION" : finalMaster >= 58 ? "POSITIVE_BIAS" : finalMaster <= 42 ? "UNDERPERFORM" : "NEUTRAL",
        micro_15m: micro15
      },
      technical: {
        rsi_14: rsi14,
        macd: 0.1,
        macd_signal: 0.1,
        macd_histogram: 0.0,
        ema_20: ema20,
        ema_50: ema50,
        ema_200: ema200,
        ema_stack_bullish: emaStackBullish,
        bb_upper: currentPrice * 1.05,
        bb_middle: currentPrice,
        bb_lower: currentPrice * 0.95,
        bb_width: 10,
        atr: timing.atr_1d,
        atr_pct: timing.atr_pct,
        rvol: rvol,
        "52w_high": high52w,
        "52w_low": low52w
      },
      tracker_1h: {
        ema_20: Number(ema20_1h.toFixed(2)),
        ema_50: Number(ema50_1h.toFixed(2)),
        ema_200: Number(ema200_1h.toFixed(2)),
        ema_status: emaStatus_1h,
        rsi: Number(rsi_1h.toFixed(1)),
        candle_pattern: candlePattern_1h,
        signal: signal,
        volume_ratio: Number(volumeRatio_1h.toFixed(2)),
        change_pct_1h: Number(change_pct_1h.toFixed(2))
      },
      fundamental: {
        pe_ratio: peRatio,
        pb_ratio: pbRatio,
        gross_margin: grossMargin,
        operating_margin: operatingMargin,
        net_margin: netMargin,
        market_cap: marketCap,
        revenue_growth_ttm: revenueGrowth,
        fcf_yield: fcfYield,
        institutional_ownership_pct: stats.heldPercentInstitutions?.raw || 0.70
      },
      scores_detail: {
        entry_range_low: timing.buy_zone.low,
        entry_range_high: timing.buy_zone.high,
        target_range_low: timing.sell_zone.low,
        target_range_high: timing.sell_zone.high,
        stop_loss: timing.stop_zone.high,
        risk_reward_ratio: timing.rr_ratio
      },
      hourly: hourlyBars
    };

    // Cache the result for 5 minutes to avoid rate limiting
    setCachedYahooData(ticker, tickerData);
    return tickerData;
  } catch (e) {
    console.error("fetchYahooLive error:", e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") || "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 150); // 50'den 150'ye yükseltildi — 525 listesi 52+ hisse içeriyor

  if (tickers.length === 0) {
    return NextResponse.json([]);
  }

  const results: any[] = [];

  await Promise.all(
    tickers.map(async (ticker) => {
      // 1. Try to read from local file path first for high performance
      const localPaths = [
        path.join(DATA_ROOT, "latest", "stocks", `${ticker}.json`),
        path.join(process.cwd(), "data", "latest", "stocks", `${ticker}.json`),
        path.join(process.cwd(), "..", "data", "latest", "stocks", `${ticker}.json`),
        path.join(process.cwd(), "public", "data", "latest", "stocks", `${ticker}.json`),
      ];

      // Static files older than 1 hour are considered stale — fall through to live fetch
      const MAX_STATIC_AGE_MS = 1 * 60 * 60 * 1000;
      const now = Date.now();

      let foundData = false;
      let localSectorData: { sector?: string; industry?: string; company?: string } | null = null;

      for (const p of localPaths) {
        if (fs.existsSync(p)) {
          try {
            const mtime = fs.statSync(p).mtimeMs;
            let content = fs.readFileSync(p, "utf-8");
            content = content
              .replace(/:\s*NaN/g, ": null")
              .replace(/:\s*Infinity/g, ": null")
              .replace(/:\s*-Infinity/g, ": null");

            const parsed = JSON.parse(content);
            if (parsed && parsed.ticker) {
              // If file is not stale, use it directly
              if (now - mtime <= MAX_STATIC_AGE_MS) {
                results.push(parsed);
                foundData = true;
                break;
              } else {
                // File is stale but we can extract sector/industry data from it
                localSectorData = {
                  sector: parsed.sector,
                  industry: parsed.industry,
                  company: parsed.company
                };
              }
            }
          } catch {}
        }
      }

      // 2. If not found in static files, fetch live and calculate on the fly
      if (!foundData) {
        try {
          const liveData = await fetchYahooLive(ticker);
          if (liveData) {
            // Enhance with local sector data if available and live data lacks it
            if (localSectorData && localSectorData.sector && (!liveData.sector || liveData.sector === "Unknown")) {
              liveData.sector = localSectorData.sector;
              liveData.industry = localSectorData.industry || liveData.industry;
            }
            // Also use local company name if better
            if (localSectorData?.company && localSectorData.company.length > (liveData.company || "").length) {
              liveData.company = localSectorData.company;
            }
            results.push(liveData);
          } else {
            console.warn(`[watchlist-data] ${ticker}: fetchYahooLive returned null - no data available`);
          }
        } catch (err) {
          console.error(`[watchlist-data] Error fetching live data for ${ticker}:`, err instanceof Error ? err.message : String(err));
        }
      }
    })
  );

  // Cache bulunan datayı 2 dakika, ama yeni request'lere bypass et
  // (fresh ticker'lar için cache skip olmali)
  const hasAllTickers = tickers.every(t => results.some(r => r.ticker === t));
  const cacheControl = hasAllTickers
    ? "public, max-age=120"  // Tamam tum ticker'lar var, cache et
    : "no-cache, no-store, must-revalidate";  // Eksik ticker var, cache'e alma

  return NextResponse.json(results, {
    headers: { "Cache-Control": cacheControl }
  });
}
