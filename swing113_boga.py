"""
================================================================
🐂 BOGA AI SWING TRADE MODEL — V113.1 (Stability Patch)
================================================================
Patched version focused on consistency and realistic targets.

🔧 FIXES APPLIED IN V113.1:
  1. Price filter: $5–$1000 → $10–$250 (sweet spot for swing capital)
  2. RSI floor 38 → 45 / ceiling 78 → 72 (no weak/exhausted entries)
  3. R/R minimum 1.0 → 1.5 (real swing setups, not gamble)
  4. Entry Zone: now DYNAMIC by signal type — breakout/BOS uses
     current_price (no longer waits forever at distant support)
  5. TP ATR multiplier 2.5+1.0m → 1.6+0.4m (realistic %8–15 targets,
     hit within actual hold window — replaces fantasy %20–25 ceiling)
  6. Hold-time band 3–15 days → 3–10 days (true swing, not position)
  7. Layer 2 filter tightened: must be above EMA50 + EMA200,
     CMF non-negative, RSI ≥45, ADX ≥18, 5+ green candles in 10D,
     RVOL ≥1.05 — kills sideways/flat tape candidates
  8. detect_rising_stock: requires +2% 10D return floor
     (no more "rising swing-lows but flat price" picks)
  9. Universe: ROC5 floor lifted from −5% → 0% (no falling knives)
 10. holding_period replaced with tracker_logic block — frontend
     Smart Tracker now has profit_target/stop/entry to drive live
     status changes (PEAK_PROFIT_REACHED / STOPPED_OUT / IN_ENTRY_ZONE)
 11. yfinance retry+backoff layer; Polygon/Alpaca migration scaffold
 12. Bonus: fixed two pre-existing parse-breaking bugs in original
     (broken `if` block in churn-detection, broken closing quote
     in telegram report block — both would crash production runs)

ARCHITECTURE (unchanged):
  LAYER 1 → Global universe weekly scan → most liquid 500 stocks
  LAYER 2 → 1D data for 500 stocks is fetched, momentum + trend
             at least 50 candidates are selected
  LAYER 3 → Deep analysis for 50 candidates (1H S/R + ATR zones)
  LAYER 4 → Top 5 stocks scored out of 100
  LAYER 5 → Summaries generated with Gemini AI in multiple languages
  OUTPUT  → Saved in JSON format + Telegram notification
================================================================
"""

import json
import asyncio
import logging
import time
import math
import html
import re
import os
import random
import aiohttp
import pandas as pd
import numpy as np
import yfinance as yf

from datetime import datetime, timedelta, time as dtime, timezone
from typing import List, Dict, Any, Optional, Literal
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

from ta.volatility import AverageTrueRange, BollingerBands
from ta.trend import EMAIndicator, ADXIndicator, MACD
from ta.volume import OnBalanceVolumeIndicator
from ta.momentum import RSIIndicator

# ================================================================
# 🔹 DATA PROVIDER CONFIG  (🔧 FIX #11)
# ================================================================
# yfinance is the current default (free, but rate-limited and prone
# to stale/missing data — known cause of "entry zone never hit"
# false-negatives because the 1H bar is delayed 15-20 min).
#
# To migrate to Polygon.io / Alpaca:
#   1. Set DATA_PROVIDER = "polygon" or "alpaca"
#   2. Fill in the API keys below
#   3. Implement the corresponding branch in get_stock_data()
# Until those branches are implemented the bot stays on yfinance with
# 3-attempt retry + backoff — already a big stability improvement.
DATA_PROVIDER = "yfinance"   # options: "yfinance" | "polygon" | "alpaca"
POLYGON_API_KEY = ""          # paste key here when migrating
ALPACA_API_KEY = ""
ALPACA_SECRET_KEY = ""
ALPACA_BASE_URL = "https://data.alpaca.markets/v2"

# ================================================================
# 🔹 LOGGING
# ================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# ================================================================
# 🔹 TIME & SCHEDULER
# ================================================================
NY_TZ = ZoneInfo("America/New_York")
WEEKDAY_SET = {0, 1, 2, 3, 4}

# Weekly universe scan (Monday 09:00 NY)
WEEKLY_SCAN_DAY = 0       # 0 = Monday
WEEKLY_SCAN_HOUR = 9
WEEKLY_SCAN_MINUTE = 0

# Daily selection scan (Every day 09:00 NY)
DAILY_RUN_HOUR = 9
DAILY_RUN_MINUTE = 0

# ================================================================
# 🔹 CACHE & FILE SETTINGS
# ================================================================
UNIVERSE_TTL = 7 * 24 * 3600        # Weekly universe update (168 hours)
UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}
BULK_DATA_CACHE: Dict[str, pd.DataFrame] = {}
index_cache: Dict[str, pd.Series] = {}
alpha_vantage_cache: Dict[str, dict] = {}
# 5Y performance data — cached per scan to prevent 500+ API calls
LONG_HISTORY_CACHE: Dict[str, Dict[str, float]] = {}
LONG_HISTORY_TTL = 12 * 3600  # 12 hours

WATCHLIST_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists"
INFO_CACHE_FILE = os.path.join(WATCHLIST_DIR, "persistent_info_cache.json")
WATCHLIST_KEEP_DAYS = 180
WATCHLIST_MAX_ROLLING = 6000

# JSON File Names (For frontend integration)
OUTPUT_JSON_FILE = "swing_picks.json"
OUTPUT_ALL_JSON_FILE = "swing_all_picks.json"

# ================================================================
# 🔹 UNIVERSE AND FILTER PARAMETERS
# ================================================================
MAX_TICKERS_FINAL = 500          # Layer 1: Most liquid 500 stocks
TOP_DEEP_ANALYSIS = 50           # Layer 3: Number of stocks for deep analysis
TOP_FINAL_PICKS = 5             # Final BOGA AI selection count

# 🔧 FIX #1: Price filter aligned with swing strategy ($10-$250 sweet spot)
# Below $10: penny stock noise; Above $250: ATR-based zone math becomes dollar-heavy
# and the price targets become unrealistic for swing trading capital efficiency.
PRICE_MIN = 10.0
PRICE_MAX = 250.0
ATMACA_MIN_MARKET_CAP = 500_000_000   # 🔧 FIX: 300M → 500M (more institutional follow-through)
ATMACA_MIN_AVG_VOLUME = 750_000        # 🔧 FIX: 500K → 750K (better fill quality)
ATMACA_MIN_DOLLAR_VOLUME = 10_000_000  # 🔧 FIX: 5M → 10M ($ volume is the real liquidity)
ATMACA_MIN_BETA = 0.6
ATMACA_MAX_BETA = 3.0

ATR_PERIOD = 14
ATR_MIN_PCT_1H = 0.025
ATR_MAX_PCT_1H = 0.25

ADX_MIN_LEVEL_1D = 18
OBV_TREND_DAYS = 10
VOLUME_INCREASE_LOOKBACK = 5

RSI_MIN_SWING = 45  # 🔧 FIX: 38 → 45 (38 ve altı güçsüz / aşağı yönlü hisse demek; swing için minimum 45)
RSI_MAX_SWING = 72  # 🔧 FIX: 78 → 72 (78 yorgun zone; tepe almak istemeyiz)

MIN_RR_RATIO = 1.5         # 🔧 FIX: 1.2 → 1.5 (gerçekçi swing min)
MIN_RR_RATIO_RELAXED = 1.8  # 🔧 FIX: 1.3 → 1.8 (entry trigger varsa biraz esnek)

LOOKBACK_DAYS = 200
INDEX_BENCHMARK = "^GSPC"
MAX_PER_SECTOR = 6
RS_LOOKBACK = 30

# ================================================================
# 🔹 TELEGRAM SETTINGS
# ================================================================
TELEGRAM_API_KEY = "8182098187:AAF-jtWMJK07ZdZdyusiE1RqyQkwegb0Uhc"
TELEGRAM_CHAT_ID = "-1003406973271"
ENABLE_TELEGRAM_NOTIFICATIONS = True

# ================================================================
# 🔹 ALPHA VANTAGE
# ================================================================
ENABLE_ALPHA_VALIDATION = False
ALPHA_VALIDATION_THRESHOLD = 24.0
ALPHA_VANTAGE_API_KEY = "8S8ZRE3EPTKH0EPJ"

# ================================================================
# 🔹 GEMINI AI
# ================================================================
GEMINI_API_KEY = "AIzaSyA6cu1eE5xyh2-1eEFEdZcMXY7MSzqIPnM"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# ================================================================
# 🔹 SECTOR ETF MAP
# ================================================================
SECTOR_ETF_MAP = {
    "Technology": "XLK",
    "Energy": "XLE",
    "Financial Services": "XLF", "Financials": "XLF",
    "Healthcare": "XLV",
    "Consumer Cyclical": "XLY", "Consumer Discretionary": "XLY",
    "Industrials": "XLI",
    "Utilities": "XLU",
    "Basic Materials": "XLB", "Materials": "XLB",
    "Real Estate": "XLRE",
    "Consumer Defensive": "XLP", "Consumer Staples": "XLP",
    "Communication Services": "XLC"
}

# ================================================================
# 🔹 GLOBAL STATE VARIABLES
# ================================================================
MARKET_STATUS = {"regime": "Bull", "min_score_modifier": 0.0}
SECTOR_PERFORMANCE: Dict[str, float] = {}
sector_map: Dict[str, str] = {}
EXCLUDED_STOCKS: set = set()

# ================================================================
# 🔹 EXCHANGE SOURCES
# ================================================================
EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# ================================================================
# 🔹 COMPANY DATABASE (Fast access for known major stocks)
# ================================================================
COMPANY_DATABASE = {
    "AAPL": {"name": "Apple Inc", "exchange": "NASDAQ", "sector": "Technology"},
    "MSFT": {"name": "Microsoft Corp", "exchange": "NASDAQ", "sector": "Technology"},
    "NVDA": {"name": "NVIDIA Corp", "exchange": "NASDAQ", "sector": "Technology"},
    "TSLA": {"name": "Tesla Inc", "exchange": "NASDAQ", "sector": "Consumer Cyclical"},
    "AMZN": {"name": "Amazon.com Inc", "exchange": "NASDAQ", "sector": "Consumer Cyclical"},
    "GOOGL": {"name": "Alphabet Inc", "exchange": "NASDAQ", "sector": "Communication Services"},
    "META": {"name": "Meta Platforms", "exchange": "NASDAQ", "sector": "Communication Services"},
    "JPM": {"name": "JPMorgan Chase", "exchange": "NYSE", "sector": "Financial Services"},
    "CAT": {"name": "Caterpillar Inc", "exchange": "NYSE", "sector": "Industrials"},
}

# ================================================================
# 🔹 PERSISTENT INFO CACHE
# ================================================================
persistent_info_cache: Dict[str, dict] = {}

def load_info_cache():
    global persistent_info_cache
    try:
        if os.path.exists(INFO_CACHE_FILE):
            with open(INFO_CACHE_FILE, "r", encoding="utf-8") as f:
                persistent_info_cache = json.load(f)
            logging.info(f"📦 Persistent Cache: {len(persistent_info_cache)} stocks loaded.")
    except Exception as e:
        logging.warning(f"⚠️ Cache load error: {e}")

def save_info_cache():
    try:
        os.makedirs(WATCHLIST_DIR, exist_ok=True)
        with open(INFO_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(persistent_info_cache, f, indent=2)
    except Exception as e:
        logging.warning(f"⚠️ Cache save error: {e}")

load_info_cache()

# ================================================================
# ================================================================
# SECTION 1: UNIVERSE CREATION (LAYER 1 — WEEKLY)
# ================================================================
# ================================================================

async def fetch_all_us_tickers() -> List[str]:
    """Fetches NASDAQ, NYSE, AMEX symbols. Only 1-5 letter stocks."""
    all_tickers: set = set()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    async with aiohttp.ClientSession() as session:
        for url in EXCHANGE_SOURCES:
            try:
                async with session.get(url, headers=headers, timeout=15) as resp:
                    if resp.status != 200:
                        continue
                    content = await resp.text()
                    for sym in content.splitlines():
                        sym = sym.strip().upper()
                        if sym.isalpha() and 1 <= len(sym) <= 5:
                            all_tickers.add(sym)
            except Exception as e:
                logging.error(f"⚠️ Ticker list error ({url}): {e}")

    logging.info(f"✅ Raw symbol count: {len(all_tickers)}")
    return list(all_tickers)

# ================================================================
# 🛡️ ANTI-REPETITION MODULE (Block those selected in the last 10 days)
# ================================================================
async def get_recently_picked_tickers(days=10) -> set:
    """
    Lists stocks selected in the last N days to block them.
    Reads files in swing_YYYYMMDD.json format from the SWING2026 year folder.
    """
    recent_tickers = set()
    # ✅ FIX 1: Use absolute path
    base_data_dir = r"C:\Users\afksm\finma\frontend\public\data"
    current_year = datetime.now(NY_TZ).strftime("%Y")
    swing_year_dir = os.path.join(base_data_dir, f"swing{current_year}")

    if not os.path.exists(swing_year_dir):
        logging.warning(f"⚠️ Archive folder not found: {swing_year_dir}")
        return recent_tickers

    try:
        # ✅ FIX 2: Scan swing_YYYYMMDD.json files
        all_files = [f for f in os.listdir(swing_year_dir) if f.startswith("swing_") and f.endswith(".json")]
        all_files.sort(reverse=True)  # Newest file first

        # Select up to 'days' files
        target_files = all_files[:days]

        for file_name in target_files:
            file_path = os.path.join(swing_year_dir, file_name)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    day_data = json.load(f)
                    for pick in day_data.get("picks", []):
                        ticker = pick.get("ticker")
                        if ticker:
                            recent_tickers.add(ticker)
            except Exception as e:
                logging.warning(f"⚠️ Error reading {file_name}: {e}")

        if recent_tickers:
            logging.info(f"🚫 Stocks selected and blocked in the last {days} days ({len(recent_tickers)}): {sorted(recent_tickers)}")
        else:
            logging.info(f"ℹ️ No stocks selected in the last {days} days (first scan?)")
    except Exception as e:
        logging.error(f"❌ Error reading past selections: {e}")

    return recent_tickers
    
async def build_atmaca_universe_full() -> List[str]:
    """
    LAYER 1 — Weekly Universe Creation (Most Liquid 500 Stocks)

    PHASE 1: Fetch all US stocks
    PHASE 2: Download bulk OHLCV, filter vectorially
    PHASE 3: RVOL × DollarVolume ranking → Top 500
    """
    now = time.time()
    
    # In-memory check
    if UNIVERSE_CACHE["data"] and (now - UNIVERSE_CACHE["ts"]) < UNIVERSE_TTL:
        return UNIVERSE_CACHE["data"]

    # Disk check
    if os.path.exists("boga_universe.txt"):
        mtime = os.path.getmtime("boga_universe.txt")
        if (now - mtime) < UNIVERSE_TTL:
            try:
                with open("boga_universe.txt", "r") as f:
                    data_list = [l.strip() for l in f if l.strip()]
                    if data_list:
                        logging.info(f"📁 Disk Cache Loaded: {len(data_list)} stocks. Data is being downloaded...")
                        # ⚠️ CRITICAL FIX: Fill the cache with 1D data of stocks loaded from disk!
                        # Making the period 252d ensures EMA200 and "len < 50" conditions.
                        chunk_size = 100
                        for j in range(0, len(data_list), chunk_size):
                            chunk = data_list[j : j + chunk_size]
                            downloaded = await asyncio.to_thread(
                                yf.download, chunk, period="252d", interval="1d", progress=False, group_by="ticker", ignore_tz=True
                            )
                            for sym in chunk:
                                if sym in downloaded and not downloaded[sym].empty:
                                    BULK_DATA_CACHE[sym] = downloaded[sym].copy()
                        
                        UNIVERSE_CACHE["ts"] = mtime
                        UNIVERSE_CACHE["data"] = data_list
                        return data_list
            except Exception as e:
                logging.error(f"⚠️ Disk cache yükleme/indirme hatası: {e}")

    raw_list = await fetch_all_us_tickers()
    if not raw_list:
        logging.error("❌ Ticker list could not be retrieved.")
        return []

    logging.info(f"🚀 Bulk download starting for {len(raw_list)} stocks (chunk=1000, period=35d)...")

    CHUNK = 200
    PERIOD = "252d"
    all_rows: list = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"📥 Downloading: {i}–{i + len(chunk)} ...")
        try:
            data = await asyncio.to_thread(
                yf.download, chunk, period=PERIOD, interval="1d",
                progress=False, threads=True, ignore_tz=True, group_by="ticker"
            )

            if not isinstance(data.columns, pd.MultiIndex):
                if len(chunk) == 1:
                    sym = chunk[0]
                    data.columns = pd.MultiIndex.from_tuples([(sym, c) for c in data.columns])
                else:
                    continue

            tickers_in_data = data.columns.get_level_values(0).unique().tolist()

            for sym in tickers_in_data:
                try:
                    close  = data[sym]["Close"].dropna()
                    volume = data[sym]["Volume"].dropna()

                    if len(close) < 6 or len(volume) < 6:
                        continue

                    last_price = float(close.iloc[-1])
                    avg_vol_10 = float(volume.tail(10).mean())
                    avg_vol_5  = float(volume.tail(5).mean())
                    avg_vol_30 = float(volume.tail(30).mean()) if len(volume) >= 30 else avg_vol_10
                    dollar_vol = last_price * avg_vol_10

                    if not (PRICE_MIN <= last_price <= PRICE_MAX):
                        continue
                    if avg_vol_10 < ATMACA_MIN_AVG_VOLUME:
                        continue
                    if dollar_vol < ATMACA_MIN_DOLLAR_VOLUME:
                        continue

                    rvol = (avg_vol_5 / avg_vol_30) if avg_vol_30 > 0 else 0.0
                    # 🔧 FIX #7: 0.5 was too low — sleeping volume = sleeping stock.
                    if rvol < 0.8:
                        continue

                    roc5 = float(
                        (close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]
                    ) if len(close) >= 6 else 0.0
                    # 🔧 FIX: -5% in 5 days = clearly downtrending; we don't catch falling knives.
                    # We want stocks that already moved up at least 0% in last 5 days.
                    if roc5 < 0.0:
                        continue

                    BULK_DATA_CACHE[sym] = data[sym].copy()
                    all_rows.append({
                        "sym": sym, "price": last_price,
                        "dollar_vol": dollar_vol, "rvol": rvol,
                        "roc5": roc5, "rank_score": rvol * dollar_vol,
                    })
                except Exception:
                    continue
        except Exception as e:
            logging.warning(f"⚠️ Chunk {i} error: {e}")
            continue

    if not all_rows:
        logging.error("❌ No stocks left after bulk download.")
        return []

    logging.info(f"⚡ Vector filter: {len(all_rows)} stocks passed.")
    all_rows.sort(key=lambda r: r["rank_score"], reverse=True)
    selected = [r["sym"] for r in all_rows[:MAX_TICKERS_FINAL]]

    logging.info(f"🏆 LAYER 1 complete: {len(selected)} stocks selected.")

    UNIVERSE_CACHE["ts"] = now
    UNIVERSE_CACHE["data"] = selected

    try:
        with open("boga_universe.txt", "w") as f:
            f.write("\n".join(selected))
    except Exception:
        pass

    return selected

# ================================================================
# ================================================================
# SECTION 2: DATA HELPERS
# ================================================================
# ================================================================

def get_stock_data(ticker: str, interval: Literal["1d", "1h"] = "1d") -> Optional[pd.DataFrame]:
    """
    Reads from BULK_DATA_CACHE for 1D (zero network).
    Fetches with yf.Ticker for 1H.

    🔧 FIX #10: yfinance is unreliable in production (rate limits, stale data).
    Added 3-attempt retry with exponential backoff and tighter timeout.
    For full Polygon.io / Alpaca migration, replace the inner block with the
    DATA_PROVIDER switch — see DATA_PROVIDER_CONFIG at the top of the file.
    """
    t = ticker.strip().upper()

    if interval == "1d":
        if t in BULK_DATA_CACHE:
            return BULK_DATA_CACHE[t].copy()
        return None

    # 1H — needs network; use retry + backoff to reduce flaky data
    for attempt in range(3):
        time.sleep(random.uniform(0.15, 0.4) + (attempt * 0.5))
        try:
            stock = yf.Ticker(t)
            df = stock.history(period="7d", interval="1h", auto_adjust=True, timeout=8)
            if df is None or df.empty:
                if attempt < 2:
                    continue
                return None
            df.columns = [c.capitalize() for c in df.columns]
            df = df.dropna()
            if len(df) >= 10:
                return df
        except Exception as e:
            if attempt == 2:
                logging.error(f"❌ {t} (1h) fetch failed after 3 attempts: {e}")
            continue
    return None


def get_stock_info(ticker: str) -> dict:
    """Returns stock info from persistent cache, otherwise fetches from yfinance."""
    t = ticker.strip().upper()
    
    # 1) Cache check
    if t in persistent_info_cache:
        info = persistent_info_cache[t]
        # If critical data is missing, trigger a refresh
        if info.get("market_cap", 0) > 0 and info.get("sector") != "Unknown":
            return info

    # 2) Live Fetch (If not in cache or if data is 0)
    try:
        logging.info(f"🌐 {t} info fetching live...")
        stock = yf.Ticker(t)
        inf = stock.info
        
        # Extract critical data
        processed = {
            "market_cap": inf.get("marketCap", 0),
            "avg_volume": inf.get("averageVolume", 0),
            "beta": inf.get("beta", 1.0),
            "short_float": inf.get("shortPercentOfFloat", 0.0),
            "sector": inf.get("sector", "Unknown"),
            "industry": inf.get("industry", "Unknown"),
            "heldPercentInstitutions": inf.get("heldPercentInstitutions", 0),
            "grossMargins": inf.get("grossMargins", 0),
            "operatingMargins": inf.get("operatingMargins", 0),
            "profitMargins": inf.get("profitMargins", 0),
            "revenueGrowth": inf.get("revenueGrowth", 0),
            "trailingPE": inf.get("trailingPE", 0),
            "priceToBook": inf.get("priceToBook", 0),
            "freeCashflow": inf.get("freeCashflow", 0),
            "recommendationKey": inf.get("recommendationKey", "N/A"),
            "pegRatio": inf.get("pegRatio", 0),
            "companyName": inf.get("longName", t)
        }
        
        # Cache güncelle ve kaydet
        persistent_info_cache[t] = processed
        # Optional: Saving after every fetch puts a load on disk I/O, 
        # but prevents data loss in case of a crash.
        save_info_cache() 
        
        return processed
        
    except Exception as e:
        logging.error(f"⚠️ {t} info fetch error: {e}")
        return {
            "market_cap": 0, "avg_volume": 0, "beta": 1.0,
            "short_float": 0.0, "sector": "Unknown", "heldPercentInstitutions": 0
        }


def get_index_close_series(symbol: str = INDEX_BENCHMARK) -> Optional[pd.Series]:
    """Caches benchmark index closing series."""
    symbol = symbol.upper()
    if symbol in index_cache:
        return index_cache[symbol]
    df_idx = get_stock_data(symbol, interval="1d")
    if df_idx is None or df_idx.empty:
        return None
    index_cache[symbol] = df_idx["Close"]
    return index_cache[symbol]


def calculate_ema_slope(ema_series: pd.Series, periods: int = 10) -> bool:
    if len(ema_series) < periods:
        return False
    recent = ema_series.tail(periods)
    return float(recent.iloc[-1]) > float(recent.iloc[0])

# ================================================================
# ================================================================
# SECTION 3: TECHNICAL HELPER ENGINES
# ================================================================
# ================================================================

def norm_cdf(x: float) -> float:
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0


def calculate_bs_greeks(S, K, t_days, iv, r=0.04):
    if t_days <= 0 or iv <= 0 or K <= 0 or S <= 0:
        return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    t = t_days / 365.0
    sqrt_t = math.sqrt(t)
    d1 = (math.log(S / K) + (r + 0.5 * iv**2) * t) / (iv * sqrt_t)
    d2 = d1 - iv * sqrt_t
    pdf = math.exp(-d1**2 / 2) / math.sqrt(2 * math.pi)
    return {
        "delta": round(norm_cdf(d1), 2),
        "gamma": round(pdf / (S * iv * sqrt_t), 4),
        "theta": round(-(S * pdf * iv) / (2 * sqrt_t) / 365, 4),
        "vega":  round(S * pdf * sqrt_t / 100, 4)
    }


def calculate_ichimoku(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['tenkan'] = (df['High'].rolling(9).max() + df['Low'].rolling(9).min()) / 2
    df['kijun']  = (df['High'].rolling(26).max() + df['Low'].rolling(26).min()) / 2
    df['span_a'] = ((df['tenkan'] + df['kijun']) / 2).shift(26)
    df['span_b'] = ((df['High'].rolling(52).max() + df['Low'].rolling(52).min()) / 2).shift(26)
    df['chikou'] = df['Close'].shift(-26)
    return df


def check_ichimoku_setup(df: pd.DataFrame) -> dict:
    try:
        last = df.iloc[-1]
        price = last['Close']
        cloud_top    = max(last['span_a'], last['span_b'])
        cloud_bottom = min(last['span_a'], last['span_b'])
        if cloud_bottom <= price <= cloud_top and last['tenkan'] > last['kijun']:
            return {'valid': True, 'bonus': 0.8, 'msg': "🟡 Ichimoku: Intra-Cloud Swing Awakening (+0.8)"}
        if price > cloud_top:
            if last['tenkan'] > last['kijun']:
                return {'valid': True, 'bonus': 1.4, 'msg': "✅ Ichimoku: Strong Bullish Continuation (+1.4)"}
            return {'valid': True, 'bonus': 0.6, 'msg': "✅ Ichimoku: Above Cloud (+0.6)"}
        return {'valid': False, 'bonus': 0.0, 'msg': ""}
    except Exception:
        return {'valid': False, 'bonus': 0.0, 'msg': ""}


def check_volume_profile(df: pd.DataFrame) -> dict:
    try:
        data = df.tail(30)
        price_min, price_max = data['Low'].min(), data['High'].max()
        bins = np.linspace(price_min, price_max, 20)
        vol_dist = np.zeros(19)
        for i in range(len(data)):
            row = data.iloc[i]
            for b in range(19):
                if bins[b] <= row['Close'] < bins[b + 1]:
                    vol_dist[b] += row['Volume']
                    break
        max_vol_idx = vol_dist.argmax()
        poc_price = (bins[max_vol_idx] + bins[max_vol_idx + 1]) / 2
        current = df['Close'].iloc[-1]
        dist_pct = (current - poc_price) / poc_price
        if current > poc_price and abs(dist_pct) < 0.04:
            return {'valid': True, 'bonus': 1.2, 'msg': f"🟢 VP: Support Above POC (+{dist_pct*100:.1f}%)"}
        if current > poc_price:
            return {'valid': True, 'bonus': 0.5, 'msg': f"📈 VP: Momentum Above POC (+{dist_pct*100:.1f}%)"}
        return {'valid': False, 'bonus': 0.0, 'msg': "⚠️ VP: Below POC (Resistance Zone)"}
    except Exception:
        return {'valid': False, 'bonus': 0.0, 'msg': ""}


def analyze_smart_money_flow(df_1d: pd.DataFrame, ticker: str, info: dict) -> dict:
    try:
        if len(df_1d) < 20:
            return {'has_smart_flow': False, 'score': 0.0, 'details': []}
        close, high, low, volume = df_1d['Close'], df_1d['High'], df_1d['Low'], df_1d['Volume']
        score, details = 0.0, []

        mf_mult = ((close - low) - (high - close)) / (high - low).replace(0, np.nan)
        mf_mult = mf_mult.fillna(0)
        cmf_val = float((mf_mult * volume).rolling(20).sum().iloc[-1] / volume.rolling(20).sum().iloc[-1])

        if cmf_val > 0.15:
            score += 6.0; details.append(f"💰 Smart Money: Strong Accumulation (CMF: {cmf_val:.2f})")
        elif cmf_val > 0.05:
            score += 3.2; details.append(f"📈 Smart Money: Positive Money Flow (CMF: {cmf_val:.2f})")
        elif cmf_val < -0.10:
            score -= 3.2; details.append(f"⚠️ Smart Money: Institutional Distribution (CMF: {cmf_val:.2f})")

        typical_price = (high + low + close) / 3
        raw_mf = typical_price * volume
        pos_mf = raw_mf.where(typical_price > typical_price.shift(1), 0)
        neg_mf = raw_mf.where(typical_price < typical_price.shift(1), 0)
        mf_ratio = pos_mf.rolling(14).sum() / neg_mf.rolling(14).sum()
        mf_ratio = mf_ratio.replace([np.inf, -np.inf], 100).fillna(50)
        mfi_val = float(100 - 100 / (1 + mf_ratio.iloc[-1]))

        if mfi_val > 60:
            score += 4.0; details.append(f"💚 MFI: Strong Money Flow ({mfi_val:.1f})")
        elif mfi_val < 30:
            score -= 2.0; details.append(f"🔴 MFI: Weak Money Flow ({mfi_val:.1f})")

        return {
            'has_smart_flow': score > 0, 'score': min(score, 12.0),
            'details': details, 'cmf': round(cmf_val, 3), 'mfi': round(mfi_val, 1)
        }
    except Exception:
        return {'has_smart_flow': False, 'score': 0.0, 'details': [], 'cmf': 0.0, 'mfi': 50.0}


def detect_rising_stock(df: pd.DataFrame) -> dict:
    """🔧 FIX #12: A stock with 0% 10-day return that just has rising swing lows
    is NOT rising — it's flatlining. Demand at least +2% over 10 days before
    awarding the 'is_rising' badge. This kills the sideways-listing problem."""
    try:
        close = df['Close']
        volume = df['Volume']
        score, details, pattern = 0.0, [], ""

        if len(close) < 10:
            return {'is_rising': False, 'score': 0.0, 'details': [], 'pattern': ''}

        recent_ret = (close.iloc[-1] - close.iloc[-10]) / close.iloc[-10]

        # 🔧 FIX: Hard floor — anything below +2% in 10 days is not "rising".
        if recent_ret < 0.02:
            return {'is_rising': False, 'score': 0.0, 'details': ['Flat/down 10D return'], 'pattern': ''}

        if recent_ret > 0.10:
            score += 4.0; pattern = "Gaining Momentum"
            details.append(f"🚀 10D Return: +{recent_ret*100:.1f}%")
        elif recent_ret > 0.05:
            score += 2.0; pattern = "Base Breakout"
            details.append(f"📈 10D Return: +{recent_ret*100:.1f}%")
        else:
            score += 1.0; pattern = "Mild Uptrend"
            details.append(f"↗️ 10D Return: +{recent_ret*100:.1f}%")

        swing_lows = []
        for i in range(2, min(15, len(df)) - 2):
            low = df['Low'].iloc[-i]
            if low < df['Low'].iloc[-(i-1)] and low < df['Low'].iloc[-(i+1)]:
                swing_lows.append(low)
        if len(swing_lows) >= 2 and swing_lows[0] > swing_lows[-1]:
            score += 2.0; pattern = pattern or "Pullback Reversal"
            details.append("🔰 Higher Lows: Pullback Reversal")

        return {'is_rising': score > 0, 'score': score, 'details': details, 'pattern': pattern}
    except Exception:
        return {'is_rising': False, 'score': 0.0, 'details': [], 'pattern': ''}


def detect_insider_activity(ticker: str, info: dict) -> dict:
    try:
        stock = yf.Ticker(ticker)
        insider_data = stock.insider_transactions
        if insider_data is None or insider_data.empty:
            return {'has_insider': False, 'score': 0.0, 'details': []}
        recent = insider_data.head(20)
        buy_count = sell_count = executive_buys = 0
        for _, row in recent.iterrows():
            text = str(row.get('Text', '')).lower()
            insider_name = str(row.get('Insider', '')).lower()
            if any(k in text for k in ['purchase', 'buy', 'acquisition']):
                buy_count += 1
                if any(t in insider_name for t in ['ceo', 'cfo', 'cto', 'president', 'director']):
                    executive_buys += 1
            elif any(k in text for k in ['sale', 'sell']):
                sell_count += 1
        score, details = 0.0, []
        if buy_count > sell_count:
            score += 4.0; details.append(f"🏦 Insider Net Buyer ({buy_count}/{sell_count})")
        if executive_buys >= 2:
            score += 6.0; details.append(f"👔 C-Suite Strong Buy ({executive_buys})")
        elif executive_buys >= 1:
            score += 3.2; details.append("👔 C-Suite Buy Signal")
        if buy_count >= 3:
            score += 3.2; details.append(f"🎯 Insider Cluster ({buy_count})")
        return {'has_insider': score > 0, 'score': min(score, 12.0), 'details': details,
                'buy_count': buy_count, 'sell_count': sell_count, 'executive_buys': executive_buys}
    except Exception:
        return {'has_insider': False, 'score': 0.0, 'details': []}


def analyze_financial_health(ticker: str, info: dict) -> dict:
    try:
        score, details = 0.0, []
        gross_margin     = info.get('grossMargins', 0) or 0
        operating_margin = info.get('operatingMargins', 0) or 0
        net_margin       = info.get('profitMargins', 0) or 0
        revenue_growth   = info.get('revenueGrowth', 0) or 0
        debt_to_equity   = info.get('debtToEquity', 0) or 0
        pe_ratio         = info.get('trailingPE', 0) or 0
        pb_ratio         = info.get('priceToBook', 0) or 0
        fcf_yield        = info.get('freeCashflow', 0) or 0
        market_cap       = info.get('marketCap', 0) or 0
        fcf_yield_pct    = (fcf_yield / market_cap * 100) if market_cap > 0 and fcf_yield > 0 else 0.0

        if gross_margin > 0.35:
            score += 2.0; details.append(f"💎 Gross Margin: {gross_margin*100:.1f}% (Strong)")
        if operating_margin > 0.15:
            score += 2.0; details.append(f"📊 Operating Margin: {operating_margin*100:.1f}% (Strong)")
        if net_margin > 0.10:
            score += 2.0; details.append(f"💰 Net Margin: {net_margin*100:.1f}% (Healthy)")
        if revenue_growth > 0.10:
            score += 3.0; details.append(f"🚀 Revenue Growth: {revenue_growth*100:.1f}% (Good)")
        elif revenue_growth > 0.05:
            score += 1.5; details.append(f"📈 Revenue Growth: {revenue_growth*100:.1f}%")
        if 0 < debt_to_equity < 1.5:
            score += 1.5; details.append(f"🟢 D/E: {debt_to_equity:.2f} (Healthy)")
        if fcf_yield_pct > 3.0:
            score += 2.0; details.append(f"💸 FCF Yield: {fcf_yield_pct:.1f}% (Strong)")

        return {
            'health_score': min(score, 15.0), 'details': details,
            'gross_margin': round(gross_margin * 100, 2),
            'operating_margin': round(operating_margin * 100, 2),
            'net_margin': round(net_margin * 100, 2),
            'revenue_growth': round(revenue_growth * 100, 2),
            'pe_ratio': round(pe_ratio, 1),
            'pb_ratio': round(pb_ratio, 2),
            'fcf_yield': round(fcf_yield_pct, 2),
            'market_cap_b': round(market_cap / 1e9, 2) if market_cap > 0 else 0.0
        }
    except Exception:
        return {'health_score': 0.0, 'details': []}


def check_silent_catalysts(ticker: str, info: dict) -> dict:
    catalysts, score = [], 0.0
    short_pct = info.get('shortPercentOfFloat', 0) or 0
    if short_pct > 0.20:
        catalysts.append(f"⚡ Short Float: %{short_pct*100:.1f}"); score += 1.0
    inst_pct = info.get('heldPercentInstitutions', 0) or 0
    if inst_pct > 0.80:
        catalysts.append(f"🏛️ Institutional: %{inst_pct*100:.0f}"); score += 0.8
    elif inst_pct > 0.60:
        catalysts.append(f"🏦 Institutional: %{inst_pct*100:.0f}"); score += 0.3
    rec = str(info.get('recommendationKey', '')).lower()
    if 'strong_buy' in rec:
        catalysts.append("📈 Analyst: Strong Buy"); score += 0.8
    elif 'buy' in rec:
        catalysts.append("📈 Analyst: Buy"); score += 0.4
    peg = info.get('pegRatio', 0) or 0
    if 0 < peg < 1.5:
        catalysts.append(f"💎 PEG: {peg:.1f} (Cheap Growth)"); score += 0.5
    return {'has_catalyst': len(catalysts) > 0, 'score': min(score, 14.0), 'reasons': catalysts}


async def check_legal_risk_live(ticker: str) -> dict:
    keywords = ['class action', 'lawsuit', 'sec investigation', 'fraud', 'shareholder rights']
    url = f"https://finance.yahoo.com/quote/{ticker}/press-releases"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5) as resp:
                if resp.status == 200:
                    text = (await resp.text()).lower()
                    for kw in keywords:
                        if kw in text and text.find(kw) < 5000:
                            return {'has_risk': True, 'penalty': 5.0, 'msg': f"⚠️ LEGAL RISK: '{kw}'"}
    except Exception:
        pass
    return {'has_risk': False, 'penalty': 0.0, 'msg': ""}


async def analyze_options_sentiment(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        exp_dates = await asyncio.to_thread(lambda: stock.options)
        if not exp_dates:
            return {'bullish': False, 'score': 0.0, 'details': [], 'pcr': "N/A"}

        now_date = datetime.now(NY_TZ).date()
        target_date = None
        for d in exp_dates:
            try:
                exp_dt = datetime.strptime(d, "%Y-%m-%d").date()
                if 10 <= (exp_dt - now_date).days <= 45:
                    target_date = d; break
            except Exception:
                continue
        if not target_date:
            return {'bullish': False, 'score': 0.0, 'details': [], 'pcr': "N/A"}

        chain = await asyncio.to_thread(lambda: stock.option_chain(target_date))
        call_oi = chain.calls['openInterest'].sum() if not chain.calls.empty else 0
        put_oi  = chain.puts['openInterest'].sum()  if not chain.puts.empty  else 0
        pcr = round(put_oi / call_oi, 2) if call_oi > 0 else 1.0

        score, details = 0.0, []
        if pcr < 0.7:
            score += 4.0; details.append(f"🐂 Options Signal: Strong Bullish (PCR: {pcr})")
        elif pcr < 0.9:
            score += 2.0; details.append(f"📈 Options Signal: Mild Bullish (PCR: {pcr})")
        elif pcr > 1.3:
            score -= 2.0; details.append(f"🐻 Options Signal: Bearish (PCR: {pcr})")

        return {'bullish': pcr < 0.9, 'score': score, 'details': details, 'pcr': str(pcr)}
    except Exception:
        return {'bullish': False, 'score': 0.0, 'details': [], 'pcr': "N/A"}

# ================================================================
# ================================================================
# SECTION 4: SUPPORT / RESISTANCE CALCULATION AND TIMING ENGINE
# ================================================================

def calculate_support_resistance_1h(df_1h: pd.DataFrame, df_1d: pd.DataFrame, current_price: float, entry_trigger_1d: str = "") -> dict:
    """
    BOGA AI TIMING ENGINE (Sniper Module): 
    Combines 1D macro structure and 1H micro price movements.
    No matter how good the stock is, if there is no Smart Money volume and 
    reversal confirmation, entry_valid = False is returned.
    """
    try:
        # ── 1. DAILY (1D) MACRO STRUCTURE AND ATR ─────────────────────────
        close_1d = df_1d['Close']
        high_1d  = df_1d['High']
        low_1d   = df_1d['Low']
        
        atr_1d_series = AverageTrueRange(high_1d, low_1d, close_1d, ATR_PERIOD).average_true_range()
        atr_1d = float(atr_1d_series.iloc[-1]) if not pd.isna(atr_1d_series.iloc[-1]) else current_price * 0.03
        atr_pct = atr_1d / current_price

        macro_support = float(low_1d.tail(10).min())
        macro_resist  = float(high_1d.tail(15).max())

        support_1h = macro_support
        resist_1h  = macro_resist

        # ── 2. REAL-TIME TIMING (Via 1H Data) ────────
        entry_valid = False
        entry_type = "WAITING_FOR_VOLUME_OR_SWEEP"
        entry_confidence = 0

        if df_1h is not None and len(df_1h) >= 20:
            low_1h   = df_1h['Low']
            high_1h  = df_1h['High']
            close_1h = df_1h['Close']
            open_1h  = df_1h['Open']
            vol_1h   = df_1h['Volume']

            # Intraday Candle Data
            curr_c = float(close_1h.iloc[-1])
            curr_o = float(open_1h.iloc[-1])
            curr_h = float(high_1h.iloc[-1])
            curr_l = float(low_1h.iloc[-1])
            curr_v = float(vol_1h.iloc[-1])

            prev_c = float(close_1h.iloc[-2])
            prev_o = float(open_1h.iloc[-2])

            # 1H Pivot / Noise Filter
            lows, highs = low_1h.tail(50), high_1h.tail(50)
            pivot_lows = [float(lows.iloc[i]) for i in range(2, len(lows)-2) if lows.iloc[i] < lows.iloc[i-1] and lows.iloc[i] < lows.iloc[i+1]]
            pivot_highs = [float(highs.iloc[i]) for i in range(2, len(highs)-2) if highs.iloc[i] > highs.iloc[i-1] and highs.iloc[i] > highs.iloc[i+1]]

            supports_below = [p for p in pivot_lows if p < current_price - (atr_1d * 0.4)]
            if supports_below:
                support_1h = max(max(supports_below), macro_support)
            
            resists_above = [p for p in pivot_highs if p > current_price + (atr_1d * 0.5)]
            if resists_above:
                resist_1h = min(min(resists_above), macro_resist)

            # --- SMART MONEY & VOLUME CONFIRMATION ---
            # Hacim Filtresi: Son 20 saatin ortalamasının 1.8 katı ve YEŞİL mum!
            vol_avg_20 = float(vol_1h.rolling(20).mean().iloc[-1])
            is_green_candle = curr_c > curr_o
            volume_spike = (curr_v > vol_avg_20 * 1.8) and is_green_candle

            # Price Action (Candle Formations)
            body = abs(curr_c - curr_o)
            lower_wick = min(curr_c, curr_o) - curr_l
            upper_wick = curr_h - max(curr_c, curr_o)
            
            is_pinbar = (lower_wick > body * 2.0) and (upper_wick < body * 0.5)
            is_bullish_engulfing = is_green_candle and (prev_c < prev_o) and (curr_c > prev_o) and (curr_o < prev_c)

            # --- ENTRY SCENARIOS (Signal Triggers) ---
            is_liquidity_sweep = (curr_l < support_1h) and (curr_c > support_1h)
            
            recent_local_high = float(high_1h.tail(10).max())
            is_bos = (curr_c > recent_local_high) and volume_spike

            is_pullback = (support_1h <= curr_l <= support_1h + (atr_1d * 0.3))

            # --- FINAL DECISION ---
            if is_liquidity_sweep and (is_pinbar or volume_spike):
                entry_valid = True
                entry_type = "REVERSAL (Liquidity Sweep)"
                entry_confidence = 95
            elif is_bos:
                entry_valid = True
                entry_type = "BREAKOUT (BOS)"
                entry_confidence = 85
            elif is_pullback and (is_pinbar or is_bullish_engulfing) and volume_spike:
                entry_valid = True
                entry_type = "PULLBACK"
                entry_confidence = 80

        # Safety Buffer (If support is too close to price)
        if (current_price - support_1h) < (atr_1d * 0.6):
            support_1h = current_price - (atr_1d * 0.8)

        # ── 3. REFERENCE ZONES — DYNAMIC BY SIGNAL TYPE ───────────────────
        # 🔧 FIX #3 (CRITICAL): Buy Zone is no longer hard-anchored to support_1h.
        # In a BREAKOUT/BOS/Early Awakening, price does not pull back to support;
        # it shoots upward immediately. Anchoring the zone to support causes the
        # alert to never trigger (the famous "fiyat hiç bölgeye gelmiyor" problem).
        #
        # Strategy:
        #   • BREAKOUT (BOS) / Early Awakening → zone is built TIGHT around current_price
        #     (low = price - 0.25*ATR, high = price + 0.15*ATR). Allows the bot to act
        #     immediately on the breakout candle instead of waiting for an unrealistic dip.
        #   • PULLBACK / Liquidity Sweep      → classic support-based zone preserved
        #     (low = support + 0.2*ATR, high = price + 0.1*ATR), because here the
        #     thesis literally IS that price retests support before the next leg.
        #   • No valid trigger yet            → conservative classic zone (waiting mode).
        # 1H momentumuna ek olarak 1D'den gelen agresif kırılım (Early Awakening) sinyali kontrolü
        is_momentum_entry = (
            (entry_valid and entry_type in ("BREAKOUT (BOS)", "REVERSAL (Liquidity Sweep)")) or
            (entry_type or "").startswith("BREAKOUT") or
            "Early Awakening" in entry_trigger_1d
        )

        if is_momentum_entry:
            # Tight zone around live price — strike now, not at a stale support level
            buy_zone_low  = round(current_price - (atr_1d * 0.25), 2)
            buy_zone_high = round(current_price + (atr_1d * 0.15), 2)
        elif entry_valid and entry_type == "PULLBACK":
            # Classic pullback retest zone — wait for price to revisit support area
            buy_zone_low  = round(support_1h + (atr_1d * 0.2), 2)
            buy_zone_high = round(current_price + (atr_1d * 0.1), 2)
        else:
            # No confirmed trigger → keep historical (defensive) calculation
            buy_zone_low  = round(support_1h + (atr_1d * 0.2), 2)
            buy_zone_high = round(current_price + (atr_1d * 0.1), 2)

        # Sanity guard: low must always be below high
        if buy_zone_low >= buy_zone_high:
            buy_zone_low = round(buy_zone_high - (atr_1d * 0.3), 2)

        stop_high = round(support_1h - (atr_1d * 0.5), 2)
        stop_low  = round(stop_high - (atr_1d * 0.2), 2)

        avg_entry = current_price if entry_valid else ((buy_zone_low + buy_zone_high) / 2)
        risk = max(avg_entry - stop_high, atr_1d * 1.0)
        
        reward = risk * 2.5
        structural_reward = resist_1h - avg_entry
        if structural_reward > reward and (structural_reward / risk) <= 4.0:
            reward = structural_reward

        sell_zone_low  = round(avg_entry + reward * 0.85, 2)
        sell_zone_high = round(avg_entry + reward, 2)

        actual_risk   = avg_entry - stop_high
        actual_reward = sell_zone_high - avg_entry
        rr_ratio = round(actual_reward / actual_risk, 2) if actual_risk > 0 else 0.0

        return {
            "entry_engine": {
                "valid": entry_valid,
                "type": entry_type,
                "confidence": entry_confidence
            },
            "buy_zone":  {"low": buy_zone_low,  "high": buy_zone_high},
            "sell_zone": {"low": sell_zone_low,  "high": sell_zone_high},
            "stop_zone": {"low": stop_low,        "high": stop_high},
            "support_1h":  round(support_1h, 2),
            "resist_1h":   round(resist_1h, 2),
            "atr_1d":      round(atr_1d, 2),
            "atr_pct":     round(atr_pct * 100, 2),
            "rr_ratio":    rr_ratio,
            "risk_usd":    round(actual_risk, 2),
            "reward_usd":  round(actual_reward, 2),
        }

    except Exception as e:
        logging.error(f"❌ Support/Resistance & Timing error: {e}")
        return {
            "entry_engine": {"valid": False, "type": "DATA_ERROR", "confidence": 0},
            "buy_zone": {"low": current_price * 0.98, "high": current_price * 1.01},
            "sell_zone": {"low": current_price * 1.05, "high": current_price * 1.08},
            "stop_zone": {"low": current_price * 0.94, "high": current_price * 0.95},
            "support_1h": current_price * 0.95, "resist_1h": current_price * 1.08,
            "atr_1d": current_price * 0.03, "atr_pct": 3.0,
            "rr_ratio": 2.5, "risk_usd": current_price * 0.05, "reward_usd": current_price * 0.125
        }       
# ================================================================
# ================================================================
# SECTION 5: PERFORMANCE DATA
# ================================================================
# ================================================================

def get_price_performance(df_1d: pd.DataFrame, ticker: str) -> dict:
    """
    Calculates 1D (day), 1W (week), 1M (month), 1Y (year), 5Y (5 years) change ratios.
    Additional data is fetched for 5Y.
    """
    try:
        close = df_1d['Close']
        perf = {}

        # 1-Day
        if len(close) >= 2:
            perf['1d'] = round((float(close.iloc[-1]) - float(close.iloc[-2])) / float(close.iloc[-2]) * 100, 2)
        else:
            perf['1d'] = 0.0

        # 1-Week (5 trading days)
        if len(close) >= 6:
            perf['1w'] = round((float(close.iloc[-1]) - float(close.iloc[-6])) / float(close.iloc[-6]) * 100, 2)
        else:
            perf['1w'] = 0.0

        # 1-Month (21 trading days)
        if len(close) >= 22:
            perf['1m'] = round((float(close.iloc[-1]) - float(close.iloc[-22])) / float(close.iloc[-22]) * 100, 2)
        else:
            perf['1m'] = 0.0

        # 1Y and 5Y — cache check (one yf.Ticker call per scan)
        now = time.time()
        cached = LONG_HISTORY_CACHE.get(ticker)
        if cached and (now - cached.get("ts", 0)) < LONG_HISTORY_TTL:
            perf['1y'] = cached.get('1y', 0.0)
            perf['5y'] = cached.get('5y', 0.0)
        else:
            perf['1y'] = 0.0
            perf['5y'] = 0.0
            try:
                stock = yf.Ticker(ticker)
                hist_1y = stock.history(period="1y", interval="1d")
                if len(hist_1y) >= 2:
                    perf['1y'] = round((float(hist_1y['Close'].iloc[-1]) - float(hist_1y['Close'].iloc[0])) / float(hist_1y['Close'].iloc[0]) * 100, 2)
                hist_5y = stock.history(period="5y", interval="1mo")
                if len(hist_5y) >= 2:
                    perf['5y'] = round((float(hist_5y['Close'].iloc[-1]) - float(hist_5y['Close'].iloc[0])) / float(hist_5y['Close'].iloc[0]) * 100, 2)
            except Exception:
                pass
            LONG_HISTORY_CACHE[ticker] = {"ts": now, "1y": perf['1y'], "5y": perf['5y']}

        return perf
    except Exception:
        return {'1d': 0.0, '1w': 0.0, '1m': 0.0, '1y': 0.0, '5y': 0.0}

# ================================================================
# ================================================================
# SECTION 6: EARNINGS & MARKET ANALYSIS
# ================================================================
# ================================================================

def get_earnings_date_safe(ticker: str) -> Optional[datetime]:
    try:
        stock = yf.Ticker(ticker)
        if hasattr(stock, 'calendar') and stock.calendar:
            earnings_date = stock.calendar.get('Earnings Date', None)
            if earnings_date:
                if isinstance(earnings_date, list): earnings_date = earnings_date[0]
                return pd.to_datetime(earnings_date)
        if hasattr(stock, 'earnings_dates') and stock.earnings_dates is not None:
            upcoming = stock.earnings_dates[stock.earnings_dates.index >= datetime.now(NY_TZ)]
            if not upcoming.empty: return upcoming.index[0]
        return None
    except Exception:
        return None


def is_earnings_safe_for_swing(ticker: str, min_days_away: int = 7) -> bool:
    try:
        earnings_date = get_earnings_date_safe(ticker)
        if earnings_date is None: return True
        now = datetime.now(NY_TZ)
        # yfinance sometimes returns naive (UTC assumption) sometimes aware.
        # When it comes as Naive, we accept it as UTC and convert to NY — default NY_TZ
        # was causing wrong decisions on borderline earnings due to time difference.
        if earnings_date.tzinfo is None:
            earnings_date = earnings_date.replace(tzinfo=timezone.utc).astimezone(NY_TZ)
        else:
            earnings_date = earnings_date.astimezone(NY_TZ)
        days_until = (earnings_date - now).days
        if 0 <= days_until < min_days_away: return False
        if -2 <= days_until < 0: return False
        return True
    except Exception:
        return True


async def analyze_market_and_sectors():
    """Market regime (VIX + SPY) and sector performance analysis."""
    global MARKET_STATUS, SECTOR_PERFORMANCE
    current_vix = 20.0
    try:
        # Bulk download indices to avoid rate limiting
        indices = ["^VIX", "SPY"]
        df_indices = await asyncio.to_thread(
            yf.download, indices, period="252d", progress=False, group_by="ticker", ignore_tz=True
        )

        if "^VIX" in df_indices and not df_indices["^VIX"].empty:
            current_vix = float(df_indices["^VIX"]["Close"].iloc[-1])

        if "SPY" in df_indices and not df_indices["SPY"].empty:
            spy_close = df_indices["SPY"]["Close"].dropna()
            current_spy = float(spy_close.iloc[-1])
            spy_ema200 = EMAIndicator(spy_close, 200).ema_indicator().iloc[-1] if len(spy_close) >= 200 else spy_close.mean()
            spy_ema50  = EMAIndicator(spy_close, 50).ema_indicator().iloc[-1]  if len(spy_close) >= 50  else spy_close.mean()
            spy_5d_change = (current_spy - float(spy_close.iloc[-6])) / float(spy_close.iloc[-6]) * 100 if len(spy_close) >= 6 else 0.0

            if current_vix < 18 and current_spy > spy_ema50 and spy_5d_change > 0:
                MARKET_STATUS["regime"] = "STRONG"; MARKET_STATUS["min_score_modifier"] = -0.5
            elif current_vix < 22 and current_spy > spy_ema50:
                MARKET_STATUS["regime"] = "BULLISH"; MARKET_STATUS["min_score_modifier"] = 0.0
            elif current_vix < 28 and current_spy > spy_ema200:
                MARKET_STATUS["regime"] = "CHOPPY"; MARKET_STATUS["min_score_modifier"] = 0.0
            elif current_vix >= 22 and current_vix < 35:
                MARKET_STATUS["regime"] = "HIGH_VOLATILITY"; MARKET_STATUS["min_score_modifier"] = 0.5
            else:
                MARKET_STATUS["regime"] = "WEAK"; MARKET_STATUS["min_score_modifier"] = 1.0

        logging.info(f"📊 Piyasa Rejimi: {MARKET_STATUS['regime']} (VIX: {current_vix:.1f})")
    except Exception as e:
        logging.error(f"Market analysis error: {e}")

    # Sector performance
    for sector_name, etf_ticker in SECTOR_ETF_MAP.items():
        try:
            etf = yf.Ticker(etf_ticker)
            hist = etf.history(period="5d")
            if len(hist) >= 2:
                SECTOR_PERFORMANCE[sector_name] = round(
                    (float(hist["Close"].iloc[-1]) - float(hist["Close"].iloc[0])) / float(hist["Close"].iloc[0]) * 100, 2
                )
        except Exception:
            continue

    logging.info("✅ Market and Sector Analysis Completed.")

# ================================================================
# ================================================================
# SECTION 7: PROFIT TARGET / STOP LOSS (ATR BASED)
# ================================================================
# ================================================================

def calculate_profit_target(entry_price, atr_value, momentum_score, is_exhausted=False, beta=1.0):
    """V113 — ATR Based Dynamic TP/SL (Realistic swing band: %8-15, mostly hit within 5-10 days)

    🔧 FIX #4: Old formula `tp_atr_mult = 2.5 + 1.0*m` produced 3.5 ATR targets,
    which translates to %20-25 moves — almost never reached in 5-10 days.
    New formula `1.6 + 0.4*m` keeps targets in the realistic 1.6-2.0 ATR zone
    (~ %7-12) which the win-rate stats actually support.
    """
    if pd.isna(atr_value) or atr_value == 0:
        fallback_tp_pct = 0.07 if not is_exhausted else 0.04
        return entry_price * (1 + fallback_tp_pct), entry_price * 0.98

    atr_multiplier_sl = 1.5 if atr_value < entry_price * 0.01 else 2.0
    stop_loss = entry_price - atr_value * atr_multiplier_sl
    m = min(1.0, momentum_score / 12.0)
    # 🔧 FIX: Realistic swing TP band — 1.6 ATR to 2.0 ATR (max), not 2.5-3.5
    tp_atr_mult = 1.4 if is_exhausted else 1.6 + (0.4 * m)
    profit_target_raw = entry_price + atr_value * tp_atr_mult
    profit_pct_raw = (profit_target_raw - entry_price) / entry_price * 100
    # 🔧 FIX: Realistic ceilings — most swings finish around %10, not %25
    if beta > 1.5:
        max_profit_pct = 15.0   # was 25.0
    elif beta > 1.0:
        max_profit_pct = 12.0   # was 22.0
    else:
        max_profit_pct = 9.0    # was 18.0
    if is_exhausted:
        max_profit_pct = min(max_profit_pct, 6.0)  # was 12.0
    profit_target = entry_price * (1 + max_profit_pct / 100) if profit_pct_raw > max_profit_pct else profit_target_raw

    return float(round(profit_target, 4)), float(round(stop_loss, 4))


def estimate_hold_time(momentum_score, vol_increase, profit_pct=0.0, atr_pct=0.0, is_exhausted=False):
    """🔧 FIX #8: Hold band squeezed from 3-15 → 3-10 days.
    Anything past 10 days is no longer a swing trade — it becomes a position trade
    and ties up capital that could rotate to a fresher signal."""
    directional_daily = atr_pct * 0.20
    hold = int(profit_pct / directional_daily) if directional_daily > 0 and profit_pct > 0 else 6
    hold = max(3, min(12, hold))
    m = min(1.0, momentum_score / 14.0)
    if m >= 0.90: hold -= 2
    elif m >= 0.75: hold -= 1
    elif m < 0.35: hold += 2
    elif m < 0.50: hold += 1
    if vol_increase >= 2.2: hold -= 2
    elif vol_increase >= 1.8: hold -= 1
    elif vol_increase < 0.8: hold += 2
    if is_exhausted: hold += 2
    return max(3, min(10, hold))   # 🔧 FIX: 15 → 10 hard cap

# ================================================================
# ================================================================
# SECTION 8: MAIN STOCK ANALYSIS (apply_atmaca_filters)
# ================================================================
# ================================================================
# 🚀 SMART NETWORK MANAGEMENT STRATEGY:
#
#  PHASE 1 (500 stocks — ZERO network I/O):
#    • 1D data read only from BULK_DATA_CACHE (0 ms)
#    • EMA, ADX, RVOL, Dead Money → fast elimination
#    • At least 450 stocks that fail Layer 2 return None immediately
#
#  PHASE 2 (only those that pass Layer 2 — ~50 stocks):
#    • Earnings check (yf.Ticker)
#    • 1H data fetch (yf.Ticker)
#    → These 2 operations run approximately 50 times, not 500!
# ================================================================

async def apply_atmaca_filters(ticker: str) -> Optional[dict]:
    """
    Comprehensive technical analysis for a single stock.
    PHASE 1: 1D data (memory) → Fast elimination (500 stocks, zero network)
    PHASE 2: 1H + Earnings (only Layer 2 pass ~50 stocks)
    + ATR + EMA + RSI + ADX + MACD + OBV + BB + Smart Money + Ichimoku + VP
    """
    try:
        ticker = ticker.strip().upper()

        # ── HARD FILTER: Pass if market is WEAK (0 ms) ─────────────────
        if MARKET_STATUS.get("regime") == "WEAK":
            return None

        # ── PHASE 1: MEMORY ONLY — ZERO NETWORK I/O ───────────────
        # From persistent_info_cache (accumulation from previous scans)
        global persistent_info_cache
        cached_info = get_stock_info(ticker)
        market_cap  = cached_info.get("market_cap", 0)
        beta        = cached_info.get("beta", 1.0)
        sector_name = cached_info.get("sector", "Unknown")
        short_float = cached_info.get("short_float", 0.0)

        # 1D data → From BULK_DATA_CACHE (0 ms, yf.download already loaded)
        df_1d = await asyncio.to_thread(get_stock_data, ticker, "1d")
        if df_1d is None or len(df_1d) < 50:
            return None

        # Volume hard filter
        avg_volume_10d = float(df_1d["Volume"].tail(10).mean())
        if avg_volume_10d < ATMACA_MIN_AVG_VOLUME:
            return None
        if market_cap > 0 and market_cap < ATMACA_MIN_MARKET_CAP:
            return None

        close_1d  = df_1d["Close"]
        high_1d   = df_1d["High"]
        low_1d    = df_1d["Low"]
        volume_1d = df_1d["Volume"]
        current_price = float(close_1d.iloc[-1])

        score   = 0.0
        details: List[str] = []
        details.append("✅ UNIVERSE: Liquidity/Structural Conditions Met")
        score += 4.0

        # ── SECTOR ROTATION ────────────────────────────────────────
        sec_perf = SECTOR_PERFORMANCE.get(sector_name, 0.0)
        if sec_perf > 2.0:
            score += 6.0; details.append(f"🔥 Sector: {sector_name} HOT (+{sec_perf:.1f}%)")
        elif sec_perf > 0:
            score += 1.2; details.append(f"📊 Sector: {sector_name} Positive (+{sec_perf:.1f}%)")
        elif sec_perf < -2.0:
            score -= 3.2; details.append(f"🥶 Sector: {sector_name} COLD ({sec_perf:.1f}%)")
        else:
            score -= 0.8; details.append(f"➖ Sector: {sector_name} Neutral ({sec_perf:.1f}%)")

        # ── RELATIVE STRENGTH ───────────────────────────────────────
        rs_label = "N/A"
        rs_slope = 0.0
        index_close = get_index_close_series(INDEX_BENCHMARK)
        if index_close is not None:
            idx_aligned = index_close.reindex(close_1d.index, method="ffill").dropna()
            common_idx = close_1d.index.intersection(idx_aligned.index)
            if len(common_idx) >= 20:
                rs_series = close_1d.loc[common_idx] / idx_aligned.loc[common_idx]
                rs_tail = rs_series.tail(min(RS_LOOKBACK, len(rs_series)))
                try:
                    rs_slope = np.polyfit(range(len(rs_tail)), rs_tail.values, 1)[0]
                except Exception:
                    rs_slope = 0.0
                if rs_slope > 0.0005:
                    score += 4.8; rs_label = "Strong Outperform"; details.append(f"💪 RS: Above {INDEX_BENCHMARK} (Strong)")
                elif rs_slope > 0:
                    score += 2.0; rs_label = "Mild Outperform"; details.append(f"📈 RS: Above {INDEX_BENCHMARK} (Mild)")
                elif rs_slope > -0.0005:
                    score -= 1.2; rs_label = "Neutral"; details.append(f"➖ RS: Parallel")
                else:
                    score -= 3.2; rs_label = "Underperform"; details.append(f"⚠️ RS: Below {INDEX_BENCHMARK}")

        # ── EMA SYSTEM ─────────────────────────────────────────────
        ema20_1d = EMAIndicator(close_1d, 20).ema_indicator()
        ema50_1d = EMAIndicator(close_1d, 50).ema_indicator()
        ema200_1d = EMAIndicator(close_1d, 200).ema_indicator()
        last_ema20  = float(ema20_1d.iloc[-1])
        last_ema50  = float(ema50_1d.iloc[-1])
        last_ema200 = float(ema200_1d.iloc[-1])
        trend_durumu_1d = "N/A"

        if current_price > last_ema50 and last_ema50 > last_ema200:
            score += 14.0; details.append("🏆 1D TREND: Macro Bullish (P>EMA50>EMA200)"); trend_durumu_1d = "Macro Bullish"
            ema_spread = (last_ema50 - last_ema200) / last_ema200 if last_ema200 > 0 else 0.0
            if ema_spread > 0.03:
                score += 1.6; details.append("🔥 EMA50-200 Spread Wide")
        elif current_price > last_ema20 and last_ema20 > last_ema50 and last_ema50 > last_ema200:
            score += 8.8; details.append("📈 1D TREND: Upward Order (EMA20>50>200)"); trend_durumu_1d = "Upward"
        elif current_price > last_ema200:
            score += 3.2; details.append("🟢 1D TREND: Above EMA200"); trend_durumu_1d = "Above EMA200"
        elif current_price > last_ema50:
            score += 1.2; details.append("🟡 1D TREND: Above EMA50"); trend_durumu_1d = "Above EMA50"
        else:
            score -= 6.0; details.append("🔴 1D TREND: Downtrend"); trend_durumu_1d = "Downtrend"

        cond_ema20_slope_positive = calculate_ema_slope(ema20_1d, periods=10)
        if cond_ema20_slope_positive:
            score += 4.0; details.append("📈 EMA20: Positive slope")
        else:
            score -= 1.6; details.append("📉 EMA20: Negative/Flat slope")

        # ── ALPHA ENGINE 1: VOLATILITY SQUEEZE (Contraction Before Explosion) ──
        ema20_slope_numeric = (ema20_1d.iloc[-1] - ema20_1d.iloc[-10]) / ema20_1d.iloc[-10] if len(ema20_1d) >= 10 and ema20_1d.iloc[-10] > 0 else 0.0
        is_ema_flat = abs(ema20_slope_numeric) < 0.008

        # Bollinger Bands (BB) Width Squeeze Control (RELATIVE SQUEEZE)
        bb_1d = BollingerBands(close_1d, 20, 2)
        bb_width_series = (bb_1d.bollinger_hband() - bb_1d.bollinger_lband()) / ema20_1d
        bb_width = bb_width_series.iloc[-1]
        bb_width_avg_50 = bb_width_series.tail(50).mean() if len(bb_width_series) >= 50 else bb_width
        # Current width is less than 60% of the last 50-day average OR absolute value is below 6%
        is_squeeze = (bb_width < (bb_width_avg_50 * 0.60)) or (bb_width < 0.06)

        # ── ALPHA ENGINE 2: LIQUIDITY HUNT (Failed Breakdown / Spring) ─────
        min_low_10d = low_1d.tail(10).iloc[:-1].min()
        current_low = low_1d.iloc[-1]
        # Did price break the last 10-day low (popping stops) and quickly return above the open?
        is_spring = (current_low < min_low_10d) and (current_price > min_low_10d) and (current_price > df_1d['Open'].iloc[-1])

        # Final decision mechanism before ADX calculation
        if is_squeeze:
            score += 15.0; details.append("🚨 ALPHA EDGE: Volatility Squeeze (Preparing for Big Move)")
        elif is_spring:
            score += 12.0; details.append("⚡ ALPHA EDGE: Failed Breakdown (Smart Money Liquidity Hunt Complete)")
        elif is_ema_flat and adx_1d < 15:
            return None  # No contraction, no liquidity hunt, and if trend is flat, it's TRULY dead money, eliminate.
            

        # ── ADX ──────────────────────────────────────────────────────
        try:
            adx_series_1d = ADXIndicator(high_1d, low_1d, close_1d, 14).adx()
            adx_1d = float(adx_series_1d.iloc[-1])
        except Exception:
            adx_series_1d = pd.Series(data=0.0, index=df_1d.index)
            adx_1d = 0.0

        if adx_1d >= 30: score += 6.0; details.append(f"🔥 ADX: Very Strong ({adx_1d:.1f})")
        elif adx_1d >= 25: score += 4.0; details.append(f"💪 ADX: Strong ({adx_1d:.1f})")
        elif adx_1d >= 20: score += 2.0; details.append(f"📊 ADX: Medium ({adx_1d:.1f})")
        elif adx_1d >= 15: score += 0.4; details.append(f"🟡 ADX: Weak ({adx_1d:.1f})")
        else:              score -= 2.0; details.append(f"⚠️ ADX: Very Weak ({adx_1d:.1f})")

        try:
            adx_slope = adx_series_1d.diff().tail(5).mean()
            if adx_slope > 0.5: score += 1.6; details.append("🚀 ADX Momentum: Accelerating")
            elif adx_slope < -0.5: score -= 1.2; details.append("🐌 ADX Momentum: Slowing")
        except Exception:
            pass

        if is_ema_flat and adx_1d < 15:
            return None  # Dead Money

        # ── LAYER 2: FLOW & MOMENTUM FILTER ─────────────────────
        # 🔧 FIX #6: This filter is the gate that previously let in
        # sideways/downtrend stocks. We tighten it so only stocks
        # already in motion or in a textbook accumulation pass.
        layer2_pass = True
        layer2_reasons = []

        try:
            vol_2g_avg  = float(volume_1d.tail(2).mean())
            vol_20g_avg = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_2g_avg
            rvol_micro  = (vol_2g_avg / vol_20g_avg) if vol_20g_avg > 0 else 0.0
        except Exception:
            rvol_micro = 0.0
        rvol_5_30 = rvol_micro

        # 1. VOLUME TIGHTENED: 0.90 was too loose — sideways stocks easily clear it.
        if rvol_micro < 1.05:   # 🔧 FIX: 0.90 → 1.05 (must show at least mild expansion)
            layer2_pass = False; layer2_reasons.append(f"Micro-RVOL={rvol_micro:.2f}<1.05")

        # 2. TREND HARD GATE: must be above EMA50 AND EMA200.
        #    Plus: EMA20 must have positive slope OR price > EMA20 (no flat tape).
        try:
            ema20_val  = float(ema20_1d.iloc[-1])
            ema50_val  = float(ema50_1d.iloc[-1])
            ema200_val = float(ema200_1d.iloc[-1])
            # Old rule: only EMA200 — let in stocks that "might recover in 2-3 days" (sideways).
            # New rule: above EMA50 too, otherwise this is base-building, not an entry zone.
            if current_price < ema50_val or current_price < ema200_val:
                layer2_pass = False; layer2_reasons.append("Below EMA50 or EMA200 (not actionable)")
            # Trend direction confirmation — last 5 days must show positive change
            if len(close_1d) >= 6:
                ret_5d_pct = (current_price - float(close_1d.iloc[-6])) / float(close_1d.iloc[-6]) * 100
                if ret_5d_pct < -2.0:
                    layer2_pass = False
                    layer2_reasons.append(f"5-day return {ret_5d_pct:.2f}% (downtrend)")
        except Exception:
            pass

        # 3. ADX TIGHTENED: 12 was too loose. Below 18 means no real trend.
        if adx_1d > 0 and adx_1d < 18:   # 🔧 FIX: 12 → 18 (matches ADX_MIN_LEVEL_1D constant)
            layer2_pass = False; layer2_reasons.append(f"ADX={adx_1d:.1f}<18 (no trend)")

        try:
            last10 = df_1d.tail(10)
            green_candles = int((last10['Close'] > last10['Open']).sum())
        except Exception:
            green_candles = 0
        # 🔧 FIX: 3 green candles out of 10 was too loose — half are red/down. Need 5+.
        if green_candles < 5:
            layer2_pass = False; layer2_reasons.append(f"Green candles={green_candles}<5 (no upward bias)")

        try:
            df_cmf = df_1d.tail(20)
            hl_range = (df_cmf['High'] - df_cmf['Low']).replace(0, np.nan)
            mfm = ((df_cmf['Close'] - df_cmf['Low']) - (df_cmf['High'] - df_cmf['Close'])) / hl_range
            cmf_val = float((mfm * df_cmf['Volume']).sum() / df_cmf['Volume'].sum()) if df_cmf['Volume'].sum() > 0 else 0.0
        except Exception:
            cmf_val = 0.0

        # 4. MONEY FLOW TIGHTENED: CMF must be NON-NEGATIVE for a swing long.
        #    Negative CMF = distribution = retail buying / smart money exiting.
        if cmf_val != 0.0 and cmf_val < 0.0:   # 🔧 FIX: -0.10/-0.20 → 0.0 (no distribution allowed)
            layer2_pass = False; layer2_reasons.append(f"CMF={cmf_val:.3f}<0 (distribution)")

        # 5. RSI HARD GATE: anything below 45 = weak / has downside potential.
        try:
            rsi_quick = float(RSIIndicator(close_1d, 14).rsi().iloc[-1])
            if rsi_quick < RSI_MIN_SWING:
                layer2_pass = False; layer2_reasons.append(f"RSI={rsi_quick:.1f}<{RSI_MIN_SWING} (weak)")
        except Exception:
            pass

        # 6. TREND STATUS GATE: explicit downtrend reject.
        if trend_durumu_1d == "Downtrend":
            layer2_pass = False; layer2_reasons.append("Trend Status=Downtrend")

        if not layer2_pass:
            return None

        # ============================================================
        # 🚀 SMART NETWORK TRANSITION — ONLY PASSING LAYER 2 ~50 STOCKS
        # WE ARE GOING TO THE INTERNET. 450 bad stocks already eliminated above.
        # ============================================================

        # 1) Earnings güvenliği (yf.Ticker → network, ama sadece ~50 kez)
        if not await asyncio.to_thread(is_earnings_safe_for_swing, ticker):
            logging.info(f"🚫 {ticker}: Earnings near → ELIMINATION")
            return None

        # 2) 1H data (yf.Ticker → network, but only ~50 times)
        df_1h = await asyncio.to_thread(get_stock_data, ticker, "1h")

        # ============================================================

        score += 6.0
        details.append(f"✅ LAYER 2: Momentum Confirmed (RVOL:{rvol_micro:.2f}x | Green:{green_candles}/10 | CMF:{cmf_val:.3f})")
        if rvol_micro >= 1.60:
            score += 2.0; details.append(f"🔥 Micro-RVOL Aggressive: {rvol_micro:.2f}x")

        # ── ATR & BOLLINGER ──────────────────────────────────────────
        try:
            atr_1d_series = AverageTrueRange(high_1d, low_1d, close_1d, ATR_PERIOD).average_true_range()
            atr_1d = float(atr_1d_series.iloc[-1])
        except Exception:
            atr_1d = 0.0

        atr_pct_1d = (atr_1d / current_price) if current_price > 0 else 0.0

        if atr_pct_1d > 0:
            if atr_pct_1d < 0.005: return None
            if atr_pct_1d > 0.080: return None

        try:
            bb_1d = BollingerBands(close_1d, 20, 2)
            bb_width_1d = (bb_1d.bollinger_hband().iloc[-1] - bb_1d.bollinger_lband().iloc[-1]) / current_price if current_price > 0 else 0.0
        except Exception:
            bb_width_1d = 0.0

        if atr_pct_1d < 0.020 and bb_width_1d < 0.045:
            score += 3.2; details.append("🟦 VOL Regime: Squeeze (Breakout Candidate)")
        elif 0.020 <= atr_pct_1d < 0.040:
            score += 4.0; details.append("🟩 VOL Regime: Early Swing")
        elif 0.040 <= atr_pct_1d <= 0.080:
            score += 6.0; details.append("⚡ VOL Regime: Ideal Swing Zone")
        else:
            score += 1.2; details.append("🟨 VOL Regime: High (Caution)")

        # ── RSI ──────────────────────────────────────────────────────
        try:
            rsi_1d_series = RSIIndicator(close_1d, 14).rsi()
            rsi_1d_val = float(rsi_1d_series.iloc[-1])
        except Exception:
            rsi_1d_val = 50.0

        if 40 <= rsi_1d_val <= 55:
            score += 6.0; details.append(f"🌀 RSI: Momentum Start ({rsi_1d_val:.1f})")
        elif 55 < rsi_1d_val <= 70:
            score += 3.2; details.append(f"📈 RSI: Momentum Continuation ({rsi_1d_val:.1f})")
        elif 70 < rsi_1d_val <= 82:
            score += 1.2; details.append(f"⚠️ RSI: Near Overbought ({rsi_1d_val:.1f})")
        elif rsi_1d_val < 35:
            score -= 3.2; details.append(f"❄️ RSI: Weak ({rsi_1d_val:.1f})")
        elif rsi_1d_val > 82:
            score -= 2.0; details.append(f"🔴 RSI: Overbought ({rsi_1d_val:.1f})")
        else:
            score += 0.4; details.append(f"➖ RSI: Neutral ({rsi_1d_val:.1f})")

        try:
            if len(close_1d) > 5:
                if close_1d.iloc[-1] > close_1d.iloc[-5] and rsi_1d_series.iloc[-1] < rsi_1d_series.iloc[-5]:
                    score -= 4.0; details.append("⚠️ RSI Divergence: Negatif")
        except Exception:
            pass

        # ── EXHAUSTION ───────────────────────────────────────────────
        is_exhausted = False
        try:
            roc_3d = (float(close_1d.iloc[-1]) - float(close_1d.iloc[-4])) / float(close_1d.iloc[-4]) * 100 if len(close_1d) >= 4 else 0.0
            if roc_3d > 12.0 or rsi_1d_val > 75.0:
                is_exhausted = True
                reasons_ex = []
                if roc_3d > 12.0: reasons_ex.append(f"3G ROC: +{roc_3d:.1f}%")
                if rsi_1d_val > 75.0: reasons_ex.append(f"RSI: {rsi_1d_val:.1f}")
                score -= 8.0; details.append(f"🔴 EXHAUSTED: {', '.join(reasons_ex)}")
            elif 45 <= rsi_1d_val <= 55:
                score += 4.0; details.append(f"🌅 Early Awakening: RSI {rsi_1d_val:.1f} (Optimal Entry)")
        except Exception:
            is_exhausted = False

        # ── MACD ─────────────────────────────────────────────────────
        try:
            macd_obj     = MACD(close_1d, window_slow=26, window_fast=12, window_sign=9)
            macd_line    = macd_obj.macd()
            macd_signal  = macd_obj.macd_signal()
            macd_hist    = macd_obj.macd_diff()
            macd_hist_val= float(macd_hist.iloc[-1])
            macd_hist_prev = float(macd_hist.iloc[-2]) if len(macd_hist) >= 2 else 0.0
            
            if macd_hist_val > 0 and macd_hist_val > macd_hist_prev:
                score += 3.0; details.append(f"📈 MACD Hist: Rising ({macd_hist_val:.3f})")
            elif macd_hist_val > 0:
                score += 1.5; details.append(f"✅ MACD Hist: Positive ({macd_hist_val:.3f})")
            elif macd_hist_val < 0 and macd_hist_val > macd_hist_prev and (macd_hist_val - macd_hist_prev) > abs(macd_hist_prev) * 0.15:
                score += 2.5; details.append("🌅 MACD: Strong Bottom Reversal Momentum")
            elif macd_hist_val < 0:
                score -= 2.0; details.append(f"⚠️ MACD Hist: Negative ({macd_hist_val:.3f})")
        except Exception:
            macd_hist_val = 0.0; macd_line = pd.Series(); macd_signal = pd.Series()

        # ── 1D SUMMARY ──────────────────────────────────────────────────
        d1_summary = {
            "Trend Status": trend_durumu_1d,
            "EMA20 Slope": "Positive" if cond_ema20_slope_positive else "Negative/Flat",
            "RSI(14)": f"{rsi_1d_val:.1f}",
            "ADX": f"{adx_1d:.1f}",
            "ATR%": f"{atr_pct_1d * 100:.2f}%",
            "BB Width": f"{bb_width_1d * 100:.1f}%",
            "MACD_Hist": f"{macd_hist_val:.3f}",
        }

        # ── 1H MICRO ANALYSIS ─────────────────────────────────────────
        h1_summary = {"Status": "Insufficient Data"}
        rsi_1h = 50.0; adx_1h = 0.0; atr_pct_1h = 0.0; rvol_1h = 0.0

        if df_1h is not None and len(df_1h) >= 10:
            close_1h = df_1h["Close"]
            high_1h  = df_1h["High"]
            low_1h   = df_1h["Low"]
            volume_1h = df_1h["Volume"]
            ema20_1h = EMAIndicator(close_1h, 20).ema_indicator()
            ema50_1h = EMAIndicator(close_1h, 50).ema_indicator()
            try: rsi_1h = float(RSIIndicator(close_1h, 14).rsi().iloc[-1])
            except Exception: rsi_1h = 50.0
            try: adx_1h = float(ADXIndicator(high_1h, low_1h, close_1h, 14).adx().iloc[-1])
            except Exception: adx_1h = 0.0
            try:
                atr_1h_series = AverageTrueRange(high_1h, low_1h, close_1h, ATR_PERIOD).average_true_range()
                atr_1h = float(atr_1h_series.iloc[-1])
                atr_pct_1h = atr_1h / float(close_1h.iloc[-1]) if float(close_1h.iloc[-1]) > 0 else 0.0
            except Exception:
                atr_1h = 0.0

            try:
                vol_ma_1h  = volume_1h.rolling(10).mean()
                rvol_1h    = float(volume_1h.iloc[-1]) / float(vol_ma_1h.iloc[-1]) if float(vol_ma_1h.iloc[-1]) > 0 else 0.0
            except Exception:
                rvol_1h = 0.0

            rvol_durumu = "🔥 EXTREMELY INTENSE" if rvol_1h > 3.0 else "✅ High" if rvol_1h > 1.5 else "❄️ Volumeless" if rvol_1h < 0.7 else "Normal"
            close_now_1h  = float(close_1h.iloc[-1])
            ema20_now_1h  = float(ema20_1h.iloc[-1])
            ema50_now_1h  = float(ema50_1h.iloc[-1])
            ema20_distance = (close_now_1h - ema20_now_1h) / ema20_now_1h if ema20_now_1h > 0 else 0.0

            if adx_1h >= 30: score += 10.0; details.append(f"🔥 1H ADX: Very Strong ({adx_1h:.1f})")
            elif adx_1h >= 20: score += 6.0; details.append(f"💪 1H ADX: Strong ({adx_1h:.1f})")
            elif adx_1h >= 14: score += 2.4; details.append(f"🟡 1H ADX: Early ({adx_1h:.1f})")
            else: score -= 3.2; details.append(f"⚠️ 1H ADX: Weak ({adx_1h:.1f})")

            if ema20_distance > 0.05:
                score -= 8.0; details.append(f"🔴 1H: Far from EMA20 (+{ema20_distance*100:.1f}% FOMO)")
            elif close_now_1h > ema50_now_1h:
                score += 4.8; details.append("🏗️ 1H: Above EMA50 (Strong)")
            elif close_now_1h > ema20_now_1h:
                score += 2.0; details.append("🟡 1H: Above EMA20")
            else:
                score -= 2.4; details.append("⚠️ 1H: Below EMA")

            cond_ema20_slope_1h = calculate_ema_slope(ema20_1h, periods=5)
            if cond_ema20_slope_1h: score += 2.0; details.append("📈 1H EMA20: Positive Slope")

            if 45 <= rsi_1h <= 72: score += 2.4; details.append(f"🌀 1H RSI: Optimal ({rsi_1h:.1f})")
            elif 72 < rsi_1h <= 82: score -= 4.0; details.append(f"⚠️ 1H RSI: Overbought ({rsi_1h:.1f})")
            elif rsi_1h > 82: score -= 10.0; details.append(f"🔴 1H RSI: FOMO Peak ({rsi_1h:.1f})")
            elif rsi_1h < 35: score -= 2.0; details.append(f"❄️ 1H RSI: Weak ({rsi_1h:.1f})")

            if rvol_1h >= 2.5: score += 7.2; details.append(f"🐳 1H RVOL: Money Entry ({rvol_1h:.1f}x)")
            elif rvol_1h >= 1.5: score += 3.2; details.append(f"📊 1H RVOL: High ({rvol_1h:.1f}x)")
            elif rvol_1h < 0.7: score -= 1.6; details.append(f"❄️ 1H RVOL: Volumeless ({rvol_1h:.1f}x)")

            lows_1h = df_1h["Low"].tail(20)
            pivots_1h = []
            for i in range(2, len(lows_1h) - 2):
                if lows_1h.iloc[i] < lows_1h.iloc[i-1] and lows_1h.iloc[i] < lows_1h.iloc[i+1]:
                    pivots_1h.append(lows_1h.iloc[i])
            if len(pivots_1h) >= 2 and pivots_1h[-1] > pivots_1h[-2]:
                score += 2.4; details.append("🔰 1H: Pivot Higher-Low")

            if ATR_MIN_PCT_1H <= atr_pct_1h <= ATR_MAX_PCT_1H:
                score += 2.0

            h1_summary = {
                "Status": "Analyzed",
                "Price/EMA": "Above EMA50" if close_now_1h > ema50_now_1h else "Below EMA50",
                "EMA20 Slope": "Positive" if cond_ema20_slope_1h else "Negative/Flat",
                "RVOL(1H)": f"{rvol_1h:.1f}x ({rvol_durumu})",
                "RSI(14)": f"{rsi_1h:.1f}",
                "ADX(14)": f"{adx_1h:.1f}",
                "ATR%": f"{atr_pct_1h * 100:.2f}%",
                "Structure": "Pivot HL" if len(pivots_1h) >= 2 and pivots_1h[-1] > pivots_1h[-2] else "Normal",
            }
        else:
            score -= 1.2; details.append("⚠️ No 1H Data")

        # ── MTF LOCK ───────────────────────────────────────────────
        # EMA200 threshold is used not to kill quality stocks that dip below EMA50 (Pullback).
        is_1d_bullish = current_price > last_ema200
        if not is_1d_bullish:
            return None

        # ── OBV ──────────────────────────────────────────────────────
        try:
            obv_1d   = OnBalanceVolumeIndicator(close_1d, volume_1d).on_balance_volume()
            obv_tail = obv_1d.tail(OBV_TREND_DAYS).values
            obv_slope = np.polyfit(range(len(obv_tail)), obv_tail, 1)[0]
        except Exception:
            obv_slope = 0.0

        if obv_slope > 1000: score += 6.0; details.append("✅ OBV: Strong Accumulation")
        elif obv_slope > 0: score += 2.4; details.append("📈 OBV: Positive Trend")
        elif obv_slope < -1000: score -= 3.2; details.append("⚠️ OBV: Distribution Risk")
        else: score -= 0.8; details.append("➖ OBV: Neutral")

        # ── RVOL (1D) & FAKE VOLUME (CHURN) PROTECTION ──────────────────
        vol_today = float(volume_1d.iloc[-1])
        vol_ma_1d = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_today
        rvol_today = (vol_today / vol_ma_1d) if vol_ma_1d > 0 else 0.0
        close_change_pct = (float(close_1d.iloc[-1]) - float(close_1d.iloc[-2])) / float(close_1d.iloc[-2]) if len(close_1d) > 1 else 0.0

        # Candle Body Analysis
        open_today = float(df_1d['Open'].iloc[-1])
        high_today = float(high_1d.iloc[-1])
        low_today = float(low_1d.iloc[-1])
        candle_range = high_today - low_today
        candle_body = abs(current_price - open_today)
        churn_ratio = (candle_body / candle_range) if candle_range > 0 else 1.0

        # Fake Spike & Churn Protection (Probability of Sideways Binding)
        # 🔧 BONUS FIX: Original code had a broken `if` block here (bare `return None`
        # with no condition above it) — that's an IndentationError that would crash
        # this entire function. Restored proper churn-detection logic.
        if churn_ratio < 0.30 and rvol_today > 2.0:
            # Volume exists but candle body is very small (Doji/Pinbar). This is not momentum, it is churn.
            return None
            
        if rvol_today > 2.5 and close_change_pct < -0.015:
            return None

        try:
            price_20d_range = (high_1d.tail(20).max() - low_1d.tail(20).min()) / current_price
            if 0 < price_20d_range < 0.08:
                return None  # Chronically stable (Dead Money - Bandwidth expanded)
        except Exception:
            pass

        if 1.2 <= rvol_today <= 1.8 and abs(close_change_pct) < 0.006:
            score += 6.4; details.append(f"🐋 RVOL Regime: Quiet Accumulation ({rvol_today:.2f}x)")
        elif rvol_today > 2.0 and close_change_pct > 0.008:
            score += 8.0; details.append(f"🚀 RVOL Regime: Swing Awakening ({rvol_today:.2f}x)")
        elif rvol_today > 1.5:
            score += 3.2; details.append(f"📊 RVOL Regime: Active ({rvol_today:.2f}x)")
        elif rvol_today < 0.6:
            score -= 3.2; details.append(f"🐢 RVOL Regime: Volumeless ({rvol_today:.2f}x)")
        else:
            score += 0.8; details.append(f"➖ RVOL Regime: Normal ({rvol_today:.2f}x)")

        # ── VOLUME TREND ─────────────────────────────────────────────
        vol_avg5  = float(volume_1d.tail(VOLUME_INCREASE_LOOKBACK).mean())
        vol_avg20 = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_avg5
        vol_increase_ratio = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 0.0

        if vol_increase_ratio > 1.4: score += 7.2; details.append(f"🔥 Volume Trend: Increase ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio > 1.1: score += 4.0; details.append(f"📈 Volume Trend: Early ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio < 0.8: score -= 2.4; details.append(f"📉 Volume Trend: Weak ({vol_increase_ratio:.2f}x)")
        else: score += 0.8; details.append(f"➖ Volume Trend: Stable ({vol_increase_ratio:.2f}x)")

        # ── MARKET REGIME ─────────────────────────────────────────────
        market_regime = MARKET_STATUS.get("regime", "UNKNOWN")
        try:
            ema50_10d_ago = float(ema50_1d.iloc[-10]) if len(ema50_1d) >= 10 else float(ema50_1d.iloc[-1])
            ema50_slope_check = (float(ema50_1d.iloc[-1]) - ema50_10d_ago) / ema50_10d_ago if ema50_10d_ago > 0 else 0.0
        except Exception:
            ema50_slope_check = 0.0
        vol_5d_trend = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 1.0
        if ema50_slope_check > 0 and vol_5d_trend > 1.1:
            score += 3.2; details.append("🟢 Trend-Volume Synced")
        if market_regime == "STRONG":
            if ema50_slope_check > 0: score += 3.2; details.append("💎 STRONG Market Alignment")
        elif market_regime == "BULLISH":
            if vol_5d_trend >= 0.80: score += 1.6; details.append("✅ Bullish Market Alignment")
        elif market_regime == "CHOPPY":
            if vol_5d_trend >= 0.75 and ema50_slope_check > 0: score += 3.2; details.append("✅ Solid Signal in Choppy")
            else: score -= 3.2; details.append("⚠️ Choppy Market Weak Structure")

        # ── SMART MONEY FLOW ──────────────────────────────────────────
        smart_money = analyze_smart_money_flow(df_1d, ticker, cached_info)
        if smart_money['has_smart_flow']:
            score += smart_money['score'] * 0.8
            details.extend(smart_money['details'])

        # ── RISING STOCK ──────────────────────────────────────────────
        rising = detect_rising_stock(df_1d)
        if rising['is_rising']:
            score += rising['score'] * 0.6
            details.extend(rising['details'])

        # ── ICHIMOKU ─────────────────────────────────────────────────
        try:
            if len(df_1d) >= 60:
                df_ichi = calculate_ichimoku(df_1d)
                ichi_result = check_ichimoku_setup(df_ichi)
                if ichi_result['valid']:
                    score += ichi_result['bonus']
                    details.append(ichi_result['msg'])
        except Exception:
            pass

        # ── VOLUME PROFILE ────────────────────────────────────────────
        try:
            vp_result = check_volume_profile(df_1d)
            if vp_result['valid']:
                score += vp_result['bonus']
                details.append(vp_result['msg'])
        except Exception:
            pass

        # ── MFI ───────────────────────────────────────────────────────
        mfi_val = smart_money.get('mfi', 50.0)

        # ── TP/SL HESAPLAMA ───────────────────────────────────────────
        profit_target, stop_loss = calculate_profit_target(
            current_price, atr_1d, score, is_exhausted, beta
        )
        risk   = max(current_price - stop_loss, 0.0)
        reward = max(profit_target - current_price, 0.0)
        rr_ratio_calc = (reward / risk) if risk > 0 else 0.0
        profit_expectation_pct = (reward / current_price) * 100 if current_price > 0 else 0.0

        # ── ENTRY TRIGGER ─────────────────────────────────────
        entry_trigger = None
        try:
            ema9_now  = float(EMAIndicator(close_1d, 9).ema_indicator().iloc[-1])
            ema9_prev = float(EMAIndicator(close_1d, 9).ema_indicator().iloc[-2])
            ema20_now = float(ema20_1d.iloc[-1])
            ema20_prev = float(ema20_1d.iloc[-2])
            ema50_now_1d = float(ema50_1d.iloc[-1])
        except Exception:
            ema9_now = ema9_prev = ema20_now = ema20_prev = ema50_now_1d = 0.0

        ema_cross = ema9_now > ema20_now and ema9_prev <= ema20_prev
        ema_stack = ema9_now > ema20_now > ema50_now_1d
        bb_squeeze = bb_width_1d < 0.05
        ema9_slope = (ema9_now - ema9_prev) / ema9_prev if ema9_prev > 0 else 0.0
        micro_volume = rvol_today > 1.2

        # Stealth Breakout Definition: Price above EMA20, RSI awakening, Volume normal/mild (0.9 - 1.3)
        is_early_awakening = (current_price > ema20_now) and (45 <= rsi_1d_val <= 55) and (0.9 <= rvol_today <= 1.3)

        if bb_squeeze and ema_stack and rvol_today > 1.3:
            score += 10.0; entry_trigger = "BB Squeeze + EMA Stack + Volume"
            details.append("💥 ENTRY: Squeeze → Breakout (Strong)")
        elif is_early_awakening:
            score += 8.8; entry_trigger = "Early Awakening (Stealth Breakout)"
            details.append("🌅 ENTRY: Early Awakening (Strategic entry before volume)")
        elif ema_cross and 1.2 <= rvol_today <= 1.8:
            score += 8.0; entry_trigger = "EMA9/20 Crossover + Micro Volume"
            details.append("🎯 ENTRY: EMA9/20 Cross + Micro Volume")
        elif ema9_slope > 0.003 and bb_squeeze and micro_volume:
            score += 6.4; entry_trigger = "EMA9 Slope + Squeeze + Micro Volume"
            details.append("⚡ ENTRY: EMA9 Dynamic Start")
        elif ema20_now > ema50_now_1d and close_change_pct > 0.006:
            score += 4.8; entry_trigger = "Trend Continuation Swing"
            details.append("↗️ ENTRY: Trend Continuation")
        elif rising.get('is_rising') and rising.get('pattern') in ['Pullback Reversal', 'Base Breakout', 'Gaining Momentum']:
            score += 4.0; entry_trigger = f"Rising: {rising['pattern']}"
            details.append(f"📈 ENTRY: {rising['pattern']}")
        else:
            score -= 1.2; details.append("⏳ ENTRY: No trigger yet")

        if rr_ratio_calc < (MIN_RR_RATIO_RELAXED if entry_trigger else MIN_RR_RATIO):
            score -= 4.0; details.append(f"⚠️ R/R Insufficient ({rr_ratio_calc:.2f})")

        # ── PERFORMANS VERİLERİ ───────────────────────────────────────
        try:
            ret_5g_pct = float((close_1d.iloc[-1] - close_1d.iloc[-6]) / close_1d.iloc[-6] * 100) if len(close_1d) >= 6 else 0.0
            ret_1d_pct = float((close_1d.iloc[-1] - close_1d.iloc[-2]) / close_1d.iloc[-2] * 100) if len(close_1d) >= 2 else 0.0
        except Exception:
            ret_5g_pct = 0.0; ret_1d_pct = 0.0

        dollar_volume_val = current_price * avg_volume_10d
        hold_days = estimate_hold_time(score, vol_increase_ratio, profit_expectation_pct, atr_pct_1d * 100, is_exhausted)
        volume_regime_str = "Expansion" if vol_increase_ratio > 1.4 else "Early" if vol_increase_ratio > 1.1 else "Flat"

        details.append(f"💰 TP/SL: ${profit_target:.2f} / ${stop_loss:.2f} (R/R: {rr_ratio_calc:.2f})")
        exhaust_tag = " [EXHAUSTED]" if is_exhausted else ""
        logging.info(f"✅ {ticker}: Analysis complete (Score: {score:.2f}{exhaust_tag})")

        return {
            "ticker": ticker,
            "score": round(score, 2),
            "df_1d": df_1d,
            "df_1h": df_1h,
            "current_price": current_price,
            "entry_price": current_price,
            "profit_expectation_pct": profit_expectation_pct,
            "hold_days": hold_days,
            "sector": sector_name,
            "market_cap": market_cap,
            "avg_volume": avg_volume_10d,
            "beta": beta,
            "short_float": short_float,
            "atr_pct": round(atr_pct_1d * 100, 2),
            "rsi_14": round(rsi_1d_val, 1),
            "rsi_1h": round(rsi_1h, 1),
            "adx": round(adx_1d, 1),
            "adx_1h": round(adx_1h, 1),
            "mfi": round(mfi_val, 1),
            "cmf": round(cmf_val, 4),
            "macd_hist": round(macd_hist_val, 3),
            "ema20": round(last_ema20, 2),
            "ema50": round(last_ema50, 2),
            "ema200": round(last_ema200, 2),
            "relative_strength": rs_label,
            "profit_target": round(profit_target, 2),
            "stop_loss": round(stop_loss, 2),
            "rr_ratio": round(rr_ratio_calc, 2),
            "entry_trigger": entry_trigger or "None Yet",
            "volume_regime": volume_regime_str,
            "rvol_today": round(rvol_today, 2),
            "rvol_5_30": round(rvol_5_30, 3),
            "ret_1d_pct": round(ret_1d_pct, 2),
            "ret_5g_pct": round(ret_5g_pct, 2),
            "dollar_volume": dollar_volume_val,
            "green_candles_10d": green_candles,
            "is_exhausted": is_exhausted,
            "trend_status_1d": trend_durumu_1d,
            "details": details,
            "d1_summary": d1_summary,
            "h1_summary": h1_summary,
            "smart_money": smart_money,
            "rising_data": rising,
            "meta": {"1d": d1_summary, "1h": h1_summary, "volume_regime": volume_regime_str},
            # Layer 3 heavy data fields (filled later)
            "insider_data": {'has_insider': False, 'score': 0.0, 'details': []},
            "financial_health": {},
            "catalyst_data": {'has_catalyst': False, 'score': 0.0, 'reasons': []},
            "opt_sentiment": {},
            "tsi": 0.0, "msi": 0.0, "vrs": 0.0, "vps": 0.0,
            "nfi": 0.0, "sss": 0.0, "rcs": 0.0, "pfi": 0.0,
            "ifi": 0.0, "ffi": 0.0, "composite_score": 0.0,
        }

    except Exception as e:
        logging.error(f"🔴 apply_atmaca_filters({ticker}): {e}")
        return None

# ================================================================
# SECTION 8.5: MICRO MOMENTUM (15m) CONFIRMATION MODULE
# ================================================================
async def analyze_15m_micro_momentum(ticker: str) -> dict:
    """Measures RSI, Price and Volume momentum on the 15-minute chart."""
    try:
        stock = yf.Ticker(ticker)
        # Only last 5 days of 15m data lightens the network load
        df_15m = await asyncio.to_thread(stock.history, period="5d", interval="15m")

        if df_15m is None or len(df_15m) < 15:
            return {"micro_score": 0.0, "msg": "Insufficient 15m data"}

        close = df_15m['Close']
        volume = df_15m['Volume']

        # 1. 15m RSI Trend
        rsi_15m_series = RSIIndicator(close, 14).rsi()
        rsi_now = float(rsi_15m_series.iloc[-1])
        rsi_prev = float(rsi_15m_series.iloc[-2])

        # 2. 15m Price Momentum (Is last close higher than previous?)
        price_up = close.iloc[-1] > close.iloc[-2]

        # 3. 15m Volume Momentum (Does current volume exceed last 10 bar average?)
        vol_ma10 = volume.tail(10).mean()
        vol_now = float(volume.iloc[-1])
        vol_up = vol_now > vol_ma10

        # Micro Scoring (Max 10 Points)
        score = 0.0
        
        # If RSI has made a bottom reversal and is not overbought
        if 45 <= rsi_now <= 75 and rsi_now > rsi_prev:
            score += 4.0
        
        # If price is triggered upwards
        if price_up:
            score += 3.0
            
        # If money entry (volume) supports
        if vol_up:
            score += 3.0

        return {
            "micro_score": score,
            "rsi_15m": round(rsi_now, 1),
            "msg": f"15m RSI: {rsi_now:.1f} | Volume: {'Increasing' if vol_up else 'Weak'}"
        }
    except Exception as e:
        logging.error(f"❌ 15m Analysis Error ({ticker}): {e}")
        return {"micro_score": 0.0, "msg": "Error"}
        
# ================================================================
# ================================================================
# SECTION 9: 8-FACTOR COMPOSITE SCORE
# ================================================================
# ================================================================

def compute_multi_factor_score(c: dict) -> float:
    """Layer 3 Composite Score (RVOL × Trend × Momentum × ADX × DollarVol × Volatility)"""
    base_score = c.get("score", 0.0)
    d1 = c.get("meta", {}).get("1d", {})

    rvol_raw = c.get("rvol_5_30", 1.0)
    rvol_zscore = min(max((rvol_raw - 1.0) / 0.5 * 4, 0.0), 14.0)

    trend_score = 0.0
    # NOTE: d1_summary uses English keys, trend_status_1d uses English values.
    if d1.get("EMA20 Slope") == "Positive": trend_score += 4.0
    adx_str = str(d1.get("ADX", "0")).replace("%", "").strip()
    try: adx_val = float(adx_str)
    except Exception: adx_val = 0.0
    if adx_val >= 30: trend_score += 8.0
    elif adx_val >= 25: trend_score += 6.0
    elif adx_val >= 18: trend_score += 4.0
    trend_durumu = str(d1.get("Trend Status", ""))
    if "Macro" in trend_durumu: trend_score = min(trend_score + 4.0, 12.0)
    elif "Upward" in trend_durumu: trend_score = min(trend_score + 2.0, 12.0)

    ret_5g = c.get("ret_5g_pct", 0.0)
    ret_accel = 12.0 if ret_5g >= 8.0 else 8.0 if ret_5g >= 5.0 else 6.0 if ret_5g >= 3.0 else 4.0 if ret_5g >= 1.5 else 2.0 if ret_5g > 0 else 0.0

    adx_norm = min(adx_val / 40.0 * 12.0, 12.0)

    dollar_vol = c.get("dollar_volume", 0.0) or 0.0
    dv_norm = 12.0 if dollar_vol >= 50e6 else 8.0 if dollar_vol >= 20e6 else 6.0 if dollar_vol >= 10e6 else 4.0 if dollar_vol >= 5e6 else 2.0

    atr_str = str(d1.get("ATR%", "3%")).replace("%", "")
    try: atr_pct = float(atr_str)
    except Exception: atr_pct = 3.0
    vol_expand = 12.0 if 4.0 <= atr_pct <= 8.0 else 8.0 if (3.0 <= atr_pct < 4.0 or 8.0 < atr_pct <= 10.0) else 4.0 if atr_pct < 3.0 else 2.0

    layer3_composite = (
        rvol_zscore * 0.40 + trend_score * 0.25 + ret_accel * 0.20 +
        adx_norm * 0.05 + dv_norm * 0.05 + vol_expand * 0.05
    )
    final_score = base_score + (layer3_composite * 2.5)
    if c.get("is_exhausted"):
        final_score *= 0.70

    c.update({
        "rvol_zscore": round(rvol_zscore, 2), "trend_score": round(trend_score, 2),
        "ret_accel": round(ret_accel, 2), "adx_norm": round(adx_norm, 2),
        "dv_norm": round(dv_norm, 2), "vol_expand": round(vol_expand, 2),
        "tsi": round(trend_score, 2), "msi": round(ret_accel, 2),
        "vrs": round(vol_expand, 2), "vps": round(rvol_zscore, 2),
        "nfi": round(dv_norm, 2), "sss": round(trend_score, 2),
        "composite_score": round(layer3_composite, 2),
    })
    c["score"] = round(final_score, 2)
    return final_score

# ================================================================
# ================================================================
# SECTION 10: BOGA AI SCORE OUT OF 100
# ================================================================
# ================================================================

def compute_boga_score_100(c: dict) -> float:
    """
    🎯 BOGA AI FINAL SCORE (0-100) — SINGLE USER-FRIENDLY DECISION VALUE.

    This is the only value shown as 'score' in the report and JSON.
    Others (raw 'score', 'composite_score') are internal calculation 
    intermediate values only; the only field the external consumer should look at is boga_score_100.

    Technical (70%) + Fundamental (15%) + Risk/Reward (15%)
    """
    score_100 = 0.0

    # ── TECHNICAL (70 points) ────────────────────────────────────────────
    # Composite score normalize: 0-200 arası → 0-35 puan
    composite = c.get("composite_score", 0.0)
    score_100 += min(composite / 14.0 * 35.0, 35.0)

    # RSI optimal zone (0-10 points)
    rsi = c.get("rsi_14", 50.0)
    if 45 <= rsi <= 65: score_100 += 10.0
    elif 40 <= rsi < 45 or 65 < rsi <= 72: score_100 += 7.0
    elif 35 <= rsi < 40 or 72 < rsi <= 78: score_100 += 3.0

    # ADX (0-10 puan)
    adx = c.get("adx", 0.0)
    if adx >= 30: score_100 += 10.0
    elif adx >= 25: score_100 += 8.0
    elif adx >= 20: score_100 += 5.0
    elif adx >= 15: score_100 += 2.0

    # MACD Hist pozitif ve yükselen (0-5 puan)
    macd_h = c.get("macd_hist", 0.0)
    if macd_h > 0.05: score_100 += 5.0
    elif macd_h > 0: score_100 += 3.0

    # MFI (0-5 puan)
    mfi = c.get("mfi", 50.0)
    if 50 <= mfi <= 70: score_100 += 5.0
    elif 40 <= mfi < 50: score_100 += 3.0

    # RVOL (0-5 puan)
    rvol = c.get("rvol_today", 1.0)
    if rvol >= 2.0: score_100 += 5.0
    elif rvol >= 1.5: score_100 += 3.0
    elif rvol >= 1.2: score_100 += 1.0

    # ── FUNDAMENTAL (15 puan) ───────────────────────────────────────
    fin = c.get("financial_health", {})
    if fin:
        gross_m = fin.get("gross_margin", 0)
        if gross_m >= 40: score_100 += 5.0
        elif gross_m >= 25: score_100 += 3.0
        elif gross_m >= 15: score_100 += 1.5

        rev_growth = fin.get("revenue_growth", 0)
        if rev_growth >= 15: score_100 += 5.0
        elif rev_growth >= 8: score_100 += 3.0
        elif rev_growth >= 3: score_100 += 1.5

        fcf = fin.get("fcf_yield", 0)
        if fcf >= 5: score_100 += 5.0
        elif fcf >= 3: score_100 += 3.0
        elif fcf >= 1: score_100 += 1.5
    else:
        score_100 += 5.0  # Give neutral score if no data

    # ── RISK / REWARD (15 points) ─────────────────────────────────────
    # Use boga_zones data in Risk/Reward section
    rr = c.get("boga_rr", c.get("rr_ratio", 0.0))
    if rr >= 2.5: score_100 += 15.0
    elif rr >= 2.0: score_100 += 12.0
    elif rr >= 1.5: score_100 += 8.0
    elif rr >= 1.2: score_100 += 4.0

    # Exhausted penalty
    if c.get("is_exhausted"):
        score_100 *= 0.75

    return round(min(score_100, 100.0), 1)

# ================================================================
# ================================================================
# SECTION 11: DIVERSIFIED SELECTION
# ================================================================
# ================================================================

def build_diversified_toplist(candidates: list, max_per_sector: int = MAX_PER_SECTOR, total: int = 20) -> list:
    if not candidates: return []
    sorted_cands = sorted(
        [c for c in candidates if c.get("score", -99) > -50],
        key=lambda x: x.get("score", 0.0), reverse=True
    )
    final_list, sector_counts, remaining = [], {}, []
    for cand in sorted_cands:
        sec = cand.get("sector", "Unknown")
        if sector_counts.get(sec, 0) < max_per_sector and len(final_list) < total:
            final_list.append(cand)
            sector_counts[sec] = sector_counts.get(sec, 0) + 1
        else:
            remaining.append(cand)
    if len(final_list) < total and remaining:
        needed = total - len(final_list)
        final_list.extend(remaining[:needed])
    return final_list[:total]

# ================================================================
# ================================================================
# SECTION 12: GEMINI AI SUMMARIES (6 LANGUAGES) — BOGA AI Core Engine v113
# ================================================================
# ================================================================

def safe_json_parse(text: str):
    """Improved safe parse function for extracting JSON from AI response."""
    if not text: return None
    try:
    # 1. Clean attempt (if Markdown blocks are cleaned)
        clean_text = re.sub(r"```json\s*", "", text)
        clean_text = re.sub(r"```\s*", "", clean_text)
        clean_text = clean_text.strip()
        return json.loads(clean_text)
    except Exception:
        # 2. Re-search attempt (Search for outermost {} blocks)
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                json_part = match.group()
                # Clean common JSON errors (trailing comma etc.)
                json_part = re.sub(r",\s*\}", "}", json_part)
                json_part = re.sub(r",\s*\]", "]", json_part)
                return json.loads(json_part)
            except Exception:
                pass
    return None

async def generate_gemini_summary(c: dict, fin_health: dict, zones: dict) -> dict:
    """
    BOGA AI 'Kartal Yuvası Alpha Commander v5.5' — High Performance Unified Engine.
    Produces all languages with a single smart request to overcome Speed and Rate Limit issues.
    """
    if not GEMINI_API_KEY:
        return _fallback_summary(c)

    ticker = c.get("ticker", "")
    score_100 = c.get("boga_score_100", 0.0)
    
    # ── Data Preparation ───────────────────────────────────────────────────────
    perf = c.get("performance", {})
    df_1d = c.get("df_1d")
    ohlc_str = df_1d.tail(10)[['Open', 'High', 'Low', 'Close', 'Volume']].to_string() if df_1d is not None and len(df_1d) >= 10 else "N/A"

    # Context Package
    ctx = {
        "ticker": ticker,
        "company": c.get("company", ticker),
        "sector": c.get("sector", "Unknown"),
        "price": c.get("current_price", 0.0),
        "score": score_100,
        "trend": c.get("trend_durumu_1d", "Neutral"),
        "rsi": c.get("rsi_14", 50.0),
        "adx": c.get("adx", 0.0),
        "macd": c.get("macd_hist", 0.0),
        "ema20": c.get("ema20", 0.0),
        "ema50": c.get("ema50", 0.0),
        "ema200": c.get("ema200", 0.0),
        "rev_g": fin_health.get("revenue_growth", 0),
        "mcap": fin_health.get("market_cap_b", 0),
        "buy": f"${zones.get('buy_zone',{}).get('low',0):.2f}-${zones.get('buy_zone',{}).get('high',0):.2f}",
        "target": f"${zones.get('sell_zone',{}).get('high',0):.2f}",
        "stop": f"${zones.get('stop_zone',{}).get('high',0):.2f}",
        "rr": f"{zones.get('rr_ratio',0.0):.1f}:1",
        "ohlc": ohlc_str
    }

    prompt = f"""
You are a senior Wall Street Analyst. Analyze {ctx['ticker']} ({ctx['company']}) for global institutional investors.
Current Context: Price ${ctx['price']} | BOGA Score {ctx['score']}/100 | Trend: {ctx['trend']}

TACTICAL SETUP:
- Entry: {ctx['buy']}
- Targets: {ctx['target']}
- Stop Protection: {ctx['stop']}
- Risk/Reward: {ctx['rr']}

REAL HISTORICAL DATA (Last 10 Days):
{ctx['ohlc']}

TASK:
Return analysis in 6 languages: EN, TR, ES, PT, FR, ID.
Provide high-res detail (350+ words total) per language using these sections:
### 1. Business & Sector Context (Core business and catalysts)
### 2. Market Performance (Price action and volume review)
### 3. Technical Matrix (MUST include a Markdown table of provided OHLC data + Trend/MA/Verdict: Strong Buy/Buy/Neutral/Sell)
### 4. Risk Mitigation (Fundamental and market-based risks)
### 5. Execution Strategy (Clear entry/target/stop logic)

OUTPUT FORMAT: Strict valid JSON.
{{
  "homepage": {{ "en": "...", "tr": "...", "es": "...", "pt": "...", "fr": "...", "id": "..." }},
  "detail":   {{ "en": "Markdown...", "tr": "Markdown...", "es": "...", "pt": "...", "fr": "...", "id": "..." }}
}}
"""
    for attempt in range(2):
        try:
            url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.4,
                    "maxOutputTokens": 8192, # Maximum possible for 6 languages room
                }
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=75) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = safe_json_parse(raw_text)
                        if parsed and "homepage" in parsed and "detail" in parsed:
                            logging.info(f"✅ {ticker}: Unified Gemini Analizi Başarılı")
                            return {{
                                "homepage_summary": parsed["homepage"],
                                "detail_summary": parsed["detail"]
                            }}
                        else:
                            logging.error(f"❌ {ticker}: JSON Parsing Error (Attempt {{attempt+1}})")
                    elif resp.status == 429:
                        logging.warning(f"⚠️ {ticker}: Rate Limit (Attempt {{attempt+1}})")
                        await asyncio.sleep(5)
            await asyncio.sleep(2)
        except Exception as e:
            logging.error(f"⚠️ {ticker}: Unified Request Exception: {{e}}")
    
    return _fallback_summary(c)


# ================================================================
# FALLBACK — Activates when Gemini API is inaccessible
# High quality template summaries supported by data, customized per language,
# in accordance with the "Kartal Yuvası Alpha Commander v5.5" protocol.
# ================================================================

def _fallback_summary(c: dict) -> dict:
    """
    High quality fallback that produces a professional 5-section report even when the API cannot be reached.
    """
    ticker = c.get("ticker", ""); company = c.get("company", ticker)
    price = c.get("current_price", 0.0); score = c.get("boga_score_100", 0.0)
    trend = c.get("trend_durumu_1d", "Bullish")
    zones = c.get("boga_zones", {}); buy = zones.get("buy_zone", {"low": 0, "high":0})
    tgt = zones.get("sell_zone", {"high": 0}); stp = zones.get("stop_zone", {"high": 0})
    rr = zones.get("rr_ratio", 0.0); sector = c.get("sector", "Market")

    lang_titles = {
        "en": ["Industry Insight", "Performance Review", "Technical Matrix", "Risk Profile", "Execution Strategy", "Verdict"],
        "tr": ["Sektörel Bakış", "Performans Değerlendirmesi", "Teknik Analiz", "Risk Profili", "Uygulama Stratejisi", "Karar"],
        "es": ["Perspectiva Industrial", "Resumen de Desempeño", "Análisis Técnico", "Perfil de Riesgo", "Estrategia de Ejecución", "Veredicto"],
        "pt": ["Perspectiva Industrial", "Resumo de Desempenho", "Análise Técnica", "Perfil de Risco", "Estratégia de Execução", "Veredito"],
        "fr": ["Perspective Industrielle", "Revue de Performance", "Analyse Technique", "Profil de Risque", "Stratégie d'Exécution", "Verdict"],
        "id": ["Wawasan Industri", "Tinjauan Performa", "Analisis Teknikal", "Profil Risiko", "Strategi Eksekusi", "Putusan"]
    }

    lang_data = {
        "en": {
            "desc": f"{company} is showing institutional interest in the {sector} sector. BOGA AI indicates a tactical score of {score:.0f}/100, aligning with the current {trend} volume profile.",
            "perf": f"The stock is currently trading at ${price:.2f}. Momentum indicators suggest entry is optimal within the identified strategic zones.",
            "tech": f"Technical matrix shows active bullish accumulation. EMA structures are supportive of the current leg up.",
            "risk": f"Primary risks involve general market volatility and volume rotation. Disciplined use of stop losses at ${stp.get('high',0):.2f} is mandatory.",
            "entry": "Entry Zone", "target": "Short-term Target", "stop": "Stop Protection", "rr": "Risk/Reward Reward", "disclaimer": "Not Financial Advice"
        },
        "tr": {
            "desc": f"{company} is attracting institutional interest in the {sector} sector. BOGA AI shows a tactical score of {score:.0f}/100, consistent with the current {trend} volume profile.",
            "perf": f"The stock is currently trading at ${price:.2f}. Momentum indicators show that entry is optimal in identified strategic zones.",
            "tech": f"Technical matrix shows active bull accumulation. EMA structures support the current rise.",
            "risk": f"Basic risks include general market volatility and sector rotation. Disciplined use of stop loss at ${stp.get('high',0):.2f} is mandatory.",
            "entry": "Entry Zone", "target": "Short-term Target", "stop": "Stop Loss Protection", "rr": "Risk/Reward Ratio", "disclaimer": "Not Investment Advice"
        },
        "es": {
            "desc": f"{company} está mostrando interés institucional en el sector {sector}. BOGA AI indica una puntuación táctica de {score:.0f}/100, alineándose con el perfil de volumen {trend} actual.",
            "perf": f"La acción cotiza actualmente a ${price:.2f}. Los indicadores de impulso sugieren que la entrada es óptima dentro de las zonas estratégicas identificadas.",
            "tech": f"La matriz técnica muestra una acumulación alcista activa. Las estructuras de EMA respaldan el tramo actual de subida.",
            "risk": f"Los riesgos principales incluyen la volatilidad general del mercado y la rotación de volumen. El uso disciplinado de stop loss en ${stp.get('high',0):.2f} es obligatorio.",
            "entry": "Zona de Entrada", "target": "Objetivo a Corto Plazo", "stop": "Protección de Stop", "rr": "Relación Riesgo/Beneficio", "disclaimer": "No es asesoramiento financiero"
        },
        "pt": {
            "desc": f"{company} está mostrando interesse institucional no setor {sector}. BOGA AI indica uma pontuação tática de {score:.0f}/100, alinhando-se com o perfil de volume {trend} atual.",
            "perf": f"A ação está sendo negociada atualmente a ${price:.2f}. Os indicadores de momentum sugerem que a entrada é ideal dentro das zonas estratégicas identificadas.",
            "tech": f"A matriz técnica mostra acumulação de alta ativa. As estruturas de EMA apoiam a perna atual de alta.",
            "risk": f"Os riscos principais envolvem a volatilidade geral do mercado e a rotação de volume. O uso disciplinado de stop loss em ${stp.get('high',0):.2f} é obrigatório.",
            "entry": "Zona de Entrada", "target": "Alvo de Curto Prazo", "stop": "Proteção de Stop", "rr": "Relação Risco/Recompensa", "disclaimer": "Não é aconselhamento financeiro"
        },
        "fr": {
            "desc": f"{company} suscite un intérêt institutionnel dans le secteur {sector}. BOGA AI indique un score tactique de {score:.0f}/100, en phase avec le profil de volume {trend} actuel.",
            "perf": f"L'action se négocie actuellement à ${price:.2f}. Les indicateurs de momentum suggèrent que l'entrée est optimale dans les zones stratégiques identifiées.",
            "tech": f"La matrice technique montre une accumulation haussière active. Les structures EMA soutiennent la phase de hausse actuelle.",
            "risk": f"Les principaux risques concernent la volatilité générale du marché et la rotation des volumes. L'utilisation disciplinée des stop loss à ${stp.get('high',0):.2f} est obligatoire.",
            "entry": "Zone d'Entrée", "target": "Objectif à Court Terme", "stop": "Protection Stop", "rr": "Rapport Risque/Récompense", "disclaimer": "Pas un conseil financier"
        },
        "id": {
            "desc": f"{company} menunjukkan minat institusional di sektor {sector}. BOGA AI menunjukkan skor taktis {score:.0f}/100, selaras dengan profil volume {trend} saat ini.",
            "perf": f"Saham saat ini diperdagangkan pada ${price:.2f}. Indikator momentum menunjukkan entri optimal dalam zona strategis yang diidentifikasi.",
            "tech": f"Matriks teknikal menunjukkan akumulasi bullish aktif. Struktur EMA mendukung kenaikan saat ini.",
            "risk": f"Risiko utama melibatkan volatilitas pasar umum dan rotasi volume. Penggunaan stop loss yang disiplin pada ${stp.get('high',0):.2f} adalah wajib.",
            "entry": "Zona Masuk", "target": "Target Jangka Pendek", "stop": "Perlindungan Stop", "rr": "Rasio Risiko/Imbalan", "disclaimer": "Bukan Nasihat Keuangan"
        }
    }

    homepage_summaries = {
        "en": f"BOGA AI rates {ticker} at {score:.0f}/100 within a {trend} trend. Macro targets suggest ${tgt.get('high',0):.2f}.",
        "tr": f"BOGA AI gave a score of {score:.0f}/100 in the {trend} trend for {ticker}. Target zone: ${tgt.get('high',0):.2f}.",
        "es": f"BOGA AI califica a {ticker} con {score:.0f}/100 en una tendencia {trend}. Los objetivos sugieren ${tgt.get('high',0):.2f}.",
        "pt": f"BOGA AI avalia {ticker} em {score:.0f}/100 em uma tendência {trend}. Os alvos sugerem ${tgt.get('high',0):.2f}.",
        "fr": f"BOGA AI évalue {ticker} à {score:.0f}/100 dans une tendance {trend}. Les objectifs suggèrent ${tgt.get('high',0):.2f}.",
        "id": f"BOGA AI menilai {ticker} pada {score:.0f}/100 dalam tren {trend}. Target makro menunjukkan ${tgt.get('high',0):.2f}."
    }

    detail_summaries = {}
    for lang, tags in lang_titles.items():
        ld = lang_data[lang]
        detail_summaries[lang] = f"""
### 1. {tags[0]}
{ld['desc']}

### 2. {tags[1]}
{ld['perf']}

### 3. {tags[2]}
{ld['tech']}
**{tags[5]}:** BUY / ACCUMULATE

### 4. {tags[3]}
{ld['risk']}

### 5. {tags[4]}
- **{ld['entry']}:** ${buy.get('low',0):.2f} - ${buy.get('high',0):.2f}
- **{ld['target']}:** ${tgt.get('high',0):.2f}
- **{ld['stop']}:** ${stp.get('high',0):.2f}
- **{ld['rr']}:** {rr:.1f}:1

*{ld['disclaimer']}*
"""
    return {
        "homepage_summary": homepage_summaries,
        "detail_summary":   detail_summaries,
    }



    # ── RSI context translated into human language ───────────────────────────────────
    if rsi >= 70:
        rsi_ctx_en = f"RSI at {rsi:.0f} — the stock is in overbought territory, so a brief pullback before the next leg up is possible"
        rsi_ctx_tr = f"RSI {rsi:.0f} in overbought territory — a pullback after short-term rise could continue"
        rsi_ctx_es = f"RSI en {rsi:.0f} — sobrecomprado, posible corrección breve antes de continuar al alza"
        rsi_ctx_pt = f"RSI em {rsi:.0f} — sobrecomprado, possível recuo breve antes de continuar em alta"
        rsi_ctx_fr = f"RSI à {rsi:.0f} — suracheté, une correction courte est possible avant la prochaine hausse"
        rsi_ctx_id = f"RSI di {rsi:.0f} — jenuh beli, koreksi singkat mungkin terjadi sebelum melanjutkan naik"
    elif rsi >= 55:
        rsi_ctx_en = f"RSI at {rsi:.0f} — momentum is building in the healthy bullish zone without being overextended"
        rsi_ctx_tr = f"RSI {rsi:.0f} in healthy bullish territory — momentum is strengthening without going too far"
        rsi_ctx_es = f"RSI en {rsi:.0f} — impulso saludable, sin sobreextensión"
        rsi_ctx_pt = f"RSI em {rsi:.0f} — momentum saudável, sem sobreextensão"
        rsi_ctx_fr = f"RSI à {rsi:.0f} — momentum haussier sain, sans surextension"
        rsi_ctx_id = f"RSI di {rsi:.0f} — momentum bullish sehat, tidak berlebihan"
    else:
        rsi_ctx_en = f"RSI at {rsi:.0f} — still neutral; a catalyst is needed to confirm the breakout"
        rsi_ctx_tr = f"RSI {rsi:.0f} in neutral territory — catalyst expected to confirm breakout"
        rsi_ctx_es = f"RSI en {rsi:.0f} — neutral, se necesita catalizador para confirmar la ruptura"
        rsi_ctx_pt = f"RSI em {rsi:.0f} — neutro, precisa de catalisador para confirmar o rompimento"
        rsi_ctx_fr = f"RSI à {rsi:.0f} — neutre, un catalyseur est nécessaire pour confirmer la cassure"
        rsi_ctx_id = f"RSI di {rsi:.0f} — netral, butuh katalis untuk konfirmasi breakout"

    # ── ADX context ──────────────────────────────────────────────────────────
    if adx >= 25:
        adx_ctx_en = f"with ADX at {adx:.0f} confirming a genuine trend"
        adx_ctx_tr = f"ADX {adx:.0f} confirms the existence of a real trend"
        adx_ctx_es = f"con ADX en {adx:.0f} confirmando una tendencia real"
        adx_ctx_pt = f"com ADX em {adx:.0f} confirmando uma tendência real"
        adx_ctx_fr = f"avec un ADX à {adx:.0f} confirmant une vraie tendance"
        adx_ctx_id = f"dengan ADX {adx:.0f} mengkonfirmasi tren nyata"
    else:
        adx_ctx_en = f"though ADX at {adx:.0f} suggests the trend is still maturing"
        adx_ctx_tr = f"but ADX {adx:.0f} points to the trend still being in maturation phase"
        adx_ctx_es = f"aunque el ADX en {adx:.0f} indica que la tendencia aún madura"
        adx_ctx_pt = f"embora ADX em {adx:.0f} indique que a tendência ainda está se formando"
        adx_ctx_fr = f"bien que l'ADX à {adx:.0f} suggère que la tendance est encore en formation"
        adx_ctx_id = f"meskipun ADX {adx:.0f} menunjukkan tren masih dalam pematangan"

    # ── MACD context ─────────────────────────────────────────────────────────
    macd_dir_en = "positive MACD histogram" if macd_h > 0 else "MACD histogram turning negative"
    macd_dir_tr = "positive MACD histogram" if macd_h > 0 else "MACD histogram turning negative"
    macd_dir_es = "histograma MACD positivo" if macd_h > 0 else "histograma MACD girando negativo"
    macd_dir_pt = "histograma MACD positivo" if macd_h > 0 else "histograma MACD virando negativo"
    macd_dir_fr = "histogramme MACD positif" if macd_h > 0 else "histogramme MACD virant négatif"
    macd_dir_id = "histogram MACD positif" if macd_h > 0 else "histogram MACD berbalik negatif"

    # ── Valuation context ────────────────────────────────────────────────────
    if pe > 40:
        pe_ctx_en = f"At P/E {pe:.0f}x, the valuation is high — which means the market expects strong growth; any earnings miss could trigger a sharp correction"
        pe_ctx_tr = f"P/E {pe:.0f}x valuation is high — market expects strong growth; earnings disappointment could trigger sharp correction"
        pe_ctx_es = f"Con P/E {pe:.0f}x, la valoración es elevada — el mercado exige crecimiento sostenido; una decepción en ganancias podría generar corrección"
        pe_ctx_pt = f"Com P/L {pe:.0f}x, a avaliação é alta — o mercado exige crescimento forte; uma decepção nos lucros pode gerar correção"
        pe_ctx_fr = f"Avec un P/E à {pe:.0f}x, la valorisation est élevée — le marché exige une forte croissance; une déception sur les bénéfices pourrait provoquer une correction"
        pe_ctx_id = f"Dengan P/E {pe:.0f}x, valuasi tinggi — pasar mengharapkan pertumbuhan kuat; kekecewaan laba dapat memicu koreksi tajam"
    elif pe > 0:
        pe_ctx_en = f"P/E at {pe:.0f}x is reasonable for the sector, leaving room for re-rating if earnings accelerate"
        pe_ctx_tr = f"P/E {pe:.0f}x is reasonable for the sector — potential for re-valuation if earnings accelerate"
        pe_ctx_es = f"P/E de {pe:.0f}x es razonable para el sector, con margen de revalorización si los beneficios aceleran"
        pe_ctx_pt = f"P/L de {pe:.0f}x é razoável para o setor, com espaço para reavaliação se os lucros acelerarem"
        pe_ctx_fr = f"Le P/E à {pe:.0f}x est raisonnable pour le secteur, avec une marge de revalorisation si les bénéfices s'accélèrent"
        pe_ctx_id = f"P/E {pe:.0f}x wajar untuk sektor ini, dengan ruang rerating jika laba meningkat"
    else:
        pe_ctx_en = "Valuation data is limited — weight technical signals more heavily for this setup"
        pe_ctx_tr = "Valuation data limited — give more weight to technical signals in this setup"
        pe_ctx_es = "Datos de valoración limitados — priorizar señales técnicas para este setup"
        pe_ctx_pt = "Dados de avaliação limitados — priorizar sinais técnicos neste setup"
        pe_ctx_fr = "Données de valorisation limitées — privilégier les signaux techniques pour ce setup"
        pe_ctx_id = "Data valuasi terbatas — lebih utamakan sinyal teknikal untuk setup ini"

    # ════════════════════════════════════════════════════════════════════════
    # SUMMARIES — 6 LANGUAGES
    # ════════════════════════════════════════════════════════════════════════

    summaries = {}

    # ── EN — English ─────────────────────────────────────────────────────────
    summaries["en"] = (
        # homepage
        f"BOGA AI assigns {ticker} a score of {score:.0f}/100 in a {trend} trend — "
        f"entry zone ${buy_low:.2f}–${buy_high:.2f} targets ${sell_h:.2f} with a {rr:.1f}:1 risk/reward.",

        # detail
        f"{company} operates in the {sector} sector, and BOGA AI's algorithm flagged it "
        f"with a {score:.0f}/100 score after detecting institutional accumulation signals aligned "
        f"with a {trend} daily trend. "
        f"On the technical side, {rsi_ctx_en}, {adx_ctx_en}, "
        f"and the {macd_dir_en} reinforces the directional bias. "
        f"Fundamentally, the company is growing revenue at {rev_g:.1f}% with a net margin of {net_m:.1f}%, "
        f"which means it keeps ${net_m:.1f} of profit for every $100 in sales. "
        f"{pe_ctx_en}. "
        f"The tactical setup: buy between ${buy_low:.2f} and ${buy_high:.2f}, "
        f"target ${sell_h:.2f}, and place a hard stop at ${stop_h:.2f} — "
        f"a {rr:.1f}:1 reward-to-risk ratio that makes this a disciplined swing trade candidate."
    )

    # ── TR — Turkish ───────────────────────────────────────────────────────────
    summaries["tr"] = (
        # homepage
        f"BOGA AI gave {ticker} a score of {score:.0f}/100 in {trend} trend — "
        f"${buy_low:.2f}–${buy_high:.2f} entry zone, ${sell_h:.2f} target, {rr:.1f}:1 risk/reward ratio.",

        # detail
        f"{company} operates in the {sector} sector and BOGA AI algorithm, "
        f"detecting institutional accumulation signals and {trend} daily trend, assigned {score:.0f}/100 score to the stock. "
        f"On the technical side {rsi_ctx_tr}, {adx_ctx_tr} and {macd_dir_tr} support directional bias. "
        f"From a fundamental perspective, while company grows revenue by {rev_g:.1f}%, "
        f"net profit margin is {net_m:.1f}% — meaning it makes {net_m:.1f} dollars profit from every 100 dollars of sales. "
        f"{pe_ctx_tr}. "
        f"Operational plan: Entry from ${buy_low:.2f}–${buy_high:.2f} range, "
        f"${sell_h:.2f} profit target, ${stop_h:.2f} hard stop — "
        f"{rr:.1f}:1 risk/reward ratio makes it a disciplined swing trade opportunity."
    )

    # ── ES — Español ──────────────────────────────────────────────────────────
    summaries["es"] = (
        # homepage
        f"BOGA AI otorga a {ticker} una puntuación de {score:.0f}/100 en tendencia {trend} — "
        f"zona de entrada ${buy_low:.2f}–${buy_high:.2f}, objetivo ${sell_h:.2f}, relación riesgo/beneficio {rr:.1f}:1.",

        # detail
        f"{company} opera en el sector {sector}, y el algoritmo BOGA AI le asignó {score:.0f}/100 "
        f"al detectar señales de acumulación institucional alineadas con una tendencia {trend} diaria. "
        f"Técnicamente, {rsi_ctx_es}, {adx_ctx_es}, "
        f"y el {macd_dir_es} refuerza el sesgo direccional. "
        f"En lo fundamental, la empresa crece sus ingresos al {rev_g:.1f}% con un margen neto del {net_m:.1f}% — "
        f"es decir, retiene ${net_m:.1f} de ganancia por cada $100 en ventas. "
        f"{pe_ctx_es}. "
        f"El plan táctico: comprar entre ${buy_low:.2f} y ${buy_high:.2f}, "
        f"objetivo ${sell_h:.2f}, stop definitivo en ${stop_h:.2f} — "
        f"una relación recompensa/riesgo de {rr:.1f}:1 que lo convierte en candidato ideal para swing trade."
    )

    # ── PT — Português ────────────────────────────────────────────────────────
    summaries["pt"] = (
        # homepage
        f"BOGA AI atribui ao {ticker} uma pontuação de {score:.0f}/100 em tendência {trend} — "
        f"zona de entrada ${buy_low:.2f}–${buy_high:.2f}, alvo ${sell_h:.2f}, relação risco/retorno {rr:.1f}:1.",

        # detail
        f"{company} atua no setor de {sector}, e o algoritmo BOGA AI atribuiu {score:.0f}/100 "
        f"ao detectar sinais de acumulação institucional alinhados com uma tendência {trend} diária. "
        f"No âmbito técnico, {rsi_ctx_pt}, {adx_ctx_pt}, "
        f"e o {macd_dir_pt} reforça o viés direcional. "
        f"Nos fundamentos, a empresa cresce receita a {rev_g:.1f}% com margem líquida de {net_m:.1f}% — "
        f"ou seja, retém ${net_m:.1f} de lucro para cada $100 em vendas. "
        f"{pe_ctx_pt}. "
        f"O plano tático: comprar entre ${buy_low:.2f} e ${buy_high:.2f}, "
        f"alvo ${sell_h:.2f}, stop definitivo em ${stop_h:.2f} — "
        f"uma relação retorno/risco de {rr:.1f}:1 que o torna candidato ideal para swing trade."
    )

    # ── FR — Français ─────────────────────────────────────────────────────────
    summaries["fr"] = (
        # homepage
        f"BOGA AI attribue à {ticker} un score de {score:.0f}/100 en tendance {trend} — "
        f"zone d'entrée ${buy_low:.2f}–${buy_high:.2f}, objectif ${sell_h:.2f}, ratio risque/rendement {rr:.1f}:1.",

        # detail
        f"{company} opère dans le secteur {sector}, et l'algorithme BOGA AI lui a attribué {score:.0f}/100 "
        f"après avoir détecté des signaux d'accumulation institutionnelle alignés sur une tendance {trend} journalière. "
        f"Techniquement, {rsi_ctx_fr}, {adx_ctx_fr}, "
        f"et le {macd_dir_fr} renforce le biais directionnel. "
        f"Sur le plan fondamental, l'entreprise affiche une croissance des revenus de {rev_g:.1f}% "
        f"avec une marge nette de {net_m:.1f}% — soit ${net_m:.1f} de bénéfice pour chaque $100 de ventes. "
        f"{pe_ctx_fr}. "
        f"Le plan tactique : achat entre ${buy_low:.2f} et ${buy_high:.2f}, "
        f"objectif ${sell_h:.2f}, stop définitif à ${stop_h:.2f} — "
        f"un ratio rendement/risque de {rr:.1f}:1 qui en fait un candidat idéal pour le swing trade."
    )

    # ── ID — Bahasa Indonesia ─────────────────────────────────────────────────
    summaries["id"] = (
        # homepage
        f"BOGA AI memberi {ticker} skor {score:.0f}/100 dalam tren {trend} — "
        f"zona beli ${buy_low:.2f}–${buy_high:.2f}, target ${sell_h:.2f}, rasio risiko/imbalan {rr:.1f}:1.",

        # detail
        f"{company} beroperasi di sektor {sector}, dan algoritma BOGA AI menetapkan skor {score:.0f}/100 "
        f"setelah mendeteksi sinyal akumulasi institusional yang selaras dengan tren {trend} harian. "
        f"Secara teknikal, {rsi_ctx_id}, {adx_ctx_id}, "
        f"dan {macd_dir_id} memperkuat bias arah pergerakan. "
        f"Secara fundamental, perusahaan tumbuh pendapatannya {rev_g:.1f}% dengan margin bersih {net_m:.1f}% — "
        f"artinya setiap $100 penjualan menghasilkan ${net_m:.1f} keuntungan bersih. "
        f"{pe_ctx_id}. "
        f"Rencana taktis: beli di antara ${buy_low:.2f} dan ${buy_high:.2f}, "
        f"target ${sell_h:.2f}, stop ketat di ${stop_h:.2f} — "
        f"rasio imbalan/risiko {rr:.1f}:1 menjadikannya kandidat swing trade yang terukur."
    )

    return {
        "homepage_summary": {k: v[0] for k, v in summaries.items()},
        "detail_summary":   {k: v[1] for k, v in summaries.items()},
    }

# ================================================================
# ================================================================
# SECTION 13: TELEGRAM
# ================================================================
# ================================================================

def tg(text: str) -> str:
    if not text: return ""
    escaped = html.escape(text)
    allowed = {"&lt;b&gt;": "<b>", "&lt;/b&gt;": "</b>", "&lt;i&gt;": "<i>", "&lt;/i&gt;": "</i>",
               "&lt;u&gt;": "<u>", "&lt;/u&gt;": "</u>", "&lt;code&gt;": "<code>",
               "&lt;/code&gt;": "</code>", "&lt;pre&gt;": "<pre>", "&lt;/pre&gt;": "</pre>"}
    for k, v in allowed.items(): escaped = escaped.replace(k, v)
    return escaped


def split_html_safe(text: str, max_len: int = 3800) -> list:
    """Tries to maintain HTML integrity by splitting message at nearest space or line start."""
    if len(text) <= max_len: return [text]
    parts, current_part = [], ""
    lines = text.split("\n")
    for line in lines:
        if len(current_part) + len(line) + 1 > max_len:
            if current_part: parts.append(current_part.strip())
            current_part = line + "\n"
        else:
            current_part += line + "\n"
    if current_part: parts.append(current_part.strip())
    return parts


async def send_telegram_message(message: str):
    if not ENABLE_TELEGRAM_NOTIFICATIONS or not TELEGRAM_API_KEY: return
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    async with aiohttp.ClientSession() as session:
        for idx, part in enumerate(split_html_safe(tg(message)), 1):
            try:
                async with session.post(url, data={"chat_id": TELEGRAM_CHAT_ID, "text": part, "parse_mode": "HTML"}, timeout=15) as resp:
                    if resp.status != 200:
                        logging.error(f"❌ Telegram ({idx}): {await resp.text()}")
            except Exception as e:
                logging.error(f"⚠️ Telegram connection error ({idx}): {e}")


async def send_telegram_photo(photo_path: str, caption: str = ""):
    if not TELEGRAM_API_KEY or not os.path.exists(photo_path): return
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendPhoto"
    async with aiohttp.ClientSession() as session:
        try:
            with open(photo_path, "rb") as img:
                form = aiohttp.FormData()
                form.add_field("chat_id", TELEGRAM_CHAT_ID)
                form.add_field("caption", tg(caption))
                form.add_field("parse_mode", "HTML")
                form.add_field("photo", img, filename=os.path.basename(photo_path), content_type="image/png")
                async with session.post(url, data=form, timeout=20) as resp:
                    if resp.status != 200:
                        logging.error(f"❌ Telegram foto: {await resp.text()}")
        except Exception as e:
            logging.error(f"⚠️ Telegram Photo Error: {e}")

# ================================================================
# ================================================================
# SECTION 14: JSON OUTPUT GENERATOR
# ================================================================
# ================================================================

def build_json_output(top10: list, generated_at: str) -> dict:
    """
    Prepares Top 10 stocks in JSON format.
    Includes BOGA AI score, BUY/SELL/STOP ZONE, technical indicators,
    fundamentals, performance and 6 language summaries.
    """
    picks = []
    for i, c in enumerate(top10):
        ticker   = c.get("ticker", "")
        price    = c.get("current_price", 0.0)
        zones    = c.get("boga_zones", {})
        fin      = c.get("financial_health", {})
        summ     = c.get("ai_summary", {})
        perf     = c.get("performance", {})
        d1       = c.get("d1_summary", {})
        h1       = c.get("h1_summary", {})

        # Market Cap format
        mcap_raw = c.get("market_cap", 0) or 0
        if mcap_raw >= 1e12: mcap_str = f"{mcap_raw/1e12:.2f}T"
        elif mcap_raw >= 1e9: mcap_str = f"{mcap_raw/1e9:.2f}B"
        elif mcap_raw >= 1e6: mcap_str = f"{mcap_raw/1e6:.1f}M"
        else: mcap_str = str(mcap_raw)

        pick = {
            "rank": i + 1,
            "ticker": ticker,
            "company": c.get("company", ticker),
            "sector": c.get("sector", "Unknown"),
            "score": c.get("boga_score_100", 0.0),
            "boga_score": c.get("boga_score_100", 0.0), # Backward compatibility
            "market_regime": MARKET_STATUS.get("regime", "Bull"),
            "current_price": price,
            # 🔧 FIX #5: holding_period is now an estimate — not a hard rule.
            # Smart Tracker on the frontend MUST switch to "Peak Profit Reached / Closed"
            # when current price >= profit_target_price (see tracker_logic block below).
            "holding_period_estimate": f"{c.get('hold_days', 5)}-{c.get('hold_days', 5) + 5} Days (max)",
            "holding_period": f"{c.get('hold_days', 5)}-{c.get('hold_days', 5) + 5} Days",  # legacy field kept for compat
            "status": "WAITING_FOR_ENTRY",  # initial status — frontend updates this live
            "tracker_logic": {
                # Frontend Smart Tracker should evaluate these in order:
                "entry_zone_low":     zones.get("buy_zone", {}).get("low", 0),
                "entry_zone_high":    zones.get("buy_zone", {}).get("high", 0),
                "profit_target_low":  zones.get("sell_zone", {}).get("low", 0),
                "profit_target_high": zones.get("sell_zone", {}).get("high", 0),
                "stop_loss_high":     zones.get("stop_zone", {}).get("high", 0),
                "max_hold_days":      c.get("hold_days", 5) + 5,
                "exit_rule":          "EXIT_ON_TARGET_OR_STOP_OR_MAX_HOLD",
                # Pseudocode for frontend:
                #   if price <= stop_loss_high          → status = "STOPPED_OUT"
                #   elif price >= profit_target_low     → status = "PEAK_PROFIT_REACHED"
                #   elif entry_zone_low <= price <= entry_zone_high → status = "IN_ENTRY_ZONE"
                #   elif days_since_pick > max_hold_days → status = "TIME_EXIT"
                #   else                                 → status = "HOLDING"
            },
            
            # 🔥 Flattened Fields for Frontend Compatibility
            "buy_zone": zones.get("buy_zone", {"low": 0, "high": 0}),
            "profit_zone": zones.get("sell_zone", {"low": 0, "high": 0}),
            "stop_zone": zones.get("stop_zone", {"low": 0, "high": 0}),
            "reasoning": summ.get("homepage_summary", {}).get("en", "BOGA AI analysis in progress..."),
            "detail_reasoning": summ.get("detail_summary", {}).get("en", ""),
            "adx": c.get("adx", 0.0),
            "rsi": c.get("rsi_14", 50.0),
            "rvol": c.get("rvol_today", 1.0),
            "change_1d": perf.get("1d", 0.0),
            "change_1w": perf.get("1w", 0.0),
            "change_1m": perf.get("1m", 0.0),
            "change_1y": perf.get("1y", 0.0),
            "change_5y": perf.get("5y", 0.0),

            # ── BOGA AI MODEL ANALYSIS ─────────────────────────────
            "boga_zones": {
                "buying_zone": zones.get("buy_zone", {"low": 0, "high": 0}),
                "sell_zone":   zones.get("sell_zone", {"low": 0, "high": 0}),
                "stop_loss_zone": zones.get("stop_zone", {"low": 0, "high": 0}),
                "risk_reward": zones.get("rr_ratio", 0.0),
                "support_1h": zones.get("support_1h", 0.0),
                "resistance_1h": zones.get("resist_1h", 0.0),
                "atr_1d": zones.get("atr_1d", 0.0),
                "atr_pct": zones.get("atr_pct", 0.0),
                "risk_usd": zones.get("risk_usd", 0.0),
                "reward_usd": zones.get("reward_usd", 0.0),
            },

            # ── TREND STATUS & INDICATORS ──────────────────────────
            "trend_status": {
                "trend": d1.get("Trend Status", "N/A"),
                "rsi_14": c.get("rsi_14", 50.0),
                "adx": c.get("adx", 0.0),
                "macd_hist": c.get("macd_hist", 0.0),
                "mfi": c.get("mfi", 50.0),
                "cmf": c.get("cmf", 0.0),
                "rvol_today": c.get("rvol_today", 0.0),
                "entry_trigger": c.get("entry_trigger", ""),
                "is_exhausted": c.get("is_exhausted", False),
            },

            # ── MOVING AVERAGES ────────────────────────────────────
            "moving_averages": {
                "ema_20": c.get("ema20", 0.0),
                "ema_50": c.get("ema50", 0.0),
                "ema_200": c.get("ema200", 0.0),
                "price_vs_ema20": round(price - c.get("ema20", price), 2),
                "price_vs_ema50": round(price - c.get("ema50", price), 2),
                "price_vs_ema200": round(price - c.get("ema200", price), 2),
                "ema20_slope": d1.get("EMA20 Slope", "N/A"),
            },

            # ── 1H ANALYSIS ─────────────────────────────────────────
            "hourly_analysis": {
                "rsi_1h": c.get("rsi_1h", 50.0),
                "adx_1h": c.get("adx_1h", 0.0),
                "rvol_1h": h1.get("RVOL(1H)", "N/A"),
                "ema_structure": h1.get("Price/EMA", "N/A"),
                "pivot_structure": h1.get("Structure", "N/A"),
            },

            # ── FUNDAMENTAL MARGINS ────────────────────────────────
            "fundamentals": {
                "gross_margin_pct":     fin.get("gross_margin", 0),
                "operating_margin_pct": fin.get("operating_margin", 0),
                "net_margin_pct":       fin.get("net_margin", 0),
                "revenue_growth_pct":   fin.get("revenue_growth", 0),
                "pe_ratio":             fin.get("pe_ratio", 0),
                "pb_ratio":             fin.get("pb_ratio", 0),
                "fcf_yield_pct":        fin.get("fcf_yield", 0),
                "market_cap":           mcap_str,
                "market_cap_usd":       mcap_raw,
            },

            # ── PERFORMANCE ─────────────────────────────────────────
            "performance": {
                "1d_pct":  perf.get("1d", 0.0),
                "1w_pct":  perf.get("1w", 0.0),
                "1m_pct":  perf.get("1m", 0.0),
                "1y_pct":  perf.get("1y", 0.0),
                "5y_pct":  perf.get("5y", 0.0),
            },

            # ── FACTOR DIFFERENTIATION (only for technical visualization; final score boga_score_100) ─
            "factor_scores": {
                "trend_score":   c.get("tsi", 0.0),
                "momentum_score": c.get("msi", 0.0),
                "volatility_score": c.get("vrs", 0.0),
                "volume_score":  c.get("vps", 0.0),
                "financial_score": c.get("ffi", 0.0),
                "catalyst_score": c.get("pfi", 0.0),
                "insider_score": c.get("ifi", 0.0),
                # The following two fields are internal calculation intermediate values, NOT the final score:
                "composite":     c.get("composite_score", 0.0),
                "raw_score":     c.get("score", 0.0),
            },

            # ── BOGA AI SUMMARIES (6 LANGUAGES) ───────────────────────────
            "ai_summary": {
                "homepage_summary": summ.get("homepage_summary", {}),
                "detail_summary":   summ.get("detail_summary", {}),
            },
        }
        picks.append(pick)

    return {
        "generated_at": generated_at,
        "date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
        "model": "BOGA AI V113",
        "market_regime": MARKET_STATUS.get("regime", "Bull"),
        "total_picks": len(picks),
        "picks": picks,
    }

# ================================================================
# ================================================================
# SECTION 15: TELEGRAM REPORT BLOCK — BOGA AI Core Engine v113
# ================================================================
# ================================================================

def classify_risk(rr: float) -> str:
    """Quality classification according to Risk/Reward ratio."""
    if rr >= 3.0: return "🏆 S (Elite)"
    if rr >= 2.5: return "💎 A+ (Premium)"
    if rr >= 2.0: return "✅ A (Strong)"
    if rr >= 1.8: return "🟡 B+ (Good)"
    if rr >= 1.5: return "🟠 B (Medium)"
    return "🔴 C (Weak)"


def classify_rsi(rsi: float) -> str:
    """Translates RSI value into human language."""
    if rsi >= 75: return "⚠️ Overbought — High pullback risk"
    if rsi >= 65: return "🔥 Strong Momentum — Careful follow-up"
    if rsi >= 55: return "📈 Healthy Bullish Zone"
    if rsi >= 45: return "➡️ Neutral — Waiting for catalyst"
    if rsi >= 35: return "📉 Under Pressure — Recovery follow-up"
    return "❄️ Oversold — Potential reversal opportunity"


def classify_adx(adx: float) -> str:
    """Interprets ADX value as trend strength."""
    if adx >= 40: return "🚀 Very Strong Trend — Momentum near peak"
    if adx >= 30: return "💪 Strong Trend — Institutional interest exists"
    if adx >= 25: return "📊 Confirmed Trend — Healthy move"
    if adx >= 20: return "🌊 Medium Trend — Maturing"
    return "😴 Weak Trend — Range-bound caution"


def classify_macd(macd_hist: float) -> str:
    """Interprets MACD histogram."""
    if macd_hist > 0.05:  return f"✅ Positive ({macd_hist:+.3f}) — Supports breakout"
    if macd_hist > 0:     return f"🟡 Mild Positive ({macd_hist:+.3f}) — Momentum building"
    if macd_hist > -0.05: return f"🟠 Mild Negative ({macd_hist:+.3f}) — Watch carefully"
    return f"🔴 Negative ({macd_hist:+.3f}) — Selling pressure exists"


def classify_mfi(mfi: float) -> str:
    """Money Flow Index interpretation."""
    if mfi >= 70: return f"{mfi:.1f} — 💰 Strong Money Entry (Institutional accumulation)"
    if mfi >= 55: return f"{mfi:.1f} — 📥 Money Flow Positive"
    if mfi >= 45: return f"{mfi:.1f} — ↔️ Neutral Money Flow"
    if mfi >= 30: return f"{mfi:.1f} — 📤 Money Outflow"
    return f"{mfi:.1f} — 🚨 Strong Money Outflow (Distribution risk)"


def ema_gap(price: float, ema: float, label: str) -> str:
    """Shows price position relative to EMA."""
    if price <= 0 or ema <= 0:
        return f"${ema:.2f} (No data)"
    pct = ((price - ema) / ema) * 100
    arrow = "▲" if pct >= 0 else "▼"
    return f"${ema:.2f}  {arrow} {abs(pct):.1f}% {'above' if pct >= 0 else 'below'}"


def format_mcap(mcap_raw: float) -> str:
    """Converts market cap to readable format."""
    if mcap_raw >= 1e12: return f"${mcap_raw/1e12:.2f}T"
    if mcap_raw >= 1e9:  return f"${mcap_raw/1e9:.2f}B"
    if mcap_raw > 0:     return f"${mcap_raw/1e6:.0f}M"
    return "N/A"


def verdict_emoji(score: float) -> str:
    """Decision label based on BOGA AI score."""
    if score >= 85: return "🦅 ELITE OPPORTUNITY"
    if score >= 75: return "🐂 STRONG BUY"
    if score >= 65: return "📊 BUY / WATCH"
    if score >= 55: return "⏳ WAIT"
    return "⚠️ WEAK"


def build_candidate_block(rank: int, c: dict) -> str:
    """
    Produces single stock analysis block for Telegram.
    In "Kartal Yuvası Alpha Commander v5.5" format:
    — Appeals to both financial professionals and beginner investors
    — AI summary in Turkish (localized)
    — All indicators explained in simple language
    — No empty/generic sentences; every line contains concrete data
    """

    # ── Temel Kimlik ─────────────────────────────────────────────────────────
    ticker      = c.get("ticker", "")
    sector      = c.get("sector", "Various")
    boga_s      = c.get("boga_score_100", 0.0)
    entry       = c.get("current_price", 0.0)
    mcap_raw    = c.get("market_cap", 0) or 0
    mcap_str    = format_mcap(mcap_raw)
    exhaust_tag = "  ⚠️ EXHAUSTED — Careful!" if c.get("is_exhausted") else ""

    # ── Bölgeler ─────────────────────────────────────────────────────────────
    zones    = c.get("boga_zones", {})
    rr       = zones.get("rr_ratio", c.get("rr_ratio", 0.0))
    risk_cls = classify_risk(rr)
    buy_z    = zones.get("buy_zone",  {})
    sell_z   = zones.get("sell_zone", {})
    stop_z   = zones.get("stop_zone", {})
    sup_1h   = zones.get("support_1h",  0.0)
    res_1h   = zones.get("resist_1h",   0.0)

    # ── Teknik İndikatörler ──────────────────────────────────────────────────
    rsi      = c.get("rsi_14",    50.0)
    adx      = c.get("adx",        0.0)
    macd_h   = c.get("macd_hist",  0.0)
    mfi      = c.get("mfi",       50.0)
    ema20    = c.get("ema20",       0.0)
    ema50    = c.get("ema50",       0.0)
    ema200   = c.get("ema200",      0.0)

    # ── Trend Özeti ───────────────────────────────────────────────────────────
    d1   = c.get("d1_summary", {})
    h1   = c.get("h1_summary", {})
    trend_d1 = d1.get("Trend Status", "N/A")
    trend_h1 = h1.get("Trend Status", "N/A")

    # ── Performans ────────────────────────────────────────────────────────────
    perf = c.get("performance", {})
    p1d  = perf.get("1d", 0.0)
    p1w  = perf.get("1w", 0.0)
    p1m  = perf.get("1m", 0.0)
    p1y  = perf.get("1y", 0.0)
    p5y  = perf.get("5y", 0.0)

    # ── Temel Veriler ─────────────────────────────────────────────────────────
    fin     = c.get("financial_health", {})
    gross_m = fin.get("gross_margin",    0.0)
    op_m    = fin.get("operating_margin", 0.0)
    net_m   = fin.get("net_margin",       0.0)
    rev_g   = fin.get("revenue_growth",   0.0)
    pe      = fin.get("pe_ratio",         0.0)
    pb      = fin.get("pb_ratio",         0.0)
    fcf_y   = fin.get("fcf_yield",        0.0)

    # ── P/E Yorumu ────────────────────────────────────────────────────────────
    if pe > 50:
        pe_yorum = "High valuation — strong growth expected"
    elif pe > 25:
        pe_yorum = "Reasonable valuation — growth priced in"
    elif pe > 0:
        pe_yorum = "Low P/E — potential discount opportunity"
    else:
        pe_yorum = "No data"

    # ── Gelir Büyümesi Yorumu ─────────────────────────────────────────────────
    if rev_g >= 30:
        rev_yorum = "🚀 High growth rate"
    elif rev_g >= 15:
        rev_yorum = "📈 Strong growth"
    elif rev_g >= 5:
        rev_yorum = "📊 Stable growth"
    elif rev_g >= 0:
        rev_yorum = "➡️ Flat growth"
    else:
        rev_yorum = "📉 Revenue contraction"

    # ── AI Summary (Turkish) ─────────────────────────────────────────────────────
    summ      = c.get("ai_summary", {})
    detail_tr = summ.get("detail_summary", {}).get("tr", "")
    home_tr   = summ.get("homepage_summary", {}).get("tr", "")

    # ── BLOK OLUŞTURMA ────────────────────────────────────────────────────────

    block = (
        # ── HEADER ──────────────────────────────────────────────────────────
        f"{'═'*40}\n"
        f"<b>#{rank:02d} — {ticker}</b>  |  {sector}{exhaust_tag}\n"
        f"{'═'*40}\n\n"

        # ── SCORES & IDENTITY ─────────────────────────────────────────────────
        f"🐂 <b>BOGA AI Score: {boga_s:.1f}/100</b>  —  {verdict_emoji(boga_s)}\n"
        f"⚖️ Risk Class: <b>{risk_cls}</b>  |  Risk/Reward: <b>{rr:.1f}:1</b>\n"
        f"💼 Market Cap: <b>{mcap_str}</b>\n"
        f"💵 Current Price: <b>${entry:.2f}</b>\n\n"

        # ── BOGA AI ZONES ────────────────────────────────────────────────
        f"┌─ 🎯 <b>BOGA AI BUY/SELL MAP</b>\n"
        f"│\n"
        f"│  🟢 <b>BUY ZONE     :</b>  ${buy_z.get('low',0):.2f}  –  ${buy_z.get('high',0):.2f}\n"
        f"│     ↳ Ideal entry point if price hits this range\n"
        f"│\n"
        f"│  🎯 <b>PROFIT TARGET :</b>  ${sell_z.get('low',0):.2f}  –  ${sell_z.get('high',0):.2f}\n"
        f"│     ↳ Target zone for partial or full exit\n"
        f"│\n"
        f"│  🔴 <b>STOP LOSS    :</b>  ${stop_z.get('low',0):.2f}  –  ${stop_z.get('high',0):.2f}\n"
        f"│     ↳ Strategy cancelled if this level breaks — cut loss\n"
        f"│\n"
        f"│  📐 1H Support: ${sup_1h:.2f}  |  Resistance: ${res_1h:.2f}\n"
        f"└────────────────────────────────────────\n\n"

        # ── TREND STATUS ─────────────────────────────────────────────────────
        f"📌 <b>TREND STATUS</b>\n"
        f"• Daily (1D) Trend : <b>{trend_d1}</b>\n"
        f"• Hourly (1H) Trend: <b>{trend_h1}</b>\n\n"

        # ── TECHNICAL INDICATORS ──────────────────────────────────────────────
        f"📌 <b>TECHNICAL INDICATORS</b>\n"
        f"• RSI (14)   : {rsi:.1f}  →  {classify_rsi(rsi)}\n"
        f"• ADX        : {adx:.1f}  →  {classify_adx(adx)}\n"
        f"• MACD Hist  : {classify_macd(macd_h)}\n"
        f"• Money Flow : {classify_mfi(mfi)}\n\n"

        # ── MOVING AVERAGES ─────────────────────────────────────────────
        f"📌 <b>MOVING AVERAGES</b>  (Price: ${entry:.2f})\n"
        f"• EMA 20  : {ema_gap(entry, ema20,  'EMA20')}\n"
        f"  ↳ Short-term momentum indicator\n"
        f"• EMA 50  : {ema_gap(entry, ema50,  'EMA50')}\n"
        f"  ↳ Medium-term trend health\n"
        f"• EMA 200 : {ema_gap(entry, ema200, 'EMA200')}\n"
        f"  ↳ Long-term bull/bear separation\n\n"

        # ── PRICE PERFORMANCE ─────────────────────────────────────────────────
        f"📌 <b>PRICE PERFORMANCE</b>\n"
        f"• 1 Day  : <b>{p1d:+.2f}%</b>  |  1 Week: <b>{p1w:+.2f}%</b>  |  1 Month: <b>{p1m:+.2f}%</b>\n"
        f"• 1 Year : <b>{p1y:+.2f}%</b>  |  5 Year : <b>{p5y:+.2f}%</b>\n\n"
    )

    # ── FUNDAMENTAL ANALYSIS (if fin data exists) ──────────────────────────────────────
    if fin:
        block += (
            f"📌 <b>FUNDAMENTAL ANALYSIS</b>  (Company Financial Health)\n"
            f"• Gross Margin    : %{gross_m:.1f}\n"
            f"  ↳ Profit ratio remaining after production/sales cost\n"
            f"• Operating Margin : %{op_m:.1f}\n"
            f"  ↳ Shows how efficiently daily operations work\n"
            f"• Net Profit Margin : %{net_m:.1f}\n"
            f"  ↳ Net profit left to company from every 100$ sales: ${net_m:.1f}\n"
            f"• Revenue Growth    : %{rev_g:.1f}  —  {rev_yorum}\n"
            f"• P/E Ratio         : {pe:.1f}x  —  {pe_yorum}\n"
            f"• P/B Ratio         : {pb:.2f}x\n"
            f"• Free Cash Flow Yield: %{fcf_y:.1f}\n"
            f"  ↳ Real cash value created by company per shareholder\n\n"
        )

    # ── BOGA AI TÜRKÇE ANALİZ ────────────────────────────────────────────────
    #if home_tr:
    #    block += (
    #        f"🐂 <b>BOGA AI KISA ÖZET:</b>\n"
    #        f"<i>{home_tr}</i>\n\n"
    #    )
    #
    #if detail_tr:
    #    # 700 karakter sınırı — detay sayfasına yönlendir
    #    truncated = detail_tr[:700].rsplit(" ", 1)[0] + "…" if len(detail_tr) > 700 else detail_tr
    #    block += (
    #        f"🧠 <b>BOGA AI DETAYLI ANALİZ:</b>\n"
    #        f"<i>{truncated}</i>\n\n"
    #    )

    # ── SUMMARY DECISION BOX ────────────────────────────────────────────────────
    block += (
        f"┌─ ⚡ <b>BOGA AI VERDICT</b>\n"
        f"│  Score   : {boga_s:.1f}/100  —  {verdict_emoji(boga_s)}\n"
        f"│  Entry   : ${buy_z.get('low',0):.2f} – ${buy_z.get('high',0):.2f}\n"
        f"│  Target  : ${sell_z.get('high',0):.2f}\n"
        f"│  Stop    : ${stop_z.get('high',0):.2f}\n"
        f"│  R/R     : {rr:.1f}:1  —  {risk_cls}\n"
        f"└────────────────────────────────────────\n\n"
    )

    return block

# ================================================================
# ================================================================
# SECTION 16: STATS AUTO-UPDATE (Homepage ↔ Performance Sync)
# ================================================================
# ================================================================

def update_swing_performance_stats():
    """
    Automatically calculate the stats part of the swing performance JSON from history data.
    Called every time a scan completes — homepage & performance pages are always in sync.
    """
    try:
        public_dir = os.path.join(os.path.dirname(__file__), "frontend", "public")
        perf_file = os.path.join(public_dir, "swing_performance.json")

        if not os.path.exists(perf_file):
            logging.warning(f"swing_performance.json not found: {perf_file}")
            return

        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        history = data.get('history', [])
        if not history:
            logging.warning("History data empty")
            return

        # Completed trades (PENDING hariç)
        completed = [t for t in history if t.get('result') != 'PENDING']
        if not completed:
            logging.warning("No completed trades")
            return

        # Calculate Stats
        wins = sum(1 for t in completed if t.get('return_pct', 0) > 0)
        losses = sum(1 for t in completed if t.get('return_pct', 0) <= 0)
        avg_return = sum(t.get('return_pct', 0) for t in completed) / len(completed) if completed else 0
        above_5 = sum(1 for t in completed if t.get('return_pct', 0) >= 5)
        above_10 = sum(1 for t in completed if t.get('return_pct', 0) >= 10)

        win_rate = (wins / len(completed) * 100) if completed else 0
        above_5_rate = (above_5 / len(completed) * 100) if completed else 0
        above_10_rate = (above_10 / len(completed) * 100) if completed else 0

        # Update stats
        data['stats']['win_rate'] = round(win_rate, 1)
        data['stats']['avg_return_pct'] = round(avg_return, 1)
        data['stats']['above_5pct_rate'] = round(above_5_rate, 1)
        data['stats']['above_10pct_rate'] = round(above_10_rate, 1)
        data['stats']['total_picks'] = len(history)

        # Write back
        with open(perf_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logging.info(
            f"📊 Stats auto-updated: "
            f"Win Rate {win_rate:.1f}% | "
            f"Avg Return {avg_return:.1f}% | "
            f"Above 10% {above_10_rate:.1f}% | "
            f"Total {len(history)} trades"
        )
    except Exception as e:
        logging.error(f"❌ Stats update error: {e}")

# ================================================================
# ================================================================
# SECTION 17: MAIN SCANNER
# ================================================================
# ================================================================

async def scan_top_stocks():
    """
    BOGA AI MASTER SCANNER V113

    WORKFLOW:
    1. Market + Sector Analysis
    2. Universe Preparation (500 stocks - weekly cache)
    3. 500 stocks → apply_atmaca_filters → min 50 pass
    4. Layer 2: Select top 50 candidates
    5. Layer 3: Deep analysis for 50 (Insider, Options, Financial Health)
    6. 5 final stocks BOGA AI score out of 100
    7. ATR + 1H support/resistance: BUY/SELL/STOP ZONE (R/R 2.5:1)
    8. Stock performance data (1D/1H/1M/1Y/5Y)
    9. Gemini AI summaries (6 languages)
    10. Save JSON + Notify Telegram
    """
    start_time = time.time()
    scanned_count = 0

    # --- REPETITION PREVENTION LOGIC ---
    recently_picked = await get_recently_picked_tickers(days=10)
    # Add last 10 days picks to currently manually excluded ones
    CURRENT_EXCLUSIONS = EXCLUDED_STOCKS.union(recently_picked)
    # ---------------------------------
    
    await send_telegram_message(
        "🐂 <b>BOGA AI SWING TRADE V113 Scanner Started!</b>\n"
        "⏱ Schedule: Weekdays NY 13:00\n"
        "🎯 Goal: Daily Top 5 Swing Trade Opportunities\n"
        "📈 Primary Language: English"
    )

    # ── STEP 1: MARKET ANALYSIS ──────────────────────────────────────
    await analyze_market_and_sectors()
    logging.info(f"⚙️ Regime: {MARKET_STATUS['regime']} | Modifier: {MARKET_STATUS['min_score_modifier']}")

    # ── STEP 2: UNIVERSE (500 stocks - weekly cache) ───────────────────
    MASTER_UNIVERSE = await build_atmaca_universe_full()
    if not MASTER_UNIVERSE:
        await send_telegram_message("❌ Could not create universe!")
        return

    # ── CRITICAL FIX: Filter scan list with CURRENT list only ──
    tickers_to_scan = [t for t in MASTER_UNIVERSE if t not in CURRENT_EXCLUSIONS]
    logging.info(f"📋 Number of stocks to scan (Duplicates removed): {len(tickers_to_scan)}")

    # ── STEP 3: PARALLEL ANALYSIS (500 stocks → at least 50 pass) ─────────
    semaphore = asyncio.Semaphore(2)

    async def sem_analyze(ticker: str):
        nonlocal scanned_count
        async with semaphore:
            await asyncio.sleep(random.uniform(1.5, 3.2))
            try:
                result = await apply_atmaca_filters(ticker)
                scanned_count += 1
                if scanned_count % 50 == 0:
                    logging.info(f"⏳ Progress: {scanned_count}/{len(tickers_to_scan)}")
                return result
            except Exception as e:
                logging.error(f"❌ {ticker}: {e}")
                return None

    tasks = [sem_analyze(t) for t in tickers_to_scan]
    raw_results = await asyncio.gather(*tasks)

    candidates = [r for r in raw_results if r is not None]
    logging.info(f"✅ Layer 2 passed: {len(candidates)} stocks")

    if not candidates:
        await send_telegram_message("⚠️ No candidates found meeting criteria.")
        return
        
    # ── STEP 4: 8-FACTOR SCORE + BEST 50 ──────────────────────────
    for c in candidates:
        compute_multi_factor_score(c)

    candidates_ranked = sorted(
        [c for c in candidates if c.get("composite_score", -99) > -50],
        key=lambda x: x.get("score", 0.0), reverse=True
    )
    top_50 = candidates_ranked[:TOP_DEEP_ANALYSIS]
    logging.info(f"🏆 Layer 2 → Top {len(top_50)} moving to deep analysis.")

    # ── STEP 5: LAYER 3 — DEEP ANALYSIS (Top 50) ───────────────────
    async def fetch_heavy_data(c: dict):
        ticker = c["ticker"]
        try:
            info = get_stock_info(ticker)
            c["sector"] = info.get("sector", c.get("sector", "Unknown"))
            c["beta"] = info.get("beta", c.get("beta", 1.0))

            # Insider
            insider = await asyncio.to_thread(detect_insider_activity, ticker, info)
            if insider.get('has_insider'):
                c["score"] += insider['score']; c["details"].extend(insider['details'])
                c["insider_data"] = insider; c["ifi"] = insider['score']

            # Financial Health
            fin_health = analyze_financial_health(ticker, info)
            if fin_health.get('health_score', 0) > 0:
                c["score"] += fin_health['health_score'] * 0.4
                c["details"].extend(fin_health['details'])
                c["financial_health"] = fin_health; c["ffi"] = fin_health['health_score']

            # Catalyst
            catalyst = check_silent_catalysts(ticker, info)
            if catalyst.get('has_catalyst'):
                c["score"] += catalyst['score']; c["details"].extend(catalyst['reasons'])
                c["catalyst_data"] = catalyst; c["pfi"] = catalyst['score']

            # Legal Risk
            if c.get('score', 0) > 20.0:
                risk_res = await check_legal_risk_live(ticker)
                if risk_res.get('has_risk'):
                    c['score'] -= risk_res['penalty']; c['details'].append(risk_res['msg'])

            # Options Sentiment
            opt = await analyze_options_sentiment(ticker)
            if opt.get('bullish'):
                c["score"] += opt.get('score', 0); c["details"].extend(opt.get('details', []))
                c["opt_sentiment"] = opt

        except Exception as e:
            logging.debug(f"⚠️ {ticker} Layer 3: {e}")

    sem_k3 = asyncio.Semaphore(3)
    async def sem_heavy(c):
        async with sem_k3:
            await asyncio.sleep(random.uniform(0.1, 0.4))
            await fetch_heavy_data(c)

    await asyncio.gather(*(sem_heavy(c) for c in top_50))
    top_50.sort(key=lambda x: x.get("score", 0.0), reverse=True)

    # ── STEP 6: ALPHA VANTAGE VALIDATION ────────────────────────────
    if ENABLE_ALPHA_VALIDATION:
        high_conviction = [c for c in top_50 if c.get('score', 0) >= 35.0][:5]
        for idx, c in enumerate(high_conviction):
            av_result = await _verify_with_alpha_vantage(c['ticker'], c['current_price'])
            c['alpha_validation'] = av_result
            if not av_result.get('validated', True):
                c['score'] -= 10.0
            if idx < len(high_conviction) - 1:
                await asyncio.sleep(12)

    # ── STEP 7: 20 CANDIDATE SELECTION AND 15m MICRO CONFIRMATION (NEW) ────────────────
    # Initially get top 20 candidates by diversifying (we use 20 instead of TOP_FINAL_PICKS)
    top_20_candidates = build_diversified_toplist(top_50, total=20)
    logging.info(f"🔍 15m Micro Momentum (Timing) analysis starting for Top 20 candidates...")

    # Fetch and score 15m data in parallel for 20 candidates
    async def fetch_micro(c):
        micro_data = await analyze_15m_micro_momentum(c["ticker"])
        c["micro_score"] = micro_data.get("micro_score", 0.0)
        c["micro_msg"] = micro_data.get("msg", "")

    await asyncio.gather(*(fetch_micro(c) for c in top_20_candidates))

    # Final Ranking Logic: 
    # First those with highest 15m micro momentum (ready to burst immediately), 
    # in case of equality BOGA AI 1D macro score takes precedence.
    top_20_candidates.sort(
        key=lambda x: (x.get("micro_score", 0.0), x.get("boga_score_100", 0.0)), 
        reverse=True
    )

    # Cut final top 5 candidates (Assign this to original bot variable top_candidates)
    top_candidates = top_20_candidates[:TOP_FINAL_PICKS]
    
    for c in top_candidates:
        logging.info(f"🎯 15m CONFIRM: {c['ticker']} -> Micro Score: {c.get('micro_score')}/10 | {c.get('micro_msg')}")

    # ── STEP 8: BOGA AI ZONE CALCULATION (ATR + 1H Support/Resistance) ─────
    for c in top_candidates:
        trigger = c.get("entry_trigger", "")
        zones = calculate_support_resistance_1h(
            c.get("df_1h"), c.get("df_1d"), c.get("current_price", 0.0), trigger
        )
        
        c["boga_zones"] = zones
        c["boga_rr"] = zones.get("rr_ratio", 0.0)

    # ── R/R HARD ELIMINATION (Realistic floor) ────────────────────────────
    # 🔧 FIX #9: R/R < 1.0 was way too lenient — that means risking $1 for $1.
    # Professional swing setups need at least R/R 1.5 (risk $1 to make $1.50).
    # Setups where risk exceeds reward are not suitable for swing trade.
    top_candidates = [c for c in top_candidates if c.get("boga_rr", 0.0) >= 1.5]
    if not top_candidates:
        logging.warning("⚠️ No candidates left after R/R < 1.5 elimination.")
        await send_telegram_message("⚠️ No setups with R/R 1.5+ in daily scan.")
        return

    # ── STEP 9: BOGA AI SCORE OUT OF 100 ─────────────────────────────────
    for c in top_candidates:
        c["boga_score_100"] = compute_boga_score_100(c)

    # Re-sort by score
    top_candidates.sort(key=lambda x: x.get("boga_score_100", 0.0), reverse=True)
    for i, c in enumerate(top_candidates):
        c["rank"] = i + 1

    # ── STEP 10: PERFORMANCE DATA ─────────────────────────────────
    for c in top_candidates:
        c["performance"] = get_price_performance(c.get("df_1d", pd.DataFrame()), c["ticker"])
        # Company name
        db_info = COMPANY_DATABASE.get(c["ticker"], {})
        c["company"] = db_info.get("name", c["ticker"])

    # ── STEP 11: GEMINI AI SUMMARIES ───────────────────────────────────
    logging.info("🤖 Generating Gemini AI summaries...")
    for c in top_candidates:
        fin_health = c.get("financial_health", {})
        zones = c.get("boga_zones", {})
        summary = await generate_gemini_summary(c, fin_health, zones)
        c["ai_summary"] = summary
        await asyncio.sleep(0.5)  # Gemini rate limit protection

# ── STEP 12: JSON OUTPUT (inday313 and Archive Synchronization) ──────────
    now_ny = datetime.now(NY_TZ)
    generated_at = now_ny.isoformat()
    
    try:
        # 1. Main Directory and Folder Configuration
        # Folder: C:\Users\afksm\finma\frontend\public\data\swing2026
        year_str = now_ny.strftime("%Y")
        base_data_dir = r"C:\Users\afksm\finma\frontend\public\data"
        swing_year_dir = os.path.join(base_data_dir, f"swing{year_str}")
        os.makedirs(swing_year_dir, exist_ok=True)

        # File name: swing_20260426.json format
        file_date_str = now_ny.strftime("%Y%m%d")
        custom_file_name = f"swing_{file_date_str}.json"
        full_archive_path = os.path.join(swing_year_dir, custom_file_name)

        # 2. Prepare JSON Data
        output_all = build_json_output(top_candidates, generated_at)
        output_top5 = build_json_output(top_candidates[:5], generated_at)

        # 3. Save Special Archive for inday313 Reference
        with open(full_archive_path, "w", encoding="utf-8") as f:
            json.dump(output_all, f, indent=2, ensure_ascii=False, default=str)
        logging.info(f"📁 Archived for inday313: {full_archive_path}")

        # 4. Update Frontend Live Dashboard Files
        public_dir = r"C:\Users\afksm\finma\frontend\public"
        os.makedirs(public_dir, exist_ok=True)

        # swing_picks.json (Dashboard side panel/Summary)
        with open(os.path.join(public_dir, "swing_picks.json"), "w", encoding="utf-8") as f:
            json.dump(output_top5, f, indent=2, ensure_ascii=False, default=str)
        
        # swing_all_picks.json (Full list page view)
        with open(os.path.join(public_dir, "swing_all_picks.json"), "w", encoding="utf-8") as f:
            json.dump(output_all, f, indent=2, ensure_ascii=False, default=str)

        # 5. Special Table Format (swing_table.json)
        english_months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        date_str = f"{now_ny.day} {english_months[now_ny.month]}"
        
        table_data = []
        for c in top_candidates:
            z = c.get("boga_zones", {})
            table_data.append({
                "Date": date_str,
                "Symbol": c.get("ticker", ""),
                "Entry (Buy_L)": z.get("buying_zone", {}).get("low", 0.0),
                "Stop (SL)": z.get("stop_loss_zone", {}).get("high", 0.0),
                "Target 1 (TP1)": z.get("sell_zone", {}).get("low", 0.0),
                "Target 2 (TP2)": z.get("sell_zone", {}).get("high", 0.0)
            })
        
        with open(os.path.join(public_dir, "swing_table.json"), "w", encoding="utf-8") as f:
            json.dump(table_data, f, indent=2, ensure_ascii=False)

        logging.info(f"🚀 Dashboard and Archive successfully updated.")

    except Exception as e:
        logging.error(f"❌ JSON save error: {e}")
        

    # ── STEP 13: TELEGRAM REPORT ───────────────────────────────────────
    duration = time.time() - start_time
    now_str = now_ny.strftime("%Y-%m-%d %H:%M %Z")

    # Summary table
    header = (
        f"🐂 <b>ATMACA SWING V113 – TOP {TOP_FINAL_PICKS} PICKS</b>\n"
        f"🕒 <i>{now_str}</i> | ⏱ {duration:.1f}s\n"
        f"📊 <i>{len(tickers_to_scan)} scanned → {len(candidates)} candidates → Top {TOP_FINAL_PICKS}</i>\n"
        f"📈 Market: <b>{MARKET_STATUS['regime']}</b>\n\n"
        "<pre>"
        f"#   SYMBOL   BOGA  SCORE  BUY_L   SELL_H  STOP   R/R\n"
        f"─────────────────────────────────────────────────────\n"
    )
    rows = []
    for i, c in enumerate(top_candidates):
        zones = c.get("boga_zones", {})
        buy_l  = zones.get("buy_zone", {}).get("low", 0)
        sell_h = zones.get("sell_zone", {}).get("high", 0)
        stop_h = zones.get("stop_zone", {}).get("high", 0)
        rr     = zones.get("rr_ratio", 0.0)
        boga_s = c.get("boga_score_100", 0.0)
        score  = c.get("score", 0.0)
        tag = "🚀" if boga_s >= 80 else "🔥" if boga_s >= 65 else "🔍"
        rows.append(
            f"{i+1:02d}. {tag} {c['ticker']:<6} {boga_s:>5.1f} {score:>6.1f}  "
            f"{buy_l:>7.2f} {sell_h:>7.2f} {stop_h:>7.2f} {rr:>4.1f}"
        )

    toplist_msg = header + "\n".join(rows) + "\n─────────────────────────────────────────────────────\n</pre>\n"
    toplist_msg += f"<i>💡 BUY→SELL: R/R~2.5:1 | ATR+1H Support/Resistance | BOGA AI V113</i>\n\n"
    toplist_msg += "<b>📋 Detailed Analysis Below:</b>\n\n"

    # Send Toplist Summary
    await send_telegram_message(toplist_msg)
    # Send each candidate block separately (to prevent HTML explosion)
    for i, c in enumerate(top_candidates):
        block = build_candidate_block(i + 1, c)
        await send_telegram_message(block)
        await asyncio.sleep(0.5) # Telegram flood protection

    save_info_cache()

    # Auto-update stats (homepage ↔ performance sync)
    update_swing_performance_stats()

    logging.info(f"✅ BOGA AI Scan complete. ({scanned_count} stocks scanned | {duration:.1f}s)")


async def _verify_with_alpha_vantage(ticker: str, yahoo_price: float) -> dict:
    """Alpha Vantage cross-validation."""
    cache_key = f"{ticker}_{datetime.now().date()}"
    if cache_key in alpha_vantage_cache:
        return alpha_vantage_cache[cache_key]
    if not ALPHA_VANTAGE_API_KEY:
        return {'validated': True, 'av_price': 0, 'warning': 'No API Key'}
    try:
        url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={ALPHA_VANTAGE_API_KEY}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as resp:
                if resp.status != 200:
                    return {'validated': False, 'av_price': 0, 'warning': 'AV API error'}
                data = await resp.json()
        av_price = float(data.get('Global Quote', {}).get('05. price', 0))
        if av_price == 0:
            return {'validated': False, 'av_price': 0, 'warning': 'AV no data'}
        price_diff_pct = abs((yahoo_price - av_price) / yahoo_price) * 100
        validated = price_diff_pct < 5.0
        result = {'validated': validated, 'av_price': av_price, 'price_diff_pct': price_diff_pct,
                  'warning': None if validated else f"Price diff %{price_diff_pct:.1f}"}
        alpha_vantage_cache[cache_key] = result
        return result
    except Exception as e:
        return {'validated': False, 'av_price': 0, 'price_diff_pct': 0, 'warning': str(e)}

# ================================================================
# ================================================================
# SECTION 17: SCHEDULER
# ================================================================
# ================================================================

def get_next_weekday_run_time_ny(target_hour=13, target_minute=0):
    """Returns the next weekday NY 13:00 time (UTC aware)."""
    now_utc = datetime.now(timezone.utc)
    now_ny  = now_utc.astimezone(NY_TZ)
    candidate_ny = now_ny.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    if candidate_ny <= now_ny:
        candidate_ny += timedelta(days=1)
    while candidate_ny.weekday() >= 5:
        candidate_ny += timedelta(days=1)
    candidate_utc = candidate_ny.astimezone(timezone.utc)
    if candidate_utc <= now_utc:
        candidate_utc = (now_ny + timedelta(days=1)).replace(
            hour=target_hour, minute=target_minute, second=0, microsecond=0
        ).astimezone(timezone.utc)
    return candidate_utc


async def run_scanner():
    """Main loop — Runs every day at NY 13:00."""
    await send_telegram_message(
        "🐂 <b>BOGA AI SWING TRADE V113 Started!</b>\n"
        "📅 Schedule: Every weekday New York 13:00\n"
        "🎯 Goal: Daily Top 5 Swing Trade Opportunities\n"
        "💡 JSON: swing_picks_boga.json\n"
        "📊 R/R: ~2.5:1 target | ATR + 1H Support/Resistance"
    )

    # Initial scan
    try:
        logging.info("▶ Initial scan starting...")
        await scan_top_stocks()
    except Exception as e:
        logging.error(f"Startup scan error: {e}")
        await send_telegram_message(f"🚨 Startup error: {e}")

    # Infinite loop
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            next_run_utc = get_next_weekday_run_time_ny()
            wait_seconds = (next_run_utc - now_utc).total_seconds()

            if wait_seconds < 0 or wait_seconds > 90000:
                next_run_utc = get_next_weekday_run_time_ny()
                wait_seconds = (next_run_utc - datetime.now(timezone.utc)).total_seconds()

            logging.info(
                f"🕒 Next scan: {next_run_utc.strftime('%Y-%m-%d %H:%M %Z')} "
                f"(~{wait_seconds/3600:.2f} hours)"
            )
            await asyncio.sleep(wait_seconds)
            logging.info("▶ NY 13:00 scan starting...")
            await scan_top_stocks()

        except Exception as e:
            logging.error(f"Loop error: {e}")
            await send_telegram_message(f"🚨 Loop error: {e}")
            await asyncio.sleep(3600)


# ================================================================
# ================================================================
# SECTION 18: STARTUP
# ================================================================
# ================================================================

if __name__ == "__main__":
    try:
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print("\n🐂 BOGA AI Bot stopped manually.")
    except Exception as e:
        print(f"Critical Startup Error: {e}")
