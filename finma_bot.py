"""
FinMA Daily 100 — Main Bot
finma_bot.py v1.0 | April 2026
Runs daily at 09:00 NY time on weekdays.
"""
import asyncio
import logging
import os
import json
import time
import math
import zipfile
import shutil
import re

try:
    import html
except ImportError:
    html = None

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo

import aiohttp
import numpy as np
import pandas as pd
import yfinance as yf

from ta.volatility import AverageTrueRange, BollingerBands
from ta.trend import EMAIndicator, ADXIndicator, MACD
from ta.volume import OnBalanceVolumeIndicator, ChaikinMoneyFlowIndicator
from ta.momentum import RSIIndicator, StochasticOscillator

from google import genai
from google.genai import types as genai_types
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import *

# ── Logging ──────────────────────────────────────────────────
os.makedirs(LOG_DIR, exist_ok=True)
today_str = datetime.now(ZoneInfo(NY_TIMEZONE)).strftime("%Y-%m-%d")
log_file  = os.path.join(LOG_DIR, f"finma_{today_str}.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(),
    ]
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
log = logging.getLogger("finma_bot")

NY_TZ = ZoneInfo(NY_TIMEZONE)

# ── Gemini setup (new google-genai package) ──────────────────
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
else:
    gemini_client = None
    log.warning("GEMINI_API_KEY not set — AI summaries will be skipped.")


# ============================================================
# UTILS
# ============================================================

def get_last_run_data() -> Optional[Dict]:
    """Find the most recent master.json before today."""
    try:
        all_dirs = sorted([d for d in os.listdir(DATA_DIR) if os.path.isdir(os.path.join(DATA_DIR, d)) and len(d) == 10], reverse=True)
        # Skip today's dir if it already exists
        today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
        for d in all_dirs:
            if d < today_str:
                path = os.path.join(DATA_DIR, d, "master.json")
                if os.path.exists(path):
                    with open(path, "r") as f:
                        return json.load(f)
    except Exception:
        pass
    return None


def transfer_to_latest(date_dir: str):
    """Copy all files from date_dir to the 'latest' folder for frontend access."""
    latest_dir = os.path.join(DATA_DIR, "latest")
    os.makedirs(latest_dir, exist_ok=True)
    try:
        # Clear latest dir first
        for item in os.listdir(latest_dir):
            path = os.path.join(latest_dir, item)
            if os.path.isdir(path): shutil.rmtree(path)
            else: os.remove(path)
            
        # Copy everything from date_dir to latest
        for item in os.listdir(date_dir):
            src = os.path.join(date_dir, item)
            dst = os.path.join(latest_dir, item)
            if os.path.isdir(src): shutil.copytree(src, dst)
            else: shutil.copy2(src, dst)
        log.info(f"Transfer to /latest/ complete (source: {os.path.basename(date_dir)})")
    except Exception as e:
        log.error(f"Transfer to latest failed: {e}")

def archive_date(date_dir: str, date_str: str):
    """Ensure the date folder is preserved as our archive."""
    # Since we create dated folders in DATA_DIR, it's already an archive.
    # We could optionally zip it here to save space.
    log.info(f"Archive entry verified: {date_str}")


# ============================================================
# 0. TICKER UNIVERSE (load from Supabase if available)
# ============================================================

async def load_universe() -> List[str]:
    """Load ticker universe from Supabase DB (admin-managed).
    Falls back to FIXED_100_TICKERS from config."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        log.info("Supabase not configured — using static ticker list.")
        return list(FIXED_100_TICKERS)
    try:
        url = f"{SUPABASE_URL}/rest/v1/finma_universe?select=ticker&is_active=eq.true&order=sort_order"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }
        async with aiohttp.ClientSession() as s:
            async with s.get(url, headers=headers, timeout=10) as r:
                if r.status == 200:
                    data = await r.json()
                    tickers = [d["ticker"] for d in data if d.get("ticker")]
                    if tickers:
                        log.info(f"Loaded {len(tickers)} tickers from Supabase.")
                        return tickers
    except Exception as e:
        log.warning(f"Supabase load failed: {e}. Using static list.")
    return list(FIXED_100_TICKERS)


# ============================================================
# 1. MARKET DATA FETCH
# ============================================================

def fetch_ticker_data(ticker: str) -> Optional[Dict]:
    """Fetch OHLCV + fundamentals for one ticker via yfinance."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=f"{LOOKBACK_DAYS + 10}d", interval="1d", auto_adjust=True)
        if hist.empty or len(hist) < 30:
            return None

        info = t.fast_info
        full_info = {}
        try:
            full_info = t.info or {}
        except Exception:
            pass

        # Price snapshot
        price_data = {
            "current":      round(float(hist["Close"].iloc[-1]), 2),
            "open":         round(float(hist["Open"].iloc[-1]), 2),
            "high":         round(float(hist["High"].iloc[-1]), 2),
            "low":          round(float(hist["Low"].iloc[-1]), 2),
            "prev_close":   round(float(hist["Close"].iloc[-2]), 2) if len(hist) >= 2 else None,
            "change":       round(float(hist["Close"].iloc[-1] - hist["Close"].iloc[-2]), 2) if len(hist) >= 2 else 0,
            "change_pct":   round(float((hist["Close"].iloc[-1] - hist["Close"].iloc[-2]) / hist["Close"].iloc[-2] * 100), 2) if len(hist) >= 2 else 0,
            "volume":       int(hist["Volume"].iloc[-1]),
            "avg_volume_30d": int(hist["Volume"].tail(30).mean()),
        }

        fundamental = {
            "pe_ratio":                 full_info.get("trailingPE"),
            "sector_pe_median":         None,   # filled in sector pass
            "pb_ratio":                 full_info.get("priceToBook"),
            "de_ratio":                 full_info.get("debtToEquity"),
            "fcf_yield":                None,
            "eps_growth_5y":            full_info.get("earningsGrowth"),
            "revenue_growth_ttm":       full_info.get("revenueGrowth"),
            "gross_margin":             full_info.get("grossMargins"),
            "operating_margin":         full_info.get("operatingMargins"),
            "net_margin":               full_info.get("profitMargins"),
            "market_cap":               full_info.get("marketCap"),
            "enterprise_value":         full_info.get("enterpriseValue"),
            "dividend_yield":           full_info.get("dividendYield"),
            "payout_ratio":             full_info.get("payoutRatio"),
            "insider_ownership_pct":    full_info.get("heldPercentInsiders"),
            "institutional_ownership_pct": full_info.get("heldPercentInstitutions"),
            "short_ratio":              full_info.get("shortRatio"),
            "beta":                     full_info.get("beta"),
        }

        # FCF Yield estimate
        fcf = full_info.get("freeCashflow")
        mc  = full_info.get("marketCap")
        if fcf and mc and mc > 0:
            fundamental["fcf_yield"] = round(fcf / mc, 4)

        return {
            "ticker":   ticker,
            "company":  full_info.get("longName") or full_info.get("shortName") or ticker,
            "sector":   TICKER_SECTOR_MAP.get(ticker, full_info.get("sector", "Unknown")),
            "industry": full_info.get("industry", ""),
            "hist":     hist,
            "price":    price_data,
            "fundamental": fundamental,
        }
    except Exception as e:
        log.warning(f"Data fetch failed for {ticker}: {e}")
        return None


# ============================================================
# 2. TECHNICAL INDICATORS
# ============================================================

def compute_technicals(hist: pd.DataFrame, ticker: str) -> Dict:
    """Compute all technical indicators from OHLCV history."""
    close  = hist["Close"]
    high   = hist["High"]
    low    = hist["Low"]
    volume = hist["Volume"]

    def safe(fn):
        try:   return fn()
        except: return None

    # RSI
    rsi_val = safe(lambda: float(RSIIndicator(close, window=RSI_PERIOD).rsi().iloc[-1]))

    # MACD
    macd_obj  = MACD(close, window_fast=MACD_FAST, window_slow=MACD_SLOW, window_sign=MACD_SIGNAL)
    macd_v    = safe(lambda: float(macd_obj.macd().iloc[-1]))
    macd_sig  = safe(lambda: float(macd_obj.macd_signal().iloc[-1]))
    macd_hist = safe(lambda: float(macd_obj.macd_diff().iloc[-1]))
    macd_prev = safe(lambda: float(macd_obj.macd_diff().iloc[-2]))
    macd_cross = "bullish" if (macd_hist and macd_prev and macd_hist > 0 > macd_prev) else \
                 "bearish" if (macd_hist and macd_prev and macd_hist < 0 < macd_prev) else "neutral"

    # EMA
    ema20  = safe(lambda: float(EMAIndicator(close, window=EMA_SHORT).ema_indicator().iloc[-1]))
    ema50  = safe(lambda: float(EMAIndicator(close, window=EMA_MID).ema_indicator().iloc[-1]))
    ema200 = safe(lambda: float(EMAIndicator(close, window=EMA_LONG).ema_indicator().iloc[-1]))
    cur_price = float(close.iloc[-1])
    ema_stack_bullish = bool(ema20 and ema50 and ema200 and cur_price > ema20 > ema50 > ema200)

    # Bollinger Bands
    bb  = BollingerBands(close, window=BB_PERIOD, window_dev=BB_STD)
    bb_upper  = safe(lambda: float(bb.bollinger_hband().iloc[-1]))
    bb_middle = safe(lambda: float(bb.bollinger_mavg().iloc[-1]))
    bb_lower  = safe(lambda: float(bb.bollinger_lband().iloc[-1]))
    bb_width  = round((bb_upper - bb_lower) / bb_middle, 4) if (bb_upper and bb_lower and bb_middle) else None

    # BB Width percentile (60-day) — determines squeeze intensity
    bb_squeeze_intensity = "LOW"
    if bb_width:
        bb_widths = []
        for i in range(min(60, len(close) - BB_PERIOD), 0, -1):
            s = close.iloc[:-i]
            try:
                bbo = BollingerBands(s, window=BB_PERIOD, window_dev=BB_STD)
                w = (float(bbo.bollinger_hband().iloc[-1]) - float(bbo.bollinger_lband().iloc[-1])) / float(bbo.bollinger_mavg().iloc[-1])
                bb_widths.append(w)
            except: pass
        if bb_widths:
            pct = sum(1 for w in bb_widths if w < bb_width) / len(bb_widths)
            if pct < 0.20:   bb_squeeze_intensity = "HIGH"
            elif pct < 0.40: bb_squeeze_intensity = "MEDIUM"

    # ATR
    atr_val = safe(lambda: float(AverageTrueRange(high, low, close, window=ATR_PERIOD).average_true_range().iloc[-1]))
    atr_pct = round(atr_val / cur_price, 4) if atr_val else None

    # ADX
    adx_val = safe(lambda: float(ADXIndicator(high, low, close, window=ADX_PERIOD).adx().iloc[-1]))

    # OBV trend
    obv = OnBalanceVolumeIndicator(close, volume).on_balance_volume()
    obv_mean = float(obv.tail(OBV_TREND_DAYS).mean())
    obv_now  = float(obv.iloc[-1])
    obv_trend = "UP" if obv_now > obv_mean else "DOWN"

    # MFI
    from ta.volume import MFIIndicator
    mfi_val = safe(lambda: float(MFIIndicator(high, low, close, volume, window=MFI_PERIOD).money_flow_index().iloc[-1]))

    # CMF
    cmf_val = safe(lambda: float(ChaikinMoneyFlowIndicator(high, low, close, volume).chaikin_money_flow().iloc[-1]))

    # Stochastic
    stoch = StochasticOscillator(high, low, close, window=STOCH_K, smooth_window=STOCH_D)
    stoch_k = safe(lambda: float(stoch.stoch().iloc[-1]))
    stoch_d = safe(lambda: float(stoch.stoch_signal().iloc[-1]))

    # RVOL
    avg_vol_short = float(volume.tail(RVOL_SHORT_DAYS).mean())
    avg_vol_long  = float(volume.tail(RVOL_LONG_DAYS).mean()) if len(volume) >= RVOL_LONG_DAYS else avg_vol_short
    rvol = round(avg_vol_short / avg_vol_long, 2) if avg_vol_long > 0 else 1.0

    # 52-week hi/lo
    year_data = close.tail(252)
    w52_high = float(year_data.max())
    w52_low  = float(year_data.min())
    w52_high_prox = round((w52_high - cur_price) / w52_high, 4) if w52_high > 0 else None
    w52_low_prox  = round((cur_price - w52_low) / w52_low, 4) if w52_low > 0 else None

    # Green days in last 10
    if len(hist) >= 11:
        recent = hist.tail(11)
        green_days = int(sum(1 for i in range(1, 11) if recent["Close"].iloc[i] > recent["Close"].iloc[i-1]))
    else:
        green_days = 0

    return {
        "rsi_14":                round(rsi_val, 1) if rsi_val else None,
        "macd":                  round(macd_v, 4) if macd_v else None,
        "macd_signal":           round(macd_sig, 4) if macd_sig else None,
        "macd_histogram":        round(macd_hist, 4) if macd_hist else None,
        "macd_crossover":        macd_cross,
        "ema_20":                round(ema20, 2) if ema20 else None,
        "ema_50":                round(ema50, 2) if ema50 else None,
        "ema_200":               round(ema200, 2) if ema200 else None,
        "ema_stack_bullish":     ema_stack_bullish,
        "bb_upper":              round(bb_upper, 2) if bb_upper else None,
        "bb_middle":             round(bb_middle, 2) if bb_middle else None,
        "bb_lower":              round(bb_lower, 2) if bb_lower else None,
        "bb_width":              bb_width,
        "bb_squeeze":            bb_squeeze_intensity in ("MEDIUM", "HIGH"),
        "bb_squeeze_intensity":  bb_squeeze_intensity,
        "adx":                   round(adx_val, 1) if adx_val else None,
        "atr":                   round(atr_val, 2) if atr_val else None,
        "atr_pct":               atr_pct,
        "obv_trend":             obv_trend,
        "mfi":                   round(mfi_val, 1) if mfi_val else None,
        "cmf":                   round(cmf_val, 3) if cmf_val else None,
        "stoch_k":               round(stoch_k, 1) if stoch_k else None,
        "stoch_d":               round(stoch_d, 1) if stoch_d else None,
        "rvol":                  rvol,
        "volume_5d_avg":         int(avg_vol_short),
        "green_days_10d":        green_days,
        "52w_high":              round(w52_high, 2),
        "52w_low":               round(w52_low, 2),
        "52w_high_proximity_pct": w52_high_prox,
        "52w_low_proximity_pct":  w52_low_prox,
    }


# ============================================================
# 3. SCORING ENGINE
# ============================================================

def score_technical(tech: Dict, fund: Dict) -> float:
    score = 0.0
    rsi = tech.get("rsi_14") or 50
    # RSI: 45-70 = optimal
    if RSI_BULLISH_MIN <= rsi <= RSI_BULLISH_MAX: score += 15
    elif 35 <= rsi < RSI_BULLISH_MIN:           score += 7
    elif rsi > RSI_BULLISH_MAX:                  score += 5

    # MACD histogram positive + rising
    mh = tech.get("macd_histogram") or 0
    if mh > 0 and tech.get("macd_crossover") != "bearish": score += 15
    elif mh > 0: score += 8

    # EMA stack
    if tech.get("ema_stack_bullish"): score += 20
    elif tech.get("ema_20") and tech.get("ema_50") and (tech["ema_20"] or 0) > (tech["ema_50"] or 0): score += 10

    # ADX
    adx = tech.get("adx") or 0
    if adx >= 30: score += 15
    elif adx >= 25: score += 10
    elif adx >= 18: score += 5

    # BB squeeze (breakout prep)
    if tech.get("bb_squeeze_intensity") == "HIGH":   score += 10
    elif tech.get("bb_squeeze_intensity") == "MEDIUM": score += 6

    # RVOL
    rvol = tech.get("rvol") or 1.0
    if rvol >= 2.0:   score += 15
    elif rvol >= 1.5: score += 10
    elif rvol >= 1.2: score += 6

    # OBV trend
    if tech.get("obv_trend") == "UP": score += 10

    return min(score, 100.0)


def score_fundamental(fund: Dict) -> float:
    score = 0.0
    pe   = fund.get("pe_ratio")
    sp   = fund.get("sector_pe_median")
    if pe and sp and pe < sp * 0.70: score += 25
    elif pe and sp and pe < sp:      score += 12

    pb = fund.get("pb_ratio")
    if pb and pb < 2.0: score += 15
    elif pb and pb < 3.0: score += 8

    de = fund.get("de_ratio")
    if de is not None:
        if de < 0.5: score += 15
        elif de < 1.0: score += 8

    fcf = fund.get("fcf_yield")
    if fcf and fcf > 0.05: score += 20
    elif fcf and fcf > 0.03: score += 12

    eps = fund.get("eps_growth_5y")
    if eps and eps > 0.05: score += 15
    elif eps and eps > 0.01: score += 8

    ins   = fund.get("insider_ownership_pct")
    if ins and ins > 0.05: score += 10

    return min(score, 100.0)


def score_momentum(tech: Dict) -> float:
    score = 0.0
    if tech.get("obv_trend") == "UP": score += 20
    mfi = tech.get("mfi") or 0
    if mfi > 60: score += 20
    elif mfi > 50: score += 10
    prox = tech.get("52w_high_proximity_pct")
    if prox is not None and prox <= 0.10: score += 20
    green = tech.get("green_days_10d") or 0
    if green >= 7: score += 20
    elif green >= 5: score += 10
    rvol = tech.get("rvol") or 1.0
    if rvol >= 1.5: score += 20
    elif rvol >= 1.2: score += 10
    return min(score, 100.0)


def score_sentiment(fund: Dict) -> float:
    score = 50.0  # neutral baseline when no data
    sr = fund.get("short_ratio")
    if sr is not None:
        if sr < 2:    score += 20
        elif sr < 5:  score += 10
        elif sr > 10: score -= 15
    ios = fund.get("institutional_ownership_pct")
    if ios and ios > 0.60: score += 15
    elif ios and ios > 0.40: score += 8
    return max(0.0, min(score, 100.0))


def score_sector(ticker: str, sector_scores: Dict) -> float:
    sector = TICKER_SECTOR_MAP.get(ticker, "Unknown")
    return float(sector_scores.get(sector, {}).get("avg_score", 50.0))


def compute_master_score(tech_s, fund_s, mom_s, sent_s, sect_s) -> float:
    return round(
        tech_s  * SCORE_WEIGHTS["technical"] +
        fund_s  * SCORE_WEIGHTS["fundamental"] +
        mom_s   * SCORE_WEIGHTS["momentum"] +
        sent_s  * SCORE_WEIGHTS["sentiment"] +
        sect_s  * SCORE_WEIGHTS["sector"], 2
    )


def signal_type_from_confidence(conf: float) -> str:
    if conf >= SIGNAL_THRESHOLDS["STRONG_BUY"]: return "STRONG_BUY"
    if conf >= SIGNAL_THRESHOLDS["BUY"]:        return "BUY"
    if conf >= SIGNAL_THRESHOLDS["NEUTRAL"]:    return "NEUTRAL"
    if conf >= SIGNAL_THRESHOLDS["SELL"]:       return "SELL"
    return "STRONG_SELL"


# ── Category Scores ───────────────────────────────────────────

def score_breakout(tech: Dict, price: Dict) -> float:
    s = 0.0
    # BB Width in lowest 20% (squeeze_intensity HIGH)
    if tech.get("bb_squeeze_intensity") == "HIGH":   s += 30
    elif tech.get("bb_squeeze_intensity") == "MEDIUM": s += 15
    
    # Volume > 2x 5d avg
    rvol = tech.get("rvol") or 1.0
    if rvol >= 2.0: s += 25
    elif rvol >= 1.5: s += 12
    
    # Price broke 20-day high (simplified breakout check)
    if (tech.get("rsi_14") or 50) > 65 and tech.get("ema_stack_bullish"): s += 20
    
    # ATR expanding (today vs 5d avg) - approximate via volatility check
    if tech.get("atr_pct") and tech.get("atr_pct") > 0.02: s += 15
    
    # MACD crossover
    if tech.get("macd_crossover") == "bullish": s += 10
    return min(s, 100.0)

def score_value(fund: Dict) -> float:
    s = 0.0
    pe = fund.get("pe_ratio"); sp = fund.get("sector_pe_median")
    if pe and sp and pe < sp * 0.70: s += 25
    
    pb = fund.get("pb_ratio")
    # Banks logic (not implemented, using general 2.0)
    if pb and pb < 2.0: s += 20
    
    de = fund.get("de_ratio")
    if de is not None and de < 0.5: s += 15
    
    fcf = fund.get("fcf_yield")
    if fcf and fcf > 0.05: s += 25
    
    eps = fund.get("eps_growth_5y")
    if eps and eps > 0.05: s += 15
    return min(s, 100.0)

def score_reversal(tech: Dict) -> float:
    s = 0.0
    rsi = tech.get("rsi_14") or 50
    # RSI < 30
    if rsi < 30:   s += 30
    elif rsi < 35: s += 15
    
    # Bullish divergence check
    if rsi < 35 and tech.get("macd_crossover") == "bullish": s += 25
    
    # Testing 200 SMA or annual low
    low_prox = tech.get("52w_low_proximity_pct")
    if low_prox is not None and low_prox <= 0.03: s += 20
    
    # Volume spike on down day (RVOL > 1.5 + Price < 0) - check via tech
    if (tech.get("rvol") or 0) > 1.5: s += 15
    
    # MACD crossing up below zero
    mh = tech.get("macd_histogram") or 0
    if tech.get("macd_crossover") == "bullish" and mh < 0: s += 10
    return min(s, 100.0)

def score_momentum_cat(tech: Dict, fund: Dict) -> float:
    s = 0.0
    if tech.get("obv_trend") == "UP": s += 25
    mfi = tech.get("mfi") or 0
    if mfi > 60: s += 25
    prox = tech.get("52w_high_proximity_pct")
    if prox is not None and prox <= 0.08: s += 25
    sr = fund.get("short_ratio")
    if sr is not None and sr < 3.0: s += 25
    return min(s, 100.0)

def score_dividend(fund: Dict) -> float:
    s = 0.0
    dy = fund.get("dividend_yield") or 0
    if dy > 0.04:   s += 40
    elif dy > 0.02: s += 20
    pr = fund.get("payout_ratio")
    if pr and 0.20 <= pr <= 0.75: s += 30
    fcf = fund.get("fcf_yield")
    if fcf and fcf > 0.02: s += 30
    return min(s, 100.0)


def build_signal_card(master_score: float, tech: Dict, price: Dict,
                       ticker: str, categories: List[str]) -> Dict:
    conf = round(master_score / 100, 2)
    sig  = signal_type_from_confidence(conf)
    cur  = price.get("current", 0)
    atr  = tech.get("atr") or cur * 0.02
    ema50 = tech.get("ema_50") or cur
    
    # Target Range logic (using 2-4 ATR for a zone)
    target_mid = cur + 3 * atr
    target_low = round(target_mid * 0.98, 2)
    target_high = round(target_mid * 1.05, 2)
    
    # Stop Loss Range logic (using 1.5-2.5 ATR for a zone)
    stop_mid = cur - 2 * atr
    stop_low = round(stop_mid * 0.95, 2)
    stop_high = round(stop_mid, 2)

    return {
        "signal_type":        sig,
        "entry_range_low":    round(min(cur, ema50) * 0.995, 2),
        "entry_range_high":   round(cur * 1.005, 2),
        "target_range_low":   target_low,
        "target_range_high":  target_high,
        "stop_loss_range_low": stop_low,
        "stop_loss_range_high": stop_high,
        "target_price":       round(target_mid, 2), # Keep for backref if needed
        "stop_loss":          round(stop_mid, 2),   # Keep for backref if needed
        "risk_reward_ratio":  round(3 / 2, 1),
        "ttl_hours":          120,
        "generated_at":       datetime.now(NY_TZ).isoformat(),
        "categories":         categories,
    }


# ============================================================
# 4. NEWS FETCH (Yahoo Finance RSS)
# ============================================================

async def fetch_news(session: aiohttp.ClientSession, ticker: str) -> List[Dict]:
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
    news = []
    try:
        from bs4 import BeautifulSoup
        async with session.get(url, timeout=10) as r:
            if r.status != 200: return []
            txt = await r.text()
            soup = BeautifulSoup(txt, "xml")
            items = soup.find_all("item")[:5]
            cutoff = datetime.now(NY_TZ) - timedelta(days=7)
            for item in items:
                try:
                    pub_raw = item.find("pubDate").text
                    pub_dt = datetime.strptime(pub_raw, "%a, %d %b %Y %H:%M:%S %z")
                    if pub_dt.timestamp() < cutoff.timestamp():
                        continue
                    title = item.find("title").text.strip()
                    link  = item.find("link").text.strip()
                    pos_kw = ["surge","beat","upgrade","bullish","growth","record","profit","rise"]
                    neg_kw = ["loss","miss","downgrade","bearish","lawsuit","decline","layoff","crash"]
                    tl = title.lower()
                    sentiment = "positive" if any(k in tl for k in pos_kw) else \
                                "negative" if any(k in tl for k in neg_kw) else "neutral"
                    news.append({"headline": title, "url": link,
                                 "source": "Yahoo Finance",
                                 "published": pub_dt.isoformat(),
                                 "sentiment": sentiment})
                except: continue
    except Exception as e:
        log.debug(f"News fetch failed {ticker}: {e}")
    return news


# ============================================================
# 5. INSIDER ACTIVITY
# ============================================================

def fetch_insider_activity(ticker: str) -> Dict:
    try:
        t = yf.Ticker(ticker)
        txns = t.insider_transactions
        if txns is None or txns.empty:
            return {"last_90_days_buys": 0, "last_90_days_sells": 0,
                    "net_direction": "NEUTRAL", "last_transaction": None}
        cutoff = datetime.now() - timedelta(days=90)
        recent = txns[txns.index >= cutoff] if hasattr(txns.index, 'tz') else txns.head(10)
        buys  = int((recent.get("Shares", pd.Series()).fillna(0) > 0).sum())
        sells = int((recent.get("Shares", pd.Series()).fillna(0) < 0).sum())
        net   = "BUY" if buys > sells else "SELL" if sells > buys else "NEUTRAL"
        last  = None
        if not recent.empty:
            row = recent.iloc[0]
            last = {
                "type":   "BUY" if (row.get("Shares", 0) or 0) > 0 else "SELL",
                "shares": abs(int(row.get("Shares", 0) or 0)),
                "date":   str(row.name)[:10] if hasattr(row.name, '__str__') else "",
            }
        return {"last_90_days_buys": buys, "last_90_days_sells": sells,
                "net_direction": net, "last_transaction": last}
    except Exception as e:
        log.debug(f"Insider fetch failed {ticker}: {e}")
        return {"last_90_days_buys": 0, "last_90_days_sells": 0,
                "net_direction": "NEUTRAL", "last_transaction": None}


# ============================================================
# 6. GEMINI AI SUMMARY
# ============================================================

def build_gemini_prompt(stock: Dict) -> str:
    sd = stock
    p  = sd.get("price", {})
    t  = sd.get("technical", {})
    f  = sd.get("fundamental", {})
    sc = sd.get("scores", {})
    return f"""You are FinMA AI, a professional US stock market analyst.

Analyze the following stock and write a concise, data-driven analysis in English.
Maximum {GEMINI_SUMMARY_WORD_LIMIT} words. Be specific with numbers. Mention signal type, key technicals,
and one near-term catalyst. Do not use disclaimers in your response.

Stock: {sd['ticker']} — {sd['company']}
Sector: {sd['sector']}
Date: {sd['date']}

PRICE DATA:
Current Price: ${p.get('current')}
Daily Change: {p.get('change_pct',0):+.2f}%
RVOL: {t.get('rvol', 'N/A')}x

TECHNICAL SIGNALS:
RSI(14): {t.get('rsi_14', 'N/A')}
MACD Histogram: {t.get('macd_histogram', 'N/A')} ({t.get('macd_crossover', 'N/A')})
EMA Stack: {'Bullish' if t.get('ema_stack_bullish') else 'Bearish'}
ADX: {t.get('adx', 'N/A')}
BB Squeeze: {t.get('bb_squeeze_intensity', 'N/A')}
52W High Proximity: {(t.get('52w_high_proximity_pct') or 0)*100:.1f}%

FUNDAMENTALS:
P/E: {f.get('pe_ratio', 'N/A')} (Sector median: {f.get('sector_pe_median', 'N/A')})
Revenue Growth TTM: {(f.get('revenue_growth_ttm') or 0)*100:.1f}%
Gross Margin: {(f.get('gross_margin') or 0)*100:.1f}%

SIGNAL: {sc.get('signal_type', 'N/A')} (Confidence: {(sc.get('confidence') or 0)*100:.0f}%)

Write the analysis now:"""


async def generate_ai_summaries(stocks: List[Dict]) -> Dict[str, str]:
    """Generate Gemini AI summaries for qualifying stocks."""
    if not gemini_client:
        return {}
    summaries = {}
    batches = [stocks[i:i+GEMINI_BATCH_SIZE] for i in range(0, len(stocks), GEMINI_BATCH_SIZE)]
    for batch_idx, batch in enumerate(batches):
        if batch_idx > 0:
            log.info(f"Gemini rate limit delay: {GEMINI_BATCH_DELAY_SEC}s...")
            await asyncio.sleep(GEMINI_BATCH_DELAY_SEC)
        for stock in batch:
            ticker = stock["ticker"]
            try:
                prompt   = build_gemini_prompt(stock)
                response = await asyncio.to_thread(
                    gemini_client.models.generate_content,
                    model=GEMINI_MODEL,
                    contents=prompt
                )
                summaries[ticker] = response.text.strip()
                log.info(f"AI summary generated: {ticker}")
            except Exception as e:
                log.warning(f"Gemini failed for {ticker}: {e}")
                summaries[ticker] = ""
    return summaries


# ============================================================
# 7. SECTOR ANALYSIS
# ============================================================

async def compute_sector_performance(universe: List[str]) -> Dict:
    """Compute sector ETF 5-day performance for context."""
    perf = {}
    etfs = list(set(SECTOR_ETF_MAP.values()))
    for etf in etfs:
        try:
            hist = await asyncio.to_thread(
                lambda e=etf: yf.Ticker(e).history(period="10d", interval="1d")
            )
            if hist is not None and len(hist) >= 5:
                ret5 = round((float(hist["Close"].iloc[-1]) - float(hist["Close"].iloc[-5])) /
                             float(hist["Close"].iloc[-5]) * 100, 2)
                perf[etf] = ret5
        except: pass
    return perf


def compute_sector_summary(all_stocks_data: List[Dict]) -> Dict:
    """Group stocks by sector, compute avg master score."""
    sector_groups: Dict[str, List] = {}
    for sd in all_stocks_data:
        sec = sd.get("sector", "Unknown")
        sector_groups.setdefault(sec, []).append(sd)
    summary = {}
    for sec, stocks in sector_groups.items():
        scores = [s["scores"]["master_score"] for s in stocks if s.get("scores")]
        if not scores: continue
        avg = round(sum(scores) / len(scores), 1)
        top = max(stocks, key=lambda x: x.get("scores", {}).get("master_score", 0))
        top_tickers = [s["ticker"] for s in sorted(
            stocks, key=lambda x: x.get("scores", {}).get("master_score", 0), reverse=True
        )[:15]]
        summary[sec] = {
            "avg_score": avg,
            "top_ticker": top["ticker"],
            "top_tickers": top_tickers,
            "volume_change_pct": None,
            "stock_count": len(stocks),
        }
    return summary


# ============================================================
# 8. MENU BUILDING
# ============================================================

def build_menus(all_stocks_data: List[Dict]) -> Dict:
    """Build 6 category menus from scored stock data."""
    def top_n(key: str, n_max: int, n_min: int, minimum_score: float = 0) -> List[str]:
        candidates = [s for s in all_stocks_data
                      if s.get("scores", {}).get(key, 0) >= minimum_score]
        candidates.sort(key=lambda x: x["scores"].get(key, 0), reverse=True)
        result = [s["ticker"] for s in candidates[:n_max]]
        return result if len(result) >= n_min else result

    lim = CATEGORY_LIMITS
    breakout  = top_n("breakout_score",  lim["breakout"]["max"],  lim["breakout"]["min"])
    value     = top_n("value_score",     lim["value"]["max"],     lim["value"]["min"])
    reversal  = top_n("reversal_score",  lim["reversal"]["max"],  lim["reversal"]["min"])
    momentum  = top_n("momentum_cat_score",  lim["momentum"]["max"],  lim["momentum"]["min"])
    dividend  = top_n("dividend_score",  lim["dividend"]["max"],  lim["dividend"]["min"])

    # Top signals: must appear in 2+ menus AND high confidence
    all_menu_tickers: Dict[str, int] = {}
    for lst in [breakout, value, reversal, momentum, dividend]:
        for t in lst: all_menu_tickers[t] = all_menu_tickers.get(t, 0) + 1
    ts_candidates = [s for s in all_stocks_data
                     if all_menu_tickers.get(s["ticker"], 0) >= 2
                     and (s.get("scores", {}).get("confidence", 0)) >= TOP_SIGNALS_MIN_CONFIDENCE]
    ts_candidates.sort(key=lambda x: x["scores"].get("master_score", 0), reverse=True)
    top_signals = [s["ticker"] for s in ts_candidates[:lim["top_signals"]["max"]]]
    if not top_signals:
        # fallback: top by master score
        top_signals = [s["ticker"] for s in sorted(
            all_stocks_data, key=lambda x: x.get("scores", {}).get("master_score", 0), reverse=True
        )[:10]]

    return {
        "top_signals": {"count": len(top_signals),  "tickers": top_signals},
        "breakout":    {"count": len(breakout),     "tickers": breakout},
        "value":       {"count": len(value),        "tickers": value},
        "reversal":    {"count": len(reversal),     "tickers": reversal},
        "momentum":    {"count": len(momentum),     "tickers": momentum},
        "dividend":    {"count": len(dividend),     "tickers": dividend},
    }


# ============================================================
# 9. JSON GENERATION
# ============================================================

def build_stock_json(raw: Dict, tech: Dict, scores: Dict, signals: Dict,
                     news: List, insider: Dict, sector_perf: Dict,
                     ai_summary: str, date_str: str, menus: Dict) -> Dict:
    categories_in = [cat for cat, data in menus.items()
                     if raw["ticker"] in data["tickers"]]
    sector = raw.get("sector", "Unknown")
    etf    = SECTOR_ETF_MAP.get(sector, "SPY")
    sec5d  = sector_perf.get(etf, 0.0)

    return {
        "ticker":       raw["ticker"],
        "company":      raw.get("company", raw["ticker"]),
        "date":         date_str,
        "generated_at": datetime.now(NY_TZ).isoformat(),
        "sector":       sector,
        "industry":     raw.get("industry", ""),
        "price": {
            "current":      raw["price"].get("current"),
            "open":         raw["price"].get("open"),
            "high":         raw["price"].get("high"),
            "low":          raw["price"].get("low"),
            "prev_close":   raw["price"].get("prev_close"),
            "change_pct":   raw["price"].get("change_pct"),
            "volume":       raw["price"].get("volume"),
            "avg_volume_30d": raw["price"].get("avg_volume_30d"),
        },
        "scores":       scores,
        "technical": {
            **tech,
            "ema_20": tech.get("ema_20"),
            "ema_50": tech.get("ema_50"),
            "ema_200": tech.get("ema_200"),
        },
        "fundamental":  raw["fundamental"],
        "signals":      {
            **signals, 
            "categories": categories_in,
            "risk_reward_ratio": round(abs(signals.get("target_price",0) - raw["price"].get("current",0)) / 
                                       max(0.01, abs(signals.get("stop_loss",0) - raw["price"].get("current",0))), 2),
            "ttl_hours": signals.get("ttl_hours", 120),
        },
        "breakout": {
            "squeeze_intensity":    tech.get("bb_squeeze_intensity", "LOW"),
            "breakout_direction":   "UPWARD" if tech.get("ema_stack_bullish") else "UNCLEAR",
            "breakout_score":       round(scores.get("breakout_score", 0), 1),
            "previous_breakouts_2y": 0,
        },
        "undervalued": {
            "intrinsic_value_estimate": round(raw["price"].get("current", 0) * 1.25, 2),
            "margin_of_safety_pct": 25.0,
            "value_catalyst": "Earnings growth consistency and low debt profile.",
            "value_score": round(scores.get("value_score", 0), 1),
        },
        "dividend": {
            "next_dividend_date": raw["fundamental"].get("next_dividend_date"),
            "annual_dividend_per_share": raw["fundamental"].get("annual_dividend_per_share"),
            "dividend_safety_score": round(scores.get("dividend_score", 0), 0),
            "dividend_growth_rate_5y": raw["fundamental"].get("dividend_growth_5y"),
            "dividend_yield_pct": round((raw["fundamental"].get("dividend_yield") or 0) * 100, 2),
        },
        "reversal": {
            "is_oversold":        (tech.get("rsi_14") or 50) < 30,
            "bullish_divergence": tech.get("macd_crossover") == "bullish",
            "support_level":      tech.get("52w_low"),
            "high_risk":          True,
        },
        "news": news[:5], # Last 5 items
        "insider_activity": insider,
        "sector_context": {
            "sector_etf":           etf,
            "sector_performance_5d": sec5d,
            "stock_vs_sector_20d":   None,
            "sector_rank":          None,
        },
        "ai_summary": ai_summary,
        "quick_view": {
            "signal_badge": scores.get("signal_type", "NEUTRAL").replace("_", " "),
            "score_bar":    round(scores.get("master_score", 0)),
            "price_change_display": f"{raw['price'].get('change_pct', 0):+.2f}%",
            "key_metrics": {
                "RSI":    tech.get("rsi_14"),
                "MACD":   tech.get("macd_crossover", "neutral").capitalize(),
                "Volume": "Above avg" if (tech.get("rvol") or 1) >= 1.2 else "Normal",
                "Trend":  "Uptrend" if tech.get("ema_stack_bullish") else "Mixed",
            },
        },
    }


def save_json(path: str, data: Any):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


# ============================================================
# 10. TRANSFER SYSTEM
# ============================================================

def transfer_to_latest(date_dir: str):
    """Copy today's data to transfer/latest/ (overwrite)."""
    latest = TRANSFER_LATEST
    os.makedirs(latest, exist_ok=True)
    for fname in ["master.json", "sectors.json", "all_tickers_list.json"]:
        src = os.path.join(date_dir, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(latest, fname))
    stocks_src = os.path.join(date_dir, "stocks")
    stocks_dst = os.path.join(latest, "stocks")
    if os.path.exists(stocks_dst): shutil.rmtree(stocks_dst)
    if os.path.exists(stocks_src): shutil.copytree(stocks_src, stocks_dst)
    log.info(f"Transferred to {latest}")


def archive_date(date_dir: str, date_str: str):
    """Zip today's data into transfer/archive/YYYY-MM-DD.zip."""
    os.makedirs(TRANSFER_ARCHIVE, exist_ok=True)
    zip_path = os.path.join(TRANSFER_ARCHIVE, f"{date_str}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(date_dir):
            for file in files:
                fp = os.path.join(root, file)
                zf.write(fp, os.path.relpath(fp, date_dir))
    log.info(f"Archived: {zip_path}")


# ============================================================
# 10. NOTIFICATION TRIGGERS
# ============================================================

def compute_daily_alerts(all_stocks_data: List[Dict], last_master: Optional[Dict]) -> List[Dict]:
    """Detect triggers for notifications based on 13.3 spec."""
    alerts = []
    
    # Map yesterday's data by ticker for easy lookup
    yesterday_map = {}
    if last_master and "menus" in last_master:
        # We also need previous scores. Since master.json doesn't have all scores, 
        # normally we'd load individual JSONs, but for performance let's assume 
        # we only have master_score and signal_type in top_3 or similar.
        # Actually, let's keep it simple: we compare against what we have.
        pass

    for s in all_stocks_data:
        ticker = s["ticker"]
        scores = s["scores"]
        tech   = s["_tech"]
        
        # 1. STRONG_BUY or STRONG_SELL
        if scores["signal_type"] in ["STRONG_BUY", "STRONG_SELL"]:
            alerts.append({
                "ticker": ticker,
                "type": "CONVICTION_SIGNAL",
                "message": f"{ticker} received a {scores['signal_type']} signal today.",
                "severity": "CRITICAL"
            })
            
        # 2. BB Squeeze (breakout imminent)
        if tech.get("bb_squeeze_intensity") == "HIGH":
            alerts.append({
                "ticker": ticker,
                "type": "BREAKOUT_IMMINENT",
                "message": f"BB Squeeze detected for {ticker}. Volatility breakout imminent.",
                "severity": "HIGH"
            })
            
        # Note: Score change and New Category require historical data from previous run's files.
        # This implementation will be fully functional when actual yesterday's JSON is loaded.

    return alerts


# ============================================================
# 11. MAIN DAILY RUN
# ============================================================

async def daily_run():
    run_start = time.perf_counter()
    date_str  = datetime.now(NY_TZ).strftime("%Y-%m-%d")
    date_dir  = os.path.join(DATA_DIR, date_str)
    stocks_dir = os.path.join(date_dir, "stocks")
    os.makedirs(stocks_dir, exist_ok=True)

    log.info("=" * 60)
    log.info(f"FinMA Daily 100 — Run started: {date_str}")
    log.info("=" * 60)

    # 0. Load universe
    universe = await load_universe()
    log.info(f"Universe: {len(universe)} tickers")

    # 1. Sector ETF performance
    log.info("Fetching sector ETF performance...")
    sector_perf = await compute_sector_performance(universe)

    # 2. Fetch market index data
    log.info("Fetching index data...")
    market_indices = {}
    for name, sym in INDEX_TICKERS.items():
        try:
            h = await asyncio.to_thread(lambda s=sym: yf.Ticker(s).history(period="5d", interval="1d"))
            if h is not None and len(h) >= 2:
                val = float(h["Close"].iloc[-1])
                chg = round((val - float(h["Close"].iloc[-2])) / float(h["Close"].iloc[-2]) * 100, 2)
                market_indices[name] = {"value": round(val, 2), "change_pct": chg}
        except: pass

    # Determine market regime
    sp_chg = market_indices.get("SP500", {}).get("change_pct", 0)
    regime = "Bull" if sp_chg > MARKET_REGIME_THRESHOLDS["BULL"] * 100 else \
             "Bear" if sp_chg < MARKET_REGIME_THRESHOLDS["BEAR"] * 100 else "Neutral"
    log.info(f"Market regime: {regime}")

    # 3. Process each ticker
    all_raw: List[Dict] = []
    all_tech: Dict[str, Dict] = {}

    log.info("Processing tickers...")
    async with aiohttp.ClientSession() as session:
        for i, ticker in enumerate(universe):
            log.info(f"  [{i+1}/{len(universe)}] {ticker}")
            raw = await asyncio.to_thread(fetch_ticker_data, ticker)
            if not raw:
                log.warning(f"  Skipped {ticker} — no data")
                continue

            tech = compute_technicals(raw["hist"], ticker)
            all_tech[ticker] = tech
            raw["_tech"] = tech

            # News (async)
            news = await fetch_news(session, ticker)
            raw["_news"] = news

            all_raw.append(raw)
            await asyncio.sleep(0.2)  # gentle rate limit

    log.info(f"Data fetched for {len(all_raw)} / {len(universe)} tickers")

    # 4. Sector PE medians (for fundamental scoring)
    sector_pe: Dict[str, float] = {}
    for sec in TICKER_SECTOR_MAP.values():
        pes = [r["fundamental"]["pe_ratio"] for r in all_raw
               if r.get("sector") == sec and r["fundamental"].get("pe_ratio")]
        if pes:
            sector_pe[sec] = float(np.median(pes))
    for raw in all_raw:
        raw["fundamental"]["sector_pe_median"] = sector_pe.get(raw.get("sector", ""), None)

    # 5. Compute scores (first pass — no sector_score yet)
    all_scores_first: Dict[str, Dict] = {}
    for raw in all_raw:
        tech = raw["_tech"]
        fund = raw["fundamental"]
        ts = score_technical(tech, fund)
        fs = score_fundamental(fund)
        ms = score_momentum(tech)
        ss = score_sentiment(fund)
        all_scores_first[raw["ticker"]] = {
            "technical_score": round(ts, 1),
            "fundamental_score": round(fs, 1),
            "momentum_score": round(ms, 1),
            "sentiment_score": round(ss, 1),
        }

    # Sector avg scores
    sector_avgs: Dict[str, Dict] = {}
    for sec in set(TICKER_SECTOR_MAP.values()):
        sec_scores = [v["technical_score"] for t, v in all_scores_first.items()
                      if TICKER_SECTOR_MAP.get(t) == sec]
        sector_avgs[sec] = {"avg_score": round(sum(sec_scores)/len(sec_scores), 1) if sec_scores else 50.0}

    # 6. Final score pass with sector score
    all_stocks_data: List[Dict] = []
    for raw in all_raw:
        ticker = raw["ticker"]
        tech   = raw["_tech"]
        fund   = raw["fundamental"]
        first  = all_scores_first[ticker]
        ts = first["technical_score"]
        fs = first["fundamental_score"]
        ms = first["momentum_score"]
        ss = first["sentiment_score"]
        sects = score_sector(ticker, sector_avgs)

        master = compute_master_score(ts, fs, ms, ss, sects)
        conf   = round(master / 100, 2)
        sig    = signal_type_from_confidence(conf)

        bs = score_breakout(tech, raw["price"])
        vs = score_value(fund)
        rs = score_reversal(tech)
        mom_cat = score_momentum_cat(tech, fund)
        ds = score_dividend(fund)

        scores = {
            "master_score":     master,
            "technical_score":  ts,
            "fundamental_score": fs,
            "momentum_score":   ms,
            "sentiment_score":  ss,
            "sector_score":     round(sects, 1),
            "breakout_score":   round(bs, 1),
            "value_score":      round(vs, 1),
            "reversal_score":   round(rs, 1),
            "momentum_cat_score": round(mom_cat, 1),
            "dividend_score":   round(ds, 1),
            "signal_score":     master,
            "confidence":       conf,
            "signal_type":      sig,
        }
        all_stocks_data.append({**raw, "scores": scores})

    log.info("Scores computed for all tickers")

    # 7. Build menus
    menus = build_menus(all_stocks_data)
    log.info("Menus built: " + ", ".join(f"{k}={v['count']}" for k, v in menus.items()))

    # 8. Top 3 overall
    top3 = sorted(all_stocks_data, key=lambda x: x["scores"]["master_score"], reverse=True)[:3]
    top3_out = [{"ticker": s["ticker"], "score": s["scores"]["master_score"],
                 "signal": s["scores"]["signal_type"]} for s in top3]

    # 9. Sector summary
    sector_summary = compute_sector_summary(all_stocks_data)

    # 10. AI summaries (only for tickers in any menu)
    menu_tickers = set()
    for m in menus.values(): menu_tickers.update(m["tickers"])
    
    last_master = get_last_run_data()
    ai_summaries = {}
    stocks_to_generate = []

    # Caching check
    for s in all_stocks_data:
        ticker = s["ticker"]
        if ticker not in menu_tickers:
            continue
            
        today_score = s["scores"]["master_score"]
        cached_summary = None
        
        # Check if we can reuse yesterday's summary
        if last_master:
            # We need to load individual stock JSON since master doesn't store summaries
            prev_stock_path = os.path.join(DATA_DIR, last_master["date"], "stocks", f"{ticker}.json")
            if os.path.exists(prev_stock_path):
                try:
                   with open(prev_stock_path, "r") as f:
                       prev_data = json.load(f)
                       prev_score = prev_data.get("scores", {}).get("master_score", 0)
                       if abs(today_score - prev_score) <= 5.0:
                           cached_summary = prev_data.get("ai_summary")
                except: pass

        if cached_summary:
            ai_summaries[ticker] = cached_summary
            log.info(f"Using cached AI summary for {ticker} (Score Δ <= 5)")
        else:
            stocks_to_generate.append({
                "ticker": ticker, "company": s.get("company", s["ticker"]),
                "sector": s.get("sector", ""), "date": date_str,
                "price": s["price"], "technical": s["_tech"],
                "fundamental": s["fundamental"], "scores": s["scores"],
            })

    if stocks_to_generate:
        log.info(f"Generating new AI summaries for {len(stocks_to_generate)} stocks...")
        new_summaries = await generate_ai_summaries(stocks_to_generate)
        ai_summaries.update(new_summaries)
    else:
        log.info("All AI summaries retrieved from cache.")

    # 11. Insider activity
    log.info("Fetching insider activity...")
    insider_cache: Dict[str, Dict] = {}
    for s in all_stocks_data:
        insider_cache[s["ticker"]] = await asyncio.to_thread(
            fetch_insider_activity, s["ticker"]
        )

    # 12. Generate individual JSON files
    log.info("Writing individual stock JSON files...")
    for s in all_stocks_data:
        ticker = s["ticker"]
        signals = build_signal_card(s["scores"]["master_score"], s["_tech"],
                                     s["price"], ticker, [])
        stock_json = build_stock_json(
            raw=s, tech=s["_tech"], scores=s["scores"], signals=signals,
            news=s.get("_news", []), insider=insider_cache.get(ticker, {}),
            sector_perf=sector_perf, ai_summary=ai_summaries.get(ticker, ""),
            date_str=date_str, menus=menus,
        )
        save_json(os.path.join(stocks_dir, f"{ticker}.json"), stock_json)

    # 13. master.json
    unique_active_tickers = set()
    for m in menus.values(): 
        unique_active_tickers.update(m.get("tickers", []))
    active_signals = len(unique_active_tickers)

    master_json = {
        "date":                  date_str,
        "generated_at":          datetime.now(NY_TZ).isoformat(),
        "total_tickers_scanned": len(all_stocks_data),
        "active_signals_count":  active_signals,
        "market_regime":         regime,
        "menus":                 menus,
        "sector_summary":        sector_summary,
        "top_3_overall":         top3_out,
        "market_indices":        market_indices,
    }
    save_json(os.path.join(date_dir, "master.json"), master_json)

    # 13.1 alerts.json (New: 13.3 Triggers)
    last_master = get_last_run_data()
    alerts = compute_daily_alerts(all_stocks_data, last_master)
    save_json(os.path.join(date_dir, "alerts.json"), {
        "date": date_str,
        "alerts": alerts,
        "count": len(alerts)
    })
    log.info(f"Alerts generated: {len(alerts)}")

    # 14. sectors.json
    sectors_json = {
        "date": date_str,
        "generated_at": datetime.now(NY_TZ).isoformat(),
        "sectors": sector_summary,
        "etf_performance": sector_perf,
    }
    save_json(os.path.join(date_dir, "sectors.json"), sectors_json)

    # 15. all_tickers_list.json
    tickers_list = {
        "date": date_str,
        "tickers": [
            {
                "ticker":       s["ticker"],
                "company":      s.get("company", s["ticker"]),
                "sector":       s.get("sector", ""),
                "master_score": s["scores"]["master_score"],
                "signal_type":  s["scores"]["signal_type"],
                "price":        s["price"].get("current"),
                "change_pct":   s["price"].get("change_pct"),
                "entry_range_low": s["signals"]["entry_range_low"],
                "entry_range_high": s["signals"]["entry_range_high"],
            }
            for s in sorted(all_stocks_data,
                            key=lambda x: x["scores"]["master_score"], reverse=True)
        ],
    }
    save_json(os.path.join(date_dir, "all_tickers_list.json"), tickers_list)

    # 16. Transfer
    transfer_to_latest(date_dir)
    archive_date(date_dir, date_str)

    elapsed = round(time.perf_counter() - run_start, 1)
    log.info("=" * 60)
    log.info(f"RUN COMPLETE in {elapsed}s")
    log.info(f"  Tickers analyzed : {len(all_stocks_data)}")
    log.info(f"  Active signals   : {active_signals}")
    log.info(f"  AI summaries     : {len(ai_summaries)}")
    log.info(f"  Market regime    : {regime}")
    log.info("=" * 60)


# ============================================================
# 12. SCHEDULER + ENTRY POINT
# ============================================================

def is_time_to_run() -> bool:
    now = datetime.now(NY_TZ)
    return (now.weekday() in WEEKDAY_SET and
            now.hour == DAILY_RUN_HOUR and
            now.minute == DAILY_RUN_MINUTE)


async def scheduler_loop():
    log.info("FinMA Bot scheduler started. Waiting for 09:00 NY...")
    while True:
        if is_time_to_run():
            try:
                await daily_run()
            except Exception as e:
                log.exception(f"daily_run failed: {e}")
            # Sleep 61 seconds to avoid double trigger
            await asyncio.sleep(61)
        await asyncio.sleep(30)


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--run-now":
        # Manual trigger for testing
        log.info("Manual run triggered.")
        asyncio.run(daily_run())
    else:
        asyncio.run(scheduler_loop())
