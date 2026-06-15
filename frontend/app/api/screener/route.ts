/**
 * /api/screener
 * BOGA Screener v2 — Architecture spec uyumlu Multi-Stage Filter Engine
 * Yahoo Finance altyapısı: EMA8/13/20/21/50/200 · SMA200 · RSI · MACD · ATR · RVOL · BB
 * BOGA Score = preset ağırlıklı: Trend + Momentum + Options + Liquidity
 * Market Regime: SPY SMA200/ADX bazlı, strateji multiplier'ları
 * Grade: A+ / A / B+ / B / C / D
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime  = "nodejs";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScreenerResult {
  ticker: string;
  company: string;
  sector: string;
  price: number;
  change_1d: number;
  change_1w: number;
  volume: number;
  avg_volume: number;
  rvol: number;
  market_cap: number;
  market_cap_label: string;
  float_shares: number;
  // BOGA Score
  boga_score: number;
  grade: string;
  trend_score: number;
  momentum_score: number;
  options_score: number;
  liquidity_score: number;
  // Technical
  ema8: number;
  ema13: number;
  ema20: number;
  ema21: number;
  ema50: number;
  ema200: number;
  sma200: number;
  rsi: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  atr_pct: number;
  bb_upper: number;
  bb_lower: number;
  bb_pct: number;
  bb_width: number;
  adx: number;
  roc10: number;
  ema_structure: string;
  trend_direction: "up" | "dn" | "neu";
  pct_from_52w_high: number;
  setup_signals: string[];
  primary_setup: string;
  // Options
  has_options: boolean;
  has_weekly_options: boolean;
  iv_est: number;
  // Trade plan
  entry: number;
  stop: number;
  target: number;
  rr_ratio: string;
  risk_pct: number;
  support: number;
  resistance: number;
  // Warnings
  warnings: string[];
  // Relative Strength & momentum quality
  rs_rating: number;
  is_new_high: boolean;
  vol_contraction: boolean;
  // Triangle Pattern (early_break)
  triangle_detected?: boolean;
  triangle_score?: number;
  bbw_percentile?: number;
  apex_bars_left?: number;
  upper_trendline?: number;
  lower_trendline?: number;
  target_fib?: number;
  triangle_stop?: number;
  triangle_rr?: number;
}

interface Regime {
  regime: "bull_trending" | "bull_choppy" | "neutral" | "bear_choppy" | "bear_trending" | "high_volatility" | "low_volatility";
  label: string;
  spy_change: number;
  vix_price: number;
  trend: "bullish" | "bearish" | "choppy";
  momentum: "strong" | "moderate" | "weak";
  spy_12m_return: number;
}

// ─── BOGA Score Weights per Preset (Architecture spec §6.1) ──────────────────

const PRESET_WEIGHTS: Record<string, { trend: number; momentum: number; options: number; liquidity: number }> = {
  genel_swing:     { trend: 35, momentum: 40, options: 10, liquidity: 15 },
  swing_cont:      { trend: 30, momentum: 25, options: 20, liquidity: 25 },
  early_break:     { trend: 25, momentum: 35, options: 15, liquidity: 25 },
  day_mom:         { trend: 15, momentum: 45, options: 10, liquidity: 30 },
  opt_sniper:      { trend: 20, momentum: 20, options: 45, liquidity: 15 },
  inst_trend:      { trend: 40, momentum: 20, options: 15, liquidity: 25 },
  cheap_exp:       { trend: 20, momentum: 35, options: 25, liquidity: 20 },
  ema_cross:       { trend: 30, momentum: 35, options: 15, liquidity: 20 },
  gamma_sq:        { trend: 15, momentum: 25, options: 45, liquidity: 15 },
  pre_catalyst:    { trend: 20, momentum: 35, options: 10, liquidity: 35 },
  quality_growth:  { trend: 45, momentum: 20, options: 5,  liquidity: 30 },
  agg_growth:      { trend: 30, momentum: 40, options: 5,  liquidity: 25 },
  breakout_growth: { trend: 30, momentum: 35, options: 15, liquidity: 20 },
  hottest_momo:    { trend: 25, momentum: 50, options: 5,  liquidity: 20 },
};

// Regime multipliers (Architecture spec §8.1)
const REGIME_MULTIPLIERS: Record<string, Record<string, number>> = {
  bull_trending:  { genel_swing: 1.30, swing_cont: 1.20, early_break: 1.15, day_mom: 1.10, inst_trend: 1.20, opt_sniper: 1.00, gamma_sq: 1.00, cheap_exp: 1.05, ema_cross: 1.10, pre_catalyst: 1.25, quality_growth: 1.20, agg_growth: 1.15, breakout_growth: 1.20, hottest_momo: 1.30 },
  bull_choppy:    { genel_swing: 0.95, swing_cont: 0.85, early_break: 1.00, day_mom: 0.90, inst_trend: 0.90, opt_sniper: 1.10, gamma_sq: 0.80, cheap_exp: 0.90, ema_cross: 0.90, pre_catalyst: 0.95, quality_growth: 0.90, agg_growth: 0.85, breakout_growth: 1.00, hottest_momo: 0.85 },
  neutral:        { genel_swing: 0.95, swing_cont: 0.90, early_break: 1.00, day_mom: 0.95, inst_trend: 0.90, opt_sniper: 1.00, gamma_sq: 0.90, cheap_exp: 0.95, ema_cross: 0.95, pre_catalyst: 0.90, quality_growth: 0.90, agg_growth: 0.85, breakout_growth: 0.95, hottest_momo: 0.90 },
  bear_choppy:    { genel_swing: 0.30, swing_cont: 0.40, early_break: 0.50, day_mom: 0.70, inst_trend: 0.30, opt_sniper: 1.10, gamma_sq: 0.50, cheap_exp: 0.60, ema_cross: 0.50, pre_catalyst: 0.50, quality_growth: 0.40, agg_growth: 0.25, breakout_growth: 0.35, hottest_momo: 0.50 },
  bear_trending:  { genel_swing: 0.15, swing_cont: 0.20, early_break: 0.30, day_mom: 0.70, inst_trend: 0.20, opt_sniper: 1.20, gamma_sq: 0.40, cheap_exp: 0.50, ema_cross: 0.30, pre_catalyst: 0.35, quality_growth: 0.20, agg_growth: 0.15, breakout_growth: 0.20, hottest_momo: 0.30 },
  high_volatility:{ genel_swing: 1.20, swing_cont: 0.50, early_break: 0.70, day_mom: 1.40, inst_trend: 0.60, opt_sniper: 1.30, gamma_sq: 1.20, cheap_exp: 1.10, ema_cross: 0.70, pre_catalyst: 1.35, quality_growth: 0.60, agg_growth: 0.70, breakout_growth: 0.80, hottest_momo: 1.20 },
  low_volatility: { genel_swing: 1.10, swing_cont: 0.80, early_break: 1.40, day_mom: 0.50, inst_trend: 0.80, opt_sniper: 1.30, gamma_sq: 0.60, cheap_exp: 0.70, ema_cross: 1.20, pre_catalyst: 0.75, quality_growth: 1.00, agg_growth: 0.90, breakout_growth: 1.10, hottest_momo: 0.60 },
};

// ─── Universe (Architecture spec §3.1) ───────────────────────────────────────
// We no longer use the hardcoded UNIVERSE_T1.
// The universe is now built daily by universe_builder.py and stored in public/data/daily_universe.json.

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function ema(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let e = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) e = data[i] * k + e * (1 - k);
  return e;
}

function sma(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] ?? 0;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function macd(closes: number[]): { macd: number; signal: number; hist: number } {
  const fast  = ema(closes, 12);
  const slow  = ema(closes, 26);
  const line  = fast - slow;
  // Signal: EMA9 of MACD line (approximate)
  const macdSeries = closes.slice(-35).map((_, i, arr) => {
    const sl = arr.slice(0, i + 1);
    return ema(sl, 12) - ema(sl, 26);
  });
  const signal = ema(macdSeries, 9);
  return { macd: line, signal, hist: line - signal };
}

function atr(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (highs.length < period + 1) return 0;
  const trs = highs.slice(1).map((h, i) =>
    Math.max(h - lows[i + 1], Math.abs(h - closes[i]), Math.abs(lows[i + 1] - closes[i]))
  );
  return sma(trs, period);
}

function bollinger(closes: number[], period = 20): { upper: number; lower: number; pct: number; width: number } {
  const mid = sma(closes, period);
  const slice = closes.slice(-period);
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
  const upper = mid + 2 * std;
  const lower = mid - 2 * std;
  const last = closes[closes.length - 1];
  return {
    upper,
    lower,
    pct: (last - lower) / (upper - lower),
    width: (upper - lower) / mid,
  };
}

// ─── Triangle Detection Helpers ───────────────────────────────────────────────

function calcBBWPercentile(closes: number[], period = 20, lookback = 50): number {
  if (closes.length < period + lookback) return 50;
  const bbws: number[] = [];
  for (let i = closes.length - lookback; i < closes.length; i++) {
    const sl = closes.slice(i - period, i);
    if (sl.length < period) continue;
    const mid = sl.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(sl.reduce((s, v) => s + (v - mid) ** 2, 0) / period);
    bbws.push(mid > 0 ? (4 * std) / mid : 0);
  }
  if (bbws.length === 0) return 50;
  const current = bbws[bbws.length - 1];
  const below = bbws.filter(v => v <= current).length;
  return Math.round((below / bbws.length) * 100);
}

function findPivotHighs(data: number[], win = 5): number[] {
  const pivots: number[] = [];
  for (let i = win; i < data.length - win; i++) {
    let ok = true;
    for (let j = i - win; j <= i + win; j++) {
      if (j !== i && data[j] >= data[i]) { ok = false; break; }
    }
    if (ok) pivots.push(i);
  }
  return pivots;
}

function findPivotLows(data: number[], win = 5): number[] {
  const pivots: number[] = [];
  for (let i = win; i < data.length - win; i++) {
    let ok = true;
    for (let j = i - win; j <= i + win; j++) {
      if (j !== i && data[j] <= data[i]) { ok = false; break; }
    }
    if (ok) pivots.push(i);
  }
  return pivots;
}

interface TriangleResult {
  detected: boolean;
  bbw_percentile: number;
  apex_bars_left: number;
  triangle_score: number;
  upper_trendline: number;
  lower_trendline: number;
  target_1x: number;
  target_fib: number;
  stop_loss: number;
  risk_reward: number;
}

function detectSymmetricalTriangle(
  highs: number[], lows: number[], closes: number[], volumes: number[],
  lookback = 60
): TriangleResult {
  const none: TriangleResult = {
    detected: false, bbw_percentile: 50, apex_bars_left: 0,
    triangle_score: 0, upper_trendline: 0, lower_trendline: 0,
    target_1x: 0, target_fib: 0, stop_loss: 0, risk_reward: 0,
  };

  if (closes.length < lookback + 20) return none;

  const rH = highs.slice(-lookback);
  const rL = lows.slice(-lookback);
  const rC = closes.slice(-lookback);
  const rV = volumes.slice(-lookback);

  const phIdx = findPivotHighs(rH, 5);
  const plIdx = findPivotLows(rL, 5);
  if (phIdx.length < 2 || plIdx.length < 2) return none;

  // Lower highs: last 2+ pivot highs descending
  const lastPH = phIdx.slice(-3);
  let lowerHighs = true;
  for (let i = 1; i < lastPH.length; i++) {
    if (rH[lastPH[i]] >= rH[lastPH[i - 1]]) { lowerHighs = false; break; }
  }

  // Higher lows: last 2+ pivot lows ascending
  const lastPL = plIdx.slice(-3);
  let higherLows = true;
  for (let i = 1; i < lastPL.length; i++) {
    if (rL[lastPL[i]] <= rL[lastPL[i - 1]]) { higherLows = false; break; }
  }

  if (!lowerHighs || !higherLows) return none;

  // Upper trendline through last 2 pivot highs
  const h1i = lastPH[lastPH.length - 2], h2i = lastPH[lastPH.length - 1];
  const upperSlope = (rH[h2i] - rH[h1i]) / (h2i - h1i);
  const upperNow   = rH[h2i] + upperSlope * (lookback - 1 - h2i);

  // Lower trendline through last 2 pivot lows
  const l1i = lastPL[lastPL.length - 2], l2i = lastPL[lastPL.length - 1];
  const lowerSlope = (rL[l2i] - rL[l1i]) / (l2i - l1i);
  const lowerNow   = rL[l2i] + lowerSlope * (lookback - 1 - l2i);

  const triWidth = upperNow - lowerNow;
  if (triWidth <= 0) return none;

  // Apex bars left
  let apexBars = 999;
  if (upperSlope < lowerSlope) {
    apexBars = Math.round(triWidth / (lowerSlope - upperSlope));
  } else {
    const w0 = Math.max(rH[lastPH[0]] - rL[lastPL[0]], triWidth * 1.5);
    const rate = (w0 - triWidth) / Math.max(h2i - h1i, 1);
    if (rate > 0) apexBars = Math.round(triWidth / rate);
  }

  // Apex > 85% converged → signal too late
  const w0 = Math.max(rH[lastPH[0]] - rL[lastPL[0]], triWidth * 1.5);
  if (triWidth / w0 < 0.15) return none;

  // Scoring
  const bbwPct     = calcBBWPercentile(closes, 20, 50);
  const sma50Val   = sma(rC, Math.min(50, rC.length));
  const curPrice   = rC[rC.length - 1];
  const aboveSma50 = curPrice > sma50Val;
  const avgVol     = rV.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const curVol     = rV[rV.length - 1];
  const volExpand  = curVol > avgVol * 1.3;
  const rsiVal     = rsi(rC);
  const rsiOk      = rsiVal >= 45 && rsiVal <= 65;
  const fibMid     = lowerNow + triWidth * 0.5;
  const fibSupport = curPrice <= fibMid * 1.05 && curPrice >= lowerNow * 0.98;

  let triScore = 25; // triangle confirmed
  if (bbwPct < 20)  triScore += 20; else if (bbwPct < 30) triScore += 12;
  if (aboveSma50)   triScore += 15;
  if (volExpand)    triScore += 20;
  if (rsiOk)        triScore += 10;
  if (fibSupport)   triScore += 10;

  const breakoutPx = upperNow * 1.002;
  const target1x   = breakoutPx + triWidth;
  const targetFib  = breakoutPx + triWidth * 1.618;
  const stopLoss   = lowerNow * 0.98;
  const risk       = breakoutPx - stopLoss;
  const rr         = risk > 0 ? +((targetFib - breakoutPx) / risk).toFixed(1) : 0;

  return {
    detected: true,
    bbw_percentile: bbwPct,
    apex_bars_left: Math.min(Math.max(apexBars, 0), 60),
    triangle_score: triScore,
    upper_trendline: +upperNow.toFixed(2),
    lower_trendline: +lowerNow.toFixed(2),
    target_1x: +target1x.toFixed(2),
    target_fib: +targetFib.toFixed(2),
    stop_loss: +stopLoss.toFixed(2),
    risk_reward: rr,
  };
}

function roc(closes: number[], period = 10): number {
  if (closes.length < period + 1) return 0;
  const base = closes[closes.length - 1 - period];
  return base ? ((closes[closes.length - 1] - base) / base) * 100 : 0;
}

function adx(highs: number[], lows: number[], closes: number[], period = 14): number {
  // Simplified ADX approximation
  if (highs.length < period * 2) return 20;
  const atrVal = atr(highs, lows, closes, period);
  if (!atrVal) return 20;
  let plusDI = 0, minusDI = 0;
  for (let i = 1; i < highs.length; i++) {
    const ph = highs[i] - highs[i - 1];
    const pl = lows[i - 1] - lows[i];
    if (ph > pl && ph > 0) plusDI += ph;
    if (pl > ph && pl > 0) minusDI += pl;
  }
  const norm = atrVal * period;
  const p = (plusDI / period) / norm * 100;
  const m = (minusDI / period) / norm * 100;
  const dx = Math.abs(p - m) / (p + m + 0.001) * 100;
  return Math.min(100, Math.max(0, dx));
}

function toGrade(score: number): string {
  if (score >= 85) return "A+";
  if (score >= 75) return "A";
  if (score >= 65) return "B+";
  if (score >= 55) return "B";
  if (score >= 45) return "C";
  return "D";
}

function fmtCap(cap: number): string {
  if (cap >= 200e9) return "Mega";
  if (cap >= 10e9)  return "Large";
  if (cap >= 2e9)   return "Mid";
  if (cap >= 300e6) return "Small";
  if (cap >= 50e6)  return "Micro";
  return "Nano";
}

// ─── Weekly Options Whitelist ──────────────────────────────────────────────────

const WEEKLY_OPTIONS = new Set([
  "AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","SPY","QQQ","IWM","VXX",
  "AMD","INTC","AVGO","BABA","PLTR","SOFI","COIN","HOOD","MARA","RIOT","CRWD",
  "NET","SNOW","NFLX","DIS","SHOP","UBER","SNAP","PYPL","SQ","ROKU","MRNA",
  "BNTX","JPM","GS","BAC","XOM","CVX","GLD","TLT","SMH","SOXL","TQQQ","SPXL",
  "UPRO","MU","QCOM","AMAT","KLAC","SMCI","IONQ","RGTI","MSTR","BTBT","WULF",
  "CLSK","HUT","CIFR","IREN","SOUN","BBAI","WOLF","RIVN","LCID","NIO","XPEV",
  "COIN","HOOD","MARA","RIOT","F","GM","BA","LMT","RTX","PANW","ZS","OKTA",
  "CRM","NOW","WDAY","ORCL","V","MA","BLK","SCHW","OXY","FCX","GOLD","NEM",
]);

function optionsAvail(ticker: string, mktCap: number): { has_options: boolean; has_weekly: boolean } {
  const has_weekly = WEEKLY_OPTIONS.has(ticker) || mktCap >= 2e9;
  return { has_options: has_weekly || mktCap >= 300e6, has_weekly };
}

// ─── BOGA Score Engine (Architecture spec §6.2) ───────────────────────────────

function calcTrendScore(params: {
  price: number; ema8: number; ema13: number; ema20: number; ema21: number;
  ema50: number; ema200: number; sma200: number; adxVal: number; pct52h: number;
}): number {
  const { price, ema8, ema13, ema20, ema21, ema50, ema200, sma200, adxVal, pct52h } = params;
  let score = 0;
  // EMA alignment (40 pts)
  if (ema8 > ema13 && ema13 > ema21 && ema21 > ema50 && ema50 > ema200) score += 40;
  else if (ema20 > ema50 && ema50 > ema200) score += 30;
  else if (ema20 > ema50) score += 20;
  // SMA 200 (20 pts)
  if (price > sma200) score += 20;
  // ADX (20 pts)
  if (adxVal >= 35) score += 20;
  else if (adxVal >= 25) score += 15;
  else if (adxVal >= 20) score += 10;
  // 52w proximity (20 pts)
  if (pct52h >= -3) score += 20;
  else if (pct52h >= -8) score += 15;
  else if (pct52h >= -15) score += 10;
  return Math.min(100, score);
}

function calcMomentumScore(params: {
  rsiVal: number; rvol: number; macdVal: number; macdHist: number; rocVal: number; atrPct: number;
}): number {
  const { rsiVal, rvol, macdVal, macdHist, rocVal } = params;
  let score = 0;
  // RVOL (30 pts)
  if (rvol >= 4.0) score += 30;
  else if (rvol >= 2.5) score += 22;
  else if (rvol >= 1.5) score += 15;
  else if (rvol >= 1.0) score += 5;
  // RSI zone (25 pts)
  if (rsiVal >= 60 && rsiVal <= 72) score += 25;
  else if (rsiVal >= 55 && rsiVal < 60) score += 18;
  else if (rsiVal >= 50 && rsiVal < 55) score += 10;
  // MACD (25 pts)
  if (macdVal > 0 && macdHist > 0) score += 25;
  else if (macdVal > 0) score += 15;
  else if (macdHist > 0) score += 10;
  // ROC (20 pts)
  if (rocVal >= 8) score += 20;
  else if (rocVal >= 5) score += 15;
  else if (rocVal >= 2) score += 8;
  return Math.min(100, score);
}

function calcOptionsScore(hasWeekly: boolean, hasOptions: boolean, mktCap: number, iv_est: number): number {
  let score = 0;
  if (hasWeekly) score += 30;
  // OI proxy via market cap
  if (mktCap >= 10e9) score += 25;
  else if (mktCap >= 2e9) score += 18;
  else if (mktCap >= 300e6) score += 10;
  // Spread proxy (liquid = tight)
  if (mktCap >= 5e9) score += 25;
  else if (mktCap >= 1e9) score += 18;
  else if (mktCap >= 200e6) score += 10;
  // IV expansion zone (20 pts)
  if (iv_est >= 30 && iv_est <= 80) score += 20;
  else if (iv_est < 30) score += 15;
  if (!hasOptions) return 0;
  return Math.min(100, score);
}

function calcLiquidityScore(rvol: number, avgVol: number, price: number, mktCap: number): number {
  let score = 0;
  const dolVol = avgVol * price;
  // Dollar volume (40 pts)
  if (dolVol >= 50e6) score += 40;
  else if (dolVol >= 10e6) score += 30;
  else if (dolVol >= 5e6) score += 20;
  else if (dolVol >= 1e6) score += 10;
  // Market cap (35 pts)
  if (mktCap >= 10e9) score += 35;
  else if (mktCap >= 2e9) score += 28;
  else if (mktCap >= 500e6) score += 20;
  else if (mktCap >= 100e6) score += 12;
  // RVOL (25 pts)
  if (rvol >= 3.0) score += 25;
  else if (rvol >= 2.0) score += 18;
  else if (rvol >= 1.5) score += 12;
  return Math.min(100, score);
}

function calcBogaScore(params: {
  trend: number; momentum: number; options: number; liquidity: number;
  preset: string; regime: string;
}): { score: number; grade: string } {
  const w = PRESET_WEIGHTS[params.preset] ?? PRESET_WEIGHTS.swing_cont;
  const mult = REGIME_MULTIPLIERS[params.regime]?.[params.preset] ?? 1.0;
  const raw =
    (params.trend    * w.trend    +
     params.momentum * w.momentum +
     params.options  * w.options  +
     params.liquidity * w.liquidity) / 100 * mult;
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  return { score, grade: toGrade(score) };
}

// ─── Primary Setup Classifier ─────────────────────────────────────────────────

function classifySetup(params: {
  price: number; ema20: number; ema50: number; sma200: number;
  rsiVal: number; rvol: number; atrPct: number; change1d: number;
  hasWeekly: boolean; bbPct: number;
}): { primary: string; signals: string[] } {
  const { price, ema20, ema50, sma200, rsiVal, rvol, atrPct, change1d, hasWeekly, bbPct } = params;
  const signals: string[] = [];
  if (price > sma200) signals.push("Price>SMA200");
  if (ema20 > ema50)  signals.push("EMA20>EMA50");
  if (rsiVal >= 55 && rsiVal <= 70) signals.push(`RSI ${rsiVal.toFixed(0)} (Momentum)`);
  if (rvol >= 1.5) signals.push(`RVOL ${rvol.toFixed(1)}x`);
  if (hasWeekly) signals.push("Haftalık OPT");
  if (change1d > 2) signals.push(`+${change1d.toFixed(1)}% Güçlü gün`);
  if (atrPct > 5) signals.push(`ATR ${atrPct.toFixed(1)}%`);

  let primary = "swing";
  if (rvol >= 3 && change1d > 4 && atrPct > 4) primary = "momentum";
  else if (rvol >= 2.5 && change1d > 3) primary = "day";
  else if (price > sma200 && ema20 > ema50 && rsiVal >= 55 && rsiVal <= 72) primary = "swing";
  else if (hasWeekly && atrPct >= 3.5 && rvol >= 1.5) primary = "options";
  else if (bbPct < 0.15 || bbPct > 0.85) primary = "breakout";

  return { primary, signals };
}

// ─── Trade Plan (Architecture spec §7.2) ──────────────────────────────────────

function tradePlan(params: {
  price: number; ema20: number; atrVal: number; bbUpper: number; bbLower: number; preset: string;
  triUpper?: number; triLower?: number;
}): { entry: number; stop: number; target: number; rr: string; riskPct: number } {
  const { price, ema20, atrVal, bbUpper, bbLower, preset, triUpper, triLower } = params;
  let entry: number, stop: number, target: number;

  if (preset === "early_break") {
    if (triUpper && triLower && triUpper > triLower) {
      const h = triUpper - triLower;
      entry  = +(triUpper * 1.002).toFixed(2);
      stop   = +(triLower * 0.98).toFixed(2);
      target = +(entry + h * 1.618).toFixed(2);
    } else {
      entry  = +(bbUpper * 1.001).toFixed(2);
      stop   = +(bbLower * 0.999).toFixed(2);
      target = +(entry + (entry - stop) * 2.5).toFixed(2);
    }
  } else if (preset === "day_mom") {
    entry  = +(price * 1.001).toFixed(2);
    stop   = +(price * 0.97).toFixed(2);
    target = +(entry + atrVal * 2).toFixed(2);
  } else {
    // Swing default — EMA20 stop
    entry  = +(price * 1.002).toFixed(2);
    stop   = +(Math.min(ema20 * 0.995, price * 0.97)).toFixed(2);
    target = +(entry + (entry - stop) * 3).toFixed(2);
  }

  const risk = entry - stop;
  const rr   = risk > 0 ? ((target - entry) / risk).toFixed(1) + "x" : "—";
  const riskPct = risk > 0 ? +((risk / entry) * 100).toFixed(1) : 0;
  return { entry, stop, target, rr, riskPct };
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function generateWarnings(params: { rsiVal: number; atrPct: number; ivEst: number }): string[] {
  const w: string[] = [];
  if (params.rsiVal > 75) w.push(`RSI aşırı alım (${params.rsiVal.toFixed(0)}) — giriş riskli`);
  if (params.atrPct > 10) w.push(`Yüksek ATR (${params.atrPct.toFixed(1)}%) — pozisyon boyutunu küçült`);
  if (params.ivEst > 120) w.push(`IV çok yüksek (~${params.ivEst}%) — opsiyon primleri pahalı`);
  return w;
}

// ─── Yahoo Finance Fetcher ────────────────────────────────────────────────────

async function fetchChart(ticker: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y&includePrePost=false`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d?.chart?.result?.[0] ?? null;
  } catch { return null; }
}

// ─── Analyze Single Ticker ────────────────────────────────────────────────────

async function analyzeTicker(ticker: string, preset: string, regime: string, spy12mReturn = 0): Promise<ScreenerResult | null> {
  try {
    const chart = await fetchChart(ticker);
    if (!chart) return null;
    const meta  = chart.meta;
    const q     = chart.indicators?.quote?.[0];
    if (!q) return null;

    const closes  = (q.close  || []).filter((v: any): v is number => v != null && typeof v === "number");
    const highs   = (q.high   || []).filter((v: any): v is number => v != null);
    const lows    = (q.low    || []).filter((v: any): v is number => v != null);
    const volumes = (q.volume || []).filter((v: any): v is number => v != null);

    if (closes.length < 50) return null;

    const price   = meta.regularMarketPrice ?? closes.at(-1)!;
    const prev1d  = meta.previousClose ?? closes.at(-2)!;
    const prev1w  = closes.at(-6) ?? closes[0];
    const change1d = prev1d ? +((price - prev1d) / prev1d * 100).toFixed(2) : 0;
    const change1w = prev1w ? +((price - prev1w) / prev1w * 100).toFixed(2) : 0;

    const curVol  = meta.regularMarketVolume ?? volumes.at(-1) ?? 0;
    const avgVol  = sma(volumes, 20);
    const rvolVal = avgVol > 0 ? +(curVol / avgVol).toFixed(2) : 1;
    const mktCap  = meta.marketCap ?? (price * curVol / 10);

    // Indicators
    const e8   = ema(closes, 8);
    const e13  = ema(closes, 13);
    const e20  = ema(closes, 20);
    const e21  = ema(closes, 21);
    const e50  = ema(closes, 50);
    const e200 = ema(closes, 200);
    const s200 = sma(closes, 200);
    const rsiVal  = +rsi(closes).toFixed(1);
    const macdR   = macd(closes);
    const atrVal  = atr(highs, lows, closes, 14);
    const atrPct  = price > 0 ? +(atrVal / price * 100).toFixed(2) : 0;
    const bb      = bollinger(closes);
    const adxVal  = +adx(highs, lows, closes, 14).toFixed(1);
    const rocVal  = +roc(closes).toFixed(2);
    const ivEst   = Math.min(250, +(atrPct * 16).toFixed(0));

    const hi52 = meta.fiftyTwoWeekHigh ?? Math.max(...closes.slice(-252));
    const lo52 = meta.fiftyTwoWeekLow  ?? Math.min(...closes.slice(-252));
    const pct52h = hi52 ? +((price - hi52) / hi52 * 100).toFixed(1) : 0;

    // EMA structure label
    let ema_structure = "EMA Nötr";
    if (e8 > e13 && e13 > e21 && e21 > e50 && e50 > e200) {
      ema_structure = price > s200 ? "EMA8>13>21>50>200 ✓" : "EMA8>13>21>50>200";
    } else if (e20 > e50 && e50 > e200) {
      ema_structure = price > s200 ? "EMA20>50>200 ✓" : "EMA20>50>200";
    } else if (e20 > e50) {
      ema_structure = "EMA20>EMA50 ✓";
    } else if (e20 < e50) {
      ema_structure = "EMA20<EMA50 ✗";
    }

    const trend_direction: "up" | "dn" | "neu" =
      price > s200 && e20 > e50 ? "up" :
      price < s200 && e20 < e50 ? "dn" : "neu";

    const { has_options, has_weekly } = optionsAvail(ticker, mktCap);

    // Sub-scores
    const tScore = calcTrendScore({ price, ema8: e8, ema13: e13, ema20: e20, ema21: e21, ema50: e50, ema200: e200, sma200: s200, adxVal, pct52h });
    const mScore = calcMomentumScore({ rsiVal, rvol: rvolVal, macdVal: macdR.macd, macdHist: macdR.hist, rocVal, atrPct });
    const oScore = calcOptionsScore(has_weekly, has_options, mktCap, ivEst);
    const lScore = calcLiquidityScore(rvolVal, avgVol, price, mktCap);

    const { score, grade } = calcBogaScore({ trend: tScore, momentum: mScore, options: oScore, liquidity: lScore, preset, regime });

    // Triangle detection
    const tri = detectSymmetricalTriangle(highs, lows, closes, volumes);

    // Boost BOGA score when triangle confirmed on early_break
    let finalScore = score;
    let finalGrade = grade;
    if (tri.detected && preset === "early_break") {
      const bonus = Math.round(tri.triangle_score * 0.12);
      finalScore = Math.min(100, finalScore + bonus);
      finalGrade = toGrade(finalScore);
    }

    const { primary, signals } = classifySetup({ price, ema20: e20, ema50: e50, sma200: s200, rsiVal, rvol: rvolVal, atrPct, change1d, hasWeekly: has_weekly, bbPct: bb.pct });
    const plan = tradePlan({ price, ema20: e20, atrVal, bbUpper: bb.upper, bbLower: bb.lower, preset, triUpper: tri.upper_trendline, triLower: tri.lower_trendline });
    const warnings = generateWarnings({ rsiVal, atrPct, ivEst });

    // RS Rating: hisse 12 aylık getirisi vs SPY (IBD mantığı, 1-99 skala)
    const stock12mReturn = closes.length >= 2
      ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100
      : 0;
    const rs_rating = spy12mReturn !== 0
      ? Math.min(99, Math.max(1, Math.round(50 + (stock12mReturn - spy12mReturn) * 1.5)))
      : Math.min(99, Math.max(1, Math.round(50 + stock12mReturn * 0.8)));

    // New High: 52 hafta zirvesine ≤3% uzaklık
    const is_new_high = pct52h >= -3;

    // VCP (Volatility Contraction Pattern): son 10 günde hacim kuruması
    const minVol10 = volumes.length >= 10 ? Math.min(...volumes.slice(-10)) : avgVol;
    const vol_contraction = minVol10 < avgVol * 0.65;

    return {
      ticker,
      company:  meta.shortName || meta.longName || ticker,
      sector:   meta.sector || "Unknown",
      price, change1d, change_1d: change1d, change_1w: change1w,
      volume: curVol, avg_volume: Math.round(avgVol), rvol: rvolVal,
      market_cap: mktCap, market_cap_label: fmtCap(mktCap), float_shares: 0,
      boga_score: finalScore, grade: finalGrade,
      trend_score: tScore, momentum_score: mScore, options_score: oScore, liquidity_score: lScore,
      ema8: +e8.toFixed(2), ema13: +e13.toFixed(2), ema20: +e20.toFixed(2),
      ema21: +e21.toFixed(2), ema50: +e50.toFixed(2), ema200: +e200.toFixed(2),
      sma200: +s200.toFixed(2), rsi: rsiVal,
      macd: +macdR.macd.toFixed(4), macd_signal: +macdR.signal.toFixed(4), macd_hist: +macdR.hist.toFixed(4),
      atr_pct: atrPct,
      bb_upper: +bb.upper.toFixed(2), bb_lower: +bb.lower.toFixed(2), bb_pct: +bb.pct.toFixed(3), bb_width: +bb.width.toFixed(3),
      adx: adxVal, roc10: rocVal,
      ema_structure, trend_direction, pct_from_52w_high: pct52h,
      has_options, has_weekly_options: has_weekly, iv_est: ivEst,
      entry: plan.entry, stop: plan.stop, target: plan.target, rr_ratio: plan.rr, risk_pct: plan.riskPct,
      support: +lo52.toFixed(2), resistance: +hi52.toFixed(2),
      primary_setup: primary, setup_signals: signals, warnings,
      rs_rating, is_new_high, vol_contraction,
      triangle_detected: tri.detected,
      triangle_score: tri.triangle_score,
      bbw_percentile: tri.bbw_percentile,
      apex_bars_left: tri.apex_bars_left,
      upper_trendline: tri.upper_trendline,
      lower_trendline: tri.lower_trendline,
      target_fib: tri.target_fib,
      triangle_stop: tri.stop_loss,
      triangle_rr: tri.risk_reward,
    } as any;
  } catch { return null; }
}

// ─── Preset Filters (Architecture spec §4.3 + §4.4) ──────────────────────────

function passesPreset(s: ScreenerResult, preset: string): boolean {
  switch (preset) {
    case "genel_swing":
      // Price > EMA8 > EMA20, RSI 50+, RVOL ≥ 1.5
      return s.price > s.ema8 &&
             s.ema8 > s.ema20 &&
             s.ema20 > s.ema50 &&
             s.rsi >= 50 &&
             s.rvol >= 1.5 &&
             s.boga_score >= 40;
    case "swing_cont":
      // Price > SMA200, EMA20 > EMA50, RSI 55-75, RVOL ≥ 1.0, MCap ≥ 500M
      return s.price > s.sma200 &&
             s.ema20 > s.ema50 &&
             s.rsi >= 55 && s.rsi <= 75 &&
             s.rvol >= 1.0 &&
             s.market_cap >= 500e6 &&
             s.boga_score >= 45;
    case "early_break": {
      if (s.price > 100) return false;
      const triDetected = s.triangle_detected ?? false;
      const triScore    = s.triangle_score    ?? 0;
      const bbwPct      = s.bbw_percentile    ?? 100;
      const trianglePath = triDetected && triScore >= 50;
      const squeezePath  = s.bb_width < 0.12 && bbwPct < 35;
      return (trianglePath || squeezePath) && s.rvol >= 0.8 && s.boga_score >= 40;
    }
    case "day_mom":
      // Değişim > 2.5%, RVOL ≥ 2.0, RSI 50+
      return s.change_1d > 2.5 &&
             s.rvol >= 2.0 &&
             s.rsi >= 50 &&
             s.boga_score >= 45;
    case "opt_sniper":
      // Haftalık opsiyonlar, IV expansion, RVOL ≥ 1.3, RSI 45+
      return s.has_weekly_options &&
             s.rvol >= 1.3 &&
             s.atr_pct >= 2.0 &&
             s.rsi >= 45 &&
             s.boga_score >= 45;
    case "inst_trend":
      // MCap > 10B, Price > SMA200, EMA20 > EMA50, ADX ≥ 20
      return s.market_cap >= 10e9 &&
             s.price > s.sma200 &&
             s.ema20 > s.ema50 &&
             s.adx >= 20 &&
             s.boga_score >= 50;
    case "cheap_exp":
      // Price $0.5-$10, ATR% ≥ 3.0, RVOL ≥ 1.5, opsiyonlu
      return s.price >= 0.5 && s.price < 10 &&
             s.atr_pct >= 3.0 &&
             s.rvol >= 1.5 &&
             s.has_options &&
             s.boga_score >= 38;
    case "ema_cross":
      // EMA8 > EMA20, EMA20 EMA50'ye yakın (±7%), RVOL ≥ 1.3, RSI 45-72
      return s.ema8 > s.ema20 &&
             s.ema20 >= s.ema50 * 0.93 && s.ema20 <= s.ema50 * 1.07 &&
             s.rvol >= 1.3 &&
             s.rsi >= 45 && s.rsi <= 72 &&
             s.boga_score >= 40;
    case "gamma_sq":
      // Haftalık opsiyonlar, ATR% ≥ 4.0, MCap < 20B, RVOL ≥ 1.5
      return s.has_weekly_options &&
             s.atr_pct >= 4.0 &&
             s.market_cap < 20e9 &&
             s.rvol >= 1.5 &&
             s.rsi >= 45 &&
             s.boga_score >= 45;
    case "pre_catalyst":
      // Episodic Pivot: MCap ≥ 200M, RVOL ≥ 2.0, RSI 45+, Değişim > 2.0%
      return s.price >= 1 &&
             s.market_cap >= 200e6 &&
             s.rvol >= 2.0 &&
             s.rsi >= 45 &&
             s.change_1d > 2.0 &&
             s.boga_score >= 38;
    case "quality_growth":
      // Teknik proxy: Price > SMA200, MCap ≥ 1B, EMA20 > EMA50, ADX ≥ 18
      return s.price > s.sma200 &&
             s.market_cap >= 1e9 &&
             s.ema20 > s.ema50 &&
             s.adx >= 18 &&
             s.rsi >= 50 &&
             s.boga_score >= 52;
    case "agg_growth":
      // Güçlü momentum proxy: Price > SMA200, RVOL ≥ 1.5, RSI 55+, ROC ≥ 5%
      return s.price > s.sma200 &&
             s.rvol >= 1.5 &&
             s.rsi >= 55 &&
             s.roc10 >= 5 &&
             s.boga_score >= 55;
    case "breakout_growth":
      // Golden Cross proxy: EMA50 > SMA200, Price > EMA20, RVOL ≥ 2, ADX ≥ 20, BOGA ≥ 60
      return s.ema50 > s.sma200 &&
             s.price > s.ema20 &&
             s.rvol >= 2.0 &&
             s.adx >= 20 &&
             s.boga_score >= 60;
    case "hottest_momo":
      // Fotoğraftaki filtre: $10-$100, AvgVol>1M, RVOL>1.5, MCap>500M,
      // RSI 45-70, Price>SMA50, Price>SMA200, Gün>+2%, Unusual Vol VEYA New High
      return s.price >= 10 && s.price <= 100 &&
             s.avg_volume >= 1e6 &&
             s.rvol >= 1.5 &&
             s.market_cap >= 500e6 &&
             s.rsi >= 45 && s.rsi <= 70 &&
             s.price > s.ema50 &&
             s.price > s.sma200 &&
             s.change_1d >= 2.0 &&
             (s.rvol >= 2.5 || s.is_new_high) &&
             s.boga_score >= 42;
    default:
      return s.boga_score >= 45;
  }
}

// ─── Regime Detector ──────────────────────────────────────────────────────────

async function detectRegime(): Promise<Regime> {
  try {
    const [res, vxRes] = await Promise.all([
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1y",
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }),
      fetch("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d",
        { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }),
    ]);
    const d    = await res.json();
    const vxD  = await vxRes.json();
    const chart    = d?.chart?.result?.[0];
    const vxChart  = vxD?.chart?.result?.[0];

    const spyCloses = (chart?.indicators?.quote?.[0]?.close || []).filter(Boolean) as number[];
    const spyPrice  = chart?.meta?.regularMarketPrice ?? spyCloses.at(-1) ?? 500;
    const spyPrev   = chart?.meta?.previousClose ?? spyCloses.at(-2) ?? 500;
    const spySma200 = sma(spyCloses, Math.min(200, spyCloses.length));
    const spyChange = spyPrev ? ((spyPrice - spyPrev) / spyPrev) * 100 : 0;
    const vixPrice  = vxChart?.meta?.regularMarketPrice ?? vxChart?.indicators?.quote?.[0]?.close?.filter(Boolean)?.at(-1) ?? 20;

    // 12-month SPY return for RS Rating baseline
    const spy12mReturn = spyCloses.length >= 2
      ? ((spyCloses.at(-1)! - spyCloses[0]) / spyCloses[0]) * 100
      : 0;

    let regime: Regime["regime"];
    if (vixPrice > 35) regime = "high_volatility";
    else if (vixPrice < 14 && spyChange > -0.5) regime = "low_volatility";
    else if (spyPrice > spySma200) {
      regime = spyChange > 0.3 ? "bull_trending" : "bull_choppy";
    } else {
      regime = spyChange < -0.3 ? "bear_trending" : "bear_choppy";
    }

    return {
      regime,
      label: { bull_trending: "Güçlü Boğa", bull_choppy: "Çalkantılı Boğa", neutral: "Nötr", bear_choppy: "Çalkantılı Ayı", bear_trending: "Güçlü Ayı", high_volatility: "Yüksek Volatilite", low_volatility: "Düşük Volatilite" }[regime] ?? "Nötr",
      spy_change: +spyChange.toFixed(2),
      vix_price: +vixPrice.toFixed(1),
      trend: spyPrice > spySma200 ? "bullish" : "bearish",
      momentum: spyChange > 0.5 ? "strong" : spyChange < -0.5 ? "weak" : "moderate",
      spy_12m_return: +spy12mReturn.toFixed(2),
    };
  } catch {
    return { regime: "neutral", label: "Nötr", spy_change: 0, vix_price: 20, trend: "choppy", momentum: "moderate", spy_12m_return: 0 };
  }
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const preset     = sp.get("preset")    || "swing_cont";
  const priceMin   = parseFloat(sp.get("priceMin") || "0");
  const priceMax   = parseFloat(sp.get("priceMax") || "999999");
  const capFilter  = sp.get("cap")       || "all";
  const optFilter  = sp.get("opt")       || "all";
  const liqFilter  = sp.get("liq")       || "all";
  const sortBy     = sp.get("sort")      || "score";
  const limit      = Math.min(parseInt(sp.get("limit") || "100"), 200);
  // Advanced filters
  const rvolMin    = sp.get("rvolMin")   ? parseFloat(sp.get("rvolMin")!) : null;
  const rsiMin     = sp.get("rsiMin")    ? parseInt(sp.get("rsiMin")!)    : null;
  const rsiMax     = sp.get("rsiMax")    ? parseInt(sp.get("rsiMax")!)    : null;
  const adxMin     = sp.get("adxMin")    ? parseInt(sp.get("adxMin")!)    : null;

  // Fetch regime
  const regime = await detectRegime();

  // Deduplicate and load universe
  let universe: string[] = [];
  try {
    const protocol = req.nextUrl.protocol;
    const host = req.nextUrl.host;
    const url = `${protocol}//${host}/data/daily_universe.json`;
    const uniRes = await fetch(url, { cache: 'no-store' });
    if (uniRes.ok) {
      const uniData = await uniRes.json();
      if (uniData.tickers && Array.isArray(uniData.tickers)) {
        universe = uniData.tickers;
      }
    }
  } catch (e) {
    console.error("Could not load daily universe:", e);
  }

  // Fallback if universe is empty
  if (universe.length === 0) {
    universe = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA"];
  }
  universe = [...new Set(universe)];

  // Batch fetch (parallel, optimized for 1000 stocks without Vercel timeout)
  // Higher batch size and concurrency to process faster.
  const batchSize = 30;
  const batches: string[][] = [];
  for (let i = 0; i < universe.length; i += batchSize) {
    batches.push(universe.slice(i, i + batchSize));
  }

  const allResults: ScreenerResult[] = [];
  const concurrency = 8;
  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    const chunkRes = await Promise.all(
      chunk.map(batch => Promise.all(batch.map(t => analyzeTicker(t, preset, regime.regime, regime.spy_12m_return))))
    );
    chunkRes.flat().forEach(r => r && allResults.push(r));
  }

  // Segment filters
  const capRanges: Record<string, [number, number]> = {
    nano:  [0, 50e6], micro: [50e6, 300e6], small: [300e6, 2e9],
    mid:   [2e9, 10e9], large: [10e9, 200e9], mega: [200e9, Infinity],
  };
  const liqRanges: Record<string, [number, number]> = {
    low:  [0, 500e3], mid: [500e3, 5e6], high: [5e6, 50e6], inst: [50e6, Infinity],
  };

  const filtered = allResults.filter(s => {
    if (s.price < priceMin || s.price > priceMax) return false;
    if (capFilter !== "all") {
      const [lo, hi] = capRanges[capFilter] ?? [0, Infinity];
      if (s.market_cap < lo || s.market_cap >= hi) return false;
    }
    if (optFilter === "weekly" && !s.has_weekly_options) return false;
    if (optFilter === "has_options" && !s.has_options) return false;
    if (optFilter === "no_options" && s.has_options) return false;
    if (liqFilter !== "all") {
      const dolVol = s.price * s.avg_volume;
      const [lo, hi] = liqRanges[liqFilter] ?? [0, Infinity];
      if (dolVol < lo || dolVol >= hi) return false;
    }
    // Advanced filters
    if (rvolMin !== null && s.rvol < rvolMin) return false;
    if (rsiMin !== null && s.rsi < rsiMin) return false;
    if (rsiMax !== null && s.rsi > rsiMax) return false;
    if (adxMin !== null && s.adx < adxMin) return false;
    return passesPreset(s, preset);
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "score": return b.boga_score - a.boga_score;
      case "rvol":  return b.rvol - a.rvol;
      case "chg":   return b.change_1d - a.change_1d;
      case "rsi":   return b.rsi - a.rsi;
      case "price": return a.price - b.price;
      default:      return b.boga_score - a.boga_score;
    }
  });

  return NextResponse.json(
    {
      results:       sorted.slice(0, limit),
      total:         filtered.length,
      scanned:       allResults.length,
      universe_size: universe.length,
      preset,
      regime,
      timestamp:     new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=90, stale-while-revalidate=45" } }
  );
}
