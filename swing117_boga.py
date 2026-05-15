# -*- coding: utf-8 -*-
"""
================================================================
ðŸ‚ BOGA AI SWING TRADE MODEL — V117.0 (Transparency + Edge)
================================================================
V117 YENİLİKLER:
  1. selection_system: Her hisse için SQUEEZE/SPRING/AWAKENING/EMA_CROSS/
     PULLBACK/BREAKOUT/MOMENTUM etiketleri
  2. selection_reasons: Çoklu sinyal kaynağı listesi
  3. system_category: Contraction / Reversal / Momentum / Breakout
  4. Telegram: Her hissede sistem etiketi + özet tabloda kısaltma
  5. Terminal: 20 hissenin tamamı sistem + sektör + R/R ile listelenir
  6. JSON: by_system gruplaması + system_summary
  7. ADX: Level-bazlı değil, slope-bazlı puanlama (optimal giriş tespiti)
  8. Composite: RVOL ağırlığı 0.40 â†’ 0.20 (dry-up/VCP tolerance)
  9. Earnings filter: 3 gİ¼n â†’ 5 gİ¼n (swing hold buffer)
 10. VIX entegrasyonu: Market regime'e VIX overlay eklendi
 11. Backtest altyapısı: Peak tracker + sistem bazlı winrate birikimi
================================================================

ARCHITECTURE (unchanged):
  LAYER 1 â†’ Global universe weekly scan â†’ most liquid 500 stocks
  LAYER 2 â†’ 1D data for 500 stocks is fetched, momentum + trend
             at least 50 candidates are selected
  LAYER 3 â†’ Deep analysis for 50 candidates (1H S/R + ATR zones)
  LAYER 4 â†’ Top 10 stocks scored out of 100
  LAYER 5 â†’ Summaries generated with Gemini AI in multiple languages
  OUTPUT  â†’ Saved in JSON format + Telegram notification
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
# ðŸ”¹ DATA PROVIDER CONFIG  (ðŸ”§ FIX #11)
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
# ðŸ”¹ LOGGING
# ================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# ================================================================
# ðŸ”¹ TIME & SCHEDULER
# ================================================================
NY_TZ = ZoneInfo("America/New_York")
WEEKDAY_SET = {0, 1, 2, 3, 4}

# Weekly universe scan (Monday 09:00 NY)
WEEKLY_SCAN_DAY = 0       # 0 = Monday
WEEKLY_SCAN_HOUR = 9
WEEKLY_SCAN_MINUTE = 0

# Daily selection scan (Every day 13:00 NY)
DAILY_RUN_HOUR = 13
DAILY_RUN_MINUTE = 0

# ================================================================
# ðŸ”¹ CACHE & FILE SETTINGS
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
# ðŸ”¹ UNIVERSE AND FILTER PARAMETERS
# ================================================================
MAX_TICKERS_FINAL = 800          # 🎯 SNIPER: Daha geniş evren = daha çok small/mid-cap fırsat.
TOP_DEEP_ANALYSIS = 80           # 🎯 SNIPER: Daha fazla derin analiz.
TOP_FINAL_PICKS = 20             # 🎯 SNIPER: Hedef Her gİ¼n 20 aday.

# ðŸ”§ BOGA AI FIX: Fiyat ve Likidite Filtresi (Profesyonel Swing Standartları)
PRICE_MIN = 10.0
PRICE_MAX = 500.0

# Wall Street 'İşlem Yapılabilir' (Tradable) Likidite Alt Sınırları:
ATMACA_MIN_MARKET_CAP = 75_000_000     # 🎯 SNIPER: 300M â†’ 75M. Small-cap dahil. Float kİ¼çİ¼k = hareket bİ¼yİ¼k.
ATMACA_MIN_AVG_VOLUME = 250_000        # 🎯 SNIPER: 500K â†’ 250K. Patlama öncesi hacimsizlik (dry-up) tolere edilir.
ATMACA_MIN_DOLLAR_VOLUME = 2_000_000   # 🎯 SNIPER: 5M â†’ 2M.

ATMACA_MIN_BETA = 0.6
ATMACA_MAX_BETA = 3.0

ATR_PERIOD = 14
ATR_MIN_PCT_1H = 0.025
ATR_MAX_PCT_1H = 0.25

ADX_MIN_LEVEL_1D = 18
OBV_TREND_DAYS = 10
VOLUME_INCREASE_LOOKBACK = 5

# 🎯 RSI THRESHOLDS (Unified Documented Constraints)
RSI_1D_MIN = 45         # Ana trend alt sınırı (Unified boga_score_100 ile tutarlı)
RSI_1D_MAX = 78         # Momentum liderleri için mutlak 1D tavanı (Bunun İ¼stİ¼ kesin red)
RSI_1H_MAX = 82         # İntraday (1H) spike mutlak tavanı
RSI_BOGA_OPT_MIN = 45   # Unified sistem optimal alt sınır
RSI_BOGA_OPT_MAX = 65   # Unified sistem optimal İ¼st sınır

MIN_RR_RATIO = 1.5         # ðŸ”§ FIX: 1.2 â†’ 1.5 (gerçekçi swing min)
MIN_RR_RATIO_RELAXED = 1.8  # ðŸ”§ FIX: 1.3 â†’ 1.8 (entry trigger varsa biraz esnek)

LOOKBACK_DAYS = 200
INDEX_BENCHMARK = "^GSPC"
MAX_PER_SECTOR = 3 # ?? FIX: Korelasyon riskini ve SL patlamasini önlemek için 6'dan 3'e düsürüldü.
RS_LOOKBACK = 30

# ================================================================
# ðŸ”¹ TELEGRAM SETTINGS
# ================================================================
TELEGRAM_API_KEY = "8182098187:AAF-jtWMJK07ZdZdyusiE1RqyQkwegb0Uhc"
TELEGRAM_CHAT_ID = "-1003406973271"
ENABLE_TELEGRAM_NOTIFICATIONS = True

# ================================================================
# ðŸ”¹ ALPHA VANTAGE
# ================================================================
ENABLE_ALPHA_VALIDATION = False
ALPHA_VALIDATION_THRESHOLD = 24.0
ALPHA_VANTAGE_API_KEY = "8S8ZRE3EPTKH0EPJ"


# YENİ:
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

# 🎯 7g HEDEF — Yavaş sektörlerde momentum haftalarda kuruluyor.
# Veri: Energy %12.2, Consumer Defensive %9.4, Utilities %23.5 7g-içinde-zirve oranı.
# Bu sektörler tamamen elenmiyor (kaliteli setup gelirse alınsın) ama -3 puan ceza alır.
# YENİ:
SLOW_PEAK_SECTORS = {
    # "Real Estate": -5.0,  # Real Estate artık Phase 1A'da hard reject ile tamamen eleniyor.
    "Consumer Defensive": -3.0,
    "Utilities": -3.0,
    # ðŸš¨ FIX: Son dönemde yİ¼ksek stop-loss patlaması yaşatan sektörlere karantina cezası
    "Industrials": -10.0,
    "Consumer Cyclical": -8.0,
    "Communication Services": -8.0,
}

# -- Yİ¼ksek riskli industry grupları — swing için hard reject -----------------
# Bu industry'lere ait hisseler binary event (FDA kararı, faz 3 sonucu, patent
# davası vb.) riskiyle teknik analiz sinyalini geçersiz kılabilir.
#
# Kural: Clinical-stage / pre-revenue biyotech hisseleri kesinlikle elenir.
# Onaylı İ¼rİ¼nİ¼ olan bİ¼yİ¼k pharma/biotech (ABBV, AMGN, BIIB vb.) zaten yİ¼ksek
# market cap nedeniyle ATMACA_MIN_MARKET_CAP filtresinden geçer.
HIGH_RISK_INDUSTRIES: set = {
    "biotechnology",                            # Pre-revenue / klinik aşama
    "drug manufacturers - specialty & generic", # Kİ¼çİ¼k tek-İ¼rİ¼n pharma
    "pharmaceutical retailers",                 # Dağıtım tek İ¼rİ¼ne bağlı
    "medical devices",                          # FDA pre-market onay riski
    "diagnostics & research",                   # Reimbursement bağımlı
    "health information services",              # Regİ¼lasyon değişkeni
}

# Market cap eşiği: Bu industry'lerde market cap'i bu değerin ALTINDA olanlar elenir.
HIGH_RISK_INDUSTRY_MCAP_FLOOR = 5_000_000_000  # $5B

# Negatif FCF hard floor — bu sınırın altında FCF olan hisse elenir
NEGATIVE_FCF_FLOOR = -50_000_000  # -$50M

# â”€â”€ V117 FIX: CEF / ETF / MutualFund Engelleme Setleri (Global) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CEF_BLOCK_QUOTE_TYPES: set = {"etf", "mutualfund", "cef"}
CEF_BLOCK_INDUSTRIES: set = {
    "closed-end fund",
    "closed end fund",
    "asset management",          # saf holding/fund yöneticisi
    "exchange traded fund",
}

# ================================================================
# ðŸ”¹ GLOBAL STATE VARIABLES
# ================================================================

MARKET_STATUS = {"regime": "Bull", "min_score_modifier": 0.0}
SECTOR_PERFORMANCE: Dict[str, float] = {}
sector_map: Dict[str, str] = {}
EXCLUDED_STOCKS: set = set()

# ================================================================
# ðŸ”¹ EXCHANGE SOURCES
# ================================================================
EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# ================================================================
# ðŸ”¹ COMPANY DATABASE (Fast access for known major stocks)
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
# ðŸ”¹ PERSISTENT INFO CACHE
# ================================================================
persistent_info_cache: Dict[str, dict] = {}

def load_info_cache():
    global persistent_info_cache
    try:
        if os.path.exists(INFO_CACHE_FILE):
            with open(INFO_CACHE_FILE, "r", encoding="utf-8") as f:
                persistent_info_cache = json.load(f)
            logging.info(f"ðŸ“¦ Persistent Cache: {len(persistent_info_cache)} stocks loaded.")
    except Exception as e:
        logging.warning(f"âš ï¸ Cache load error: {e}")

def save_info_cache():
    try:
        os.makedirs(WATCHLIST_DIR, exist_ok=True)
        with open(INFO_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(persistent_info_cache, f, indent=2)
    except Exception as e:
        logging.warning(f"âš ï¸ Cache save error: {e}")

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
                logging.error(f"âš ï¸ Ticker list error ({url}): {e}")

    logging.info(f"[OK] Raw symbol count: {len(all_tickers)}")
    return list(all_tickers)

# ================================================================
# ðŸ›¡ï¸ ANTI-REPETITION MODULE (Block those selected in the last 10 days)
# ================================================================
async def get_recently_picked_tickers(days=5) -> set:
    """
    Lists stocks selected in the last N days to block them.
    Reads files in swing_YYYYMMDD.json format from the SWING2026 year folder.
    """
    recent_tickers = set()
    # [OK] FIX 1: Use absolute path
    base_data_dir = r"C:\Users\afksm\finma\frontend\public\data"
    current_year = datetime.now(NY_TZ).strftime("%Y")
    swing_year_dir = os.path.join(base_data_dir, f"swing{current_year}")

    if not os.path.exists(swing_year_dir):
        logging.warning(f"âš ï¸ Archive folder not found: {swing_year_dir}")
        return recent_tickers

    try:
        # [OK] FIX 2: Scan swing_YYYYMMDD.json files
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
                logging.warning(f"âš ï¸ Error reading {file_name}: {e}")

        if recent_tickers:
            logging.info(f"ðŸš« Stocks selected and blocked in the last {days} days ({len(recent_tickers)}): {sorted(recent_tickers)}")
        else:
            logging.info(f"â„¹ï¸ No stocks selected in the last {days} days (first scan?)")
    except Exception as e:
        logging.error(f"âŒ Error reading past selections: {e}")

    return recent_tickers
    
async def build_atmaca_universe_full() -> List[str]:
    """
    LAYER 1 — Weekly Universe Creation (Most Liquid 500 Stocks)

    PHASE 1: Fetch all US stocks
    PHASE 2: Download bulk OHLCV, filter vectorially
    PHASE 3: RVOL İ— DollarVolume ranking â†’ Top 500
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
                        logging.info(f"ðŸ“ Disk Cache Loaded: {len(data_list)} stocks. Data is being downloaded...")
                        # âš ï¸ CRITICAL FIX: Fill the cache with 1D data of stocks loaded from disk!
                        # Making the period 252d ensures EMA200 and "len < 60" conditions.
                        chunk_size = 100
                        filtered_list = []
                        for j in range(0, len(data_list), chunk_size):
                            chunk = data_list[j : j + chunk_size]
                            downloaded = await asyncio.to_thread(
                                yf.download, chunk, period="252d", interval="1d", progress=False, group_by="ticker", ignore_tz=True
                            )
                            for sym in chunk:
                                if sym in downloaded and not downloaded[sym].empty:
                                    df_sym = downloaded[sym].dropna()
                                    # 🎯 V117 FIX: Disk cache'ten gelen yeni listelenmiş
                                    # hisseleri (AYA tipi) burada da engelle.
                                    # TSX/yabancı borsada geçmişi olan bir hisse ABD'de
                                    # yeni listelenmiş olabilir — 60 bar garantisi şart.
                                    if len(df_sym) < 60:
                                        logging.info(f"ðŸš« {sym}: Disk cache'te yetersiz geçmiş ({len(df_sym)} bar) â†’ atlandı")
                                        continue
                                    BULK_DATA_CACHE[sym] = df_sym.copy()
                                    filtered_list.append(sym)

                        if filtered_list:
                            logging.info(f"âœ… Disk Cache: {len(data_list)} â†’ {len(filtered_list)} hisse ({len(data_list)-len(filtered_list)} yetersiz geçmişli elendi)")
                            UNIVERSE_CACHE["ts"] = mtime
                            UNIVERSE_CACHE["data"] = filtered_list
                            return filtered_list
            except Exception as e:
                logging.error(f"âš ï¸ Disk cache yİ¼kleme/indirme hatası: {e}")

    raw_list = await fetch_all_us_tickers()
    if not raw_list:
        logging.error("âŒ Ticker list could not be retrieved.")
        return []

    logging.info(f"[START] Bulk download starting for {len(raw_list)} stocks (chunk=1000, period=35d)...")

    CHUNK = 200
    PERIOD = "252d"
    all_rows: list = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"ðŸ“¥ Downloading: {i}â€“{i + len(chunk)} ...")
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

                    # 🎯 V117 FIX: Yeni halka arzları (AYA gibi) ve yetersiz verisi olanları baştan ele
                    if len(close) < 60 or len(volume) < 60:
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
                    # 🎯 SNIPER MOD: 0.8 â†’ 0.55. Quiet accumulation hisseleri dahil.
                    # BB squeeze öncesi volume sessizliği normaldir.
                    if rvol < 0.55:
                        continue

                    roc5 = float(
                        (close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]
                    ) if len(close) >= 6 else 0.0
                    # 🎯 SNIPER MOD: Sıkışma bölgesindeki hisseleri dahil et.
                    # ðŸ”§ BOGA AI FIX: Hacimli momentum kırılımları (Tier 2) evrene eklendi
                    is_squeeze_candidate = (-0.04 <= roc5 <= 0.06)
                    # 🎯 FIX: Eşik 0.15'e esnetildi. 5 gİ¼ne yayılan sağlıklı (%10-12'lik) trendler içeri alınır.
                    # Tek gİ¼nde %10 yapan pis patlamaların elenmesi işi Layer 2'deki Exhaustion modİ¼lİ¼ne bırakıldı.
                    is_momentum_breakout = (0.06 < roc5 <= 0.15) and rvol > 1.2
                    
                    if not (is_squeeze_candidate or is_momentum_breakout):
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
            logging.warning(f"âš ï¸ Chunk {i} error: {e}")
            continue

    if not all_rows:
        logging.error("âŒ No stocks left after bulk download.")
        return []

    logging.info(f"⚡ Vector filter: {len(all_rows)} stocks passed.")
    all_rows.sort(key=lambda r: r["rank_score"], reverse=True)
    selected = [r["sym"] for r in all_rows[:MAX_TICKERS_FINAL]]

    logging.info(f"ðŸ† LAYER 1 complete: {len(selected)} stocks selected.")

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

def get_stock_data(ticker: str, interval: Literal["1d", "1h", "15m"] = "1d") -> Optional[pd.DataFrame]:
    """
    Reads from BULK_DATA_CACHE for 1D (zero network).
    Fetches with yf.Ticker for 1H.

    ðŸ”§ FIX #10: yfinance is unreliable in production (rate limits, stale data).
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
    period_map = {"1h": ("7d", 10), "15m": ("5d", 20)}
    period_str, min_bars = period_map.get(interval, ("7d", 10))

    for attempt in range(3):
        time.sleep(random.uniform(0.15, 0.4) + (attempt * 0.5))
        try:
            stock = yf.Ticker(t)
            df = stock.history(period=period_str, interval=interval, auto_adjust=True, timeout=8)
            if df is None or df.empty:
                if attempt < 2:
                    continue
                return None
            df.columns = [c.capitalize() for c in df.columns]
            df = df.dropna()
            if len(df) >= min_bars:
                return df
        except Exception as e:
            if attempt == 2:
                logging.error(f"âŒ {t} ({interval}) fetch failed after 3 attempts: {e}")
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
        logging.info(f"ðŸŒ {t} info fetching live...")
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
            "companyName": inf.get("longName", t),
            # â”€â”€ V117 FIX: Eksik bilanço alanları eklendi â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            "debtToEquity": inf.get("debtToEquity", 0),          # D/E oranı
            "totalCash": inf.get("totalCash", 0),                 # Nakit pozisyon
            "totalDebt": inf.get("totalDebt", 0),                 # Toplam borç
            "netIncomeToCommon": inf.get("netIncomeToCommon", 0), # Net gelir (negatif = zarar)
            "trailingEps": inf.get("trailingEps", 0),             # EPS (negatif = zarar)
            # â”€â”€ V117 FIX: CEF/ETF/MutualFund filtresi için quoteType â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            "quoteType": inf.get("quoteType", "EQUITY"),          # EQUITY / ETF / MUTUALFUND / CEF
        }
        
        # Cache gİ¼ncelle ve kaydet
        persistent_info_cache[t] = processed
        # ðŸ”§ BOGA AI FIX: Disk I/O yİ¼kİ¼nİ¼ kaldırmak için her fetch'te diske yazma işlemi iptal edildi. 
        # (Tarama sonunda toplu olarak yazılacak)
        # save_info_cache()
        
        return processed
        
    except Exception as e:
        logging.error(f"âš ï¸ {t} info fetch error: {e}")
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
            return {'valid': True, 'bonus': 0.8, 'msg': "ðŸŸ¡ Ichimoku: Intra-Cloud Swing Awakening (+0.8)"}
        if price > cloud_top:
            if last['tenkan'] > last['kijun']:
                return {'valid': True, 'bonus': 1.4, 'msg': "[OK] Ichimoku: Strong Bullish Continuation (+1.4)"}
            return {'valid': True, 'bonus': 0.6, 'msg': "[OK] Ichimoku: Above Cloud (+0.6)"}
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
        return {'valid': False, 'bonus': 0.0, 'msg': "âš ï¸ VP: Below POC (Resistance Zone)"}
    except Exception:
        return {'valid': False, 'bonus': 0.0, 'msg': ""}


def analyze_smart_money_flow(df_1d: pd.DataFrame, ticker: str, info: dict) -> dict:
    try:
        if len(df_1d) < 20:
            return {'has_smart_flow': False, 'score': 0.0, 'details': []}
        
        close, high, low, volume = df_1d['Close'], df_1d['High'], df_1d['Low'], df_1d['Volume']
        score, details = 0.0, []

        # True Range tabanlı MFM (Gap Körlİ¼ğİ¼nİ¼ Çözer)
        prev_close = close.shift(1)
        true_high = np.maximum(high, prev_close)
        true_low = np.minimum(low, prev_close)
        true_range = (true_high - true_low).replace(0, np.nan)
        
        mf_mult = ((close - true_low) - (true_high - close)) / true_range
        mf_mult = mf_mult.fillna(0)
        
        cmf_val = float((mf_mult * volume).rolling(20).sum().iloc[-1] / volume.rolling(20).sum().iloc[-1])

        if cmf_val > 0.15:
            score += 6.0; details.append(f"ðŸ’° Smart Money: Strong Accumulation (CMF: {cmf_val:.2f})")
        elif cmf_val > 0.05:
            score += 3.2; details.append(f"📈 Smart Money: Positive Money Flow (CMF: {cmf_val:.2f})")
        elif cmf_val < -0.10:
            score -= 3.2; details.append(f"âš ï¸ Smart Money: Institutional Distribution (CMF: {cmf_val:.2f})")

        typical_price = (high + low + close) / 3
        raw_mf = typical_price * volume
        pos_mf = raw_mf.where(typical_price > typical_price.shift(1), 0)
        neg_mf = raw_mf.where(typical_price < typical_price.shift(1), 0)
        mf_ratio = pos_mf.rolling(14).sum() / neg_mf.rolling(14).sum()
        mf_ratio = mf_ratio.replace([np.inf, -np.inf], 100).fillna(50)
        mfi_val = float(100 - 100 / (1 + mf_ratio.iloc[-1]))

        if mfi_val > 60:
            score += 4.0; details.append(f"ðŸ’š MFI: Strong Money Flow ({mfi_val:.1f})")
        elif mfi_val < 30:
            score -= 2.0; details.append(f"🔴 MFI: Weak Money Flow ({mfi_val:.1f})")

        return {
            'has_smart_flow': score > 0, 'score': min(score, 12.0),
            'details': details, 'cmf': round(cmf_val, 3), 'mfi': round(mfi_val, 1)
        }
    except Exception:
        return {'has_smart_flow': False, 'score': 0.0, 'details': [], 'cmf': 0.0, 'mfi': 50.0}


def detect_rising_stock(df: pd.DataFrame, adx_1d: float = 0.0) -> dict:
    """ðŸ”§ FIX #12: A stock with 0% 10-day return that just has rising swing lows
    is NOT rising — it's flatlining. Demand at least +2% over 10 days before
    awarding the 'is_rising' badge. This kills the sideways-listing problem."""
    try:
        close = df['Close']
        volume = df['Volume']
        score, details, pattern = 0.0, [], ""

        if len(close) < 10:
            return {'is_rising': False, 'score': 0.0, 'details': [], 'pattern': ''}

        # YENİ:
        recent_ret = (close.iloc[-1] - close.iloc[-10]) / close.iloc[-10]
        recent_5d  = (close.iloc[-1] - close.iloc[-6]) / close.iloc[-6] if len(close) >= 6 else 0.0

        # 🎯 FIX 4: Sıkışma bölgesindeki hisseleri (Base Breakout öncesi) kaçırmamak için tolerans
        # Eğer 10 gİ¼n 0 getiri, ama son 5 gİ¼n ufak bir kıpırdanma varsa pas geçme.
        if recent_ret < 0.0 and recent_5d < 0.01:
            return {'is_rising': False, 'score': 0.0, 'details': ['Flat/down return (No momentum)'], 'pattern': ''}

        # 🎯 7g HEDEF: 5g ivmesi 10g'nin yarısından fazlaysa = HIZLANIYOR
        if recent_5d > 0 and recent_ret > 0:
            accel_ratio = recent_5d / recent_ret
            if accel_ratio >= 0.55:
                score += 2.5; pattern = pattern or "Accelerating"
                details.append(f"⚡ Momentum Hızlanıyor (5g **%{recent_5d*100:.1f}** / 10g **%{recent_ret*100:.1f}**)")
            elif accel_ratio < 0.20:
                score -= 1.0
                details.append(f"ðŸ¢ Momentum Yavaşlıyor (5g sadece **%{recent_5d*100:.1f}**)")

        # 🎯 0-DAY SNIPER: 10 gİ¼nde %15+ uçmuş hisseye girilmez, parti bitmiştir.
        if recent_ret > 0.15:
            # Öneri 6: Momentum Lideri Muafiyeti
            if score > 15 and adx_1d > 30: # RS slope ve ADX kontrolİ¼yle
                score -= 2.0; pattern = "High Momentum Leader"
            else:
                score -= 5.0; pattern = "Overextended"
                
            details.append(f"âš ï¸ 10D Return: +{recent_ret*100:.1f}% (Çok Åžişkin, FOMO Riski)")
        elif recent_ret > 0.08:
            score += 1.0; pattern = "Mature Trend"
            details.append(f"📈 10D Return: +{recent_ret*100:.1f}% (Olgun Trend, Geç Kalınmış Olabilir)")
        elif recent_ret > 0.02:
            score += 4.0; pattern = "Fresh Breakout"
            details.append(f"ðŸš€ 10D Return: +{recent_ret*100:.1f}% (Taze Başlangıç / Sniper Bölgesi)")
        else:
            score += 1.0; pattern = "Mild Uptrend"
            details.append(f"â†—ï¸ 10D Return: +{recent_ret*100:.1f}%")

        swing_lows = []
        for i in range(2, min(15, len(df)) - 2):
            swing_low_val = df['Low'].iloc[-i]
            if swing_low_val < df['Low'].iloc[-(i-1)] and swing_low_val < df['Low'].iloc[-(i+1)]:
                swing_lows.append(swing_low_val)
                
        if len(swing_lows) >= 2 and swing_lows[0] > swing_lows[-1]:
            score += 2.0; pattern = pattern or "Pullback Reversal"
            details.append("ðŸ”° Higher Lows: Pullback Reversal")

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
            score += 4.0; details.append(f"ðŸ¦ Insider Net Buyer ({buy_count}/{sell_count})")
        if executive_buys >= 2:
            score += 6.0; details.append(f"ðŸ‘” C-Suite Strong Buy ({executive_buys})")
        elif executive_buys >= 1:
            score += 3.2; details.append("ðŸ‘” C-Suite Buy Signal")
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
        # â”€â”€ V117 FIX: Key uyumsuzluğu giderildi (cached_info desteği) â”€â”€
        market_cap       = info.get('marketCap', 0) or info.get('market_cap', 0)
        fcf_yield_pct    = (fcf_yield / market_cap * 100) if market_cap > 0 and fcf_yield > 0 else 0.0

        if gross_margin > 0.35:
            score += 2.0; details.append(f"ðŸ’Ž Gross Margin: {gross_margin*100:.1f}% (Strong)")
        if operating_margin > 0.15:
            score += 2.0; details.append(f"📊 Operating Margin: {operating_margin*100:.1f}% (Strong)")
        if net_margin > 0.10:
            score += 2.0; details.append(f"ðŸ’° Net Margin: {net_margin*100:.1f}% (Healthy)")
        if revenue_growth > 0.10:
            score += 3.0; details.append(f"[START] Revenue Growth: {revenue_growth*100:.1f}% (Good)")
        elif revenue_growth > 0.05:
            score += 1.5; details.append(f"📈 Revenue Growth: {revenue_growth*100:.1f}%")
        if 0 < debt_to_equity < 1.5:
            score += 1.5; details.append(f"🟢 D/E: {debt_to_equity:.2f} (Healthy)")
        if fcf_yield_pct > 3.0:
            score += 2.0; details.append(f"ðŸ’¸ FCF Yield: {fcf_yield_pct:.1f}% (Strong)")
        elif fcf_yield_pct < 0:
            score -= 4.0; details.append(f"âš ï¸ FCF Yield: Negatif Nakit Akışı ({fcf_yield_pct:.1f}%)")
            
        if net_margin < 0:
            score -= 4.0; details.append(f"ðŸš¨ Net Margin: Zarar Eden Åžirket ({net_margin*100:.1f}%)")

        return {
            'health_score': max(-10.0, min(score, 15.0)), 'details': details,
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
        catalysts.append(f"ðŸ›ï¸ Institutional: %{inst_pct*100:.0f}"); score += 0.8
    elif inst_pct > 0.60:
        catalysts.append(f"ðŸ¦ Institutional: %{inst_pct*100:.0f}"); score += 0.3
    rec = str(info.get('recommendationKey', '')).lower()
    if 'strong_buy' in rec:
        catalysts.append("📈 Analyst: Strong Buy"); score += 0.8
    elif 'buy' in rec:
        catalysts.append("📈 Analyst: Buy"); score += 0.4
    peg = info.get('pegRatio', 0) or 0
    if 0 < peg < 1.5:
        catalysts.append(f"ðŸ’Ž PEG: {peg:.1f} (Cheap Growth)"); score += 0.5
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
                            return {'has_risk': True, 'penalty': 5.0, 'msg': f"âš ï¸ LEGAL RISK: '{kw}'"}
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
                if 10 <= (exp_dt - now_date).days <= 60:
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
            score += 4.0; details.append(f"ðŸ‚ Options Signal: Strong Bullish (PCR: {pcr})")
        elif pcr < 0.9:
            score += 2.0; details.append(f"📈 Options Signal: Mild Bullish (PCR: {pcr})")
        elif pcr > 1.3:
            score -= 2.0; details.append(f"ðŸ» Options Signal: Bearish (PCR: {pcr})")

        return {'bullish': pcr < 0.9, 'score': score, 'details': details, 'pcr': str(pcr)}
    except Exception:
        return {'bullish': False, 'score': 0.0, 'details': [], 'pcr': "N/A"}

# ================================================================
# ================================================================
# SECTION 4: SUPPORT / RESISTANCE CALCULATION AND TIMING ENGINE
# ================================================================

def calculate_support_resistance_1h(df_1h: pd.DataFrame, df_1d: pd.DataFrame, current_price: float, entry_trigger_1d: str = "", df_15m: pd.DataFrame = None) -> dict:
    """
    BOGA AI TIMING ENGINE (Sniper Module): 
    Combines 1D macro structure and 1H micro price movements.
    No matter how good the stock is, if there is no Smart Money volume and 
    reversal confirmation, entry_valid = False is returned.
    """
    try:
        # â”€â”€ 1. DAILY (1D) MACRO STRUCTURE AND ATR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        # â”€â”€ 2. REAL-TIME TIMING (Via 1H Data) â”€â”€â”€â”€â”€â”€â”€â”€
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
            # Hacim Filtresi: Dual-Tier (Breakout için daha esnek, Sweep için sert)
            vol_avg_20 = float(vol_1h.rolling(20).mean().iloc[-1])
            is_green_candle = curr_c > curr_o
            volume_spike_breakout = (curr_v > vol_avg_20 * 1.3) and is_green_candle
            volume_spike_sweep = (curr_v > vol_avg_20 * 1.8) and is_green_candle

            # Price Action (Candle Formations)
            body = abs(curr_c - curr_o)
            lower_wick = min(curr_c, curr_o) - curr_l
            upper_wick = curr_h - max(curr_c, curr_o)
            
            is_pinbar = (lower_wick > body * 2.0) and (upper_wick < body * 0.5)
            is_bullish_engulfing = is_green_candle and (prev_c < prev_o) and (curr_c > prev_o) and (curr_o < prev_c)

            # --- ENTRY SCENARIOS (Signal Triggers) ---
            is_liquidity_sweep = (curr_l < support_1h) and (curr_c > support_1h)
            
            # ðŸš¨ FIX 1: BOS Bug - current candle dahil edilmedi, gerçek breakout tespiti
            recent_local_high = float(high_1h.iloc[-11:-1].max()) if len(high_1h) >= 11 else float(high_1h.iloc[:-1].max())
            is_bos = (curr_c > recent_local_high) and volume_spike_breakout

            is_pullback = (support_1h <= curr_l <= support_1h + (atr_1d * 0.3))

            # â”€â”€ ERKEN MOMENTUM TESPİTİ (Sessiz Kırılımlar İçin) â”€â”€
            try:
                ema20_1h_val = float(EMAIndicator(close_1h, 20).ema_indicator().iloc[-1])
                roc_1h = ((curr_c - prev_c) / prev_c) * 100 if prev_c > 0 else 0.0
                is_early_momentum = (curr_c > ema20_1h_val) and (roc_1h > 0.8) and (curr_v > vol_avg_20 * 1.15)
            except Exception:
                is_early_momentum = False

            # --- FINAL DECISION (Giriş Öncelik Hiyerarşisi) ---
            if is_liquidity_sweep and (is_pinbar or volume_spike_sweep):
                entry_valid = True
                entry_type = "REVERSAL (Liquidity Sweep)"
                entry_confidence = 95
                
            elif is_bos:
                entry_valid = True
                entry_type = "BREAKOUT (BOS)"
                entry_confidence = 85
                
            elif is_early_momentum:
                entry_valid = True
                entry_type = "EARLY MOMENTUM"
                entry_confidence = 80
                
            elif is_pullback and (is_pinbar or is_bullish_engulfing) and volume_spike_breakout:
                entry_valid = True
                entry_type = "PULLBACK"
                entry_confidence = 80
                
        # Safety Buffer (If support is too close to price)
        if (current_price - support_1h) < (atr_1d * 0.6):
            support_1h = current_price - (atr_1d * 0.8)

        # â”€â”€ 3. REFERENCE ZONES — DYNAMIC BY SIGNAL TYPE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        is_momentum_entry = (
            (entry_valid and entry_type in ("BREAKOUT (BOS)", "REVERSAL (Liquidity Sweep)")) or
            (entry_type or "").startswith("BREAKOUT") or
            "Early Awakening" in entry_trigger_1d
        )

        if is_momentum_entry:
            # Tight zone around live price
            buy_zone_low  = round(current_price - (atr_1d * 0.25), 2)
            buy_zone_high = round(current_price + (atr_1d * 0.15), 2)
        elif entry_valid and entry_type == "PULLBACK":
            buy_zone_low  = round(support_1h + (atr_1d * 0.2), 2)
            buy_zone_high = round(current_price + (atr_1d * 0.1), 2)
        else:
            buy_zone_low  = round(support_1h + (atr_1d * 0.2), 2)
            buy_zone_high = round(current_price + (atr_1d * 0.1), 2)

        # Sanity guard
        if buy_zone_low >= buy_zone_high:
            buy_zone_low = round(buy_zone_high - (atr_1d * 0.3), 2)

        stop_high = round(support_1h - (atr_1d * 0.5), 2)
        stop_low  = round(stop_high - (atr_1d * 0.2), 2)

        # 🎯 FIX 5: Entry Buffer. Breakout mumunun tam tepesinden almamak (slippage protection) için.
        avg_entry = (current_price * 0.995) if entry_valid else ((buy_zone_low + buy_zone_high) / 2)
        risk = max(avg_entry - stop_high, atr_1d * 1.0)
        
        # 🎯 FIX 3: R/R Kaybını Engelleme (Momentum hisseleri için edge)
        structural_reward = resist_1h - avg_entry
        reward = max(risk * 2.0, structural_reward) if structural_reward > 0 else risk * 2.5
        
        # ðŸš¨ FIX 7: R/R Tavanı — exhausted/late hissede 4x, momentum liderinde 6x.
        # "Early Awakening" veya "Squeeze" sinyali varsa asymmetry korunur.
        is_momentum_trigger_keyword = entry_trigger_1d and any(k in entry_trigger_1d for k in ["Squeeze", "Awakening", "Momentum", "Spring"])
        rr_cap = 6.0 if is_momentum_trigger_keyword else 4.0
        if reward > risk * rr_cap:
            reward = risk * rr_cap

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
        logging.error(f"âŒ Support/Resistance & Timing error: {e}")
        return {
            "entry_engine": {"valid": False, "type": "DATA_ERROR", "confidence": 0},
            "buy_zone": {"low": current_price * 0.98, "high": current_price * 1.01},
            "sell_zone": {"low": current_price * 1.05, "high": current_price * 1.08},
            "stop_zone": {"low": current_price * 0.94, "high": current_price * 0.95},
            "support_1h": current_price * 0.95, "resist_1h": current_price * 1.08,
            "atr_1d": current_price * 0.03, "atr_pct": 3.0,
            "rr_ratio": 0.0, "risk_usd": 0.0, "reward_usd": 0.0
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

        # Kaynak 1: calendar (en gİ¼ncel, ama bazen None)
        if hasattr(stock, 'calendar') and stock.calendar:
            earnings_date = stock.calendar.get('Earnings Date', None)
            if earnings_date:
                if isinstance(earnings_date, list): earnings_date = earnings_date[0]
                result = pd.to_datetime(earnings_date)
                if result and not pd.isna(result):
                    return result

        # Kaynak 2: earnings_dates DataFrame (daha geniş pencere, genelde dolu)
        if hasattr(stock, 'earnings_dates') and stock.earnings_dates is not None:
            try:
                now_tz = datetime.now(NY_TZ)
                ed = stock.earnings_dates
                # Index timezone-aware yapılıyor
                if ed.index.tz is None:
                    ed.index = ed.index.tz_localize('America/New_York')
                else:
                    ed.index = ed.index.tz_convert('America/New_York')
                upcoming = ed[ed.index >= now_tz]
                if not upcoming.empty:
                    return upcoming.index[0]
            except Exception:
                pass

        # Kaynak 3: info dict'inden EPS tarihi (son çare, kaba ama çalışır)
        try:
            info = stock.info
            next_eps = info.get('nextFiscalYearEnd', None) or info.get('mostRecentQuarter', None)
            # nextFiscalYearEnd çok uzak olur, sadece 60 gİ¼n içindeyse kullan
            if next_eps:
                dt = pd.to_datetime(next_eps, unit='s') if isinstance(next_eps, (int, float)) else pd.to_datetime(next_eps)
                days_away = (dt - datetime.now()).days
                if 0 <= days_away <= 60:
                    return dt
        except Exception:
            pass

        return None
    except Exception:
        return None


def is_earnings_safe_for_swing(ticker: str, min_days_away: int = 5) -> bool:  # ðŸ”§ FIX: 5 â†’ 5 gİ¼n (V117 spec: "3 gİ¼n â†’ 5 gİ¼n")
    try:
        earnings_date = get_earnings_date_safe(ticker)
        # 🎯 FIX: API veri vermiyorsa kİ¼çİ¼k hisseleri yanlışlıkla elememek için True dön.
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
        return False


async def analyze_market_and_sectors():
    """
    V117: Market regime (VIX + SPY) ve sektör performans analizi.
    
    DEÄžİÅžİKLİKLER (V114 â†’ V117):
      - VIX zaten çekiliyordu ama sadece eşik kontrol ediyordu.
      - V117: VIX slope (yİ¼kseliyor mu?) + VIX percentile + override logic eklendi.
      - MARKET_STATUS'a vix, vix_rising, vix_note alanları eklendi.
      - VIX > 35 â†’ regime zorla HIGH_VOLATILITY (SPY ne olursa olsun).
      - VIX < 14 â†’ STRONG rejimine bonus modifier.
      - Sektör analizi değişmedi (zaten sağlam).
    """
    global MARKET_STATUS, SECTOR_PERFORMANCE
    current_vix = 20.0
    vix_prev    = 20.0
    vix_rising  = False

    # â”€â”€ STEP 1: INDEX VERİSİ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        indices  = ["^VIX", "SPY"]
        df_indices = await asyncio.to_thread(
            yf.download, indices, period="252d", progress=False,
            group_by="ticker", ignore_tz=True
        )

        # â”€â”€ VIX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if "^VIX" in df_indices and not df_indices["^VIX"].empty:
            vix_series  = df_indices["^VIX"]["Close"].dropna()
            current_vix = float(vix_series.iloc[-1])
            vix_prev    = float(vix_series.iloc[-2]) if len(vix_series) >= 2 else current_vix

            # VIX yönİ¼: son 3 gİ¼nİ¼n ortalaması bugİ¼nden kİ¼çİ¼kse yİ¼kseliyor
            vix_3d_avg  = float(vix_series.tail(4).iloc[:-1].mean()) if len(vix_series) >= 4 else vix_prev
            vix_rising  = current_vix > vix_3d_avg * 1.03   # %3+ artış = "yİ¼kseliyor"

            # VIX 252 gİ¼nlİ¼k yİ¼zdesi (paniğin tarihsel bağlamı)
            vix_52w_min  = float(vix_series.min())
            vix_52w_max  = float(vix_series.max())
            vix_pct_rank = (
                (current_vix - vix_52w_min) / (vix_52w_max - vix_52w_min) * 100
                if vix_52w_max > vix_52w_min else 50.0
            )
        else:
            vix_series  = None
            vix_pct_rank = 50.0

        # â”€â”€ SPY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if "SPY" in df_indices and not df_indices["SPY"].empty:
            spy_close     = df_indices["SPY"]["Close"].dropna()
            current_spy   = float(spy_close.iloc[-1])
            spy_ema200    = float(EMAIndicator(spy_close, 200).ema_indicator().iloc[-1]) if len(spy_close) >= 200 else float(spy_close.mean())
            spy_ema50     = float(EMAIndicator(spy_close, 50).ema_indicator().iloc[-1])  if len(spy_close) >= 50  else float(spy_close.mean())
            spy_5d_change = (current_spy - float(spy_close.iloc[-6])) / float(spy_close.iloc[-6]) * 100 if len(spy_close) >= 6 else 0.0
        else:
            current_spy = spy_ema200 = spy_ema50 = 1.0
            spy_5d_change = 0.0
            vix_pct_rank  = 50.0

    except Exception as e:
        logging.error(f"Market analysis error: {e}")
        # Gİ¼venli default — scan durmasın
        current_spy = spy_ema200 = spy_ema50 = 1.0
        spy_5d_change = vix_pct_rank = 0.0

    # â”€â”€ STEP 2: REGIME KARAR AÄžACI (VIX öncelikli) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    #
    # Mantık:
    #   1. VIX ekstrem ise (>35) â†’ SPY'a bakma, direkt HIGH_VOLATILITY/WEAK
    #   2. VIX normal aralıkta ise â†’ SPY + VIX kombinasyonu ile karar ver
    #   3. VIX çok dİ¼şİ¼k ise (<14) â†’ STRONG rejimine bonus modifier ekle
    #
    # V114'ten fark: VIX eşikleri aynı ama yön (rising) ve percentile rank
    # artık modifier'ı etkiliyor â†’ daha nİ¼anslı risk yönetimi.

    if current_vix >= 40:
        # Piyasa panik modunda — sadece en gİ¼çlİ¼ setuplara izin ver
        MARKET_STATUS["regime"]             = "WEAK"
        MARKET_STATUS["min_score_modifier"] = 2.0
        vix_note = f"ðŸš¨ VIX PANIC ({current_vix:.1f}) — Tarama çok seçici, sadece SQUEEZE/SPRING geçer"

    elif current_vix >= 35:
        # Yİ¼ksek korku — regime HIGH_VOLATILITY, SPY pozisyonu ikincil
        MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
        MARKET_STATUS["min_score_modifier"] = 1.5
        vix_note = f"âš ï¸ VIX EXTREME ({current_vix:.1f}) — Sadece en iyi setuplar geçer"

    elif current_vix >= 28:
        # Gergin piyasa — SPY durumu ne olursa olsun modifier artı
        extra_modifier = 0.5 if vix_rising else 0.0   # yİ¼kseliyorsa daha da sıkı
        if current_spy < spy_ema200:
            MARKET_STATUS["regime"]             = "WEAK"
            MARKET_STATUS["min_score_modifier"] = 1.0 + extra_modifier
            vix_note = f"🔴 VIX High + SPY Downtrend ({current_vix:.1f}) — Seçim çok sıkı"
        else:
            MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
            MARKET_STATUS["min_score_modifier"] = 0.5 + extra_modifier
            vix_note = f"ðŸŸ  VIX Elevated ({current_vix:.1f}, {'Rising' if vix_rising else 'Stable'}) — Dikkatli"

    elif current_vix >= 22:
        # Orta gerilim — SPY ile birlikte değerlendir
        if current_spy > spy_ema50:
            MARKET_STATUS["regime"]             = "CHOPPY"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"ðŸŸ¡ VIX Moderate ({current_vix:.1f}) + SPY EMA50 İ¼stİ¼ — Seçici al"
        else:
            MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
            MARKET_STATUS["min_score_modifier"] = 0.5
            vix_note = f"ðŸŸ  VIX Moderate ({current_vix:.1f}) + SPY EMA50 altı — Dikkat"

    elif current_vix >= 18:
        # Normal piyasa
        if current_spy > spy_ema50 and spy_5d_change > 0:
            MARKET_STATUS["regime"]             = "BULLISH"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"📈 VIX Normal ({current_vix:.1f}) + SPY yİ¼kseliyor — Normal tarama"
        elif current_spy > spy_ema200:
            MARKET_STATUS["regime"]             = "CHOPPY"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"âž¡ï¸ VIX Normal ({current_vix:.1f}) + SPY kararsız — Normal tarama"
        else:
            MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
            MARKET_STATUS["min_score_modifier"] = 0.3
            vix_note = f"âš ï¸ VIX Normal ama SPY EMA200 altı ({current_vix:.1f}) — Temkinli"

    else:
        # VIX < 18 — Dİ¼şİ¼k korku, ideal swing koşulları
        if current_spy > spy_ema50 and spy_5d_change > 0:
            MARKET_STATUS["regime"]             = "STRONG"
            # VIX < 14 ise ekstra bonus modifier (ultra-dİ¼şİ¼k korku = fırsat)
            MARKET_STATUS["min_score_modifier"] = -1.0 if current_vix < 14 else -0.5
            vix_note = f"âœ… VIX Low ({current_vix:.1f}) + SPY gİ¼çlİ¼ — {'Ultra-favorable' if current_vix < 14 else 'Favorable'}"
        else:
            MARKET_STATUS["regime"]             = "BULLISH"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"🟢 VIX Low ({current_vix:.1f}) — Normal tarama"

    # â”€â”€ STEP 3: VIX YÖN CEZASI (ek ayar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # VIX hızla yİ¼kseliyorsa (3 gİ¼nde %10+) modifier'a 0.3 ekle
    # Bu, "piyasa henİ¼z paniklemedi ama panikliyor" anını yakalar
    if vix_rising and current_vix > 20:
        vix_spike = (current_vix - vix_prev) / vix_prev if vix_prev > 0 else 0.0
        if vix_spike > 0.10:   # tek gİ¼nde %10+ VIX artışı
            MARKET_STATUS["min_score_modifier"] = round(
                MARKET_STATUS.get("min_score_modifier", 0.0) + 0.5, 2
            )
            vix_note += f" | ⚡ VIX spike +{vix_spike*100:.0f}% today"

    # â”€â”€ STEP 4: MARKET_STATUS'a VIX ALANLARI KAYDET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    MARKET_STATUS["vix"]          = round(current_vix, 2)
    MARKET_STATUS["vix_prev"]     = round(vix_prev, 2)
    MARKET_STATUS["vix_rising"]   = vix_rising
    MARKET_STATUS["vix_pct_rank"] = round(vix_pct_rank, 1)   # 0-100, 100 = tarihsel max panik
    MARKET_STATUS["vix_note"]     = vix_note

    logging.info(
        f"📊 Piyasa Rejimi: {MARKET_STATUS['regime']} | "
        f"VIX: {current_vix:.1f} ({'â†‘ Rising' if vix_rising else 'â†’ Stable'}) | "
        f"Rank: {vix_pct_rank:.0f}. percentile | "
        f"Modifier: {MARKET_STATUS['min_score_modifier']:+.1f}"
    )
    logging.info(f"   {vix_note}")

    # â”€â”€ STEP 5: SEKTÖR PERFORMANSI (V114 ile aynı, değişmedi) â”€â”€â”€â”€â”€â”€â”€â”€
    for sector_name, etf_ticker in SECTOR_ETF_MAP.items():
        try:
            etf      = yf.Ticker(etf_ticker)
            hist_21d = etf.history(period="21d")
            if len(hist_21d) >= 5:
                hist_5d  = hist_21d.tail(5)
                hist_3d  = hist_21d.tail(3)
                hist_1d  = hist_21d.tail(2)
                
                perf_1d  = (float(hist_1d["Close"].iloc[-1]) - float(hist_1d["Close"].iloc[0])) / float(hist_1d["Close"].iloc[0]) * 100 if len(hist_1d) >= 2 else 0.0
                perf_3d  = (float(hist_3d["Close"].iloc[-1]) - float(hist_3d["Close"].iloc[0])) / float(hist_3d["Close"].iloc[0]) * 100 if len(hist_3d) >= 3 else perf_1d
                perf_5d  = (float(hist_5d["Close"].iloc[-1]) - float(hist_5d["Close"].iloc[0])) / float(hist_5d["Close"].iloc[0]) * 100
                perf_21d = (float(hist_21d["Close"].iloc[-1]) - float(hist_21d["Close"].iloc[0])) / float(hist_21d["Close"].iloc[0]) * 100
                
                # ðŸš¨ FIX: Gİ¼nlİ¼k hızlı rotasyonu yakalamak için kısa vade (1d & 3d) eklendi.
                # Yeni Ağırlık Dağılımı: %30 (1d) + %30 (3d) + %25 (5d) + %15 (21d)
                SECTOR_PERFORMANCE[sector_name] = round((perf_1d * 0.30) + (perf_3d * 0.30) + (perf_5d * 0.25) + (perf_21d * 0.15), 2)
        except Exception:
            continue

    logging.info(
        "[OK] Market and Sector Analysis Completed. "
        f"Hot sectors: {[k for k,v in sorted(SECTOR_PERFORMANCE.items(), key=lambda x: -x[1])[:3]]}"
    )

# ================================================================
# ================================================================
# SECTION 7: PROFIT TARGET / STOP LOSS (ATR BASED)
# ================================================================
# ================================================================

def calculate_profit_target(entry_price, atr_value, momentum_score, is_exhausted=False, beta=1.0):
    """V117 — Asymmetric TP/SL: 4 değer döndİ¼rİ¼r (tp1, tp2, tp3, stop_loss)
    Temel mantık:
      SL: Fiyat yapısına yakın, dar â†’ 0.9-1.2İ—ATR
      TP2: Ana hedef â†’ 2.2-3.0İ—ATR (R/R hesabı buradan)
      TP1: TP2'nin %50'si — ilk kısmi çıkış noktası
      TP3: TP2'nin %140'ı — trend devam ederse tutulan kısım
      R/R hedefi: 2.0-3.5İ—
    """
    if pd.isna(atr_value) or atr_value == 0:
        pct  = 0.07 if not is_exhausted else 0.04
        sl_p = 0.032 if not is_exhausted else 0.025
        sl   = float(round(entry_price * (1 - sl_p), 4))
        t2   = float(round(entry_price * (1 + pct), 4))
        t1   = float(round(entry_price * (1 + pct * 0.50), 4))
        t3   = float(round(entry_price * (1 + pct * 1.40), 4))
        return t1, t2, t3, sl

    m = min(1.0, momentum_score / 12.0)  # 0.0 â†’ 1.0 normalize

    # â”€â”€ STOP LOSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if atr_value < entry_price * 0.015:      # ATR < %1.5 — dar oynaklık
        atr_sl_mult = 0.9
    elif atr_value < entry_price * 0.03:     # ATR %1.5â€“3 — normal
        atr_sl_mult = 1.0
    else:                                    # ATR > %3 — volatil hisse
        atr_sl_mult = 1.2

    if is_exhausted:
        atr_sl_mult *= 0.85

    stop_loss = entry_price - (atr_value * atr_sl_mult)
    stop_loss = max(stop_loss, entry_price * 0.50)  # 🎯 FIX: En fazla %50 kayıp (Negatif SL koruması)

    # â”€â”€ TP2 — ANA HEDEF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if is_exhausted:
        tp_atr_mult = 1.6 + (0.3 * m)       # 1.6â€“1.9İ—
    else:
        tp_atr_mult = 2.2 + (0.8 * m)       # 2.2â€“3.0İ—

    tp2_raw     = entry_price + atr_value * tp_atr_mult
    tp2_pct_raw = (tp2_raw - entry_price) / entry_price * 100

    # â”€â”€ BETA BAZLI TAVAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if beta > 2.0:
        max_profit_pct = 25.0
    elif beta > 1.5:
        max_profit_pct = 18.0
    elif beta > 1.0:
        max_profit_pct = 14.0
    else:
        max_profit_pct = 11.0

    if is_exhausted:
        max_profit_pct = min(max_profit_pct, 7.0)

    tp2 = (
        entry_price * (1 + max_profit_pct / 100)
        if tp2_pct_raw > max_profit_pct
        else tp2_raw
    )

    # â”€â”€ TP1 / TP3 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    swing = tp2 - entry_price          # tp2'ye olan mesafe
    tp1   = entry_price + swing * 0.50 # %50 noktası — ilk çıkış
    tp3   = entry_price + swing * 1.40 # %140 noktası — trend devam

    # tp3 için de tavan uygula
    tp3_max = entry_price * (1 + min(max_profit_pct * 1.40, 35.0) / 100)
    tp3     = min(tp3, tp3_max)

    return (
        float(round(tp1, 4)),
        float(round(tp2, 4)),
        float(round(tp3, 4)),
        float(round(stop_loss, 4))
    )


def estimate_hold_time(momentum_score, vol_increase, profit_pct=0.0, atr_pct=0.0, is_exhausted=False):
    """ðŸ”§ FIX #8: Hold band squeezed from 3-15 â†’ 3-10 days.
    Anything past 10 days is no longer a swing trade — it becomes a position trade
    and ties up capital that could rotate to a fresher signal."""
    directional_daily = atr_pct * 0.20
    hold = int(profit_pct / directional_daily) if directional_daily > 0 and profit_pct > 0 else 5
    hold = max(2, min(7, hold))  # 🎯 FIX: İç hesaplama tavanı 7'ye çekildi, bonuslar kaybolmayacak
    m = min(1.0, momentum_score / 14.0)
    if m >= 0.90: hold -= 2
    elif m >= 0.75: hold -= 1
    elif m < 0.35: hold += 2
    elif m < 0.50: hold += 1
    if vol_increase >= 2.2: hold -= 2
    elif vol_increase >= 1.8: hold -= 1
    elif vol_increase < 0.8: hold += 2
    if is_exhausted: hold += 1
    # 🎯 1. ÖNCELİK FIX: Sermaye döngİ¼sİ¼nİ¼ hızlandırmak için hold sİ¼resi 2-7 gİ¼ne indirildi
    return max(2, min(7, hold))

# ================================================================
# ================================================================
# SECTION 8: MAIN STOCK ANALYSIS (apply_atmaca_filters)
# ================================================================
# ================================================================
# [START] SMART NETWORK MANAGEMENT STRATEGY:
#
#  PHASE 1 (500 stocks — ZERO network I/O):
#    â€¢ 1D data read only from BULK_DATA_CACHE (0 ms)
#    â€¢ EMA, ADX, RVOL, Dead Money â†’ fast elimination
#    â€¢ At least 450 stocks that fail Layer 2 return None immediately
#
#  PHASE 2 (only those that pass Layer 2 — ~50 stocks):
#    â€¢ Earnings check (yf.Ticker)
#    â€¢ 1H data fetch (yf.Ticker)
#    â†’ These 2 operations run approximately 50 times, not 500!
# ================================================================

async def apply_atmaca_filters(ticker: str) -> Optional[dict]:
    """
    Tek hisse için kapsamlı teknik analiz.

    Returns:
        dict: Hisse geçti ise tİ¼m metrikler ve skor.
        None: Herhangi bir hard reject veya kritik hata oluştuysa.
    """
    try:
        ticker = ticker.strip().upper()

        # =============================================================
        # PHASE 0: BAÅžLANGIÇ — Tİ¼m değişkenleri en başta tanımla
        # =============================================================
        score: float = 0.0
        details: List[str] = []
        is_early_awakening: bool = False  # â”€â”€ V117 FIX: Phase 2B NameError önlemi â”€â”€
        is_steady_momentum: bool = False  # â”€â”€ V117 FIX: Phase 3E NameError önlemi â”€â”€
        financial_health_data: dict = {}  # â”€â”€ V117 FIX: Phase 3N Temel Analiz Verisi â”€â”€

        # =============================================================

        # =============================================================
        # PHASE 1A: TEMEL META FİLTRELER (network yok — cache okuma)
        global persistent_info_cache
        cached_info = get_stock_info(ticker)
        
        # â”€â”€ V117 FIX: Temel analiz verilerini Phase 0/1A'da hazırlıyoruz â”€â”€â”€â”€â”€
        # Bu veriler boga_score_100 içindeki 'F' bölİ¼mİ¼ (10p) için kritiktir.
        financial_health_data = analyze_financial_health(ticker, cached_info)
        
        market_cap   = cached_info.get("market_cap", 0)
        beta         = cached_info.get("beta", 1.0)
        sector_name  = cached_info.get("sector", "Unknown")
        short_float  = cached_info.get("short_float", 0.0)

        # ðŸš¨ FIX: Real Estate (REIT) faiz hassasiyeti ve dİ¼şİ¼k kazanma oranı nedeniyle swing evreninden tamamen çıkarıldı.
        if sector_name == "Real Estate":
            return None

        # Beta hard reject: Çok dİ¼şİ¼k beta = market'i takip etmiyor, swing için uygunsuz
        if 0 < beta < ATMACA_MIN_BETA:
            return None

        # â”€â”€ Industry Hard Reject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # Yİ¼ksek riskli industry gruplarındaki kİ¼çİ¼k şirketler elenir.
        # Kural: Clinical-stage / tek İ¼rİ¼n biyotech = binary event riski var.
        # Bİ¼yİ¼k pharma ($5B+ mcap) bu listede olsa bile eşiği geçer â†’ girer.
        industry_raw = cached_info.get("industry", "Unknown")
        industry_lower = industry_raw.lower()
        if industry_lower in HIGH_RISK_INDUSTRIES and 0 < market_cap < HIGH_RISK_INDUSTRY_MCAP_FLOOR:
            logging.info(f"ðŸš« {ticker}: High-risk industry ({industry_raw}) + kİ¼çİ¼k cap (${market_cap/1e9:.1f}B < $5B) â†’ Elendi")
            return None

        # â”€â”€ CEF / ETF / MutualFund Hard Reject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # V117 FIX: NVG (Nuveen muni CEF) ve BCAT (BlackRock CEF) gibi
        # kapalı uçlu fonlar swing evrenine girmemeli — teknik analiz
        # sinyalleri geçersiz, beta sıfıra yakın, fiyat NAV'a kilitli.
        quote_type_raw = cached_info.get("quoteType", "EQUITY").lower()
        
        
        if quote_type_raw in CEF_BLOCK_QUOTE_TYPES:
            logging.info(f"ðŸš« {ticker}: ETF/CEF/MutualFund (quoteType={quote_type_raw}) â†’ Swing evrenine girmez")
            return None
            
        if industry_lower in CEF_BLOCK_INDUSTRIES:
            logging.info(f"ðŸš« {ticker}: CEF/Fund industry ({industry_raw}) â†’ Swing evrenine girmez")
            return None


        # â”€â”€ Negatif FCF Hard Reject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # Yılda $50M'dan fazla nakit yakan şirket swing için uygun değil.
        # (Borç / dilution / likidite riski — teknik setup'ı geçersiz kılar)
        raw_fcf = cached_info.get("freeCashflow", 0) or 0
        
        # 🎯 FIX: Yfinance bİ¼yİ¼k şirketlerde FCF'yi bazen eksik (0) döndİ¼rİ¼r. 
        # Veri 0 ise, net geliri proxy olarak kullanarak kaçakları (Boeing/BA gibi) yakala.
        if raw_fcf == 0:
            net_inc = cached_info.get("netIncomeToCommon", 0) or 0
            if net_inc < 0:
                raw_fcf = net_inc

        if raw_fcf < NEGATIVE_FCF_FLOOR:
            logging.info(f"ðŸš« {ticker}: Negatif FCF/Net Income Proxy (${raw_fcf/1e6:.0f}M) < ${NEGATIVE_FCF_FLOOR/1e6:.0f}M floor â†’ Elendi")
            return None

        # â”€â”€ Sİ¼rekli Zarar Veren Åžirket Reject â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # Net gelir negatif VE EPS negatif = operasyonel zarar, swing için riskli.
        # İstisna: bİ¼yİ¼k cap ($10B+) â†’ kurumsal destek ve diversified gelir var.
        net_income_raw = cached_info.get("netIncomeToCommon", 0) or 0
        trailing_eps   = cached_info.get("trailingEps", 0) or 0
        if net_income_raw < 0 and trailing_eps < 0 and 0 < market_cap < 10_000_000_000:
            # Sektör istisnası: Real Estate (REIT) ve Utilities negatif net gelir raporlayabilir
            if sector_name not in ("Real Estate", "Utilities", "Energy"):
                logging.info(f"ðŸš« {ticker}: Negatif net gelir (EPS:{trailing_eps:.2f}) + kİ¼çİ¼k cap â†’ Elendi")
                return None

        # =============================================================
        # PHASE 1B: 1D VERİ ÇEKİMİ (BULK_DATA_CACHE'den, 0 ms)
        # =============================================================
        df_1d = await asyncio.to_thread(get_stock_data, ticker, "1d")
        if df_1d is None or len(df_1d) < 60:
            return None  # IPO/yetersiz geçmiş

        avg_volume_10d = float(df_1d["Volume"].tail(10).mean())
        if avg_volume_10d < ATMACA_MIN_AVG_VOLUME:
            return None
        if 0 < market_cap < ATMACA_MIN_MARKET_CAP:
            return None

        # Veri shortcut'ları
        close_1d  = df_1d["Close"]
        high_1d   = df_1d["High"]
        low_1d    = df_1d["Low"]
        volume_1d = df_1d["Volume"]
        current_price = float(close_1d.iloc[-1])

        score += 4.0
        details.append("[OK] UNIVERSE: Likidite/Yapısal koşullar OK")

        # =============================================================
        # PHASE 2A: ANA TEKNİK GÖSTERGELER (Layer 2 öncesi)
        # =============================================================

        # â”€â”€ EMA Sistemi (1D) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        ema20_1d  = EMAIndicator(close_1d, 20).ema_indicator()
        ema50_1d  = EMAIndicator(close_1d, 50).ema_indicator()
        ema200_1d = EMAIndicator(close_1d, 200).ema_indicator()
        last_ema20  = float(ema20_1d.iloc[-1])
        last_ema50  = float(ema50_1d.iloc[-1])
        last_ema200 = float(ema200_1d.iloc[-1])

        # Trend durumu sınıflandırma
        if current_price > last_ema50 > last_ema200:
            trend_durumu_1d = "Macro Bullish"
        elif current_price > last_ema20 > last_ema50 > last_ema200:
            trend_durumu_1d = "Upward"
        elif current_price > last_ema200:
            trend_durumu_1d = "Above EMA200"
        elif current_price > last_ema50:
            trend_durumu_1d = "Above EMA50"
        else:
            trend_durumu_1d = "Downtrend"

        # â”€â”€ BB Width (Squeeze tespiti için gerekli) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        bb_1d = BollingerBands(close_1d, 20, 2)
        bb_width_series = (bb_1d.bollinger_hband() - bb_1d.bollinger_lband()) / ema20_1d
        bb_width = float(bb_width_series.iloc[-1])
        bb_width_avg_50 = float(bb_width_series.tail(50).mean()) if len(bb_width_series) >= 50 else bb_width
        is_squeeze = (bb_width < bb_width_avg_50 * 0.60) or (bb_width < 0.05)

        # â”€â”€ Spring (Failed Breakdown) Tespiti â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        min_low_10d  = float(low_1d.tail(10).iloc[:-1].min())
        current_low  = float(low_1d.iloc[-1])
        daily_range  = float(high_1d.iloc[-1]) - current_low
        is_spring = (
            current_low < min_low_10d
            and current_price > min_low_10d
            and current_price > float(df_1d['Open'].iloc[-1])
            and current_price >= current_low + (daily_range * 0.5)
        )

        # â”€â”€ ADX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            adx_series_1d = ADXIndicator(high_1d, low_1d, close_1d, 14).adx()
            adx_1d = float(adx_series_1d.iloc[-1])
        except Exception:
            adx_series_1d = pd.Series(0.0, index=df_1d.index)
            adx_1d = 0.0

        # â”€â”€ EMA20 Slope â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if len(ema20_1d) >= 10 and float(ema20_1d.iloc[-10]) > 0:
            ema20_slope_numeric = (float(ema20_1d.iloc[-1]) - float(ema20_1d.iloc[-10])) / float(ema20_1d.iloc[-10])
        else:
            ema20_slope_numeric = 0.0
        is_ema_flat = abs(ema20_slope_numeric) < 0.008

        # =============================================================
        # PHASE 2B: HARD REJECT KAPILARI (Layer 2 erken eleme)
        # =============================================================
        # Mantık: Squeeze/Spring varsa bazı kapılarda istisna tanı
        # (sıkışma/dönİ¼ş hisseleri normalde "kötİ¼" görİ¼nİ¼r ama fırsattır)

        # Dead money: hiç sıkışma yok, hiç dönİ¼ş yok, EMA flat ve ADX zayıf
        if not is_squeeze and not is_spring and is_ema_flat and adx_1d < 15:
            return None

        # â”€â”€ RVOL Mikro (son 2 gİ¼n / son 20 gİ¼n) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            vol_2g_avg  = float(volume_1d.tail(2).mean())
            vol_20g_avg = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_2g_avg
            rvol_micro  = (vol_2g_avg / vol_20g_avg) if vol_20g_avg > 0 else 0.0
        except Exception:
            rvol_micro = 0.0

        # RVOL eşiği: REIT'ler daha dİ¼şİ¼k, dirence yakınsa daha esnek
        min_rvol_required = 0.80 if sector_name == "Real Estate" else 1.05
        try:
            macro_resist = float(high_1d.tail(15).max())
            breakout_distance = (macro_resist - current_price) / current_price
            if 0 <= breakout_distance < 0.025:
                # Direncin %2.5 altındaysak, hacimsizlik kopuş öncesi sessizliktir
                min_rvol_required = min(min_rvol_required, 0.85)
        except Exception:
            pass

        if rvol_micro < min_rvol_required and not (is_squeeze or is_spring):
            return None

        # â”€â”€ Trend Hard Gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # EMA200 altındaki sıkışma genelde Bear Flag â†’ sadece Spring'e izin ver
        if current_price < last_ema200 and not is_spring:
            return None

        # 5 gİ¼nde -%3.5 altı dİ¼şİ¼ş = kanama, pullback değil
        if len(close_1d) >= 6:
            ret_5d_pct = (current_price - float(close_1d.iloc[-6])) / float(close_1d.iloc[-6]) * 100
            if ret_5d_pct < -3.5:
                return None

        # â”€â”€ ADX Hard Gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        min_adx_required = 12 if sector_name == "Real Estate" else 18
        if adx_1d > 0 and adx_1d < min_adx_required and not (is_squeeze or is_spring):
            return None

        # â”€â”€ Yeşil Mum Sayısı (son 10 gİ¼n) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            last10 = df_1d.tail(10)
            green_candles = int((last10['Close'] > last10['Open']).sum())
        except Exception:
            green_candles = 0

        if sector_name == "Real Estate":
            min_green_required = 4
        elif is_squeeze or is_spring:
            min_green_required = 3
        else:
            min_green_required = 4

        if green_candles < min_green_required:
            return None

        # â”€â”€ CMF (Chaikin Money Flow) Hesabı â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        cmf_val = 0.0
        try:
            df_cmf = df_1d.tail(25)
            prev_close_l2 = df_cmf['Close'].shift(1)
            true_high_l2 = np.maximum(df_cmf['High'], prev_close_l2)
            true_low_l2  = np.minimum(df_cmf['Low'], prev_close_l2)
            true_range_l2 = (true_high_l2 - true_low_l2).replace(0, np.nan)

            mfm_l2 = ((df_cmf['Close'] - true_low_l2) - (true_high_l2 - df_cmf['Close'])) / true_range_l2
            mfm_l2 = mfm_l2.fillna(0)

            cmf_current = (mfm_l2 * df_cmf['Volume']).tail(20).sum() / df_cmf['Volume'].tail(20).sum()
            cmf_val = float(cmf_current) if not pd.isna(cmf_current) else 0.0
        except Exception:
            cmf_val = 0.0

        # CMF Hard Gate: -0.05 altı = dağıtım (squeeze/spring istisna)
        if cmf_val < -0.05 and not (is_squeeze or is_spring):
            return None

# â”€â”€ RSI Hard Gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            rsi_1d_series = RSIIndicator(close_1d, 14).rsi()
            rsi_quick = float(rsi_1d_series.iloc[-1])
            rsi_prev  = float(rsi_1d_series.iloc[-2]) if len(rsi_1d_series) >= 2 else rsi_quick

            if rsi_quick < RSI_1D_MIN:
                return None  # Çok zayıf
            # Falling Knife: 45 altı + hâlâ dİ¼şİ¼şte
            if rsi_quick < 45 and rsi_quick < rsi_prev:
                return None
                
            # ðŸ†• Yön filtresi: RSI 45-52 arası + 3 gİ¼n İ¼st İ¼ste dİ¼şİ¼yor
            # İstisna: Squeeze/Spring kurulumunda RSI dİ¼şİ¼k/dİ¼şen olabilir
            if not (is_squeeze or is_spring or is_early_awakening):
                rsi_3d_ago = float(rsi_1d_series.iloc[-3]) if len(rsi_1d_series) >= 3 else rsi_quick
                rsi_falling_3d = (rsi_quick < rsi_prev < rsi_3d_ago)
                if rsi_falling_3d and rsi_quick < 52:
                    return None  # Dİ¼şen RSI + zayıf bölge = elenir
  
        except Exception:
            rsi_1d_series = pd.Series([50.0])
            rsi_quick = 50.0

        # â”€â”€ Trend Status Gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if trend_durumu_1d == "Downtrend" and not is_spring:
            return None

        # =============================================================
        # PHASE 3A: NETWORK GEÇİÅžİ — Earnings + 1H Veri
        # =============================================================
        # Buraya ulaşan ~50 hisse var, 450'si zaten elendi.

        if not await asyncio.to_thread(is_earnings_safe_for_swing, ticker):
            logging.info(f"ðŸš« {ticker}: Earnings yakın â†’ Eleme")
            return None

        df_1h = await asyncio.to_thread(get_stock_data, ticker, "1h")
        df_15m = None  # 15m analiz V117'da iptal edildi

        # Layer 2 başarı puanı
        score += 6.0
        details.append(
            f"[OK] LAYER 2: Momentum onaylı "
            f"(RVOL:{rvol_micro:.2f}x | Yeşil:{green_candles}/10 | CMF:{cmf_val:.3f})"
        )
        if rvol_micro >= 1.60:
            score += 2.0
            details.append(f"🔥 Mikro-RVOL agresif: {rvol_micro:.2f}x")

        # =============================================================
        # PHASE 3B: ATR & VOLATİLİTE
        # =============================================================
        try:
            atr_1d_series = AverageTrueRange(high_1d, low_1d, close_1d, ATR_PERIOD).average_true_range()
            atr_1d = float(atr_1d_series.iloc[-1])
        except Exception:
            atr_1d = 0.0

        atr_pct_1d = (atr_1d / current_price) if current_price > 0 else 0.0

        # ATR sınırları
        if atr_pct_1d > 0:
            # â”€â”€ V117 FIX: Çok dar ATR hard reject eşiği %0.5'ten %1.5'e çıkarıldı â”€â”€
            if atr_pct_1d < 0.015:
                return None  # Çok dar, swing için ölİ¼
            max_atr_allowed = 0.120 if beta > 1.5 else 0.080
            if atr_pct_1d > max_atr_allowed:
                return None  # Aşırı volatil
        try:
            bb_width_1d = (bb_1d.bollinger_hband().iloc[-1] - bb_1d.bollinger_lband().iloc[-1]) / current_price if current_price > 0 else 0.0
        except Exception:
            bb_width_1d = 0.0

        # REIT'lerde dar ATR = swing yok
        if atr_pct_1d < 0.025 and sector_name == "Real Estate":
            return None

        # =============================================================
        # PHASE 3C: PUANLAMA — Trend & Sektör & RS
        # =============================================================

        # â”€â”€ Sektör Rotasyonu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        sec_perf = SECTOR_PERFORMANCE.get(sector_name, 0.0)
        if sec_perf > 2.0:
            score += 6.0; details.append(f"🔥 Sektör HOT: {sector_name} (+{sec_perf:.1f}%)")
        elif sec_perf > 0:
            score += 1.2; details.append(f"📊 Sektör Pozitif: {sector_name} (+{sec_perf:.1f}%)")
        elif sec_perf < -2.0:
            score -= 3.2; details.append(f"ðŸ¥¶ Sektör SOÄžUK: {sector_name} ({sec_perf:.1f}%)")
        else:
            score -= 0.8; details.append(f"âž– Sektör Nötr: {sector_name} ({sec_perf:.1f}%)")

        # â”€â”€ Relative Strength (S&P 500'e karşı) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        rs_label = "N/A"
        rs_slope = 0.0
        index_close = get_index_close_series(INDEX_BENCHMARK)
        if index_close is not None:
            idx_aligned = index_close.reindex(close_1d.index, method="ffill").dropna()
            common_idx  = close_1d.index.intersection(idx_aligned.index)
            if len(common_idx) >= 20:
                rs_series = close_1d.loc[common_idx] / idx_aligned.loc[common_idx]
                rs_tail = rs_series.tail(min(RS_LOOKBACK, len(rs_series)))
                try:
                    rs_slope = float(np.polyfit(range(len(rs_tail)), rs_tail.values, 1)[0])
                except Exception:
                    rs_slope = 0.0

                if rs_slope > 0.0005:
                    score += 4.8; rs_label = "Strong Outperform"
                    details.append(f"ðŸ’ª RS: {INDEX_BENCHMARK} İ¼stİ¼ (Gİ¼çlİ¼)")
                elif rs_slope > 0:
                    score += 2.0; rs_label = "Mild Outperform"
                    details.append(f"📈 RS: {INDEX_BENCHMARK} İ¼stİ¼ (Hafif)")
                elif rs_slope > -0.0005:
                    score -= 1.2; rs_label = "Neutral"
                    details.append("âž– RS: Paralel")
                else:
                    score -= 3.2; rs_label = "Underperform"
                    details.append(f"âš ï¸ RS: {INDEX_BENCHMARK} altı")

        is_strong_rs = rs_slope > 0.0005

        # â”€â”€ 1W Multi-Timeframe Onay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        is_above_1w_ema50 = True
        try:
            weekly_close = close_1d.resample('W').last().dropna()

            if len(weekly_close) >= 50:
                weekly_ema50 = EMAIndicator(weekly_close, 50).ema_indicator()
                last_w_ema50 = float(weekly_ema50.iloc[-1])
                if current_price < last_w_ema50:
                    is_above_1w_ema50 = False
                    score -= 5.0
                    details.append("🔴 1W TREND: Fiyat < 1W EMA50 (-5p)")

            if len(weekly_close) >= 14:
                weekly_rsi = RSIIndicator(weekly_close, 14).rsi()
                last_w_rsi = float(weekly_rsi.iloc[-1])
                if last_w_rsi < 40:
                    score -= 3.0
                    details.append(f"â„ï¸ 1W RSI: Zayıf ({last_w_rsi:.1f})")
        except Exception:
            pass

        # â”€â”€ 1D EMA Trend Puanlaması â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if trend_durumu_1d == "Macro Bullish":
            score += 14.0
            details.append("ðŸ† 1D TREND: Macro Bullish (P>EMA50>EMA200)")
            ema_spread = (last_ema50 - last_ema200) / last_ema200 if last_ema200 > 0 else 0.0
            if ema_spread > 0.03:
                score += 1.6
                details.append("🔥 EMA50-200 Geniş Spread")
        elif trend_durumu_1d == "Upward":
            score += 8.8; details.append("📈 1D TREND: Sıralı Yİ¼kseliş (EMA20>50>200)")
        elif trend_durumu_1d == "Above EMA200":
            score += 3.2; details.append("🟢 1D TREND: EMA200 İ¼stİ¼")
        elif trend_durumu_1d == "Above EMA50":
            score += 1.2; details.append("ðŸŸ¡ 1D TREND: EMA50 İ¼stİ¼")
        else:
            score -= 6.0; details.append("🔴 1D TREND: Aşağı")

        # EMA20 slope
        cond_ema20_slope_positive = calculate_ema_slope(ema20_1d, periods=10)
        if cond_ema20_slope_positive:
            score += 4.0; details.append("📈 EMA20: Pozitif eğim")
        else:
            score -= 1.6; details.append("ðŸ“‰ EMA20: Negatif/Dİ¼z eğim")

        # =============================================================
        # PHASE 3D: ALPHA ENGINES (Squeeze / Spring Bonus)
        # =============================================================

        # â”€â”€ YENİ: Squeeze Kalite Kontrolİ¼ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if is_squeeze:
            # Squeeze kalite puanı: BB sıkışma derinliği
            # 0.0 = barely squeeze, 1.0 = extreme squeeze
            squeeze_quality = max(0.0, 1.0 - (bb_width / (bb_width_avg_50 * 0.60)))
            squeeze_quality = min(squeeze_quality, 1.0)

            # Base bonus: 10-22 arası (eskiden sabit 25)
            squeeze_base = 10.0 + (12.0 * squeeze_quality)

            # Muafiyet maliyeti: hangi kapılardan "bedava" geçti?
            squeeze_exemption_cost = 0.0
            if rvol_micro < 1.05:
                squeeze_exemption_cost += 3.0   # RVOL muafiyeti kullandı
            if cmf_val < -0.05:
                squeeze_exemption_cost += 3.0   # CMF muafiyeti kullandı
            if is_ema_flat and adx_1d < 15:
                squeeze_exemption_cost += 2.0   # Dead money muafiyeti kullandı
            if green_candles < 4:
                squeeze_exemption_cost += 1.5   # Green candle muafiyeti kullandı

            squeeze_net = squeeze_base - squeeze_exemption_cost
            score += squeeze_net

            exemption_note = f" (Muafiyet maliyeti: -{squeeze_exemption_cost:.1f})" if squeeze_exemption_cost > 0 else ""
            details.append(
                f"ðŸš¨ SQUEEZE: Kalite {squeeze_quality*100:.0f}% | "
                f"Bonus: +{squeeze_net:.1f}{exemption_note}"
            )
        elif is_spring:
            score += 18.0
            details.append("⚡ SNIPER: Failed Breakdown / Spring — TUZAK BİTTİ")

        # â”€â”€ ADX Slope + Level Puanı â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            adx_slope = float(adx_series_1d.diff().tail(5).mean())
        except Exception:
            adx_slope = 0.0

        if adx_1d >= 40:
            score -= 3.0; details.append(f"âš ï¸ ADX: Zirve/Tİ¼kenme ({adx_1d:.1f})")
        elif adx_1d >= 28:
            score += 2.0; details.append(f"ðŸ’ª ADX: Kurulu Trend ({adx_1d:.1f})")
        elif adx_1d >= 18:
            score += 5.0; details.append(f"🔥 ADX: Trend Uyanışı — OPTIMAL ({adx_1d:.1f})")
        else:
            score -= 2.0; details.append(f"ðŸŸ¡ ADX: Çok Zayıf ({adx_1d:.1f})")

        if adx_slope > 0.8:
            score += 2.0; details.append(f"⚡ ADX Slope: Agresif (+{adx_slope:.2f}/bar)")
        elif adx_slope > 0.3:
            score += 1.0; details.append(f"📈 ADX Slope: Yİ¼kseliyor ({adx_slope:.2f}/bar)")
        elif adx_slope < -0.5:
            score -= 3.0; details.append(f"ðŸŒ ADX Slope: Soluyor ({adx_slope:.2f}/bar)")

        # â”€â”€ Beta Volatilite Ödİ¼lİ¼ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if beta >= 1.5:
            score += 4.0; details.append(f"ðŸš€ High Beta ({beta:.2f}): Hızlı hareket")
        elif beta >= 1.2:
            score += 2.0; details.append(f"📈 Good Beta ({beta:.2f}): Market İ¼stİ¼")
        elif beta < 0.8:
            score -= 2.0; details.append(f"ðŸ¢ Low Beta ({beta:.2f}): Yavaş")

        # â”€â”€ ATR Rejimi Puanlaması â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if atr_pct_1d < 0.025:
            if is_squeeze:
                score -= 1.0; details.append("âš ï¸ VOL: Squeeze sıkışması (ATR<2.5% normal)")
            else:
                # â”€â”€ V117 FIX: ATR cezaları WTS gibi ağır hisseleri ezmemesi için yumuşatıldı â”€â”€
                score -= 5.0; details.append("🔴 VOL: 7g swing için yavaş (ATR<2.5%)")
        elif atr_pct_1d < 0.035:
            score -= 1.0; details.append("âš ï¸ VOL: Hafif Yavaş (ATR<3.5%)")
        elif atr_pct_1d < 0.045:
            score += 6.0; details.append("⚡ VOL: İyi Swing")
        elif atr_pct_1d <= 0.075:
            score += 8.0; details.append("🔥 VOL: 7g HEDEF Sweet Spot")
        elif atr_pct_1d <= 0.100:
            score += 4.5; details.append("ðŸŸ§ VOL: Yİ¼ksek (yönetilen risk)")
        else:
            score += 1.0; details.append("ðŸŸ¨ VOL: Aşırı (riskli)")

        # =============================================================
        # PHASE 3E: RSI / MACD / OBV / CMF Puanlaması
        # =============================================================

        # â”€â”€ RSI Puanlaması (sektöre göre) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        rsi_1d_val = rsi_quick  # Zaten yukarıda hesaplandı

        if sector_name == "Real Estate":
            if 38 <= rsi_1d_val <= 55:
                score += 8.0; details.append(f"ðŸ¢ REIT RSI: Optimal Base ({rsi_1d_val:.1f})")
            elif 55 < rsi_1d_val <= 65:
                score += 4.0; details.append(f"📈 REIT RSI: Momentum ({rsi_1d_val:.1f})")
            elif rsi_1d_val > 65:
                score -= 5.0; details.append(f"âš ï¸ REIT RSI: Aşırı Åžişkin ({rsi_1d_val:.1f})")
            elif rsi_1d_val < 35:
                score -= 3.2; details.append(f"â„ï¸ REIT RSI: Zayıf ({rsi_1d_val:.1f})")
            else:
                score += 0.4; details.append(f"âž– REIT RSI: Nötr ({rsi_1d_val:.1f})")
        else:
            if RSI_BOGA_OPT_MIN <= rsi_1d_val <= 60:
                score += 8.0; details.append(f"ðŸŒ€ RSI: Sniper Sweet Spot ({rsi_1d_val:.1f})")
            elif 60 < rsi_1d_val <= 68:
                score += 4.0; details.append(f"📈 RSI: Momentum Devamı ({rsi_1d_val:.1f})")
            elif 68 < rsi_1d_val <= RSI_1D_MAX and is_strong_rs:
                score += 2.0; details.append(f"ðŸš€ RSI: Gİ¼çlİ¼ Momentum Lideri ({rsi_1d_val:.1f})")
            elif 68 < rsi_1d_val <= 75 and not is_strong_rs:
                score -= 5.0; details.append(f"âš ï¸ RSI: FOMO Riski ({rsi_1d_val:.1f})")
            elif rsi_1d_val < 40:
                score -= 3.2; details.append(f"â„ï¸ RSI: Zayıf ({rsi_1d_val:.1f})")
            elif rsi_1d_val > RSI_1D_MAX or (rsi_1d_val > 75 and not is_strong_rs):
                score -= 10.0; details.append(f"🔴 RSI: Overbought Peak ({rsi_1d_val:.1f})")
            else:
                score += 0.4; details.append(f"âž– RSI: Nötr ({rsi_1d_val:.1f})")

        # RSI Divergence (negatif)
        try:
            if (
                len(close_1d) > 5
                and close_1d.iloc[-1] > close_1d.iloc[-5]
                and rsi_1d_series.iloc[-1] < rsi_1d_series.iloc[-5]
            ):
                score -= 4.0; details.append("âš ï¸ RSI Diverjans: Negatif")
        except Exception:
            pass

        # RSI Slope (1D)
        rsi_slope_5 = 0.0
        try:
            if len(rsi_1d_series) >= 5:
                rsi_slope_5 = float(rsi_1d_series.iloc[-1]) - float(rsi_1d_series.iloc[-5])
                if rsi_slope_5 < -5:
                    score -= 3.0; details.append(f"ðŸ“‰ RSI Slope: Gİ¼çlİ¼ dİ¼şİ¼ş ({rsi_slope_5:.1f})")
                elif rsi_slope_5 < -2:
                    score -= 1.5; details.append(f"â†˜ï¸ RSI Slope: Hafif dİ¼şİ¼ş ({rsi_slope_5:.1f})")
                elif rsi_slope_5 > 5:
                    score += 2.0; details.append(f"📈 RSI Slope: Gİ¼çlİ¼ yİ¼kseliş ({rsi_slope_5:.1f})")
                elif rsi_slope_5 > 2:
                    score += 1.0; details.append(f"â†—ï¸ RSI Slope: Yİ¼kselişte ({rsi_slope_5:.1f})")
        except Exception:
            pass

        # â”€â”€ Exhaustion Tespiti â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        is_exhausted = False
        try:
            roc_3d = (
                (float(close_1d.iloc[-1]) - float(close_1d.iloc[-4])) / float(close_1d.iloc[-4]) * 100
                if len(close_1d) >= 4 else 0.0
            )
            ret_1d_pct = (
                (float(close_1d.iloc[-1]) - float(close_1d.iloc[-2])) / float(close_1d.iloc[-2]) * 100
                if len(close_1d) >= 2 else 0.0
            )

            is_overbought_rsi = (rsi_1d_val > 80.0) or (rsi_1d_val > 75.0 and not is_strong_rs)

            if roc_3d > 12.0 or is_overbought_rsi or ret_1d_pct > 6.0:
                is_exhausted = True
                reasons_ex = []
                if roc_3d > 12.0:
                    reasons_ex.append(f"3G ROC: +{roc_3d:.1f}% (Parabolic)")
                if ret_1d_pct > 6.0:
                    reasons_ex.append(f"1G ROC: +{ret_1d_pct:.1f}% (Spike FOMO)")
                if is_overbought_rsi:
                    reasons_ex.append(f"RSI: {rsi_1d_val:.1f} (Peak)")
                score -= 20.0
                details.append(f"🔴 EXHAUSTED / FOMO: {', '.join(reasons_ex)}")
        except Exception:
            pass

        # â”€â”€ MACD Histogram â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        macd_hist_val = 0.0
        try:
            macd_obj = MACD(close_1d, window_slow=26, window_fast=12, window_sign=9)
            macd_hist = macd_obj.macd_diff()
            macd_hist_val = float(macd_hist.iloc[-1])
            macd_hist_prev = float(macd_hist.iloc[-2]) if len(macd_hist) >= 2 else 0.0

            if macd_hist_val > 0 and macd_hist_val > macd_hist_prev:
                score += 3.0; details.append(f"📈 MACD Hist: Yİ¼kseliyor ({macd_hist_val:.3f})")
            elif macd_hist_val > 0:
                score += 1.5; details.append(f"[OK] MACD Hist: Pozitif ({macd_hist_val:.3f})")
            elif (
                macd_hist_val < 0
                and macd_hist_val > macd_hist_prev
                and (macd_hist_val - macd_hist_prev) > abs(macd_hist_prev) * 0.15
            ):
                score += 2.5; details.append("🌅 MACD: Gİ¼çlİ¼ Dip Dönİ¼ş Momentumu")
            elif macd_hist_val < 0:
                score -= 2.0; details.append(f"âš ï¸ MACD Hist: Negatif ({macd_hist_val:.3f})")
        except Exception:
            macd_hist_val = 0.0

        # â”€â”€ CMF Puanlaması (sadece zayıf birikim cezası) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        # Negatif CMF zaten hard gate'te elenmişti, burada hafif uyarılar
        # İstisna: Spring ve Steady Momentum tam muaf.
        # Squeeze ise muafiyet maliyetini ödediği için sadece "indirim" alır.
        if -0.05 <= cmf_val < 0.0 and not (is_spring or is_steady_momentum):
            penalty = 1.0 if is_squeeze else 2.0
            score -= penalty
            details.append(f"âš ï¸ CMF Hafif Negatif ({cmf_val:.3f}){' (Squeeze indirimi)' if is_squeeze else ''}")
        elif 0.0 <= cmf_val < 0.08 and not (is_spring or is_steady_momentum):
            penalty = 2.0 if is_squeeze else 4.0
            score -= penalty
            details.append(f"âš ï¸ CMF Zayıf Birikim ({cmf_val:.3f}){' (Squeeze indirimi)' if is_squeeze else ''}")

        # =============================================================
        # PHASE 3F: 1H MİKRO ANALİZ
        # =============================================================
        h1_summary = {"Status": "Insufficient Data"}
        rsi_1h = 50.0
        adx_1h = 0.0
        atr_pct_1h = 0.0
        rvol_1h = 0.0
        rsi_1h_slope = 0.0

        if df_1h is not None and len(df_1h) >= 10:
            close_1h  = df_1h["Close"]
            high_1h   = df_1h["High"]
            low_1h    = df_1h["Low"]
            volume_1h = df_1h["Volume"]

            ema20_1h = EMAIndicator(close_1h, 20).ema_indicator()
            ema50_1h = EMAIndicator(close_1h, 50).ema_indicator()

            try:
                rsi_1h = float(RSIIndicator(close_1h, 14).rsi().iloc[-1])
            except Exception:
                rsi_1h = 50.0
            try:
                adx_1h = float(ADXIndicator(high_1h, low_1h, close_1h, 14).adx().iloc[-1])
            except Exception:
                adx_1h = 0.0
            try:
                atr_1h_series = AverageTrueRange(high_1h, low_1h, close_1h, ATR_PERIOD).average_true_range()
                atr_1h = float(atr_1h_series.iloc[-1])
                atr_pct_1h = atr_1h / float(close_1h.iloc[-1]) if float(close_1h.iloc[-1]) > 0 else 0.0
            except Exception:
                atr_1h = 0.0

            try:
                vol_ma_1h = volume_1h.rolling(10).mean()
                rvol_1h = float(volume_1h.iloc[-1]) / float(vol_ma_1h.iloc[-1]) if float(vol_ma_1h.iloc[-1]) > 0 else 0.0
            except Exception:
                rvol_1h = 0.0

            close_now_1h = float(close_1h.iloc[-1])
            ema20_now_1h = float(ema20_1h.iloc[-1])
            ema50_now_1h = float(ema50_1h.iloc[-1])
            ema20_distance = (close_now_1h - ema20_now_1h) / ema20_now_1h if ema20_now_1h > 0 else 0.0

            # 1H ADX
            if adx_1h >= 30:
                score += 10.0; details.append(f"🔥 1H ADX: Çok Gİ¼çlİ¼ ({adx_1h:.1f})")
            elif adx_1h >= 20:
                score += 6.0; details.append(f"ðŸ’ª 1H ADX: Gİ¼çlİ¼ ({adx_1h:.1f})")
            elif adx_1h >= 14:
                score += 2.4; details.append(f"ðŸŸ¡ 1H ADX: Erken ({adx_1h:.1f})")
            else:
                score -= 3.2; details.append(f"âš ï¸ 1H ADX: Zayıf ({adx_1h:.1f})")

            # EMA20 mesafesi (FOMO koruması)
            if ema20_distance > 0.05:
                score -= 20.0; details.append(f"🔴 1H: EXTREME FOMO RİSKİ (+{ema20_distance*100:.1f}%)")
            elif ema20_distance > 0.025:
                score -= 6.0; details.append(f"ðŸŸ¡ 1H: Uzama Riski (+{ema20_distance*100:.1f}%)")
            elif close_now_1h > ema50_now_1h:
                score += 4.8; details.append("ðŸ—ï¸ 1H: EMA50 İ¼stİ¼ (Gİ¼çlİ¼)")
            elif close_now_1h > ema20_now_1h:
                score += 2.0; details.append("ðŸŸ¡ 1H: EMA20 İ¼stİ¼")
            else:
                score -= 2.4; details.append("âš ï¸ 1H: EMA altı")

            cond_ema20_slope_1h = calculate_ema_slope(ema20_1h, periods=5)
            if cond_ema20_slope_1h:
                score += 2.0; details.append("📈 1H EMA20: Pozitif Slope")

            # 1H RSI
            if 45 <= rsi_1h <= 72:
                score += 2.4; details.append(f"ðŸŒ€ 1H RSI: Optimal ({rsi_1h:.1f})")
            elif 72 < rsi_1h <= RSI_1H_MAX:
                score -= 4.0; details.append(f"âš ï¸ 1H RSI: Overbought ({rsi_1h:.1f})")
            elif rsi_1h > RSI_1H_MAX:
                score -= 10.0; details.append(f"🔴 1H RSI: FOMO Peak ({rsi_1h:.1f})")
            elif rsi_1h < 35:
                score -= 10.0; details.append(f"🔴 1H RSI: Çok Zayıf ({rsi_1h:.1f})")
            elif rsi_1h < 45:
                score -= 4.0; details.append(f"â„ï¸ 1H RSI: Zayıf Bölge ({rsi_1h:.1f})")

            # 1H RSI Slope
            try:
                rsi_1h_series = RSIIndicator(close_1h, 14).rsi()
                if len(rsi_1h_series) >= 3:
                    rsi_1h_slope = float(rsi_1h_series.iloc[-1]) - float(rsi_1h_series.iloc[-3])
                    if rsi_1h_slope < -8:
                        score -= 5.0; details.append(f"ðŸ“‰ 1H RSI Slope: Sert dİ¼şİ¼ş ({rsi_1h_slope:.1f})")
                    elif rsi_1h_slope < -3:
                        score -= 2.5; details.append(f"â†˜ï¸ 1H RSI Slope: Dİ¼şİ¼şte ({rsi_1h_slope:.1f})")
                    elif rsi_1h_slope > 8:
                        score += 3.0; details.append(f"📈 1H RSI Slope: Sert yİ¼kseliş ({rsi_1h_slope:.1f})")
                    elif rsi_1h_slope > 3:
                        score += 1.5; details.append(f"â†—ï¸ 1H RSI Slope: Yİ¼kselişte ({rsi_1h_slope:.1f})")
            except Exception:
                pass

            # Dual-TF RSI Dİ¼şİ¼ş — Hard Block
            if rsi_slope_5 < -4 and rsi_1h_slope < -4:
                if is_squeeze or is_spring:
                    # Squeeze+RSI dİ¼şİ¼şİ¼ = olası bear squeeze. Puan dİ¼ş ama eleme yok.
                    dual_tf_penalty = -12.0 if (rsi_slope_5 < -7 and rsi_1h_slope < -7) else -8.0
                    score += dual_tf_penalty
                    details.append(
                        f"âš ï¸ DUAL-TF RSI DÜÅžÜÅž: 1D({rsi_slope_5:.1f}) + 1H({rsi_1h_slope:.1f}) "
                        f"Ceza: {dual_tf_penalty:.0f} (Squeeze/Spring İstisna)"
                    )
                else:
                    # Hard eleme — squeeze/spring dışında tolerans yok
                    logging.info(f"ðŸš« {ticker}: Dual-TF RSI dİ¼şİ¼ş â†’ Elendi")
                    return None

            # 1H RVOL
            if rvol_1h >= 2.5:
                score += 7.2; details.append(f"ðŸ³ 1H RVOL: Para Girişi ({rvol_1h:.1f}x)")
            elif rvol_1h >= 1.5:
                score += 3.2; details.append(f"📊 1H RVOL: Yİ¼ksek ({rvol_1h:.1f}x)")
            elif rvol_1h < 0.7:
                score -= 1.6; details.append(f"â„ï¸ 1H RVOL: Hacimsiz ({rvol_1h:.1f}x)")

            # 1H Pivot Higher-Low
            lows_1h = low_1h.tail(20)
            pivots_1h = []
            for i in range(2, len(lows_1h) - 2):
                if lows_1h.iloc[i] < lows_1h.iloc[i - 1] and lows_1h.iloc[i] < lows_1h.iloc[i + 1]:
                    pivots_1h.append(float(lows_1h.iloc[i]))
            if len(pivots_1h) >= 2 and pivots_1h[-1] > pivots_1h[-2]:
                score += 2.4; details.append("ðŸ”° 1H: Pivot Higher-Low")

            # 1H ATR optimal aralık
            if ATR_MIN_PCT_1H <= atr_pct_1h <= ATR_MAX_PCT_1H:
                score += 2.0

            rvol_durumu = (
                "🔥 EXTREMELY INTENSE" if rvol_1h > 3.0 else
                "[OK] High" if rvol_1h > 1.5 else
                "â„ï¸ Volumeless" if rvol_1h < 0.7 else
                "Normal"
            )

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
            score -= 1.2
            details.append("âš ï¸ 1H Veri Yok")

        # =============================================================
        # PHASE 3G: MTF LOCK + Geri Kalan İndikatörler
        # =============================================================

        # MTF Lock: EMA200 İ¼stİ¼ olmalı (Spring istisna)
        is_1d_bullish = current_price > last_ema200
        if not is_1d_bullish and not is_spring:
            return None

        # â”€â”€ OBV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            obv_1d = OnBalanceVolumeIndicator(close_1d, volume_1d).on_balance_volume()
            obv_tail = obv_1d.tail(OBV_TREND_DAYS).values
            obv_slope = float(np.polyfit(range(len(obv_tail)), obv_tail, 1)[0])
        except Exception:
            obv_slope = 0.0

        if obv_slope > 1000:
            score += 6.0; details.append("[OK] OBV: Gİ¼çlİ¼ Birikim")
        elif obv_slope > 0:
            score += 2.4; details.append("📈 OBV: Pozitif Trend")
        elif obv_slope < -1000:
            score -= 3.2; details.append("âš ï¸ OBV: Dağıtım Riski")
        else:
            score -= 0.8; details.append("âž– OBV: Nötr")

        # â”€â”€ 1D RVOL & Churn Koruması â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        vol_today = float(volume_1d.iloc[-1])
        vol_ma_1d = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_today
        rvol_today = (vol_today / vol_ma_1d) if vol_ma_1d > 0 else 0.0
        close_change_pct = (
            (float(close_1d.iloc[-1]) - float(close_1d.iloc[-2])) / float(close_1d.iloc[-2])
            if len(close_1d) > 1 else 0.0
        )

        # Churn: yİ¼ksek hacim + dar gövde = sahte momentum
        open_today = float(df_1d['Open'].iloc[-1])
        candle_range = float(high_1d.iloc[-1]) - float(low_1d.iloc[-1])
        candle_body = abs(current_price - open_today)
        churn_ratio = (candle_body / candle_range) if candle_range > 0 else 1.0

        if churn_ratio < 0.30 and rvol_today > 2.0 and not is_spring:
            return None  # Doji/pinbar with volume = churn

        if rvol_today > 2.5 and close_change_pct < -0.015:
            return None  # Yİ¼ksek hacimli dİ¼şİ¼ş = dağıtım

        if close_change_pct > 0.08:
            return None  # %8+ tek gİ¼nde = aşırı şişme

        # 20G dar range = ölİ¼ hisse (squeeze hariç)
        try:
            price_20d_range = (high_1d.tail(20).max() - low_1d.tail(20).min()) / current_price
            if 0 < price_20d_range < 0.05 and not is_squeeze:
                return None
        except Exception:
            pass

        # 1D RVOL Rejimi puanlaması
        if 1.2 <= rvol_today <= 1.8 and abs(close_change_pct) < 0.006:
            score += 6.4; details.append(f"ðŸ‹ RVOL: Sessiz Birikim ({rvol_today:.2f}x)")
        elif rvol_today > 2.0 and close_change_pct > 0.008:
            score += 8.0; details.append(f"[START] RVOL: Swing Uyanışı ({rvol_today:.2f}x)")
        elif rvol_today > 1.5:
            score += 3.2; details.append(f"📊 RVOL: Aktif ({rvol_today:.2f}x)")
        elif rvol_today < 0.6:
            score -= 3.2; details.append(f"ðŸ¢ RVOL: Hacimsiz ({rvol_today:.2f}x)")
        else:
            score += 0.8; details.append(f"âž– RVOL: Normal ({rvol_today:.2f}x)")

        # â”€â”€ Hacim Trendi (5G/20G) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        vol_avg5  = float(volume_1d.tail(VOLUME_INCREASE_LOOKBACK).mean())
        vol_avg20 = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_avg5
        vol_increase_ratio = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 0.0

        if vol_increase_ratio > 1.4:
            score += 7.2; details.append(f"🔥 Hacim Trendi: Artış ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio > 1.1:
            score += 4.0; details.append(f"📈 Hacim Trendi: Erken ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio < 0.8:
            score -= 2.4; details.append(f"ðŸ“‰ Hacim Trendi: Zayıf ({vol_increase_ratio:.2f}x)")
        else:
            score += 0.8; details.append(f"âž– Hacim Trendi: Stabil ({vol_increase_ratio:.2f}x)")

        # =============================================================
        # PHASE 3H: PİYASA REJİMİ ETKİSİ
        # =============================================================
        market_regime = MARKET_STATUS.get("regime", "UNKNOWN")
        market_modifier = MARKET_STATUS.get("min_score_modifier", 0.0)

        if market_modifier != 0.0:
            regime_score_effect = -market_modifier * 8.0
            score += regime_score_effect
            details.append(f"⚖ï¸ Piyasa Rejim Adj ({market_regime}): {regime_score_effect:+.1f}p")

        try:
            ema50_10d_ago = float(ema50_1d.iloc[-10]) if len(ema50_1d) >= 10 else float(ema50_1d.iloc[-1])
            ema50_slope_check = (
                (float(ema50_1d.iloc[-1]) - ema50_10d_ago) / ema50_10d_ago
                if ema50_10d_ago > 0 else 0.0
            )
        except Exception:
            ema50_slope_check = 0.0

        vol_5d_trend = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 1.0

        if ema50_slope_check > 0 and vol_5d_trend > 1.1:
            score += 3.2; details.append("🟢 Trend-Hacim Senkron")

        if market_regime == "STRONG" and ema50_slope_check > 0:
            score += 3.2; details.append("ðŸ’Ž STRONG Market Hizalama")
        elif market_regime == "BULLISH" and vol_5d_trend >= 0.80:
            score += 1.6; details.append("[OK] Bullish Market Hizalama")
        elif market_regime == "CHOPPY":
            if vol_5d_trend >= 0.75 and ema50_slope_check > 0:
                score += 3.2; details.append("[OK] Choppy'de Sağlam Sinyal")
            else:
                score -= 3.2; details.append("âš ï¸ Choppy'de Zayıf Yapı")
        elif market_regime == "HIGH_VOLATILITY" and vol_5d_trend < 1.0:
            score -= 5.0; details.append("ðŸš¨ Yİ¼ksek Vol & Daralan Hacim Riski")

        # =============================================================
        # PHASE 3I: SMART MONEY / RISING / ICHIMOKU / VP
        # =============================================================

        # â”€â”€ ðŸ†• Steady Momentum & Higher High/Low Bonus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        try:
            # 5 gİ¼nlİ¼k kademeli yİ¼kseliş kontrolİ¼ (tek gİ¼nlİ¼k spike değil, yavaş/sağlam trend)
            
            if len(close_1d) >= 5:
                close_5d = close_1d.tail(5).values
                # En fazla %1'lik ufak geri çekilmelere tolerans tanı, net kapanış yİ¼ksek olsun ve 1G ret %5 altında olsun
                is_steady_momentum = all(close_5d[i] >= close_5d[i-1] * 0.99 for i in range(1, 5)) and (close_5d[-1] > close_5d[0]) and (ret_1d_pct < 5.0)

                if is_steady_momentum:
                    score += 12.0
                    details.append("📈 Steady Momentum: Sağlam ve kademeli trend (+12p)")

            # 🎯 FIX 2: HH/HL yapısını 2 gİ¼nlİ¼k gİ¼rİ¼ltİ¼den çıkarıp 5 gİ¼nlİ¼k trend pencerisine yayıyoruz
            if len(high_1d) >= 5 and len(low_1d) >= 5:
                hh_hl_valid = (float(high_1d.iloc[-1]) > float(high_1d.iloc[-5])) and (float(low_1d.iloc[-1]) > float(low_1d.iloc[-5]))
                if hh_hl_valid and trend_durumu_1d in ["Macro Bullish", "Upward"]:
                    score += 6.0
                    details.append("ðŸ”° HH/HL Yapısı: Gİ¼çlİ¼ trend devamı (+6p)")
        except Exception:
            pass

        smart_money = analyze_smart_money_flow(df_1d, ticker, cached_info)
        if smart_money['has_smart_flow']:
            score += smart_money['score'] * 0.8
            details.extend(smart_money['details'])

        rising = detect_rising_stock(df_1d, adx_1d)
        if rising['is_rising']:
            score += rising['score'] * 0.6
            details.extend(rising['details'])

        try:
            if len(df_1d) >= 60:
                df_ichi = calculate_ichimoku(df_1d)
                ichi_result = check_ichimoku_setup(df_ichi)
                if ichi_result['valid']:
                    score += ichi_result['bonus']
                    details.append(ichi_result['msg'])
        except Exception:
            pass

        try:
            vp_result = check_volume_profile(df_1d)
            if vp_result['valid']:
                score += vp_result['bonus']
                details.append(vp_result['msg'])
        except Exception:
            pass

        mfi_val = smart_money.get('mfi', 50.0)

        # =============================================================
        # PHASE 3J: TP/SL HESAPLAMA + R/R Erken Eleme
        # =============================================================
        tp1, tp2, tp3, stop_loss = calculate_profit_target(
            current_price, atr_1d, score, is_exhausted, beta
        )
        risk = max(current_price - stop_loss, 0.0)
        reward = max(tp2 - current_price, 0.0)
        rr_ratio_calc = (reward / risk) if risk > 0 else 0.0

        # Esnek erken eleme: R/R < 1.0 = umutsuz
        if 0.0 < rr_ratio_calc < 1.0:
            return None

        profit_expectation_pct = (reward / current_price) * 100 if current_price > 0 else 0.0

        # 🎯 FIX: Mutlak kazanç potansiyeli %3'İ¼n altındaysa swing için anlamsız (Muni/Bond ETF koruması)
        if profit_expectation_pct < 3.0:
            return None

        # =============================================================
        # PHASE 3K: ENTRY TRIGGER + SİSTEM SEÇİMİ
        # =============================================================
        entry_trigger: Optional[str] = None
        selection_system = "MOMENTUM"
        selection_reasons: List[str] = []

        try:
            ema9_series = EMAIndicator(close_1d, 9).ema_indicator()
            ema9_now  = float(ema9_series.iloc[-1])
            ema9_prev = float(ema9_series.iloc[-2])
            ema20_now = float(ema20_1d.iloc[-1])
            ema20_prev = float(ema20_1d.iloc[-2])
            ema50_now_1d = float(ema50_1d.iloc[-1])
        except Exception:
            ema9_now = ema9_prev = ema20_now = ema20_prev = ema50_now_1d = 0.0

        ema_cross    = ema9_now > ema20_now and ema9_prev <= ema20_prev
        ema_stack    = ema9_now > ema20_now > ema50_now_1d
        bb_squeeze   = bb_width_1d < 0.05
        ema9_slope   = (ema9_now - ema9_prev) / ema9_prev if ema9_prev > 0 else 0.0
        micro_volume = rvol_today > 1.2

        is_early_awakening = (
            current_price > ema20_now
            and 45 <= rsi_1d_val <= 55
            and 0.9 <= rvol_today <= 1.3
        )

        # Spring varsa öncelikli
        if is_spring:
            selection_system = "SPRING"
            selection_reasons.append("Failed_Breakdown")

        # Trigger seçimi (öncelik sırası)
        if bb_squeeze and ema_stack:
            vol_avg_3d = float(volume_1d.tail(3).mean())
            vol_avg_20d = vol_avg20  # zaten yukarıda hesaplandı

            if vol_avg_3d < (vol_avg_20d * 1.30):
                entry_trigger = "Pre-breakout (Low Vol Squeeze)"
                score += 20.0
            else:
                entry_trigger = "BB Squeeze + EMA Stack + Volume"
                score += 25.0

            selection_system = "SQUEEZE"
            selection_reasons.extend(["BB_Squeeze", "EMA_Stack", "Volume_Confirm"])
            details.append("ðŸ’¥ ENTRY: DAY 0 SQUEEZE BREAKOUT (SNIPER)")

        elif is_early_awakening:
            score += 18.0
            entry_trigger = "Early Awakening (Stealth Breakout)"
            selection_system = "AWAKENING"
            selection_reasons.extend(["Stealth_Breakout", "RSI_Sweet_Spot"])
            details.append("🌅 ENTRY: DAY 0 EARLY AWAKENING")

        elif ema_cross and 1.1 <= rvol_today <= 1.8:
            score += 10.0
            entry_trigger = "EMA9/20 Crossover + Micro Volume"
            selection_system = "EMA_CROSS"
            selection_reasons.extend(["EMA9_20_Cross", "Micro_Volume"])
            details.append("🎯 ENTRY: EMA9/20 Fresh Cross")

        elif ema9_slope > 0.003 and bb_squeeze and micro_volume:
            score += 15.0
            entry_trigger = "EMA9 Slope + Squeeze + Micro Volume"
            selection_system = "SQUEEZE"
            selection_reasons.extend(["EMA9_Slope", "BB_Squeeze", "Micro_Volume"])
            details.append("⚡ ENTRY: EMA9 Dynamic Squeeze Break")

        elif ema20_now > ema50_now_1d and close_change_pct > 0.006:
            score -= 2.0
            entry_trigger = "Trend Continuation (Late)"
            selection_system = "BREAKOUT"
            selection_reasons.append("Trend_Continuation")
            details.append("âš ï¸ ENTRY: Trend Devamı (FOMO Riski)")

        # 🎯 FIX 3: is_steady_momentum için sistem bağlantısı kuruldu
        elif is_steady_momentum:
            score += 3.0
            entry_trigger = "Steady Momentum (Kademeli Yİ¼kseliş)"
            selection_system = "TREND_CONT"
            selection_reasons.extend(["Steady_Momentum", "Healthy_Trend"])
            details.append("📈 ENTRY: Steady Momentum")

        elif rising.get('is_rising') and rising.get('pattern') in ['Pullback Reversal', 'Base Breakout']:
            score += 6.0
            
            entry_trigger = f"Rising: {rising['pattern']}"
            selection_system = "PULLBACK"
            selection_reasons.append("Rising_Pullback")
            selection_reasons.append(rising.get('pattern', '').replace(' ', '_'))
            details.append(f"📈 ENTRY: {rising['pattern']}")

        else:
            score -= 1.2
            details.append("â³ ENTRY: Tetik yok")

        # Sistem kategorizasyonu
        sys_cat = (
            "Contraction" if selection_system == "SQUEEZE" else
            "Reversal"    if selection_system in ("SPRING", "PULLBACK") else
            "Momentum"    if selection_system in ("AWAKENING", "EMA_CROSS", "TREND_CONT") else
            "Breakout"
        )
        
        # =============================================================
        # PHASE 3L: VIX & SEKTÖR STRATEJİ ADAPTASYONU
        # =============================================================
        current_vix = MARKET_STATUS.get("vix", 20.0)

        # ðŸš¨ FIX: Kazanma oranı tarihsel olarak kanıtlanmış (Energy, Basic Mat.) ve bozuk piyasada çalışan (Tech, Health) sektörlere prim
        if sector_name in ["Energy", "Basic Materials", "Technology", "Healthcare"]:
            score += 5.0
            details.append(f"ðŸ’Ž Gİ¼venilir Sektör Primi: {sector_name} (+5.0p)")
        elif sector_name == "Consumer Defensive":
            score += 3.0
            details.append(f"ðŸ›¡ï¸ Defansif Sektör Primi: {sector_name} (+3.0p)")

        # ðŸš¨ FIX: VIX > 20 olduğunda SL avcısı olan kırılgan sektörlere spesifik risk cezası
        if current_vix >= 20.0 and sector_name in ["Industrials", "Financial Services", "Consumer Cyclical"]:
            score -= 12.0
            details.append(f"âš ï¸ VIX {current_vix:.1f}: {sector_name} Yİ¼ksek SL Riski (-12.0p)")

        if current_vix >= 25.0:
            if sys_cat in ("Breakout", "Momentum"):
                score -= 15.0
                details.append(f"ðŸš¨ VIX {current_vix:.1f}: Breakout Tuzağı (Ağır Ceza)")
            elif sys_cat == "Reversal":
                score += 8.0
                details.append(f"ðŸ›¡ï¸ VIX {current_vix:.1f}: Reversal Ortamı (Ödİ¼l)")
        elif current_vix >= 20.0:
            if sys_cat in ("Breakout", "Momentum"):
                score -= 5.0
                details.append(f"âš ï¸ VIX {current_vix:.1f}: Breakout için Gergin")
        elif current_vix <= 15.0:
            if sys_cat in ("Breakout", "Momentum", "Contraction"):
                score += 8.0
                details.append(f"ðŸš€ VIX {current_vix:.1f}: Trend için İdeal")
            elif sys_cat == "Reversal":
                score -= 5.0
                details.append(f"ðŸ¢ VIX {current_vix:.1f}: Reversal Zayıf Kalır")

        # â”€â”€ Ek sinyal kaynakları â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if smart_money.get('has_smart_flow') and smart_money.get('score', 0) >= 6.0:
            selection_reasons.append("Smart_Money_Flow")

        if is_squeeze and selection_system != "SQUEEZE":
            selection_reasons.append("BB_Squeeze_Secondary")

        if not selection_reasons:
            selection_reasons = ["Momentum_Filter"]

        # =============================================================
        # PHASE 3M: R/R FİNAL HARD GATE
        # =============================================================
        # Trigger varsa standart R/R yeterli (1.5), trigger yoksa riske değmesi için daha yİ¼ksek R/R (1.8) bekle
        required_rr = MIN_RR_RATIO if entry_trigger else MIN_RR_RATIO_RELAXED
        if rr_ratio_calc < required_rr:
            logging.info(f"ðŸš« {ticker}: R/R yetersiz ({rr_ratio_calc:.2f} < {required_rr})")
            return None

        # =============================================================
        # PHASE 3N: SLOW SECTOR CEZASI (Dinamik)
        # =============================================================
        sector_penalty = SLOW_PEAK_SECTORS.get(sector_name, 0.0)
        sec_perf_val = SECTOR_PERFORMANCE.get(sector_name, 0.0)

        if sector_penalty < 0:
            # â”€â”€ V117 FIX: Yavaş sektörler için ceza iptal eşiği 2.0'den 1.0'e indirildi â”€â”€
            if sec_perf_val > 1.0:
                details.append(f"🔥 Yavaş Sektör ama HOT Trend: {sector_name} (Ceza İptal)")
            else:
                score += sector_penalty
                details.append(f"ðŸ¢ Yavaş Peak Sektör: {sector_name} ({sector_penalty:.1f}p)")
                
        # =============================================================
        # PHASE 4: PERFORMANS VERİLERİ + ÖZET
        # =============================================================
        try:
            ret_5g_pct = float(
                (close_1d.iloc[-1] - close_1d.iloc[-6]) / close_1d.iloc[-6] * 100
            ) if len(close_1d) >= 6 else 0.0
            ret_1d_pct = float(
                (close_1d.iloc[-1] - close_1d.iloc[-2]) / close_1d.iloc[-2] * 100
            ) if len(close_1d) >= 2 else 0.0
        except Exception:
            ret_5g_pct = 0.0
            ret_1d_pct = 0.0

        dollar_volume_val = current_price * avg_volume_10d
        hold_days = estimate_hold_time(
            score, vol_increase_ratio, profit_expectation_pct, atr_pct_1d * 100, is_exhausted
        )
        volume_regime_str = (
            "Expansion" if vol_increase_ratio > 1.4 else
            "Early"     if vol_increase_ratio > 1.1 else
            "Flat"
        )

        details.append(
            f"ðŸ’° TP1/TP2/SL: ${tp1:.2f} / ${tp2:.2f} / ${stop_loss:.2f} (R/R: {rr_ratio_calc:.2f})"
        )

        d1_summary = {
            "Trend Status": trend_durumu_1d,
            "EMA20 Slope": "Positive" if cond_ema20_slope_positive else "Negative/Flat",
            "RSI(14)": f"{rsi_1d_val:.1f}",
            "ADX": f"{adx_1d:.1f}",
            "ATR%": f"{atr_pct_1d * 100:.2f}%",
            "BB Width": f"{bb_width_1d * 100:.1f}%",
            "MACD_Hist": f"{macd_hist_val:.3f}",
        }

        exhaust_tag = " [EXHAUSTED]" if is_exhausted else ""
        logging.info(f"[OK] {ticker}: Analiz tamam (Skor: {score:.2f}{exhaust_tag})")

        # =============================================================
        # FINAL OUTPUT
        # =============================================================
        return {
            "ticker": ticker,
            "score": round(score, 2),
            "above_1w_ema50": is_above_1w_ema50,
            "sector_perf": sec_perf,
            "df_1d": df_1d,
            "df_1h": df_1h,
            "df_15m": df_15m,
            "current_price": current_price,
            "entry_price": current_price,

            # V117: Sistem etiketleri
            "selection_system": selection_system,
            "selection_reasons": selection_reasons,
            "system_category": sys_cat,

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
            "tp1": round(tp1, 2),
            "tp2": round(tp2, 2),
            "tp3": round(tp3, 2),
            "stop_loss": round(stop_loss, 2),
            "rr_ratio": round(rr_ratio_calc, 2),
            "entry_trigger": entry_trigger or "None Yet",
            "volume_regime": volume_regime_str,
            "rvol_today": round(rvol_today, 2),
            "rvol_5_30": round(rvol_micro, 3),
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

            # Layer 3 ağır veri alanları (sonra doldurulacak)
            "insider_data":     {'has_insider': False, 'score': 0.0, 'details': []},
            "financial_health": financial_health_data,
            "catalyst_data":    {'has_catalyst': False, 'score': 0.0, 'reasons': []},
            "opt_sentiment":    {},
            "tsi": 0.0, "msi": 0.0, "vrs": 0.0, "vps": 0.0,
            "nfi": 0.0, "sss": 0.0, "rcs": 0.0, "pfi": 0.0,
            "ifi": 0.0, "ffi": 0.0, "composite_score": 0.0,
        }

    except Exception as e:
        logging.error(f"🔴 apply_atmaca_filters({ticker}): {e}")
        return None



# ================================================================
# ================================================================
# SECTION 9: 8-FACTOR COMPOSITE SCORE
# ================================================================
# ================================================================

def compute_multi_factor_score(c: dict) -> float:
    """Layer 3 Composite Score (RVOL İ— Trend İ— Momentum İ— ADX İ— DollarVol İ— Volatility)"""
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

# BOGA AI FIX: Sabit ve sıkı hacim kuralına geri dönİ¼ş (Hacimsiz fakeout hisseler elenir)
    rvol_weight = 0.30  # V117'te dİ¼şİ¼rİ¼lmİ¼ştİ¼, veri teyidiyle momentum yakalamak için 0.30'da dengelendi
    trend_weight = 0.30
    ret_weight = 0.20
    
    layer3_composite = (
        rvol_zscore    * rvol_weight +
        trend_score    * trend_weight +
        ret_accel      * ret_weight +
        adx_norm       * 0.10 +
        dv_norm        * 0.05 +
        vol_expand     * 0.05
    )
    
    final_score = base_score + (layer3_composite * 2.5)
    
    # 🎯 FIX: 'is_exhausted' cezası Unified Score (boga_score_100) içine taşındığı için 
    # buradaki mİ¼kerrer (çifte) çarpımsal ceza silindi.

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
    🎯 YENİ BOGA AI FINAL SCORE (0-100) — UNIFIED SYSTEM
    Tek skor, tek sıralama. SQUEEZE ve SPRING gibi gİ¼çlİ¼ sinyaller doğrudan puana yansır.
    A: Trend & Momentum (25) + B: System Signal (20) + C: Volume & Flow (15)
    D: Rel. Strength & Sector (10) + E: Risk/Reward (15) + F: Fundamentals (10)
    G: Layer 3 - Catalysts/Insider (5) = Toplam 100
    """
    score = 0.0

    # â”€â”€ A. TREND & MOMENTUM (Max 25p) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if c.get("above_1w_ema50", True): score += 5.0
    
    rsi = c.get("rsi_14", 50.0)
    if RSI_BOGA_OPT_MIN <= rsi <= RSI_BOGA_OPT_MAX: score += 5.0
    elif 40 <= rsi < RSI_BOGA_OPT_MIN or RSI_BOGA_OPT_MAX < rsi <= 72: score += 3.0
    
    adx = c.get("adx", 0.0)
    if 18 <= adx < 30: score += 5.0
    elif 30 <= adx < 40: score += 3.0
    elif adx >= 15: score += 1.0

    macd_h = c.get("macd_hist", 0.0)
    if macd_h > 0.05: score += 5.0
    elif macd_h > 0: score += 3.0
    
    trend_stat = c.get("trend_status_1d", "")  # 🎯 FIX: Doğrudan gİ¼venli değişkenden okuma
    if "Macro" in trend_stat: score += 5.0
    elif "Upward" in trend_stat: score += 3.0

    # â”€â”€ B. SYSTEM SIGNAL (Max 20p) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # raw_score'daki o gİ¼çlİ¼ sistem bonusları artık doğrudan finale yansıyor
    sys_name = c.get("selection_system", "MOMENTUM")
    if sys_name == "SQUEEZE": score += 20.0
    elif sys_name == "SPRING": score += 18.0
    elif sys_name == "AWAKENING": score += 15.0
    elif sys_name == "TREND_CONT": score += 14.0  # 🎯 FIX 4: Sağlam trend devamı için adil puan tanımlandı
    elif sys_name == "EMA_CROSS": score += 12.0
    elif sys_name == "PULLBACK": score += 10.0
    elif sys_name == "BREAKOUT": score += 8.0
    elif sys_name == "MOMENTUM": score += 6.0  # Zayıf ama gerçek momentum
    else: pass  # Bilinmeyen veya tetiklenemeyen sinyal = 0 puan

    # â”€â”€ C. VOLUME & FLOW (Max 15p) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    rvol = c.get("rvol_today", 1.0)
    if rvol >= 2.0: score += 10.0
    elif rvol >= 1.5: score += 7.0
    elif rvol >= 1.2: score += 4.0
    
    mfi = c.get("mfi", 50.0)
    if 55 <= mfi <= 75: score += 5.0
    elif 45 <= mfi < 55: score += 3.0

    # â”€â”€ D. RELATIVE STRENGTH & SECTOR (Max 10p) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    sec_perf = c.get("sector_perf", 0.0)
    if sec_perf > 2.0: score += 5.0
    elif sec_perf > 0.0: score += 3.0
    
    rs_label = c.get("relative_strength", "N/A")
    if "Strong" in rs_label: score += 5.0
    elif "Mild" in rs_label: score += 3.0

    # â”€â”€ E. RISK / REWARD (Max 15p) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    rr = c.get("boga_rr", c.get("rr_ratio", 0.0))
    if rr >= 3.0: score += 15.0
    elif rr >= 2.5: score += 12.0
    elif rr >= 2.0: score += 8.0
    elif rr >= 1.5: score += 4.0

    # â”€â”€ F. FUNDAMENTALS (Max 10p) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    fin = c.get("financial_health", {})
    sector = c.get("sector", "Unknown")
    
    if fin:
        if sector == "Real Estate":
            pb_ratio = fin.get("pb_ratio", 0)
            if 0 < pb_ratio <= 1.5: score += 10.0
            elif 1.5 < pb_ratio <= 3.0: score += 6.0
            else: score += 3.0
        else:
            fund_pts = 0.0
            gross_m = fin.get("gross_margin", 0)
            if gross_m >= 40: fund_pts += 4.0
            elif gross_m >= 25: fund_pts += 2.0
            
            rev_growth = fin.get("revenue_growth", 0)
            if rev_growth >= 15: fund_pts += 3.0
            elif rev_growth >= 5: fund_pts += 1.5
            
            fcf = fin.get("fcf_yield", 0)
            if fcf >= 5: fund_pts += 3.0
            elif fcf >= 2: fund_pts += 1.5
            elif fcf < 0: fund_pts -= 4.0  # Negatif FCF cezası
            
            net_m = fin.get("net_margin", 0)
            if net_m < 0: fund_pts -= 4.0  # Zarar eden şirket cezası
            
            # Puanı [-8.0, 10.0] aralığına sıkıştır (Clamp)
            fund_pts = max(-8.0, min(fund_pts, 10.0))
            score += fund_pts
            
    else:
        pass  # Veri yoksa puan yok — belirsizlik ödİ¼llendirilmez

    # â”€â”€ G. LAYER 3: INSIDER, OPTIONS, CATALYSTS (Max 5p) â”€â”€â”€â”€â”€
    l3_pts = 0.0
    if c.get("ifi", 0.0) > 0: l3_pts += 2.0
    if c.get("pfi", 0.0) > 0: l3_pts += 1.5
    if c.get("opt_sentiment", {}).get("bullish"): l3_pts += 1.5
    
    score += min(l3_pts, 5.0)

    # â”€â”€ PENALTIES (Multiplicative) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if c.get("is_exhausted"):
        score *= 0.70  # En ağır ceza önce: aşırı yorgun hisse (-30%)
    if not c.get("above_1w_ema50", True):
        score *= 0.85  # Haftalık trend karşı: -15% (Veri yoksa True varsayılır, ceza kesilmez)
    if MARKET_STATUS.get("regime") == "WEAK":
        score *= 0.80  # Zayıf piyasada her şey söner: -20%
        
    return round(min(score, 100.0), 1)

# ================================================================
# ================================================================
# SECTION 11: DIVERSIFIED SELECTION
# ================================================================
# ================================================================

from scipy.stats import pearsonr
import pandas as pd

def build_diversified_toplist(candidates: list, max_per_sector: int = MAX_PER_SECTOR, total: int = 20, corr_threshold: float = 0.75) -> list:
    if not candidates: return []
    
    # 🎯 FIX: Sıralama öncesi tİ¼m adayların boga_score_100 değerini hesapla
    for c in candidates:
        if "boga_score_100" not in c:
            c["boga_score_100"] = compute_boga_score_100(c)

    # 1. Puan bazlı ana sıralama (raw_score yerine boga_score_100 kullan)
    # 🎯 FIX: boga_score_100 >= 45 eşiği ile dİ¼şİ¼k kaliteli (çöp) hisseleri baştan ele
    sorted_cands = sorted(
        [c for c in candidates if c.get("boga_score_100", 0.0) >= 45.0],
        key=lambda x: x.get("boga_score_100", 0.0), reverse=True
    )
    
    # 2. Pairwise Correlation Check (SciPy)
    filtered_cands = []
    dropped_tickers = set()
    
    for i in range(len(sorted_cands)):
        stock_a = sorted_cands[i]
        if stock_a['ticker'] in dropped_tickers:
            continue
            
        for j in range(i + 1, len(sorted_cands)):
            stock_b = sorted_cands[j]
            
            # Sadece aynı sektör içindeki hisselerin korelasyonuna bak
            if stock_a['sector'] == stock_b['sector'] and stock_b['ticker'] not in dropped_tickers:
                close_a = stock_a.get('df_1d', pd.DataFrame()).get('Close')
                close_b = stock_b.get('df_1d', pd.DataFrame()).get('Close')
                
                if close_a is not None and close_b is not None and not close_a.empty and not close_b.empty:
                    df_merged = pd.concat([close_a.tail(60), close_b.tail(60)], axis=1, join='inner').dropna()
                    if len(df_merged) >= 20:
                        corr, _ = pearsonr(df_merged.iloc[:, 0], df_merged.iloc[:, 1])
                        # Eğer korelasyon yİ¼ksekse, skoru daha dİ¼şİ¼k olan stock_b'yi ele
                        if corr > corr_threshold:
                            dropped_tickers.add(stock_b['ticker'])

        if stock_a['ticker'] not in dropped_tickers:
            filtered_cands.append(stock_a)

    # 3. Klasik Sektör Rotasyonu ve Final Liste
    final_list, sector_counts, remaining = [], {}, []
    for cand in filtered_cands:
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
                        logging.error(f"âŒ Telegram ({idx}): {await resp.text()}")
            except Exception as e:
                logging.error(f"âš ï¸ Telegram connection error ({idx}): {e}")


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
                        logging.error(f"âŒ Telegram foto: {await resp.text()}")
        except Exception as e:
            logging.error(f"âš ï¸ Telegram Photo Error: {e}")

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
            # ðŸ”§ FIX #5: holding_period is now an estimate — not a hard rule.
            # Smart Tracker on the frontend MUST switch to "Peak Profit Reached / Closed"
            # when current price >= profit_target_price (see tracker_logic block below).
            "holding_period_estimate": f"{c.get('hold_days', 5)} Days (max)",
            "holding_period": f"{c.get('hold_days', 5)} Days",  # legacy field kept for compat
            "status": "WAITING_FOR_ENTRY",  # initial status — frontend updates this live
            "tracker_logic": {
                # Frontend Smart Tracker should evaluate these in order:
                "entry_zone_low":     zones.get("buy_zone", {}).get("low", 0),
                "entry_zone_high":    zones.get("buy_zone", {}).get("high", 0),
                "profit_target_tp1":  c.get("tp1", 0),
                "profit_target_tp2":  c.get("tp2", 0),
                "profit_target_tp3":  c.get("tp3", 0),
                "stop_loss_high":     zones.get("stop_zone", {}).get("high", 0),
                "max_hold_days":      c.get("hold_days", 5),
                
                "exit_rule":          "EXIT_ON_TARGET_OR_STOP_OR_MAX_HOLD",
                "trailing_stop_rules": {
                    "step_1": "If profit > 5%, move Stop Loss to Entry Price (Break-even).",
                    "step_2": "If profit > 8%, move Stop Loss to Entry Price + 2%."
                }
                # Pseudocode for frontend (🎯 FIX 7: Trailing Stop Logic added):
                #   if max_profit_reached >= 8% and price < entry_price * 1.02 â†’ "STOPPED_IN_PROFIT"
                #   elif max_profit_reached >= 5% and price < entry_price â†’ "STOPPED_BREAK_EVEN"
                #   elif price <= stop_loss_high          â†’ status = "STOPPED_OUT"
                #   elif price >= profit_target_low     â†’ status = "PEAK_PROFIT_REACHED"
                #   elif entry_zone_low <= price <= entry_zone_high â†’ status = "IN_ENTRY_ZONE"
                #   elif days_since_pick > max_hold_days â†’ status = "TIME_EXIT"
                #   else                                 â†’ status = "HOLDING"
            },
            
            # 🔥 Flattened Fields for Frontend Compatibility
            "buy_zone": zones.get("buy_zone", {"low": 0, "high": 0}),
            "profit_zone": zones.get("sell_zone", {"low": 0, "high": 0}),
            "stop_zone": zones.get("stop_zone", {"low": 0, "high": 0}),
            # â”€â”€ V117: Sistem Etiketleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            "selected_system": c.get("selection_system", "MOMENTUM"),
            "system_category": c.get("system_category", "Breakout"),
            "selection_reasons": c.get("selection_reasons", ["Momentum_Filter"]),
            "system_label": {                             # Frontend badge için
                "SQUEEZE":   {"text": "Volatility Squeeze", "color": "purple"},
                "SPRING":    {"text": "Failed Breakdown",   "color": "orange"},
                "AWAKENING": {"text": "Stealth Breakout",   "color": "teal"},
                "EMA_CROSS": {"text": "EMA Crossover",      "color": "blue"},
                "PULLBACK":  {"text": "Pullback Setup",     "color": "green"},
                "BREAKOUT":  {"text": "Trend Breakout",     "color": "red"},
                "TREND_CONT": {"text": "Steady Trend",      "color": "green"}, # â”€â”€ V117 FIX: Eksik frontend etiketi eklendi â”€â”€
                "MOMENTUM":  {"text": "Momentum Play",      "color": "gray"},
            }.get(c.get("selection_system", "MOMENTUM"), {"text": "Momentum Play", "color": "gray"}),
            "reasoning": f"BOGA AI Score: {c.get('boga_score_100', 0.0)} | System: {c.get('selection_system', 'MOMENTUM')}",
            "detail_reasoning": "Algoritmik teknik kriterler ve momentum analizi sonucunda seçilmiştir.",
            "adx": c.get("adx", 0.0),
            "rsi": c.get("rsi_14", 50.0),
            "rvol": c.get("rvol_today", 1.0),
            "change_1d": perf.get("1d", 0.0),
            "change_1w": perf.get("1w", 0.0),
            "change_1m": perf.get("1m", 0.0),
            "change_1y": perf.get("1y", 0.0),
            "change_5y": perf.get("5y", 0.0),

            # â”€â”€ BOGA AI MODEL ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # â”€â”€ TREND STATUS & INDICATORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # â”€â”€ MOVING AVERAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            "moving_averages": {
                "ema_20": c.get("ema20", 0.0),
                "ema_50": c.get("ema50", 0.0),
                "ema_200": c.get("ema200", 0.0),
                "price_vs_ema20": round(price - c.get("ema20", price), 2),
                "price_vs_ema50": round(price - c.get("ema50", price), 2),
                "price_vs_ema200": round(price - c.get("ema200", price), 2),
                "ema20_slope": d1.get("EMA20 Slope", "N/A"),
            },

            # â”€â”€ 1H ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            "hourly_analysis": {
                "rsi_1h": c.get("rsi_1h", 50.0),
                "adx_1h": c.get("adx_1h", 0.0),
                "rvol_1h": h1.get("RVOL(1H)", "N/A"),
                "ema_structure": h1.get("Price/EMA", "N/A"),
                "pivot_structure": h1.get("Structure", "N/A"),
            },

            # â”€â”€ FUNDAMENTAL MARGINS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

            # â”€â”€ PERFORMANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            "performance": {
                "1d_pct":  perf.get("1d", 0.0),
                "1w_pct":  perf.get("1w", 0.0),
                "1m_pct":  perf.get("1m", 0.0),
                "1y_pct":  perf.get("1y", 0.0),
                "5y_pct":  perf.get("5y", 0.0),
            },

            # â”€â”€ FACTOR DIFFERENTIATION (only for technical visualization; final score boga_score_100) â”€
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


        }
        picks.append(pick)

    # V117: Sistem bazlı gruplama
    by_system: Dict[str, list] = {}
    for p in picks:
        sys = p.get("selected_system", "MOMENTUM")
        by_system.setdefault(sys, []).append(p.get("ticker"))

    return {
        "generated_at": generated_at,
        "date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
        "model": "BOGA AI V117",
        "market_regime": MARKET_STATUS.get("regime", "Bull"),
        "total_picks": len(picks),
        "picks": picks,
        "by_system": by_system,           # {"SQUEEZE": ["NVDA", "AAPL"], "SPRING": ["TSLA"]}
        "system_summary": {               # Frontend özet kartı için
            sys: {"count": len(tickers), "tickers": tickers}
            for sys, tickers in by_system.items()
        },
    }

# ================================================================
# ================================================================
# SECTION 15: TELEGRAM REPORT BLOCK — BOGA AI Core Engine V117
# ================================================================
# ================================================================

def classify_risk(rr: float) -> str:
    """Quality classification according to Risk/Reward ratio."""
    if rr >= 3.0: return "ðŸ† S (Elite)"
    if rr >= 2.5: return "ðŸ’Ž A+ (Premium)"
    if rr >= 2.0: return "[OK] A (Strong)"
    if rr >= 1.8: return "ðŸŸ¡ B+ (Good)"
    if rr >= 1.5: return "ðŸŸ  B (Medium)"
    return "🔴 C (Weak)"


def classify_rsi(rsi: float) -> str:
    """Translates RSI value into human language."""
    if rsi >= 75: return "âš ï¸ Overbought — High pullback risk"
    if rsi >= 65: return "🔥 Strong Momentum — Careful follow-up"
    if rsi >= 55: return "📈 Healthy Bullish Zone"
    if rsi >= 45: return "âž¡ï¸ Neutral — Waiting for catalyst"
    if rsi >= 35: return "ðŸ“‰ Under Pressure — Recovery follow-up"
    return "â„ï¸ Oversold — Potential reversal opportunity"


def classify_adx(adx: float) -> str:
    """Interprets ADX value as trend strength."""
    if adx >= 40: return "[START] Very Strong Trend — Momentum near peak"
    if adx >= 30: return "ðŸ’ª Strong Trend — Institutional interest exists"
    if adx >= 25: return "📊 Confirmed Trend — Healthy move"
    if adx >= 20: return "ðŸŒŠ Medium Trend — Maturing"
    return "ðŸ˜´ Weak Trend — Range-bound caution"


def classify_macd(macd_hist: float) -> str:
    """Interprets MACD histogram."""
    if macd_hist > 0.05:  return f"[OK] Positive ({macd_hist:+.3f}) — Supports breakout"
    if macd_hist > 0:     return f"ðŸŸ¡ Mild Positive ({macd_hist:+.3f}) — Momentum building"
    if macd_hist > -0.05: return f"ðŸŸ  Mild Negative ({macd_hist:+.3f}) — Watch carefully"
    return f"🔴 Negative ({macd_hist:+.3f}) — Selling pressure exists"


def classify_mfi(mfi: float) -> str:
    """Money Flow Index interpretation."""
    if mfi >= 70: return f"{mfi:.1f} — ðŸ’° Strong Money Entry (Institutional accumulation)"
    if mfi >= 55: return f"{mfi:.1f} — ðŸ“¥ Money Flow Positive"
    if mfi >= 45: return f"{mfi:.1f} — â†”ï¸ Neutral Money Flow"
    if mfi >= 30: return f"{mfi:.1f} — ðŸ“¤ Money Outflow"
    return f"{mfi:.1f} — ðŸš¨ Strong Money Outflow (Distribution risk)"


def ema_gap(price: float, ema: float, label: str) -> str:
    """Shows price position relative to EMA."""
    if price <= 0 or ema <= 0:
        return f"${ema:.2f} (No data)"
    pct = ((price - ema) / ema) * 100
    arrow = "â–²" if pct >= 0 else "â–¼"
    return f"${ema:.2f}  {arrow} {abs(pct):.1f}% {'above' if pct >= 0 else 'below'}"


def format_mcap(mcap_raw: float) -> str:
    """Converts market cap to readable format."""
    if mcap_raw >= 1e12: return f"${mcap_raw/1e12:.2f}T"
    if mcap_raw >= 1e9:  return f"${mcap_raw/1e9:.2f}B"
    if mcap_raw > 0:     return f"${mcap_raw/1e6:.0f}M"
    return "N/A"


def verdict_emoji(score: float) -> str:
    """Decision label based on BOGA AI score (Sniper Context).
    Not: Bu aşamaya gelen hisseler 800 hisse içinden en zorlu filtreleri 
    geçmiştir. Yani 'Zayıf' hisse yoktur, sadece şampiyonlar liginin sıralaması vardır."""
    if score >= 75: return "🦅 ELITE SNIPER"
    if score >= 60: return "🔥 STRONG BREAKOUT"
    if score >= 50: return "ðŸ‚ SOLID SETUP"
    if score >= 40: return "🎯 PRIME WATCHLIST"
    return "â³ PULLBACK CANDIDATE"


def build_candidate_block(rank: int, c: dict) -> str:
    """
    V117: Sistem etiketi ve selection_reasons eklendi.
    """
    ticker      = c.get("ticker", "")
    sector      = c.get("sector", "Various")
    boga_s      = c.get("boga_score_100", 0.0)
    entry       = c.get("current_price", 0.0)
    exhaust_tag = " âš ï¸ [EXHAUSTED]" if c.get("is_exhausted") else ""

    zones    = c.get("boga_zones", {})
    rr       = zones.get("rr_ratio", c.get("rr_ratio", 0.0))
    buy_z    = zones.get("buy_zone",  {})
    sell_z   = zones.get("sell_zone", {})
    stop_z   = zones.get("stop_zone", {})
    
    trigger  = c.get("entry_trigger", "Squeeze / Breakout")
    rvol     = c.get("rvol_today", 0.0)

    # V117: Sistem etiketi
    sys_name  = c.get("selection_system", "MOMENTUM")
    sys_reasons = c.get("selection_reasons", [])
    sys_cat   = c.get("system_category", "Breakout")
    reasons_str = " Â· ".join(sys_reasons[:3]) if sys_reasons else "Momentum_Filter"

    # Sistem emoji haritası
    sys_emoji = {
        "SQUEEZE":   "ðŸ—œï¸",
        "SPRING":    "⚡",
        "AWAKENING": "🌅",
        "EMA_CROSS": "âœ‚ï¸",
        "PULLBACK":  "ðŸ”",
        "BREAKOUT":  "ðŸš€",
        "MOMENTUM":  "📈",
    }.get(sys_name, "🎯")

    block = (
        f"🦅 <b>#{rank:02d} — {ticker}</b> | {sector}{exhaust_tag}\n"
        f"{sys_emoji} <b>SİSTEM: [{sys_name}]</b> — <i>{sys_cat}</i>\n"
        f"ðŸ” <b>Signals:</b> <code>{reasons_str}</code>\n"
        f"ðŸ‚ <b>BOGA Score:</b> {boga_s:.1f}/100 | <b>Price:</b> ${entry:.2f}\n\n"
        f"🎯 <b>SWING SETUP</b>\n"
        f"🟢 <b>BUY :</b> ${buy_z.get('low',0):.2f} â€“ ${buy_z.get('high',0):.2f}\n"
        f"🔴 <b>STOP:</b> ${stop_z.get('high',0):.2f}\n"
        f"ðŸ <b>TP  :</b> ${c.get('tp1',0):.2f} / ${c.get('tp2',0):.2f} / ${c.get('tp3',0):.2f}\n"
        f"⚖ï¸ <b>R/R :</b> {rr:.1f}:1\n\n"
        f"⚡ <b>Trigger:</b> {trigger} (RVOL: {rvol:.1f}x)\n"
        f"{'â”€'*35}\n"
    )
    return block
    
# ================================================================
# ================================================================
# SECTION 16: STATS AUTO-UPDATE (Homepage â†” Performance Sync)
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
        logging.error(f"âŒ Stats update error: {e}")

def track_pick_peak_performance():
    """
    V117: Geçmiş seçimlerin peak % performansını otomatik hesaplar.
    Her scan sonrası çağrılır. swing_performance.json history'sine yazar.
    
    Bu fonksiyon şu an PENDING olan hisselerin gİ¼ncel fiyatını çeker
    ve peak_pct / days_held alanlarını gİ¼nceller.
    Böylece hangi sistemin ne kadar kazandırdığı zamanla görİ¼nİ¼r hale gelir.
    """
    try:
        public_dir = r"C:\Users\afksm\finma\frontend\public"
        perf_file  = os.path.join(public_dir, "swing_performance.json")
        
        if not os.path.exists(perf_file):
            return
        
        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        history = data.get('history', [])
        updated = False
        
        for trade in history:
            if trade.get('result') != 'PENDING':
                continue
            
            ticker     = trade.get('ticker', '')
            entry_date = trade.get('date', '')
            entry_px   = trade.get('entry_price', 0.0)
            system     = trade.get('selected_system', 'UNKNOWN')
            
            if not ticker or not entry_px:
                continue
            
            try:
                # Giriş tarihinden bugİ¼ne veri çek
                from datetime import datetime
                start_dt = entry_date if entry_date else None
                df_check = yf.download(ticker, start=start_dt, progress=False) if start_dt else yf.download(ticker, period="14d", progress=False)
                if df_check is None or df_check.empty:
                    continue
                
                highs = df_check['High'].dropna()
                last  = float(df_check['Close'].dropna().iloc[-1])
                peak  = float(highs.max())
                
                peak_pct = (peak - entry_px) / entry_px * 100 if entry_px > 0 else 0.0
                curr_pct = (last - entry_px) / entry_px * 100 if entry_px > 0 else 0.0
                
                trade['peak_pct']     = round(peak_pct, 2)
                trade['current_pct']  = round(curr_pct, 2)
                trade['selected_system'] = system   # sistemin kaydı
                
                # Auto-close: Stop veya TP vurulmuşsa
                stop_px   = trade.get('stop_price', 0.0)
                target_px = trade.get('target_price', 0.0)
                
                if stop_px > 0 and float(df_check['Low'].min()) <= stop_px:
                    trade['result']     = 'STOPPED_OUT'
                    trade['return_pct'] = round((stop_px - entry_px) / entry_px * 100, 2)
                    updated = True
                elif target_px > 0 and peak >= target_px:
                    trade['result']     = 'TARGET_HIT'
                    trade['return_pct'] = round(peak_pct, 2)
                    updated = True
                else:
                    updated = True  # peak_pct gİ¼ncellendi
                    
            except Exception as e:
                logging.debug(f"Peak tracker {ticker}: {e}")
                continue
        
        if updated:
            # Sistem bazlı winrate hesapla
            completed = [t for t in history if t.get('result') not in ('PENDING', None)]
            sys_stats: Dict[str, dict] = {}
            for t in completed:
                sys = t.get('selected_system', 'UNKNOWN')
                ret = t.get('return_pct', 0.0)
                if sys not in sys_stats:
                    sys_stats[sys] = {'wins': 0, 'losses': 0, 'total_return': 0.0, 'count': 0}
                sys_stats[sys]['count'] += 1
                sys_stats[sys]['total_return'] += ret
                if ret > 0:
                    sys_stats[sys]['wins'] += 1
                else:
                    sys_stats[sys]['losses'] += 1
            
            data['system_stats'] = {
                sys: {
                    'winrate': round(v['wins'] / v['count'] * 100, 1) if v['count'] > 0 else 0,
                    'avg_return': round(v['total_return'] / v['count'], 2) if v['count'] > 0 else 0,
                    'count': v['count']
                }
                for sys, v in sys_stats.items()
            }
            
            with open(perf_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            logging.info(f"📈 Peak tracker updated: {len([t for t in history if t.get('result') == 'PENDING'])} PENDING trades tracked")
            
            # Sistem winrate özeti logla
            for sys, stats in data.get('system_stats', {}).items():
                logging.info(f"  [{sys}] WR: {stats['winrate']}% | Avg: {stats['avg_return']:+.1f}% | n={stats['count']}")
    
    except Exception as e:
        logging.error(f"âŒ Peak tracker error: {e}")

async def send_weekly_performance_report():
    """
    Haftalık performans özeti — Pazartesi taramasında otomatik tetiklenir.
    swing_performance.json içindeki system_stats ve history'den İ¼retilir.
    """
    try:
        perf_file = os.path.join(r"C:\Users\afksm\finma\frontend\public", "swing_performance.json")
        if not os.path.exists(perf_file):
            logging.warning("âš ï¸ Haftalık rapor: swing_performance.json bulunamadı.")
            return

        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        history   = data.get('history', [])
        stats     = data.get('stats', {})
        sys_stats = data.get('system_stats', {})

        if not history:
            return

        # â”€â”€ Son 7 gİ¼nİ¼n işlemlerini al â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        cutoff = (datetime.now(NY_TZ) - timedelta(days=7)).strftime("%Y-%m-%d")
        recent = [t for t in history if t.get('date', '') >= cutoff]
        completed_recent = [t for t in recent if t.get('result') not in ('PENDING', None)]

        wins_r   = sum(1 for t in completed_recent if t.get('return_pct', 0) > 0)
        losses_r = sum(1 for t in completed_recent if t.get('return_pct', 0) <= 0)
        avg_r    = (sum(t.get('return_pct', 0) for t in completed_recent) / len(completed_recent)) if completed_recent else 0
        wr_r     = (wins_r / len(completed_recent) * 100) if completed_recent else 0

        # â”€â”€ Tİ¼m zamanların özeti â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        total_trades  = stats.get('total_picks', len(history))
        all_wr        = stats.get('win_rate', 0)
        all_avg_ret   = stats.get('avg_return_pct', 0)
        above_5       = stats.get('above_5pct_rate', 0)
        above_10      = stats.get('above_10pct_rate', 0)

        # â”€â”€ Sistem bazlı tablo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        sys_lines = []
        for sys_name, s in sorted(sys_stats.items(), key=lambda x: -x[1].get('avg_return', 0)):
            wr  = s.get('winrate', 0)
            avg = s.get('avg_return', 0)
            cnt = s.get('count', 0)
            bar = "🟢" if avg > 3 else "ðŸŸ¡" if avg > 0 else "🔴"
            sys_lines.append(f"  {bar} {sys_name:<10} WR:{wr:>4.0f}%  Avg:{avg:>+5.1f}%  n={cnt}")

        sys_block = "\n".join(sys_lines) if sys_lines else "  (henİ¼z veri yok)"

        # â”€â”€ Son 7 gİ¼nİ¼n en iyi / en kötİ¼ işlemleri â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if completed_recent:
            best  = max(completed_recent, key=lambda t: t.get('return_pct', 0))
            worst = min(completed_recent, key=lambda t: t.get('return_pct', 0))
            best_line  = f"ðŸ† En iyi:  {best.get('ticker','?')} ({best.get('selected_system','?')}) â†’ <b>{best.get('return_pct',0):+.1f}%</b>"
            worst_line = f"ðŸ’€ En kötİ¼: {worst.get('ticker','?')} ({worst.get('selected_system','?')}) â†’ <b>{worst.get('return_pct',0):+.1f}%</b>"
        else:
            best_line  = "ðŸ† En iyi: —"
            worst_line = "ðŸ’€ En kötİ¼: —"

        # â”€â”€ Mesajı oluştur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
        msg = (
            f"📊 <b>BOGA AI — HAFTALIK PERFORMANS RAPORU</b>\n"
            f"ðŸ—“ {now_str}\n\n"

            f"<b>â”â” SON 7 GÜN ({len(completed_recent)} tamamlandı) â”â”</b>\n"
            f"  âœ… Win Rate:     <b>{wr_r:.1f}%</b>  ({wins_r}W / {losses_r}L)\n"
            f"  ðŸ’° Ort. Return:  <b>{avg_r:+.1f}%</b>\n"
            f"  ðŸ“Œ Toplam sinyal: {len(recent)}\n"
            f"{best_line}\n"
            f"{worst_line}\n\n"

            f"<b>â”â” TÜM ZAMANLAR ({total_trades} sinyal) â”â”</b>\n"
            f"  âœ… Win Rate:     <b>{all_wr:.1f}%</b>\n"
            f"  ðŸ’° Ort. Return:  <b>{all_avg_ret:+.1f}%</b>\n"
            f"  📈 +5% İ¼zeri:   <b>{above_5:.1f}%</b>\n"
            f"  ðŸš€ +10% İ¼zeri:  <b>{above_10:.1f}%</b>\n\n"

            f"<b>â”â” SİSTEM BAZLI PERFORMANS â”â”</b>\n"
            f"<pre>{sys_block}</pre>\n\n"

            f"<i>BOGA AI V117 | swing_performance.json</i>"
        )

        await send_telegram_message(msg)
        logging.info("📊 Haftalık performans raporu Telegram'a gönderildi.")

    except Exception as e:
        logging.error(f"âŒ Haftalık rapor hatası: {e}")
        
        
# ================================================================
# ================================================================
# SECTION 17: MAIN SCANNER
# ================================================================
# ================================================================

async def scan_top_stocks():
    """
    BOGA AI MASTER SCANNER V117

    WORKFLOW:
    1. Market + Sector Analysis
    2. Universe Preparation (500 stocks - weekly cache)
    3. 500 stocks â†’ apply_atmaca_filters â†’ min 50 pass
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
    recently_picked = await get_recently_picked_tickers(days=5)
    # Add last 5 days picks to currently manually excluded ones
    CURRENT_EXCLUSIONS = EXCLUDED_STOCKS.union(recently_picked)
    # ---------------------------------
    
    # â”€â”€ STEP 1: MARKET ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    await analyze_market_and_sectors()
    logging.info(f"âš™ï¸ Regime: {MARKET_STATUS['regime']} | Modifier: {MARKET_STATUS['min_score_modifier']}")

    vix_note = MARKET_STATUS.get("vix_note", "VIX: N/A")
    # Telegram notification moved to main_loop to avoid duplicates if run via scheduler
    
    # â”€â”€ STEP 2: UNIVERSE (500 stocks - weekly cache) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    MASTER_UNIVERSE = await build_atmaca_universe_full()
    if not MASTER_UNIVERSE:
        await send_telegram_message("âŒ Could not create universe!")
        return

    # â”€â”€ CRITICAL FIX: Filter scan list with CURRENT list only â”€â”€
    tickers_to_scan = [t for t in MASTER_UNIVERSE if t not in CURRENT_EXCLUSIONS]
    logging.info(f"📋 Number of stocks to scan (Duplicates removed): {len(tickers_to_scan)}")

    # â”€â”€ STEP 3: PARALLEL ANALYSIS (500 stocks â†’ at least 50 pass) â”€â”€â”€â”€â”€â”€â”€â”€â”€
    semaphore = asyncio.Semaphore(8)

    async def sem_analyze(ticker: str):
        nonlocal scanned_count
        async with semaphore:
            await asyncio.sleep(random.uniform(0.5, 1.2))  # Hızlandırılmış bekleme
            try:
                result = await apply_atmaca_filters(ticker)
                scanned_count += 1
                if scanned_count % 50 == 0:
                    logging.info(f"â³ Progress: {scanned_count}/{len(tickers_to_scan)}")
                return result
            except Exception as e:
                logging.error(f"âŒ {ticker}: {e}")
                return None

    tasks = [sem_analyze(t) for t in tickers_to_scan]
    raw_results = await asyncio.gather(*tasks)

    candidates = [r for r in raw_results if r is not None]
    logging.info(f"[OK] Layer 2 passed: {len(candidates)} stocks")

    if not candidates:
        await send_telegram_message("âš ï¸ No candidates found meeting criteria.")
        return
        
    # â”€â”€ STEP 4: 8-FACTOR SCORE + BEST 50 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for c in candidates:
        compute_multi_factor_score(c)
        # 🎯 FIX: Layer 3'e gidecek havuzu doğru seçmek için boga_score_100 ön hesaplaması
        c["boga_score_100"] = compute_boga_score_100(c)

    # 🎯 FIX: Sıralamayı raw_score ("score") yerine boga_score_100'e göre yap.
    # En az 40 puan alamayanları derin analize (API maliyetine ve zaman kaybına) sokma.
    candidates_ranked = sorted(
        [c for c in candidates if c.get("boga_score_100", 0.0) >= 40.0],
        key=lambda x: x.get("boga_score_100", 0.0), reverse=True
    )
    
    top_50 = candidates_ranked[:TOP_DEEP_ANALYSIS]
    logging.info(f"ðŸ† Layer 2 â†’ Top {len(top_50)} moving to deep analysis (based on Boga Score).")

    # â”€â”€ STEP 5: LAYER 3 — DEEP ANALYSIS (Top 50) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            if fin_health.get('health_score', 0) != 0:  # Negatif skor da ceza olarak uygulanır
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
            logging.debug(f"âš ï¸ {ticker} Layer 3: {e}")

    sem_k3 = asyncio.Semaphore(8)
    async def sem_heavy(c):
        async with sem_k3:
            await asyncio.sleep(random.uniform(0.1, 0.4))
            await fetch_heavy_data(c)

    await asyncio.gather(*(sem_heavy(c) for c in top_50))
    top_50.sort(key=lambda x: x.get("score", 0.0), reverse=True)

    # â”€â”€ STEP 6: ALPHA VANTAGE VALIDATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if ENABLE_ALPHA_VALIDATION:
        high_conviction = [c for c in top_50 if c.get('score', 0) >= 35.0][:5]
        for idx, c in enumerate(high_conviction):
            av_result = await _verify_with_alpha_vantage(c['ticker'], c['current_price'])
            c['alpha_validation'] = av_result
            if not av_result.get('validated', True):
                c['score'] -= 10.0
            if idx < len(high_conviction) - 1:
                await asyncio.sleep(12)

    # â”€â”€ STEP 7: DIVERSIFIED CANDIDATE SELECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # Get top candidates directly based on BOGA AI's robust 1D/1H Macro Score.
    top_candidates = build_diversified_toplist(top_50, total=TOP_FINAL_PICKS)
   
    
    # â”€â”€ STEP 8: BOGA AI ZONE CALCULATION (ATR + 1H Support/Resistance) â”€â”€â”€â”€â”€
    for c in top_candidates:
        trigger = c.get("entry_trigger", "")
        zones = calculate_support_resistance_1h(
            c.get("df_1h"), c.get("df_1d"), c.get("current_price", 0.0), trigger, c.get("df_15m")
        )
        
        c["boga_zones"] = zones
        c["boga_rr"] = zones.get("rr_ratio", 0.0)

    # â”€â”€ R/R HARD ELIMINATION (Realistic floor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # ðŸ”§ FIX #9: Professional swing setups need at least R/R 1.5.
    top_candidates = [c for c in top_candidates if c.get("boga_rr", 0.0) >= 1.5]
    if not top_candidates:
        logging.warning("âš ï¸ No candidates left after R/R < 1.5 elimination.")
        await send_telegram_message("âš ï¸ No setups with R/R 1.5+ in daily scan.")
        return

    # Capture 20 candidates for Terminal Daily tab AFTER R/R filtering (Tutarsızlık Giderildi)
    top_20_candidates = list(top_candidates)


    # â”€â”€ STEP 9: BOGA AI SCORE OUT OF 100 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for c in top_20_candidates:
        c["boga_score_100"] = compute_boga_score_100(c)

    # ðŸš¨ 1-3 Gİ¼nlİ¼k Short-Hold için Kalite Barajı
    filtered_top_20 = []
    for c in top_20_candidates:
        # 🎯 FIX: Unified skor sisteminde 80+ çok nadirdir. SQUEEZE/AWAKENING gibi
        # hızlı (hold <= 3) setupları boğmamak için baraj gerçekçi bir seviye olan 70'e indirildi.
        if c.get("hold_days", 5) <= 3 and c.get("boga_score_100", 0.0) < 70.0:
            logging.info(f"ðŸš« {c['ticker']}: Short-hold (<=3 day) barajı geçemedi. Skor: {c.get('boga_score_100')} < 70")
            continue
        filtered_top_20.append(c)
        
    top_20_candidates = filtered_top_20

    # Re-sort by score
    top_20_candidates.sort(key=lambda x: x.get("boga_score_100", 0.0), reverse=True)

    for i, c in enumerate(top_20_candidates):
        c["rank"] = i + 1

    # top_candidates dizisini de eşitle ve sırala (Telegram ile terminal tutarlı olsun)
    top_candidates = [c for c in top_candidates if c['ticker'] in [x['ticker'] for x in top_20_candidates]]
    top_candidates.sort(key=lambda x: x.get("boga_score_100", 0.0), reverse=True)
    
    # â”€â”€ V117: Terminal'de 20 hissenin tam listesi (boga_score_100 artık hazır) â”€â”€
    logging.info("=" * 70)
    logging.info(f"ðŸ‚ BOGA AI V117 — TAM ADAY LİSTESİ ({len(top_20_candidates)} hisse)")
    logging.info(f"{'#':<4} {'TICKER':<7} {'SİSTEM':<10} {'BOGA':>5} {'SEKTOR':<22} {'R/R':>5} {'RSI':>5} {'RVOL':>6}")
    logging.info("-" * 70)
    for i, c in enumerate(top_20_candidates):
        sys_name = c.get("selection_system", "N/A")
        boga_s   = c.get("boga_score_100", 0.0)
        sector_s = c.get("sector", "Unknown")[:20]
        rr_s     = c.get("boga_rr", 0.0)
        rsi_s    = c.get("rsi_14", 0.0)
        rvol_s   = c.get("rvol_today", 0.0)
        tg_flag  = " â† TELEGRAM" if i < 5 else ""
        logging.info(
            f"{i+1:<4} {c['ticker']:<7} {sys_name:<10} {boga_s:>5.1f} "
            f"{sector_s:<22} {rr_s:>4.1f} {rsi_s:>5.1f} {rvol_s:>5.2f}x{tg_flag}"
        )
    logging.info("=" * 70)
    from collections import Counter
    sys_counts = Counter(c.get("selection_system", "N/A") for c in top_20_candidates)
    logging.info("📊 Sistem Dağılımı: " + " | ".join(f"{k}: {v}" for k, v in sys_counts.most_common()))
    logging.info("=" * 70)

    # â”€â”€ STEP 10: PERFORMANCE DATA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for c in top_20_candidates:
        c["performance"] = get_price_performance(c.get("df_1d", pd.DataFrame()), c["ticker"])
        db_info = COMPANY_DATABASE.get(c["ticker"], {})
        c["company"] = db_info.get("name", c["ticker"])

    # â”€â”€ STEP 12: JSON OUTPUT (inday313 and Archive Synchronization) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

        # 2. Prepare JSON Data (Terminal gets 20, Summary gets filtered)
        output_terminal = build_json_output(top_20_candidates, generated_at)
        output_top5 = build_json_output(top_candidates[:5], generated_at)

        # 3. Save Special Archive for inday313 Reference
        with open(full_archive_path, "w", encoding="utf-8") as f:
            json.dump(output_terminal, f, indent=2, ensure_ascii=False, default=str)
        logging.info(f"ðŸ“ Archived for inday313: {full_archive_path}")

        # 4. Update Frontend Live Dashboard Files
        public_dir = r"C:\Users\afksm\finma\frontend\public"
        os.makedirs(public_dir, exist_ok=True)

        # swing_picks.json (Dashboard side panel/Summary)
        with open(os.path.join(public_dir, "swing_picks.json"), "w", encoding="utf-8") as f:
            json.dump(output_top5, f, indent=2, ensure_ascii=False, default=str)
        
        # swing_all_picks.json (Full list page view / Terminal Daily)
        with open(os.path.join(public_dir, "swing_all_picks.json"), "w", encoding="utf-8") as f:
            json.dump(output_terminal, f, indent=2, ensure_ascii=False, default=str)

        # 5. Special Table Format (swing_table.json)
        english_months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        date_str = f"{now_ny.day} {english_months[now_ny.month]}"
        
        table_data = []
        for c in top_candidates:
            z = c.get("boga_zones", {})
            table_data.append({
                "Date": date_str,
                "Symbol": c.get("ticker", ""),
                "Entry (Buy_L)": z.get("buy_zone", {}).get("low", 0.0),
                "Stop (SL)": z.get("stop_zone", {}).get("high", 0.0),
                "Target 1 (TP1)": z.get("sell_zone", {}).get("low", 0.0),
                "Target 2 (TP2)": z.get("sell_zone", {}).get("high", 0.0)
            })
        
        with open(os.path.join(public_dir, "swing_table.json"), "w", encoding="utf-8") as f:
            json.dump(table_data, f, indent=2, ensure_ascii=False)

        logging.info(f"[START] Dashboard and Archive successfully updated.")

    except Exception as e:
        logging.error(f"âŒ JSON save error: {e}")
        

    # â”€â”€ STEP 13: TELEGRAM REPORT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    duration = time.time() - start_time
    now_str = now_ny.strftime("%Y-%m-%d %H:%M %Z")

    # Summary table
    tg_display_picks = top_candidates[:5]  # 🎯 Sadece ilk 5'i Telegram'a yolla
    
    header = (
        f"ðŸ‚ <b>ATMACA SWING V117 â€“ TOP 5 PREMIUM PICKS</b>\n"
        f"ðŸ•’ <i>{now_str}</i> | â± {duration:.1f}s\n"
        f"📊 <i>{len(tickers_to_scan)} scanned â†’ {len(candidates)} candidates â†’ Top 10 Saved</i>\n"
        f"📈 Market: <b>{MARKET_STATUS['regime']}</b>\n\n"
        "<pre>"
        f"#   SYMBOL  [SYSTEM ]  BOGA   BUY_L  SELL_H  STOP\n"
        f"â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n"
    )
    rows = []
    
    for i, c in enumerate(tg_display_picks):
        zones = c.get("boga_zones", {})
        
        buy_l  = zones.get("buy_zone", {}).get("low", 0)
        sell_h = zones.get("sell_zone", {}).get("high", 0)
        stop_h = zones.get("stop_zone", {}).get("high", 0)
        rr     = zones.get("rr_ratio", 0.0)
        boga_s = c.get("boga_score_100", 0.0)
        score  = c.get("score", 0.0)
        tag = "🦅" if boga_s >= 75 else "🔥" if boga_s >= 60 else "🎯"
        
        # V117: Sistem kısaltması (7 karakter max, tablo bozulmasın)
        sys_raw = c.get("selection_system", "BREAK")
        short_sys = {
            "SQUEEZE":   "SQUEEZE",
            "SPRING":    "SPRING ",
            "AWAKENING": "AWAKN  ",
            "EMA_CROSS": "CROSS  ",
            "PULLBACK":  "PULLBK ",
            "BREAKOUT":  "BREAK  ",
            "MOMENTUM":  "MOMENTM",
        }.get(sys_raw, sys_raw[:7].ljust(7))
        
        rows.append(
            f"{i+1:02d}. {tag} {c['ticker']:<5} [{short_sys}] {boga_s:>4.0f}  "
            f"{buy_l:>6.2f} {sell_h:>6.2f} {stop_h:>6.2f}"
        )

    toplist_msg = header + "\n".join(rows) + "\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\n</pre>\n"
    toplist_msg += f"<i>[INFO] BUYâ†’SELL: R/R~2.5:1 | ATR+1H Support/Resistance | BOGA AI V117</i>\n\n"
    toplist_msg += "<b>📋 Detailed Analysis Below:</b>\n\n"

    # Send Toplist Summary
    await send_telegram_message(toplist_msg)
    # Send each candidate block separately (to prevent HTML explosion)
    for i, c in enumerate(tg_display_picks):
        block = build_candidate_block(i + 1, c)
        await send_telegram_message(block)
        await asyncio.sleep(0.5) # Telegram flood protection

    save_info_cache()

    # Auto-update stats (homepage â†” performance sync)
    update_swing_performance_stats()
    
    # V117: Peak performance tracker (sistem bazlı winrate birikimi)
    track_pick_peak_performance()

    # 🎯 FIX: Haftalık Rapor Tetikleyici (Sadece Pazartesi Gİ¼nleri Çalışır)
    if now_ny.weekday() == 0:  
        try:
            await send_weekly_performance_report()
            logging.info("ðŸ“… Haftalık performans raporu başarıyla tetiklendi ve gönderildi.")
        except Exception as e:
            logging.error(f"âŒ Haftalık rapor gönderim hatası: {e}")

    logging.info(f"[OK] BOGA AI Scan complete. ({scanned_count} stocks scanned | {duration:.1f}s)")
        
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

def get_next_weekday_run_time_ny(target_hour=DAILY_RUN_HOUR, target_minute=DAILY_RUN_MINUTE):
    """Returns the next weekday NY 13:00 time (UTC aware)."""
    now_utc = datetime.now(timezone.utc)
    now_ny  = now_utc.astimezone(NY_TZ)
    candidate_ny = now_ny.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    if candidate_ny <= now_ny:
        candidate_ny += timedelta(days=1)
    while candidate_ny.weekday() >= 5:
        candidate_ny += timedelta(days=1)
        
    candidate_utc = candidate_ny.astimezone(timezone.utc)
    # ðŸ”§ FIX: Hafta sonu sonsuz döngİ¼ edge-case koruması eklendi.
    if candidate_utc <= now_utc:
        candidate_ny += timedelta(days=1)
        while candidate_ny.weekday() >= 5:
            candidate_ny += timedelta(days=1)
        candidate_utc = candidate_ny.astimezone(timezone.utc)
    return candidate_utc


async def run_scanner():
    """Main loop — Runs every day at NY 13:00."""
    await send_telegram_message(
        "ðŸ‚ <b>BOGA AI SWING TRADE V117 Started!</b>\n"
        "ðŸ“… Schedule: Every weekday New York 13:00\n"
        "🎯 Goal: Daily Top 5 Swing Trade Opportunities\n"
        f"📊 Market: <b>{MARKET_STATUS.get('regime','Bull')}</b> | R/R: ~2.5:1\n"
        "ðŸ” V117: Sistem etiketleri + VIX overlay aktif"
    )

    # Initial scan
    try:
        logging.info("â–¶ Initial scan starting...")
        await scan_top_stocks()
    except Exception as e:
        logging.error(f"Startup scan error: {e}")
        await send_telegram_message(f"ðŸš¨ Startup error: {e}")

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
                f"ðŸ•’ Next scan: {next_run_utc.strftime('%Y-%m-%d %H:%M %Z')} "
                f"(~{wait_seconds/3600:.2f} hours)"
            )
            await asyncio.sleep(wait_seconds)
            logging.info("â–¶ NY 13:00 scan starting...")
            await scan_top_stocks()

        except Exception as e:
            logging.error(f"Loop error: {e}")
            await send_telegram_message(f"ðŸš¨ Loop error: {e}")
            await asyncio.sleep(3600)


# ================================================================
# ================================================================
# SECTION 18: STARTUP
# ================================================================
# ================================================================

if __name__ == "__main__":
    import sys
    try:
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
        if "--oneshot" in sys.argv:
            from zoneinfo import ZoneInfo
            ny_tz = ZoneInfo("America/New_York")
            now_ny = datetime.now(ny_tz)
            target_ny = now_ny.replace(hour=DAILY_RUN_HOUR, minute=DAILY_RUN_MINUTE, second=0, microsecond=0)
            
            if now_ny < target_ny and "--now" not in sys.argv:
                wait_sec = (target_ny - now_ny).total_seconds()
                print(f"ðŸ•’ Saat henuz erken. NY 13:00 bekleniyor ({wait_sec/3600:.1f} saat)...")
                import time
                time.sleep(wait_sec)
            
            print("[START] BOGA AI V117.0 Swing Scanner (One-Shot) baslatildi...")
            asyncio.run(scan_top_stocks())
            print("[OK] Tarama tamamlandi.")
        else:
            asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print("\nðŸ‚ BOGA AI V117.0 durduruldu.")
    except Exception as e:
        print(f"Critical Startup Error: {e}")