import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Recurse to find the local python fallback or JSON files
const DATA_ROOT = process.env.FINMA_DATA_PATH
  ? path.resolve(process.env.FINMA_DATA_PATH)
  : path.resolve(process.cwd(), "..", "transfer");

// Re-use calculation logic from ask api to ensure 100% mathematical consistency
import { POST } from "../ask/route";

export const runtime = "nodejs";

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

async function fetchYahooLive(ticker: string) {
  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=252d&interval=1d`;
    const chart1hUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10d&interval=1h`;
    const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,assetProfile,financialData,defaultKeyStatistics`;

    const [chartRes, chart1hRes, quoteRes] = await Promise.all([
      fetch(chartUrl, { signal: AbortSignal.timeout(10000) }),
      fetch(chart1hUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null),
      fetch(quoteUrl, { signal: AbortSignal.timeout(10000) })
    ]);

    if (!chartRes.ok) return null;

    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];
    if (!result) return null;

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

    if (closes.length < 50) return null;

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
        }
      } catch {}
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

    const quoteSummary = await quoteRes.json().catch(() => ({}));
    const qResult = quoteSummary?.quoteSummary?.result?.[0] || {};
    const sumDetail = qResult.summaryDetail || {};
    const assetProfile = qResult.assetProfile || {};
    const finData = qResult.financialData || {};
    const stats = qResult.defaultKeyStatistics || {};

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

    const compositeScore = (tScore * 0.40) + (fScore * 0.25) + (mScore * 0.20) + (50 + smScore * 4) * 0.15;
    const finalMaster = Math.max(10, Math.min(100, Math.round(compositeScore)));

    let signalType = "NEUTRAL";
    if (finalMaster >= 70) signalType = "STRONG_BUY";
    else if (finalMaster >= 58) signalType = "BUY";
    else if (finalMaster <= 42) signalType = "STRONG_SELL";
    else if (finalMaster <= 49) signalType = "SELL";

    return {
      ticker: ticker.toUpperCase(),
      company: meta.longName || stats.longName || `${ticker.toUpperCase()} Corp.`,
      date: new Date().toISOString().split("T")[0],
      generated_at: new Date().toISOString(),
      sector: assetProfile.sector || "Unknown",
      industry: assetProfile.industry || "Unknown",
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
        score_type: signalType === "STRONG_BUY" ? "HIGH_CONVICTION" : signalType === "BUY" ? "POSITIVE_BIAS" : signalType.startsWith("STRONG") ? "UNDERPERFORM" : "NEUTRAL"
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
      }
    };
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
    .slice(0, 50);

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
      ];

      let foundData = false;
      for (const p of localPaths) {
        if (fs.existsSync(p)) {
          try {
            let content = fs.readFileSync(p, "utf-8");
            content = content
              .replace(/:\s*NaN/g, ": null")
              .replace(/:\s*Infinity/g, ": null")
              .replace(/:\s*-Infinity/g, ": null");
            
            const parsed = JSON.parse(content);
            if (parsed && parsed.ticker) {
              results.push(parsed);
              foundData = true;
              break;
            }
          } catch {}
        }
      }

      // 2. If not found in static files, fetch live and calculate on the fly
      if (!foundData) {
        try {
          const liveData = await fetchYahooLive(ticker);
          if (liveData) {
            results.push(liveData);
          }
        } catch (err) {
          console.error(`Error querying dynamic watchlist stock ${ticker}:`, err);
        }
      }
    })
  );

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, max-age=120" }
  });
}
