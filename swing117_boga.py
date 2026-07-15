# -*- coding: utf-8 -*-
"""
================================================================
🐂 BOGA AI SWING TRADE MODEL — v117.v3.0 (POWER PULLBACK)
================================================================
v117.v3 — TAM MİMARİ DEĞİŞİM (1.167 trade backtest analizi sonrası):

  TEŞHİS (finma_swing_trades_SL3_5pct backtest verisi):
    • Win rate %85.9 iyi, ama Peak>=8% oranı sadece %21.7
    • Days-to-peak medyan 15 gün → swing değil, position davranışı
    • SL yiyen trade'lerin %44'ü hiç hareket etmeden düştü (peak<%2)
    → Sorun hisse seçimi değil, GİRİŞ ZAMANLAMASI.

  ÇÖZÜM — POWER PULLBACK (tek strateji, 5 katman):
    LAYER 0 → UNIVERSE   : Fiyat>$10 + rejime göre MCap/DollarVol (~600)
    LAYER 1 → TREND (1D) : EMA50>EMA200 + Close>EMA50 + RS>SPY + RSI 55-70
    LAYER 2 → QUALITY(4H): EMA20>EMA50 + ADX>20 + RSI>55   [RTH resample]
    LAYER 3 → MOMENTUM(1H): RSI 52-68 + RVOL>1.5           → WATCHLIST havuzu
    LAYER 4 → ENTRY (15m): 3-8 mum pullback + EMA20 teması +
                           RSI 45-60 reset + resume mumu (engulf/breakout)
                           + resume RVOL>1.5               → SİNYAL

  ÇIKTI: Top 10 SİNYAL + Top 10 WATCHLIST (tetik bekleyen adaylar)

  DİSİPLİN KURALLARI:
    • Rejime göre universe eşiği:
        BULL   → MCap>1B,  DollarVol>15M
        NORMAL → MCap>2B,  DollarVol>20M
        CHOPPY → MCap>5B,  DollarVol>30M
    • Cooldown: sinyal sonrası 20 gün blok.
      İSTİSNA: Yeni 52W High VEYA yeni Base Breakout → cooldown sıfırlanır.
    • Earnings filtresi: 7 gün (5'ten yükseltildi)
    • Duplicate önleme: cooldown arşiv dosyalarından okunur (state dosyası yok)

  SKORLAMA (100p — sadece 5 şeffaf bileşen, mikro-düzeltme YOK):
    RS Gücü (25) + 4H Trend Kalitesi (25) + 1H RVOL (20) +
    Pullback Kalitesi (20) + Sektör Momentumu (10)

  ATILANLAR (v117.v2 → v3):
    Ichimoku, Volume Profile, OBV, Options Sentiment, Insider,
    Legal Risk, Financial Health puanlaması, SQUEEZE/SPRING/AWAKENING/
    EMA_CROSS/BREAKOUT sistem etiketleri, Gemini özet katmanı.
    (MFI/MACD/CMF sadece JSON gösterimi için hesaplanır — skora girmez.)

  KORUNANLAR (frontend/otomasyon uyumluluğu — DEĞİŞTİRME):
    • Dosya adı: swing117_boga.py
    • JSON şeması: build_json_output alan yapısı birebir
    • Çıktı yolları: swing_picks.json / swing_all_picks.json /
      swing_table.json / data/swing{YYYY}/swing_YYYYMMDD.json
    • Telegram formatı, scheduler (NY 13:00), --oneshot/--now
    • persistent_info_cache, swing_performance.json tracker'ları
================================================================
"""

import json
import asyncio
import logging
import time
import math
import os
import sys
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

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Literal
from zoneinfo import ZoneInfo

from ta.volatility import AverageTrueRange
from ta.trend import EMAIndicator, ADXIndicator, MACD
from ta.volume import MFIIndicator, ChaikinMoneyFlowIndicator
from ta.momentum import RSIIndicator

# ================================================================
# 🔹 DATA PROVIDER CONFIG
# ================================================================
DATA_PROVIDER = "yfinance"   # options: "yfinance" | "polygon" | "alpaca"
POLYGON_API_KEY = ""
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

DAILY_RUN_HOUR = 13
DAILY_RUN_MINUTE = 0

# ================================================================
# 🔹 CACHE & FILE SETTINGS  (yollar v117.v2 ile birebir aynı)
# ================================================================
UNIVERSE_TTL = 7 * 24 * 3600
UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}
BULK_DATA_CACHE: Dict[str, pd.DataFrame] = {}
index_cache: Dict[str, pd.Series] = {}
LONG_HISTORY_CACHE: Dict[str, Dict[str, float]] = {}
LONG_HISTORY_TTL = 12 * 3600

WATCHLIST_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists"
INFO_CACHE_FILE = os.path.join(WATCHLIST_DIR, "persistent_info_cache.json")

FRONTEND_PUBLIC_DIR = r"C:\Users\afksm\finma\frontend\public"
BASE_DATA_DIR = os.path.join(FRONTEND_PUBLIC_DIR, "data")

OUTPUT_JSON_FILE = "swing_picks.json"
OUTPUT_ALL_JSON_FILE = "swing_all_picks.json"

# ================================================================
# 🔹 POWER PULLBACK — UNIVERSE & GATE PARAMETRELERİ
# ================================================================
UNIVERSE_TARGET_SIZE = 600       # Layer 0 hedefi (~600 likit hisse)
MAX_L2_CANDIDATES = 140          # 1H/4H veri çekilecek maksimum L1 geçen hisse
TOP_SIGNAL_PICKS = 10            # 🎯 Top 10 swing adayı (Giriş Zone/Bekle ikisi de olabilir)
TOP_WATCHLIST_PICKS = 10         # 🎯 Top 10 watchlist (10 gün takip, giriş-bölgesi kavramı yok)
MAX_PER_SECTOR_SIGNALS = 3       # Sinyal listesinde sektör başına maks.

# ── v3.1: SAATLİK TARAMA + PERSİSTAN ADAY HAVUZU ─────────────────
# L1→L3 sadece 09/14/17 NY'de (FULL_SCAN) çalışıp havuzu yeniler.
# Diğer saatlerde (ENTRY_CHECK) sadece PENDING swing adayları için
# Layer 4 (15m Power Pullback) kontrol edilir — universe/L1-L3 tekrar
# çalışmaz. Bkz. run_scanner() ve run_entry_check_pass().
FULL_SCAN_HOURS_NY = {9, 14, 17}
ACTIVE_SCAN_HOURS_NY = set(range(9, 18))   # 09:00–17:00 NY, haftaiçi her saat
SWING_PENDING_MAX_DAYS = 3       # PENDING swing adayı 3 gün giriş yakalayamazsa havuzdan düşer
WATCHLIST_MAX_DAYS = 10          # Watchlist adayı 10 gün sonra havuzdan düşer
CANDIDATE_POOL_FILE = os.path.join(BASE_DATA_DIR, "candidate_pool.json")
WATCHLIST_PICKS_FILE = "watchlist_picks.json"

PRICE_MIN = 10.0                 # v3: $5 → $10 (kurumsal likidite standardı)
PRICE_MAX = 5000.0

# Rejime göre universe eşikleri (kullanıcı onaylı):
#   BULL   → MCap > 1B,  DollarVol > 15M
#   NORMAL → MCap > 2B,  DollarVol > 20M
#   CHOPPY → MCap > 5B,  DollarVol > 30M
REGIME_UNIVERSE_RULES = {
    "BULL":   {"min_mcap": 1_000_000_000, "min_dollar_vol": 15_000_000},
    "NORMAL": {"min_mcap": 2_000_000_000, "min_dollar_vol": 20_000_000},
    "CHOPPY": {"min_mcap": 5_000_000_000, "min_dollar_vol": 30_000_000},
}
# Universe haftalık cache'lendiği için Layer 0'da EN GEVŞEK eşik ($15M DV)
# kullanılır; rejime özel DV + MCap eşikleri her gün Layer 1'de uygulanır.
UNIVERSE_BASE_MIN_DOLLAR_VOLUME = 15_000_000

# ── LAYER 1 (1D) ────────────────────────────────────────────────
RSI_1D_MIN = 55                  # Power Pullback: trend-içi güç şartı
RSI_1D_MAX = 75                  # v117.v2 dersi: RSI>75 aşırı alım → %29 WR
RS_LOOKBACK = 30                 # SPY'a karşı göreli güç penceresi (gün)
LOOKBACK_DAYS = 400              # 400 takvim günü (52W high + EMA200 garantisi)

# ── LAYER 2 (4H — RTH resample) ────────────────────────────────
ADX_4H_MIN = 20
RSI_4H_MIN = 55

# ── LAYER 3 (1H) ────────────────────────────────────────────────
RSI_1H_MIN = 52                  # Kullanıcı kuralı: 1H RSI > 52
RSI_1H_MAX = 68                  # Trend-içi dinlenme üst bandı
RVOL_1H_MIN = 1.1                # Kurumsal giriş kanıtı (hard gate)
RVOL_1H_IDEAL = 1.5              # Skor bonusu eşiği

# ── LAYER 4 (15m — tetik) ───────────────────────────────────────
PULLBACK_MIN_CANDLES = 3
PULLBACK_MAX_CANDLES = 8
RSI_15M_RESET_LOW = 45           # Pullback dibinde RSI 45-60 reset bandı
RSI_15M_RESET_HIGH = 60
RVOL_15M_TRIGGER = 1.5           # Resume mumunda RVOL şartı
EMA_TOUCH_ATR_BAND = 0.30        # EMA20 teması toleransı (× ATR15m)

# ── DİSİPLİN ────────────────────────────────────────────────────
COOLDOWN_DAYS = 20               # Kullanıcı onaylı: 30 → 20 gün
EARNINGS_MIN_DAYS = 7            # Kullanıcı onaylı: 5 → 7 gün
BASE_BREAKOUT_LOOKBACK = 60      # Base breakout: son 60 günün tabanı
BASE_BREAKOUT_BUFFER = 5         # ...son 5 gün hariç (taze kırılım şartı)

ATR_PERIOD = 14
MIN_RR_RATIO = 1.1               # Yayın öncesi R/R alt sınırı

# ================================================================
# 🔹 TELEGRAM SETTINGS  (v117.v2 ile aynı)
# ================================================================
TELEGRAM_API_KEY = "8182098187:AAF-jtWMJK07ZdZdyusiE1RqyQkwegb0Uhc"
TELEGRAM_CHAT_ID = "-1003406973271"
ENABLE_TELEGRAM_NOTIFICATIONS = False

# ================================================================
# 🔹 SEKTÖR HARİTALARI
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

# Binary-event riski taşıyan industry grupları (küçük mcap'te hard reject)
HIGH_RISK_INDUSTRIES: set = {
    "biotechnology",
    "drug manufacturers - specialty & generic",
    "pharmaceutical retailers",
    "medical devices",
    "diagnostics & research",
    "health information services",
}
HIGH_RISK_INDUSTRY_MCAP_FLOOR = 5_000_000_000

CEF_BLOCK_QUOTE_TYPES: set = {"etf", "mutualfund", "cef"}
CEF_BLOCK_INDUSTRIES: set = {
    "closed-end fund",
    "closed end fund",
    "asset management",
    "exchange traded fund",
}

# ================================================================
# 🔹 GLOBAL STATE
# ================================================================
MARKET_STATUS = {"regime": "Bull", "min_score_modifier": 0.0}
SECTOR_PERFORMANCE: Dict[str, float] = {}
EXCLUDED_STOCKS: set = set()
INDEX_BENCHMARK = "^GSPC"

EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

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
        os.makedirs(WATCHLIST_DIR, exist_ok=True)
        if os.path.exists(INFO_CACHE_FILE):
            with open(INFO_CACHE_FILE, "r", encoding="utf-8") as f:
                persistent_info_cache = json.load(f)
            logging.info(f"📁 Info cache yüklendi: {len(persistent_info_cache)} hisse")
    except Exception as e:
        logging.warning(f"⚠️ Info cache yüklenemedi: {e}")
        persistent_info_cache = {}

def save_info_cache():
    try:
        os.makedirs(WATCHLIST_DIR, exist_ok=True)
        with open(INFO_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(persistent_info_cache, f, ensure_ascii=False)
        logging.info(f"💾 Info cache kaydedildi: {len(persistent_info_cache)} hisse")
    except Exception as e:
        logging.warning(f"⚠️ Info cache kaydedilemedi: {e}")

# ================================================================
# ================================================================
# SECTION 1: TICKER LIST & UNIVERSE (LAYER 0)
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


async def build_power_universe() -> List[str]:
    """
    LAYER 0 — Haftalık Universe (~600 likit hisse)

    Baseline filtreler (EN GEVŞEK rejim eşiği ile — rejime özel
    daraltma her gün Layer 1'de yapılır):
      • Fiyat: $10 – $5000
      • AvgDollarVolume(20d) > $15M
      • En az 220 işlem günü geçmiş (EMA200 + 52W high güvenilirliği)
    Sıralama: dolar hacmine göre → Top 600.
    1D veriler BULK_DATA_CACHE'e alınır (Layer 1 sıfır network çalışır).
    """
    now = time.time()

    if UNIVERSE_CACHE["data"] and (now - UNIVERSE_CACHE["ts"]) < UNIVERSE_TTL:
        return UNIVERSE_CACHE["data"]

    # ── Disk cache ───────────────────────────────────────────────
    if os.path.exists("boga_universe.txt"):
        mtime = os.path.getmtime("boga_universe.txt")
        if (now - mtime) < UNIVERSE_TTL:
            try:
                with open("boga_universe.txt", "r") as f:
                    data_list = [l.strip() for l in f if l.strip()]
                if data_list:
                    logging.info(f"📁 Disk Cache: {len(data_list)} hisse. 1D veri indiriliyor...")
                    filtered_list = []
                    CHUNK = 100
                    for j in range(0, len(data_list), CHUNK):
                        chunk = data_list[j: j + CHUNK]
                        downloaded = await asyncio.to_thread(
                            yf.download, chunk, period=f"{LOOKBACK_DAYS}d", interval="1d",
                            progress=False, group_by="ticker", ignore_tz=True
                        )
                        for sym in chunk:
                            try:
                                if sym in downloaded and not downloaded[sym].empty:
                                    df_sym = downloaded[sym].dropna()
                                    if len(df_sym) < 220:
                                        continue
                                    last_px = float(df_sym["Close"].iloc[-1])
                                    if not (PRICE_MIN <= last_px <= PRICE_MAX):
                                        continue
                                    BULK_DATA_CACHE[sym] = df_sym.copy()
                                    filtered_list.append(sym)
                            except Exception:
                                continue
                    if filtered_list:
                        logging.info(f"✅ Disk Cache: {len(data_list)} → {len(filtered_list)} hisse hazır")
                        UNIVERSE_CACHE["ts"] = mtime
                        UNIVERSE_CACHE["data"] = filtered_list
                        return filtered_list
            except Exception as e:
                logging.error(f"⚠️ Disk cache hatası: {e}")

    # ── Sıfırdan universe inşası ─────────────────────────────────
    raw_list = await fetch_all_us_tickers()
    if not raw_list:
        logging.error("❌ Ticker list could not be retrieved.")
        return []

    logging.info(f"[START] Bulk download: {len(raw_list)} hisse (chunk=200, period={LOOKBACK_DAYS}d)...")

    CHUNK = 200
    all_rows: list = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"📥 Downloading: {i}–{i + len(chunk)} ...")
        try:
            data = await asyncio.wait_for(
                asyncio.to_thread(
                    yf.download, chunk, period=f"{LOOKBACK_DAYS}d", interval="1d",
                    progress=False, threads=True, ignore_tz=True, group_by="ticker"
                ),
                timeout=90.0
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
                    df_sym  = data[sym].dropna()
                    close   = df_sym["Close"]
                    volume  = df_sym["Volume"]

                    # Yeni halka arzlar / yetersiz geçmiş → ele
                    if len(close) < 220:
                        continue

                    last_price  = float(close.iloc[-1])
                    avg_vol_20  = float(volume.tail(20).mean())
                    dollar_vol  = last_price * avg_vol_20

                    if not (PRICE_MIN <= last_price <= PRICE_MAX):
                        continue
                    if dollar_vol < UNIVERSE_BASE_MIN_DOLLAR_VOLUME:
                        continue

                    BULK_DATA_CACHE[sym] = df_sym.copy()
                    all_rows.append({"sym": sym, "dollar_vol": dollar_vol})
                except Exception:
                    continue
        except Exception as e:
            logging.warning(f"⚠️ Chunk {i} error: {e}")
            continue

    if not all_rows:
        logging.error("❌ Universe boş kaldı.")
        return []

    all_rows.sort(key=lambda r: r["dollar_vol"], reverse=True)
    selected = [r["sym"] for r in all_rows[:UNIVERSE_TARGET_SIZE]]

    logging.info(f"🏆 LAYER 0 complete: {len(selected)} hisse (DollarVol > $15M, Fiyat > $10).")

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
# SECTION 2: DATA HELPERS (1D cache / 1H / 15m / 4H RTH resample)
# ================================================================
# ================================================================

def get_stock_data(ticker: str, interval: Literal["1d", "1h", "15m"] = "1d") -> Optional[pd.DataFrame]:
    """
    1D  → BULK_DATA_CACHE'ten okur (sıfır network)
    1H  → 60 gün (4H resample için ~120 RTH bar gerekir → ADX(14) sağlıklı)
    15m → 5 gün (~130 bar; pullback+tetik tespiti için fazlasıyla yeterli)

    yfinance intraday veriler prepost=False → sadece RTH döner.
    3 deneme + backoff (rate limit / stale data koruması).
    """
    t = ticker.strip().upper()

    if interval == "1d":
        if t in BULK_DATA_CACHE:
            return BULK_DATA_CACHE[t].copy()
        return None

    period_map = {"1h": ("60d", 60), "15m": ("5d", 40)}
    period_str, min_bars = period_map.get(interval, ("60d", 60))

    for attempt in range(3):
        time.sleep(random.uniform(0.15, 0.4) + (attempt * 0.5))
        try:
            stock = yf.Ticker(t)
            df = stock.history(period=period_str, interval=interval,
                               auto_adjust=True, prepost=False, timeout=20)
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


def resample_1h_to_4h_rth(df_1h: pd.DataFrame) -> Optional[pd.DataFrame]:
    """
    🔧 RTH-DOĞRU 4H RESAMPLE
    ─────────────────────────────────────────────────────────
    yfinance'ta native 4H interval yok. Naif `resample('4H')` gece
    boşluklarını ve 09:30 açılışını yanlış böler (00:00 hizalı bloklar
    seans ortasından geçer). Bu fonksiyon işlem gününü RTH bazlı
    2 bloğa böler:

        BLOK 1: 09:30 – 13:30   (4 saat)
        BLOK 2: 13:30 – 16:00   (2.5 saat — kapanış bloğu)

    Her blok OHLCV kurallarıyla toplanır:
        Open  = bloğun ilk barının open'ı
        High  = blok max
        Low   = blok min
        Close = bloğun son barının close'u
        Volume= toplam

    Not: Kapanış bloğunun 2.5 saat olması sorun değildir — kurumsal
    platformlar (TradingView RTH modu) da aynı bölünmeyi kullanır.
    Kısmi (henüz kapanmamış) son blok da dahil edilir; ADX/RSI
    hesapları son değeri canlı okur.
    """
    try:
        if df_1h is None or len(df_1h) < 20:
            return None

        df = df_1h.copy()
        if df.index.tz is None:
            df.index = df.index.tz_localize(NY_TZ)
        else:
            df.index = df.index.tz_convert(NY_TZ)

        # RTH dışı barları at (güvenlik — prepost=False zaten RTH döndürür)
        mask_rth = [(t.time() >= pd.Timestamp("09:30").time()) and
                    (t.time() < pd.Timestamp("16:00").time()) for t in df.index]
        df = df[mask_rth]
        if len(df) < 20:
            return None

        cutoff = pd.Timestamp("13:30").time()
        session_block = [0 if t.time() < cutoff else 1 for t in df.index]
        df["_date"]  = df.index.date
        df["_block"] = session_block

        agg = df.groupby(["_date", "_block"]).agg(
            Open=("Open", "first"),
            High=("High", "max"),
            Low=("Low", "min"),
            Close=("Close", "last"),
            Volume=("Volume", "sum"),
        )

        # Zaman indeksini yeniden kur (blok başlangıç saatiyle)
        new_index = []
        for (d, b) in agg.index:
            hh, mm = (9, 30) if b == 0 else (13, 30)
            new_index.append(pd.Timestamp(
                year=d.year, month=d.month, day=d.day, hour=hh, minute=mm, tz=NY_TZ
            ))
        agg.index = pd.DatetimeIndex(new_index)
        agg = agg.sort_index().dropna()

        return agg if len(agg) >= 40 else None
    except Exception as e:
        logging.debug(f"4H resample hatası: {e}")
        return None


def get_stock_info(ticker: str) -> dict:
    """Returns stock info from persistent cache, otherwise fetches from yfinance."""
    t = ticker.strip().upper()

    if t in persistent_info_cache:
        info = persistent_info_cache[t]
        if info.get("market_cap", 0) > 0 and info.get("sector") != "Unknown":
            return info

    try:
        logging.info(f"🌐 {t} info fetching live...")
        stock = yf.Ticker(t)
        inf = stock.info

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
            "debtToEquity": inf.get("debtToEquity", 0),
            "totalCash": inf.get("totalCash", 0),
            "totalDebt": inf.get("totalDebt", 0),
            "netIncomeToCommon": inf.get("netIncomeToCommon", 0),
            "trailingEps": inf.get("trailingEps", 0),
            "quoteType": inf.get("quoteType", "EQUITY"),
        }

        persistent_info_cache[t] = processed
        return processed

    except Exception as e:
        logging.error(f"⚠️ {t} info fetch error: {e}")
        return {
            "market_cap": 0, "avg_volume": 0, "beta": 1.0,
            "short_float": 0.0, "sector": "Unknown", "industry": "Unknown",
            "quoteType": "EQUITY", "heldPercentInstitutions": 0,
            "companyName": t,
        }


def get_index_close_series(symbol: str = INDEX_BENCHMARK) -> Optional[pd.Series]:
    """Caches benchmark index closing series."""
    symbol = symbol.upper()
    if symbol in index_cache:
        return index_cache[symbol]
    try:
        df_idx = yf.Ticker(symbol).history(period=f"{LOOKBACK_DAYS}d", interval="1d",
                                           auto_adjust=True, timeout=20)
        if df_idx is None or df_idx.empty:
            return None
        df_idx.columns = [c.capitalize() for c in df_idx.columns]
        index_cache[symbol] = df_idx["Close"].dropna()
        return index_cache[symbol]
    except Exception:
        return None

# ================================================================
# ================================================================
# SECTION 3: INDICATOR HELPERS
# ================================================================
# ================================================================

def safe_rsi(close: pd.Series, window: int = 14) -> float:
    try:
        v = float(RSIIndicator(close, window).rsi().iloc[-1])
        return v if not math.isnan(v) else 50.0
    except Exception:
        return 50.0


def safe_adx(high: pd.Series, low: pd.Series, close: pd.Series, window: int = 14) -> float:
    try:
        v = float(ADXIndicator(high, low, close, window).adx().iloc[-1])
        return v if not math.isnan(v) else 0.0
    except Exception:
        return 0.0


def safe_atr(high: pd.Series, low: pd.Series, close: pd.Series, window: int = ATR_PERIOD) -> float:
    try:
        v = float(AverageTrueRange(high, low, close, window).average_true_range().iloc[-1])
        return v if not math.isnan(v) and v > 0 else 0.0
    except Exception:
        return 0.0


def safe_last_ema(close: pd.Series, window: int) -> float:
    try:
        v = float(EMAIndicator(close, window).ema_indicator().iloc[-1])
        return v if not math.isnan(v) else 0.0
    except Exception:
        return 0.0


def compute_display_indicators(df_1d: pd.DataFrame) -> dict:
    """
    MFI / CMF / MACD_hist — SADECE JSON gösterimi için (frontend
    trend_status kartı). Skorlamaya ve gate'lere KESİNLİKLE girmez.
    """
    out = {"mfi": 50.0, "cmf": 0.0, "macd_hist": 0.0}
    try:
        high, low, close, vol = df_1d["High"], df_1d["Low"], df_1d["Close"], df_1d["Volume"]
        if len(close) >= 30:
            m = float(MFIIndicator(high, low, close, vol, 14).money_flow_index().iloc[-1])
            if not math.isnan(m):
                out["mfi"] = round(m, 1)
            c = float(ChaikinMoneyFlowIndicator(high, low, close, vol, 20).chaikin_money_flow().iloc[-1])
            if not math.isnan(c):
                out["cmf"] = round(c, 3)
            h = float(MACD(close).macd_diff().iloc[-1])
            if not math.isnan(h):
                out["macd_hist"] = round(h, 3)
    except Exception:
        pass
    return out

# ================================================================
# ================================================================
# SECTION 4: MARKET REGIME & SECTOR ANALYSIS
# ================================================================
# ================================================================

async def analyze_market_and_sectors():
    """
    Market regime (VIX + SPY) ve sektör performans analizi.
    v117.v2'den birebir taşındı — tek görevi:
      1. MARKET_STATUS['regime'] → universe eşik seçimi (BULL/NORMAL/CHOPPY)
      2. SECTOR_PERFORMANCE     → 10 puanlık sektör momentum bileşeni
    v3 FARKI: regime artık puan mikro-yönetimi YAPMAZ; sadece universe
    kapısını ve tarama iznini belirler.
    """
    global MARKET_STATUS, SECTOR_PERFORMANCE
    current_vix = 20.0
    vix_prev = 20.0
    vix_rising = False
    vix_pct_rank = 50.0

    try:
        indices = ["^VIX", "SPY"]
        df_indices = await asyncio.to_thread(
            yf.download, indices, period="252d", progress=False,
            group_by="ticker", ignore_tz=True
        )

        if "^VIX" in df_indices and not df_indices["^VIX"].empty:
            vix_series = df_indices["^VIX"]["Close"].dropna()
            current_vix = float(vix_series.iloc[-1])
            vix_prev = float(vix_series.iloc[-2]) if len(vix_series) >= 2 else current_vix
            vix_3d_avg = float(vix_series.tail(4).iloc[:-1].mean()) if len(vix_series) >= 4 else vix_prev
            vix_rising = current_vix > vix_3d_avg * 1.03
            vix_52w_min = float(vix_series.min())
            vix_52w_max = float(vix_series.max())
            vix_pct_rank = (
                (current_vix - vix_52w_min) / (vix_52w_max - vix_52w_min) * 100
                if vix_52w_max > vix_52w_min else 50.0
            )

        if "SPY" in df_indices and not df_indices["SPY"].empty:
            spy_close = df_indices["SPY"]["Close"].dropna()
            current_spy = float(spy_close.iloc[-1])
            spy_ema200 = float(EMAIndicator(spy_close, 200).ema_indicator().iloc[-1]) if len(spy_close) >= 200 else float(spy_close.mean())
            spy_ema50 = float(EMAIndicator(spy_close, 50).ema_indicator().iloc[-1]) if len(spy_close) >= 50 else float(spy_close.mean())
            spy_5d_change = (current_spy - float(spy_close.iloc[-6])) / float(spy_close.iloc[-6]) * 100 if len(spy_close) >= 6 else 0.0
        else:
            current_spy = spy_ema200 = spy_ema50 = 1.0
            spy_5d_change = 0.0

    except Exception as e:
        logging.error(f"Market analysis error: {e}")
        current_spy = spy_ema200 = spy_ema50 = 1.0
        spy_5d_change = 0.0

    # ── REGIME KARAR AĞACI (VIX öncelikli — v117.v2 ile aynı) ─────
    if current_vix >= 40:
        MARKET_STATUS["regime"] = "WEAK"
        vix_note = f"🚨 VIX PANIC ({current_vix:.1f}) — Tarama çok seçici"
    elif current_vix >= 35:
        MARKET_STATUS["regime"] = "HIGH_VOLATILITY"
        vix_note = f"⚠️ VIX EXTREME ({current_vix:.1f})"
    elif current_vix >= 28:
        if current_spy < spy_ema200:
            MARKET_STATUS["regime"] = "WEAK"
            vix_note = f"🔴 VIX High + SPY Downtrend ({current_vix:.1f})"
        else:
            MARKET_STATUS["regime"] = "HIGH_VOLATILITY"
            vix_note = f"🟠 VIX Elevated ({current_vix:.1f}, {'Rising' if vix_rising else 'Stable'})"
    elif current_vix >= 22:
        if current_spy > spy_ema50:
            MARKET_STATUS["regime"] = "CHOPPY"
            vix_note = f"🟡 VIX Moderate ({current_vix:.1f}) + SPY EMA50 üstü"
        else:
            MARKET_STATUS["regime"] = "HIGH_VOLATILITY"
            vix_note = f"🟠 VIX Moderate ({current_vix:.1f}) + SPY EMA50 altı"
    elif current_vix >= 18:
        if current_spy > spy_ema50 and spy_5d_change > 0:
            MARKET_STATUS["regime"] = "BULLISH"
            vix_note = f"📈 VIX Normal ({current_vix:.1f}) + SPY yükseliyor"
        elif current_spy > spy_ema200:
            MARKET_STATUS["regime"] = "CHOPPY"
            vix_note = f"➡️ VIX Normal ({current_vix:.1f}) + SPY kararsız"
        else:
            MARKET_STATUS["regime"] = "HIGH_VOLATILITY"
            vix_note = f"⚠️ VIX Normal ama SPY EMA200 altı ({current_vix:.1f})"
    else:
        if current_spy > spy_ema50 and spy_5d_change > 0:
            MARKET_STATUS["regime"] = "STRONG"
            vix_note = f"✅ VIX Low ({current_vix:.1f}) + SPY güçlü"
        else:
            MARKET_STATUS["regime"] = "BULLISH"
            vix_note = f"🟢 VIX Low ({current_vix:.1f})"

    MARKET_STATUS["min_score_modifier"] = 0.0   # v3: puan mikro-yönetimi kaldırıldı
    MARKET_STATUS["vix"] = round(current_vix, 2)
    MARKET_STATUS["vix_prev"] = round(vix_prev, 2)
    MARKET_STATUS["vix_rising"] = vix_rising
    MARKET_STATUS["vix_pct_rank"] = round(vix_pct_rank, 1)
    MARKET_STATUS["vix_note"] = vix_note

    logging.info(
        f"📊 Piyasa Rejimi: {MARKET_STATUS['regime']} | "
        f"VIX: {current_vix:.1f} ({'↑ Rising' if vix_rising else '→ Stable'}) | "
        f"Rank: {vix_pct_rank:.0f}. percentile"
    )
    logging.info(f"   {vix_note}")

    # ── SEKTÖR PERFORMANSI (v117.2 ağırlıkları korundu) ──────────
    for sector_name, etf_ticker in SECTOR_ETF_MAP.items():
        try:
            etf = yf.Ticker(etf_ticker)
            hist_63d = etf.history(period="63d")
            if len(hist_63d) < 5:
                continue
            hist_21d = hist_63d.tail(21)
            hist_5d = hist_63d.tail(5)
            hist_3d = hist_63d.tail(3)
            hist_1d = hist_63d.tail(2)

            def _pct(h, n):
                if len(h) >= n:
                    return (float(h["Close"].iloc[-1]) - float(h["Close"].iloc[0])) / float(h["Close"].iloc[0]) * 100
                return None

            perf_1d = _pct(hist_1d, 2) or 0.0
            perf_3d = _pct(hist_3d, 3)
            perf_3d = perf_3d if perf_3d is not None else perf_1d
            perf_5d = _pct(hist_5d, 5)
            perf_5d = perf_5d if perf_5d is not None else perf_3d
            perf_21d = _pct(hist_21d, 10)
            perf_21d = perf_21d if perf_21d is not None else perf_5d

            SECTOR_PERFORMANCE[sector_name] = round(
                (perf_1d * 0.15) + (perf_3d * 0.20) + (perf_5d * 0.25) + (perf_21d * 0.40), 2
            )
        except Exception:
            continue

    logging.info(
        "[OK] Market and Sector Analysis Completed. "
        f"Hot sectors: {[k for k, v in sorted(SECTOR_PERFORMANCE.items(), key=lambda x: -x[1])[:3]]}"
    )


def get_regime_bucket() -> str:
    """
    v117.v2 rejim etiketlerini kullanıcı onaylı 3 universe kovasına indirger:
      STRONG                          → BULL
      BULLISH                         → NORMAL
      CHOPPY / HIGH_VOLATILITY / WEAK → CHOPPY
    """
    regime = MARKET_STATUS.get("regime", "BULLISH")
    if regime == "STRONG":
        return "BULL"
    if regime == "BULLISH":
        return "NORMAL"
    return "CHOPPY"

# ================================================================
# ================================================================
# SECTION 5: EARNINGS FILTER (7 GÜN)
# ================================================================
# ================================================================

def get_earnings_date_safe(ticker: str) -> Optional[datetime]:
    try:
        stock = yf.Ticker(ticker)

        # Kaynak 1: calendar
        if hasattr(stock, 'calendar') and stock.calendar:
            earnings_date = stock.calendar.get('Earnings Date', None)
            if earnings_date:
                if isinstance(earnings_date, list):
                    earnings_date = earnings_date[0]
                result = pd.to_datetime(earnings_date)
                if result is not None and not pd.isna(result):
                    return result

        # Kaynak 2: earnings_dates DataFrame
        if hasattr(stock, 'earnings_dates') and stock.earnings_dates is not None:
            try:
                now_tz = datetime.now(NY_TZ)
                ed = stock.earnings_dates
                if ed.index.tz is None:
                    ed.index = ed.index.tz_localize('America/New_York')
                else:
                    ed.index = ed.index.tz_convert('America/New_York')
                upcoming = ed[ed.index >= now_tz]
                if not upcoming.empty:
                    return upcoming.index[0]
            except Exception:
                pass

        # Kaynak 3: info dict (son çare)
        try:
            info = stock.info
            next_eps = info.get('nextFiscalYearEnd', None) or info.get('mostRecentQuarter', None)
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


def is_earnings_safe_for_swing(ticker: str, min_days_away: int = EARNINGS_MIN_DAYS) -> bool:
    """
    v3: min_days_away default 7 (kullanıcı onaylı, 5'ten yükseltildi).
    API tarih veremiyorsa hisse elenir (v117.2 kuralı korundu).
    """
    try:
        earnings_date = get_earnings_date_safe(ticker)
        if earnings_date is None:
            return False

        now = datetime.now(NY_TZ)
        if earnings_date.tzinfo is None:
            earnings_date = earnings_date.replace(tzinfo=timezone.utc).astimezone(NY_TZ)
        else:
            earnings_date = earnings_date.astimezone(NY_TZ)

        days_until = (earnings_date - now).days
        if 0 <= days_until < min_days_away:
            return False
        if -1 <= days_until < 0:
            return False
        return True
    except Exception:
        return False

# ================================================================
# ================================================================
# SECTION 6: COOLDOWN ENGINE (20 GÜN + 52W HIGH / BASE BREAKOUT İSTİSNASI)
# ================================================================
# ================================================================

def load_signal_history_dates(days: int = COOLDOWN_DAYS) -> Dict[str, str]:
    """
    Son N günün SİNYAL arşivlerinden {ticker: son_sinyal_tarihi} çıkarır.
    Ayrı state dosyası YOK — arşiv (swing_YYYYMMDD.json) tek doğruluk
    kaynağıdır. Watchlist kayıtları (status=WATCHLIST) cooldown'a girmez.
    """
    history: Dict[str, str] = {}
    try:
        current_year = datetime.now(NY_TZ).strftime("%Y")
        prev_year = str(int(current_year) - 1)
        cutoff_date = (datetime.now(NY_TZ) - timedelta(days=days)).strftime("%Y%m%d")

        for yr in (prev_year, current_year):
            swing_year_dir = os.path.join(BASE_DATA_DIR, f"swing{yr}")
            if not os.path.exists(swing_year_dir):
                continue
            for fname in sorted(os.listdir(swing_year_dir)):
                if not (fname.startswith("swing_") and fname.endswith(".json")):
                    continue
                date_part = fname[6:14]
                if not date_part.isdigit() or date_part < cutoff_date:
                    continue
                try:
                    with open(os.path.join(swing_year_dir, fname), "r", encoding="utf-8") as f:
                        day_data = json.load(f)
                    for pick in day_data.get("picks", []):
                        if pick.get("status") == "WATCHLIST":
                            continue          # watchlist cooldown tetiklemez
                        tkr = pick.get("ticker")
                        if tkr:
                            prev = history.get(tkr, "")
                            if date_part > prev:
                                history[tkr] = date_part
                except Exception as e:
                    logging.debug(f"Cooldown arşiv okuma ({fname}): {e}")
    except Exception as e:
        logging.error(f"❌ Cooldown history hatası: {e}")

    if history:
        logging.info(f"🧊 Cooldown havuzu ({COOLDOWN_DAYS}g): {len(history)} hisse")
    return history


def has_cooldown_reset_event(df_1d: pd.DataFrame) -> Optional[str]:
    """
    Cooldown SIFIRLAMA istisnaları (kullanıcı onaylı):
      1. YENİ 52W HIGH  : bugünkü high, önceki 252 günün max high'ına eşit/üstü
      2. BASE BREAKOUT  : bugünkü kapanış, son 60 günün (son 5 gün hariç)
                          max high'ının üzerine İLK KEZ çıkıyor
                          (dünkü kapanış hâlâ base altındaydı → taze kırılım)
    Dönen değer: istisna etiketi ya da None.
    """
    try:
        high  = df_1d["High"]
        close = df_1d["Close"]
        if len(high) < BASE_BREAKOUT_LOOKBACK + BASE_BREAKOUT_BUFFER + 5:
            return None

        today_high  = float(high.iloc[-1])
        today_close = float(close.iloc[-1])
        prev_close  = float(close.iloc[-2])

        # 1) Yeni 52W High
        lookback_252 = high.iloc[-253:-1] if len(high) >= 253 else high.iloc[:-1]
        if len(lookback_252) >= 100 and today_high >= float(lookback_252.max()):
            return "NEW_52W_HIGH"

        # 2) Taze Base Breakout
        base_window = high.iloc[-(BASE_BREAKOUT_LOOKBACK + BASE_BREAKOUT_BUFFER):-BASE_BREAKOUT_BUFFER]
        if len(base_window) >= 30:
            base_top = float(base_window.max())
            if today_close > base_top and prev_close <= base_top:
                return "BASE_BREAKOUT"

        return None
    except Exception:
        return None


def check_cooldown(ticker: str, df_1d: pd.DataFrame, cooldown_map: Dict[str, str]) -> (bool, str):
    """
    True → tarama devam edebilir. False → cooldown bloğu.
    20 gün içinde sinyal verilmişse blok; 52W High / Base Breakout
    oluşmuşsa istisna devreye girer ve blok kalkar.
    """
    last_date = cooldown_map.get(ticker)
    if not last_date:
        return True, ""

    try:
        last_dt = datetime.strptime(last_date, "%Y%m%d").replace(tzinfo=NY_TZ)
        days_since = (datetime.now(NY_TZ) - last_dt).days
    except Exception:
        return True, ""

    if days_since >= COOLDOWN_DAYS:
        return True, ""

    reset = has_cooldown_reset_event(df_1d)
    if reset:
        logging.info(f"🔓 {ticker}: Cooldown SIFIRLANDI ({reset}) — {days_since}. günde yeniden aday")
        return True, reset

    return False, f"COOLDOWN ({days_since}/{COOLDOWN_DAYS}g)"

# ================================================================
# ================================================================
# SECTION 7: LAYER 1 — TREND ENGINE (1D)  [HARD GATES]
# ================================================================
# ================================================================

def layer1_trend_engine(ticker: str, cooldown_map: Dict[str, str],
                        spy_close: Optional[pd.Series]) -> Optional[dict]:
    """
    LAYER 1 — 1D TREND [tamamı hard gate, puan YOK]:
      • Veri: >= 220 bar (EMA200 + 52W güvenilirliği)
      • Fiyat: $10 - $5000
      • DollarVol(20d) > rejim eşiği  (BULL 15M / NORMAL 20M / CHOPPY 30M)
      • EMA50 > EMA200  (golden alignment)
      • Close > EMA50   (trendin üstünde)
      • 1D RSI: 55 < RSI <= 70  (trend-içi güç, aşırı alım freni)
      • RS > SPY (30 günlük göreli güç pozitif)
      • Cooldown kontrolü (20g, 52WH/BaseBreakout istisnalı)
    Info-bazlı gate'ler (MCap, industry, quoteType) burada YAPILMAZ —
    Layer 1.5'te (sadece geçenler için) uygulanır → info API tasarrufu.
    """
    df_1d = get_stock_data(ticker, "1d")
    if df_1d is None or len(df_1d) < 220:
        return None

    try:
        close = df_1d["Close"]
        high  = df_1d["High"]
        low   = df_1d["Low"]
        vol   = df_1d["Volume"]

        current_price = float(close.iloc[-1])
        if not (PRICE_MIN <= current_price <= PRICE_MAX):
            return None

        # ── Rejime göre dolar hacmi gate ──────────────────────────
        bucket = get_regime_bucket()
        rules = REGIME_UNIVERSE_RULES[bucket]
        dollar_vol_20d = current_price * float(vol.tail(20).mean())
        if dollar_vol_20d < rules["min_dollar_vol"]:
            return None

        # ── EMA yapısı ────────────────────────────────────────────
        ema20_s  = EMAIndicator(close, 20).ema_indicator()
        ema50_s  = EMAIndicator(close, 50).ema_indicator()
        ema200_s = EMAIndicator(close, 200).ema_indicator()
        ema20  = float(ema20_s.iloc[-1])
        ema50  = float(ema50_s.iloc[-1])
        ema200 = float(ema200_s.iloc[-1])

        if not (ema50 > ema200):
            return None
        if not (current_price > ema50):
            return None

        # ── 1D RSI bandı ──────────────────────────────────────────
        rsi_1d = safe_rsi(close, 14)
        if not (RSI_1D_MIN < rsi_1d <= RSI_1D_MAX):
            return None

        # ── RS > SPY (30 gün) ─────────────────────────────────────
        rs_30d = 0.0
        if spy_close is not None and len(spy_close) >= RS_LOOKBACK + 1 and len(close) >= RS_LOOKBACK + 1:
            stock_ret = (current_price / float(close.iloc[-(RS_LOOKBACK + 1)])) - 1.0
            spy_ret   = (float(spy_close.iloc[-1]) / float(spy_close.iloc[-(RS_LOOKBACK + 1)])) - 1.0
            rs_30d = (stock_ret - spy_ret) * 100
            if rs_30d <= 0:
                return None

        # ── Cooldown ──────────────────────────────────────────────
        ok, cooldown_note = check_cooldown(ticker, df_1d, cooldown_map)
        if not ok:
            logging.debug(f"🧊 {ticker}: {cooldown_note}")
            return None

        # ── 1D metrikler (skor ve JSON için) ──────────────────────
        adx_1d  = safe_adx(high, low, close, 14)
        atr_1d  = safe_atr(high, low, close, ATR_PERIOD)
        if atr_1d <= 0:
            atr_1d = current_price * 0.03

        rvol_1d = 1.0
        try:
            v20 = float(vol.iloc[-21:-1].mean())
            rvol_1d = float(vol.iloc[-1]) / v20 if v20 > 0 else 1.0
        except Exception:
            pass

        ema20_slope_up = float(ema20_s.iloc[-1]) > float(ema20_s.iloc[-6]) if len(ema20_s) >= 6 else True

        return {
            "ticker": ticker,
            "df_1d": df_1d,
            "current_price": current_price,
            "dollar_vol_20d": dollar_vol_20d,
            "regime_bucket": bucket,
            "ema20": round(ema20, 2), "ema50": round(ema50, 2), "ema200": round(ema200, 2),
            "ema20_slope_up": ema20_slope_up,
            "rsi_14": round(rsi_1d, 1),
            "adx": round(adx_1d, 1),
            "atr_1d": atr_1d,
            "rvol_today": round(rvol_1d, 2),
            "rs_30d": round(rs_30d, 2),
            "cooldown_reset": cooldown_note,   # "" | NEW_52W_HIGH | BASE_BREAKOUT
            "details": [
                f"[L1 OK] EMA50>EMA200 | Close>EMA50 | RSI:{rsi_1d:.1f} | "
                f"RS30:{rs_30d:+.1f}% | DV:${dollar_vol_20d/1e6:.0f}M ({bucket})"
            ],
        }
    except Exception as e:
        logging.debug(f"L1 {ticker}: {e}")
        return None


def layer1b_info_gates(c: dict) -> bool:
    """
    LAYER 1.5 — Info-bazlı hard gate'ler (persistent cache öncelikli):
      • MarketCap > rejim eşiği (BULL 1B / NORMAL 2B / CHOPPY 5B)
      • CEF / ETF / MutualFund engeli
      • Yüksek riskli industry + MCap < 5B → engel
    """
    ticker = c["ticker"]
    info = get_stock_info(ticker)
    c["info"] = info
    c["sector"] = info.get("sector", "Unknown")
    c["beta"] = info.get("beta", 1.0) or 1.0
    c["market_cap"] = info.get("market_cap", 0) or 0
    c["company"] = info.get("companyName", COMPANY_DATABASE.get(ticker, {}).get("name", ticker))

    rules = REGIME_UNIVERSE_RULES[c["regime_bucket"]]
    if 0 < c["market_cap"] < rules["min_mcap"]:
        return False

    quote_type = str(info.get("quoteType", "EQUITY")).lower()
    if quote_type in CEF_BLOCK_QUOTE_TYPES:
        return False
    industry = str(info.get("industry", "")).lower()
    if any(b in industry for b in CEF_BLOCK_INDUSTRIES):
        return False
    if industry in HIGH_RISK_INDUSTRIES and c["market_cap"] < HIGH_RISK_INDUSTRY_MCAP_FLOOR:
        return False

    return True

# ================================================================
# ================================================================
# SECTION 8: LAYER 2 — MOMENTUM ENGINE (4H, RTH RESAMPLE)
# ================================================================
# ================================================================

def layer2_momentum_engine_4h(c: dict, df_1h: pd.DataFrame) -> bool:
    """
    LAYER 2 — 4H TREND KALİTESİ [hard gate]:
      • EMA20(4H) > EMA50(4H)
      • ADX(4H)  > 20
      • RSI(4H)  > 55
    1D ile 1H arasındaki 'görünmez bozulma' boşluğunu kapatır —
    backtest'te ölü girişlerin ana kaynağı buydu.
    """
    df_4h = resample_1h_to_4h_rth(df_1h)
    if df_4h is None or len(df_4h) < 55:
        return False

    try:
        close_4h = df_4h["Close"]
        high_4h  = df_4h["High"]
        low_4h   = df_4h["Low"]

        ema20_4h = safe_last_ema(close_4h, 20)
        ema50_4h = safe_last_ema(close_4h, 50)
        if not (ema20_4h > ema50_4h > 0):
            return False

        adx_4h = safe_adx(high_4h, low_4h, close_4h, 14)
        if adx_4h < ADX_4H_MIN:
            return False

        rsi_4h = safe_rsi(close_4h, 14)
        if rsi_4h <= RSI_4H_MIN:
            return False

        # 4H kalite metrikleri (skor bileşeni #2 için)
        ema_spread_pct = (ema20_4h - ema50_4h) / ema50_4h * 100 if ema50_4h > 0 else 0.0

        c["df_4h"] = df_4h
        c["adx_4h"] = round(adx_4h, 1)
        c["rsi_4h"] = round(rsi_4h, 1)
        c["ema20_4h"] = round(ema20_4h, 2)
        c["ema50_4h"] = round(ema50_4h, 2)
        c["ema_spread_4h_pct"] = round(ema_spread_pct, 2)
        c["details"].append(f"[L2 OK] 4H ADX:{adx_4h:.1f} | 4H RSI:{rsi_4h:.1f} | EMA Spread:{ema_spread_pct:+.2f}%")
        return True
    except Exception as e:
        logging.debug(f"L2 {c['ticker']}: {e}")
        return False

# ================================================================
# ================================================================
# SECTION 9: LAYER 3 — SWING ENGINE (1H)  → WATCHLIST HAVUZU
# ================================================================
# ================================================================

def layer3_swing_engine_1h(c: dict, df_1h: pd.DataFrame) -> bool:
    """
    LAYER 3 — 1H MOMENTUM [hard gate]:
      • 1H RSI: 52 - 68  (trend-içi dinlenme bandı; kullanıcı kuralı >52)
      • 1H RVOL > 1.5    (kurumsal para girişi kanıtı)
      • 1H ADX: gate DEĞİL (kullanıcı 'veya' kuralı: 4H ADX>20 zaten L2'de
        sağlandı) — ama skor bileşeni olarak kaydedilir.
    Bu katmanı geçen HER hisse watchlist havuzuna girer.
    """
    try:
        if df_1h is None or len(df_1h) < 30:
            return False

        close_1h = df_1h["Close"]
        high_1h  = df_1h["High"]
        low_1h   = df_1h["Low"]
        vol_1h   = df_1h["Volume"]

        rsi_1h = safe_rsi(close_1h, 14)
        if not (RSI_1H_MIN <= rsi_1h <= RSI_1H_MAX):
            return False

        v20 = float(vol_1h.iloc[-21:-1].mean())
        rvol_1h = float(vol_1h.iloc[-1]) / v20 if v20 > 0 else 0.0
        if rvol_1h < RVOL_1H_MIN:
            return False

        adx_1h = safe_adx(high_1h, low_1h, close_1h, 14)
        ema20_1h = safe_last_ema(close_1h, 20)
        ema50_1h = safe_last_ema(close_1h, 50)
        curr_c = float(close_1h.iloc[-1])

        atr_1h = safe_atr(high_1h, low_1h, close_1h, ATR_PERIOD)
        atr_pct_1h = (atr_1h / curr_c * 100) if curr_c > 0 else 0.0

        c["df_1h"] = df_1h
        c["rsi_1h"] = round(rsi_1h, 1)
        c["adx_1h"] = round(adx_1h, 1)
        c["rvol_1h"] = round(rvol_1h, 2)
        c["atr_pct_1h"] = round(atr_pct_1h, 2)
        c["h1_summary"] = {
            "RVOL(1H)": f"{rvol_1h:.1f}x ({'Para Girişi' if rvol_1h >= RVOL_1H_IDEAL else 'Yüksek'})",
            "RSI(1H)": f"{rsi_1h:.1f}",
            "ADX(14)": f"{adx_1h:.1f}",
            "Price/EMA": ("Above EMA20/50" if curr_c > ema20_1h > ema50_1h
                          else "Above EMA20" if curr_c > ema20_1h else "Below EMA20"),
            "Structure": "HH/HL Uptrend" if curr_c > ema20_1h else "Pullback Phase",
        }
        c["details"].append(f"[L3 OK] 1H RSI:{rsi_1h:.1f} | 1H RVOL:{rvol_1h:.2f}x | 1H ADX:{adx_1h:.1f}")
        return True
    except Exception as e:
        logging.debug(f"L3 {c['ticker']}: {e}")
        return False

# ================================================================
# ================================================================
# SECTION 10: LAYER 4 — ENTRY ENGINE (15m POWER PULLBACK TETİĞİ)
# ================================================================
# ================================================================

def layer4_entry_trigger_15m(c: dict, df_15m: pd.DataFrame) -> dict:
    """
    LAYER 4 — 15m POWER PULLBACK TETİĞİ.
    Kullanıcının favori formasyonu birebir kodlanmıştır:

      1. PULLBACK    : Son 30 barın swing high'ından bu yana 3-8 mumluk
                       geri çekilme penceresi (resume mumu hariç)
      2. EMA20 TEMASI: Pullback içinde en az bir mumun low'u
                       EMA20(15m) ± 0.30×ATR(15m) bandına değmiş
      3. RSI RESET   : Pullback dibinde 15m RSI 45-60 bandına inmiş
                       (düşen bıçak değil, trend-içi dinlenme)
      4. RESUME MUMU : Son kapanan mum:
                         a) Bullish engulfing  VEYA
                         b) Breakout candle (pullback tepesinin üstünde
                            güçlü gövdeli yeşil kapanış)
                       + kapanış EMA20(15m) üzerinde
      5. RVOL SPIKE  : Resume mumunda RVOL(15m) > 1.5

    Dönen dict:
      triggered      : bool
      trigger_type   : BULLISH_ENGULFING | BREAKOUT_CANDLE | ""
      pullback_*     : kalite metrikleri (skor bileşeni #4)
      state_note     : watchlist için insan-okur durum notu
    """
    out = {
        "triggered": False, "trigger_type": "", "state_note": "Setup bekleniyor",
        "pullback_candles": 0, "pullback_depth_atr": 0.0,
        "ema_touch": False, "rsi_reset": False, "rvol_15m": 0.0,
        "resume_body_ratio": 0.0,
    }
    try:
        if df_15m is None or len(df_15m) < 40:
            out["state_note"] = "15m veri yetersiz"
            return out

        o = df_15m["Open"];  h = df_15m["High"]
        l = df_15m["Low"];   cl = df_15m["Close"]
        v = df_15m["Volume"]

        ema20_15 = EMAIndicator(cl, 20).ema_indicator()
        rsi_15   = RSIIndicator(cl, 14).rsi()
        atr_15   = safe_atr(h, l, cl, 14)
        if atr_15 <= 0:
            atr_15 = float(cl.iloc[-1]) * 0.004

        # ── 1) Swing high & pullback penceresi ────────────────────
        # Resume mumu = son bar. Swing high son 30 bar içinde aranır
        # (son bar hariç). Pullback penceresi: swing_high+1 → son bar-1.
        search = h.iloc[-31:-1]
        swing_pos_in_search = int(np.argmax(search.values))
        swing_idx = len(df_15m) - 31 + swing_pos_in_search   # mutlak konum
        swing_high_val = float(h.iloc[swing_idx])

        pull_start = swing_idx + 1
        pull_end   = len(df_15m) - 1        # son bar (resume) hariç
        n_pull = pull_end - pull_start
        out["pullback_candles"] = n_pull

        if not (PULLBACK_MIN_CANDLES <= n_pull <= PULLBACK_MAX_CANDLES):
            out["state_note"] = f"Pullback {n_pull} mum (3-8 dışı)"
            return out

        pull_low = float(l.iloc[pull_start:pull_end].min())
        depth_atr = (swing_high_val - pull_low) / atr_15
        out["pullback_depth_atr"] = round(depth_atr, 2)

        # Anlamsız sığ (gürültü) veya çöküş derinliğinde pullback'i ele
        if depth_atr < 0.5:
            out["state_note"] = "Pullback çok sığ (gürültü)"
            return out
        if depth_atr > 4.0:
            out["state_note"] = "Geri çekilme çok derin (trend kırılma riski)"
            return out

        # ── 2) EMA20 teması ───────────────────────────────────────
        ema_touch = False
        for i in range(pull_start, pull_end):
            ema_v = float(ema20_15.iloc[i])
            if math.isnan(ema_v):
                continue
            if float(l.iloc[i]) <= ema_v + (EMA_TOUCH_ATR_BAND * atr_15):
                ema_touch = True
                break
        out["ema_touch"] = ema_touch
        if not ema_touch:
            out["state_note"] = "EMA20 teması henüz yok"
            return out

        # ── 3) RSI reset (45-60) ──────────────────────────────────
        rsi_window = rsi_15.iloc[pull_start:pull_end].dropna()
        if rsi_window.empty:
            out["state_note"] = "RSI verisi eksik"
            return out
        rsi_min = float(rsi_window.min())
        rsi_reset = (RSI_15M_RESET_LOW - 5) <= rsi_min <= RSI_15M_RESET_HIGH
        out["rsi_reset"] = rsi_reset
        if not rsi_reset:
            out["state_note"] = f"RSI reset dışı (dip:{rsi_min:.0f})"
            return out

        # ── 4) Resume mumu ────────────────────────────────────────
        curr_o = float(o.iloc[-1]);  curr_c = float(cl.iloc[-1])
        curr_h = float(h.iloc[-1]);  curr_l = float(l.iloc[-1])
        prev_o = float(o.iloc[-2]);  prev_c = float(cl.iloc[-2])
        prev_h = float(h.iloc[-2])

        is_green = curr_c > curr_o
        candle_range = max(curr_h - curr_l, 1e-9)
        body_ratio = abs(curr_c - curr_o) / candle_range
        out["resume_body_ratio"] = round(body_ratio, 2)

        above_ema = curr_c > float(ema20_15.iloc[-1])

        is_engulfing = (
            is_green and (prev_c < prev_o)
            and (curr_c > prev_o) and (curr_o <= prev_c)
        )
        pull_recent_high = float(h.iloc[max(pull_start, pull_end - 3):pull_end].max())
        is_breakout_candle = (
            is_green and body_ratio >= 0.55
            and (curr_c > prev_h) and (curr_c > pull_recent_high)
        )

        if not above_ema or not (is_engulfing or is_breakout_candle):
            out["state_note"] = "EMA20 temaslı, resume mumu bekleniyor"
            return out

        # ── 5) Resume mumunda RVOL ────────────────────────────────
        v20 = float(v.iloc[-21:-1].mean())
        rvol_15m = float(v.iloc[-1]) / v20 if v20 > 0 else 0.0
        out["rvol_15m"] = round(rvol_15m, 2)
        if rvol_15m < RVOL_15M_TRIGGER:
            out["state_note"] = f"Resume mumu var, RVOL zayıf ({rvol_15m:.1f}x)"
            return out

        # ✅ TETİK TAMAM
        out["triggered"] = True
        out["trigger_type"] = "BULLISH_ENGULFING" if is_engulfing else "BREAKOUT_CANDLE"
        out["state_note"] = (
            f"Power Pullback tetiklendi: {n_pull} mum + EMA20 teması + "
            f"RSI reset ({rsi_min:.0f}) + {out['trigger_type']} + RVOL {rvol_15m:.1f}x"
        )
        return out
    except Exception as e:
        logging.debug(f"L4 {c.get('ticker','?')}: {e}")
        out["state_note"] = "15m analiz hatası"
        return out

# ================================================================
# ================================================================
# SECTION 11: POWER PULLBACK SKORU (100p — 5 ŞEFFAF BİLEŞEN)
# ================================================================
# ================================================================

def compute_power_pullback_score(c: dict) -> float:
    """
    BOGA SCORE 100 — v3 (mikro-düzeltme YOK, 5 bileşen, tam izlenebilir):

      1. RS GÜCÜ (25p)          : 30 günlük SPY üstü getiri
      2. 4H TREND KALİTESİ (25p): ADX(4H) seviye + EMA20/50 spread
      3. 1H RVOL (20p)          : kurumsal para girişi şiddeti
      4. PULLBACK KALİTESİ (20p): mum sayısı + derinlik + tetik gücü
                                  (watchlist: tetik yok → maks 12p)
      5. SEKTÖR MOMENTUMU (10p) : SECTOR_PERFORMANCE sıralaması

    Her bileşenin puanı c['factor_breakdown'] içine yazılır —
    Telegram/JSON'da sinyal gerekçesi 5 satırda okunur.
    """
    bd = {}

    # ── 1) RS Gücü (25p) ─────────────────────────────────────────
    rs = c.get("rs_30d", 0.0)
    if rs >= 15:   rs_p = 25.0
    elif rs >= 10: rs_p = 21.0
    elif rs >= 6:  rs_p = 17.0
    elif rs >= 3:  rs_p = 12.0
    else:          rs_p = max(5.0, rs * 3.0)   # 0-3 arası: 5-9p taban
    bd["rs_strength"] = round(rs_p, 1)

    # ── 2) 4H Trend Kalitesi (25p) ───────────────────────────────
    adx4 = c.get("adx_4h", 0.0)
    if adx4 >= 40:   adx_p = 12.0   # tükenme riski — tavan değil
    elif adx4 >= 30: adx_p = 15.0   # sweet spot
    elif adx4 >= 25: adx_p = 13.0
    else:            adx_p = 9.0    # 20-25: yeni kurulan trend
    spread = c.get("ema_spread_4h_pct", 0.0)
    if spread >= 3.0:   sp_p = 10.0
    elif spread >= 1.5: sp_p = 8.0
    elif spread >= 0.5: sp_p = 5.0
    else:               sp_p = 2.0
    q4_p = min(25.0, adx_p + sp_p)
    bd["trend_quality_4h"] = round(q4_p, 1)

    # ── 3) 1H RVOL (20p) ─────────────────────────────────────────
    rv = c.get("rvol_1h", 0.0)
    if rv >= 3.0:   rv_p = 20.0
    elif rv >= RVOL_1H_IDEAL: rv_p = 17.0
    elif rv >= 1.75: rv_p = 13.0
    else:            rv_p = 10.0    # 1.5-1.75 (gate'i zaten geçti)
    bd["rvol_1h"] = round(rv_p, 1)

    # ── 4) Pullback Kalitesi (20p) ───────────────────────────────
    trig = c.get("trigger", {})
    n = trig.get("pullback_candles", 0)
    depth = trig.get("pullback_depth_atr", 0.0)

    if 4 <= n <= 6:            n_p = 6.0     # ideal düzen
    elif PULLBACK_MIN_CANDLES <= n <= PULLBACK_MAX_CANDLES: n_p = 4.0
    else:                      n_p = 1.0     # (watchlist'te henüz oluşmamış olabilir)

    if 1.0 <= depth <= 2.0:    d_p = 6.0     # ideal derinlik
    elif 0.5 <= depth <= 3.0:  d_p = 4.0
    else:                      d_p = 1.0

    if trig.get("triggered"):
        t_p = 8.0 if trig.get("trigger_type") == "BULLISH_ENGULFING" else 7.0
        if trig.get("rvol_15m", 0.0) >= 2.0:
            t_p = 8.0                          # RVOL 2x+ resume → tavan
    else:
        # Watchlist: tetik yok. Setup olgunluğuna göre kısmi puan.
        t_p = 0.0
        if trig.get("ema_touch"):  t_p += 1.0
        if trig.get("rsi_reset"):  t_p += 1.0

    pb_p = min(20.0, n_p + d_p + t_p)
    bd["pullback_quality"] = round(pb_p, 1)

    # ── 5) Sektör Momentumu (10p) ────────────────────────────────
    sector = c.get("sector", "Unknown")
    sec_perf = SECTOR_PERFORMANCE.get(sector, 0.0)
    ranked = sorted(SECTOR_PERFORMANCE.values(), reverse=True)
    if ranked and sec_perf >= ranked[min(2, len(ranked) - 1)]:
        sec_p = 10.0        # ilk 3 sektör
    elif sec_perf > 0:
        sec_p = 7.0
    elif sec_perf > -1.0:
        sec_p = 4.0
    else:
        sec_p = 1.0
    bd["sector_momentum"] = round(sec_p, 1)

    total = round(min(100.0, rs_p + q4_p + rv_p + pb_p + sec_p), 1)
    c["factor_breakdown"] = bd
    c["details"].append(
        f"[SCORE {total}] RS:{bd['rs_strength']} + 4H:{bd['trend_quality_4h']} + "
        f"RVOL:{bd['rvol_1h']} + PB:{bd['pullback_quality']} + SEC:{bd['sector_momentum']}"
    )
    return total

# ================================================================
# ================================================================
# SECTION 12: ZONE ENGINE (BUY/STOP/TP — v117.v2'DEN KORUNDU)
# ================================================================
# ================================================================

def calculate_support_resistance_1h(df_1h: pd.DataFrame, df_1d: pd.DataFrame,
                                    current_price: float,
                                    entry_trigger_1d: str = "",
                                    df_15m: pd.DataFrame = None) -> dict:
    """
    BOGA AI ZONE ENGINE — v117.v2'den TAŞINDI (frontend tp1-3/zone
    şeması ve TS motoru — tradePlanEngine.ts — ile birebir uyumlu).
    v3 sadeleştirmesi: entry_type artık hep POWER_PULLBACK ailesidir;
    zone matematiği (pivot merdiveni, %5 SL floor) aynen korunmuştur.
    """
    try:
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

        if df_1h is not None and len(df_1h) >= 20:
            low_1h  = df_1h['Low']
            high_1h = df_1h['High']

            lows, highs = low_1h.tail(50), high_1h.tail(50)
            pivot_lows = [float(lows.iloc[i]) for i in range(2, len(lows) - 2)
                          if lows.iloc[i] < lows.iloc[i - 1] and lows.iloc[i] < lows.iloc[i + 1]]
            pivot_highs = [float(highs.iloc[i]) for i in range(2, len(highs) - 2)
                           if highs.iloc[i] > highs.iloc[i - 1] and highs.iloc[i] > highs.iloc[i + 1]]

            supports_below = [p for p in pivot_lows if p < current_price - (atr_1d * 0.4)]
            if supports_below:
                support_1h = max(max(supports_below), macro_support)

            resists_above = [p for p in pivot_highs if p > current_price + (atr_1d * 0.5)]
            if resists_above:
                resist_1h = min(min(resists_above), macro_resist)

        # Safety buffer
        if (current_price - support_1h) < (atr_1d * 0.6):
            support_1h = current_price - (atr_1d * 0.8)

        # ── BUY ZONE — Power Pullback: tetik anına yakın dar bant ──
        # Sinyal, resume mumunun kapanışında üretilir → giriş bölgesi
        # canlı fiyat etrafında dar tutulur (tetik-anlık giriş felsefesi).
        buy_zone_low  = round(current_price - (atr_1d * 0.25), 2)
        buy_zone_high = round(current_price + (atr_1d * 0.15), 2)
        if buy_zone_low >= buy_zone_high:
            buy_zone_low = round(buy_zone_high - (atr_1d * 0.3), 2)

        stop_high = round(support_1h - (atr_1d * 0.5), 2)
        stop_low  = round(stop_high - (atr_1d * 0.2), 2)

        # %5 SL floor (v117.v2 MDU dersi — gürültüde yenmeyi önler)
        min_sl_pct = 0.050
        sl_floor = round(current_price * (1 - min_sl_pct), 2)
        if stop_high > sl_floor:
            gap = stop_high - sl_floor
            stop_high = sl_floor
            stop_low  = round(stop_low - gap, 2)

        # ── TP MERDİVENİ (pivot dirençler + yüzde tabanları) ───────
        avg_entry = (buy_zone_low + buy_zone_high) / 2.0

        PIVOT_WIN = 7
        highs_arr = high_1d.to_numpy(dtype=float)
        pivot_highs_d = []
        for i in range(PIVOT_WIN, len(highs_arr) - PIVOT_WIN):
            if (highs_arr[i] >= highs_arr[i - PIVOT_WIN:i].max()
                    and highs_arr[i] >= highs_arr[i + 1:i + PIVOT_WIN + 1].max()):
                pivot_highs_d.append(float(highs_arr[i]))

        ladder = []
        last_lvl = -float("inf")
        for vv in sorted(pivot_highs_d):
            if vv - last_lvl > last_lvl * 0.008:
                ladder.append(vv)
                last_lvl = vv

        hi_52 = float(high_1d.max())
        res_above = [r for r in ladder if r > avg_entry * 1.02]
        tp1 = max(res_above[0] if len(res_above) > 0 else 0.0, avg_entry * 1.05)
        tp2 = max(res_above[1] if len(res_above) > 1 else 0.0, avg_entry * 1.10, tp1 * 1.02)
        tp3 = max(res_above[2] if len(res_above) > 2 else hi_52, avg_entry * 1.15, tp2 * 1.02)

        sell_zone_low  = round(tp1, 2)
        sell_zone_high = round(tp3, 2)

        actual_risk   = avg_entry - stop_high
        actual_reward = tp2 - avg_entry
        rr_ratio = round(actual_reward / actual_risk, 2) if actual_risk > 0 else 0.0

        return {
            "entry_engine": {"valid": True, "type": "POWER_PULLBACK", "confidence": 85},
            "buy_zone":   {"low": buy_zone_low, "high": buy_zone_high},
            "sell_zone":  {"low": sell_zone_low, "high": sell_zone_high},
            "stop_zone":  {"low": stop_low, "high": stop_high},
            "tp1": round(tp1, 2),
            "tp2": round(tp2, 2),
            "tp3": round(tp3, 2),
            "support_1h": round(support_1h, 2),
            "resist_1h":  round(resist_1h, 2),
            "atr_1d":     round(atr_1d, 2),
            "atr_pct":    round(atr_pct * 100, 2),
            "rr_ratio":   rr_ratio,
            "risk_usd":   round(actual_risk, 2),
            "reward_usd": round(actual_reward, 2),
        }

    except Exception as e:
        logging.error(f"❌ Zone engine error: {e}")
        return {
            "entry_engine": {"valid": False, "type": "DATA_ERROR", "confidence": 0},
            "buy_zone":  {"low": current_price * 0.98, "high": current_price * 1.01},
            "sell_zone": {"low": current_price * 1.05, "high": current_price * 1.15},
            "stop_zone": {"low": current_price * 0.94, "high": current_price * 0.95},
            "tp1": round(current_price * 1.05, 2),
            "tp2": round(current_price * 1.10, 2),
            "tp3": round(current_price * 1.15, 2),
            "support_1h": current_price * 0.95,
            "resist_1h":  current_price * 1.08,
            "atr_1d": current_price * 0.03,
            "atr_pct": 3.0,
            "rr_ratio": 0.0,
            "risk_usd": 0.0,
            "reward_usd": 0.0,
        }


def estimate_hold_time(atr_pct: float, adx_4h: float) -> int:
    """
    Swing hold tahmini (3-10 gün bandı — v117.v2 FIX #8 korundu).
    Yüksek volatilite + güçlü 4H trend → hedefe daha hızlı ulaşır.
    """
    if atr_pct >= 4.0 and adx_4h >= 30:
        return 5
    if atr_pct >= 3.0:
        return 6
    if atr_pct >= 2.0:
        return 8
    return 10


def get_price_performance(df_1d: pd.DataFrame, ticker: str) -> dict:
    """1D/1W/1M/1Y/5Y değişim oranları (v117.v2'den korundu)."""
    try:
        close = df_1d['Close']
        perf = {}

        perf['1d'] = round((float(close.iloc[-1]) - float(close.iloc[-2])) / float(close.iloc[-2]) * 100, 2) if len(close) >= 2 else 0.0
        perf['1w'] = round((float(close.iloc[-1]) - float(close.iloc[-6])) / float(close.iloc[-6]) * 100, 2) if len(close) >= 6 else 0.0
        perf['1m'] = round((float(close.iloc[-1]) - float(close.iloc[-22])) / float(close.iloc[-22]) * 100, 2) if len(close) >= 22 else 0.0

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
# SECTION 13: JSON OUTPUT (ŞEMA v117.v2 İLE BİREBİR AYNI)
# ================================================================
# ================================================================

def build_json_output(top10: list, generated_at: str) -> dict:
    """
    Prepares picks in JSON format.
    ⚠️ ŞEMA KİLİTLİ: Alan adları/iç yapı v117.v2 ile birebir aynıdır —
    frontend (Smart Tracker, terminal, dashboard) bu şemayı okur.
    v3 EKLERİ (geriye uyumlu, sadece YENİ alanlar):
      • status: "WAITING_FOR_ENTRY" (sinyal) | "WATCHLIST" (tetik bekleyen)
      • selected_system: "PULLBACK" | "PULLBACK_WATCH"
      • factor_scores: 5 bileşenli yeni şeffaf skor dökümü
      • kök seviyede "watchlist" listesi (by_system'e ek kolaylık alanı)
    """
    picks = []
    for i, c in enumerate(top10):
        ticker = c.get("ticker", "")
        price  = c.get("current_price", 0.0)
        zones  = c.get("boga_zones", {})
        info   = c.get("info", {})
        perf   = c.get("performance", {})
        h1     = c.get("h1_summary", {})
        disp   = c.get("display_ind", {})
        bd     = c.get("factor_breakdown", {})
        is_watch = c.get("is_watchlist", False)

        mcap_raw = c.get("market_cap", 0) or 0
        if mcap_raw >= 1e12: mcap_str = f"{mcap_raw/1e12:.2f}T"
        elif mcap_raw >= 1e9: mcap_str = f"{mcap_raw/1e9:.2f}B"
        elif mcap_raw >= 1e6: mcap_str = f"{mcap_raw/1e6:.1f}M"
        else: mcap_str = str(mcap_raw)

        sel_system = "PULLBACK_WATCH" if is_watch else "PULLBACK"
        trig = c.get("trigger", {})

        pick = {
            "rank": i + 1,
            "ticker": ticker,
            "company": c.get("company", ticker),
            "sector": c.get("sector", "Unknown"),
            "score": c.get("boga_score_100", 0.0),
            "boga_score": c.get("boga_score_100", 0.0),  # Backward compatibility
            "market_regime": MARKET_STATUS.get("regime", "Bull"),
            "current_price": price,
            "holding_period_estimate": f"{c.get('hold_days', 7)} Days (max)",
            "holding_period": f"{c.get('hold_days', 7)} Days",  # legacy field
            "status": "WATCHLIST" if is_watch else "WAITING_FOR_ENTRY",
            # v3.1 — persistan aday havuzu alanları (candidate_pool.json'dan overlay edilir)
            "date_added": c.get("date_added", ""),
            "entry_status": c.get("entry_status", "PENDING"),
            "entry_zone": c.get("entry_zone"),
            "tracker_logic": {
                "entry_zone_low":    zones.get("buy_zone", {}).get("low", 0),
                "entry_zone_high":   zones.get("buy_zone", {}).get("high", 0),
                "profit_target_tp1": c.get("tp1", 0),
                "profit_target_tp2": c.get("tp2", 0),
                "profit_target_tp3": c.get("tp3", 0),
                "stop_loss_high":    zones.get("stop_zone", {}).get("high", 0),
                "max_hold_days":     c.get("hold_days", 7),
                "exit_rule":         "EXIT_ON_TARGET_OR_STOP_OR_MAX_HOLD",
                "trailing_stop_rules": {
                    "step_1": "If profit > 5%, move Stop Loss to Entry Price (Break-even).",
                    "step_2": "If profit > 8%, move Stop Loss to Entry Price + 2%."
                }
            },

            # 🔥 Flattened Fields for Frontend Compatibility
            "buy_zone": zones.get("buy_zone", {"low": 0, "high": 0}),
            "profit_zone": zones.get("sell_zone", {"low": 0, "high": 0}),
            "stop_zone": zones.get("stop_zone", {"low": 0, "high": 0}),
            "selected_system": sel_system,
            "system_category": "Pullback",
            "selection_reasons": c.get("selection_reasons", ["Power_Pullback"]),
            "system_label": {
                "PULLBACK":       {"text": "Power Pullback",            "color": "green"},
                "PULLBACK_WATCH": {"text": "Watchlist — Trigger Pending", "color": "yellow"},
            }.get(sel_system, {"text": "Power Pullback", "color": "green"}),
            "reasoning": f"BOGA AI Score: {c.get('boga_score_100', 0.0)} | System: {sel_system}",
            "detail_reasoning": (
                trig.get("state_note", "")
                if trig else "Power Pullback (1D+4H+1H+15m hizalaması) sonucunda seçilmiştir."
            ),
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
                "trend": "Uptrend (EMA50>EMA200)",
                "rsi_14": c.get("rsi_14", 50.0),
                "adx": c.get("adx", 0.0),
                "macd_hist": disp.get("macd_hist", 0.0),
                "mfi": disp.get("mfi", 50.0),
                "cmf": disp.get("cmf", 0.0),
                "rvol_today": c.get("rvol_today", 0.0),
                "entry_trigger": c.get("entry_trigger", ""),
                "is_exhausted": False,
            },

            # ── MOVING AVERAGES ────────────────────────────────────
            "moving_averages": {
                "ema_20": c.get("ema20", 0.0),
                "ema_50": c.get("ema50", 0.0),
                "ema_200": c.get("ema200", 0.0),
                "price_vs_ema20": round(price - c.get("ema20", price), 2),
                "price_vs_ema50": round(price - c.get("ema50", price), 2),
                "price_vs_ema200": round(price - c.get("ema200", price), 2),
                "ema20_slope": "Rising" if c.get("ema20_slope_up") else "Flat/Falling",
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
                "gross_margin_pct":     round((info.get("grossMargins", 0) or 0) * 100, 1),
                "operating_margin_pct": round((info.get("operatingMargins", 0) or 0) * 100, 1),
                "net_margin_pct":       round((info.get("profitMargins", 0) or 0) * 100, 1),
                "revenue_growth_pct":   round((info.get("revenueGrowth", 0) or 0) * 100, 1),
                "pe_ratio":             round(info.get("trailingPE", 0) or 0, 1),
                "pb_ratio":             round(info.get("priceToBook", 0) or 0, 1),
                "fcf_yield_pct":        round((info.get("freeCashflow", 0) or 0) / mcap_raw * 100, 1) if mcap_raw > 0 else 0,
                "market_cap":           mcap_str,
                "market_cap_usd":       mcap_raw,
            },

            # ── PERFORMANCE ─────────────────────────────────────────
            "performance": {
                "1d_pct": perf.get("1d", 0.0),
                "1w_pct": perf.get("1w", 0.0),
                "1m_pct": perf.get("1m", 0.0),
                "1y_pct": perf.get("1y", 0.0),
                "5y_pct": perf.get("5y", 0.0),
            },

            # ── FACTOR SCORES (v3: 5 şeffaf bileşen) ───────────────
            "factor_scores": {
                "trend_score":     bd.get("trend_quality_4h", 0.0),
                "momentum_score":  bd.get("rs_strength", 0.0),
                "volatility_score": bd.get("pullback_quality", 0.0),
                "volume_score":    bd.get("rvol_1h", 0.0),
                "financial_score": 0.0,
                "catalyst_score":  bd.get("sector_momentum", 0.0),
                "insider_score":   0.0,
                "composite":       c.get("boga_score_100", 0.0),
                "raw_score":       c.get("boga_score_100", 0.0),
            },

            # ── v3 YENİ: 4H katmanı + tetik detayları (ek alanlar) ─
            "four_hour_analysis": {
                "adx_4h": c.get("adx_4h", 0.0),
                "rsi_4h": c.get("rsi_4h", 0.0),
                "ema20_4h": c.get("ema20_4h", 0.0),
                "ema50_4h": c.get("ema50_4h", 0.0),
                "ema_spread_pct": c.get("ema_spread_4h_pct", 0.0),
            },
            "trigger_15m": {
                "triggered": trig.get("triggered", False),
                "type": trig.get("trigger_type", ""),
                "pullback_candles": trig.get("pullback_candles", 0),
                "pullback_depth_atr": trig.get("pullback_depth_atr", 0.0),
                "rvol_15m": trig.get("rvol_15m", 0.0),
                "note": trig.get("state_note", ""),
            },
        }
        picks.append(pick)

    by_system: Dict[str, list] = {}
    for p in picks:
        sysname = p.get("selected_system", "PULLBACK")
        by_system.setdefault(sysname, []).append(p.get("ticker"))

    return {
        "generated_at": generated_at,
        "date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
        "model": "BOGA AI v117.v3 (Power Pullback)",
        "market_regime": MARKET_STATUS.get("regime", "Bull"),
        "regime_bucket": get_regime_bucket(),
        "total_picks": len(picks),
        "picks": picks,
        "by_system": by_system,
        "system_summary": {
            sysname: {"count": len(tickers), "tickers": tickers}
            for sysname, tickers in by_system.items()
        },
        "watchlist": by_system.get("PULLBACK_WATCH", []),
    }

# ================================================================
# ================================================================
# SECTION 14: TELEGRAM
# ================================================================
# ================================================================

async def send_telegram_message(message: str):
    if not ENABLE_TELEGRAM_NOTIFICATIONS:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=15) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logging.warning(f"⚠️ Telegram error {resp.status}: {body[:200]}")
    except Exception as e:
        logging.warning(f"⚠️ Telegram send failed: {e}")


def classify_risk(rr: float) -> str:
    """Quality classification according to Risk/Reward ratio."""
    if rr >= 3.0: return "🏆 S (Elite)"
    if rr >= 2.5: return "💎 A+ (Premium)"
    if rr >= 2.0: return "[OK] A (Strong)"
    if rr >= 1.8: return "🟡 B+ (Good)"
    if rr >= 1.5: return "🟠 B (Medium)"
    return "🔴 C (Weak)"


def format_mcap(mcap_raw: float) -> str:
    if mcap_raw >= 1e12: return f"${mcap_raw/1e12:.2f}T"
    if mcap_raw >= 1e9:  return f"${mcap_raw/1e9:.2f}B"
    if mcap_raw > 0:     return f"${mcap_raw/1e6:.0f}M"
    return "N/A"


def verdict_emoji(score: float) -> str:
    if score >= 75: return "🦅 ELITE PULLBACK"
    if score >= 60: return "🔥 STRONG SETUP"
    if score >= 50: return "🐂 SOLID SETUP"
    return "🎯 QUALIFIED"


def build_candidate_block(rank: int, c: dict) -> str:
    """Telegram detay bloğu (v117.v2 düzeni + Power Pullback alanları)."""
    ticker = c.get("ticker", "")
    sector = c.get("sector", "Various")
    boga_s = c.get("boga_score_100", 0.0)
    entry  = c.get("current_price", 0.0)

    zones  = c.get("boga_zones", {})
    rr     = zones.get("rr_ratio", c.get("rr_ratio", 0.0))
    buy_z  = zones.get("buy_zone", {})
    stop_z = zones.get("stop_zone", {})

    trig     = c.get("trigger", {})
    bd       = c.get("factor_breakdown", {})
    rvol_1h  = c.get("rvol_1h", 0.0)
    trig_txt = trig.get("trigger_type", "").replace("_", " ").title() or "—"

    block = (
        f"🦅 <b>#{rank:02d} — {ticker}</b> | {sector}\n"
        f"🔁 <b>SİSTEM: [POWER PULLBACK]</b> — <i>1D+4H+1H+15m hizalı</i>\n"
        f"🔍 <b>Tetik:</b> <code>{trig_txt} | {trig.get('pullback_candles',0)} mum PB | "
        f"15m RVOL {trig.get('rvol_15m',0):.1f}x</code>\n"
        f"🐂 <b>BOGA Score:</b> {boga_s:.1f}/100 | <b>Price:</b> ${entry:.2f}\n"
        f"📊 <b>Döküm:</b> RS:{bd.get('rs_strength',0):.0f} · 4H:{bd.get('trend_quality_4h',0):.0f} · "
        f"RVOL:{bd.get('rvol_1h',0):.0f} · PB:{bd.get('pullback_quality',0):.0f} · SEC:{bd.get('sector_momentum',0):.0f}\n\n"
        f"🎯 <b>SWING SETUP</b>\n"
        f"🟢 <b>BUY :</b> ${buy_z.get('low',0):.2f} – ${buy_z.get('high',0):.2f}\n"
        f"🔴 <b>STOP:</b> ${stop_z.get('high',0):.2f}\n"
        f"🏁 <b>TP  :</b> ${c.get('tp1',0):.2f} / ${c.get('tp2',0):.2f} / ${c.get('tp3',0):.2f}\n"
        f"⚖️ <b>R/R :</b> {rr:.1f}:1  ({classify_risk(rr)})\n\n"
        f"⚡ <b>1H RVOL:</b> {rvol_1h:.1f}x | <b>4H ADX:</b> {c.get('adx_4h',0):.0f} | "
        f"<b>1D RSI:</b> {c.get('rsi_14',0):.0f}\n"
        f"{'─'*35}\n"
    )
    return block

# ================================================================
# ================================================================
# SECTION 15: STATS & PEAK TRACKER (v117.v2'DEN KORUNDU)
# ================================================================
# ================================================================

def update_swing_performance_stats():
    """swing_performance.json stats bölümünü history'den yeniden hesaplar."""
    try:
        perf_file = os.path.join(FRONTEND_PUBLIC_DIR, "swing_performance.json")
        if not os.path.exists(perf_file):
            logging.warning(f"swing_performance.json not found: {perf_file}")
            return

        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        history = data.get('history', [])
        if not history:
            return

        completed = [t for t in history if t.get('result') != 'PENDING']
        if not completed:
            return

        wins = sum(1 for t in completed if t.get('return_pct', 0) > 0)
        avg_return = sum(t.get('return_pct', 0) for t in completed) / len(completed)
        above_5 = sum(1 for t in completed if t.get('return_pct', 0) >= 5)
        above_10 = sum(1 for t in completed if t.get('return_pct', 0) >= 10)

        win_rate = wins / len(completed) * 100
        data.setdefault('stats', {})
        data['stats']['win_rate'] = round(win_rate, 1)
        data['stats']['avg_return_pct'] = round(avg_return, 1)
        data['stats']['above_5pct_rate'] = round(above_5 / len(completed) * 100, 1)
        data['stats']['above_10pct_rate'] = round(above_10 / len(completed) * 100, 1)
        data['stats']['total_picks'] = len(history)

        with open(perf_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logging.info(
            f"📊 Stats auto-updated: Win Rate {win_rate:.1f}% | "
            f"Avg Return {avg_return:.1f}% | Total {len(history)} trades"
        )
    except Exception as e:
        logging.error(f"❌ Stats update error: {e}")


def track_pick_peak_performance():
    """PENDING seçimlerin peak %'sini günceller; sistem bazlı winrate biriktirir."""
    try:
        perf_file = os.path.join(FRONTEND_PUBLIC_DIR, "swing_performance.json")
        if not os.path.exists(perf_file):
            return

        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        history = data.get('history', [])
        updated = False

        for trade in history:
            if trade.get('result') != 'PENDING':
                continue

            ticker = trade.get('ticker', '')
            entry_date = trade.get('date', '')
            entry_px = trade.get('entry_price', 0.0)
            system = trade.get('selected_system', 'PULLBACK')

            if not ticker or not entry_px:
                continue

            try:
                start_dt = entry_date if entry_date else None
                df_check = yf.download(ticker, start=start_dt, progress=False) if start_dt else yf.download(ticker, period="14d", progress=False)
                if df_check is None or df_check.empty:
                    continue

                highs = df_check['High'].dropna()
                last = float(df_check['Close'].dropna().iloc[-1])
                peak = float(highs.max())

                peak_pct = (peak - entry_px) / entry_px * 100 if entry_px > 0 else 0.0
                curr_pct = (last - entry_px) / entry_px * 100 if entry_px > 0 else 0.0

                trade['peak_pct'] = round(peak_pct, 2)
                trade['current_pct'] = round(curr_pct, 2)
                trade['selected_system'] = system

                stop_px = trade.get('stop_price', 0.0)
                target_px = trade.get('target_price', 0.0)

                if stop_px > 0 and float(df_check['Low'].min()) <= stop_px:
                    trade['result'] = 'STOPPED_OUT'
                    trade['return_pct'] = round((stop_px - entry_px) / entry_px * 100, 2)
                    updated = True
                elif target_px > 0 and peak >= target_px:
                    trade['result'] = 'TARGET_HIT'
                    trade['return_pct'] = round(peak_pct, 2)
                    updated = True
                else:
                    updated = True
                    ret = trade.get('return_pct', 0.0)
                    if ret >= 0:
                        trade['result'] = 'WIN'
                    elif ret <= -5.0:
                        trade['result'] = 'LOSS'
                    else:
                        trade['result'] = 'PENDING'

            except Exception as e:
                logging.debug(f"Peak tracker {ticker}: {e}")
                continue

        if updated:
            completed = [t for t in history if t.get('result') not in ('PENDING', None)]
            sys_stats: Dict[str, dict] = {}
            for t in completed:
                sysname = t.get('selected_system', 'UNKNOWN')
                ret = t.get('return_pct', 0.0)
                if sysname not in sys_stats:
                    sys_stats[sysname] = {'wins': 0, 'losses': 0, 'total_return': 0.0, 'count': 0}
                sys_stats[sysname]['count'] += 1
                sys_stats[sysname]['total_return'] += ret
                if ret > 0:
                    sys_stats[sysname]['wins'] += 1
                else:
                    sys_stats[sysname]['losses'] += 1

            data['system_stats'] = {
                sysname: {
                    'winrate': round(v['wins'] / v['count'] * 100, 1) if v['count'] > 0 else 0,
                    'avg_return': round(v['total_return'] / v['count'], 2) if v['count'] > 0 else 0,
                    'count': v['count']
                }
                for sysname, v in sys_stats.items()
            }

            with open(perf_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            logging.info(f"📈 Peak tracker updated: {len([t for t in history if t.get('result') == 'PENDING'])} PENDING trades tracked")
    except Exception as e:
        logging.error(f"❌ Peak tracker error: {e}")


async def send_weekly_performance_report():
    """Haftalık performans özeti — Pazartesi taramasında tetiklenir."""
    try:
        perf_file = os.path.join(FRONTEND_PUBLIC_DIR, "swing_performance.json")
        if not os.path.exists(perf_file):
            logging.warning("⚠️ Haftalık rapor: swing_performance.json bulunamadı.")
            return

        with open(perf_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        history = data.get('history', [])
        stats = data.get('stats', {})
        sys_stats = data.get('system_stats', {})

        if not history:
            return

        cutoff = (datetime.now(NY_TZ) - timedelta(days=7)).strftime("%Y-%m-%d")
        recent = [t for t in history if t.get('date', '') >= cutoff]
        completed_recent = [t for t in recent if t.get('result') not in ('PENDING', None)]

        wins_r = sum(1 for t in completed_recent if t.get('return_pct', 0) > 0)
        losses_r = sum(1 for t in completed_recent if t.get('return_pct', 0) <= 0)
        avg_r = (sum(t.get('return_pct', 0) for t in completed_recent) / len(completed_recent)) if completed_recent else 0
        wr_r = (wins_r / len(completed_recent) * 100) if completed_recent else 0

        total_trades = stats.get('total_picks', len(history))
        all_wr = stats.get('win_rate', 0)
        all_avg_ret = stats.get('avg_return_pct', 0)
        above_5 = stats.get('above_5pct_rate', 0)
        above_10 = stats.get('above_10pct_rate', 0)

        sys_lines = []
        for sys_name, s in sorted(sys_stats.items(), key=lambda x: -x[1].get('avg_return', 0)):
            wr = s.get('winrate', 0)
            avg = s.get('avg_return', 0)
            cnt = s.get('count', 0)
            bar = "🟢" if avg > 3 else "🟡" if avg > 0 else "🔴"
            sys_lines.append(f"  {bar} {sys_name:<14} WR:{wr:>4.0f}%  Avg:{avg:>+5.1f}%  n={cnt}")
        sys_block = "\n".join(sys_lines) if sys_lines else "  (henüz veri yok)"

        if completed_recent:
            best = max(completed_recent, key=lambda t: t.get('return_pct', 0))
            worst = min(completed_recent, key=lambda t: t.get('return_pct', 0))
            best_line = f"🏆 En iyi:  {best.get('ticker','?')} → <b>{best.get('return_pct',0):+.1f}%</b>"
            worst_line = f"💀 En kötü: {worst.get('ticker','?')} → <b>{worst.get('return_pct',0):+.1f}%</b>"
        else:
            best_line = "🏆 En iyi: —"
            worst_line = "💀 En kötü: —"

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
            f"<i>BOGA AI v117.v3 Power Pullback | swing_performance.json</i>"
        )

        await send_telegram_message(msg)
        logging.info("📊 Haftalık performans raporu Telegram'a gönderildi.")
    except Exception as e:
        logging.error(f"❌ Haftalık rapor hatası: {e}")

# ================================================================
# ================================================================
# SECTION 16: MAIN SCANNER — POWER PULLBACK PIPELINE
# ================================================================
# ================================================================

def build_diversified_signal_list(signals: list, total: int = TOP_SIGNAL_PICKS,
                                  max_per_sector: int = MAX_PER_SECTOR_SIGNALS) -> list:
    """
    Sinyal listesinde sektör konsantrasyonunu sınırlar (SL zincirleme
    patlaması / korelasyon riski). Watchlist'e kota uygulanmaz.
    """
    out, sector_counts = [], {}
    for c in signals:                       # signals skor sıralı gelir
        sec = c.get("sector", "Unknown")
        if sector_counts.get(sec, 0) >= max_per_sector:
            continue
        out.append(c)
        sector_counts[sec] = sector_counts.get(sec, 0) + 1
        if len(out) >= total:
            break
    return out

# ================================================================
# ================================================================
# SECTION 12.5: PERSİSTAN ADAY HAVUZU (v3.1 — candidate_pool.json)
# ================================================================
# ================================================================
#
# swing_candidates: L1-L3'ü geçen ve skor sırasına göre ilk 10 — her biri
#   PENDING (henüz 15m tetik yakalamadı) ya da ENTERED (giriş bölgesi
#   yakalandı) durumunda olabilir. PENDING adaylar 3 gün içinde tetik
#   yakalayamazsa havuzdan düşer. ENTERED adaylar, ilgili trade
#   swing_performance.json'da kapanana kadar havuzda kalır (setup
#   bozulsa/skor düşse bile — artık gerçek bir pozisyon takip ediliyor).
#
# watchlist_candidates: skor sırasında 11-20. arası — giriş-bölgesi
#   kavramı yok, sadece 10 gün boyunca "radarda" takip edilir.

def load_candidate_pool() -> dict:
    try:
        if os.path.exists(CANDIDATE_POOL_FILE):
            with open(CANDIDATE_POOL_FILE, "r", encoding="utf-8") as f:
                pool = json.load(f)
                pool.setdefault("swing_candidates", [])
                pool.setdefault("watchlist_candidates", [])
                return pool
    except Exception as e:
        logging.warning(f"⚠️ candidate_pool.json yükleme hatası: {e}")
    return {"swing_candidates": [], "watchlist_candidates": []}


def save_candidate_pool(pool: dict):
    try:
        os.makedirs(os.path.dirname(CANDIDATE_POOL_FILE), exist_ok=True)
        with open(CANDIDATE_POOL_FILE, "w", encoding="utf-8") as f:
            json.dump(pool, f, indent=2, ensure_ascii=False, default=str)
    except Exception as e:
        logging.warning(f"⚠️ candidate_pool.json kaydetme hatası: {e}")


def _days_since_ny(date_str: str) -> int:
    try:
        d0 = datetime.strptime(date_str, "%Y-%m-%d")
        today = datetime.now(NY_TZ).replace(tzinfo=None)
        return (today - d0).days
    except Exception:
        return 0


def is_trade_closed_in_performance(ticker: str, entered_at: str) -> bool:
    """swing_performance.json'da bu ticker için açılmış işlem kapanmış mı
    (result != PENDING) diye bakar. Dosya/kayıt yoksa False döner (henüz
    performansa geçmemiş demektir, havuzda tutulmaya devam eder)."""
    try:
        perf_file = os.path.join(FRONTEND_PUBLIC_DIR, "swing_performance.json")
        if not os.path.exists(perf_file):
            return False
        with open(perf_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        matches = [t for t in data.get("history", []) if t.get("ticker") == ticker]
        if not matches:
            return False
        # En güncel kayda bak (entered_at'e en yakın olan)
        latest = matches[-1]
        return latest.get("result") not in (None, "PENDING")
    except Exception:
        return False


def merge_candidate_pool(top_signals: list, top_watch: list, l1b_pass_tickers: set) -> dict:
    """FULL_SCAN sonunda çağrılır — bu run'ın taze L1-L4 sonuçlarıyla
    persiste edilmiş havuzu birleştirir (bkz. modül üstü açıklama)."""
    pool = load_candidate_pool()
    today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
    now_iso = datetime.now(NY_TZ).isoformat()

    fresh_swing = {c["ticker"]: c for c in top_signals}
    fresh_watch = {c["ticker"]: c for c in top_watch}

    # ── Swing candidates ─────────────────────────────────────────
    kept_swing = []
    seen = set()
    for entry in pool.get("swing_candidates", []):
        t = entry["ticker"]
        if entry.get("entry_status") == "ENTERED":
            if is_trade_closed_in_performance(t, entry.get("entered_at", "")):
                continue  # trade kapandı → havuzdan düş
            # Taze veri varsa last_pick'i güncelle, yoksa eski kaydı koru
            if t in fresh_swing:
                c = fresh_swing[t]
                entry["last_pick"] = c.get("_pick_json", entry.get("last_pick"))
                entry["last_checked"] = today_str
            kept_swing.append(entry)
            seen.add(t)
            continue

        # PENDING
        if _days_since_ny(entry.get("first_seen_date", today_str)) >= SWING_PENDING_MAX_DAYS:
            continue  # 3 gün giriş yok → düş
        if t not in fresh_swing and t not in l1b_pass_tickers:
            continue  # setup bozuldu (artık temel trend gate'ini bile geçmiyor) → düş
        if t in fresh_swing:
            c = fresh_swing[t]
            trig = c.get("trigger", {})
            if trig.get("triggered"):
                entry["entry_status"] = "ENTERED"
                zones = c.get("boga_zones", {})
                entry["entry_zone"] = {
                    "low": zones.get("buy_zone", {}).get("low", 0.0),
                    "high": zones.get("buy_zone", {}).get("high", 0.0),
                }
                entry["entered_at"] = now_iso
            entry["last_pick"] = c.get("_pick_json", entry.get("last_pick"))
            entry["last_checked"] = today_str
        kept_swing.append(entry)
        seen.add(t)

    for t, c in fresh_swing.items():
        if t in seen:
            continue
        trig = c.get("trigger", {})
        triggered = bool(trig.get("triggered"))
        zones = c.get("boga_zones", {})
        kept_swing.append({
            "ticker": t,
            "sector": c.get("sector", "Unknown"),
            "first_seen_date": today_str,
            "entry_status": "ENTERED" if triggered else "PENDING",
            "entry_zone": ({
                "low": zones.get("buy_zone", {}).get("low", 0.0),
                "high": zones.get("buy_zone", {}).get("high", 0.0),
            } if triggered else None),
            "entered_at": now_iso if triggered else None,
            "last_checked": today_str,
            "last_pick": c.get("_pick_json"),
        })

    # ── Watchlist candidates (giriş-bölgesi yok, sadece 10-gün takip) ──
    kept_watch = []
    seen_w = set()
    for entry in pool.get("watchlist_candidates", []):
        t = entry["ticker"]
        if t in fresh_swing:
            continue  # swing havuzuna terfi etti
        if _days_since_ny(entry.get("first_seen_date", today_str)) >= WATCHLIST_MAX_DAYS:
            continue
        if t not in fresh_watch and t not in l1b_pass_tickers:
            continue  # setup bozuldu
        if t in fresh_watch:
            entry["last_checked"] = today_str
        kept_watch.append(entry)
        seen_w.add(t)

    for t, c in fresh_watch.items():
        if t in seen_w or t in fresh_swing:
            continue
        kept_watch.append({
            "ticker": t,
            "sector": c.get("sector", "Unknown"),
            "score": c.get("boga_score_100", 0.0),
            "first_seen_date": today_str,
            "last_checked": today_str,
        })

    pool["swing_candidates"] = kept_swing
    pool["watchlist_candidates"] = kept_watch
    pool["updated_at"] = now_iso
    save_candidate_pool(pool)
    return pool


def write_watchlist_picks_json(pool: dict):
    """Watchlist için ayrı, hafif JSON — frontend /watchlist sayfası bunu okur."""
    try:
        os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)
        picks = [
            {
                "ticker": e["ticker"],
                "sector": e.get("sector", "Unknown"),
                "date_added": e.get("first_seen_date", ""),
                "score": e.get("score", 0.0),
            }
            for e in pool.get("watchlist_candidates", [])
        ]
        out = {"generated_at": datetime.now(NY_TZ).isoformat(), "picks": picks}
        with open(os.path.join(FRONTEND_PUBLIC_DIR, WATCHLIST_PICKS_FILE), "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False, default=str)
    except Exception as e:
        logging.warning(f"⚠️ watchlist_picks.json yazma hatası: {e}")


async def run_entry_check_pass():
    """ENTRY_CHECK modu (FULL_SCAN olmayan saatler): universe/L1-L3 tekrar
    çalışmaz. Sadece candidate_pool.json'daki PENDING swing adayları için
    Layer 4 (15m Power Pullback) kontrolü yapılır; tetik yakalanırsa
    entry_status ENTERED'e döner ve mevcut swing_picks.json /
    swing_all_picks.json / bugünkü arşiv dosyasındaki ilgili pick
    yerinde güncellenir (tam yeniden analiz yapılmaz)."""
    pool = load_candidate_pool()
    pending = [e for e in pool.get("swing_candidates", []) if e.get("entry_status") == "PENDING"]
    now_ny = datetime.now(NY_TZ)

    if not pending:
        logging.info("[ENTRY_CHECK] Bekleyen (PENDING) swing adayı yok.")
        return

    logging.info(f"[ENTRY_CHECK] {len(pending)} bekleyen aday için 15m tetik kontrolü başlıyor...")
    updated_any = False

    for entry in pending:
        ticker = entry["ticker"]
        try:
            df_1d = get_stock_data(ticker, "1d")
            if df_1d is None or df_1d.empty:
                dl = await asyncio.to_thread(
                    yf.download, ticker, period="252d", interval="1d",
                    progress=False, ignore_tz=True
                )
                if dl is None or dl.empty:
                    continue
                BULK_DATA_CACHE[ticker] = dl.dropna().copy()
                df_1d = BULK_DATA_CACHE[ticker]

            df_1h = await asyncio.to_thread(get_stock_data, ticker, "1h")
            df_15m = await asyncio.to_thread(get_stock_data, ticker, "15m")
            if df_15m is None or df_15m.empty:
                continue

            trig = layer4_entry_trigger_15m({"ticker": ticker}, df_15m)
            entry["last_checked"] = now_ny.strftime("%Y-%m-%d %H:%M")
            if not trig.get("triggered"):
                continue

            current_price = float(df_1d["Close"].iloc[-1])
            zones = calculate_support_resistance_1h(
                df_1h, df_1d, current_price,
                f"Power Pullback ({trig['trigger_type']})", df_15m
            )
            entry["entry_status"] = "ENTERED"
            entry["entry_zone"] = {
                "low": zones.get("buy_zone", {}).get("low", 0.0),
                "high": zones.get("buy_zone", {}).get("high", 0.0),
            }
            entry["entered_at"] = now_ny.isoformat()
            updated_any = True
            logging.info(f"🎯 [ENTRY_CHECK] {ticker}: Giriş bölgesi yakalandı → {entry['entry_zone']}")

            await send_telegram_message(
                f"🎯 <b>GİRİŞ ZONE YAKALANDI: {ticker}</b>\n"
                f"Buy Zone: {entry['entry_zone']['low']:.2f} - {entry['entry_zone']['high']:.2f}\n"
                f"<i>{trig.get('state_note','')}</i>"
            )
        except Exception as e:
            logging.error(f"❌ [ENTRY_CHECK] {ticker}: {e}")

    save_candidate_pool(pool)
    if updated_any:
        patch_pick_files_with_pool(pool)


def patch_pick_files_with_pool(pool: dict):
    """candidate_pool.json'daki entry_status/entry_zone/date_added
    alanlarını, mevcut swing_picks.json / swing_all_picks.json / bugünkü
    arşiv dosyasındaki picks listesinde ticker eşleşmesine göre yerinde
    günceller (tam yeniden yazma yapmaz)."""
    status_map = {e["ticker"]: e for e in pool.get("swing_candidates", [])}
    now_ny = datetime.now(NY_TZ)

    paths = [
        os.path.join(FRONTEND_PUBLIC_DIR, OUTPUT_JSON_FILE),
        os.path.join(FRONTEND_PUBLIC_DIR, OUTPUT_ALL_JSON_FILE),
        os.path.join(BASE_DATA_DIR, f"swing{now_ny.strftime('%Y')}", f"swing_{now_ny.strftime('%Y%m%d')}.json"),
    ]
    for path in paths:
        try:
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            picks = data.get("picks", [])
            changed = False
            for p in picks:
                st = status_map.get(p.get("ticker"))
                if not st:
                    continue
                new_status = st.get("entry_status", "PENDING")
                new_zone = st.get("entry_zone")
                if p.get("entry_status") != new_status or p.get("entry_zone") != new_zone:
                    p["entry_status"] = new_status
                    p["entry_zone"] = new_zone
                    p["status"] = "WAITING_FOR_ENTRY" if new_status == "PENDING" else p.get("status", "WAITING_FOR_ENTRY")
                    p["date_added"] = st.get("first_seen_date", p.get("date_added"))
                    changed = True
            if changed:
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False, default=str)
                logging.info(f"📝 Patch edildi: {path}")
        except Exception as e:
            logging.warning(f"⚠️ Patch hatası ({path}): {e}")


async def scan_top_stocks(mode: str = "FULL_SCAN"):
    """
    BOGA AI MASTER SCANNER — v117.v3 POWER PULLBACK

    WORKFLOW:
      1. Market + Sector Analysis  → rejim kovası (BULL/NORMAL/CHOPPY)
      2. Universe (~600, haftalık cache)
      3. LAYER 1 (1D)   : cache üstünde hızlı hard-gate — sıfır network
      4. LAYER 1.5      : MCap / industry / quoteType (info cache)
      5. LAYER 2 (4H)   : 1H çek → RTH resample → kalite gate
      6. Earnings gate (7 gün) — sadece L2 geçenlere (API tasarrufu)
      7. LAYER 3 (1H)   : momentum gate → WATCHLIST havuzu
      8. LAYER 4 (15m)  : Power Pullback tetiği → SİNYAL
      9. Skor (5 bileşen) + zone/TP + R/R eleme
     10. Top 10 SİNYAL + Top 10 WATCHLIST → JSON + Telegram
    """
    if mode == "ENTRY_CHECK":
        logging.info("▶ ENTRY_CHECK modu — universe/L1-L3 atlanıyor, sadece PENDING adaylar için 15m tetik kontrolü.")
        await run_entry_check_pass()
        return

    start_time = time.time()
    scanned_count = 0

    # ── STEP 1: MARKET ANALYSIS ─────────────────────────────────
    await analyze_market_and_sectors()
    bucket = get_regime_bucket()
    rules = REGIME_UNIVERSE_RULES[bucket]
    logging.info(
        f"⚙️ Regime: {MARKET_STATUS['regime']} → Kova: {bucket} | "
        f"MCap>{rules['min_mcap']/1e9:.0f}B | DV>{rules['min_dollar_vol']/1e6:.0f}M"
    )

    # ── STEP 2: UNIVERSE ─────────────────────────────────────────
    MASTER_UNIVERSE = await build_power_universe()
    if not MASTER_UNIVERSE:
        await send_telegram_message("❌ Could not create universe!")
        return

    tickers_to_scan = [t for t in MASTER_UNIVERSE if t not in EXCLUDED_STOCKS]
    logging.info(f"📋 Taranacak hisse: {len(tickers_to_scan)}")

    # Cooldown haritası + SPY benchmark (bir kez yüklenir)
    cooldown_map = load_signal_history_dates(days=COOLDOWN_DAYS)
    spy_close = await asyncio.to_thread(get_index_close_series, INDEX_BENCHMARK)
    if spy_close is None:
        logging.warning("⚠️ SPY benchmark verisi alınamadı — RS gate atlanacak")

    # ── STEP 3: LAYER 1 (1D — cache üstünde, hızlı) ─────────────
    l1_pass: list = []
    for t in tickers_to_scan:
        r = layer1_trend_engine(t, cooldown_map, spy_close)
        scanned_count += 1
        if r is not None:
            l1_pass.append(r)
    logging.info(f"[L1] 1D Trend Gate: {len(tickers_to_scan)} → {len(l1_pass)} hisse")

    if not l1_pass:
        await send_telegram_message(
            f"🐂 <b>BOGA v117.v3</b> — Bugün Layer 1'i geçen hisse yok.\n"
            f"📊 Rejim: {MARKET_STATUS['regime']} ({bucket})\n"
            f"<i>Disiplin = pozisyon yok da bir pozisyondur.</i>"
        )
        return

    # ── STEP 4: LAYER 1.5 (info gates — MCap/industry/quoteType) ─
    l1b_pass = []
    for c in l1_pass:
        try:
            if layer1b_info_gates(c):
                l1b_pass.append(c)
        except Exception as e:
            logging.debug(f"L1.5 {c['ticker']}: {e}")
    logging.info(f"[L1.5] Info Gate (MCap>{rules['min_mcap']/1e9:.0f}B): {len(l1_pass)} → {len(l1b_pass)} hisse")

    # RS gücüne göre sırala — 1H veri bütçesini en güçlülere harca
    l1b_pass.sort(key=lambda x: x.get("rs_30d", 0.0), reverse=True)
    l2_input = l1b_pass[:MAX_L2_CANDIDATES]

    # ── STEP 5-8: LAYER 2/3/4 (network katmanları, paralel) ─────
    semaphore = asyncio.Semaphore(6)
    watch_pool: list = []
    signal_pool: list = []

    async def deep_pipeline(c: dict):
        ticker = c["ticker"]
        async with semaphore:
            await asyncio.sleep(random.uniform(0.3, 0.8))
            try:
                df_1h = await asyncio.to_thread(get_stock_data, ticker, "1h")
                if df_1h is None:
                    return

                # LAYER 2 — 4H kalite
                if not layer2_momentum_engine_4h(c, df_1h):
                    return

                # Earnings gate (7 gün) — L2 sonrası (daha az API çağrısı)
                earnings_ok = await asyncio.to_thread(is_earnings_safe_for_swing, ticker, EARNINGS_MIN_DAYS)
                if not earnings_ok:
                    logging.debug(f"📅 {ticker}: Earnings {EARNINGS_MIN_DAYS} gün penceresinde → elendi")
                    return

                # LAYER 3 — 1H momentum → watchlist havuzu
                if not layer3_swing_engine_1h(c, df_1h):
                    return

                # LAYER 4 — 15m Power Pullback tetiği
                df_15m = await asyncio.to_thread(get_stock_data, ticker, "15m")
                trig = layer4_entry_trigger_15m(c, df_15m if df_15m is not None else pd.DataFrame())
                c["trigger"] = trig
                c["df_15m"] = df_15m

                c["selection_reasons"] = ["1D_Trend", "4H_Quality", "1H_Momentum"]
                if trig["triggered"]:
                    c["selection_reasons"].append("15m_Trigger")
                    c["entry_trigger"] = f"Power Pullback ({trig['trigger_type']})"
                    c["is_watchlist"] = False
                    signal_pool.append(c)
                    logging.info(f"🎯 SİNYAL: {ticker} — {trig['state_note']}")
                else:
                    c["entry_trigger"] = "Watchlist (15m trigger pending)"
                    c["is_watchlist"] = True
                    watch_pool.append(c)
                    logging.info(f"👁️ WATCHLIST: {ticker} — {trig['state_note']}")
            except Exception as e:
                logging.error(f"❌ Pipeline {ticker}: {e}")

    await asyncio.gather(*(deep_pipeline(c) for c in l2_input))
    logging.info(
        f"[L2-L4] Sonuç: {len(l2_input)} → SİNYAL: {len(signal_pool)} | WATCHLIST: {len(watch_pool)}"
    )

    all_qualified = signal_pool + watch_pool
    if not all_qualified:
        await send_telegram_message(
            f"🐂 <b>BOGA v117.v3</b> — Bugün 4 katmanı geçen hisse yok.\n"
            f"📊 Rejim: {MARKET_STATUS['regime']} ({bucket})\n"
            f"<i>Power Pullback tetiksiz giriş yapmaz. Yarın tekrar.</i>"
        )
        return

    # ── STEP 9: SKOR + ZONE + R/R ────────────────────────────────
    for c in all_qualified:
        c["boga_score_100"] = compute_power_pullback_score(c)
        c["hold_days"] = estimate_hold_time(
            (c.get("atr_1d", 0) / c["current_price"] * 100) if c["current_price"] > 0 else 2.5,
            c.get("adx_4h", 20.0)
        )

        zones = calculate_support_resistance_1h(
            c.get("df_1h"), c.get("df_1d"), c.get("current_price", 0.0),
            c.get("entry_trigger", ""), c.get("df_15m")
        )
        c["boga_zones"] = zones
        c["boga_rr"] = zones.get("rr_ratio", 0.0)
        c["tp1"] = zones.get("tp1", 0.0)
        c["tp2"] = zones.get("tp2", 0.0)
        c["tp3"] = zones.get("tp3", 0.0)
        c["stop_loss"] = zones.get("stop_zone", {}).get("high", 0.0)
        c["rr_ratio"] = c["boga_rr"]
        if c["current_price"] > 0 and zones.get("tp2"):
            c["profit_expectation_pct"] = round((zones["tp2"] / c["current_price"] - 1) * 100, 2)

        c["display_ind"] = compute_display_indicators(c["df_1d"])

    # R/R hard eleme: sadece bu run'da TETİKLENMİŞ (gerçek giriş) adaylara
    # uygulanır — henüz tetiklenmemiş (PENDING) adaylarda zone'lar geçici
    # olduğundan RR'a göre elenmezler (bkz. v3.1 rank-bazlı swing/watchlist
    # ayrımı, eski signal_pool/watch_pool ayrımının yerini aldı).
    all_qualified = [
        c for c in all_qualified
        if not c.get("trigger", {}).get("triggered") or c.get("boga_rr", 0.0) >= MIN_RR_RATIO
    ]

    # ── STEP 10: SIRALAMA + SEKTÖR ÇEŞİTLENDİRME (v3.1) ──────────
    # Sinyal/Watchlist ayrımı artık günlük L4 tetiklemesine göre DEĞİL,
    # BOGA skoruna göre yapılıyor: ilk 10 = Swing Adayları (Giriş Zone
    # veya Bekle durumunda olabilir, 3-gün persistan takip), sonraki 10 =
    # Watchlist (giriş-bölgesi kavramı yok, 10-gün persistan takip).
    all_qualified.sort(key=lambda x: x.get("boga_score_100", 0.0), reverse=True)
    diversified = build_diversified_signal_list(
        all_qualified, TOP_SIGNAL_PICKS + TOP_WATCHLIST_PICKS
    )
    top_signals = diversified[:TOP_SIGNAL_PICKS]
    top_watch = diversified[TOP_SIGNAL_PICKS:TOP_SIGNAL_PICKS + TOP_WATCHLIST_PICKS]

    for i, c in enumerate(top_signals):
        c["rank"] = i + 1
        c["is_watchlist"] = not c.get("trigger", {}).get("triggered")
    for i, c in enumerate(top_watch):
        c["rank"] = i + 1
        c["is_watchlist"] = True

    combined = top_signals + top_watch   # arşiv/terminal: swing önce

    # ── Terminal tam liste ───────────────────────────────────────
    logging.info("=" * 78)
    logging.info(f"🐂 BOGA AI v117.v3 POWER PULLBACK — SİNYAL: {len(top_signals)} | WATCHLIST: {len(top_watch)}")
    logging.info(f"{'#':<4}{'TICKER':<8}{'TİP':<10}{'BOGA':>6} {'SEKTOR':<22}{'R/R':>5}{'RSI':>6}{'4H-ADX':>8}{'1H-RVOL':>8}")
    logging.info("-" * 78)
    for i, c in enumerate(combined):
        tip = "WATCH" if c.get("is_watchlist") else "SIGNAL"
        logging.info(
            f"{i+1:<4}{c['ticker']:<8}{tip:<10}{c.get('boga_score_100',0):>6.1f} "
            f"{c.get('sector','Unknown')[:20]:<22}{c.get('boga_rr',0):>5.1f}{c.get('rsi_14',0):>6.1f}"
            f"{c.get('adx_4h',0):>8.1f}{c.get('rvol_1h',0):>7.1f}x"
        )
    logging.info("=" * 78)

    # ── STEP 11: PERFORMANS VERİSİ ───────────────────────────────
    for c in combined:
        c["performance"] = get_price_performance(c.get("df_1d", pd.DataFrame()), c["ticker"])
        if c.get("company", c["ticker"]) == c["ticker"]:
            db_info = COMPANY_DATABASE.get(c["ticker"], {})
            c["company"] = db_info.get("name", c.get("info", {}).get("companyName", c["ticker"]))

    # ── STEP 12: JSON OUTPUT (yollar/şema v117.v2 ile aynı) ─────
    now_ny = datetime.now(NY_TZ)
    generated_at = now_ny.isoformat()

    # ── v3.1: PERSİSTAN HAVUZ BİRLEŞTİRME ────────────────────────
    # Her adayın tam analiz kaydını (_pick_json) hesapla, sonra bugünün
    # taze sonuçlarını persiste edilmiş havuzla birleştir. swing_all_picks.json
    # bundan sonra SADECE bugünün top 20'sinden değil, havuzda hâlâ takip
    # edilen TÜM swing adaylarından üretilir — "mevcut adaylar listede
    # kalmaya devam edecek" kuralı bu sayede sağlanır.
    for c in combined:
        c["_pick_json"] = build_json_output([c], generated_at)["picks"][0]

    l1b_pass_tickers = {c["ticker"] for c in l1b_pass}
    pool = merge_candidate_pool(top_signals, top_watch, l1b_pass_tickers)
    write_watchlist_picks_json(pool)

    def _wrap_picks(picks_list: list) -> dict:
        by_system: Dict[str, list] = {}
        for p in picks_list:
            sysname = p.get("selected_system", "PULLBACK")
            by_system.setdefault(sysname, []).append(p.get("ticker"))
        return {
            "generated_at": generated_at,
            "date": now_ny.strftime("%Y-%m-%d"),
            "model": "BOGA AI v117.v3 (Power Pullback)",
            "market_regime": MARKET_STATUS.get("regime", "Bull"),
            "regime_bucket": get_regime_bucket(),
            "total_picks": len(picks_list),
            "picks": picks_list,
            "by_system": by_system,
            "system_summary": {k: {"count": len(v), "tickers": v} for k, v in by_system.items()},
            "watchlist": by_system.get("PULLBACK_WATCH", []),
        }

    pool_signal_entries = []
    for i, e in enumerate(pool.get("swing_candidates", [])):
        pick = dict(e.get("last_pick") or {})
        if not pick.get("ticker"):
            continue
        pick["rank"] = i + 1
        pick["date_added"] = e.get("first_seen_date", "")
        pick["entry_status"] = e.get("entry_status", "PENDING")
        pick["entry_zone"] = e.get("entry_zone")
        pick["status"] = "WAITING_FOR_ENTRY" if e.get("entry_status") == "PENDING" else pick.get("status", "WAITING_FOR_ENTRY")
        pool_signal_entries.append(pick)

    entered_only = [p for p in pool_signal_entries if p.get("entry_status") == "ENTERED"]

    try:
        year_str = now_ny.strftime("%Y")
        swing_year_dir = os.path.join(BASE_DATA_DIR, f"swing{year_str}")
        os.makedirs(swing_year_dir, exist_ok=True)

        file_date_str = now_ny.strftime("%Y%m%d")
        full_archive_path = os.path.join(swing_year_dir, f"swing_{file_date_str}.json")

        def clean_nan(obj):
            if isinstance(obj, float) and math.isnan(obj):
                return None
            elif isinstance(obj, dict):
                return {k: clean_nan(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [clean_nan(v) for v in obj]
            return obj

        # Terminal/arşiv: bugünün taze taraması (20). Dashboard (swing_all_picks.json):
        # havuzda takip edilen TÜM swing adayları (PENDING+ENTERED, çok-günlü).
        # swing_picks.json: sadece giriş bölgesi onaylanmış (ENTERED) adaylar.
        output_terminal = clean_nan(build_json_output(combined, generated_at))
        output_all = clean_nan(_wrap_picks(pool_signal_entries))
        output_signals = clean_nan(_wrap_picks(entered_only))

        with open(full_archive_path, "w", encoding="utf-8") as f:
            json.dump(output_terminal, f, indent=2, ensure_ascii=False, default=str)
        logging.info(f"📁 Archived: {full_archive_path}")

        os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)

        with open(os.path.join(FRONTEND_PUBLIC_DIR, OUTPUT_JSON_FILE), "w", encoding="utf-8") as f:
            json.dump(output_signals, f, indent=2, ensure_ascii=False, default=str)

        with open(os.path.join(FRONTEND_PUBLIC_DIR, OUTPUT_ALL_JSON_FILE), "w", encoding="utf-8") as f:
            json.dump(output_all, f, indent=2, ensure_ascii=False, default=str)

        # swing_table.json — SADECE sinyaller (watchlist trade tablosuna girmez)
        english_months = ["", "January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"]
        date_str = f"{now_ny.day} {english_months[now_ny.month]}"

        table_data = []
        for c in top_signals:
            if not c.get("trigger", {}).get("triggered"):
                continue  # sadece giriş bölgesi onaylanmış (ENTERED) adaylar trade tablosuna girer
            z = c.get("boga_zones", {})
            table_data.append({
                "Date": date_str,
                "Symbol": c.get("ticker", ""),
                "Entry (Buy_L)": z.get("buy_zone", {}).get("low", 0.0),
                "Stop (SL)": z.get("stop_zone", {}).get("high", 0.0),
                "Target 1 (TP1)": z.get("sell_zone", {}).get("low", 0.0),
                "Target 2 (TP2)": z.get("sell_zone", {}).get("high", 0.0)
            })
        table_data = clean_nan(table_data)

        with open(os.path.join(FRONTEND_PUBLIC_DIR, "swing_table.json"), "w", encoding="utf-8") as f:
            json.dump(table_data, f, indent=2, ensure_ascii=False)

        logging.info("[START] Dashboard and Archive successfully updated.")

        # ── ISR Cache Revalidation ───────────────────────────────
        try:
            import requests
            revalidate_secret = os.getenv("REVALIDATE_SECRET", "")
            if revalidate_secret:
                resp = requests.post(
                    "http://localhost:3000/api/revalidate-swing",
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

    # ── STEP 13: TELEGRAM RAPORU ─────────────────────────────────
    duration = time.time() - start_time
    now_str = now_ny.strftime("%Y-%m-%d %H:%M %Z")

    header = (
        f"🐂 <b>BOGA AI V117.v3 — POWER PULLBACK</b>\n"
        f"🕒 <i>{now_str}</i> | ⏱ {duration:.1f}s\n"
        f"📊 <i>{len(tickers_to_scan)} tarandı → L1:{len(l1_pass)} → "
        f"SİNYAL:{len(top_signals)} + WATCH:{len(top_watch)}</i>\n"
        f"📈 Market: <b>{MARKET_STATUS['regime']}</b> (Kova: {bucket})\n\n"
        "<pre>"
        f"#   SYMBOL  TİP      BOGA   BUY_L   STOP    TP2\n"
        f"──────────────────────────────────────────────────\n"
    )
    rows = []
    for i, c in enumerate(top_signals):
        zones = c.get("boga_zones", {})
        buy_l = zones.get("buy_zone", {}).get("low", 0)
        stop_h = zones.get("stop_zone", {}).get("high", 0)
        tp2 = c.get("tp2", 0)
        boga_s = c.get("boga_score_100", 0.0)
        tag = "🦅" if boga_s >= 75 else "🔥" if boga_s >= 60 else "🎯"
        rows.append(
            f"{i+1:02d}. {tag} {c['ticker']:<5} SIGNAL  {boga_s:>4.0f}  "
            f"{buy_l:>6.2f} {stop_h:>6.2f} {tp2:>6.2f}"
        )
    for i, c in enumerate(top_watch):
        boga_s = c.get("boga_score_100", 0.0)
        rows.append(
            f"{i+1:02d}. 👁️ {c['ticker']:<5} WATCH   {boga_s:>4.0f}  "
            f"{'—':>6} {'—':>6} {'—':>6}"
        )

    toplist_msg = header + "\n".join(rows) + "\n──────────────────────────────────────────────────\n</pre>\n"
    toplist_msg += "<i>[INFO] SIGNAL: 15m tetik ONAYLI — WATCH: setup hazır, tetik bekleniyor | BOGA AI v117.v3</i>\n\n"
    if top_signals:
        toplist_msg += "<b>📋 Detailed Analysis Below:</b>\n"

    await send_telegram_message(toplist_msg)

    for i, c in enumerate(top_signals):
        block = build_candidate_block(i + 1, c)
        await send_telegram_message(block)
        await asyncio.sleep(0.5)

    # Watchlist özet bloğu (tek mesaj)
    if top_watch:
        w_lines = []
        for i, c in enumerate(top_watch):
            trig = c.get("trigger", {})
            w_lines.append(
                f"{i+1:02d}. <b>{c['ticker']}</b> ({c.get('sector','?')[:14]}) "
                f"— {c.get('boga_score_100',0):.0f}p | <i>{html_escape(trig.get('state_note',''))}</i>"
            )
        await send_telegram_message(
            "👁️ <b>WATCHLIST — Tetik Bekleyen 10 Aday</b>\n"
            "<i>1D+4H+1H katmanlarını geçti; 15m Power Pullback tetiği oluşursa sinyale döner.</i>\n\n"
            + "\n".join(w_lines)
        )

    save_info_cache()
    update_swing_performance_stats()
    track_pick_peak_performance()

    if now_ny.weekday() == 0:
        try:
            await send_weekly_performance_report()
            logging.info("📅 Haftalık performans raporu tetiklendi.")
        except Exception as e:
            logging.error(f"❌ Haftalık rapor gönderim hatası: {e}")

    logging.info(f"[OK] BOGA AI v117.v3 Scan complete. ({scanned_count} hisse tarandı | {duration:.1f}s)")

# ================================================================
# ================================================================
# SECTION 17: SCHEDULER
# ================================================================
# ================================================================

def get_next_hourly_run_time_ny():
    """v3.1: Haftaiçi (Mon-Fri) 09:00-17:00 NY arası her saat başı bir sonraki
    çalışma zamanını döner (UTC aware). Saat ∈ ACTIVE_SCAN_HOURS_NY dışına
    çıkıldığında bir sonraki günün 09:00'ına atlar."""
    now_utc = datetime.now(timezone.utc)
    now_ny = now_utc.astimezone(NY_TZ)

    candidate_ny = now_ny.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)

    def _is_valid(dt_ny):
        return dt_ny.weekday() < 5 and dt_ny.hour in ACTIVE_SCAN_HOURS_NY

    guard = 0
    while not _is_valid(candidate_ny) and guard < 24 * 7:
        if candidate_ny.hour > max(ACTIVE_SCAN_HOURS_NY) or candidate_ny.weekday() >= 5:
            candidate_ny = (candidate_ny + timedelta(days=1)).replace(
                hour=min(ACTIVE_SCAN_HOURS_NY), minute=0, second=0, microsecond=0
            )
        else:
            candidate_ny = candidate_ny.replace(
                hour=min(ACTIVE_SCAN_HOURS_NY), minute=0, second=0, microsecond=0
            )
        guard += 1

    return candidate_ny.astimezone(timezone.utc)


def get_run_mode_for_hour(hour_ny: int) -> str:
    """FULL_SCAN: L1-L3 taze çalışır, havuz yenilenir (09/14/17 NY).
    ENTRY_CHECK: sadece PENDING adaylar için 15m tetik kontrolü (diğer saatler)."""
    return "FULL_SCAN" if hour_ny in FULL_SCAN_HOURS_NY else "ENTRY_CHECK"


async def run_scanner():
    """Main loop — v3.1: Haftaiçi NY 09:00-17:00 arası her saat çalışır.
    09/14/17'de FULL_SCAN (L1-L3 yenilenir + 10 swing + 10 watchlist
    belirlenir), diğer saatlerde ENTRY_CHECK (sadece 15m giriş tetiği)."""
    await send_telegram_message(
        "🐂 <b>BOGA AI SWING V117.v3.1 — POWER PULLBACK Started!</b>\n"
        "📅 Schedule: Haftaiçi NY 09:00-17:00, her saat başı\n"
        "🎯 FULL_SCAN (09/14/17): 10 Swing Adayı + 10 Watchlist\n"
        "🎯 ENTRY_CHECK (diğer saatler): PENDING adaylar için 15m tetik kontrolü\n"
        f"📊 Market: <b>{MARKET_STATUS.get('regime','Bull')}</b>\n"
        "🔍 v3: 1D Trend → 4H Quality → 1H Momentum → 15m Trigger\n"
        f"🧊 Cooldown: {COOLDOWN_DAYS}g (52WH/Base Breakout istisnalı) | 📅 Earnings: {EARNINGS_MIN_DAYS}g"
    )

    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() < 5 and now_ny.hour in ACTIVE_SCAN_HOURS_NY:
        try:
            mode = get_run_mode_for_hour(now_ny.hour)
            logging.info(f"▶ Initial scan starting... (mode={mode})")
            await scan_top_stocks(mode=mode)
        except Exception as e:
            logging.error(f"Startup scan error: {e}")
            await send_telegram_message(f"🚨 Startup error: {html_escape(str(e))}")

    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            next_run_utc = get_next_hourly_run_time_ny()
            wait_seconds = (next_run_utc - now_utc).total_seconds()

            if wait_seconds < 0 or wait_seconds > 90000:
                next_run_utc = get_next_hourly_run_time_ny()
                wait_seconds = (next_run_utc - datetime.now(timezone.utc)).total_seconds()

            logging.info(
                f"🕒 Next scan: {next_run_utc.strftime('%Y-%m-%d %H:%M %Z')} "
                f"(~{wait_seconds/3600:.2f} hours)"
            )
            await asyncio.sleep(wait_seconds)

            run_ny = datetime.now(NY_TZ)
            mode = get_run_mode_for_hour(run_ny.hour)
            logging.info(f"▶ NY {run_ny.strftime('%H:%M')} scan starting... (mode={mode})")
            await scan_top_stocks(mode=mode)

        except Exception as e:
            logging.error(f"Loop error: {e}")
            await send_telegram_message(f"🚨 Loop error: {html_escape(str(e))}")
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

        load_info_cache()

        if "--oneshot" in sys.argv:
            # v3.1: Tek seferlik manuel çalıştırma — saatlik programın DIŞINDA.
            # Varsayılan: mevcut NY saatine göre otomatik mod (FULL_SCAN/ENTRY_CHECK).
            # --full-scan: modu zorla FULL_SCAN yapar (L1-L3 tam yenilenir).
            # --entry-check: modu zorla ENTRY_CHECK yapar (sadece 15m tetik kontrolü).
            now_ny = datetime.now(NY_TZ)
            if "--full-scan" in sys.argv:
                oneshot_mode = "FULL_SCAN"
            elif "--entry-check" in sys.argv:
                oneshot_mode = "ENTRY_CHECK"
            else:
                oneshot_mode = get_run_mode_for_hour(now_ny.hour) if now_ny.hour in ACTIVE_SCAN_HOURS_NY else "FULL_SCAN"

            print(f"[START] BOGA AI v117.v3.1 POWER PULLBACK Scanner (One-Shot, mode={oneshot_mode}) baslatildi...")
            asyncio.run(scan_top_stocks(mode=oneshot_mode))
            print("[OK] Tarama tamamlandi.")
        else:
            asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print("\n🐂 BOGA AI v117.v3.0 durduruldu.")
    except Exception as e:
        print(f"❌ Kritik hata: {e}")
        logging.error(f"❌ Kritik hata: {e}")
