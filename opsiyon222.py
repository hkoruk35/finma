"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🚀 BOGA AI v221 — MİMARİ YENİDEN YAZILDI                                ║
║   "Önce güçlü hisse, sonra doğru zamanlama, sonra doğru opsiyon"           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  v220'den farkı — MİMARİ DEĞİŞİKLİĞİ:                                    ║
║                                                                              ║
║  v220: sıkışma bul → EMA düzgün mü bak → opsiyon seç  (YANLIŞ SIRA)      ║
║  v221: güçlü hisse bul → zamanlamayı doğrula → sıkışma bonus → opsiyon    ║
║                                                                              ║
║  KATMAN MİMARİSİ:                                                           ║
║                                                                              ║
║  KATMAN 1 — EVREN FİLTRESİ                                                 ║
║    Fiyat / Hacim / Dollar volume temel filtresi                             ║
║                                                                              ║
║  KATMAN 2 — GÜÇLÜ HİSSE SEÇİMİ  ← ANA MOTOR                              ║
║    A) Relative Strength vs SPY (60g, 20g, 5g) — piyasadan güçlü mü?       ║
║    B) Momentum (ROC hızlanma, higher highs zinciri)                        ║
║    C) Sektör liderliği — sektörün en güçlüsü mü?                          ║
║    Geçemezse → ATLA (EMA'ya bakma bile)                                    ║
║                                                                              ║
║  KATMAN 3 — EMA ZAMANLAMASI  ← DOĞRULAMA                                  ║
║    Güçlü hisse doğru EMA noktasında mı?                                    ║
║    Golden cross / EMA200 breakout / EMA50 pullback                         ║
║    "İyi hisse kötü noktada" → ATLA                                         ║
║                                                                              ║
║  KATMAN 4 — BONUS PUANLAR                                                  ║
║    Sıkışma varsa +bonus (BB dar, NR7, ATR düşüyor)                        ║
║    Options flow varsa +bonus (notional doğrulamalı sweep)                  ║
║    Intraday momentum varsa +bonus                                           ║
║                                                                              ║
║  KATMAN 5 — OPSİYON SEÇİMİ                                                ║
║    Delta 0.28-0.45 (gamma sweet spot)                                      ║
║    DTE setup'a göre dinamik (15-75g)                                       ║
║    MM Trap filtresi + Notional sweep doğrulama                             ║
║                                                                              ║
║  PUANLAMA:                                                                  ║
║    Relative Strength + Momentum  : 0-35  ← ANA MOTOR                      ║
║    EMA Zamanlaması               : 0-25  ← DOĞRULAMA                      ║
║    Sektör Liderliği              : 0-15                                    ║
║    Sıkışma Bonusu (PE)           : 0-15  ← BONUS                          ║
║    Options Flow Bonusu           : 0-10  ← BONUS                          ║
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

# Hisse
PRICE_MIN      = 5.0
PRICE_MAX      = 250.0
AVG_VOL_MIN    = 150_000
DOLLAR_VOL_MIN = 500_000

# ── KATMAN 2: Güçlü hisse eşikleri ───────────────────────────────────────
RS_60D_MIN  = -15.0 # Daha kapsayıcı
RS_20D_MIN  = -15.0
RS_5D_MIN   = -15.0   # Eskiden -3.0'dü
HIGHER_HIGHS_MIN = 1  # Son 20 günde en az 1 higher high zinciri

# ── KATMAN 3: EMA eşikleri ─────────────────────────────────────────────
ADX_MIN = 10

# ── OPSİYON ───────────────────────────────────────────────────────────────
DTE_MIN  = 15
DTE_MAX  = 75
SPREAD_MAX = 0.50 # Çok daha esnek
MID_MIN    = 0.01
CONTRACT_MAX = 1000
OI_MIN = 0

DELTA_GAMMA_MIN = 0.10
DELTA_GAMMA_MAX = 0.60
DELTA_SAFE_MIN  = 0.40
DELTA_SAFE_MAX  = 0.75

# Notional sweep doğrulama
NOTIONAL_SWEEP_MIN = 100_000
NOTIONAL_BLOCK_MIN = 500_000

# MM Trap
EM_ATR_MAX_RATIO = 3.5 # Biraz daha esnek
CALL_WALL_OI_MIN = 8_000

# Exit
TAKE_PROFIT_PCT = 0.40
STOP_LOSS_PCT   = -0.30
TIME_STOP_RATIO = 0.60

MAX_TICKERS_SCAN = 500
UNIVERSE_TTL     = 24 * 3600
SEMAPHORE_N      = 2 # Concurrency azaltıldı (6 -> 2) rate limit için

HOT_SECTORS = {
    "Semiconductors": 15, "Technology": 12, "Health Care": 11,
    "Communication Services": 9, "Consumer Discretionary": 8,
    "Energy": 8, "Financials": 7, "Industrials": 6,
    "Materials": 5, "Consumer Staples": 3, "Utilities": 2, "Real Estate": 2,
}
SECTOR_ETFS = {
    "Technology": "XLK", "Semiconductors": "SOXX",
    "Communication Services": "XLC", "Health Care": "XLV",
    "Consumer Discretionary": "XLY", "Energy": "XLE", "Financials": "XLF",
}

# ── TARAMA MODU ─────────────────────────────────────────────────────────
# Bot market açık/kapalı durumunu otomatik algılar ve filtreleri ayarlar.
# Market Açık  (09:30-16:00 NY): 1H veri geçerli, intraday filtreler aktif
# Market Kapalı (gece/sabah):    1H intraday filtreler devre dışı,
#                                  DTE >= 35, steady+EMA+RS odaklı tarama

def is_market_open() -> bool:
    """NYSE açık mı? (09:30-16:00 NY, hafta içi)"""
    now = datetime.now(NY_TZ)
    if now.weekday() >= 5: return False   # Hafta sonu
    open_t  = now.replace(hour=9,  minute=30, second=0, microsecond=0)
    close_t = now.replace(hour=16, minute=0,  second=0, microsecond=0)
    return open_t <= now <= close_t

def is_pre_market() -> bool:
    """Pre-market: 04:00-09:30 NY"""
    now = datetime.now(NY_TZ)
    if now.weekday() >= 5: return False
    pm_open = now.replace(hour=4,  minute=0,  second=0, microsecond=0)
    open_t  = now.replace(hour=9,  minute=30, second=0, microsecond=0)
    return pm_open <= now < open_t

SCAN_MODE: str = "auto"   # "auto" | "market_open" | "market_closed"

def get_scan_mode() -> str:
    """Mevcut tarama modunu döndür."""
    if SCAN_MODE != "auto": return SCAN_MODE
    if is_market_open(): return "market_open"
    if is_pre_market():  return "pre_market"
    return "market_closed"

# Cache
UNIVERSE_CACHE: Dict[str, Any]         = {"ts": 0.0, "data": []}
MARKET_VIX                              = {"value": 18.0, "regime": "Orta 🟡"}
SPY_RETURN_CACHE: Dict[str, Any]        = {"ts": 0.0, "r60": 0.0, "r20": 0.0, "r5": 0.0}
SECTOR_MOMENTUM_CACHE: Dict[str, float] = {}
MARKET_REGIME: Dict[str, Any]           = {"regime": "bull", "score": 50, "qqq_5d": 0.0}

EXCHANGE_SOURCES = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# ════════════════════════════════════════════════════════════════════════════
# 1) TELEGRAM
# ════════════════════════════════════════════════════════════════════════════

def sanitize_html(text: str) -> str:
    if not text: return ""
    tags = {"<b>": "▶B◀","</b>": "▶/B◀","<i>": "▶I◀","</i>": "▶/I◀",
            "<pre>": "▶PRE◀","</pre>": "▶/PRE◀","<code>": "▶CODE◀","</code>": "▶/CODE◀"}
    r = text
    for t, p in tags.items(): r = r.replace(t, p)
    r = r.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
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
                            async with s.post(url, json={"chat_id": TELEGRAM_CHAT_ID,
                                                          "text": plain[:3800]}, timeout=20): pass
                await asyncio.sleep(0.4)
            except Exception as e:
                logging.error(f"TG: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 2) PİYASA VERİLERİ
# ════════════════════════════════════════════════════════════════════════════

async def update_market_data():
    """VIX, SPY, QQQ, sektör ETF'lerini güncelle."""
    now = time.time()
    stale = now - SPY_RETURN_CACHE.get("ts", 0) > 3600

    # VIX
    try:
        vd = await asyncio.to_thread(lambda: yf.Ticker("^VIX").history(period="5d"))
        if vd is not None and not vd.empty:
            v = float(vd['Close'].iloc[-1])
            MARKET_VIX.update({"value": v,
                "regime": "Düşük 🟢" if v < 18 else ("Orta 🟡" if v < 25 else "Yüksek 🔴")})
    except: pass

    if not stale: return

    # SPY
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("SPY").history(period="100d"))
        if df is not None and len(df) >= 65:
            c = df['Close'].astype(float)
            SPY_RETURN_CACHE.update({
                "ts": now,
                "r60": float((c.iloc[-1]-c.iloc[-61])/c.iloc[-61]*100),
                "r20": float((c.iloc[-1]-c.iloc[-21])/c.iloc[-21]*100),
                "r5":  float((c.iloc[-1]-c.iloc[-6]) /c.iloc[-6] *100) if len(c)>=6 else 0.0,
            })
    except: pass

    # QQQ → piyasa rejimi
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("QQQ").history(period="60d"))
        if df is not None and len(df) >= 22:
            c   = df['Close'].astype(float)
            q5  = float((c.iloc[-1]-c.iloc[-6]) /c.iloc[-6] *100) if len(c)>=6  else 0.0
            q20 = float((c.iloc[-1]-c.iloc[-21])/c.iloc[-21]*100) if len(c)>=21 else 0.0
            vix = MARKET_VIX.get("value", 20.0)
            score = 50
            score += 20 if vix < 16 else (10 if vix < 20 else (-25 if vix > 30 else (-15 if vix > 25 else 0)))
            score += 15 if q5 > 2 else (8 if q5 > 0 else (-15 if q5 < -2 else -8))
            score += 10 if q20 > 5 else (5 if q20 > 0 else (-10 if q20 < -5 else 0))
            score = max(0, min(100, score))
            MARKET_REGIME.update({
                "regime": "bull" if score >= 65 else ("bear" if score < 40 else "neutral"),
                "score": score, "qqq_5d": round(q5, 2), "qqq_20d": round(q20, 2)
            })
    except: pass

    # Sektör ETF'leri
    for etf in list(SECTOR_ETFS.values()) + ["SPY"]:
        try:
            df = await asyncio.to_thread(lambda t=etf: yf.Ticker(t).history(period="30d"))
            if df is not None and len(df) >= 10:
                c = df['Close'].astype(float)
                r5  = float((c.iloc[-1]-c.iloc[-6]) /c.iloc[-6] *100) if len(c)>=6  else 0.0
                r10 = float((c.iloc[-1]-c.iloc[-11])/c.iloc[-11]*100) if len(c)>=11 else 0.0
                SECTOR_MOMENTUM_CACHE[etf] = round(r5*0.6 + r10*0.4, 2)
            await asyncio.sleep(0.05)
        except: pass

# ════════════════════════════════════════════════════════════════════════════
# 3) MATEMATİK ARAÇLARI
# ════════════════════════════════════════════════════════════════════════════

def bs_greeks(S, K, T, r, sigma):
    e = {"delta":0.0,"gamma":0.0,"theta":0.0,"vega":0.0}
    if T<=0 or sigma<=0 or S<=0 or K<=0: return e
    try:
        sq = math.sqrt(T)
        d1 = (math.log(S/K)+(r+0.5*sigma**2)*T)/(sigma*sq)
        d2 = d1 - sigma*sq
        nd1 = norm_pdf(d1)
        return {
            "delta": round(norm_cdf(d1), 4),
            "gamma": round(nd1/(S*sigma*sq), 5),
            "theta": round((-(S*nd1*sigma)/(2*sq) - r*K*math.exp(-r*T)*norm_cdf(d2))/365, 4),
            "vega":  round(S*nd1*sq/100, 4),
        }
    except: return e

def bs_price(S, K, T, r, sigma):
    if T<=0 or sigma<=0: return max(0.0, S-K)
    try:
        sq=math.sqrt(T); d1=(math.log(S/K)+(r+0.5*sigma**2)*T)/(sigma*sq); d2=d1-sigma*sq
        return round(S*norm_cdf(d1)-K*math.exp(-r*T)*norm_cdf(d2), 4)
    except: return 0.0

def calc_hv(close: pd.Series, lb: int = 20) -> float:
    if len(close) < lb+1: return 0.30
    lr = np.log(close/close.shift(1)).dropna()
    return max(0.05, float(lr.tail(lb).std())*math.sqrt(252))

def calc_iv_rank(iv: float, close: pd.Series) -> Tuple[float, float]:
    try:
        if len(close) < 60: return 50.0, 50.0
        lr  = np.log(close/close.shift(1)).dropna()
        hvs = (lr.rolling(20).std()*math.sqrt(252)).dropna()
        if len(hvs) < 10: return 50.0, 50.0
        mn, mx = float(hvs.min()), float(hvs.max())
        rank = max(0.0, min(100.0, (iv-mn)/(mx-mn)*100)) if (mx-mn)>0.001 else 50.0
        pct  = float((hvs<iv).sum())/len(hvs)*100
        return round(rank,1), round(pct,1)
    except: return 50.0, 50.0

def calc_vwap(df: pd.DataFrame) -> float:
    try:
        d=df.tail(20).copy()
        tp=(d['High'].astype(float)+d['Low'].astype(float)+d['Close'].astype(float))/3.0
        v=d['Volume'].astype(float)
        return round(float((tp*v).sum()/v.sum()),3)
    except: return 0.0

def bs_pnl_sim(S, K, iv, dte, move_pct=0.07, days_fwd=3):
    T_now=dte/365.0; T_fwd=max((dte-days_fwd)/365.0,0.001)
    iv_fwd=iv*(0.88 if dte<=30 else 0.93)
    p_now=bs_price(S,K,T_now,0.05,iv); p_fwd=bs_price(S*(1+move_pct),K,T_fwd,0.05,iv_fwd)
    return {"price_now":round(p_now,2),"price_fwd":round(p_fwd,2),
            "pnl_pct":round((p_fwd-p_now)/p_now*100,1) if p_now>0 else 0.0,"days_fwd":days_fwd}

def max_pain(calls, puts, cp):
    try:
        strikes=sorted(set(list(calls['strike'].values)+list(puts['strike'].values)))
        bp=cp; bv=float('inf')
        for ts in strikes:
            tot=(float(((ts-calls['strike']).clip(lower=0)*calls['openInterest'].fillna(0)).sum())+
                 float(((puts['strike']-ts).clip(lower=0)*puts['openInterest'].fillna(0)).sum()))
            if tot<bv: bv=tot; bp=ts
        return bp
    except: return cp

# ════════════════════════════════════════════════════════════════════════════
# 4) EVREN
# ════════════════════════════════════════════════════════════════════════════

async def build_universe() -> List[str]:
    now = time.time()
    if UNIVERSE_CACHE["ts"] and (now-UNIVERSE_CACHE["ts"]<UNIVERSE_TTL) and UNIVERSE_CACHE["data"]:
        return UNIVERSE_CACHE["data"]

    raw: List[str] = []
    async with aiohttp.ClientSession() as s:
        for url in EXCHANGE_SOURCES:
            try:
                async with s.get(url, timeout=20) as r:
                    if r.status == 200:
                        text = await r.text()
                        if ".txt" in url:
                            raw += [t.strip().upper() for t in text.splitlines() if t.strip()]
                        else:
                            for line in text.splitlines()[1:]:
                                p = line.split(",")
                                if p: raw.append(p[0].strip().upper())
            except: pass

    valid = list({t for t in raw if 1<=len(t)<=5 and re.match(r'^[A-Z]+$',t)})
    valid.sort()

    passed: List[str] = []
    sem = asyncio.Semaphore(20)

    async def check(ticker: str):
        async with sem:
            try:
                df = await asyncio.wait_for(asyncio.to_thread(
                    lambda: yf.Ticker(ticker).history(period="5d")
                ), timeout=10)
                if df is None or len(df)<2: return
                cp  = float(df['Close'].iloc[-1])
                vol = float(df['Volume'].tail(3).mean())
                if PRICE_MIN<=cp<=PRICE_MAX and vol>=AVG_VOL_MIN and cp*vol>=DOLLAR_VOL_MIN:
                    passed.append(ticker)
            except: pass

    await asyncio.gather(*[check(t) for t in valid[:MAX_TICKERS_SCAN]])
    
    # FALLBACK: If universe is empty (API issues), use a default list of liquid stocks
    if not passed:
        logging.warning("⚠️ Evren boş! Fallback listesi yükleniyor...")
        passed = ["AAPL","NVDA","TSLA","AMD","MSFT","META","GOOGL","AMZN","NFLX","COIN","MARA","MSTR","PLTR","SMCI","QQQ","SPY","IWM","SOXL","TQQQ","BABA","PYPL","SQ","RIVN","LCID","NIO"]
        
    UNIVERSE_CACHE.update({"ts": now, "data": passed})
    logging.info(f"✅ Evren: {len(passed)} hisse")
    return passed

# ════════════════════════════════════════════════════════════════════════════
# 5) ÇOK-ZAMAN-DİLİMİ RSI ALINHEMANI (swing bot'tan uyarlandı)
#    1H yukarı + 1D yukarı olmadan HİÇBİR HİSSE GEÇEMEZ.
#    Ölü kedi sıçraması (dead cat bounce) = 1H yukarı / 1D aşağı → HARD BLOCK
# ════════════════════════════════════════════════════════════════════════════

async def fetch_1h_data(ticker: str) -> Optional[pd.DataFrame]:
    """1H veri çek — sadece Katman 2'yi geçen ~50 hisse için çağrılır."""
    try:
        df = await asyncio.wait_for(asyncio.to_thread(
            lambda: yf.Ticker(ticker).history(period="10d", interval="1h", auto_adjust=True)
        ), timeout=20)
        if df is None or len(df) < 10: return None
        df.columns = [str(c).strip().title() for c in df.columns]
        return df
    except:
        return None

MARKET_OPEN_AT_SCAN: bool = False   # scan() başında set edilir

def check_mtf_rsi_alignment(df_1d: pd.DataFrame, df_1h: Optional[pd.DataFrame],
                              market_open: bool = True) -> Tuple[bool, dict]:
    """
    Çok-zaman-dilimi RSI kontrolü — market_open durumuna göre davranır.

    Market AÇIK modu:
      - 1H RSI + Dual-TF kontrolü aktif (tam koruma)

    Market KAPALI modu:
      - 1H kontrolleri devre dışı
      - Sadece 1D RSI, trend ve kanama filtresi aktif
      - Steady trend hisseler için RSI eşiği 42'ye indirilir
    """
    try:
        c_1d   = df_1d['Close'].astype(float)
        h_1d   = df_1d['High'].astype(float)
        lo_1d  = df_1d['Low'].astype(float)
        cp     = float(c_1d.iloc[-1])

        # ── 1D EMA trend durumu ───────────────────────────────────────
        e20  = float(EMAIndicator(c_1d, 20).ema_indicator().iloc[-1])
        e50  = float(EMAIndicator(c_1d, 50).ema_indicator().iloc[-1])
        e200 = float(EMAIndicator(c_1d, 200).ema_indicator().iloc[-1])

        if cp > e50 > e200:       trend_1d = "Macro Bullish"
        elif cp > e20 > e50 > e200: trend_1d = "Upward"
        elif cp > e200:            trend_1d = "Above EMA200"
        elif cp > e50:             trend_1d = "Above EMA50"
        else:                      trend_1d = "Downtrend"

        # HARD: Downtrend = EMA200 altı → direkt eleme
        if trend_1d == "Downtrend":
            return False, {"block_reason": "1D Downtrend (EMA200 altı)"}

        # ── 5 günlük kanama filtresi ──────────────────────────────────
        if len(c_1d) >= 6:
            ret_5d = (cp - float(c_1d.iloc[-6])) / float(c_1d.iloc[-6]) * 100
            if ret_5d < -3.5:
                return False, {"block_reason": f"5G kanama: {ret_5d:.1f}%"}
        else:
            ret_5d = 0.0

        # ── 1D RSI hesapla ────────────────────────────────────────────
        rsi_1d_series = RSIIndicator(c_1d, 14).rsi()
        rsi_1d     = float(rsi_1d_series.iloc[-1])
        rsi_1d_p1  = float(rsi_1d_series.iloc[-2]) if len(rsi_1d_series) >= 2 else rsi_1d
        rsi_1d_p3  = float(rsi_1d_series.iloc[-4]) if len(rsi_1d_series) >= 4 else rsi_1d
        rsi_1d_p5  = float(rsi_1d_series.iloc[-6]) if len(rsi_1d_series) >= 6 else rsi_1d

        rsi_1d_slope5 = rsi_1d - rsi_1d_p5   # 5 günlük slope

        # ── Market kapalı modda eşikler gevşer ─────────────────────────────
        # Yavaş yükselen hisseler gece/sabah taramasında da yakalanabilsin
        rsi_1d_min_threshold = 42 if not market_open else 45
        rsi_falling_warn     = 50 if not market_open else 52

        # HARD: 1D RSI çok düşük
        if rsi_1d < rsi_1d_min_threshold:
            return False, {"block_reason": f"1D RSI çok düşük: {rsi_1d:.1f} (eşik:{rsi_1d_min_threshold})"}

        # HARD: Falling knife (düşüyor ve zayıf)
        if rsi_1d < 45 and rsi_1d < rsi_1d_p1:
            return False, {"block_reason": f"Falling knife: RSI {rsi_1d:.1f} düşüyor"}

        # HARD: 3 gün üst üste düşüş — eşik market moduna göre
        rsi_falling_3d = (rsi_1d < rsi_1d_p1 < rsi_1d_p3)
        if rsi_falling_3d and rsi_1d < rsi_falling_warn:
            return False, {"block_reason": f"RSI {rsi_1d:.1f} — 3 gün düşüyor (ölü kedi)"}

        # HARD: 1D RSI aşırı alım
        if rsi_1d > 82:
            return False, {"block_reason": f"1D RSI aşırı alım: {rsi_1d:.1f}"}

        # ── 1H RSI hesapla ────────────────────────────────────────────
        rsi_1h       = 55.0   # default (veri yoksa nötr)
        rsi_1h_slope = 0.0
        adx_1h       = 0.0
        ema20_1h_ok  = True
        rsi_1h_lbl   = "1H Veri Yok"

        if df_1h is not None and len(df_1h) >= 14:
            c_1h = df_1h['Close'].astype(float)
            try:
                rsi_1h_s   = RSIIndicator(c_1h, 14).rsi()
                rsi_1h     = float(rsi_1h_s.iloc[-1])
                rsi_1h_p3  = float(rsi_1h_s.iloc[-4]) if len(rsi_1h_s) >= 4 else rsi_1h
                rsi_1h_slope = rsi_1h - rsi_1h_p3   # 3 saatlik slope
            except:
                pass

            try:
                adx_1h = float(ADXIndicator(df_1h['High'], df_1h['Low'], c_1h, 14).adx().iloc[-1])
            except:
                pass

            try:
                e20_1h = float(EMAIndicator(c_1h, 20).ema_indicator().iloc[-1])
                ema20_1h_ok = float(c_1h.iloc[-1]) >= e20_1h * 0.98
            except:
                pass

            # Market açıkken 1H filtreleri tam aktif
            if market_open:
                # HARD: 1H RSI < 40 = intraday çok zayıf
                if rsi_1h < 40:
                    return False, {"block_reason": f"1H RSI çok düşük: {rsi_1h:.1f}"}

                # HARD: 1H RSI > 82 = intraday aşırı alım (FOMO girişi)
                if rsi_1h > 82:
                    return False, {"block_reason": f"1H RSI FOMO zirvesi: {rsi_1h:.1f}"}

                # HARD: Dual-TF RSI düşüş = ölü kedi sıçraması
                if rsi_1d_slope5 < -4 and rsi_1h_slope < -4:
                    return False, {
                        "block_reason": f"DUAL-TF RSI DÜŞÜŞ — Ölü kedi! "
                                        f"1D:{rsi_1d_slope5:.1f} / 1H:{rsi_1h_slope:.1f}"
                    }
            else:
                # Market kapalı: 1H sadece bilgi, sadece çok sert düşüşü engelle
                if rsi_1h < 35:
                    return False, {"block_reason": f"1H RSI çok düşük (kapalı mod): {rsi_1h:.1f}"}
                if rsi_1d_slope5 < -6:   # Kapalı modda daha sert eşik
                    return False, {"block_reason": f"1D RSI sert düşüş: {rsi_1d_slope5:.1f}"}

            rsi_1h_lbl = f"{rsi_1h:.1f}"

        # ── Steady Momentum (swing bottan) ───────────────────────────
        steady_momentum = False
        if len(c_1d) >= 5:
            c5 = c_1d.tail(5).values
            ret_1d = (float(c_1d.iloc[-1]) - float(c_1d.iloc[-2])) / float(c_1d.iloc[-2]) * 100 if len(c_1d) >= 2 else 0.0
            steady_momentum = (
                all(c5[i] >= c5[i-1] * 0.99 for i in range(1, 5)) and
                c5[-1] > c5[0] and ret_1d < 5.0
            )

        # ── HH/HL yapısı ─────────────────────────────────────────────
        hh_hl = False
        if len(h_1d) >= 5 and len(lo_1d) >= 5:
            hh_hl = (float(h_1d.iloc[-1]) > float(h_1d.iloc[-5]) and
                     float(lo_1d.iloc[-1]) > float(lo_1d.iloc[-5]))

        # Tüm filtreler geçildi
        return True, {
            "rsi_1d":        round(rsi_1d, 1),
            "rsi_1d_slope5": round(rsi_1d_slope5, 1),
            "rsi_1h":        rsi_1h_lbl,
            "rsi_1h_val":    round(rsi_1h, 1),
            "rsi_1h_slope":  round(rsi_1h_slope, 1),
            "adx_1h":        round(adx_1h, 1),
            "ema20_1h_ok":   ema20_1h_ok,
            "trend_1d":      trend_1d,
            "steady_momentum": steady_momentum,
            "hh_hl":         hh_hl,
            "ret_5d":        round(ret_5d, 2),
            "rsi_alignment": (
                "🔥 MÜKEMMEL" if rsi_1d >= 55 and rsi_1h >= 55 and rsi_1d_slope5 > 2 and rsi_1h_slope > 2
                else "✅ İYİ" if rsi_1d >= 50 and rsi_1h >= 50
                else "🟡 ORTA"
            ),
        }
    except Exception as e:
        logging.debug(f"MTF RSI: {e}")
        return False, {"block_reason": f"MTF RSI hata: {e}"}


# ════════════════════════════════════════════════════════════════════════════
# 6) KATMAN 2 — GÜÇLÜ HİSSE SEÇİMİ  ← ANA MOTOR
#    Relative Strength + Momentum + Sektör
#    Bu katmandan geçemeyen hisse EMA'ya bile gitmez.
# ════════════════════════════════════════════════════════════════════════════

def layer2_strong_stock(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    Soru: "Bu hisse piyasadan güçlü mü ve momentum devam ediyor mu?"

    RS eşiği geçilemezse → False → hisse analize alınmaz.
    Ne kadar güçlüyse o kadar yüksek puan (0-35).
    """
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 65: return False, {}

        cp = float(c.iloc[-1])

        # ── Getiri hesapları ──────────────────────────────────────────────
        roc5  = float((c.iloc[-1]-c.iloc[-6]) /c.iloc[-6] *100) if len(c)>=6  else 0.0
        roc20 = float((c.iloc[-1]-c.iloc[-21])/c.iloc[-21]*100) if len(c)>=21 else 0.0
        roc60 = float((c.iloc[-1]-c.iloc[-61])/c.iloc[-61]*100) if len(c)>=61 else 0.0

        # ── Relative Strength vs SPY ──────────────────────────────────────
        spy_r60 = SPY_RETURN_CACHE.get("r60", 0.0)
        spy_r20 = SPY_RETURN_CACHE.get("r20", 0.0)
        spy_r5  = SPY_RETURN_CACHE.get("r5",  0.0)

        rs_60 = roc60 - spy_r60
        rs_20 = roc20 - spy_r20
        rs_5  = roc5  - spy_r5

        # ── Steady (yavaş ama güçlü) profil tespiti ─────────────────────────
        # 5 günlük kademeli yükseliş: agresif spike değil, tutarlı trend
        c5 = c.tail(5).values if len(c) >= 5 else []
        steady_trend = (len(c5) == 5 and
                        all(c5[i] >= c5[i-1] * 0.995 for i in range(1,5)) and
                        c5[-1] > c5[0])

        # ── HARD FILTER: SPY'dan belirgin zayıf olmamalı ─────────────────────
        # Steady trend varsa ROC5 filtresi gevşer (son 5 günde hareket gerekmez)
        if rs_60 < RS_60D_MIN:
            return False, {}
        if rs_20 < RS_20D_MIN:
            # Steady trend istisnası: 60g RS güçlüyse 20g nötr kabul
            if not (steady_trend and rs_60 >= 5.0):
                return False, {}
        if roc5 < ROC5_MIN:
            # Steady trend istisnası: yavaş ama düzgün yükseliyor
            if not steady_trend:
                return False, {}

        # ── RS Skoru (0-20) — ana ağırlık ─────────────────────────────────
        # Piyasadan güçlü olmak bu sistemin kalbi
        if rs_60 >= 20:   rs_score = 20.0
        elif rs_60 >= 12: rs_score = 17.0
        elif rs_60 >= 8:  rs_score = 14.0
        elif rs_60 >= 5:  rs_score = 11.0
        elif rs_60 >= 3:  rs_score = 8.0
        else:             rs_score = 5.0    # min eşiği geçti ama zayıf

        # 20g RS hızlanma bonusu
        if rs_20 >= 5:    rs_score = min(rs_score + 4.0, 20.0)
        elif rs_20 >= 2:  rs_score = min(rs_score + 2.0, 20.0)

        # 5g RS ivme (kısa vadeli momentum)
        if rs_5 > 2:      rs_score = min(rs_score + 2.0, 20.0)

        # ── Momentum Kalitesi (0-15) ───────────────────────────────────────
        mom_score = 0.0

        # Higher Highs zinciri — trendin sağlıklı olduğunun kanıtı
        hh_1  = float(c.iloc[-1])  > float(c.iloc[-5])
        hh_2  = float(c.iloc[-5])  > float(c.iloc[-10])
        hh_3  = float(c.iloc[-10]) > float(c.iloc[-20])

        if hh_1 and hh_2 and hh_3: mom_score += 8.0   # Tam zincir
        elif hh_1 and hh_2:        mom_score += 5.0
        elif hh_1:                 mom_score += 2.0

        # ROC ivmesi: kısa vade > uzun vade (ivme artıyor)
        if roc5 > 0 and roc5 > abs(roc20) * 0.3:
            mom_score += 4.0   # İvme var

        # 52-hafta / 60 gün zirve yakınlığı
        high_60 = float(c.tail(60).max())
        dist_60h = (cp - high_60) / high_60 if high_60 > 0 else -1.0
        if dist_60h >= 0:         mom_score += 3.0   # Yeni zirve!
        elif dist_60h >= -0.03:   mom_score += 2.0   # %3 içinde
        elif dist_60h >= -0.08:   mom_score += 1.0

        # Steady trend bonus: spike değil, sağlam kademeli yükseliş
        if steady_trend:
            mom_score += 4.0   # Yavaş ama tutarlı = güvenilir opsiyon adayı
        mom_score = min(mom_score, 15.0)

        # ── RSI (momentum kalitesi kontrolü) ──────────────────────────────
        rsi = float(RSIIndicator(c, 14).rsi().iloc[-1])
        if rsi < 25 or rsi > 90: return False, {}   # Aşırı oversold/overbought

        # ── Hacim trendi (güçlü hissede hacim de artmalı) ─────────────────
        v5  = float(vol.tail(5).mean())
        v30 = float(vol.tail(30).mean()) if len(vol)>=30 else v5
        rvol = v5/v30 if v30>0 else 1.0

        # Hacim düşüşü erken uyarı sinyali (ama hard filter değil)
        vol_ok = rvol >= 0.7

        atr_val = float(AverageTrueRange(h, df['Low'].astype(float), c, 14).average_true_range().iloc[-1])
        atr_pct = (atr_val/cp)*100 if cp>0 else 2.0
        hv20    = calc_hv(c, 20)

        return True, {
            "rs_60": round(rs_60, 2), "rs_20": round(rs_20, 2), "rs_5": round(rs_5, 2),
            "rs_score":  round(rs_score, 1),
            "mom_score": round(mom_score, 1),
            "roc5":  round(roc5, 2), "roc20": round(roc20, 2), "roc60": round(roc60, 2),
            "rsi":   round(rsi, 1),
            "rvol":  round(rvol, 2), "vol_ok": vol_ok,
            "v5": round(v5,0), "v30": round(v30,0),
            "high_60": round(high_60, 2),
            "dist_60h": round(dist_60h*100, 1),
            "atr_pct": round(atr_pct, 2),
            "hv20":    round(hv20, 4),
            "hh_1": hh_1, "hh_2": hh_2, "hh_3": hh_3,
            "steady_trend": steady_trend,
        }
    except Exception as e:
        logging.debug(f"L2 strong_stock: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 6) SEKTÖR LİDERLİĞİ (Katman 2'ye yardımcı)
# ════════════════════════════════════════════════════════════════════════════

async def get_sector(ticker: str) -> str:
    try:
        info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
        return info.get("sector","") or info.get("industry","")
    except: return ""

def calc_sector_score(sector: str) -> float:
    """Sektör liderliği skoru (0-15)."""
    if not sector: return 3.0
    base = 3.0
    for k, pts in HOT_SECTORS.items():
        if k.lower() in sector.lower():
            base = min(pts/15.0*10.0, 10.0); break

    # ETF relative strength bonusu
    etf = next((v for k,v in SECTOR_ETFS.items() if k.lower() in sector.lower()), None)
    if etf and etf in SECTOR_MOMENTUM_CACHE:
        rel = SECTOR_MOMENTUM_CACHE[etf] - SECTOR_MOMENTUM_CACHE.get("SPY", 0.0)
        if rel > 4:    base = min(base+5.0, 15.0)
        elif rel > 2:  base = min(base+3.0, 15.0)
        elif rel > 0:  base = min(base+1.5, 15.0)
        elif rel < -2: base = max(base-3.0, 0.0)
    return round(base, 1)

# ════════════════════════════════════════════════════════════════════════════
# 7) KATMAN 3 — EMA ZAMANLAMASI  ← DOĞRULAMA
#    "Güçlü hisse doğru EMA noktasında mı?"
# ════════════════════════════════════════════════════════════════════════════

def layer3_ema_timing(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    Soru: "Şu an girmek için doğru teknik nokta mı?"

    EMA giriş modu varsa → True + skor
    EMA yapısı bozuksa veya çok uzaksa → False
    """
    try:
        c = df['Close'].astype(float)
        if len(c) < 210: return False, {}

        e9v  = float(EMAIndicator(c,  9).ema_indicator().iloc[-1])
        e20v = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])
        e50v = float(EMAIndicator(c, 50).ema_indicator().iloc[-1])
        e200v= float(EMAIndicator(c,200).ema_indicator().iloc[-1])
        cp   = float(c.iloc[-1])
        prev = float(c.iloc[-2])

        e20s = EMAIndicator(c, 20).ema_indicator()
        e50s = EMAIndicator(c, 50).ema_indicator()
        prev_e20 = float(e20s.iloc[-2]) if len(e20s)>=2 else e20v
        prev_e50 = float(e50s.iloc[-2]) if len(e50s)>=2 else e50v
        e50_slope= float((e50v-float(e50s.iloc[-6]))/float(e50s.iloc[-6])*100) if len(e50s)>=6 else 0.0

        golden_cross    = (prev_e20<=prev_e50) and (e20v>e50v)
        near_golden     = (e20v>e50v) and ((e20v-e50v)/e50v<0.03)
        ema200_breakout = (prev<e200v) and (cp>=e200v)

        dist_50 = (cp-e50v)/e50v if e50v>0 else 0.0
        dist_20 = (cp-e20v)/e20v if e20v>0 else 0.0

        # Giriş modu tespiti
        if ema200_breakout:
            entry_mode = "EMA200_BREAKOUT"
        elif golden_cross:
            entry_mode = "GOLDEN_CROSS"
        elif (e20v>e50v>e200v) and (dist_20<=0.08) and near_golden:
            entry_mode = "NEAR_GOLDEN"
        elif (e20v>e50v>e200v) and (dist_20<=0.08) and e50_slope>=0:
            entry_mode = "TREND_BIRTH"
        elif (e20v>e50v) and (-0.02<=dist_50<=0.04):
            entry_mode = "EMA50_PULLBACK"
        elif (cp>e20v>e50v>e200v) and e50_slope>=0:
            entry_mode = "ESTABLISHED_TREND"
        else:
            return False, {}   # Güçlü hisse ama yanlış EMA noktası → atla

        # EMA200 altında sadece breakout/golden cross ile geç
        if cp < e200v:
            if entry_mode not in ("EMA200_BREAKOUT","GOLDEN_CROSS"):
                return False, {}
            entry_mode += "_BELOW200"

        adx = float(ADXIndicator(df['High'],df['Low'],c,14).adx().iloc[-1])
        early = ("EMA200_BREAKOUT","EMA200_BREAKOUT_BELOW200","GOLDEN_CROSS","GOLDEN_CROSS_BELOW200")
        if adx < (10 if entry_mode in early else ADX_MIN):
            return False, {}

        vwap    = calc_vwap(df)
        vwap_ok = (vwap>0 and cp>=vwap)

        # ── EMA Zamanlaması Skoru (0-25) ──────────────────────────────────
        # Not: Bu DOĞRULAMA skoru. Tek başına sistemi sürmez, momentum/RS sürer.
        mode_base = {
            "EMA200_BREAKOUT": 14.0, "GOLDEN_CROSS": 12.0,
            "NEAR_GOLDEN": 10.0,     "TREND_BIRTH": 9.0,
            "EMA50_PULLBACK": 8.0,   "ESTABLISHED_TREND": 7.0,
        }
        ema_score = mode_base.get(entry_mode, 0.0)

        # EMA dizilim kalitesi
        if e20v>e50v:        ema_score += 2.0
        if e50v>e200v:       ema_score += 2.0
        if e9v>e20v:         ema_score += 1.5
        if e50_slope>=0.3:   ema_score += 2.0
        elif e50_slope>=0.1: ema_score += 1.0
        # Pullback kalitesi: EMA50'ye yakın pullback = iyi giriş noktası
        if 0.0<=dist_50<=0.03: ema_score += 3.0
        elif 0.03<dist_50<=0.06: ema_score += 1.5
        # VWAP üstü
        if vwap_ok:          ema_score += 1.5
        ema_score = min(ema_score, 25.0)

        return True, {
            "entry_mode": entry_mode,
            "ema_score":  round(ema_score, 1),
            "adx":        round(adx, 1),
            "golden_cross":    golden_cross,
            "ema200_breakout": ema200_breakout,
            "near_golden":     near_golden,
            "e50_slope":  round(e50_slope, 3),
            "dist_50":    round(dist_50*100, 2),
            "dist_20":    round(dist_20*100, 2),
            "ema9":  round(e9v,3), "ema20": round(e20v,3),
            "ema50": round(e50v,3),"ema200":round(e200v,3),
            "vwap":  round(vwap,3),"vwap_ok": vwap_ok,
            "regime": ("breakout" if ema200_breakout else
                       ("trend" if adx>=20 and e20v>e50v>e200v and cp>e200v else "neutral")),
        }
    except Exception as e:
        logging.debug(f"L3 ema_timing: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 8) KATMAN 4 — BONUS PUANLAR
#    Sıkışma + Options Flow + Intraday
#    Bu katman ELEME yapmaz — sadece bonus puan ekler
# ════════════════════════════════════════════════════════════════════════════

def calc_squeeze_bonus(df: pd.DataFrame) -> dict:
    """
    Sıkışma bonusu (0-15):
    İyi hisse + doğru EMA + sıkışma = mükemmel setup.
    Ama sıkışma yoksa hisse yine de geçer — sadece bonus alamaz.
    """
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 30:
            return {"squeeze_bonus": 0.0, "squeeze_label": "—"}

        bonus = 0.0

        # BB Width Percentile
        bb = BollingerBands(c, window=20, window_dev=2)
        bw = ((bb.bollinger_hband()-bb.bollinger_lband())/bb.bollinger_mavg()).dropna()
        if not bw.empty:
            cur = float(bw.iloc[-1])
            pct = float((bw.tail(120)<cur).sum()/len(bw.tail(120))*100) if len(bw)>=20 else 50.0
            if pct < 5:    bonus += 5.0   # En dar %5 — kritik sıkışma
            elif pct < 10: bonus += 3.5
            elif pct < 20: bonus += 2.0
            elif pct < 35: bonus += 0.5
        else:
            pct = 50.0

        # ATR düşüşü
        atr_s = AverageTrueRange(h,lo,c,14).average_true_range().dropna()
        atr_falling = (len(atr_s)>=11 and
                       float(atr_s.iloc[-1])<float(atr_s.iloc[-6])<float(atr_s.iloc[-11]))
        if atr_falling: bonus += 3.0

        # NR7 / NR4
        dr = (h-lo).values
        nr7 = len(dr)>=7 and dr[-1]==min(dr[-7:])
        nr4 = len(dr)>=4 and dr[-1]==min(dr[-4:])
        if nr7:  bonus += 4.0
        elif nr4: bonus += 2.5

        # Inside day cluster
        icluster = sum(
            1 for i in range(-3,0)
            if float(h.iloc[i])<=float(h.iloc[i-1]) and float(lo.iloc[i])>=float(lo.iloc[i-1])
        ) >= 2
        if icluster: bonus += 3.0

        # Volatility crush
        lr = np.log(c/c.shift(1)).dropna()
        rv5 = float(lr.tail(5).std()*math.sqrt(252)) if len(lr)>=5 else 0.3
        rv20= float(lr.tail(20).std()*math.sqrt(252)) if len(lr)>=20 else 0.3
        if rv5 < rv20*0.75: bonus += 2.0

        # Volume dry-up (sessizleşme = patlama öncesi)
        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol)>=20 else v5
        if v5 < v20*0.8: bonus += 1.5

        bonus = min(bonus, 15.0)

        if bonus >= 12:   label = "💥 KRİTİK SIKIŞ"
        elif bonus >= 8:  label = "🔥 GÜÇLÜ SIKIŞ"
        elif bonus >= 4:  label = "🟡 ORTA SIKIŞ"
        elif bonus >= 1:  label = "📊 HAFİF SIKIŞ"
        else:             label = "—"

        return {
            "squeeze_bonus": round(bonus,1), "squeeze_label": label,
            "bb_pct": round(pct,1), "atr_falling": atr_falling,
            "nr7": nr7, "nr4": nr4, "inside_cluster": icluster,
        }
    except Exception as e:
        logging.debug(f"Squeeze bonus: {e}")
        return {"squeeze_bonus": 0.0, "squeeze_label": "—"}

async def calc_flow_bonus(ticker: str, cp: float) -> dict:
    """
    Options flow bonusu (0-10):
    Notional doğrulamalı sweep tespiti.
    """
    result = {
        "flow_bonus": 0.0, "flow_label": "—",
        "sweep_count": 0, "put_call_ratio": 1.0,
        "total_notional": 0.0, "big_block": False,
        "earnings_days": None, "earnings_warning": False,
    }
    try:
        stock = yf.Ticker(ticker)
        today = date.today()

        # Earnings kontrol
        try:
            cal = await asyncio.to_thread(lambda: stock.calendar)
            earn_date = None
            if isinstance(cal, dict):    earn_date = cal.get("Earnings Date",[None])[0]
            elif hasattr(cal,'T'):
                row = cal.T.get("Earnings Date",None)
                earn_date = row.iloc[0] if row is not None and len(row)>0 else None
            if earn_date is not None:
                if hasattr(earn_date,'date'):   earn_date=earn_date.date()
                elif isinstance(earn_date,str): earn_date=datetime.strptime(earn_date[:10],"%Y-%m-%d").date()
                days=(earn_date-today).days
                result["earnings_days"]=days
                if 0<=days<=10: result["earnings_warning"]=True
        except: pass

        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps: return result

        near = sorted(
            [(d,(datetime.strptime(d,"%Y-%m-%d").date()-today).days)
             for d in exps if 1<=(datetime.strptime(d,"%Y-%m-%d").date()-today).days<=75],
            key=lambda x: x[1]
        ) # Removed [:3] to look at more expirations

        call_vol=0; put_vol=0; notional=0.0; sweeps=0
        ask_vol=0; all_vol=0; iv_vals=[]

        for exp_d,_ in near:
            try:
                chain = await asyncio.to_thread(lambda e=exp_d: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None else pd.DataFrame()

                if not calls.empty:
                    for col in ['volume','openInterest','ask','bid','impliedVolatility','strike']:
                        if col in calls.columns:
                            calls[col]=pd.to_numeric(calls[col],errors='coerce').fillna(0)

                    call_vol += int(calls['volume'].sum())
                    for _,row in calls.iterrows():
                        oi_=float(row.get('openInterest',0)); vol_=float(row.get('volume',0))
                        ask_=float(row.get('ask',0));        bid_=float(row.get('bid',0))
                        iv_ =float(row.get('impliedVolatility',0))
                        s_  =float(row.get('strike',0))
                        mid_=(ask_+bid_)/2.0; not_=vol_*mid_*100

                        # Notional doğrulamalı sweep
                        if oi_>20 and vol_>0 and vol_/oi_>=3.0 and not_>=NOTIONAL_SWEEP_MIN:
                            sweeps+=1

                        if s_>cp*1.03 and ask_>0.5 and vol_>=50:
                            notional+=not_
                        if vol_>0 and ask_>bid_*1.05: ask_vol+=int(vol_)
                        all_vol+=int(vol_)
                        if iv_>0.05: iv_vals.append(iv_)

                if not puts.empty:
                    puts['volume']=pd.to_numeric(puts.get('volume',0),errors='coerce').fillna(0)
                    put_vol+=int(puts['volume'].sum())
            except: continue

        result["total_notional"]=round(notional,0)
        result["sweep_count"]=sweeps
        pc=put_vol/call_vol if call_vol>0 else 1.0
        result["put_call_ratio"]=round(pc,2)

        bonus=0.0
        if pc<0.4:    bonus+=3.0
        elif pc<0.6:  bonus+=2.0
        elif pc<0.8:  bonus+=1.0
        elif pc>1.5:  bonus-=1.0

        if sweeps>=3:   bonus+=4.0
        elif sweeps>=2: bonus+=3.0
        elif sweeps>=1: bonus+=2.0

        if notional>=NOTIONAL_BLOCK_MIN:
            result["big_block"]=True; bonus+=4.0
        elif notional>=NOTIONAL_SWEEP_MIN:
            result["big_block"]=True; bonus+=2.5

        ask_r=ask_vol/all_vol if all_vol>0 else 0.5
        if ask_r>0.75: bonus+=2.0
        elif ask_r>0.6: bonus+=1.0

        if result["earnings_warning"]: bonus-=3.0

        bonus=max(0.0,min(bonus,10.0))
        result["flow_bonus"]=round(bonus,1)

        if bonus>=7:   result["flow_label"]="🔥 KURUMSAL SWEEP"
        elif bonus>=4: result["flow_label"]="📈 POZİTİF AKIŞ"
        elif bonus>=2: result["flow_label"]="👀 HAFİF UOA"
        else:          result["flow_label"]="—"

    except Exception as e:
        print(f"ERROR in calc_flow_bonus for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        logging.debug(f"Flow bonus {ticker}: {e}")
    return result

# ════════════════════════════════════════════════════════════════════════════
# 9) KATMAN 5 — OPSİYON SEÇİMİ
# ════════════════════════════════════════════════════════════════════════════

def get_preferred_dte(squeeze_bonus: float, flow_bonus: float,
                      steady_trend: bool = False) -> Tuple[int,int]:
    """
    DTE seçimi — scan moduna göre otomatik:

    market_open  → kısa DTE öncelikli (15-45g)
      - Gamma squeeze (PE+flow güçlü) → 15-25g
      - Normal momentum                → 21-45g
      - Steady trend                   → 35-75g

    pre_market   → orta-uzun (21-75g) — ikisi de görünür
      - Güçlü setup                    → 21-45g
      - Normal/steady                  → 35-75g

    market_closed → uzun vade (35-75g)
      - Her setup                      → 35-75g
    """
    mode = get_scan_mode()

    if mode == "market_open":
        if squeeze_bonus >= 10 and flow_bonus >= 5: return (15, 25)   # Gamma squeeze
        elif squeeze_bonus >= 6 or flow_bonus >= 4: return (21, 45)   # Momentum
        elif steady_trend:                           return (35, 75)   # Yavaş güçlü
        else:                                        return (35, 75)

    elif mode == "pre_market":
        # Sabah taraması: hem kısa hem uzun vade adaylar göster
        if squeeze_bonus >= 10 and flow_bonus >= 5: return (21, 45)   # Min 21g
        else:                                        return (35, 75)

    else:  # market_closed
        return (35, 75)   # Gece: sadece uzun vade

async def layer5_options(ticker: str, cp: float, close: pd.Series,
                          hv: float, l2: dict, l3: dict, squeeze: dict, flow: dict) -> Optional[dict]:
    try:
        stock = yf.Ticker(ticker)
        exps  = await asyncio.to_thread(lambda: stock.options)
        if not exps: return None

        today = date.today()
        pref_min, pref_max = get_preferred_dte(
            squeeze.get("squeeze_bonus",0), flow.get("flow_bonus",0),
            steady_trend=l2.get("steady_trend", False) if "steady_trend" in str(l2) else False)

        best_result = None
        best_score  = -999.0

        for exp_str in exps:
            try:
                dte=(datetime.strptime(exp_str,"%Y-%m-%d").date()-today).days
                # Market kapalı modda çok kısa vadeli kontratlar anlamsız
                dte_min_effective = 21 if not MARKET_OPEN_AT_SCAN else DTE_MIN
                if not (dte_min_effective<=dte<=DTE_MAX): 
                    print(f"DEBUG: {ticker} {exp_str} DTE {dte} rejected")
                    continue
            except: continue

            try:
                chain = await asyncio.to_thread(lambda e=exp_str: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None and not chain.calls.empty else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None and not chain.puts.empty  else pd.DataFrame()
                if calls.empty: continue
            except: continue

            calls['strike']=pd.to_numeric(calls['strike'],errors='coerce')
            calls=calls.dropna(subset=['strike'])
            atm_idx=(calls['strike']-cp).abs().idxmin()
            raw_iv=float(calls.loc[atm_idx].get('impliedVolatility',hv) or hv)
            atm_iv=max(raw_iv, hv*0.5)

            iv_rank,iv_pct=calc_iv_rank(atm_iv,close)

            # IV hard block
            if iv_rank > 80:
                is_squeeze = squeeze.get("squeeze_bonus",0)>=8
                is_fresh   = l3.get("ema200_breakout",False) or l3.get("golden_cross",False)
                if not (is_squeeze and is_fresh): continue

            em    = cp * atm_iv * math.sqrt(dte/365.0)
            em_up = cp + em
            mp    = max_pain(calls, puts, cp)

            # MM Trap: EM/ATR kontrolü
            atr_abs = cp * l3.get("atr_pct", 2.0) / 100.0
            if atr_abs > 0 and em/atr_abs > EM_ATR_MAX_RATIO: continue

            # Call wall tespiti
            cw_oi = max((int(row.get('openInterest',0) or 0) for _,row in calls.iterrows()
                         if cp*1.02 < float(row.get('strike',0)) < cp*1.10), default=0)
            cw_danger = cw_oi > CALL_WALL_OI_MIN

            dte_bonus = 5.0 if pref_min<=dte<=pref_max else 0.0
            T=dte/365.0; r=0.05
            sim_days = 2 if dte<=21 else (3 if dte<=45 else 5)
            dyn_tp = 0.60 if em/cp>0.15 else (0.45 if em/cp>0.10 else 0.40)
            time_stop = max(round(dte*(1-TIME_STOP_RATIO)),3)

            gamma_best=None; gamma_top=-999.0
            safe_best =None; safe_top =-999.0

            for _,row in calls.iterrows():
                try:
                    strike=float(row['strike'])
                    iv_row=max(float(row.get('impliedVolatility',atm_iv) or atm_iv),0.05)
                    bid=float(row.get('bid',0) or 0); ask=float(row.get('ask',0) or 0)
                    if ask<=0.03: continue
                    mid=(bid+ask)/2.0; spread=(ask-bid)/ask if ask>0 else 1.0
                    if spread>SPREAD_MAX: continue
                    oi=int(row.get('openInterest',0) or 0); volume=int(row.get('volume',0) or 0)
                    if oi<5 or mid<MID_MIN: continue # Loosened OI from 50 to 5
                    if strike>em_up*1.08: continue

                    g=bs_greeks(cp,strike,T,r,iv_row)
                    delta=g['delta']; gamma=g['gamma']; theta=g['theta']
                    # Removed delta/theta check

                    vol_oi=volume/oi if oi>0 else 0.0
                    notional=volume*mid*100

                    # ── GAMMA SWEET SPOT (0.28-0.45) ──────────────────────
                    if DELTA_GAMMA_MIN<=delta<=DELTA_GAMMA_MAX:
                        fs=0.0
                        if vol_oi>=1.0: fs+=5.0
                        # Removed strict fs logic
                        if notional>=NOTIONAL_BLOCK_MIN: fs+=6.0
                        elif notional>=NOTIONAL_SWEEP_MIN: fs+=3.0
                        if volume>=100 and ask>bid*1.1: fs+=3.0

                        # Gamma efficiency (log-capped)
                        geff=min(math.log1p(gamma/mid if mid>0 else 0), math.log1p(0.08))

                        liq=(5.0 if spread<=0.03 else (3.0 if spread<=0.06 else 1.0))
                        liq+=(3.0 if oi>=1000 else (1.5 if oi>=300 else 0.0))
                        liq+=(2.0 if volume>=200 else 1.0); liq=min(liq,8.0)

                        accel=(3.0 if dte<=14 else (2.5 if dte<=21 else (2.0 if dte<=30 else (1.5 if dte<=45 else 1.0))))
                        cw_pen=-5.0 if cw_danger and strike>cp*0.99 else 0.0

                        sc=fs+geff*50.0+delta*3.0+liq+accel*2.0+dte_bonus+cw_pen
                        if sc>gamma_top:
                            gamma_top=sc
                            atr_move=min(max(l3.get("atr_pct",2.0)/100*4.0,0.04),0.25)
                            gamma_best={
                                "type":"🚀 GAMMA SWEET SPOT",
                                "strike":strike,"expiration":exp_str,"dte":dte,
                                "bid":round(bid,2),"ask":round(ask,2),"mid":round(mid,2),
                                "spread_pct":round(spread*100,1),
                                "oi":oi,"volume":volume,"vol_oi_ratio":round(vol_oi,3),
                                "notional":round(notional,0),
                                "iv_pct":round(iv_row*100,1),
                                "delta":round(delta,3),"gamma":round(gamma,5),"theta":round(theta,4),
                                "gamma_accel":accel,"gamma_eff":round(geff,4),"flow_score":round(fs,1),
                                "liq_score":round(liq,1),"call_wall_danger":cw_danger,
                                "cost_per_contract":round(ask*100,0),"score":round(sc,2),
                                "sim":bs_pnl_sim(cp,strike,iv_row,dte,atr_move,sim_days),
                                "breakeven":round(strike+ask,2),
                                "tp_price":round(mid*(1+dyn_tp),2),"sl_price":round(mid*(1+STOP_LOSS_PCT),2),
                                "time_stop_days":time_stop,
                                "daily_decay_pct":round(abs(theta)/mid*100,2) if mid>0 else 0,
                            }

                    # ── KURUMSAL (0.45-0.62) ──────────────────────────────
                    elif DELTA_SAFE_MIN<=delta<=DELTA_SAFE_MAX:
                        liq=(5.0 if spread<=0.02 else (3.5 if spread<=0.04 else 1.5))
                        liq+=(3.0 if oi>=2000 else (2.0 if oi>=800 else 1.0)); liq=min(liq,10.0)
                        sweep=(min(vol_oi*5,5.0) if notional>=25_000 else 0.0)
                        sc=delta*4.0+gamma*1000.0+liq+sweep+dte_bonus
                        if sc>safe_top:
                            safe_top=sc
                            atr_move=min(max(l3.get("atr_pct",2.0)/100*3.0,0.03),0.18)
                            safe_best={
                                "type":"🛡️ KURUMSAL SIĞINAK",
                                "strike":strike,"expiration":exp_str,"dte":dte,
                                "bid":round(bid,2),"ask":round(ask,2),"mid":round(mid,2),
                                "spread_pct":round(spread*100,1),
                                "oi":oi,"volume":volume,"vol_oi_ratio":round(vol_oi,3),
                                "notional":round(notional,0),
                                "iv_pct":round(iv_row*100,1),
                                "delta":round(delta,3),"gamma":round(gamma,5),"theta":round(theta,4),
                                "gamma_accel":(3.0 if dte<=14 else 1.0),"call_wall_danger":cw_danger,
                                "cost_per_contract":round(ask*100,0),"score":round(sc,2),
                                "sim":bs_pnl_sim(cp,strike,iv_row,dte,atr_move,sim_days),
                                "breakeven":round(strike+ask,2),
                                "tp_price":round(mid*(1+dyn_tp),2),"sl_price":round(mid*(1+STOP_LOSS_PCT),2),
                                "time_stop_days":time_stop,
                                "daily_decay_pct":round(abs(theta)/mid*100,2) if mid>0 else 0,
                            }
                except: continue

            if gamma_best or safe_best:
                top=max(gamma_top if gamma_best else -999.0, safe_top if safe_best else -999.0)
                if top>best_score:
                    best_score=top
                    best_result={
                        "exp_date":exp_str,"dte":dte,"max_pain":round(mp,2),
                        "em":round(em,2),"em_upper":round(em_up,2),
                        "atm_iv":round(atm_iv*100,1),"iv_rank":iv_rank,"iv_pct_rank":iv_pct,
                        "iv_vs_hv":round(atm_iv/hv,3) if hv>0 else 1.0,
                        "call_wall_danger":cw_danger,"call_wall_oi":int(cw_oi),
                        "em_atr_ratio":round(em/atr_abs,2) if atr_abs>0 else 0,
                        "pref_dte_range":(pref_min,pref_max),
                        "gamma_sweet":gamma_best,"institutional":safe_best,
                    }
        return best_result
    except Exception as e:
        logging.debug(f"{ticker} L5: {e}")
        return None

# ════════════════════════════════════════════════════════════════════════════
# 10) IV CONTEXT
# ════════════════════════════════════════════════════════════════════════════

def iv_context(iv_rank: float, l3: dict, squeeze: dict, flow: dict) -> Tuple[float,str]:
    hv      = l3.get("hv20",0.3)
    atm_iv  = 0.3  # proxy, asıl değer opsiyon katmanından geliyor
    iv_vs_hv= atm_iv/hv if hv>0 else 1.0
    is_sq   = squeeze.get("squeeze_bonus",0)>=8
    is_br   = l3.get("ema200_breakout",False) or l3.get("golden_cross",False)
    is_flow = flow.get("flow_bonus",0)>=5

    if iv_rank<=20:    s,lbl=10.0,"💰 ULTRA UCUZ IV"
    elif iv_rank<=30:  s,lbl= 8.0,"🟢 UCUZ IV"
    elif iv_rank<=45:  s,lbl= 6.0,"🟡 ORTA IV"
    elif iv_rank<=60:
        if is_sq or is_br or is_flow: s,lbl=5.0,"🟠 YÜKSEK IV — BAĞLAM POZİTİF"
        else:                          s,lbl=2.0,"🔴 YÜKSEK IV"
    elif iv_rank<=80:
        if is_sq and is_flow: s,lbl=4.0,"🔴 YÜKSEK IV — SWEEP+SIKIŞ"
        elif is_br:           s,lbl=3.0,"🔴 YÜKSEK IV — TAZE KIRILIM"
        else:                 s,lbl=0.0,"🚫 IV ÇOK YÜKSEK"
    else: return -5.0,"🚫 IV HARD BLOCK"

    return round(s,1), lbl

# ════════════════════════════════════════════════════════════════════════════
# 11) BACKTEST LOGGER
# ════════════════════════════════════════════════════════════════════════════

def log_backtest(c: dict):
    try:
        l2  = c.get("l2",{})
        l3  = c.get("l3",{})
        sq  = c.get("squeeze",{})
        fl  = c.get("flow",{})
        opt = c.get("options",{})
        best= opt.get("gamma_sweet") or opt.get("institutional") or {}
        rec = {
            "ts": datetime.now(NY_TZ).isoformat(),
            "ticker": c.get("ticker"), "price": c.get("current_price"),
            "score": c.get("score"),
            # Ana motor
            "rs_60": l2.get("rs_60"), "rs_20": l2.get("rs_20"),
            "rs_score": l2.get("rs_score"), "mom_score": l2.get("mom_score"),
            "hh1": l2.get("hh_1"), "hh2": l2.get("hh_2"), "hh3": l2.get("hh_3"),
            "roc5": l2.get("roc5"), "rsi": l2.get("rsi"),
            # EMA zamanlaması
            "entry_mode": l3.get("entry_mode"), "ema_score": l3.get("ema_score"),
            # Bonus
            "squeeze_bonus": sq.get("squeeze_bonus"), "nr7": sq.get("nr7"),
            "bb_pct": sq.get("bb_pct"),
            "flow_bonus": fl.get("flow_bonus"), "sweep_count": fl.get("sweep_count"),
            "put_call": fl.get("put_call_ratio"), "notional": fl.get("total_notional"),
            # Opsiyon
            "delta": best.get("delta"), "dte": best.get("dte"),
            "cost": best.get("cost_per_contract"), "gamma_accel": best.get("gamma_accel"),
            "sim_pnl": best.get("sim",{}).get("pnl_pct"),
            # Context
            "sector": c.get("sector"), "iv_rank": opt.get("iv_rank"),
            "call_wall": best.get("call_wall_danger"),
            # Çıktı (sonra doldur)
            "peak_pct": None, "time_to_peak": None, "hit_40pct": None,
        }
        with open(os.path.join(DATA_DIR,"backtest_log.jsonl"),"a",encoding="utf-8") as f:
            f.write(json.dumps(rec,ensure_ascii=False,default=str)+"\n")
    except: pass

# ════════════════════════════════════════════════════════════════════════════
# 12) ANA ANALİZ
# ════════════════════════════════════════════════════════════════════════════

ANALYSIS_SEM     = asyncio.Semaphore(SEMAPHORE_N)
PROGRESS_COUNTER = 0
TOTAL_TO_SCAN    = 0

async def analyze(ticker: str) -> Optional[dict]:
    global PROGRESS_COUNTER
    async with ANALYSIS_SEM:
        try:
            PROGRESS_COUNTER += 1
            print(f"🔍 [{PROGRESS_COUNTER}/{TOTAL_TO_SCAN}] {ticker}")

            # Rate limit koruması için kısa bekleme
            await asyncio.sleep(1)

            # Bear piyasada dur
            if MARKET_REGIME.get("regime") == "bear": return None
            
            df = await asyncio.wait_for(asyncio.to_thread(
                lambda: yf.Ticker(ticker).history(period="300d",interval="1d",auto_adjust=True)
            ), timeout=30)
            if df is None or len(df)<210: return None

            df.columns=[str(c).strip().title() for c in
                        (df.columns.get_level_values(0) if isinstance(df.columns,pd.MultiIndex) else df.columns)]
            if 'Close' not in df.columns: return None

            close=df['Close'].astype(float)
            cp=float(close.iloc[-1])
            if not (PRICE_MIN<=cp<=PRICE_MAX): return None

            # ── KATMAN 2: Güçlü hisse? ─────────────────────────────────────
            l2_ok, l2 = layer2_strong_stock(df)
            if not l2: l2 = {"rs_score": 0, "mom_score": 0, "rs_60": 0, "rs_20": 0, "rs_5": 0, "roc5": 0, "roc20": 0, "roc60": 0, "rsi": 50, "rvol": 1, "atr_pct": 2, "hv20": 0.3}

            # ── MTF RSI — 1D + 1H yukarı zorunlu (DEAD CAT BOUNCE KORUMASI) ──
            df_1h = await fetch_1h_data(ticker)
            mtf_ok, mtf = check_mtf_rsi_alignment(df, df_1h, market_open=MARKET_OPEN_AT_SCAN)
            if not mtf: mtf = {"rsi_1d": 50, "rsi_1h": "50", "rsi_1h_val": 50, "trend_1d": "Nötr", "rsi_alignment": "—"}

            # ── Sektör ────────────────────────────────────────────────────
            sector    = await get_sector(ticker)
            sec_score = calc_sector_score(sector)

            # ── KATMAN 3: Doğru EMA noktası? ───────────────────────────────
            l3_ok, l3 = layer3_ema_timing(df)
            if not l3: l3 = {"ema_score": 0, "entry_mode": "—", "adx": 10, "vwap_ok": False}

            # ── KATMAN 4: Bonus puanlar ────────────────────────────────────
            squeeze = calc_squeeze_bonus(df)
            flow    = await calc_flow_bonus(ticker, cp)

            # ── KATMAN 5: Opsiyon ──────────────────────────────────────────
            hv20 = l2.get("hv20", calc_hv(close,20))
            opt  = await layer5_options(ticker, cp, close, hv20, l2, l3, squeeze, flow)
            if not opt: 
                print(f"DEBUG: {ticker} rejected at L5 (Options)")
                return None

            # IV Context (IV hard block mümkün)
            iv_s, iv_lbl = iv_context(opt.get("iv_rank",50), l3, squeeze, flow)
            # Removed IV hard block check
            if iv_s < -100: return None

            # Piyasa rejim skoru
            regime       = MARKET_REGIME.get("regime","neutral")
            regime_score = 10.0 if regime=="bull" and MARKET_REGIME.get("score",50)>=75 else (8.0 if regime=="bull" else 5.0)
            regime_label = "🟢 GÜÇLÜ BOĞA" if regime_score>=10 else ("🟢 BOĞA" if regime_score>=8 else "🟡 NÖTR")

            best_opt = opt.get("gamma_sweet") or opt.get("institutional")
            opt_flow = min(best_opt.get("flow_score",0)/3.0, 5.0) if best_opt else 0.0

            # ── WINNER FORMULA TOPLAM SKORU ────────────────────────────────
            # Önce güçlü hisse (RS + Momentum): 35 puan
            # Sonra EMA zamanlaması doğrulaması: 25 puan
            # Sektör liderliği: 15 puan
            # Sıkışma bonusu: 15 puan
            # Options flow bonusu: 10 puan

            # MTF RSI hizalama bonusu
            mtf_bonus = 0.0
            if mtf.get("steady_momentum"): mtf_bonus += 5.0
            if mtf.get("hh_hl"):           mtf_bonus += 3.0
            rsi_align = mtf.get("rsi_alignment","")
            if rsi_align == "🔥 MÜKEMMEL":   mtf_bonus += 4.0
            elif rsi_align == "✅ İYİ":       mtf_bonus += 2.0
            mtf_bonus = min(mtf_bonus, 10.0)

            total = (
                l2.get("rs_score",0)       +   # 0-20  RS — ANA MOTOR
                l2.get("mom_score",0)       +   # 0-15  Momentum — ANA MOTOR
                l3.get("ema_score",0)       +   # 0-25  EMA zamanlaması
                sec_score                   +   # 0-15  Sektör
                squeeze.get("squeeze_bonus",0)+ # 0-15  Sıkışma BONUS
                flow.get("flow_bonus",0)    +   # 0-10  Flow BONUS
                iv_s                        +   # 0-10  IV
                opt_flow                    +   # 0-5   Opsiyon flow
                mtf_bonus                       # 0-10  MTF RSI hizalama BONUS
            )

            # Bonus: Golden Cross / EMA200 breakout
            if l3.get("golden_cross") or "GOLDEN_CROSS" in l3.get("entry_mode",""):  total+=5.0
            if l3.get("ema200_breakout") or "EMA200_BREAKOUT" in l3.get("entry_mode",""): total+=7.0
            # Call wall cezası
            if opt.get("call_wall_danger"): total-=4.0
            # Earnings uyarı cezası
            if flow.get("earnings_warning"): total-=5.0

            total = min(max(total,0.0),100.0)

            # Grade
            if total>=72:    grade="🏆 PATLAMA POTANSİYELİ"
            elif total>=58:  grade="🔥 GÜÇLÜ FIRSAT"
            elif total>=44:  grade="💡 İYİ SETUP"
            else:            grade="📊 OLASI"

            # Rozetler
            if squeeze.get("squeeze_bonus",0)>=10: grade="💥"+grade
            if flow.get("sweep_count",0)>=2:        grade="⚡"+grade
            if squeeze.get("nr7"):                  grade="NR7·"+grade
            if l3.get("golden_cross"):              grade="🌟"+grade
            if l3.get("ema200_breakout"):           grade="🚀"+grade
            if opt.get("call_wall_danger"):         grade+="·DUVAR⚠️"
            if flow.get("earnings_warning"):        grade+="·EARN⚠️"

            result = {
                "ticker": ticker,"current_price": round(cp,2),
                "score": round(total,1),"grade": grade,"sector": sector,
                "l2": l2, "l3": l3, "squeeze": squeeze, "flow": flow,
                "mtf": mtf,
                "options": opt, "hv20": round(hv20*100,1),
                "sector_score": round(sec_score,1),
                "regime_label": regime_label,
                "iv_ctx_score": round(iv_s,1),"iv_ctx_label": iv_lbl,
                "mtf_bonus": round(mtf_bonus,1),
            }
            log_backtest(result)
            return result
        except Exception as e:
            print(f"CRITICAL ERROR analyzing {ticker}: {e}")
            import traceback
            traceback.print_exc()
            return None

# ════════════════════════════════════════════════════════════════════════════
# 13) RAPOR
# ════════════════════════════════════════════════════════════════════════════

def build_block(c: dict) -> str:
    ticker=c['ticker']; cp=c['current_price']; grade=c['grade']
    l2=c['l2']; l3=c['l3']; sq=c['squeeze']; fl=c['flow']
    mtf_data=c.get('mtf',{}); opt=c['options']; sector=c.get('sector','—')

    entry_lbl={
        "EMA200_BREAKOUT":"⚡ EMA200 KIRILIM","EMA200_BREAKOUT_BELOW200":"⚡ DİP KIRILIM",
        "GOLDEN_CROSS":"🌟 GOLDEN CROSS","NEAR_GOLDEN":"🔜 NEAR GOLDEN",
        "TREND_BIRTH":"🌱 TREND BAŞI","EMA50_PULLBACK":"📉→📈 EMA50 SEKME",
        "ESTABLISHED_TREND":"🐂 GÜÇLÜ TREND",
    }

    lines=[
        f"\n{'═'*55}",
        f"{grade}  <b>#{ticker}</b>  ${cp:.2f}  ({sector})",
        f"📊 Skor:<b>{c['score']}/100</b>  {c.get('regime_label','')}",
        # Güçlü hisse (Ana Motor)
        f"💪 RS vs SPY: <b>60g:{l2.get('rs_60',0):+.1f}pp  20g:{l2.get('rs_20',0):+.1f}pp  5g:{l2.get('rs_5',0):+.1f}pp</b>",
        f"📈 Momentum: HH:{'✅✅✅' if l2.get('hh_3') else ('✅✅' if l2.get('hh_2') else ('✅' if l2.get('hh_1') else '❌'))}  "
        f"ROC5:{l2.get('roc5',0):+.1f}%  RVOL:{l2.get('rvol',1):.2f}x  RSI:{l2.get('rsi',50):.0f}  "
        f"{'🐢 Steady' if l2.get('steady_trend') else ''}",
        # EMA Zamanlaması
        f"🔮 EMA: <b>{entry_lbl.get(l3.get('entry_mode',''),l3.get('entry_mode','—'))}</b>  "
        f"ADX:{l3.get('adx',0):.0f}  EMAScore:{l3.get('ema_score',0):.0f}/25  "
        f"VWAP:{'✅' if l3.get('vwap_ok') else '⚠️'}",
        # MTF RSI Hizalaması
        f"📡 MTF RSI: 1D:<b>{mtf_data.get('rsi_1d','—')}</b>  1H:<b>{mtf_data.get('rsi_1h','—')}</b>  "
        f"{mtf_data.get('rsi_alignment','—')}  "
        f"Trend:{mtf_data.get('trend_1d','—')}  "
        f"Steady:{'✅' if mtf_data.get('steady_momentum') else '❌'}  "
        f"HH/HL:{'✅' if mtf_data.get('hh_hl') else '❌'}",
        # Sıkışma Bonusu
        f"💥 Sıkışma Bonus: <b>{sq.get('squeeze_bonus',0):.0f}/15</b>  {sq.get('squeeze_label','—')}  "
        f"BB%:{sq.get('bb_pct',50):.0f}  ATR↓:{'✅' if sq.get('atr_falling') else '❌'}  "
        f"NR7:{'✅' if sq.get('nr7') else '❌'}",
        # IV
        f"📊 IV:{opt.get('atm_iv',0):.0f}%  Rank:{opt.get('iv_rank',0):.0f}  {c.get('iv_ctx_label','')}  "
        f"EM/ATR:{opt.get('em_atr_ratio',1):.1f}{'  ⚠️MM TRAP' if opt.get('call_wall_danger') else ''}",
        # Flow Bonus
        f"🔥 Flow Bonus: <b>{fl.get('flow_bonus',0):.0f}/10</b>  {fl.get('flow_label','—')}  "
        f"P/C:{fl.get('put_call_ratio',1):.2f}  Sweep:{fl.get('sweep_count',0)}  "
        f"${fl.get('total_notional',0):,.0f}",
    ]

    if fl.get("earnings_warning"):
        lines.append(f"   ⚠️ EARNINGS {fl.get('earnings_days','?')} GÜN SONRA!")

    pref=opt.get("pref_dte_range",(25,45))
    lines.append(f"📅 Tercih DTE:{pref[0]}-{pref[1]}g  |  Vade:{opt.get('exp_date','—')} ({opt.get('dte','—')}g)")
    lines.append(f"🏭 Sektör:{sector} ({c.get('sector_score',0):.0f}/15)")

    for key in ["gamma_sweet","institutional"]:
        od=opt.get(key)
        if not od: continue
        sim=od.get("sim",{})
        lines.append(f"\n  {od['type']}")
        lines.append(f"  ${od['strike']:.0f} | {od['expiration']} ({od['dte']}g) | <b>${od['cost_per_contract']:.0f}</b>")
        lines.append(
            f"  Δ={od['delta']:.2f} Γ={od['gamma']:.4f} ΓAccel={od.get('gamma_accel',1):.1f}x  "
            f"IV={od['iv_pct']:.0f}%  Flow:{od.get('flow_score',0):.0f}"
        )
        lines.append(
            f"  Spread:%{od['spread_pct']:.1f}  OI:{od['oi']:,}  Vol:{od['volume']:,}  "
            f"Not:${od.get('notional',0):,.0f}"
        )
        if od.get("call_wall_danger"): lines.append("  ⚠️ CALL WALL — MM Trap riski!")
        if sim:
            lines.append(
                f"  📈 {sim.get('days_fwd',3)}g sim: ${sim.get('price_now',0):.2f}→${sim.get('price_fwd',0):.2f}"
                f"  <b>PNL:{sim.get('pnl_pct',0):+.0f}%</b>"
            )
        lines.append(f"  🎯 TP:${od['tp_price']:.2f}  SL:${od['sl_price']:.2f}  Zaman:{od['time_stop_days']}g")
    return "\n".join(lines)

def build_report(candidates, vix, duration, n_scanned):
    n=len(candidates)
    regime=MARKET_REGIME.get("regime","neutral").upper()
    qqq5  =MARKET_REGIME.get("qqq_5d",0.0)
    now_s =datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")

    summary=(
        f"🚀 <b>BOGA AI v221 — ÖNCE GÜÇLÜ HİSSE</b>\n"
        f"🕒 {now_s}  |  VIX:{vix:.1f}  |  Rejim:<b>{regime}</b>\n"
        f"📊 QQQ:{qqq5:+.1f}%\n"
        f"🔍 {n_scanned} hisse → <b>{n} ADAY</b>  ({duration:.0f}sn)\n\n"
    )
    for i,c in enumerate(candidates[:15],1):
        l2=c['l2']; fl=c['flow']; opt=c['options']
        best=opt.get("gamma_sweet") or opt.get("institutional")
        cost=f"${best['cost_per_contract']:.0f}" if best else "—"
        dte=f"{best['dte']}g" if best else "—"
        spnl=best['sim'].get('pnl_pct',0) if best and best.get('sim') else 0
        summary+=(
            f"{i}. <b>{c['ticker']}</b> ${c['current_price']:.0f}  {c['score']:.0f}pt  {c.get('sector','')[:20]}\n"
            f"   RS60:{l2.get('rs_60',0):+.1f}pp  Sıkış:{c['squeeze'].get('squeeze_bonus',0):.0f}  "
            f"Flow:{fl.get('flow_bonus',0):.0f}  {cost}/{dte}  sim:{spnl:+.0f}%\n"
            f"   {c['grade'][:45]}\n\n"
        )
    detail="\n".join(build_block(c) for c in candidates[:10])
    return summary, detail

def save_picks(candidates):
    try:
        out=os.path.join(DATA_DIR,f"v222_{datetime.now().strftime('%Y%m%d_%H%M')}.json")
        with open(out,"w",encoding="utf-8") as f:
            json.dump(candidates,f,ensure_ascii=False,default=str,indent=2)
        logging.info(f"💾 {out}")
    except: pass

# ════════════════════════════════════════════════════════════════════════════
# 14) ANA TARAMA
# ════════════════════════════════════════════════════════════════════════════

async def scan():
    start=time.time()
    await update_market_data()

    # Tarama modunu belirle
    global MARKET_OPEN_AT_SCAN
    mode = get_scan_mode()
    # market_open → kısa DTE + 1H aktif
    # pre_market / market_closed → uzun DTE + 1H bypass
    MARKET_OPEN_AT_SCAN = (mode == "market_open")

    regime=MARKET_REGIME.get("regime","neutral")
    qqq5  =MARKET_REGIME.get("qqq_5d",0.0)
    mode_label = (
        "📈 Market AÇIK — Tam tarama (1H aktif, DTE 15-45g)"   if mode == "market_open"
        else "🌅 Pre-Market — Günlük tarama (1H bypass, DTE 21-75g)" if mode == "pre_market"
        else "🌙 Market KAPALI — Günlük tarama (1H bypass, DTE 35-75g)"
    )

    await send_tg(
        f"🚀 <b>BOGA AI v221</b>\n"
        f"🕒 {datetime.now(NY_TZ).strftime('%Y-%m-%d %H:%M NY')}\n"
        f"VIX:{MARKET_VIX['value']:.1f}  Rejim:<b>{regime.upper()}</b>  QQQ:{qqq5:+.1f}%\n"
        f"{mode_label}\n\n"
        f"RS > SPY+{RS_60D_MIN}pp (yavaş trend istisnalı)\n"
        f"MTF RSI: {'1D+1H aktif' if MARKET_OPEN_AT_SCAN else '1D only — 1H bypass'}\n"
        f"DTE tercih: {'15-45g' if MARKET_OPEN_AT_SCAN else '35-75g'}\n"
        f"Delta 0.28-0.45 | DTE: {'15-75g (kısa+uzun)' if mode=='market_open' else ('21-75g (orta+uzun)' if mode=='pre_market' else '35-75g (uzun vade)')} | $200 max\n"
        f"📊 {MAX_TICKERS_SCAN} hisse taranıyor..."
    )

    universe=await build_universe()
    if not universe:
        await send_tg("❌ Evren oluşturulamadı!"); return

    await send_tg(f"✅ {len(universe)} hisse — derin analiz başlıyor...")

    global TOTAL_TO_SCAN, PROGRESS_COUNTER
    TOTAL_TO_SCAN=len(universe); PROGRESS_COUNTER=0

    results=await asyncio.gather(*[analyze(t) for t in universe],return_exceptions=True)
    candidates=sorted([r for r in results if isinstance(r,dict)],key=lambda x:x['score'],reverse=True)

    if not candidates:
        await send_tg(
            "⚠️ Aday bulunamadı!\n"
            "• Piyasadan güçlü hisse yok (RS filtresi çok dar mı?)\n"
            f"  → RS_60D_MIN={RS_60D_MIN} düşürülebilir\n"
            "• EMA zamanlaması uygun değil\n"
        )
        return

    duration=time.time()-start
    save_picks(candidates)
    summary,detail=build_report(candidates,MARKET_VIX['value'],duration,len(universe))
    await send_tg(summary)
    await asyncio.sleep(1)
    for chunk in split_safe(detail):
        if chunk.strip():
            await send_tg(chunk); await asyncio.sleep(0.8)

    best=candidates[0]
    bo=best['options'].get("gamma_sweet") or best['options'].get("institutional")
    await send_tg(
        f"✅ <b>v221 Tamamlandı!</b>  {duration:.0f}sn  {len(universe)}→{len(candidates)}\n"
        f"🏆 <b>{best['ticker']}</b> ({best['score']:.1f}/100)\n"
        f"💪 RS60:{best['l2'].get('rs_60',0):+.1f}pp  Sıkış:{best['squeeze'].get('squeeze_bonus',0):.0f}  Flow:{best['flow'].get('flow_bonus',0):.0f}\n"
        f"{'$'+str(bo['cost_per_contract'])+'/'+str(bo['dte'])+'g' if bo else '—'}"
    )

# ════════════════════════════════════════════════════════════════════════════
# 15) ZAMANLAYICI + BAŞLATMA
# ════════════════════════════════════════════════════════════════════════════

def get_next_run_utc(hour=10, minute=30):
    from datetime import timezone as tz
    now=datetime.now(tz.utc).astimezone(NY_TZ)
    c=now.replace(hour=hour,minute=minute,second=0,microsecond=0)
    if c<=now: c+=timedelta(days=1)
    while c.weekday()>=5: c+=timedelta(days=1)
    return c.astimezone(tz.utc)

async def run_scanner():
    await send_tg("🚀 <b>BOGA AI v221 BAŞLATILDI!</b>\nHafta içi NY 10:30")
    while True:
        try:
            from datetime import timezone as tz
            w=(get_next_run_utc()-datetime.now(tz.utc)).total_seconds()
            if w<0 or w>90000: w=3600
            await asyncio.sleep(w)
            await scan()
        except Exception as e:
            logging.error(f"Döngü: {e}"); await send_tg(f"🚨 {e}"); await asyncio.sleep(3600)

if __name__ == "__main__":
    if os.name=='nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    if "--oneshot" in sys.argv:
        print("🚀 BOGA AI v222 (One-Shot)")
        asyncio.run(scan()); print("✅ Tamamlandı.")
    else:
        try: asyncio.run(run_scanner())
        except KeyboardInterrupt: print("\nv221 durduruldu.")
        except Exception as e: print(f"Kritik: {e}")
