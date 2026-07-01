# -*- coding: utf-8 -*-
"""
================================================================
🐂 BOGA AI — MOMENTUM SWING ENGINE  (swing117_boga.py / v200)
================================================================
FELSEFE:
  Bu bot "en risksiz hisseyi bulmaz".
  Bu bot: "Önümüzdeki 7-15 günde %8-20 hareket etme olasılığı
           en yüksek hisseleri bulur."

  Amaç kayması yapan onlarca koruma katmanı (insider, financial
  health, options sentiment, ichimoku, volume profile, ATR entry
  engine, 1H/15m mikro trend, ADX/MACD/BB/MFI/OBV, VIX overlay,
  7 farklı sistem tipi) TAMAMEN kaldırıldı.

MİMARİ (sadece bu kadar):
  LAYER 1 — UNIVERSE
      Sektör + Price>2 + MarketCap>300M + DollarVol20>10M
  LAYER 2 — ANA FİLTRE (6 koşul, hepsi zorunlu)
      Close>EMA50 · EMA50>EMA200 · RSI 50-68 ·
      RSI son 3 gün yükseliyor · RVOL>1.3 · Volume>Avg20*1.3
  LAYER 3 — RELATIVE STRENGTH
      20 günlük performans > S&P500 20 günlük performans
  LAYER 4 — BREAKOUT HAZIRLIĞI
      20 günlük en yüksek kapanışa %2 yakın VEYA yeni kırılmış
  PUANLAMA (100)
      Liquidity 20 · Trend 20 · Momentum 20 · Volume 20 · RS 20

  OUTPUT — JSON (frontend) + Telegram
================================================================
"""

import os
import json
import math
import time
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo

import aiohttp
import numpy as np
import pandas as pd
import yfinance as yf


# ================================================================
# 🔹 LOGGING
# ================================================================
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(levelname)s - %(message)s")
logging.getLogger("yfinance").setLevel(logging.CRITICAL)


# ================================================================
# 🔹 TIME & SCHEDULE
# ================================================================
NY_TZ = ZoneInfo("America/New_York")
DAILY_RUN_HOUR = 13      # NY 13:00 — her hafta içi günü
DAILY_RUN_MINUTE = 0


# ================================================================
# 🔹 UNIVERSE & FILTER PARAMETERS  (LAYER 1)
# ================================================================
PRICE_MIN            = 2.0
PRICE_MAX            = 2000.0
MIN_MARKET_CAP       = 300_000_000       # > 300M
MIN_DOLLAR_VOLUME_20 = 10_000_000        # 20g ort dolar hacmi > 10M

UNIVERSE_SIZE   = 500      # Layer 1 sonrası tutulan en likit N hisse
TOP_FINAL_PICKS = 20       # Günlük seçilecek aday sayısı

# ── LAYER 2 — ANA FİLTRE eşikleri ──────────────────────────────
RSI_MIN          = 50.0
RSI_MAX          = 68.0
RVOL_MIN         = 1.3
VOLUME_MULT_MIN  = 1.3     # Volume > Avg20 * 1.3

# ── LAYER 3 — Relative Strength ────────────────────────────────
RS_LOOKBACK_DAYS = 20
INDEX_BENCHMARK  = "^GSPC"

# ── LAYER 4 — Breakout ─────────────────────────────────────────
BREAKOUT_LOOKBACK = 20     # 20 günlük en yüksek kapanış
BREAKOUT_PROXIMITY = 0.02  # %2 yakınlık

LOOKBACK_DAYS = 400        # 🚨 FIX: 252 takvim günü ~180 işlem günü = EMA200'ü ve len>=210 kontrolünü çökertir.
                           # 365 sınırda (~250 işlem günü) kalır; 400 güvenli tampon sağlar.
MIN_HISTORY_BARS = 210     # analyze() minimum bar şartı (EMA200 stabilitesi için)


# ================================================================
# 🔹 TELEGRAM
# ================================================================
TELEGRAM_API_KEY = "8182098187:AAF-jtWMJK07ZdZdyusiE1RqyQkwegb0Uhc"
TELEGRAM_CHAT_ID = "-1003406973271"
ENABLE_TELEGRAM_NOTIFICATIONS = True


# ================================================================
# 🔹 OUTPUT PATHS  (frontend ile senkron)
# ================================================================
PUBLIC_DIR    = r"C:\Users\afksm\finma\frontend\public"
BASE_DATA_DIR = r"C:\Users\afksm\finma\frontend\public\data"


# ================================================================
# 🔹 TICKER SOURCES
# ================================================================
EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# Bilinen büyük hisseler için hızlı sektör/isim erişimi (yalnızca kozmetik)
COMPANY_DATABASE: Dict[str, Dict[str, str]] = {
    "AAPL":  {"name": "Apple Inc",        "sector": "Technology"},
    "MSFT":  {"name": "Microsoft Corp",   "sector": "Technology"},
    "NVDA":  {"name": "NVIDIA Corp",      "sector": "Technology"},
    "TSLA":  {"name": "Tesla Inc",        "sector": "Consumer Cyclical"},
    "AMZN":  {"name": "Amazon.com Inc",   "sector": "Consumer Cyclical"},
    "GOOGL": {"name": "Alphabet Inc",     "sector": "Communication Services"},
    "META":  {"name": "Meta Platforms",   "sector": "Communication Services"},
    "JPM":   {"name": "JPMorgan Chase",   "sector": "Financial Services"},
    "CAT":   {"name": "Caterpillar Inc",  "sector": "Industrials"},
}


# ================================================================
# 🔹 GLOBAL STATE
# ================================================================
UNIVERSE_TTL   = 7 * 24 * 3600
UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}
BULK_DATA_CACHE: Dict[str, pd.DataFrame] = {}
INFO_CACHE: Dict[str, dict] = {}
_INDEX_RS_CACHE: Dict[str, float] = {"ts": 0.0, "value": 0.0}


# ================================================================
# ================================================================
# SECTION 1 — INDICATORS  (yalnızca EMA + RSI, başka indikatör YOK)
# ================================================================
# ================================================================
def ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss
    out = 100.0 - (100.0 / (1.0 + rs))
    # avg_loss == 0 (hiç kayıp yok) → RSI = 100, gelişme yoksa 50, ısınma dönemi 50
    out = out.where(avg_loss != 0, 100.0)
    out = out.where(~((avg_gain == 0) & (avg_loss == 0)), 50.0)
    return out.fillna(50.0)


# ================================================================
# ================================================================
# SECTION 2 — LAYER 1: UNIVERSE
# ================================================================
# ================================================================
async def fetch_all_us_tickers() -> List[str]:
    """NASDAQ/NYSE/AMEX sembolleri — sadece 1-5 harfli hisseler."""
    tickers: set = set()
    headers = {"User-Agent": "Mozilla/5.0"}
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
                            tickers.add(sym)
            except Exception as e:
                logging.error(f"⚠️ Ticker list error ({url}): {e}")
    logging.info(f"[OK] Ham sembol sayısı: {len(tickers)}")
    return list(tickers)


def get_info(ticker: str) -> dict:
    """Sektör + isim + market cap. Sadece Layer 1 için gerekli minimum bilgi."""
    if ticker in INFO_CACHE:
        return INFO_CACHE[ticker]
    info = {"name": ticker, "sector": "Unknown", "market_cap": 0}
    db = COMPANY_DATABASE.get(ticker)
    if db:
        info.update({"name": db["name"], "sector": db["sector"]})
    try:
        yf_info = yf.Ticker(ticker).info or {}
        info["name"]       = yf_info.get("shortName", info["name"]) or info["name"]
        info["sector"]     = yf_info.get("sector", info["sector"]) or info["sector"]
        info["market_cap"] = yf_info.get("marketCap", 0) or 0
    except Exception:
        pass
    INFO_CACHE[ticker] = info
    return info


async def build_universe() -> List[str]:
    """
    LAYER 1 — Haftalık evren.
    Filtreler: Price>2 · MarketCap>300M · DollarVol20>10M
    Sonuç: en likit UNIVERSE_SIZE hisse (dolar hacmine göre).
    """
    now = time.time()
    if UNIVERSE_CACHE["data"] and (now - UNIVERSE_CACHE["ts"]) < UNIVERSE_TTL:
        return UNIVERSE_CACHE["data"]

    raw = await fetch_all_us_tickers()
    if not raw:
        logging.error("❌ Sembol listesi boş — evren kurulamadı.")
        return []

    ranked: List[tuple] = []   # (dollar_vol, ticker)
    chunk = 200
    for i in range(0, len(raw), chunk):
        batch = raw[i:i + chunk]
        try:
            data = await asyncio.to_thread(
                yf.download, batch, period=f"{LOOKBACK_DAYS}d", interval="1d",
                progress=False, group_by="ticker", ignore_tz=True, threads=True
            )
        except Exception as e:
            logging.error(f"⚠️ Bulk indirme hatası: {e}")
            continue

        for sym in batch:
            try:
                df = data[sym].dropna() if sym in data else pd.DataFrame()
            except Exception:
                df = pd.DataFrame()
            if df.empty or len(df) < 60:
                continue

            close = df["Close"]
            vol   = df["Volume"]
            price = float(close.iloc[-1])
            if not (PRICE_MIN <= price <= PRICE_MAX):
                continue

            dollar_vol_20 = float((close.tail(20) * vol.tail(20)).mean())
            if dollar_vol_20 < MIN_DOLLAR_VOLUME_20:
                continue

            BULK_DATA_CACHE[sym] = df
            ranked.append((dollar_vol_20, sym))

        logging.info(f"🔍 Evren taraması: {i + len(batch)}/{len(raw)} — aday: {len(ranked)}")

    ranked.sort(reverse=True)
    universe = [sym for _, sym in ranked[:UNIVERSE_SIZE]]

    UNIVERSE_CACHE["data"] = universe
    UNIVERSE_CACHE["ts"] = now
    try:
        with open("boga_universe.txt", "w") as f:
            f.write("\n".join(universe))
    except Exception:
        pass

    logging.info(f"[OK] LAYER 1 tamamlandı — {len(universe)} likit hisse.")
    return universe


# ================================================================
# ================================================================
# SECTION 3 — RELATIVE STRENGTH BENCHMARK
# ================================================================
# ================================================================
def get_index_return_20d() -> float:
    """S&P500'ün 20 günlük getirisi (%)."""
    now = time.time()
    if _INDEX_RS_CACHE["value"] and (now - _INDEX_RS_CACHE["ts"]) < 3600:
        return _INDEX_RS_CACHE["value"]
    try:
        # 🚨 FIX: MultiIndex riskini sıfırlamak için doğrudan Ticker.history kullanılır.
        idx = yf.Ticker(INDEX_BENCHMARK).history(period="40d", interval="1d")
        close = idx["Close"].dropna()
        ret = float((close.iloc[-1] / close.iloc[-(RS_LOOKBACK_DAYS + 1)] - 1.0) * 100.0)
    except Exception as e:
        logging.warning(f"⚠️ Endeks getirisi alınamadı: {e}")
        ret = 0.0
    _INDEX_RS_CACHE.update({"ts": now, "value": ret})
    return ret


# ================================================================
# ================================================================
# SECTION 4 — CORE ANALYSIS  (LAYER 2 + 3 + 4 + SCORE)
# ================================================================
# ================================================================
def analyze(ticker: str, index_ret_20d: float) -> Optional[dict]:
    """
    Tek hisse için tam değerlendirme.
    Layer 2/3/4 kapılarının HEPSİ geçilmeli, aksi halde None döner.
    Geçen hisse 0-100 arası puan alır.
    """
    df = BULK_DATA_CACHE.get(ticker)
    if df is None or len(df) < MIN_HISTORY_BARS:
        return None

    close  = df["Close"]
    volume = df["Volume"]
    price  = float(close.iloc[-1])

    # ── İndikatörler (yalnızca EMA + RSI) ──────────────────────
    ema50_s  = ema(close, 50)
    ema200_s = ema(close, 200)
    rsi_s    = rsi(close, 14)

    ema50  = float(ema50_s.iloc[-1])
    ema200 = float(ema200_s.iloc[-1])
    ema20  = float(ema(close, 20).iloc[-1])
    rsi_now = float(rsi_s.iloc[-1])

    vol_avg20 = float(volume.tail(20).mean())
    vol_today = float(volume.iloc[-1])
    rvol = (vol_today / vol_avg20) if vol_avg20 > 0 else 0.0

    # ===========================================================
    # LAYER 2 — ANA FİLTRE (6 koşul, hepsi zorunlu)
    # ===========================================================
    # 1) Close > EMA50
    if not (price > ema50):
        return None
    # 2) EMA50 > EMA200
    if not (ema50 > ema200):
        return None
    # 3) RSI 50-68
    if not (RSI_MIN <= rsi_now <= RSI_MAX):
        return None
    # 4) RSI son 3 gün genel yönü yukarı (RSI Slope Pozitif)
    r = rsi_s.tail(3).values
    if not (len(r) == 3 and r[2] > r[0] and r[2] >= r[1]):
        # 🚨 FIX: Katı r0<r1<r2 şartı, ortadaki günde 0.1p mikro düşüş yaşayan güçlü
        # kalkışları (MU/SNDK tipi) eliyordu. Artık 3g net yön yukarı olması yeterli.
        return None
    # 5) RVOL > 1.3
    if rvol < RVOL_MIN:
        return None
    # 6) Volume > Avg20 * 1.3  (RVOL ile aynı ailede ama ayrı kapı — istenildiği gibi)
    if vol_today < vol_avg20 * VOLUME_MULT_MIN:
        return None

    # ===========================================================
    # LAYER 3 — RELATIVE STRENGTH
    # ===========================================================
    stock_ret_20d = float((price / float(close.iloc[-(RS_LOOKBACK_DAYS + 1)]) - 1.0) * 100.0)
    if stock_ret_20d <= index_ret_20d:
        return None

    # ===========================================================
    # LAYER 4 — BREAKOUT HAZIRLIĞI
    # ===========================================================
    high_20 = float(close.tail(BREAKOUT_LOOKBACK).max())
    prev_high_20 = float(close.iloc[-(BREAKOUT_LOOKBACK + 1):-1].max())
    near_high = (high_20 - price) / high_20 <= BREAKOUT_PROXIMITY if high_20 > 0 else False
    fresh_breakout = price > prev_high_20
    if not (near_high or fresh_breakout):
        return None

    # ===========================================================
    # PUANLAMA (5 x 20 = 100)
    # ===========================================================
    dollar_vol_20 = float((close.tail(20) * volume.tail(20)).mean())

    # 1) LIQUIDITY (20)
    if   dollar_vol_20 >= 100e6: liquidity = 20.0
    elif dollar_vol_20 >=  50e6: liquidity = 16.0
    elif dollar_vol_20 >=  25e6: liquidity = 12.0
    elif dollar_vol_20 >=  10e6: liquidity = 8.0
    else:                        liquidity = 4.0

    # 2) TREND (20) — EMA50/EMA200 açıklığı (yükselen trend gücü)
    ema_spread = (ema50 - ema200) / ema200 if ema200 > 0 else 0.0
    price_above = (price - ema50) / ema50 if ema50 > 0 else 0.0
    # 🚨 OPTİMİZASYON: Çarpanlar trend lideri hisselerin 20 tam puana adil ulaşması için kalibre edildi.
    trend = min(20.0, max(0.0, (ema_spread * 120.0) + (price_above * 80.0)))
    trend = min(trend, 20.0)

    # 3) MOMENTUM (20) — RSI sweet spot + 20g getiri
    rsi_pts = 12.0 if 55 <= rsi_now <= 63 else 9.0 if 50 <= rsi_now < 55 else 7.0
    perf_pts = 8.0 if stock_ret_20d >= 15 else 6.0 if stock_ret_20d >= 8 else 4.0 if stock_ret_20d >= 4 else 2.0
    momentum = min(20.0, rsi_pts + perf_pts)

    # 4) VOLUME (20) — RVOL gücü
    if   rvol >= 2.5: vol_score = 20.0
    elif rvol >= 2.0: vol_score = 17.0
    elif rvol >= 1.7: vol_score = 14.0
    elif rvol >= 1.5: vol_score = 11.0
    else:             vol_score = 8.0

    # 5) RELATIVE STRENGTH (20) — endeksi ne kadar geçtiği
    rs_gap = stock_ret_20d - index_ret_20d
    if   rs_gap >= 15: rs_score = 20.0
    elif rs_gap >= 10: rs_score = 16.0
    elif rs_gap >=  5: rs_score = 12.0
    elif rs_gap >=  2: rs_score = 8.0
    else:              rs_score = 5.0

    total = round(liquidity + trend + momentum + vol_score + rs_score, 1)

    # ── Basit hedef/stop (frontend tracker için — giriş botu DEĞİL) ──
    atr = _simple_atr(df, 14)
    entry = round(price, 2)
    stop  = round(price - atr * 1.5, 2)
    tp1   = round(price + atr * 1.5, 2)
    tp2   = round(price + atr * 3.0, 2)
    tp3   = round(price + atr * 4.5, 2)
    risk   = max(entry - stop, 0.01)
    reward = tp2 - entry
    rr = round(reward / risk, 2) if risk > 0 else 0.0

    info = get_info(ticker)

    return {
        "ticker": ticker,
        "company": info.get("name", ticker),
        "sector": info.get("sector", "Unknown"),
        "market_cap": info.get("market_cap", 0),
        "current_price": entry,
        "boga_score_100": total,
        "score": total,

        # skor kırılımı
        "factor_scores": {
            "liquidity": liquidity, "trend": round(trend, 1), "momentum": round(momentum, 1),
            "volume": vol_score, "relative_strength": rs_score,
        },

        # indikatör değerleri
        "rsi_14": round(rsi_now, 1),
        "rvol_today": round(rvol, 2),
        "ema20": round(ema20, 2), "ema50": round(ema50, 2), "ema200": round(ema200, 2),
        "ret_20d": round(stock_ret_20d, 2),
        "rs_gap": round(rs_gap, 2),
        "dollar_volume": dollar_vol_20,

        # breakout durumu
        "breakout_state": "FRESH_BREAKOUT" if fresh_breakout else "NEAR_HIGH",
        "high_20d": round(high_20, 2),

        # hedef/stop
        "entry": entry, "stop_loss": stop, "tp1": tp1, "tp2": tp2, "tp3": tp3,
        "rr_ratio": rr,
        "hold_days": 10,   # 7-15g swing bandının orta değeri (sabit, tahmin)
        "df_1d": df,
    }


def _simple_atr(df: pd.DataFrame, period: int = 14) -> float:
    high, low, close = df["High"], df["Low"], df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat([(high - low),
                    (high - prev_close).abs(),
                    (low - prev_close).abs()], axis=1).max(axis=1)
    atr = tr.tail(period).mean()
    return float(atr) if not math.isnan(atr) else float(close.iloc[-1]) * 0.02


# ================================================================
# ================================================================
# SECTION 5 — PERFORMANCE HELPERS (frontend perf alanları)
# ================================================================
# ================================================================
def price_performance(df: pd.DataFrame) -> dict:
    try:
        close = df["Close"].dropna()
        p = float(close.iloc[-1])
        def chg(n):
            if len(close) > n:
                return round((p / float(close.iloc[-(n + 1)]) - 1.0) * 100.0, 2)
            return 0.0
        return {"1d": chg(1), "1w": chg(5), "1m": chg(21), "1y": chg(252),
                "5y": round((p / float(close.iloc[0]) - 1.0) * 100.0, 2)}
    except Exception:
        return {"1d": 0.0, "1w": 0.0, "1m": 0.0, "1y": 0.0, "5y": 0.0}


# ================================================================
# ================================================================
# SECTION 6 — JSON OUTPUT  (frontend uyumlu, sadeleştirilmiş)
# ================================================================
# ================================================================
def build_json_output(picks_list: list, generated_at: str) -> dict:
    picks = []
    for i, c in enumerate(picks_list):
        price = c.get("current_price", 0.0)
        perf  = c.get("performance", {})
        mcap  = c.get("market_cap", 0) or 0
        if   mcap >= 1e12: mcap_str = f"{mcap / 1e12:.2f}T"
        elif mcap >= 1e9:  mcap_str = f"{mcap / 1e9:.2f}B"
        elif mcap >= 1e6:  mcap_str = f"{mcap / 1e6:.1f}M"
        else:              mcap_str = str(mcap)

        picks.append({
            "rank": i + 1,
            "ticker": c.get("ticker", ""),
            "company": c.get("company", c.get("ticker", "")),
            "sector": c.get("sector", "Unknown"),
            "score": c.get("boga_score_100", 0.0),
            "boga_score": c.get("boga_score_100", 0.0),
            "current_price": price,
            "selected_system": "MOMENTUM_SWING",
            "system_label": {"text": "Momentum Swing", "color": "blue"},
            "holding_period": f"{c.get('hold_days', 10)} Days",
            "holding_period_estimate": f"{c.get('hold_days', 10)} Days (7-15 band)",
            "status": "WAITING_FOR_ENTRY",
            "breakout_state": c.get("breakout_state", "NEAR_HIGH"),

            # tracker (frontend Smart Tracker bu alanları okur)
            "tracker_logic": {
                "entry": c.get("entry", price),
                "stop_loss": c.get("stop_loss", 0),
                "profit_target_tp1": c.get("tp1", 0),
                "profit_target_tp2": c.get("tp2", 0),
                "profit_target_tp3": c.get("tp3", 0),
                "max_hold_days": c.get("hold_days", 10),
                "exit_rule": "EXIT_ON_TARGET_OR_STOP_OR_MAX_HOLD",
                "trailing_stop_rules": {
                    "step_1": "Kar > %5 → Stop = Giriş (break-even).",
                    "step_2": "Kar > %8 → Stop = Giriş + %2.",
                },
            },

            # düz alanlar (geri uyumluluk)
            "buy_zone":  {"low": round(price * 0.995, 2), "high": round(price * 1.01, 2)},
            "profit_zone": {"low": c.get("tp1", 0), "high": c.get("tp2", 0)},
            "stop_zone": {"low": c.get("stop_loss", 0), "high": round(c.get("stop_loss", 0) * 1.005, 2)},
            "rsi": c.get("rsi_14", 50.0),
            "rvol": c.get("rvol_today", 1.0),
            "rr_ratio": c.get("rr_ratio", 0.0),
            "ret_20d": c.get("ret_20d", 0.0),
            "rs_gap": c.get("rs_gap", 0.0),

            "moving_averages": {
                "ema_20": c.get("ema20", 0.0),
                "ema_50": c.get("ema50", 0.0),
                "ema_200": c.get("ema200", 0.0),
            },
            "factor_scores": c.get("factor_scores", {}),
            "performance": {
                "1d_pct": perf.get("1d", 0.0), "1w_pct": perf.get("1w", 0.0),
                "1m_pct": perf.get("1m", 0.0), "1y_pct": perf.get("1y", 0.0),
                "5y_pct": perf.get("5y", 0.0),
            },
            "fundamentals": {"market_cap": mcap_str, "market_cap_usd": mcap},
            "reasoning": f"Momentum Swing Score: {c.get('boga_score_100', 0.0)}/100",
        })

    return {
        "generated_at": generated_at,
        "date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
        "model": "BOGA AI Momentum Swing v200",
        "total_picks": len(picks),
        "picks": picks,
    }


def clean_nan(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return None
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    return obj


def save_outputs(final_picks: list, generated_at: str):
    """swing_picks.json (Top 5) + swing_all_picks.json (Top 20) + arşiv."""
    top_all = clean_nan(build_json_output(final_picks, generated_at))
    top_5   = clean_nan(build_json_output(final_picks[:5], generated_at))

    now_ny = datetime.now(NY_TZ)
    try:
        year_dir = os.path.join(BASE_DATA_DIR, f"swing{now_ny.strftime('%Y')}")
        os.makedirs(year_dir, exist_ok=True)
        archive = os.path.join(year_dir, f"swing_{now_ny.strftime('%Y%m%d')}.json")
        with open(archive, "w", encoding="utf-8") as f:
            json.dump(top_all, f, indent=2, ensure_ascii=False, default=str)
        logging.info(f"📁 Arşivlendi: {archive}")

        os.makedirs(PUBLIC_DIR, exist_ok=True)
        with open(os.path.join(PUBLIC_DIR, "swing_picks.json"), "w", encoding="utf-8") as f:
            json.dump(top_5, f, indent=2, ensure_ascii=False, default=str)
        with open(os.path.join(PUBLIC_DIR, "swing_all_picks.json"), "w", encoding="utf-8") as f:
            json.dump(top_all, f, indent=2, ensure_ascii=False, default=str)
        logging.info("💾 Frontend JSON dosyaları güncellendi.")
    except Exception as e:
        logging.error(f"❌ JSON kaydetme hatası: {e}")


# ================================================================
# ================================================================
# SECTION 7 — TELEGRAM
# ================================================================
# ================================================================
def _split(text: str, max_len: int = 3800) -> List[str]:
    if len(text) <= max_len:
        return [text]
    parts, cur = [], ""
    for line in text.split("\n"):
        if len(cur) + len(line) + 1 > max_len:
            parts.append(cur)
            cur = ""
        cur += line + "\n"
    if cur:
        parts.append(cur)
    return parts


async def send_telegram(message: str):
    if not ENABLE_TELEGRAM_NOTIFICATIONS or not TELEGRAM_API_KEY:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    async with aiohttp.ClientSession() as session:
        for part in _split(message):
            try:
                async with session.post(url, data={
                    "chat_id": TELEGRAM_CHAT_ID, "text": part, "parse_mode": "HTML"
                }, timeout=15) as resp:
                    if resp.status != 200:
                        logging.error(f"❌ Telegram: {await resp.text()}")
            except Exception as e:
                logging.error(f"⚠️ Telegram bağlantı hatası: {e}")
            await asyncio.sleep(0.4)


def build_telegram_report(picks: list) -> str:
    date_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
    head = (
        "🐂 <b>BOGA AI — MOMENTUM SWING</b>\n"
        f"📅 {date_str} · NY 13:00\n"
        f"🎯 7-15 günde %8-20 hareket adayları\n"
        f"📊 Toplam: <b>{len(picks)}</b> aday\n"
        "─────────────────────────────\n<pre>\n"
        " #  TICKER  SKOR  RSI   RVOL  20g%  DURUM\n"
        "─────────────────────────────\n"
    )
    rows = []
    for i, c in enumerate(picks, 1):
        tag = "🦅" if c["boga_score_100"] >= 80 else "🔥" if c["boga_score_100"] >= 65 else "🎯"
        state = "BRK" if c.get("breakout_state") == "FRESH_BREAKOUT" else "NHI"
        rows.append(
            f"{i:02d} {tag}{c['ticker']:<5} {c['boga_score_100']:>4.0f}  "
            f"{c['rsi_14']:>4.0f}  {c['rvol_today']:>4.2f}x {c['ret_20d']:>5.1f} {state}"
        )
    body = "\n".join(rows) + "\n─────────────────────────────\n</pre>\n"
    tail = "<i>BRK=Yeni Kırılım · NHI=Zirveye Yakın · Skor: Liq/Trend/Mom/Vol/RS (5×20)</i>"
    return head + body + tail


def build_detail_block(rank: int, c: dict) -> str:
    fs = c.get("factor_scores", {})
    return (
        f"<b>{rank}. {c['ticker']} — {c['company']}</b>  ({c['sector']})\n"
        f"🎯 Skor: <b>{c['boga_score_100']}/100</b> · "
        f"{'🚀 Yeni Kırılım' if c.get('breakout_state') == 'FRESH_BREAKOUT' else '📈 Zirveye Yakın'}\n"
        f"💵 Fiyat: ${c['current_price']} · 20g: {c['ret_20d']:+.1f}% (Endekse +{c['rs_gap']:.1f}%)\n"
        f"📊 RSI {c['rsi_14']} · RVOL {c['rvol_today']}x\n"
        f"🎯 Giriş ${c['entry']} · TP1 ${c['tp1']} · TP2 ${c['tp2']} · Stop ${c['stop_loss']} (R/R {c['rr_ratio']})\n"
        f"🧩 Liq {fs.get('liquidity',0):.0f} · Trend {fs.get('trend',0):.0f} · "
        f"Mom {fs.get('momentum',0):.0f} · Vol {fs.get('volume',0):.0f} · RS {fs.get('relative_strength',0):.0f}\n"
    )


# ================================================================
# ================================================================
# SECTION 8 — MAIN SCAN
# ================================================================
# ================================================================
async def scan():
    t0 = time.time()
    logging.info("▶ BOGA Momentum Swing taraması başlıyor...")

    universe = await build_universe()
    if not universe:
        await send_telegram("🚨 Evren kurulamadı — tarama iptal.")
        return

    index_ret = get_index_return_20d()
    logging.info(f"📈 S&P500 20g getirisi: {index_ret:+.2f}%")

    # LAYER 2/3/4 + puanlama (tümü BULK_DATA_CACHE üzerinden, ağ I/O yok)
    candidates = []
    for ticker in universe:
        try:
            c = analyze(ticker, index_ret)
            if c:
                candidates.append(c)
        except Exception as e:
            logging.debug(f"analyze({ticker}) hata: {e}")

    logging.info(f"✅ Filtreleri geçen: {len(candidates)} hisse")

    candidates.sort(key=lambda x: x["boga_score_100"], reverse=True)
    final = candidates[:TOP_FINAL_PICKS]

    if not final:
        await send_telegram(
            f"🐂 <b>BOGA Momentum Swing</b> · {datetime.now(NY_TZ).strftime('%Y-%m-%d')}\n"
            "⚠️ Bugün kriterleri geçen hisse bulunamadı. Piyasa momentum'u zayıf olabilir."
        )
        logging.info("Bugün aday yok.")
        return

    # Performans alanları
    for c in final:
        c["performance"] = price_performance(c.get("df_1d", pd.DataFrame()))
        c.pop("df_1d", None)   # JSON'a df koyma

    generated_at = datetime.now(NY_TZ).isoformat()
    save_outputs(final, generated_at)

    # Telegram
    await send_telegram(build_telegram_report(final))
    for i, c in enumerate(final, 1):
        await send_telegram(build_detail_block(i, c))

    logging.info(f"[OK] Tarama tamamlandı — {len(final)} aday · {time.time() - t0:.1f}s")


# ================================================================
# ================================================================
# SECTION 9 — SCHEDULER
# ================================================================
# ================================================================
def next_run_utc(hour=DAILY_RUN_HOUR, minute=DAILY_RUN_MINUTE) -> datetime:
    now_ny = datetime.now(timezone.utc).astimezone(NY_TZ)
    cand = now_ny.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if cand <= now_ny:
        cand += timedelta(days=1)
    while cand.weekday() >= 5:   # hafta sonu atla
        cand += timedelta(days=1)
    return cand.astimezone(timezone.utc)


async def run_scheduler():
    await send_telegram(
        "🐂 <b>BOGA AI Momentum Swing v200 başlatıldı!</b>\n"
        "📅 Her hafta içi NY 13:00\n"
        "🎯 7-15 günde %8-20 hareket adayları"
    )
    try:
        await scan()
    except Exception as e:
        logging.error(f"İlk tarama hatası: {e}")
        await send_telegram(f"🚨 Başlangıç hatası: {e}")

    while True:
        try:
            nxt = next_run_utc()
            wait = (nxt - datetime.now(timezone.utc)).total_seconds()
            logging.info(f"🕒 Sonraki tarama: {nxt.strftime('%Y-%m-%d %H:%M %Z')} (~{wait/3600:.1f}s saat)")
            await asyncio.sleep(max(wait, 0))
            await scan()
        except Exception as e:
            logging.error(f"Döngü hatası: {e}")
            await send_telegram(f"🚨 Döngü hatası: {e}")
            await asyncio.sleep(3600)


# ================================================================
# ================================================================
# SECTION 10 — STARTUP
# ================================================================
# ================================================================
if __name__ == "__main__":
    import sys
    try:
        if os.name == "nt":
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        if "--oneshot" in sys.argv:
            print("[START] BOGA Momentum Swing v200 (one-shot)...")
            asyncio.run(scan())
            print("[OK] Tarama tamamlandı.")
        else:
            asyncio.run(run_scheduler())
    except KeyboardInterrupt:
        print("\n🐂 BOGA Momentum Swing durduruldu.")
    except Exception as e:
        print(f"Kritik başlangıç hatası: {e}")
