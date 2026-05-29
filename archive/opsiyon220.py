"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🚀 BOGA AI v220 — WINNER FORMULA SCANNER                                ║
║   "1-3 günde %40+ opsiyon hareketi" — minimal & lethal                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  v219 → v220  KRİTİK DÜZELTMELER + GÜÇLÜ EKLEMELERs:                     ║
║                                                                              ║
║  ✅ FIX-1: FAKE SWEEP YAMALANIDI — notional filter ($100K+)                ║
║  ✅ FIX-2: GAMMA EFFICIENCY CAP — math.log1p() ile explosion önlendi       ║
║  ✅ FIX-3: DTE REGIME SCORING — PE+flow'a göre optimal DTE seçimi          ║
║  ✅ FIX-4: MARKET MAKER TRAP FİLTRESİ — EM/ATR ratio + call wall          ║
║  ✅ NEW-1: BREAKOUT PROXIMITY SKORU — 20g zirveye mesafe                   ║
║  ✅ NEW-2: 15m INTRADAY ENGINE — opening drive + ORB + VWAP reclaim       ║
║  ✅ NEW-3: BACKTEST LOGGER — her trade'i logla, hangi faktör çalışıyor?   ║
║                                                                              ║
║  WINNER FORMULA CORE (basitleştirildi):                                    ║
║  1. Güçlü sektör                                                            ║
║  2. Pre-explosion sıkışma                                                   ║
║  3. Breakout proximity (<3% uzakta)                                        ║
║  4. Agresif options flow (notional doğrulamalı)                            ║
║  5. Delta 0.30-0.40                                                         ║
║  6. DTE 21-45 (setup'a göre dinamik)                                       ║
║  7. Gamma acceleration                                                      ║
║  8. Volume ignition                                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import sys
import io
import logging
import time
import math
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
# ⚙️  AYARLAR — v220 WINNER FORMULA
# ════════════════════════════════════════════════════════════════════════════

NY_TZ    = ZoneInfo("America/New_York")
HERE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
os.makedirs(DATA_DIR, exist_ok=True)

TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"
ENABLE_TELEGRAM  = True

# Hisse filtresi
PRICE_MIN      = 5.0
PRICE_MAX      = 250.0
AVG_VOL_MIN    = 100_000
DOLLAR_VOL_MIN = 300_000
ADX_MIN        = 10
RSI_MIN        = 25
RSI_MAX        = 85

# ── Opsiyon filtresi ──────────────────────────────────────────────────────
DTE_MIN    = 15           # Gamma squeeze için
DTE_MAX    = 75           # Uzun swing
DTE_TARGET = 35           # Default sweet spot
OI_MIN     = 50
SPREAD_MAX = 0.10
MID_MIN    = 0.05
CONTRACT_MAX_COST = 200   # $200 max

# ✅ FIX-1: Notional filter — sahte sweep engelleyici
NOTIONAL_SWEEP_MIN  = 100_000   # $100K = gerçek institutional sweep eşiği
NOTIONAL_BLOCK_MIN  = 500_000   # $500K = büyük blok
NOTIONAL_RETAIL_MAX = 25_000    # $25K altı = retail, düşük puan

# ✅ FIX-3: DTE Regime
DTE_GAMMA_SQUEEZE    = (15, 25)   # PE >= 12 + flow >= 15
DTE_MOMENTUM_NORMAL  = (25, 45)   # Normal momentum
DTE_SAFER_SWING      = (45, 75)   # Güvenli swing

# ✅ FIX-4: MM Trap
EM_ATR_MAX_RATIO = 2.5    # EM > ATR * 2.5 → market çok fazla fiyatlamış
CALL_WALL_OI_MIN = 8_000  # OI yığılması tehlikeli eşik

# ✅ NEW-1: Breakout Proximity
BP_BONUS_PCT    = 0.03    # %3 içinde = bonus
BP_PENALTY_PCT  = 0.08    # %8 ötesi = ceza

# Delta aralıkları — Winner Formula
DELTA_CORE_MIN   = 0.28
DELTA_CORE_MAX   = 0.45   # Primary: high gamma
DELTA_SAFE_MIN   = 0.45
DELTA_SAFE_MAX   = 0.62   # Secondary: safer

# IV
IV_RANK_HARD_MAX = 80.0

# Exit
TAKE_PROFIT_PCT  = 0.40
STOP_LOSS_PCT    = -0.30
TIME_STOP_RATIO  = 0.60

MAX_TICKERS_SCAN = 500
UNIVERSE_TTL     = 24 * 3600
SEMAPHORE_N      = 6
MIN_CANDIDATES   = 3

# Hot sectors (skor max 15)
HOT_SECTORS = {
    "Semiconductors": 15, "Technology": 12,
    "Communication Services": 9, "Health Care": 10,
    "Consumer Discretionary": 8, "Energy": 8,
    "Financials": 7, "Industrials": 6,
    "Materials": 5, "Consumer Staples": 3,
    "Utilities": 2, "Real Estate": 2,
}

SECTOR_ETFS = {
    "Technology": "XLK", "Semiconductors": "SOXX",
    "Communication Services": "XLC", "Health Care": "XLV",
    "Consumer Discretionary": "XLY", "Energy": "XLE", "Financials": "XLF",
}

# Cache
UNIVERSE_CACHE: Dict[str, Any]      = {"ts": 0.0, "data": []}
MARKET_VIX                           = {"value": 18.0, "regime": "Orta 🟡"}
SPY_RETURN_CACHE: Dict[str, Any]     = {"ts": 0.0, "return_60d": 0.0, "return_20d": 0.0}
QQQ_RETURN_CACHE: Dict[str, Any]     = {"ts": 0.0, "return_5d": 0.0, "return_20d": 0.0}
SECTOR_MOMENTUM_CACHE: Dict[str, float] = {}
MARKET_REGIME_V2: Dict[str, Any]     = {"regime": "bull", "score": 50, "updated": 0}

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
            current = line if len(line) <= limit else ""
            if len(line) > limit:
                for i in range(0, len(line), limit): chunks.append(line[i:i+limit])
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
                    if r.status == 400:
                        body = await r.text()
                        if "parse" in body.lower():
                            plain = re.sub(r'<[^>]+>', '', chunk)
                            async with s.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": plain[:3800]}, timeout=20): pass
                await asyncio.sleep(0.4)
            except Exception as e:
                logging.error(f"TG: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 2) PİYASA VERİLERİ
# ════════════════════════════════════════════════════════════════════════════

async def update_vix():
    try:
        vd = await asyncio.to_thread(lambda: yf.Ticker("^VIX").history(period="5d"))
        if vd is not None and not vd.empty:
            v = float(vd['Close'].iloc[-1])
            MARKET_VIX.update({
                "value": v,
                "regime": "Düşük 🟢" if v < 18 else ("Orta 🟡" if v < 25 else "Yüksek 🔴")
            })
    except Exception as e:
        logging.warning(f"VIX: {e}")

async def update_spy_returns():
    now = time.time()
    if SPY_RETURN_CACHE["ts"] and (now - SPY_RETURN_CACHE["ts"] < 3600): return
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("SPY").history(period="100d", interval="1d"))
        if df is not None and len(df) >= 65:
            c = df['Close'].astype(float)
            SPY_RETURN_CACHE.update({
                "ts": now,
                "return_60d": float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100),
                "return_20d": float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100),
            })
    except Exception as e:
        logging.warning(f"SPY: {e}")

async def update_qqq_regime():
    now = time.time()
    if QQQ_RETURN_CACHE["ts"] and (now - QQQ_RETURN_CACHE["ts"] < 3600): return
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("QQQ").history(period="60d", interval="1d"))
        if df is not None and len(df) >= 22:
            c = df['Close'].astype(float)
            r5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
            r20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            QQQ_RETURN_CACHE.update({"ts": now, "return_5d": r5, "return_20d": r20})

        vix = MARKET_VIX.get("value", 20.0)
        qqq5 = QQQ_RETURN_CACHE.get("return_5d", 0.0)
        qqq20= QQQ_RETURN_CACHE.get("return_20d", 0.0)

        score = 50
        if vix < 16:     score += 20
        elif vix < 20:   score += 10
        elif vix > 30:   score -= 25
        elif vix > 25:   score -= 15
        if qqq5 > 2:     score += 15
        elif qqq5 > 0:   score += 8
        elif qqq5 < -2:  score -= 15
        elif qqq5 < 0:   score -= 8
        if qqq20 > 5:    score += 10
        elif qqq20 > 0:  score += 5
        elif qqq20 < -5: score -= 10

        score = max(0, min(100, score))
        MARKET_REGIME_V2.update({
            "regime": "bull" if score >= 65 else ("bear" if score < 40 else "neutral"),
            "score": score, "updated": now,
            "qqq_5d": round(qqq5, 2), "qqq_20d": round(qqq20, 2)
        })
        logging.info(f"Rejim: {MARKET_REGIME_V2['regime'].upper()} ({score}/100)")
    except Exception as e:
        logging.warning(f"QQQ: {e}")

async def update_sector_momentum():
    now = time.time()
    if SECTOR_MOMENTUM_CACHE and (now - MARKET_REGIME_V2.get("updated", 0) < 3600): return
    tickers = list(SECTOR_ETFS.values()) + ["SPY"]
    for etf in tickers:
        try:
            df = await asyncio.to_thread(lambda t=etf: yf.Ticker(t).history(period="30d", interval="1d"))
            if df is not None and len(df) >= 10:
                c = df['Close'].astype(float)
                r5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
                r10 = float((c.iloc[-1] - c.iloc[-11]) / c.iloc[-11] * 100) if len(c) >= 11 else 0.0
                SECTOR_MOMENTUM_CACHE[etf] = round(r5 * 0.6 + r10 * 0.4, 2)
            await asyncio.sleep(0.1)
        except: pass

# ════════════════════════════════════════════════════════════════════════════
# 3) MATEMATİK
# ════════════════════════════════════════════════════════════════════════════

def bs_greeks(S, K, T, r, sigma):
    empty = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0: return empty
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sq)
        d2 = d1 - sigma * sq
        nd1 = norm_pdf(d1)
        return {
            "delta": round(norm_cdf(d1), 4),
            "gamma": round(nd1 / (S * sigma * sq), 5),
            "theta": round((-(S * nd1 * sigma) / (2 * sq) - r * K * math.exp(-r * T) * norm_cdf(d2)) / 365, 4),
            "vega":  round(S * nd1 * sq / 100, 4),
        }
    except: return empty

def bs_price(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0: return max(0.0, S - K)
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sq)
        d2 = d1 - sigma * sq
        return round(S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2), 4)
    except: return 0.0

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
        mn, mx = float(hvs.min()), float(hvs.max())
        rank = max(0.0, min(100.0, (current_iv - mn) / (mx - mn) * 100)) if (mx - mn) > 0.001 else 50.0
        pct  = float((hvs < current_iv).sum()) / len(hvs) * 100
        return round(rank, 1), round(pct, 1)
    except: return 50.0, 50.0

def calc_vwap(df: pd.DataFrame) -> float:
    try:
        d   = df.tail(20).copy()
        tp  = (d['High'].astype(float) + d['Low'].astype(float) + d['Close'].astype(float)) / 3.0
        vol = d['Volume'].astype(float)
        return round(float((tp * vol).sum() / vol.sum()), 3)
    except: return 0.0

def bs_pnl_sim(S, K, iv, dte, move_pct=0.07, days_fwd=3):
    T_now = dte / 365.0
    T_fwd = max((dte - days_fwd) / 365.0, 0.001)
    S_fwd = S * (1 + move_pct)
    iv_fwd = iv * (0.88 if dte <= 30 else 0.93)
    r = 0.05
    p_now = bs_price(S, K, T_now, r, iv)
    p_fwd = bs_price(S_fwd, K, T_fwd, r, iv_fwd)
    pnl = round((p_fwd - p_now) / p_now * 100, 1) if p_now > 0 else 0.0
    return {"price_now": round(p_now, 2), "price_fwd": round(p_fwd, 2),
            "pnl_pct": pnl, "days_fwd": days_fwd}

def calc_expected_move(price, iv, dte):
    return round(price * iv * math.sqrt(dte / 365.0), 2)

def max_pain(calls, puts, cp):
    try:
        strikes = sorted(set(list(calls['strike'].values) + list(puts['strike'].values)))
        bp = cp; bv = float('inf')
        for ts in strikes:
            cp_val = float(((ts - calls['strike']).clip(lower=0) * calls['openInterest'].fillna(0)).sum())
            pp_val = float(((puts['strike'] - ts).clip(lower=0) * puts['openInterest'].fillna(0)).sum())
            tot = cp_val + pp_val
            if tot < bv: bv = tot; bp = ts
        return bp
    except: return cp

# ════════════════════════════════════════════════════════════════════════════
# 4) ✅ NEW-2: 15m INTRADAY ENGINE
# ════════════════════════════════════════════════════════════════════════════

async def intraday_engine_15m(ticker: str, cp: float) -> dict:
    """
    ✅ NEW-2: 15m Intraday Engine
    Opening drive, ORB breakout, VWAP reclaim, 15m higher low, volume ignition.
    Günlük datadan proxy hesaplar — gerçek intraday feed olmadan çalışır.
    """
    result = {
        "intraday_score": 0.0,
        "intraday_label": "—",
        "orb_breakout": False,
        "vwap_reclaim": False,
        "opening_volume_ratio": 0.0,
        "higher_low_15m": False,
    }
    try:
        # 5 günlük saatlik data (proxy için)
        df_1h = await asyncio.to_thread(lambda: yf.Ticker(ticker).history(period="5d", interval="1h"))
        if df_1h is None or len(df_1h) < 10:
            return result

        df_1h.columns = [str(c).strip().title() for c in df_1h.columns]
        c_1h   = df_1h['Close'].astype(float)
        h_1h   = df_1h['High'].astype(float)
        lo_1h  = df_1h['Low'].astype(float)
        vol_1h = df_1h['Volume'].astype(float)

        # Bugünün saatlik barlari (NY timezone aware)
        now_ny = datetime.now(NY_TZ)
        today_bars = []
        for idx in df_1h.index:
            try:
                bar_time = idx.tz_convert(NY_TZ) if idx.tzinfo else idx.replace(tzinfo=NY_TZ)
                if bar_time.date() == now_ny.date():
                    today_bars.append(idx)
            except: pass

        score = 0.0

        if len(today_bars) >= 2:
            # ORB (Opening Range Breakout): ilk 1 saatin high'ı kırıldı mı?
            first_bar = today_bars[0]
            orb_high  = float(h_1h.loc[first_bar])
            latest_close = float(c_1h.iloc[-1])
            if latest_close > orb_high * 1.002:
                result["orb_breakout"] = True
                score += 8.0

            # Opening volume vs ortalama
            first_vol    = float(vol_1h.loc[first_bar])
            avg_vol_hour = float(vol_1h.tail(20).mean()) if len(vol_1h) >= 20 else first_vol
            open_ratio   = first_vol / avg_vol_hour if avg_vol_hour > 0 else 1.0
            result["opening_volume_ratio"] = round(open_ratio, 2)
            if open_ratio > 2.5:    score += 8.0
            elif open_ratio > 1.5:  score += 5.0
            elif open_ratio > 1.0:  score += 2.0

            # Higher Low: son 2 bar yükselen dip
            if len(today_bars) >= 3:
                lows = [float(lo_1h.loc[b]) for b in today_bars[-3:] if b in lo_1h.index]
                if len(lows) >= 2 and all(lows[i] > lows[i-1] for i in range(1, len(lows))):
                    result["higher_low_15m"] = True
                    score += 5.0

        # VWAP reclaim (24 saatlik)
        last_24 = df_1h.tail(24)
        if not last_24.empty:
            tp = (last_24['High'].astype(float) + last_24['Low'].astype(float) + last_24['Close'].astype(float)) / 3.0
            v  = last_24['Volume'].astype(float)
            vwap_24h = float((tp * v).sum() / v.sum()) if v.sum() > 0 else cp
            if cp > vwap_24h * 1.001:
                result["vwap_reclaim"] = True
                score += 6.0
            elif cp < vwap_24h * 0.998:
                score -= 3.0

        # Momentum: son 3 saatlik bar kapanışı yükseliyor mu?
        if len(c_1h) >= 4:
            if float(c_1h.iloc[-1]) > float(c_1h.iloc[-2]) > float(c_1h.iloc[-3]):
                score += 4.0

        score = max(0.0, min(score, 20.0))
        result["intraday_score"] = round(score, 1)

        if score >= 15:    result["intraday_label"] = "🔥 GÜÇLÜ AÇILIŞ IVMESI"
        elif score >= 10:  result["intraday_label"] = "📈 POZİTİF INTRADAY"
        elif score >= 5:   result["intraday_label"] = "🟡 ORTA"
        else:              result["intraday_label"] = "📊 ZAYİF INTRADAY"

    except Exception as e:
        logging.debug(f"Intraday 15m {ticker}: {e}")

    return result

# ════════════════════════════════════════════════════════════════════════════
# 5) EVREN
# ════════════════════════════════════════════════════════════════════════════

async def build_universe() -> List[str]:
    now = time.time()
    if UNIVERSE_CACHE["ts"] and (now - UNIVERSE_CACHE["ts"] < UNIVERSE_TTL) and UNIVERSE_CACHE["data"]:
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
                            for line in text.splitlines()[1:]:
                                parts = line.split(",")
                                if parts: tickers_raw.append(parts[0].strip().upper())
            except: pass

    valid = list({t for t in tickers_raw if 1 <= len(t) <= 5 and re.match(r'^[A-Z]+$', t)})
    valid.sort()

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
                if PRICE_MIN <= cp <= PRICE_MAX and vol >= AVG_VOL_MIN and cp * vol >= DOLLAR_VOL_MIN:
                    passed.append(ticker)
            except: pass

    await asyncio.gather(*[quick_check(t) for t in valid[:MAX_TICKERS_SCAN]])
    result = passed[:MAX_TICKERS_SCAN]
    UNIVERSE_CACHE.update({"ts": now, "data": result})
    logging.info(f"✅ Evren: {len(result)} hisse")
    return result

# ════════════════════════════════════════════════════════════════════════════
# 6) KATMAN 2 — EMA TREND
# ════════════════════════════════════════════════════════════════════════════

def layer2_ema(df: pd.DataFrame) -> Tuple[bool, dict]:
    try:
        c = df['Close'].astype(float)
        if len(c) < 210: return False, {}

        e9v  = float(EMAIndicator(c, 9).ema_indicator().iloc[-1])
        e20v = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])
        e50v = float(EMAIndicator(c, 50).ema_indicator().iloc[-1])
        e200v= float(EMAIndicator(c, 200).ema_indicator().iloc[-1])
        cp   = float(c.iloc[-1])
        prev_cp = float(c.iloc[-2])

        e20s = EMAIndicator(c, 20).ema_indicator()
        e50s = EMAIndicator(c, 50).ema_indicator()
        prev_e20 = float(e20s.iloc[-2]) if len(e20s) >= 2 else e20v
        prev_e50 = float(e50s.iloc[-2]) if len(e50s) >= 2 else e50v
        e50_slope = float((e50v - float(e50s.iloc[-6])) / float(e50s.iloc[-6]) * 100) if len(e50s) >= 6 else 0.0

        golden_cross    = (prev_e20 <= prev_e50) and (e20v > e50v)
        near_golden     = (e20v > e50v) and ((e20v - e50v) / e50v < 0.03)
        ema200_breakout = (prev_cp < e200v) and (cp >= e200v)

        dist_ema50 = (cp - e50v) / e50v if e50v > 0 else 0.0
        dist_ema20 = (cp - e20v) / e20v if e20v > 0 else 0.0

        mod_b = ema200_breakout
        mod_a = (e20v > e50v > e200v) and (dist_ema20 <= 0.08) and (e50_slope >= 0.0)
        mod_c = (e20v > e50v) and (-0.02 <= dist_ema50 <= 0.04)
        mod_d = (cp > e20v > e50v > e200v) and (e50_slope >= 0.0)

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
            entry_mode += "_BELOW200"

        adx_val = float(ADXIndicator(df['High'], df['Low'], c, 14).adx().iloc[-1])
        early_modes = ("EMA200_BREAKOUT", "EMA200_BREAKOUT_BELOW200", "GOLDEN_CROSS", "GOLDEN_CROSS_BELOW200")
        if adx_val < (10 if entry_mode in early_modes else ADX_MIN): return False, {}

        full_align = (e20v > e50v > e200v) and (cp > e200v)
        regime = ("breakout" if ema200_breakout else
                  ("trend"   if adx_val >= 20 and full_align else
                   ("breakout" if adx_val >= 15 and full_align else "neutral")))

        if regime == "neutral" and entry_mode not in ("EMA200_BREAKOUT", "GOLDEN_CROSS", "NEAR_GOLDEN"):
            return False, {}

        vwap = calc_vwap(df)
        vwap_ok = (vwap > 0 and cp >= vwap)

        mode_scores = {
            "EMA200_BREAKOUT": 12.0, "GOLDEN_CROSS": 10.0,
            "NEAR_GOLDEN": 8.0,      "TREND_BIRTH": 7.0,
            "ESTABLISHED_TREND": 6.0,"EMA50_BOUNCE": 5.0,
        }
        ema_score = mode_scores.get(entry_mode, 0.0)
        if e20v > e50v:           ema_score += 2.0
        if e50v > e200v:          ema_score += 2.0
        if e9v > e20v:            ema_score += 1.5
        if e50_slope >= 0.3:      ema_score += 2.5
        elif e50_slope >= 0.1:    ema_score += 1.5
        if 0.0 <= dist_ema50 <= 0.03: ema_score += 3.0
        ema_score = min(ema_score, 20.0)

        return True, {
            "ema9": round(e9v, 3), "ema20": round(e20v, 3),
            "ema50": round(e50v, 3), "ema200": round(e200v, 3),
            "cp": round(cp, 3),
            "ema_score": round(ema_score, 1),
            "adx": round(adx_val, 1),
            "regime": regime, "vwap": round(vwap, 3),
            "vwap_ok": vwap_ok,
            "entry_mode": entry_mode,
            "golden_cross": golden_cross,
            "ema200_breakout": ema200_breakout,
            "e50_slope": round(e50_slope, 3),
        }
    except Exception as e:
        logging.debug(f"L2: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 7) KATMAN 3 — WINNER FORMULA CORE
#    Pre-Explosion + Breakout Proximity + Volume + RSI + RS
# ════════════════════════════════════════════════════════════════════════════

def layer3_winner(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    Winner Formula:
    1. Pre-Explosion sıkışma (BB+ATR+NR7)
    2. ✅ NEW-1: Breakout Proximity (<3% = bonus, >8% = ceza)
    3. Volume Ignition
    4. RSI + RS
    """
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 65: return False, {}

        cp = float(c.iloc[-1])

        # ── BB Width Percentile ───────────────────────────────────────────
        bb = BollingerBands(c, window=20, window_dev=2)
        bb_width = ((bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()).dropna()
        bb_current = float(bb_width.iloc[-1]) if not bb_width.empty else 0.05
        bb_pct = float((bb_width.tail(120) < bb_current).sum() / len(bb_width.tail(120)) * 100) if len(bb_width) >= 20 else 50.0

        # ── ATR Compression ───────────────────────────────────────────────
        atr_s = AverageTrueRange(h, lo, c, 14).average_true_range().dropna()
        atr_now  = float(atr_s.iloc[-1]) if not atr_s.empty else 1.0
        atr_5ago = float(atr_s.iloc[-6]) if len(atr_s) >= 6  else atr_now
        atr_10ago= float(atr_s.iloc[-11])if len(atr_s) >= 11 else atr_now
        atr_falling  = (atr_now < atr_5ago < atr_10ago)
        atr_comp_pct = (atr_5ago - atr_now) / atr_5ago * 100 if atr_5ago > 0 else 0.0
        atr_pct_of_price = (atr_now / cp) * 100 if cp > 0 else 2.0

        # ── NR7 / NR4 / Inside Day ────────────────────────────────────────
        dr   = (h - lo).values
        nr7  = len(dr) >= 7 and dr[-1] == min(dr[-7:])
        nr4  = len(dr) >= 4 and dr[-1] == min(dr[-4:])
        iday = float(h.iloc[-1]) <= float(h.iloc[-2]) and float(lo.iloc[-1]) >= float(lo.iloc[-2])
        icluster = sum(
            1 for i in range(-3, 0)
            if float(h.iloc[i]) <= float(h.iloc[i-1]) and float(lo.iloc[i]) >= float(lo.iloc[i-1])
        ) >= 2

        # ── Vol Crush / Dry-Up ────────────────────────────────────────────
        lr  = np.log(c / c.shift(1)).dropna()
        rv5 = float(lr.tail(5).std()  * math.sqrt(252)) if len(lr) >= 5  else 0.3
        rv20= float(lr.tail(20).std() * math.sqrt(252)) if len(lr) >= 20 else 0.3
        vol_crush = rv5 < rv20 * 0.8

        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        v30 = float(vol.tail(30).mean()) if len(vol) >= 30 else v5
        vol_dryup = v5 < v20 * 0.85

        # ── PRE-EXPLOSION SKORU (0-20) ────────────────────────────────────
        pe = 0.0
        if bb_pct < 5:    pe += 7.0
        elif bb_pct < 10: pe += 5.0
        elif bb_pct < 20: pe += 3.0
        elif bb_pct < 35: pe += 1.0

        if atr_falling and atr_comp_pct > 15: pe += 5.0
        elif atr_falling and atr_comp_pct > 8: pe += 3.0
        elif atr_falling: pe += 1.5

        if nr7:             pe += 4.0
        elif nr4:           pe += 2.5
        if icluster:        pe += 3.0
        elif iday:          pe += 1.5
        if vol_crush and vol_dryup: pe += 3.0
        elif vol_crush or vol_dryup: pe += 1.5

        roc20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
        roc60 = float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100) if len(c) >= 61 else 0.0
        roc5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0

        if roc20 > 0 and roc60 > 0: pe *= 1.2   # Yön biası: yukarı sıkışma
        elif roc20 < -5:             pe *= 0.7
        pe = min(pe, 20.0)

        # ── ✅ NEW-1: BREAKOUT PROXIMITY SKORU (0-10) ─────────────────────
        high_20  = float(h.tail(20).max())
        high_60  = float(c.tail(60).max())
        dist_20h = (high_20 - cp) / cp if cp > 0 else 1.0   # Ne kadar uzakta?
        dist_60h = (cp - high_60) / high_60 if high_60 > 0 else -1.0

        bp_score = 0.0
        if dist_20h < 0:              bp_score = 10.0  # Zirve kırıldı!
        elif dist_20h < BP_BONUS_PCT: bp_score = 8.0   # %3 içinde = çok yakın
        elif dist_20h < 0.05:         bp_score = 6.0
        elif dist_20h < BP_PENALTY_PCT: bp_score = 3.0
        else:                          bp_score = 0.0   # %8+ uzak = ceza

        volume_spike = v5 > v30 * 1.2

        # ── Volume Acceleration (0-10) ────────────────────────────────────
        if v5 > v30 * 2.0:    vol_score = 10.0
        elif v5 > v30 * 1.5:  vol_score = 7.0
        elif v5 > v30 * 1.2:  vol_score = 4.0
        elif v5 > v30:        vol_score = 2.0
        elif vol_dryup:        vol_score = 3.0  # Dry-up da değerli
        else:                  vol_score = 0.0

        # ── RSI (0-10) ────────────────────────────────────────────────────
        rsi = float(RSIIndicator(c, 14).rsi().iloc[-1])
        if not (RSI_MIN <= rsi <= RSI_MAX): return False, {}

        if 40 <= rsi <= 65:   rsi_score = 10.0
        elif 35 <= rsi < 40:  rsi_score = 7.0
        elif 65 < rsi <= 75:  rsi_score = 5.0
        elif 25 <= rsi < 35:  rsi_score = 3.0
        else:                 rsi_score = 1.0

        # ── RS vs SPY (0-10) ──────────────────────────────────────────────
        spy60 = SPY_RETURN_CACHE.get("return_60d", 0.0)
        rs_60 = roc60 - spy60
        rs_score = (10.0 if rs_60 >= 10 else (7.0 if rs_60 >= 5 else
                    (5.0 if rs_60 >= 2 else (3.0 if rs_60 >= 0 else (1.0 if rs_60 >= -3 else 0.0)))))

        # Higher Highs
        higher_highs = float(c.iloc[-1]) > float(c.iloc[-10]) > float(c.iloc[-20])
        hv20 = calc_hv(c, 20)

        return True, {
            "rsi": round(rsi, 1), "rsi_score": round(rsi_score, 1),
            "roc5_pct": round(roc5, 2), "roc20_pct": round(roc20, 2), "roc60_pct": round(roc60, 2),
            "rs_score": round(rs_score, 1), "rs_60d": round(rs_60, 1),
            "atr_pct": round(atr_pct_of_price, 2), "hv20": round(hv20, 4),
            "v5": round(v5, 0), "v30": round(v30, 0),
            "rvol": round(v5 / v30, 2) if v30 > 0 else 1.0,
            # Pre-Explosion
            "pe_score": round(pe, 1),
            "bb_pct": round(bb_pct, 1),
            "atr_falling": atr_falling, "atr_comp_pct": round(atr_comp_pct, 1),
            "nr7": nr7, "nr4": nr4, "inside_day": iday, "inside_cluster": icluster,
            "vol_crush": vol_crush, "vol_dryup": vol_dryup,
            # Breakout Proximity
            "bp_score": round(bp_score, 1),
            "dist_to_20h_pct": round(dist_20h * 100, 1),
            "high_20": round(high_20, 2), "high_60": round(high_60, 2),
            "dist_from_60h": round(dist_60h * 100, 1),
            # Volume
            "vol_score": round(vol_score, 1),
            "volume_spike": volume_spike,
            "higher_highs": higher_highs,
        }
    except Exception as e:
        logging.debug(f"L3: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 8) KATMAN 4 — SEKTÖR
# ════════════════════════════════════════════════════════════════════════════

async def get_sector(ticker: str) -> str:
    try:
        info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
        return info.get("sector", "") or info.get("industry", "")
    except: return ""

def sector_score(sector: str) -> float:
    if not sector: return 3.0
    base = 3.0
    for k, pts in HOT_SECTORS.items():
        if k.lower() in sector.lower():
            base = min(pts / 15.0 * 10.0, 10.0); break

    etf = next((v for k, v in SECTOR_ETFS.items() if k.lower() in sector.lower()), None)
    if etf and etf in SECTOR_MOMENTUM_CACHE:
        rel = SECTOR_MOMENTUM_CACHE[etf] - SECTOR_MOMENTUM_CACHE.get("SPY", 0.0)
        if rel > 3:    base = min(base + 3.0, 10.0)
        elif rel > 1:  base = min(base + 1.5, 10.0)
        elif rel < -2: base = max(base - 2.0, 0.0)
    return round(base, 1)

# ════════════════════════════════════════════════════════════════════════════
# 9) ✅ FIX-3: DTE REGIME — setup'a göre optimal DTE seç
# ════════════════════════════════════════════════════════════════════════════

def get_preferred_dte(pe_score: float, flow_score: float, vol_score: float) -> Tuple[int, int]:
    """
    ✅ FIX-3: DTE Regime Scoring
    PE güçlü + flow güçlü → kısa vade (gamma squeeze)
    Normal → orta vade
    Zayıf sinyal → uzun vade
    """
    if pe_score >= 12 and flow_score >= 15:
        return DTE_GAMMA_SQUEEZE         # 15-25 gün
    elif pe_score >= 8 or (vol_score >= 7 and flow_score >= 8):
        return DTE_MOMENTUM_NORMAL       # 25-45 gün
    else:
        return DTE_SAFER_SWING           # 45-75 gün

# ════════════════════════════════════════════════════════════════════════════
# 10) KATMAN 5 — OPSİYON ZİNCİRİ (v220 tüm fix'ler)
# ════════════════════════════════════════════════════════════════════════════

async def layer5_options(ticker: str, cp: float, close: pd.Series,
                          hv: float, l2: dict, l3: dict) -> Optional[dict]:
    """
    v220 Options Layer:
    ✅ FIX-1: Notional filter (fake sweep engellendi)
    ✅ FIX-2: Gamma efficiency cap (log1p)
    ✅ FIX-3: DTE regime (PE+flow bazlı)
    ✅ FIX-4: MM Trap filter (EM/ATR ratio + call wall)
    """
    try:
        stock = yf.Ticker(ticker)
        exps  = await asyncio.to_thread(lambda: stock.options)
        if not exps: return None

        today   = date.today()
        atm_iv  = hv * 1.15

        # ✅ FIX-3: Preferred DTE range
        pref_dte_min, pref_dte_max = get_preferred_dte(
            l3.get("pe_score", 0), 0.0, l3.get("vol_score", 0)
        )

        best_result  = None
        best_score   = -999.0

        for exp_str in exps:
            try:
                dte = (datetime.strptime(exp_str, "%Y-%m-%d").date() - today).days
                if not (DTE_MIN <= dte <= DTE_MAX): continue
            except: continue

            try:
                chain = await asyncio.to_thread(lambda e=exp_str: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None and not chain.calls.empty else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None and not chain.puts.empty  else pd.DataFrame()
                if calls.empty: continue
            except: continue

            calls['strike'] = pd.to_numeric(calls['strike'], errors='coerce')
            calls = calls.dropna(subset=['strike'])
            atm_idx = (calls['strike'] - cp).abs().idxmin()
            raw_iv  = float(calls.loc[atm_idx].get('impliedVolatility', hv) or hv)
            atm_iv  = max(raw_iv, hv * 0.5)

            iv_rank, iv_pct = calc_iv_rank(atm_iv, close)

            # IV hard block (bear context ise)
            is_context_good = (
                l3.get("pe_score", 0) >= 8 or
                l2.get("ema200_breakout", False) or
                l2.get("golden_cross", False)
            )
            if iv_rank > IV_RANK_HARD_MAX and not is_context_good:
                continue

            em    = calc_expected_move(cp, atm_iv, dte)
            em_up = cp + em
            mp    = max_pain(calls, puts, cp)

            # ✅ FIX-4: MM TRAP — EM/ATR ratio kontrolü
            atr_pct = l3.get("atr_pct", 2.0) / 100.0
            atr_abs = cp * atr_pct
            em_atr_ratio = em / atr_abs if atr_abs > 0 else 1.0
            if em_atr_ratio > EM_ATR_MAX_RATIO:
                logging.debug(f"{ticker} MM Trap: EM/ATR={em_atr_ratio:.1f} > {EM_ATR_MAX_RATIO}")
                continue   # Piyasa çok fazla hareket fiyatlamış

            # ✅ FIX-3: DTE scoring — preferred range içinde mi?
            dte_bonus = 0.0
            if pref_dte_min <= dte <= pref_dte_max:
                dte_bonus = 5.0  # Optimal DTE aralığı

            T = dte / 365.0
            r = 0.05

            sim_days = 2 if dte <= 21 else (3 if dte <= 45 else 5)
            dyn_tp = 0.60 if em / cp > 0.15 else (0.45 if em / cp > 0.10 else 0.40)
            dyn_sl = -0.30
            time_stop = max(round(dte * (1 - TIME_STOP_RATIO)), 3)

            gamma_best  = None
            gamma_score = -999.0
            safe_best   = None
            safe_score  = -999.0

            # ✅ FIX-4: Call wall tespiti
            call_wall_oi = 0.0
            for _, row in calls.iterrows():
                try:
                    s_ = float(row['strike'])
                    o_ = int(row.get('openInterest', 0) or 0)
                    if cp * 1.02 < s_ < cp * 1.10 and o_ > 0:
                        call_wall_oi = max(call_wall_oi, o_)
                except: pass
            call_wall_danger = call_wall_oi > CALL_WALL_OI_MIN

            for _, row in calls.iterrows():
                try:
                    strike   = float(row['strike'])
                    iv_row   = max(float(row.get('impliedVolatility', atm_iv) or atm_iv), 0.05)
                    bid      = float(row.get('bid', 0) or 0)
                    ask      = float(row.get('ask', 0) or 0)
                    if ask <= 0.03: continue
                    mid      = (bid + ask) / 2.0
                    spread_p = (ask - bid) / ask if ask > 0 else 1.0

                    if spread_p > SPREAD_MAX: continue
                    oi     = int(row.get('openInterest', 0) or 0)
                    volume = int(row.get('volume', 0) or 0)
                    if oi < OI_MIN or mid < MID_MIN: continue
                    if (ask * 100) > CONTRACT_MAX_COST: continue
                    if strike > em_up * 1.08: continue

                    g     = bs_greeks(cp, strike, T, r, iv_row)
                    delta = g['delta']
                    gamma = g['gamma']
                    theta = g['theta']
                    td_ratio = abs(delta / theta) if theta != 0 else 999.0
                    if td_ratio < 0.03: continue

                    vol_oi   = volume / oi if oi > 0 else 0.0
                    # ✅ FIX-1: NOTIONAL FILTER — sahte sweep engellendi
                    notional = volume * mid * 100   # Gerçek dolar değeri

                    # ──────────────────────────────────────────────────────
                    # GAMMA SWEET SPOT (delta 0.28-0.45)
                    # ──────────────────────────────────────────────────────
                    if DELTA_CORE_MIN <= delta <= DELTA_CORE_MAX:
                        # ✅ FIX-2: GAMMA EFFICIENCY CAP — log1p ile explosion önlendi
                        geff = math.log1p(gamma / mid) if mid > 0 else 0.0
                        # Hard cap: max 0.08 oranına denk logscale
                        geff = min(geff, math.log1p(0.08))

                        # ✅ FIX-1: Notional-doğrulamalı flow score
                        flow_score = 0.0
                        if vol_oi >= 3.0 and notional >= NOTIONAL_SWEEP_MIN:
                            flow_score += 15.0  # Gerçek sweep
                        elif vol_oi >= 2.0 and notional >= NOTIONAL_SWEEP_MIN:
                            flow_score += 9.0
                        elif vol_oi >= 3.0 and notional >= NOTIONAL_RETAIL_MAX:
                            flow_score += 4.0   # Vol yüksek ama küçük — muhtemelen retail
                        elif vol_oi >= 0.8:
                            flow_score += 2.0

                        if notional >= NOTIONAL_BLOCK_MIN:
                            flow_score += 8.0   # Büyük blok
                        elif notional >= NOTIONAL_SWEEP_MIN:
                            flow_score += 4.0

                        # Ask-side proxy
                        if volume >= 100 and ask > bid * 1.1:
                            flow_score += 4.0

                        # Likidite
                        liq = (5.0 if spread_p <= 0.03 else (3.0 if spread_p <= 0.06 else 1.0))
                        liq += (3.0 if oi >= 1000 else (1.5 if oi >= 300 else 0.0))
                        liq += (2.0 if volume >= 200 else (1.0 if volume >= 80 else 0.0))
                        liq = min(liq, 8.0)

                        # Gamma acceleration bonus
                        gamma_accel = 3.0 if dte <= 14 else (2.5 if dte <= 21 else (2.0 if dte <= 30 else (1.5 if dte <= 45 else 1.0)))

                        # ✅ FIX-4: Call wall penalty
                        cw_penalty = -5.0 if call_wall_danger and strike > cp * 0.99 else 0.0

                        cscore = (
                            flow_score +
                            geff * 50.0 +  # logscale, daha dengeli
                            delta * 3.0 +
                            liq +
                            gamma_accel * 2.0 +
                            dte_bonus +
                            cw_penalty
                        )

                        if cscore > gamma_score:
                            gamma_score = cscore
                            atr_move = min(max(l3.get("atr_pct", 2.0) / 100 * 4.0, 0.04), 0.25)
                            sim = bs_pnl_sim(cp, strike, iv_row, dte, atr_move, sim_days)
                            gamma_best = {
                                "type": "🚀 GAMMA SWEET SPOT",
                                "regime": l2.get("regime", "neutral"),
                                "strike": strike, "expiration": exp_str, "dte": dte,
                                "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                                "spread_pct": round(spread_p * 100, 1),
                                "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi, 3),
                                "notional": round(notional, 0),
                                "iv_pct": round(iv_row * 100, 1),
                                "delta": round(delta, 3), "gamma": round(gamma, 5),
                                "theta": round(theta, 4),
                                "gamma_accel": gamma_accel,
                                "gamma_efficiency_log": round(geff, 4),
                                "flow_score": round(flow_score, 1),
                                "liq_score": round(liq, 1),
                                "td_ratio": round(td_ratio, 2),
                                "call_wall_danger": call_wall_danger,
                                "cost_per_contract": round(ask * 100, 0),
                                "score": round(cscore, 2),
                                "sim": sim,
                                "breakeven": round(strike + ask, 2),
                                "tp_price": round(mid * (1 + dyn_tp), 2),
                                "sl_price": round(mid * (1 + dyn_sl), 2),
                                "time_stop_days": time_stop,
                                "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                                "dte_bonus": dte_bonus,
                            }

                    # ──────────────────────────────────────────────────────
                    # SAFE (delta 0.45-0.62)
                    # ──────────────────────────────────────────────────────
                    elif DELTA_SAFE_MIN <= delta <= DELTA_SAFE_MAX:
                        liq = (5.0 if spread_p <= 0.02 else (3.5 if spread_p <= 0.04 else 1.5))
                        liq += (3.0 if oi >= 2000 else (2.0 if oi >= 800 else 1.0))
                        liq += (2.0 if volume >= 500 else 1.0)
                        liq = min(liq, 10.0)

                        sweep = min(vol_oi * 5.0, 5.0) if notional >= NOTIONAL_RETAIL_MAX else 0.0
                        sscore = delta * 4.0 + gamma * 1000.0 + liq + sweep + dte_bonus

                        if sscore > safe_score:
                            safe_score = sscore
                            atr_move = min(max(l3.get("atr_pct", 2.0) / 100 * 3.0, 0.03), 0.18)
                            sim = bs_pnl_sim(cp, strike, iv_row, dte, atr_move, sim_days)
                            safe_best = {
                                "type": "🛡️ KURUMSAL SIĞINAK",
                                "regime": l2.get("regime", "neutral"),
                                "strike": strike, "expiration": exp_str, "dte": dte,
                                "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                                "spread_pct": round(spread_p * 100, 1),
                                "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi, 3),
                                "notional": round(notional, 0),
                                "iv_pct": round(iv_row * 100, 1),
                                "delta": round(delta, 3), "gamma": round(gamma, 5),
                                "theta": round(theta, 4),
                                "gamma_accel": (3.0 if dte <= 14 else 1.0),
                                "liq_score": round(liq, 1),
                                "td_ratio": round(td_ratio, 2),
                                "cost_per_contract": round(ask * 100, 0),
                                "score": round(sscore, 2),
                                "sim": sim,
                                "breakeven": round(strike + ask, 2),
                                "tp_price": round(mid * (1 + dyn_tp), 2),
                                "sl_price": round(mid * (1 + dyn_sl), 2),
                                "time_stop_days": time_stop,
                                "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                                "dte_bonus": dte_bonus,
                            }
                except: continue

            if gamma_best or safe_best:
                total = max(gamma_score, safe_score)
                if total > best_score:
                    best_score = total
                    best_result = {
                        "exp_date": exp_str, "dte": dte,
                        "max_pain": round(mp, 2),
                        "em": round(em, 2), "em_upper": round(em_up, 2),
                        "atm_iv": round(atm_iv * 100, 1),
                        "iv_rank": iv_rank, "iv_pct_rank": iv_pct,
                        "iv_vs_hv": round(atm_iv / hv, 3) if hv > 0 else 1.0,
                        "em_atr_ratio": round(em_atr_ratio, 2),
                        "call_wall_oi": int(call_wall_oi),
                        "call_wall_danger": call_wall_danger,
                        "gamma_sweet": gamma_best,
                        "institutional": safe_best,
                        "asymmetric": gamma_best,   # backward compat
                        "regime": l2.get("regime", "neutral"),
                        "pref_dte_range": (pref_dte_min, pref_dte_max),
                    }

        return best_result
    except Exception as e:
        logging.debug(f"{ticker} L5: {e}")
        return None

# ════════════════════════════════════════════════════════════════════════════
# 11) UOA v220 — Notional doğrulamalı
# ════════════════════════════════════════════════════════════════════════════

async def detect_uoa(ticker: str, cp: float) -> dict:
    result = {
        "uoa_score": 0.0, "uoa_signal": "—",
        "put_call_ratio": 0.0, "unusual_call_vol": False,
        "big_block_detected": False, "iv_spike_detected": False,
        "sweep_count": 0, "ask_side_ratio": 0.0,
        "total_notional_flow": 0.0,
        "earnings_days": None, "earnings_warning": False,
    }
    try:
        stock = yf.Ticker(ticker)
        today = date.today()

        try:
            cal = await asyncio.to_thread(lambda: stock.calendar)
            if cal is not None:
                if isinstance(cal, dict):    earn_date = cal.get("Earnings Date", [None])[0]
                elif hasattr(cal, 'T'):
                    row = cal.T.get("Earnings Date", None)
                    earn_date = row.iloc[0] if row is not None and len(row) > 0 else None
                else: earn_date = None
                if earn_date is not None:
                    if hasattr(earn_date, 'date'):    earn_date = earn_date.date()
                    elif isinstance(earn_date, str):  earn_date = datetime.strptime(earn_date[:10], "%Y-%m-%d").date()
                    days = (earn_date - today).days
                    result["earnings_days"] = days
                    if 0 <= days <= 10: result["earnings_warning"] = True
        except: pass

        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps: return result

        near_exps = sorted(
            [(d, (datetime.strptime(d, "%Y-%m-%d").date() - today).days)
             for d in exps
             if 1 <= (datetime.strptime(d, "%Y-%m-%d").date() - today).days <= 60],
            key=lambda x: x[1]
        )[:3]

        total_call_vol = 0; total_put_vol = 0; total_call_oi = 0
        max_vol_oi = 0.0; total_notional = 0.0; sweep_count = 0
        ask_vol = 0; all_vol = 0; iv_vals = []

        for exp_d, _ in near_exps:
            try:
                chain = await asyncio.to_thread(lambda e=exp_d: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None else pd.DataFrame()

                if not calls.empty:
                    for col in ['volume', 'openInterest', 'ask', 'bid', 'impliedVolatility', 'strike']:
                        if col in calls.columns:
                            calls[col] = pd.to_numeric(calls[col], errors='coerce').fillna(0)

                    total_call_vol += float(calls['volume'].sum())
                    total_call_oi  += float(calls['openInterest'].sum())

                    for _, row in calls.iterrows():
                        oi_  = float(row.get('openInterest', 0))
                        vol_ = float(row.get('volume', 0))
                        ask_ = float(row.get('ask', 0))
                        bid_ = float(row.get('bid', 0))
                        iv_  = float(row.get('impliedVolatility', 0))
                        s_   = float(row.get('strike', 0))
                        mid_ = (ask_ + bid_) / 2.0
                        not_ = vol_ * mid_ * 100   # Notional

                        if oi_ > 20 and vol_ > 0:
                            voi = vol_ / oi_
                            if voi > max_vol_oi: max_vol_oi = voi
                            # ✅ FIX-1: Sweep = vol/oi >= 3 VE notional >= $100K
                            if voi >= 3.0 and not_ >= NOTIONAL_SWEEP_MIN:
                                sweep_count += 1

                        if vol_ > 0 and ask_ > bid_ * 1.05:
                            ask_vol += int(vol_)
                        all_vol += int(vol_)

                        # OTM büyük blok
                        if s_ > cp * 1.03 and ask_ > 0.5 and vol_ >= 50:
                            total_notional += not_

                        if iv_ > 0.05: iv_vals.append(iv_)

                if not puts.empty:
                    puts['volume'] = pd.to_numeric(puts.get('volume', 0), errors='coerce').fillna(0)
                    total_put_vol += float(puts['volume'].sum())
            except: continue

        result["total_notional_flow"] = round(total_notional, 0)
        result["sweep_count"] = sweep_count

        uoa = 0.0
        pc  = total_put_vol / total_call_vol if total_call_vol > 0 else 1.0
        result["put_call_ratio"] = round(pc, 2)
        if pc < 0.4:    uoa += 25.0
        elif pc < 0.6:  uoa += 15.0
        elif pc < 0.8:  uoa += 8.0
        elif pc > 1.5:  uoa -= 8.0

        if sweep_count >= 3:   uoa += 25.0
        elif sweep_count >= 2: uoa += 18.0
        elif sweep_count >= 1: uoa += 10.0

        if max_vol_oi > 3.0: result["unusual_call_vol"] = True; uoa += 15.0
        elif max_vol_oi > 1.5: result["unusual_call_vol"] = True; uoa += 8.0

        ask_r = ask_vol / all_vol if all_vol > 0 else 0.5
        result["ask_side_ratio"] = round(ask_r, 2)
        if ask_r > 0.75:   uoa += 12.0
        elif ask_r > 0.60: uoa += 6.0

        if total_notional >= NOTIONAL_BLOCK_MIN:
            result["big_block_detected"] = True; uoa += 25.0
        elif total_notional >= NOTIONAL_SWEEP_MIN:
            result["big_block_detected"] = True; uoa += 15.0
        elif total_notional >= NOTIONAL_RETAIL_MAX:
            uoa += 5.0

        if len(iv_vals) > 5:
            iv_m, iv_s = np.mean(iv_vals), np.std(iv_vals)
            if iv_s > 0 and sum(1 for v in iv_vals if v > iv_m + 2 * iv_s) > 0:
                result["iv_spike_detected"] = True; uoa += 10.0

        uoa = max(0.0, min(uoa, 100.0))
        result["uoa_score"] = round(uoa, 1)
        result["uoa_signal"] = ("🔥 KURUMSAL SÜPÜRME" if uoa >= 60 else
                                ("📈 GÜÇLÜ AKIŞ" if uoa >= 40 else
                                 ("👀 POZİTİF UOA" if uoa >= 20 else "—")))
    except Exception as e:
        logging.debug(f"UOA {ticker}: {e}")
    return result

# ════════════════════════════════════════════════════════════════════════════
# 12) IV CONTEXT ENGINE
# ════════════════════════════════════════════════════════════════════════════

def iv_context(iv_rank: float, entry_mode: str, pe_score: float,
               uoa_score: float, hv: float, atm_iv: float) -> Tuple[float, str]:
    iv_vs_hv = atm_iv / hv if hv > 0 else 1.0
    is_squeeze   = pe_score >= 10.0
    is_fresh     = "EMA200_BREAKOUT" in entry_mode or "GOLDEN_CROSS" in entry_mode
    is_inst      = uoa_score >= 40.0

    if iv_rank <= 20:   score, lbl = 10.0, "💰 ULTRA UCUZ IV"
    elif iv_rank <= 30: score, lbl = 8.0,  "🟢 UCUZ IV"
    elif iv_rank <= 45: score, lbl = 6.0,  "🟡 ORTA IV"
    elif iv_rank <= 60:
        if is_squeeze or is_fresh or is_inst: score, lbl = 5.0, "🟠 IV YÜKSEK — BAĞLAM POZİTİF"
        else:                                  score, lbl = 2.0, "🔴 IV YÜKSEK"
    elif iv_rank <= 75:
        if is_squeeze and is_inst: score, lbl = 4.0, "🔴 YÜKSEK IV — SWEEP+SIKIŞ → GİRİŞ"
        elif is_fresh:             score, lbl = 3.0, "🔴 YÜKSEK IV — TAZE KIRILIM"
        else:                      score, lbl = 0.0, "🚫 IV ÇOK YÜKSEK"
    else: score, lbl = 0.0, "🚫 IV AŞIRI"

    if iv_rank > IV_RANK_HARD_MAX and not (is_squeeze and is_inst):
        return -5.0, "🚫 IV HARD BLOCK"

    if iv_vs_hv < 0.85:   score = min(score + 2.0, 10.0)
    elif iv_vs_hv > 1.5:  score = max(score - 2.0, 0.0)
    return round(score, 1), lbl

# ════════════════════════════════════════════════════════════════════════════
# 13) DYNAMIC EXIT ENGINE v220
# ════════════════════════════════════════════════════════════════════════════

def dynamic_exit(opt_data: Optional[dict], l3: dict, uoa: dict) -> str:
    """
    ✅ MOD-9: Bağlama göre çıkış önerisi (rapor için)
    """
    if not opt_data: return "📊 STANDART: %40 / -%30"
    pe     = l3.get("pe_score", 0)
    rvol   = l3.get("rvol", 1.0)
    roc5   = l3.get("roc5_pct", 0)
    accel  = opt_data.get("gamma_accel", 1.0)
    sweep  = uoa.get("sweep_count", 0)
    nr7    = l3.get("nr7", False)

    if accel >= 2.5:
        return "⚡ GAMMA SQUEEZE: %25'de yarı çık, kalanı trailing stop"
    if sweep >= 2 and rvol > 1.5:
        return "🔥 KURUMSAL AKIŞ: %40 hızlı çıkış hedefi"
    if roc5 > 5.0:
        return "📈 PARABOLİK: %25-30 güvenlik kârı, kalanı tut"
    if nr7 and pe >= 12:
        return "💥 NR7+SIKIŞ: Tam %40 patlamayı bekle"
    return "📊 STANDART: %40 / -%30 / DTE zaman durağı"

# ════════════════════════════════════════════════════════════════════════════
# 14) ✅ NEW-3: BACKTEST LOGGER
# ════════════════════════════════════════════════════════════════════════════

def log_trade_for_backtest(candidate: dict):
    """
    ✅ NEW-3: Her tarama adayını backtest için loglar.
    Hangi faktörün %40'ı sağladığını analiz etmek için.
    """
    try:
        log_path = os.path.join(DATA_DIR, "backtest_log.jsonl")
        l3  = candidate.get("l3", {})
        opt = candidate.get("options", {})
        uoa = candidate.get("uoa", {})
        best = opt.get("gamma_sweet") or opt.get("institutional") or {}

        record = {
            "timestamp":    datetime.now(NY_TZ).isoformat(),
            "ticker":       candidate.get("ticker"),
            "price":        candidate.get("current_price"),
            "total_score":  candidate.get("score"),
            # Winner Formula faktörleri
            "pe_score":     l3.get("pe_score", 0),
            "bp_score":     l3.get("bp_score", 0),
            "vol_score":    l3.get("vol_score", 0),
            "rsi":          l3.get("rsi", 0),
            "rs_60d":       l3.get("rs_60d", 0),
            "rvol":         l3.get("rvol", 1),
            "nr7":          l3.get("nr7", False),
            "nr4":          l3.get("nr4", False),
            "bb_pct":       l3.get("bb_pct", 50),
            "atr_falling":  l3.get("atr_falling", False),
            "vol_crush":    l3.get("vol_crush", False),
            "higher_highs": l3.get("higher_highs", False),
            # Opsiyon
            "delta":        best.get("delta", 0),
            "gamma":        best.get("gamma", 0),
            "dte":          best.get("dte", 0),
            "iv_pct":       best.get("iv_pct", 0),
            "cost":         best.get("cost_per_contract", 0),
            "notional":     best.get("notional", 0),
            "flow_score":   best.get("flow_score", 0),
            "gamma_accel":  best.get("gamma_accel", 1),
            "sim_pnl_pct":  best.get("sim", {}).get("pnl_pct", 0),
            # UOA
            "uoa_score":    uoa.get("uoa_score", 0),
            "sweep_count":  uoa.get("sweep_count", 0),
            "put_call_ratio": uoa.get("put_call_ratio", 1),
            "big_block":    uoa.get("big_block_detected", False),
            # Context
            "sector":       candidate.get("sector", ""),
            "entry_mode":   candidate.get("l2", {}).get("entry_mode", ""),
            "iv_rank":      opt.get("iv_rank", 50),
            "iv_ctx_label": candidate.get("iv_ctx_label", ""),
            "call_wall_danger": best.get("call_wall_danger", False),
            "em_atr_ratio": opt.get("em_atr_ratio", 1.0),
            # Çıktılar (sonra backfill edilecek)
            "peak_pct":     None,   # Taramadan sonra manuel/otomatik doldur
            "time_to_peak": None,
            "hit_40pct":    None,
        }

        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
    except Exception as e:
        logging.debug(f"Backtest log: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 15) ANA ANALİZ
# ════════════════════════════════════════════════════════════════════════════

ANALYSIS_SEM     = asyncio.Semaphore(SEMAPHORE_N)
PROGRESS_COUNTER = 0
TOTAL_TO_SCAN    = 0

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

            # Bear piyasada dur
            if MARKET_REGIME_V2.get("regime") == "bear": return None

            l2_ok, l2 = layer2_ema(df1d)
            if not l2_ok: return None

            l3_ok, l3 = layer3_winner(df1d)
            if not l3_ok: return None

            # Minimum winner signal: PE >= 5 veya BP skoru >= 6 (breakout yakın)
            if l3.get("pe_score", 0) < 3 and l3.get("bp_score", 0) < 3:
                return None

            hv20  = l3.get("hv20", calc_hv(close, 20))
            opt   = await layer5_options(ticker, cp, close, hv20, l2, l3)
            if not opt: return None

            sector     = await get_sector(ticker)
            sec_score  = sector_score(sector)

            uoa = await detect_uoa(ticker, cp)

            # Market Regime
            regime = MARKET_REGIME_V2.get("regime", "neutral")
            regime_score = (10.0 if regime == "bull" and MARKET_REGIME_V2.get("score", 50) >= 75
                            else 8.0 if regime == "bull"
                            else 5.0)
            regime_label = ("🟢 GÜÇLÜ BOĞA" if regime_score >= 10 else
                            ("🟢 BOĞA" if regime_score >= 8 else "🟡 NÖTR"))

            # IV Context
            iv_ctx_score, iv_ctx_label = iv_context(
                opt.get("iv_rank", 50),
                l2.get("entry_mode", ""),
                l3.get("pe_score", 0.0),
                uoa.get("uoa_score", 0.0),
                hv20, opt.get("atm_iv", 30) / 100.0
            )
            if iv_ctx_score < 0: return None

            # Intraday 15m
            intraday = await intraday_engine_15m(ticker, cp)

            # Options flow score
            best_opt = opt.get("gamma_sweet") or opt.get("institutional")
            opt_flow_score = min(best_opt.get("flow_score", 0) / 3.0, 10.0) if best_opt else 0.0
            uoa_bonus = min(uoa.get("uoa_score", 0) / 7.0, 10.0)
            if uoa.get("earnings_warning"): uoa_bonus -= 5.0
            sweep_mega = 5.0 if uoa.get("sweep_count", 0) >= 2 else 0.0

            # ── WINNER FORMULA TOPLAM SKORU ────────────────────────────────
            total_score = (
                l3.get("pe_score", 0)             +  # 0-20  Pre-Explosion
                l3.get("bp_score", 0)             +  # 0-10  Breakout Proximity ← YENİ
                l2.get("ema_score", 0)            +  # 0-20  EMA
                sec_score                         +  # 0-10  Sector
                l3.get("rsi_score", 0)            +  # 0-10  RSI
                l3.get("rs_score", 0)             +  # 0-10  RS
                l3.get("vol_score", 0)            +  # 0-10  Volume
                iv_ctx_score                      +  # 0-10  IV Context
                opt_flow_score                    +  # 0-10  Options Flow
                uoa_bonus                         +  # 0-10  UOA
                intraday.get("intraday_score", 0) * 0.5 +  # 0-10  Intraday
                sweep_mega                           # 0-5   Sweep bonus
            )

            # Bonuslar
            entry_mode = l2.get("entry_mode", "")
            if l2.get("golden_cross") or "GOLDEN_CROSS" in entry_mode: total_score += 5.0
            if l2.get("ema200_breakout") or "EMA200_BREAKOUT" in entry_mode: total_score += 7.0
            if opt.get("call_wall_danger"): total_score -= 5.0   # MM Trap cezası

            total_score = min(max(total_score, 0.0), 100.0)

            if total_score >= 72:   grade = "🏆 PATLAMA POTANSİYELİ"
            elif total_score >= 58: grade = "🔥 GÜÇLÜ FIRSAT"
            elif total_score >= 44: grade = "💡 İYİ SETUP"
            else:                   grade = "📊 OLASI"

            if l3.get("pe_score", 0) >= 12:          grade = "💥" + grade
            if uoa.get("sweep_count", 0) >= 2:        grade = "⚡" + grade
            if l3.get("nr7"):                          grade = "NR7·" + grade
            if l2.get("golden_cross"):                grade = "🌟" + grade
            if l2.get("ema200_breakout"):             grade = "🚀" + grade
            if opt.get("call_wall_danger"):           grade += "·DUVAR⚠️"
            if uoa.get("earnings_warning"):           grade += "·EARN⚠️"

            result = {
                "ticker": ticker, "current_price": round(cp, 2),
                "score": round(total_score, 1), "grade": grade,
                "sector": sector,
                "l2": l2, "l3": l3, "options": opt, "uoa": uoa,
                "intraday": intraday,
                "hv20": round(hv20 * 100, 1),
                "sector_score": round(sec_score, 1),
                "regime_score": round(regime_score, 1),
                "regime_label": regime_label,
                "iv_ctx_score": round(iv_ctx_score, 1),
                "iv_ctx_label": iv_ctx_label,
            }

            # ✅ NEW-3: Backtest log
            log_trade_for_backtest(result)

            return result
        except Exception as e:
            logging.debug(f"{ticker}: {e}")
            return None

# ════════════════════════════════════════════════════════════════════════════
# 16) RAPOR
# ════════════════════════════════════════════════════════════════════════════

def build_option_block(c: dict) -> str:
    ticker = c['ticker']; cp = c['current_price']; grade = c['grade']
    l2 = c['l2']; l3 = c['l3']; opt = c['options']; uoa = c['uoa']
    sector = c.get('sector', '—'); intra = c.get('intraday', {})

    entry_labels = {
        "EMA200_BREAKOUT": "⚡ EMA200 KIRILIM",
        "EMA200_BREAKOUT_BELOW200": "⚡ DİP KIRILIM",
        "GOLDEN_CROSS": "🌟 GOLDEN CROSS",
        "NEAR_GOLDEN": "🔜 NEAR GOLDEN",
        "TREND_BIRTH": "🌱 TREND BAŞI",
        "ESTABLISHED_TREND": "🐂 GÜÇLÜ TREND",
        "EMA50_BOUNCE": "📉→📈 EMA50 SEKME",
    }

    lines = [f"\n{'═'*55}",
             f"{grade}  <b>#{ticker}</b>  ${cp:.2f}  ({sector})",
             f"📊 Skor: <b>{c['score']}/100</b>  |  {c.get('regime_label','')}"]

    entry_str = entry_labels.get(l2.get("entry_mode",""), l2.get("entry_mode","—"))
    lines.append(f"🔮 {entry_str}  ADX:{l2.get('adx',0):.0f}  VWAP:{'✅' if l2.get('vwap_ok') else '⚠️'}")

    # Pre-Explosion
    pe   = l3.get("pe_score", 0)
    pe_t = "💥 KRİTİK" if pe >= 15 else ("🔥 GÜÇLÜ" if pe >= 10 else ("🟡 ORTA" if pe >= 5 else "📊"))
    lines.append(
        f"💥 Pre-Exp: <b>{pe:.0f}/20</b> {pe_t}  "
        f"BB%:{l3.get('bb_pct',50):.0f}  ATR↓:{'✅' if l3.get('atr_falling') else '❌'}  "
        f"NR7:{'✅' if l3.get('nr7') else '❌'}  Inside:{'✅' if l3.get('inside_cluster') else '❌'}"
    )

    # Breakout Proximity
    bp  = l3.get("bp_score", 0)
    d20 = l3.get("dist_to_20h_pct", 0)
    bp_t = "🎯 ZIRVEYE ÇOK YAKIN" if bp >= 8 else ("✅ YAKIN" if bp >= 5 else ("🟡 ORTA" if bp >= 3 else "⚠️ UZAK"))
    lines.append(f"🎯 Breakout Proximity: <b>{bp:.0f}/10</b> {bp_t}  20g zirveye: %{d20:.1f}")

    # IV + Volume
    lines.append(
        f"📊 IV:{opt.get('atm_iv',0):.0f}%  Rank:{opt.get('iv_rank',0):.0f}  {c.get('iv_ctx_label','')}  "
        f"|  EM/ATR:{opt.get('em_atr_ratio',1):.1f}{'  ⚠️MM' if opt.get('call_wall_danger') else ''}"
    )
    lines.append(
        f"📈 RSI:{l3.get('rsi',50):.0f}  RS:{l3.get('rs_60d',0):+.1f}pp  "
        f"RVOL:{l3.get('rvol',1):.2f}x  Vol:{l3.get('vol_score',0):.0f}/10  "
        f"HH:{'✅' if l3.get('higher_highs') else '❌'}"
    )

    # Intraday
    if intra.get("intraday_score", 0) > 0:
        lines.append(
            f"⏱ Intraday: <b>{intra.get('intraday_label','—')}</b>  "
            f"ORB:{'✅' if intra.get('orb_breakout') else '❌'}  "
            f"VWAP:{'✅' if intra.get('vwap_reclaim') else '❌'}  "
            f"OpenVol:{intra.get('opening_volume_ratio',0):.1f}x"
        )

    # UOA
    uoa_s = uoa.get("uoa_score", 0)
    if uoa_s > 0:
        sweep_t = f"  ⚡Sweep:{uoa.get('sweep_count',0)}" if uoa.get("sweep_count", 0) > 0 else ""
        block_t = "  💰BigBlok" if uoa.get("big_block_detected") else ""
        not_f   = f"  ${uoa.get('total_notional_flow',0):,.0f}" if uoa.get("total_notional_flow", 0) > 0 else ""
        lines.append(f"🔥 UOA: <b>{uoa.get('uoa_signal','—')}</b> ({uoa_s:.0f}/100){sweep_t}{block_t}{not_f}")
        lines.append(f"   P/C:{uoa.get('put_call_ratio',0):.2f}  Ask-side:{uoa.get('ask_side_ratio',0):.0%}")
    if uoa.get("earnings_warning"):
        lines.append(f"   ⚠️ EARNINGS {uoa.get('earnings_days','?')} GÜN SONRA!")

    lines.append(f"🏭 Sektör: {sector}  ({c.get('sector_score',0):.0f}/10)")

    # DTE Regime
    pref = opt.get("pref_dte_range", (25, 45))
    lines.append(f"📅 Tercih DTE: {pref[0]}-{pref[1]}g  |  Vade: {opt.get('exp_date','—')} ({opt.get('dte','—')}g)")

    # Opsiyon blokları
    for key in ["gamma_sweet", "institutional"]:
        od = opt.get(key)
        if not od: continue
        sim = od.get("sim", {})
        lines.append(f"\n  {od['type']}")
        lines.append(
            f"  ${od['strike']:.0f} | {od['expiration']} ({od['dte']}g) | Maliyet: <b>${od['cost_per_contract']:.0f}</b>"
        )
        lines.append(
            f"  Δ={od['delta']:.2f} Γ={od['gamma']:.4f} ΓAccel={od.get('gamma_accel',1):.1f}x  "
            f"IV={od['iv_pct']:.0f}%  Geff={od.get('gamma_efficiency_log',0):.3f}"
        )
        lines.append(
            f"  Spread:%{od['spread_pct']:.1f}  OI:{od['oi']:,}  Vol:{od['volume']:,}  "
            f"V/OI:{od['vol_oi_ratio']:.2f}  Not:${od.get('notional',0):,.0f}"
        )
        if od.get("call_wall_danger"):
            lines.append(f"  ⚠️ CALL WALL TESPİT EDİLDİ — MM Trap riski!")
        if sim:
            lines.append(
                f"  📈 {sim.get('days_fwd',3)}g sim: ${sim.get('price_now',0):.2f}→${sim.get('price_fwd',0):.2f}  "
                f"<b>PNL:{sim.get('pnl_pct',0):+.0f}%</b>"
            )
        exit_s = dynamic_exit(od, l3, uoa)
        lines.append(f"  🎯 TP:${od['tp_price']:.2f}  SL:${od['sl_price']:.2f}  ZamanDurağı:{od['time_stop_days']}g")
        lines.append(f"  ⚙️ Çıkış: {exit_s}")

    return "\n".join(lines)

def build_report(candidates: list, vix: float, duration: float, n_scanned: int) -> Tuple[str, str]:
    n       = len(candidates)
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")
    r       = MARKET_REGIME_V2
    regime  = r.get("regime", "neutral").upper()
    qqq5    = r.get("qqq_5d", 0.0)
    qqq20   = r.get("qqq_20d", 0.0)

    summary = (
        f"🚀 <b>BOGA AI v220 — WINNER FORMULA</b>\n"
        f"🕒 {now_str}  |  VIX:{vix:.1f}  |  Rejim:<b>{regime}</b>\n"
        f"📊 QQQ 5g:{qqq5:+.1f}%  20g:{qqq20:+.1f}%\n"
        f"🔍 {n_scanned} hisse → <b>{n} ADAY</b>  ({duration:.0f}sn)\n\n"
    )

    for i, c in enumerate(candidates[:15], 1):
        l3   = c['l3']
        opt  = c['options']
        pe   = l3.get("pe_score", 0)
        bp   = l3.get("bp_score", 0)
        uoa_s= c['uoa'].get("uoa_score", 0)
        best = opt.get("gamma_sweet") or opt.get("institutional")
        cost = f"${best['cost_per_contract']:.0f}" if best else "—"
        dte  = f"{best['dte']}g"              if best else "—"
        s_pnl= best['sim'].get('pnl_pct', 0) if best and best.get('sim') else 0
        sweep = uoa_s >= 40

        summary += (
            f"{i}. <b>{c['ticker']}</b> ${c['current_price']:.0f}  {c['score']:.0f}pt\n"
            f"   💥PE:{pe:.0f} 🎯BP:{bp:.0f} {'⚡' if sweep else ''}UOA:{uoa_s:.0f}  {cost}/{dte}  sim:{s_pnl:+.0f}%\n"
            f"   {c.get('iv_ctx_label','')[:45]}\n"
            f"   {c['grade'][:40]}\n\n"
        )

    detail = "\n".join(build_option_block(c) for c in candidates[:10])
    return summary, detail

def save_picks(candidates: list):
    try:
        out = os.path.join(DATA_DIR, f"v220_{datetime.now().strftime('%Y%m%d_%H%M')}.json")
        with open(out, "w", encoding="utf-8") as f:
            json.dump(candidates, f, ensure_ascii=False, default=str, indent=2)
        logging.info(f"💾 {out}")
    except Exception as e:
        logging.error(f"JSON: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 17) ANA TARAMA
# ════════════════════════════════════════════════════════════════════════════

async def scan():
    start = time.time()

    await update_vix()
    await update_spy_returns()
    await update_qqq_regime()
    await update_sector_momentum()

    regime = MARKET_REGIME_V2.get("regime", "neutral")
    qqq5   = QQQ_RETURN_CACHE.get("return_5d", 0.0)

    await send_tg(
        f"🚀 <b>BOGA AI v220 — WINNER FORMULA</b>\n"
        f"🕒 {datetime.now(NY_TZ).strftime('%Y-%m-%d %H:%M NY')}\n"
        f"VIX:{MARKET_VIX['value']:.1f}  Rejim:<b>{regime.upper()}</b>  QQQ:{qqq5:+.1f}%\n\n"
        f"✅ v220 FİX'LER:\n"
        f"  🔧 FIX-1: Fake Sweep yamalandı ($100K notional)\n"
        f"  🔧 FIX-2: Gamma efficiency cap (log1p)\n"
        f"  🔧 FIX-3: DTE regime (PE+flow'a göre)\n"
        f"  🔧 FIX-4: MM Trap filtresi (EM/ATR)\n"
        f"  🆕 NEW-1: Breakout Proximity (20g zirve)\n"
        f"  🆕 NEW-2: 15m Intraday Engine\n"
        f"  🆕 NEW-3: Backtest Logger\n\n"
        f"🎯 Winner Formula: Sector+PE+BP+Flow+Γ+Vol\n"
        f"📊 {MAX_TICKERS_SCAN} hisse taranıyor..."
    )

    universe = await build_universe()
    if not universe:
        await send_tg("❌ Evren oluşturulamadı!"); return

    await send_tg(f"✅ {len(universe)} hisse — derin analiz başlıyor...")

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
            "⚠️ Aday bulunamadı!\n"
            "• Pre-explosion sinyali yok (sıkışma yok)\n"
            "• Breakout proximity zayıf (hisseler zirveden uzak)\n"
            "• MM Trap filtresi çok fazlasını engelledi → EM_ATR_MAX_RATIO değerini kontrol et\n"
        )
        save_picks(candidates)
        return

    duration = time.time() - start
    save_picks(candidates)

    summary, detail = build_report(candidates, MARKET_VIX['value'], duration, len(universe))
    await send_tg(summary)
    await asyncio.sleep(1)
    for chunk in split_safe(detail):
        if chunk.strip():
            await send_tg(chunk)
            await asyncio.sleep(0.8)

    best = candidates[0]
    best_opt = best['options'].get("gamma_sweet") or best['options'].get("institutional")
    await send_tg(
        f"✅ <b>v220 Tarama Tamamlandı!</b>\n"
        f"⏱ {duration:.0f}sn  |  {len(universe)} → {len(candidates)} aday\n"
        f"🏆 <b>{best['ticker']}</b> ({best['score']:.1f}/100)\n"
        f"💥 PE:{best['l3'].get('pe_score',0):.0f}  🎯 BP:{best['l3'].get('bp_score',0):.0f}\n"
        f"⚡ UOA:{best['uoa'].get('uoa_score',0):.0f}  {'$'+str(best_opt['cost_per_contract']) if best_opt else '—'}/{best_opt['dte']}g"
    )

# ════════════════════════════════════════════════════════════════════════════
# 18) ZAMANLAYICI
# ════════════════════════════════════════════════════════════════════════════

def get_next_run_utc(hour=10, minute=30):
    from datetime import timezone as tz
    now_utc = datetime.now(tz.utc)
    now_ny  = now_utc.astimezone(NY_TZ)
    cand    = now_ny.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if cand <= now_ny: cand += timedelta(days=1)
    while cand.weekday() >= 5: cand += timedelta(days=1)
    return cand.astimezone(tz.utc)

async def run_scanner():
    await send_tg(
        "🚀 <b>BOGA AI v220 BAŞLATILDI!</b>\n"
        "Hafta içi NY 10:30 otomatik tarama\n\n"
        "Winner Formula: Sector+PE+BP+Flow+Gamma+Vol\n"
        "Delta 0.28-0.45 | DTE dinamik | $200 max\n"
        "FIX: Fake Sweep + Gamma Cap + MM Trap + DTE Regime"
    )
    while True:
        try:
            from datetime import timezone as tz
            wait = (get_next_run_utc() - datetime.now(tz.utc)).total_seconds()
            if wait < 0 or wait > 90000: wait = 3600
            logging.info(f"🕒 Sonraki: ~{wait/3600:.1f}h")
            await asyncio.sleep(wait)
            await scan()
        except Exception as e:
            logging.error(f"Döngü: {e}")
            await send_tg(f"🚨 {e}")
            await asyncio.sleep(3600)

# ════════════════════════════════════════════════════════════════════════════
# 19) BAŞLATMA
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    if "--oneshot" in sys.argv:
        print("🚀 BOGA AI v220 (One-Shot)")
        asyncio.run(scan())
        print("✅ Tamamlandı.")
    else:
        try:
            asyncio.run(run_scanner())
        except KeyboardInterrupt:
            print("\n🚀 v220 durduruldu.")
        except Exception as e:
            print(f"Kritik: {e}")
