"""
================================================================
🐂 BOGA AI SWING TRADE MODEL — V114
================================================================
MIMARI:
  KATMAN 1 → Tüm evren haftalık tarama → en likit 500 hisse
  KATMAN 2 → 500 hissenin 1D verisi çekilir, momentum + trend
             güçlü en az 50 aday seçilir
  KATMAN 3 → 50 aday için derin analiz (1H zaman dilimine göre
             destek/direnç + ATR tabanlı BUY/SELL/STOP ZONE)
  KATMAN 4 → Top 10 hisse 100 üzerinden skorlanır
  KATMAN 5 → Gemini AI ile İngilizce/Türkçe/İspanyolca/Portekizce/
             Fransızca/Endonezya dillerinde özetler üretilir
  ÇIKTI    → JSON formatında kaydedilir + Telegram bildirimi

YENİLİKLER V114:
  ✅ 100 üzerinden BOGA AI skoru (10 hisse)
  ✅ BUY ZONE / SELL ZONE / STOP LOSS ZONE (ATR + 1H destek/direnç)
  ✅ Risk/Reward 2.5:1 hedefi
  ✅ Gemini AI özetleri 6 dilde (teknik indikatörlerin kullanıcı dostu açıklaması)
  ✅ Hissenin 1G/1H/1A/5Y performans değişim oranları
  ✅ Fundamental Margins bölümü (anlam açıklamaları)
  ✅ Trend Status, RSI, ADX, MACD Hist, MFI, EMA değerleri sade dilde
  ✅ BOGA AI adıyla tüm analizlerde referans
  ✅ JSON çıktısı: swing_picks_boga.json
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
# 🔹 LOGGING
# ================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# ================================================================
# 🔹 ZAMAN & ZAMANLAYICI
# ================================================================
NY_TZ = ZoneInfo("America/New_York")
WEEKDAY_SET = {0, 1, 2, 3, 4}

# Haftalık evren taraması (Pazartesi 13:00 NY)
WEEKLY_SCAN_DAY = 0       # 0 = Pazartesi
WEEKLY_SCAN_HOUR = 13
WEEKLY_SCAN_MINUTE = 0

# Günlük seçim taraması (Her gün 13:00 NY)
DAILY_RUN_HOUR = 13
DAILY_RUN_MINUTE = 0

# ================================================================
# 🔹 CACHE & DOSYA AYARLARI
# ================================================================
UNIVERSE_TTL = 7 * 24 * 3600        # Haftalık evren güncelleme (168 saat)
UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}
BULK_DATA_CACHE: Dict[str, pd.DataFrame] = {}
index_cache: Dict[str, pd.Series] = {}
alpha_vantage_cache: Dict[str, dict] = {}

WATCHLIST_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists"
INFO_CACHE_FILE = os.path.join(WATCHLIST_DIR, "persistent_info_cache.json")
WATCHLIST_KEEP_DAYS = 180
WATCHLIST_MAX_ROLLING = 6000

# JSON Dosya İsimleri (Frontend entegrasyonu için)
OUTPUT_JSON_FILE = "swing_picks.json"
OUTPUT_ALL_JSON_FILE = "swing_all_picks.json"

# ================================================================
# 🔹 EVREN VE FİLTRE PARAMETRELERİ
# ================================================================
MAX_TICKERS_FINAL = 500          # Katman 1: En likit 500 hisse
TOP_DEEP_ANALYSIS = 50           # Katman 3: Derin analize giren hisse sayısı
TOP_FINAL_PICKS = 10             # Nihai BOGA AI seçim sayısı

PRICE_MIN = 5.0
PRICE_MAX = 1000.0
ATMACA_MIN_MARKET_CAP = 300_000_000
ATMACA_MIN_AVG_VOLUME = 500_000
ATMACA_MIN_DOLLAR_VOLUME = 5_000_000
ATMACA_MIN_BETA = 0.6
ATMACA_MAX_BETA = 3.0

ATR_PERIOD = 14
ATR_MIN_PCT_1H = 0.025
ATR_MAX_PCT_1H = 0.25

ADX_MIN_LEVEL_1D = 18
OBV_TREND_DAYS = 10
VOLUME_INCREASE_LOOKBACK = 5

RSI_MIN_SWING = 38
RSI_MAX_SWING = 78

MIN_RR_RATIO = 1.2
MIN_RR_RATIO_RELAXED = 1.3
MIN_ATMACA_SCORE = 8

LOOKBACK_DAYS = 200
INDEX_BENCHMARK = "^GSPC"
MAX_PER_SECTOR = 6
RS_LOOKBACK = 30

# ================================================================
# 🔹 TELEGRAM AYARLARI
# ================================================================
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"
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
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# ================================================================
# 🔹 SEKTÖR ETF HARİTASI
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
# 🔹 GLOBAL DURUM DEĞİŞKENLERİ
# ================================================================
MARKET_STATUS = {"regime": "Bull", "min_score_modifier": 0.0}
SECTOR_PERFORMANCE: Dict[str, float] = {}
sector_map: Dict[str, str] = {}
EXCLUDED_STOCKS: set = set()

# ================================================================
# 🔹 BORSA KAYNAKLARI
# ================================================================
EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
    "https://raw.githubusercontent.com/shilewenuw/get_all_tickers/master/get_all_tickers/tickers.csv"
]

# ================================================================
# 🔹 ŞİRKET VERİ TABANI (Bilinen büyük hisseler için hızlı erişim)
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
            logging.info(f"📦 Persistent Cache: {len(persistent_info_cache)} hisse yüklendi.")
    except Exception as e:
        logging.warning(f"⚠️ Cache yükleme hatası: {e}")

def save_info_cache():
    try:
        os.makedirs(WATCHLIST_DIR, exist_ok=True)
        with open(INFO_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(persistent_info_cache, f, indent=2)
    except Exception as e:
        logging.warning(f"⚠️ Cache kaydetme hatası: {e}")

load_info_cache()

# ================================================================
# ================================================================
# BÖLÜM 1: EVREN OLUŞTURMA (KATMAN 1 — HAFTALIK)
# ================================================================
# ================================================================

async def fetch_all_us_tickers() -> List[str]:
    """NASDAQ, NYSE, AMEX sembollerini çeker. Sadece 1-5 harfli hisseler."""
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
                logging.error(f"⚠️ Ticker listesi hatası ({url}): {e}")

    logging.info(f"✅ Ham sembol sayısı: {len(all_tickers)}")
    return list(all_tickers)


async def build_atmaca_universe_full() -> List[str]:
    """
    KATMAN 1 — Haftalık Evren Oluşturma (En Likit 500 Hisse)

    AŞAMA 1: Tüm US hisselerini çek
    AŞAMA 2: Toplu OHLCV indir, vektörel filtrele
    AŞAMA 3: RVOL × DollarVolume sıralaması → Top 500
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
                        logging.info(f"📁 Disk Cache Yüklendi: {len(data_list)} hisse. Veriler indiriliyor...")
                        # ⚠️ KRİTİK DÜZELTME: Diskten yüklenen hisselerin 1D verilerini cache'e doldur!
                        # Periyodu 252d yaparak EMA200 ve "len < 50" şartlarını sağlıyoruz.
                        chunk_size = 100
                        for j in range(0, len(data_list), chunk_size):
                            chunk = data_list[j : j + chunk_size]
                            downloaded = await asyncio.to_thread(
                                yf.download, chunk, period="252d", progress=False, group_by="ticker", ignore_tz=True
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
        logging.error("❌ Ticker listesi alınamadı.")
        return []

    logging.info(f"🚀 {len(raw_list)} hisse için toplu indirme başlıyor (chunk=1000, period=35d)...")

    CHUNK = 200
    PERIOD = "252d"
    all_rows: list = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"📥 İndiriliyor: {i}–{i + len(chunk)} ...")
        try:
            data = await asyncio.to_thread(
                yf.download, chunk, period=PERIOD,
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
                    if rvol < 0.5:
                        continue

                    roc5 = float(
                        (close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]
                    ) if len(close) >= 6 else 0.0
                    if roc5 < -0.05:
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
            logging.warning(f"⚠️ Chunk {i} hatası: {e}")
            continue

    if not all_rows:
        logging.error("❌ Toplu indirme sonrası hiç hisse kalmadı.")
        return []

    logging.info(f"⚡ Vektörel filtre: {len(all_rows)} hisse geçti.")
    all_rows.sort(key=lambda r: r["rank_score"], reverse=True)
    selected = [r["sym"] for r in all_rows[:MAX_TICKERS_FINAL]]

    logging.info(f"🏆 KATMAN 1 tamamlandı: {len(selected)} hisse seçildi.")

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
# BÖLÜM 2: VERİ YARDIMCILARI
# ================================================================
# ================================================================

def get_stock_data(ticker: str, interval: Literal["1d", "1h"] = "1d") -> Optional[pd.DataFrame]:
    """
    1D için BULK_DATA_CACHE'den okur (sıfır network).
    1H için yf.Ticker ile çeker.
    """
    t = ticker.strip().upper()

    if interval == "1d":
        if t in BULK_DATA_CACHE:
            return BULK_DATA_CACHE[t].copy()
        return None

    time.sleep(random.uniform(0.1, 0.3))
    try:
        stock = yf.Ticker(t)
        df = stock.history(period="7d", interval="1h", auto_adjust=True, timeout=10)
        if df is None or df.empty:
            return None
        df.columns = [c.capitalize() for c in df.columns]
        df = df.dropna()
        return df if len(df) >= 10 else None
    except Exception as e:
        logging.error(f"❌ {t} (1h) fetch hatası: {e}")
        return None


def get_stock_info(ticker: str) -> dict:
    """Persistent cache'den hisse bilgisi döner."""
    t = ticker.strip().upper()
    if t in persistent_info_cache:
        return persistent_info_cache[t]
    return {
        "market_cap": 0, "avg_volume": 0, "beta": 1.0,
        "short_float": 0.0, "sector": "Unknown", "heldPercentInstitutions": 0
    }


def get_index_close_series(symbol: str = INDEX_BENCHMARK) -> Optional[pd.Series]:
    """Benchmark endeksi kapanış serisini cache'ler."""
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
# BÖLÜM 3: TEKNİK YARDIMCI MOTORLAR
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
            return {'valid': True, 'bonus': 0.8, 'msg': "🟡 Ichimoku: Bulut İçi Swing Uyanışı (+0.8)"}
        if price > cloud_top:
            if last['tenkan'] > last['kijun']:
                return {'valid': True, 'bonus': 1.4, 'msg': "✅ Ichimoku: Güçlü Bullish Devam (+1.4)"}
            return {'valid': True, 'bonus': 0.6, 'msg': "✅ Ichimoku: Bulut Üstü (+0.6)"}
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
            return {'valid': True, 'bonus': 1.2, 'msg': f"🟢 VP: POC Üzeri Destek (+{dist_pct*100:.1f}%)"}
        if current > poc_price:
            return {'valid': True, 'bonus': 0.5, 'msg': f"📈 VP: POC Üzeri Momentum (+{dist_pct*100:.1f}%)"}
        return {'valid': False, 'bonus': 0.0, 'msg': "⚠️ VP: POC Altı (Direnç Bölgesi)"}
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
            score += 6.0; details.append(f"💰 Smart Money: Güçlü Akümülasyon (CMF: {cmf_val:.2f})")
        elif cmf_val > 0.05:
            score += 3.2; details.append(f"📈 Smart Money: Pozitif Para Akışı (CMF: {cmf_val:.2f})")
        elif cmf_val < -0.10:
            score -= 3.2; details.append(f"⚠️ Smart Money: Kurumsal Dağıtım (CMF: {cmf_val:.2f})")

        typical_price = (high + low + close) / 3
        raw_mf = typical_price * volume
        pos_mf = raw_mf.where(typical_price > typical_price.shift(1), 0)
        neg_mf = raw_mf.where(typical_price < typical_price.shift(1), 0)
        mf_ratio = pos_mf.rolling(14).sum() / neg_mf.rolling(14).sum()
        mf_ratio = mf_ratio.replace([np.inf, -np.inf], 100).fillna(50)
        mfi_val = float(100 - 100 / (1 + mf_ratio.iloc[-1]))

        if mfi_val > 60:
            score += 4.0; details.append(f"💚 MFI: Güçlü Para Akışı ({mfi_val:.1f})")
        elif mfi_val < 30:
            score -= 2.0; details.append(f"🔴 MFI: Zayıf Para Akışı ({mfi_val:.1f})")

        return {
            'has_smart_flow': score > 0, 'score': min(score, 12.0),
            'details': details, 'cmf': round(cmf_val, 3), 'mfi': round(mfi_val, 1)
        }
    except Exception:
        return {'has_smart_flow': False, 'score': 0.0, 'details': [], 'cmf': 0.0, 'mfi': 50.0}


def detect_rising_stock(df: pd.DataFrame) -> dict:
    try:
        close = df['Close']
        volume = df['Volume']
        score, details, pattern = 0.0, [], ""

        if len(close) < 10:
            return {'is_rising': False, 'score': 0.0, 'details': [], 'pattern': ''}

        recent_ret = (close.iloc[-1] - close.iloc[-10]) / close.iloc[-10]

        if recent_ret > 0.10:
            score += 4.0; pattern = "Gaining Momentum"
            details.append(f"🚀 10G Getiri: +{recent_ret*100:.1f}%")
        elif recent_ret > 0.05:
            score += 2.0; pattern = "Base Breakout"
            details.append(f"📈 10G Getiri: +{recent_ret*100:.1f}%")

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
            score += 4.0; details.append(f"🏦 Insider Net Alıcı ({buy_count}/{sell_count})")
        if executive_buys >= 2:
            score += 6.0; details.append(f"👔 C-Suite Güçlü Alım ({executive_buys})")
        elif executive_buys >= 1:
            score += 3.2; details.append("👔 C-Suite Alım Sinyali")
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
            score += 2.0; details.append(f"💎 Gross Margin: {gross_margin*100:.1f}% (Güçlü)")
        if operating_margin > 0.15:
            score += 2.0; details.append(f"📊 Operating Margin: {operating_margin*100:.1f}% (Güçlü)")
        if net_margin > 0.10:
            score += 2.0; details.append(f"💰 Net Margin: {net_margin*100:.1f}% (Sağlıklı)")
        if revenue_growth > 0.10:
            score += 3.0; details.append(f"🚀 Revenue Growth: {revenue_growth*100:.1f}% (İyi)")
        elif revenue_growth > 0.05:
            score += 1.5; details.append(f"📈 Revenue Growth: {revenue_growth*100:.1f}%")
        if 0 < debt_to_equity < 1.5:
            score += 1.5; details.append(f"🟢 D/E: {debt_to_equity:.2f} (Sağlıklı)")
        if fcf_yield_pct > 3.0:
            score += 2.0; details.append(f"💸 FCF Yield: {fcf_yield_pct:.1f}% (Güçlü)")

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
        catalysts.append(f"🏛️ Kurumsal: %{inst_pct*100:.0f}"); score += 0.8
    elif inst_pct > 0.60:
        catalysts.append(f"🏦 Kurumsal: %{inst_pct*100:.0f}"); score += 0.3
    rec = str(info.get('recommendationKey', '')).lower()
    if 'strong_buy' in rec:
        catalysts.append("📈 Analist: Güçlü Al"); score += 0.8
    elif 'buy' in rec:
        catalysts.append("📈 Analist: Al"); score += 0.4
    peg = info.get('pegRatio', 0) or 0
    if 0 < peg < 1.5:
        catalysts.append(f"💎 PEG: {peg:.1f} (Ucuz Büyüme)"); score += 0.5
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
                            return {'has_risk': True, 'penalty': 5.0, 'msg': f"⚠️ YASAL RİSK: '{kw}'"}
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
            score += 4.0; details.append(f"🐂 Opsiyon Sinyali: Güçlü Bullish (PCR: {pcr})")
        elif pcr < 0.9:
            score += 2.0; details.append(f"📈 Opsiyon Sinyali: Hafif Bullish (PCR: {pcr})")
        elif pcr > 1.3:
            score -= 2.0; details.append(f"🐻 Opsiyon Sinyali: Bearish (PCR: {pcr})")

        return {'bullish': pcr < 0.9, 'score': score, 'details': details, 'pcr': str(pcr)}
    except Exception:
        return {'bullish': False, 'score': 0.0, 'details': [], 'pcr': "N/A"}

# ================================================================
# ================================================================
# BÖLÜM 4: DESTEK / DİRENÇ HESAPLAMA (1H + ATR BAZLI)
# ================================================================
# ================================================================

def calculate_support_resistance_1h(df_1h: pd.DataFrame, df_1d: pd.DataFrame, current_price: float) -> dict:
    """
    ATR ve 1 saatlik zaman dilimine göre destek ve direnç noktaları hesaplar.
    BUY ZONE, SELL ZONE (TARGET), STOP LOSS ZONE ve R/R 2.5:1 hesaplanır.
    """
    try:
        # ── ATR Hesabı (1D) ──────────────────────────────────────────
        close_1d = df_1d['Close']
        high_1d  = df_1d['High']
        low_1d   = df_1d['Low']
        atr_1d_series = AverageTrueRange(high_1d, low_1d, close_1d, ATR_PERIOD).average_true_range()
        atr_1d = float(atr_1d_series.iloc[-1]) if not pd.isna(atr_1d_series.iloc[-1]) else current_price * 0.02
        atr_pct = atr_1d / current_price

        # ── 1H Destek / Direnç ───────────────────────────────────────
        support_1h  = current_price
        resist_1h   = current_price

        if df_1h is not None and len(df_1h) >= 20:
            close_1h = df_1h['Close']
            high_1h  = df_1h['High']
            low_1h   = df_1h['Low']

            # 1H ATR
            atr_1h_s = AverageTrueRange(high_1h, low_1h, close_1h, 14).average_true_range()
            atr_1h   = float(atr_1h_s.iloc[-1]) if not pd.isna(atr_1h_s.iloc[-1]) else atr_1d * 0.25

            # 1H son 50 barda swing lows / highs
            lows   = low_1h.tail(50)
            highs  = high_1h.tail(50)
            pivot_lows, pivot_highs = [], []

            for i in range(2, len(lows) - 2):
                if lows.iloc[i] < lows.iloc[i-1] and lows.iloc[i] < lows.iloc[i+1]:
                    pivot_lows.append(float(lows.iloc[i]))
                if highs.iloc[i] > highs.iloc[i-1] and highs.iloc[i] > highs.iloc[i+1]:
                    pivot_highs.append(float(highs.iloc[i]))

            # Fiyatın altındaki en yakın pivot low → destek
            supports_below = [p for p in pivot_lows if p < current_price]
            if supports_below:
                support_1h = max(supports_below)

            # Fiyatın üstündeki en yakın pivot high → direnç
            resists_above = [p for p in pivot_highs if p > current_price]
            if resists_above:
                resist_1h = min(resists_above)

        else:
            # 1H veri yoksa 1D bazlı yaklaşık destek / direnç
            support_1h = current_price - atr_1d * 1.5
            resist_1h  = current_price + atr_1d * 2.0

        # ── BUY ZONE ──────────────────────────────────────────────────
        # Giriş bölgesi: mevcut fiyattan ATR'nin %25'i kadar altında
        # Destek noktasının biraz üstünde
        buy_zone_low  = round(max(support_1h, current_price - atr_1d * 0.5), 2)
        buy_zone_high = round(current_price + atr_1d * 0.2, 2)

        # ── STOP LOSS ZONE ────────────────────────────────────────────
        # 1H destek noktasının %1 altında — 1.5x ATR mesafesi
        stop_low  = round(max(support_1h - atr_1d * 0.5, current_price - atr_1d * 2.0), 2)
        stop_high = round(support_1h - atr_1d * 0.1, 2)
        if stop_high >= buy_zone_low:
            stop_high = round(buy_zone_low - atr_1d * 0.1, 2)
        if stop_low >= stop_high:
            stop_low = round(stop_high - atr_1d * 0.2, 2)

        # ── SELL ZONE (TARGET) — R/R 2.5:1 ───────────────────────────
        # Risk = buy_zone_low - stop_high
        # Reward = Risk * 2.5
        risk = max(buy_zone_low - stop_high, atr_1d * 0.5)
        reward = risk * 2.5

        sell_zone_low  = round(buy_zone_low + reward * 0.8, 2)
        sell_zone_high = round(buy_zone_low + reward, 2)

        # Direnç noktasını da dikkate al
        if resist_1h > buy_zone_high and resist_1h < sell_zone_high:
            sell_zone_high = round(resist_1h * 0.99, 2)
            sell_zone_low  = round(sell_zone_high - atr_1d * 0.5, 2)

        # Gerçek R/R hesapla
        actual_risk   = buy_zone_low - stop_high
        actual_reward = sell_zone_high - buy_zone_low
        rr_ratio = round(actual_reward / actual_risk, 2) if actual_risk > 0 else 0.0

        return {
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
        logging.error(f"❌ Destek/Direnç hesaplama hatası: {e}")
        fallback_atr = current_price * 0.025
        buy_l = round(current_price * 0.985, 2)
        buy_h = round(current_price * 1.01, 2)
        stop_h = round(current_price * 0.97, 2)
        stop_l = round(current_price * 0.965, 2)
        sell_h = round(buy_l + (buy_l - stop_h) * 2.5, 2)
        sell_l = round(sell_h - fallback_atr, 2)
        return {
            "buy_zone":  {"low": buy_l,  "high": buy_h},
            "sell_zone": {"low": sell_l, "high": sell_h},
            "stop_zone": {"low": stop_l, "high": stop_h},
            "support_1h": stop_h, "resist_1h": sell_h,
            "atr_1d": round(fallback_atr, 2), "atr_pct": 2.5,
            "rr_ratio": 2.5, "risk_usd": round(buy_l - stop_h, 2),
            "reward_usd": round(sell_h - buy_l, 2),
        }

# ================================================================
# ================================================================
# BÖLÜM 5: PERFORMANS VERİLERİ
# ================================================================
# ================================================================

def get_price_performance(df_1d: pd.DataFrame, ticker: str) -> dict:
    """
    1G, 1H (hafta), 1A (ay), 1Y (yıl), 5Y (5 yıl) değişim oranlarını hesaplar.
    5Y için ek veri çekilir.
    """
    try:
        close = df_1d['Close']
        perf = {}

        # 1 Günlük
        if len(close) >= 2:
            perf['1d'] = round((float(close.iloc[-1]) - float(close.iloc[-2])) / float(close.iloc[-2]) * 100, 2)
        else:
            perf['1d'] = 0.0

        # 1 Haftalık (5 işlem günü)
        if len(close) >= 6:
            perf['1w'] = round((float(close.iloc[-1]) - float(close.iloc[-6])) / float(close.iloc[-6]) * 100, 2)
        else:
            perf['1w'] = 0.0

        # 1 Aylık (21 işlem günü)
        if len(close) >= 22:
            perf['1m'] = round((float(close.iloc[-1]) - float(close.iloc[-22])) / float(close.iloc[-22]) * 100, 2)
        else:
            perf['1m'] = 0.0

        # 1 Yıllık — cache'deki veri sınırlı olabilir, doğrudan çekilir
        try:
            stock = yf.Ticker(ticker)
            hist_1y = stock.history(period="1y", interval="1d")
            if len(hist_1y) >= 2:
                perf['1y'] = round((float(hist_1y['Close'].iloc[-1]) - float(hist_1y['Close'].iloc[0])) / float(hist_1y['Close'].iloc[0]) * 100, 2)
            else:
                perf['1y'] = 0.0
        except Exception:
            perf['1y'] = 0.0

        # 5 Yıllık
        try:
            hist_5y = stock.history(period="5y", interval="1mo")
            if len(hist_5y) >= 2:
                perf['5y'] = round((float(hist_5y['Close'].iloc[-1]) - float(hist_5y['Close'].iloc[0])) / float(hist_5y['Close'].iloc[0]) * 100, 2)
            else:
                perf['5y'] = 0.0
        except Exception:
            perf['5y'] = 0.0

        return perf
    except Exception:
        return {'1d': 0.0, '1w': 0.0, '1m': 0.0, '1y': 0.0, '5y': 0.0}

# ================================================================
# ================================================================
# BÖLÜM 6: EARNINGS & PİYASA ANALİZİ
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
        if earnings_date.tzinfo is None:
            earnings_date = earnings_date.replace(tzinfo=NY_TZ)
        days_until = (earnings_date - now).days
        if 0 <= days_until < min_days_away: return False
        if -2 <= days_until < 0: return False
        return True
    except Exception:
        return True


async def analyze_market_and_sectors():
    """Piyasa rejimi (VIX + SPY) ve sektör performansı analizi."""
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
        logging.error(f"Piyasa analizi hatası: {e}")

    # Sektör performansı
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

    logging.info("✅ Piyasa ve Sektör Analizi Tamamlandı.")

# ================================================================
# ================================================================
# BÖLÜM 7: PROFIT TARGET / STOP LOSS (ATR BAZLI)
# ================================================================
# ================================================================

def calculate_profit_target(entry_price, atr_value, momentum_score, is_exhausted=False, beta=1.0):
    """V114 — ATR Bazlı Dinamik TP/SL (Tavan %10-12)"""
    if pd.isna(atr_value) or atr_value == 0:
        fallback_tp_pct = 0.07 if not is_exhausted else 0.04
        return entry_price * (1 + fallback_tp_pct), entry_price * 0.98

    atr_multiplier_sl = 1.5 if atr_value < entry_price * 0.01 else 2.0
    stop_loss = entry_price - atr_value * atr_multiplier_sl
    m = min(1.0, momentum_score / 12.0)
    tp_atr_mult = 1.8 if is_exhausted else 1.8 + (0.7 * m)
    profit_target_raw = entry_price + atr_value * tp_atr_mult
    profit_pct_raw = (profit_target_raw - entry_price) / entry_price * 100
    max_profit_pct = 12.0 if beta > 1.5 else 10.0
    profit_target = entry_price * (1 + max_profit_pct / 100) if profit_pct_raw > max_profit_pct else profit_target_raw

    return float(round(profit_target, 4)), float(round(stop_loss, 4))


def estimate_hold_time(momentum_score, vol_increase, profit_pct=0.0, atr_pct=0.0, is_exhausted=False):
    directional_daily = atr_pct * 0.20
    hold = int(profit_pct / directional_daily) if directional_daily > 0 and profit_pct > 0 else 7
    hold = max(3, min(20, hold))
    m = min(1.0, momentum_score / 14.0)
    if m >= 0.90: hold -= 2
    elif m >= 0.75: hold -= 1
    elif m < 0.35: hold += 2
    elif m < 0.50: hold += 1
    if vol_increase >= 2.2: hold -= 2
    elif vol_increase >= 1.8: hold -= 1
    elif vol_increase < 0.8: hold += 2
    if is_exhausted: hold += 3
    return max(3, min(15, hold))

# ================================================================
# ================================================================
# BÖLÜM 8: ANA HISSE ANALİZİ (apply_atmaca_filters)
# ================================================================
# ================================================================
# 🚀 AKILLI AĞ YÖNETİMİ STRATEJİSİ:
#
#  AŞAMA 1 (500 hisse — SIFIR network I/O):
#    • 1D veri sadece BULK_DATA_CACHE'den okunur (0 ms)
#    • EMA, ADX, RVOL, Dead Money → hızlı eleme
#    • Katman 2'yi geçemeyen ~450 hisse anında return None
#
#  AŞAMA 2 (sadece Katman 2 geçenler — ~50 hisse):
#    • Earnings kontrolü (yf.Ticker)
#    • 1H verisi çekimi (yf.Ticker)
#    → Bu 2 işlem yaklaşık 50 kez çalışır, 500 kez değil!
# ================================================================

async def apply_atmaca_filters(ticker: str) -> Optional[dict]:
    """
    Tek hisse için kapsamlı teknik analiz.
    AŞAMA 1: 1D veri (bellek) → Hızlı eleme (500 hisse, sıfır network)
    AŞAMA 2: 1H + Earnings (sadece Katman 2 geçenler ~50 hisse)
    + ATR + EMA + RSI + ADX + MACD + OBV + BB + Smart Money + Ichimoku + VP
    """
    try:
        ticker = ticker.strip().upper()

        # ── HARD FILTER: Piyasa WEAK ise geç (0 ms) ─────────────────
        if MARKET_STATUS.get("regime") == "WEAK":
            return None

        # ── AŞAMA 1: SADECE BELLEK — SIFIR NETWORK I/O ───────────────
        # persistent_info_cache'den (önceki taramalardan birikim)
        global persistent_info_cache
        cached_info = get_stock_info(ticker)
        market_cap  = cached_info.get("market_cap", 0)
        beta        = cached_info.get("beta", 1.0)
        sector_name = cached_info.get("sector", "Unknown")
        short_float = cached_info.get("short_float", 0.0)

        # 1D veri → BULK_DATA_CACHE'den (0 ms, yf.download zaten yükledi)
        df_1d = await asyncio.to_thread(get_stock_data, ticker, "1d")
        if df_1d is None or len(df_1d) < 50:
            return None

        # Hacim hard filter
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
        details.append("✅ EVREN: Likidite/Yapısal Koşullar Tamam")
        score += 4.0

        # ── SEKTÖR ROTASYONU ────────────────────────────────────────
        sec_perf = SECTOR_PERFORMANCE.get(sector_name, 0.0)
        if sec_perf > 2.0:
            score += 6.0; details.append(f"🔥 Sektör: {sector_name} HOT (+{sec_perf:.1f}%)")
        elif sec_perf > 0:
            score += 1.2; details.append(f"📊 Sektör: {sector_name} Pozitif (+{sec_perf:.1f}%)")
        elif sec_perf < -2.0:
            score -= 3.2; details.append(f"🥶 Sektör: {sector_name} SOĞUK ({sec_perf:.1f}%)")
        else:
            score -= 0.8; details.append(f"➖ Sektör: {sector_name} Nötr ({sec_perf:.1f}%)")

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
                    score += 4.8; rs_label = "Güçlü Outperform"; details.append(f"💪 RS: {INDEX_BENCHMARK} üstünde (Güçlü)")
                elif rs_slope > 0:
                    score += 2.0; rs_label = "Hafif Outperform"; details.append(f"📈 RS: {INDEX_BENCHMARK} üstünde (Hafif)")
                elif rs_slope > -0.0005:
                    score -= 1.2; rs_label = "Nötr"; details.append(f"➖ RS: Paralel")
                else:
                    score -= 3.2; rs_label = "Underperform"; details.append(f"⚠️ RS: {INDEX_BENCHMARK} altında")

        # ── EMA SİSTEMİ ─────────────────────────────────────────────
        ema20_1d = EMAIndicator(close_1d, 20).ema_indicator()
        ema50_1d = EMAIndicator(close_1d, 50).ema_indicator()
        ema200_1d = EMAIndicator(close_1d, 200).ema_indicator()
        last_ema20  = float(ema20_1d.iloc[-1])
        last_ema50  = float(ema50_1d.iloc[-1])
        last_ema200 = float(ema200_1d.iloc[-1])
        trend_durumu_1d = "N/A"

        if current_price > last_ema50 and last_ema50 > last_ema200:
            score += 14.0; details.append("🏆 1D TREND: Makro Bullish (P>EMA50>EMA200)"); trend_durumu_1d = "Makro Bullish"
            ema_spread = (last_ema50 - last_ema200) / last_ema200 if last_ema200 > 0 else 0.0
            if ema_spread > 0.03:
                score += 1.6; details.append("🔥 EMA50-200 Spread Geniş")
        elif current_price > last_ema20 and last_ema20 > last_ema50 and last_ema50 > last_ema200:
            score += 8.8; details.append("📈 1D TREND: Yükseliş Sırası (EMA20>50>200)"); trend_durumu_1d = "Yükseliş"
        elif current_price > last_ema200:
            score += 3.2; details.append("🟢 1D TREND: EMA200 Üstü"); trend_durumu_1d = "EMA200 Üstü"
        elif current_price > last_ema50:
            score += 1.2; details.append("🟡 1D TREND: EMA50 Üstü"); trend_durumu_1d = "EMA50 Üstü"
        else:
            score -= 6.0; details.append("🔴 1D TREND: Downtrend"); trend_durumu_1d = "Downtrend"

        cond_ema20_slope_positive = calculate_ema_slope(ema20_1d, periods=10)
        if cond_ema20_slope_positive:
            score += 4.0; details.append("📈 EMA20: Pozitif eğim")
        else:
            score -= 1.6; details.append("📉 EMA20: Negatif/Yatay eğim")

        # Dead Money Koruması
        ema20_slope_numeric = (ema20_1d.iloc[-1] - ema20_1d.iloc[-10]) / ema20_1d.iloc[-10] if len(ema20_1d) >= 10 and ema20_1d.iloc[-10] > 0 else 0.0
        is_ema_flat = abs(ema20_slope_numeric) < 0.008

        # ── ADX ──────────────────────────────────────────────────────
        try:
            adx_series_1d = ADXIndicator(high_1d, low_1d, close_1d, 14).adx()
            adx_1d = float(adx_series_1d.iloc[-1])
        except Exception:
            adx_series_1d = pd.Series(data=0.0, index=df_1d.index)
            adx_1d = 0.0

        if adx_1d >= 30: score += 6.0; details.append(f"🔥 ADX: Çok Güçlü ({adx_1d:.1f})")
        elif adx_1d >= 25: score += 4.0; details.append(f"💪 ADX: Güçlü ({adx_1d:.1f})")
        elif adx_1d >= 20: score += 2.0; details.append(f"📊 ADX: Orta ({adx_1d:.1f})")
        elif adx_1d >= 15: score += 0.4; details.append(f"🟡 ADX: Zayıf ({adx_1d:.1f})")
        else:              score -= 2.0; details.append(f"⚠️ ADX: Çok Zayıf ({adx_1d:.1f})")

        try:
            adx_slope = adx_series_1d.diff().tail(5).mean()
            if adx_slope > 0.5: score += 1.6; details.append("🚀 ADX Momentum: Hızlanıyor")
            elif adx_slope < -0.5: score -= 1.2; details.append("🐌 ADX Momentum: Yavaşlıyor")
        except Exception:
            pass

        if is_ema_flat and adx_1d < 15:
            return None  # Dead Money

        # ── KATMAN 2: AKIŞ & MOMENTUM FİLTRESİ ─────────────────────
        layer2_pass = True
        layer2_reasons = []

        try:
            vol_2g_avg  = float(volume_1d.tail(2).mean())
            vol_20g_avg = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_2g_avg
            rvol_micro  = (vol_2g_avg / vol_20g_avg) if vol_20g_avg > 0 else 0.0
        except Exception:
            rvol_micro = 0.0
        rvol_5_30 = rvol_micro

        # 1. HACİM ESNETİLDİ: Konsolidasyon evresindeki hisseler elenmesin (0.90 yeterli)
        if rvol_micro < 0.90:
            layer2_pass = False; layer2_reasons.append(f"Micro-RVOL={rvol_micro:.2f}<0.90")

        # 2. TREND ESNETİLDİ: Pullback (dipten dönüş) yakalayabilmek için EMA50 yerine EMA200'e (Makro Trend) bakılır.
        try:
            ema200_val = float(ema200_1d.iloc[-1])
            if current_price < ema200_val:
                layer2_pass = False; layer2_reasons.append("Makro Trend (EMA200) kırık")
        except Exception:
            pass

        # 3. ADX ESNETİLDİ: 10 seviyesi yatay piyasa uyanışı için kafidir.
        if adx_1d > 0 and adx_1d < 10:
            layer2_pass = False; layer2_reasons.append(f"ADX={adx_1d:.1f}<10")

        try:
            last10 = df_1d.tail(10)
            green_candles = int((last10['Close'] > last10['Open']).sum())
        except Exception:
            green_candles = 0
        if green_candles < 3:
            layer2_pass = False; layer2_reasons.append(f"Yeşil mum={green_candles}<3")

        try:
            df_cmf = df_1d.tail(20)
            hl_range = (df_cmf['High'] - df_cmf['Low']).replace(0, np.nan)
            mfm = ((df_cmf['Close'] - df_cmf['Low']) - (df_cmf['High'] - df_cmf['Close'])) / hl_range
            cmf_val = float((mfm * df_cmf['Volume']).sum() / df_cmf['Volume'].sum()) if df_cmf['Volume'].sum() > 0 else 0.0
        except Exception:
            cmf_val = 0.0

        # 4. PARA GİRİŞİ ESNETİLDİ: Hafif eksiler tolere edilir (-0.10). Sadece sert mal boşaltmaları elenir.
        if cmf_val != 0.0 and cmf_val < -0.10:
            layer2_pass = False; layer2_reasons.append(f"CMF={cmf_val:.3f}<-0.10")
            
        if not layer2_pass:
            return None

        # ============================================================
        # 🚀 AKILLI AĞ GEÇİŞİ — SADECE KATMAN 2'Yİ GEÇEN ~50 HİSSE
        # İÇİN İNTERNETE ÇIKIYORUZ. 450 kötü hisse zaten yukarda elendi.
        # ============================================================

        # 1) Earnings güvenliği (yf.Ticker → network, ama sadece ~50 kez)
        if not await asyncio.to_thread(is_earnings_safe_for_swing, ticker):
            logging.info(f"🚫 {ticker}: Earnings yakın → ELEME")
            return None

        # 2) 1H verisi (yf.Ticker → network, ama sadece ~50 kez)
        df_1h = await asyncio.to_thread(get_stock_data, ticker, "1h")

        # ============================================================

        score += 6.0
        details.append(f"✅ KATMAN 2: Momentum Onaylı (RVOL:{rvol_micro:.2f}x | Yeşil:{green_candles}/10 | CMF:{cmf_val:.3f})")
        if rvol_micro >= 1.60:
            score += 2.0; details.append(f"🔥 Micro-RVOL Agresif: {rvol_micro:.2f}x")

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
            score += 3.2; details.append("🟦 VOL Rejim: Sıkışma (Breakout Adayı)")
        elif 0.020 <= atr_pct_1d < 0.040:
            score += 4.0; details.append("🟩 VOL Rejim: Erken Swing")
        elif 0.040 <= atr_pct_1d <= 0.080:
            score += 6.0; details.append("⚡ VOL Rejim: Swing İdeal Bölge")
        else:
            score += 1.2; details.append("🟨 VOL Rejim: Yüksek (Dikkatli)")

        # ── RSI ──────────────────────────────────────────────────────
        try:
            rsi_1d_series = RSIIndicator(close_1d, 14).rsi()
            rsi_1d_val = float(rsi_1d_series.iloc[-1])
        except Exception:
            rsi_1d_val = 50.0

        if 40 <= rsi_1d_val <= 55:
            score += 6.0; details.append(f"🌀 RSI: Momentum Başlangıcı ({rsi_1d_val:.1f})")
        elif 55 < rsi_1d_val <= 70:
            score += 3.2; details.append(f"📈 RSI: Momentum Devamı ({rsi_1d_val:.1f})")
        elif 70 < rsi_1d_val <= 82:
            score += 1.2; details.append(f"⚠️ RSI: Aşırıya Yakın ({rsi_1d_val:.1f})")
        elif rsi_1d_val < 35:
            score -= 3.2; details.append(f"❄️ RSI: Zayıf ({rsi_1d_val:.1f})")
        elif rsi_1d_val > 82:
            score -= 2.0; details.append(f"🔴 RSI: Aşırı Alım ({rsi_1d_val:.1f})")
        else:
            score += 0.4; details.append(f"➖ RSI: Nötr ({rsi_1d_val:.1f})")

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
                score += 4.0; details.append(f"🌅 Erken Uyanış: RSI {rsi_1d_val:.1f} (Optimal Giriş)")
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
                score += 3.0; details.append(f"📈 MACD Hist: Yükselen ({macd_hist_val:.3f})")
            elif macd_hist_val > 0:
                score += 1.5; details.append(f"✅ MACD Hist: Pozitif ({macd_hist_val:.3f})")
            elif macd_hist_val < 0:
                score -= 2.0; details.append(f"⚠️ MACD Hist: Negatif ({macd_hist_val:.3f})")
        except Exception:
            macd_hist_val = 0.0; macd_line = pd.Series(); macd_signal = pd.Series()

        # ── 1D ÖZET ──────────────────────────────────────────────────
        d1_summary = {
            "Trend Status": trend_durumu_1d,
            "EMA20 Slope": "Positive" if cond_ema20_slope_positive else "Negative/Flat",
            "RSI(14)": f"{rsi_1d_val:.1f}",
            "ADX": f"{adx_1d:.1f}",
            "ATR%": f"{atr_pct_1d * 100:.2f}%",
            "BB Width": f"{bb_width_1d * 100:.1f}%",
            "MACD_Hist": f"{macd_hist_val:.3f}",
        }

        # ── 1H MİKRO ANALİZ ─────────────────────────────────────────
        h1_summary = {"Durum": "Yetersiz Veri"}
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

            rvol_durumu = "🔥 AŞIRI YOĞUN" if rvol_1h > 3.0 else "✅ Yüksek" if rvol_1h > 1.5 else "❄️ Hacimsiz" if rvol_1h < 0.7 else "Normal"
            close_now_1h  = float(close_1h.iloc[-1])
            ema20_now_1h  = float(ema20_1h.iloc[-1])
            ema50_now_1h  = float(ema50_1h.iloc[-1])
            ema20_distance = (close_now_1h - ema20_now_1h) / ema20_now_1h if ema20_now_1h > 0 else 0.0

            if adx_1h >= 30: score += 10.0; details.append(f"🔥 1H ADX: Çok Güçlü ({adx_1h:.1f})")
            elif adx_1h >= 20: score += 6.0; details.append(f"💪 1H ADX: Güçlü ({adx_1h:.1f})")
            elif adx_1h >= 14: score += 2.4; details.append(f"🟡 1H ADX: Erken ({adx_1h:.1f})")
            else: score -= 3.2; details.append(f"⚠️ 1H ADX: Zayıf ({adx_1h:.1f})")

            if ema20_distance > 0.05:
                score -= 8.0; details.append(f"🔴 1H: EMA20'den uzak (+{ema20_distance*100:.1f}% FOMO)")
            elif close_now_1h > ema50_now_1h:
                score += 4.8; details.append("🏗️ 1H: EMA50 Üstü (Güçlü)")
            elif close_now_1h > ema20_now_1h:
                score += 2.0; details.append("🟡 1H: EMA20 Üstü")
            else:
                score -= 2.4; details.append("⚠️ 1H: EMA Altı")

            cond_ema20_slope_1h = calculate_ema_slope(ema20_1h, periods=5)
            if cond_ema20_slope_1h: score += 2.0; details.append("📈 1H EMA20: Pozitif Eğim")

            if 45 <= rsi_1h <= 72: score += 2.4; details.append(f"🌀 1H RSI: Optimal ({rsi_1h:.1f})")
            elif 72 < rsi_1h <= 82: score -= 4.0; details.append(f"⚠️ 1H RSI: Aşırı Alım ({rsi_1h:.1f})")
            elif rsi_1h > 82: score -= 10.0; details.append(f"🔴 1H RSI: FOMO Zirvesi ({rsi_1h:.1f})")
            elif rsi_1h < 35: score -= 2.0; details.append(f"❄️ 1H RSI: Zayıf ({rsi_1h:.1f})")

            if rvol_1h >= 2.5: score += 7.2; details.append(f"🐳 1H RVOL: Para Girişi ({rvol_1h:.1f}x)")
            elif rvol_1h >= 1.5: score += 3.2; details.append(f"📊 1H RVOL: Yüksek ({rvol_1h:.1f}x)")
            elif rvol_1h < 0.7: score -= 1.6; details.append(f"❄️ 1H RVOL: Hacimsiz ({rvol_1h:.1f}x)")

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
            score -= 1.2; details.append("⚠️ 1H Veri Yok")

        # ── MTF KİLİDİ ───────────────────────────────────────────────
        # EMA50 altına sarkan kaliteli hisseleri (Pullback) öldürmemek için EMA200 barajı kullanılır.
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

        if obv_slope > 1000: score += 6.0; details.append("✅ OBV: Güçlü Akümülasyon")
        elif obv_slope > 0: score += 2.4; details.append("📈 OBV: Pozitif Trend")
        elif obv_slope < -1000: score -= 3.2; details.append("⚠️ OBV: Dağıtım Riski")
        else: score -= 0.8; details.append("➖ OBV: Nötr")

        # ── RVOL (1D) ─────────────────────────────────────────────────
        vol_today = float(volume_1d.iloc[-1])
        vol_ma_1d = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_today
        rvol_today = (vol_today / vol_ma_1d) if vol_ma_1d > 0 else 0.0
        close_change_pct = (float(close_1d.iloc[-1]) - float(close_1d.iloc[-2])) / float(close_1d.iloc[-2]) if len(close_1d) > 1 else 0.0

        # Fake Spike Koruması
        if rvol_today > 2.5 and close_change_pct < -0.015:
            return None

        try:
            price_20d_range = (high_1d.tail(20).max() - low_1d.tail(20).min()) / current_price
            if 0 < price_20d_range < 0.05:
                return None  # Kronik stabil
        except Exception:
            pass

        if 1.2 <= rvol_today <= 1.8 and abs(close_change_pct) < 0.006:
            score += 6.4; details.append(f"🐋 RVOL Rejim: Sessiz Birikim ({rvol_today:.2f}x)")
        elif rvol_today > 2.0 and close_change_pct > 0.008:
            score += 8.0; details.append(f"🚀 RVOL Rejim: Swing Uyanışı ({rvol_today:.2f}x)")
        elif rvol_today > 1.5:
            score += 3.2; details.append(f"📊 RVOL Rejim: Aktif ({rvol_today:.2f}x)")
        elif rvol_today < 0.6:
            score -= 3.2; details.append(f"🐢 RVOL Rejim: Hacimsiz ({rvol_today:.2f}x)")
        else:
            score += 0.8; details.append(f"➖ RVOL Rejim: Normal ({rvol_today:.2f}x)")

        # ── HACİM TRENDİ ─────────────────────────────────────────────
        vol_avg5  = float(volume_1d.tail(VOLUME_INCREASE_LOOKBACK).mean())
        vol_avg20 = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_avg5
        vol_increase_ratio = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 0.0

        if vol_increase_ratio > 1.4: score += 7.2; details.append(f"🔥 Hacim Trendi: Artış ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio > 1.1: score += 4.0; details.append(f"📈 Hacim Trendi: Erken ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio < 0.8: score -= 2.4; details.append(f"📉 Hacim Trendi: Zayıf ({vol_increase_ratio:.2f}x)")
        else: score += 0.8; details.append(f"➖ Hacim Trendi: Stabil ({vol_increase_ratio:.2f}x)")

        # ── MARKET REGIME ─────────────────────────────────────────────
        market_regime = MARKET_STATUS.get("regime", "UNKNOWN")
        try:
            ema50_10d_ago = float(ema50_1d.iloc[-10]) if len(ema50_1d) >= 10 else float(ema50_1d.iloc[-1])
            ema50_slope_check = (float(ema50_1d.iloc[-1]) - ema50_10d_ago) / ema50_10d_ago if ema50_10d_ago > 0 else 0.0
        except Exception:
            ema50_slope_check = 0.0
        vol_5d_trend = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 1.0
        if ema50_slope_check > 0 and vol_5d_trend > 1.1:
            score += 3.2; details.append("🟢 Trend-Hacim Senkron")
        if market_regime == "STRONG":
            if ema50_slope_check > 0: score += 3.2; details.append("💎 STRONG Market Uyumu")
        elif market_regime == "BULLISH":
            if vol_5d_trend >= 0.80: score += 1.6; details.append("✅ Bullish Market Uyumu")
        elif market_regime == "CHOPPY":
            if vol_5d_trend >= 0.75 and ema50_slope_check > 0: score += 3.2; details.append("✅ Choppy'de Sağlam Sinyal")
            else: score -= 3.2; details.append("⚠️ Choppy Market Zayıf Yapı")

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

        # ── GİRİŞ TETİKLEYİCİSİ ─────────────────────────────────────
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

        if bb_squeeze and ema_stack and rvol_today > 1.3:
            score += 10.0; entry_trigger = "BB Squeeze + EMA Stack + Volume"
            details.append("💥 ENTRY: Squeeze → Breakout (Strong)")
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
            score -= 1.2; details.append("⏳ ENTRY: Henüz tetik yok")

        if rr_ratio_calc < (MIN_RR_RATIO_RELAXED if entry_trigger else MIN_RR_RATIO):
            score -= 4.0; details.append(f"⚠️ R/R Yetersiz ({rr_ratio_calc:.2f})")

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
        logging.info(f"✅ {ticker}: Analiz tamamlandı (Skor: {score:.2f}{exhaust_tag})")

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
            "trend_durumu_1d": trend_durumu_1d,
            "details": details,
            "d1_summary": d1_summary,
            "h1_summary": h1_summary,
            "smart_money": smart_money,
            "rising_data": rising,
            "meta": {"1d": d1_summary, "1h": h1_summary, "volume_regime": volume_regime_str},
            # Katman 3 ağır veri alanları (sonradan doldurulur)
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
# ================================================================
# BÖLÜM 9: 8-FAKTÖR COMPOSITE SKOR
# ================================================================
# ================================================================

def compute_multi_factor_score(c: dict) -> float:
    """Katman 3 Composite Skor (RVOL × Trend × İvme × ADX × DollarVol × Volatilite)"""
    base_score = c.get("score", 0.0)
    d1 = c.get("meta", {}).get("1d", {})

    rvol_raw = c.get("rvol_5_30", 1.0)
    rvol_zscore = min(max((rvol_raw - 1.0) / 0.5 * 4, 0.0), 14.0)

    trend_score = 0.0
    if d1.get("EMA20 Eğimi") == "Pozitif": trend_score += 4.0
    adx_val = float(d1.get("ADX", 0) or 0)
    if adx_val >= 30: trend_score += 8.0
    elif adx_val >= 25: trend_score += 6.0
    elif adx_val >= 18: trend_score += 4.0
    trend_durumu = str(d1.get("Trend Durumu", ""))
    if "Makro" in trend_durumu: trend_score = min(trend_score + 4.0, 12.0)
    elif "Yükseliş" in trend_durumu: trend_score = min(trend_score + 2.0, 12.0)

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
# BÖLÜM 10: BOGA AI 100'LÜK SKORU
# ================================================================
# ================================================================

def compute_boga_score_100(c: dict) -> float:
    """
    100 üzerinden BOGA AI Swing Trade Skoru.
    Teknik (70%) + Fundamental (15%) + Risk/Reward (15%)
    """
    score_100 = 0.0

    # ── TEKNİK (70 puan) ────────────────────────────────────────────
    # Composite score normalize: 0-200 arası → 0-35 puan
    composite = c.get("composite_score", 0.0)
    score_100 += min(composite / 14.0 * 35.0, 35.0)

    # RSI optimal bölge (0-10 puan)
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
        score_100 += 5.0  # Veri yoksa nötr puan ver

    # ── RİSK / REWARD (15 puan) ─────────────────────────────────────
    # Risk/Reward bölümündeki boga_zones verisini kullan
    rr = c.get("boga_rr", c.get("rr_ratio", 0.0))
    if rr >= 2.5: score_100 += 15.0
    elif rr >= 2.0: score_100 += 12.0
    elif rr >= 1.5: score_100 += 8.0
    elif rr >= 1.2: score_100 += 4.0

    # Exhausted cezası
    if c.get("is_exhausted"):
        score_100 *= 0.75

    return round(min(score_100, 100.0), 1)

# ================================================================
# ================================================================
# BÖLÜM 11: ÇEŞİTLENDİRİLMİŞ SEÇME
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
# BÖLÜM 12: GEMINI AI ÖZETLER (6 DİL)
# ================================================================
# ================================================================

async def generate_gemini_summary(c: dict, fin_health: dict, zones: dict) -> dict:
    """
    BOGA AI tarafından desteklenen Gemini AI ile 6 dilde özet üretir.

    homepage_summary: 1 cümlelik kısa özet (ana sayfa için)
    detail_summary: 3-5 cümlelik neden seçildiğinin gerekçesi (detay sayfası)

    Teknik indikatörler: Kullanıcı dostu açıklamalarla (teknik değil anlam odaklı)
    Fundamental veriler: Şirketin sağlığını sade dilde anlatır
    """
    if not GEMINI_API_KEY:
        return _fallback_summary(c)

    ticker       = c.get("ticker", "")
    company      = c.get("company", ticker)
    sector       = c.get("sector", "Unknown")
    price        = c.get("current_price", 0.0)
    rsi          = c.get("rsi_14", 50.0)
    adx          = c.get("adx", 0.0)
    macd_hist    = c.get("macd_hist", 0.0)
    mfi          = c.get("mfi", 50.0)
    ema20        = c.get("ema20", 0.0)
    ema50        = c.get("ema50", 0.0)
    ema200       = c.get("ema200", 0.0)
    score_100    = c.get("boga_score_100", 0.0)
    entry_trigger = c.get("entry_trigger", "")
    trend_status = c.get("trend_durumu_1d", "")
    rr           = zones.get("rr_ratio", 0.0)
    buy_low      = zones["buy_zone"]["low"]
    buy_high     = zones["buy_zone"]["high"]
    sell_high    = zones["sell_zone"]["high"]
    stop_high    = zones["stop_zone"]["high"]

    # Fundamental veriler
    gross_m  = fin_health.get("gross_margin", 0)
    op_m     = fin_health.get("operating_margin", 0)
    net_m    = fin_health.get("net_margin", 0)
    rev_g    = fin_health.get("revenue_growth", 0)
    pe       = fin_health.get("pe_ratio", 0)
    pb       = fin_health.get("pb_ratio", 0)
    fcf_y    = fin_health.get("fcf_yield", 0)
    mcap     = fin_health.get("market_cap_b", 0)

    # Performans
    perf = c.get("performance", {})
    p1d = perf.get("1d", 0.0); p1w = perf.get("1w", 0.0)
    p1m = perf.get("1m", 0.0); p1y = perf.get("1y", 0.0); p5y = perf.get("5y", 0.0)

    prompt = f"""
You are BOGA AI, a professional swing trade analysis assistant. Your task is to generate investment summaries for the stock {ticker} ({company}) in the {sector} sector.

BOGA AI SCORE: {score_100}/100
TECHNICAL INDICATORS: {trend_status}, RSI={rsi:.1f}, ADX={adx:.1f}, MACD Hist={macd_hist:.3f}, MFI={mfi:.1f}.
ZONES (Target/Stop): ${sell_high:.2f} / ${stop_high:.2f}.
FUNDAMENTALS: Margin={net_m:.1f}%, Growth={rev_g:.1f}%, PE={pe:.1f}.

INSTRUCTIONS:
1. Write a "homepage_summary": ONE sentence summary in English.
2. Write a "detail_summary": 3-5 sentences technical reasoning in English.

Generate output ONLY as JSON:
{{
  "homepage_summary": {{ "en": "..." }},
  "detail_summary": {{ "en": "..." }}
}}
"""

    try:
        url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2000}
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=30) as resp:
                if resp.status != 200:
                    logging.error(f"Gemini API hatası ({ticker}): HTTP {resp.status}")
                    return _fallback_summary(c)
                data = await resp.json()

        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        raw_text = re.sub(r"```json|```", "", raw_text).strip()
        result = json.loads(raw_text)
        logging.info(f"✅ {ticker}: Gemini AI özeti oluşturuldu.")
        return result

    except Exception as e:
        logging.error(f"❌ {ticker} Gemini API hatası: {e}")
        return _fallback_summary(c)


def _fallback_summary(c: dict) -> dict:
    """Gemini API çalışmadığında varsayılan özet."""
    ticker = c.get("ticker", "")
    score  = c.get("boga_score_100", 0.0)
    trend  = c.get("trend_durumu_1d", "Bullish")
    rsi    = c.get("rsi_14", 50.0)

    hp_en = f"BOGA AI selected {ticker} as a high-probability swing trade with a score of {score}/100."
    dt_en = (
        f"BOGA AI has identified {ticker} as a compelling swing trade opportunity. "
        f"The stock is in a {trend} trend with RSI at {rsi:.1f}, indicating momentum "
        f"is building without being overstretched. Volume and price action confirm "
        f"institutional accumulation. The Risk/Reward setup offers favorable returns "
        f"relative to the defined stop loss level."
    )

    langs = {"en": (hp_en, dt_en)}
    # Simplified multilingual fallbacks
    langs["tr"] = (
        f"BOGA AI, {ticker} hissesini {score}/100 skorla yüksek olasılıklı swing işlemi olarak seçti.",
        f"BOGA AI, {ticker} hissesini cazip bir swing trade fırsatı olarak belirledi. "
        f"Hisse {trend} trendinde, RSI {rsi:.1f} ile momentum ivme kazanıyor. "
        f"Hacim ve fiyat hareketleri kurumsal birikim yapıldığını teyit ediyor. "
        f"Risk/Ödül oranı tanımlanmış stop loss seviyesine göre avantajlı getiri sunuyor."
    )
    langs["es"] = (
        f"BOGA AI seleccionó {ticker} como operación swing de alta probabilidad con puntuación {score}/100.",
        f"BOGA AI identificó {ticker} como una atractiva oportunidad de swing trade. "
        f"La acción está en tendencia {trend} con RSI {rsi:.1f} mostrando impulso sin sobreextenderse. "
        f"El volumen y la acción del precio confirman acumulación institucional. "
        f"La relación riesgo/recompensa ofrece retornos favorables respecto al stop loss definido."
    )
    langs["pt"] = (
        f"BOGA AI selecionou {ticker} como trade swing de alta probabilidade com pontuação {score}/100.",
        f"BOGA AI identificou {ticker} como uma oportunidade de swing trade atraente. "
        f"A ação está em tendência {trend} com RSI {rsi:.1f} mostrando impulso sem exageros. "
        f"Volume e ação do preço confirmam acumulação institucional. "
        f"A relação risco/retorno oferece ganhos favoráveis em relação ao stop loss definido."
    )
    langs["fr"] = (
        f"BOGA AI a sélectionné {ticker} comme opportunité de swing trade avec un score de {score}/100.",
        f"BOGA AI a identifié {ticker} comme une opportunité de swing trade convaincante. "
        f"L'action est en tendance {trend} avec un RSI à {rsi:.1f}, indiquant un momentum sans surextension. "
        f"Le volume et l'action des prix confirment une accumulation institutionnelle. "
        f"Le rapport risque/récompense offre des rendements favorables par rapport au stop loss défini."
    )
    langs["id"] = (
        f"BOGA AI memilih {ticker} sebagai swing trade probabilitas tinggi dengan skor {score}/100.",
        f"BOGA AI mengidentifikasi {ticker} sebagai peluang swing trade yang menarik. "
        f"Saham berada dalam tren {trend} dengan RSI {rsi:.1f}, menunjukkan momentum tanpa berlebihan. "
        f"Volume dan aksi harga mengkonfirmasi akumulasi institusional. "
        f"Rasio risiko/imbalan menawarkan keuntungan yang menguntungkan relatif terhadap stop loss."
    )

    return {
        "homepage_summary": {k: v[0] for k, v in langs.items()},
        "detail_summary":   {k: v[1] for k, v in langs.items()},
    }

# ================================================================
# ================================================================
# BÖLÜM 13: TELEGRAM
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
    """Mesajı en yakın boşluktan veya satır başından bölerek HTML bütünlüğünü korumaya çalışır."""
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
                logging.error(f"⚠️ Telegram bağlantı hatası ({idx}): {e}")


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
# BÖLÜM 14: JSON ÇIKTI OLUŞTURUCU
# ================================================================
# ================================================================

def build_json_output(top10: list, generated_at: str) -> dict:
    """
    Top 10 hisseyi JSON formatında hazırlar.
    BOGA AI skoru, BUY/SELL/STOP ZONE, teknik indikatörler,
    fundamentaller, performans ve 6 dil özetlerini içerir.
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
            "boga_score": c.get("boga_score_100", 0.0), # Geriye dönük uyumluluk
            "market_regime": MARKET_STATUS.get("regime", "Bull"),
            "current_price": price,
            "holding_period": f"{c.get('hold_days', 5)}-{c.get('hold_days', 5) + 5} Days",
            
            # 🔥 Frontend Uyumluluğu İçin Düzleştirilmiş Alanlar
            "buy_zone": zones.get("buy_zone", {"low": 0, "high": 0}),
            "profit_zone": zones.get("sell_zone", {"low": 0, "high": 0}),
            "stop_zone": zones.get("stop_zone", {"low": 0, "high": 0}),
            "reasoning": summ.get("homepage_summary", {}).get("en", "BOGA AI analysis in progress..."),
            "detail_reasoning": summ.get("detail_summary", {}).get("en", ""),
            "adx": c.get("adx", 0.0),
            "rsi": c.get("rsi_14", 50.0),
            "rvol": c.get("rvol_today", 1.0),
            "change_1w": perf.get("1w", 0.0),
            "change_1d": perf.get("1d", 0.0),

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

            # ── 1H ANALİZ ─────────────────────────────────────────
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

            # ── PERFORMANS ─────────────────────────────────────────
            "performance": {
                "1d_pct":  perf.get("1d", 0.0),
                "1w_pct":  perf.get("1w", 0.0),
                "1m_pct":  perf.get("1m", 0.0),
                "1y_pct":  perf.get("1y", 0.0),
                "5y_pct":  perf.get("5y", 0.0),
            },

            # ── FACTOR SCORES ──────────────────────────────────────
            "factor_scores": {
                "trend_score":   c.get("tsi", 0.0),
                "momentum_score": c.get("msi", 0.0),
                "volatility_score": c.get("vrs", 0.0),
                "volume_score":  c.get("vps", 0.0),
                "financial_score": c.get("ffi", 0.0),
                "catalyst_score": c.get("pfi", 0.0),
                "insider_score": c.get("ifi", 0.0),
                "composite":     c.get("composite_score", 0.0),
                "raw_score":     c.get("score", 0.0),
            },

            # ── BOGA AI ÖZETLER (6 DİL) ───────────────────────────
            "ai_summary": {
                "homepage_summary": summ.get("homepage_summary", {}),
                "detail_summary":   summ.get("detail_summary", {}),
            },
        }
        picks.append(pick)

    return {
        "generated_at": generated_at,
        "date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
        "model": "BOGA AI V114",
        "market_regime": MARKET_STATUS.get("regime", "Bull"),
        "total_picks": len(picks),
        "picks": picks,
    }

# ================================================================
# ================================================================
# BÖLÜM 15: TELEGRAM RAPOR BLOKU
# ================================================================
# ================================================================

def classify_risk(rr: float) -> str:
    if rr >= 2.5: return "A+ (Premium)"
    if rr >= 2.0: return "A (Strong)"
    if rr >= 1.8: return "B+ (Good)"
    if rr >= 1.5: return "B (Moderate)"
    return "C (Weak)"


def build_candidate_block(rank: int, c: dict) -> str:
    ticker = c["ticker"]
    sector = c.get("sector", "Çeşitli")
    score  = c.get("score", 0.0)
    boga_s = c.get("boga_score_100", 0.0)
    zones  = c.get("boga_zones", {})
    rr     = zones.get("rr_ratio", c.get("rr_ratio", 0.0))
    risk_class = classify_risk(rr)

    buy_z  = zones.get("buy_zone", {})
    sell_z = zones.get("sell_zone", {})
    stop_z = zones.get("stop_zone", {})

    entry  = c.get("current_price", 0.0)
    perf   = c.get("performance", {})
    fin    = c.get("financial_health", {})
    d1     = c.get("d1_summary", {})
    h1     = c.get("h1_summary", {})
    summ   = c.get("ai_summary", {})
    detail_en = summ.get("detail_summary", {}).get("en", "")

    # Market Cap
    mcap_raw = c.get("market_cap", 0) or 0
    if mcap_raw >= 1e12: mcap_str = f"{mcap_raw/1e12:.2f}T"
    elif mcap_raw >= 1e9: mcap_str = f"{mcap_raw/1e9:.2f}B"
    else: mcap_str = f"{mcap_raw/1e6:.0f}M" if mcap_raw > 0 else "N/A"

    exhaust_tag = " ⚠️ EXHAUSTED" if c.get("is_exhausted") else ""

    block = (
        f"<b>{rank:02d}. {ticker}</b> ({sector}){exhaust_tag}\n"
        f"🐂 <b>BOGA AI Score: {boga_s:.1f}/100</b> | 💼 Cap: {mcap_str} | 🧠 Risk: {risk_class}\n\n"
        f"💵 <b>Current Price: ${entry:.2f}</b>\n\n"
        # BOGA AI ZONES
        f"📌 <b>BOGA AI MODEL ANALYSIS</b>\n"
        f"🟢 <b>BUYING ZONE:</b> ${buy_z.get('low',0):.2f} – ${buy_z.get('high',0):.2f}\n"
        f"🎯 <b>SELL ZONE (TARGET):</b> ${sell_z.get('low',0):.2f} – ${sell_z.get('high',0):.2f}\n"
        f"🔴 <b>STOP LOSS ZONE:</b> ${stop_z.get('low',0):.2f} – ${stop_z.get('high',0):.2f}\n"
        f"⚖️ <b>Risk/Reward: {rr:.1f}:1</b> | 1H Support: ${zones.get('support_1h',0):.2f} | Resistance: ${zones.get('resist_1h',0):.2f}\n\n"
        # Trend Status
        f"📌 <b>Trend Status</b>\n"
        f"• Trend: <b>{d1.get('Trend Status','N/A')}</b>\n"
        f"• RSI (14): {c.get('rsi_14',0):.1f} — {'Momentum building' if 40<=c.get('rsi_14',50)<=55 else 'Momentum continuing' if c.get('rsi_14',50)<=70 else 'Overbought zone'}\n"
        f"• ADX: {c.get('adx',0):.1f} — {'Very strong trend' if c.get('adx',0)>=30 else 'Strong trend' if c.get('adx',0)>=25 else 'Moderate trend' if c.get('adx',0)>=20 else 'Weak trend'}\n"
        f"• MACD Hist: {c.get('macd_hist',0):.3f} — {'Supporting breakout' if c.get('macd_hist',0)>0 else 'Caution advised'}\n"
        f"• MFI: {c.get('mfi',50):.1f} — {'Money flowing in' if c.get('mfi',50)>=50 else 'Money flowing out'}\n\n"
        # Moving Averages
        f"📌 <b>Moving Averages</b>\n"
        f"• EMA 20: ${c.get('ema20',0):.2f}\n"
        f"• EMA 50: ${c.get('ema50',0):.2f}\n"
        f"• EMA 200: ${c.get('ema200',0):.2f}\n\n"
        # Performance
        f"📌 <b>Price Performance</b>\n"
        f"• 1G: {c.get('performance',{}).get('1d',0):+.2f}% | 1H: {c.get('performance',{}).get('1w',0):+.2f}% | 1A: {c.get('performance',{}).get('1m',0):+.2f}%\n"
        f"• 1Y: {c.get('performance',{}).get('1y',0):+.2f}% | 5Y: {c.get('performance',{}).get('5y',0):+.2f}%\n\n"
    )

    # Fundamental Margins
    if fin:
        block += (
            f"📌 <b>Fundamental Margins</b>\n"
            f"• Gross Margin: {fin.get('gross_margin',0):.1f}% — {'Profit kept after production costs'}\n"
            f"• Operating Margin: {fin.get('operating_margin',0):.1f}% — {'Operational efficiency indicator'}\n"
            f"• Net Margin: {fin.get('net_margin',0):.1f}% — {'Final net profit percentage'}\n"
            f"• Revenue Growth: {fin.get('revenue_growth',0):.1f}% — {'YoY revenue growth speed'}\n"
            f"• P/E: {fin.get('pe_ratio',0):.1f} | P/B: {fin.get('pb_ratio',0):.2f} | FCF Yield: {fin.get('fcf_yield',0):.1f}%\n"
            f"• Market Cap: {c.get('market_cap_str', mcap_str)}\n\n"
        )

    # BOGA AI özet (İngilizce)
    if detail_en:
        block += (
            f"🐂 <b>BOGA AI Analysis:</b>\n"
            f"<i>{detail_en[:500]}...</i>\n\n"
        )

    block += "────────────────────────────────────────\n\n"
    return block

# ================================================================
# ================================================================
# BÖLÜM 16: ANA TARAYICI
# ================================================================
# ================================================================

async def scan_top_stocks():
    """
    BOGA AI MASTER SCANNER V114

    AKIŞ:
    1. Piyasa + Sektör Analizi
    2. Evren Hazırlığı (500 hisse - haftalık cache)
    3. 500 hisse → apply_atmaca_filters → min 50 geçer
    4. Katman 2: En iyi 50 adayı seç
    5. Katman 3: 50 için derin analiz (Insider, Opsiyon, Finansal Sağlık)
    6. 10 nihai hisse 100 üzerinden BOGA AI skoru
    7. ATR + 1H destek/direnç: BUY/SELL/STOP ZONE (R/R 2.5:1)
    8. Hisse performans verileri (1G/1H/1A/1Y/5Y)
    9. Gemini AI özetleri (6 dil)
    10. JSON kaydet + Telegram bildir
    """
    start_time = time.time()
    scanned_count = 0

    await send_telegram_message(
        "🐂 <b>BOGA AI SWING TRADE V114 Scanner Started!</b>\n"
        "⏱ Schedule: Weekdays NY 13:00\n"
        "🎯 Goal: Daily Top 10 Swing Trade Opportunities\n"
        "📈 Primary Language: English"
    )

    # ── ADIM 1: PİYASA ANALİZİ ──────────────────────────────────────
    await analyze_market_and_sectors()
    global MIN_ATMACA_SCORE
    MIN_ATMACA_SCORE = 8.0 + (MARKET_STATUS["min_score_modifier"] * 4)
    logging.info(f"⚙️ Rejim: {MARKET_STATUS['regime']} | Puan Barajı: {MIN_ATMACA_SCORE}")

    # ── ADIM 2: EVREN (500 hisse - haftalık cache) ───────────────────
    MASTER_UNIVERSE = await build_atmaca_universe_full()
    if not MASTER_UNIVERSE:
        await send_telegram_message("❌ Evren oluşturulamadı!")
        return

    tickers_to_scan = [t for t in MASTER_UNIVERSE if t not in EXCLUDED_STOCKS]
    logging.info(f"📋 Taranacak hisse sayısı: {len(tickers_to_scan)}")

    # ── ADIM 3: PARALEL ANALİZ (500 hisse → en az 50 geçer) ─────────
    semaphore = asyncio.Semaphore(2)

    async def sem_analyze(ticker: str):
        nonlocal scanned_count
        async with semaphore:
            await asyncio.sleep(random.uniform(1.5, 3.2))
            try:
                result = await apply_atmaca_filters(ticker)
                scanned_count += 1
                if scanned_count % 50 == 0:
                    logging.info(f"⏳ İlerleme: {scanned_count}/{len(tickers_to_scan)}")
                return result
            except Exception as e:
                logging.error(f"❌ {ticker}: {e}")
                return None

    tasks = [sem_analyze(t) for t in tickers_to_scan]
    raw_results = await asyncio.gather(*tasks)

    candidates = [r for r in raw_results if r is not None]
    logging.info(f"✅ Katman 2 geçen: {len(candidates)} hisse")

    if not candidates:
        await send_telegram_message("⚠️ Kriterlere uygun aday bulunamadı.")
        return

    # ── ADIM 4: 8-FAKTÖR SKOR + EN İYİ 50 ──────────────────────────
    for c in candidates:
        compute_multi_factor_score(c)

    candidates_ranked = sorted(
        [c for c in candidates if c.get("composite_score", -99) > -50],
        key=lambda x: x.get("score", 0.0), reverse=True
    )
    top_50 = candidates_ranked[:TOP_DEEP_ANALYSIS]
    logging.info(f"🏆 Katman 2 → Top {len(top_50)} derin analize geçiyor.")

    # ── ADIM 5: KATMAN 3 — DERİN ANALİZ (Top 50) ───────────────────
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

            # Finansal Sağlık
            fin_health = analyze_financial_health(ticker, info)
            if fin_health.get('health_score', 0) > 0:
                c["score"] += fin_health['health_score'] * 0.4
                c["details"].extend(fin_health['details'])
                c["financial_health"] = fin_health; c["ffi"] = fin_health['health_score']

            # Katalizör
            catalyst = check_silent_catalysts(ticker, info)
            if catalyst.get('has_catalyst'):
                c["score"] += catalyst['score']; c["details"].extend(catalyst['reasons'])
                c["catalyst_data"] = catalyst; c["pfi"] = catalyst['score']

            # Yasal Risk
            if c.get('score', 0) > 20.0:
                risk_res = await check_legal_risk_live(ticker)
                if risk_res.get('has_risk'):
                    c['score'] -= risk_res['penalty']; c['details'].append(risk_res['msg'])

            # Opsiyon Sentiment
            opt = await analyze_options_sentiment(ticker)
            if opt.get('bullish'):
                c["score"] += opt.get('score', 0); c["details"].extend(opt.get('details', []))
                c["opt_sentiment"] = opt

        except Exception as e:
            logging.debug(f"⚠️ {ticker} Katman 3: {e}")

    sem_k3 = asyncio.Semaphore(3)
    async def sem_heavy(c):
        async with sem_k3:
            await asyncio.sleep(random.uniform(0.1, 0.4))
            await fetch_heavy_data(c)

    await asyncio.gather(*(sem_heavy(c) for c in top_50))
    top_50.sort(key=lambda x: x.get("score", 0.0), reverse=True)

    # ── ADIM 6: ALPHA VANTAGE DOĞRULAMASI ────────────────────────────
    if ENABLE_ALPHA_VALIDATION:
        high_conviction = [c for c in top_50 if c.get('score', 0) >= 35.0][:5]
        for idx, c in enumerate(high_conviction):
            av_result = await _verify_with_alpha_vantage(c['ticker'], c['current_price'])
            c['alpha_validation'] = av_result
            if not av_result.get('validated', True):
                c['score'] -= 10.0
            if idx < len(high_conviction) - 1:
                await asyncio.sleep(12)

    # ── ADIM 7: TOP 10 SEÇİMİ ve BOGA AI PUANLAMA ────────────────────
    top_candidates = build_diversified_toplist(top_50, total=TOP_FINAL_PICKS)
    logging.info(f"🎯 Top {len(top_candidates)} BOGA AI adayı hazır.")

    # ── ADIM 8: BOGA AI ZONE HESAPLAMA (ATR + 1H Destek/Direnç) ─────
    for c in top_candidates:
        zones = calculate_support_resistance_1h(
            c.get("df_1h"), c.get("df_1d"), c.get("current_price", 0.0)
        )
        c["boga_zones"] = zones
        c["boga_rr"] = zones.get("rr_ratio", 0.0)

    # ── ADIM 9: BOGA AI 100'LÜK SKOR ─────────────────────────────────
    for c in top_candidates:
        c["boga_score_100"] = compute_boga_score_100(c)

    # Skora göre yeniden sırala
    top_candidates.sort(key=lambda x: x.get("boga_score_100", 0.0), reverse=True)
    for i, c in enumerate(top_candidates):
        c["rank"] = i + 1

    # ── ADIM 10: PERFORMANS VERİLERİ ─────────────────────────────────
    for c in top_candidates:
        c["performance"] = get_price_performance(c.get("df_1d", pd.DataFrame()), c["ticker"])
        # Company name
        db_info = COMPANY_DATABASE.get(c["ticker"], {})
        c["company"] = db_info.get("name", c["ticker"])

    # ── ADIM 11: GEMİNİ AI ÖZETLER ───────────────────────────────────
    logging.info("🤖 Gemini AI özetleri oluşturuluyor...")
    for c in top_candidates:
        fin_health = c.get("financial_health", {})
        zones = c.get("boga_zones", {})
        summary = await generate_gemini_summary(c, fin_health, zones)
        c["ai_summary"] = summary
        await asyncio.sleep(0.5)  # Gemini rate limit koruması

    # ── ADIM 12: JSON ÇIKTI ───────────────────────────────────────────
    now_ny = datetime.now(NY_TZ)
    generated_at = now_ny.isoformat()
    output_json = build_json_output(top_candidates, generated_at)

    try:
        os.makedirs(WATCHLIST_DIR, exist_ok=True)
        cwd = os.getcwd()
        public_dir = os.path.join(cwd, "frontend", "public")
        os.makedirs(public_dir, exist_ok=True)

        # 1. swing_picks.json (Top 20 for Sidebar/Homepage)
        output_20 = build_json_output(top_candidates[:20], generated_at)
        with open(os.path.join(public_dir, "swing_picks.json"), "w", encoding="utf-8") as f:
            json.dump(output_20, f, indent=2, ensure_ascii=False, default=str)
        
        # 2. swing_all_picks.json (Full Candidate List)
        output_all = build_json_output(top_candidates, generated_at)
        with open(os.path.join(public_dir, "swing_all_picks.json"), "w", encoding="utf-8") as f:
            json.dump(output_all, f, indent=2, ensure_ascii=False, default=str)

        logging.info(f"🚀 JSON dosyaları frontend/public klasörüne yerleştirildi.")
    except Exception as e:
        logging.error(f"❌ JSON kayıt hatası: {e}")

    # ── ADIM 13: TELEGRAM RAPOR ───────────────────────────────────────
    duration = time.time() - start_time
    now_str = now_ny.strftime("%Y-%m-%d %H:%M %Z")

    # Özet tablo
    header = (
        f"🐂 <b>BOGA AI SWING V114 – TOP {TOP_FINAL_PICKS} PICKS</b>\n"
        f"🕒 <i>{now_str}</i> | ⏱ {duration:.1f}s\n"
        f"📊 <i>{len(tickers_to_scan)} scanned → {len(candidates)} candidates → Top {TOP_FINAL_PICKS}</i>\n"
        f"📈 Market: <b>{MARKET_STATUS['regime']}</b>\n\n"
        "<pre>"
        f"#   SEMBOL   BOGA  SCORE  BUY_L   SELL_H  STOP   R/R\n"
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
    toplist_msg += f"<i>💡 BUY→SELL: R/R~2.5:1 | ATR+1H Support/Resistance | BOGA AI V114</i>\n\n"
    toplist_msg += "<b>📋 Detailed Analysis Below:</b>\n\n"

    # Toplist Özetini gönder
    await send_telegram_message(toplist_msg)
    # Her bir aday bloğunu ayrı ayrı gönder (HTML patlamaması için)
    for i, c in enumerate(top_candidates):
        block = build_candidate_block(i + 1, c)
        await send_telegram_message(block)
        await asyncio.sleep(0.5) # Telegram flood protection

    save_info_cache()
    logging.info(f"✅ BOGA AI Tarama tamamlandı. ({scanned_count} hisse taranmış | {duration:.1f}s)")


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
                  'warning': None if validated else f"Fiyat farkı %{price_diff_pct:.1f}"}
        alpha_vantage_cache[cache_key] = result
        return result
    except Exception as e:
        return {'validated': False, 'av_price': 0, 'price_diff_pct': 0, 'warning': str(e)}

# ================================================================
# ================================================================
# BÖLÜM 17: ZAMANLAYICI
# ================================================================
# ================================================================

def get_next_weekday_run_time_ny(target_hour=13, target_minute=0):
    """Bir sonraki hafta içi NY 13:00 zamanını döner (UTC aware)."""
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
    """Ana döngü — Her gün NY 13:00'de çalışır."""
    await send_telegram_message(
        "🐂 <b>BOGA AI SWING TRADE V114 Başlatıldı!</b>\n"
        "📅 Çalışma: Hafta içi her gün New York 13:00\n"
        "🎯 Hedef: Günün En İyi 10 Swing Trade Fırsatı\n"
        "🌍 6 Dil AI Özet: EN / TR / ES / PT / FR / ID\n"
        "💡 JSON: swing_picks_boga.json\n"
        "📊 R/R: ~2.5:1 hedefi | ATR + 1H Destek/Direnç"
    )

    # İlk tarama
    try:
        logging.info("▶ İlk tarama başlıyor...")
        await scan_top_stocks()
    except Exception as e:
        logging.error(f"Başlangıç tarama hatası: {e}")
        await send_telegram_message(f"🚨 Başlangıç hatası: {e}")

    # Sonsuz döngü
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            next_run_utc = get_next_weekday_run_time_ny()
            wait_seconds = (next_run_utc - now_utc).total_seconds()

            if wait_seconds < 0 or wait_seconds > 90000:
                next_run_utc = get_next_weekday_run_time_ny()
                wait_seconds = (next_run_utc - datetime.now(timezone.utc)).total_seconds()

            logging.info(
                f"🕒 Sonraki tarama: {next_run_utc.strftime('%Y-%m-%d %H:%M %Z')} "
                f"(~{wait_seconds/3600:.2f} saat)"
            )
            await asyncio.sleep(wait_seconds)
            logging.info("▶ NY 13:00 taraması başlıyor...")
            await scan_top_stocks()

        except Exception as e:
            logging.error(f"Döngü hatası: {e}")
            await send_telegram_message(f"🚨 Döngü hatası: {e}")
            await asyncio.sleep(3600)


# ================================================================
# ================================================================
# BÖLÜM 18: BAŞLATMA
# ================================================================
# ================================================================

if __name__ == "__main__":
    try:
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print("\n🐂 BOGA AI Bot manuel olarak durduruldu.")
    except Exception as e:
        print(f"Kritik Başlatma Hatası: {e}")
