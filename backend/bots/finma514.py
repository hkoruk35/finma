"""
finma514.py — FinMA AI Analytics Engine | Faz 1 Scoring Bot
─────────────────────────────────────────────────────────────
Pipeline : 8.000+ US hisse → 200 shortlist → 54 seçim (5 kategori)
Çalışma  : Hafta içi NY 06:30 + 12:00 (Yahoo Finance local)
Çıktı    : JSON (finma514_latest.json + arşiv)
─────────────────────────────────────────────────────────────
Scoring (0-100):
  Trend    (30p): EMA20 > EMA50 +15  | MACD > signal +15
  Volume   (25p): RVOL > 1.5 +15    | OBV 5g ↑ +10
  Momentum (32p): RSI 40-65 +20     | ADX > 25 +12
  Context  (13p): Sektör ETF > SPY (5g) +13
─────────────────────────────────────────────────────────────
Tier : 90+ STRONG | 75-89 HIGH | 60-74 WATCH | <60 IGNORE
─────────────────────────────────────────────────────────────
Kategoriler (overlap korumalı):
  CORE      (20) : En yüksek composite skor
  SECTOR   (~14) : Her GICS sektöründen 1 lider
  VOLUME    (7)  : En yüksek RVOL
  GAINER    (7)  : En yüksek günlük % kazanç
  LOSER     (7)  : RSI < 30 + günlük düşüş liderleri
─────────────────────────────────────────────────────────────
⚠ YASAL NOT: Bu bot yatırım tavsiyesi üretmez.
  Tüm çıktılar bilgilendirme amaçlıdır.
"""

# ================================================================
# IMPORTS
# ================================================================

import asyncio
import logging
import json
import argparse
import time
import random
import os
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

import aiohttp
import numpy as np
import pandas as pd
import yfinance as yf

from zoneinfo import ZoneInfo
from ta.trend import EMAIndicator, ADXIndicator, MACD
from ta.volatility import AverageTrueRange, BollingerBands
from ta.volume import OnBalanceVolumeIndicator
from ta.momentum import RSIIndicator


# ================================================================
# BÖLÜM 1 — LOG & TEMEL AYARLAR
# ================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

NY_TZ = ZoneInfo("America/New_York")

# ─── Günlük iki tarama saati (NY) ──────────────────────────────
DAILY_RUNS = [
    {"hour": 6,  "minute": 30},   # 06:30 — Piyasa öncesi
    {"hour": 12, "minute": 0},    # 12:00 — Piyasa ortası
]
WEEKDAY_SET = {0, 1, 2, 3, 4}    # Pazartesi–Cuma

# ─── L1 Universe Filtreleme ─────────────────────────────────────
PRICE_MIN       = 2.0
PRICE_MAX       = 5_000.0
MIN_AVG_VOLUME  = 500_000          # 500K lot
MIN_MARKET_CAP  = 50_000_000       # $50M
UNIVERSE_TTL    = 24 * 3600        # 24 saat cache
MAX_SHORTLIST   = 200              # L1 → L2 geçiş sayısı
UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}

# ─── Scoring Eşikleri ───────────────────────────────────────────
TIER_STRONG = 90
TIER_HIGH   = 75
TIER_WATCH  = 60

# ─── Kategori Boyutları ─────────────────────────────────────────
CORE_SIZE   = 20
SECTOR_SIZE = 14   # max (11 GICS + 3 esnek)
VOLUME_SIZE = 7
GAINER_SIZE = 7
LOSER_SIZE  = 7

# ─── Teknik Parametreler ────────────────────────────────────────
ATR_PERIOD      = 14
LOOKBACK_DAYS   = 200
RVOL_THRESHOLD  = 1.5   # Volume scoring
ADX_THRESHOLD   = 25    # Momentum scoring
RSI_BULL_LOW    = 40    # RSI bant alt
RSI_BULL_HIGH   = 65    # RSI bant üst

# ─── Output ─────────────────────────────────────────────────────
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
BOT_NAME   = "finma514"

# ─── Sektör ETF Haritası ────────────────────────────────────────
SECTOR_ETF_MAP: Dict[str, str] = {
    "Technology":             "XLK",
    "Energy":                 "XLE",
    "Financial Services":     "XLF",
    "Financials":             "XLF",
    "Healthcare":             "XLV",
    "Consumer Cyclical":      "XLY",
    "Consumer Discretionary": "XLY",
    "Industrials":            "XLI",
    "Utilities":              "XLU",
    "Basic Materials":        "XLB",
    "Materials":              "XLB",
    "Real Estate":            "XLRE",
    "Consumer Defensive":     "XLP",
    "Consumer Staples":       "XLP",
    "Communication Services": "XLC",
}

INDEX_BENCHMARK = "^GSPC"

# ─── Sembol Kaynakları ──────────────────────────────────────────
EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
    "https://raw.githubusercontent.com/shilewenuw/get_all_tickers/master/get_all_tickers/tickers.csv",
]

# ─── Global Durum ───────────────────────────────────────────────
MARKET_STATUS:    Dict[str, Any]   = {"regime": "BULLISH", "vix": 0.0}
SECTOR_PERF:      Dict[str, float] = {}   # Sektör ETF vs SPY 5g rel. performans
INDEX_CACHE:      Dict[str, pd.Series] = {}
STOCK_INFO_CACHE: Dict[str, dict]  = {}


# ================================================================
# BÖLÜM 2 — UNIVERSE BUILDER (L1: 8000+ → 200)
# ================================================================

async def fetch_all_us_tickers() -> List[str]:
    """NASDAQ + NYSE + AMEX borsalarından ham sembol listesi çeker."""
    all_tickers: set[str] = set()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    async with aiohttp.ClientSession() as session:
        for url in EXCHANGE_SOURCES:
            market = url.split("/")[-2].upper()
            try:
                async with session.get(url, headers=headers, timeout=15) as resp:
                    if resp.status != 200:
                        logging.warning(f"Sembol kaynağı {market}: HTTP {resp.status}")
                        continue
                    content = await resp.text()
                    for sym in content.splitlines():
                        sym = sym.strip().upper()
                        if sym.isalpha() and 1 <= len(sym) <= 5:
                            all_tickers.add(sym)
                    logging.info(f"Kaynak {market}: toplam {len(all_tickers)} sembol")
            except Exception as e:
                logging.warning(f"Sembol kaynağı {market} hatası: {e}")

    logging.info(f"Ham sembol sayısı: {len(all_tickers)}")
    return list(all_tickers)


async def build_finma_universe() -> List[str]:
    """
    8.000+ ham sembol → MAX_SHORTLIST shortlist.

    AŞAMA 1 : Toplu OHLCV indirme (chunk = 500, period = 40d)
    AŞAMA 2 : Vektörel filtreleme
              — Fiyat: $2–$5000
              — Avg Vol (20g) ≥ 500K lot
              — RVOL (5g/30g) ≥ 0.8
    AŞAMA 3 : Sıralama (RVOL × DollarVol) → Top 200
    """
    now = time.time()

    if UNIVERSE_CACHE["data"] and (now - UNIVERSE_CACHE["ts"] < UNIVERSE_TTL):
        logging.info(f"Universe cache'den alındı ({len(UNIVERSE_CACHE['data'])} hisse)")
        return UNIVERSE_CACHE["data"]

    raw_list = await fetch_all_us_tickers()
    if not raw_list:
        logging.error("Ham sembol listesi alınamadı.")
        return []

    logging.info(f"{len(raw_list)} sembol için toplu OHLCV indirmesi başlıyor (chunk=500, 40d)...")

    CHUNK  = 500
    PERIOD = "40d"
    all_rows: List[dict] = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"  İndiriliyor: {i}–{i + len(chunk)} / {len(raw_list)}")

        try:
            data = await asyncio.to_thread(
                yf.download,
                chunk,
                period=PERIOD,
                progress=False,
                threads=False,
                ignore_tz=True,
                group_by="ticker",
            )

            if not isinstance(data.columns, pd.MultiIndex):
                if len(chunk) == 1:
                    sym = chunk[0]
                    data.columns = pd.MultiIndex.from_tuples(
                        [(sym, c) for c in data.columns]
                    )
                else:
                    continue

            tickers_in = data.columns.get_level_values(0).unique().tolist()

            for sym in tickers_in:
                try:
                    close  = data[sym]["Close"].dropna()
                    volume = data[sym]["Volume"].dropna()

                    if len(close) < 6 or len(volume) < 6:
                        continue

                    last_price  = float(close.iloc[-1])
                    avg_vol_5   = float(volume.tail(5).mean())
                    avg_vol_20  = float(volume.tail(20).mean()) if len(volume) >= 20 else avg_vol_5
                    avg_vol_30  = float(volume.tail(30).mean()) if len(volume) >= 30 else avg_vol_20

                    # L1 Filtreler
                    if not (PRICE_MIN <= last_price <= PRICE_MAX):
                        continue
                    if avg_vol_20 < MIN_AVG_VOLUME:
                        continue

                    rvol = (avg_vol_5 / avg_vol_30) if avg_vol_30 > 0 else 0.0
                    if rvol < 0.8:
                        continue

                    dollar_vol = last_price * avg_vol_20

                    all_rows.append({
                        "sym":        sym,
                        "price":      last_price,
                        "avg_vol_20": avg_vol_20,
                        "rvol":       rvol,
                        "dollar_vol": dollar_vol,
                        "rank_score": rvol * dollar_vol,
                    })

                except Exception:
                    continue

        except Exception as e:
            logging.warning(f"Chunk {i} indirme hatası: {e}")
            continue

    if not all_rows:
        logging.error("Vektörel filtre sonrası hiç hisse kalmadı.")
        return []

    all_rows.sort(key=lambda r: r["rank_score"], reverse=True)
    selected = [r["sym"] for r in all_rows[:MAX_SHORTLIST]]

    logging.info(
        f"Universe hazır: {len(selected)} hisse seçildi "
        f"({len(all_rows)} filtre geçti, {len(raw_list)} içinden)"
    )

    UNIVERSE_CACHE["ts"]   = now
    UNIVERSE_CACHE["data"] = selected

    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        upath = os.path.join(OUTPUT_DIR, "finma514_universe.txt")
        with open(upath, "w", encoding="utf-8") as f:
            for s in selected:
                f.write(f"{s}\n")
        logging.info(f"Universe dosyası güncellendi → {upath}")
    except Exception:
        pass

    return selected


# ================================================================
# BÖLÜM 3 — PİYASA REJİMİ & SEKTÖR ANALİZİ
# ================================================================

async def analyze_market_regime():
    """SPY EMA50/200 + VIX → piyasa rejimi tespiti."""
    global MARKET_STATUS
    try:
        spy_df = await asyncio.to_thread(
            lambda: yf.Ticker("SPY").history(period="1y")
        )
        vix_df = await asyncio.to_thread(
            lambda: yf.Ticker("^VIX").history(period="5d")
        )

        if spy_df.empty or vix_df.empty:
            logging.warning("SPY/VIX verisi alınamadı, rejim belirsiz.")
            return

        close  = spy_df["Close"]
        vix    = float(vix_df["Close"].iloc[-1])
        price  = float(close.iloc[-1])
        ema200 = float(EMAIndicator(close, 200).ema_indicator().iloc[-1])
        ema50  = float(EMAIndicator(close, 50).ema_indicator().iloc[-1])

        MARKET_STATUS["vix"] = round(vix, 1)

        if price > ema50 > ema200 and vix < 20:
            MARKET_STATUS["regime"] = "STRONG"
        elif price > ema200 and vix < 25:
            MARKET_STATUS["regime"] = "BULLISH"
        elif price > ema200:
            MARKET_STATUS["regime"] = "CHOPPY"
        elif 25 <= vix < 35:
            MARKET_STATUS["regime"] = "HIGH_VOL"
        else:
            MARKET_STATUS["regime"] = "WEAK"

        logging.info(
            f"Piyasa Rejimi: {MARKET_STATUS['regime']} | "
            f"SPY: ${price:.1f} | EMA200: ${ema200:.1f} | VIX: {vix:.1f}"
        )

    except Exception as e:
        logging.warning(f"Market regime hatası: {e}")


async def analyze_sector_performance():
    """Her sektör ETF'inin 5g performansını SPY ile kıyaslar (relative)."""
    global SECTOR_PERF
    try:
        spy_df = await asyncio.to_thread(
            lambda: yf.Ticker("SPY").history(period="8d")
        )
        if spy_df.empty or len(spy_df) < 2:
            return

        spy_chg = float(
            (spy_df["Close"].iloc[-1] - spy_df["Close"].iloc[0])
            / spy_df["Close"].iloc[0] * 100
        )

        unique_etfs = set(SECTOR_ETF_MAP.values())
        for etf in unique_etfs:
            try:
                df = await asyncio.to_thread(
                    lambda e=etf: yf.Ticker(e).history(period="8d")
                )
                if len(df) < 2:
                    continue
                chg = float(
                    (df["Close"].iloc[-1] - df["Close"].iloc[0])
                    / df["Close"].iloc[0] * 100
                )
                rel = chg - spy_chg   # SPY'a göre rölatif performans
                for sector, e in SECTOR_ETF_MAP.items():
                    if e == etf:
                        SECTOR_PERF[sector] = round(rel, 2)
            except Exception:
                continue

        hot = sorted(SECTOR_PERF.items(), key=lambda x: x[1], reverse=True)[:3]
        logging.info(
            f"Hot sektörler: "
            + " | ".join(f"{s[0]} ({s[1]:+.1f}%)" for s in hot)
        )

    except Exception as e:
        logging.warning(f"Sektör analizi hatası: {e}")


# ================================================================
# BÖLÜM 4 — VERİ ÇEKİCİLER
# ================================================================

def get_stock_data(ticker: str, interval: str = "1d") -> Optional[pd.DataFrame]:
    """
    Yahoo Finance veri çekici — retry + exponential backoff + rate limit koruması.
    interval: '1d' (250 günlük) | '1h' (7 günlük)
    """
    MAX_RETRIES = 3
    period_map  = {"1d": "250d", "1h": "7d"}
    min_bars    = {"1d": 50,     "1h": 10}

    t     = ticker.strip().upper()
    stock = yf.Ticker(t)

    for attempt in range(MAX_RETRIES):
        wait = random.uniform(3.0, 6.0) + (30.0 * attempt if attempt > 0 else 0.0)
        if attempt > 0:
            logging.info(f"  {t} retry {attempt}/{MAX_RETRIES} — {wait:.0f}s bekleniyor")
        time.sleep(wait)

        try:
            df = stock.history(
                period=period_map.get(interval, "250d"),
                interval=interval,
                auto_adjust=True,
                timeout=15,
            )
        except Exception as e:
            if "Too Many Requests" in str(e) and attempt < MAX_RETRIES - 1:
                continue
            return None

        if df is None or df.empty:
            if attempt < MAX_RETRIES - 1:
                continue
            return None

        df.columns = [c.capitalize() for c in df.columns]
        df = df.dropna()

        if interval == "1d":
            if len(df) < min_bars["1d"]:
                return None
            df = df.tail(LOOKBACK_DAYS)
        elif interval == "1h":
            if len(df) < min_bars["1h"]:
                return None

        return df

    return None


def get_stock_info(ticker: str) -> dict:
    """
    Yahoo Finance info: company_name, sector, market_cap, beta, industry, exchange.
    Cache'li — aynı hisse için tekrar çekilmez.
    """
    t = ticker.strip().upper()
    if t in STOCK_INFO_CACHE:
        return STOCK_INFO_CACHE[t]

    try:
        info = yf.Ticker(t).info or {}
        result = {
            "market_cap":   int(info.get("marketCap", 0) or 0),
            "sector":       str(info.get("sector", "Unknown") or "Unknown"),
            "company_name": str(info.get("longName", t) or t),
            "beta":         float(info.get("beta", 1.0) or 1.0),
            "industry":     str(info.get("industry", "") or ""),
            "exchange":     str(info.get("exchange", "") or ""),
        }
    except Exception:
        result = {
            "market_cap":   0,
            "sector":       "Unknown",
            "company_name": t,
            "beta":         1.0,
            "industry":     "",
            "exchange":     "",
        }

    STOCK_INFO_CACHE[t] = result
    return result


def get_index_series(symbol: str = INDEX_BENCHMARK) -> Optional[pd.Series]:
    """Benchmark endeks kapanış serisini cache'ler."""
    symbol = symbol.upper()
    if symbol in INDEX_CACHE:
        return INDEX_CACHE[symbol]
    df = get_stock_data(symbol, "1d")
    if df is None:
        return None
    INDEX_CACHE[symbol] = df["Close"]
    return INDEX_CACHE[symbol]


# ================================================================
# BÖLÜM 5 — SCORING ENGINE (0–100 puan, 4 bileşen)
# ================================================================

def score_trend(df_1d: pd.DataFrame) -> dict:
    """
    Trend Skoru (max 30p):
      EMA20 > EMA50         → +15p
      MACD çizgi > sinyal   → +15p
    """
    close = df_1d["Close"]
    pts   = 0
    det   = {}

    # EMA20 vs EMA50
    try:
        ema20 = float(EMAIndicator(close, 20).ema_indicator().iloc[-1])
        ema50 = float(EMAIndicator(close, 50).ema_indicator().iloc[-1])
        det.update({"ema20": round(ema20, 2), "ema50": round(ema50, 2)})
        if ema20 > ema50:
            pts += 15
            det["ema_bull"] = True
        else:
            det["ema_bull"] = False
    except Exception:
        det.update({"ema20": 0.0, "ema50": 0.0, "ema_bull": False})

    # EMA200 (bilgi amaçlı)
    try:
        det["ema200"] = round(
            float(EMAIndicator(close, 200).ema_indicator().iloc[-1]), 2
        )
    except Exception:
        det["ema200"] = 0.0

    # MACD çizgi > sinyal
    try:
        macd_obj = MACD(close)
        ml       = float(macd_obj.macd().iloc[-1])
        ms       = float(macd_obj.macd_signal().iloc[-1])
        det.update({"macd_line": round(ml, 4), "macd_signal": round(ms, 4)})
        if ml > ms:
            pts += 15
            det["macd_bull"] = True
        else:
            det["macd_bull"] = False
    except Exception:
        det.update({"macd_line": 0.0, "macd_signal": 0.0, "macd_bull": False})

    return {"score": pts, "max": 30, "details": det}


def score_volume(df_1d: pd.DataFrame) -> dict:
    """
    Volume Skoru (max 25p):
      RVOL ≥ 1.5            → +15p  (1.2–1.5 arası → +8p)
      OBV 5 gün yükselen    → +10p
    """
    close  = df_1d["Close"]
    volume = df_1d["Volume"]
    pts    = 0
    det    = {}

    # RVOL (5g / 20g)
    try:
        avg5  = float(volume.tail(5).mean())
        avg20 = float(volume.tail(20).mean()) if len(volume) >= 20 else avg5
        rvol  = avg5 / avg20 if avg20 > 0 else 1.0
        det["rvol"] = round(rvol, 2)
        if rvol >= RVOL_THRESHOLD:
            pts += 15
        elif rvol >= 1.2:
            pts += 8
    except Exception:
        det["rvol"] = 0.0

    # OBV 5 gün yükselen mi?
    try:
        obv      = OnBalanceVolumeIndicator(close, volume).on_balance_volume()
        tail     = obv.tail(6).values
        rising   = bool(len(tail) >= 2 and tail[-1] > tail[0])
        det["obv_rising"] = rising
        if rising:
            pts += 10
    except Exception:
        det["obv_rising"] = False

    return {"score": pts, "max": 25, "details": det}


def score_momentum(df_1d: pd.DataFrame) -> dict:
    """
    Momentum Skoru (max 32p):
      RSI 40–65 bölgesi     → +20p  (65–75 → +10p)
      ADX ≥ 25              → +12p  (20–25 → +6p)
    """
    close = df_1d["Close"]
    high  = df_1d["High"]
    low   = df_1d["Low"]
    pts   = 0
    det   = {}

    # RSI
    try:
        rsi = float(RSIIndicator(close, 14).rsi().iloc[-1])
        det["rsi"] = round(rsi, 1)
        if RSI_BULL_LOW <= rsi <= RSI_BULL_HIGH:
            pts += 20
        elif RSI_BULL_HIGH < rsi <= 75:
            pts += 10
        # RSI < 30 = oversold → LOSER kategorisi için ayrıca bakılır
    except Exception:
        det["rsi"] = 50.0

    # ADX
    try:
        adx = float(ADXIndicator(high, low, close, 14).adx().iloc[-1])
        det["adx"] = round(adx, 1)
        if adx >= ADX_THRESHOLD:
            pts += 12
        elif adx >= 20:
            pts += 6
    except Exception:
        det["adx"] = 0.0

    return {"score": pts, "max": 32, "details": det}


def score_context(ticker: str, sector: str) -> dict:
    """
    Context Skoru (max 13p):
      Sektör ETF son 5g SPY'ı geçmişse → +13p
    """
    pts = 0
    det = {}

    rel = SECTOR_PERF.get(sector, 0.0)
    det["sector"]           = sector
    det["sector_vs_spy_5g"] = round(rel, 2)

    if rel > 0:
        pts += 13

    return {"score": pts, "max": 13, "details": det}


def classify_tier(total: int) -> str:
    if total >= TIER_STRONG:
        return "STRONG"
    if total >= TIER_HIGH:
        return "HIGH"
    if total >= TIER_WATCH:
        return "WATCH"
    return "IGNORE"


def compute_full_score(df_1d: pd.DataFrame, ticker: str, sector: str) -> dict:
    """
    4 alt skoru hesaplar → toplam (0-100) + tier + tüm indikatörler.
    """
    t = score_trend(df_1d)
    v = score_volume(df_1d)
    m = score_momentum(df_1d)
    c = score_context(ticker, sector)

    total = t["score"] + v["score"] + m["score"] + c["score"]
    tier  = classify_tier(total)

    indicators: dict = {}
    for d in [t["details"], v["details"], m["details"], c["details"]]:
        indicators.update(d)

    return {
        "score":      total,
        "tier":       tier,
        "breakdown": {
            "trend":    t["score"],
            "volume":   v["score"],
            "momentum": m["score"],
            "context":  c["score"],
        },
        "indicators": indicators,
    }


# ================================================================
# BÖLÜM 6 — PER-STOCK TAM TEKNİK ANALİZ
# ================================================================

def _interest_zone(df_1d: pd.DataFrame) -> tuple:
    """Son 20 günün volume profile POC'unu hesaplar (±0.5 ATR bant)."""
    try:
        data      = df_1d.tail(20)
        pmin      = float(data["Low"].min())
        pmax      = float(data["High"].max())
        bins      = np.linspace(pmin, pmax, 20)
        vdist     = np.zeros(19)

        for i in range(len(data)):
            row = data.iloc[i]
            for b in range(19):
                if bins[b] <= float(row["Close"]) < bins[b + 1]:
                    vdist[b] += float(row["Volume"])
                    break

        poc_idx = vdist.argmax()
        poc     = (bins[poc_idx] + bins[poc_idx + 1]) / 2

        atr_s = AverageTrueRange(
            data["High"], data["Low"], data["Close"], ATR_PERIOD
        ).average_true_range()
        atr = float(atr_s.iloc[-1]) if not atr_s.empty else (pmax - pmin) / 10

        return round(poc - atr * 0.5, 2), round(poc + atr * 0.5, 2)

    except Exception:
        p = float(df_1d["Close"].iloc[-1])
        return round(p * 0.98, 2), round(p * 1.02, 2)


def full_stock_analysis(ticker: str) -> Optional[dict]:
    """
    Tek hisse için tam teknik analiz + skorlama.
    Dönüş: tüm metrikler içeren dict (None = elendi).
    """
    try:
        df_1d = get_stock_data(ticker, "1d")
        if df_1d is None or len(df_1d) < 50:
            return None

        # İlk sektör bilgisi cache'ten (veya Unknown)
        cached = STOCK_INFO_CACHE.get(ticker, {})
        sector = cached.get("sector", "Unknown")

        # Scoring
        scored = compute_full_score(df_1d, ticker, sector)
        inds   = scored["indicators"]

        close  = df_1d["Close"]
        volume = df_1d["Volume"]
        high   = df_1d["High"]
        low    = df_1d["Low"]
        curr   = float(close.iloc[-1])

        # Fiyat değişimleri
        def pct(n: int) -> float:
            if len(close) > n:
                return round(float((close.iloc[-1] - close.iloc[-n]) / close.iloc[-n] * 100), 2)
            return 0.0

        change_1d = pct(2)
        change_5d = pct(6)
        change_1m = pct(22)

        # ATR
        try:
            atr_s   = AverageTrueRange(high, low, close, ATR_PERIOD).average_true_range()
            atr_val = float(atr_s.iloc[-1])
            atr_pct = round(atr_val / curr * 100, 2) if curr > 0 else 2.0
        except Exception:
            atr_val = curr * 0.02
            atr_pct = 2.0

        # Bollinger Width
        try:
            bb       = BollingerBands(close, 20, 2)
            bb_width = round(
                (float(bb.bollinger_hband().iloc[-1]) - float(bb.bollinger_lband().iloc[-1]))
                / curr * 100, 2
            ) if curr > 0 else 0.0
        except Exception:
            bb_width = 0.0

        # TP / SL
        stop_loss = round(curr - 1.5 * atr_val, 2)
        target_1  = round(curr + 1.8 * atr_val, 2)
        target_2  = round(curr + 2.5 * atr_val, 2)

        # Interest zone (volume profile POC)
        iz_low, iz_high = _interest_zone(df_1d)

        return {
            # Kimlik
            "ticker":       ticker,
            "company_name": cached.get("company_name", ticker),
            "sector":       sector,
            "industry":     cached.get("industry", ""),
            "exchange":     cached.get("exchange", ""),
            "market_cap":   cached.get("market_cap", 0),
            "beta":         cached.get("beta", 1.0),
            # Scoring
            "score":     scored["score"],
            "tier":      scored["tier"],
            "breakdown": scored["breakdown"],
            # Fiyat
            "price":     round(curr, 2),
            "change_1d": change_1d,
            "change_5d": change_5d,
            "change_1m": change_1m,
            # Teknik indikatörler
            "rvol":      inds.get("rvol", 0.0),
            "rsi":       inds.get("rsi", 50.0),
            "adx":       inds.get("adx", 0.0),
            "atr_pct":   atr_pct,
            "bb_width":  bb_width,
            "ema20":     inds.get("ema20", 0.0),
            "ema50":     inds.get("ema50", 0.0),
            "ema200":    inds.get("ema200", 0.0),
            # Trade seviyeleri
            "interest_zone": f"{iz_low} - {iz_high}",
            "stop_loss":     stop_loss,
            "target_1":      target_1,
            "target_2":      target_2,
            # Raw data (grafik & derin analiz için — JSON'a dahil edilmez)
            "_df_1d": df_1d,
        }

    except Exception as e:
        logging.debug(f"{ticker} analiz hatası: {e}")
        return None


# ================================================================
# BÖLÜM 7 — 54 HİSSE SEÇİMİ + OVERLAP KORUMA
# ================================================================

def select_54_stocks(analyzed: List[dict]) -> dict:
    """
    5 kategorili 54 hisse seçimi.
    Overlap koruması: Her hisse yalnızca 1 kategoride yer alır.
    Öncelik sırası: CORE → SECTOR → VOLUME → GAINER → LOSER
    """
    if not analyzed:
        return {}

    # IGNORE hariç eligible (score ≥ WATCH eşiği)
    eligible = [s for s in analyzed if s["score"] >= TIER_WATCH]
    eligible.sort(key=lambda x: x["score"], reverse=True)

    assigned: set = set()

    # ─── CORE (20): En yüksek skor ──────────────────────────────
    core_picks = []
    for s in eligible:
        if len(core_picks) >= CORE_SIZE:
            break
        core_picks.append({**s, "tag": "CORE"})
        assigned.add(s["ticker"])

    remaining = [s for s in eligible if s["ticker"] not in assigned]

    # ─── SECTOR (~14): Her sektörden 1 lider; yetmezse puana göre doldur ───
    seen_sectors: set = set()
    sector_leaders = []

    # 1. Geçiş: benzersiz sektör başına 1 hisse
    for s in remaining:
        if len(sector_leaders) >= SECTOR_SIZE:
            break
        sec = s.get("sector", "Unknown")
        if sec not in seen_sectors:
            sector_leaders.append({**s, "tag": "SECTOR"})
            seen_sectors.add(sec)
            assigned.add(s["ticker"])

    # 2. Geçiş: pazar unique sektör sayısı 14'ün altındaysa,
    #           kalan slotları en yüksek puanlı hisselerle tamamla
    if len(sector_leaders) < SECTOR_SIZE:
        remaining2 = [s for s in eligible if s["ticker"] not in assigned]
        for s in remaining2:
            if len(sector_leaders) >= SECTOR_SIZE:
                break
            sector_leaders.append({**s, "tag": "SECTOR"})
            assigned.add(s["ticker"])

    remaining = [s for s in eligible if s["ticker"] not in assigned]

    # ─── VOLUME (7): En yüksek RVOL ─────────────────────────────
    by_rvol   = sorted(remaining, key=lambda x: x.get("rvol", 0.0), reverse=True)
    high_vol  = []
    for s in by_rvol:
        if len(high_vol) >= VOLUME_SIZE:
            break
        high_vol.append({**s, "tag": "VOLUME"})
        assigned.add(s["ticker"])

    remaining = [s for s in eligible if s["ticker"] not in assigned]

    # ─── GAINER (7): En yüksek günlük % kazanç ──────────────────
    by_gain     = sorted(remaining, key=lambda x: x.get("change_1d", 0.0), reverse=True)
    top_gainers = []
    for s in by_gain:
        if len(top_gainers) >= GAINER_SIZE:
            break
        top_gainers.append({**s, "tag": "GAINER"})
        assigned.add(s["ticker"])

    # ─── LOSER (7): RSI<30 + günlük düşüş (TÜM analiz edilenlerden) ─
    all_unassigned = [s for s in analyzed if s["ticker"] not in assigned]
    oversold       = [s for s in all_unassigned if s.get("rsi", 50.0) < 30]
    oversold.sort(key=lambda x: x.get("change_1d", 0.0))  # en büyük düşüş önce
    oversold_losers = []
    for s in oversold:
        if len(oversold_losers) >= LOSER_SIZE:
            break
        oversold_losers.append({**s, "tag": "LOSER"})
        assigned.add(s["ticker"])

    total = (
        len(core_picks) + len(sector_leaders) +
        len(high_vol)   + len(top_gainers) +
        len(oversold_losers)
    )

    logging.info(
        f"54 Seçim tamamlandı → "
        f"CORE:{len(core_picks)} | SECTOR:{len(sector_leaders)} | "
        f"VOLUME:{len(high_vol)} | GAINER:{len(top_gainers)} | "
        f"LOSER:{len(oversold_losers)} | TOPLAM:{total}"
    )

    return {
        "core_picks":      core_picks,
        "sector_leaders":  sector_leaders,
        "high_volume":     high_vol,
        "top_gainers":     top_gainers,
        "oversold_losers": oversold_losers,
    }


# ================================================================
# BÖLÜM 8 — LEGAL-SAFE AI METİN ŞABLONLARI
# ================================================================

# Yasak ifadeler — mevcut veya değiştirilen metin içinde olmamalı
_FORBIDDEN = [
    "buy", "sell", "strong buy", "enter now", "guaranteed",
    "exact target", "kesinlikle al", "sat", "satin al",
    "kesin kar", "emir ver", "al şimdi", "hemen gir",
]


def _guard(text: str) -> str:
    """Yasak kelimeleri tespit et ve temizle (tam kelime eşleşmesi)."""
    import re
    for w in _FORBIDDEN:
        # \b kelime sınırı — 'sat' kelimesinin 'satım', 'satış' gibi
        # Türkçe türevlerinde yanlış tetiklenmesini önler
        pattern = r'\b' + re.escape(w) + r'\b'
        if re.search(pattern, text, flags=re.IGNORECASE | re.UNICODE):
            logging.warning(f"Legal-safe ihlali: '{w}' tespit edildi — temizleniyor")
            text = re.sub(pattern, "[—]", text, flags=re.IGNORECASE | re.UNICODE)
    return text


def generate_ai_text(stock: dict) -> dict:
    """
    Teknik indikatörlere dayalı, legal-safe Türkçe metin şablonları üretir.
    ─────────────────────────────────────────────────────────────────
    ⚠ ZORUNLU DİL KURALI:
      Yasak  : buy / sell / al / sat / kesin / guaranteed / enter now
      Zorunlu: olası / izlenebilir / mümkün / bazı yatırımcılar /
               tercih edebilir / senaryo / bölge / yapı / gözlemleniyor
    ─────────────────────────────────────────────────────────────────
    Gemini API entegrasyonuna hazır: _generated_by = "template_v1"
    Bu alanlar Gemini entegre edildiğinde API yanıtıyla değiştirilecek.
    """
    ticker = stock.get("ticker", "")
    price  = stock.get("price", 0.0)
    score  = stock.get("score", 0)
    tier   = stock.get("tier", "WATCH")
    rsi    = stock.get("rsi", 50.0)
    adx    = stock.get("adx", 0.0)
    rvol   = stock.get("rvol", 1.0)
    atr_p  = stock.get("atr_pct", 2.0)
    c1d    = stock.get("change_1d", 0.0)
    c5d    = stock.get("change_5d", 0.0)
    ema20  = stock.get("ema20", price)
    ema50  = stock.get("ema50", price)
    tp1    = stock.get("target_1", price)
    tp2    = stock.get("target_2", price)
    sl     = stock.get("stop_loss", price)
    iz     = stock.get("interest_zone", f"{price*0.98:.2f} - {price*1.02:.2f}")
    tag    = stock.get("tag", "CORE")
    sector = stock.get("sector", "")

    # ─── Hacim tanımı ────────────────────────────────────────────
    if rvol >= 2.0:
        vol_desc = "son dönemde belirgin biçimde artan işlem hacmi dikkat çekiyor"
    elif rvol >= 1.5:
        vol_desc = "ortalama üzerinde hacim akışı gözlemleniyor"
    else:
        vol_desc = "hacim seyri normal seyrini korumakta"

    # ─── Trend tanımı ────────────────────────────────────────────
    if ema20 > ema50:
        trend_desc = "kısa vadeli ortalamaların uzun vadeli ortalamaların üzerinde konumlandığı görülüyor"
    else:
        trend_desc = "kısa vadeli ortalamaların yapısal baskı altında seyrettiği izleniyor"

    # ─── ATR volatilite tanımı ───────────────────────────────────
    if atr_p < 2.5:
        vol_level = "sınırlı"
    elif atr_p < 4.5:
        vol_level = "ılımlı"
    else:
        vol_level = "belirgin"

    # ─── 1. Market Context ───────────────────────────────────────
    market_context = _guard(
        f"{ticker} hissesinde {vol_desc}. "
        f"Günlük bazda yaklaşık %{abs(c1d):.1f} "
        f"{'artış' if c1d >= 0 else 'gerileme'} kaydedilirken "
        f"5 günlük değişim %{abs(c5d):.1f} olarak gerçekleşmiş. "
        f"{trend_desc.capitalize()}. "
        f"RSI değeri {rsi:.0f} seviyesinde, ADX ise {adx:.0f} ile "
        f"{'güçlü bir trend yapısına' if adx >= 25 else 'orta düzeyde bir momentum yapısına'} işaret ediyor."
    )

    # ─── 2. Interest Zone ────────────────────────────────────────
    interest_zone_text = _guard(
        f"Tarihsel hacim analizine göre {iz} aralığı, "
        f"geçmişte yoğun işlem gören bir bölge olarak öne çıkıyor. "
        f"Bu alan, bazı piyasa katılımcılarının fiyat hareketini yakından izlediği "
        f"bir referans noktası niteliği taşıyabilir."
    )

    # ─── 3. Bullish Scenario ─────────────────────────────────────
    if score >= TIER_STRONG:
        momentum_note = "güçlü momentum yapısının devam etmesi olası"
    elif score >= TIER_HIGH:
        momentum_note = "olumlu teknik koşulların sürmesi mümkün"
    else:
        momentum_note = "yapısal iyileşme senaryoları gündeme gelebilir"

    scenario_bull = _guard(
        f"${tp1:.2f} bölgesinde ilk olası direnç noktası konumlanıyor; "
        f"bu seviyenin üzerinde kalınması halinde ${tp2:.2f} bölgesi "
        f"izlenebilir bir sonraki alan olabilir. "
        f"Mevcut koşullarda {momentum_note}."
    )

    # ─── 4. Bearish Scenario ─────────────────────────────────────
    scenario_bear = _guard(
        f"${sl:.2f} seviyesinin altına gerilenmesi durumunda yapısal baskı "
        f"artabilir. ADX değerinin {adx:.0f}'den gerilemeye başlaması, "
        f"momentum kaybının erken sinyali olarak değerlendirilebilir. "
        f"Bazı yatırımcılar bu senaryoda daha temkinli bir yaklaşım benimseyebilir."
    )

    # ─── 5. Neutral Scenario ─────────────────────────────────────
    scenario_neutral = _guard(
        f"Mevcut {iz} aralığında yatay bir konsolidasyon süreci devam edebilir. "
        f"ATR oranı yaklaşık %{atr_p:.1f} ile volatilitenin {vol_level} "
        f"seyrettiğine işaret ediyor. "
        f"Fiyatın netleşeceği bir bekleme döneminin gündeme gelmesi mümkün."
    )

    # ─── 6. Risk Reference ───────────────────────────────────────
    risk_reference = _guard(
        f"${sl:.2f} seviyesi, mevcut teknik yapıya göre kritik bir referans noktası "
        f"olarak öne çıkıyor. Bu seviyenin altında kalıcı bir seyir, "
        f"yapısal zayıflama sinyallerini güçlendirebilir."
    )

    # ─── 7. Strategy Note (en hassas alan) ───────────────────────
    if tag == "CORE":
        strat_raw = (
            f"Composite skoru {score}/100 ile {tier} sınıfında yer alan {ticker}, "
            f"bazı yatırımcıların yakından takip ettiği yapılardan biri olabilir. "
            f"Kademeli yaklaşım ile pozisyon yönetimi tercih edilebilir bir seçenek olarak değerlendirilebilir."
        )
    elif tag == "SECTOR":
        strat_raw = (
            f"{sector} sektöründe öne çıkan bir yapı sergileyen {ticker} için "
            f"sektör momentumunun seyri, bazı yatırımcıların bu hisseyi "
            f"sektör stratejileri kapsamında değerlendirmesine zemin hazırlayabilir."
        )
    elif tag == "VOLUME":
        strat_raw = (
            f"RVOL değeri {rvol:.1f}x ile ortalama üzerinde seyreden {ticker}, "
            f"piyasa katılımcılarının ilgisini çekmiş olabilir. "
            f"Yüksek hacimli hareketlerde risk yönetimini ön planda tutmak önem taşıyabilir."
        )
    elif tag == "GAINER":
        strat_raw = (
            f"Günlük bazda %{abs(c1d):.1f} artış kaydeden {ticker}, "
            f"kısa vadeli momentum açısından öne çıkıyor. "
            f"Hızlı hareket eden yapılarda bazı yatırımcılar daha temkinli bir yaklaşımı tercih edebilir."
        )
    else:  # LOSER
        strat_raw = (
            f"RSI {rsi:.0f} seviyesiyle aşırı satım bölgesinde seyreden {ticker} için "
            f"geri dönüş senaryoları izlenebilir. "
            f"Ancak trendin yönünü teyit eden sinyallerin beklenmesi "
            f"bazı yatırımcılar tarafından tercih edilebilir."
        )

    strategy_note = _guard(strat_raw)

    return {
        "market_context":     market_context,
        "interest_zone_text": interest_zone_text,
        "scenario_bull":      scenario_bull,
        "scenario_bear":      scenario_bear,
        "scenario_neutral":   scenario_neutral,
        "risk_reference":     risk_reference,
        "strategy_note":      strategy_note,
        "_generated_by":      "template_v1",
        "_legal_safe":        True,
        "_disclaimer":        (
            "Bu içerik yatırım tavsiyesi değildir. "
            "Bilgilendirme amaçlıdır. Tüm yatırım kararları kullanıcının sorumluluğundadır."
        ),
    }


# ================================================================
# BÖLÜM 9 — JSON BUILDER & OUTPUT
# ================================================================

def _fmt_mcap(mcap: int) -> str:
    if mcap >= 1_000_000_000_000:
        return f"{mcap / 1_000_000_000_000:.2f}T"
    if mcap >= 1_000_000_000:
        return f"{mcap / 1_000_000_000:.2f}B"
    if mcap >= 1_000_000:
        return f"{mcap / 1_000_000:.1f}M"
    return str(mcap)


def build_stock_record(stock: dict) -> dict:
    """Tek hisse için temiz JSON nesnesi üretir (_df_1d hariç)."""
    ai = generate_ai_text(stock)
    mcap = int(stock.get("market_cap", 0) or 0)

    return {
        "ticker":          stock.get("ticker", ""),
        "company_name":    stock.get("company_name", stock.get("ticker", "")),
        "sector":          stock.get("sector", "Unknown"),
        "industry":        stock.get("industry", ""),
        "exchange":        stock.get("exchange", ""),
        "market_cap":      mcap,
        "market_cap_fmt":  _fmt_mcap(mcap),
        "tag":             stock.get("tag", "CORE"),
        "tier":            stock.get("tier", "WATCH"),
        "score":           stock.get("score", 0),
        "score_breakdown": stock.get("breakdown", {}),
        "price":           stock.get("price", 0.0),
        "change_1d":       stock.get("change_1d", 0.0),
        "change_5d":       stock.get("change_5d", 0.0),
        "change_1m":       stock.get("change_1m", 0.0),
        "rvol":            stock.get("rvol", 0.0),
        "rsi":             stock.get("rsi", 0.0),
        "adx":             stock.get("adx", 0.0),
        "atr_pct":         stock.get("atr_pct", 0.0),
        "bb_width":        stock.get("bb_width", 0.0),
        "ema20":           stock.get("ema20", 0.0),
        "ema50":           stock.get("ema50", 0.0),
        "ema200":          stock.get("ema200", 0.0),
        "interest_zone":   stock.get("interest_zone", ""),
        "stop_loss":       stock.get("stop_loss", 0.0),
        "target_1":        stock.get("target_1", 0.0),
        "target_2":        stock.get("target_2", 0.0),
        "ai_text":         ai,
    }


def build_output_payload(
    categories: dict,
    run_time_ny: str,
    duration_s: float,
) -> dict:
    """Tam output JSON yapısını oluşturur."""
    now_ny = datetime.now(NY_TZ)

    cat_json: dict = {}
    all_54:   List[dict] = []

    for cat_name, stocks in categories.items():
        records = [build_stock_record(s) for s in stocks]
        cat_json[cat_name] = records
        all_54.extend(records)

    all_54.sort(key=lambda x: x.get("score", 0), reverse=True)

    return {
        "bot_name":      BOT_NAME,
        "run_timestamp": now_ny.strftime("%Y-%m-%d %H:%M:%S"),
        "market_date":   now_ny.strftime("%Y-%m-%d"),
        "run_time_ny":   run_time_ny,
        "duration_sec":  round(duration_s, 1),
        "market_regime": MARKET_STATUS.get("regime", "UNKNOWN"),
        "vix":           MARKET_STATUS.get("vix", 0.0),
        "stock_count":   len(all_54),
        "categories":    cat_json,
        "all_54":        all_54,
        "_disclaimer":   (
            "This content is for informational purposes only and does not "
            "constitute investment advice. All financial decisions are the sole "
            "responsibility of the user. Past performance is not indicative of "
            "future results."
        ),
    }


def save_json(payload: dict) -> str:
    """JSON'u latest + arşiv dosyalarına yazar. latest dosya yolunu döner."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    ts      = datetime.now(NY_TZ).strftime("%Y%m%d_%H%M")
    latest  = os.path.join(OUTPUT_DIR, f"{BOT_NAME}_latest.json")
    archive = os.path.join(OUTPUT_DIR, f"{BOT_NAME}_{ts}.json")

    for path in [latest, archive]:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False, default=str)

    logging.info(
        f"JSON kaydedildi → {latest} ({payload.get('stock_count', 0)} hisse, {ts})"
    )
    return latest


# ================================================================
# BÖLÜM 10 — ANA TARAYICI
# ================================================================

async def run_scan(run_label: str = "manual") -> Optional[dict]:
    """
    Tam tarama döngüsü:
      1. Piyasa rejimi + sektör analizi
      2. Universe builder (8000+ → 200)
      3. Paralel tam teknik analiz (200 hisse, semaphore=3)
      4. Company info enrichment (top 60) + context rescore
      5. 54 hisse seçimi + overlap koruması
      6. JSON build + save
    """
    start  = time.time()
    now_ny = datetime.now(NY_TZ)
    rt_str = now_ny.strftime("%H:%M")

    logging.info(
        "\n"
        "╔══════════════════════════════════════════════╗\n"
        f"  FinMA514 Tarama Başladı — {now_ny.strftime('%Y-%m-%d %H:%M')} NY\n"
        f"  Mod: {run_label}\n"
        "╚══════════════════════════════════════════════╝"
    )

    # ─── ADIM 1: Piyasa & Sektör ──────────────────────────────
    logging.info("ADIM 1/6 — Piyasa rejimi + sektör performansı analiz ediliyor")
    await asyncio.gather(analyze_market_regime(), analyze_sector_performance())

    if MARKET_STATUS.get("regime") == "WEAK":
        logging.warning("WEAK piyasa rejimi tespit edildi — tarama gözlem modunda devam ediyor")

    # ─── ADIM 2: Universe Builder ──────────────────────────────
    logging.info("ADIM 2/6 — Universe oluşturuluyor (8000+ → 200)")
    universe = await build_finma_universe()
    if not universe:
        logging.error("Universe boş — tarama iptal edildi.")
        return None
    logging.info(f"Universe: {len(universe)} hisse → detaylı analize geçiliyor")

    # ─── ADIM 3: Paralel Detaylı Analiz ────────────────────────
    logging.info(f"ADIM 3/6 — Paralel teknik analiz başlıyor (semaphore=3, {len(universe)} hisse)")
    semaphore     = asyncio.Semaphore(3)
    analyzed_count = 0

    async def sem_analyze(ticker: str):
        nonlocal analyzed_count
        async with semaphore:
            result = await asyncio.to_thread(full_stock_analysis, ticker)
            analyzed_count += 1
            if analyzed_count % 20 == 0:
                pct    = analyzed_count / len(universe) * 100
                elapsed = time.time() - start
                logging.info(
                    f"  İlerleme: {analyzed_count}/{len(universe)} "
                    f"(%{pct:.0f}) | {elapsed:.0f}s geçti"
                )
            return result

    tasks   = [sem_analyze(t) for t in universe]
    results = await asyncio.gather(*tasks)

    analyzed = [r for r in results if r is not None]
    logging.info(
        f"Analiz tamamlandı: {len(analyzed)}/{len(universe)} hisse "
        f"filtreden geçti ({time.time()-start:.0f}s)"
    )

    if not analyzed:
        logging.error("Analiz sonucu boş — tarama iptal edildi.")
        return None

    # ─── ADIM 4: Company Info Enrichment (Top 60) ──────────────
    logging.info("ADIM 4/6 — Company info enrichment (Top 60) + context rescore")
    top_60 = sorted(analyzed, key=lambda x: x["score"], reverse=True)[:60]

    info_sem = asyncio.Semaphore(5)

    async def fetch_info(stock: dict):
        ticker = stock["ticker"]
        async with info_sem:
            await asyncio.sleep(random.uniform(0.5, 1.5))
            info = await asyncio.to_thread(get_stock_info, ticker)
            old_sector = stock.get("sector", "Unknown")
            new_sector = info.get("sector", old_sector)

            stock.update({
                "company_name": info.get("company_name", ticker),
                "sector":       new_sector,
                "industry":     info.get("industry", ""),
                "exchange":     info.get("exchange", ""),
                "market_cap":   info.get("market_cap", 0),
                "beta":         info.get("beta", 1.0),
            })

            # Context skorunu güncelle (sektör değişmişse)
            if new_sector != old_sector:
                ctx_new = score_context(ticker, new_sector)
                old_ctx = stock["breakdown"].get("context", 0)
                stock["breakdown"]["context"] = ctx_new["score"]
                delta = ctx_new["score"] - old_ctx
                stock["score"]  = max(0, min(100, stock["score"] + delta))
                stock["tier"]   = classify_tier(stock["score"])

    await asyncio.gather(*(fetch_info(s) for s in top_60))
    logging.info("Info enrichment tamamlandı")

    # ─── ADIM 5: 54 Hisse Seçimi ────────────────────────────────
    logging.info("ADIM 5/6 — 54 hisse seçimi + overlap koruması")
    categories = select_54_stocks(analyzed)
    if not categories:
        logging.error("Kategori seçimi başarısız — tarama iptal edildi.")
        return None

    # ─── ADIM 6: JSON Build + Save ──────────────────────────────
    logging.info("ADIM 6/6 — JSON oluşturuluyor ve kaydediliyor")
    duration = time.time() - start
    payload  = build_output_payload(categories, rt_str, duration)
    save_json(payload)

    # ─── ADIM 6b: Supabase + Redis yazma ────────────────────────
    try:
        import sys, pathlib
        # backend/app/services klasörünü path'e ekle (bots/ dışındaki modüller için)
        _backend = str(pathlib.Path(__file__).parent.parent)
        if _backend not in sys.path:
            sys.path.insert(0, _backend)
        from app.services.finma514_writer import write_to_db
        db_result = await asyncio.to_thread(write_to_db, payload)
        logging.info(
            f"DB/Cache: supabase={db_result['supabase_ok']} | "
            f"redis={db_result['redis_ok']} | "
            f"rows={db_result['rows_written']}"
        )
        if db_result["errors"]:
            for err in db_result["errors"]:
                logging.warning(f"  DB uyarı: {err}")
    except Exception as e:
        logging.warning(f"DB/Cache yazma atlandı: {e}")

    total = payload.get("stock_count", 0)
    logging.info(
        "\n"
        "╔══════════════════════════════════════════════╗\n"
        f"  FinMA514 Tarama Tamamlandı\n"
        f"  Toplam seçilen : {total} hisse\n"
        f"  Süre           : {duration:.1f}s\n"
        f"  Rejim          : {MARKET_STATUS.get('regime')} | VIX: {MARKET_STATUS.get('vix', 0):.1f}\n"
        "╚══════════════════════════════════════════════╝"
    )

    return payload


# ================================================================
# BÖLÜM 11 — SCHEDULER (NY 06:30 + 12:00)
# ================================================================

def _next_run_utc() -> datetime:
    """
    Bir sonraki hafta içi NY 06:30 veya 12:00 zamanını UTC olarak döner.
    DST güvenli.
    """
    now_utc = datetime.now(timezone.utc)
    now_ny  = now_utc.astimezone(NY_TZ)

    candidates = []
    for run in DAILY_RUNS:
        c_ny = now_ny.replace(
            hour=run["hour"], minute=run["minute"],
            second=0, microsecond=0,
        )
        if c_ny <= now_ny:
            c_ny += timedelta(days=1)
        while c_ny.weekday() >= 5:   # Hafta sonunu geç
            c_ny += timedelta(days=1)
        candidates.append(c_ny)

    next_ny = min(candidates)
    return next_ny.astimezone(timezone.utc)


async def run_scheduler():
    """
    Sonsuz scheduler döngüsü.
    Çalışma: Hafta içi NY 06:30 + 12:00
    """
    logging.info(
        "FinMA514 Scheduler başlatıldı — "
        "Hafta içi NY 06:30 + 12:00 taraması aktif"
    )

    # Başlangıçta bir tarama çalıştır
    try:
        await run_scan(run_label="startup")
    except Exception as e:
        logging.error(f"Başlangıç tarama hatası: {e}")

    while True:
        try:
            now_utc  = datetime.now(timezone.utc)
            next_utc = _next_run_utc()
            wait_s   = (next_utc - now_utc).total_seconds()

            # Güvenlik
            if not (0 < wait_s <= 90_000):
                next_utc = _next_run_utc()
                wait_s   = max(60.0, (next_utc - datetime.now(timezone.utc)).total_seconds())

            next_ny = next_utc.astimezone(NY_TZ)
            logging.info(
                f"Bir sonraki tarama: {next_ny.strftime('%Y-%m-%d %H:%M')} NY "
                f"(~{wait_s / 3600:.1f} saat sonra)"
            )

            await asyncio.sleep(wait_s)

            now_ny    = datetime.now(NY_TZ)
            run_label = f"NY_{now_ny.strftime('%H:%M')}"
            await run_scan(run_label=run_label)

        except Exception as e:
            logging.error(f"Scheduler döngü hatası: {e}")
            await asyncio.sleep(300)   # 5 dk bekle, tekrar dene


# ================================================================
# BÖLÜM 12 — ENTRY POINT
# ================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "finma514 — FinMA AI Analytics Engine | Faz 1 Scoring Bot\n"
            "Pipeline: 8000+ → 200 shortlist → 54 seçim (5 kategori)\n"
            "Çıktı  : JSON (finma514_latest.json)"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--one-shot",
        action="store_true",
        help="Bir kez çalıştır ve çık (cron / Windows Task Scheduler ile kullanım için)",
    )
    parser.add_argument(
        "--now",
        action="store_true",
        help="Scheduler beklemesi olmadan hemen bir tarama başlat",
    )
    args = parser.parse_args()

    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    try:
        if args.one_shot:
            logging.info("finma514 — ONE-SHOT mod")
            asyncio.run(run_scan(run_label="one-shot"))

        elif args.now:
            logging.info("finma514 — NOW mod (anında tarama)")
            asyncio.run(run_scan(run_label="manual-now"))

        else:
            asyncio.run(run_scheduler())

    except KeyboardInterrupt:
        print("\nfinma514 durduruldu.")
    except Exception as e:
        logging.critical(f"Kritik başlatma hatası: {e}", exc_info=True)
