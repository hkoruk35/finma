"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🚀 BOGA AI v242.1 — SADE MİMARİ + KURUMSAL MANTIK                         ║
║   "Trend → Momentum → Breakout → Hacim → Opsiyon"                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  v242.1 — v242'den devralınan güçlü yanlar KORUNDU:                          ║
║    ✅ Sektör-önce pipeline (ETF RS bazlı evren, 500→40-60 hisse)           ║
║    ✅ Earnings hard block (<14g = tamamen eleme)                            ║
║    ✅ Black-Scholes greeks + kontrat seçimi                                 ║
║    ✅ Backtesting gerçek sonuç takibi                                       ║
║    ✅ Telegram altyapısı                                                    ║
║                                                                              ║
║  v242.1 YENİLİKLER — sadeleştirme & güçlendirme:                             ║
║    1. TREND ENGINE (1W + 1D)                                                ║
║       close > EMA20D > EMA50D > EMA200D  (günlük)                          ║
║       close > EMA20W > EMA50W            (haftalık — gerçek 1W verisi)     ║
║                                                                              ║
║    2. MOMENTUM ENGINE (1D + 1H)                                             ║
║       RSI_1D: 50-78  (ne çok zayıf ne aşırı alım)                         ║
║       1H: close > EMA20_1H + son 3 mum bullish bias                        ║
║                                                                              ║
║    3. BREAKOUT ENGINE (tek fonksiyon)                                       ║
║       20g direnç yakınlığı + hacim genişlemesi + sıkışma                   ║
║                                                                              ║
║    4. SKOR (5 bileşen, 100 puan, izlenebilir)                              ║
║       Trend:25 + Momentum:25 + Breakout/Squeeze:25 + Hacim:15 + Opsiyon:10 ║
║                                                                              ║
║    5. KALDIRILDI — gereksiz karmaşa                                         ║
║       ✗ 15m/1h korelasyon validasyonu                                      ║
║       ✗ 6 farklı EMA entry mode                                             ║
║       ✗ SETUP_RULES dict (6 setup tipi)                                    ║
║       ✗ bs_pnl_sim forward simülasyon                                       ║
║       ✗ Gamma/Theta hard eleme (bonus'a dönüştü)                           ║
║                                                                              ║
║  SEKTÖR EVREN (SECTOR_STOCKS):                                              ║
║    SMH→25 semi  XLK→20 tech  XLC→15 comm  XLV→15 health                   ║
║    XLE→12 energy  XLF→15 finans  ARKK→15 innovation                        ║
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
import requests_cache

session = requests_cache.CachedSession('yfinance.cache')
session.headers['User-agent'] = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
)
yf.base.utils.get_session = lambda: session

from datetime import datetime, timedelta, date
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
# ⚙️  AYARLAR
# ════════════════════════════════════════════════════════════════════════════

NY_TZ    = ZoneInfo("America/New_York")
HERE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
os.makedirs(DATA_DIR, exist_ok=True)

TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"
ENABLE_TELEGRAM  = True

# ── Evren filtresi ────────────────────────────────────────────────────────
PRICE_MIN      = 5.0
PRICE_MAX      = 500.0
AVG_VOL_MIN    = 1_000_000

# ── RS eşikleri ───────────────────────────────────────────────────────────
RS_60D_MIN = -15.0
RS_20D_MIN = -15.0

# ── Opsiyon parametreleri ─────────────────────────────────────────────────
DTE_MIN      = 1
DTE_MAX      = 30
SPREAD_MAX   = 0.40   # ATM seçimde gevşetildi
MID_MIN      = 0.01
OI_MIN       = 10     # ATM seçimde gevşetildi
ATM_STRIKES  = 5      # Fiyata en yakın kaç strike listelensin

EARNINGS_HARD_BLOCK_DAYS = 14
EARNINGS_WARN_DAYS       = 21

# ── Exit hedefleri ────────────────────────────────────────────────────────
TAKE_PROFIT_PCT = 0.50
STOP_LOSS_PCT   = 0.35

# ── Diğer ─────────────────────────────────────────────────────────────────
SEMAPHORE_N        = 2
NOTIONAL_SWEEP_MIN = 100_000
NOTIONAL_BLOCK_MIN = 500_000

# ── HOT SECTORS ──────────────────────────────────────────────────────────
HOT_SECTORS = {
    "Semiconductors": 15, "Technology": 12, "Health Care": 11,
    "Communication Services": 9, "Consumer Discretionary": 8,
    "Energy": 8, "Financials": 7, "Industrials": 6,
    "Materials": 5, "Consumer Staples": 3, "Utilities": 2, "Real Estate": 2,
}

# ── SEKTÖR ETF HARİTASI ───────────────────────────────────────────────────
SECTOR_ETFS = {
    "SMH":  "Semiconductors",
    "XLK":  "Technology",
    "XLC":  "Communication Services",
    "XLV":  "Health Care",
    "XLE":  "Energy",
    "XLF":  "Financials",
    "ARKK": "Technology",
}

# ════════════════════════════════════════════════════════════════════════════
# 🗺️  SEKTÖR EVREN HARİTASI
# ════════════════════════════════════════════════════════════════════════════

SECTOR_STOCKS: Dict[str, List[str]] = {
    "SMH": [
        "NVDA", "AVGO", "AMD", "MU", "ASML", "QCOM", "AMAT", "LRCX", "KLAC",
        "MRVL", "ON", "TXN", "ADI", "MCHP", "SWKS", "SLAB", "MPWR", "WOLF",
        "SMCI", "ARM", "TSM", "INTC", "NXPI", "STM", "AMBA",
    ],
    "XLK": [
        "MSFT", "AAPL", "GOOGL", "META", "CRM", "NOW", "ADBE", "ORCL",
        "SNOW", "PLTR", "DDOG", "MDB", "ZS", "CRWD", "PANW", "FTNT",
        "NET", "HUBS", "TWLO", "PATH",
    ],
    "XLC": [
        "NFLX", "DIS", "ROKU", "SPOT", "SNAP", "PINS", "RDDT",
        "PARA", "WBD", "TMUS", "T", "VZ", "CHTR", "LUMN", "COIN",
    ],
    "XLV": [
        "LLY", "UNH", "ABBV", "MRK", "JNJ", "PFE", "AMGN",
        "GILD", "REGN", "VRTX", "BIIB", "BMY", "CVS", "HUM", "MRNA",
    ],
    "XLE": [
        "XOM", "CVX", "OXY", "SLB", "EOG", "PXD", "COP",
        "MPC", "PSX", "VLO", "HAL", "BKR",
    ],
    "XLF": [
        "JPM", "GS", "MS", "BAC", "WFC", "C", "AXP",
        "BLK", "SCHW", "IBKR", "HOOD", "SOFI", "NU", "PYPL", "SQ",
    ],
    "ARKK": [
        "TSLA", "ROKU", "COIN", "SHOP", "MSTR", "PLTR", "EXAS",
        "PATH", "TWLO", "U", "RBLX", "AFRM", "UPST", "HOOD", "IONQ",
    ],
}

SCAN_MODE: str = "auto"


def is_market_open() -> bool:
    now = datetime.now(NY_TZ)
    if now.weekday() >= 5: return False
    return (now.replace(hour=9, minute=30, second=0, microsecond=0) <= now <=
            now.replace(hour=16, minute=0,  second=0, microsecond=0))


def is_pre_market() -> bool:
    now = datetime.now(NY_TZ)
    if now.weekday() >= 5: return False
    return (now.replace(hour=4, minute=0, second=0, microsecond=0) <= now <
            now.replace(hour=9, minute=30, second=0, microsecond=0))


def get_scan_mode() -> str:
    if SCAN_MODE != "auto": return SCAN_MODE
    if is_market_open(): return "market_open"
    if is_pre_market():  return "pre_market"
    return "market_closed"


# Global cache'ler
MARKET_VIX:          Dict[str, Any] = {"value": 18.0, "regime": "Orta 🟡"}
SPY_RETURN_CACHE:    Dict[str, Any] = {"ts": 0.0, "r60": 0.0, "r20": 0.0, "r5": 0.0}
SECTOR_ETF_CACHE:    Dict[str, Any] = {}
MARKET_REGIME:       Dict[str, Any] = {"regime": "bull", "score": 50, "qqq_5d": 0.0}
MARKET_OPEN_AT_SCAN: bool           = False
ACTIVE_SECTORS:      List[str]      = []
BOGA_REGIME_CACHE:   Dict[str, Any] = {"ok": True, "reason": "", "ts": 0.0}

# ════════════════════════════════════════════════════════════════════════════
# 1) TELEGRAM
# ════════════════════════════════════════════════════════════════════════════

def sanitize_html(text: str) -> str:
    if not text: return ""
    tags = {"<b>": "▶B◀", "</b>": "▶/B◀", "<i>": "▶I◀", "</i>": "▶/I◀",
            "<pre>": "▶PRE◀", "</pre>": "▶/PRE◀"}
    r = text
    for t, p in tags.items(): r = r.replace(t, p)
    r = r.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for t, p in tags.items(): r = r.replace(p, t)
    return r


def split_safe(msg: str, limit: int = 3800) -> list:
    if len(msg) <= limit: return [msg]
    chunks, lines, cur = [], msg.split("\n"), ""
    for line in lines:
        cand = cur + ("\n" if cur else "") + line
        if len(cand) > limit:
            if cur: chunks.append(cur)
            cur = line if len(line) <= limit else ""
            if len(line) > limit:
                for i in range(0, len(line), limit): chunks.append(line[i:i+limit])
        else:
            cur = cand
    if cur: chunks.append(cur)
    return chunks


async def send_tg(msg: str):
    if not ENABLE_TELEGRAM: print(msg); return
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    async with aiohttp.ClientSession() as s:
        for chunk in split_safe(sanitize_html(msg)):
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
                            async with s.post(url, json={
                                "chat_id": TELEGRAM_CHAT_ID, "text": plain[:3800]
                            }, timeout=20): pass
                await asyncio.sleep(0.4)
            except Exception as e:
                logging.error(f"TG: {e}")


# ════════════════════════════════════════════════════════════════════════════
# 2) MARKET DATA — VIX + SPY + QQQ + SEKTÖR ETF RS
# ════════════════════════════════════════════════════════════════════════════

async def update_market_data():
    """VIX, SPY, QQQ ve tüm sektör ETF RS değerlerini güncelle."""
    now   = time.time()
    stale = now - SPY_RETURN_CACHE.get("ts", 0) > 3600

    # VIX
    try:
        vd = await asyncio.to_thread(lambda: yf.Ticker("^VIX").history(period="5d"))
        if vd is not None and not vd.empty:
            v = float(vd['Close'].iloc[-1])
            MARKET_VIX.update({
                "value": v,
                "regime": "Düşük 🟢" if v < 18 else ("Orta 🟡" if v < 25 else "Yüksek 🔴")
            })
    except: pass

    if not stale: return

    # SPY referans getirileri
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("SPY").history(period="100d"))
        if df is not None and len(df) >= 65:
            c = df['Close'].astype(float)
            SPY_RETURN_CACHE.update({
                "ts":  now,
                "r60": float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100),
                "r20": float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100),
                "r5":  float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6 else 0.0,
            })
    except: pass

    # QQQ → piyasa rejimi skoru
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("QQQ").history(period="60d"))
        if df is not None and len(df) >= 22:
            c   = df['Close'].astype(float)
            q5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
            q20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            vix = MARKET_VIX.get("value", 20.0)
            ema20_qqq      = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])
            qqq_above_ema20 = float(c.iloc[-1]) > ema20_qqq
            score = 50
            score += 20 if vix < 16 else (10 if vix < 20 else (-25 if vix > 30 else (-15 if vix > 25 else 0)))
            score += 15 if q5 > 2  else (8  if q5 > 0  else (-15 if q5 < -2  else -8))
            score += 10 if q20 > 5 else (5  if q20 > 0 else (-10 if q20 < -5 else 0))
            score += 5 if qqq_above_ema20 else -10
            score = max(0, min(100, score))
            MARKET_REGIME.update({
                "regime": "bull" if score >= 65 else ("bear" if score < 40 else "neutral"),
                "score": score, "qqq_5d": round(q5, 2), "qqq_20d": round(q20, 2),
                "qqq_above_ema20": qqq_above_ema20,
            })
    except: pass

    # SPY gap tespiti
    try:
        df_spy = await asyncio.to_thread(
            lambda: yf.Ticker("SPY").history(period="5d", interval="1d")
        )
        if df_spy is not None and len(df_spy) >= 2:
            prev_close = float(df_spy['Close'].iloc[-2])
            today_open = float(df_spy['Open'].iloc[-1])
            gap_pct    = (today_open - prev_close) / prev_close * 100
            MARKET_REGIME["spy_gap_pct"]  = round(gap_pct, 2)
            MARKET_REGIME["spy_gap_up"]   = gap_pct > 0.3
            MARKET_REGIME["spy_gap_down"] = gap_pct < -0.3
    except:
        MARKET_REGIME.setdefault("spy_gap_pct", 0.0)
        MARKET_REGIME.setdefault("spy_gap_up", False)
        MARKET_REGIME.setdefault("spy_gap_down", False)

    # Sektör ETF RS hesabı
    spy_r5  = SPY_RETURN_CACHE.get("r5",  0.0)
    spy_r20 = SPY_RETURN_CACHE.get("r20", 0.0)

    for etf in list(SECTOR_ETFS.keys()) + ["IWM", "SMH"]:
        try:
            df = await asyncio.to_thread(lambda t=etf: yf.Ticker(t).history(period="40d"))
            if df is None or len(df) < 10: continue
            c   = df['Close'].astype(float)
            r5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
            r10 = float((c.iloc[-1] - c.iloc[-11]) / c.iloc[-11] * 100) if len(c) >= 11 else 0.0
            r20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            rs5  = r5  - spy_r5
            rs20 = r20 - spy_r20
            composite = r5 * 0.5 + r10 * 0.3 + rs5 * 0.2
            SECTOR_ETF_CACHE[etf] = {
                "r5": round(r5, 2), "r10": round(r10, 2), "r20": round(r20, 2),
                "rs5": round(rs5, 2), "rs20": round(rs20, 2),
                "composite": round(composite, 2),
            }
            await asyncio.sleep(0.1)
        except: pass


async def select_top_sectors(top_n: int = 2) -> List[str]:
    """En güçlü sektörleri composite RS skoruna göre seç."""
    vix    = MARKET_VIX.get("value", 20.0)
    regime = MARKET_REGIME.get("regime", "neutral")

    if regime == "bear":
        logging.info("Bear piyasa — sektör seçimi atlanıyor")
        return []

    effective_n = 1 if vix > 25 else top_n

    scored = []
    for etf, data in SECTOR_ETF_CACHE.items():
        if etf not in SECTOR_ETFS: continue
        if data.get("rs5", 0.0) < -5.0: continue   # Ciddi negatif sektörleri atla
        scored.append((etf, data.get("composite", 0.0)))

    scored.sort(key=lambda x: x[1], reverse=True)
    selected = [etf for etf, _ in scored[:effective_n]]

    # Fallback: tüm sektörler negatif olsa bile en iyi 1'i seç
    if not selected and SECTOR_ETF_CACHE:
        all_s = [(e, d.get("composite", 0.0)) for e, d in SECTOR_ETF_CACHE.items() if e in SECTOR_ETFS]
        all_s.sort(key=lambda x: x[1], reverse=True)
        if all_s:
            selected = [all_s[0][0]]
            logging.warning(f"⚠️ Fallback sektör: {selected}")

    logging.info(f"✅ Seçilen sektörler: {selected} (top {effective_n})")
    return selected


async def check_boga_market_regime(index: str = "^IXIC") -> Tuple[bool, str]:
    """
    BOGA STEP 1: Index EMA10 > EMA20 AND both slopes positive → LONG_ONLY
    NASDAQ: ^IXIC  |  DJ: ^DJI  |  SP500: ^GSPC
    """
    global BOGA_REGIME_CACHE
    now = time.time()
    if now - BOGA_REGIME_CACHE.get("ts", 0) < 1800:
        return BOGA_REGIME_CACHE["ok"], BOGA_REGIME_CACHE["reason"]
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker(index).history(period="60d", interval="1d"))
        if df is None or len(df) < 25:
            BOGA_REGIME_CACHE.update({"ok": True, "reason": "Veri yetersiz — devam", "ts": now})
            return True, "Veri yetersiz — devam"
        c = df['Close'].astype(float)
        e10s = EMAIndicator(c, 10).ema_indicator()
        e20s = EMAIndicator(c, 20).ema_indicator()
        ema10 = float(e10s.iloc[-1])
        ema20 = float(e20s.iloc[-1])
        slope10 = float(e10s.iloc[-1]) - float(e10s.iloc[-6]) if len(e10s) >= 6 else 0.0
        slope20 = float(e20s.iloc[-1]) - float(e20s.iloc[-6]) if len(e20s) >= 6 else 0.0
        if ema10 > ema20 and slope10 > 0 and slope20 > 0:
            reason = f"LONG_ONLY: {index} EMA10({ema10:.1f}) > EMA20({ema20:.1f}) ↑"
            BOGA_REGIME_CACHE.update({"ok": True, "reason": reason, "ts": now})
            return True, reason
        else:
            reason = (f"CASH_PROTECTION: {index} EMA10({ema10:.1f}) "
                      f"{'>' if ema10>ema20 else '<'} EMA20({ema20:.1f}) "
                      f"slope10={slope10:.2f} slope20={slope20:.2f}")
            BOGA_REGIME_CACHE.update({"ok": False, "reason": reason, "ts": now})
            return False, reason
    except Exception as e:
        BOGA_REGIME_CACHE.update({"ok": True, "reason": str(e), "ts": now})
        return True, str(e)


def boga_ticker_passes(df_1d: pd.DataFrame, cp: float) -> Tuple[bool, dict]:
    """
    BOGA STEP 2+3:
    - Close > EMA10 > EMA20 (daily)
    - RSI(14) >= 50 AND slope > 0
    - RVOL >= 1.5 (5g ort / 20g ort)
    - Daily Volume > 20g ortalaması
    """
    try:
        c = df_1d['Close'].astype(float)
        if len(c) < 22:
            return False, {"reason": "Yetersiz veri"}

        e10 = float(EMAIndicator(c, 10).ema_indicator().iloc[-1])
        e20 = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])

        if not (cp > e10 > e20):
            return False, {"reason": f"Trend bozuk: cp={cp:.2f} e10={e10:.2f} e20={e20:.2f}"}

        rsi_s = RSIIndicator(c, 14).rsi()
        rsi = float(rsi_s.iloc[-1])
        rsi_p5 = float(rsi_s.iloc[-6]) if len(rsi_s) >= 6 else rsi
        rsi_slope = rsi - rsi_p5

        if rsi < 50:
            return False, {"reason": f"RSI < 50: {rsi:.1f}"}
        if rsi_slope <= 0:
            return False, {"reason": f"RSI slope <= 0: {rsi_slope:.1f}"}

        vol = df_1d['Volume'].astype(float) if 'Volume' in df_1d.columns else pd.Series([1e6]*len(c))
        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        rvol = v5 / v20 if v20 > 0 else 1.0
        today_vol = float(vol.iloc[-1])

        if rvol < 1.5:
            return False, {"reason": f"RVOL < 1.5: {rvol:.2f}"}
        if today_vol < v20:
            return False, {"reason": f"Günlük vol < 20g ort"}

        return True, {
            "e10": round(e10, 2), "e20": round(e20, 2),
            "rsi": round(rsi, 1), "rsi_slope": round(rsi_slope, 1),
            "rvol": round(rvol, 2), "today_vol": int(today_vol),
        }
    except Exception as e:
        return False, {"reason": str(e)}


def build_sector_universe(active_sectors: List[str]) -> List[str]:
    """Seçilen sektörlerin hisselerini deduplicate ederek birleştir."""
    universe, seen = [], set()
    for etf in active_sectors:
        for ticker in SECTOR_STOCKS.get(etf, []):
            if ticker not in seen:
                universe.append(ticker)
                seen.add(ticker)
    return universe


def stage0_market_ok() -> Tuple[bool, dict]:
    """Piyasa koşulları taramaya uygun mu? VIX < 35 ve bear değilse devam."""
    vix    = MARKET_VIX.get("value", 20.0)
    regime = MARKET_REGIME.get("regime", "neutral")
    score  = MARKET_REGIME.get("score", 50)
    qqq5   = MARKET_REGIME.get("qqq_5d", 0.0)
    qqq_ema20 = MARKET_REGIME.get("qqq_above_ema20", True)
    gap_pct   = MARKET_REGIME.get("spy_gap_pct", 0.0)

    swing_ok = vix <= 22 and qqq_ema20

    issues = []
    if vix > 22:    issues.append(f"VIX > 22 ({vix:.1f}) — dikkatli ol")
    if not qqq_ema20: issues.append("QQQ EMA20 altında")
    if MARKET_REGIME.get("spy_gap_down"): issues.append(f"SPY gap down {gap_pct:+.2f}%")

    gap_lbl = (f"⬆️ GAP UP {gap_pct:+.2f}%" if MARKET_REGIME.get("spy_gap_up")
               else f"⬇️ GAP DOWN {gap_pct:+.2f}%" if MARKET_REGIME.get("spy_gap_down")
               else f"➡️ FLAT {gap_pct:+.2f}%")

    ok = regime != "bear" and vix < 35
    return ok, {
        "regime": regime, "score": score, "vix": round(vix, 1),
        "qqq_5d": qqq5, "qqq_above_ema20": qqq_ema20,
        "spy_gap_label": gap_lbl, "swing_ok": swing_ok, "issues": issues,
        "label": ("🟢 GÜÇLÜ BOĞA" if score >= 75 else "🟢 BOĞA" if score >= 65
                  else "🟡 NÖTR" if score >= 40 else "🔴 AYICI"),
        "swing_verdict": (
            "✅ SWING UYGUN" if swing_ok and not MARKET_REGIME.get("spy_gap_down")
            else "⚠️ SWING DİKKATLİ — gap down" if swing_ok
            else "🚫 SWING YAPMA — VIX > 22 veya QQQ EMA20 altı"
        ),
    }


# ════════════════════════════════════════════════════════════════════════════
# 3) MATEMATİK ARAÇLARI
# ════════════════════════════════════════════════════════════════════════════

def bs_greeks(S, K, T, r, sigma):
    e = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0: return e
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
    except: return e


def bs_price(S, K, T, r, sigma):
    if T <= 0 or sigma <= 0: return max(0.0, S - K)
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * sq)
        d2 = d1 - sigma * sq
        return round(S * norm_cdf(d1) - K * math.exp(-r * T) * norm_cdf(d2), 4)
    except: return 0.0


def calc_hv(close: pd.Series, lb: int = 20) -> float:
    if len(close) < lb + 1: return 0.30
    lr = np.log(close / close.shift(1)).dropna()
    return max(0.05, float(lr.tail(lb).std()) * math.sqrt(252))


def calc_iv_rank(iv: float, close: pd.Series) -> Tuple[float, float]:
    try:
        if len(close) < 60: return 50.0, 50.0
        lr  = np.log(close / close.shift(1)).dropna()
        hvs = (lr.rolling(20).std() * math.sqrt(252)).dropna()
        if len(hvs) < 10: return 50.0, 50.0
        mn, mx = float(hvs.min()), float(hvs.max())
        rank = max(0.0, min(100.0, (iv - mn) / (mx - mn) * 100)) if (mx - mn) > 0.001 else 50.0
        pct  = float((hvs < iv).sum()) / len(hvs) * 100
        return round(rank, 1), round(pct, 1)
    except: return 50.0, 50.0


def calc_vwap(df: pd.DataFrame) -> float:
    try:
        d  = df.tail(20).copy()
        tp = (d['High'].astype(float) + d['Low'].astype(float) + d['Close'].astype(float)) / 3.0
        v  = d['Volume'].astype(float)
        return round(float((tp * v).sum() / v.sum()), 3)
    except: return 0.0


def max_pain(calls, puts, cp):
    try:
        strikes = sorted(set(list(calls['strike'].values) + list(puts['strike'].values)))
        bp = cp; bv = float('inf')
        for ts in strikes:
            tot = (
                float(((ts - calls['strike']).clip(lower=0) * calls['openInterest'].fillna(0)).sum()) +
                float(((puts['strike'] - ts).clip(lower=0) * puts['openInterest'].fillna(0)).sum())
            )
            if tot < bv: bv = tot; bp = ts
        return bp
    except: return cp


# ════════════════════════════════════════════════════════════════════════════
# 4) TREND ENGINE — 1W + 1D
#    Amaç: hisse ana trendde yukarı mı?
#    Weekly: close > EMA20W > EMA50W
#    Daily:  close > EMA20D > EMA50D > EMA200D
# ════════════════════════════════════════════════════════════════════════════

def trend_engine(df_1d: pd.DataFrame, df_1w: pd.DataFrame) -> Tuple[bool, dict]:
    """
    Sade trend motoru.
    1W: close > EMA20W ve EMA20W > EMA50W  → haftalık yön bullish
    1D: close > EMA20D > EMA50D (> EMA200D arzu edilir)
    """
    try:
        c_1d = df_1d['Close'].astype(float)
        if len(c_1d) < 55: return False, {"block_reason": "Yetersiz günlük veri"}

        cp = float(c_1d.iloc[-1])

        # ── Günlük EMA ──
        e20d  = float(EMAIndicator(c_1d, 20).ema_indicator().iloc[-1])
        e50d  = float(EMAIndicator(c_1d, 50).ema_indicator().iloc[-1])
        e200d = float(EMAIndicator(c_1d, min(200, len(c_1d) - 1)).ema_indicator().iloc[-1]) if len(c_1d) >= 60 else None

        daily_trend_ok = (cp > e20d > e50d)
        if not daily_trend_ok:
            return False, {"block_reason": f"1D trend bozuk: cp={cp:.2f} e20={e20d:.2f} e50={e50d:.2f}"}

        # EMA200 altındaysa sadece kırılım durumunda geç
        above_ema200 = True
        if e200d is not None:
            above_ema200 = cp > e200d * 0.97   # %3 tolerans — kırılım yakını da dahil
            if not above_ema200:
                return False, {"block_reason": f"EMA200 altı: cp={cp:.2f} e200={e200d:.2f}"}

        # ATR-based extension koruması (exhaustion)
        try:
            atr_s = AverageTrueRange(df_1d['High'].astype(float), df_1d['Low'].astype(float), c_1d, 14).average_true_range()
            atr_v = float(atr_s.iloc[-1]) if not atr_s.empty else cp * 0.02
            if atr_v > 0 and (cp - e20d) / atr_v > 3.5:
                return False, {"block_reason": f"Exhaustion: fiyat EMA20'den çok uzakta"}
        except: pass

        # 5 günlük getiri — ciddi kanama kontrolü
        ret_5d = 0.0
        if len(c_1d) >= 6:
            ret_5d = (cp - float(c_1d.iloc[-6])) / float(c_1d.iloc[-6]) * 100
            if ret_5d < -7.0:
                return False, {"block_reason": f"5G sert düşüş: {ret_5d:.1f}%"}

        # EMA50 eğimi
        e50s    = EMAIndicator(c_1d, 50).ema_indicator()
        e50_sl  = float((e50d - float(e50s.iloc[-6])) / float(e50s.iloc[-6]) * 100) if len(e50s) >= 6 else 0.0

        # Trend skoru (0-25)
        trend_score = 10.0   # base: cp > EMA20 > EMA50
        if e200d and cp > e200d:      trend_score += 3.0
        if e50_sl >= 0.1:             trend_score += 2.0
        elif e50_sl >= -0.05:         trend_score += 1.0

        # HH yapısı (yükselen zirveler)
        hh = False
        if len(c_1d) >= 20:
            h1 = float(c_1d.iloc[-1])  > float(c_1d.iloc[-5])
            h2 = float(c_1d.iloc[-5])  > float(c_1d.iloc[-10])
            h3 = float(c_1d.iloc[-10]) > float(c_1d.iloc[-20])
            hh = h1 and h2 and h3
            if hh:           trend_score += 5.0
            elif h1 and h2:  trend_score += 3.0
            elif h1:         trend_score += 1.0

        # RS vs SPY (60 günlük)
        spy_r60 = SPY_RETURN_CACHE.get("r60", 0.0)
        roc60   = 0.0
        if len(c_1d) >= 61:
            roc60 = float((cp - float(c_1d.iloc[-61])) / float(c_1d.iloc[-61]) * 100)
        rs_60 = roc60 - spy_r60
        if rs_60 < RS_60D_MIN:
            return False, {"block_reason": f"RS60 çok zayıf: {rs_60:.1f}pp"}
        if rs_60 >= 15:      trend_score += 5.0
        elif rs_60 >= 8:     trend_score += 3.5
        elif rs_60 >= 3:     trend_score += 2.0
        elif rs_60 >= 0:     trend_score += 0.5

        # ── Haftalık trend ──
        weekly_ok   = False
        weekly_lbl  = "1W veri yok"
        w_bonus     = 0.0

        if df_1w is not None and len(df_1w) >= 22:
            c_1w = df_1w['Close'].astype(float)
            try:
                e20w = float(EMAIndicator(c_1w, 20).ema_indicator().iloc[-1])
                e50w = float(EMAIndicator(c_1w, 50).ema_indicator().iloc[-1]) if len(c_1w) >= 50 else e20w
                cp_w = float(c_1w.iloc[-1])
                weekly_ok = (cp_w > e20w) and (e20w > e50w * 0.99)
                if weekly_ok:
                    weekly_lbl = "1W Bullish ✅"
                    w_bonus    = 5.0
                    # Haftalık yükselen zirveler ekstra bonus
                    if len(c_1w) >= 8:
                        if float(c_1w.iloc[-1]) > float(c_1w.iloc[-4]) > float(c_1w.iloc[-8]):
                            w_bonus = 7.0
                else:
                    weekly_lbl = f"1W Nötr ⚠️ (cp={cp_w:.0f} e20w={e20w:.0f})"
            except: pass

        trend_score = min(trend_score + w_bonus, 25.0)

        return True, {
            "trend_score": round(trend_score, 1),
            "e20d": round(e20d, 3), "e50d": round(e50d, 3),
            "e200d": round(e200d, 3) if e200d else None,
            "above_ema200": above_ema200, "e50_slope": round(e50_sl, 3),
            "hh_structure": hh, "rs_60": round(rs_60, 2), "roc60": round(roc60, 2),
            "ret_5d": round(ret_5d, 2), "cp": round(cp, 2),
            "weekly_ok": weekly_ok, "weekly_label": weekly_lbl,
            "trend_label": (
                "🐂 GÜÇLÜ TREND"  if trend_score >= 20 else
                "📈 TREND OK"     if trend_score >= 14 else
                "🟡 ZAYIF TREND"
            ),
        }
    except Exception as e:
        logging.debug(f"trend_engine: {e}")
        return False, {}


# ════════════════════════════════════════════════════════════════════════════
# 5) MOMENTUM ENGINE — 1D + 1H
#    Amaç: hareket şu an canlı mı?
#    1D: RSI 50-78, RSI yükseliyor
#    1H: close > EMA20_1H, son 3 mum bullish bias
# ════════════════════════════════════════════════════════════════════════════

async def fetch_1h_data(ticker: str) -> Optional[pd.DataFrame]:
    try:
        df = await asyncio.wait_for(asyncio.to_thread(
            lambda: yf.Ticker(ticker).history(period="10d", interval="1h", auto_adjust=True)
        ), timeout=20)
        if df is None or len(df) < 14: return None
        df.columns = [str(c).strip().title() for c in df.columns]
        return df
    except: return None


async def fetch_1w_data(ticker: str) -> Optional[pd.DataFrame]:
    """Gerçek haftalık veri — 1W trend motoru için."""
    try:
        df = await asyncio.wait_for(asyncio.to_thread(
            lambda: yf.Ticker(ticker).history(period="2y", interval="1wk", auto_adjust=True)
        ), timeout=20)
        if df is None or len(df) < 22: return None
        df.columns = [str(c).strip().title() for c in df.columns]
        return df
    except: return None


def momentum_engine(df_1d: pd.DataFrame, df_1h: Optional[pd.DataFrame],
                    market_open: bool = True) -> Tuple[bool, dict]:
    """
    Momentum motoru — sade 3 soru:
    1. 1D RSI 50-78 bandında mı?
    2. 1H fiyat EMA20_1H üzerinde mi?
    3. Son 3 mum bullish bias mı?
    """
    try:
        c_1d = df_1d['Close'].astype(float)
        if len(c_1d) < 15: return False, {"block_reason": "Yetersiz 1D veri"}

        # ── Günlük RSI ──
        rsi_s  = RSIIndicator(c_1d, 14).rsi()
        rsi_1d = float(rsi_s.iloc[-1])
        rsi_p3 = float(rsi_s.iloc[-4]) if len(rsi_s) >= 4 else rsi_1d
        rsi_p5 = float(rsi_s.iloc[-6]) if len(rsi_s) >= 6 else rsi_1d
        rsi_slope = rsi_1d - rsi_p5

        if rsi_1d < 42:
            return False, {"block_reason": f"1D RSI çok düşük: {rsi_1d:.1f}"}
        if rsi_1d > 82:
            return False, {"block_reason": f"1D RSI aşırı alım: {rsi_1d:.1f}"}

        # Düşüş halinde olan RSI (falling knife) koruması
        if rsi_1d < 50 and rsi_1d < rsi_p3 and rsi_slope < -5:
            return False, {"block_reason": f"RSI düşüyor: {rsi_1d:.1f} (slope:{rsi_slope:.1f})"}

        # 1D momentum skoru
        mom_score = 0.0
        if 55 <= rsi_1d <= 72:   mom_score += 10.0   # ideal bölge
        elif 50 <= rsi_1d < 55:  mom_score += 6.0
        elif 72 < rsi_1d <= 78:  mom_score += 6.0    # yüksek ama henüz aşırı değil
        else:                    mom_score += 3.0

        if rsi_slope > 3:   mom_score += 3.0
        elif rsi_slope > 0: mom_score += 1.5

        # ── 1H analizi ──
        rsi_1h       = 55.0
        rsi_1h_slope = 0.0
        h1_ema_ok    = True
        h1_bias_ok   = True
        h1_lbl       = "1H veri yok"
        adx_1h       = 0.0

        if df_1h is not None and len(df_1h) >= 14:
            c_1h = df_1h['Close'].astype(float)
            o_1h = df_1h['Open'].astype(float) if 'Open' in df_1h.columns else c_1h

            # 1H RSI
            try:
                rsi_1h_s   = RSIIndicator(c_1h, 14).rsi()
                rsi_1h     = float(rsi_1h_s.iloc[-1])
                rsi_1h_p3  = float(rsi_1h_s.iloc[-4]) if len(rsi_1h_s) >= 4 else rsi_1h
                rsi_1h_slope = rsi_1h - rsi_1h_p3
            except: pass

            # 1H EMA20 filtresi: close > EMA20_1H
            try:
                e20_1h   = float(EMAIndicator(c_1h, 20).ema_indicator().iloc[-1])
                h1_ema_ok = float(c_1h.iloc[-1]) >= e20_1h * 0.98
            except: pass

            # Son 3 mum bullish bias
            try:
                last3_close = c_1h.tail(3).values
                last3_open  = o_1h.tail(3).values
                bullish_candles = sum(1 for i in range(3) if last3_close[i] >= last3_open[i])
                h1_bias_ok = bullish_candles >= 2
            except: pass

            # ADX
            try:
                adx_1h = float(ADXIndicator(df_1h['High'], df_1h['Low'], c_1h, 14).adx().iloc[-1])
            except: pass

            # 1H RSI hard block (sadece çok aşırı durumlarda)
            if market_open and rsi_1h < 35:
                return False, {"block_reason": f"1H RSI çok düşük: {rsi_1h:.1f}"}
            if market_open and rsi_1h > 85:
                return False, {"block_reason": f"1H RSI FOMO: {rsi_1h:.1f}"}

            # Dual TF düşüş — ölü kedi koruması
            if rsi_slope < -5 and rsi_1h_slope < -5:
                return False, {"block_reason": "Dual TF RSI düşüş — ölü kedi riski"}

            h1_lbl = f"{rsi_1h:.0f}"

            # 1H bonus
            if h1_ema_ok:   mom_score += 4.0
            if h1_bias_ok:  mom_score += 3.0
            if rsi_1h >= 55 and rsi_1h_slope > 0: mom_score += 3.0
            elif rsi_1h >= 50: mom_score += 1.5
            if adx_1h >= 20:   mom_score += 2.0

        mom_score = min(mom_score, 25.0)

        # Genel momentum durumu
        momentum_label = (
            "🔥 GÜÇLÜ MOMENTUM" if mom_score >= 20 else
            "📈 POZİTİF"        if mom_score >= 13 else
            "🟡 ORTA MOMENTUM"
        )

        return True, {
            "mom_score": round(mom_score, 1),
            "rsi_1d": round(rsi_1d, 1), "rsi_slope": round(rsi_slope, 1),
            "rsi_1h": h1_lbl, "rsi_1h_val": round(rsi_1h, 1),
            "rsi_1h_slope": round(rsi_1h_slope, 1),
            "h1_ema_ok": h1_ema_ok, "h1_bias_ok": h1_bias_ok,
            "adx_1h": round(adx_1h, 1),
            "momentum_label": momentum_label,
        }
    except Exception as e:
        logging.debug(f"momentum_engine: {e}")
        return False, {}


# ════════════════════════════════════════════════════════════════════════════
# 6) BREAKOUT + SQUEEZE ENGINE — tek fonksiyon
#    Amaç: patlama öncesi enerji birikimi + direnç yakınlığı
#    Breakout: direnç %3 içinde + hacim genişliyor
#    Squeeze: BB daralması + ATR düşüyor + NR7 + hacim kuruma
# ════════════════════════════════════════════════════════════════════════════

def breakout_squeeze_engine(df: pd.DataFrame) -> dict:
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 30:
            return {"bs_score": 0.0, "bs_label": "—", "setup_type": "HAFIF"}

        cp  = float(c.iloc[-1])
        score = 0.0

        # ── BREAKOUT YAKINILIK ──
        high_20 = float(h.tail(20).max())
        high_5  = float(h.tail(5).max())
        dist_20h = (cp - high_20) / high_20 * 100 if high_20 > 0 else -10.0
        dist_5h  = (cp - high_5)  / high_5  * 100 if high_5  > 0 else -10.0

        near_breakout  = dist_20h >= -3.0
        above_5d_high  = dist_5h  >= 0.0
        at_new_high    = dist_20h >= 0.0

        if at_new_high:      score += 8.0
        elif near_breakout:  score += 5.0

        if above_5d_high:    score += 3.0

        # VWAP geri kazanım
        vwap = calc_vwap(df)
        vwap_ok = vwap > 0 and cp >= vwap
        if vwap_ok: score += 2.0

        # ── SQUEEZE (enerji birikimi) ──
        # Bollinger band daralması
        bb  = BollingerBands(c, window=20, window_dev=2)
        bw  = ((bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()).dropna()
        bb_pct = 50.0
        if not bw.empty and len(bw) >= 20:
            cur    = float(bw.iloc[-1])
            bb_pct = float((bw.tail(120) < cur).sum() / len(bw.tail(120)) * 100)
            if bb_pct < 5:    score += 5.0
            elif bb_pct < 10: score += 3.5
            elif bb_pct < 20: score += 2.0
            elif bb_pct < 35: score += 0.5

        # ATR daralıyor mu?
        atr_s = AverageTrueRange(h, lo, c, 14).average_true_range().dropna()
        atr_falling = (len(atr_s) >= 11 and
                       float(atr_s.iloc[-1]) < float(atr_s.iloc[-6]) < float(atr_s.iloc[-11]))
        if atr_falling: score += 3.0

        # NR7 (en dar günlük range son 7 günde)
        dr  = (h - lo).values
        nr7 = len(dr) >= 7 and dr[-1] == min(dr[-7:])
        nr4 = len(dr) >= 4 and dr[-1] == min(dr[-4:])
        if nr7:   score += 4.0
        elif nr4: score += 2.0

        # Inside bar cluster (sıkışma mumu kümesi)
        icluster = sum(
            1 for i in range(-3, 0)
            if float(h.iloc[i]) <= float(h.iloc[i - 1]) and float(lo.iloc[i]) >= float(lo.iloc[i - 1])
        ) >= 2
        if icluster: score += 3.0

        # Hacim kuruması (squeeze teyidi)
        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        vol_dryup = v5 < v20 * 0.80
        if vol_dryup: score += 1.5

        score = min(score, 25.0)

        # Setup tipi tespiti (Telegram raporu için)
        if at_new_high and nr7:         setup_type = "NR7_BREAKOUT"
        elif at_new_high:               setup_type = "NEW_HIGH"
        elif nr7 and score >= 12:       setup_type = "NR7_SIKIŞ"
        elif bb_pct < 10 and atr_falling: setup_type = "BB_SIKIŞ"
        elif near_breakout:             setup_type = "BREAKOUT_YAKINI"
        elif icluster:                  setup_type = "INSIDE_CLUSTER"
        else:                           setup_type = "HAFIF"

        bs_label = (
            "💥 KRİTİK SETUP"   if score >= 20 else
            "🔥 GÜÇLÜ SETUP"    if score >= 14 else
            "🟡 ORTA SETUP"     if score >= 7  else
            "📊 HAFİF"
        )

        return {
            "bs_score": round(score, 1), "bs_label": bs_label, "setup_type": setup_type,
            "dist_20h": round(dist_20h, 2), "dist_5h": round(dist_5h, 2),
            "near_breakout": near_breakout, "above_5d_high": above_5d_high,
            "at_new_high": at_new_high, "vwap_ok": vwap_ok, "vwap": round(vwap, 2),
            "bb_pct": round(bb_pct, 1), "atr_falling": atr_falling,
            "nr7": nr7, "nr4": nr4, "inside_cluster": icluster, "vol_dryup": vol_dryup,
        }
    except Exception as e:
        logging.debug(f"breakout_squeeze: {e}")
        return {"bs_score": 0.0, "bs_label": "—", "setup_type": "HAFIF"}


# ════════════════════════════════════════════════════════════════════════════
# 7) HACİM MOTORU — RVOL + akümülasyon
# ════════════════════════════════════════════════════════════════════════════

def volume_engine(df: pd.DataFrame) -> dict:
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)

        v5   = float(vol.tail(5).mean())
        v20  = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        v30  = float(vol.tail(30).mean()) if len(vol) >= 30 else v5
        rvol = v5 / v20 if v20 > 0 else 1.0
        today_vol  = float(vol.iloc[-1])
        today_rvol = today_vol / v20 if v20 > 0 else 1.0

        # Fiyat + hacim birlikteliği: fiyat yükselirken hacim artıyor mu?
        price_up_vol_up = False
        if len(c) >= 2 and len(vol) >= 2:
            price_up_vol_up = (float(c.iloc[-1]) > float(c.iloc[-2]) and
                               float(vol.iloc[-1]) > float(vol.tail(5).mean()))

        # Kapanış pozisyonu (güçlü kapanışlar = akümülasyon)
        acc_days = 0
        atr_s   = AverageTrueRange(h, lo, c, 14).average_true_range().dropna()
        atr_val = float(atr_s.iloc[-1]) if not atr_s.empty else float(c.iloc[-1]) * 0.02
        today_range = float(h.iloc[-1]) - float(lo.iloc[-1])
        drive_ratio = today_range / atr_val if atr_val > 0 else 1.0

        for i in range(-5, 0):
            try:
                day_range = float(h.iloc[i]) - float(lo.iloc[i])
                if day_range > 0:
                    close_pos = (float(c.iloc[i]) - float(lo.iloc[i])) / day_range
                    if close_pos > 0.65: acc_days += 1
            except: pass

        vol_score = 0.0
        if rvol >= 2.5:   vol_score += 7.0
        elif rvol >= 1.8: vol_score += 5.0
        elif rvol >= 1.3: vol_score += 3.5
        elif rvol >= 1.1: vol_score += 2.0

        if today_rvol >= 3.0:   vol_score += 4.0
        elif today_rvol >= 2.0: vol_score += 2.5
        elif today_rvol >= 1.5: vol_score += 1.5

        if drive_ratio >= 2.0: vol_score += 2.0
        elif drive_ratio >= 1.5: vol_score += 1.0

        if acc_days >= 4:   vol_score += 2.0
        elif acc_days >= 2: vol_score += 1.0

        if price_up_vol_up: vol_score += 1.0

        vol_score = min(vol_score, 15.0)

        return {
            "vol_score": round(vol_score, 1),
            "vol_label": (
                "🔥 HACİM PATLAMASI" if vol_score >= 12 else
                "📈 GÜÇLÜ RVOL"      if vol_score >= 7  else
                "👀 HAFİF İVME"      if vol_score >= 3  else "—"
            ),
            "rvol": round(rvol, 2), "today_rvol": round(today_rvol, 2),
            "drive_ratio": round(drive_ratio, 2), "acc_days": acc_days,
            "price_up_vol_up": price_up_vol_up,
        }
    except Exception as e:
        logging.debug(f"volume_engine: {e}")
        return {"vol_score": 0.0, "vol_label": "—", "rvol": 1.0, "today_rvol": 1.0}


# ════════════════════════════════════════════════════════════════════════════
# 8) OPSİYON UYUM MOTORU — earnings + flow + kontrat seçimi
# ════════════════════════════════════════════════════════════════════════════

async def options_engine(ticker: str, cp: float, close: pd.Series, hv: float) -> Optional[dict]:
    """
    Earnings hard block + flow analizi + en iyi kontrat seçimi.
    Döner: kontrat detayları veya None (uygun kontrat yoksa)
    """
    result = {
        "opt_score": 0.0,
        "earnings_days": None, "earnings_warning": False, "earnings_hard_block": False,
        "flow_label": "—", "sweep_count": 0, "put_call_ratio": 1.0,
        "total_notional": 0.0, "big_block": False,
        "best": None,
        "atm_iv": 0.0, "iv_rank": 50.0, "iv_pct_rank": 50.0,
        "max_pain": round(cp, 2),
    }

    try:
        stock = yf.Ticker(ticker)
        today = date.today()

        # ── EARNINGS HARD BLOCK ──
        try:
            cal = await asyncio.to_thread(lambda: stock.calendar)
            earn_date = None
            if isinstance(cal, dict):
                earn_date = cal.get("Earnings Date", [None])[0]
            elif hasattr(cal, 'T'):
                row = cal.T.get("Earnings Date", None)
                earn_date = row.iloc[0] if row is not None and len(row) > 0 else None
            if earn_date is not None:
                if hasattr(earn_date, 'date'):   earn_date = earn_date.date()
                elif isinstance(earn_date, str): earn_date = datetime.strptime(earn_date[:10], "%Y-%m-%d").date()
                days = (earn_date - today).days
                result["earnings_days"] = days
                if 0 <= days < EARNINGS_HARD_BLOCK_DAYS:
                    result["earnings_hard_block"] = True
                    return result
                elif days < EARNINGS_WARN_DAYS:
                    result["earnings_warning"] = True
        except: pass

        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps: return result

        # ── FLOW ANALİZİ ──
        near_exps = sorted(
            [(d, (datetime.strptime(d, "%Y-%m-%d").date() - today).days)
             for d in exps if DTE_MIN <= (datetime.strptime(d, "%Y-%m-%d").date() - today).days <= DTE_MAX],
            key=lambda x: x[1]
        )

        call_vol = 0; put_vol = 0; sweeps = 0; notional = 0.0; ask_vol = 0; all_vol = 0
        best_result = None; best_score = -999.0
        atm_iv_collected = []
        all_atm_contracts: List[dict] = []

        for exp_d, dte in near_exps:
            try:
                chain = await asyncio.to_thread(lambda e=exp_d: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None else pd.DataFrame()

                if calls.empty: continue

                for col in ['volume', 'openInterest', 'ask', 'bid', 'impliedVolatility', 'strike']:
                    if col in calls.columns:
                        calls[col] = pd.to_numeric(calls[col], errors='coerce').fillna(0)

                # ATM IV tespiti
                calls_valid = calls.dropna(subset=['strike'])
                if not calls_valid.empty:
                    atm_idx = (calls_valid['strike'] - cp).abs().idxmin()
                    raw_iv  = float(calls_valid.loc[atm_idx].get('impliedVolatility', hv) or hv)
                    atm_iv_collected.append(max(raw_iv, hv * 0.5))

                call_vol += int(calls.get('volume', pd.Series()).sum())

                # Sweep tespiti
                for _, row in calls.iterrows():
                    oi_  = float(row.get('openInterest', 0))
                    vol_ = float(row.get('volume', 0))
                    ask_ = float(row.get('ask', 0))
                    bid_ = float(row.get('bid', 0))
                    mid_ = (ask_ + bid_) / 2.0
                    not_ = vol_ * mid_ * 100
                    if oi_ > 20 and vol_ > 0 and vol_ / max(oi_, 1) >= 3.0 and not_ >= NOTIONAL_SWEEP_MIN:
                        sweeps += 1
                    if float(row.get('strike', 0)) > cp * 1.03 and ask_ > 0.5 and vol_ >= 50:
                        notional += not_
                    if vol_ > 0 and ask_ > bid_ * 1.05: ask_vol += int(vol_)
                    all_vol += int(vol_)

                if not puts.empty:
                    puts['volume'] = pd.to_numeric(puts.get('volume', 0), errors='coerce').fillna(0)
                    put_vol += int(puts['volume'].sum())

                # ── KONTRAT SEÇİMİ — Fiyata en yakın strike'lar ──
                atm_iv = atm_iv_collected[-1] if atm_iv_collected else hv
                T = dte / 365.0
                r = 0.05
                iv_rank, iv_pct = calc_iv_rank(atm_iv, close)

                # Strike'ları fiyata yakınlık sırasına diz, en yakın ATM_STRIKES adet al
                atm_candidates = []
                for _, row in calls.iterrows():
                    try:
                        strike = float(row['strike'])
                        bid    = float(row.get('bid', 0) or 0)
                        ask    = float(row.get('ask', 0) or 0)
                        if ask <= 0: continue
                        mid    = (bid + ask) / 2.0
                        if mid < MID_MIN: continue
                        spread = (ask - bid) / ask if ask > 0 else 1.0
                        if spread > SPREAD_MAX: continue
                        oi     = int(row.get('openInterest', 0) or 0)
                        if oi < OI_MIN: continue
                        dist   = abs(strike - cp)
                        atm_candidates.append((dist, strike, bid, ask, mid, spread, oi,
                                               int(row.get('volume', 0) or 0),
                                               float(row.get('impliedVolatility', atm_iv) or atm_iv)))
                    except: continue

                atm_candidates.sort(key=lambda x: x[0])

                for dist, strike, bid, ask, mid, spread, oi, volume, iv_row in atm_candidates[:ATM_STRIKES]:
                    try:
                        iv_row = max(iv_row, 0.05)
                        g     = bs_greeks(cp, strike, T, r, iv_row)
                        delta = g['delta']
                        gamma = g['gamma']
                        theta = g['theta']
                        vol_oi = volume / oi if oi > 0 else 0.0
                        time_stop = min(max(round(dte * 0.40), 2), 7)
                        tp_target  = round(mid * (1.0 + TAKE_PROFIT_PCT), 2)
                        sl_breaker = round(mid * (1.0 - STOP_LOSS_PCT),  2)
                        gt_ratio   = round(gamma / (ask * abs(theta)), 3) if ask > 0 and abs(theta) > 0 else 0.0

                        contract = {
                            "strike": strike, "expiration": exp_d, "dte": dte,
                            "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                            "spread_pct": round(spread * 100, 1),
                            "oi": oi, "volume": volume, "vol_oi": round(vol_oi, 3),
                            "iv_pct": round(iv_row * 100, 1),
                            "delta": round(delta, 3), "gamma": round(gamma, 5),
                            "theta": round(theta, 4), "gt_ratio": gt_ratio,
                            "cost_per_contract": round(ask * 100, 0),
                            "tp_price": tp_target, "sl_price": sl_breaker,
                            "time_stop_days": time_stop,
                            "breakeven": round(strike + ask, 2),
                            "iv_rank": iv_rank, "iv_pct_rank": iv_pct,
                            "atm_iv": round(atm_iv * 100, 1),
                            "dist_pct": round(dist / cp * 100, 2),
                            "atm_label": ("ATM" if dist/cp < 0.01 else
                                          "ITM" if strike < cp else "OTM"),
                        }

                        if best_result is None or dist < abs(best_result["strike"] - cp):
                            best_result = contract

                        all_atm_contracts.append(contract)
                    except: continue

            except: continue

        result["sweep_count"]    = sweeps
        result["total_notional"] = round(notional, 0)
        result["best"]           = best_result
        # ATM yakını tüm kontratlar (fiyata yakınlık sırasına göre)
        all_atm_contracts.sort(key=lambda x: x.get("dist_pct", 99))
        result["atm_contracts"]  = all_atm_contracts

        if best_result:
            result["atm_iv"]      = best_result["atm_iv"]
            result["iv_rank"]     = best_result["iv_rank"]
            result["iv_pct_rank"] = best_result["iv_pct_rank"]

        pc = put_vol / call_vol if call_vol > 0 else 1.0
        result["put_call_ratio"] = round(pc, 2)

        # Flow skoru (0-10)
        flow_s = 0.0
        if pc < 0.4:   flow_s += 3.0
        elif pc < 0.6: flow_s += 2.0
        elif pc < 0.8: flow_s += 1.0
        elif pc > 1.5: flow_s -= 1.0
        if sweeps >= 3:   flow_s += 4.0
        elif sweeps >= 2: flow_s += 3.0
        elif sweeps >= 1: flow_s += 2.0
        if notional >= NOTIONAL_BLOCK_MIN:  flow_s += 3.0; result["big_block"] = True
        elif notional >= NOTIONAL_SWEEP_MIN: flow_s += 1.5; result["big_block"] = True
        ask_r = ask_vol / all_vol if all_vol > 0 else 0.5
        if ask_r > 0.75: flow_s += 2.0
        elif ask_r > 0.6: flow_s += 1.0
        if result["earnings_warning"]: flow_s -= 8.0

        flow_s = max(0.0, min(flow_s, 10.0))

        # IV skoru
        iv_rank = result["iv_rank"]
        is_sq   = False   # breakout_squeeze'den geliyor; analyze() içinde güncellenecek
        if iv_rank <= 20:   iv_s = 5.0
        elif iv_rank <= 35: iv_s = 4.0
        elif iv_rank <= 50: iv_s = 3.0
        elif iv_rank <= 65: iv_s = 1.0
        else:               iv_s = 0.0

        opt_score = min(flow_s + iv_s, 10.0)
        result["opt_score"]  = round(opt_score, 1)
        result["flow_label"] = (
            "🔥 KURUMSAL SWEEP" if flow_s >= 7 else
            "📈 POZİTİF AKIŞ"  if flow_s >= 4 else
            "👀 HAFİF UOA"     if flow_s >= 2 else "—"
        )

        if best_result:
            # max_pain hesabı (son exp için)
            try:
                last_exp = near_exps[-1][0]
                chain2   = await asyncio.to_thread(lambda: stock.option_chain(last_exp))
                result["max_pain"] = round(max_pain(chain2.calls, chain2.puts, cp), 2)
            except: pass

    except Exception as e:
        logging.debug(f"options_engine {ticker}: {e}")

    return result


# ════════════════════════════════════════════════════════════════════════════
# 9) BACKTESTING — gerçek sonuç takibi (v242'den korundu)
# ════════════════════════════════════════════════════════════════════════════

def log_backtest(c: dict):
    try:
        boga  = c.get("boga", {})
        opt   = c.get("opt",  {})
        best  = opt.get("best") or {}
        rec   = {
            "ts":         datetime.now(NY_TZ).isoformat(),
            "ticker":     c.get("ticker"),
            "price":      c.get("current_price"),
            "score":      c.get("score"),
            "sector_etf": c.get("sector_etf", "—"),
            "setup_type": "BOGA",
            "rsi_1d":     boga.get("rsi"),
            "rvol":       boga.get("rvol"),
            "delta":      best.get("delta"),
            "dte":        best.get("dte"),
            "gt_ratio":   best.get("gt_ratio"),
            "cost":       best.get("cost_per_contract"),
            "iv_rank":    best.get("iv_rank"),
            "peak_pct":   None, "peak_date": None,
            "time_to_peak": None, "hit_tp": None, "hit_sl": None,
            "atr_pct":    2.0,
        }
        path = os.path.join(DATA_DIR, "backtest_log.jsonl")
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
    except: pass


async def fill_backtest_results():
    path = os.path.join(DATA_DIR, "backtest_log.jsonl")
    if not os.path.exists(path): return
    try:
        with open(path, "r", encoding="utf-8") as f:
            records = [json.loads(line) for line in f if line.strip()]
    except: return
    if not records: return

    pending = [r for r in records[-30:] if r.get("peak_pct") is None and r.get("ticker")]
    if not pending: return

    updated = 0
    for rec in pending:
        try:
            ticker      = rec["ticker"]
            entry_price = float(rec.get("price") or 0)
            entry_ts    = rec.get("ts", "")
            dte         = int(rec.get("dte") or 21)
            atr_pct     = float(rec.get("atr_pct") or 2.0)
            if not entry_ts or entry_price <= 0: continue

            try:
                entry_dt = datetime.fromisoformat(entry_ts).date()
            except: continue

            today = date.today()
            if (today - entry_dt).days < 1: continue

            df = await asyncio.wait_for(asyncio.to_thread(
                lambda t=ticker, s=entry_dt.strftime("%Y-%m-%d"), e=today.strftime("%Y-%m-%d"):
                    yf.Ticker(t).history(start=s, end=e)
            ), timeout=20)

            if df is None or len(df) < 2: continue

            closes = df['Close'].astype(float).values
            highs  = df['High'].astype(float).values
            lows   = df['Low'].astype(float).values

            peak_price   = float(max(highs))
            peak_pct     = (peak_price - entry_price) / entry_price * 100
            peak_idx     = int(np.argmax(highs))

            atr_abs  = entry_price * (atr_pct / 100.0)
            tp_level = entry_price + 2.5 * atr_abs
            sl_level = entry_price - 1.5 * atr_abs

            hit_tp = False; hit_sl = False
            for hi, lo in zip(highs, lows):
                if lo <= sl_level:  hit_sl = True; break
                if hi >= tp_level:  hit_tp = True; break

            rec["peak_pct"]    = round(peak_pct, 2)
            rec["time_to_peak"] = peak_idx + 1
            rec["hit_tp"]      = hit_tp
            rec["hit_sl"]      = hit_sl
            updated += 1
        except Exception as e:
            logging.debug(f"backtest fill {rec.get('ticker')}: {e}")
            continue

    if updated == 0: return
    try:
        with open(path, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
        logging.info(f"✅ Backtest: {updated} kayıt güncellendi")
    except Exception as e:
        logging.error(f"Backtest yazma: {e}")


def get_backtest_summary() -> dict:
    path = os.path.join(DATA_DIR, "backtest_log.jsonl")
    if not os.path.exists(path): return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            records = [json.loads(line) for line in f if line.strip()]
    except: return {}

    filled = [r for r in records if r.get("peak_pct") is not None]
    if len(filled) < 5: return {"msg": f"Henüz {len(filled)} sonuç var"}

    last50 = filled[-50:]
    peaks  = [r["peak_pct"] for r in last50]
    wins   = [r for r in last50 if r.get("hit_tp")]
    losses = [r for r in last50 if r.get("hit_sl")]

    setup_stats: Dict[str, list] = {}
    for r in last50:
        st = r.get("setup_type", "UNKNOWN")
        if st not in setup_stats: setup_stats[st] = []
        setup_stats[st].append(r.get("peak_pct", 0))

    return {
        "total":    len(last50),
        "win_rate": round(len(wins)   / len(last50) * 100, 1),
        "sl_rate":  round(len(losses) / len(last50) * 100, 1),
        "avg_peak": round(sum(peaks)  / len(peaks), 1),
        "max_peak": round(max(peaks), 1),
        "setup_breakdown": {
            st: {"count": len(v), "avg_peak": round(sum(v) / len(v), 1)}
            for st, v in setup_stats.items()
        },
    }


# ════════════════════════════════════════════════════════════════════════════
# 10) SEKTÖR SKORU — ETF RS bağlı
# ════════════════════════════════════════════════════════════════════════════

def sector_score_from_etf(etf: str) -> Tuple[float, dict]:
    data = SECTOR_ETF_CACHE.get(etf, {})
    rs5  = data.get("rs5", 0.0)
    sector_name = SECTOR_ETFS.get(etf, "")
    base = 5.0
    for k, pts in HOT_SECTORS.items():
        if k.lower() in sector_name.lower():
            base = min(pts / 15.0 * 10.0, 10.0); break
    if rs5 > 4:    base = min(base + 3.0, 15.0)
    elif rs5 > 2:  base = min(base + 1.5, 15.0)
    elif rs5 < -2: base = max(base - 2.0, 0.0)
    return round(base, 1), {"etf": etf, "sector_name": sector_name, "rs5": rs5}


# ════════════════════════════════════════════════════════════════════════════
# 11) ANA ANALİZ — 5 katman + skor
# ════════════════════════════════════════════════════════════════════════════

ANALYSIS_SEM     = asyncio.Semaphore(SEMAPHORE_N)
PROGRESS_COUNTER = 0
TOTAL_TO_SCAN    = 0


async def analyze(ticker: str, sector_etf: str = "") -> Optional[dict]:
    global PROGRESS_COUNTER
    async with ANALYSIS_SEM:
        try:
            PROGRESS_COUNTER += 1
            print(f"🔍 [{PROGRESS_COUNTER}/{TOTAL_TO_SCAN}] {ticker} ({sector_etf})")

            # Açılış ilk 15 dakika filtresi (piyasa saatinde)
            now_ny = datetime.now(NY_TZ)
            if now_ny.weekday() < 5:
                market_open_time = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)
                if market_open_time <= now_ny < market_open_time + timedelta(minutes=15):
                    logging.info(f"⏳ {ticker}: açılış 15dk filtresi")
                    return None

            # ── STAGE 0: Bear market hard gate ──
            if MARKET_REGIME.get("regime") == "bear": return None

            # ── VERİ: Günlük 300 gün ──
            df_1d = await asyncio.wait_for(asyncio.to_thread(
                lambda: yf.Ticker(ticker).history(period="300d", interval="1d", auto_adjust=True)
            ), timeout=30)
            if df_1d is None or len(df_1d) < 55: return None
            df_1d.columns = [
                str(c).strip().title() for c in
                (df_1d.columns.get_level_values(0) if isinstance(df_1d.columns, pd.MultiIndex) else df_1d.columns)
            ]
            if 'Close' not in df_1d.columns: return None

            close = df_1d['Close'].astype(float)
            cp    = float(close.iloc[-1])
            if not (PRICE_MIN <= cp <= PRICE_MAX): return None

            vol_mean = float(df_1d['Volume'].astype(float).tail(20).mean()) if 'Volume' in df_1d.columns else 0
            if vol_mean < AVG_VOL_MIN: return None

            # ── BOGA GATE (STEP 2+3): Close > EMA10 > EMA20, RSI≥50↑, RVOL≥1.5 ──
            # Bu zorunlu giriş koşuludur — geçmeden diğer engine'ler çalışmaz
            boga_ok, boga_info = boga_ticker_passes(df_1d, cp)
            if not boga_ok:
                logging.debug(f"❌ {ticker}: {boga_info.get('reason', '—')}")
                return None

            # ── KATMAN 1: TREND ENGINE (1W + 1D) ──
            df_1w = await fetch_1w_data(ticker)
            trend_ok, trend = trend_engine(df_1d, df_1w)
            if not trend_ok: return None

            # ── KATMAN 2: MOMENTUM ENGINE (1D + 1H) ──
            df_1h = await fetch_1h_data(ticker)
            mom_ok, mom = momentum_engine(df_1d, df_1h, market_open=MARKET_OPEN_AT_SCAN)
            if not mom_ok: return None

            # ── KATMAN 3: BREAKOUT + SQUEEZE ──
            bs = breakout_squeeze_engine(df_1d)

            # ── KATMAN 4: HACİM ──
            vol = volume_engine(df_1d)

            # ── KATMAN 5: OPSİYON (ATM kontrat + flow) ──
            hv20 = calc_hv(close, 20)
            opt  = await options_engine(ticker, cp, close, hv20)

            if opt is None or opt.get("earnings_hard_block"):
                if opt: logging.info(f"⛔ {ticker}: Earnings {opt.get('earnings_days')}g — HARD BLOCK")
                return None
            if opt.get("best") is None:
                return None

            # ── SKOR: 5-engine (100 puan) ──
            sector_sc, sector_info = sector_score_from_etf(sector_etf or "XLK")

            trend_s = trend.get("trend_score", 0.0)   # 0-25
            mom_s   = mom.get("mom_score",    0.0)    # 0-25
            bs_s    = bs.get("bs_score",      0.0)    # 0-25
            vol_s   = vol.get("vol_score",    0.0)    # 0-15
            opt_s   = opt.get("opt_score",    0.0)    # 0-10

            total = trend_s + mom_s + bs_s + vol_s + opt_s

            # Bonus'lar
            if trend.get("weekly_ok"):             total += 3.0
            if bs.get("at_new_high"):              total += 3.0
            if bs.get("nr7"):                      total += 2.0
            if vol.get("today_rvol", 0) >= 3.0:   total += 2.0
            if opt.get("big_block"):               total += 2.0
            if trend.get("hh_structure"):          total += 1.0
            if boga_info.get("rvol", 0) >= 2.5:   total += 2.0  # BOGA RVOL bonus

            # Cezalar
            if opt.get("earnings_warning"):            total -= 8.0
            if opt.get("put_call_ratio", 1.0) > 1.5:  total -= 2.0

            total = round(min(max(total, 0.0), 100.0), 1)

            # Grade
            if total >= 75:   grade = "🏆 BOGA EXECUTION SIGNAL"
            elif total >= 60: grade = "🔥 GÜÇLÜ FIRSAT"
            elif total >= 45: grade = "💡 İYİ SETUP"
            else:             grade = "📊 OLASI"

            setup = bs.get("setup_type", "")
            if "NR7" in setup:                      grade = "NR7·" + grade
            if bs.get("at_new_high"):               grade = "🎯" + grade
            if vol.get("today_rvol", 0) >= 2.5:    grade = "🔊" + grade
            if trend.get("weekly_ok"):              grade = "1W·" + grade
            if opt.get("sweep_count", 0) >= 2:     grade = "⚡" + grade
            if opt.get("earnings_warning"):         grade += "·EARN⚠️"

            # ATR pct (backtest için)
            atr_pct = 2.0
            try:
                atr_s  = AverageTrueRange(df_1d['High'].astype(float), df_1d['Low'].astype(float), close, 14).average_true_range()
                atr_pct = float(atr_s.iloc[-1]) / cp * 100 if cp > 0 else 2.0
            except: pass
            trend["atr_pct"] = round(atr_pct, 2)

            result = {
                "ticker": ticker, "current_price": round(cp, 2),
                "score": total, "grade": grade,
                "sector_etf": sector_etf, "sector_info": sector_info,
                "sector_score": round(sector_sc, 1),
                "boga": boga_info,
                "trend": trend, "mom": mom, "bs": bs, "vol": vol, "opt": opt,
                "hv20": round(hv20 * 100, 1),
            }
            log_backtest(result)
            return result

        except Exception as e:
            logging.error(f"HATA {ticker}: {e}")
            return None


# ════════════════════════════════════════════════════════════════════════════
# 12) RAPOR — sade ve okunabilir
# ════════════════════════════════════════════════════════════════════════════

def build_block(c: dict) -> str:
    ticker  = c['ticker']
    cp      = c['current_price']
    grade   = c['grade']
    boga    = c.get('boga', {})
    trend   = c.get('trend', {})
    mom     = c.get('mom', {})
    bs      = c.get('bs', {})
    vol     = c.get('vol', {})
    opt     = c.get('opt', {})
    best    = opt.get("best") or {}
    etf     = c.get("sector_etf", "—")
    si      = c.get("sector_info", {})

    e10  = boga.get("e10", 0)
    e20  = boga.get("e20", 0)
    rsi  = boga.get("rsi", 0)
    rvol = boga.get("rvol", 0)
    rs   = "IXIC Bullish (10/20 EMA Aligned)" if BOGA_REGIME_CACHE.get("ok") else "NÖTR"

    lines = [
        f"\n{'═' * 56}",
        f"### {ticker} — {grade}",
        f"{'─' * 56}",
        f"<b>[MARKET REGIME]:</b> {rs}",
        f"<b>[STRATEGY]:</b> {bs.get('setup_type','Breakout/Pullback')}",
        f"",
        f"<b>TECHNICAL MATRIX:</b>",
        f"• Price vs EMAs: ${cp:.2f} > EMA10({e10:.2f}) > EMA20({e20:.2f}) ✅",
        f"• RSI(14): {rsi:.1f} slope:{boga.get('rsi_slope',0):+.1f} ✅",
        f"• RVOL: {rvol:.2f}x ✅  |  Score: <b>{c['score']:.0f}/100</b>  [{etf} RS5:{si.get('rs5',0):+.1f}%]",
    ]

    # Trend detayı (eski versiyonun gücü)
    if trend:
        lines += [
            f"",
            f"📈 TREND  {trend.get('trend_label','—')}  ({trend.get('trend_score',0):.0f}/25)",
            f"   EMA20D:{trend.get('e20d',0):.1f}  EMA50D:{trend.get('e50d',0):.1f}"
            + (f"  EMA200:{trend.get('e200d',0):.1f}" if trend.get('e200d') else ""),
            f"   {trend.get('weekly_label','—')}  RS60:{trend.get('rs_60',0):+.1f}pp"
            f"  5G:{trend.get('ret_5d',0):+.1f}%  HH:{'✅' if trend.get('hh_structure') else '—'}",
        ]

    # Momentum detayı
    if mom:
        lines += [
            f"",
            f"💪 MOMENTUM  {mom.get('momentum_label','—')}  ({mom.get('mom_score',0):.0f}/25)",
            f"   RSI_1D:{mom.get('rsi_1d',0):.0f}↑{mom.get('rsi_slope',0):+.0f}"
            f"  RSI_1H:{mom.get('rsi_1h','—')}  ADX:{mom.get('adx_1h',0):.0f}",
            f"   1H EMA20:{'✅' if mom.get('h1_ema_ok') else '⚠️'}"
            f"  3Mum:{'✅' if mom.get('h1_bias_ok') else '⚠️'}",
        ]

    # Breakout
    if bs:
        lines += [
            f"",
            f"💥 BREAKOUT  {bs.get('bs_label','—')}  ({bs.get('bs_score',0):.0f}/25)",
            f"   20H:{bs.get('dist_20h',-10):.1f}%  BB%:{bs.get('bb_pct',50):.0f}"
            f"  NR7:{'✅' if bs.get('nr7') else '—'}"
            f"  ATR↓:{'✅' if bs.get('atr_falling') else '—'}"
            f"  VWAP:{'✅' if bs.get('vwap_ok') else '—'}",
        ]

    # Hacim
    if vol:
        lines += [
            f"",
            f"📊 HACİM  {vol.get('vol_label','—')}  ({vol.get('vol_score',0):.0f}/15)",
            f"   RVOL:{vol.get('rvol',1):.2f}x  Bugün:{vol.get('today_rvol',1):.2f}x"
            f"  Akm:{vol.get('acc_days',0)}g"
            f"  {'📈F+V' if vol.get('price_up_vol_up') else ''}",
        ]

    # Opsiyon flow
    lines += [
        f"",
        f"🎯 OPSİYON  {opt.get('flow_label','—')}  ({opt.get('opt_score',0):.0f}/10)",
        f"   IV:{opt.get('atm_iv',0):.0f}%  IVRank:{opt.get('iv_rank',0):.0f}"
        f"  P/C:{opt.get('put_call_ratio',1):.2f}  Sweep:{opt.get('sweep_count',0)}",
    ]

    if opt.get("earnings_warning"):
        lines.append(f"   ⚠️ EARNINGS {opt.get('earnings_days','?')} GÜN SONRA!")

    # Execution levels (en iyi kontrat)
    if best:
        e20_sl = boga.get("e20", best.get("sl_price", 0))
        lines += [
            f"",
            f"<b>EXECUTION LEVELS:</b>",
            f"• Entry Zone: ${cp:.2f}  |  SL: ${e20_sl:.2f} (EMA20)",
            f"• TP: RSI≥75 bearish hook → %50 çık  |  EMA10 kırılırsa tümünü çık",
        ]

    # ATM kontrat tablosu (yeni versiyonun gücü)
    atm_contracts = opt.get("atm_contracts", [])
    if atm_contracts:
        lines.append(f"")
        lines.append(f"<b>📋 ATM OPSİYONLAR — {len(atm_contracts)} kontrat:</b>")
        for con in atm_contracts[:ATM_STRIKES]:
            lbl = con.get("atm_label", "OTM")
            lines.append(
                f"  [{lbl:3s}] ${con['strike']:.0f} | {con['expiration']} ({con['dte']}g)"
                f"  Δ={con['delta']:.2f}  <b>${con['cost_per_contract']:.0f}</b>/kont"
                f"  OI:{con['oi']:,}  Sp:{con['spread_pct']:.1f}%"
            )
            lines.append(
                f"        IV:{con['iv_pct']:.0f}%  TP:${con['tp_price']:.2f}"
                f"  SL:${con['sl_price']:.2f}  BE:${con['breakeven']:.2f}"
            )

    return "\n".join(lines)


def build_report(candidates, vix, duration, n_scanned, s0: dict,
                 active_sectors: List[str], bt_summary: dict) -> Tuple[str, str]:
    n      = len(candidates)
    regime = MARKET_REGIME.get("regime", "neutral").upper()
    qqq5   = MARKET_REGIME.get("qqq_5d", 0.0)
    now_s  = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")

    sector_line = "  ".join(
        f"{etf}:{SECTOR_ETF_CACHE.get(etf, {}).get('rs5', 0):+.1f}%"
        for etf in active_sectors
    )

    bt_line = ""
    if bt_summary and "win_rate" in bt_summary:
        bt_line = (
            f"📊 Backtest ({bt_summary['total']} trade): "
            f"Win:{bt_summary['win_rate']:.0f}%  "
            f"AvgPeak:{bt_summary['avg_peak']:.1f}%  "
            f"SL:{bt_summary['sl_rate']:.0f}%\n"
        )
    elif bt_summary and "msg" in bt_summary:
        bt_line = f"📊 Backtest: {bt_summary['msg']}\n"

    total_contracts = sum(len(c.get("opt", {}).get("atm_contracts", [])) for c in candidates)

    summary = (
        f"🚀 <b>BOGA AI v243 — PROFESSIONAL OPTIONS HUNTER</b>\n"
        f"🕒 {now_s}  |  VIX:{vix:.1f}  |  Rejim:<b>{regime}</b>  QQQ:{qqq5:+.1f}%\n"
        f"🔍 {n_scanned} hisse → <b>{n} ADAY</b>  <b>{total_contracts} kontrat</b>  ({duration:.0f}sn)\n"
        f"📅 DTE:{DTE_MIN}-{DTE_MAX}g  ATM±{ATM_STRIKES}  Earnings &lt;{EARNINGS_HARD_BLOCK_DAYS}g=BLOCK\n"
        f"{bt_line}\n"
    )

    for i, c in enumerate(candidates[:25], 1):
        boga  = c.get('boga', {})
        trend = c.get('trend', {})
        vol   = c.get('vol', {})
        bs    = c.get('bs', {})
        opt   = c['opt']
        best  = opt.get("best") or {}
        cost  = f"${best['cost_per_contract']:.0f}" if best else "—"
        dte_s = f"{best['dte']}g" if best else "—"
        n_con = len(opt.get("atm_contracts", []))
        summary += (
            f"{i}. <b>{c['ticker']}</b> ${c['current_price']:.2f}  {c['score']:.0f}pt"
            f"  [{c.get('sector_etf','—')}]  {n_con}kon\n"
            f"   RSI:{boga.get('rsi',0):.0f}↑{boga.get('rsi_slope',0):+.0f}"
            f"  RVOL:{boga.get('rvol',0):.2f}x"
            f"  RS60:{trend.get('rs_60',0):+.1f}pp"
            f"  {bs.get('setup_type','—')}  {cost}/{dte_s}\n"
            f"   {c['grade'][:55]}\n\n"
        )

    detail = "\n".join(build_block(c) for c in candidates[:15])
    return summary, detail


def save_picks(candidates, n_universe, duration, active_sectors):
    try:
        today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d")
        data = {
            "version": "v243", "date": today_str,
            "generated_at": datetime.now(NY_TZ).isoformat(),
            "vix": MARKET_VIX.get("value", 0),
            "dte_range": f"{DTE_MIN}-{DTE_MAX}", "atm_strikes": ATM_STRIKES,
            "earnings_hard_block_days": EARNINGS_HARD_BLOCK_DAYS,
            "active_sectors": active_sectors, "regime": MARKET_REGIME,
            "universe_size": n_universe, "scan_duration_sec": duration,
            "total_candidates": len(candidates), "picks": candidates,
        }
        payload = json.dumps(data, ensure_ascii=False, default=str, indent=2)

        # 1. data/ arşiv dosyası
        out = os.path.join(DATA_DIR, f"v243_{datetime.now().strftime('%Y%m%d_%H%M')}.json")
        with open(out, "w", encoding="utf-8") as f:
            f.write(payload)
        logging.info(f"💾 {out}")

        # 2. frontend/public — web sitesi güncellemesi
        fe_root = os.path.join(HERE, "frontend", "public")
        paths_to_write = [
            os.path.join(fe_root, "options_picks.json"),
            os.path.join(fe_root, "data", "latest", "options_picks.json"),
            os.path.join(fe_root, "data", today_str, "options_picks.json"),
        ]
        for p in paths_to_write:
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(payload)
        logging.info(f"✅ Frontend güncellendi: options_picks.json ({today_str})")

    except Exception as e:
        logging.error(f"❌ Kayıt hatası: {e}")


async def deploy_to_git():
    """Scan sonuçlarını git commit + push ile Vercel'e deploy et."""
    import subprocess
    try:
        today_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M")
        fe_picks  = os.path.join("frontend", "public", "options_picks.json")
        fe_latest = os.path.join("frontend", "public", "data", "latest", "options_picks.json")
        fe_date   = os.path.join("frontend", "public", "data",
                                  datetime.now(NY_TZ).strftime("%Y-%m-%d"), "options_picks.json")

        def run(cmd):
            return subprocess.run(cmd, capture_output=True, text=True,
                                  cwd=HERE, encoding="utf-8")

        # Sadece değişiklik varsa push et
        diff = run(["git", "diff", "--quiet", fe_picks])
        if diff.returncode == 0:
            logging.info("ℹ️ options_picks.json değişmedi — push atlandı")
            return

        run(["git", "add", fe_picks, fe_latest, fe_date])
        run(["git", "commit", "-m",
             f"Data: Options Scan {today_str} [bot]"])
        result = run(["git", "push", "origin", "main"])
        if result.returncode == 0:
            logging.info("🚀 Git push OK — Vercel deploy tetiklendi")
            await send_tg("🌐 Web sitesi güncellendi → bogastock.com/options")
        else:
            logging.warning(f"⚠️ Git push başarısız: {result.stderr[:200]}")
    except Exception as e:
        logging.error(f"❌ Deploy hatası: {e}")


# ════════════════════════════════════════════════════════════════════════════
# 13) ANA TARAMA
# ════════════════════════════════════════════════════════════════════════════

def _load_boga_universe() -> List[str]:
    """boga_universe.txt + SECTOR_STOCKS birleşik evreni yükle."""
    tickers: List[str] = []
    seen: set = set()
    # Önce sector stocks
    for stocks in SECTOR_STOCKS.values():
        for t in stocks:
            if t not in seen:
                tickers.append(t); seen.add(t)
    # boga_universe.txt'den ekle
    univ_path = os.path.join(HERE, "boga_universe.txt")
    if os.path.isfile(univ_path):
        with open(univ_path, "r", encoding="utf-8") as f:
            for line in f:
                t = line.strip().upper()
                if t and t not in seen:
                    tickers.append(t); seen.add(t)
    return tickers


async def scan():
    start = time.time()

    session_lbl = SESSION_LABELS.get(SCAN_SESSION, f"⏰ {SCAN_SESSION.upper()}")

    global MARKET_OPEN_AT_SCAN, ACTIVE_SECTORS
    MARKET_OPEN_AT_SCAN = (get_scan_mode() == "market_open")

    # ── BOGA STEP 1: Market Regime (IXIC) ──
    regime_ok, regime_reason = await check_boga_market_regime("^IXIC")
    await update_market_data()
    vix_val = MARKET_VIX.get("value", 20.0)

    now_str = datetime.now(NY_TZ).strftime('%Y-%m-%d %H:%M NY')

    if not regime_ok:
        await send_tg(
            f"🔴 <b>BOGA AI — CASH_PROTECTION</b>\n"
            f"🕒 {now_str}\n\n"
            f"Market environment unfavorable. Do not deploy capital.\n"
            f"<i>{regime_reason}</i>"
        )
        return

    # Geniş evren: sector stocks + boga_universe.txt
    universe = _load_boga_universe()
    ACTIVE_SECTORS = list(SECTOR_ETFS.keys())

    await send_tg(
        f"🚀 <b>BOGA AI v242.1 — LONG_ONLY</b>\n"
        f"🕒 {now_str}\n"
        f"<b>{session_lbl}</b>\n\n"
        f"✅ {regime_reason}\n"
        f"VIX:{vix_val:.1f}  DTE:{DTE_MIN}-{DTE_MAX}g  ATM±{ATM_STRIKES} strike\n"
        f"Earnings &lt;{EARNINGS_HARD_BLOCK_DAYS}g = HARD BLOCK\n"
        f"📊 {len(universe)} hisse taranıyor (hedef: ≥20 kontrat)..."
    )

    global TOTAL_TO_SCAN, PROGRESS_COUNTER
    TOTAL_TO_SCAN = len(universe); PROGRESS_COUNTER = 0

    # ETF eşleştirme (sektör içi olanlara etiket, diğerleri "BOGA")
    ticker_etf_map = {}
    for etf, stocks in SECTOR_STOCKS.items():
        for t in stocks:
            ticker_etf_map[t] = etf
    ticker_etf_pairs = [(t, ticker_etf_map.get(t, "BOGA")) for t in universe]

    results = await asyncio.gather(
        *[analyze(t, etf) for t, etf in ticker_etf_pairs],
        return_exceptions=True
    )
    raw_candidates = sorted(
        [r for r in results if isinstance(r, dict)],
        key=lambda x: x['score'], reverse=True
    )

    # Toplam kontrat sayısını hesapla
    total_contracts = sum(
        len(c.get("opt", {}).get("atm_contracts", [])) for c in raw_candidates
    )

    candidates = raw_candidates  # Limitsiz — 20 kontrat hedefi
    duration   = time.time() - start

    if not candidates:
        save_picks([], len(universe), duration, ACTIVE_SECTORS)
        await send_tg(
            "⚠️ <b>Aday bulunamadı</b>\n"
            f"Taranan: {len(universe)} hisse  ({duration:.0f}sn)\n\n"
            "Olası nedenler:\n"
            "• BOGA kriterleri karşılanmadı (Close > EMA10 > EMA20, RSI≥50↑, RVOL≥1.5)\n"
            "• Uygun DTE 1-30g kontrat yok\n"
            "• Earnings hard block devrede"
        )
        return

    # Backtest güncelle
    await fill_backtest_results()
    bt_summary = get_backtest_summary()

    save_picks(candidates, len(universe), duration, ACTIVE_SECTORS)

    # P&L Tracker
    try:
        import importlib.util
        _tracker_path = os.path.join(HERE, "options_pnl_tracker.py")
        if os.path.isfile(_tracker_path):
            spec = importlib.util.spec_from_file_location("options_pnl_tracker", _tracker_path)
            _mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(_mod)
            await _mod.run_tracker()
            logging.info("✅ P&L Tracker tamamlandı")
    except Exception as _te:
        logging.warning(f"⚠️ P&L Tracker başarısız: {_te}")

    # Web sitesi deploy
    await deploy_to_git()

    summary, detail = build_report(
        candidates, vix_val, duration, len(universe),
        {}, ACTIVE_SECTORS, bt_summary
    )
    await send_tg(summary)
    await asyncio.sleep(1)
    for chunk in split_safe(detail):
        if chunk.strip():
            await send_tg(chunk); await asyncio.sleep(0.8)

    best   = candidates[0]
    best_c = best['opt'].get("best") or {}
    await send_tg(
        f"✅ <b>v243 Tamamlandı!</b>  {duration:.0f}sn\n"
        f"📊 {len(universe)} hisse → <b>{len(candidates)} aday</b>"
        f"  |  <b>{total_contracts} kontrat</b>\n"
        f"🏆 <b>{best['ticker']}</b> ({best['score']:.1f}/100)  {best['grade'][:40]}\n"
        f"   RSI:{best['boga'].get('rsi',0):.0f}  RVOL:{best['boga'].get('rvol',0):.2f}x"
        f"  {best.get('bs',{}).get('setup_type','—')}\n"
        f"{'$' + str(best_c.get('cost_per_contract','—')) + '/' + str(best_c.get('dte','—')) + 'g' if best_c else '—'}\n\n"
        + (f"📊 Backtest: Win:{bt_summary.get('win_rate','—')}%  "
           f"AvgPeak:{bt_summary.get('avg_peak','—')}%"
           if "win_rate" in bt_summary else "📊 Backtest: veri toplanıyor...")
    )


# ════════════════════════════════════════════════════════════════════════════
# 14) ZAMANLAYICI
# ════════════════════════════════════════════════════════════════════════════

# ── Tarama Programı: Günde 1x, NY 11:00 (Hafta içi) ─────────────────────
DAILY_RUN_TIMES = [
    (11, 0, "morning"),   # 11:00 NY — sabah taraması (piyasa açık +90dk)
]

SESSION_LABELS = {
    "morning": "🌅 SABAH (11:00 NY) — Günlük opsiyon taraması",
}

SCAN_SESSION: str = "morning"


def get_next_run_utc() -> Tuple[datetime, str]:
    from datetime import timezone as tz
    now_ny = datetime.now(tz.utc).astimezone(NY_TZ)
    wd = now_ny.weekday()  # 0=Mon … 6=Sun

    if wd < 5:  # Hafta içi
        h, m, lbl = DAILY_RUN_TIMES[0]
        candidate = now_ny.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate > now_ny:
            return candidate.astimezone(tz.utc), lbl

    # Bugün geçti veya hafta sonu → sonraki iş günü 11:00
    next_day = now_ny + timedelta(days=1)
    while next_day.weekday() >= 5:
        next_day += timedelta(days=1)
    h, m, lbl = DAILY_RUN_TIMES[0]
    target = next_day.replace(hour=h, minute=m, second=0, microsecond=0)
    return target.astimezone(tz.utc), lbl


async def run_scanner():
    from datetime import timezone as tz
    await send_tg(
        "🚀 <b>BOGA AI v243 — PROFESSIONAL OPTIONS HUNTER</b>\n"
        "⏰ Günde 1 tarama: <b>11:00 NY</b> (Hafta içi)\n\n"
        "✅ BOGA Gate: EMA10/20 + RSI≥50↑ + RVOL≥1.5\n"
        "✅ 5-Engine: Trend+Momentum+Breakout+Volume+Options\n"
        "✅ ATM ±5 strike  |  DTE 1-30g\n"
        f"✅ Earnings &lt;{EARNINGS_HARD_BLOCK_DAYS}g = HARD BLOCK\n"
        "✅ ~900 hisse evreni  |  Backtesting\n"
        "✅ Web sitesi otomatik güncelleme"
    )
    while True:
        try:
            next_run_utc, session = get_next_run_utc()
            wait_sec = (next_run_utc - datetime.now(tz.utc)).total_seconds()
            if wait_sec < 0 or wait_sec > 86400:
                logging.warning(f"Bekleyiş anormal: {wait_sec:.0f}sn — 1 saat bekleniyor")
                await asyncio.sleep(3600); continue
            next_ny = next_run_utc.astimezone(NY_TZ).strftime("%Y-%m-%d %H:%M NY")
            logging.info(f"⏰ Sonraki: {next_ny} ({session}) — {wait_sec/60:.0f}dk")
            await asyncio.sleep(wait_sec)
            global SCAN_SESSION
            SCAN_SESSION = session
            await scan()
        except Exception as e:
            logging.error(f"Döngü hatası: {e}")
            await send_tg(f"🚨 Döngü hatası: {e}")
            await asyncio.sleep(3600)


# ════════════════════════════════════════════════════════════════════════════
# 15) BAŞLATMA
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    if "--oneshot" in sys.argv:
        SCAN_SESSION = "eod" if "--eod" in sys.argv else "morning"
        try:
            print(f"🚀 BOGA AI v242.1 (One-Shot) — session:{SCAN_SESSION}")
            print(f"   DTE:{DTE_MIN}-{DTE_MAX}g  ATM±{ATM_STRIKES} strike  "
                  f"Earnings BLOCK:<{EARNINGS_HARD_BLOCK_DAYS}g")
        except ValueError:
            # Stdout closed in subprocess context — continue silently
            pass
        asyncio.run(scan())
        try:
            print("✅ Tamamlandı.")
        except ValueError:
            # Stdout closed — exit cleanly without error
            pass

    elif "--times" in sys.argv:
        from datetime import timezone as tz
        print("📅 Tarama programı (NY):")
        for h, m in DAILY_RUN_TIMES:
            print(f"  {h:02d}:{m:02d} NY")
        next_utc, sess = get_next_run_utc()
        next_ny = next_utc.astimezone(NY_TZ).strftime("%Y-%m-%d %H:%M NY")
        wait    = (next_utc - datetime.now(tz.utc)).total_seconds()
        print(f"Sonraki: {next_ny} ({sess}) — {wait/60:.0f}dk sonra")

    else:
        try:
            asyncio.run(run_scanner())
        except KeyboardInterrupt:
            print("\nv242.1 durduruldu.")
        except Exception as e:
            print(f"Kritik hata: {e}")
