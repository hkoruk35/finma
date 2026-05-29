"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🚀 BOGA AI v219 — PRE-EXPLOSION GAMMA MOMENTUM SCANNER                  ║
║   "1-3 günde %40+ opsiyon hareketi" avcısı                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  v218 → v219  YENİ MODÜLLER:                                               ║
║                                                                              ║
║  ✅ MOD-1: PRE-EXPLOSION DETECTOR (BB Daraltma + ATR Sıkışma + NR7/NR4)   ║
║  ✅ MOD-2: GAMMA EXPANSION ENGINE (gamma/dollar, gamma cluster, call wall) ║
║  ✅ MOD-3: OPTIONS FLOW UPGRADE (sweep, ask-side ratio, same-day OI growth)║
║  ✅ MOD-4: DELTA 0.28-0.45 (agresif gamma sweet spot)                     ║
║  ✅ MOD-5: IV CONTEXT ENGINE (yüksek IV her zaman kötü değil!)             ║
║  ✅ MOD-6: INTRADAY VOLUME ACCELERATION (opening drive + 1H spike)         ║
║  ✅ MOD-7: SECTOR MOMENTUM ENGINE (hot sector önceliği)                    ║
║  ✅ MOD-8: MARKET REGIME V2 (QQQ + breadth + put/call)                    ║
║  ✅ MOD-9: DYNAMIC EXIT ENGINE (gamma squeeze / parabolic / trailing)      ║
║  ✅ MOD-10: DTE 15-90 (eski 45-90'dan daha agresif kısa vade)             ║
║                                                                              ║
║  PUANLAMA (0-100):                                                          ║
║  • Pre-Explosion (BB+ATR+NR7)     : 0-20  ← YENİ                          ║
║  • Gamma Expansion Skoru          : 0-15  ← YENİ                          ║
║  • EMA Giriş Modu + Yapı          : 0-20  (eski 30, azaltıldı)            ║
║  • Market Regime V2               : 0-10  ← YENİ                          ║
║  • Sector Momentum                : 0-10  ← YENİ                          ║
║  • RSI + Momentum                 : 0-10                                   ║
║  • Relative Strength (SPY)        : 0-10                                   ║
║  • Volume Acceleration            : 0-10  ← YENİ                          ║
║  • IV Context                     : 0-10  ← YENİ                          ║
║  • Options Flow (Sweep+UOA)       : 0-15  ← GELİŞTİRİLDİ                 ║
║  + Bonuslar: GoldenCross +5, EMA200 Breakout +7, BigSweep +5              ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import sys
import io
import logging
import time
import math
import html
import os
import re
import json
import aiohttp
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, date, timezone
from typing import List, Dict, Any, Optional, Tuple
from zoneinfo import ZoneInfo
from ta.volatility import AverageTrueRange, BollingerBands
from ta.trend import EMAIndicator, ADXIndicator
from ta.momentum import RSIIndicator

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    from scipy.stats import norm as _norm
    norm_cdf = lambda x: float(_norm.cdf(x))
    norm_pdf = lambda x: float(_norm.pdf(x))
except ImportError:
    norm_cdf = lambda x: (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0
    norm_pdf = lambda x: math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)

logging.basicConfig(level=logging.INFO, format="%(asctime)s — %(levelname)s — %(message)s")
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# ════════════════════════════════════════════════════════════════════════════
# ⚙️  AYARLAR — v219 AGRESIF MOD
# ════════════════════════════════════════════════════════════════════════════

NY_TZ    = ZoneInfo("America/New_York")
HERE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# ── Telegram ──────────────────────────────────────────────────────────────
TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"
ENABLE_TELEGRAM  = True

# ── Hisse Filtresi ────────────────────────────────────────────────────────
PRICE_MIN      = 5.0
PRICE_MAX      = 250.0
AVG_VOL_MIN    = 100_000
DOLLAR_VOL_MIN = 300_000
ADX_MIN        = 10              # Agresif: erken trendleri yakala
RSI_MIN        = 25              # Oversold bounce için gevşetildi
RSI_MAX        = 85

# ── Opsiyon Filtresi (v219: AGRESIF MOD) ─────────────────────────────────
DTE_MIN    = 15    # ✅ YENİ: 45→15 (kısa vade için daha yüksek gamma)
DTE_MAX    = 90
DTE_TARGET = 45    # ✅ YENİ: 67→45 (gamma sweet spot)
OI_MIN     = 50    # Gevşetildi
SPREAD_MAX = 0.10
MID_MIN    = 0.05  # Gevşetildi: ucuz kontratlara erişim
MID_MAX    = 2.00  # $200 max kontrat

# ── Delta Aralığı (v219: GAMMAoptimized) ─────────────────────────────────
# ✅ MOD-4: 0.28-0.45 sweet spot (yüksek gamma leverage, uygun maliyet)
DELTA_AGGRESSIVE_MIN = 0.28
DELTA_AGGRESSIVE_MAX = 0.45
DELTA_SAFE_MIN       = 0.45
DELTA_SAFE_MAX       = 0.62

# ── IV Context (v219: Dinamik) ────────────────────────────────────────────
# ✅ MOD-5: Yüksek IV her zaman kötü değil
IV_RANK_HARD_MAX   = 80.0   # Sadece >80 gerçekten kötü
IV_RANK_BONUS_MAX  = 25.0   # Düşük IV bonus eşiği

# ── Exit (v219: Dynamic) ──────────────────────────────────────────────────
TAKE_PROFIT_PCT  = 0.40
STOP_LOSS_PCT    = -0.30
TIME_STOP_RATIO  = 0.60

# ── Tarama ────────────────────────────────────────────────────────────────
MAX_TICKERS_SCAN = 500
UNIVERSE_TTL     = 24 * 3600
SEMAPHORE_N      = 6
MIN_CANDIDATES   = 3

# ── HOT SECTORS (v219: MOD-7) ─────────────────────────────────────────────
HOT_SECTORS = {
    "Technology":           12,
    "Semiconductors":       15,
    "Communication Services": 8,
    "Consumer Discretionary": 7,
    "Health Care":          10,
    "Financials":           6,
    "Energy":               8,
    "Industrials":          5,
    "Utilities":            2,
    "Real Estate":          2,
    "Materials":            4,
    "Consumer Staples":     3,
}

# Sektör ETF haritası (relative strength için)
SECTOR_ETFS = {
    "Technology": "XLK",
    "Semiconductors": "SOXX",
    "Communication Services": "XLC",
    "Consumer Discretionary": "XLY",
    "Health Care": "XLV",
    "Financials": "XLF",
    "Energy": "XLE",
}

UNIVERSE_CACHE: Dict[str, Any]   = {"ts": 0.0, "data": []}
MARKET_VIX                        = {"value": 18.0, "regime": "Orta 🟡"}
SPY_RETURN_CACHE: Dict[str, Any]  = {"ts": 0.0, "return_60d": 0.0, "return_20d": 0.0}
QQQ_RETURN_CACHE: Dict[str, Any]  = {"ts": 0.0, "return_5d": 0.0, "return_20d": 0.0}
SECTOR_MOMENTUM_CACHE: Dict[str, float] = {}
MARKET_REGIME_V2: Dict[str, Any]  = {"regime": "bull", "score": 50, "updated": 0}

EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# ════════════════════════════════════════════════════════════════════════════
# 1) TELEGRAM
# ════════════════════════════════════════════════════════════════════════════

def sanitize_html(text: str) -> str:
    if not text: return ""
    allowed = {
        "<b>": "▶B◀", "</b>": "▶/B◀",
        "<i>": "▶I◀", "</i>": "▶/I◀",
        "<pre>": "▶PRE◀", "</pre>": "▶/PRE◀",
        "<code>": "▶CODE◀", "</code>": "▶/CODE◀",
    }
    result = text
    for tag, ph in allowed.items():
        result = result.replace(tag, ph)
    result = result.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for tag, ph in allowed.items():
        result = result.replace(ph, tag)
    return result

def split_safe(msg: str, limit: int = 3800) -> list:
    if len(msg) <= limit: return [msg]
    chunks, lines, current = [], msg.split("\n"), ""
    for line in lines:
        candidate = current + ("\n" if current else "") + line
        if len(candidate) > limit:
            if current: chunks.append(current)
            if len(line) > limit:
                for i in range(0, len(line), limit): chunks.append(line[i:i+limit])
                current = ""
            else:
                current = line
        else:
            current = candidate
    if current: chunks.append(current)
    return chunks

async def send_tg(msg: str):
    if not ENABLE_TELEGRAM:
        print(msg); return
    safe_msg = sanitize_html(msg)
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    async with aiohttp.ClientSession() as s:
        for chunk in split_safe(safe_msg):
            if not chunk.strip(): continue
            try:
                async with s.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID, "text": chunk,
                    "parse_mode": "HTML", "disable_web_page_preview": True
                }, timeout=20) as r:
                    if r.status != 200:
                        body = await r.text()
                        if r.status == 400 and "parse" in body.lower():
                            plain = re.sub(r'<[^>]+>', '', chunk)
                            async with s.post(url, json={
                                "chat_id": TELEGRAM_CHAT_ID, "text": plain[:3800],
                            }, timeout=20): pass
                await asyncio.sleep(0.4)
            except Exception as e:
                logging.error(f"TG: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 2) PİYASA VERİLERİ (VIX / SPY / QQQ / SEKTÖR)
# ════════════════════════════════════════════════════════════════════════════

async def update_vix():
    try:
        vd = await asyncio.to_thread(lambda: yf.Ticker("^VIX").history(period="5d"))
        if vd is not None and not vd.empty:
            v = float(vd['Close'].iloc[-1])
            r = "Düşük 🟢" if v < 18 else ("Orta 🟡" if v < 25 else "Yüksek 🔴")
            MARKET_VIX.update({"value": v, "regime": r})
            logging.info(f"🌡️ VIX: {v:.1f} ({r})")
    except Exception as e:
        logging.warning(f"VIX: {e}")

async def update_spy_returns():
    now = time.time()
    if SPY_RETURN_CACHE["ts"] and (now - SPY_RETURN_CACHE["ts"] < 3600): return
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("SPY").history(period="100d", interval="1d"))
        if df is not None and len(df) >= 65:
            c = df['Close'].astype(float)
            r60 = float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100) if len(c) >= 61 else 0.0
            r20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            SPY_RETURN_CACHE.update({"ts": now, "return_60d": r60, "return_20d": r20})
    except Exception as e:
        logging.warning(f"SPY: {e}")

async def update_qqq_regime():
    """
    ✅ MOD-8: QQQ momentum + market breadth proxy
    """
    now = time.time()
    if QQQ_RETURN_CACHE["ts"] and (now - QQQ_RETURN_CACHE["ts"] < 3600): return
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("QQQ").history(period="60d", interval="1d"))
        if df is not None and len(df) >= 22:
            c = df['Close'].astype(float)
            r5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
            r20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            QQQ_RETURN_CACHE.update({"ts": now, "return_5d": r5, "return_20d": r20})

        # Market Regime V2 hesapla
        vix_val = MARKET_VIX.get("value", 20.0)
        qqq_5d  = QQQ_RETURN_CACHE.get("return_5d", 0.0)
        qqq_20d = QQQ_RETURN_CACHE.get("return_20d", 0.0)

        regime_score = 50  # Nötr başlangıç
        if vix_val < 16:    regime_score += 20
        elif vix_val < 20:  regime_score += 10
        elif vix_val > 30:  regime_score -= 25
        elif vix_val > 25:  regime_score -= 15

        if qqq_5d > 2:    regime_score += 15
        elif qqq_5d > 0:  regime_score += 8
        elif qqq_5d < -2: regime_score -= 15
        elif qqq_5d < 0:  regime_score -= 8

        if qqq_20d > 5:    regime_score += 10
        elif qqq_20d > 0:  regime_score += 5
        elif qqq_20d < -5: regime_score -= 10

        regime_score = max(0, min(100, regime_score))

        if regime_score >= 65:     regime = "bull"
        elif regime_score >= 40:   regime = "neutral"
        else:                      regime = "bear"

        MARKET_REGIME_V2.update({
            "regime": regime, "score": regime_score,
            "qqq_5d": round(qqq_5d, 2), "qqq_20d": round(qqq_20d, 2),
            "updated": now
        })
        logging.info(f"📊 Piyasa Rejimi V2: {regime.upper()} ({regime_score}/100) | QQQ 5g:{qqq_5d:+.1f}%")
    except Exception as e:
        logging.warning(f"QQQ Regime: {e}")

async def update_sector_momentum():
    """
    ✅ MOD-7: Sektör ETF momentum güncelle
    """
    now = time.time()
    if SECTOR_MOMENTUM_CACHE and (now - MARKET_REGIME_V2.get("updated", 0) < 3600): return
    tickers = list(SECTOR_ETFS.values()) + ["SPY"]
    try:
        for etf in tickers:
            try:
                df = await asyncio.to_thread(lambda t=etf: yf.Ticker(t).history(period="30d", interval="1d"))
                if df is not None and len(df) >= 10:
                    c = df['Close'].astype(float)
                    r5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
                    r10 = float((c.iloc[-1] - c.iloc[-11]) / c.iloc[-11] * 100) if len(c) >= 11 else 0.0
                    SECTOR_MOMENTUM_CACHE[etf] = round((r5 * 0.6 + r10 * 0.4), 2)
                await asyncio.sleep(0.1)
            except: pass
        logging.info(f"📊 Sektör momentumu güncellendi: {len(SECTOR_MOMENTUM_CACHE)} ETF")
    except Exception as e:
        logging.warning(f"Sektör momentum: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 3) MATEMATİK ARAÇLARI
# ════════════════════════════════════════════════════════════════════════════

def bs_greeks(S: float, K: float, T: float, r: float, sigma: float) -> dict:
    empty = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0: return empty
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sq)
        d2 = d1 - sigma * sq
        nd1 = norm_pdf(d1)
        return {
            "delta": round(norm_cdf(d1), 4),
            "gamma": round(nd1 / (S * sigma * sq), 5),
            "theta": round((-(S * nd1 * sigma) / (2 * sq) - r * K * math.exp(-r * T) * norm_cdf(d2)) / 365, 4),
            "vega":  round(S * nd1 * sq / 100, 4),
        }
    except:
        return empty

def bs_price(S: float, K: float, T: float, r: float, sigma: float) -> float:
    if T <= 0 or sigma <= 0: return max(0.0, S - K)
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sq)
        d2 = d1 - sigma * sq
        return round(S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2), 4)
    except:
        return 0.0

def calc_expected_move(price: float, iv: float, dte: int) -> float:
    return round(price * iv * math.sqrt(dte / 365.0), 2)

def calc_hv(close: pd.Series, lb: int = 20) -> float:
    if len(close) < lb + 1: return 0.30
    lr = np.log(close / close.shift(1)).dropna()
    return max(0.05, float(lr.tail(lb).std()) * math.sqrt(252))

def calc_iv_rank(current_iv: float, close: pd.Series) -> Tuple[float, float]:
    try:
        if len(close) < 60: return 50.0, 50.0
        lr  = np.log(close / close.shift(1)).dropna()
        hvs = (lr.rolling(20).std() * math.sqrt(252)).dropna()
        if len(hvs) < 10: return 50.0, 50.0
        mn = float(hvs.min()); mx = float(hvs.max())
        rank = max(0.0, min(100.0, (current_iv - mn) / (mx - mn) * 100)) if (mx - mn) > 0.001 else 50.0
        pct  = float((hvs < current_iv).sum()) / len(hvs) * 100
        return round(rank, 1), round(pct, 1)
    except:
        return 50.0, 50.0

def calc_vwap(df: pd.DataFrame) -> float:
    try:
        d  = df.tail(20).copy()
        tp = (d['High'].astype(float) + d['Low'].astype(float) + d['Close'].astype(float)) / 3.0
        vol = d['Volume'].astype(float)
        return round(float((tp * vol).sum() / vol.sum()), 3)
    except:
        return 0.0

def bs_pnl_sim(S: float, K: float, iv: float, dte: int,
               move_pct: float = 0.07, days_fwd: int = 3) -> dict:
    T_now = dte / 365.0
    T_fwd = max((dte - days_fwd) / 365.0, 0.001)
    S_fwd = S * (1 + move_pct)
    iv_fwd = iv * 0.92 if dte > 30 else iv * 0.88  # IV crush daha sert kısa vadede
    r = 0.05
    p_now = bs_price(S, K, T_now, r, iv)
    p_fwd = bs_price(S_fwd, K, T_fwd, r, iv_fwd)
    pnl_pct = round((p_fwd - p_now) / p_now * 100, 1) if p_now > 0 else 0.0
    return {
        "price_now": round(p_now, 2), "price_fwd": round(p_fwd, 2),
        "pnl_pct":   pnl_pct, "days_fwd": days_fwd,
    }

# ════════════════════════════════════════════════════════════════════════════
# 4) EVREN OLUŞTURUCU
# ════════════════════════════════════════════════════════════════════════════

async def build_universe() -> List[str]:
    now = time.time()
    if UNIVERSE_CACHE["ts"] and (now - UNIVERSE_CACHE["ts"] < UNIVERSE_TTL) and UNIVERSE_CACHE["data"]:
        logging.info(f"📋 Cache'den {len(UNIVERSE_CACHE['data'])} ticker")
        return UNIVERSE_CACHE["data"]

    tickers_raw: List[str] = []
    async with aiohttp.ClientSession() as s:
        for url in EXCHANGE_SOURCES:
            try:
                async with s.get(url, timeout=20) as r:
                    if r.status == 200:
                        text = await r.text()
                        if ".txt" in url:
                            tickers_raw += [t.strip().upper() for t in text.splitlines() if t.strip()]
                        else:
                            lines = text.splitlines()
                            for line in lines[1:]:
                                parts = line.split(",")
                                if parts: tickers_raw.append(parts[0].strip().upper())
            except Exception as e:
                logging.warning(f"Evren kaynağı: {e}")

    # Filtrele: tek sembol, harf, no slash/dot
    valid = list({t for t in tickers_raw
                  if 1 <= len(t) <= 5 and re.match(r'^[A-Z]+$', t)})
    valid.sort()

    # Hacim/fiyat filtresi (Katman 1)
    logging.info(f"🔍 Katman 1: {len(valid)} hisse taranıyor...")
    passed: List[str] = []
    sem = asyncio.Semaphore(20)

    async def quick_check(ticker: str):
        async with sem:
            try:
                df = await asyncio.wait_for(asyncio.to_thread(
                    lambda: yf.Ticker(ticker).history(period="5d", interval="1d")
                ), timeout=10)
                if df is None or len(df) < 2: return
                cp  = float(df['Close'].iloc[-1])
                vol = float(df['Volume'].tail(3).mean())
                dv  = cp * vol
                if PRICE_MIN <= cp <= PRICE_MAX and vol >= AVG_VOL_MIN and dv >= DOLLAR_VOL_MIN:
                    passed.append(ticker)
            except: pass

    tasks = [quick_check(t) for t in valid[:MAX_TICKERS_SCAN]]
    await asyncio.gather(*tasks)
    random.shuffle(passed) if len(passed) > MAX_TICKERS_SCAN else None
    result = passed[:MAX_TICKERS_SCAN]

    UNIVERSE_CACHE.update({"ts": now, "data": result})
    logging.info(f"✅ Evren: {len(result)} hisse")
    return result

try:
    import random
except: pass

# ════════════════════════════════════════════════════════════════════════════
# 5) KATMAN 2 — EMA TREND ANALİZİ
# ════════════════════════════════════════════════════════════════════════════

def layer2_ema_trend(df: pd.DataFrame) -> Tuple[bool, dict]:
    try:
        c  = df['Close'].astype(float)
        if len(c) < 210: return False, {}

        e9v   = float(EMAIndicator(c, 9).ema_indicator().iloc[-1])
        e20v  = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])
        e50v  = float(EMAIndicator(c, 50).ema_indicator().iloc[-1])
        e200v = float(EMAIndicator(c, 200).ema_indicator().iloc[-1])
        cp    = float(c.iloc[-1])
        prev_cp = float(c.iloc[-2])

        e20_series  = EMAIndicator(c, 20).ema_indicator()
        e50_series  = EMAIndicator(c, 50).ema_indicator()
        prev_e20    = float(e20_series.iloc[-2]) if len(e20_series) >= 2 else e20v
        prev_e50    = float(e50_series.iloc[-2]) if len(e50_series) >= 2 else e50v
        e50_slope   = float((e50v - float(e50_series.iloc[-6])) / float(e50_series.iloc[-6]) * 100) if len(e50_series) >= 6 else 0.0

        golden_cross    = (prev_e20 <= prev_e50) and (e20v > e50v)
        near_golden     = (e20v > e50v) and ((e20v - e50v) / e50v < 0.03)
        ema200_breakout = (prev_cp < e200v) and (cp >= e200v)

        dist_ema50 = (cp - e50v) / e50v if e50v > 0 else 0.0
        dist_ema20 = (cp - e20v) / e20v if e20v > 0 else 0.0

        mod_a = (e20v > e50v > e200v) and (dist_ema20 <= 0.08) and (e50_slope >= 0.0)
        mod_b = ema200_breakout
        mod_c = (e20v > e50v) and (-0.02 <= dist_ema50 <= 0.04)
        mod_d = (cp > e20v > e50v > e200v) and (e50_slope >= 0.0)

        entry_mode = None
        if mod_b:                        entry_mode = "EMA200_BREAKOUT"
        elif golden_cross:               entry_mode = "GOLDEN_CROSS"
        elif mod_a and near_golden:      entry_mode = "NEAR_GOLDEN"
        elif mod_a:                      entry_mode = "TREND_BIRTH"
        elif mod_c:                      entry_mode = "EMA50_BOUNCE"
        elif mod_d:                      entry_mode = "ESTABLISHED_TREND"
        else:                            return False, {}

        if cp < e200v:
            if entry_mode not in ("EMA200_BREAKOUT", "GOLDEN_CROSS"):
                return False, {}
            entry_mode = entry_mode + "_BELOW200"

        adx_ind   = ADXIndicator(df['High'], df['Low'], c, 14)
        adx_val   = float(adx_ind.adx().iloc[-1])
        early_modes = ("EMA200_BREAKOUT", "EMA200_BREAKOUT_BELOW200",
                       "GOLDEN_CROSS", "GOLDEN_CROSS_BELOW200")
        adx_thr   = 10 if entry_mode in early_modes else ADX_MIN
        if adx_val < adx_thr: return False, {}

        # Rejim (basit)
        full_align = (e20v > e50v > e200v) and (cp > e200v)
        if ema200_breakout:             regime = "breakout"
        elif adx_val >= 20 and full_align: regime = "trend"
        elif adx_val >= 15 and full_align: regime = "breakout"
        else:                           regime = "neutral"

        # Nötr yasak (sadece erken sinyalsiz)
        if regime == "neutral":
            if entry_mode not in ("EMA200_BREAKOUT", "GOLDEN_CROSS", "NEAR_GOLDEN"):
                return False, {}

        vwap = calc_vwap(df)

        # EMA Skoru (0-20, v219'da azaltıldı — pre-explosion daha önemli)
        mode_scores = {
            "EMA200_BREAKOUT": 12.0, "GOLDEN_CROSS": 10.0,
            "NEAR_GOLDEN": 8.0, "TREND_BIRTH": 7.0,
            "ESTABLISHED_TREND": 6.0, "EMA50_BOUNCE": 5.0,
        }
        ema_score = mode_scores.get(entry_mode, 0.0)
        if e20v > e50v:   ema_score += 2.0
        if e50v > e200v:  ema_score += 2.0
        if e9v > e20v:    ema_score += 1.5
        if e50_slope >= 0.3: ema_score += 2.5
        elif e50_slope >= 0.1: ema_score += 1.5
        if 0.0 <= dist_ema50 <= 0.03: ema_score += 3.0
        elif 0.03 < dist_ema50 <= 0.06: ema_score += 1.5
        ema_score = min(ema_score, 20.0)

        adx_score = 15.0 if adx_val >= 35 else (12.0 if adx_val >= 28 else (8.0 if adx_val >= 20 else (5.0 if adx_val >= 14 else 2.0)))
        adx_score = min(adx_score, 10.0)  # v219: cap düşürüldü

        vwap_ok = (vwap > 0 and cp >= vwap)
        vwap_score = 10.0 if cp >= vwap * 1.01 else (6.0 if cp >= vwap else (2.0 if cp >= vwap * 0.98 else 0.0))

        return True, {
            "ema9": round(e9v, 3), "ema20": round(e20v, 3),
            "ema50": round(e50v, 3), "ema200": round(e200v, 3),
            "cp": round(cp, 3),
            "ema_score": round(ema_score, 1), "adx": round(adx_val, 1),
            "adx_score": round(adx_score, 1), "regime": regime,
            "vwap": round(vwap, 3), "vwap_ok": vwap_ok,
            "vwap_score": round(vwap_score, 1),
            "dist_ema20": round(dist_ema20 * 100, 2),
            "dist_ema50": round(dist_ema50 * 100, 2),
            "entry_mode": entry_mode,
            "golden_cross": golden_cross,
            "ema200_breakout": ema200_breakout,
            "e50_slope": round(e50_slope, 3),
        }
    except Exception as e:
        logging.debug(f"L2: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 6) KATMAN 3 — PRE-EXPLOSION DETECTOR (v219 YENİ)
# ════════════════════════════════════════════════════════════════════════════

def layer3_pre_explosion(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    ✅ MOD-1: PRE-EXPLOSION DETECTOR
    Patlama öncesi sıkışma sinyalleri:
    - BB Width Percentile (son 6 ayın en dar %10'u)
    - ATR Compression (5 gün düşüyor)
    - NR7 / NR4 (son N günün en dar aralığı)
    - Inside Day Cluster
    - Volatility Crush (5g realized vol < 20g)
    """
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 65: return False, {}

        # ── BB Width Percentile ───────────────────────────────────────────
        bb = BollingerBands(c, window=20, window_dev=2)
        bb_width = (bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()
        bb_width = bb_width.dropna()
        bb_current = float(bb_width.iloc[-1]) if not bb_width.empty else 0.05
        bb_pct = float((bb_width.tail(120) < bb_current).sum() / len(bb_width.tail(120)) * 100) if len(bb_width) >= 20 else 50.0
        # bb_pct düşükse = sıkışma (en dar %10 = bb_pct < 10)

        # ── ATR Compression ───────────────────────────────────────────────
        atr_series = AverageTrueRange(h, lo, c, 14).average_true_range().dropna()
        atr_current = float(atr_series.iloc[-1]) if not atr_series.empty else 1.0
        atr_5ago    = float(atr_series.iloc[-6]) if len(atr_series) >= 6 else atr_current
        atr_10ago   = float(atr_series.iloc[-11]) if len(atr_series) >= 11 else atr_current
        atr_falling = (atr_current < atr_5ago < atr_10ago)  # ATR sıralı düşüyor
        atr_comp_pct = (atr_5ago - atr_current) / atr_5ago * 100 if atr_5ago > 0 else 0.0

        # ── NR7 / NR4 Setup ───────────────────────────────────────────────
        daily_range = (h - lo).values
        nr7 = len(daily_range) >= 7 and daily_range[-1] == min(daily_range[-7:])
        nr4 = len(daily_range) >= 4 and daily_range[-1] == min(daily_range[-4:])

        # ── Inside Day ────────────────────────────────────────────────────
        inside_day = (float(h.iloc[-1]) <= float(h.iloc[-2]) and
                      float(lo.iloc[-1]) >= float(lo.iloc[-2]))
        inside_cluster = sum(
            1 for i in range(-3, 0)
            if (float(h.iloc[i]) <= float(h.iloc[i-1]) and
                float(lo.iloc[i]) >= float(lo.iloc[i-1]))
        ) >= 2

        # ── Realized Volatility Crush ─────────────────────────────────────
        lr = np.log(c / c.shift(1)).dropna()
        rv5  = float(lr.tail(5).std()  * math.sqrt(252)) if len(lr) >= 5  else 0.3
        rv20 = float(lr.tail(20).std() * math.sqrt(252)) if len(lr) >= 20 else 0.3
        vol_crush = rv5 < rv20 * 0.8  # 5g vol, 20g'nin %80'inden düşük

        # ── Hacim Dry-Up (patlama öncesi hacim sessizleşir) ───────────────
        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        v30 = float(vol.tail(30).mean()) if len(vol) >= 30 else v5
        vol_dryup = v5 < v20 * 0.85  # Sessiz hacim

        # ── ROC ve Direction Bias ─────────────────────────────────────────
        roc5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
        roc20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
        roc60 = float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100) if len(c) >= 61 else 0.0

        cp    = float(c.iloc[-1])
        high_20 = float(h.tail(20).max())
        high_60 = float(c.tail(60).max())
        dist_from_60h = (cp - high_60) / high_60 if high_60 > 0 else -1.0

        # ── PRE-EXPLOSION SKORU (0-20) ────────────────────────────────────
        pe_score = 0.0

        # BB Width Compression
        if bb_pct < 5:    pe_score += 7.0   # En dar %5 — kritik sıkışma
        elif bb_pct < 10: pe_score += 5.0   # En dar %10
        elif bb_pct < 20: pe_score += 3.0
        elif bb_pct < 35: pe_score += 1.0

        # ATR Compression
        if atr_falling and atr_comp_pct > 15: pe_score += 5.0
        elif atr_falling and atr_comp_pct > 8: pe_score += 3.0
        elif atr_falling: pe_score += 1.5

        # NR7/NR4
        if nr7:           pe_score += 4.0
        elif nr4:         pe_score += 2.5

        # Inside Day/Cluster
        if inside_cluster: pe_score += 3.0
        elif inside_day:   pe_score += 1.5

        # Vol Crush + Dry-Up
        if vol_crush and vol_dryup: pe_score += 3.0
        elif vol_crush or vol_dryup: pe_score += 1.5

        # Yön biası (yukarı yönlü sıkışma daha değerli)
        if roc20 > 0 and roc60 > 0: pe_score *= 1.2
        elif roc20 < -5:             pe_score *= 0.7

        pe_score = min(pe_score, 20.0)

        # ── VOLUME ACCELERATION (0-10) — MOD-6 ───────────────────────────
        # Intraday hacim ivmesi (günlük datadan proxy)
        vol_accel_score = 0.0
        if v5 > v30 * 2.0:    vol_accel_score = 10.0  # 2x hacim patlaması
        elif v5 > v30 * 1.5:  vol_accel_score = 7.0
        elif v5 > v30 * 1.2:  vol_accel_score = 4.0
        elif v5 > v30 * 1.0:  vol_accel_score = 2.0
        elif vol_dryup:        vol_accel_score = 3.0   # Dry-up da değerli (patlama öncesi)

        # ── RSI ───────────────────────────────────────────────────────────
        rsi_series = RSIIndicator(c, 14).rsi()
        rsi = float(rsi_series.iloc[-1])
        if not (RSI_MIN <= rsi <= RSI_MAX): return False, {}

        rsi_score = 10.0 if 40 <= rsi <= 65 else (7.0 if 35 <= rsi < 40 else (5.0 if 65 < rsi <= 75 else (3.0 if 25 <= rsi < 35 else 1.0)))

        # ── Relative Strength vs SPY ──────────────────────────────────────
        spy_r60 = SPY_RETURN_CACHE.get("return_60d", 0.0)
        rs_60 = roc60 - spy_r60
        rs_score = 10.0 if rs_60 >= 10 else (7.0 if rs_60 >= 5 else (5.0 if rs_60 >= 2 else (3.0 if rs_60 >= 0 else (1.0 if rs_60 >= -3 else 0.0))))

        # ── Higher Highs ──────────────────────────────────────────────────
        higher_highs = float(c.iloc[-1]) > float(c.iloc[-10]) > float(c.iloc[-20])

        # ── Breakout Proximity ────────────────────────────────────────────
        volume_spike = v5 > v30 * 1.2
        if dist_from_60h >= 0 and volume_spike: breakout_score = 10.0
        elif dist_from_60h >= 0:                 breakout_score = 7.0
        elif dist_from_60h >= -0.02:             breakout_score = 8.0
        elif dist_from_60h >= -0.05:             breakout_score = 5.0
        elif dist_from_60h >= -0.10:             breakout_score = 2.0
        else:                                    breakout_score = 0.0

        atr_val = atr_current
        atr_pct = (atr_val / cp) * 100 if cp > 0 else 2.0
        hv20 = calc_hv(c, 20)

        return True, {
            "rsi": round(rsi, 1), "rsi_score": round(rsi_score, 1),
            "roc5_pct": round(roc5, 2), "roc20_pct": round(roc20, 2), "roc60_pct": round(roc60, 2),
            "rs_score": round(rs_score, 1), "rs_60d": round(rs_60, 1),
            "atr_pct": round(atr_pct, 2), "hv20": round(hv20, 4),
            "v5": round(v5, 0), "v30": round(v30, 0),
            "rvol": round(v5 / v30, 2) if v30 > 0 else 1.0,
            # Pre-Explosion
            "pe_score": round(pe_score, 1),
            "bb_pct": round(bb_pct, 1),
            "atr_falling": atr_falling,
            "atr_comp_pct": round(atr_comp_pct, 1),
            "nr7": nr7, "nr4": nr4,
            "inside_day": inside_day, "inside_cluster": inside_cluster,
            "vol_crush": vol_crush, "vol_dryup": vol_dryup,
            # Volume
            "vol_accel_score": round(vol_accel_score, 1),
            "volume_spike": volume_spike,
            # Standard
            "high_60": round(high_60, 2),
            "breakout_score": round(breakout_score, 1),
            "higher_highs": higher_highs,
            "dist_from_60h": round(dist_from_60h * 100, 1),
        }
    except Exception as e:
        logging.debug(f"L3 Pre-Explosion: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 7) KATMAN 4 — GAMMA EXPANSION ENGINE (v219 YENİ)
# ════════════════════════════════════════════════════════════════════════════

def calc_gamma_expansion_score(calls_df: pd.DataFrame, cp: float, atm_iv: float, dte: int) -> dict:
    """
    ✅ MOD-2: GAMMA EXPANSION ENGINE
    - gamma/dollar oranı (gamma efficiency)
    - near-the-money gamma cluster
    - call wall tespiti (büyük OI yığılması)
    - gamma acceleration (DTE < 30 = gamma patlaması yakın)
    """
    try:
        r = 0.05
        T = dte / 365.0
        if T <= 0: T = 0.001

        gamma_vals = []
        gamma_dollars = []
        otm_oi_sum = 0.0
        atm_gamma_sum = 0.0

        for _, row in calls_df.iterrows():
            try:
                strike = float(row['strike'])
                iv_row = float(row.get('impliedVolatility', atm_iv) or atm_iv)
                mid    = (float(row.get('bid', 0) or 0) + float(row.get('ask', 0) or 0)) / 2.0
                oi     = int(row.get('openInterest', 0) or 0)

                if mid <= 0 or strike <= 0: continue

                g = bs_greeks(cp, strike, T, r, iv_row)
                gamma = g['gamma']

                # Gamma per dollar (gamma efficiency)
                if mid > 0:
                    gamma_dollar = gamma / mid
                    gamma_dollars.append(gamma_dollar)

                # Near-the-money: %5 yakınındaki strikeler
                if abs(strike - cp) / cp < 0.05:
                    atm_gamma_sum += gamma * oi
                    gamma_vals.append(gamma)

                # OTM call wall: büyük OI yığılması (breakout engeli)
                if strike > cp * 1.03 and oi > 1000:
                    otm_oi_sum += oi

            except: continue

        max_gamma_dollar = max(gamma_dollars) if gamma_dollars else 0.0
        avg_atm_gamma    = float(np.mean(gamma_vals)) if gamma_vals else 0.0

        # Gamma Acceleration: DTE azaldıkça gamma hızlanır
        gamma_accel = 1.0
        if dte <= 14:   gamma_accel = 3.0   # Haftalık — gamma en güçlü
        elif dte <= 21: gamma_accel = 2.5
        elif dte <= 30: gamma_accel = 2.0
        elif dte <= 45: gamma_accel = 1.5

        # GAMMA EXPANSION SKORU (0-15)
        ge_score = 0.0

        if max_gamma_dollar > 5.0:   ge_score += 6.0
        elif max_gamma_dollar > 2.0: ge_score += 4.0
        elif max_gamma_dollar > 1.0: ge_score += 2.0

        if avg_atm_gamma > 0.01:     ge_score += 5.0
        elif avg_atm_gamma > 0.005:  ge_score += 3.0
        elif avg_atm_gamma > 0.002:  ge_score += 1.5

        ge_score *= gamma_accel
        ge_score = min(ge_score, 15.0)

        call_wall_exists = otm_oi_sum > 5000
        call_wall_strength = "GÜÇLÜ DUVAR ⚠️" if call_wall_exists and otm_oi_sum > 20000 else \
                             ("HAFİF DUVAR" if call_wall_exists else "DUVAR YOK ✅")

        return {
            "ge_score": round(ge_score, 1),
            "max_gamma_dollar": round(max_gamma_dollar, 3),
            "avg_atm_gamma": round(avg_atm_gamma, 5),
            "gamma_accel": gamma_accel,
            "call_wall_oi": int(otm_oi_sum),
            "call_wall_strength": call_wall_strength,
        }
    except Exception as e:
        logging.debug(f"Gamma Expansion: {e}")
        return {"ge_score": 0.0, "max_gamma_dollar": 0.0, "avg_atm_gamma": 0.0,
                "gamma_accel": 1.0, "call_wall_oi": 0, "call_wall_strength": "—"}

# ════════════════════════════════════════════════════════════════════════════
# 8) IV CONTEXT ENGINE (v219 MOD-5)
# ════════════════════════════════════════════════════════════════════════════

def iv_context_engine(iv_rank: float, entry_mode: str, pe_score: float,
                      uoa_score: float = 0.0, hv: float = 0.3, atm_iv: float = 0.3) -> Tuple[float, str]:
    """
    ✅ MOD-5: IV Context Engine
    Yüksek IV her zaman kötü değil. Bağlama göre değerlendir:
    - Fresh breakout: IV yüksek ama hareket daha fazla
    - Squeeze/VCP: IV düşük = ucuz opsiyonlar
    - Institutional sweep: IV yükselirken akış pozitifse = devam eder
    - Dead trend: Yüksek IV = gerçekten kötü
    """
    iv_vs_hv = atm_iv / hv if hv > 0 else 1.0

    # Bağlam tespiti
    is_squeeze      = pe_score >= 10.0  # Sıkışma sinyali güçlü
    is_fresh_break  = entry_mode in ("EMA200_BREAKOUT", "GOLDEN_CROSS", "EMA200_BREAKOUT_BELOW200")
    is_inst_sweep   = uoa_score >= 40.0
    is_momentum     = entry_mode in ("TREND_BIRTH", "NEAR_GOLDEN")

    # IV Rank yorumu
    if iv_rank <= 20:
        score = 10.0
        label = "💰 ULTRA UCUZ IV — MÜKEMMEL GİRİŞ"
    elif iv_rank <= 30:
        score = 8.0
        label = "🟢 UCUZ IV — İYİ GİRİŞ"
    elif iv_rank <= 45:
        score = 6.0
        label = "🟡 ORTA IV — KABUL"
    elif iv_rank <= 60:
        # Bağlama göre karar
        if is_squeeze or is_fresh_break or is_inst_sweep:
            score = 5.0
            label = "🟠 IV YÜKSEK AMA BAĞLAM POZİTİF"
        else:
            score = 2.0
            label = "🔴 IV YÜKSEK — DİKKAT"
    elif iv_rank <= 75:
        if is_squeeze and is_inst_sweep:
            score = 4.0
            label = "🔴 IV YÜKSEK — KURUMSAL AKIŞ + SIKIŞ → İZİN"
        elif is_fresh_break:
            score = 3.0
            label = "🔴 IV YÜKSEK — TAZE KIRILIM → DİKKATLİ GİR"
        else:
            score = 0.0
            label = "🚫 IV ÇOK YÜKSEK — PAHALI OPSIYON"
    else:
        score = 0.0
        label = "🚫 IV AŞIRI YÜKSEK — ATLA"

    # Hard block: IV > 80 ve bağlam zayıfsa
    if iv_rank > IV_RANK_HARD_MAX and not (is_squeeze and is_inst_sweep):
        return -5.0, "🚫 IV AŞIRI — HARD BLOCK"

    # IV/HV bonus
    if iv_vs_hv < 0.85:   score = min(score + 2.0, 10.0)
    elif iv_vs_hv > 1.5:  score = max(score - 2.0, 0.0)

    return round(score, 1), label

# ════════════════════════════════════════════════════════════════════════════
# 9) SECTOR MOMENTUM SCORER (v219 MOD-7)
# ════════════════════════════════════════════════════════════════════════════

async def get_sector_for_ticker(ticker: str) -> str:
    """Hissenin sektörünü yfinance'tan al."""
    try:
        info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
        return info.get("sector", "") or info.get("industry", "")
    except:
        return ""

def calc_sector_score(sector: str) -> float:
    """
    ✅ MOD-7: Sektör momentum skoru (0-10)
    Hot sektör + ETF momentum kombinasyonu
    """
    if not sector: return 3.0

    # Baz puan sektöre göre
    base = 3.0
    for sec_key, pts in HOT_SECTORS.items():
        if sec_key.lower() in sector.lower():
            base = min(pts / 15.0 * 7.0, 7.0)
            break

    # ETF momentum bonusu
    etf = None
    for sec_key, etf_sym in SECTOR_ETFS.items():
        if sec_key.lower() in sector.lower():
            etf = etf_sym; break

    if etf and etf in SECTOR_MOMENTUM_CACHE:
        etf_mom = SECTOR_MOMENTUM_CACHE[etf]
        spy_mom = SECTOR_MOMENTUM_CACHE.get("SPY", 0.0)
        rel_mom = etf_mom - spy_mom
        if rel_mom > 3:    base = min(base + 3.0, 10.0)
        elif rel_mom > 1:  base = min(base + 1.5, 10.0)
        elif rel_mom < -2: base = max(base - 2.0, 0.0)

    return round(base, 1)

# ════════════════════════════════════════════════════════════════════════════
# 10) MARKET REGIME V2 SCORE (v219 MOD-8)
# ════════════════════════════════════════════════════════════════════════════

def calc_regime_score() -> Tuple[float, str]:
    """
    ✅ MOD-8: Market Regime V2 skoru (0-10)
    """
    regime = MARKET_REGIME_V2.get("regime", "neutral")
    score  = MARKET_REGIME_V2.get("score", 50)

    # Agresif call bot için: sadece bull/neutral modda çalış
    if regime == "bear":
        return 0.0, "🔴 BEAR PİYASA — CALL ALMA"
    elif regime == "neutral":
        return 5.0, "🟡 NÖTR — DİKKATLİ DEVAM"
    else:  # bull
        if score >= 75: return 10.0, "🟢 GÜÇLÜ BOĞA — ATEŞ ET"
        else:           return 8.0,  "🟢 BOĞA PİYASA — DEVAM"

# ════════════════════════════════════════════════════════════════════════════
# 11) KATMAN 5 — OPSİYON ZİNCİRİ (v219: GAMMA + FLOW UPGRADE)
# ════════════════════════════════════════════════════════════════════════════

def max_pain(calls: pd.DataFrame, puts: pd.DataFrame, cp: float) -> float:
    try:
        strikes = sorted(set(list(calls['strike'].values) + list(puts['strike'].values)))
        bp = cp; bv = float('inf')
        for ts in strikes:
            call_pain = float(((ts - calls['strike']).clip(lower=0) * calls['openInterest'].fillna(0)).sum())
            put_pain  = float(((puts['strike'] - ts).clip(lower=0) * puts['openInterest'].fillna(0)).sum())
            tot = call_pain + put_pain
            if tot < bv: bv = tot; bp = ts
        return bp
    except:
        return cp

async def layer5_options(ticker: str, cp: float, close: pd.Series,
                          hv: float, l2: dict, l3: dict) -> Optional[dict]:
    """
    v219 Opsiyon Katmanı:
    - DTE 15-90 (agresif)
    - Delta 0.28-0.45 sweet spot
    - Gamma Expansion Engine
    - Gelişmiş Options Flow
    - IV Context Engine
    - Dynamic Exit Engine
    """
    try:
        stock = yf.Ticker(ticker)
        exps  = await asyncio.to_thread(lambda: stock.options)
        if not exps: return None

        today = date.today()
        iv_rank, iv_pct = calc_iv_rank(hv, close)
        atm_iv = hv * 1.15  # proxy

        best_result = None
        best_score  = -999.0

        for exp_str in exps:
            try:
                exp_date = datetime.strptime(exp_str, "%Y-%m-%d").date()
                dte = (exp_date - today).days
                if not (DTE_MIN <= dte <= DTE_MAX): continue
            except: continue

            try:
                chain = await asyncio.to_thread(lambda e=exp_str: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None and not chain.calls.empty else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None and not chain.puts.empty  else pd.DataFrame()
                if calls.empty: continue
            except: continue

            # ATM IV
            calls['strike'] = pd.to_numeric(calls['strike'], errors='coerce')
            calls = calls.dropna(subset=['strike'])
            atm_idx = (calls['strike'] - cp).abs().idxmin()
            atm_row = calls.loc[atm_idx]
            raw_iv  = float(atm_row.get('impliedVolatility', hv) or hv)
            atm_iv  = max(raw_iv, hv * 0.5)

            iv_rank_local, iv_pct_local = calc_iv_rank(atm_iv, close)
            em    = calc_expected_move(cp, atm_iv, dte)
            em_up = cp + em
            mp    = max_pain(calls, puts, cp)

            # IV Context
            entry_mode = l2.get("entry_mode", "")
            pe_score   = l3.get("pe_score", 0.0)

            # Gamma Expansion
            ge_data = calc_gamma_expansion_score(calls, cp, atm_iv, dte)

            # ── AGRESIF DELTA 0.28-0.45 (MOD-4) ─────────────────────────
            T = dte / 365.0
            r = 0.05

            # Sim günü: DTE'ye göre dinamik
            if dte <= 21:      sim_days = 2
            elif dte <= 45:    sim_days = 3
            else:              sim_days = 5

            # Exit dinamikleri
            if em / cp > 0.15:    dyn_tp, dyn_sl = 0.60, -0.35
            elif em / cp > 0.10:  dyn_tp, dyn_sl = 0.45, -0.30
            else:                 dyn_tp, dyn_sl = 0.40, -0.25

            time_stop = max(round(dte * (1 - TIME_STOP_RATIO)), 3)

            gamma_candidate = None
            safe_candidate  = None
            gamma_best_score = -999.0
            safe_best_score  = -999.0

            for _, row in calls.iterrows():
                try:
                    strike   = float(row['strike'])
                    raw_iv_r = float(row.get('impliedVolatility', atm_iv) or atm_iv)
                    iv_row   = max(raw_iv_r, 0.05)
                    bid      = float(row.get('bid', 0) or 0)
                    ask      = float(row.get('ask', 0) or 0)
                    if ask <= 0.03: continue
                    mid      = (bid + ask) / 2.0
                    spread_p = (ask - bid) / ask if ask > 0 else 1.0

                    if spread_p > SPREAD_MAX: continue
                    oi     = int(row.get('openInterest', 0) or 0)
                    volume = int(row.get('volume', 0) or 0)
                    if oi < OI_MIN: continue
                    if mid < MID_MIN: continue
                    if (ask * 100) > 200: continue
                    if strike > em_up * 1.08: continue

                    g     = bs_greeks(cp, strike, T, r, iv_row)
                    delta = g['delta']
                    gamma = g['gamma']
                    theta = g['theta']

                    # Theta/Delta kalite
                    td_ratio = abs(delta / theta) if theta != 0 else 999.0
                    if td_ratio < 0.03: continue

                    vol_oi = volume / oi if oi > 0 else 0.0

                    # ── GAMMA SWEET SPOT (0.28-0.45) ─────────────────────
                    if DELTA_AGGRESSIVE_MIN <= delta <= DELTA_AGGRESSIVE_MAX:
                        # Gamma efficiency score
                        geff  = gamma / mid if mid > 0 else 0.0

                        # OPTIONS FLOW SCORE (MOD-3)
                        flow_score = 0.0
                        if vol_oi >= 3.0:   flow_score += 15.0  # Sweep tespit
                        elif vol_oi >= 1.5: flow_score += 9.0
                        elif vol_oi >= 0.8: flow_score += 5.0
                        elif vol_oi >= 0.3: flow_score += 2.0

                        # Ask-side execution proxy (yüksek vol/oi + yüksek ask = ask-side)
                        if volume >= 200 and ask > bid * 1.1:
                            flow_score += 5.0  # Ask-side execution signal

                        # Same-day OI büyümesi proxy (vol > oi = yeni pozisyon)
                        if volume > oi * 0.5:
                            flow_score += 5.0  # Muhtemelen yeni açılış

                        # Premium büyüklüğü
                        if (volume * mid * 100) > 500_000: flow_score += 8.0
                        elif (volume * mid * 100) > 100_000: flow_score += 4.0

                        # Likidite
                        liq = 0.0
                        if spread_p <= 0.03:   liq += 5.0
                        elif spread_p <= 0.06: liq += 3.0
                        elif spread_p <= 0.10: liq += 1.0
                        if oi >= 1000: liq += 3.0
                        elif oi >= 300: liq += 1.5
                        if volume >= 200: liq += 2.0
                        liq = min(liq, 8.0)

                        candidate_score = (
                            flow_score +
                            geff * 2000.0 +
                            delta * 3.0 +
                            liq +
                            ge_data["ge_score"] * 0.5
                        )

                        if candidate_score > gamma_best_score:
                            gamma_best_score = candidate_score
                            atr_move = min(max(l3.get("atr_pct", 2.0) / 100 * 4.0, 0.04), 0.25)
                            sim = bs_pnl_sim(cp, strike, iv_row, dte, atr_move, sim_days)
                            gamma_candidate = {
                                "type": "🚀 GAMMA SWEET SPOT",
                                "regime": l2.get("regime", "neutral"),
                                "strike": strike, "expiration": exp_str, "dte": dte,
                                "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                                "spread_pct": round(spread_p * 100, 1),
                                "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi, 3),
                                "iv_pct": round(iv_row * 100, 1),
                                "delta": round(delta, 3), "gamma": round(gamma, 5),
                                "theta": round(theta, 4),
                                "gamma_efficiency": round(geff, 3),
                                "gamma_accel": ge_data["gamma_accel"],
                                "flow_score": round(flow_score, 1),
                                "liq_score": round(liq, 1),
                                "td_ratio": round(td_ratio, 2),
                                "cost_per_contract": round(ask * 100, 0),
                                "score": round(candidate_score, 2),
                                "sim": sim,
                                "breakeven": round(strike + ask, 2),
                                "tp_price": round(mid * (1 + dyn_tp), 2),
                                "sl_price": round(mid * (1 + dyn_sl), 2),
                                "time_stop_days": time_stop,
                                "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                            }

                    # ── SAFE DELTA (0.45-0.62) ────────────────────────────
                    elif DELTA_SAFE_MIN <= delta <= DELTA_SAFE_MAX:
                        liq = 0.0
                        if spread_p <= 0.02:   liq += 5.0
                        elif spread_p <= 0.04: liq += 3.5
                        elif spread_p <= 0.08: liq += 1.5
                        if oi >= 2000: liq += 3.0
                        elif oi >= 800: liq += 2.0
                        if volume >= 500: liq += 2.0
                        liq = min(liq, 10.0)

                        sweep = min(vol_oi * 5.0, 5.0)
                        td_b  = min((td_ratio - 0.04) / 2.0, 5.0)
                        s_score = delta * 4.0 + gamma * 1000.0 + liq + sweep + td_b

                        if s_score > safe_best_score:
                            safe_best_score = s_score
                            atr_move = min(max(l3.get("atr_pct", 2.0) / 100 * 3.0, 0.03), 0.18)
                            sim = bs_pnl_sim(cp, strike, iv_row, dte, atr_move, sim_days)
                            safe_candidate = {
                                "type": "🛡️ KURUMSAL SIĞINAK",
                                "regime": l2.get("regime", "neutral"),
                                "strike": strike, "expiration": exp_str, "dte": dte,
                                "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                                "spread_pct": round(spread_p * 100, 1),
                                "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi, 3),
                                "iv_pct": round(iv_row * 100, 1),
                                "delta": round(delta, 3), "gamma": round(gamma, 5),
                                "theta": round(theta, 4),
                                "gamma_efficiency": round(gamma / mid if mid > 0 else 0, 3),
                                "liq_score": round(liq, 1),
                                "td_ratio": round(td_ratio, 2),
                                "cost_per_contract": round(ask * 100, 0),
                                "score": round(s_score, 2),
                                "sim": sim,
                                "breakeven": round(strike + ask, 2),
                                "tp_price": round(mid * (1 + dyn_tp), 2),
                                "sl_price": round(mid * (1 + dyn_sl), 2),
                                "time_stop_days": time_stop,
                                "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                            }

                except: continue

            if gamma_candidate or safe_candidate:
                result_score = max(
                    gamma_best_score if gamma_candidate else -999.0,
                    safe_best_score  if safe_candidate  else -999.0
                )
                if result_score > best_score:
                    best_score = result_score
                    best_result = {
                        "exp_date": exp_str, "dte": dte,
                        "max_pain": round(mp, 2),
                        "em": round(em, 2), "em_upper": round(em_up, 2),
                        "atm_iv": round(atm_iv * 100, 1),
                        "iv_rank": iv_rank_local, "iv_pct_rank": iv_pct_local,
                        "iv_vs_hv": round(atm_iv / hv, 3) if hv > 0 else 1.0,
                        "ge_data": ge_data,
                        "gamma_sweet": gamma_candidate,
                        "institutional": safe_candidate,
                        # backward compat
                        "asymmetric": gamma_candidate,
                        "regime": l2.get("regime", "neutral"),
                    }

        return best_result
    except Exception as e:
        logging.debug(f"{ticker} Opsiyon L5: {e}")
        return None

# ════════════════════════════════════════════════════════════════════════════
# 12) UOA + EARNINGS DETECTOR (v219: geliştirilmiş flow)
# ════════════════════════════════════════════════════════════════════════════

async def detect_uoa_v219(ticker: str, cp: float) -> dict:
    """
    ✅ MOD-3: Gelişmiş Options Flow
    - Sweep detection (vol/oi > 3x)
    - Ask-side execution ratio
    - Repeated same-strike activity
    - Büyük premium bloklar ($100K+)
    - IV spike / gizli alım
    """
    result = {
        "uoa_score": 0.0, "uoa_signal": "—",
        "put_call_ratio": 0.0,
        "unusual_call_vol": False, "big_block_detected": False,
        "iv_spike_detected": False, "sweep_count": 0,
        "ask_side_ratio": 0.0, "total_premium_flow": 0.0,
        "earnings_days": None, "earnings_warning": False,
    }
    try:
        stock = yf.Ticker(ticker)
        today = date.today()

        # Earnings filtresi
        try:
            cal = await asyncio.to_thread(lambda: stock.calendar)
            if cal is not None:
                if isinstance(cal, dict):
                    earn_date = cal.get("Earnings Date", [None])[0]
                elif hasattr(cal, 'T'):
                    earn_row  = cal.T.get("Earnings Date", None)
                    earn_date = earn_row.iloc[0] if earn_row is not None and len(earn_row) > 0 else None
                else:
                    earn_date = None

                if earn_date is not None:
                    if hasattr(earn_date, 'date'): earn_date = earn_date.date()
                    elif isinstance(earn_date, str): earn_date = datetime.strptime(earn_date[:10], "%Y-%m-%d").date()
                    days_to_earn = (earn_date - today).days
                    result["earnings_days"] = days_to_earn
                    if 0 <= days_to_earn <= 10: result["earnings_warning"] = True
        except: pass

        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps: return result

        near_exps = []
        for d in exps:
            try:
                dte_d = (datetime.strptime(d, "%Y-%m-%d").date() - today).days
                if 1 <= dte_d <= 60: near_exps.append((d, dte_d))
            except: pass
        near_exps.sort(key=lambda x: x[1])
        near_exps = near_exps[:3]

        total_call_vol = 0
        total_put_vol  = 0
        total_call_oi  = 0
        max_vol_oi     = 0.0
        big_premium    = 0.0
        iv_values      = []
        sweep_events   = 0
        ask_side_vol   = 0
        total_vol_all  = 0

        for exp_d, _ in near_exps:
            try:
                chain = await asyncio.to_thread(lambda e=exp_d: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None else pd.DataFrame()

                if not calls.empty:
                    for col in ['volume', 'openInterest', 'ask', 'bid', 'impliedVolatility', 'strike']:
                        if col in calls.columns:
                            calls[col] = pd.to_numeric(calls[col], errors='coerce').fillna(0)

                    cv = float(calls['volume'].sum())
                    co = float(calls['openInterest'].sum())
                    total_call_vol += cv
                    total_call_oi  += co

                    for _, row in calls.iterrows():
                        oi_     = float(row.get('openInterest', 0))
                        vol_    = float(row.get('volume', 0))
                        iv_     = float(row.get('impliedVolatility', 0))
                        ask_    = float(row.get('ask', 0))
                        bid_    = float(row.get('bid', 0))
                        strike_ = float(row.get('strike', 0))
                        mid_    = (ask_ + bid_) / 2.0

                        if oi_ > 20 and vol_ > 0:
                            voi = vol_ / oi_
                            if voi > max_vol_oi: max_vol_oi = voi
                            # Sweep: vol/oi > 3 ve yeterli hacim
                            if voi >= 3.0 and vol_ >= 50: sweep_events += 1

                        # Ask-side proxy: yüksek ask alımı
                        if vol_ > 0 and ask_ > bid_ * 1.05:
                            ask_side_vol += int(vol_)
                        total_vol_all += int(vol_)

                        # Büyük OTM call blokları
                        if strike_ > cp * 1.03 and ask_ > 0.5 and vol_ >= 50:
                            big_premium += vol_ * mid_ * 100

                        if iv_ > 0.05: iv_values.append(iv_)

                if not puts.empty:
                    puts['volume'] = pd.to_numeric(puts.get('volume', 0), errors='coerce').fillna(0)
                    total_put_vol += float(puts['volume'].sum())
            except: continue

        # UOA Skoru
        uoa_score = 0.0

        pc_ratio = total_put_vol / total_call_vol if total_call_vol > 0 else 1.0
        result["put_call_ratio"] = round(pc_ratio, 2)
        if pc_ratio < 0.4:    uoa_score += 25.0
        elif pc_ratio < 0.6:  uoa_score += 15.0
        elif pc_ratio < 0.8:  uoa_score += 8.0
        elif pc_ratio > 1.5:  uoa_score -= 8.0

        # Sweep tespiti (MOD-3)
        result["sweep_count"] = sweep_events
        if sweep_events >= 3:   uoa_score += 25.0
        elif sweep_events >= 2: uoa_score += 18.0
        elif sweep_events >= 1: uoa_score += 10.0

        if max_vol_oi > 3.0:
            result["unusual_call_vol"] = True
            uoa_score += 20.0
        elif max_vol_oi > 1.5:
            result["unusual_call_vol"] = True
            uoa_score += 12.0
        elif max_vol_oi > 0.8:
            uoa_score += 6.0

        # Ask-side ratio
        ask_ratio = ask_side_vol / total_vol_all if total_vol_all > 0 else 0.5
        result["ask_side_ratio"] = round(ask_ratio, 2)
        if ask_ratio > 0.75:    uoa_score += 12.0
        elif ask_ratio > 0.60:  uoa_score += 7.0

        # Büyük premium blok
        result["total_premium_flow"] = round(big_premium, 0)
        if big_premium > 500_000:
            result["big_block_detected"] = True
            uoa_score += 30.0
        elif big_premium > 100_000:
            result["big_block_detected"] = True
            uoa_score += 18.0
        elif big_premium > 25_000:
            uoa_score += 8.0

        # IV spike
        if len(iv_values) > 5:
            iv_mean, iv_std = np.mean(iv_values), np.std(iv_values)
            if iv_std > 0:
                spikes = sum(1 for iv in iv_values if iv > iv_mean + 2 * iv_std)
                if spikes > 0:
                    result["iv_spike_detected"] = True
                    uoa_score += 12.0

        uoa_score = max(0.0, min(uoa_score, 100.0))
        result["uoa_score"] = round(uoa_score, 1)

        if uoa_score >= 60:   result["uoa_signal"] = "🔥 KURUMSAL SÜPÜRME"
        elif uoa_score >= 40: result["uoa_signal"] = "📈 GÜÇLÜ AKIŞ"
        elif uoa_score >= 20: result["uoa_signal"] = "👀 POZİTİF UOA"
        else:                 result["uoa_signal"] = "—"

    except Exception as e:
        logging.debug(f"UOA v219 {ticker}: {e}")

    return result

# ════════════════════════════════════════════════════════════════════════════
# 13) ANA ANALİZ
# ════════════════════════════════════════════════════════════════════════════

ANALYSIS_SEM    = asyncio.Semaphore(SEMAPHORE_N)
PROGRESS_COUNTER = 0
TOTAL_TO_SCAN   = 0

async def analyze(ticker: str) -> Optional[dict]:
    global PROGRESS_COUNTER
    async with ANALYSIS_SEM:
        try:
            PROGRESS_COUNTER += 1
            if PROGRESS_COUNTER % 10 == 0 or PROGRESS_COUNTER == 1:
                print(f"🔍 [{PROGRESS_COUNTER}/{TOTAL_TO_SCAN}] {ticker}")

            stock = yf.Ticker(ticker)
            df1d  = await asyncio.wait_for(asyncio.to_thread(
                lambda: stock.history(period="300d", interval="1d", auto_adjust=True)
            ), timeout=30)

            if df1d is None or len(df1d) < 210: return None

            df1d.columns = [
                str(c).strip().title()
                for c in (df1d.columns.get_level_values(0) if isinstance(df1d.columns, pd.MultiIndex) else df1d.columns)
            ]
            if 'Close' not in df1d.columns: return None

            close = df1d['Close'].astype(float)
            cp    = float(close.iloc[-1])
            if not (PRICE_MIN <= cp <= PRICE_MAX): return None

            # Katman 2: EMA Trend
            l2_ok, l2 = layer2_ema_trend(df1d)
            if not l2_ok: return None

            # Katman 3: Pre-Explosion + Momentum
            l3_ok, l3 = layer3_pre_explosion(df1d)
            if not l3_ok: return None

            # Katman 5: Opsiyon
            hv20 = l3.get("hv20", calc_hv(close, 20))
            opt  = await layer5_options(ticker, cp, close, hv20, l2, l3)
            if not opt: return None

            # Sektör
            sector      = await get_sector_for_ticker(ticker)
            sector_score = calc_sector_score(sector)

            # UOA
            uoa = await detect_uoa_v219(ticker, cp)

            # Market Regime V2
            regime_score, regime_label = calc_regime_score()

            # Bear piyasada agresif call sistemi çalışmaz
            if MARKET_REGIME_V2.get("regime") == "bear":
                return None

            # IV Context
            iv_ctx_score, iv_ctx_label = iv_context_engine(
                opt.get("iv_rank", 50),
                l2.get("entry_mode", ""),
                l3.get("pe_score", 0.0),
                uoa.get("uoa_score", 0.0),
                hv20, opt.get("atm_iv", 30) / 100.0
            )
            if iv_ctx_score < 0:  # Hard block
                return None

            # Breakout+Base birleşik skor
            breakout_base = min(
                l3.get("breakout_score", 0) * 0.7 + l3.get("pe_score", 0) * 0.5,
                20.0
            )

            # ── TOPLAM PUANLAMA v219 ──────────────────────────────────────
            # Pre-Explosion (BB+ATR+NR7)      : 0-20
            # Gamma Expansion                 : 0-15
            # EMA Giriş Modu                  : 0-20
            # Market Regime V2               : 0-10
            # Sector Momentum                : 0-10
            # RSI + Momentum                 : 0-10
            # Relative Strength (SPY)        : 0-10
            # Volume Acceleration            : 0-10
            # IV Context                     : 0-10
            # Options Flow (UOA+Sweep)       : 0-15
            # + Bonuslar

            opt_flow_score = 0.0
            best_opt = opt.get("gamma_sweet") or opt.get("institutional")
            if best_opt:
                opt_flow_score = min(best_opt.get("flow_score", 0) / 3.0, 10.0)
            uoa_bonus = min(uoa.get("uoa_score", 0) / 7.0, 10.0)
            if uoa.get("earnings_warning"): uoa_bonus -= 5.0

            # Sweep mega bonus
            sweep_mega = 5.0 if uoa.get("sweep_count", 0) >= 2 else 0.0

            ge_score = opt.get("ge_data", {}).get("ge_score", 0.0)

            total_score = (
                l3.get("pe_score", 0)         +  # 0-20 Pre-Explosion
                ge_score                       +  # 0-15 Gamma Expansion
                l2.get("ema_score", 0)         +  # 0-20 EMA
                regime_score                   +  # 0-10 Regime
                sector_score                   +  # 0-10 Sector
                l3.get("rsi_score", 0)         +  # 0-10 RSI
                l3.get("rs_score", 0)          +  # 0-10 RS
                l3.get("vol_accel_score", 0)   +  # 0-10 Volume Accel
                iv_ctx_score                   +  # 0-10 IV Context
                opt_flow_score                 +  # 0-10 Options Flow
                uoa_bonus                      +  # 0-10 UOA
                sweep_mega                        # 0-5  Sweep bonus
            )

            # Bonuslar
            entry_mode_raw = l2.get("entry_mode", "")
            if l2.get("golden_cross") or "GOLDEN_CROSS" in entry_mode_raw: total_score += 5.0
            if l2.get("ema200_breakout") or "EMA200_BREAKOUT" in entry_mode_raw: total_score += 7.0

            total_score = min(total_score, 100.0)

            if total_score >= 72:   grade = "🏆 PATLAMA POTANSİYELİ"
            elif total_score >= 58: grade = "🔥 GÜÇLÜ FIRSAT"
            elif total_score >= 44: grade = "💡 İYİ SETUP"
            else:                   grade = "📊 OLASI"

            # Rozetler
            if l3.get("pe_score", 0) >= 12:         grade = "💥" + grade
            if uoa.get("sweep_count", 0) >= 2:       grade = "⚡" + grade
            if l2.get("golden_cross"):               grade = "🌟" + grade
            if l2.get("ema200_breakout"):            grade = "⚡" + grade
            if uoa.get("earnings_warning"):          grade += " ⚠️EARN"

            return {
                "ticker": ticker, "current_price": round(cp, 2),
                "score": round(total_score, 1), "grade": grade,
                "sector": sector,
                "l2": l2, "l3": l3, "options": opt, "uoa": uoa,
                "hv20": round(hv20 * 100, 1),
                "sector_score": round(sector_score, 1),
                "regime_score": round(regime_score, 1),
                "iv_ctx_score": round(iv_ctx_score, 1),
                "iv_ctx_label": iv_ctx_label,
                "ge_score": round(ge_score, 1),
                "regime_label": regime_label,
                "breakout_base": round(breakout_base, 1),
            }
        except Exception as e:
            logging.debug(f"{ticker}: {e}")
            return None

# ════════════════════════════════════════════════════════════════════════════
# 14) DYNAMIC EXIT ENGINE (v219 MOD-9)
# ════════════════════════════════════════════════════════════════════════════

def dynamic_exit_signal(opt_data: dict, l3: dict, uoa: dict) -> str:
    """
    ✅ MOD-9: Dynamic Exit Engine
    Duruma göre çıkış stratejisi öner.
    """
    pe_score = l3.get("pe_score", 0)
    rvol     = l3.get("rvol", 1.0)
    roc5     = l3.get("roc5_pct", 0)
    gamma_accel = opt_data.get("gamma_accel", 1.0) if opt_data else 1.0
    sweep_count = uoa.get("sweep_count", 0)

    if gamma_accel >= 2.5:
        return "🎯 GAMMA SQUEEZE: %25'te yarı çıkış, kalanı trailing stop"
    elif sweep_count >= 2 and rvol > 2.0:
        return "🚀 KURUMSAL SÜPÜRME: %40 hedef, tight trailing stop"
    elif roc5 > 5.0:
        return "📈 PARABOLİK: Acil %30 güvenlik kârı al, kalanı tut"
    elif pe_score >= 12:
        return "💥 VCP/NR7 PATLAMASI: Tam %40 hedef bekle"
    else:
        return "📊 STANDART: %40 kâr / -%30 zarar / DTE zaman durağı"

# ════════════════════════════════════════════════════════════════════════════
# 15) RAPOR OLUŞTURUCU
# ════════════════════════════════════════════════════════════════════════════

def build_option_block_v219(c: dict) -> str:
    ticker = c['ticker']
    cp     = c['current_price']
    grade  = c['grade']
    l2     = c['l2']
    l3     = c['l3']
    opt    = c['options']
    uoa    = c['uoa']
    sector = c.get('sector', '—')

    lines = []
    lines.append(f"\n{'═' * 55}")
    lines.append(f"{grade}  <b>#{ticker}</b>  ${cp:.2f}  ({sector})")
    lines.append(f"📊 Skor: <b>{c['score']}/100</b>  |  {c.get('regime_label','')}")

    entry_labels = {
        "EMA200_BREAKOUT": "⚡ EMA200 KIRILIM",
        "EMA200_BREAKOUT_BELOW200": "⚡ DİP KIRILIM",
        "GOLDEN_CROSS": "🌟 GOLDEN CROSS",
        "NEAR_GOLDEN": "🔜 NEAR GOLDEN",
        "TREND_BIRTH": "🌱 TREND BAŞI",
        "ESTABLISHED_TREND": "🐂 GÜÇLÜ TREND",
        "EMA50_BOUNCE": "📉→📈 EMA50 SEKME",
    }
    entry_str = entry_labels.get(l2.get("entry_mode", ""), l2.get("entry_mode", "—"))
    lines.append(f"🔮 Giriş: <b>{entry_str}</b>  |  ADX: {l2.get('adx',0):.0f}  |  VWAP: {'✅' if l2.get('vwap_ok') else '⚠️'}")

    # Pre-Explosion
    pe = l3.get("pe_score", 0)
    pe_tag = "💥 KRİTİK SIKIŞ" if pe >= 15 else ("🔥 GÜÇLÜ SIKIŞ" if pe >= 10 else ("🟡 ORTA" if pe >= 5 else "📊 NORMAL"))
    lines.append(
        f"💥 Pre-Explosion: <b>{pe:.0f}/20</b> {pe_tag}  |  "
        f"BB%: {l3.get('bb_pct',50):.0f}  ATR↓: {'✅' if l3.get('atr_falling') else '❌'}  "
        f"NR7: {'✅' if l3.get('nr7') else '❌'}  NR4: {'✅' if l3.get('nr4') else '❌'}"
    )

    # Gamma Expansion
    ge = opt.get("ge_data", {})
    lines.append(
        f"⚡ Gamma: <b>{ge.get('ge_score',0):.0f}/15</b>  "
        f"Γ/$ = {ge.get('max_gamma_dollar',0):.2f}  "
        f"Hızlanma: {ge.get('gamma_accel',1):.1f}x  "
        f"{ge.get('call_wall_strength','—')}"
    )

    # IV Context
    lines.append(f"📊 IV: {opt.get('atm_iv',0):.0f}%  Rank:{opt.get('iv_rank',0):.0f}  {c.get('iv_ctx_label','')}")

    # RSI + RS + Hacim
    lines.append(
        f"📈 RSI: {l3.get('rsi',50):.0f}  |  RS vs SPY: {l3.get('rs_60d',0):+.1f}pp  |  "
        f"RVOL: {l3.get('rvol',1):.2f}x  HH: {'✅' if l3.get('higher_highs') else '❌'}"
    )

    # UOA
    uoa_score = uoa.get("uoa_score", 0)
    if uoa_score > 0:
        sweep_txt = f"Sweep:{uoa.get('sweep_count',0)}" if uoa.get("sweep_count", 0) > 0 else ""
        block_txt = "💰 Büyük Blok" if uoa.get("big_block_detected") else ""
        lines.append(
            f"🔥 UOA: <b>{uoa.get('uoa_signal','—')}</b> ({uoa_score:.0f}/100)  "
            f"P/C: {uoa.get('put_call_ratio',0):.2f}  {sweep_txt}  {block_txt}"
        )
        if uoa.get("total_premium_flow", 0) > 0:
            lines.append(f"   💵 Flow: ${uoa.get('total_premium_flow',0):,.0f}")

    if uoa.get("earnings_warning"):
        lines.append(f"   ⚠️ EARNINGS {uoa.get('earnings_days','?')} GÜN SONRA — DİKKAT!")

    # Sektör
    lines.append(f"🏭 Sektör: {sector}  Skor:{c.get('sector_score',0):.0f}/10")

    # Opsiyon blokları
    for opt_key in ["gamma_sweet", "institutional"]:
        od = opt.get(opt_key)
        if not od: continue
        sim = od.get("sim", {})
        lines.append(f"\n  {od['type']}")
        lines.append(
            f"  Strike: <b>${od['strike']:.0f}</b>  Vade: {od['expiration']} ({od['dte']}g)  "
            f"Maliyet: <b>${od['cost_per_contract']:.0f}</b>"
        )
        lines.append(
            f"  Δ={od['delta']:.2f}  Γ={od['gamma']:.4f}  "
            f"Geff={od.get('gamma_efficiency',0):.2f}  IV={od['iv_pct']:.0f}%"
        )
        lines.append(
            f"  Spread: %{od['spread_pct']:.1f}  OI:{od['oi']:,}  "
            f"Vol:{od['volume']:,}  V/OI:{od['vol_oi_ratio']:.2f}"
        )
        if sim:
            lines.append(
                f"  📈 {sim.get('days_fwd',3)}g Sim: ${sim.get('price_now',0):.2f}→${sim.get('price_fwd',0):.2f}  "
                f"<b>PNL: %{sim.get('pnl_pct',0):+.0f}</b>"
            )
        # Dynamic Exit
        exit_strat = dynamic_exit_signal(od, l3, uoa)
        lines.append(f"  🎯 TP: ${od['tp_price']:.2f}  SL: ${od['sl_price']:.2f}  ZamanDurağı: {od['time_stop_days']}g")
        lines.append(f"  ⚙️ Çıkış: {exit_strat}")

    return "\n".join(lines)

def build_summary_v219(candidates: list, vix: float, duration: float, n_scanned: int) -> Tuple[str, str]:
    n = len(candidates)
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")
    qqq_5d  = QQQ_RETURN_CACHE.get("return_5d", 0.0)
    qqq_20d = QQQ_RETURN_CACHE.get("return_20d", 0.0)
    regime  = MARKET_REGIME_V2.get("regime", "neutral").upper()

    summary = (
        f"🚀 <b>BOGA AI v219 — GAMMA EXPLOSION SCANNER</b>\n"
        f"🕒 {now_str}  |  🌡️ VIX: {vix:.1f}\n"
        f"📊 Piyasa: <b>{regime}</b>  QQQ 5g:{qqq_5d:+.1f}%  20g:{qqq_20d:+.1f}%\n"
        f"🔍 {n_scanned} hisse → <b>{n} PATLAMA ADAYI</b>  ({duration:.0f}sn)\n\n"
    )

    for i, c in enumerate(candidates[:15], 1):
        l3  = c['l3']
        opt = c['options']
        pe  = l3.get("pe_score", 0)
        ge  = opt.get("ge_data", {}).get("ge_score", 0)
        uoa_score = c['uoa'].get("uoa_score", 0)
        best = opt.get("gamma_sweet") or opt.get("institutional")
        cost = f"${best['cost_per_contract']:.0f}" if best else "—"
        dte  = f"{best['dte']}g" if best else "—"
        sim_pnl = best['sim'].get('pnl_pct', 0) if best and best.get('sim') else 0

        summary += (
            f"{i}. <b>{c['ticker']}</b> ${c['current_price']:.0f}  "
            f"Skor:{c['score']:.0f}  {c['grade'][:20]}\n"
            f"   💥PE:{pe:.0f}  ⚡Γ:{ge:.0f}  🔥UOA:{uoa_score:.0f}  {cost}/{dte}  sim:{sim_pnl:+.0f}%\n"
            f"   {c.get('iv_ctx_label','')[:50]}\n\n"
        )

    return summary, summary  # detail ayrı

def build_detail_v219(candidates: list) -> str:
    lines = []
    for c in candidates[:10]:
        lines.append(build_option_block_v219(c))
    return "\n".join(lines)

def save_picks_v219(candidates: list):
    try:
        out_path = os.path.join(DATA_DIR, f"opsiyon219_{datetime.now().strftime('%Y%m%d_%H%M')}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(candidates, f, ensure_ascii=False, default=str, indent=2)
        logging.info(f"💾 Kaydedildi: {out_path}")
    except Exception as e:
        logging.error(f"JSON kayıt: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 16) ANA TARAMA DÖNGÜSÜ
# ════════════════════════════════════════════════════════════════════════════

async def scan():
    start   = time.time()
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")

    await update_vix()
    await update_spy_returns()
    await update_qqq_regime()
    await update_sector_momentum()

    regime_label = MARKET_REGIME_V2.get("regime", "neutral").upper()
    qqq_5d = QQQ_RETURN_CACHE.get("return_5d", 0.0)

    await send_tg(
        f"🚀 <b>BOGA AI v219 — GAMMA EXPLOSION SCANNER</b>\n"
        f"🕒 {now_str}\n"
        f"🌡️ VIX: {MARKET_VIX['value']:.1f} ({MARKET_VIX['regime']})\n"
        f"📊 Piyasa Rejimi V2: <b>{regime_label}</b>  QQQ 5g:{qqq_5d:+.1f}%\n\n"
        f"✅ YENİ v219 MODÜLLER AKTİF:\n"
        f"  💥 Pre-Explosion Detector (BB+ATR+NR7)\n"
        f"  ⚡ Gamma Expansion Engine (Γ/$+hızlanma)\n"
        f"  🔥 Options Flow V2 (sweep+ask-side)\n"
        f"  📊 IV Context Engine (bağlama göre)\n"
        f"  🏭 Sector Momentum\n"
        f"  🎯 Dynamic Exit Engine\n\n"
        f"🎯 Hedef: 1-3 günde %40+ opsiyon hareketi\n"
        f"⚡ Delta 0.28-0.45 | DTE 15-90g | Gamma sweet spot\n"
        f"📊 {MAX_TICKERS_SCAN} hisse taranıyor..."
    )

    universe = await build_universe()
    if not universe:
        await send_tg("❌ Evren oluşturulamadı!"); return

    await send_tg(f"✅ {len(universe)} hisse geçti. Derin analiz başlıyor (8-12 dk)...")

    global TOTAL_TO_SCAN, PROGRESS_COUNTER
    TOTAL_TO_SCAN    = len(universe)
    PROGRESS_COUNTER = 0

    results    = await asyncio.gather(*[analyze(t) for t in universe], return_exceptions=True)
    candidates = sorted(
        [r for r in results if isinstance(r, dict)],
        key=lambda x: x['score'], reverse=True
    )

    if not candidates:
        await send_tg(
            "⚠️ Patlama adayı bulunamadı!\n"
            "• Pre-Explosion sinyali yok (sıkışma yok)\n"
            "• Gamma sweet spot (0.28-0.45 delta) için uygun kontrat yok\n"
            "• Options Flow negatif\n"
            "→ Piyasa rejimi kontrol edin"
        ); return

    duration = time.time() - start
    save_picks_v219(candidates)

    summary, _ = build_summary_v219(candidates, MARKET_VIX['value'], duration, len(universe))
    detail      = build_detail_v219(candidates)

    await send_tg(summary)
    await asyncio.sleep(1)

    for chunk in split_safe(detail, limit=3800):
        if chunk.strip():
            await send_tg(chunk)
            await asyncio.sleep(0.8)

    best = candidates[0]
    best_opt = best['options'].get("gamma_sweet") or best['options'].get("institutional")
    await send_tg(
        f"✅ <b>v219 Tarama Tamamlandı!</b>\n"
        f"⏱ {duration:.0f}sn  |  {len(universe)} hisse → {len(candidates)} aday\n"
        f"🏆 En iyi: <b>{best['ticker']}</b> ({best['score']:.1f}/100)\n"
        f"💥 Pre-Explosion: {best['l3'].get('pe_score',0):.0f}/20  "
        f"⚡ Gamma: {best.get('ge_score',0):.0f}/15\n"
        f"🎯 {'DTE:' + str(best_opt['dte']) + 'g  $' + str(best_opt['cost_per_contract']) if best_opt else '—'}\n"
        f"📊 Rejim: {best.get('regime_label','—')}"
    )

# ════════════════════════════════════════════════════════════════════════════
# 17) ZAMANLAYICI
# ════════════════════════════════════════════════════════════════════════════

def get_next_run_utc(hour: int = 10, minute: int = 30):
    from datetime import timezone as tz
    now_utc = datetime.now(tz.utc)
    now_ny  = now_utc.astimezone(NY_TZ)
    cand    = now_ny.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if cand <= now_ny: cand += timedelta(days=1)
    while cand.weekday() >= 5: cand += timedelta(days=1)
    return cand.astimezone(tz.utc)

async def run_scanner():
    await send_tg(
        "🚀 <b>BOGA AI v219 BAŞLATILDI!</b>\n"
        "⏱ Hafta içi NY 10:30 otomatik tarama\n"
        "🎯 Hedef: 1-3 günde %40+ opsiyon hareketi\n\n"
        "<b>v219 Özellikler:</b>\n"
        "  💥 Pre-Explosion (BB+ATR+NR7+Inside Day)\n"
        "  ⚡ Gamma Expansion Engine (Γ/dollar + hızlanma)\n"
        "  🔥 Options Flow V2 (sweep/ask-side/big block)\n"
        "  📊 IV Context (yüksek IV bağlam analizi)\n"
        "  🏭 Sector Momentum (hot sector önceliği)\n"
        "  🎯 Dynamic Exit Engine\n"
        "  📊 Market Regime V2 (QQQ+VIX+breadth)\n"
        f"  ⚡ Delta 0.28-0.45 | DTE 15-90g | max $200/kontrat"
    )
    while True:
        try:
            from datetime import timezone as tz
            wait_sec = (get_next_run_utc() - datetime.now(tz.utc)).total_seconds()
            if wait_sec < 0 or wait_sec > 90000: wait_sec = 3600
            logging.info(f"🕒 Sonraki tarama ~{wait_sec/3600:.1f}h sonra")
            await asyncio.sleep(wait_sec)
            await scan()
        except Exception as e:
            logging.error(f"Döngü: {e}")
            await send_tg(f"🚨 Döngü hatası: {e}")
            await asyncio.sleep(3600)

# ════════════════════════════════════════════════════════════════════════════
# 18) BAŞLATMA
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    import sys
    if "--oneshot" in sys.argv:
        try:
            print("🚀 BOGA AI v219 Options Scanner (One-Shot) başlatıldı...")
            asyncio.run(scan())
            print("✅ Tarama tamamlandı.")
        except Exception as e:
            print(f"Hata: {e}")
    else:
        try:
            asyncio.run(run_scanner())
        except KeyboardInterrupt:
            print("\n🚀 BOGA AI v219 durduruldu.")
        except Exception as e:
            print(f"Kritik hata: {e}")
