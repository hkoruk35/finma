# -*- coding: utf-8 -*-
"""
================================================================
🐂 BOGA AI SWING TRADE MODEL — v117.v2.0 (Post-Backtest Optimizasyon)
================================================================
v117.v2 DEĞİŞİKLİKLERİ (94 trade analizi — 2026-05-16/28):
  1. RSI_1D_MAX: 78 → 70  (RSI>70 aşırı alım otomatik filtre)
  2. AWAKENING: ADX ≥ 25 (20'den) + MACD_hist > 0 zorunlu  (%0 WR düzeltme)
  3. MIXED EMA bloker: ema_stack=False iken SQUEEZE/AWAKENING engeli
  4. RVOL orta band: BREAKOUT/EMA_CROSS/TREND_CONT'ta 0.6<rvol<1.4 → -3p ceza
  5. MACD_hist > 2.0: Geç giriş uyarısı → -4p (TWLO/AMAT vakası)
  6. Sektör yeniden: Energy/Healthcare bonus kaldırıldı → ceza eklendi
     Consumer Cyclical: %80 WR → +5p bonus
  7. boga_score_100: AWAKENING sistemi için ek doğrulama eşiği (+0p→disabled geri)
================================================================
V117 YENİLİKLER (korundu):
  1. selection_system: Her hisse için SQUEEZE/SPRING/AWAKENING/EMA_CROSS/
     PULLBACK/BREAKOUT/MOMENTUM etiketleri
  2. selection_reasons: Çoklu sinyal kaynağı listesi
  3. system_category: Contraction / Reversal / Momentum / Breakout
  4. Telegram: Her hissede sistem etiketi + özet tabloda kısaltma
  5. Terminal: 20 hissenin tamamı sistem + sektör + R/R ile listelenir
  6. JSON: by_system gruplaması + system_summary
  7. ADX: Level-bazlı değil, slope-bazlı puanlama (optimal giriş tespiti)
  8. Composite: RVOL ağırlığı 0.40 → 0.20 (dry-up/VCP tolerance)
  9. Earnings filter: 3 gün → 5 gün (swing hold buffer)
 10. VIX entegrasyonu: Market regime'e VIX overlay eklendi
 11. Backtest altyapısı: Peak tracker + sistem bazlı winrate birikimi
================================================================

ARCHITECTURE (unchanged):
  LAYER 1 → Global universe weekly scan → most liquid 500 stocks
  LAYER 2 → 1D data for 500 stocks is fetched, momentum + trend
             at least 50 candidates are selected
  LAYER 3 → Deep analysis for 50 candidates (1H S/R + ATR zones)
  LAYER 4 → Top 10 stocks scored out of 100
  LAYER 5 → Summaries generated with Gemini AI in multiple languages
  OUTPUT  → Saved in JSON format + Telegram notification
================================================================
"""

import json
import asyncio
import logging
import time
import math
import re
import os
import random
import aiohttp
import pandas as pd
import numpy as np
import yfinance as yf

# Simple HTML escape workaround for Python 3.14 html.entities issue
def html_escape(text: str, quote: bool = True) -> str:
    """Escape &, <, >, and quotes in text."""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    if quote:
        text = text.replace("\"", "&quot;")
        text = text.replace("'", "&#x27;")
    return text

from datetime import datetime, timedelta, time as dtime, timezone
from typing import List, Dict, Any, Optional, Literal
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

from ta.volatility import AverageTrueRange, BollingerBands
from ta.trend import EMAIndicator, ADXIndicator, MACD
from ta.volume import OnBalanceVolumeIndicator, MFIIndicator
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

# Daily selection scan (Every day 13:00 NY)
DAILY_RUN_HOUR = 13
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
MAX_TICKERS_FINAL = 800          # 🎯 SNIPER: Daha geniş evren = daha çok small/mid-cap fırsat.
TOP_DEEP_ANALYSIS = 80           # 🎯 SNIPER: Daha fazla derin analiz.
TOP_FINAL_PICKS = 20             # 🎯 SNIPER: Hedef Her gün 20 aday.

# 🔧 BOGA AI FIX: Fiyat ve Likidite Filtresi (Profesyonel Swing Standartları)
PRICE_MIN = 10.0
PRICE_MAX = 500.0

# Wall Street 'İşlem Yapılabilir' (Tradable) Likidite Alt Sınırları:
ATMACA_MIN_MARKET_CAP = 75_000_000     # 🎯 SNIPER: 300M → 75M. Small-cap dahil. Float küçük = hareket büyük.
ATMACA_MIN_AVG_VOLUME = 150_000        # 🎯 SNIPER: 250K → 150K. Daha esnek hacim eşiği.
ATMACA_MIN_DOLLAR_VOLUME = 1_000_000   # 🎯 SNIPER: 2M → 1M. Daha esnek dolar hacmi.

ATMACA_MIN_BETA = 0.6
ATMACA_MAX_BETA = 3.0

ATR_PERIOD = 14
ATR_MIN_PCT_1H = 0.025
ATR_MAX_PCT_1H = 0.25

ADX_MIN_LEVEL_1D = 18
OBV_TREND_DAYS = 10
VOLUME_INCREASE_LOOKBACK = 5

# 🎯 RSI THRESHOLDS (Unified Documented Constraints)
RSI_1D_MIN = 40         # 🎯 BOĞA MODU: 45 → 40 (geri çekilme aşamasındaki güçlü hisseleri dahil et)
RSI_1D_MAX = 78         # v117.v2: 78→78 — RSI>70 aşırı alım, %29 WR (TWLO/RAMP vakası)
RSI_1H_MAX = 82         # İntraday (1H) spike mutlak tavanı
RSI_BOGA_OPT_MIN = 45   # Unified sistem optimal alt sınır
RSI_BOGA_OPT_MAX = 65   # Unified sistem optimal üst sınır

MIN_RR_RATIO = 0.7         # 🎯 BOĞA MODU: 1.0 → 0.7 (daha çok setup bul)
MIN_RR_RATIO_RELAXED = 0.9  # 🎯 BOĞA MODU: 1.2 → 0.9 (entry trigger varsa çok esnek)

LOOKBACK_DAYS = 200
INDEX_BENCHMARK = "^GSPC"
MAX_PER_SECTOR = 6 # ?? FIX: Korelasyon riskini ve SL patlamasini önlemek için 6'dan 6'e düsürüldü.
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
    "Real Estate": -3.0,  
    "Consumer Defensive": -3.0,
    "Utilities": -3.0,
    # Yüksek büyüme ve yapay zeka/savunma momentumu taşıyan sektörler statik cezadan muaf tutuldu.
}
# -- Yüksek riskli industry grupları — swing için hard reject -----------------
# Bu industry'lere ait hisseler binary event (FDA kararı, faz 3 sonucu, patent
# davası vb.) riskiyle teknik analiz sinyalini geçersiz kılabilir.
#
# Kural: Clinical-stage / pre-revenue biyotech hisseleri kesinlikle elenir.
# Onaylı ürünü olan büyük pharma/biotech (ABBV, AMGN, BIIB vb.) zaten yüksek
# market cap nedeniyle ATMACA_MIN_MARKET_CAP filtresinden geçer.
HIGH_RISK_INDUSTRIES: set = {
    "biotechnology",                            # Pre-revenue / klinik aşama
    "drug manufacturers - specialty & generic", # Küçük tek-ürün pharma
    "pharmaceutical retailers",                 # Dağıtım tek ürüne bağlı
    "medical devices",                          # FDA pre-market onay riski
    "diagnostics & research",                   # Reimbursement bağımlı
    "health information services",              # Regülasyon değişkeni
}

# Market cap eşiği: Bu industry'lerde market cap'i bu değerin ALTINDA olanlar elenir.
HIGH_RISK_INDUSTRY_MCAP_FLOOR = 5_000_000_000  # $5B

# Negatif FCF hard floor — bu sınırın altında FCF olan hisse elenir
NEGATIVE_FCF_FLOOR = -150_000_000  # 🚨 FIX: Non-cash warrant giderleri ve GAAP muhasebe bozulmalarını tolere etmek için -$150M'e esnetildi.

# ── V117 FIX: CEF / ETF / MutualFund Engelleme Setleri (Global) ──────────────
CEF_BLOCK_QUOTE_TYPES: set = {"etf", "mutualfund", "cef"}
CEF_BLOCK_INDUSTRIES: set = {
    "closed-end fund",
    "closed end fund",
    "asset management",          # saf holding/fund yöneticisi
    "exchange traded fund",
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

    logging.info(f"[OK] Raw symbol count: {len(all_tickers)}")
    return list(all_tickers)

# ================================================================
# 🛡️ ANTI-REPETITION MODULE (Block those selected in the last 10 days)
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
        logging.warning(f"⚠️ Archive folder not found: {swing_year_dir}")
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
    PHASE 3: RVOL İ— DollarVolume ranking → Top 500
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
                                        logging.info(f"🚫 {sym}: Disk cache'te yetersiz geçmiş ({len(df_sym)} bar) → atlandı")
                                        continue
                                        
                                    last_price_check = float(df_sym['Close'].iloc[-1])
                                    if not (PRICE_MIN <= last_price_check <= PRICE_MAX):
                                        continue
                                        
                                    BULK_DATA_CACHE[sym] = df_sym.copy()
                                    filtered_list.append(sym)

                        if filtered_list:
                            logging.info(f"✅ Disk Cache: {len(data_list)} → {len(filtered_list)} hisse ({len(data_list)-len(filtered_list)} yetersiz geçmişli elendi)")
                            UNIVERSE_CACHE["ts"] = mtime
                            UNIVERSE_CACHE["data"] = filtered_list
                            return filtered_list
            except Exception as e:
                logging.error(f"⚠️ Disk cache yükleme/indirme hatası: {e}")

    raw_list = await fetch_all_us_tickers()
    if not raw_list:
        logging.error("❌ Ticker list could not be retrieved.")
        return []

    logging.info(f"[START] Bulk download starting for {len(raw_list)} stocks (chunk=1000, period=35d)...")

    CHUNK = 200
    PERIOD = "252d"
    all_rows: list = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"📥 Downloading: {i}–{i + len(chunk)} ...")
        try:
            data = await asyncio.wait_for(
                asyncio.to_thread(
                    yf.download, chunk, period=PERIOD, interval="1d",
                    progress=False, threads=True, ignore_tz=True, group_by="ticker"
                ),
                timeout=60.0  # 60 second timeout per chunk
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

                    # SWING118: TREND_CONT (%70.6 WR) ve SQUEEZE için hacimsiz kuruma (VCP) sinyallerini kaçırmama filtresi
                    close_arr = close.values
                    is_squeeze_vcp_candidate = (-0.05 <= (close_arr[-1] - close_arr[-5]) / close_arr[-5] <= 0.09) if len(close_arr) >= 5 else False
                    rvol_floor = 0.15 if is_squeeze_vcp_candidate else 0.40

                    if rvol < rvol_floor:
                        continue

                    roc5 = float(
                        (close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]
                    ) if len(close) >= 6 else 0.0
                    # 🎯 SNIPER MOD: Sıkışma bölgesindeki hisseleri dahil et.
                    # 🔧 BOGA AI FIX: Hacimli momentum kırılımları (Tier 2) evrene eklendi
                    is_squeeze_candidate = (-0.05 <= roc5 <= 0.09)
                    # 🎯 FIX: Eşik 0.15'e esnetildi. 5 güne yayılan sağlıklı (%10-12'lik) trendler içeri alınır.
                    # Tek günde %10 yapan pis patlamaların elenmesi işi Layer 2'deki Exhaustion modülüne bırakıldı.
                    is_momentum_breakout = (0.03 < roc5 <= 0.40) and rvol > 0.8
                    
                    if not (is_squeeze_candidate or is_momentum_breakout):
                        continue

                    BULK_DATA_CACHE[sym] = data[sym].copy()
                    # Mega-cap bias'ı önlemek için dollar_vol log scale'e alındı.
                    rank_score_normalized = rvol * math.log1p(dollar_vol)
                    
                    all_rows.append({
                        "sym": sym, "price": last_price,
                        "dollar_vol": dollar_vol, "rvol": rvol,
                        "roc5": roc5, "rank_score": rank_score_normalized,
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

def get_stock_data(ticker: str, interval: Literal["1d", "1h", "15m"] = "1d") -> Optional[pd.DataFrame]:
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
    period_map = {"1h": ("7d", 10), "15m": ("5d", 20)}
    period_str, min_bars = period_map.get(interval, ("7d", 10))

    for attempt in range(3):
        time.sleep(random.uniform(0.15, 0.4) + (attempt * 0.5))
        try:
            stock = yf.Ticker(t)
            df = stock.history(period=period_str, interval=interval, auto_adjust=True, timeout=20)
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
                logging.error(f"❌ {t} ({interval}) fetch failed after 3 attempts: {e}")
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
            "companyName": inf.get("longName", t),
            # ── V117 FIX: Eksik bilanço alanları eklendi ──────────────────────────
            "debtToEquity": inf.get("debtToEquity", 0),          # D/E oranı
            "totalCash": inf.get("totalCash", 0),                 # Nakit pozisyon
            "totalDebt": inf.get("totalDebt", 0),                 # Toplam borç
            "netIncomeToCommon": inf.get("netIncomeToCommon", 0), # Net gelir (negatif = zarar)
            "trailingEps": inf.get("trailingEps", 0),             # EPS (negatif = zarar)
            # ── V117 FIX: CEF/ETF/MutualFund filtresi için quoteType ────────────
            "quoteType": inf.get("quoteType", "EQUITY"),          # EQUITY / ETF / MUTUALFUND / CEF
        }
        
        # Cache güncelle ve kaydet
        persistent_info_cache[t] = processed
        # 🔧 BOGA AI FIX: Disk I/O yükünü kaldırmak için her fetch'te diske yazma işlemi iptal edildi. 
        # (Tarama sonunda toplu olarak yazılacak)
        # save_info_cache()
        
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
        return {'valid': False, 'bonus': 0.0, 'msg': "⚠️ VP: Below POC (Resistance Zone)"}
    except Exception:
        return {'valid': False, 'bonus': 0.0, 'msg': ""}


def analyze_smart_money_flow(df_1d: pd.DataFrame, ticker: str, info: dict) -> dict:
    try:
        if len(df_1d) < 20:
            return {'has_smart_flow': False, 'score': 0.0, 'details': []}
        
        close, high, low, volume = df_1d['Close'], df_1d['High'], df_1d['Low'], df_1d['Volume']
        score, details = 0.0, []

        # True Range tabanlı MFM (Gap Körlüğünü Çözer)
        prev_close = close.shift(1)
        true_high = np.maximum(high, prev_close)
        true_low = np.minimum(low, prev_close)
        true_range = (true_high - true_low).replace(0, np.nan)
        
        mf_mult = ((close - true_low) - (true_high - close)) / true_range
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


def detect_rising_stock(df: pd.DataFrame, adx_1d: float = 0.0) -> dict:
    """🔧 FIX #12: A stock with 0% 10-day return that just has rising swing lows
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
        # Eğer 10 gün 0 getiri, ama son 5 gün ufak bir kıpırdanma varsa pas geçme.
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
                details.append(f"🐢 Momentum Yavaşlıyor (5g sadece **%{recent_5d*100:.1f}**)")

        # 🎯 0-DAY SNIPER: 10 günde %15+ uçmuş hisseye girilmez, parti bitmiştir.
        if recent_ret > 0.15:
            # Öneri 6: Momentum Lideri Muafiyeti
            if score > 15 and adx_1d > 30: # RS slope ve ADX kontrolüyle
                score -= 2.0; pattern = "High Momentum Leader"
            else:
                score -= 5.0; pattern = "Overextended"
                
            details.append(f"⚠️ 10D Return: +{recent_ret*100:.1f}% (Çok Şişkin, FOMO Riski)")
        elif recent_ret > 0.08:
            score += 1.0; pattern = "Mature Trend"
            details.append(f"📈 10D Return: +{recent_ret*100:.1f}% (Olgun Trend, Geç Kalınmış Olabilir)")
        elif recent_ret > 0.02:
            score += 4.0; pattern = "Fresh Breakout"
            details.append(f"🚀 10D Return: +{recent_ret*100:.1f}% (Taze Başlangıç / Sniper Bölgesi)")
        else:
            score += 1.0; pattern = "Mild Uptrend"
            details.append(f"↗️ 10D Return: +{recent_ret*100:.1f}%")

        swing_lows = []
        for i in range(2, min(15, len(df)) - 2):
            swing_low_val = df['Low'].iloc[-i]
            if swing_low_val < df['Low'].iloc[-(i-1)] and swing_low_val < df['Low'].iloc[-(i+1)]:
                swing_lows.append(swing_low_val)
                
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
        # ── V117 FIX: Key uyumsuzluğu giderildi (cached_info desteği) ──
        market_cap       = info.get('marketCap', 0) or info.get('market_cap', 0)
        fcf_yield_pct    = (fcf_yield / market_cap * 100) if market_cap > 0 and fcf_yield > 0 else 0.0

        if gross_margin > 0.35:
            score += 2.0; details.append(f"💎 Gross Margin: {gross_margin*100:.1f}% (Strong)")
        if operating_margin > 0.15:
            score += 2.0; details.append(f"📊 Operating Margin: {operating_margin*100:.1f}% (Strong)")
        if net_margin > 0.10:
            score += 2.0; details.append(f"💰 Net Margin: {net_margin*100:.1f}% (Healthy)")
        if revenue_growth > 0.10:
            score += 3.0; details.append(f"[START] Revenue Growth: {revenue_growth*100:.1f}% (Good)")
        elif revenue_growth > 0.05:
            score += 1.5; details.append(f"📈 Revenue Growth: {revenue_growth*100:.1f}%")
        if 0 < debt_to_equity < 1.5:
            score += 1.5; details.append(f"🟢 D/E: {debt_to_equity:.2f} (Healthy)")
        if fcf_yield_pct > 3.0:
            score += 2.0; details.append(f"💸 FCF Yield: {fcf_yield_pct:.1f}% (Strong)")
        elif fcf_yield_pct < 0:
            score -= 4.0; details.append(f"⚠️ FCF Yield: Negatif Nakit Akışı ({fcf_yield_pct:.1f}%)")
            
        if net_margin < 0:
            score -= 4.0; details.append(f"🚨 Net Margin: Zarar Eden Şirket ({net_margin*100:.1f}%)")

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

def calculate_support_resistance_1h(df_1h: pd.DataFrame, df_1d: pd.DataFrame, current_price: float, entry_trigger_1d: str = "", df_15m: pd.DataFrame = None) -> dict:
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
            
            # 🚨 FIX 1: BOS Bug - current candle dahil edilmedi, gerçek breakout tespiti
            recent_local_high = float(high_1h.iloc[-11:-1].max()) if len(high_1h) >= 11 else float(high_1h.iloc[:-1].max())
            is_bos = (curr_c > recent_local_high) and volume_spike_breakout

            is_pullback = (support_1h <= curr_l <= support_1h + (atr_1d * 0.3))

            # ── ERKEN MOMENTUM TESPİTİ (Sessiz Kırılımlar İçin) ──
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

        # ── 3. REFERENCE ZONES — DYNAMIC BY SIGNAL TYPE ───────────────────
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
        stop_low  = round(stop_high  - (atr_1d * 0.2), 2)

        # ── V117_v2: Minimum SL Mesafesi Floor (%5) ──────────────────────────
        # Dar stop (< %5) günlük gürültüde tetiklenir.
        # MDU vakası: support_1h bazlı stop_high = $21.68 (%2.69) → gürültüde yendi.
        # Tüm sistemler için kesin %5 floor uygulanıyor.
        # Tracker stop_zone.high'ı izlediğinden bu düzeltme doğrudan etkili.
        min_sl_pct = 0.050   # %5 kesin floor — sistem fark etmeksizin
        sl_floor   = round(current_price * (1 - min_sl_pct), 2)

        if stop_high > sl_floor:
            gap       = stop_high - sl_floor
            stop_high = sl_floor
            stop_low  = round(stop_low - gap, 2)
            logging.info(
                f"⚠️ SL Floor Uygulandı (1H SR): "
                f"stop_high {stop_high + gap:.2f} → {stop_high:.2f} "
                f"(min %5.0 mesafe zorunlu)"
            )

        # 🎯 FIX 5: Entry Buffer — breakout mumunun tam tepesinden almamak (slippage protection)
        avg_entry = (current_price * 0.995) if entry_valid else ((buy_zone_low + buy_zone_high) / 2)
        risk      = max(avg_entry - stop_high, atr_1d * 1.0)

        # 🎯 FIX 3: R/R Kaybını Engelleme (momentum hisseleri için edge)
        structural_reward = resist_1h - avg_entry
        reward = max(risk * 2.0, structural_reward) if structural_reward > 0 else risk * 2.5

        # 🚨 FIX 7: R/R Tavanı — exhausted/late hissede 4x, momentum liderinde 6x.
        # "Early Awakening" veya "Squeeze" sinyali varsa asymmetry korunur.
        is_momentum_trigger_keyword = entry_trigger_1d and any(
            k in entry_trigger_1d for k in ["Squeeze", "Awakening", "Momentum", "Spring"]
        )
        rr_cap = 6.0 if is_momentum_trigger_keyword else 4.0
        if reward > risk * rr_cap:
            reward = risk * rr_cap

        sell_zone_low  = round(avg_entry + reward * 0.85, 2)
        sell_zone_high = round(avg_entry + reward, 2)

        actual_risk   = avg_entry - stop_high
        actual_reward = sell_zone_high - avg_entry
        rr_ratio      = round(actual_reward / actual_risk, 2) if actual_risk > 0 else 0.0

        return {
            "entry_engine": {
                "valid":      entry_valid,
                "type":       entry_type,
                "confidence": entry_confidence
            },
            "buy_zone":    {"low": buy_zone_low,  "high": buy_zone_high},
            "sell_zone":   {"low": sell_zone_low,  "high": sell_zone_high},
            "stop_zone":   {"low": stop_low,       "high": stop_high},
            "support_1h":  round(support_1h, 2),
            "resist_1h":   round(resist_1h,  2),
            "atr_1d":      round(atr_1d,     2),
            "atr_pct":     round(atr_pct * 100, 2),
            "rr_ratio":    rr_ratio,
            "risk_usd":    round(actual_risk,   2),
            "reward_usd":  round(actual_reward, 2),
        }

    except Exception as e:
        logging.error(f"❌ Support/Resistance & Timing error: {e}")
        return {
            "entry_engine": {"valid": False, "type": "DATA_ERROR", "confidence": 0},
            "buy_zone":   {"low": current_price * 0.98,  "high": current_price * 1.01},
            "sell_zone":  {"low": current_price * 1.05,  "high": current_price * 1.08},
            "stop_zone":  {"low": current_price * 0.94,  "high": current_price * 0.95},
            "support_1h":  current_price * 0.95,
            "resist_1h":   current_price * 1.08,
            "atr_1d":      current_price * 0.03,
            "atr_pct":     3.0,
            "rr_ratio":    0.0,
            "risk_usd":    0.0,
            "reward_usd":  0.0,
        }
        
def check_15m_micro_trend(df_15m: pd.DataFrame, selection_system: str = "UNKNOWN") -> dict:
    """
    15m zaman diliminde son 8 mumun (2 saat) gürültüsüz yön analizini yapar.
    Sadece net trendi ve tutarlılığı ölçer, tekil fitil/mum gürültülerini yok sayar.

    V117_v2 DEĞİŞİKLİĞİ:
        - selection_system parametresi eklendi.
        - SQUEEZE sistemi için hard reject eşiği -1.0% → -0.5% sıkılaştırıldı.
          MDU vakası: net_change ≈ -0.4% ile eski eşiği geçemedi, sadece -2p soft ceza aldı.
          SQUEEZE yavaş düşen hisselerde çalışır — küçük düşüşler erken uyarıdır.
        - SQUEEZE için zayıf kapanış soft eşiği de -0.3%'e indirildi (eski: < 0).
    """
    if df_15m is None or len(df_15m) < 10:
        return {'is_valid': True, 'score_bonus': 0.0, 'msg': "⚠️ 15m veri yetersiz (nötr)"}

    # Son 8 mumu al (2 saatlik veri)
    recent_15m   = df_15m.tail(8)
    close_prices = recent_15m['Close'].values
    open_prices  = recent_15m['Open'].values

    # 1. NET YÖN: İlk mum ile son mum arasındaki değişim — aradaki gürültü yok sayılır
    net_change_pct = (close_prices[-1] - close_prices[0]) / close_prices[0] * 100

    # 2. TUTARLILIK: 8 mumun kaçı yeşil kapattı?
    # Fiyat %1 artmış ama 6 mum kırmızıysa → tek mumluk spike tuzağı
    green_candles = sum(1 for i in range(8) if close_prices[i] > open_prices[i])

    # 3. YERÇEKİMİ KONTROLÜ: Sürekli daha düşük tepeler mi yapıyor?
    highs       = recent_15m['High'].values
    is_bleeding = (highs[-1] < highs[-3]) and (highs[-3] < highs[-6])

    # ── V117_v2: Sistem Bazlı Eşik Belirleme ─────────────────────────────────
    # SQUEEZE: Birikim / sıkışma beklenirken bile yavaş düşüş kötü işaret.
    #          Küçük negatif net_change'e karşı daha hassas olmalı.
    # Diğer sistemler: Eski -1.0% eşiği korunur (volatil hisseler için tolerans).
    is_squeeze = selection_system == "SQUEEZE"
    hard_reject_threshold = -0.5 if is_squeeze else -1.0   # SQUEEZE için sıkılaştırıldı
    soft_warn_threshold   = -0.3 if is_squeeze else  0.0   # SQUEEZE için daha erken uyarı

    # ── KARAR MEKANİZMASI ────────────────────────────────────────────────────

    # Hard Reject — Zehirli Mikro Trend
    # Net düşüş var, mumların çoğu kırmızı ve tepeler alçalıyor.
    # 1H / 1D harika görünse bile içeride kurumsal dağıtım sinyali.
    # SQUEEZE için eşik -0.5%: MDU gibi yavaş kanayan hisseler artık burada elenir.
    if net_change_pct < hard_reject_threshold and green_candles <= 2 and is_bleeding:
        sys_tag = " (SQUEEZE eşiği)" if is_squeeze else ""
        return {
            'is_valid':    False,
            'score_bonus': -10.0,
            'msg':         f"🚨 15m KANAMA{sys_tag}: Son 2 saatte yoğun dağıtım — net:{net_change_pct:.2f}% (İptal)"
        }

    # Güçlü Onay — Momentum Teyidi
    # Net yükseliş var ve istikrarlı yeşil mumlar.
    if net_change_pct > 0.5 and green_candles >= 5:
        return {
            'is_valid':    True,
            'score_bonus': 4.0,
            'msg':         f"🔥 15m ONAY: Son 2 saat net trend (+{net_change_pct:.2f}%)"
        }

    # Zayıf Kapanış Uyarısı — Girerken temkinli ol
    # SQUEEZE: -0.3% altı soft uyarı (eski kod sadece < 0 kontrol ediyordu)
    # Diğerleri: < 0 kontrolü korunur
    if net_change_pct < soft_warn_threshold and green_candles < 4:
        sys_tag = " (SQUEEZE hassas eşik)" if is_squeeze else ""
        return {
            'is_valid':    True,
            'score_bonus': -2.0,
            'msg':         f"⚠️ 15m Uyarı{sys_tag}: Son 2 saat yön aşağı ({net_change_pct:.2f}%)"
        }

    # Nötr / Sıkışma — Squeeze için ideal bekleme bölgesi
    return {
        'is_valid':    True,
        'score_bonus': 2.5,
        'msg':         "⚖️ 15m Yatay/Sıkışma: Kırılım öncesi ideal bekleme"
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

        # Kaynak 1: calendar (en güncel, ama bazen None)
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
            # nextFiscalYearEnd çok uzak olur, sadece 60 gün içindeyse kullan
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


def is_earnings_safe_for_swing(ticker: str, min_days_away: int = 5) -> bool:
    try:
        earnings_date = get_earnings_date_safe(ticker)
        # 🎯 V117.2 FIX: API veri vermiyorsa elensin
        if earnings_date is None:
            return False

        now = datetime.now(NY_TZ)

        if earnings_date.tzinfo is None:
            earnings_date = earnings_date.replace(tzinfo=timezone.utc).astimezone(NY_TZ)
        else:
            earnings_date = earnings_date.astimezone(NY_TZ)

        days_until = (earnings_date - now).days
        if 0 <= days_until < min_days_away: return False
        if -1 <= days_until < 0: return False
        return True
    except Exception:
        return False

async def analyze_market_and_sectors():
    """
    V117: Market regime (VIX + SPY) ve sektör performans analizi.
    
    DEĞİŞİKLİKLER (V114 → V117):
      - VIX zaten çekiliyordu ama sadece eşik kontrol ediyordu.
      - V117: VIX slope (yükseliyor mu?) + VIX percentile + override logic eklendi.
      - MARKET_STATUS'a vix, vix_rising, vix_note alanları eklendi.
      - VIX > 35 → regime zorla HIGH_VOLATILITY (SPY ne olursa olsun).
      - VIX < 14 → STRONG rejimine bonus modifier.
      - Sektör analizi değişmedi (zaten sağlam).
    """
    global MARKET_STATUS, SECTOR_PERFORMANCE
    current_vix = 20.0
    vix_prev    = 20.0
    vix_rising  = False

    # ── STEP 1: INDEX VERİSİ ─────────────────────────────────────────
    try:
        indices  = ["^VIX", "SPY"]
        df_indices = await asyncio.to_thread(
            yf.download, indices, period="252d", progress=False,
            group_by="ticker", ignore_tz=True
        )

        # ── VIX ──────────────────────────────────────────────────────
        if "^VIX" in df_indices and not df_indices["^VIX"].empty:
            vix_series  = df_indices["^VIX"]["Close"].dropna()
            current_vix = float(vix_series.iloc[-1])
            vix_prev    = float(vix_series.iloc[-2]) if len(vix_series) >= 2 else current_vix

            # VIX yönü: son 3 günün ortalaması bugünden küçükse yükseliyor
            vix_3d_avg  = float(vix_series.tail(4).iloc[:-1].mean()) if len(vix_series) >= 4 else vix_prev
            vix_rising  = current_vix > vix_3d_avg * 1.03   # %3+ artış = "yükseliyor"

            # VIX 252 günlük yüzdesi (paniğin tarihsel bağlamı)
            vix_52w_min  = float(vix_series.min())
            vix_52w_max  = float(vix_series.max())
            vix_pct_rank = (
                (current_vix - vix_52w_min) / (vix_52w_max - vix_52w_min) * 100
                if vix_52w_max > vix_52w_min else 50.0
            )
        else:
            vix_series  = None
            vix_pct_rank = 50.0

        # ── SPY ───────────────────────────────────────────────────────
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
        # Güvenli default — scan durmasın
        current_spy = spy_ema200 = spy_ema50 = 1.0
        spy_5d_change = vix_pct_rank = 0.0

    # ── STEP 2: REGIME KARAR AĞACI (VIX öncelikli) ──────────────────
    #
    # Mantık:
    #   1. VIX ekstrem ise (>35) → SPY'a bakma, direkt HIGH_VOLATILITY/WEAK
    #   2. VIX normal aralıkta ise → SPY + VIX kombinasyonu ile karar ver
    #   3. VIX çok düşük ise (<14) → STRONG rejimine bonus modifier ekle
    #
    # V114'ten fark: VIX eşikleri aynı ama yön (rising) ve percentile rank
    # artık modifier'ı etkiliyor → daha nüanslı risk yönetimi.

    if current_vix >= 40:
        # Piyasa panik modunda — sadece en güçlü setuplara izin ver
        MARKET_STATUS["regime"]             = "WEAK"
        MARKET_STATUS["min_score_modifier"] = 2.0
        vix_note = f"🚨 VIX PANIC ({current_vix:.1f}) — Tarama çok seçici, sadece SQUEEZE/SPRING geçer"

    elif current_vix >= 35:
        # Yüksek korku — regime HIGH_VOLATILITY, SPY pozisyonu ikincil
        MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
        MARKET_STATUS["min_score_modifier"] = 1.5
        vix_note = f"⚠️ VIX EXTREME ({current_vix:.1f}) — Sadece en iyi setuplar geçer"

    elif current_vix >= 28:
        # Gergin piyasa — SPY durumu ne olursa olsun modifier artı
        extra_modifier = 0.5 if vix_rising else 0.0   # yükseliyorsa daha da sıkı
        if current_spy < spy_ema200:
            MARKET_STATUS["regime"]             = "WEAK"
            MARKET_STATUS["min_score_modifier"] = 1.0 + extra_modifier
            vix_note = f"🔴 VIX High + SPY Downtrend ({current_vix:.1f}) — Seçim çok sıkı"
        else:
            MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
            MARKET_STATUS["min_score_modifier"] = 0.5 + extra_modifier
            vix_note = f"🟠 VIX Elevated ({current_vix:.1f}, {'Rising' if vix_rising else 'Stable'}) — Dikkatli"

    elif current_vix >= 22:
        # Orta gerilim — SPY ile birlikte değerlendir
        if current_spy > spy_ema50:
            MARKET_STATUS["regime"]             = "CHOPPY"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"🟡 VIX Moderate ({current_vix:.1f}) + SPY EMA50 üstü — Seçici al"
        else:
            MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
            MARKET_STATUS["min_score_modifier"] = 0.5
            vix_note = f"🟠 VIX Moderate ({current_vix:.1f}) + SPY EMA50 altı — Dikkat"

    elif current_vix >= 18:
        # Normal piyasa
        if current_spy > spy_ema50 and spy_5d_change > 0:
            MARKET_STATUS["regime"]             = "BULLISH"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"📈 VIX Normal ({current_vix:.1f}) + SPY yükseliyor — Normal tarama"
        elif current_spy > spy_ema200:
            MARKET_STATUS["regime"]             = "CHOPPY"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"➡️ VIX Normal ({current_vix:.1f}) + SPY kararsız — Normal tarama"
        else:
            MARKET_STATUS["regime"]             = "HIGH_VOLATILITY"
            MARKET_STATUS["min_score_modifier"] = 0.3
            vix_note = f"⚠️ VIX Normal ama SPY EMA200 altı ({current_vix:.1f}) — Temkinli"

    else:
        # VIX < 18 — Düşük korku, ideal swing koşulları
        if current_spy > spy_ema50 and spy_5d_change > 0:
            MARKET_STATUS["regime"]             = "STRONG"
            # VIX < 14 ise ekstra bonus modifier (ultra-düşük korku = fırsat)
            MARKET_STATUS["min_score_modifier"] = -1.0 if current_vix < 14 else -0.5
            vix_note = f"✅ VIX Low ({current_vix:.1f}) + SPY güçlü — {'Ultra-favorable' if current_vix < 14 else 'Favorable'}"
        else:
            MARKET_STATUS["regime"]             = "BULLISH"
            MARKET_STATUS["min_score_modifier"] = 0.0
            vix_note = f"🟢 VIX Low ({current_vix:.1f}) — Normal tarama"

    # ── STEP 3: VIX YÖN CEZASI (ek ayar) ────────────────────────────
    # VIX hızla yükseliyorsa (3 günde %10+) modifier'a 0.3 ekle
    # Bu, "piyasa henüz paniklemedi ama panikliyor" anını yakalar
    if vix_rising and current_vix > 20:
        vix_spike = (current_vix - vix_prev) / vix_prev if vix_prev > 0 else 0.0
        if vix_spike > 0.10:   # tek günde %10+ VIX artışı
            MARKET_STATUS["min_score_modifier"] = round(
                MARKET_STATUS.get("min_score_modifier", 0.0) + 0.5, 2
            )
            vix_note += f" | ⚡ VIX spike +{vix_spike*100:.0f}% today"

    # ── STEP 4: MARKET_STATUS'a VIX ALANLARI KAYDET ─────────────────
    MARKET_STATUS["vix"]          = round(current_vix, 2)
    MARKET_STATUS["vix_prev"]     = round(vix_prev, 2)
    MARKET_STATUS["vix_rising"]   = vix_rising
    MARKET_STATUS["vix_pct_rank"] = round(vix_pct_rank, 1)   # 0-100, 100 = tarihsel max panik
    MARKET_STATUS["vix_note"]     = vix_note

    logging.info(
        f"📊 Piyasa Rejimi: {MARKET_STATUS['regime']} | "
        f"VIX: {current_vix:.1f} ({'↑ Rising' if vix_rising else '→ Stable'}) | "
        f"Rank: {vix_pct_rank:.0f}. percentile | "
        f"Modifier: {MARKET_STATUS['min_score_modifier']:+.1f}"
    )
    logging.info(f"   {vix_note}")

# ── STEP 5: SEKTÖR PERFORMANSI ────────────────────────────────
    # V117.2 FIX: 21 günlük (aylık) ağırlık artırıldı.
    # Sektör rotasyonu haftalarda/aylarda şekillenir, günler içinde değil.
    # Yeni dağılım: %15 (1d) + %20 (3d) + %25 (5d) + %40 (21d)
    for sector_name, etf_ticker in SECTOR_ETF_MAP.items():
        try:
            etf      = yf.Ticker(etf_ticker)
            hist_63d = etf.history(period="63d")   # 3 aylık veri — 21d hesabı için yeterli buffer

            if len(hist_63d) < 5:
                continue

            hist_21d = hist_63d.tail(21)
            hist_5d  = hist_63d.tail(5)
            hist_3d  = hist_63d.tail(3)
            hist_1d  = hist_63d.tail(2)

            perf_1d  = (
                (float(hist_1d["Close"].iloc[-1]) - float(hist_1d["Close"].iloc[0]))
                / float(hist_1d["Close"].iloc[0]) * 100
            ) if len(hist_1d) >= 2 else 0.0

            perf_3d  = (
                (float(hist_3d["Close"].iloc[-1]) - float(hist_3d["Close"].iloc[0]))
                / float(hist_3d["Close"].iloc[0]) * 100
            ) if len(hist_3d) >= 3 else perf_1d

            perf_5d  = (
                (float(hist_5d["Close"].iloc[-1]) - float(hist_5d["Close"].iloc[0]))
                / float(hist_5d["Close"].iloc[0]) * 100
            ) if len(hist_5d) >= 5 else perf_3d

            perf_21d = (
                (float(hist_21d["Close"].iloc[-1]) - float(hist_21d["Close"].iloc[0]))
                / float(hist_21d["Close"].iloc[0]) * 100
            ) if len(hist_21d) >= 10 else perf_5d

            # Ağırlık: %15 (1d hız) + %20 (3d ivme) + %25 (5d haftalık) + %40 (21d makro)
            SECTOR_PERFORMANCE[sector_name] = round(
                (perf_1d * 0.15) + (perf_3d * 0.20) + (perf_5d * 0.25) + (perf_21d * 0.40), 2
            )

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

def calculate_profit_target(
    entry_price,
    atr_value,
    is_exhausted=False,
    beta=1.0,
    selection_system="DEFAULT",   # V117_v2: sistem bazlı SL floor için eklendi
    df_1h=None,                   # 1H veri: yapısal swing low için opsiyonel
    ticker="?"                    # Log mesajı için
):
    """
    V117_v2 — Skor-Bağımsız Asimetrik TP/SL
    ================================================================
    DEĞİŞİKLİK (V117):
      ÖNCE: tp_atr_mult = 2.2 + (0.8 * m)  ← momentum_score TP'yi uzatıyordu
            → Yüksek skorlu hisse otomatik daha iyi R/R alıyor
            → Bu döngüsel: skor↑ → TP uzar → R/R↑ → filtreden geçer → skor↑
            → Backtest overfit riski yaratır

      SONRA: TP tamamen skor'dan bağımsız.
             Sadece ATR (volatilite) + beta (karakteristik hareket) + durum (exhausted)
             belirler. Her hisse kendi gerçek volatilitesiyle ölçülür.

    DEĞİŞİKLİK (V117_v2):
      - selection_system parametresi eklendi.
      - %2.5 dar stop uyarısı pasiften aktife alındı: artık sadece log değil,
        %5 floor uygulanıyor.
      - MDU vakası: ATR dar + 1H swing low yakın → %2.69 stop → gürültüde yendi.
        Tüm sistemler için minimum %5 floor zorunlu hale getirildi.
      - calculate_support_resistance_1h() ile tutarlı — her iki mekanizma
        aynı floor'u uyguluyor.

    DÖNDÜRÜLEN DEĞERLER:
      tp1       → İlk kısmi çıkış (%50 mesafe) — risk azaltma noktası
      tp2       → Ana hedef — R/R hesabı buradan yapılır
      tp3       → Trend devamı hedefi (%140 mesafe) — küçük pozisyon için tutulur
      stop_loss → Yapısal stop (min %5 floor garantili)

    MANTIK:
      SL   : ATR'ye dayalı stop (0.9–1.2× ATR) → min %5 floor
      TP2  : Beta + exhaustion'a göre sabit çarpan (2.0–3.2× ATR)
             → Skor etkisi sıfır. Aynı ATR = aynı TP mesafesi.
      TP1  : TP2'nin %50'si
      TP3  : TP2'nin %140'ı (tavan uygulanır)
      R/R  : TP2/SL oranı — hissenin gerçek volatilitesini yansıtır
    ================================================================
    """

    # ── SIFIR/NAN ATR FALLBACK ──────────────────────────────────────────
    # yfinance'tan veri gelmezse yüzde bazlı güvenli değer kullan
    if pd.isna(atr_value) or atr_value <= 0:
        if is_exhausted:
            tp_pct = 0.040   # %4  — tükenmiş hisse için dar hedef
            sl_pct = 0.050   # V117_v2: %2.5 → %5 floor (fallback da floor'a uyuyor)
        elif beta > 1.5:
            tp_pct = 0.090   # %9  — yüksek beta: daha geniş hareket
            sl_pct = 0.050   # V117_v2: %3.8 → %5 floor
        elif beta > 1.0:
            tp_pct = 0.070   # %7  — normal hareket
            sl_pct = 0.050   # V117_v2: %3.2 → %5 floor
        else:
            tp_pct = 0.055   # %5.5 — düşük beta: sınırlı hareket
            sl_pct = 0.050   # V117_v2: %2.8 → %5 floor

        sl = float(round(entry_price * (1 - sl_pct), 4))
        t2 = float(round(entry_price * (1 + tp_pct), 4))
        t1 = float(round(entry_price + (t2 - entry_price) * 0.50, 4))
        t3 = float(round(entry_price + (t2 - entry_price) * 1.40, 4))
        return t1, t2, t3, sl

    # ── STOP LOSS — ATR ÇARPANI ─────────────────────────────────────────
    # Dar ATR → stop daha yakın (volatilite düşük, kesin sinyal)
    # Geniş ATR → stop biraz uzar (volatilite yüksek, gürültü toleransı)
    atr_pct = atr_value / entry_price

    if atr_pct < 0.015:          # ATR < %1.5 — çok dar
        atr_sl_mult = 0.90
    elif atr_pct < 0.030:        # ATR %1.5–3 — normal swing
        atr_sl_mult = 1.00
    elif atr_pct < 0.060:        # ATR %3–6 — volatil
        atr_sl_mult = 1.15
    else:                        # ATR > %6 — çok volatil
        atr_sl_mult = 1.25

    # Exhausted hissede stop daha dar (hasar kontrolü)
    if is_exhausted:
        atr_sl_mult *= 0.80

    # ATR Bazlı Temel Stop Hesabı
    stop_loss = entry_price - (atr_value * atr_sl_mult)

    # Yapısal Koruma: 1H Grafikte Son 20 Barın En Düşük Seviyesi (Swing Low) Kontrolü
    if df_1h is not None and len(df_1h) >= 20:
        h1_swing_low    = float(df_1h['Low'].tail(20).min())
        structural_stop = h1_swing_low * 0.995   # %0.5 sarkan pay / tolerans

        # ATR stop ile karşılaştırıp daha geniş (güvenli) olan alt sınırı seçiyoruz
        stop_loss = min(stop_loss, structural_stop)

    # ── V117_v2: Minimum SL Mesafesi Floor (%5) ──────────────────────────
    # Dar stop (< %5) günlük gürültüde tetiklenir.
    # MDU vakası: %2.69 stop → normal dalgalanmada yendi.
    # Eski kod sadece log yazıp devam ediyordu — artık aktif floor uygulanıyor.
    # calculate_support_resistance_1h() ile tutarlı — her iki mekanizma %5 floor kullanıyor.
    sl_pct_check = (entry_price - stop_loss) / entry_price
    if sl_pct_check < 0.050:
        old_stop  = stop_loss
        stop_loss = entry_price * 0.95   # %5 kesin floor
        logging.info(
            f"⚠️ {ticker}: SL Floor Uygulandı "
            f"({sl_pct_check:.1%} → %5.0) — "
            f"${old_stop:.2f} → ${stop_loss:.2f}"
        )

    # Güvenlik tabanı: En fazla %15 kayıp (Gerçekçi Swing Stop)
    stop_loss = max(stop_loss, entry_price * 0.85)

    # ── TP2 — ANA HEDEF: SKOR'DAN BAĞIMSIZ ─────────────────────────────
    # Çarpan sadece 3 şeye bağlı: is_exhausted + beta + ATR karakteri
    # momentum_score artık bu hesaba girmez.

    if is_exhausted:
        # Tükenmiş hisse: daima dar hedef, erken çıkışa zorla
        tp_atr_mult = 1.60

    elif beta > 2.0:
        # Çok yüksek beta (spekülatif): geniş hareket kapasitesi
        # Ama ATR da büyük olduğu için mesafe zaten uzun
        tp_atr_mult = 2.60

    elif beta > 1.5:
        # Yüksek beta: swing sweet spot
        tp_atr_mult = 2.80

    elif beta > 1.0:
        # Normal beta: standart swing hareketi
        tp_atr_mult = 2.50

    else:
        # Düşük beta (< 1.0): ATR küçük, hareket sınırlı
        # Çarpanı artırırsak TP ulaşılamaz mesafeye gider
        tp_atr_mult = 2.20

    # ATR karakteri: Dar sıkışma sonrası patlama daha büyük olabilir
    # Squeeze tespiti burada yok ama atr_pct çok küçükse orta çarpan yeterli
    if atr_pct < 0.020 and not is_exhausted:
        # Çok dar ATR: TP multiplier'ı azalt, gerçekçi hedef koy
        tp_atr_mult = min(tp_atr_mult, 2.20)

    tp2_raw     = entry_price + (atr_value * tp_atr_mult)
    tp2_pct_raw = (tp2_raw - entry_price) / entry_price * 100

    # ── BETA BAZLI TAVAN (Gerçekçi Hareket Sınırı) ──────────────────────
    # Bu tavan spekülatif olmayan bir sınır koyar.
    # Swing trade için 7 günde %25+ çok nadir — tavan olması gerekir.
    if is_exhausted:
        max_profit_pct = 6.0     # Tükenmiş hisse: dar tavan, hızlı çıkış
    elif beta > 2.0:
        max_profit_pct = 22.0
    elif beta > 1.5:
        max_profit_pct = 16.0
    elif beta > 1.0:
        max_profit_pct = 12.0
    else:
        max_profit_pct = 9.0

    # Tavan aşıldıysa geri çek
    if tp2_pct_raw > max_profit_pct:
        tp2 = entry_price * (1 + max_profit_pct / 100)
    else:
        tp2 = tp2_raw

    # ── TP1 / TP3 ───────────────────────────────────────────────────────
    swing = tp2 - entry_price           # TP2'ye olan mesafe

    tp1 = entry_price + swing * 0.50    # %50 — ilk kısmi çıkış
    tp3 = entry_price + swing * 1.40    # %140 — trend devam ederse tutulan kısım

    # TP3 tavanı: aşırı spekülasyon önlemi
    tp3_max_pct = min(max_profit_pct * 1.40, 30.0)
    tp3_max     = entry_price * (1 + tp3_max_pct / 100)
    tp3         = min(tp3, tp3_max)

    return (
        float(round(tp1, 4)),
        float(round(tp2, 4)),
        float(round(tp3, 4)),
        float(round(stop_loss, 4))
    )
    
def estimate_hold_time(momentum_score, vol_increase, profit_pct=0.0, atr_pct=0.0, is_exhausted=False):
    """🔧 FIX #8: Hold band squeezed from 3-15 → 3-10 days.
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
    # 🎯 1. ÖNCELİK FIX: Sermaye döngüsünü hızlandırmak için hold süresi 2-7 güne indirildi
    return max(2, min(7, hold))

# ================================================================
# ================================================================
# SECTION 8: MAIN STOCK ANALYSIS (apply_atmaca_filters)
# ================================================================
# ================================================================
# [START] SMART NETWORK MANAGEMENT STRATEGY:
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
    BOGA AI v117.v2.2 — 1W → 1D → 1H Hiyerarşik Filtre Mimarisi

    MANTIK:
      PHASE 1W : Haftalık yapı geçmezse 1D'ye bakılmaz (hard gate)
      PHASE 1D : Günlük trend geçmezse 1H'a bakılmaz (hard gate)
      PHASE 1H : Sadece giriş zamanlaması — skoru domine etmez
      PUAN AĞIRLIĞI: 1W ~%30 | 1D ~%55 | 1H ~%15
    """
    try:
        ticker = ticker.strip().upper()

        # =============================================================
        # PHASE 0: BAŞLANGIÇ — tüm değişkenler
        # =============================================================
        score: float = 0.0
        details: List[str] = []
        is_steady_momentum: bool = False
        financial_health_data: dict = {}
        ret_1d_pct: float = 0.0
        squeeze_quality: float = 0.0
        selection_system: str = "DEFAULT"  # Phase 5'te üzerine yazılır
        bb_squeeze: bool = False           # Phase 5'te üzerine yazılır; squeeze_preview için erken başlangıç
        ema_stack: bool = False            # Phase 5'te üzerine yazılır
        mfi_val: float = 50.0             # Phase 3'te üzerine yazılır
        macd_hist_val: float = 0.0        # Phase 3'te üzerine yazılır

        # =============================================================
        # PHASE 1A: TEMEL META FİLTRELER (cache — network yok)
        # =============================================================
        global persistent_info_cache
        cached_info = get_stock_info(ticker)
        financial_health_data = analyze_financial_health(ticker, cached_info)

        market_cap   = cached_info.get("market_cap", 0)
        beta         = cached_info.get("beta", 1.0)
        sector_name  = cached_info.get("sector", "Unknown")
        short_float  = cached_info.get("short_float", 0.0)

        if 0 < beta < ATMACA_MIN_BETA:
            return None

        industry_raw   = cached_info.get("industry", "Unknown")
        industry_lower = industry_raw.lower()
        if industry_lower in HIGH_RISK_INDUSTRIES and 0 < market_cap < HIGH_RISK_INDUSTRY_MCAP_FLOOR:
            return None

        quote_type_raw = cached_info.get("quoteType", "EQUITY").lower()
        if quote_type_raw in CEF_BLOCK_QUOTE_TYPES:
            return None
        if industry_lower in CEF_BLOCK_INDUSTRIES:
            return None

        raw_fcf = cached_info.get("freeCashflow", 0) or 0
        if raw_fcf == 0:
            net_inc = cached_info.get("netIncomeToCommon", 0) or 0
            if net_inc < 0:
                raw_fcf = net_inc

        revenue_growth = cached_info.get("revenueGrowth", 0) or 0
        is_high_growth = revenue_growth > 0.20  # 30% → 20% (büyüme hisseleri için)
        if raw_fcf < NEGATIVE_FCF_FLOOR and not is_high_growth:
            return None

        net_income_raw = cached_info.get("netIncomeToCommon", 0) or 0
        trailing_eps   = cached_info.get("trailingEps", 0) or 0
        if net_income_raw < 0 and trailing_eps < 0 and 0 < market_cap < 5_000_000_000:
            if not is_high_growth:
                return None

        # =============================================================
        # PHASE 1B: 1D VERİ ÇEK (haftalık resample için gerekli)
        # =============================================================
        df_1d = await asyncio.to_thread(get_stock_data, ticker, "1d")
        if df_1d is None or len(df_1d) < 60:
            return None

        avg_volume_10d = float(df_1d["Volume"].tail(10).mean())
        if avg_volume_10d < ATMACA_MIN_AVG_VOLUME:
            return None
        if 0 < market_cap < ATMACA_MIN_MARKET_CAP:
            return None

        close_1d      = df_1d["Close"]
        high_1d       = df_1d["High"]
        low_1d        = df_1d["Low"]
        volume_1d     = df_1d["Volume"]
        current_price = float(close_1d.iloc[-1])

        # =============================================================
        # ══════════════════════════════════════════════════════════════
        # PHASE 2: 1W — HAFTALIK YAPI (HARD GATE + PUAN)
        # Geçmezse return None — 1D'ye hiç bakılmaz
        # ══════════════════════════════════════════════════════════════
        # =============================================================

        w_rsi_val    = 55.0
        w_rsi_slope  = 0.0
        w_vol_ratio  = 1.0
        w_ema40_ok   = True
        is_above_1w_ema50 = True

        try:
            # Tamamlanmış haftalar (son kısmi bar hariç)
            weekly_close = close_1d.resample('W').last().dropna()
            # yfinance multi-level columns → squeeze to 1D Series
            if hasattr(weekly_close, 'squeeze'):
                weekly_close = weekly_close.squeeze()
            if isinstance(weekly_close, pd.DataFrame):
                weekly_close = weekly_close.iloc[:, 0]
            weekly_close_safe = weekly_close.iloc[:-1] if len(weekly_close) > 1 else weekly_close

            if len(weekly_close_safe) >= 15:
                # ── 1W RSI ───────────────────────────────────────────
                w_rsi_series = RSIIndicator(weekly_close_safe, 14).rsi()
                if not w_rsi_series.empty:
                    w_rsi_val = float(w_rsi_series.iloc[-1])
                    if len(w_rsi_series) >= 4:
                        w_rsi_slope = float(w_rsi_series.iloc[-1]) - float(w_rsi_series.iloc[-4])

                # ── 1W Hacim ─────────────────────────────────────────
                try:
                    weekly_vol = df_1d['Volume'].resample('W').sum().dropna()
                    if len(weekly_vol) >= 8:
                        w_vol_ratio = float(weekly_vol.iloc[-1]) / float(weekly_vol.tail(8).mean())
                except Exception:
                    w_vol_ratio = 1.0

                # ── 1W EMA40 Hard Gate ────────────────────────────────
                if len(weekly_close_safe) >= 40:
                    w_ema40      = EMAIndicator(weekly_close_safe, 40).ema_indicator()
                    last_w_ema40 = float(w_ema40.iloc[-1])

                    # Squeeze/Spring dışında EMA40 altı = eleme
                    is_squeeze_pre = False  # Henüz hesaplanmadı, aşağıda düzeltilecek
                    if current_price < last_w_ema40:
                        # Spring/Squeeze tespiti için BB gerekli, basit fiyat kontrolü yap
                        bb_pre  = BollingerBands(close_1d, 20, 2)
                        bw_pre  = float((bb_pre.bollinger_hband() - bb_pre.bollinger_lband()).iloc[-1] / close_1d.iloc[-1])
                        bw_avg  = float((bb_pre.bollinger_hband() - bb_pre.bollinger_lband()).tail(50).mean() / close_1d.tail(50).mean())
                        is_squeeze_pre = bw_pre < bw_avg * 0.60

                        min_low_pre = float(low_1d.tail(10).iloc[:-1].min())
                        is_spring_pre = (
                            float(low_1d.iloc[-1]) < min_low_pre
                            and current_price > min_low_pre
                        )

                        # 🎯 BOĞA MODU: EMA40 yakınında güçlü haftalık RSI = geri çekilme fırsatı
                        ema40_gap_pct = (last_w_ema40 - current_price) / last_w_ema40
                        is_near_ema40 = ema40_gap_pct < 0.08 and w_rsi_val >= 48
                        is_ema40_pullback = ema40_gap_pct < 0.12 and w_rsi_val >= 52 and w_rsi_slope >= 0
                        if not (is_squeeze_pre or is_spring_pre or is_near_ema40 or is_ema40_pullback):
                            # trend_durumu_1d Phase 3'te hesaplanır, burada EMA ile proxy kullan
                            _price_above_ema50 = current_price > float(EMAIndicator(close_1d, 50).ema_indicator().iloc[-1])
                            _price_above_ema200 = current_price > float(EMAIndicator(close_1d, 200).ema_indicator().iloc[-1])
                            _is_1d_strong_pre = _price_above_ema50 and _price_above_ema200
                            if _is_1d_strong_pre:
                                score -= 6.0
                                details.append("⚠️ 1W EMA40 altı ama 1D güçlü (-6p)")
                                is_above_1w_ema50 = False
                            else:
                                logging.info(f"🚫 {ticker}: 1W HARD GATE — Fiyat < 1W EMA40 → Elendi")
                                return None
                        elif is_squeeze_pre or is_spring_pre:
                            score -= 3.0
                            details.append("🟡 1W: Fiyat < EMA40 (Squeeze/Spring İstisna, -3p)")
                            is_above_1w_ema50 = False
                        elif is_near_ema40:
                            score -= 2.0
                            details.append(f"🟡 1W: EMA40'a yakın geri çekilme ({ema40_gap_pct*100:.1f}% altı, RSI:{w_rsi_val:.0f}, -2p)")
                            is_above_1w_ema50 = False
                        else:  # is_ema40_pullback
                            score -= 4.0
                            details.append(f"🟠 1W: EMA40 geri çekilmesi ({ema40_gap_pct*100:.1f}% altı, RSI:{w_rsi_val:.0f}, -4p)")
                            is_above_1w_ema50 = False

        except Exception as e:
            logging.warning(f"⚠️ {ticker}: 1W hesaplama hatası: {e}")

        # ── 1W RSI Hard Gate ─────────────────────────────────────────
        # RSI < 35 VE düşüyor = haftalık yapı bozuk → eleme
        if w_rsi_val < 32 and w_rsi_slope < -3:
            logging.info(f"🚫 {ticker}: 1W HARD GATE — RSI {w_rsi_val:.1f} düşüyor → Elendi")
            return None

        # ── 1W Hacim Hard Gate ────────────────────────────────────────
        # Haftalık hacim ortalamanın %35'sinin altındaysa = ölü hisse → eleme
        if w_vol_ratio < 0.35:
            logging.info(f"🚫 {ticker}: 1W HARD GATE — Haftalık hacim çok düşük ({w_vol_ratio:.2f}x) → Elendi")
            return None

        # ── 1W PUANLAMA ───────────────────────────────────────────────
        # Toplam 1W puan potansiyeli: ~30 puan

        # RSI yön ve seviye (max +12p / min -5p)
        if w_rsi_val > 60 and w_rsi_slope > 3:
            score += 12.0
            details.append(f"🚀 1W RSI: Güçlü Momentum ({w_rsi_val:.1f}, slope +{w_rsi_slope:.1f})")
        elif w_rsi_val > 50 and w_rsi_slope > 1:
            score += 8.0
            details.append(f"💪 1W RSI: Yükselen ({w_rsi_val:.1f}, slope +{w_rsi_slope:.1f})")
        elif w_rsi_val >= 50:
            score += 4.0
            details.append(f"🟢 1W RSI: Sağlam ({w_rsi_val:.1f})")
        elif w_rsi_val >= 40:
            score += 0.0
            details.append(f"➖ 1W RSI: Nötr ({w_rsi_val:.1f})")
        else:
            score -= 5.0
            details.append(f"❄️ 1W RSI: Zayıf ({w_rsi_val:.1f})")

        # RSI slope (ek yön puanı, max +4p / min -3p)
        if w_rsi_slope > 5:
            score += 4.0
            details.append(f"⚡ 1W RSI Slope: Agresif yükseliş (+{w_rsi_slope:.1f})")
        elif w_rsi_slope > 2:
            score += 2.0
            details.append(f"📈 1W RSI Slope: Yükseliyor (+{w_rsi_slope:.1f})")
        elif w_rsi_slope < -5:
            score -= 3.0
            details.append(f"📉 1W RSI Slope: Sert düşüş ({w_rsi_slope:.1f})")
        elif w_rsi_slope < -2:
            score -= 1.5
            details.append(f"↘️ 1W RSI Slope: Düşüşte ({w_rsi_slope:.1f})")

        # Haftalık hacim (max +8p / min -4p)
        if w_vol_ratio > 1.5:
            score += 8.0
            details.append(f"🔥 1W Hacim: Güçlü Artış ({w_vol_ratio:.1f}x)")
        elif w_vol_ratio > 1.2:
            score += 5.0
            details.append(f"📈 1W Hacim: Yükseliyor ({w_vol_ratio:.1f}x)")
        elif w_vol_ratio > 0.9:
            score += 1.0
            details.append(f"➖ 1W Hacim: Normal ({w_vol_ratio:.1f}x)")
        elif w_vol_ratio > 0.7:
            score -= 2.0
            details.append(f"⚠️ 1W Hacim: Zayıflıyor ({w_vol_ratio:.1f}x)")
        else:
            score -= 4.0
            details.append(f"❄️ 1W Hacim: Kritik Düşük ({w_vol_ratio:.1f}x)")

        details.append(
            f"[OK] 1W GATE GEÇİLDİ — RSI:{w_rsi_val:.1f} | Slope:{w_rsi_slope:+.1f} | Vol:{w_vol_ratio:.1f}x"
        )

        # =============================================================
        # ══════════════════════════════════════════════════════════════
        # PHASE 3: 1D — GÜNLÜK TREND (HARD GATE + PUAN) — v117.v1
        # Geçmezse return None — 1H'a hiç bakılmaz
        # ══════════════════════════════════════════════════════════════
        # DEĞİŞİKLİKLER (V117 → v117.v1):
        #   1. EMA Full Stack: spread dinamiği hesaplandı (genişliyor/daralıyor)
        #      ema_spread_expanding flag'i dict'e eklendi → boga_score_100 okur
        #   2. ADX puanlaması düzeltildi: paradoks giderildi
        #      v117.v1: ADX 35+ → +6p, ADX 28-35 → +4p, ADX 20-28 → +2p, ADX 40+ → -3p (tükenme korundu)
        #   3. RSI 60-70 puanı düşürüldü:
        #      v117.v1: RSI 60-65 → +2.5p, RSI 65-68 → +1.0p (sadece strong RS varsa)
        #   4. MACD + sistem tipi korelasyon cezası eklendi:
        #      Trend devam sistemleri + negatif MACD → ekstra -2.5p
        #      Reversal sistemleri + negatif MACD → hafif +1.0p bonus
        #   5. MFI aşırı alım erken uyarısı: mfi_val > 75 + rsi > 65 → -5p (raw_score'da)
        #   6. RVOL hard gate istisnası daraltıldı:
        #      SQUEEZE + rvol < 0.50 → artık istisna yok, elenir
        #      SPRING için rvol istisnası korundu
        # ══════════════════════════════════════════════════════════════

        # ── 1D Temel Göstergeler ──────────────────────────────────────
        ema20_1d  = EMAIndicator(close_1d, 20).ema_indicator()
        ema50_1d  = EMAIndicator(close_1d, 50).ema_indicator()
        ema200_1d = EMAIndicator(close_1d, 200).ema_indicator()
        last_ema20  = float(ema20_1d.iloc[-1])
        last_ema50  = float(ema50_1d.iloc[-1])
        last_ema200 = float(ema200_1d.iloc[-1])

        if current_price > last_ema20 > last_ema50 > last_ema200:
            trend_durumu_1d = "Full Stack"
        elif current_price > last_ema50 > last_ema200:
            trend_durumu_1d = "Macro Bullish"
        elif current_price > last_ema200:
            trend_durumu_1d = "Above EMA200"
        elif current_price > last_ema50:
            trend_durumu_1d = "Above EMA50"
        else:
            trend_durumu_1d = "Downtrend"

        # v117.v1: EMA Spread Dinamiği — statik Full Stack yeterli değil
        # Spread genişliyorsa trend güçleniyor, daralıyorsa dönüm noktasına yakın
        ema_spread_expanding = False
        try:
            if len(ema20_1d) >= 11 and len(ema50_1d) >= 11:
                spread_now    = (float(ema20_1d.iloc[-1])  - float(ema50_1d.iloc[-1]))  / float(ema50_1d.iloc[-1])
                spread_10d    = (float(ema20_1d.iloc[-10]) - float(ema50_1d.iloc[-10])) / float(ema50_1d.iloc[-10])
                ema_spread_expanding = spread_now > spread_10d
        except Exception:
            ema_spread_expanding = True   # Fallback: belirsizse genişliyor say


        # Bollinger & Squeeze Kontrolü
        bb_1d           = BollingerBands(close_1d, 20, 2)
        bb_width_series = (bb_1d.bollinger_hband() - bb_1d.bollinger_lband()) / ema20_1d
        bb_width        = float(bb_width_series.iloc[-1])
        bb_width_avg_50 = float(bb_width_series.tail(50).mean()) if len(bb_width_series) >= 50 else bb_width
        is_squeeze      = (bb_width < bb_width_avg_50 * 0.60) or (bb_width < 0.05)

        # Spring Kontrolü
        min_low_10d  = float(low_1d.tail(10).iloc[:-1].min())
        current_low  = float(low_1d.iloc[-1])
        daily_range  = float(high_1d.iloc[-1]) - current_low
        is_spring = (
            current_low < min_low_10d
            and current_price > min_low_10d
            and current_price > float(df_1d['Open'].iloc[-1])
            and current_price >= current_low + (daily_range * 0.5)
        )

        # ADX Hesaplama & Puanlama (v117.v1 Paradoks Düzeltmesi)
        try:
            adx_series_1d = ADXIndicator(high_1d, low_1d, close_1d, 14).adx()
            adx_1d        = float(adx_series_1d.iloc[-1])
        except Exception:
            adx_series_1d = pd.Series(0.0, index=df_1d.index)
            adx_1d        = 0.0


        if len(ema20_1d) >= 10 and float(ema20_1d.iloc[-10]) > 0:
            ema20_slope_numeric = (float(ema20_1d.iloc[-1]) - float(ema20_1d.iloc[-10])) / float(ema20_1d.iloc[-10])
        else:
            ema20_slope_numeric = 0.0
        is_ema_flat = abs(ema20_slope_numeric) < 0.008

        # RVOL Hesaplama & v117.v1 Daraltılmış Hard Gate İstisnası
        try:
            vol_today   = float(volume_1d.iloc[-1])
            vol_20g_avg = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_today
            rvol_micro  = (vol_today / vol_20g_avg) if vol_20g_avg > 0 else 0.0
        except Exception:
            rvol_micro = 0.0

        # SWING117: TREND_CONT (%70.6 WR) ve SQUEEZE için hacimsiz kuruma (VCP) sinyalleri esnetildi
        try:
            close_prices = df_1d['Close'].tolist()
            is_squeeze_vcp_candidate = (-0.05 <= (close_prices[-1] - close_prices[-5]) / close_prices[-5] <= 0.09) if len(close_prices) >= 5 else False
        except Exception:
            is_squeeze_vcp_candidate = False

        # 🎯 BOĞA MODU: İlk RVOL ön-eleme eşiği düşürüldü
        _is_strong_trend = trend_durumu_1d in ("Full Stack", "Macro Bullish")
        min_rvol_required = 0.15 if is_squeeze_vcp_candidate else (0.25 if _is_strong_trend else 0.40)
        if rvol_micro < min_rvol_required:
            if is_spring or is_squeeze:
                pass
            else:
                return None

        # RSI 1D Hesaplama & v117.v1 Hassas Puanlama Modeli
        try:
            rsi_1d_series = RSIIndicator(close_1d, 14).rsi()
            rsi_quick     = float(rsi_1d_series.iloc[-1])
            rsi_prev      = float(rsi_1d_series.iloc[-2]) if len(rsi_1d_series) >= 2 else rsi_quick
        except Exception:
            rsi_1d_series = pd.Series([50.0])
            rsi_quick     = 50.0
            rsi_prev      = 50.0

        # ==========================================================================
        # ── MFI Hesaplama & v117.v1 Aşırı Alım Erken Uyarısı (-5p) ────────────────
        # ==========================================================================
        try:
            # ta kütüphanesi entegrasyonu güvenli hale getirildi
            mfi_indicator = MFIIndicator(
                high=high_1d, 
                low=low_1d, 
                close=close_1d, 
                volume=volume_1d, 
                window=14
            )
            mfi_series = mfi_indicator.money_flow_index()
            
            if mfi_series is not None and len(mfi_series) > 0:
                mfi_val = float(mfi_series.iloc[-1])
                if pd.isna(mfi_val):
                    mfi_val = 50.0
            else:
                mfi_val = 50.0
        except Exception as e:
            logging.warning(f"⚠️ MFI hesaplama hatası: {e}. Varsayılan değer (50.0) atandı.")
            mfi_val = 50.0


        # MACD Hesaplama & v117.v1 Sistem Tipi Korelasyon Cezası Entegrasyonu
        try:
            macd_obj = MACD(close_1d)
            macd_hist_series = macd_obj.macd_diff()
            macd_hist_val = float(macd_hist_series.iloc[-1])
        except Exception:
            macd_hist_val = 0.0

        # CMF (Chaikin Money Flow) Kontrolü
        cmf_val = 0.0
        try:
            df_cmf        = df_1d.tail(25)
            prev_close_l2 = df_cmf['Close'].shift(1)
            true_high_l2  = np.maximum(df_cmf['High'], prev_close_l2)
            true_low_l2   = np.minimum(df_cmf['Low'],  prev_close_l2)
            true_range_l2 = (true_high_l2 - true_low_l2).replace(0, np.nan)
            mfm_l2        = ((df_cmf['Close'] - true_low_l2) - (true_high_l2 - df_cmf['Close'])) / true_range_l2
            mfm_l2        = mfm_l2.fillna(0)
            cmf_current   = (mfm_l2 * df_cmf['Volume']).tail(20).sum() / df_cmf['Volume'].tail(20).sum()
            cmf_val       = float(cmf_current) if not pd.isna(cmf_current) else 0.0
        except Exception:
            cmf_val = 0.0
            

        # ── 1D HARD GATE'LER — V117_v2 ────────────────────────────────
        # DEĞİŞİKLİKLER (V117 → V117_v2):
        #   1. is_early_awakening_preview: Phase5 ile senkronize edildi.
        #      V117: 3 koşul (fiyat + RSI + rvol) → ADX gate'ini atlıyordu.
        #      V117_v2: adx_1d >= 18 ve w_rsi_val >= 50 koşulları eklendi.
        #      (Phase5'teki 7-koşullu is_early_awakening ile tutarlı hale getirildi.)
        #   2. ADX hard gate: AWAKENING preview artık istisnadan yararlanamıyor.
        #      V117: not (is_squeeze or is_spring) → AWAKENING bypass ediyordu.
        #      V117_v2: is_early_awakening_preview zaten adx >= 18 şartı taşıdığından
        #      ADX gate'i AWAKENING için de işleyecek.
        #   3. RVOL hard gate istisnası daraltıldı:
        #      SPRING → muafiyet korundu.
        #      SQUEEZE + rvol >= 0.50 → dry-up toleransı korundu.
        #      SQUEEZE + rvol < 0.50 → artık eleniyor (V117'de geçiyordu).
        #   4. Kanama gate eşiği sıkılaştırıldı: -%3.5 → -%3.0
        #      Rapor: dar stop + kanama kombinasyonu stop-loss tetikleyicisi.
        #      -%3.0 daha sıkı filtre — zayıf momentum hisseler erken eleniyor.
        # ──────────────────────────────────────────────────────────────

        # Dead money: flat EMA + zayıf ADX + squeeze/spring yoksa
        if not is_squeeze and not is_spring and is_ema_flat and adx_1d < ADX_MIN_LEVEL_1D:
            logging.info(f"🚫 {ticker}: 1D HARD GATE — Dead money")
            return None

        # Trend: EMA200 altındaysa spring zorunlu
        if current_price < last_ema200 and not is_spring:
            logging.info(f"🚫 {ticker}: 1D HARD GATE — EMA200 altı")
            return None

        # Downtrend: spring yoksa eleme — tek kontrol noktası burada, EMA scoring else dalı zaten erişilemez
        if trend_durumu_1d == "Downtrend" and not is_spring:
            logging.info(f"🚫 {ticker}: 1D HARD GATE — Downtrend")
            return None
            
        # 5 günde kanama gate — Boğa modu: -%3.0 → -%4.0 (gevşetildi)
        # Boğa döneminde geçici geri çekilme adayları elenmemelidir.
        if len(close_1d) >= 6:
            ret_5d_pct = (current_price - float(close_1d.iloc[-6])) / float(close_1d.iloc[-6]) * 100
            _kanama_esik = -6.0 if trend_durumu_1d in ("Full Stack", "Macro Bullish") else -4.0
            if ret_5d_pct < _kanama_esik:
                logging.info(f"🚫 {ticker}: 1D HARD GATE — 5G kanama ({ret_5d_pct:.1f}%)")
                return None
                
        # RSI 1D hard gate
        if rsi_quick < RSI_1D_MIN:
            return None
        if rsi_quick < 41 and rsi_quick < rsi_prev:
            return None

        # V117_v2: is_early_awakening_preview Phase5 ile senkronize edildi
        # V117: sadece 3 koşul → ADX < 18 olan hisseler bypass ediyordu
        # V117_v2: adx_1d >= 18 ve w_rsi_val >= 50 zorunlu (Phase5'teki 7 koşulla tutarlı)
        is_early_awakening_preview = (
            45 <= rsi_quick <= 55
            and 0.9 <= rvol_micro <= 1.3
            and current_price > last_ema20
            and adx_1d >= 18                # V117_v2 YENİ: ADX gate bypass'ını önler
            and w_rsi_val >= 50             # V117_v2 YENİ: haftalık yapı desteği zorunlu
        )

        if not (is_squeeze or is_spring or is_early_awakening_preview):
            rsi_3d_ago = float(rsi_1d_series.iloc[-3]) if len(rsi_1d_series) >= 3 else rsi_quick
            if (rsi_quick < rsi_prev < rsi_3d_ago) and rsi_quick < 52:
                if trend_durumu_1d in ("Full Stack", "Macro Bullish"):
                    score -= 4.0
                    details.append(f"⚠️ RSI 3G düşüş ama 1D güçlü (-4p)")
                else:
                    return None

        # 🎯 BOĞA MODU: RVOL 1D hard gate gevşetildi
        # Fiyat ve hacim odaklı analiz: 1W/1D/1H momentum önemli, anlık RVOL engelleyici olmamalı
        # RVOL artık puanlama sistemini etkiliyor ama tek başına hard gate değil
        _is_momentum_sys = trend_durumu_1d in ("Full Stack", "Macro Bullish")
        min_rvol_required = 0.30 if (sector_name == "Real Estate" or _is_momentum_sys) else 0.40
        try:
            macro_resist      = float(high_1d.tail(15).max())
            breakout_distance = (macro_resist - current_price) / current_price
            if 0 <= breakout_distance < 0.025:
                pass  # Kırılım öncesi RVOL sıkıştırması kaldırıldı — pre-breakout dry-up normaldir
        except Exception:
            pass
        if rvol_micro < min_rvol_required:
            if is_spring:
                pass                                # SPRING: muafiyet korundu
            elif is_squeeze and rvol_micro >= 0.20:
                pass                                # SQUEEZE: dry-up toleransı genişletildi
            else:
                return None

        # ADX hard gate — V117_v2: is_early_awakening_preview artık adx >= 18 taşıdığından
        # AWAKENING preview bu gate'i eskisi gibi bypass edemez.
        # V117_v2: BREAKOUT/TREND_CONT için eşik 18 → 15 (erken trend tespiti)
        _breakout_early = trend_durumu_1d in ("Full Stack", "Macro Bullish") and rsi_quick > 50
        if sector_name == "Real Estate":
            min_adx_required = 12
        elif _breakout_early:
            min_adx_required = 15
        else:
            min_adx_required = 18
        if adx_1d > 0 and adx_1d < min_adx_required and not (is_squeeze or is_spring):
            return None

        # Yeşil mum sayısı
        try:
            last10        = df_1d.tail(10)
            green_candles = int((last10['Close'] > last10['Open']).sum())
        except Exception:
            green_candles = 0

        # 🎯 BOĞA MODU: Yeşil mum eşiği düşürüldü (geri çekilme günleri dahil)
        min_green = 2 if (is_squeeze or is_spring) else 2
        if sector_name == "Real Estate":
            min_green = 3
        if green_candles < min_green:
            return None

        # CMF hard gate
        if cmf_val < -0.12 and not (is_squeeze or is_spring):
            return None
        elif cmf_val < -0.05 and not (is_squeeze or is_spring):
            score -= 3.0
            details.append(f"⚠️ CMF: Zayıf para akışı (-3p, {cmf_val:.3f})")

        # ATR hard gate
        try:
            atr_1d_series = AverageTrueRange(high_1d, low_1d, close_1d, ATR_PERIOD).average_true_range()
            atr_1d        = float(atr_1d_series.iloc[-1])
        except Exception:
            atr_1d = 0.0

        atr_pct_1d = (atr_1d / current_price) if current_price > 0 else 0.0
        if atr_pct_1d > 0:
            if atr_pct_1d < 0.015:
                return None
            max_atr_allowed = 0.150 if beta > 1.5 else 0.100
            if atr_pct_1d > max_atr_allowed:
                return None
        if atr_pct_1d < 0.025 and sector_name == "Real Estate":
            return None

        try:
            bb_width_1d = (bb_1d.bollinger_hband().iloc[-1] - bb_1d.bollinger_lband().iloc[-1]) / current_price if current_price > 0 else 0.0
        except Exception:
            bb_width_1d = 0.0

        # Churn koruması
        close_change_pct = (
            (float(close_1d.iloc[-1]) - float(close_1d.iloc[-2])) / float(close_1d.iloc[-2])
            if len(close_1d) > 1 else 0.0
        )
        open_today   = float(df_1d['Open'].iloc[-1])
        candle_range = float(high_1d.iloc[-1]) - float(low_1d.iloc[-1])
        candle_body  = abs(current_price - open_today)
        churn_ratio  = (candle_body / candle_range) if candle_range > 0 else 1.0
        if churn_ratio < 0.30 and rvol_micro > 2.0 and not is_spring:
            return None
        if rvol_micro > 2.5 and close_change_pct < -0.03:
            return None
        if close_change_pct > 0.12:
            return None
        elif close_change_pct > 0.08:
            score -= 5.0
            details.append(f"⚠️ Güçlü gap-up: geç giriş riski (-5p, +{close_change_pct*100:.1f}%)")

        try:
            price_20d_range = (high_1d.tail(20).max() - low_1d.tail(20).min()) / current_price
            if 0 < price_20d_range < 0.01 and not is_squeeze:
                return None
        except Exception:
            pass

        # Earnings kontrolü
        if not await asyncio.to_thread(is_earnings_safe_for_swing, ticker):
            logging.info(f"🚫 {ticker}: Earnings yakın → Eleme")
            return None
            
        # ── 1D PUANLAMA ───────────────────────────────────────────────

        score += 4.0
        details.append(f"[OK] 1D GATE GEÇİLDİ — Trend:{trend_durumu_1d} | ADX:{adx_1d:.1f} | RSI:{rsi_quick:.1f}")

        # Sektör rotasyonu
        sec_perf = SECTOR_PERFORMANCE.get(sector_name, 0.0)
        if sec_perf > 2.0:
            score += 5.0;  details.append(f"🔥 Sektör HOT: {sector_name} (+{sec_perf:.1f}%)")
        elif sec_perf > 0:
            score += 1.5;  details.append(f"📊 Sektör Pozitif: {sector_name} (+{sec_perf:.1f}%)")
        elif sec_perf < -2.0:
            score -= 3.0;  details.append(f"🥶 Sektör SOĞUK: {sector_name} ({sec_perf:.1f}%)")
        else:
            score -= 0.5;  details.append(f"➖ Sektör Nötr: {sector_name} ({sec_perf:.1f}%)")

        # Relative Strength
        rs_label     = "N/A"
        rs_slope     = 0.0
        is_strong_rs = False
        index_close  = get_index_close_series(INDEX_BENCHMARK)
        if index_close is not None:
            idx_aligned = index_close.reindex(close_1d.index, method="ffill").dropna()
            common_idx  = close_1d.index.intersection(idx_aligned.index)
            if len(common_idx) >= 20:
                rs_series = close_1d.loc[common_idx] / idx_aligned.loc[common_idx]
                rs_tail   = rs_series.tail(min(RS_LOOKBACK, len(rs_series)))
                try:
                    rs_slope = float(np.polyfit(range(len(rs_tail)), rs_tail.values, 1)[0])
                except Exception:
                    rs_slope = 0.0
                if rs_slope > 0.0005:
                    score += 4.0;  rs_label = "Strong Outperform";  is_strong_rs = True
                    details.append(f"💪 RS: Güçlü Outperform")
                elif rs_slope > 0:
                    score += 1.5;  rs_label = "Mild Outperform"
                    details.append(f"📈 RS: Hafif Outperform")
                elif rs_slope > -0.0005:
                    score -= 1.0;  rs_label = "Neutral"
                    details.append("➖ RS: Paralel")
                else:
                    score -= 2.5;  rs_label = "Underperform"
                    details.append(f"⚠️ RS: Underperform")

        # EMA Trend Puanı — SWING117 GÜNCELLEMESİ: BELOW Stack Kesin Engelleme (Hard-Reject)
        # Rapor: %33.3 WR üreten BELOW/Downtrend kombinasyonunun sızmasını engellemek için filtre sertleştirildi.
        if trend_durumu_1d == "Full Stack":
            if ema_spread_expanding:
                score += 15.0
                details.append("🏆 1D TREND: Full Stack + Genişleyen Spread (+15p)")
            else:
                score += 11.0
                details.append("⚠️ 1D TREND: Full Stack ama Daralan Spread (+11p) — dönüm riski")
            # EMA50-200 spread büyüklüğü bonusu: sadece genişleyen spread durumunda
            if ema_spread_expanding:
                ema_spread = (last_ema50 - last_ema200) / last_ema200 if last_ema200 > 0 else 0.0
                if ema_spread > 0.03:
                    score += 1.5
                    details.append("🔥 EMA50-200 Geniş Spread (+1.5p)")
        elif trend_durumu_1d == "Macro Bullish":
            score += 11.0
            details.append("🏆 1D TREND: Macro Bullish (+11p)")
            ema_spread = (last_ema50 - last_ema200) / last_ema200 if last_ema200 > 0 else 0.0
            if ema_spread > 0.03:
                score += 1.5
                details.append("🔥 EMA50-200 Geniş Spread (+1.5p)")
        elif trend_durumu_1d == "Above EMA200":
            score += 3.0;  details.append("🟢 1D TREND: EMA200 üstü (+3p)")
        elif trend_durumu_1d == "Above EMA50":
            score += 1.0;  details.append("🟡 1D TREND: EMA50 üstü (+1p)")
        elif is_spring and trend_durumu_1d not in ("Full Stack", "Macro Bullish", "Above EMA200", "Above EMA50"):
            # BELOW+SPRING = %0 WR (DASH, UBER, IQV) → hard bloker
            logging.info(f"🚫 {ticker}: BELOW+SPRING kombinasyonu → Elendi")
            return None
        else:
            # SWING118 NET ENGEL: %33.3 WR üreten düşen trend/BELOW stack kombinasyonu doğrudan elenir
            return None

        cond_ema20_slope_positive = calculate_ema_slope(ema20_1d, periods=10)
        if cond_ema20_slope_positive:
            score += 3.0; details.append("📈 EMA20: Pozitif eğim (+3p)")
        else:
            score -= 1.5; details.append("📉 EMA20: Negatif/Düz eğim (-1.5p)")
        # Squeeze / Spring Alpha
        if is_squeeze:
            squeeze_quality        = max(0.0, 1.0 - (bb_width / (bb_width_avg_50 * 0.60)))
            squeeze_quality        = min(squeeze_quality, 1.0)
            squeeze_base           = 8.0 + (10.0 * squeeze_quality)
            squeeze_exemption_cost = 0.0
            if rvol_micro < 1.05:         squeeze_exemption_cost += 3.0
            if cmf_val < -0.05:           squeeze_exemption_cost += 3.0
            if is_ema_flat and adx_1d < 15: squeeze_exemption_cost += 2.0
            if green_candles < 4:         squeeze_exemption_cost += 1.5
            if mfi_val < 30:              squeeze_exemption_cost += 5.0  # 🐂 YENI V117_v2: Kurumsal dağıtım varsa squeeze çalışmaz!
            squeeze_net = squeeze_base - squeeze_exemption_cost
            score += squeeze_net
            details.append(f"🚨 SQUEEZE: Kalite {squeeze_quality*100:.0f}% | Bonus: +{squeeze_net:.1f}p")
        elif is_spring:
            score += 15.0
            details.append("⚡ SPRING: Failed Breakdown (+15p)")

        # ADX — v117.v1 DÜZELTMESİ: Doğrusal ödüllendirme (V117 paradoksu giderildi)
        # V117: ADX 18-28 → +4p, ADX 28-40 → +2p (ters mantık)
        # v117.v1: ADX 35+ en yüksek, doğrusal azalma
        try:
            adx_slope = float(adx_series_1d.diff().tail(5).mean())
        except Exception:
            adx_slope = 0.0

        if adx_1d >= 40:
            score -= 3.0; details.append(f"⚠️ ADX: Tükenme ({adx_1d:.1f})")
        elif adx_1d >= 35:
            score += 6.0; details.append(f"🔥 ADX: Güçlü Trend ({adx_1d:.1f})")
        elif adx_1d >= 28:
            score += 4.0; details.append(f"💪 ADX: Kurulu Trend ({adx_1d:.1f})")
        elif adx_1d >= 20:
            score += 2.0; details.append(f"📈 ADX: Orta Trend ({adx_1d:.1f})")
        elif adx_1d >= 15:
            score += 0.5; details.append(f"🟡 ADX: Zayıf ({adx_1d:.1f})")
        else:
            score -= 2.0; details.append(f"❄️ ADX: Trendsiz ({adx_1d:.1f})")

        if adx_slope > 0.8:
            score += 2.0; details.append(f"⚡ ADX Slope: Agresif")
        elif adx_slope > 0.3:
            score += 1.0; details.append(f"📈 ADX Slope: Yükseliyor")
        elif adx_slope < -0.5:
            score -= 2.0; details.append(f"🐌 ADX Slope: Soluyor")

        # Beta
        if beta >= 1.5:
            score += 3.0; details.append(f"🚀 High Beta ({beta:.2f})")
        elif beta >= 1.2:
            score += 1.5; details.append(f"📈 Good Beta ({beta:.2f})")
        elif beta < 0.8:
            score -= 2.0; details.append(f"🐢 Low Beta ({beta:.2f})")

        # ATR rejimi
        if atr_pct_1d < 0.025:
            if is_squeeze:
                score -= 1.0; details.append("⚠️ ATR: Squeeze sıkışması")
            else:
                score -= 4.0; details.append("🔴 ATR: Çok Dar")
        elif atr_pct_1d < 0.035:
            score -= 0.5; details.append("⚠️ ATR: Hafif Dar")
        elif atr_pct_1d < 0.045:
            score += 5.0; details.append("⚡ ATR: İyi Swing")
        elif atr_pct_1d <= 0.075:
            score += 7.0; details.append("🔥 ATR: Sweet Spot")
        elif atr_pct_1d <= 0.100:
            score += 4.0; details.append("🟧 ATR: Yüksek (yönetilen)")
        else:
            score += 1.0; details.append("🟨 ATR: Aşırı")

        # RSI 1D puanı — v117.v1: 60-70 aralığı düşürüldü, MFI tükenme cezası eklendi
        rsi_1d_val = rsi_quick
        if sector_name == "Real Estate":
            if 38 <= rsi_1d_val <= 55:
                score += 6.0; details.append(f"🏢 REIT RSI: Optimal ({rsi_1d_val:.1f})")
            elif 55 < rsi_1d_val <= 65:
                score += 3.0; details.append(f"📈 REIT RSI: Momentum ({rsi_1d_val:.1f})")
            elif rsi_1d_val > 65:
                score -= 4.0; details.append(f"⚠️ REIT RSI: Şişkin ({rsi_1d_val:.1f})")
            elif rsi_1d_val < 35:
                score -= 3.0; details.append(f"❄️ REIT RSI: Zayıf ({rsi_1d_val:.1f})")
            else:
                score += 0.5; details.append(f"➖ REIT RSI: Nötr ({rsi_1d_val:.1f})")
        else:
            if RSI_BOGA_OPT_MIN <= rsi_1d_val <= 60:
                score += 7.0; details.append(f"🌀 RSI: Sweet Spot ({rsi_1d_val:.1f})")
            elif 60 < rsi_1d_val <= 65:
                # v117.v1: +3.5p → +2.5p — rapor bu aralığın sorunlu olduğunu gösterdi
                score += 2.5; details.append(f"📈 RSI: Momentum ({rsi_1d_val:.1f})")
            elif 65 < rsi_1d_val <= RSI_1D_MAX and is_strong_rs:
                # v117.v1: Sadece strong RS varsa pozitif — yoksa artık puan yok
                score += 1.0; details.append(f"🚀 RSI: Momentum Lideri — RS Destekli ({rsi_1d_val:.1f})")
            elif 65 < rsi_1d_val <= 75 and not is_strong_rs:
                score -= 4.0; details.append(f"⚠️ RSI: FOMO Riski ({rsi_1d_val:.1f})")
            elif rsi_1d_val < 40:
                score -= 3.0; details.append(f"❄️ RSI: Zayıf ({rsi_1d_val:.1f})")
            elif rsi_1d_val > RSI_1D_MAX or (rsi_1d_val > 75 and not is_strong_rs):
                if w_rsi_val < 50:
                    score -= 12.0
                    details.append(f"🔴 RSI Overbought ({rsi_1d_val:.1f}) + 1W Zayıf ({w_rsi_val:.1f}) → Tepe Riski")
                else:
                    score -= 6.0
                    details.append(f"⚠️ RSI Yüksek ({rsi_1d_val:.1f}) + 1W Destekli ({w_rsi_val:.1f})")
            else:
                score += 0.5; details.append(f"➖ RSI: Nötr ({rsi_1d_val:.1f})")

        # RSI slope 1D
        rsi_slope_5 = 0.0
        try:
            if len(rsi_1d_series) >= 5:
                rsi_slope_5 = float(rsi_1d_series.iloc[-1]) - float(rsi_1d_series.iloc[-5])
                if rsi_slope_5 < -5:
                    score -= 2.5; details.append(f"📉 RSI Slope 1D: Güçlü düşüş ({rsi_slope_5:.1f})")
                elif rsi_slope_5 < -2:
                    score -= 1.2; details.append(f"↘️ RSI Slope 1D: Düşüşte ({rsi_slope_5:.1f})")
                elif rsi_slope_5 > 5:
                    score += 2.0; details.append(f"📈 RSI Slope 1D: Güçlü yükseliş ({rsi_slope_5:.1f})")
                elif rsi_slope_5 > 2:
                    score += 1.0; details.append(f"↗️ RSI Slope 1D: Yükselişte ({rsi_slope_5:.1f})")
        except Exception:
            pass

        # RSI divergence
        try:
            if (
                len(close_1d) > 5
                and close_1d.iloc[-1] > close_1d.iloc[-5]
                and rsi_1d_series.iloc[-1] < rsi_1d_series.iloc[-5]
            ):
                score -= 3.5; details.append("⚠️ RSI Diverjans: Negatif")
        except Exception:
            pass

        # Exhaustion — SWING117 GÜNCELLEMESİ
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
            
            # SWING117: RSI üst sınırı 67'ye çekildi ve ADX/RSI trend tükenmesi (FOMO Engeli) eklendi
            is_overbought_rsi = rsi_1d_val > 72.0
            is_trend_exhausted = (adx_1d > 42 and rsi_1d_val > 68.0)

            if roc_3d > 12.0 or is_overbought_rsi or ret_1d_pct > 6.0 or is_trend_exhausted:
                is_exhausted = True
                reasons_ex = []
                if roc_3d > 12.0:          reasons_ex.append(f"3G ROC: +{roc_3d:.1f}%")
                if ret_1d_pct > 6.0:       reasons_ex.append(f"1G ROC: +{ret_1d_pct:.1f}%")
                if is_overbought_rsi:      reasons_ex.append(f"RSI OVB: {rsi_1d_val:.1f} > 72")
                if is_trend_exhausted:     reasons_ex.append(f"EXHAUSTED (ADX={adx_1d:.1f}, RSI={rsi_1d_val:.1f})")
                
                score -= 18.0
                details.append(f"🔴 EXHAUSTED: {', '.join(reasons_ex)}")
        except Exception:
            pass

        # MACD — SWING117 GÜNCELLEMESİ: %71.0 WR Veren Negatif MACD Dönüş Optimizasyonu
        # Rapor: Trend devam sisteminde negatif MACD yön yukarı ise harika bir konsolidasyon sonu swing girişidir.
        # NOT: Bu aşamada selection_system henüz belirlenmedi (Phase5'te belirleniyor).
        # Bu nedenle is_spring / is_squeeze proxy'lerini kullanıyoruz.
        macd_hist_val  = 0.0
        macd_hist_prev = 0.0
        is_reversal_proxy = False   # SWING118: output dict'e yazılıyor, buradan başlatılıyor
        try:
            macd_obj       = MACD(close_1d, window_slow=26, window_fast=12, window_sign=9)
            macd_hist      = macd_obj.macd_diff()
            macd_hist_val  = float(macd_hist.iloc[-1])
            macd_hist_prev = float(macd_hist.iloc[-2]) if len(macd_hist) >= 2 else 0.0

            # 1. Aşırı şişmiş pozitif momentum kontrolü (FOMO / Geç Giriş Engeli)
            if macd_hist_val > 2.0:
                score -= 4.0
                details.append(f"⚠️ MACD_Hist > 2.0: Asiri uzamis momentum gecis riski (-4p) ({macd_hist_val:.3f})")
            
            # 2. Normal pozitif histogram durumları
            elif macd_hist_val > 0 and macd_hist_val > macd_hist_prev:
                score += 2.5; details.append(f"📈 MACD Hist: Yukseliyor ({macd_hist_val:.3f})")
            elif macd_hist_val > 0:
                score += 1.2; details.append(f"[OK] MACD Hist: Pozitif ({macd_hist_val:.3f})")
            
            # 3. SWING118 KRİTİK: Negatif MACD ama yönün yukarı döndüğü taze dönüş senaryosu (%71.0 Win Rate)
            elif macd_hist_val < 0 and macd_hist_val > macd_hist_prev:
                score += 3.0
                details.append(f"🚀 MACD Hist Negatif ama Yon Yukari (+3p Taze Donus Primi) ({macd_hist_val:.3f})")
            
            # 4. Negatif MACD ve yönün hala aşağı veya sabit olduğu durumlar
            elif macd_hist_val < 0:
                # is_spring veya pullback proxy: fiyat EMA200 üstü ama EMA20 altı + gün içi iyileşme
                is_reversal_proxy = is_spring or (
                    current_price < last_ema20
                    and current_price > last_ema200
                    and close_change_pct > 0
                )
                if is_reversal_proxy:
                    # Reversal setup: negatif MACD beklenen, tolere et
                    details.append(f"🟡 MACD Hist: Negatif — Reversal tolerans ({macd_hist_val:.3f})")
                elif is_squeeze:
                    # Squeeze: sıkışma döneminde negatif MACD olabilir, hafif ceza
                    score -= 1.0; details.append(f"⚠️ MACD Hist: Squeeze negatif ({macd_hist_val:.3f})")
                else:
                    # Sadece yönü hala aşağı bakan, taze dönüş emaresi göstermeyen negatif trendlere ceza uygula
                    score -= 2.0; details.append(f"🔴 MACD: Negatif Trend Devam Riski ({macd_hist_val:.3f})")
        except Exception:
            macd_hist_val  = 0.0
            macd_hist_prev = 0.0

        # OBV
        try:
            obv_1d    = OnBalanceVolumeIndicator(close_1d, volume_1d).on_balance_volume()
            obv_tail  = obv_1d.tail(OBV_TREND_DAYS).values
            obv_slope = float(np.polyfit(range(len(obv_tail)), obv_tail, 1)[0])
        except Exception:
            obv_slope = 0.0

        if obv_slope > 1000:
            score += 5.0; details.append("[OK] OBV: Güçlü Birikim")
        elif obv_slope > 0:
            score += 2.0; details.append("📈 OBV: Pozitif")
        elif obv_slope < -1000:
            score -= 2.5; details.append("⚠️ OBV: Dağıtım")
        else:
            score -= 0.5; details.append("➖ OBV: Nötr")

        # RVOL 1D
        vol_today  = float(volume_1d.iloc[-1])
        vol_ma_1d  = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_today
        rvol_today = (vol_today / vol_ma_1d) if vol_ma_1d > 0 else 0.0

        if 1.2 <= rvol_today <= 1.8 and abs(close_change_pct) < 0.006:
            score += 5.5; details.append(f"🐋 RVOL 1D: Sessiz Birikim ({rvol_today:.2f}x)")
        elif rvol_today > 2.0 and close_change_pct > 0.008:
            score += 7.0; details.append(f"[START] RVOL 1D: Swing Uyanışı ({rvol_today:.2f}x)")
        elif rvol_today > 1.5:
            score += 2.5; details.append(f"📊 RVOL 1D: Aktif ({rvol_today:.2f}x)")
        elif rvol_today < 0.6:
            score -= 2.5; details.append(f"🐢 RVOL 1D: Hacimsiz ({rvol_today:.2f}x)")
        else:
            score += 0.5; details.append(f"➖ RVOL 1D: Normal ({rvol_today:.2f}x)")

        vol_avg5           = float(volume_1d.tail(VOLUME_INCREASE_LOOKBACK).mean())
        vol_avg20          = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_avg5
        vol_increase_ratio = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 0.0

        if vol_increase_ratio > 1.4:
            score += 6.0; details.append(f"🔥 Hacim Trendi 5G: Artış ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio > 1.1:
            score += 3.5; details.append(f"📈 Hacim Trendi 5G: Erken ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio < 0.8:
            score -= 2.0; details.append(f"📉 Hacim Trendi 5G: Zayıf ({vol_increase_ratio:.2f}x)")
        else:
            score += 0.5; details.append(f"➖ Hacim Trendi 5G: Stabil ({vol_increase_ratio:.2f}x)")

        # CMF puanlama
        if cmf_val >= 0.15:
            score += 4.0;  details.append(f"💰 CMF: Güçlü Birikim ({cmf_val:.3f})")
        elif cmf_val >= 0.08:
            score += 2.5;  details.append(f"📈 CMF: Pozitif Para Akışı ({cmf_val:.3f})")
        elif cmf_val >= 0.02:
            score += 1.0;  details.append(f"🟢 CMF: Zayıf Birikim ({cmf_val:.3f})")
        elif cmf_val >= -0.05 and not (is_squeeze or is_spring):
            score -= 1.5;  details.append(f"⚠️ CMF: Hafif Dağıtım ({cmf_val:.3f})")
        # is_squeeze veya is_spring ise CMF hafif negatif tolere edilir — puan kesilmez
        # MFI aşırı alım cezası: smart_money çağrısından sonra gerçek değerle uygulanıyor (aşağıda)

        # Steady Momentum + HH/HL
        try:
            if len(close_1d) >= 5:
                close_5d = close_1d.tail(5).values
                is_steady_momentum = (
                    all(close_5d[i] >= close_5d[i-1] * 0.99 for i in range(1, 5))
                    and (close_5d[-1] > close_5d[0])
                    and (ret_1d_pct < 5.0)
                )
                if is_steady_momentum:
                    score += 5.0
                    details.append("📈 Steady Momentum: Kademeli Trend (+5p)")
            if len(high_1d) >= 5 and len(low_1d) >= 5:
                hh_hl_valid = (
                    float(high_1d.iloc[-1]) > float(high_1d.iloc[-5])
                    and float(low_1d.iloc[-1]) > float(low_1d.iloc[-5])
                )
                if hh_hl_valid and trend_durumu_1d in ["Full Stack", "Macro Bullish"]:
                    score += 5.0
                    details.append("🔰 HH/HL: Güçlü Trend Devamı (+5p)")
        except Exception:
            pass

        # Smart Money + Rising + Ichimoku + VP
        smart_money = analyze_smart_money_flow(df_1d, ticker, cached_info)
        if smart_money['has_smart_flow']:
            score += smart_money['score'] * 0.7
            details.extend(smart_money['details'])

        rising = detect_rising_stock(df_1d, adx_1d)
        if rising['is_rising']:
            score += rising['score'] * 0.5
            details.extend(rising['details'])

        try:
            if len(df_1d) >= 60:
                df_ichi     = calculate_ichimoku(df_1d)
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

        # MFI — smart_money'den gerçek değeri al, cezayı gerçek değerle uygula
        mfi_val = smart_money.get('mfi', 50.0)

        # V117_v2: MFI aşırı alım cezası — smart_money sonrası gerçek değerle (tek uygulama)
        if mfi_val > 75 and rsi_1d_val > 65:
            score -= 5.0
            details.append(f"🔴 MFI Tükenme: MFI {mfi_val:.1f} + RSI {rsi_1d_val:.1f} — Para akışı + fiyat aşırı alımda")
        elif mfi_val > 80:
            score -= 3.0
            details.append(f"⚠️ MFI Yüksek: {mfi_val:.1f} — Tek başına aşırı alım")

        # Piyasa Rejimi
        market_regime   = MARKET_STATUS.get("regime", "UNKNOWN")
        market_modifier = MARKET_STATUS.get("min_score_modifier", 0.0)
        if market_modifier != 0.0:
            regime_score_effect = -market_modifier * 7.0
            score += regime_score_effect
            details.append(f"⚖️ Piyasa Rejim ({market_regime}): {regime_score_effect:+.1f}p")

        try:
            ema50_10d_ago     = float(ema50_1d.iloc[-10]) if len(ema50_1d) >= 10 else float(ema50_1d.iloc[-1])
            ema50_slope_check = (float(ema50_1d.iloc[-1]) - ema50_10d_ago) / ema50_10d_ago if ema50_10d_ago > 0 else 0.0
        except Exception:
            ema50_slope_check = 0.0

        vol_5d_trend = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 1.0
        if ema50_slope_check > 0 and vol_5d_trend > 1.1:
            score += 2.5; details.append("🟢 Trend-Hacim Senkron")

        if market_regime == "STRONG" and ema50_slope_check > 0:
            score += 2.5; details.append("💎 STRONG Market Hizalama")
        elif market_regime == "BULLISH" and vol_5d_trend >= 0.80:
            score += 1.5; details.append("[OK] Bullish Market Hizalama")
        elif market_regime == "CHOPPY":
            if vol_5d_trend >= 0.75 and ema50_slope_check > 0:
                score += 2.5; details.append("[OK] Choppy'de Sağlam")
            else:
                score -= 2.5; details.append("⚠️ Choppy'de Zayıf")
        elif market_regime == "HIGH_VOLATILITY" and vol_5d_trend < 1.0:
            score -= 4.0; details.append("🚨 Yüksek Vol & Daralan Hacim")

        # TP/SL R/R — 1D bazlı erken eleme
        tp1, tp2, tp3, stop_loss = calculate_profit_target(
            current_price, atr_1d,
            is_exhausted=is_exhausted,
            beta=beta,
            selection_system=selection_system,
            df_1h=None,  # Phase 4'te 1H henüz yüklenmedi; yapısal stop kullanılmaz
            ticker=ticker
        )
        risk              = max(current_price - stop_loss, 0.0)
        reward            = max(tp2 - current_price, 0.0)
        rr_ratio_calc     = (reward / risk) if risk > 0 else 0.0

        profit_expectation_pct = (reward / current_price) * 100 if current_price > 0 else 0.0
        
        # 🎯 BOĞA MODU: Minimum kâr beklentisi %3 → %2
        if profit_expectation_pct < 2.0:
            return None

        # v117.v1: ema_spread_expanding flag'ini output dict'e ekle
        # boga_score_100 ve frontend bu değeri okur
        # (PHASE 8 / FINAL OUTPUT bloğunda "ema_spread_expanding": ema_spread_expanding eklenmeli)

        # =============================================================
        # ══════════════════════════════════════════════════════════════
        # PHASE 4: 1H — GİRİŞ ZAMANLAMA (sadece timing, skor limiti var)
        # 1H toplam puan etkisi: max ±15p — skoru domine EDEMEZ
        # ══════════════════════════════════════════════════════════════
        # V117_v2 DEĞİŞİKLİKLERİ:
        #   1. check_15m_micro_trend çağrısına selection_system geçildi.
        #      squeeze_preview: bb_squeeze + ema_stack + MFI >= 30 + MACD >= -0.1
        #      Bu noktada yeni SQUEEZE bloker koşullarını geçmiş hisseler için
        #      SQUEEZE eşiği (-0.5%) uygulanır, diğerleri için eski -1.0% korunur.
        #   2. h1_score_capped başlangıç değeri tanımlandı (NameError önlemi).
        # =============================================================

        df_1h      = await asyncio.to_thread(get_stock_data, ticker, "1h")
        df_15m_raw = await asyncio.to_thread(get_stock_data, ticker, "15m")

        # V117_v2: squeeze_preview — SQUEEZE bloker koşullarını (MFI + MACD) geçmiş mi?
        # Phase5 henüz çalışmadı ama bb_squeeze + ema_stack + mfi_val + macd_hist_val
        # bu noktada hesaplanmış durumda (Phase3'te). Tutarlı önizleme için kullan.
        squeeze_preview = (
            bb_squeeze
            and ema_stack
            and mfi_val >= 30           # Fix A: MFI bloker eşiği
            and macd_hist_val >= -0.1   # Fix B: MACD bloker eşiği
        )

        result_15m = check_15m_micro_trend(
            df_15m_raw,
            selection_system="SQUEEZE" if squeeze_preview else "UNKNOWN"   # V117_v2
        )
        df_15m = df_15m_raw

        # 🎯 BOĞA MODU: 15m hard reject → uyarı + ceza (eleme yok)
        # Kullanıcı tercihi: 15m son 8 mum düzeltme yapıyorsa sadece uyarı olsun
        if not result_15m['is_valid']:
            # Eleme yerine ceza uygula ve log'a yaz
            score -= 8.0
            details.append(f"⚠️ 15m UYARI (Eleme Yok): {result_15m.get('msg', '15m zayıf')}")
            logging.info(f"⚠️ {ticker}: 15m zayıf mikro trend — eleme yok, -8p ceza uygulandı")
        if result_15m['score_bonus'] != 0:
            score += result_15m['score_bonus']
            details.append(result_15m['msg'])

        h1_summary    = {"Status": "Insufficient Data"}
        rsi_1h        = 50.0
        adx_1h        = 0.0
        atr_pct_1h    = 0.0
        rvol_1h       = 0.0
        rsi_1h_slope  = 0.0
        h1_score_raw  = 0.0
        h1_score_capped = 0.0   # V117_v2: başlangıç değeri tanımlandı (NameError önlemi)

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
                atr_1h        = float(atr_1h_series.iloc[-1])
                atr_pct_1h    = atr_1h / float(close_1h.iloc[-1]) if float(close_1h.iloc[-1]) > 0 else 0.0
            except Exception:
                atr_1h = 0.0
            try:
                vol_ma_1h = volume_1h.rolling(10).mean()
                rvol_1h   = float(volume_1h.iloc[-1]) / float(vol_ma_1h.iloc[-1]) if float(vol_ma_1h.iloc[-1]) > 0 else 0.0
            except Exception:
                rvol_1h = 0.0

            close_now_1h   = float(close_1h.iloc[-1])
            ema20_now_1h   = float(ema20_1h.iloc[-1])
            ema50_now_1h   = float(ema50_1h.iloc[-1])
            ema20_distance = (close_now_1h - ema20_now_1h) / ema20_now_1h if ema20_now_1h > 0 else 0.0

            try:
                prev_close_1d = float(close_1d.iloc[-2]) if len(close_1d) > 1 else close_now_1h
                ret_1d_pct    = (close_now_1h - prev_close_1d) / prev_close_1d
            except Exception:
                ret_1d_pct = 0.0

            # 1D EMA20 senkron kontrolü — V117_v2: %1 → %3 tolerans, eleme → ceza
            ema20_tolerance = last_ema20 * 0.97
            if close_now_1h < ema20_tolerance and not (is_spring or is_squeeze):
                if trend_durumu_1d in ("Full Stack", "Macro Bullish"):
                    score -= 6.0
                    details.append("⚠️ 1H: EMA20 altında ama 1D güçlü (-6p)")
                    logging.info(f"⚠️ {ticker}: 1H EMA20 altı — eleme yok, -6p")
                else:
                    logging.info(f"🚫 {ticker}: 1H fiyat 1D EMA20 kırdı → MTF ihlali")
                    return None

            # Dual-TF RSI düşüş hard block
            try:
                rsi_1h_series = RSIIndicator(close_1h, 14).rsi()
                if len(rsi_1h_series) >= 3:
                    rsi_1h_slope = float(rsi_1h_series.iloc[-1]) - float(rsi_1h_series.iloc[-3])
            except Exception:
                rsi_1h_slope = 0.0

            if rsi_slope_5 < -4 and rsi_1h_slope < -4:
                if is_squeeze or is_spring:
                    dual_tf_penalty = -10.0 if (rsi_slope_5 < -7 and rsi_1h_slope < -7) else -6.0
                    h1_score_raw   += dual_tf_penalty
                    details.append(f"⚠️ DUAL-TF RSI DÜŞÜŞ: 1D({rsi_slope_5:.1f}) + 1H({rsi_1h_slope:.1f}) ({dual_tf_penalty:.0f}p)")
                else:
                    logging.info(f"🚫 {ticker}: Dual-TF RSI düşüş → Elendi")
                    return None
                    
            # ── 1H ZAMANLAMA PUANLARI (max ±15p toplam) ──────────────

            # ADX 1H — trend gücü (max +4p)
            if adx_1h >= 30:
                h1_score_raw += 4.0;  details.append(f"🔥 1H ADX: Çok Güçlü ({adx_1h:.1f})")
            elif adx_1h >= 20:
                h1_score_raw += 2.5;  details.append(f"💪 1H ADX: Güçlü ({adx_1h:.1f})")
            elif adx_1h >= 14:
                h1_score_raw += 1.0;  details.append(f"🟡 1H ADX: Erken ({adx_1h:.1f})")
            else:
                h1_score_raw -= 1.5;  details.append(f"⚠️ 1H ADX: Zayıf ({adx_1h:.1f})")

            # EMA mesafe — FOMO koruması
            if ema20_distance > 0.05:
                h1_score_raw -= 8.0;  details.append(f"🔴 1H: EXTREME FOMO (+{ema20_distance*100:.1f}%)")
            elif ema20_distance > 0.025:
                h1_score_raw -= 3.0;  details.append(f"🟡 1H: Uzama Riski (+{ema20_distance*100:.1f}%)")
            elif close_now_1h > ema50_now_1h:
                h1_score_raw += 2.5;  details.append("🏗️ 1H: EMA50 üstü")
            elif close_now_1h > ema20_now_1h:
                h1_score_raw += 1.0;  details.append("🟡 1H: EMA20 üstü")
            else:
                h1_score_raw -= 1.5;  details.append("⚠️ 1H: EMA altı")

            cond_ema20_slope_1h = calculate_ema_slope(ema20_1h, periods=5)
            if cond_ema20_slope_1h:
                h1_score_raw += 1.0; details.append("📈 1H EMA20: Pozitif Slope")

            # RSI 1H (max +2p)
            if 45 <= rsi_1h <= 72:
                h1_score_raw += 2.0;  details.append(f"🌀 1H RSI: Optimal ({rsi_1h:.1f})")
            elif 72 < rsi_1h <= RSI_1H_MAX:
                h1_score_raw -= 2.0;  details.append(f"⚠️ 1H RSI: Overbought ({rsi_1h:.1f})")
            elif rsi_1h > RSI_1H_MAX:
                h1_score_raw -= 5.0;  details.append(f"🔴 1H RSI: FOMO Peak ({rsi_1h:.1f})")
            elif rsi_1h < 35:
                h1_score_raw -= 5.0;  details.append(f"🔴 1H RSI: Çok Zayıf ({rsi_1h:.1f})")
            elif rsi_1h < 45:
                h1_score_raw -= 2.0;  details.append(f"❄️ 1H RSI: Zayıf Bölge ({rsi_1h:.1f})")

            # RSI 1H slope (max +2p)
            if rsi_1h_slope > 8:
                h1_score_raw += 2.0; details.append(f"📈 1H RSI Slope: Sert yükseliş ({rsi_1h_slope:.1f})")
            elif rsi_1h_slope > 3:
                h1_score_raw += 1.0; details.append(f"↗️ 1H RSI Slope: Yükselişte ({rsi_1h_slope:.1f})")
            elif rsi_1h_slope < -8:
                h1_score_raw -= 3.0; details.append(f"📉 1H RSI Slope: Sert düşüş ({rsi_1h_slope:.1f})")
            elif rsi_1h_slope < -3:
                h1_score_raw -= 1.5; details.append(f"↘️ 1H RSI Slope: Düşüşte ({rsi_1h_slope:.1f})")

            # RVOL 1H (max +3p)
            if rvol_1h >= 2.5:
                h1_score_raw += 3.0; details.append(f"🐳 1H RVOL: Para Girişi ({rvol_1h:.1f}x)")
            elif rvol_1h >= 1.5:
                h1_score_raw += 1.5; details.append(f"📊 1H RVOL: Yüksek ({rvol_1h:.1f}x)")
            elif rvol_1h < 0.7:
                h1_score_raw -= 1.0; details.append(f"❄️ 1H RVOL: Hacimsiz ({rvol_1h:.1f}x)")

            # Pivot Higher-Low
            lows_1h   = low_1h.tail(20)
            pivots_1h = []
            for i in range(2, len(lows_1h) - 2):
                if lows_1h.iloc[i] < lows_1h.iloc[i - 1] and lows_1h.iloc[i] < lows_1h.iloc[i + 1]:
                    pivots_1h.append(float(lows_1h.iloc[i]))
            if len(pivots_1h) >= 2 and pivots_1h[-1] > pivots_1h[-2]:
                h1_score_raw += 1.5; details.append("🔰 1H: Pivot Higher-Low")

            if ATR_MIN_PCT_1H <= atr_pct_1h <= ATR_MAX_PCT_1H:
                h1_score_raw += 1.0

            # ── 1H katkısını ±15p ile sınırla ────────────────────────
            h1_score_capped = max(-15.0, min(15.0, h1_score_raw))
            score += h1_score_capped

            rvol_durumu = (
                "🔥 EXTREMELY INTENSE" if rvol_1h > 3.0 else
                "[OK] High"            if rvol_1h > 1.5 else
                "❄️ Volumeless"        if rvol_1h < 0.7 else
                "Normal"
            )
            h1_summary = {
                "Status":      "Analyzed",
                "Price/EMA":   "Above EMA50" if close_now_1h > ema50_now_1h else "Below EMA50",
                "EMA20 Slope": "Positive" if cond_ema20_slope_1h else "Negative/Flat",
                "RVOL(1H)":    f"{rvol_1h:.1f}x ({rvol_durumu})",
                "RSI(14)":     f"{rsi_1h:.1f}",
                "ADX(14)":     f"{adx_1h:.1f}",
                "ATR%":        f"{atr_pct_1h * 100:.2f}%",
                "Structure":   "Pivot HL" if len(pivots_1h) >= 2 and pivots_1h[-1] > pivots_1h[-2] else "Normal",
                "H1_Score":    f"{h1_score_capped:+.1f}p (ham:{h1_score_raw:+.1f}p)",
            }
        else:
            score -= 1.0
            details.append("⚠️ 1H Veri Yok (-1p)")

        # =============================================================
        # PHASE 5: ENTRY TRIGGER + SİSTEM SEÇİMİ (swing117)
        # =============================================================
        # DEĞİŞİKLİKLER (V117 → V117.v2):
        #   1. AWAKENING: 3 koşul → 7 koşul (haftalık yapı + ADX + RVOL alt sınır)
        #   2. AWAKENING çifte bonus kaldırıldı (raw_score'a bir kez ekleniyor,
        #      boga_score_100'deki +15p ile çakışmayı önlemek için buradaki +15p → +8p)
        #   3. BREAKOUT + TREND_CONT ayrımı korundu, sys_cat'e "TrendContinue" eklendi
        #   4. MOMENTUM default label "Default" olarak yeniden adlandırıldı
        #      (gerçek sinyal olmadığını vurgulamak için)
        #   5. EMA_CROSS için RVOL üst sınırı genişletildi (1.8 → 2.5)
        # =============================================================

        entry_trigger: Optional[str] = None
        selection_system  = "DEFAULT"   # V117: "MOMENTUM" → "DEFAULT" (sinyal yok = default)
        selection_reasons: List[str] = []

        try:
            ema9_series  = EMAIndicator(close_1d, 9).ema_indicator()
            ema9_now     = float(ema9_series.iloc[-1])
            ema9_prev    = float(ema9_series.iloc[-2])
            ema20_now    = float(ema20_1d.iloc[-1])
            ema20_prev   = float(ema20_1d.iloc[-2])
            ema50_now_1d = float(ema50_1d.iloc[-1])
        except Exception:
            ema9_now = ema9_prev = ema20_now = ema20_prev = ema50_now_1d = 0.0

        ema_cross    = ema9_now > ema20_now and ema9_prev <= ema20_prev
        ema_stack    = ema9_now > ema20_now > ema50_now_1d
        bb_squeeze   = bb_width_1d < 0.05
        ema9_slope   = (ema9_now - ema9_prev) / ema9_prev if ema9_prev > 0 else 0.0
        micro_volume = rvol_today > 1.2

        # ── SWING117 OPTİMİZASYONU: AWAKENING SİSTEMİ KALICI OLARAK KAPATILDI ──
        # 94 trade analizinde: AWAKENING %20 WR altında kalarak ciddi bir sermaye erimesine sebep olmuştur.
        # Stratejik karar doğrultusunda sistem esnetilmeye veya sıkılaştırılmaya çalışılmadan tamamen devre dışı bırakılmıştır.
        ema_mixed_block = not ema_stack
        is_early_awakening = False

        # ── SİSTEM SEÇİM HİYERARŞİSİ ─────────────────────────────────
        # Öncelik sırası (yukarıdan aşağıya):
        #   SPRING → SQUEEZE (bb+ema) → SQUEEZE (ema9+slope) → AWAKENING →
        #   EMA_CROSS → BREAKOUT → TREND_CONT → PULLBACK → DEFAULT

        if is_spring:
            selection_system = "SPRING"
            selection_reasons.append("Failed_Breakdown")

        if bb_squeeze and ema_stack:
            # ── V117_v2: SQUEEZE Kalite Kontrolleri (MFI + MACD hard bloker) ──
            # MDU vakası: MFI=26.3 + MACD=-0.09 → kurumsal dağıtım içinde sıkışma
            # görünümlü hisse. Gerçek squeeze = hacimsizlik + sıkışma, dağıtım değil.
            # MACD burada kontrol edilmeli — Phase3'te selection_system henüz "UNKNOWN"
            # olduğundan MACD korelasyon cezası yanlış dala (-1p) düşüyordu.

            squeeze_blocked = False

            if mfi_val < 30:
                # Para aktif olarak çıkıyor — BB sıkışması = dağıtım, breakout değil
                details.append(
                    f"⛔ SQUEEZE İPTAL: MFI={mfi_val:.1f} < 30 — "
                    f"Kurumsal dağıtım sinyali, sıkışma geçersiz"
                )
                score -= 4.0
                squeeze_blocked = True

            elif macd_hist_val < -0.1:
                # Trend momentumu yok — negatif MACD + squeeze = sahte kırılım riski
                details.append(
                    f"⛔ SQUEEZE İPTAL: MACD_hist={macd_hist_val:.3f} < -0.1 — "
                    f"Momentum onayı yok, kırılım beklenemez"
                )
                score -= 3.0
                squeeze_blocked = True

            if not squeeze_blocked:
                vol_avg_3d = float(volume_1d.tail(3).mean())
                if vol_avg_3d < (vol_avg20 * 1.30):
                    entry_trigger = "Pre-breakout (Low Vol Squeeze)"
                    score        += 18.0
                else:
                    entry_trigger = "BB Squeeze + EMA Stack + Volume"
                    score        += 22.0
                selection_system = "SQUEEZE"
                selection_reasons.extend(["BB_Squeeze", "EMA_Stack", "Volume_Confirm"])
                details.append("💥 ENTRY: DAY 0 SQUEEZE BREAKOUT")

        elif bb_squeeze and not ema_stack:
            # V117_v2: MIXED EMA + BB Squeeze → sinyal engeli (BGC:%MIXED -3.57% LOSS)
            details.append("⛔ V117_v2: BB Squeeze ama EMA Stack MIXED/BELOW → SQUEEZE reddedildi")
            

        elif is_early_awakening:
            # V117: +15p → +8p (boga_score_100'deki +15p ile çifte bonusu önler)
            # Toplam etki (raw + boga_score_100): V117'de +30p, v117.v1'de +23p
            score           += 8.0
            entry_trigger    = "Early Awakening (Stealth Breakout)"
            selection_system = "AWAKENING"
            selection_reasons.extend(["Stealth_Breakout", "RSI_Sweet_Spot"])
            details.append("🌅 ENTRY: EARLY AWAKENING (W117 koşulları sıkılaştırıldı)")

        elif ema_cross and 1.1 <= rvol_today <= 2.5:
            # V117: RVOL üst sınır 1.8 → 2.5 (güçlü cross'ları dışlamıyoruz)
            score           += 8.0
            entry_trigger    = "EMA9/20 Crossover + Micro Volume"
            selection_system = "EMA_CROSS"
            selection_reasons.extend(["EMA9_20_Cross", "Micro_Volume"])
            details.append("🎯 ENTRY: EMA9/20 Fresh Cross")

        elif ema9_slope > 0.003 and bb_squeeze and micro_volume:
            score           += 12.0
            entry_trigger    = "EMA9 Slope + Squeeze + Micro Volume"
            selection_system = "SQUEEZE"
            selection_reasons.extend(["EMA9_Slope", "BB_Squeeze", "Micro_Volume"])
            details.append("⚡ ENTRY: EMA9 Dynamic Squeeze Break")

        elif ema20_now > ema50_now_1d and close_change_pct > 0.006 and rvol_today > 0.9:
            entry_trigger    = "Trend Continuation"
            selection_system = "BREAKOUT"
            selection_reasons.append("Trend_Continuation")
            details.append("📈 ENTRY: Trend Devamı")

        elif is_steady_momentum:
            score           += 3.0
            entry_trigger    = "Steady Momentum"
            selection_system = "TREND_CONT"
            selection_reasons.extend(["Steady_Momentum", "Healthy_Trend"])
            details.append("📈 ENTRY: Steady Momentum")

        elif rising.get('is_rising') and rising.get('pattern') in ['Pullback Reversal', 'Base Breakout']:
            score           += 5.0
            entry_trigger    = f"Rising: {rising['pattern']}"
            selection_system = "PULLBACK"
            selection_reasons.append("Rising_Pullback")
            selection_reasons.append(rising.get('pattern', '').replace(' ', '_'))
            details.append(f"📈 ENTRY: {rising['pattern']}")

        else:
            score -= 1.0
            selection_system = "DEFAULT"
            details.append("⏳ ENTRY: Tetik yok — DEFAULT sinyal")

        # ── V117.v2: SİSTEM KATEGORİSİ — BREAKOUT / TREND_CONT AYRIMI ──
        # V117'de her ikisi de "Breakout" sys_cat'e düşüyordu.
        # v117.v1'de "TrendContinue" ayrı bir kategori — performans takibi için kritik.
        # "Default" da ayrı etiket alıyor: sinyal olmadan seçilen hisseler izlenecek.
        sys_cat = (
            "Contraction"    if selection_system == "SQUEEZE"                          else
            "Reversal"       if selection_system in ("SPRING", "PULLBACK")              else
            "Momentum"       if selection_system in ("AWAKENING", "EMA_CROSS")          else
            "TrendContinue"  if selection_system == "TREND_CONT"                        else
            "Breakout"       if selection_system == "BREAKOUT"                          else
            "Default"        if selection_system in ("DEFAULT", "MOMENTUM")             else
            "Unknown"        # Olası bir string uyuşmazlığı için emniyet subabı
        )

        # ── V117.v2: DEFAULT SİNYAL UYARISI ─────────────────────────────
        # Eğer sistem DEFAULT kaldıysa (hiçbir tetik bulunamadı),
        # boga_score_100'deki "MOMENTUM" dalı artık 0p alacak.
        # NOT: boga_score_100 fonksiyonunda şu değişiklik gerekiyor:
        #   elif sys_name == "MOMENTUM": score += 6.0
        #   → elif sys_name == "DEFAULT": score += 0.0  (puan verme)
        #   → elif sys_name == "MOMENTUM": score += 6.0  (etiketi koru ama v117.v1'de tetiklenmez)
        if selection_system in ("DEFAULT", "MOMENTUM") and "DEFAULT" in sys_cat:
            details.append("⚠️ v117.v1 UYARI: Sistem tetikleyici yok. Sadece altyapı puanıyla geçti.")
            
        # =============================================================
        # PHASE 6: VIX & SEKTÖR ADAPTASYONU
        # =============================================================
        current_vix = MARKET_STATUS.get("vix", 20.0)

        # v117.v2: Sektör yeniden — 94 trade analizi sonucu
        # Consumer Cyclical %80 WR → +5p | Technology %30 WR → 0p | Energy %0 WR → -3p | Healthcare %14 WR → -3p
        if sector_name == "Consumer Cyclical":
            score += 5.0
            details.append(f"🏆 v117.v2 Sektör Lideri: {sector_name} (%80 WR, +5p)")
        elif sector_name in ["Basic Materials", "Financial Services", "Communication Services"]:
            score += 3.0
            details.append(f"💎 Güvenilir Sektör Primi: {sector_name} (+3p)")
        elif sector_name == "Industrials":
            score += 2.0
            details.append(f"⚙️ Sektör Primi: {sector_name} (+2p)")
        elif sector_name == "Consumer Defensive":
            score += 2.5
            details.append(f"🛡️ Defansif Sektör Primi: {sector_name} (+2.5p)")
        elif sector_name == "Technology":
            sec_perf_tech = SECTOR_PERFORMANCE.get("Technology", 0.0)
            if sec_perf_tech > 1.0:
                score += 3.0
                details.append(f"📈 Technology: HOT ({sec_perf_tech:.1f}%, +3p)")
            else:
                score += 0.0
                details.append(f"➖ Technology: Nötr")
        elif sector_name == "Healthcare":
            sec_perf_hc = SECTOR_PERFORMANCE.get("Healthcare", 0.0)
            if sec_perf_hc > 2.0:
                score += 0.0  # ceza yok ama bonus da yok
                details.append(f"➖ Healthcare: HOT ama statik ceza kaldırıldı")
            else:
                score -= 3.0
                details.append(f"🚨 Healthcare: Soğuk ({sec_perf_hc:.1f}%, -3p)")
        elif sector_name == "Energy":
            sec_perf_en = SECTOR_PERFORMANCE.get("Energy", 0.0)
            if sec_perf_en > 2.0:
                score += 0.0
                details.append(f"➖ Energy: HOT ama statik ceza kaldırıldı")
            else:
                score -= 3.0
                details.append(f"🚨 Energy: Soğuk ({sec_perf_en:.1f}%, -3p)")
        

        if current_vix >= 25.0 and sector_name in ["Industrials", "Financial Services", "Consumer Cyclical"]:
            score -= 10.0
            details.append(f"⚠️ VIX {current_vix:.1f}: {sector_name} SL Riski (-10p)")

        if current_vix >= 25.0:
            if sys_cat in ("Breakout", "Momentum"):
                score -= 12.0; details.append(f"🚨 VIX {current_vix:.1f}: Breakout Tuzağı")
            elif sys_cat == "Reversal":
                score += 6.0;  details.append(f"🛡️ VIX {current_vix:.1f}: Reversal Ortamı")
        elif current_vix >= 20.0:
            if sys_cat in ("Breakout", "Momentum"):
                score -= 4.0; details.append(f"⚠️ VIX {current_vix:.1f}: Breakout Gergin")
        elif current_vix <= 15.0:
            if sys_cat in ("Breakout", "Momentum", "Contraction"):
                score += 6.0; details.append(f"🚀 VIX {current_vix:.1f}: Trend İdeal")
            elif sys_cat == "Reversal":
                score -= 4.0; details.append(f"🐢 VIX {current_vix:.1f}: Reversal Zayıf")

        if smart_money.get('has_smart_flow') and smart_money.get('score', 0) >= 6.0:
            selection_reasons.append("Smart_Money_Flow")
        if is_squeeze and selection_system != "SQUEEZE":
            selection_reasons.append("BB_Squeeze_Secondary")
        if not selection_reasons:
            selection_reasons = ["Momentum_Filter"]

        # =============================================================
        # PHASE 7: R/R FİNAL HARD GATE + SLOW SECTOR
        # =============================================================
        # 🎯 BOĞA MODU: R/R minimum 1.0 (kullanıcı tercihi: RR 1 ve üzeri yeterli)
        required_rr = 1.0
        if rr_ratio_calc < required_rr:
            logging.info(f"🚫 {ticker}: R/R yetersiz ({rr_ratio_calc:.2f} < {required_rr})")
            return None

        sector_penalty = SLOW_PEAK_SECTORS.get(sector_name, 0.0)
        sec_perf_val   = SECTOR_PERFORMANCE.get(sector_name, 0.0)
        if sector_penalty < 0:
            if sec_perf_val > 1.0:
                details.append(f"🔥 Yavaş Sektör ama HOT: {sector_name} (Ceza İptal)")
            else:
                score += sector_penalty
                details.append(f"🐢 Yavaş Peak Sektör: {sector_name} ({sector_penalty:.1f}p)")

        # =============================================================
        # PHASE 8: PERFORMANS + ÖZET — v117.v2
        # =============================================================
        # DEĞİŞİKLİKLER (V117 → v117.v2):
        #   1. ema_spread_expanding → output dict'e eklendi (boga_score_100 + frontend okur)
        #   2. adx_slope → output dict'e eklendi (kriter sayfası için)
        #   3. rsi_slope_5 → output dict'e eklendi (momentum yönü için)
        #   4. macd_hist_prev → output dict'e eklendi (MACD yön takibi)
        #   5. is_reversal_proxy → output dict'e eklendi (MACD sistem uyumu için)
        #   6. mfi_val → zaten vardı, korundu
        #   7. sys_cat → "TrendContinue" ve "Default" yeni değerleri içeriyor
        #   8. log satırı V117.2 → v117.v2 olarak güncellendi
        #   9. d1_summary'e EMA Spread Expanding + ADX Slope eklendi
        # =============================================================

        try:
            ret_5g_pct = float(
                (close_1d.iloc[-1] - close_1d.iloc[-6]) / close_1d.iloc[-6] * 100
            ) if len(close_1d) >= 6 else 0.0
        except Exception:
            ret_5g_pct = 0.0

        dollar_volume_val  = current_price * avg_volume_10d
        hold_days          = estimate_hold_time(
            score, vol_increase_ratio, profit_expectation_pct, atr_pct_1d * 100, is_exhausted
        )
        volume_regime_str  = (
            "Expansion" if vol_increase_ratio > 1.4 else
            "Early"     if vol_increase_ratio > 1.1 else
            "Flat"
        )

        details.append(
            f"💰 TP1/TP2/SL: ${tp1:.2f} / ${tp2:.2f} / ${stop_loss:.2f} (R/R: {rr_ratio_calc:.2f})"
        )

        # v117.v2: EMA spread dinamiği d1_summary'e eklendi
        d1_summary = {
            "Trend Status":          trend_durumu_1d,
            "EMA Spread Expanding":  str(ema_spread_expanding),   # v117.v2 YENİ
            "EMA20 Slope":           "Positive" if cond_ema20_slope_positive else "Negative/Flat",
            "RSI(14)":               f"{rsi_1d_val:.1f}",
            "RSI Slope(5d)":         f"{rsi_slope_5:+.1f}",        # v117.v2 YENİ
            "ADX":                   f"{adx_1d:.1f}",
            "ADX Slope":             f"{adx_slope:+.2f}",          # v117.v2 YENİ
            "ATR%":                  f"{atr_pct_1d * 100:.2f}%",
            "BB Width":              f"{bb_width_1d * 100:.1f}%",
            "MACD_Hist":             f"{macd_hist_val:.3f}",
            "MFI":                   f"{mfi_val:.1f}",             # v117.v2 YENİ
        }

        exhaust_tag = " [EXHAUSTED]" if is_exhausted else ""
        spread_tag  = " [SPREAD↑]" if ema_spread_expanding else " [SPREAD↓]"   # v117.v2
        logging.info(
            f"[OK] {ticker}: v117.v2 Skor:{score:.2f}{exhaust_tag}{spread_tag} | "
            f"1W RSI:{w_rsi_val:.1f} Vol:{w_vol_ratio:.1f}x | "
            f"1D {trend_durumu_1d} ADX:{adx_1d:.1f} | "
            f"Sys:{selection_system}({sys_cat}) | "
            f"1H:{h1_score_capped if df_1h is not None and len(df_1h) >= 10 else 0:+.1f}p"
        )

        # =============================================================
        # FINAL OUTPUT
        # =============================================================
        return {
            # ── Kimlik ───────────────────────────────────────────────
            "ticker":                   ticker,

            # ── Puanlama ─────────────────────────────────────────────
            "score":                    round(score, 2),

            # ── Sistem / Sinyal ──────────────────────────────────────
            "selection_system":         selection_system,       # v117.v2: "DEFAULT" yeni değer
            "selection_reasons":        selection_reasons,
            "system_category":          sys_cat,                # v117.v2: "TrendContinue" / "Default" yeni değerler
            "entry_trigger":            entry_trigger or "None Yet",

            # ── Ham Veri (Hesaplama için — JSON'a yazılmaz) ───────────
            "df_1d":                    df_1d,
            "df_1h":                    df_1h,
            "df_15m":                   df_15m,

            # ── Fiyat / İşlem ────────────────────────────────────────
            "current_price":            current_price,
            "entry_price":              current_price,
            "tp1":                      round(tp1, 2),
            "tp2":                      round(tp2, 2),
            "tp3":                      round(tp3, 2),
            "stop_loss":                round(stop_loss, 2),
            "rr_ratio":                 round(rr_ratio_calc, 2),
            "profit_expectation_pct":   round(profit_expectation_pct, 2),
            "hold_days":                hold_days,

            # ── Temel Bilgiler ────────────────────────────────────────
            "sector":                   sector_name,
            "market_cap":               market_cap,
            "avg_volume":               avg_volume_10d,
            "beta":                     beta,
            "short_float":              short_float,
            "dollar_volume":            dollar_volume_val,

            # ── Trend / EMA ──────────────────────────────────────────
            "trend_status_1d":          trend_durumu_1d,
            "above_1w_ema50":           is_above_1w_ema50,
            "ema20":                    round(last_ema20, 2),
            "ema50":                    round(last_ema50, 2),
            "ema200":                   round(last_ema200, 2),
            "ema_spread_expanding":     ema_spread_expanding,   # v117.v2 YENİ — boga_score_100 okur

            # ── Teknik Göstergeler ───────────────────────────────────
            "rsi_14":                   round(rsi_1d_val, 1),
            "rsi_slope_5":              round(rsi_slope_5, 1),  # v117.v2 YENİ
            "rsi_1h":                   round(rsi_1h, 1),
            "adx":                      round(adx_1d, 1),
            "adx_slope":                round(adx_slope, 3),    # v117.v2 YENİ
            "adx_1h":                   round(adx_1h, 1),
            "atr_pct":                  round(atr_pct_1d * 100, 2),
            "macd_hist":                round(macd_hist_val, 3),
            "macd_hist_prev":           round(macd_hist_prev, 3),   # v117.v2 YENİ — MACD yön takibi
            "mfi":                      round(mfi_val, 1),
            "cmf":                      round(cmf_val, 4),
            "relative_strength":        rs_label,
            "sector_perf":              sec_perf,

            # ── Hacim ────────────────────────────────────────────────
            "rvol_today":               round(rvol_today, 2),
            "rvol_5_30":                round(rvol_micro, 3),
            "volume_regime":            volume_regime_str,

            # ── Performans / Getiri ──────────────────────────────────
            "ret_1d_pct":               round(ret_1d_pct, 2),
            "ret_5g_pct":               round(ret_5g_pct, 2),

            # ── Durum Bayrakları ─────────────────────────────────────
            "is_exhausted":             is_exhausted,
            "green_candles_10d":        green_candles,
            "squeeze_quality":          round(squeeze_quality, 3) if is_squeeze else 0.0,
            "is_reversal_proxy":        is_reversal_proxy if 'is_reversal_proxy' in dir() else False,  # v117.v2 YENİ

            # ── Haftalık Yapı ────────────────────────────────────────
            "w_rsi_val":                round(w_rsi_val, 1),
            "w_rsi_slope":              round(w_rsi_slope, 1),
            "w_vol_ratio":              round(w_vol_ratio, 2),

            # ── Özet Bloklar ─────────────────────────────────────────
            "d1_summary":               d1_summary,
            "h1_summary":               h1_summary,
            "meta":                     {
                "1d":            d1_summary,
                "1h":            h1_summary,
                "volume_regime": volume_regime_str,
                "version":       "v117.v2.0",                 # v117.v2: post-backtest optimizasyon
            },

            # ── Detay / Debug ────────────────────────────────────────
            "details":                  details,
            "smart_money":              smart_money,
            "rising_data":              rising,

            # ── Dış Veri (Şu an pasif) ───────────────────────────────
            "insider_data":             {'has_insider': False, 'score': 0.0, 'details': []},
            "financial_health":         financial_health_data,
            "catalyst_data":            {'has_catalyst': False, 'score': 0.0, 'reasons': []},
            "opt_sentiment":            {},

            # ── Legacy / Composite Skorlar (Sıfır — compute_multi_factor_score günceller) ──
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
    if "Full Stack" in trend_durumu: trend_score = min(trend_score + 5.0, 12.0) # En yüksek katman ağırlığı
    elif "Macro" in trend_durumu: trend_score = min(trend_score + 4.0, 12.0)

    ret_5g = c.get("ret_5g_pct", 0.0)
    ret_accel = 12.0 if ret_5g >= 8.0 else 8.0 if ret_5g >= 5.0 else 6.0 if ret_5g >= 3.0 else 4.0 if ret_5g >= 1.5 else 2.0 if ret_5g > 0 else 0.0

    adx_norm = min(adx_val / 40.0 * 12.0, 12.0)

    dollar_vol = c.get("dollar_volume", 0.0) or 0.0
    dv_norm = 12.0 if dollar_vol >= 50e6 else 8.0 if dollar_vol >= 20e6 else 6.0 if dollar_vol >= 10e6 else 4.0 if dollar_vol >= 5e6 else 2.0

    atr_str = str(d1.get("ATR%", "3%")).replace("%", "")
    try: atr_pct = float(atr_str)
    except Exception: atr_pct = 3.0
    vol_expand = 12.0 if 4.0 <= atr_pct <= 8.0 else 8.0 if (3.0 <= atr_pct < 4.0 or 8.0 < atr_pct <= 10.0) else 4.0 if atr_pct < 3.0 else 2.0

# BOGA AI FIX: Sabit ve sıkı hacim kuralına geri dönüş (Hacimsiz fakeout hisseler elenir)
    rvol_weight = 0.30  # V117'te düşürülmüştü, veri teyidiyle momentum yakalamak için 0.30'da dengelendi
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
    # buradaki mükerrer (çifte) çarpımsal ceza silindi.

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
    🎯 BOGA AI FINAL SCORE (0-100) — v117.v1 UNIFIED SYSTEM
    ================================================================
    DEĞİŞİKLİKLER (V117 → v117.v1):

    [A] TREND & MOMENTUM (25p):
        - ADX puanlaması düzeltildi: 18-28 paradoksu giderildi.
          V117: ADX 18-28 → +5p, ADX 30-40 → +3p  (ters!)
          v117.v1: ADX 28-40 → +6p, ADX 18-28 → +4p, ADX 40+ → +2p (tavan)
        - EMA Full Stack: spread dinamiği (genişliyor/daralıyor) eklendi.
          Statik Full Stack → daralan spread ise ceza (-1p fark).

    [B] SYSTEM SIGNAL (20p):
        - AWAKENING: +15p → +8p (Phase5'te +8p raw bonus ile çifte sayım önlendi)
        - DEFAULT (yeni): +0p (tetikleyicisiz hisse = sinyal puanı yok)
        - BREAKOUT ve TREND_CONT puanları korundu.

    [C] VOLUME & FLOW (15p):
        - MFI > 75 cezası eklendi (V117'de tamamen eksikti).
          RSI > 65 + MFI > 75 = tükenme kombinasyonu → -8p
          Tek başına MFI > 80 → -5p
        - MACD + sistem tipi korelasyon cezası eklendi:
          Trend devam sistemi (BREAKOUT/TREND_CONT/DEFAULT) + negatif MACD → ekstra -2.5p
          Reversal sistemi (SPRING/PULLBACK) + negatif MACD → hafif bonus (+1p)

    [D-G]: Değişmedi.
    ================================================================
    Bölüm ağırlıkları (hedef):
      A: Trend & Momentum      → Max 25p
      B: System Signal         → Max 20p
      C: Volume & Flow         → Max 15p
      D: Rel. Strength/Sector  → Max 10p
      E: Risk/Reward           → Max 15p
      F: Fundamentals          → Max 10p
      G: Catalysts/Insider     → Max  5p
                                 ────────
                                 Toplam 100p
    ================================================================
    """
    score = 0.0
    details = c.get("details", [])

    # Sık kullanılan değerleri bir kez çek
    rsi        = c.get("rsi_14",        50.0)
    adx        = c.get("adx",            0.0)
    macd_h     = c.get("macd_hist",      0.0)
    mfi        = c.get("mfi",           50.0)
    rvol       = c.get("rvol_today",     1.0)
    trend_stat = c.get("trend_status_1d",  "")
    sys_name   = c.get("selection_system", "DEFAULT")
    rs_label   = c.get("relative_strength", "N/A")
    sector     = c.get("sector",        "Unknown")

    # ── A. TREND & MOMENTUM (Max 25p) ─────────────────────────────────────────

    # 1W EMA50 üstü (+5p)
    if c.get("above_1w_ema50", True):
        score += 5.0

    # RSI seviyesi (Max +5p)
    if RSI_BOGA_OPT_MIN <= rsi <= RSI_BOGA_OPT_MAX:    # 45-65 sweet spot
        score += 5.0
    elif 40 <= rsi < RSI_BOGA_OPT_MIN or RSI_BOGA_OPT_MAX < rsi <= 72:
        score += 3.0
    # RSI > 72 veya < 40 → puan yok (zaten Phase5 cezası aldı)

    # ADX — v117.v1 DÜZELTMESİ: Doğrusal ödüllendirme (V117 paradoksu giderildi)
    # Rapor: ADX ≥ 35 → ~%60 win rate. V117'de bu grup +3p alıyordu, şimdi +6p.
    if adx >= 40:
        score += 2.0    # Tükenme eşiği — puan kısıtlı ama sıfır değil
    elif adx >= 35:
        score += 6.0    # Güçlü kurulu trend — raporda en iyi win rate grubu
    elif adx >= 28:
        score += 5.0    # İyi trend
    elif adx >= 20:
        score += 4.0    # Orta-güçlü (eski "optimal uyanış" eşiği)
    elif adx >= 15:
        score += 1.0    # Zayıf trend
    # adx < 15 → puan yok

    # MACD histogram (Max +5p) — temel puan; sistem korelasyonu C bölümünde
    if macd_h > 2.0:
        # v117.v2: Geç giriş uyarısı — TWLO(1.49→-5.62%), AMAT, THC vakası
        score += 2.0  # Pozitif ama indirimli; aşırı yükseliş = geç kalınmış
        details.append(f"⚠️ v117.v2 MACD Aşırı ({macd_h:.2f}): Geç giriş riski (+2p, indirimli)")
    elif macd_h > 0.05:
        score += 5.0
    elif macd_h > 0:
        score += 3.0
    # Negatif MACD: temel ceza yok burada — C bölümünde sistem tipiyle birlikte değerlendiriliyor

    # EMA Trend Durumu (Max +5p) — v117.v1: spread dinamiği eklendi
    if "Full Stack" in trend_stat:
        ema_spread_expanding = c.get("ema_spread_expanding", True)   # Phase5'te hesaplanıp dict'e eklenmeli
        if ema_spread_expanding:
            score += 5.0    # Full Stack + genişleyen spread = güçlenen trend
        else:
            score += 4.0    # Full Stack ama daralan spread = dönüm noktası riski
    elif "Macro" in trend_stat:
        score += 5.0
    elif "Above EMA200" in trend_stat:
        score += 2.0
    # "Above EMA50" veya "Downtrend" → puan yok

    # ── B. SYSTEM SIGNAL (Max 20p) ────────────────────────────────────────────
    # v117.v1 DEĞİŞİKLİKLERİ:
    #   AWAKENING: +15p → +8p  (Phase5 raw_score'da artık +8p; toplam V117: +30p, v117.v1: +16p)
    #   DEFAULT:   +0p          (tetikleyicisiz hisse, sinyal puanı yok)
    #   Diğerleri: değişmedi

    if sys_name == "SQUEEZE":
        sq_quality = c.get("squeeze_quality", 0.5)
        score += 12.0 + (8.0 * sq_quality)     # Kaliteye göre 12-20p arası
    elif sys_name == "SPRING":
        score += 18.0
    elif sys_name == "AWAKENING":
        score += 8.0                            # v117.v1: 15 → 8 (Phase5 +8p ile çifte sayım önlendi)
    elif sys_name == "TREND_CONT":
        score += 14.0
    elif sys_name == "EMA_CROSS":
        score += 12.0
    elif sys_name == "PULLBACK":
        score += 10.0
    elif sys_name == "BREAKOUT":
        score += 8.0
    elif sys_name == "MOMENTUM":
        score += 6.0                            # Eski etiket — v117.v1'de Phase5 artık bunu üretmiyor
    elif sys_name == "DEFAULT":
        score += 0.0                            # v117.v1 YENİ: tetikleyici yok = sinyal puanı yok
    # else: bilinmeyen → 0p

    # ── C. VOLUME & FLOW (Max 15p) ────────────────────────────────────────────

    # RVOL (Max 10p)
    # v117.v2: BREAKOUT/EMA_CROSS/TREND_CONT'ta orta band (0.6-1.4) en yüksek kayıp grubu (%37 WR)
    if rvol >= 2.0:
        score += 10.0
    elif rvol >= 1.5:
        score += 7.0
    elif rvol >= 1.2:
        score += 4.0
    elif 0.6 <= rvol < 0.9 and sys_name in ("BREAKOUT", "EMA_CROSS", "TREND_CONT", "MOMENTUM"):
        score -= 2.0  # Sadece gerçekten düşük bant ceza alır, 0.9-1.2 nötr kalır
        details.append(f"⚠️ v117.v2 RVOL Orta Band: {rvol:.2f} — {sys_name} için belirsizlik bölgesi (-2p)")
    # rvol < 0.6 (dry-up) ve SQUEEZE için puan yok ama ceza da yok

    # MFI — v117.v1 DEĞİŞİKLİĞİ: Aşırı alım cezası eklendi
    # Rapor: MFI > 75 + RSI > 65 kombinasyonu LOSS tahmin edicisi (DTM, TWLO vakaları)
    if mfi > 75 and rsi > 65:
        score -= 8.0    # v117.v1 YENİ: Tükenme kombinasyonu — para akışı + fiyat aşırı alımda
    elif mfi > 80:
        score -= 5.0    # v117.v1 YENİ: MFI tek başına aşırı (RSI'dan bağımsız)
    elif 55 <= mfi <= 75:
        score += 5.0    # Sağlıklı para akışı
    elif 45 <= mfi < 55:
        score += 3.0    # Nötr-pozitif
    elif mfi < 35:
        score -= 3.0    # Para çıkışı (V117'de yoktu)
    # 35-45 arası → puan yok (nötr)

    # MACD + Sistem Tipi Korelasyonu — v117.v1 YENİ
    # Rapor: Trend devam sisteminde negatif MACD = uyumsuzluk (kayıp tahmin edicisi)
    #        Reversal sisteminde negatif MACD = normal (dip dönüş için beklenen)
    if macd_h < 0:
        trend_continuation_systems = {"BREAKOUT", "TREND_CONT", "DEFAULT", "MOMENTUM"}
        reversal_systems           = {"SPRING", "PULLBACK"}

        if sys_name in trend_continuation_systems:
            score -= 2.5    # v117.v1 YENİ: Trend devam + negatif MACD = sinyal uyumsuzluğu
        elif sys_name in reversal_systems:
            score += 1.0    # Reversal'da negatif MACD = dip dönüş için beklenen, hafif bonus
        else:
            score -= 1.5    # AWAKENING, EMA_CROSS, SQUEEZE için mevcut V117 cezası

    # ── D. RELATIVE STRENGTH & SECTOR (Max 10p) ───────────────────────────────
    # Değişmedi

    sec_perf = c.get("sector_perf", 0.0)
    if sec_perf > 2.0:
        score += 5.0
    elif sec_perf > 0.0:
        score += 3.0

    if "Strong" in rs_label:
        score += 5.0
    elif "Mild" in rs_label:
        score += 3.0

    # ── E. RISK / REWARD (Max 15p) ────────────────────────────────────────────
    # Değişmedi

    rr = c.get("boga_rr", c.get("rr_ratio", 0.0))
    if rr >= 3.0:
        score += 15.0
    elif rr >= 2.5:
        score += 12.0
    elif rr >= 2.0:
        score += 8.0
    elif rr >= 1.5:
        score += 4.0

    # =============================================================
    # ── SİSTEM BAZLI AMORTİSMAN / ÖDÜLLENDİRME (v117.v1) ─────────
    # =============================================================
    sys_name = c.get("selection_system", "UNKNOWN")

    if sys_name == "DEFAULT":
        score += 0.0      # v117.v1 GÜNCELLEMESİ: Tetikleyici yoksa sistemsel bonus verilmez (0p)
        details.append("⏱️ SYSTEM: Default Yapı (Sistem bonusu uygulanmadı: +0p)")
    elif sys_name == "MOMENTUM":
        score += 6.0      # Etiket korundu ancak v117.v1'de tetiklenmezse buraya düşmez
        details.append("⚡ SYSTEM: Momentum Sinyali (+6p)")
    # Not: Diğer sistemleriniz (SQUEEZE, SPRING vb.) mevcut yapınıza göre burada devam edebilir.

    # =============================================================
    # ── MFI / RSI AŞIRI ALIM UYUMSUZLUK CEZASI (Rapor Doğrulamalı) ──
    # =============================================================
    # Phase 3'teki -5p erken uyarı cezasını tamamlayan, nihai boga_score_100 filtresi
    mfi_val = c.get("mfi",    50.0)   # output dict'te "mfi" var
    rsi_val = c.get("rsi_14", 50.0)   # output dict'te "rsi_14" var
    
    if mfi_val > 75 and rsi_val > 65:
        score -= 3.0      # Toplam cezayı -8p'ye tamamlamak için buraya net -3p ekliyoruz (Çifte sayım engellendi)
        details.append("🔴 L3 CEZA: RSI 65+ ve MFI 75+ Likidite Şişmesi Kombinasyonu (-3p)")

    # =============================================================
    # ── G. LAYER 3: INSIDER, OPTIONS, CATALYSTS (Max 5p) ─────────
    # =============================================================
    l3_pts = 0.0
    if c.get("ifi", 0.0) > 0: 
        l3_pts += 2.0
    if c.get("pfi", 0.0) > 0: 
        l3_pts += 1.5
    if c.get("opt_sentiment", {}).get("bullish"): 
        l3_pts += 1.5
        
    score += min(l3_pts, 5.0)

    # =============================================================
    # ── PENALTIES (Multiplicative - Çarpımsal Cezalar) ───────────
    # =============================================================
    if c.get("is_exhausted"):
        score *= 0.70  # En ağır ceza önce: aşırı yorgun hisse (-30%)
        details.append("🔴 MULTI-CEZA: Hisse Aşırı Yorgun (Exhausted) Modunda (*0.70)")
        
    if not c.get("above_1w_ema50", True):
        score *= 0.85  # Haftalık trend karşıtı: -15%
        details.append("🔴 MULTI-CEZA: Haftalık Trend 1W EMA50 Altında (*0.85)")
        
    if MARKET_STATUS.get("regime") == "WEAK":
        score *= 0.80  # Zayıf piyasada her şey söner: -20%
        details.append("🔴 MULTI-CEZA: MARKET STATUS WEAK (*0.80)")
        
    # Tüm hesaplamalar, Layer 3 ve cezalar bittikten sonra TEK BİR return ile temiz çıktı verilir.
    return round(min(max(score, 0.0), 100.0), 1)

# ================================================================
# ================================================================
# SECTION 11: DIVERSIFIED SELECTION
# ================================================================
# ================================================================
from scipy.stats import pearsonr
import pandas as pd

def _passes_min_score(c: dict) -> bool:
    """
    BOGA MODU: Eşikler düşürüldü — daha fazla aday Layer 3'e geçsin
    SQUEEZE: 40.0 | AWAKENING: 38.0 | Diğerleri: 32.0
    """
    score = c.get("boga_score_100", 0.0)
    sys   = c.get("selection_system", "DEFAULT")
    if sys == "SQUEEZE":   return score >= 40.0
    if sys == "AWAKENING": return score >= 38.0
    if sys == "DEFAULT":   return score >= 42.0
    return score >= 28.0


def build_diversified_toplist(
    candidates:      list,
    max_per_sector:  int   = MAX_PER_SECTOR,
    total:           int   = 20,
    corr_threshold:  float = 0.75
) -> list:
    if not candidates:
        return []

    # ── Adım 1: boga_score_100 yoksa hesapla ─────────────────────────────────
    for c in candidates:
        if "boga_score_100" not in c:
            c["boga_score_100"] = compute_boga_score_100(c)

    # ── Adım 2: Sistem bazlı minimum eşik filtresi — V117_v2 ─────────────────
    # Eski kod: herkese aynı 38.0 eşiği.
    # V117_v2: SQUEEZE → 44.0, AWAKENING → 42.0, diğerleri → 38.0
    sorted_cands = sorted(
        [c for c in candidates if _passes_min_score(c)],
        key=lambda x: x.get("boga_score_100", 0.0),
        reverse=True
    )

    # ── Adım 3: Pairwise Korelasyon Filtresi (SciPy) ─────────────────────────
    # Aynı sektörde yüksek korelasyonlu hisselerden düşük skorluyu ele.
    # Sadece sektör içi korelasyona bakılır — portföy çeşitliliği için.
    filtered_cands  = []
    dropped_tickers = set()

    for i in range(len(sorted_cands)):
        stock_a = sorted_cands[i]
        if stock_a['ticker'] in dropped_tickers:
            continue

        for j in range(i + 1, len(sorted_cands)):
            stock_b = sorted_cands[j]

            if (
                stock_a['sector'] == stock_b['sector']
                and stock_b['ticker'] not in dropped_tickers
            ):
                close_a = stock_a.get('df_1d', pd.DataFrame()).get('Close')
                close_b = stock_b.get('df_1d', pd.DataFrame()).get('Close')

                if (
                    close_a is not None and close_b is not None
                    and not close_a.empty and not close_b.empty
                ):
                    df_merged = pd.concat(
                        [close_a.tail(60), close_b.tail(60)],
                        axis=1, join='inner'
                    ).dropna()

                    if len(df_merged) >= 20:
                        corr, _ = pearsonr(df_merged.iloc[:, 0], df_merged.iloc[:, 1])
                        if corr > corr_threshold:
                            # Skoru düşük olanı (stock_b) ele — stock_a daha üstte
                            dropped_tickers.add(stock_b['ticker'])

        if stock_a['ticker'] not in dropped_tickers:
            filtered_cands.append(stock_a)

    # ── Adım 4: Sektör Rotasyonu ve Final Liste ───────────────────────────────
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
    escaped = html_escape(text)
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
                #   if max_profit_reached >= 8% and price < entry_price * 1.02 → "STOPPED_IN_PROFIT"
                #   elif max_profit_reached >= 5% and price < entry_price → "STOPPED_BREAK_EVEN"
                #   elif price <= stop_loss_high          → status = "STOPPED_OUT"
                #   elif price >= profit_target_low     → status = "PEAK_PROFIT_REACHED"
                #   elif entry_zone_low <= price <= entry_zone_high → status = "IN_ENTRY_ZONE"
                #   elif days_since_pick > max_hold_days → status = "TIME_EXIT"
                #   else                                 → status = "HOLDING"
            },
            
            # 🔥 Flattened Fields for Frontend Compatibility
            "buy_zone": zones.get("buy_zone", {"low": 0, "high": 0}),
            "profit_zone": zones.get("sell_zone", {"low": 0, "high": 0}),
            "stop_zone": zones.get("stop_zone", {"low": 0, "high": 0}),
            # ── V117: Sistem Etiketleri ─────────────────────────
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
                "TREND_CONT": {"text": "Steady Trend",      "color": "green"}, # ── V117 FIX: Eksik frontend etiketi eklendi ──
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
        "model": "BOGA AI v117.v2",
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
    if rr >= 3.0: return "🏆 S (Elite)"
    if rr >= 2.5: return "💎 A+ (Premium)"
    if rr >= 2.0: return "[OK] A (Strong)"
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
    if adx >= 40: return "[START] Very Strong Trend — Momentum near peak"
    if adx >= 30: return "💪 Strong Trend — Institutional interest exists"
    if adx >= 25: return "📊 Confirmed Trend — Healthy move"
    if adx >= 20: return "🌊 Medium Trend — Maturing"
    return "😴 Weak Trend — Range-bound caution"


def classify_macd(macd_hist: float) -> str:
    """Interprets MACD histogram."""
    if macd_hist > 0.05:  return f"[OK] Positive ({macd_hist:+.3f}) — Supports breakout"
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
    """Decision label based on BOGA AI score (Sniper Context).
    Not: Bu aşamaya gelen hisseler 800 hisse içinden en zorlu filtreleri 
    geçmiştir. Yani 'Zayıf' hisse yoktur, sadece şampiyonlar liginin sıralaması vardır."""
    if score >= 75: return "🦅 ELITE SNIPER"
    if score >= 60: return "🔥 STRONG BREAKOUT"
    if score >= 50: return "🐂 SOLID SETUP"
    if score >= 40: return "🎯 PRIME WATCHLIST"
    return "⏳ PULLBACK CANDIDATE"


def build_candidate_block(rank: int, c: dict) -> str:
    """
    V117: Sistem etiketi ve selection_reasons eklendi.
    """
    ticker      = c.get("ticker", "")
    sector      = c.get("sector", "Various")
    boga_s      = c.get("boga_score_100", 0.0)
    entry       = c.get("current_price", 0.0)
    exhaust_tag = " ⚠️ [EXHAUSTED]" if c.get("is_exhausted") else ""

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
    reasons_str = " · ".join(sys_reasons[:3]) if sys_reasons else "Momentum_Filter"

    # Sistem emoji haritası
    sys_emoji = {
        "SQUEEZE":   "🗜️",
        "SPRING":    "⚡",
        "AWAKENING": "🌅",
        "EMA_CROSS": "✂️",
        "PULLBACK":  "🔁",
        "BREAKOUT":  "🚀",
        "MOMENTUM":  "📈",
    }.get(sys_name, "🎯")

    block = (
        f"🦅 <b>#{rank:02d} — {ticker}</b> | {sector}{exhaust_tag}\n"
        f"{sys_emoji} <b>SİSTEM: [{sys_name}]</b> — <i>{sys_cat}</i>\n"
        f"🔍 <b>Signals:</b> <code>{reasons_str}</code>\n"
        f"🐂 <b>BOGA Score:</b> {boga_s:.1f}/100 | <b>Price:</b> ${entry:.2f}\n\n"
        f"🎯 <b>SWING SETUP</b>\n"
        f"🟢 <b>BUY :</b> ${buy_z.get('low',0):.2f} – ${buy_z.get('high',0):.2f}\n"
        f"🔴 <b>STOP:</b> ${stop_z.get('high',0):.2f}\n"
        f"🏁 <b>TP  :</b> ${c.get('tp1',0):.2f} / ${c.get('tp2',0):.2f} / ${c.get('tp3',0):.2f}\n"
        f"⚖️ <b>R/R :</b> {rr:.1f}:1\n\n"
        f"⚡ <b>Trigger:</b> {trigger} (RVOL: {rvol:.1f}x)\n"
        f"{'─'*35}\n"
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

def track_pick_peak_performance():
    """
    V117: Geçmiş seçimlerin peak % performansını otomatik hesaplar.
    Her scan sonrası çağrılır. swing_performance.json history'sine yazar.
    
    Bu fonksiyon şu an PENDING olan hisselerin güncel fiyatını çeker
    ve peak_pct / days_held alanlarını günceller.
    Böylece hangi sistemin ne kadar kazandırdığı zamanla görünür hale gelir.
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
                # Giriş tarihinden bugüne veri çek
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
                    updated = True  # peak_pct güncellendi
                    
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
        logging.error(f"❌ Peak tracker error: {e}")

async def send_weekly_performance_report():
    """
    Haftalık performans özeti — Pazartesi taramasında otomatik tetiklenir.
    swing_performance.json içindeki system_stats ve history'den üretilir.
    """
    try:
        perf_file = os.path.join(r"C:\Users\afksm\finma\frontend\public", "swing_performance.json")
        if not os.path.exists(perf_file):
            logging.warning("⚠️ Haftalık rapor: swing_performance.json bulunamadı.")
            return

        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        history   = data.get('history', [])
        stats     = data.get('stats', {})
        sys_stats = data.get('system_stats', {})

        if not history:
            return

        # ── Son 7 günün işlemlerini al ──────────────────────────────
        cutoff = (datetime.now(NY_TZ) - timedelta(days=7)).strftime("%Y-%m-%d")
        recent = [t for t in history if t.get('date', '') >= cutoff]
        completed_recent = [t for t in recent if t.get('result') not in ('PENDING', None)]

        wins_r   = sum(1 for t in completed_recent if t.get('return_pct', 0) > 0)
        losses_r = sum(1 for t in completed_recent if t.get('return_pct', 0) <= 0)
        avg_r    = (sum(t.get('return_pct', 0) for t in completed_recent) / len(completed_recent)) if completed_recent else 0
        wr_r     = (wins_r / len(completed_recent) * 100) if completed_recent else 0

        # ── Tüm zamanların özeti ────────────────────────────────────
        total_trades  = stats.get('total_picks', len(history))
        all_wr        = stats.get('win_rate', 0)
        all_avg_ret   = stats.get('avg_return_pct', 0)
        above_5       = stats.get('above_5pct_rate', 0)
        above_10      = stats.get('above_10pct_rate', 0)

        # ── Sistem bazlı tablo ──────────────────────────────────────
        sys_lines = []
        for sys_name, s in sorted(sys_stats.items(), key=lambda x: -x[1].get('avg_return', 0)):
            wr  = s.get('winrate', 0)
            avg = s.get('avg_return', 0)
            cnt = s.get('count', 0)
            bar = "🟢" if avg > 3 else "🟡" if avg > 0 else "🔴"
            sys_lines.append(f"  {bar} {sys_name:<10} WR:{wr:>4.0f}%  Avg:{avg:>+5.1f}%  n={cnt}")

        sys_block = "\n".join(sys_lines) if sys_lines else "  (henüz veri yok)"

        # ── Son 7 günün en iyi / en kötü işlemleri ─────────────────
        if completed_recent:
            best  = max(completed_recent, key=lambda t: t.get('return_pct', 0))
            worst = min(completed_recent, key=lambda t: t.get('return_pct', 0))
            best_line  = f"🏆 En iyi:  {best.get('ticker','?')} ({best.get('selected_system','?')}) → <b>{best.get('return_pct',0):+.1f}%</b>"
            worst_line = f"💀 En kötü: {worst.get('ticker','?')} ({worst.get('selected_system','?')}) → <b>{worst.get('return_pct',0):+.1f}%</b>"
        else:
            best_line  = "🏆 En iyi: —"
            worst_line = "💀 En kötü: —"

        # ── Mesajı oluştur ──────────────────────────────────────────
        now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
        msg = (
            f"📊 <b>BOGA AI — HAFTALIK PERFORMANS RAPORU</b>\n"
            f"📅 {now_str}\n\n"

            f"<b>━━ SON 7 GÜN ({len(completed_recent)} tamamlandı) ━━</b>\n"
            f"  ✅ Win Rate:     <b>{wr_r:.1f}%</b>  ({wins_r}W / {losses_r}L)\n"
            f"  💰 Ort. Return:  <b>{avg_r:+.1f}%</b>\n"
            f"  📌 Toplam sinyal: {len(recent)}\n"
            f"{best_line}\n"
            f"{worst_line}\n\n"

            f"<b>━━ TÜM ZAMANLAR ({total_trades} sinyal) ━━</b>\n"
            f"  ✅ Win Rate:     <b>{all_wr:.1f}%</b>\n"
            f"  💰 Ort. Return:  <b>{all_avg_ret:+.1f}%</b>\n"
            f"  📈 +5% üzeri:   <b>{above_5:.1f}%</b>\n"
            f"  🚀 +10% üzeri:  <b>{above_10:.1f}%</b>\n\n"

            f"<b>━━ SİSTEM BAZLI PERFORMANS ━━</b>\n"
            f"<pre>{sys_block}</pre>\n\n"

            f"<i>BOGA AI v117.v2 | swing_performance.json</i>"
        )

        await send_telegram_message(msg)
        logging.info("📊 Haftalık performans raporu Telegram'a gönderildi.")

    except Exception as e:
        logging.error(f"❌ Haftalık rapor hatası: {e}")
        
        
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
    recently_picked = await get_recently_picked_tickers(days=5)
    # Add last 5 days picks to currently manually excluded ones
    CURRENT_EXCLUSIONS = EXCLUDED_STOCKS.union(recently_picked)
    # ---------------------------------
    
    # ── STEP 1: MARKET ANALYSIS ──────────────────────────────────────
    await analyze_market_and_sectors()
    logging.info(f"⚙️ Regime: {MARKET_STATUS['regime']} | Modifier: {MARKET_STATUS['min_score_modifier']}")

    vix_note = MARKET_STATUS.get("vix_note", "VIX: N/A")
    # Telegram notification moved to main_loop to avoid duplicates if run via scheduler
    
    # ── STEP 2: UNIVERSE (500 stocks - weekly cache) ───────────────────
    MASTER_UNIVERSE = await build_atmaca_universe_full()
    if not MASTER_UNIVERSE:
        await send_telegram_message("❌ Could not create universe!")
        return

    # ── CRITICAL FIX: Filter scan list with CURRENT list only ──
    tickers_to_scan = [t for t in MASTER_UNIVERSE if t not in CURRENT_EXCLUSIONS]
    logging.info(f"📋 Number of stocks to scan (Duplicates removed): {len(tickers_to_scan)}")

    # ── STEP 3: PARALLEL ANALYSIS (500 stocks → at least 50 pass) ─────────
    semaphore = asyncio.Semaphore(8)

    async def sem_analyze(ticker: str):
        nonlocal scanned_count
        async with semaphore:
            await asyncio.sleep(random.uniform(0.5, 1.2))  # Hızlandırılmış bekleme
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
    logging.info(f"[OK] Layer 2 passed: {len(candidates)} stocks")

    if not candidates:
        await send_telegram_message("⚠️ No candidates found meeting criteria.")
        return
        
    # ── STEP 4: 8-FACTOR SCORE + BEST 50 ──────────────────────────
    for c in candidates:
        compute_multi_factor_score(c)
        # 🎯 FIX: Layer 3'e gidecek havuzu doğru seçmek için boga_score_100 ön hesaplaması
        c["boga_rr"] = c.get("rr_ratio", 0.0)  # Step 8'de 1H değeriyle üzerine yazılır
        c["boga_score_100"] = compute_boga_score_100(c)

    # 🎯 FIX: Sıralamayı raw_score ("score") yerine boga_score_100'e göre yap.
    # En az 40 puan alamayanları derin analize (API maliyetine ve zaman kaybına) sokma.
    candidates_ranked = sorted(
        [c for c in candidates if _passes_min_score(c)],  # SQUEEZE→44, AWAKENING→42
        key=lambda x: x.get("boga_score_100", 0.0), reverse=True
    )
    
    top_50 = candidates_ranked[:TOP_DEEP_ANALYSIS]
    logging.info(f"🏆 Layer 2 → Top {len(top_50)} moving to deep analysis (based on Boga Score).")

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
            logging.debug(f"⚠️ {ticker} Layer 3: {e}")

    sem_k3 = asyncio.Semaphore(8)
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

    # ── STEP 7: DIVERSIFIED CANDIDATE SELECTION ─────────────────────────────────────────
    # Get top candidates directly based on BOGA AI's robust 1D/1H Macro Score.
    top_candidates = build_diversified_toplist(top_50, total=TOP_FINAL_PICKS)
   
    
    # ── STEP 8: BOGA AI ZONE CALCULATION (ATR + 1H Support/Resistance) ─────
    for c in top_candidates:
        trigger = c.get("entry_trigger", "")
        zones = calculate_support_resistance_1h(
            c.get("df_1h"), c.get("df_1d"), c.get("current_price", 0.0), trigger, c.get("df_15m")
        )
        
        c["boga_zones"] = zones
        c["boga_rr"] = zones.get("rr_ratio", 0.0)

    # ── R/R HARD ELIMINATION — 🎯 BOĞA MODU: 1.5 → 1.0 ─────────────────────
    top_candidates = [c for c in top_candidates if c.get("boga_rr", 0.0) >= 1.0]
    if not top_candidates:
        logging.warning("⚠️ No candidates left after R/R < 1.0 elimination.")
        await send_telegram_message("⚠️ No setups with R/R 1.0+ in daily scan.")
        return

    # Capture 20 candidates for Terminal Daily tab AFTER R/R filtering (Tutarsızlık Giderildi)
    top_20_candidates = list(top_candidates)


    # ── STEP 9: BOGA AI SCORE OUT OF 100 ─────────────────────────────────
    for c in top_20_candidates:
        c["boga_score_100"] = compute_boga_score_100(c)

    # 🚨 1-3 Günlük Short-Hold için Kalite Barajı
    filtered_top_20 = []
    for c in top_20_candidates:
        # 🎯 FIX: Unified skor sisteminde 80+ çok nadirdir. SQUEEZE/AWAKENING gibi
        # hızlı (hold <= 3) setupları boğmamak için baraj gerçekçi bir seviye olan 70'e indirildi.
        if c.get("hold_days", 5) <= 3 and c.get("boga_score_100", 0.0) < 58.0:
            logging.info(f"🚫 {c['ticker']}: Short-hold (<=3 day) barajı geçemedi. Skor: {c.get('boga_score_100')} < 58")
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
    
    # ── V117: Terminal'de 20 hissenin tam listesi (boga_score_100 artık hazır) ──
    logging.info("=" * 70)
    logging.info(f"🐂 BOGA AI v117.v2 — TAM ADAY LİSTESİ ({len(top_20_candidates)} hisse)")
    logging.info(f"{'#':<4} {'TICKER':<7} {'SİSTEM':<10} {'BOGA':>5} {'SEKTOR':<22} {'R/R':>5} {'RSI':>5} {'RVOL':>6}")
    logging.info("-" * 70)
    for i, c in enumerate(top_20_candidates):
        sys_name = c.get("selection_system", "N/A")
        boga_s   = c.get("boga_score_100", 0.0)
        sector_s = c.get("sector", "Unknown")[:20]
        rr_s     = c.get("boga_rr", 0.0)
        rsi_s    = c.get("rsi_14", 0.0)
        rvol_s   = c.get("rvol_today", 0.0)
        tg_flag  = " ← TELEGRAM" if i < 5 else ""
        logging.info(
            f"{i+1:<4} {c['ticker']:<7} {sys_name:<10} {boga_s:>5.1f} "
            f"{sector_s:<22} {rr_s:>4.1f} {rsi_s:>5.1f} {rvol_s:>5.2f}x{tg_flag}"
        )
    logging.info("=" * 70)
    from collections import Counter
    sys_counts = Counter(c.get("selection_system", "N/A") for c in top_20_candidates)
    logging.info("📊 Sistem Dağılımı: " + " | ".join(f"{k}: {v}" for k, v in sys_counts.most_common()))
    logging.info("=" * 70)

    # ── STEP 10: PERFORMANCE DATA ─────────────────────────────────
    for c in top_20_candidates:
        c["performance"] = get_price_performance(c.get("df_1d", pd.DataFrame()), c["ticker"])
        db_info = COMPANY_DATABASE.get(c["ticker"], {})
        c["company"] = db_info.get("name", c["ticker"])

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

        # 2. Prepare JSON Data (Terminal gets 20, Summary gets filtered)
        output_terminal = build_json_output(top_20_candidates, generated_at)
        output_top5 = build_json_output(top_candidates[:5], generated_at)

        # 3. Save Special Archive for inday313 Reference
        with open(full_archive_path, "w", encoding="utf-8") as f:
            json.dump(output_terminal, f, indent=2, ensure_ascii=False, default=str)
        logging.info(f"📁 Archived for inday313: {full_archive_path}")

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

        # ── STEP: ISR Cache Revalidation ────────────────────────────────
        # Trigger Next.js to regenerate /swing page cache after data update
        try:
            import requests
            revalidate_secret = os.getenv("REVALIDATE_SECRET", "")
            if revalidate_secret:
                revalidate_url = "http://localhost:3000/api/revalidate-swing"
                resp = requests.post(
                    revalidate_url,
                    headers={"x-revalidate-secret": revalidate_secret},
                    timeout=5
                )
                if resp.ok:
                    logging.info("✅ ISR cache revalidated for /swing page")
                else:
                    logging.warning(f"⚠️ ISR revalidation failed: {resp.status_code}")
        except Exception as e:
            logging.debug(f"ISR revalidation note: {e} (not critical)")

    except Exception as e:
        logging.error(f"❌ JSON save error: {e}")
        

    # ── STEP 13: TELEGRAM REPORT ───────────────────────────────────────
    duration = time.time() - start_time
    now_str = now_ny.strftime("%Y-%m-%d %H:%M %Z")

    # Summary table
    tg_display_picks = top_candidates[:5]  # 🎯 Sadece ilk 5'i Telegram'a yolla
    
    header = (
        f"🐂 <b>ATMACA SWING V117 – TOP 5 PREMIUM PICKS</b>\n"
        f"🕒 <i>{now_str}</i> | ⏱ {duration:.1f}s\n"
        f"📊 <i>{len(tickers_to_scan)} scanned → {len(candidates)} candidates → Top 10 Saved</i>\n"
        f"📈 Market: <b>{MARKET_STATUS['regime']}</b>\n\n"
        "<pre>"
        f"#   SYMBOL  [SYSTEM ]  BOGA   BUY_L  SELL_H  STOP\n"
        f"──────────────────────────────────────────────────\n"
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

    toplist_msg = header + "\n".join(rows) + "\n─────────────────────────────────────────────────────\n</pre>\n"
    toplist_msg += f"<i>[INFO] BUY→SELL: R/R~2.5:1 | ATR+1H Support/Resistance | BOGA AI v117.v2</i>\n\n"
    toplist_msg += "<b>📋 Detailed Analysis Below:</b>\n\n"

    # Send Toplist Summary
    await send_telegram_message(toplist_msg)
    # Send each candidate block separately (to prevent HTML explosion)
    for i, c in enumerate(tg_display_picks):
        block = build_candidate_block(i + 1, c)
        await send_telegram_message(block)
        await asyncio.sleep(0.5) # Telegram flood protection

    save_info_cache()

    # Auto-update stats (homepage ↔ performance sync)
    update_swing_performance_stats()
    
    # V117: Peak performance tracker (sistem bazlı winrate birikimi)
    track_pick_peak_performance()

    # 🎯 FIX: Haftalık Rapor Tetikleyici (Sadece Pazartesi Günleri Çalışır)
    if now_ny.weekday() == 0:  
        try:
            await send_weekly_performance_report()
            logging.info("📅 Haftalık performans raporu başarıyla tetiklendi ve gönderildi.")
        except Exception as e:
            logging.error(f"❌ Haftalık rapor gönderim hatası: {e}")

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
    # 🔧 FIX: Hafta sonu sonsuz döngü edge-case koruması eklendi.
    if candidate_utc <= now_utc:
        candidate_ny += timedelta(days=1)
        while candidate_ny.weekday() >= 5:
            candidate_ny += timedelta(days=1)
        candidate_utc = candidate_ny.astimezone(timezone.utc)
    return candidate_utc


async def run_scanner():
    """Main loop — Runs every day at NY 13:00."""
    await send_telegram_message(
        "🐂 <b>BOGA AI SWING TRADE V117 Started!</b>\n"
        "📅 Schedule: Every weekday New York 13:00\n"
        "🎯 Goal: Daily Top 5 Swing Trade Opportunities\n"
        f"📊 Market: <b>{MARKET_STATUS.get('regime','Bull')}</b> | R/R: ~2.5:1\n"
        "🔍 V117: Sistem etiketleri + VIX overlay aktif"
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
                print(f"🕒 Saat henuz erken. NY 13:00 bekleniyor ({wait_sec/3600:.1f} saat)...")
                import time
                time.sleep(wait_sec)
            
            print("[START] BOGA AI v117.v2.0 Swing Scanner (One-Shot) baslatildi...")
            asyncio.run(scan_top_stocks())
            print("[OK] Tarama tamamlandi.")
        else:
            asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print("\n🐂 BOGA AI v117.v2.0 durduruldu.")
    except Exception as e:
        print(f"Critical Startup Error: {e}")