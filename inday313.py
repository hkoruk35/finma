import asyncio
import logging
import time
import aiohttp
import os
import html
import json
import requests

import pandas as pd
import numpy as np
import yfinance as yf

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo

# --- Technical Indicators (Master Plan v3.0 Requirements) ---
from ta.trend import EMAIndicator, ADXIndicator
from ta.volatility import AverageTrueRange, BollingerBands  # Bollinger added (for Squeeze detection)
from ta.momentum import RSIIndicator
from ta.volume import ChaikinMoneyFlowIndicator


# =====================================================================
# 🐂 BOGA FINANCE AI – INSTITUTIONAL SWING ENGINE
#
# Objective:
# - Track Smart Money footprints.
# - Select stocks showing "Institutional Accumulation" and "Decoupling" 
#   from the local swing pool.
#
# Timeframe Discipline (Institutional Hierarchy):
# - 1D  → Structural Context & Trend Phase (Accumulation / Expansion / Exhaustion)
# - 1H  → Institutional Value Zone & VWAP Logic
# - 15M → Micro Structure Break - Entry Timing
#
# Philosophy (Price vs Intent):
# - Find the stock that is "Preparing", not just rising.
# - Detect "Absorption" with Volume/Range analysis while price falls.
# - Catch outperformers using Relative Strength (RS).
# - Filter volatility using Normalized ATR (NATR).
#
# Output:
# - Institutional Action (Absorption, Aggressive Buy)
# - Setup Type (Dip Reversal, Power Trend, Pullback)
# - Invalidation Level (Structural Invalidation Level)
# - Entry Zone (Institutional Cost Zone)
#
# Notes:
# ❌ NO simple indicator crossovers (Retail Logic).
# ❌ NO intraday scalp.
# ❌ NO social media sentiment noise (Reddit etc.).
# ✅ Focused on Volume/Price analysis (VPA) and Institutional Footprint.
# =====================================================================


# ============================================================
# 📊 REAL-TIME DATA VALIDATION (Yahoo Finance)
# ============================================================

def get_realtime_price_and_volume(ticker: str) -> dict:
    """
    Get daily close data for SWING TRADE analysis
    Swing trade uses daily closes, not intraday ticks
    Returns: {price, volume, volume_avg_20d, daily_change, trend}
    """
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        
        # Get daily data (not 5-minute!) - Swing trade uses DAILY
        daily = stock.history(period="30d", interval="1d")
        if daily.empty or len(daily) < 5:
            return None
        
        # Use LAST CLOSE (most recent daily close)
        current_price = daily['Close'].iloc[-1]
        current_volume = daily['Volume'].iloc[-1]
        
        # 20-day average volume - swing111 compatibility: Don't include today's incomplete bar
        volume_avg_20d = daily['Volume'].iloc[-21:-1].mean() if len(daily) >= 21 else daily['Volume'].iloc[:-1].mean()
        
        # Daily change (today vs yesterday CLOSE)
        if len(daily) >= 2:
            prev_close = daily['Close'].iloc[-2]
            daily_change = ((current_price - prev_close) / prev_close) * 100
        else:
            daily_change = 0
        
        # 5-day trend direction (swing trade timeframe)
        if len(daily) >= 5:
            price_5d_ago = daily['Close'].iloc[-5]
            trend = "UP" if current_price > price_5d_ago else "DOWN"
            trend_strength = ((current_price - price_5d_ago) / price_5d_ago) * 100
        else:
            trend = "NEUTRAL"
            trend_strength = 0
        
        return {
            'price': round(float(current_price), 2),
            'volume': int(current_volume),
            'volume_avg_20d': int(volume_avg_20d),
            'volume_ratio': round(float(current_volume / volume_avg_20d), 2) if volume_avg_20d > 0 else 0,
            'daily_change_pct': round(float(daily_change), 2),
            'trend': trend,
            'trend_strength_pct': round(float(trend_strength), 2),
            'data_type': 'DAILY_CLOSE'  # Swing trade uses daily data
        }
        
    except Exception as e:
        logging.warning(f"Daily data failed for {ticker}: {e}")
        return None


def validate_entry_zone(current_price: float, entry_zone: str) -> dict:
    """
    Check if current price is within swing trade entry zone
    Swing trade: Daily close within ±2% of zone is acceptable
    Returns: {status, message}
    """
    try:
        # Parse entry zone "174.00-177.00" or "174.00 - 177.00"
        parts = entry_zone.replace(" ", "").split("-")
        if len(parts) != 2:
            return {'status': 'UNKNOWN', 'message': 'Invalid entry zone format'}
        
        entry_low = float(parts[0])
        entry_high = float(parts[1])
        zone_mid = (entry_low + entry_high) / 2
        
        # Swing trade: ±2% tolerance around zone boundaries
        
        if current_price > entry_high * 1.05:  # 5% above zone = too extended
            return {
                'status': 'EXTENDED',
                'message': f'Price too high (${current_price:.2f}), zone ${entry_low:.2f}-${entry_high:.2f}'
            }
        elif current_price < entry_low * 0.95:  # 5% below zone = setup failed
            return {
                'status': 'INVALIDATED',
                'message': f'Price too low (${current_price:.2f}), setup invalidated'
            }
        elif current_price > entry_high * 1.02:  # 2-5% above = wait for pullback
            return {
                'status': 'WAIT',
                'message': f'Above entry zone (${current_price:.2f}), wait for pullback'
            }
        elif current_price < entry_low * 0.98:  # 2-5% below = caution
            return {
                'status': 'BELOW',
                'message': f'Below entry zone (${current_price:.2f}), be careful'
            }
        else:
            # Within zone ±2% = GOOD for swing trade
            distance_from_mid = abs((current_price - zone_mid) / zone_mid) * 100
            return {
                'status': 'VALID',
                'message': f'In entry zone (${entry_low:.2f}-${entry_high:.2f}), ENTRY VALID ✅ ({distance_from_mid:.1f}% from mid)'
            }
            
    except Exception as e:
        return {'status': 'UNKNOWN', 'message': str(e)}
        

def validate_volume_for_setup(setup_type: str, volume_ratio: float, df_15m: pd.DataFrame = None, df_1h: pd.DataFrame = None, ticker: str = None) -> dict:
    """
    Check if volume supports the setup - ADVANCED SWING TRADE version
    
    Rules:
    1. Check 15m trend (last 4 bars) - must be UP
    2. Check 1h trend (last 4 bars) - must be UP
    3. Check volume trend - must be stable or rising
    
    NO catching falling knives! Price UP + Volume DOWN = Trap
    """
    # Swing trade thresholds
    thresholds = {
        'BREAKOUT': 1.3,
        'SQUEEZE': 1.2,
        'ABSORPTION': 1.0,
        'TREND': 0.8
    }
    
    required = thresholds.get(setup_type, 1.0)
    
    # Check daily volume ratio first
    if volume_ratio < required:
        return {
            'valid': False,
            'message': f'Insufficient volume ({volume_ratio:.1f}x < {required}x) ❌'
        }
    
    # 🔥 CRITICAL: Multi-timeframe trend + volume check
    if not ticker:
        # If no ticker, only check daily volume
        return {
            'valid': True,
            'message': f'Volume OK ({volume_ratio:.1f}x) - trend check skipped'
        }
    
    try:
        # ============================================
        # 1. CHECK 15m TREND (Last 4 bars = 1 hour)
        # ============================================
        hist_15m = df_15m # No longer fetching from API, using ready data.
        
        if hist_15m.empty or len(hist_15m) < 4:
            return {
                'valid': True,
                'message': f'Volume OK ({volume_ratio:.1f}x) - 15m data unavailable'
            }
        
        last_4_bars_15m = hist_15m.iloc[-4:]
        
        # Price trend (first bar close vs last bar close)
        price_first = last_4_bars_15m['Close'].iloc[0]
        price_last = last_4_bars_15m['Close'].iloc[-1]
        price_trend_15m = "UP" if price_last > price_first else "DOWN"
        price_change_15m = ((price_last - price_first) / price_first) * 100
        
        # Volume trend (first 2 bars avg vs last 2 bars avg)
        volumes_15m = last_4_bars_15m['Volume'].tolist()
        vol_first_half = sum(volumes_15m[:2]) / 2
        vol_second_half = sum(volumes_15m[2:]) / 2
        volume_trend_15m = "UP" if vol_second_half >= vol_first_half else "DOWN"
        volume_change_15m = ((vol_second_half - vol_first_half) / vol_first_half) * 100
        
        # 15m REJECTION RULES
        if price_trend_15m == "DOWN":
            return {
                'valid': False,
                'message': f'15m trend DOWN ({price_change_15m:+.1f}%) 🔻 Falling knife - RED'
            }
        
        # NEW: Zero tolerance for fake rallies (Attention if volume drops 5%, RED if 10%)
        if price_trend_15m == "UP" and volume_trend_15m == "DOWN" and volume_change_15m < -10:
            return {
                'valid': False,
                'message': f'15m: Price UP but volume DOWN ({volume_change_15m:.0f}%) ⚠️ Fake Rally Trap - RED'
            }
            
        # ============================================
        # 2. CHECK 1h TREND (Last 4 bars = 4 hours)
        # ============================================
        hist_1h = df_1h  # No longer fetching from API, using ready data.
        
        if hist_1h is None or hist_1h.empty or len(hist_1h) < 4:
            # 15m passed but 1h unavailable - allow with warning
            return {
                'valid': True,
                'message': f'Volume OK, 15m trend UP - 1h data unavailable'
            }
        
        last_4_bars_1h = hist_1h.iloc[-4:]
        
        # Price trend
        price_first_1h = last_4_bars_1h['Close'].iloc[0]
        price_last_1h = last_4_bars_1h['Close'].iloc[-1]
        price_trend_1h = "UP" if price_last_1h > price_first_1h else "DOWN"
        price_change_1h = ((price_last_1h - price_first_1h) / price_first_1h) * 100
        
        # Volume trend
        volumes_1h = last_4_bars_1h['Volume'].tolist()
        vol_first_half_1h = sum(volumes_1h[:2]) / 2
        vol_second_half_1h = sum(volumes_1h[2:]) / 2
        volume_trend_1h = "UP" if vol_second_half_1h >= vol_first_half_1h else "DOWN"
        volume_change_1h = ((vol_second_half_1h - vol_first_half_1h) / vol_first_half_1h) * 100
        
        if price_trend_1h == "DOWN":
            return {
                'valid': False,
                'message': f'1h trend DOWN ({price_change_1h:+.1f}%) 🔻 Falling knife - RED'
            }
        
        if price_trend_1h == "UP" and volume_trend_1h == "DOWN" and volume_change_1h < -15:
            return {
                'valid': False,
                'message': f'1h: Fiyat UP ama hacim DOWN ({volume_change_1h:.0f}%) ⚠️ Divergence - RED'
            }
        
        # ============================================
        # 3. ALL CHECKS PASSED ✅
        # ============================================
        return {
            'valid': True,
            'message': f'Volume OK ({volume_ratio:.1f}x) | 15m: P{price_change_15m:+.1f}% V{volume_change_15m:+.0f}% | 1h: P{price_change_1h:+.1f}% V{volume_change_1h:+.0f}% ✅'
        }
        
    except Exception as e:
        # If any check fails, fall back to daily volume only
        return {
            'valid': True,
            'message': f'Volume OK ({volume_ratio:.1f}x) - trend check error: {str(e)[:30]}'
        }

# ------------------------------------------------
# 🔹 LOG CONFIGURATION
# ------------------------------------------------
_log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(_log_dir, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(_log_dir, "inday313.log"), encoding="utf-8"),
    ],
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)


# ------------------------------------------------
# 🔹 TIME SETTINGS (NEW YORK)
# ------------------------------------------------
NY_TZ = ZoneInfo("America/New_York")

RUN_START_HOUR = 9      # 09:00 NY (Pre-market end)
RUN_END_HOUR = 16       # 16:00 NY (Closing)
WEEKDAY_SET = {0, 1, 2, 3, 4}

# ------------------------------------------------
# 🔹 CACHE SETTINGS
# ------------------------------------------------
UNIVERSE_TTL = 168 * 3600       # 1 week
UNIVERSE_CACHE: Dict[str, Any] = {
    "ts": 0.0,
    "data": []
}

# Institutional analysis requires a wider dataset (VWAP & 52W High)
LOOKBACK_DAYS_1D = 365     # 1 Year (For Year-to-Date VWAP and Structural Analysis)
LOOKBACK_DAYS_1H = 90      # Stabilization and Institutional Cost Zone
LOOKBACK_DAYS_15M = 14     # Entry Timing (Short term sufficient)

MIN_BARS_1D = 150          # ~7 ay — EMA200 erken aşamada da hesaplanabilir (ewm fewer-point bootstrap)
MIN_BARS_1H = 300
MIN_BARS_15M = 200

# ------------------------------------------------
# 🔹 INSTITUTIONAL STRATEGY SETTINGS (v3.0)
# ------------------------------------------------
INSTITUTIONAL_SETTINGS = {
    # --- VOLATILITY QUALITY (NATR) ---
    "NATR_MIN": 2.0,       # Under 2% is "Dead Money"
    "NATR_SWEET_SPOT_MIN": 2.5,
    "NATR_SWEET_SPOT_MAX": 6.0,
    "NATR_MAX": 7.5,       # Over 7.5% is "Gamble/News Based" (High Risk)

    # --- RELATIVE STRENGTH (RS) ---
    "RS_LOOKBACK_DAYS": 5, # Look at 1-week separation
    "RS_DECOUPLING_THRESHOLD": 0.5, # Required 0.5% positive decoupling from index

    # --- TREND ENERGY (ADX) ---
    "ADX_MIN_TREND": 20,          # Trend start
    "ADX_MAX_SAFE": 45,           # Over 45 is "Late Trend" (Too late)

    # --- TARGETS ---
    "MIN_RR_RATIO": 2.0,          # Risk/Reward at least 1:2
}

# ------------------------------------------------
# 🔹 LIQUIDITY & FILTERING (SMART MONEY)
# ------------------------------------------------
# Kurumsal algoritmalar sığ tahtalara girmez.
PRICE_MIN = 3.0
PRICE_MAX = 1500.0

MIN_MARKET_CAP = 300_000_000    # Min 300M$ (Above Small Cap)
MIN_AVG_VOLUME = 500_000        # Daily 500k lots
MIN_DOLLAR_VOLUME = 5_000_000  # Daily 5 Million $ volume (Required)

MIN_BETA = 0.3
MAX_BETA = 3.0                  # Filter out extreme speculators
MAX_SHORT_FLOAT = 0.30          # Limit to avoid Short Squeeze trap

# ------------------------------------------------
# 🔹 GLOBAL MARKET CONTEXT (DYNAMIC)
# ------------------------------------------------
INDEX_BENCHMARK = "^GSPC"  # S&P 500

MARKET_CONTEXT = {
    "regime": "Neutral",      # Bull / Bear / Neutral
    "risk_modifier": 1.0,     # Pozisyon büyüklüğü çarpanı
    "spy_5d_pct": 0.0,        # RS hesaplaması için gerekli
    "spy_20d_pct": 0.0,       # Orta vade trend yönü
    "vix_level": 0.0,         # Volatilite endeksi (Korku ölçümü)
}

SECTOR_CONTEXT: Dict[str, float] = {}
MAX_PER_SECTOR_LATEST = 3
MAX_PER_SECTOR_OTHERS = 3
LAST_PRE_GAP_ALERT_DATE = None

# ------------------------------------------------
# 🔹 SHARED PATHS
# ------------------------------------------------
FINMA_DIR = r"C:\Users\afksm\finma"
PUBLIC_DIR = os.path.join(FINMA_DIR, "frontend", "public")
INTRADAY_HISTORY_DIR = os.path.join(PUBLIC_DIR, "intraday_history")
INDAY_UNIVERSE_FILE = os.path.join(PUBLIC_DIR, "inday_universe_today.json")
THEME_DATA_FILE = os.path.join(FINMA_DIR, "frontend", "lib", "themeData.ts")
ALL_LIST_WATCHLIST_SLUGS = ["525", "2550", "50250", "portfolio", "swing", "daily", "long_term"]
DISCOVERY_TOP_N = 20

# ============================================================
# ============================================================
# 📁 BOGA FINANCE AI – CANDIDATE UNIVERSE LOADER (ARCHIVE 30-DAY MODE)
#
# Objective:
# - Scans the C:\Users\afksm\finma\frontend\public\data\swing2026 (etc.) folder.
# - Reads archive files (swing_YYYYMMDD.json) from the past 30 days.
# - Stores the "most recent" buy/sell zones for each stock.
# - Does not pull stocks from external sources or old-format files.
# ============================================================

BOGA_SWING_ZONES = {}

def load_swing_universe() -> List[str]:
    """
    V115: swing115_boga.py'nin ürettiği swing_all_picks.json dosyasından 
    en güncel listeyi yükler. Saatlik inday313 botu sadece bu listedeki 
    hisseleri (Top 20) izler.
    """
    global BOGA_SWING_ZONES
    BOGA_SWING_ZONES.clear()

    swing_file = r"C:\Users\afksm\finma\frontend\public\swing_all_picks.json"
    
    if not os.path.exists(swing_file):
        logging.error(f"❌ {swing_file} bulunamadı! Swing botun çalışmış olduğundan emin olun.")
        return []

    try:
        with open(swing_file, encoding="utf-8") as f:
            data = json.load(f)
        
        picks = data.get("picks", [])
        pick_date = data.get("date", "")
        
        all_tickers = []
        for p in picks:
            ticker = p.get("ticker")
            if not ticker: continue
            
            all_tickers.append(ticker)
            
            # BOGA_SWING_ZONES'a ekle (inday raporları için gerekli veriler)
            BOGA_SWING_ZONES[ticker] = {
                "pick_date": pick_date,
                "company": p.get("company", ticker),
                "sector": p.get("sector", "Unknown"),
                "score": p.get("boga_score", p.get("score", 0)),
                "entry_low": p.get("entry_zone", {}).get("low", 0),
                "entry_high": p.get("entry_zone", {}).get("high", 0)
            }

        logging.info(f"✅ inday313 universe: {len(all_tickers)} hisse yüklendi (swing_all_picks.json) | Tarih: {pick_date}")
        return sorted(all_tickers)

    except Exception as e:
        logging.error(f"⚠️ swing_all_picks.json okuma hatası: {e}")
        return []

# ============================================================
# 📁 BOGA FİNANS AI – ALL-LIST TAM EVREN YÜKLEYİCİ
#
# Amaç:
# - https://bogastock.com/csp/all-list sayfasının kullandığı TÜM ticker
#   kaynaklarını (tema listeleri + Supabase watchlist'leri + swing picks)
#   birleştirip günün ilk taramasında tarayacağımız tam evreni kurar.
# - load_swing_universe() ÖNCE çağrılmış olmalı (BOGA_SWING_ZONES dolu olsun diye).
# ============================================================

def fetch_theme_tickers() -> List[str]:
    """frontend/lib/themeData.ts içindeki MARKET_THEMES dizisini parse eder."""
    try:
        if not os.path.exists(THEME_DATA_FILE):
            return []
        with open(THEME_DATA_FILE, encoding="utf-8") as f:
            content = f.read()
        json_part = content.split("=", 1)[1].strip()
        if json_part.endswith(";"):
            json_part = json_part[:-1]
        themes = json.loads(json_part)
        tickers = sorted({t for theme in themes for t in theme.get("tickers", []) if t})
        logging.info(f"✅ themeData.ts: {len(tickers)} ticker (MARKET_THEMES)")
        return tickers
    except Exception as e:
        logging.warning(f"⚠️ themeData.ts okunamadı: {e}")
        return []


def fetch_supabase_watchlist_tickers() -> List[str]:
    """Supabase csp_watchlists tablosundan all-list'in kullandığı watchlist slug'larını çeker."""
    try:
        from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            logging.warning("⚠️ SUPABASE_URL/SUPABASE_SERVICE_KEY tanımsız, watchlist taraması atlanıyor.")
            return []

        slugs_filter = ",".join(ALL_LIST_WATCHLIST_SLUGS)
        url = f"{SUPABASE_URL}/rest/v1/csp_watchlists"
        params = {"select": "tickers", "slug": f"in.({slugs_filter})"}
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        }
        resp = requests.get(url, headers=headers, params=params, timeout=15)
        resp.raise_for_status()
        rows = resp.json()

        tickers: set = set()
        for row in rows:
            for t in (row.get("tickers") or []):
                if t:
                    tickers.add(t)
        logging.info(f"✅ Supabase watchlist'leri: {len(tickers)} ticker ({len(rows)} liste)")
        return sorted(tickers)
    except Exception as e:
        logging.warning(f"⚠️ Supabase watchlist taraması başarısız: {e}")
        return []


def build_full_universe() -> List[str]:
    """
    ALL-LIST sayfasıyla aynı mantıkla tam evreni kurar:
    MARKET_THEMES ∪ Supabase watchlist'leri (525/2550/50250/portfolio/swing/daily/long_term) ∪ swing picks.
    NOT: BOGA_SWING_ZONES'un dolu olması için load_swing_universe() önce çağrılmış olmalı.
    """
    swing_tickers = set(BOGA_SWING_ZONES.keys())
    theme_tickers = set(fetch_theme_tickers())
    watchlist_tickers = set(fetch_supabase_watchlist_tickers())

    full = {t.strip().upper() for t in (swing_tickers | theme_tickers | watchlist_tickers) if t and t.strip()}
    logging.info(
        f"🌐 ALL-LIST tam evren: {len(full)} ticker "
        f"(swing={len(swing_tickers)}, tema={len(theme_tickers)}, watchlist={len(watchlist_tickers)})"
    )
    return sorted(full)


# ------------------------------------------------------------
# 🔎 GÜNÜN İLK TARAMASI – DISCOVERY / RANKING ENGINE
# Tam evrendeki yüzlerce hisseyi 15M/1H/1D üzerinden hafif bir
# momentum + hacim + patern taramasından geçirip Top-N seçer.
# ------------------------------------------------------------

DISCOVERY_CHUNK_SIZE = 150


async def _download_chunk_multi(chunk: List[str], period: str, interval: str) -> Dict[str, pd.DataFrame]:
    """Bir ticker chunk'ı için toplu indirme yapar, ticker -> DataFrame sözlüğü döndürür."""
    out: Dict[str, pd.DataFrame] = {}
    try:
        df = await asyncio.to_thread(
            yf.download, chunk, period=period, interval=interval,
            group_by="ticker", threads=True, progress=False, auto_adjust=True,
        )
    except Exception as e:
        logging.debug(f"yf.download chunk hatası ({period}/{interval}): {e}")
        return out

    if df is None or df.empty:
        return out

    if len(chunk) == 1:
        d = df.dropna(how="all")
        if not d.empty:
            out[chunk[0]] = d
        return out

    try:
        level0 = df.columns.get_level_values(0).unique().tolist()
    except Exception:
        return out

    for t in chunk:
        if t not in level0:
            continue
        try:
            tdf = df[t].dropna(how="all")
            if not tdf.empty:
                out[t] = tdf
        except Exception:
            continue
    return out


async def discover_top_n(universe: List[str], top_n: int = DISCOVERY_TOP_N) -> List[Dict[str, Any]]:
    """
    Günün ilk taraması: ALL-LIST tam evrenini 15M/1H/1D üzerinden tarar.
    1D onayı (fiyat > SMA20 ve 5 günlük momentum pozitif) zorunlu filtre olarak uygulanır;
    onaylananlar arasından günlük hacim + 1H momentum + 15M patern oluşumuna göre Top-N seçilir.
    Yeterli 1D-onaylı aday yoksa liste en iyi skorlu adaylarla tamamlanır.
    """
    chunks = [universe[i:i + DISCOVERY_CHUNK_SIZE] for i in range(0, len(universe), DISCOVERY_CHUNK_SIZE)]
    logging.info(f"🔎 Discovery taraması başladı: {len(universe)} ticker, {len(chunks)} chunk...")

    data_1d: Dict[str, pd.DataFrame] = {}
    data_1h: Dict[str, pd.DataFrame] = {}
    data_15m: Dict[str, pd.DataFrame] = {}

    for i, chunk in enumerate(chunks):
        d1d, d1h, d15m = await asyncio.gather(
            _download_chunk_multi(chunk, period="3mo", interval="1d"),
            _download_chunk_multi(chunk, period="1mo", interval="1h"),
            _download_chunk_multi(chunk, period="5d", interval="15m"),
        )
        data_1d.update(d1d)
        data_1h.update(d1h)
        data_15m.update(d15m)
        logging.info(f"  Discovery chunk {i + 1}/{len(chunks)}: {len(d1d)} 1D / {len(d1h)} 1H / {len(d15m)} 15M indirildi.")

    scored: List[Dict[str, Any]] = []
    for ticker in universe:
        df_1d = data_1d.get(ticker)
        if df_1d is None or df_1d.empty:
            continue

        try:
            close = df_1d["Close"].dropna()
            vol = df_1d["Volume"].dropna()
            if len(close) < 21 or len(vol) < 21:
                continue

            price = float(close.iloc[-1])
            if price < PRICE_MIN or price > PRICE_MAX:
                continue

            sma20 = float(close.rolling(20).mean().iloc[-1])
            chg_5d = ((close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]) * 100 if len(close) >= 6 and close.iloc[-6] else 0.0
            confirmed_1d = bool(price > sma20 and chg_5d > 0)

            today_vol = float(vol.iloc[-1])
            avg20_vol = float(vol.iloc[-21:-1].mean())
            daily_rvol = (today_vol / avg20_vol) if avg20_vol > 0 else 0.0
            dollar_vol = today_vol * price
            if dollar_vol < MIN_DOLLAR_VOLUME:
                continue

            score = 0.0
            if confirmed_1d:
                score += 3.0
            score += min(daily_rvol, 5.0) * 1.2

            chg_1h_4bar = 0.0
            df_1h = data_1h.get(ticker)
            if df_1h is not None and not df_1h.empty:
                c1h = df_1h["Close"].dropna()
                if len(c1h) >= 5 and c1h.iloc[-5] > 0:
                    chg_1h_4bar = ((c1h.iloc[-1] - c1h.iloc[-5]) / c1h.iloc[-5]) * 100
                    if chg_1h_4bar > 0:
                        score += min(chg_1h_4bar, 5.0) * 0.8

            pattern_name, pattern_score = "Neutral", 0.0
            df_15m = data_15m.get(ticker)
            if df_15m is not None and not df_15m.empty and len(df_15m) >= 21:
                # detect_15m_timing_pattern "ATR" sütununu bekler — ham yf.download
                # çıktısında bu yok, o yüzden hafif indikatör setini burada üretiyoruz.
                df_15m_ind = calculate_boga_indicators(df_15m, "15m")
                pattern_name, pattern_score = detect_15m_timing_pattern(df_15m_ind)
                score += pattern_score

            scored.append({
                "ticker": ticker,
                "discovery_score": round(score, 2),
                "confirmed_1d": confirmed_1d,
                "daily_rvol": round(daily_rvol, 2),
                "dollar_vol": round(dollar_vol, 0),
                "chg_5d_pct": round(chg_5d, 2),
                "chg_1h_4bar_pct": round(chg_1h_4bar, 2),
                "pattern_15m": pattern_name,
            })
        except Exception as e:
            logging.debug(f"Discovery skorlama hatası {ticker}: {e}")
            continue

    confirmed = sorted([r for r in scored if r["confirmed_1d"]], key=lambda x: x["discovery_score"], reverse=True)
    others = sorted([r for r in scored if not r["confirmed_1d"]], key=lambda x: x["discovery_score"], reverse=True)
    top = (confirmed + others)[:top_n]

    logging.info(
        f"✅ Discovery tamamlandı: {len(scored)} hisse skorlandı, {len(confirmed)} 1D-onaylı. "
        f"Top {len(top)}: " + ", ".join(r["ticker"] for r in top[:10])
    )
    return top


async def get_or_build_today_universe() -> List[str]:
    """
    Bugünün persisted Top-20 listesini döndürür (inday_universe_today.json).
    Dosya yok/tarih eskiyse: ALL-LIST tam evrenini tarayıp yeni Top-20 seçer ve kaydeder.
    NOT: load_swing_universe() bu fonksiyondan ÖNCE çağrılmış olmalı.
    """
    today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")

    if os.path.exists(INDAY_UNIVERSE_FILE):
        try:
            with open(INDAY_UNIVERSE_FILE, encoding="utf-8") as f:
                cached = json.load(f)
            if cached.get("date") == today_str and cached.get("tickers"):
                logging.info(f"📂 Bugünün takip evreni önbellekten yüklendi: {len(cached['tickers'])} ticker.")
                return cached["tickers"]
        except Exception as e:
            logging.warning(f"⚠️ {INDAY_UNIVERSE_FILE} okunamadı: {e}")

    logging.info("🌅 Günün ilk taraması: ALL-LIST tam evren taranıyor (15M/1H, 1D-onaylı, en hacimli/momentumlu Top 20)...")
    full_universe = build_full_universe()
    if not full_universe:
        logging.warning("⚠️ Tam evren boş, swing_all_picks.json'a geri dönülüyor.")
        return sorted(BOGA_SWING_ZONES.keys())

    try:
        ranked = await discover_top_n(full_universe, DISCOVERY_TOP_N)
    except Exception as e:
        logging.error(f"❌ Discovery taraması başarısız: {e}. swing_all_picks.json'a geri dönülüyor.")
        return sorted(BOGA_SWING_ZONES.keys())

    if not ranked:
        logging.warning("⚠️ Discovery taraması 0 sonuç döndürdü, swing_all_picks.json'a geri dönülüyor.")
        return sorted(BOGA_SWING_ZONES.keys())

    tickers = [r["ticker"] for r in ranked]
    try:
        os.makedirs(os.path.dirname(INDAY_UNIVERSE_FILE), exist_ok=True)
        with open(INDAY_UNIVERSE_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "date": today_str,
                "generated_at": datetime.now(NY_TZ).isoformat(),
                "universe_size": len(full_universe),
                "tickers": tickers,
                "discovery": ranked,
            }, f, indent=2, ensure_ascii=False)
        logging.info(f"💾 Günün Top {len(tickers)} takip evreni kaydedildi → {INDAY_UNIVERSE_FILE}")
    except Exception as e:
        logging.error(f"❌ {INDAY_UNIVERSE_FILE} kaydedilemedi: {e}")

    return tickers

# ============================================================
# 3) BOGA FİNANS AI – MULTI TIMEFRAME DATA FETCHER

#
# Amaç:
# - 1D  → Yapısal bağlam (Kurumsal trend, 52W High, YTD VWAP)
# - 1H  → Stabilizasyon & Kurumsal Maliyet Bölgesi (Value Zone)
# - 15M → Mikro Yapı Kırılımı (Timing & Invalidation)
#
# Not:
# - Veri çekme işlemi paralel (asyncio) yapılır.
# - Kurumsal filtreler (MIN_BARS) burada uygulanır.
# ============================================================

YF_SEMAPHORE = asyncio.Semaphore(4)   # Aynı anda max 4 Yahoo çağrısı


async def get_boga_data(
    ticker: str
) -> Optional[Dict[str, pd.DataFrame]]:
    """
    Çok zaman dilimli swing-entry veri seti üretir.
    Institutional Mode (v3.0) uyumlu veri derinliği sağlar.
    """

    async with YF_SEMAPHORE:
        try:
            stock = yf.Ticker(ticker)

            # -------------------------------------------------
            # 📥 PARALLEL FETCH (THREAD-SAFE)
            # -------------------------------------------------
            # Note: For institutional analysis, we fetch at least 1 year in 1D (for 200MA and YTD VWAP),
            # 6 months in 1H (max limit), and 1 month in 15M (structure break).
            df_1d, df_1h, df_15m = await asyncio.gather(
                asyncio.to_thread(
                    stock.history,
                    period="1y",        # 1D: 1 Year (~252 bars) -> Trend Phase Analysis
                    interval="1d",
                    auto_adjust=True,
                    timeout=20,
                ),
                asyncio.to_thread(
                    stock.history,
                    period="6mo",       # 1H: 6 Months (Max) -> Value Zone detection
                    interval="1h",
                    auto_adjust=True,
                    timeout=20,
                ),
                asyncio.to_thread(
                    stock.history,
                    period="1mo",       # 15M: 1 Month -> Micro Structure (1 month instead of 14d)
                    interval="15m",
                    auto_adjust=True,
                    timeout=20,
                ),
            )

            # -------------------------------------------------
            # 🧹 BASIC VALIDATION
            # -------------------------------------------------
            if any(df is None for df in (df_1d, df_1h, df_15m)):
                return None

            if df_1d.empty or df_1h.empty or df_15m.empty:
                return None

            # Minimum bar requirements (Relaxed - Technical analysis performed as much as possible)
            if len(df_1d) < 20: # At least 20 days
                return None
            if len(df_1h) < 20:
                return None
            if len(df_15m) < 20:
                return None

            # -------------------------------------------------
            # 🧼 CLEAN & NORMALIZE
            # -------------------------------------------------
            def _clean(df: pd.DataFrame) -> pd.DataFrame:
                df = df.copy()

                # Standart OHLCV isimlendirme
                df.columns = [c.strip().capitalize() for c in df.columns]

                # Duplicate timestamp temizliği
                if df.index.has_duplicates:
                    df = df[~df.index.duplicated(keep="last")]

                # Zaman sıralaması
                df.sort_index(inplace=True)

                # Temel veri bütünlüğü
                # Hacimsiz barları veya hatalı OHLC verilerini temizle
                df.dropna(subset=["Open", "High", "Low", "Close"], inplace=True)

                # Volume güvenli dönüşüm
                if "Volume" in df.columns:
                    df["Volume"] = (
                        pd.to_numeric(df["Volume"], errors="coerce")
                        .fillna(0.0)
                    )

                return df

            df_1d = _clean(df_1d)
            df_1h = _clean(df_1h)
            df_15m = _clean(df_15m)

            # Temizlik sonrası son kontrol (Veri kaybı olduysa ele)
            if (
                len(df_1d) < MIN_BARS_1D
                or len(df_1h) < MIN_BARS_1H
                or len(df_15m) < MIN_BARS_15M
            ):
                return None

            return {
                "1d": df_1d,
                "1h": df_1h,
                "15m": df_15m,
            }

        except Exception:
            # Hata durumunda (örn: delist olmuş hisse) sessizce geç
            return None
            
# ============================================================
# 4) BOGA FİNANS AI – INDICATOR ENGINE (INSTITUTIONAL)
#
# Zaman Dilimi Rolleri:
# - 1D  → Trend Fazı (Phase), Yapısal Eğim, NATR Kalitesi
# - 1H  → Sıkışma (Squeeze), Emilim (Absorption), VWAP İlişkisi
# - 15M → Mikro Kırılım (Micro Break)
# ============================================================

def calculate_boga_indicators(df: pd.DataFrame, tf: str) -> pd.DataFrame:
    """
    Master Plan v3.1 - GÜVENLİ İndikatör Seti
    Veri kaybını önlemek için 'dropna' yerine 'fillna' ve manuel hesaplama kullanır.
    """
    df = df.copy()
    
    # Veri yetersizse hesaplama yapmadan dön
    if len(df) < 20: return df

    # --- EMA Hesapları ---
    df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()
    df["EMA50"] = df["Close"].ewm(span=50, adjust=False).mean()
    df["EMA200"] = df["Close"].ewm(span=200, adjust=False).mean()
    # Slope için 5 bar yetmezse 0 bas
    df["EMA200_Slope"] = df["EMA200"].diff(periods=5).fillna(0)

    # --- ATR (Manuel Hesap - Kütüphane Bağımsız) ---
    # Kütüphane sorunlarını ve NaN riskini minimize eder
    prev_close = df["Close"].shift(1)
    tr1 = df["High"] - df["Low"]
    tr2 = (df["High"] - prev_close).abs()
    tr3 = (df["Low"] - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df["ATR"] = tr.rolling(14, min_periods=1).mean() # min_periods=1: tek bar bile olsa hesapla
    
    # NATR (Normalized ATR)
    df["NATR"] = (df["ATR"] / df["Close"]) * 100

    # --- RSI (Wilder 14) ---
    try:
        df["RSI"] = RSIIndicator(close=df["Close"], window=14).rsi()
    except Exception:
        df["RSI"] = np.nan
    df["RSI"] = df["RSI"].fillna(50.0)

    # --- Hacim ve RVOL ---
    # 15M grafiğinde veri az olabilir, pencereyi 20 bara sabitledik
    window_vol = 20
    
    df["VolMA"] = df["Volume"].rolling(window=window_vol, min_periods=1).mean()
    # Sıfıra bölünme hatasını önle (replace 0 with 1)
    df["RVOL"] = df["Volume"] / df["VolMA"].replace(0, 1) 

    # --- VPA (Effort vs Result) ---
    spread = (df["High"] - df["Low"]).replace(0, 0.01) # Spread 0 olamaz
    raw_effort = df["Volume"] / spread
    # Normalize effort (Kendi geçmişine göre)
    effort_ma = raw_effort.rolling(window=20, min_periods=1).mean()
    df["VPA_Effort"] = raw_effort / effort_ma.replace(0, 1)

    # --- Bollinger Bands (Manuel - Squeeze için) ---
    sma = df["Close"].rolling(20, min_periods=1).mean()
    std = df["Close"].rolling(20, min_periods=1).std()
    df["BB_Upper"] = sma + (2 * std)
    df["BB_Lower"] = sma - (2 * std)
    # Band genişliği
    df["BB_Width"] = (df["BB_Upper"] - df["BB_Lower"]) / sma.replace(0, 1)

    # --- ADX (Güvenli Hesaplama) ---
    try:
        # Kütüphane varsa kullan
        adx_ind = ADXIndicator(df["High"], df["Low"], df["Close"], window=14)
        df["ADX"] = adx_ind.adx().fillna(0)
    except:
        # Kütüphane hatası olursa veya veri yetmezse "Trend Gücü" proxy'si
        # (Fiyat Değişimi / ATR) trendin gücünü kabaca gösterir
        df["ADX"] = (df["Close"] - df["Close"].shift(10)).abs() / df["ATR"].replace(0, 1) * 10
        df["ADX"] = df["ADX"].fillna(0)

    # Trend Phase Mapping
    conditions = [
        (df["ADX"] < 20), 
        (df["ADX"] >= 20) & (df["ADX"] < 45),
        (df["ADX"] >= 45)
    ]
    choices = ["ACCUMULATION", "EXPANSION", "EXHAUSTION"]
    df["Trend_Phase"] = np.select(conditions, choices, default="ACCUMULATION")

    # --- VWAP Proxy (Rolling) ---
    v = df["Volume"].values
    tp = (df["High"] + df["Low"] + df["Close"]).values / 3
    # Rolling VWAP Hesabı
    vp = pd.Series(tp * v)
    vol_sum = df["Volume"].rolling(20, min_periods=1).sum().replace(0, 1)
    df["VWAP_Roll"] = vp.rolling(20, min_periods=1).sum() / vol_sum

    # --- KRİTİK DEĞİŞİKLİK: TEMİZLİK ---
    # dropna() yerine fillna() kullanıyoruz ki veri silinmesin.
    # EMA hesaplamaları baştaki verileri NaN yapar, onları geriye dönük dolduruyoruz.
    df = df.bfill() 
    df.fillna(0, inplace=True) # Hala NaN varsa 0 yap

    return df
    
# ================================================================
# 5) BOGA FİNANS AI – 15M TIMING & MICRO STRUCTURE ENGINE
# ================================================================

def detect_15m_timing_pattern(df_15m: pd.DataFrame) -> tuple[str, float]:
    """
    15M Mikro Yapı Analizi (Institutional MSB)
    Amaç: Mum şekillerinden ziyade, Yapı Kırılımı (Breakout) ve
    Hacim (Volume) onaylı dönüşleri tespit etmek.

    Çıktı:
    - pattern_name (MSB, EMA Reclaim, Liquidity Grab)
    - timing_score (0.0 – 3.0)
    """
    try:
        if len(df_15m) < 21:
            return "Insufficient Data", 0.0

        curr = df_15m.iloc[-1]
        prev = df_15m.iloc[-2]
        
        # Temel Veriler
        close = curr["Close"]
        open_p = curr["Open"]
        vol = curr["Volume"]
        
        # 15M İndikatörleri (Anlık Hesaplama)
        ema20 = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
        
        # Hacim Ortalaması (Son 20 bar)
        avg_vol = df_15m["Volume"].rolling(20).mean().iloc[-1]
        rvol_15m = vol / avg_vol if avg_vol > 0 else 0
        
        # Lokal Yapı (Son 20 barın en yükseği - Hariç son bar)
        recent_high = df_15m["High"].iloc[-21:-1].max()
        
        is_green = close > open_p
        
        # ---------------------------------------------------------
        # 1️⃣ MSB: Micro Structure Break (En Güçlü Sinyal)
        # Son 20 barın tepesini, hacimli bir şekilde kırma.
        # ---------------------------------------------------------
        if close > recent_high and is_green:
            if rvol_15m > 2.5: # YENİ: Opsiyon Sweep benzeri devasa taze para girişi
                return "🚀 HYPER MSB (Smart Money Sweep)", 4.0
            elif rvol_15m > 1.5:
                return "🔥 MSB + Vol Breakout", 3.0

        # ---------------------------------------------------------
        # 2️⃣ EMA20 Reclaim (Trende Geri Dönüş)
        # Fiyat EMA20'nin altındaydı, şimdi üstüne hacimli attı.
        # ---------------------------------------------------------
        prev_close = prev["Close"]
        prev_ema20 = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-2]
        
        if prev_close < prev_ema20 and close > ema20 and rvol_15m > 1.2:
            return "⚡ EMA20 Reclaim", 2.5

        # ---------------------------------------------------------
        # 3️⃣ Consolidation Breakout (Sıkışma Kırılımı)
        # Daralan bir yapıdan yukarı patlama.
        # ---------------------------------------------------------
        # Son 5 barın range'i (ATR'ye göre düşükse sıkışmadır)
        atr_15m = df_15m["ATR"].iloc[-1]
        recent_range = (df_15m["High"].iloc[-5:].max() - df_15m["Low"].iloc[-5:].min())
        
        if recent_range < (2.0 * atr_15m): # Sıkışma var
            if close > df_15m["High"].iloc[-5:-1].max() and rvol_15m > 1.3:
                 return "📦 Consolidation Breakout", 2.2

        # ---------------------------------------------------------
        # 4️⃣ Liquidity Grab (Fitil Atıp Dönme - Hammer/Pinbar)
        # ---------------------------------------------------------
        # Kurumsal "Stop Patlatma" mumu. Aşağı uzun fitil, yukarı kapanış.
        body = abs(close - open_p)
        lower_wick = min(close, open_p) - curr["Low"]
        
        if lower_wick > (body * 2.5) and rvol_15m > 1.5:
            return "🪝 Liquidity Grab (Pinbar)", 2.0

        # ---------------------------------------------------------
        # 5️⃣ Standart Bullish Engulfing (İkincil Sinyal)
        # ---------------------------------------------------------
        if is_green and prev["Close"] < prev["Open"]:
            if close > prev["Open"] and open_p < prev["Close"]:
                 return "🕯️ Bullish Engulfing", 1.0

        return "Neutral", 0.0

    except Exception:
        return "Pattern Error", 0.0
        
# ================================================================
# 🦅 BOGA FİNANS AI – 15M ENTRY TIMING ASSESSMENT
# ================================================================

def assess_15m_entry_timing(
    df_15m: pd.DataFrame,
    df_1h: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Entry Timing Assessment.
    Doesn't make a trade decision, measures the suitability of the 'Pull the Trigger' moment.
    """

    try:
        c15 = df_15m.iloc[-1]
        c1h = df_1h.iloc[-1]

        timing_notes = []
        timing_score = 0.0

        # ------------------------------------------------
        # 1️⃣ Micro Structure (Pattern) Analysis
        # ------------------------------------------------
        pattern, pattern_score = detect_15m_timing_pattern(df_15m)
        timing_score += pattern_score
        
        if pattern_score > 0:
            timing_notes.append(f"15M Trigger: {pattern}")

        # ------------------------------------------------
        # 2️⃣ 1H and 15M Trend Alignment (MTF Alignment)
        # ------------------------------------------------
        price = float(c15["Close"])
        ema20_1h = float(c1h.get("EMA20", 0))
        ema50_1h = float(c1h.get("EMA50", 0))
        ema20_15m = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
        
        is_15m_bullish = price > ema20_15m

        # Ideal Synchronization: 15M and 1H looking up at the same time
        if price > ema20_1h > 0 and is_15m_bullish:
            timing_score += 2.0
            timing_notes.append("✅ MTF Aligned: 1H & 15M Bullish")
        
        # Acceptable: 1H in pullback zone but 15M has started reversal
        elif price > ema50_1h > 0 and is_15m_bullish:
            timing_score += 1.0
            timing_notes.append("Aligned with 1H EMA50 & 15M Trend")
        
        # Risky: Conflict state (1H falling or 15M not yet confirmed)
        else:
            timing_score -= 2.0
            timing_notes.append("⚠️ MTF Conflict: 1H vs 15M Mismatch")
        # Don't enter if price is too far from 15M EMA20 (Mean Reversion risk).
        ema20_15m = df_15m["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
        atr_15m = float(c15.get("ATR", c15["Close"]*0.01))
        dist_from_ema = (price - ema20_15m) / (atr_15m + 1e-9)
        if dist_from_ema > 2.0:
            timing_notes.append("⛔ Extended (Don't Chase)")
            timing_score -= 2.0 # Serious penalty

        # ------------------------------------------------
        # RESULT (STATE MACHINE)
        # ------------------------------------------------
        # READY: Strong breakout and aligned with main trend.
        # FORMING: Structure forming but not yet fully triggered.
        return {
            "timing_score": round(timing_score, 2),
            "timing_state": (
                "READY"
                if timing_score >= 4.0
                else "FORMING"
                if timing_score >= 2.0
                else "WAIT"
            ),
            "pattern_name": pattern,
            "notes": timing_notes,
        }

    except Exception as e:
        return {
            "timing_score": 0.0,
            "timing_state": "ERROR",
            "pattern_name": "Pattern Error",
            "notes": [str(e)],
        }
        
# ================================================================
# 🧠 BOGA FİNANS AI – STRATEGIC ANALYSIS ENGINE
# ================================================================

def analyze_1d_context(df_1d: pd.DataFrame) -> Dict[str, Any]:
    """
    1D Structural Analysis (Institutional Context)
    Checks: NATR Quality, Trend Phase, Structural Slope, Invalidation Level.
    """
    try:
        curr = df_1d.iloc[-1]
        
        # 1️⃣ VOLATILITY QUALITY CHECK (NATR)
        # Test the stock's character first.
        natr = curr.get("NATR", 0.0)
        vol_score = 0.0
        vol_note = ""
        
        # Institutional Sweet Spot: %2.5 - %6.0
        if natr < 2.0:
            return {"structure": "DEAD_MONEY", "1d_score": -99, "1d_notes": ["NATR < 2% (Too Stable)"]}
        elif natr > 7.5:
            return {"structure": "HIGH_RISK", "1d_score": -99, "1d_notes": ["NATR > 7.5% (Gamble)"]}
        elif 2.5 <= natr <= 6.0:
            vol_score = 2.0
            vol_note = "Vol: Prime Swing"
        else:
            vol_score = 1.0 # Kabul edilebilir sınır
            vol_note = "Vol: Acceptable"

        # 2️⃣ TREND ALIGNMENT (EMA Slope)
        # NO institutional trend if EMA200 is not sloping up.
        ema200_slope = curr.get("EMA200_Slope", 0)
        price = curr["Close"]
        ema50 = curr.get("EMA50", 0)
        
        trend_score = 0.0
        
        if ema200_slope > 0 and price > ema50:
            trend_score = 3.0 # Strong Trend
        elif price > ema50:
            trend_score = 1.5 # Recovery / Early Trend
        else:
            return {"structure": "BEARISH", "1d_score": -50, "1d_notes": ["Price below EMA50 & Slope Negative"]}

        # 3️⃣ TREND PHASE (ADX Based)
        phase = curr.get("Trend_Phase", "UNKNOWN")
        phase_score = 0.0
        
        if phase == "EXPANSION":
            phase_score = 2.5
        elif phase == "ACCUMULATION":
            phase_score = 1.5 # Early entry opportunity
        elif phase == "EXHAUSTION":
            phase_score = -2.0 # Too late
            
        # 4️⃣ INVALIDATION LEVEL (Pivot Low)
        # The lowest of the last 20 days is the structural stop level.
        pivot_low = df_1d["Low"].iloc[-20:].min()

        # RESULT
        total_score = vol_score + trend_score + phase_score
        notes = [f"Phase: {phase}", vol_note]
        if ema200_slope > 0: notes.append("Slope: Positive")

        return {
            "structure": phase,
            "1d_score": total_score,
            "1d_notes": notes,
            "invalidation_level": pivot_low
        }

    except Exception:
        return {"structure": "ERROR", "1d_score": 0, "1d_notes": [], "invalidation_level": 0}
        

def evaluate_hourly_status(current_price: float, entry_zone: str, target: float, stop_loss: float, rsi_1h: float, rsi_15m: float = 50.0, trend_1h: str = "FLAT", swing_data: dict = None) -> dict:
    """
    BOGA FİNANS AI – Hourly Swing Trade Status Engine (1H + 15M timeframe logic)

    Status codes:
      ENTRY_NOW       – Price in buy zone, timing confirmed → open position
      ENTRY_WATCH     – Approaching buy zone, not yet triggered
      WAIT            – Price extended above entry, wait for pullback
      HOLD            – In position between entry and TP1, trend intact
      TIGHTEN_STOP    – Price past mid-range, trail stop to entry
      PARTIAL_PROFIT  – TP1 reached but 1H/15M momentum still bullish → take 40-50%, let rest run
      TAKE_PROFIT     – TP2 reached or momentum reversing → close full position
      STOP_ALERT      – Within 2% of stop zone, prepare to exit
      STOP_HIT        – Price at/below stop zone → exit immediately
      SCALE_IN        – Price dipped back into buy zone while already positioned
    """
    try:
        # ── Parse zones ───────────────────────────────────────────────────────
        profit_low  = target
        profit_high = target
        stop_high   = stop_loss

        if swing_data:
            pz = swing_data.get("profit_zone") or swing_data.get("sell_zone") or {}
            sz = swing_data.get("stop_zone")   or swing_data.get("stop_loss_zone") or {}
            profit_low  = float(pz.get("low",  target))
            profit_high = float(pz.get("high", target))
            stop_high   = float(sz.get("high", stop_loss))

        parts = entry_zone.replace(" ", "").split("-")
        if len(parts) == 2:
            try:
                entry_low, entry_high = float(parts[0]), float(parts[1])
            except ValueError:
                entry_low, entry_high = current_price * 0.97, current_price * 1.02
        else:
            entry_low, entry_high = current_price * 0.97, current_price * 1.02

        in_buy_zone     = entry_low * 0.99  <= current_price <= entry_high * 1.01
        above_buy_zone  = current_price > entry_high * 1.01
        dist_to_stop_pct = ((current_price - stop_high) / stop_high * 100) if stop_high > 0 else 99

        # ── 1. STOP HIT (SELL) ────────────────────────────────────────────────
        if current_price <= stop_high:
            return {
                "status": "STOP_HIT",
                "msg": f"SELL (STOP) 🔴 Price below stop level (${stop_high:.2f})."
            }

        # ── 2. PROFIT REACHED (SELL) ──────────────────────────────────────────
        if current_price >= profit_low:
            return {
                "status": "TAKE_PROFIT",
                "msg": f"SELL (PROFIT) 🟢 Target zone reached (${profit_low:.2f}). Profit realization appropriate."
            }

        # ── 3. IN BUY ZONE (BUY/ACCUMULATE) ───────────────────────────────────
        if in_buy_zone:
            if trend_1h == "DOWN" and rsi_15m < 30:
                return {
                    "status": "WAIT",
                    "msg": f"BUY (WAIT) ⏳ In buy zone but 15M trend weak. Wait for stabilization."
                }
            return {
                "status": "ENTRY_NOW",
                "msg": f"BUY ✅ Buy zone active (${entry_low:.2f}–${entry_high:.2f}). Entry suitable."
            }

        # ── 4. ABOVE BUY ZONE (HOLD) ──────────────────────────────────────────
        if above_buy_zone:
            return {
                "status": "HOLD",
                "msg": f"HOLD 💎 Above buy zone. Progressing towards target. Stop: ${stop_high:.2f}."
            }

        # ── 5. BELOW BUY ZONE (WATCH) ─────────────────────────────────────────
        return {
            "status": "ENTRY_WATCH",
            "msg": f"WATCH 👀 Waiting to enter buy zone. Zone: ${entry_low:.2f}–${entry_high:.2f}."
        }

    except Exception as e:
        return {"status": "UNKNOWN", "msg": "Failed to calculate status."}
        
        
def analyze_1h_structure(df_1h: pd.DataFrame) -> Dict[str, Any]:
    """
    1H Tactical Analysis (Boga Finans AI - Institutional Footprint)
    Focus: VWAP Defense Area, Absorption, Volatility Squeeze
    """
    try:
        curr = df_1h.iloc[-1]

        score = 0.0
        setup = "NONE"
        notes = []

        # =========================
        # 1️⃣ INSTITUTIONAL VALUE ZONE (VWAP & EMA50) – ATR BASED
        # =========================
        price = curr["Close"]
        ema50 = curr.get("EMA50", 0.0)
        vwap = curr.get("VWAP_Roll", 0.0)
        atr = curr.get("ATR", price * 0.01)

        # ATR-based distance (Institutional Approach)
        vwap_dist_atr = abs(price - vwap) / atr if atr > 0 else 99
        ema50_dist_atr = abs(price - ema50) / atr if atr > 0 else 99

        # Defense / Acceptable / Extended Separation
        in_defense_zone = (vwap_dist_atr <= 0.8) or (ema50_dist_atr <= 0.8)
        in_acceptable_zone = (vwap_dist_atr <= 1.5) or (ema50_dist_atr <= 1.5)

        if in_defense_zone and price >= ema50:
            score += 2.0
            notes.append("VWAP/EMA50 Defense Zone")
        elif in_acceptable_zone and price >= ema50:
            score += 0.8
            notes.append("VWAP/EMA50 Acceptable Zone")
        else:
            notes.append("VWAP Extended")

        # =========================
        # 2️⃣ ABSORPTION (High Effort / Low Result)
        # =========================
        vpa_effort = curr.get("VPA_Effort", 1.0)
        rvol = curr.get("RVOL", 1.0)

        absorption = (vpa_effort > 1.8) and (rvol > 1.5)

        if absorption:
            score += 3.0
            setup = "ABSORPTION"
            notes.append("🔥 Institutional Absorption")

        # =========================
        # 3️⃣ COILED SPRING (Bollinger Squeeze)
        # =========================
        bb_width = curr.get("BB_Width", 10.0)
        avg_width = df_1h["BB_Width"].rolling(20).mean().iloc[-1]

        squeeze = bb_width < (avg_width * 0.7)

        if squeeze and not absorption:
            score += 2.0
            setup = "SQUEEZE"
            notes.append("⚡ Bollinger Squeeze")

        # =========================
        # 4️⃣ MOMENTUM CONFIRMATION (ADX + VOLUME)
        # =========================
        adx = curr.get("ADX", 0.0)

        # Massive Institutional Buy (Fresh Money) in 1H Chart
        if rvol > 2.5 and price > curr.get("Open", price):
            score += 2.5
            setup = "AGGRESSIVE_BUY"
            notes.append("🚀 1H Institutional Sweep (Massive Volume)")

        # ADX Momentum Confirmation (Stop chasing if ADX > 45)
        if 18 <= adx <= 45 and (absorption or rvol > 1.3):
            score += 1.0
            notes.append("ADX + Volume Confirmation")

        return {
            "setup_type": setup,
            "1h_score": score,
            "1h_notes": notes,
            "vpa_signal": absorption
        }

    except Exception as e:
        return {
            "setup_type": "ERROR",
            "1h_score": 0.0,
            "1h_notes": [str(e)],
            "vpa_signal": False
        }
        
def _session_minutes_elapsed(now_ny: Optional[datetime] = None) -> float:
    """Dakika cinsinden 09:30 NY açılışından bu yana geçen süre (15-390 arası clamp edilir)."""
    now_ny = now_ny or datetime.now(NY_TZ)
    open_dt = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)
    elapsed = (now_ny - open_dt).total_seconds() / 60.0
    return max(15.0, min(390.0, elapsed))


def _today_intraday_mask(df: pd.DataFrame) -> pd.Series:
    """Intraday df içinde bugüne (NY takvimi) ait barları işaretler."""
    today = datetime.now(NY_TZ).date()
    idx = df.index
    try:
        idx = idx.tz_convert(NY_TZ) if idx.tz is not None else idx
    except Exception:
        pass
    return pd.Series(idx.date == today, index=df.index)


def get_today_hourly_closes(ticker: str) -> List[float]:
    """Bugüne ait saatlik arşiv dosyalarından (intraday_history/) ticker'ın fiyat zincirini okur."""
    closes: List[float] = []
    try:
        today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
        if not os.path.isdir(INTRADAY_HISTORY_DIR):
            return closes
        files = sorted(
            f for f in os.listdir(INTRADAY_HISTORY_DIR)
            if f.startswith(today_str + "T") and f.endswith(".json")
        )
        for fname in files:
            try:
                with open(os.path.join(INTRADAY_HISTORY_DIR, fname), encoding="utf-8") as f:
                    data = json.load(f)
                for sig in data.get("signals", []):
                    if sig.get("ticker") == ticker:
                        price = sig.get("current_price")
                        if price:
                            closes.append(float(price))
                        break
            except Exception:
                continue
    except Exception:
        pass
    return closes


def compute_gap_up_score(
    ticker: str,
    current_price: float,
    df_1d: pd.DataFrame,
    df_15m: pd.DataFrame,
) -> Dict[str, Any]:
    """
    BOGA FİNANS AI – PRE-GAP / GAP-UP SKORU (0-15)
    Ertesi gün açılışta GAP UP olasılığını 5 bağımsız bileşenden hesaplar:
      1) Açılış GAP%            (bugünün açılışı vs dünün kapanışı)
      2) Saatlik momentum zinciri (gün içi saatlik kapanışların yön tutarlılığı)
      3) Günlük RVOL             (zaman dilimine göre normalize edilmiş hacim oranı)
      4) Kapanış / Gün İçi Zirve (kurumsal "closing near high" sinyali)
      5) Son 30 dakika hacim patlaması
    Her bileşen 0-3 puan, toplam 0-15. Grade: A+(12-15) A(10-12) B(7-10) C(<7)
    """
    result: Dict[str, Any] = {
        "gap_pct": 0.0, "gap_score": 0,
        "hourly_strength_pct": 0.0, "hourly_score": 0,
        "daily_rvol": 0.0, "daily_rvol_score": 0,
        "close_to_high_pct": 0.0, "close_to_high_score": 0,
        "late_volume_ratio": 0.0, "late_volume_score": 0,
        "pre_gap_total": 0, "pre_gap_grade": "C", "pre_gap": False,
    }
    try:
        today = datetime.now(NY_TZ).date()
        today_dates = df_1d.index.date if len(df_1d) else []
        is_today_bar = len(today_dates) > 0 and today_dates[-1] == today

        mask = _today_intraday_mask(df_15m)
        today_bars = df_15m.loc[mask]

        # 1️⃣ GAP % ----------------------------------------------------------
        if len(df_1d) >= 2 and not today_bars.empty:
            yesterday_close = float(df_1d["Close"].iloc[-2]) if is_today_bar else float(df_1d["Close"].iloc[-1])
            today_open = float(today_bars["Open"].iloc[0])
            if yesterday_close > 0:
                gap_pct = ((today_open - yesterday_close) / yesterday_close) * 100
                result["gap_pct"] = round(gap_pct, 2)
                result["gap_score"] = 3 if gap_pct > 5 else 2 if gap_pct >= 3 else 1 if gap_pct >= 1 else 0

        # 2️⃣ Saatlik momentum zinciri ----------------------------------------
        chain = get_today_hourly_closes(ticker) + [current_price]
        moves = len(chain) - 1
        if moves > 0:
            ups = sum(1 for i in range(1, len(chain)) if chain[i] > chain[i - 1])
            ratio = ups / moves
            result["hourly_strength_pct"] = round(((chain[-1] - chain[0]) / chain[0]) * 100, 2) if chain[0] else 0.0
            result["hourly_score"] = 3 if ratio >= 0.75 else 2 if ratio >= 0.5 else 1 if ratio > 0 else 0

        # 3️⃣ Günlük RVOL (zaman-normalize) -----------------------------------
        if len(df_1d) >= 21 and is_today_bar:
            today_vol = float(df_1d["Volume"].iloc[-1])
            avg20 = float(df_1d["Volume"].iloc[-21:-1].mean())
            if avg20 > 0:
                projected_vol = today_vol * (390.0 / _session_minutes_elapsed())
                daily_rvol = projected_vol / avg20
                result["daily_rvol"] = round(daily_rvol, 2)
                result["daily_rvol_score"] = 3 if daily_rvol >= 4 else 2 if daily_rvol >= 2.5 else 1 if daily_rvol >= 1.5 else 0

        # 4️⃣ Kapanış / Gün İçi Zirve ------------------------------------------
        if not today_bars.empty:
            day_high = float(today_bars["High"].max())
            if day_high > 0:
                cth_pct = (current_price / day_high) * 100
                result["close_to_high_pct"] = round(cth_pct, 2)
                result["close_to_high_score"] = 3 if cth_pct >= 98 else 2 if cth_pct >= 95 else 1 if cth_pct >= 90 else 0

        # 5️⃣ Son 30 Dakika Hacim Patlaması ------------------------------------
        if len(df_15m) >= 12:
            avg_vol_10 = df_15m["Volume"].rolling(10).mean().iloc[-1]
            curr_vol_2 = df_15m["Volume"].iloc[-2:].mean()
            if avg_vol_10 and avg_vol_10 > 0:
                lv_ratio = curr_vol_2 / avg_vol_10
                result["late_volume_ratio"] = round(float(lv_ratio), 2)
                result["late_volume_score"] = 3 if lv_ratio >= 2.0 else 2 if lv_ratio >= 1.5 else 1 if lv_ratio >= 1.2 else 0

        total = (
            result["gap_score"] + result["hourly_score"] + result["daily_rvol_score"]
            + result["close_to_high_score"] + result["late_volume_score"]
        )
        result["pre_gap_total"] = total
        result["pre_gap_grade"] = "A+" if total >= 12 else "A" if total >= 10 else "B" if total >= 7 else "C"
        result["pre_gap"] = total >= 10

    except Exception as e:
        logging.debug(f"{ticker}: compute_gap_up_score warning: {e}")

    return result

async def process_single_stock(ticker: str) -> Optional[Dict[str, Any]]:
    """
    BOGA FİNANS AI - MASTER PROCESSOR
    Institutional Swing Engine (1–7 Day Analysis)
    
    Features:
    - AI and Sentiment dependencies completely removed (Pure Technical/Volume).
    - BOGA_SWING_ZONES (Archive) integration ensured.
    - Volume validation and Market Cap/Sector info added.
    - Stable mathematical infrastructure with NaN/Inf protection.
    """

    # ================================================
    # 1. DATA FETCHING
    # ================================================
    data_pack = await get_boga_data(ticker)
    if not data_pack:
        return None

    # ================================================
    # 2. INDICATOR CALCULATIONS
    # ================================================
    try:
        df_1d = calculate_boga_indicators(data_pack["1d"], "1d")
        df_1h = calculate_boga_indicators(data_pack["1h"], "1h")
        df_15m = calculate_boga_indicators(data_pack["15m"], "15m")
    except Exception as e:
        logging.warning(f"{ticker}: Indicator calculation failed: {e}")
        return None

    # 🛑 ERROR PREVENTION CHECK
    if df_1d.empty or df_1h.empty or df_15m.empty:
        return None

    # ================================================
    # 3. RELATIVE STRENGTH (RS) – GRADUAL
    # ================================================
    rs_score = 0.0
    rs_note = ""

    try:
        # At least 6 bars required (for 5-day prior comparison)
        if len(df_1d) > 5:
            close_curr = df_1d["Close"].iloc[-1]
            close_5d = df_1d["Close"].iloc[-6]
            stock_5d_pct = ((close_curr - close_5d) / close_5d) * 100

            spy_5d_pct = MARKET_CONTEXT.get("spy_5d_pct", 0.0)

            # Strong decoupling (Stock rising while market falls)
            if spy_5d_pct < -0.5 and stock_5d_pct > 0:
                rs_score = 3.0
                rs_note = "🛡️ RS: Strong Decoupling"
            # Clear outperformance
            elif stock_5d_pct > spy_5d_pct + 2.0:
                rs_score = 2.0
                rs_note = "🚀 RS: Outperformer"
            # Relative resilience
            elif stock_5d_pct > spy_5d_pct - 0.5:
                rs_score = 1.0
                rs_note = "🧱 RS: Resilient"

    except Exception as e:
        logging.debug(f"{ticker}: RS calculation warning: {e}")
        rs_score = 0.0
        rs_note = ""

    # ================================================
    # 4. ANALYSIS BLOCKS
    # ================================================
    ctx_1d = analyze_1d_context(df_1d)
    st_1h = analyze_1h_structure(df_1h)
    timing_15m = assess_15m_entry_timing(df_15m, df_1h)

    # ================================================
    # 5. PRICE & CHANGE METRICS
    # ================================================
    current_price = float(df_15m["Close"].iloc[-1])
    change_1h = 0.0
    change_24h = 0.0

    try:
        import math
        # 1H Change
        if len(df_1h) >= 2:
            prev_1h_close = float(df_1h["Close"].iloc[-2])
            if prev_1h_close > 0:
                change_1h = ((current_price - prev_1h_close) / prev_1h_close) * 100
        # 24H Change
        if len(df_1d) >= 2:
            prev_1d_close = float(df_1d["Close"].iloc[-2])
            if prev_1d_close > 0:
                change_24h = ((current_price - prev_1d_close) / prev_1d_close) * 100

        # NaN / Inf Protection
        if math.isnan(change_1h) or math.isinf(change_1h): change_1h = 0.0
        if math.isnan(change_24h) or math.isinf(change_24h): change_24h = 0.0
    except Exception:
        change_1h = change_24h = 0.0

    atr_val = float(df_1d["NATR"].iloc[-1])
    atr_abs = float(df_1d["ATR"].iloc[-1])
    rvol = float(df_1h["RVOL"].iloc[-1])

    # ================================================
    # 6. GAP-UP / PRE-GAP SKORU (5 bileşen, 0-15) — her taramada hesaplanır
    # ================================================
    pre_gap_setup = compute_gap_up_score(ticker, current_price, df_1d, df_15m)

    # ================================================
    # 7. WEIGHTED SCORING (INSTITUTIONAL BALANCING)
    # ================================================
    final_score = (
        (rs_score * 1.8) +                          # RS: Highest weight
        (st_1h.get("1h_score", 0) * 1.1) +          # 1H Structure and Money Flow
        (ctx_1d.get("1d_score", 0) * 1.1) +          # 1D Trend Phase
        (timing_15m.get("timing_score", 0) * 0.5)    # 15M Fine Tuning
    )

    if pre_gap_setup.get("pre_gap", False):
        final_score += 1.5
    final_score += pre_gap_setup.get("pre_gap_total", 0) * 0.1   # GAP-UP skorundan sürekli ince ayar (0-15 -> 0-1.5)

    # Market risk modifiyeri
    risk_modifier = MARKET_CONTEXT.get("risk_modifier", 1.0)
    final_score *= risk_modifier

    # ================================================
    # 8. ENTRY ZONE & STOP LOSS HESAPLAMA (MASTER SYNC)
    # ================================================
    # Arşivlenmiş bölgeleri al (BOGA_SWING_ZONES)
    swing_info = BOGA_SWING_ZONES.get(ticker)
    
    if swing_info:
        bz = swing_info.get("buying_zone", {})
        pz = swing_info.get("sell_zone", {})
        sz = swing_info.get("stop_loss_zone", {})
        
        entry_low = bz.get("low")
        entry_high = bz.get("high")
        target_val = pz.get("high") or pz.get("low")
        stop_val = sz.get("high") or sz.get("low")
        
        # ATR Fallback if archive is missing
        if entry_low is None or entry_high is None:
            entry_low, entry_high = current_price - (atr_abs * 0.5), current_price + (atr_abs * 0.5)
        if target_val is None: target_val = current_price + (atr_abs * 3.0)
        if stop_val is None: stop_val = current_price - (2.0 * atr_abs)

        scenario = {
            "entry_zone": f"{entry_low:.2f} - {entry_high:.2f}",
            "stop_loss": round(stop_val, 2),
            "stop_type": "MASTER_ARCHIVE",
            "target": round(target_val, 2),
            "target_agg": round(target_val * 1.1, 2),
            "potential_pct": round((target_val - current_price) / current_price * 100, 2) if current_price > 0 else 0,
            "rr_ratio": 2.0
        }
    else:
        # Fallback if not in archive
        entry_low, entry_high = current_price - (atr_abs * 0.5), current_price + (atr_abs * 0.5)
        stop_loss = current_price - (2.0 * atr_abs)
        target_cons = current_price + (abs(current_price - stop_loss) * 2.0)
        scenario = {
            "entry_zone": f"{entry_low:.2f} - {entry_high:.2f}",
            "stop_loss": round(stop_loss, 2),
            "stop_type": "Volatility (2ATR)",
            "target": round(target_cons, 2),
            "target_agg": round(current_price + (abs(current_price - stop_loss) * 3.5), 2),
            "potential_pct": round((target_cons - current_price) / current_price * 100, 2) if current_price > 0 else 0,
            "rr_ratio": 2.0
        }
    
    # ================================================
    # 9. VOLUME VALIDATION
    # ================================================
    setup_type = st_1h.get("setup_type", "NONE")
    volume_check = validate_volume_for_setup(setup_type, rvol, df_15m, df_1h, ticker)
    if not volume_check.get('valid', True):
        final_score -= 2.0

    # ================================================
    # 10. ACTION LOGIC
    # ================================================
    action = "WATCH"
    if final_score >= 7.0:
        action = "BUY"
        if pre_gap_setup.get("pre_gap") and pre_gap_setup.get("pre_gap_total", 0) >= 10:
            action = "CLOSE" # Closing action

    if action not in ["BUY", "CLOSE"]:
        action = "WATCH"

    # ================================================
    # 11. MARKET CAP, SECTOR & COMPANY NAME (cache'li, asla eksik dönmez)
    # ================================================
    stock_info = get_stock_info(ticker)
    market_cap = stock_info["market_cap"]
    sector = stock_info["sector"]
    company_name = stock_info["company"]

    # ================================================
    # 12. NOTES AND STATUS ANALYSIS
    # ================================================
    all_notes = []
    if rs_note: all_notes.append(rs_note)
    all_notes.extend(ctx_1d.get("1d_notes", []))
    all_notes.extend(st_1h.get("1h_notes", []))
    all_notes.extend(timing_15m.get("notes", []))
    if pre_gap_setup.get("pre_gap"): all_notes.append(f"🏦 GAP-UP {pre_gap_setup.get('pre_gap_grade','')} ({pre_gap_setup.get('pre_gap_total',0)}/15)")
    if not volume_check.get('valid', True): all_notes.append(f"⚠️ {volume_check.get('message', 'Volume weak')}")

    # RSI and Trend Calculation (for Hourly Status)
    rsi_val = float(df_1h["RSI"].iloc[-1]) if "RSI" in df_1h.columns else 50.0
    rsi_15m_val = float(df_15m["RSI"].iloc[-1]) if "RSI" in df_15m.columns else 50.0
    
    trend_1h = "FLAT"
    if len(df_1h) >= 3:
        if df_1h["Close"].iloc[-1] < df_1h["Close"].iloc[-3] * 0.99: trend_1h = "DOWN"
        elif df_1h["Close"].iloc[-1] > df_1h["Close"].iloc[-3] * 1.01: trend_1h = "UP"

    hourly_status = evaluate_hourly_status(
        current_price=current_price,
        entry_zone=scenario["entry_zone"],
        target=scenario["target"],
        stop_loss=scenario["stop_loss"],
        rsi_1h=rsi_val,
        rsi_15m=rsi_15m_val,
        trend_1h=trend_1h,
        swing_data=BOGA_SWING_ZONES.get(ticker)
    )

    # ================================================
    # 13. FINAL OUTPUT
    # ================================================
    return {
        "symbol": ticker,
        "company": company_name,
        "score": round(final_score, 1),
        "price": round(current_price, 2),
        "action": action,
        "timing": action,
        "source_bucket": "Boga_Universe",

        "hourly_action": hourly_status["status"],
        "hourly_msg": hourly_status["msg"],

        "rsi_1h": round(rsi_val, 1),
        "adx_1h": round(float(df_1h["ADX"].iloc[-1]) if "ADX" in df_1h.columns else 0.0, 1),
        "trend_1h": trend_1h,
        "atr": round(atr_abs, 2),
        "natr": round(atr_val, 2),
        "rvol": round(rvol, 2),
        "rs_score": rs_score,
        "change_1h": round(change_1h, 2),
        "change_24h": round(change_24h, 2),
        "setup_type": setup_type,
        "pattern_15m": timing_15m.get("pattern_name", "Neutral"),
        "trend_phase": ctx_1d.get("structure", "UNKNOWN"),
        "entry_zone": scenario["entry_zone"],
        "stop_loss": scenario["stop_loss"],
        "stop_type": scenario["stop_type"],
        "target": scenario["target"],
        "potential_pct": scenario["potential_pct"],
        "sector": sector,
        "market_cap": market_cap,
        "notes": all_notes,
        # --- GAP-UP / PRE-GAP (5 bileşen, 0-15) ---
        "pre_gap": pre_gap_setup.get("pre_gap", False),
        "pre_gap_total": pre_gap_setup.get("pre_gap_total", 0),
        "pre_gap_grade": pre_gap_setup.get("pre_gap_grade", "C"),
        "pre_gap_score": pre_gap_setup.get("pre_gap_total", 0.0),   # geriye dönük uyumluluk
        "gap_pct": pre_gap_setup.get("gap_pct", 0.0),
        "gap_score": pre_gap_setup.get("gap_score", 0),
        "hourly_strength_pct": pre_gap_setup.get("hourly_strength_pct", 0.0),
        "hourly_score": pre_gap_setup.get("hourly_score", 0),
        "daily_rvol": pre_gap_setup.get("daily_rvol", 0.0),
        "daily_rvol_score": pre_gap_setup.get("daily_rvol_score", 0),
        "close_to_high_pct": pre_gap_setup.get("close_to_high_pct", 0.0),
        "close_to_high_score": pre_gap_setup.get("close_to_high_score", 0),
        "late_volume_ratio": pre_gap_setup.get("late_volume_ratio", 0.0),
        "late_volume_score": pre_gap_setup.get("late_volume_score", 0),
    }
# ============================================================
# 5) BOGA FİNANS AI – TELEGRAM YAPILANDIRMASI
# ============================================================

# 🔹 Telegram Notification Settings
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"
ENABLE_TELEGRAM_NOTIFICATIONS = True


_TELEGRAM_SESSION: Optional[aiohttp.ClientSession] = None


async def get_telegram_session() -> aiohttp.ClientSession:
    global _TELEGRAM_SESSION
    if _TELEGRAM_SESSION is None or _TELEGRAM_SESSION.closed:
        timeout = aiohttp.ClientTimeout(total=20)
        _TELEGRAM_SESSION = aiohttp.ClientSession(timeout=timeout)
    return _TELEGRAM_SESSION


def tg(text: str) -> str:
    """Telegram HTML sanitizer."""
    if not text:
        return ""

    escaped = html.escape(text)
    allowed = {
        "&lt;b&gt;": "<b>", "&lt;/b&gt;": "</b>",
        "&lt;i&gt;": "<i>", "&lt;/i&gt;": "</i>",
        "&lt;u&gt;": "<u>", "&lt;/u&gt;": "</u>",
        "&lt;code&gt;": "<code>", "&lt;/code&gt;": "</code>",
        "&lt;pre&gt;": "<pre>", "&lt;/pre&gt;": "</pre>",
    }
    for k, v in allowed.items():
        escaped = escaped.replace(k, v)
    return escaped

async def send_pre_gap_telegram(pre_gap_list: list[dict]) -> None:
    """Sends the institutional pre-gap absorption list."""
    if not pre_gap_list:
        return

    msg = (
        "🐂 <b>BOGA FİNANS AI | PRE-GAP WATCHLIST</b>\n"
        "🏦 Institutional Closing Absorption Detected\n"
        "📌 Action: BUY INTO CLOSE (LIMIT)\n\n"
    )

    for r in pre_gap_list[:8]:
        msg += f"• <b>{r['symbol']}</b> | Score: {r['pre_gap_score']}\n"

    msg += "\n⚠️ <i>Overnight risk – size accordingly.</i>"

    await send_telegram_message(msg)


def split_html_safe(text: str, max_len: int = 3900) -> list[str]:
    """Splits long messages without breaking HTML."""
    if len(text) <= max_len:
        return [text]

    parts: list[str] = []
    current: list[str] = []

    for ch in text:
        current.append(ch)
        if len(current) >= max_len:
            parts.append("".join(current))
            current = []

    if current:
        parts.append("".join(current))

    return parts


async def send_telegram_message(message: str) -> None:
    return  # 🚫 TELEGRAM MESAJ GÖNDERİMİ PASİF HALE GETİRİLDİ
    
    # İleride açmak istersen eski kodlar referans olarak burada duruyor:
    # if not ENABLE_TELEGRAM_NOTIFICATIONS:
    #     return
    # safe_text = tg(message)
    # parts = split_html_safe(safe_text)
    # session = await get_telegram_session()

    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"

    for part in parts:
        try:
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": part,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            }
            async with session.post(url, data=payload) as resp:
                if resp.status != 200:
                    logging.error(f"Telegram Msg Err: {await resp.text()}")
        except Exception as e:
            logging.error(f"Telegram Connection Err: {e}")


async def send_telegram_photo(photo_path: str, caption: str = "") -> None:
    return  # 🚫 TELEGRAM MESAJ GÖNDERİMİ PASİF HALE GETİRİLDİ
    if not ENABLE_TELEGRAM_NOTIFICATIONS:
        return
    if not os.path.exists(photo_path):
        return

    session = await get_telegram_session()
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendPhoto"

    try:
        with open(photo_path, "rb") as img:
            form = aiohttp.FormData()
            form.add_field("chat_id", TELEGRAM_CHAT_ID)
            form.add_field("caption", tg(caption))
            form.add_field("parse_mode", "HTML")
            form.add_field("photo", img, filename=os.path.basename(photo_path))

            async with session.post(url, data=form) as resp:
                if resp.status != 200:
                    logging.error(f"Telegram Photo Err: {await resp.text()}")

    except Exception as e:
        logging.error(f"Telegram Photo Exception: {e}")
        
# ============================================================
# 7) MARKET & SECTOR ANALYSIS — BOGA FINANCE AI (INSTITUTIONAL CONTEXT)
# ============================================================

MARKET_SEMAPHORE = asyncio.Semaphore(2)

if "SECTOR_ETF_MAP" not in globals():
    SECTOR_ETF_MAP = {
        "Technology": "XLK", "Finance": "XLF", "Energy": "XLE",
        "Healthcare": "XLV", "Consumer Disc": "XLY", "Industrials": "XLI",
        "Utilities": "XLU", "Real Estate": "XLRE", "Materials": "XLB",
        "Comms": "XLC"
    }

async def analyze_market_and_sectors() -> None:
    """
    Boga Finans AI Kurumsal Piyasa Analizi.
    Amaç:
    1. SPY Trend ve Relative Strength (RS) verilerini (5D/20D) hesaplamak.
    2. Determine the global risk multiplier with VIX (Fear Index).
    3. Detect sector rotation (Leaders/Laggards).
    """
    global MARKET_CONTEXT, SECTOR_CONTEXT

    async with MARKET_SEMAPHORE:
        logging.info("🌍 Boga Finance AI: Market and Sector Analysis Started...")

        # =====================================================
        # 1. MARKET REGIME (SPY & VIX)
        # =====================================================
        try:
            # Fetch SPY and VIX data in parallel
            spy_ticker = yf.Ticker("SPY")
            vix_ticker = yf.Ticker("^VIX")

            spy_hist, vix_hist = await asyncio.gather(
                asyncio.to_thread(spy_ticker.history, period="1y", interval="1d", auto_adjust=True),
                asyncio.to_thread(vix_ticker.history, period="5d", interval="1d", auto_adjust=True)
            )

            # --- SPY ANALYSIS ---
            if len(spy_hist) >= 200:
                close = spy_hist["Close"]
                curr_price = float(close.iloc[-1])
                
                # EMA Calculations (Institutional Trend Guide)
                ema200 = float(close.ewm(span=200, adjust=False).mean().iloc[-1])
                ema50 = float(close.ewm(span=50, adjust=False).mean().iloc[-1])

                # Performance Metrics (Base data for RS Calculations)
                # 5-Day Change
                close_5d = close.iloc[-6] if len(close) > 6 else close.iloc[0]
                spy_5d_pct = ((curr_price - close_5d) / close_5d) * 100
                MARKET_CONTEXT["spy_5d_pct"] = spy_5d_pct

                # 20-Day Change
                close_20d = close.iloc[-21] if len(close) > 21 else close.iloc[0]
                spy_20d_pct = ((curr_price - close_20d) / close_20d) * 100
                MARKET_CONTEXT["spy_20d_pct"] = spy_20d_pct

                # Regime Determination (Bull/Bear)
                if curr_price > ema200:
                    MARKET_CONTEXT["regime"] = "Bull"
                    base_risk = 1.0 if curr_price > ema50 else 0.8
                else:
                    MARKET_CONTEXT["regime"] = "Bear"
                    base_risk = 0.5 # In a bear market, position size and scores are halved

            else:
                logging.warning("⚠️ Insufficient SPY data, switching to safe mode.")
                base_risk = 0.5

            # --- VIX ANALYSIS (Fear Adjustment) ---
            if not vix_hist.empty:
                curr_vix = float(vix_hist["Close"].iloc[-1])
                MARKET_CONTEXT["vix_level"] = curr_vix
                
                # VIX > 25: High Fear (Risk Off) -> Reduce risk multiplier
                if curr_vix > 25.0:
                    base_risk *= 0.7
                    logging.info(f"😨 High VIX ({curr_vix:.2f}): Risk Multiplier Reduced")
                elif curr_vix < 15.0:
                    base_risk *= 1.1 # Low volatility, safe zone
            
            MARKET_CONTEXT["risk_modifier"] = round(base_risk, 2)
            logging.info(f"📊 Regime: {MARKET_CONTEXT['regime']} | Risk Mod: {MARKET_CONTEXT['risk_modifier']} | SPY 5D: {MARKET_CONTEXT.get('spy_5d_pct',0):.2f}%")

        except Exception as e:
            logging.error(f"🚨 Market Context Error: {e}")

        # =====================================================
        # 2. SECTOR ROTATION (Sectoral Strength Analysis)
        # =====================================================
        try:
            SECTOR_CONTEXT.clear()
            
            async def _fetch_sector(name, ticker):
                try:
                    etf = yf.Ticker(ticker)
                    h = await asyncio.to_thread(etf.history, period="5d", interval="1d", auto_adjust=True)
                    if len(h) >= 2:
                        chg = ((h["Close"].iloc[-1] - h["Close"].iloc[0]) / h["Close"].iloc[0]) * 100
                        SECTOR_CONTEXT[name] = round(chg, 2)
                except:
                    pass

            tasks = [ _fetch_sector(n, t) for n, t in SECTOR_ETF_MAP.items() ]
            await asyncio.gather(*tasks)
            
            # Determine Sector Leaders
            sorted_sectors = sorted(SECTOR_CONTEXT.items(), key=lambda x: x[1], reverse=True)
            if sorted_sectors:
                top_str = ", ".join([f"{s[0]}: {s[1]}%" for s in sorted_sectors[:3]])
                logging.info(f"🚀 Sector Leaders (5D): {top_str}")

        except Exception as e:
            logging.error(f"🚨 Sector Analysis Error: {e}")
            
# ============================================================
# 8) BOGA FINANCE AI – UTILITY FUNCTIONS & SELECTION ENGINE
# ============================================================

def get_stock_info(ticker: str) -> Dict[str, Any]:
    """
    Fetches fundamental data (company, sector, market cap, beta, short float) from
    Yahoo Finance, with an in-memory cache so the same ticker isn't re-fetched every
    hour. Never returns missing/None fields — worst case falls back to ticker/Unknown/0.
    """
    if "STOCK_INFO_CACHE" not in globals():
        global STOCK_INFO_CACHE
        STOCK_INFO_CACHE = {}

    if ticker in STOCK_INFO_CACHE:
        return STOCK_INFO_CACHE[ticker]

    data = {"company": ticker, "market_cap": 0, "sector": "Unknown", "beta": 0, "short_float": 0}
    try:
        info = yf.Ticker(ticker).info
        data = {
            "company": info.get("longName") or info.get("shortName") or ticker,
            "market_cap": info.get("marketCap", 0) or 0,
            "sector": info.get("sector") or "Unknown",
            "beta": info.get("beta", 0) or 0,
            "short_float": info.get("shortPercentOfFloat", 0) or 0,
        }
    except Exception as e:
        logging.debug(f"{ticker}: get_stock_info hatası: {e}")

    STOCK_INFO_CACHE[ticker] = data
    return data


def select_final_candidates(
    latest_results: List[Dict],
    other_results: List[Dict],
    target_latest: int = 15,
    target_others: int = 10,
    max_per_sector: int = 3
) -> List[Dict]:
    """
    BOGA FINANCE AI – Institutional Allocation Engine
    Quality first, then source (5-day universe), finally sector distribution.
    """

    # -----------------------------
    # 1️⃣ Pre-Selection (Score Ranking)
    # -----------------------------
    latest_sorted = sorted(latest_results, key=lambda x: x["score"], reverse=True)
    others_sorted = sorted(other_results, key=lambda x: x["score"], reverse=True)

    preselected = []

    for item in latest_sorted[:target_latest]:
        item["source_bucket"] = "Boga_Universe"
        preselected.append(item)

    for item in others_sorted[:target_others]:
        item["source_bucket"] = "Secondary"
        preselected.append(item)

    # -----------------------------
    # 2️⃣ Global Ranking & Deduplication
    # -----------------------------
    preselected = sorted(preselected, key=lambda x: x["score"], reverse=True)

    final_list = []
    seen = set()
    sector_counts = {}

    # -----------------------------
    # 3️⃣ Final Selection (Institutional Filtering)
    # -----------------------------
    for item in preselected:
        if len(final_list) >= (target_latest + target_others):
            break
            
        if item["symbol"] not in seen:
            sector = item.get("sector", "Unknown")
            if sector == "Unknown":
                sector = get_stock_info(item["symbol"]).get("sector", "Unknown")
            
            sec_count = sector_counts.get(sector, 0)
            
            # Sector diversification: Take max 3 stocks per sector
            if sec_count < max_per_sector:
                item["sector_info"] = sector
                final_list.append(item)
                seen.add(item["symbol"])
                sector_counts[sector] = sec_count + 1

    return final_list

def generate_telegram_report(results: List[Dict[str, Any]], limit: int = 10) -> str:
    """Boga Finance AI - Institutional Report Format."""
    
    if not results:
        return "🐂 <b>BOGA FINANCE AI:</b> No institutional opportunities matching criteria found in current market conditions."

    # Select those with the highest scores
    top_picks = sorted(results, key=lambda x: x["score"], reverse=True)[:limit]
    
    report = [f"🐂 <b>BOGA FINANCE AI | SWING INTELLIGENCE</b>"]
    report.append(f"📅 {datetime.now().strftime('%d/%m %H:%M')} | 🌍 Regime: {MARKET_CONTEXT.get('regime', '-')}\n")

    for i, res in enumerate(top_picks):
        symbol = res['symbol']
        score = res['score']
        price = res['price']
        action = res.get('action', 'WATCH')
        
        entry = res.get('entry_zone', 'N/A')
        sl = res.get('stop_loss', 0)
        tp = res.get('target', 0)
        
        # Action Emoji Mapping
        act_emoji = "🟢" if action == "BUY" else "🏦" if action == "CLOSE" else "⏳"
        
        block = (
            f"{i+1}. {act_emoji} <b>{symbol}</b> | Score: {score}\n"
            f"   💰 Price: ${price:.2f}\n"
            f"   🎯 Entry: <code>{entry}</code>\n"
            f"   🛑 SL: ${sl:.2f} | 🎯 TP: ${tp:.2f}\n"
        )
        report.append(block)

    report.append(f"👉 <i>Visit the Dashboard for more details and charts.</i>")
    return "\n".join(report)
    
def save_json_for_dashboard(results: List[Dict[str, Any]]):
    """
    BOGA FINANCE AI - Dashboard Data Engine
    Outputs:
      - intraday_signals.json         (Instant snapshot)
      - intraday_history/{slot}.json   (Hourly archive)
      - intraday_signals_summary.json (Daily summary)
    """
    import math
    import subprocess

    os.makedirs(INTRADAY_HISTORY_DIR, exist_ok=True)

    now_ny = datetime.now(NY_TZ)
    hour_slot = now_ny.strftime("%Y-%m-%dT%H")
    today_str = now_ny.strftime("%Y-%m-%d")
    generated_at = now_ny.isoformat()

    def safe_float(val, default=0.0):
        try:
            f = float(val)
            return default if (math.isnan(f) or math.isinf(f)) else f
        except:
            return default

    def map_status(hourly_action: str) -> str:
        ha = (hourly_action or "").upper()
        if "TAKE_PROFIT" in ha: return "TAKE_PROFIT"
        if "STOP_HIT" in ha: return "STOP_HIT"
        if "ENTRY_NOW" in ha: return "ENTRY_NOW"
        if "WAIT" in ha: return "WAIT"
        if "HOLD" in ha: return "HOLD"
        return "ENTRY_WATCH"

    # Sort by scores and remove duplicates
    sorted_results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
    seen = set()
    signals = []

    for res in sorted_results:
        ticker = res.get("symbol")
        if not ticker or ticker in seen:
            continue
        seen.add(ticker)

        # Match with BOGA_SWING_ZONES (Archive)
        swing_info = BOGA_SWING_ZONES.get(ticker, {})
        hourly_action = res.get("hourly_action", "NEUTRAL")
        status = map_status(hourly_action)

        pick_date = swing_info.get("pick_date", today_str)
        try:
            days_since = (datetime.strptime(today_str, "%Y-%m-%d") - datetime.strptime(pick_date, "%Y-%m-%d")).days
        except:
            days_since = 0

        # Standardize zone data
        bz = swing_info.get("buying_zone", {})
        pz = swing_info.get("profit_zone") or swing_info.get("sell_zone", {})
        sz = swing_info.get("stop_zone") or swing_info.get("stop_loss_zone", {})

        # Şirket adı: process_single_stock'tan gelen gerçek longName > swing arşivi > ticker
        resolved_company = res.get("company")
        if not resolved_company or resolved_company == ticker:
            archived_company = swing_info.get("company")
            if archived_company and archived_company != ticker:
                resolved_company = archived_company
        if not resolved_company:
            resolved_company = ticker

        signal = {
            "ticker": ticker,
            "company": resolved_company,
            "sector": swing_info.get("sector") or res.get("sector", "Unknown"),
            "swing_pick_date": pick_date,
            "days_since_pick": days_since,
            "current_price": safe_float(res.get("price")),
            "buy_zone": bz,
            "stop_zone": sz,
            "profit_zone": pz,
            "status": status,
            "status_detail": res.get("hourly_msg", ""),
            "alert_level": (
                "HIGH" if status in ("STOP_ALERT", "ENTRY_NOW")
                else "MEDIUM" if status == "FULL_EXIT"
                else "LOW"
            ),
            "intraday": {
                "rsi_1h": safe_float(res.get("rsi_1h")),
                "adx_1h": safe_float(res.get("adx_1h")),
                "volume_ratio": safe_float(res.get("rvol"), 1.0),
                "change_1h": safe_float(res.get("change_1h")),
                "change_24h": safe_float(res.get("change_24h")),
                "trend_1h": res.get("trend_1h", "FLAT"),
                "setup": res.get("setup_type", "NONE"),
                "pattern_15m": res.get("pattern_15m", "Neutral"),
                "rs_score": safe_float(res.get("rs_score")),
                "natr": safe_float(res.get("natr")),
                # --- GAP-UP / PRE-GAP (5 bileşen, 0-15) ---
                "pre_gap_total": int(res.get("pre_gap_total", 0) or 0),
                "pre_gap_grade": res.get("pre_gap_grade", "C"),
                "gap_pct": safe_float(res.get("gap_pct")),
                "gap_score": int(res.get("gap_score", 0) or 0),
                "hourly_strength_pct": safe_float(res.get("hourly_strength_pct")),
                "hourly_score": int(res.get("hourly_score", 0) or 0),
                "daily_rvol": safe_float(res.get("daily_rvol"), 1.0),
                "daily_rvol_score": int(res.get("daily_rvol_score", 0) or 0),
                "close_to_high_pct": safe_float(res.get("close_to_high_pct")),
                "close_to_high_score": int(res.get("close_to_high_score", 0) or 0),
                "late_volume_ratio": safe_float(res.get("late_volume_ratio")),
                "late_volume_score": int(res.get("late_volume_score", 0) or 0),
            },
            "notes": res.get("notes", []),
        }
        signals.append(signal)

    export = {
        "generated_at": generated_at,
        "hour_slot": hour_slot,
        "market_regime": MARKET_CONTEXT.get("regime", "Unknown"),
        "vix_level": safe_float(MARKET_CONTEXT.get("vix_level", 0)),
        "total_scanned": len(signals),
        "signals": signals,
    }

    try:
        # 1. Instant Snapshot Record
        latest_path = os.path.join(PUBLIC_DIR, "intraday_signals.json")
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(export, f, indent=2, ensure_ascii=False)

        # 2. Archive Record
        archive_path = os.path.join(INTRADAY_HISTORY_DIR, f"{hour_slot}.json")
        with open(archive_path, "w", encoding="utf-8") as f:
            json.dump(export, f, indent=2, ensure_ascii=False)

        # 3. Daily Summary Update
        summary_path = os.path.join(PUBLIC_DIR, "intraday_signals_summary.json")
        summary = {}
        if os.path.exists(summary_path):
            try:
                with open(summary_path, encoding="utf-8") as f:
                    summary = json.load(f)
            except:
                summary = {}

        if summary.get("date") != today_str:
            summary = {"date": today_str, "last_updated": generated_at, "tickers": {}}

        summary["last_updated"] = generated_at
        hour_label = now_ny.strftime("%H:%M")

        for sig in signals:
            t_key = sig["ticker"]
            if t_key not in summary["tickers"]:
                summary["tickers"][t_key] = {
                    "status_history": [],
                    "current_status": sig["status"],
                    "entry_triggered_at": None,
                    "entry_price": None,
                }
            t = summary["tickers"][t_key]
            t["current_status"] = sig["status"]
            t["status_history"].append({"hour": hour_label, "status": sig["status"]})
            
            # Entry tracking
            if sig["status"] == "ENTRY_NOW" and t["entry_triggered_at"] is None:
                t["entry_triggered_at"] = generated_at
                t["entry_price"] = sig["current_price"]

        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)

        # 4. End-of-day archive (15:00 NY = last scan) → gün sonu kalıcı arşiv
        ARCHIVE_DIR = os.path.join(PUBLIC_DIR, "intraday_daily_archive")
        os.makedirs(ARCHIVE_DIR, exist_ok=True)
        archive_daily_path = os.path.join(ARCHIVE_DIR, f"{today_str}.json")
        # Her 15:00 taramasında güncelle (gün içinde geçici, gün sonu kalıcı)
        with open(archive_daily_path, "w", encoding="utf-8") as f:
            json.dump({
                "date": today_str,
                "generated_at": generated_at,
                "market_regime": MARKET_CONTEXT.get("regime", "Unknown"),
                "vix_level": safe_float(MARKET_CONTEXT.get("vix_level", 0)),
                "total": len(signals),
                "signals": signals,
                "summary": summary if 'summary' in dir() else {}
            }, f, indent=2, ensure_ascii=False)

        # Push to GitHub (since Vercel revalidate endpoint is not working)
        finma_dir = r"C:\Users\afksm\finma"
        try:
            # First, pull latest to prevent conflicts
            subprocess.run(["git", "pull", "--rebase", "origin", "main"], cwd=finma_dir, capture_output=True)
            
            subprocess.run(
                ["git", "add",
                 "frontend/public/intraday_signals.json",
                 f"frontend/public/intraday_history/{hour_slot}.json",
                 "frontend/public/intraday_signals_summary.json"],
                cwd=finma_dir, capture_output=True
            )
            subprocess.run(
                ["git", "commit", "-m", f"Boga AI Hourly Update: {generated_at}"],
                cwd=finma_dir, capture_output=True
            )
            subprocess.run(["git", "push", "origin", "main"], cwd=finma_dir, capture_output=True)
            logging.info(f"✅ Boga AI: Data saved and pushed to GitHub ({len(signals)} stocks).")
        except Exception as e:
            logging.error(f"❌ GitHub push error: {e}")

    except Exception as e:
        logging.error(f"❌ save_json_for_dashboard error: {e}")
        
# ============================================================
# 9) BOGA FINANCE AI – DATA RECORDING AND ARCHIVING SYSTEM
# ============================================================

def save_to_setup_folder(results: List[Dict[str, Any]]):
    """Creates versioned and detailed JSON records in the specified folder."""
    SETUP_DIR = r"C:\Users\afksm\finma\watchlists\setup"
    if not os.path.exists(SETUP_DIR):
        os.makedirs(SETUP_DIR, exist_ok=True)

    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    
    version = 1
    while os.path.exists(os.path.join(SETUP_DIR, f"{date_str}_v{version}.json")):
        version += 1
    
    file_name = f"{date_str}_v{version}.json"
    full_path = os.path.join(SETUP_DIR, file_name)

    export_list = []
    for res in results:
        export_list.append({
            "date": now.strftime("%Y-%m-%d %H:%M"),
            "symbol": res.get("symbol"),
            "sector": res.get("sector", "Unknown"),
            "action": res.get("action", "WATCH"),
            "price": res.get("price"),
            "entry_zone": res.get("entry_zone"),
            "SL": res.get("stop_loss"),
            "TP": res.get("target")
        })

    with open(full_path, "w", encoding="utf-8") as f:
        json.dump(export_list, f, indent=4)
    logging.info(f"✅ SETUP JSON SAVED: {file_name}")

def save_txt_for_archive(results: List[Dict[str, Any]]):
    """Boga Finance AI - Symbol-based TXT archive record."""
    INDAY_DIR = r"C:\Users\afksm\finma\watchlists\inday"
    if not os.path.exists(INDAY_DIR):
        os.makedirs(INDAY_DIR, exist_ok=True)

    now = datetime.now()
    date_tag = now.strftime("%Y%m%d")
    tickers = [res.get("symbol") for res in results if res.get("symbol")]

    if not tickers: return

    # Daily and Rolling record
    with open(os.path.join(INDAY_DIR, f"inday_{date_tag}.txt"), "w", encoding="utf-8") as f:
        f.write(f"# BOGA AI Swing Watchlist - {now.strftime('%Y-%m-%d %H:%M')}\n")
        for t in tickers: f.write(f"{t}\n")
            
    with open(os.path.join(INDAY_DIR, "inday_rolling.txt"), "a", encoding="utf-8") as f:
        f.write(f"\n# --- {now.strftime('%Y-%m-%d')} ---\n")
        for t in tickers: f.write(f"{t}\n")

# ============================================================
# 📊 MAIN EXECUTION - BOGA FINANCE AI SWING ENGINE
# ============================================================

async def main():
    """Main scan loop: Market analysis, Technical Scan, and Recording."""
    now_ny = datetime.now(NY_TZ)
    
    # 🕒 08:45 - 16:00 NY Time & Weekday Window Check
    if now_ny.weekday() >= 5:
        print("🕒 Hafta sonu. Tarama pas geçiliyor.")
        return
    session_start_minutes = 8 * 60 + 45   # 08:45
    now_minutes = now_ny.hour * 60 + now_ny.minute
    if now_minutes < session_start_minutes or now_ny.hour >= 16:
        print(f"🕒 Market saatleri dışı ({now_ny.strftime('%H:%M')}). Tarama pas geçiliyor.")
        return

    print("\n" + "=" * 60)
    print(f"🐂 BOGA FINANCE AI - SWING ENGINE ONLINE")
    print(f"⏰ Session Time: {now_ny.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60 + "\n")

    # 1️⃣ Market and Sector Analysis (Determining Risk Modifier)
    await analyze_market_and_sectors()

    # 2️⃣ Load Universe — swing arşivini yükle (BOGA_SWING_ZONES için, entry/stop/target verisi)
    #    ardından bugünün takip evrenini al: ilk taramada ALL-LIST tam evrenini tarayıp Top 20'yi
    #    seçer ve kaydeder; aynı gün içindeki sonraki taramalar bu kayıtlı Top 20'yi kullanır.
    load_swing_universe()
    universe = await get_or_build_today_universe()
    if not universe:
        print("❌ Boga günlük takip evreni boş. Tarama iptal edildi.")
        return

    # 3️⃣ Technical Scan (Async Parallel)
    raw_results = []
    chunk_size = 10
    for i in range(0, len(universe), chunk_size):
        chunk = universe[i:i + chunk_size]
        tasks = [process_single_stock(sym) for sym in chunk]
        chunk_res = await asyncio.gather(*tasks)
        for sym, res in zip(chunk, chunk_res):
            if res is not None:
                raw_results.append(res)
            else:
                # Fallback entry for stocks with no data (show the whole universe)
                # NOT: Teknik analiz başarısız olsa da kimlik bilgisi (şirket/sektör) HER ZAMAN doldurulur.
                fallback_price = 0.0
                try:
                    tmp = yf.Ticker(sym).history(period="2d", interval="1d")
                    if not tmp.empty:
                        fallback_price = round(float(tmp["Close"].iloc[-1]), 2)
                except Exception:
                    pass
                fallback_info = get_stock_info(sym)
                raw_results.append({
                    "symbol": sym,
                    "company": fallback_info["company"],
                    "sector": fallback_info["sector"],
                    "market_cap": fallback_info["market_cap"],
                    "score": 0.0,
                    "price": fallback_price,
                    "action": "WAIT",
                    "timing": "WAIT",
                    "hourly_action": "WAIT",
                    "hourly_msg": "Insufficient data - technical analysis could not be performed",
                    "rsi_1h": 50.0,
                    "adx_1h": 0.0,
                    "rvol": 1.0,
                    "change_1h": 0.0,
                    "change_24h": 0.0,
                    "trend_1h": "FLAT",
                    "setup_type": "NONE",
                    "pattern_15m": "Neutral",
                    "rs_score": 0.0,
                    "natr": 0.0,
                    "notes": ["⚠️ Technical data insufficient"],
                    "source_bucket": "Boga_Universe",
                })
                logging.warning(f"⚠️ {sym}: process_single_stock None döndü, fallback eklendi.")
        print(f"📊 Scan Progress: {min(i + chunk_size, len(universe))}/{len(universe)}", end="\r")
    
    # 4️⃣ Sort all scanned stocks (no filter - all raw_results will be saved)
    raw_results.sort(key=lambda x: x.get("score", 0), reverse=True)

    # 5️⃣ Data Recording Operations (Save all scanned stocks)
    is_final_scan = (now_ny.hour == 15 and now_ny.minute >= 40)
    try:
        save_to_setup_folder(raw_results)
        save_txt_for_archive(raw_results)
        save_json_for_dashboard(raw_results)

        # 3:45 PM — GAP UP analizi ve gün sonu raporu
        if is_final_scan:
            pre_gap_list = sorted(
                [r for r in raw_results if r.get("pre_gap") and r.get("pre_gap_score", 0) >= 4.0],
                key=lambda x: x.get("pre_gap_score", 0), reverse=True
            )
            logging.info("=" * 60)
            logging.info(f"🔔 GAP UP / PRE-MARKET SETUP ANALİZİ — {now_ny.strftime('%Y-%m-%d 15:45')}")
            logging.info(f"Toplam {len(pre_gap_list)} hisse pre-gap kriterlerini karşılıyor:")
            for r in pre_gap_list[:10]:
                logging.info(f"  • {r['symbol']:6s} | Pre-Gap Score: {r.get('pre_gap_score',0):.1f} | Fiyat: ${r.get('price',0):.2f}")
            if not pre_gap_list:
                logging.info("  (Bugün için pre-gap kriterlerini karşılayan hisse yok)")
            logging.info("=" * 60)
            logging.info("📋 GÜN SONU ÖZET RAPORU")
            logging.info(f"  Taranan hisse: {len(raw_results)}")
            entry_now = [r for r in raw_results if "ENTRY_NOW" in r.get("hourly_action","")]
            entry_watch = [r for r in raw_results if "ENTRY_WATCH" in r.get("hourly_action","")]
            logging.info(f"  GİRİŞ sinyali: {len(entry_now)} hisse — {', '.join(r['symbol'] for r in entry_now[:8])}")
            logging.info(f"  İZLE sinyali : {len(entry_watch)} hisse — {', '.join(r['symbol'] for r in entry_watch[:8])}")
            logging.info("=" * 60)

    except Exception as e:
        logging.error(f"Recording Error: {e}")

    # 6️⃣ Console Özeti
    top5 = sorted(raw_results, key=lambda x: x.get("score", 0), reverse=True)[:5]
    print("\n" + "-" * 40)
    print(f"🐂 BOGA DAILY — {now_ny.strftime('%H:%M')} ET | {len(raw_results)} hisse | Rejim: {MARKET_CONTEXT.get('regime','-')}")
    for r in top5:
        print(f"  {r['symbol']:6s} | {r.get('hourly_action','?'):12s} | ${r.get('price',0):.2f} | Score: {r.get('score',0):.1f}")
    print("-" * 40 + "\n")

# 📅 SCHEDULER
# ============================================================

SCHEDULE_SLOTS = [(8,45),(9,45),(10,45),(11,45),(12,45),(13,45),(14,45),(15,45)]
SCHEDULE_GRACE = timedelta(minutes=10)
_LAST_COMPLETED_SLOT: Optional[tuple] = None


def get_next_run_ny() -> datetime:
    """
    Saatte bir :45'te çalışır. 08:45 → 09:45 → ... → 15:45 ET.
    NOT: Eskiden `now`'u dakikaya yuvarlayıp `target > now` ile katı karşılaştırma
    yapıyordu — Task Scheduler script'i tam :45:00-:45:10 arası başlattığında bu
    her zaman True/False sınırında patlayıp günün İLK slotunu (08:45) tamamen
    atlıyordu (bot doğrudan 09:45'e kayıyordu). Artık: birkaç dakikalık gecikmeyle
    başlamışsa bile o slotu "şimdi" kabul eder (GRACE penceresi) ve aynı slotu
    tekrar çalıştırmamak için son tamamlanan slotu hatırlar.
    """
    now = datetime.now(NY_TZ)

    for h, m in SCHEDULE_SLOTS:
        if _LAST_COMPLETED_SLOT is not None and (h, m) <= _LAST_COMPLETED_SLOT:
            continue
        target = now.replace(hour=h, minute=m, second=0, microsecond=0)
        if now <= target + SCHEDULE_GRACE:
            return target

    # Bir sonraki iş günü 08:45'e geç
    next_day = now + timedelta(days=1)
    while next_day.weekday() >= 5:
        next_day += timedelta(days=1)
    return next_day.replace(hour=8, minute=45, second=0, microsecond=0)

async def run_scheduler():
    global _LAST_COMPLETED_SLOT
    logging.info("🐂 BOGA AI InDay Scheduler başladı. Program: 08:45-15:45 ET saatte bir.")

    while True:
        try:
            next_run = get_next_run_ny()
            wait_sec = (next_run - datetime.now(NY_TZ)).total_seconds()

            if wait_sec < 0:
                wait_sec = 0
            logging.info(f"💤 Sonraki tarama: {next_run.strftime('%H:%M')} ET ({int(wait_sec/60)} dk sonra)")

            await asyncio.sleep(wait_sec)
            await main()
            _LAST_COMPLETED_SLOT = (next_run.hour, next_run.minute)

            # 15:45 taraması bitti → gün kapandı, çık (Task Scheduler yarın 08:45'te yeniden başlatır)
            now_ny = datetime.now(NY_TZ)
            if now_ny.hour >= 15 and now_ny.minute >= 45:
                logging.info("🏁 15:45 taraması tamamlandı. Bot bugünlük kapanıyor.")
                break

        except Exception as e:
            logging.error(f"Scheduler hatası: {e}")
            await asyncio.sleep(300)

if __name__ == "__main__":
    import sys
    import io
    
    # 🛌 Hafta sonu kontrolü (Fail-safe)
    from datetime import datetime
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        print(f"🛌 Bugün hafta sonu ({now_ny.strftime('%A')}). Intraday botu çalıştırılmayacak.")
        sys.exit(0)

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    try:
        if "--force" in sys.argv:
            asyncio.run(main())
        else:
            asyncio.run(run_scheduler())
    except KeyboardInterrupt:
        print("\n⏹️ Stopped.")