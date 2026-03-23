"""
Bot 907 — 15-Dakika Detay Tarama Botu
60 hissenin tam teknik analizini ve AI skorunu hesaplar.
stock-analysis sayfası kullanıcı girdiğinde hazır veri sunar.
Schedule: Her 15 dakikada bir
"""
import json
import logging
import os
from datetime import datetime, timezone

import yfinance as yf
import pandas as pd
import numpy as np

logger = logging.getLogger("bot_907_scanner")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT_907] %(levelname)s: %(message)s")

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "output", "detail_scan_907.json")
SWING113_FILE = os.path.join(os.path.dirname(__file__), "output", "swing113_latest.json")
MOVERS_FILE = os.path.join(os.path.dirname(__file__), "output", "movers_901.json")


# ─── Technical Indicators ───

def calc_ema(series, period):
    return series.ewm(span=period, adjust=False).mean()

def calc_rsi(series, period=14):
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1/period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def calc_atr(df, period=14):
    high, low, close = df["High"], df["Low"], df["Close"]
    tr = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()

def calc_adx(df, period=14):
    high, low, close = df["High"], df["Low"], df["Close"]
    plus_dm = high.diff().clip(lower=0)
    minus_dm = (-low.diff()).clip(lower=0)
    atr = calc_atr(df, period)
    plus_di = 100 * calc_ema(plus_dm, period) / atr
    minus_di = 100 * calc_ema(minus_dm, period) / atr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    return calc_ema(dx, period)

def calc_bollinger(series, period=20, std_dev=2):
    mid = series.rolling(period).mean()
    std = series.rolling(period).std()
    return mid + std_dev * std, mid - std_dev * std

def compute_ai_score(rsi, adx, ema_trend, rvol, change_pct):
    """Basit AI skor (0-10 arası)"""
    score = 5.0
    # RSI: 40-60 nötr, <30 veya >70 uç değer
    if rsi < 30: score += 1.5  # Aşırı satım
    elif rsi > 70: score -= 1.0  # Aşırı alım
    elif 45 <= rsi <= 55: score += 0.5  # Nötr iyi
    # ADX: trend gücü
    if adx > 30: score += 1.0
    elif adx < 15: score -= 0.5
    # EMA trend
    if ema_trend == "BULLISH": score += 1.5
    elif ema_trend == "BEARISH": score -= 1.5
    # RVOL
    if rvol > 1.5: score += 0.5
    # Change pct
    if change_pct > 3: score += 0.5
    elif change_pct < -3: score -= 0.5
    return round(max(0.1, min(10.0, score)), 1)


def analyze_stock(ticker: str, source: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        df = t.history(period="3mo", interval="1d")
        if df.empty or len(df) < 20:
            return None

        close = df["Close"]
        price = round(float(close.iloc[-1]), 2)
        prev_close = round(float(close.iloc[-2]), 2) if len(close) >= 2 else price
        change_pct = round(((price - prev_close) / prev_close) * 100, 2) if prev_close else 0

        ema20_s = calc_ema(close, 20)
        ema50_s = calc_ema(close, 50)
        ema200_s = calc_ema(close, 200)
        ema20 = round(float(ema20_s.iloc[-1]), 2)
        ema50 = round(float(ema50_s.iloc[-1]), 2)
        ema200 = round(float(ema200_s.iloc[-1]), 2)

        rsi_val = round(float(calc_rsi(close).iloc[-1]), 1)
        adx_val = round(float(calc_adx(df).iloc[-1]), 1)
        atr_val = calc_atr(df).iloc[-1]
        atr_pct = round((atr_val / price) * 100, 2) if price else 0

        bb_upper, bb_lower = calc_bollinger(close)
        bb_up = round(float(bb_upper.iloc[-1]), 2)
        bb_lo = round(float(bb_lower.iloc[-1]), 2)

        # Support / Resistance (simple 20-day high/low)
        support = round(float(df["Low"].rolling(20).min().iloc[-1]), 2)
        resistance = round(float(df["High"].rolling(20).max().iloc[-1]), 2)

        # Volume RVOL
        vol_20avg = df["Volume"].rolling(20).mean().iloc[-1]
        vol_today = df["Volume"].iloc[-1]
        rvol = round(vol_today / vol_20avg, 2) if vol_20avg > 0 else 1.0

        # EMA Trend
        if price > ema20 > ema50: ema_trend = "BULLISH"
        elif price < ema20 < ema50: ema_trend = "BEARISH"
        else: ema_trend = "NEUTRAL"

        risk = "HIGH" if adx_val > 35 or atr_pct > 3 else "MEDIUM" if adx_val > 20 else "LOW"
        ai_score = compute_ai_score(rsi_val, adx_val, ema_trend, rvol, change_pct)

        # Company info (cached in yfinance)
        info = {}
        try:
            info = t.fast_info or {}
        except:
            pass

        return {
            "ticker": ticker,
            "company_name": "",  # Will be filled from info if available
            "sector": "",
            "price": price,
            "change_pct": change_pct,
            "market_cap": 0,
            "ai_score": ai_score,
            "trend": ema_trend,
            "risk": risk,
            "ema20": ema20,
            "ema50": ema50,
            "ema200": ema200,
            "rsi": rsi_val,
            "adx": adx_val,
            "atr_pct": atr_pct,
            "rvol": rvol,
            "support": support,
            "resistance": resistance,
            "bb_upper": bb_up,
            "bb_lower": bb_lo,
            "source": source,
        }
    except Exception as e:
        logger.warning(f"Error analyzing {ticker}: {e}")
        return None


def load_swing113_tickers():
    results = []
    try:
        if os.path.exists(SWING113_FILE):
            with open(SWING113_FILE) as f:
                data = json.load(f)
            for opp in data.get("opportunities", [])[:10]:
                results.append((opp["ticker"], "swing113"))
    except Exception as e:
        logger.warning(f"swing113 load error: {e}")
    return results


def load_movers_tickers():
    results = []
    try:
        if os.path.exists(MOVERS_FILE):
            with open(MOVERS_FILE) as f:
                data = json.load(f)
            for m in data.get("gainers", [])[:17]:
                results.append((m["symbol"], "gainer"))
            for m in data.get("losers", [])[:17]:
                results.append((m["symbol"], "loser"))
            for m in data.get("volume", [])[:16]:
                results.append((m["symbol"], "volume"))
    except Exception as e:
        logger.warning(f"movers load error: {e}")
    return results


def run():
    logger.info("Bot 907 — Detail Scanner starting...")
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    swing113 = load_swing113_tickers()
    movers = load_movers_tickers()

    # Deduplicate: swing113 öncelikli, max 60
    seen = set()
    all_tasks = []
    for ticker, source in swing113 + movers:
        if ticker not in seen:
            seen.add(ticker)
            all_tasks.append((ticker, source))
    all_tasks = all_tasks[:60]

    logger.info(f"Analyzing {len(all_tasks)} stocks...")
    stocks = []
    for ticker, source in all_tasks:
        result = analyze_stock(ticker, source)
        if result:
            stocks.append(result)

    output = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(stocks),
        "stocks": stocks,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f)

    logger.info(f"Bot 907 — Analysis complete: {len(stocks)} stocks saved")


if __name__ == "__main__":
    run()
