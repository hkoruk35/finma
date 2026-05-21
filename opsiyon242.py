"""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🚀 BOGA AI v242 — SEKTÖR ÖNCE + GERÇEK BACKTESTING                      ║
║   "Sektör → Lider → Sıkışma → Hacim → Flow → Doğru Kontrat"               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  v242 — v240'dan devralınan mimari (5 KRİTİK DEĞİŞİKLİK korunuyor):       ║
║                                                                              ║
║  1. SEKTÖR ÖNCE pipeline  ← en büyük değişiklik                            ║
║     ETF taraması önce (6 ETF, 10 saniye) →                                 ║
║     en güçlü 2 sektör seçilir → sadece o sektörün                          ║
║     hisseleri taranır (500 → 40-60 hisse)                                  ║
║     Tarama süresi: 30 dakika → 3-5 dakika                                  ║
║                                                                              ║
║  2. GAMMA / THETA ORANI  ← kontrat kalite metriği                          ║
║     gamma / (ask × |theta_günlük|)                                         ║
║     Ödediğin theta karşılığında aldığın gamma oranı                        ║
║     Contract Scoring'e %30 ağırlıkla dahil                                 ║
║                                                                              ║
║  3. EARNINGS HARD BLOCK  ← IV crush koruması                               ║
║     earnings < 14 gün = tamamen listeden çıkar                             ║
║     Earnings 14-21 gün = -8 puan ceza + uyarı rozeti                      ║
║                                                                              ║
║  4. DTE 7-55 — setup tipine göre dinamik  ← günlük swing                  ║
║     NR7 + sıkışma + RVOL güçlü  → 7-14g                                   ║
║     EMA breakout / golden cross  → 14-21g                                  ║
║     Trend pullback / EMA50 sekme → 21-35g                                  ║
║     Steady / belirsiz setup      → 35-55g                                  ║
║                                                                              ║
║  5. BACKTESTING  ← gerçek sonuç takibi                                     ║
║     fill_backtest_results() her tarama sonrası çalışır                     ║
║     Son 30 pick için yfinance'ten gerçek fiyat çeker                       ║
║     peak_pct, hit_40pct, time_to_peak hesaplar                             ║
║     Raporda win rate ve ortalama return gösterilir                         ║
║                                                                              ║
║  SEKTÖR EVREN HARİTASI (SECTOR_STOCKS sabit liste):                        ║
║    SMH  → 25 semi hissesi (NVDA AVGO AMD MU ASML ...)                      ║
║    XLK  → 20 tech hissesi (MSFT AAPL GOOGL META ...)                       ║
║    XLC  → 15 comm hissesi (NFLX COIN DIS ROKU ...)                         ║
║    XLV  → 15 health hissesi (LLY UNH ABBV MRK ...)                        ║
║    XLE  → 12 energy hissesi (XOM CVX OXY SLB ...)                          ║
║    XLF  → 15 finans hissesi (JPM GS MS BAC ...)                            ║
║    ARKK → 15 innovation hissesi (TSLA PLTR COIN ...)                       ║
║                                                                              ║
║  PUANLAMA:                                                                  ║
║    S4 RS + Momentum          : 0-35  ← ANA MOTOR                          ║
║    S3 Sektör (dinamik)       : 0-15  ← sektör ETF RS bağlı                ║
║    EMA Zamanlaması           : 0-20  ← DOĞRULAMA                          ║
║    S5 Sıkışma (NR7/BB)       : 0-15  ← BONUS                              ║
║    S7 Hacim Ateşleme         : 0-10  ← BONUS                              ║
║    S8 Options Flow           : 0-10  ← BONUS                              ║
║    IV Context                : 0-10                                        ║
║    MTF RSI                   : 0-10  ← BONUS                              ║
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
AVG_VOL_MIN    = 1_000_000   # Likit opsiyon tahtaları için minimum 1 milyon lot günlük hacim
DOLLAR_VOL_MIN = 1_000_000   # Sığ tahtalardan (Penny stock davranışından) tam koruma

# ── Stage 4: RS eşikleri ──────────────────────────────────────────────────
RS_60D_MIN  = -15.0
RS_20D_MIN  = -15.0
RS_5D_MIN   = -10.0
ROC5_MIN    = -8.0

# ── KURUMSAL HİBRİD SİSTEM PARAMETRELERİ (YENİLENDİ) ────────────────────────
DTE_MAX      = 60
DTE_HARD_MIN = 10  # Katalizör ve event-driven için mutlak taban 10g yapıldı.

EARNINGS_HARD_BLOCK_DAYS = 14
EARNINGS_WARN_DAYS       = 21

SPREAD_MAX = 0.25  # Aşırı geniş makaslı kumar kontratları elendi.
MID_MIN    = 0.05
OI_MIN     = 50    # Minimum likidite tabanı.

# ── SETUP BAZLI DİNAMİK DELTA VE DTE MİMARİSİ ──
# [Setup Tipi] -> (Min_Delta, Max_Delta, Min_DTE, Max_DTE)
SETUP_RULES = {
    "NR7_KRITIK":   (0.40, 0.55, 14, 21),  # Erken momentum ve asimetrik convexity yakalama
    "BB_SIKIŞ":     (0.40, 0.55, 14, 21),
    "EMA_BREAKOUT": (0.45, 0.60, 21, 30),  # Dengeli momentum kırılımı
    "TREND":        (0.55, 0.70, 30, 45),  # Trend continuation - Intrinsic ağırlıklı delta
    "MEAN_REVERSION":(0.60, 0.75, 30, 45),  # Derin ITM koruması
    "EVENT_DRIVEN": (0.45, 0.60, 10, 21),  # Katalizör, haber ve post-earnings ivmesi
    "HAFIF":        (0.50, 0.65, 30, 60)   # Varsayılan korumalı swing
}

# ── DİNAMİK GAMMA/THETA EŞİK MODELİ ──
def get_dynamic_gt_threshold() -> float:
    regime = MARKET_REGIME.get("regime", "neutral")
    vix    = MARKET_VIX.get("value", 20.0)
    if regime == "bull" and vix < 18:
        return 0.9  # Boğa piyasası: Convexity geçişine izin ver
    elif regime == "neutral" or (18 <= vix <= 24):
        return 1.1  # Dengeli / Nötr piyasa eleği
    else:
        return 1.3  # Ayı piyasası / Volatiliteli koruma: Sadece yüksek verimli kontratlar

# Notional sweep
NOTIONAL_SWEEP_MIN = 100_000
NOTIONAL_BLOCK_MIN = 500_000

# MM Trap
EM_ATR_MAX_RATIO = 3.5
CALL_WALL_OI_MIN = 8_000

# Exit (BOGA Sniper Hedefleri)
TAKE_PROFIT_PCT = 0.50  # %50 Sabit Opsiyon TP Hedefi
STOP_LOSS_PCT   = 0.35  # %35 Acil Durum Kontrat Devre Kesici Stopu
TIME_STOP_RATIO = 0.40  # DTE bazlı zaman stopu oranı

SEMAPHORE_N = 2
ADX_MIN     = 10

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
    "ARKK": "Technology",   # Innovation / growth proxy
}

# ════════════════════════════════════════════════════════════════════════════
# 🗺️  SEKTÖR EVREN HARİTASI — Sektör-önce pipeline'ın kalbi
#     Her ETF için o sektörün en likit, opsiyon-uygun hisselerinin listesi.
#     Bu liste taranan evreni 500+ → 40-60'a indirir.
# ════════════════════════════════════════════════════════════════════════════

SECTOR_STOCKS: Dict[str, List[str]] = {
    "SMH": [  # Semiconductors
        "NVDA", "AVGO", "AMD", "MU", "ASML", "QCOM", "AMAT", "LRCX", "KLAC",
        "MRVL", "ON", "TXN", "ADI", "MCHP", "SWKS", "SLAB", "MPWR", "WOLF",
        "SMCI", "ARM", "TSM", "INTC", "NXPI", "STM", "AMBA",
    ],
    "XLK": [  # Technology
        "MSFT", "AAPL", "GOOGL", "META", "CRM", "NOW", "ADBE", "ORCL",
        "SNOW", "PLTR", "DDOG", "MDB", "ZS", "CRWD", "PANW", "FTNT",
        "NET", "HUBS", "TWLO", "PATH",
    ],
    "XLC": [  # Communication Services
        "NFLX", "DIS", "ROKU", "SPOT", "SNAP", "PINS", "RDDT",
        "PARA", "WBD", "TMUS", "T", "VZ", "CHTR", "LUMN",
        "COIN",  # crypto / fintech hybrid
    ],
    "XLV": [  # Health Care
        "LLY", "UNH", "ABBV", "MRK", "JNJ", "PFE", "AMGN",
        "GILD", "REGN", "VRTX", "BIIB", "BMY", "CVS", "HUM",
        "MRNA",
    ],
    "XLE": [  # Energy
        "XOM", "CVX", "OXY", "SLB", "EOG", "PXD", "COP",
        "MPC", "PSX", "VLO", "HAL", "BKR",
    ],
    "XLF": [  # Financials
        "JPM", "GS", "MS", "BAC", "WFC", "C", "AXP",
        "BLK", "SCHW", "IBKR", "HOOD", "SOFI", "NU", "PYPL",
        "SQ",
    ],
    "ARKK": [  # Innovation / high-beta
        "TSLA", "ROKU", "COIN", "SHOP", "MSTR", "PLTR", "EXAS",
        "PATH", "TWLO", "U", "RBLX", "AFRM", "UPST", "HOOD",
        "IONQ",
    ],
}

# Tarama modu
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
MARKET_VIX:              Dict[str, Any] = {"value": 18.0, "regime": "Orta 🟡"}
SPY_RETURN_CACHE:        Dict[str, Any] = {"ts": 0.0, "r60": 0.0, "r20": 0.0, "r5": 0.0}
SECTOR_ETF_CACHE:        Dict[str, Any] = {}   # ETF adı → {rs_5, rs_10, rs_20, rank}
MARKET_REGIME:           Dict[str, Any] = {"regime": "bull", "score": 50, "qqq_5d": 0.0}
MARKET_OPEN_AT_SCAN:     bool           = False
ACTIVE_SECTORS:          List[str]      = []   # Sektör-önce: seçilen ETF'ler

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
# 2) STAGE 0 — MARKET REJİM + SEKTÖR ETF TARAMASI
#    *** DEĞİŞİKLİK 1: Sektör-önce pipeline buradan başlar ***
#    ETF RS hesabı → en güçlü 2 sektör → sadece onlar taranır
# ════════════════════════════════════════════════════════════════════════════

async def update_market_data():
    """VIX, SPY, QQQ, tüm sektör ETF'lerini güncelle."""
    now = time.time()
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

    # SPY referans
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("SPY").history(period="100d"))
        if df is not None and len(df) >= 65:
            c = df['Close'].astype(float)
            SPY_RETURN_CACHE.update({
                "ts": now,
                "r60": float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100),
                "r20": float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100),
                "r5":  float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6 else 0.0,
            })
    except: pass

    # QQQ → piyasa rejimi
    try:
        df = await asyncio.to_thread(lambda: yf.Ticker("QQQ").history(period="60d"))
        if df is not None and len(df) >= 22:
            c   = df['Close'].astype(float)
            q5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
            q20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            vix = MARKET_VIX.get("value", 20.0)
            ema20_qqq = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])
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

    # SPY gap tespiti — dünün kapanışı vs bugünün açılışı
    # Günlük swing için kritik: gap up = trend güçlü, gap down = dikkat
    try:
        df_spy = await asyncio.to_thread(
            lambda: yf.Ticker("SPY").history(period="5d", interval="1d")
        )
        if df_spy is not None and len(df_spy) >= 2:
            prev_close = float(df_spy['Close'].iloc[-2])
            today_open = float(df_spy['Open'].iloc[-1])
            gap_pct    = (today_open - prev_close) / prev_close * 100
            MARKET_REGIME["spy_gap_pct"]  = round(gap_pct, 2)
            MARKET_REGIME["spy_gap_up"]   = gap_pct > 0.3     # > %0.3 gap up
            MARKET_REGIME["spy_gap_down"] = gap_pct < -0.3    # < -%0.3 gap down
            MARKET_REGIME["spy_gap_flat"] = abs(gap_pct) <= 0.3
    except:
        MARKET_REGIME.setdefault("spy_gap_pct", 0.0)
        MARKET_REGIME.setdefault("spy_gap_up", False)
        MARKET_REGIME.setdefault("spy_gap_down", False)
        MARKET_REGIME.setdefault("spy_gap_flat", True)

    # *** SEKTÖR ETF RS HESABI (tüm ETF'ler) ***
    spy_r5  = SPY_RETURN_CACHE.get("r5",  0.0)
    spy_r20 = SPY_RETURN_CACHE.get("r20", 0.0)

    for etf in list(SECTOR_ETFS.keys()) + ["IWM", "SMH"]:
        try:
            df = await asyncio.to_thread(lambda t=etf: yf.Ticker(t).history(period="40d"))
            if df is None or len(df) < 10:
                continue
            c   = df['Close'].astype(float)
            r5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
            r10 = float((c.iloc[-1] - c.iloc[-11]) / c.iloc[-11] * 100) if len(c) >= 11 else 0.0
            r20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            rs5  = r5  - spy_r5
            rs20 = r20 - spy_r20
            # Momentum skoru: ağırlıklı composite
            composite = r5 * 0.5 + r10 * 0.3 + rs5 * 0.2
            SECTOR_ETF_CACHE[etf] = {
                "r5": round(r5, 2), "r10": round(r10, 2), "r20": round(r20, 2),
                "rs5": round(rs5, 2), "rs20": round(rs20, 2),
                "composite": round(composite, 2),
            }
            await asyncio.sleep(0.1)
        except: pass


async def select_top_sectors(top_n: int = 2) -> List[str]:
    """
    *** DEĞİŞİKLİK 1: Sektör-önce seçim ***
    Tüm sektör ETF'lerini composite RS skoruna göre sırala,
    en güçlü top_n sektörü döndür.

    VIX > 25 veya bear piyasada top_n = 1 (daha kısıtlı).
    """
    vix     = MARKET_VIX.get("value", 20.0)
    regime  = MARKET_REGIME.get("regime", "neutral")

    if regime == "bear":
        logging.info("Bear piyasa — sektör seçimi atlanıyor")
        return []

    effective_n = 1 if vix > 25 else top_n

    scored = []
    for etf, data in SECTOR_ETF_CACHE.items():
        if etf not in SECTOR_ETFS:
            continue
        composite = data.get("composite", 0.0)
        rs5       = data.get("rs5", 0.0)
        # Negatif RS olan sektör dahil edilmez
        if rs5 < -2.0:
            continue
        scored.append((etf, composite))

    scored.sort(key=lambda x: x[1], reverse=True)
    selected = [etf for etf, _ in scored[:effective_n]]
    logging.info(f"✅ Seçilen sektörler: {selected} (top {effective_n})")
    return selected


def build_sector_universe(active_sectors: List[str]) -> List[str]:
    """
    *** DEĞİŞİKLİK 1: Evren 500+ → 40-60 hisse ***
    Seçilen sektörlerin SECTOR_STOCKS listesini birleştir.
    Tekrar eden hisseler deduplicate edilir.
    """
    universe = []
    seen = set()
    for etf in active_sectors:
        for ticker in SECTOR_STOCKS.get(etf, []):
            if ticker not in seen:
                universe.append(ticker)
                seen.add(ticker)
    return universe


def stage0_market_regime_ok() -> Tuple[bool, dict]:
    """
    Stage 0: Market koşulları işleme uygun mu?
    Günlük swing için 3 temel soru:
      1. VIX < 22 mi?
      2. QQQ > EMA20 mi?
      3. SPY gap durumu nasıl?
    """
    vix         = MARKET_VIX.get("value", 20.0)
    regime      = MARKET_REGIME.get("regime", "neutral")
    score       = MARKET_REGIME.get("score", 50)
    qqq5        = MARKET_REGIME.get("qqq_5d", 0.0)
    qqq_ema20   = MARKET_REGIME.get("qqq_above_ema20", True)
    gap_pct     = MARKET_REGIME.get("spy_gap_pct", 0.0)
    gap_up      = MARKET_REGIME.get("spy_gap_up",   False)
    gap_down    = MARKET_REGIME.get("spy_gap_down", False)
    gap_flat    = MARKET_REGIME.get("spy_gap_flat",  True)

    issues = []

    # Soru 1: VIX < 22?
    if vix > 22:
        issues.append(
            f"VIX > 22 ({vix:.1f}) — opsiyon alma, sadece izle"
            if vix <= 30 else
            f"VIX çok yüksek ({vix:.1f}) — piyasa panik modunda"
        )

    # Soru 2: QQQ > EMA20?
    if not qqq_ema20:
        issues.append("QQQ EMA20 altında — trend bozuk, dikkatli ol")

    # Soru 3: SPY gap durumu
    if gap_down:
        issues.append(
            f"SPY gap DOWN ({gap_pct:+.2f}%) — açılışa dikkat, confirmation bekle"
        )

    # SPY gap durumu etiketi
    if gap_up:
        gap_label   = f"⬆️ GAP UP {gap_pct:+.2f}% — trend güçlü, momentum açılışı"
        gap_trading = "LONG_BIAS"
    elif gap_down:
        gap_label   = f"⬇️ GAP DOWN {gap_pct:+.2f}% — açılışta confirmation bekle"
        gap_trading = "CAUTION"
    else:
        gap_label   = f"➡️ FLAT OPEN {gap_pct:+.2f}% — normal seans beklentisi"
        gap_trading = "NEUTRAL"

    # Özet karar: VIX > 22 veya QQQ EMA20 altı → opsiyon alma
    swing_ok = vix <= 22 and qqq_ema20
    ok       = regime != "bear" and vix < 35

    return ok, {
        "regime": regime, "score": score,
        "vix": round(vix, 1),
        "qqq_5d": qqq5,
        "qqq_above_ema20": qqq_ema20,
        "spy_gap_pct": gap_pct,
        "spy_gap_label": gap_label,
        "spy_gap_trading": gap_trading,
        "swing_ok": swing_ok,   # Günlük swing için net karar
        "issues": issues,
        "label": (
            "🟢 GÜÇLÜ BOĞA" if score >= 75 else
            "🟢 BOĞA"       if score >= 65 else
            "🟡 NÖTR"       if score >= 40 else
            "🔴 AYICI"
        ),
        "swing_verdict": (
            "✅ SWING UYGUN — VIX düşük, QQQ trend içinde" if swing_ok and not gap_down
            else "⚠️ SWING DİKKATLİ — gap down, açılış confirmation bekle" if swing_ok and gap_down
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


def bs_pnl_sim(S, K, iv, dte, move_pct=0.07, days_fwd=3):
    T_now  = dte / 365.0
    T_fwd  = max((dte - days_fwd) / 365.0, 0.001)
    iv_fwd = iv * (0.88 if dte <= 21 else 0.93)
    p_now  = bs_price(S, K, T_now, 0.05, iv)
    p_fwd  = bs_price(S * (1 + move_pct), K, T_fwd, 0.05, iv_fwd)
    return {
        "price_now": round(p_now, 2), "price_fwd": round(p_fwd, 2),
        "pnl_pct":   round((p_fwd - p_now) / p_now * 100, 1) if p_now > 0 else 0.0,
        "days_fwd":  days_fwd
    }


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
# 4) MTF RSI — Dead cat bounce koruması
# ════════════════════════════════════════════════════════════════════════════

async def fetch_1h_data(ticker: str) -> Optional[pd.DataFrame]:
    try:
        df = await asyncio.wait_for(asyncio.to_thread(
            lambda: yf.Ticker(ticker).history(period="10d", interval="1h", auto_adjust=True)
        ), timeout=20)
        if df is None or len(df) < 10: return None
        df.columns = [str(c).strip().title() for c in df.columns]
        return df
    except: return None

async def fetch_15m_data(ticker: str) -> Optional[pd.DataFrame]:
    """BlueOne Global Analytics — 15 Dakikalık Mikro Momentum Veri Sağlayıcı"""
    try:
        df = await asyncio.wait_for(asyncio.to_thread(
            lambda: yf.Ticker(ticker).history(period="5d", interval="15m", auto_adjust=True)
        ), timeout=20)
        if df is None or len(df) < 15: return None
        df.columns = [str(c).strip().title() for c in df.columns]
        return df
    except: return None


def validate_intraday_price_volume_correlation(df_15m: Optional[pd.DataFrame], df_1h: Optional[pd.DataFrame]) -> Tuple[bool, dict]:
    """
    BlueOne Global Analytics — Multi-Timeframe Fiyat-Hacim İvme Dengesi Kontrolü.
    15m (Son 8 mum) ve 1h (Son 4-8 mum) zaman dilimlerindeki kurumsal emilimi (Absorption) ölçer.
    """
    metrics = {"score_15m": 0.0, "score_1h": 0.0, "verdict": "NÖTR", "total_bonus": 0.0}

    # 1. 15 Dakikalık Zaman Dilimi Analizi (Son 8 Mum = 2 Saatlik Mikro Yapı)
    if df_15m is not None and len(df_15m) >= 8:
        d_15m = df_15m.tail(8).copy()
        c_15m = d_15m['Close'].astype(float).values
        o_15m = d_15m['Open'].astype(float).values
        v_15m = d_15m['Volume'].astype(float).values

        # Fiyat yönü ile hacim çarpımı (İvme İndeksi)
        pos_vol, neg_vol = 0.0, 0.0
        for i in range(1, len(c_15m)):
            price_change = (c_15m[i] - c_15m[i-1]) / c_15m[i-1]
            # Boğa mumları veya yukarı kırılım hacim emilimi
            if price_change > 0 or c_15m[i] > o_15m[i]:
                pos_vol += v_15m[i] * (1 + max(0, price_change * 100))
            else:
                neg_vol += v_15m[i] * (1 + max(0, abs(price_change) * 100))

        # Son 8 msal barın hacim trend eğimi
        v_mean_first = v_15m[:4].mean() if v_15m[:4].mean() > 0 else 1.0
        v_mean_last = v_15m[4:].mean()
        vol_slope_15m = v_mean_last / v_mean_first

        if pos_vol > neg_vol * 1.3 and vol_slope_15m > 1.2:
            metrics["score_15m"] = 5.0  # Mikro hacimli akış güçlü
        elif pos_vol < neg_vol * 1.1:
            metrics["score_15m"] = -3.0 # Dağıtım veya hacimli kusma var

        metrics["vol_slope_15m"] = round(vol_slope_15m, 2)

    # 2. 1 Saatlik Zaman Dilimi Analizi (Son 6 Mum = Kurumsal Onay)
    if df_1h is not None and len(df_1h) >= 6:
        d_1h = df_1h.tail(6).copy()
        c_1h = d_1h['Close'].astype(float).values
        v_1h = d_1h['Volume'].astype(float).values

        # Spearman-benzeri Fiyat-Hacim Korelasyon Eğimi
        price_direction = np.diff(c_1h)
        vol_direction = np.diff(v_1h)

        # Fiyat artarken hacmin artması, fiyat düşerken hacmin düşmesi durumu (Sağlıklı Trend)
        concordant = sum(1 for p, v in zip(price_direction, vol_direction) if (p > 0 and v > 0) or (p < 0 and v < 0))

        v_avg_long = df_1h['Volume'].tail(24).mean() if df_1h['Volume'].tail(24).mean() > 0 else 1.0
        current_v_1h = v_1h[-1]
        rvol_1h = current_v_1h / v_avg_long

        if concordant >= 4 and rvol_1h > 1.2:
            metrics["score_1h"] = 5.0
        elif concordant <= 1 and c_1h[-1] < c_1h[0]:
            metrics["score_1h"] = -4.0 # Hacimli ayı uyumsuzluğu

        metrics["rvol_1h"] = round(rvol_1h, 2)
        metrics["concordant_bars"] = concordant

    # 3. Nihai Karar Matrisi ve Denge Filtresi
    total_score = metrics["score_15m"] + metrics["score_1h"]
    metrics["total_bonus"] = total_score

    # Eğer iki timeframe birbirini reddediyorsa (Örn: 15m sahte ralli ama 1h mal boşaltma)
    if metrics["score_15m"] < 0 or metrics["score_1h"] < 0:
        return False, metrics  # Yapı dengesiz, hisseyi eliyoruz.

    if total_score >= 8.0:
        metrics["verdict"] = "🔥 KURUMSAL AKÜMÜLASYON (15m/1h Tam Uyum)"
    elif total_score >= 4.0:
        metrics["verdict"] = "✅ POZİTİF İÇ HACİM"

    return True, metrics

def check_mtf_rsi_alignment(df_1d: pd.DataFrame, df_1h: Optional[pd.DataFrame],
                              market_open: bool = True) -> Tuple[bool, dict]:
    try:
        c_1d  = df_1d['Close'].astype(float)
        h_1d  = df_1d['High'].astype(float)
        lo_1d = df_1d['Low'].astype(float)
        cp    = float(c_1d.iloc[-1])

        e20  = float(EMAIndicator(c_1d, 20).ema_indicator().iloc[-1])
        e50  = float(EMAIndicator(c_1d, 50).ema_indicator().iloc[-1])
        e200 = float(EMAIndicator(c_1d, 200).ema_indicator().iloc[-1])
    except Exception as e:
        return False, {"block_reason": f"EMA calculation error: {e}"}

    # ── ATR-NORMALIZED EXTENSION (EXHAUSTION PROTECTION) ──
    try:
        atr_s_1d = AverageTrueRange(df_1d['High'].astype(float), df_1d['Low'].astype(float), c_1d, 14).average_true_range()
        current_atr = float(atr_s_1d.iloc[-1]) if not atr_s_1d.empty else cp * 0.02

        if current_atr > 0:
            extension_score = (cp - e20) / current_atr
            if extension_score > 3.5:
                return False, {"block_reason": f"Exhaustion: Fiyat EMA20'den çok uzakta ({extension_score:.2f} ATR)"}
    except Exception as ext_err:
        logging.debug(f"Extension filter error: {ext_err}")

    if cp > e50 > e200:         trend_1d = "Macro Bullish"
    elif cp > e20 > e50 > e200: trend_1d = "Upward"
    elif cp > e200:             trend_1d = "Above EMA200"
    elif cp > e50:              trend_1d = "Above EMA50"
    else:                       trend_1d = "Downtrend"

    if trend_1d == "Downtrend":
        return False, {"block_reason": "1D Downtrend (EMA200 altı)"}

    ret_5d = 0.0
    if len(c_1d) >= 6:
        ret_5d = (cp - float(c_1d.iloc[-6])) / float(c_1d.iloc[-6]) * 100
        if ret_5d < -3.5:
            return False, {"block_reason": f"5G kanama: {ret_5d:.1f}%"}

    rsi_1d_s  = RSIIndicator(c_1d, 14).rsi()
    rsi_1d    = float(rsi_1d_s.iloc[-1])
    rsi_1d_p1 = float(rsi_1d_s.iloc[-2]) if len(rsi_1d_s) >= 2 else rsi_1d
    rsi_1d_p3 = float(rsi_1d_s.iloc[-4]) if len(rsi_1d_s) >= 4 else rsi_1d
    rsi_1d_p5 = float(rsi_1d_s.iloc[-6]) if len(rsi_1d_s) >= 6 else rsi_1d
    rsi_1d_slope5 = rsi_1d - rsi_1d_p5

    rsi_min = 42 if not market_open else 45
    rsi_fall_warn = 50 if not market_open else 52

    if rsi_1d < rsi_min:
        return False, {"block_reason": f"1D RSI düşük: {rsi_1d:.1f}"}
    if rsi_1d < 45 and rsi_1d < rsi_1d_p1:
        return False, {"block_reason": f"Falling knife: RSI {rsi_1d:.1f}"}
    if (rsi_1d < rsi_1d_p1 < rsi_1d_p3) and rsi_1d < rsi_fall_warn:
        return False, {"block_reason": f"RSI 3g düşüyor: {rsi_1d:.1f}"}
    if rsi_1d > 82:
        return False, {"block_reason": f"1D RSI aşırı alım: {rsi_1d:.1f}"}

    rsi_1h = 55.0; rsi_1h_slope = 0.0; adx_1h = 0.0
    ema20_1h_ok = True; rsi_1h_lbl = "1H Veri Yok"

    if df_1h is not None and len(df_1h) >= 14:
        c_1h = df_1h['Close'].astype(float)
        try:
            rsi_1h_s   = RSIIndicator(c_1h, 14).rsi()
            rsi_1h     = float(rsi_1h_s.iloc[-1])
            rsi_1h_p3  = float(rsi_1h_s.iloc[-4]) if len(rsi_1h_s) >= 4 else rsi_1h
            rsi_1h_slope = rsi_1h - rsi_1h_p3
        except: pass

        try:
            adx_1h = float(ADXIndicator(df_1h['High'], df_1h['Low'], c_1h, 14).adx().iloc[-1])
        except: pass

        try:
            e20_1h = float(EMAIndicator(c_1h, 20).ema_indicator().iloc[-1])
            ema20_1h_ok = float(c_1h.iloc[-1]) >= e20_1h * 0.98
        except: pass

        if market_open:
            if rsi_1h < 40:
                return False, {"block_reason": f"1H RSI düşük: {rsi_1h:.1f}"}
            if rsi_1h > 82:
                return False, {"block_reason": f"1H RSI FOMO: {rsi_1h:.1f}"}
            if rsi_1d_slope5 < -4 and rsi_1h_slope < -4:
                return False, {"block_reason": "DUAL-TF düşüş — ölü kedi!"}
        else:
            if rsi_1h < 35:
                return False, {"block_reason": f"1H RSI çok düşük (kapalı): {rsi_1h:.1f}"}
            if rsi_1d_slope5 < -6:
                return False, {"block_reason": f"1D RSI sert düşüş: {rsi_1d_slope5:.1f}"}

        rsi_1h_lbl = f"{rsi_1h:.1f}"

    steady_momentum = False
    if len(c_1d) >= 5:
        c5 = c_1d.tail(5).values
        ret_1d = ((float(c_1d.iloc[-1]) - float(c_1d.iloc[-2])) /
                  float(c_1d.iloc[-2]) * 100) if len(c_1d) >= 2 else 0.0
        steady_momentum = (all(c5[i] >= c5[i - 1] * 0.99 for i in range(1, 5)) and
                           c5[-1] > c5[0] and ret_1d < 5.0)

    hh_hl = False
    if len(h_1d) >= 5 and len(lo_1d) >= 5:
        hh_hl = (float(h_1d.iloc[-1]) > float(h_1d.iloc[-5]) and
                 float(lo_1d.iloc[-1]) > float(lo_1d.iloc[-5]))

    return True, {
            "rsi_1d": round(rsi_1d, 1), "rsi_1d_slope5": round(rsi_1d_slope5, 1),
            "rsi_1h": rsi_1h_lbl, "rsi_1h_val": round(rsi_1h, 1),
            "rsi_1h_slope": round(rsi_1h_slope, 1), "adx_1h": round(adx_1h, 1),
            "ema20_1h_ok": ema20_1h_ok, "trend_1d": trend_1d,
            "steady_momentum": steady_momentum, "hh_hl": hh_hl, "ret_5d": round(ret_5d, 2),
            "rsi_alignment": (
                "🔥 MÜKEMMEL" if rsi_1d >= 55 and rsi_1h >= 55 and rsi_1d_slope5 > 2 and rsi_1h_slope > 2
                else "✅ İYİ" if rsi_1d >= 50 and rsi_1h >= 50 else "🟡 ORTA"
            ),
        }


# ════════════════════════════════════════════════════════════════════════════
# 5) STAGE 3 — SEKTÖR SKORU (ETF RS'e bağlı, dinamik)
# ════════════════════════════════════════════════════════════════════════════

async def get_sector(ticker: str) -> str:
    try:
        info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
        return info.get("sector", "") or info.get("industry", "")
    except: return ""


def stage3_sector_score(etf: str) -> Tuple[float, dict]:
    """
    Sektör skoru artık hisseden değil, o hissenin ait olduğu ETF'in
    güncel RS performansından hesaplanır. (0-15)
    """
    data = SECTOR_ETF_CACHE.get(etf, {})
    rs5  = data.get("rs5", 0.0)
    rs20 = data.get("rs20", 0.0)
    comp = data.get("composite", 0.0)

    # Base sektör puanı
    sector_name = SECTOR_ETFS.get(etf, "")
    base = 5.0
    for k, pts in HOT_SECTORS.items():
        if k.lower() in sector_name.lower():
            base = min(pts / 15.0 * 10.0, 10.0); break

    # ETF RS bonusu
    if rs5 > 4:    base = min(base + 5.0, 15.0)
    elif rs5 > 2:  base = min(base + 3.0, 15.0)
    elif rs5 > 0:  base = min(base + 1.5, 15.0)
    elif rs5 < -2: base = max(base - 4.0, 0.0)

    return round(base, 1), {
        "etf": etf, "sector_name": sector_name,
        "rs5": rs5, "rs20": rs20, "composite": comp,
    }


# ════════════════════════════════════════════════════════════════════════════
# 6) STAGE 4 — RÖLATIF GÜÇ LİDERİ (ANA MOTOR)
# ════════════════════════════════════════════════════════════════════════════

def stage4_relative_strength(df: pd.DataFrame) -> Tuple[bool, dict]:
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 65: return False, {}

        cp = float(c.iloc[-1])

        roc5  = float((c.iloc[-1] - c.iloc[-6])  / c.iloc[-6]  * 100) if len(c) >= 6  else 0.0
        roc20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
        roc60 = float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100) if len(c) >= 61 else 0.0

        spy_r60 = SPY_RETURN_CACHE.get("r60", 0.0)
        spy_r20 = SPY_RETURN_CACHE.get("r20", 0.0)
        spy_r5  = SPY_RETURN_CACHE.get("r5",  0.0)

        rs_60 = roc60 - spy_r60
        rs_20 = roc20 - spy_r20
        rs_5  = roc5  - spy_r5

        c5 = c.tail(5).values if len(c) >= 5 else []
        steady_trend = (len(c5) == 5 and
                        all(c5[i] >= c5[i - 1] * 0.995 for i in range(1, 5)) and
                        c5[-1] > c5[0])

        if rs_60 < RS_60D_MIN: return False, {}
        if rs_20 < RS_20D_MIN:
            if not (steady_trend and rs_60 >= 5.0): return False, {}
        if roc5 < ROC5_MIN:
            if not steady_trend: return False, {}

        if rs_60 >= 20:   rs_score = 20.0
        elif rs_60 >= 12: rs_score = 17.0
        elif rs_60 >= 8:  rs_score = 14.0
        elif rs_60 >= 5:  rs_score = 11.0
        elif rs_60 >= 3:  rs_score = 8.0
        else:             rs_score = 5.0

        if rs_20 >= 5:   rs_score = min(rs_score + 4.0, 20.0)
        elif rs_20 >= 2: rs_score = min(rs_score + 2.0, 20.0)
        if rs_5 > 2:     rs_score = min(rs_score + 2.0, 20.0)

        mom_score = 0.0
        hh_1 = float(c.iloc[-1])  > float(c.iloc[-5])
        hh_2 = float(c.iloc[-5])  > float(c.iloc[-10])
        hh_3 = float(c.iloc[-10]) > float(c.iloc[-20])

        if hh_1 and hh_2 and hh_3: mom_score += 8.0
        elif hh_1 and hh_2:        mom_score += 5.0
        elif hh_1:                 mom_score += 2.0

        if roc5 > 0 and roc5 > abs(roc20) * 0.3: mom_score += 4.0

        high_60  = float(c.tail(60).max())
        dist_60h = (cp - high_60) / high_60 if high_60 > 0 else -1.0
        if dist_60h >= 0:       mom_score += 3.0
        elif dist_60h >= -0.03: mom_score += 2.0
        elif dist_60h >= -0.08: mom_score += 1.0

        if steady_trend: mom_score += 4.0
        mom_score = min(mom_score, 15.0)

        rsi = float(RSIIndicator(c, 14).rsi().iloc[-1])
        if rsi < 25 or rsi > 90: return False, {}

        v5  = float(vol.tail(5).mean())
        v30 = float(vol.tail(30).mean()) if len(vol) >= 30 else v5
        rvol = v5 / v30 if v30 > 0 else 1.0

        atr_val = float(AverageTrueRange(h, df['Low'].astype(float), c, 14).average_true_range().iloc[-1])
        atr_pct = (atr_val / cp) * 100 if cp > 0 else 2.0
        hv20    = calc_hv(c, 20)

        return True, {
            "rs_60": round(rs_60, 2), "rs_20": round(rs_20, 2), "rs_5": round(rs_5, 2),
            "rs_score": round(rs_score, 1), "mom_score": round(mom_score, 1),
            "roc5": round(roc5, 2), "roc20": round(roc20, 2), "roc60": round(roc60, 2),
            "rsi": round(rsi, 1), "rvol": round(rvol, 2), "vol_ok": rvol >= 0.7,
            "v5": round(v5, 0), "v30": round(v30, 0),
            "high_60": round(high_60, 2), "dist_60h": round(dist_60h * 100, 1),
            "atr_pct": round(atr_pct, 2), "hv20": round(hv20, 4),
            "hh_1": hh_1, "hh_2": hh_2, "hh_3": hh_3, "steady_trend": steady_trend,
        }
    except Exception as e:
        logging.debug(f"Stage4 RS: {e}")
        return False, {}


# ════════════════════════════════════════════════════════════════════════════
# 7) EMA ZAMANLAMASI — Giriş noktası doğrulama
# ════════════════════════════════════════════════════════════════════════════

def ema_timing(df: pd.DataFrame) -> Tuple[bool, dict]:
    try:
        c = df['Close'].astype(float)
        if len(c) < 210: return False, {}

        e9v   = float(EMAIndicator(c, 9).ema_indicator().iloc[-1])
        e20v  = float(EMAIndicator(c, 20).ema_indicator().iloc[-1])
        e50v  = float(EMAIndicator(c, 50).ema_indicator().iloc[-1])
        e200v = float(EMAIndicator(c, 200).ema_indicator().iloc[-1])
        cp    = float(c.iloc[-1])
        prev  = float(c.iloc[-2])

        e20s = EMAIndicator(c, 20).ema_indicator()
        e50s = EMAIndicator(c, 50).ema_indicator()
        prev_e20 = float(e20s.iloc[-2]) if len(e20s) >= 2 else e20v
        prev_e50 = float(e50s.iloc[-2]) if len(e50s) >= 2 else e50v
        e50_slope = (float((e50v - float(e50s.iloc[-6])) / float(e50s.iloc[-6]) * 100)
                     if len(e50s) >= 6 else 0.0)

        golden_cross    = (prev_e20 <= prev_e50) and (e20v > e50v)
        near_golden     = (e20v > e50v) and ((e20v - e50v) / e50v < 0.03)
        ema200_breakout = (prev < e200v) and (cp >= e200v)

        dist_50 = (cp - e50v) / e50v if e50v > 0 else 0.0
        dist_20 = (cp - e20v) / e20v if e20v > 0 else 0.0

        if ema200_breakout:            entry_mode = "EMA200_BREAKOUT"
        elif golden_cross:             entry_mode = "GOLDEN_CROSS"
        elif (e20v > e50v > e200v) and (dist_20 <= 0.08) and near_golden:
                                       entry_mode = "NEAR_GOLDEN"
        elif (e20v > e50v > e200v) and (dist_20 <= 0.08) and e50_slope >= 0:
                                       entry_mode = "TREND_BIRTH"
        elif (e20v > e50v) and (-0.02 <= dist_50 <= 0.04):
                                       entry_mode = "EMA50_PULLBACK"
        elif (cp > e20v > e50v > e200v) and e50_slope >= 0:
                                       entry_mode = "ESTABLISHED_TREND"
        else:
            return False, {}

        if cp < e200v:
            if entry_mode not in ("EMA200_BREAKOUT", "GOLDEN_CROSS"):
                return False, {}
            entry_mode += "_BELOW200"

        adx   = float(ADXIndicator(df['High'], df['Low'], c, 14).adx().iloc[-1])
        early = ("EMA200_BREAKOUT", "EMA200_BREAKOUT_BELOW200", "GOLDEN_CROSS", "GOLDEN_CROSS_BELOW200")
        if adx < (10 if entry_mode in early else ADX_MIN):
            return False, {}

        vwap    = calc_vwap(df)
        vwap_ok = (vwap > 0 and cp >= vwap)

        mode_base = {
            "EMA200_BREAKOUT": 14.0, "GOLDEN_CROSS": 12.0,
            "NEAR_GOLDEN": 10.0,     "TREND_BIRTH": 9.0,
            "EMA50_PULLBACK": 8.0,   "ESTABLISHED_TREND": 7.0,
        }
        ema_score = mode_base.get(entry_mode, 0.0)
        if e20v > e50v:        ema_score += 2.0
        if e50v > e200v:       ema_score += 2.0
        if e9v > e20v:         ema_score += 1.5
        if e50_slope >= 0.3:   ema_score += 2.0
        elif e50_slope >= 0.1: ema_score += 1.0
        if 0.0 <= dist_50 <= 0.03:    ema_score += 3.0
        elif 0.03 < dist_50 <= 0.06:  ema_score += 1.5
        if vwap_ok: ema_score += 1.5
        ema_score = min(ema_score, 20.0)

        return True, {
            "entry_mode": entry_mode, "ema_score": round(ema_score, 1),
            "adx": round(adx, 1), "golden_cross": golden_cross,
            "ema200_breakout": ema200_breakout, "near_golden": near_golden,
            "e50_slope": round(e50_slope, 3),
            "dist_50": round(dist_50 * 100, 2), "dist_20": round(dist_20 * 100, 2),
            "ema9": round(e9v, 3), "ema20": round(e20v, 3),
            "ema50": round(e50v, 3), "ema200": round(e200v, 3),
            "vwap": round(vwap, 3), "vwap_ok": vwap_ok,
            "atr_pct": 0.0,  # analyze() içinde l4'ten doldurulur
            "regime": (
                "breakout" if ema200_breakout else
                ("trend" if adx >= 20 and e20v > e50v > e200v and cp > e200v else "neutral")
            ),
        }
    except Exception as e:
        logging.debug(f"EMA timing: {e}")
        return False, {}


# ════════════════════════════════════════════════════════════════════════════
# 8) STAGE 5 — PRE-EXPLOSION (Coiled Spring)
# ════════════════════════════════════════════════════════════════════════════

def stage5_pre_explosion(df: pd.DataFrame) -> dict:
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 30:
            return {"squeeze_bonus": 0.0, "squeeze_label": "—", "setup_type": "UNKNOWN"}

        bonus = 0.0

        bb  = BollingerBands(c, window=20, window_dev=2)
        bw  = ((bb.bollinger_hband() - bb.bollinger_lband()) / bb.bollinger_mavg()).dropna()
        pct = 50.0
        if not bw.empty:
            cur = float(bw.iloc[-1])
            pct = float((bw.tail(120) < cur).sum() / len(bw.tail(120)) * 100) if len(bw) >= 20 else 50.0
            if pct < 5:    bonus += 5.0
            elif pct < 10: bonus += 3.5
            elif pct < 20: bonus += 2.0
            elif pct < 35: bonus += 0.5

        atr_s = AverageTrueRange(h, lo, c, 14).average_true_range().dropna()
        atr_falling = (len(atr_s) >= 11 and
                       float(atr_s.iloc[-1]) < float(atr_s.iloc[-6]) < float(atr_s.iloc[-11]))
        if atr_falling: bonus += 3.0

        dr  = (h - lo).values
        nr7 = len(dr) >= 7 and dr[-1] == min(dr[-7:])
        nr4 = len(dr) >= 4 and dr[-1] == min(dr[-4:])
        if nr7:   bonus += 4.0
        elif nr4: bonus += 2.5

        icluster = sum(
            1 for i in range(-3, 0)
            if float(h.iloc[i]) <= float(h.iloc[i - 1]) and float(lo.iloc[i]) >= float(lo.iloc[i - 1])
        ) >= 2
        if icluster: bonus += 3.0

        lr  = np.log(c / c.shift(1)).dropna()
        rv5 = float(lr.tail(5).std()  * math.sqrt(252)) if len(lr) >= 5  else 0.3
        rv20= float(lr.tail(20).std() * math.sqrt(252)) if len(lr) >= 20 else 0.3
        if rv5 < rv20 * 0.75: bonus += 2.0

        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        vol_dryup = v5 < v20 * 0.8
        if vol_dryup: bonus += 1.5

        bonus = min(bonus, 15.0)

        # Setup tipi tespiti (DTE seçimi için)
        if nr7 and bonus >= 10:          setup_type = "NR7_KRITIK"
        elif nr7:                        setup_type = "NR7"
        elif pct < 10 and atr_falling:   setup_type = "BB_SIKIŞ"
        elif icluster:                   setup_type = "INSIDE_CLUSTER"
        else:                            setup_type = "HAFIF"

        label = (
            "💥 KRİTİK SIKIŞ" if bonus >= 12 else
            "🔥 GÜÇLÜ SIKIŞ" if bonus >= 8  else
            "🟡 ORTA SIKIŞ"  if bonus >= 4  else
            "📊 HAFİF SIKIŞ" if bonus >= 1  else "—"
        )

        return {
            "squeeze_bonus": round(bonus, 1), "squeeze_label": label,
            "setup_type": setup_type,
            "bb_pct": round(pct, 1), "atr_falling": atr_falling,
            "nr7": nr7, "nr4": nr4, "inside_cluster": icluster, "vol_dryup": vol_dryup,
        }
    except Exception as e:
        logging.debug(f"Stage5: {e}")
        return {"squeeze_bonus": 0.0, "squeeze_label": "—", "setup_type": "UNKNOWN"}


# ════════════════════════════════════════════════════════════════════════════
# 9) STAGE 6 — BREAKOUT YAKINLIĞI
# ════════════════════════════════════════════════════════════════════════════

def stage6_breakout_proximity(df: pd.DataFrame) -> dict:
    try:
        c  = df['Close'].astype(float)
        h  = df['High'].astype(float)
        cp = float(c.iloc[-1])

        high_20  = float(h.tail(20).max())
        high_5   = float(h.tail(5).max())
        dist_20h = (cp - high_20) / high_20 * 100 if high_20 > 0 else -10.0
        dist_5h  = (cp - high_5)  / high_5  * 100 if high_5  > 0 else -10.0

        near_breakout = dist_20h >= -3.0
        above_5d_high = dist_5h  >= 0.0

        vwap         = calc_vwap(df)
        vwap_reclaim = (vwap > 0 and cp >= vwap)

        tight_handle = False
        if len(h) >= 3 and len(c) >= 3:
            recent_range = float(h.tail(3).max()) - float(c.tail(3).min())
            avg_range    = float((h - c).tail(20).abs().mean()) if len(h) >= 20 else recent_range
            tight_handle = recent_range < avg_range * 0.6

        proximity_bonus = 0.0
        if near_breakout: proximity_bonus += 3.0
        if above_5d_high: proximity_bonus += 2.0
        if vwap_reclaim:  proximity_bonus += 2.0
        if tight_handle:  proximity_bonus += 1.5

        return {
            "dist_20h": round(dist_20h, 2), "dist_5h": round(dist_5h, 2),
            "near_breakout": near_breakout, "above_5d_high": above_5d_high,
            "vwap_reclaim": vwap_reclaim, "tight_handle": tight_handle,
            "proximity_bonus": round(proximity_bonus, 1),
        }
    except Exception as e:
        logging.debug(f"Stage6: {e}")
        return {"proximity_bonus": 0.0, "near_breakout": False}


# ════════════════════════════════════════════════════════════════════════════
# 10) STAGE 7 — HACİM ATEŞLEMESİ
# ════════════════════════════════════════════════════════════════════════════

def stage7_volume_ignition(df: pd.DataFrame) -> dict:
    try:
        c   = df['Close'].astype(float)
        h   = df['High'].astype(float)
        lo  = df['Low'].astype(float)
        vol = df['Volume'].astype(float)

        v5  = float(vol.tail(5).mean())
        v20 = float(vol.tail(20).mean()) if len(vol) >= 20 else v5
        v30 = float(vol.tail(30).mean()) if len(vol) >= 30 else v5
        rvol_20 = v5 / v20 if v20 > 0 else 1.0
        rvol_30 = v5 / v30 if v30 > 0 else 1.0

        today_vol  = float(vol.iloc[-1])
        today_rvol = today_vol / v20 if v20 > 0 else 1.0

        atr_s   = AverageTrueRange(h, lo, c, 14).average_true_range().dropna()
        atr_val = float(atr_s.iloc[-1]) if not atr_s.empty else float(c.iloc[-1]) * 0.02
        today_range = float(h.iloc[-1]) - float(lo.iloc[-1])
        drive_ratio = today_range / atr_val if atr_val > 0 else 1.0

        acc_days = 0
        for i in range(-5, 0):
            try:
                day_range = float(h.iloc[i]) - float(lo.iloc[i])
                if day_range > 0:
                    close_pos = (float(c.iloc[i]) - float(lo.iloc[i])) / day_range
                    if close_pos > 0.65: acc_days += 1
            except: pass

        bonus = 0.0
        if rvol_20 >= 2.5:   bonus += 5.0
        elif rvol_20 >= 1.8: bonus += 3.5
        elif rvol_20 >= 1.3: bonus += 2.0
        elif rvol_20 >= 1.1: bonus += 1.0

        if today_rvol >= 3.0:   bonus += 3.0
        elif today_rvol >= 2.0: bonus += 2.0
        elif today_rvol >= 1.5: bonus += 1.0

        if drive_ratio >= 2.0:   bonus += 2.0
        elif drive_ratio >= 1.5: bonus += 1.0

        if acc_days >= 4: bonus += 2.0
        elif acc_days >= 2: bonus += 1.0

        bonus = min(bonus, 10.0)

        return {
            "vol_bonus": round(bonus, 1),
            "vol_label": (
                "🔥 HACİM PATLAMASI" if bonus >= 8 else
                "📈 GÜÇLÜ RVOL"     if bonus >= 5 else
                "👀 HAFİF İVME"     if bonus >= 2 else "—"
            ),
            "rvol_20": round(rvol_20, 2), "rvol_30": round(rvol_30, 2),
            "today_rvol": round(today_rvol, 2), "drive_ratio": round(drive_ratio, 2),
            "acc_days": acc_days,
        }
    except Exception as e:
        logging.debug(f"Stage7: {e}")
        return {"vol_bonus": 0.0, "vol_label": "—", "rvol_20": 1.0}


# ════════════════════════════════════════════════════════════════════════════
# 11) STAGE 8 — OPSİYON FLOW + EARNINGS HARD BLOCK
#     *** DEĞİŞİKLİK 3: Earnings < 14g = tamamen listeden çıkar ***
# ════════════════════════════════════════════════════════════════════════════

async def stage8_options_flow(ticker: str, cp: float) -> dict:
    result = {
        "flow_bonus": 0.0, "flow_label": "—",
        "sweep_count": 0, "put_call_ratio": 1.0,
        "total_notional": 0.0, "big_block": False,
        "earnings_days": None, "earnings_warning": False,
        "earnings_hard_block": False,   # YENİ
        "repeat_strikes": 0,
    }
    try:
        stock = yf.Ticker(ticker)
        today = date.today()

        # *** EARNINGS HARD BLOCK ***
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
                    result["earnings_hard_block"] = True   # analyze() bunu görünce return None
                    return result
                elif days < EARNINGS_WARN_DAYS:
                    result["earnings_warning"] = True
        except: pass

        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps: return result

        near = sorted(
            [(d, (datetime.strptime(d, "%Y-%m-%d").date() - today).days)
             for d in exps
             if DTE_HARD_MIN <= (datetime.strptime(d, "%Y-%m-%d").date() - today).days <= DTE_MAX],
            key=lambda x: x[1]
        )

        call_vol = 0; put_vol = 0; notional = 0.0; sweeps = 0
        ask_vol  = 0; all_vol = 0
        repeat_strikes: Dict[float, int] = {}

        for exp_d, _ in near:
            try:
                chain = await asyncio.to_thread(lambda e=exp_d: stock.option_chain(e))
                calls = chain.calls.copy() if chain.calls is not None else pd.DataFrame()
                puts  = chain.puts.copy()  if chain.puts  is not None else pd.DataFrame()

                if not calls.empty:
                    for col in ['volume', 'openInterest', 'ask', 'bid', 'impliedVolatility', 'strike']:
                        if col in calls.columns:
                            calls[col] = pd.to_numeric(calls[col], errors='coerce').fillna(0)

                    call_vol += int(calls['volume'].sum())
                    for _, row in calls.iterrows():
                        oi_  = float(row.get('openInterest', 0))
                        vol_ = float(row.get('volume', 0))
                        ask_ = float(row.get('ask', 0))
                        bid_ = float(row.get('bid', 0))
                        s_   = float(row.get('strike', 0))
                        mid_ = (ask_ + bid_) / 2.0
                        not_ = vol_ * mid_ * 100

                        if oi_ > 20 and vol_ > 0 and vol_ / oi_ >= 3.0 and not_ >= NOTIONAL_SWEEP_MIN:
                            sweeps += 1
                            repeat_strikes[s_] = repeat_strikes.get(s_, 0) + 1

                        if s_ > cp * 1.03 and ask_ > 0.5 and vol_ >= 50:
                            notional += not_
                        if vol_ > 0 and ask_ > bid_ * 1.05: ask_vol += int(vol_)
                        all_vol += int(vol_)

                if not puts.empty:
                    puts['volume'] = pd.to_numeric(puts.get('volume', 0), errors='coerce').fillna(0)
                    put_vol += int(puts['volume'].sum())
            except: continue

        result["total_notional"] = round(notional, 0)
        result["sweep_count"]    = sweeps
        result["repeat_strikes"] = sum(1 for v in repeat_strikes.values() if v >= 2)

        pc = put_vol / call_vol if call_vol > 0 else 1.0
        result["put_call_ratio"] = round(pc, 2)

        bonus = 0.0
        if pc < 0.4:   bonus += 3.0
        elif pc < 0.6: bonus += 2.0
        elif pc < 0.8: bonus += 1.0
        elif pc > 1.5: bonus -= 1.0

        if sweeps >= 3:   bonus += 4.0
        elif sweeps >= 2: bonus += 3.0
        elif sweeps >= 1: bonus += 2.0

        if result["repeat_strikes"] >= 2: bonus += 2.0
        elif result["repeat_strikes"] >= 1: bonus += 1.0

        if notional >= NOTIONAL_BLOCK_MIN:
            result["big_block"] = True; bonus += 4.0
        elif notional >= NOTIONAL_SWEEP_MIN:
            result["big_block"] = True; bonus += 2.5

        ask_r = ask_vol / all_vol if all_vol > 0 else 0.5
        if ask_r > 0.75: bonus += 2.0
        elif ask_r > 0.6: bonus += 1.0

        # Earnings 14-21g arası ağır ceza
        if result["earnings_warning"]: bonus -= 8.0

        bonus = max(0.0, min(bonus, 10.0))
        result["flow_bonus"] = round(bonus, 1)
        result["flow_label"] = (
            "🔥 KURUMSAL SWEEP" if bonus >= 7 else
            "📈 POZİTİF AKIŞ"  if bonus >= 4 else
            "👀 HAFİF UOA"     if bonus >= 2 else "—"
        )

    except Exception as e:
        logging.debug(f"Stage8 flow {ticker}: {e}")
    return result


# ════════════════════════════════════════════════════════════════════════════
# 12) STAGE 9 — KONTRAT SEÇİMİ
#     *** DEĞİŞİKLİK 2: Gamma/Theta oranı ***
#     *** DEĞİŞİKLİK 4: DTE 7-55, setup tipine göre dinamik ***
# ════════════════════════════════════════════════════════════════════════════


def calc_gamma_theta_ratio(gamma: float, ask: float, theta: float) -> float:
    """
    *** DEĞİŞİKLİK 2: Gamma/Theta oranı ***
    gamma / (ask × |theta_günlük|)

    Ödediğin theta karşılığında aldığın gamma oranı.
    > 1.0 = verimli kontrat (gamma, theta'yı karşılıyor)
    < 0.5 = verimsiz kontrat (çok theta ödüyorsun)
    """
    theta_daily = abs(theta)  # theta zaten günlük değer
    if ask <= 0 or theta_daily <= 0:
        return 0.0
    return round(gamma / (ask * theta_daily), 3)


async def stage9_contract_selection(ticker: str, cp: float, close: pd.Series,
                                    hv: float, l4: dict, ema: dict,
                                    s5: dict, s8: dict, s7: dict) -> Optional[dict]:
    try:
        stock = yf.Ticker(ticker)
        exps  = await asyncio.to_thread(lambda: stock.options)
        if not exps: return None

        today = date.today()
       
        # Setup tipini ve giriş modunu saptama
        s_type = s5.get("setup_type", "HAFIF")
        entry_m = ema.get("entry_mode", "")
        
        # Kurumsal kurallarla setup anahtarını eşleştirme
        setup_key = "HAFIF"
        if s_type in ("NR7_KRITIK", "NR7"): setup_key = "NR7_KRITIK"
        elif s_type == "BB_SIKIŞ": setup_key = "BB_SIKIŞ"
        elif "BREAKOUT" in entry_m or "GOLDEN_CROSS" in entry_m: setup_key = "EMA_BREAKOUT"
        elif "PULLBACK" in entry_m or "SEKME" in entry_m: setup_key = "TREND"
        elif s8.get("earnings_warning") or s8.get("earnings_days") is not None: setup_key = "EVENT_DRIVEN"
        
        min_delta, max_delta, pref_min, pref_max = SETUP_RULES.get(setup_key, SETUP_RULES["HAFIF"])

        best_result = None
        best_score  = -999.0

        # ── DİNAMİK GAMMA/THETA REJİM THRESHOLD HESABI ──
        regime = MARKET_REGIME.get("regime", "neutral")
        vix_val = MARKET_VIX.get("value", 20.0)
        if regime == "bull" and vix_val < 18:
            gt_threshold = 0.9
        elif regime == "neutral" or (18 <= vix_val <= 24):
            gt_threshold = 1.1
        else:
            gt_threshold = 1.3  # Ayı veya yüksek volatilite rejiminde çöp kontrat filtresi sıkılaşır

        for exp_str in exps:
            try:
                dte = (datetime.strptime(exp_str, "%Y-%m-%d").date() - today).days
                if not (DTE_HARD_MIN <= dte <= DTE_MAX): continue
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

            if iv_rank > 80:
                is_squeeze = s5.get("squeeze_bonus", 0) >= 8
                is_fresh   = ema.get("ema200_breakout", False) or ema.get("golden_cross", False)
                if not (is_squeeze and is_fresh): continue

            em    = cp * atm_iv * math.sqrt(dte / 365.0)
            em_up = cp + em
            mp    = max_pain(calls, puts, cp)

            atr_pct_val = l4.get("atr_pct", 2.0)
            atr_abs     = cp * atr_pct_val / 100.0
            if atr_abs <= 0: atr_abs = cp * 0.02
            if em / atr_abs > EM_ATR_MAX_RATIO: continue

            cw_oi = max(
                (int(row.get('openInterest', 0) or 0) for _, row in calls.iterrows()
                 if cp * 1.02 < float(row.get('strike', 0)) < cp * 1.10),
                default=0
            )
            cw_danger = cw_oi > CALL_WALL_OI_MIN

            dte_bonus = 5.0 if pref_min <= dte <= pref_max else 0.0
            T         = dte / 365.0
            r         = 0.05
            sim_days  = 1 if dte <= 10 else (2 if dte <= 21 else (3 if dte <= 35 else 5))
            
            # Korumacı, dinamik ve dayanak varlık (Underlying ATR) duyarlı zaman stopu pencereleri
            time_stop = min(max(round(dte * TIME_STOP_RATIO), 2), 7)

            for _, row in calls.iterrows():
                try:
                    strike  = float(row['strike'])
                    iv_row  = max(float(row.get('impliedVolatility', atm_iv) or atm_iv), 0.05)
                    bid     = float(row.get('bid', 0) or 0)
                    ask     = float(row.get('ask', 0) or 0)
                    if ask <= 0.03 or ask > 2.50: continue  # Aşırı pahalı IV tuzakları elendi
                    mid     = (bid + ask) / 2.0
                    spread  = (ask - bid) / ask if ask > 0 else 1.0
                    if spread > SPREAD_MAX: continue
                    oi      = int(row.get('openInterest', 0) or 0)
                    volume  = int(row.get('volume', 0) or 0)
                    if oi < OI_MIN or mid < MID_MIN: continue
                    if strike > em_up * 1.08: continue

                    g     = bs_greeks(cp, strike, T, r, iv_row)
                    delta = g['delta']
                    gamma = g['gamma']
                    theta = g['theta']

                    # ── DİNAMİK GAMMA/THETA FILTRE KONTROLÜ ──
                    gt_ratio = calc_gamma_theta_ratio(gamma, ask, theta)
                    if gt_ratio < gt_threshold: continue

                    # ── SETUP-SPECIFIC HIBRID DELTA ARALIĞI KONTROLÜ ──
                    if min_delta <= delta <= max_delta:
                        vol_oi   = volume / oi if oi > 0 else 0.0
                        notional = volume * mid * 100

                        fs = 0.0
                        if vol_oi >= 1.0: fs += 5.0
                        if notional >= NOTIONAL_BLOCK_MIN: fs += 6.0
                        elif notional >= NOTIONAL_SWEEP_MIN: fs += 3.0
                        if volume >= 100 and ask > bid * 1.1: fs += 3.0

                        geff = min(math.log1p(gamma / mid if mid > 0 else 0), math.log1p(0.08))

                        liq = (5.0 if spread <= 0.03 else (3.0 if spread <= 0.06 else 1.0))
                        liq += (3.0 if oi >= 1000 else (1.5 if oi >= 300 else 0.0))
                        liq += (2.0 if volume >= 200 else 1.0)
                        liq = min(liq, 8.0)

                        accel = 2.5 if dte <= 14 else (2.0 if dte <= 21 else 1.5)
                        cw_pen    = -5.0 if cw_danger and strike > cp * 0.99 else 0.0
                        vol_boost = min(s7.get("vol_bonus", 0) * 0.3, 3.0)

                        gt_score = 0.0
                        if gt_ratio >= 2.0:   gt_score = 6.0
                        elif gt_ratio >= 1.2: gt_score = 4.0
                        elif gt_ratio >= 0.8: gt_score = 2.0

                        sc = (fs + geff * 50.0 + delta * 4.0 + liq +
                              accel * 2.0 + dte_bonus + cw_pen + vol_boost + gt_score)

                        if sc > best_score:
                            best_score = sc
                            atr_move  = min(max(l4.get("atr_pct", 2.0) / 100 * 3.0, 0.03), 0.20)
                            
                            # İdeal Kurumsal Hedefler
                            tp_target = round(mid * (1.0 + TAKE_PROFIT_PCT), 2)
                            sl_breaker = round(mid * (1.0 - STOP_LOSS_PCT), 2)

                            best_opt_data = {
                                "type": f"🎯 BOGA SNIPER ({setup_key})",
                                "strike": strike, "expiration": exp_str, "dte": dte,
                                "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                                "spread_pct": round(spread * 100, 1),
                                "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi, 3),
                                "notional": round(notional, 0),
                                "iv_pct": round(iv_row * 100, 1),
                                "delta": round(delta, 3), "gamma": round(gamma, 5),
                                "theta": round(theta, 4),
                                "gamma_accel": accel, "gamma_eff": round(geff, 4),
                                "gt_ratio": round(gt_ratio, 3),
                                "gt_score": round(gt_score, 1),
                                "flow_score": round(fs, 1), "liq_score": round(liq, 1),
                                "call_wall_danger": cw_danger,
                                "cost_per_contract": round(ask * 100, 0),
                                "score": round(sc, 2),
                                "sim": bs_pnl_sim(cp, strike, iv_row, dte, atr_move, sim_days),
                                "breakeven": round(strike + ask, 2),
                                "tp_price": tp_target,
                                "sl_price": sl_breaker,
                                "time_stop_days": time_stop,
                                "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                            }

                            best_result = {
                                "exp_date": exp_str, "dte": dte,
                                "max_pain": round(mp, 2),
                                "em": round(em, 2), "em_upper": round(em_up, 2),
                                "atm_iv": round(atm_iv * 100, 1),
                                "iv_rank": iv_rank, "iv_pct_rank": iv_pct,
                                "iv_vs_hv": round(atm_iv / hv, 3) if hv > 0 else 1.0,
                                "call_wall_danger": cw_danger, "call_wall_oi": int(cw_oi),
                                "em_atr_ratio": round(em / atr_abs, 2) if atr_abs > 0 else 0,
                                "pref_dte_range": (pref_min, pref_max),
                                "gamma_sweet": best_opt_data, "institutional": None,
                            }
                except: continue

        return best_result
    except Exception as e:
        logging.debug(f"{ticker} Stage9: {e}")
        return None

# ════════════════════════════════════════════════════════════════════════════
# 13) IV CONTEXT
# ════════════════════════════════════════════════════════════════════════════

def iv_context(iv_rank: float, ema: dict, s5: dict, s8: dict) -> Tuple[float, str]:
    is_sq   = s5.get("squeeze_bonus", 0) >= 8
    is_br   = ema.get("ema200_breakout", False) or ema.get("golden_cross", False)
    is_flow = s8.get("flow_bonus", 0) >= 5

    if iv_rank <= 20:   return 10.0, "💰 ULTRA UCUZ IV"
    elif iv_rank <= 30: return  8.0, "🟢 UCUZ IV"
    elif iv_rank <= 45: return  6.0, "🟡 ORTA IV"
    elif iv_rank <= 60:
        if is_sq or is_br or is_flow: return 5.0, "🟠 YÜKSEK IV — BAĞLAM POZİTİF"
        else:                          return 2.0, "🔴 YÜKSEK IV"
    elif iv_rank <= 80:
        if is_sq and is_flow:  return 4.0, "🔴 YÜKSEK IV — SWEEP+SIKIŞ"
        elif is_br:            return 3.0, "🔴 YÜKSEK IV — TAZE KIRILIM"
        else:                  return 0.0, "🚫 IV ÇOK YÜKSEK"
    else: return -5.0, "🚫 IV HARD BLOCK"


# ════════════════════════════════════════════════════════════════════════════
# 14) BACKTESTING — GERÇEK SONUÇ TAKİBİ
#     *** DEĞİŞİKLİK 5: peak_pct ve hit_40pct gerçekten dolduruluyor ***
# ════════════════════════════════════════════════════════════════════════════

def log_backtest(c: dict):
    """İlk kayıt — sonuçlar boş, fill_backtest_results() doldurur."""
    try:
        l4   = c.get("l4", {})
        ema  = c.get("ema", {})
        s5   = c.get("s5", {})
        s7   = c.get("s7", {})
        s8   = c.get("s8", {})
        opt  = c.get("options", {})
        best = opt.get("gamma_sweet") or opt.get("institutional") or {}
        rec  = {
            "ts":          datetime.now(NY_TZ).isoformat(),
            "ticker":      c.get("ticker"),
            "price":       c.get("current_price"),
            "score":       c.get("score"),
            "sector_etf":  c.get("sector_etf", "—"),
            # Stage 4
            "rs_60":       l4.get("rs_60"), "rs_20": l4.get("rs_20"),
            "rs_score":    l4.get("rs_score"), "mom_score": l4.get("mom_score"),
            "hh1": l4.get("hh_1"), "hh2": l4.get("hh_2"), "hh3": l4.get("hh_3"),
            "roc5": l4.get("roc5"), "rsi": l4.get("rsi"),
            "atr_pct":     l4.get("atr_pct", 2.0),
            # EMA
            "entry_mode":  ema.get("entry_mode"), "ema_score": ema.get("ema_score"),
            # Stage 5
            "setup_type":  s5.get("setup_type"),
            "squeeze_bonus": s5.get("squeeze_bonus"), "nr7": s5.get("nr7"),
            "bb_pct":      s5.get("bb_pct"),
            # Stage 7
            "vol_bonus":   s7.get("vol_bonus"), "rvol_20": s7.get("rvol_20"),
            "today_rvol":  s7.get("today_rvol"),
            # Stage 8
            "flow_bonus":  s8.get("flow_bonus"), "sweep_count": s8.get("sweep_count"),
            "put_call":    s8.get("put_call_ratio"), "notional": s8.get("total_notional"),
            # Kontrat
            "delta":       best.get("delta"), "dte": best.get("dte"),
            "gt_ratio":    best.get("gt_ratio"),   # Gamma/Theta oranı
            "cost":        best.get("cost_per_contract"),
            "gamma_accel": best.get("gamma_accel"),
            "sim_pnl":     best.get("sim", {}).get("pnl_pct"),
            # Context
            "sector":      c.get("sector"), "iv_rank": opt.get("iv_rank"),
            "call_wall":   best.get("call_wall_danger"),
            # Sonuçlar — fill_backtest_results() doldurur
            "peak_pct":    None,
            "peak_date":   None,
            "time_to_peak": None,
            "hit_40pct":   None,
            "hit_sl":      None,
            "entry_price_actual": c.get("current_price"),
        }
        path = os.path.join(DATA_DIR, "backtest_log.jsonl")
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
    except: pass


async def fill_backtest_results():
    """
    *** DEĞİŞİKLİK 5: Backtesting sonuçlarını gerçekten doldur ***

    Her tarama sonrası son 30 pick için:
    1. yfinance'ten o günden bu yana gerçek fiyat verisi çek
    2. Maksimum getiri (peak_pct) hesapla
    3. hit_40pct = TAKE_PROFIT_PCT'ye ulaşıldı mı?
    4. hit_sl = STOP_LOSS_PCT'ye ulaşıldı mı?
    5. time_to_peak = kaç gün sonra zirveye ulaştı?
    6. Güncellenmiş kayıtları dosyaya yaz
    """
    path = os.path.join(DATA_DIR, "backtest_log.jsonl")
    if not os.path.exists(path):
        return

    try:
        with open(path, "r", encoding="utf-8") as f:
            records = [json.loads(line) for line in f if line.strip()]
    except:
        return

    if not records:
        return

    # Son 30 kayıt, peak_pct henüz doldurulmamış olanlar
    pending = [r for r in records[-30:] if r.get("peak_pct") is None and r.get("ticker")]
    if not pending:
        return

    updated_count = 0
    for rec in pending:
        try:
            ticker     = rec["ticker"]
            entry_ts   = rec.get("ts", "")
            entry_price= float(rec.get("price") or 0)
            dte        = int(rec.get("dte") or 21)

            if not entry_ts or entry_price <= 0:
                continue

            # Giriş tarihini parse et
            try:
                entry_dt = datetime.fromisoformat(entry_ts).date()
            except:
                continue

            today = date.today()
            days_since = (today - entry_dt).days

            # En az 1 gün geçmemişse atla
            if days_since < 1:
                continue

            # yfinance'ten giriş tarihinden bu yana veri çek
            look_fwd = min(dte, days_since, 60)   # DTE veya geçen gün kadar bak
            start_str = entry_dt.strftime("%Y-%m-%d")
            end_str   = today.strftime("%Y-%m-%d")

            df = await asyncio.wait_for(asyncio.to_thread(
                lambda t=ticker, s=start_str, e=end_str:
                    yf.Ticker(t).history(start=s, end=e)
            ), timeout=20)

            if df is None or len(df) < 2:
                continue

            closes = df['Close'].astype(float).values
            highs  = df['High'].astype(float).values

            # Peak hesapla: giriş fiyatından itibaren maksimum high
            peak_price    = float(max(highs))
            peak_pct      = (peak_price - entry_price) / entry_price * 100
            peak_idx      = int(np.argmax(highs))
            time_to_peak  = peak_idx + 1   # gün cinsinden

            # TP / SL kontrolü (günlük kapanışlar üzerinden)
            hit_40pct = False
            hit_sl    = False
            for i, (hi, lo, cl) in enumerate(zip(
                df['High'].astype(float).values,
                df['Low'].astype(float).values,
                closes
            )):
                # ── UNDERLYING ATR-BASED INVALIDATION STOP ──
                # Hisse volatilitesine duyarlı kurumsal stop (1.5 * ATR)
                try:
                    atr_pct_val = float(rec.get("atr_pct") or 2.0)
                    atr_abs = entry_price * (atr_pct_val / 100.0)
                except:
                    atr_abs = entry_price * 0.02

                # Teknik Invalidation Seviyesi: Giriş Fiyatı - 1.5 ATR
                underlying_sl_level = entry_price - (1.5 * atr_abs)
                # Teknik Hedef Seviyesi: Giriş Fiyatı + 2.5 ATR (Yüksek deltalı opsiyonda ~%50+ kâr)
                underlying_tp_level = entry_price + (2.5 * atr_abs)

                if lo <= underlying_sl_level:
                    hit_sl = True
                    break  # Teknik yapı kırıldı, stop gerçekleşti, simülasyonu sonlandır.
                elif hi >= underlying_tp_level:
                    hit_40pct = True
                    break  # Hedef fiyat görüldü, kâr alındı, pozisyon kapandı.

            rec["peak_pct"]    = round(peak_pct, 2)
            rec["time_to_peak"] = time_to_peak
            rec["hit_40pct"]   = hit_40pct
            rec["hit_sl"]      = hit_sl
            updated_count += 1

        except Exception as e:
            logging.debug(f"Backtest fill {rec.get('ticker')}: {e}")
            continue

    if updated_count == 0:
        return

    # Güncellenmiş records'u dosyaya yaz
    try:
        with open(path, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
        logging.info(f"✅ Backtest: {updated_count} kayıt güncellendi")
    except Exception as e:
        logging.error(f"Backtest yazma hatası: {e}")


def get_backtest_summary() -> dict:
    """
    Son 50 trade'in gerçek sonuçlarından win rate ve ortalama return hesapla.
    Raporda gösterilir.
    """
    path = os.path.join(DATA_DIR, "backtest_log.jsonl")
    if not os.path.exists(path):
        return {}

    try:
        with open(path, "r", encoding="utf-8") as f:
            records = [json.loads(line) for line in f if line.strip()]
    except:
        return {}

    # Sadece doldurulmuş olanlar
    filled = [r for r in records if r.get("peak_pct") is not None]
    if len(filled) < 5:
        return {"msg": f"Henüz {len(filled)} sonuç var, min 5 gerekli"}

    last50 = filled[-50:]
    peaks  = [r["peak_pct"] for r in last50]
    wins   = [r for r in last50 if r.get("hit_40pct")]
    losses = [r for r in last50 if r.get("hit_sl")]

    # Setup tipine göre breakdown
    setup_stats: Dict[str, list] = {}
    for r in last50:
        st = r.get("setup_type", "UNKNOWN")
        if st not in setup_stats: setup_stats[st] = []
        setup_stats[st].append(r.get("peak_pct", 0))

    setup_breakdown = {
        st: {"count": len(vals), "avg_peak": round(sum(vals) / len(vals), 1)}
        for st, vals in setup_stats.items()
    }

    return {
        "total":       len(last50),
        "win_rate":    round(len(wins) / len(last50) * 100, 1),
        "avg_peak":    round(sum(peaks) / len(peaks), 1),
        "max_peak":    round(max(peaks), 1),
        "sl_rate":     round(len(losses) / len(last50) * 100, 1),
        "setup_breakdown": setup_breakdown,
    }


# ════════════════════════════════════════════════════════════════════════════
# 15) ANA ANALİZ — 9 katman + earnings hard block
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

            # ── OPENING CONFIRMATION FILTER ──
            now_ny = datetime.now(NY_TZ)
            if now_ny.weekday() < 5:  # Hafta içi seans kontrolü
                market_open_time = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)
                # Seans açıldıktan sonra ilk 20 dakika boyunca işlem tetiklenmesini engelle
                if market_open_time <= now_ny < market_open_time + timedelta(minutes=20):
                    logging.info(f"⏳ {ticker} elendi: Açılışın ilk 20 dakikası (Confirmation bekleniyor)")
                    return None

            if MARKET_REGIME.get("regime") == "bear": return None
            
            df = await asyncio.wait_for(asyncio.to_thread(
                lambda: yf.Ticker(ticker).history(period="300d", interval="1d", auto_adjust=True)
            ), timeout=30)
            if df is None or len(df) < 210: return None

            df.columns = [
                str(c).strip().title() for c in
                (df.columns.get_level_values(0) if isinstance(df.columns, pd.MultiIndex) else df.columns)
            ]
            if 'Close' not in df.columns: return None

            close = df['Close'].astype(float)
            cp    = float(close.iloc[-1])
            if not (PRICE_MIN <= cp <= PRICE_MAX): return None

            # Stage 4: RS lider
            l4_ok, l4 = stage4_relative_strength(df)
            if not l4_ok: return None
            if not l4:
                l4 = {"rs_score": 0, "mom_score": 0, "rs_60": 0, "rs_20": 0, "rs_5": 0,
                      "roc5": 0, "rsi": 50, "rvol": 1, "atr_pct": 2, "hv20": 0.3}

            # ── MULTI-TIMEFRAME VERİ SEKTÖR GİRİŞİ (15m & 1h) ──
            df_1h  = await fetch_1h_data(ticker)
            df_15m = await fetch_15m_data(ticker)

            # Fiyat-Hacim Korelasyon Dengesi Kontrolü (YENİ KATMAN)
            corr_ok, corr_data = validate_intraday_price_volume_correlation(df_15m, df_1h)
            if not corr_ok:
                logging.info(f"⏳ {ticker} elendi: 15m/1h Fiyat-Hacim Korelasyon Uyumsuzluğu (Dengesiz Yapı)")
                return None

            # MTF RSI Kontrolü
            mtf_ok, mtf = check_mtf_rsi_alignment(df, df_1h, market_open=MARKET_OPEN_AT_SCAN)
            if not mtf_ok: return None
            if not mtf:
                mtf = {"rsi_1d": 50, "rsi_1h": "50", "trend_1d": "Nötr", "rsi_alignment": "—"}

            # Stage 3: Sektör (ETF RS'e bağlı)
            sector = await get_sector(ticker)
            sec_score, sec_info = stage3_sector_score(sector_etf or "XLK")

            # EMA zamanlaması
            ema_ok, ema = ema_timing(df)
            if not ema_ok: return None
            if not ema:
                ema = {"ema_score": 0, "entry_mode": "—", "adx": 10, "vwap_ok": False}
            # atr_pct'yi EMA'ya aktar (stage9 için)
            ema["atr_pct"] = l4.get("atr_pct", 2.0)

            # Stage 5: Pre-explosion
            s5 = stage5_pre_explosion(df)

            # Stage 6: Breakout yakınlığı
            s6 = stage6_breakout_proximity(df)

            # Stage 7: Hacim
            s7 = stage7_volume_ignition(df)

            # Stage 8: Flow + Earnings Hard Block
            s8 = await stage8_options_flow(ticker, cp)
            if s8.get("earnings_hard_block"):
                logging.info(f"⛔ {ticker}: Earnings {s8.get('earnings_days')}g sonra — HARD BLOCK")
                return None

            # Stage 9: Kontrat seçimi
            hv20 = l4.get("hv20", calc_hv(close, 20))
            opt  = await stage9_contract_selection(ticker, cp, close, hv20, l4, ema, s5, s8, s7)
            if not opt: return None

            # IV Context
            iv_s, iv_lbl = iv_context(opt.get("iv_rank", 50), ema, s5, s8)
            if iv_s < -100: return None

            regime       = MARKET_REGIME.get("regime", "neutral")
            regime_score = (10.0 if regime == "bull" and MARKET_REGIME.get("score", 50) >= 75
                            else 8.0 if regime == "bull" else 5.0)
            regime_label = ("🟢 GÜÇLÜ BOĞA" if regime_score >= 10
                            else "🟢 BOĞA" if regime_score >= 8 else "🟡 NÖTR")

            best_opt = opt.get("gamma_sweet") or opt.get("institutional")
            opt_flow = min(best_opt.get("flow_score", 0) / 3.0, 5.0) if best_opt else 0.0

            mtf_bonus = 0.0
            if mtf.get("steady_momentum"): mtf_bonus += 5.0
            if mtf.get("hh_hl"):           mtf_bonus += 3.0
            rsi_align = mtf.get("rsi_alignment", "")
            if rsi_align == "🔥 MÜKEMMEL":  mtf_bonus += 4.0
            elif rsi_align == "✅ İYİ":      mtf_bonus += 2.0
            mtf_bonus = min(mtf_bonus, 10.0)

            proximity_bonus = s6.get("proximity_bonus", 0.0)
            vol_bonus       = s7.get("vol_bonus", 0.0)

            # *** Gamma/Theta bonus skora eklenir ***
            gt_ratio = best_opt.get("gt_ratio", 0.0) if best_opt else 0.0
            gt_bonus = (3.0 if gt_ratio >= 2.0 else 2.0 if gt_ratio >= 1.0 else
                        1.0 if gt_ratio >= 0.5 else 0.0)

            # Fiyat Hacim Korelasyon Bonusu
            corr_bonus = min(max(0.0, corr_data.get("total_bonus", 0.0)), 10.0)

            total = (
                l4.get("rs_score", 0)        +   # 0-20  RS
                l4.get("mom_score", 0)        +   # 0-15  Momentum
                ema.get("ema_score", 0)       +   # 0-20  EMA
                sec_score                     +   # 0-15  Sektör
                s5.get("squeeze_bonus", 0)    +   # 0-15  Sıkışma
                vol_bonus                     +   # 0-10  Hacim
                s8.get("flow_bonus", 0)       +   # 0-10  Flow
                iv_s                          +   # 0-10  IV
                opt_flow                      +   # 0-5   Opsiyon flow
                mtf_bonus                     +   # 0-10  MTF RSI
                proximity_bonus * 0.5         +   # 0-4   Breakout yakınlığı
                gt_bonus                      +   # 0-3   Gamma/Theta kalitesi
                corr_bonus                        # 0-10  Yeni 15m/1h Fiyat-Hacim Uyum Bonusu
            )

            # Bonuslar
            if ema.get("golden_cross") or "GOLDEN_CROSS" in ema.get("entry_mode", ""):
                total += 5.0
            if ema.get("ema200_breakout") or "EMA200_BREAKOUT" in ema.get("entry_mode", ""):
                total += 7.0
            if s6.get("near_breakout"):              total += 2.0
            if s7.get("today_rvol", 0) >= 3.0:       total += 3.0
            if s5.get("setup_type") == "NR7_KRITIK": total += 3.0

            # Cezalar
            if opt.get("call_wall_danger"):  total -= 4.0
            if s8.get("earnings_warning"):   total -= 8.0   # Hard block'tan kurtuldu ama yakın

            total = min(max(total, 0.0), 100.0)

            if total >= 75:   grade = "🏆 PATLAMA POTANSİYELİ"
            elif total >= 60: grade = "🔥 GÜÇLÜ FIRSAT"
            elif total >= 45: grade = "💡 İYİ SETUP"
            else:             grade = "📊 OLASI"

            # Rozetler
            if s5.get("setup_type") == "NR7_KRITIK": grade = "💥" + grade
            elif s5.get("nr7"):                       grade = "NR7·" + grade
            if s8.get("sweep_count", 0) >= 2:         grade = "⚡" + grade
            if ema.get("golden_cross"):                grade = "🌟" + grade
            if ema.get("ema200_breakout"):             grade = "🚀" + grade
            if s6.get("near_breakout"):               grade = "🎯" + grade
            if s7.get("today_rvol", 0) >= 2.5:        grade = "🔊" + grade
            if gt_ratio >= 2.0:                        grade = "Γ·" + grade
            if opt.get("call_wall_danger"):            grade += "·DUVAR⚠️"
            if s8.get("earnings_warning"):             grade += "·EARN⚠️"

            result = {
                "ticker": ticker, "current_price": round(cp, 2),
                "score": round(total, 1), "grade": grade, "sector": sector,
                "sector_etf": sector_etf,
                "l4": l4, "ema": ema, "s5": s5, "s6": s6, "s7": s7, "s8": s8,
                "mtf": mtf, "options": opt,
                "hv20": round(hv20 * 100, 1),
                "sector_score": round(sec_score, 1), "sector_info": sec_info,
                "regime_label": regime_label,
                "iv_ctx_score": round(iv_s, 1), "iv_ctx_label": iv_lbl,
                "mtf_bonus": round(mtf_bonus, 1),
                "proximity_bonus": round(proximity_bonus, 1),
                "vol_bonus": round(vol_bonus, 1),
                "gt_ratio": round(gt_ratio, 3),
                "gt_bonus": round(gt_bonus, 1),
                "corr_data": corr_data,
            }
            log_backtest(result)
            return result
        except Exception as e:
            logging.error(f"HATA {ticker}: {e}")
            return None


# ════════════════════════════════════════════════════════════════════════════
# 16) RAPOR
# ════════════════════════════════════════════════════════════════════════════

def build_block(c: dict) -> str:
    ticker   = c['ticker']; cp = c['current_price']; grade = c['grade']
    l4 = c['l4']; ema = c['ema']; s5 = c['s5']; s6 = c['s6']
    s7 = c['s7']; s8 = c['s8']
    mtf  = c.get('mtf', {}); opt = c['options']
    sector = c.get('sector', '—'); etf = c.get('sector_etf', '—')
    corr_data = c.get('corr_data', {})

    entry_lbl = {
        "EMA200_BREAKOUT":          "⚡ EMA200 KIRILIM",
        "EMA200_BREAKOUT_BELOW200": "⚡ DİP KIRILIM",
        "GOLDEN_CROSS":             "🌟 GOLDEN CROSS",
        "NEAR_GOLDEN":              "🔜 NEAR GOLDEN",
        "TREND_BIRTH":              "🌱 TREND BAŞI",
        "EMA50_PULLBACK":           "📉→📈 EMA50 SEKME",
        "ESTABLISHED_TREND":        "🐂 GÜÇLÜ TREND",
    }

    best = opt.get("gamma_sweet") or opt.get("institutional")
    gt_r = best.get("gt_ratio", 0) if best else 0
    gt_lbl = ("✅ VERİMLİ" if gt_r >= 1.0 else
              "🟡 ORTA"   if gt_r >= 0.5 else
              "🔴 VERİMSİZ")

    lines = [
        f"\n{'═' * 55}",
        f"{grade}  <b>#{ticker}</b>  ${cp:.2f}",
        f"📊 Skor:<b>{c['score']}/100</b>  {c.get('regime_label', '')}  Γ/Θ:{gt_r:.2f} {gt_lbl}",
        # Sektör (ETF RS bağlı)
        f"🏭 [S3] Sektör:{etf} ({sector[:20]})  RS5:{c.get('sector_info', {}).get('rs5', 0):+.1f}%  Score:{c.get('sector_score', 0):.0f}/15",
        # Stage 4
        f"💪 [S4] RS: 60g:{l4.get('rs_60', 0):+.1f}pp  20g:{l4.get('rs_20', 0):+.1f}pp  5g:{l4.get('rs_5', 0):+.1f}pp",
        f"📈 [S4] Mom: HH:{'✅✅✅' if l4.get('hh_3') else ('✅✅' if l4.get('hh_2') else ('✅' if l4.get('hh_1') else '❌'))}  "
        f"ROC5:{l4.get('roc5', 0):+.1f}%  RVOL:{l4.get('rvol', 1):.2f}x  RSI:{l4.get('rsi', 50):.0f}  "
        f"{'🐢 Steady' if l4.get('steady_trend') else ''}",
        # EMA
        f"🔮 EMA: <b>{entry_lbl.get(ema.get('entry_mode', ''), ema.get('entry_mode', '—'))}</b>  "
        f"ADX:{ema.get('adx', 0):.0f}  Score:{ema.get('ema_score', 0):.0f}/20  "
        f"VWAP:{'✅' if ema.get('vwap_ok') else '⚠️'}",
        # MTF RSI
        f"📡 MTF: 1D:{mtf.get('rsi_1d', '—')}  1H:{mtf.get('rsi_1h', '—')}  "
        f"{mtf.get('rsi_alignment', '—')}  Trend:{mtf.get('trend_1d', '—')}\n"
        f"📊 V/P Dengesi: {corr_data.get('verdict', '—')} | 15m Eğimi:{corr_data.get('vol_slope_15m', 1)}x | 1h RVOL:{corr_data.get('rvol_1h', 1)}x",
        # Stage 5
        f"💥 [S5] {s5.get('setup_type', '—')}  {s5.get('squeeze_label', '—')}  "
        f"Bonus:{s5.get('squeeze_bonus', 0):.0f}/15  BB%:{s5.get('bb_pct', 50):.0f}  "
        f"NR7:{'✅' if s5.get('nr7') else '❌'}  ATR↓:{'✅' if s5.get('atr_falling') else '❌'}",
        # Stage 6
        f"🎯 [S6] dist20H:{s6.get('dist_20h', -10):.1f}%  "
        f"{'🔥 YAKINDA' if s6.get('near_breakout') else '—'}  "
        f"VWAP:{'✅' if s6.get('vwap_reclaim') else '❌'}  Tight:{'✅' if s6.get('tight_handle') else '❌'}",
        # Stage 7
        f"📊 [S7] {s7.get('vol_label', '—')}  Bonus:{s7.get('vol_bonus', 0):.0f}/10  "
        f"RVOL:{s7.get('rvol_20', 1):.2f}x  Bugün:{s7.get('today_rvol', 1):.2f}x",
        # IV
        f"📊 IV:{opt.get('atm_iv', 0):.0f}%  Rank:{opt.get('iv_rank', 0):.0f}  {c.get('iv_ctx_label', '')}",
        # Stage 8
        f"🔥 [S8] {s8.get('flow_label', '—')}  Bonus:{s8.get('flow_bonus', 0):.0f}/10  "
        f"P/C:{s8.get('put_call_ratio', 1):.2f}  Sweep:{s8.get('sweep_count', 0)}  "
        f"${s8.get('total_notional', 0):,.0f}",
    ]

    if s8.get("earnings_warning"):
        lines.append(f"   ⚠️ EARNINGS {s8.get('earnings_days', '?')} GÜN SONRA! (14g üstü, devam edildi)")
    if s8.get("earnings_hard_block"):
        lines.append(f"   🚫 Bu satır görünmemeli — hard block çalışmadı!")

    pref = opt.get("pref_dte_range", (21, 35))
    lines.append(
        f"📅 [S9] DTE Tercih:{pref[0]}-{pref[1]}g  |  "
        f"Vade:{opt.get('exp_date', '—')} ({opt.get('dte', '—')}g)"
    )

    for key in ["gamma_sweet", "institutional"]:
        od = opt.get(key)
        if not od: continue
        sim = od.get("sim", {})
        gt  = od.get("gt_ratio", 0)
        lines.append(f"\n  {od['type']}")
        lines.append(
            f"  ${od['strike']:.0f} | {od['expiration']} ({od['dte']}g) | "
            f"<b>${od['cost_per_contract']:.0f}</b>"
        )
        lines.append(
            f"  Δ={od['delta']:.2f}  Γ={od['gamma']:.4f}  Θ={od['theta']:.4f}  "
            f"Γ/Θ={gt:.2f}  IV={od['iv_pct']:.0f}%"
        )
        lines.append(
            f"  Spread:%{od['spread_pct']:.1f}  OI:{od['oi']:,}  Vol:{od['volume']:,}  "
            f"Not:${od.get('notional', 0):,.0f}"
        )
        if od.get("call_wall_danger"): lines.append("  ⚠️ CALL WALL — MM Trap riski!")
        if sim:
            lines.append(
                f"  📈 {sim.get('days_fwd', 2)}g sim: "
                f"${sim.get('price_now', 0):.2f}→${sim.get('price_fwd', 0):.2f}  "
                f"<b>PNL:{sim.get('pnl_pct', 0):+.0f}%</b>"
            )
        lines.append(
            f"  🎯 Opsiyon TP:${od['tp_price']:.2f} | Acil SL:${od['sl_price']:.2f}\n"
            f"  🛡️ Dayanak Varlık (Underlying) İzleme: Stop = Entry - 1.5*ATR | Hedef = Entry + 2.5*ATR\n"
            f"  ⏰ Zaman Stopu: {od['time_stop_days']}g | {c.get('scale_out_plan', '')}"
        )
    return "\n".join(lines)


def build_report(candidates, vix, duration, n_scanned, s0: dict,
                 active_sectors: List[str], bt_summary: dict) -> Tuple[str, str]:
    n      = len(candidates)
    regime = MARKET_REGIME.get("regime", "neutral").upper()
    qqq5   = MARKET_REGIME.get("qqq_5d", 0.0)
    now_s  = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")

    # Seçilen sektörlerin ETF RS göster
    sector_line = "  ".join(
        f"{etf}:{SECTOR_ETF_CACHE.get(etf, {}).get('rs5', 0):+.1f}%"
        for etf in active_sectors
    )

    # Backtesting özeti
    bt_line = ""
    if bt_summary and "win_rate" in bt_summary:
        bt_line = (
            f"📊 Backtest ({bt_summary['total']} trade): "
            f"Win:{bt_summary['win_rate']:.0f}%  "
            f"AvgPeak:{bt_summary['avg_peak']:.1f}%  "
            f"SL Hit:{bt_summary['sl_rate']:.0f}%\n"
        )
    elif bt_summary and "msg" in bt_summary:
        bt_line = f"📊 Backtest: {bt_summary['msg']}\n"

    summary = (
        f"🚀 <b>BOGA AI v242 — SEKTÖR ÖNCE + GERÇEK BT</b>\n"
        f"🕒 {now_s}  |  VIX:{vix:.1f}  |  Rejim:<b>{regime}</b>  QQQ:{qqq5:+.1f}%\n"
        f"🏭 Aktif Sektörler: {', '.join(active_sectors) or '—'}\n"
        f"   {sector_line}\n"
        f"🔍 {n_scanned} hisse → <b>{n} ADAY</b>  ({duration:.0f}sn)\n"
        f"📅 DTE: {DTE_HARD_MIN}-{DTE_MAX}g  |  Earnings &lt;{EARNINGS_HARD_BLOCK_DAYS}g = HARD BLOCK\n"
        f"{bt_line}\n"
    )

    for i, c in enumerate(candidates[:20], 1):
        l4   = c['l4']; s5 = c['s5']; s7 = c['s7']; s8 = c['s8']
        opt  = c['options']
        best = opt.get("gamma_sweet") or opt.get("institutional")
        cost = f"${best['cost_per_contract']:.0f}" if best else "—"
        dte  = f"{best['dte']}g" if best else "—"
        spnl = best['sim'].get('pnl_pct', 0) if best and best.get('sim') else 0
        gt_r = c.get("gt_ratio", 0)
        summary += (
            f"{i}. <b>{c['ticker']}</b> ${c['current_price']:.0f}  {c['score']:.0f}pt  "
            f"[{c.get('sector_etf', '—')}]\n"
            f"   {s5.get('setup_type', '—')}  RS60:{l4.get('rs_60', 0):+.1f}pp  "
            f"RVOL:{s7.get('today_rvol', 1):.1f}x  Flow:{s8.get('flow_bonus', 0):.0f}  "
            f"Γ/Θ:{gt_r:.1f}  {cost}/{dte}  sim:{spnl:+.0f}%\n"
            f"   {c['grade'][:55]}\n\n"
        )
    detail = "\n".join(build_block(c) for c in candidates[:15])
    return summary, detail


def save_picks(candidates, n_universe, duration, active_sectors):
    try:
        out  = os.path.join(DATA_DIR, f"v242_{datetime.now().strftime('%Y%m%d_%H%M')}.json")
        data = {
            "version": "v242",
            "date": datetime.now(NY_TZ).strftime("%Y-%m-%d"),
            "generated_at": datetime.now(NY_TZ).isoformat(),
            "vix": MARKET_VIX.get("value", 0),
            "dte_range": f"{DTE_HARD_MIN}-{DTE_MAX}",
            "earnings_hard_block_days": EARNINGS_HARD_BLOCK_DAYS,
            "active_sectors": active_sectors,
            "regime": MARKET_REGIME,
            "universe_size": n_universe,
            "scan_duration_sec": duration,
            "total_candidates": len(candidates),
            "picks": candidates,
        }
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, default=str, indent=2)
        logging.info(f"💾 {out}")
    except Exception as e:
        logging.error(f"❌ Kayıt hatası: {e}")


# ════════════════════════════════════════════════════════════════════════════
# 17) ANA TARAMA — Sektör-önce akışı
# ════════════════════════════════════════════════════════════════════════════

async def scan():
    start = time.time()

    # Oturum etiketi — Telegram raporunda görünür
    session_lbl = (
        "🌅 11:00 GÜNDÜZ TARAMASI — Günlük swing setup'ları"
        if SCAN_SESSION == "morning"
        else "🌆 15:30 KAPANIŞ ÖNCESI — Ertesi gün setup'ları (bugün işlem değil!)"
    )
    dte_note = (
        f"DTE: {DTE_HARD_MIN}-{DTE_MAX}g"
        if SCAN_SESSION == "morning"
        else f"DTE: 14-{DTE_MAX}g  ← ertesi gün için min 14g"
    )

    global MARKET_OPEN_AT_SCAN, ACTIVE_SECTORS
    MARKET_OPEN_AT_SCAN = (get_scan_mode() == "market_open")

    # 1. Market verisi + sektör ETF RS hesabı
    await update_market_data()

    # Stage 0
    s0_ok, s0 = stage0_market_regime_ok()
    vix_val   = MARKET_VIX.get("value", 20.0)
    regime    = MARKET_REGIME.get("regime", "neutral")
    qqq5      = MARKET_REGIME.get("qqq_5d", 0.0)

    # Sektör seçimi
    ACTIVE_SECTORS = await select_top_sectors(top_n=2)
    if not ACTIVE_SECTORS:
        await send_tg(
            "🔴 <b>Bear piyasa veya tüm sektörler negatif RS</b>\n"
            "Aktif sektör bulunamadı — tarama iptal."
        )
        return

    sector_rs_lines = "\n".join(
        f"  {etf}: RS5={SECTOR_ETF_CACHE.get(etf, {}).get('rs5', 0):+.1f}%  "
        f"composite={SECTOR_ETF_CACHE.get(etf, {}).get('composite', 0):+.1f}"
        for etf in list(SECTOR_ETFS.keys())
    )

    swing_verdict = s0.get("swing_verdict", "—")
    gap_label     = s0.get("spy_gap_label", "—")
    qqq_ema_lbl   = "✅ QQQ > EMA20" if s0.get("qqq_above_ema20") else "⚠️ QQQ EMA20 ALTINDA"
    vix_lbl       = f"✅ VIX {vix_val:.1f}" if vix_val <= 22 else f"🚫 VIX {vix_val:.1f} > 22"

    await send_tg(
        f"🚀 <b>BOGA AI v242</b>\n"
        f"🕒 {datetime.now(NY_TZ).strftime('%Y-%m-%d %H:%M NY')}\n"
        f"<b>{session_lbl}</b>\n\n"
        f"━━ 3 SORU (Adım 1) ━━\n"
        f"{vix_lbl}\n"
        f"{qqq_ema_lbl}\n"
        f"{gap_label}\n"
        f"→ <b>{swing_verdict}</b>\n\n"
        f"━━ SEKTÖR (Adım 2) ━━\n"
        f"{sector_rs_lines}\n"
        f"🏭 <b>Seçilen: {', '.join(ACTIVE_SECTORS)}</b>\n\n"
        f"{dte_note}  |  Earnings &lt;{EARNINGS_HARD_BLOCK_DAYS}g = HARD BLOCK\n"
        f"📊 {len(build_sector_universe(ACTIVE_SECTORS))} hisse taranıyor..."
    )

    # *** SEKTÖR EVREN (500 → 40-60 hisse) ***
    universe = build_sector_universe(ACTIVE_SECTORS)
    if not universe:
        await send_tg("❌ Sektör evreni boş!"); return

    await send_tg(
        f"✅ <b>Sektör Evreni: {len(universe)} hisse</b>  "
        f"({', '.join(ACTIVE_SECTORS)})\n"
        f"Analiz başlıyor..."
    )

    global TOTAL_TO_SCAN, PROGRESS_COUNTER
    TOTAL_TO_SCAN = len(universe); PROGRESS_COUNTER = 0

    # Her ticker'a sector_etf bilgisi gönder
    ticker_etf_pairs = []
    seen = set()
    for etf in ACTIVE_SECTORS:
        for ticker in SECTOR_STOCKS.get(etf, []):
            if ticker not in seen:
                ticker_etf_pairs.append((ticker, etf))
                seen.add(ticker)

    results    = await asyncio.gather(
        *[analyze(t, etf) for t, etf in ticker_etf_pairs],
        return_exceptions=True
    )
    raw_candidates = sorted(
        [r for r in results if isinstance(r, dict)],
        key=lambda x: x['score'], reverse=True
    )

    # ── SEKTÖR KONSANTRASYON KORUMASI VE SCALE-OUT REHBERİ ──
    candidates = []
    sector_counts = {}
    MAX_TRADES_PER_SECTOR = 2

    for c in raw_candidates:
        s_etf = c.get("sector_etf", "OTHER")
        current_count = sector_counts.get(s_etf, 0)

        if current_count < MAX_TRADES_PER_SECTOR:
            # Pozisyona kurumsal yönetim scale-out notu ekleme
            c["scale_out_plan"] = (
                "⚖️ PLAN: +%20 PnL'de %25 Sat | +%40 PnL'de Stop'u Girişe Çek (BE) | "
                "+%50 TP Kâr Al | %25 Moon Bag Bırak"
            )
            candidates.append(c)
            sector_counts[s_etf] = current_count + 1
        else:
            logging.info(f"🚫 {c['ticker']} elendi: Maksimum sektör limiti aşıldı ({s_etf})")

    # Nihai en verimli top 5 sinyalle filtrele
    candidates = candidates[:5]

    if not candidates:
        await send_tg(
            "⚠️ Aday bulunamadı!\n"
            f"Seçilen sektörler: {', '.join(ACTIVE_SECTORS)}\n"
            "• Stage 4 RS filtresi çok dar?\n"
            "• EMA zamanlaması uygun değil\n"
            "• Earnings hard block devrede olabilir"
        )
        return

    # *** DEĞİŞİKLİK 5: Backtest sonuçlarını doldur ve özet al ***
    await fill_backtest_results()
    bt_summary = get_backtest_summary()

    duration = time.time() - start
    save_picks(candidates, len(universe), duration, ACTIVE_SECTORS)
    summary, detail = build_report(
        candidates, MARKET_VIX['value'], duration, len(universe),
        s0, ACTIVE_SECTORS, bt_summary
    )
    await send_tg(summary)
    await asyncio.sleep(1)
    for chunk in split_safe(detail):
        if chunk.strip():
            await send_tg(chunk); await asyncio.sleep(0.8)

    best = candidates[0]
    bo   = best['options'].get("gamma_sweet") or best['options'].get("institutional")
    gt_r = best.get("gt_ratio", 0)
    await send_tg(
        f"✅ <b>v242 Tamamlandı!</b>  {duration:.0f}sn  "
        f"{len(universe)}→{len(candidates)} aday\n"
        f"🏭 Sektörler: {', '.join(ACTIVE_SECTORS)}\n"
        f"🏆 <b>{best['ticker']}</b> ({best['score']:.1f}/100)  {best['grade'][:40]}\n"
        f"💪 RS60:{best['l4'].get('rs_60', 0):+.1f}pp  "
        f"Setup:{best['s5'].get('setup_type', '—')}  "
        f"RVOL:{best['s7'].get('today_rvol', 1):.1f}x  "
        f"Γ/Θ:{gt_r:.2f}\n"
        f"{'$' + str(bo['cost_per_contract']) + '/' + str(bo['dte']) + 'g' if bo else '—'}\n\n"
        + (f"📊 Backtest: Win:{bt_summary.get('win_rate', '—')}%  "
           f"AvgPeak:{bt_summary.get('avg_peak', '—')}%"
           if "win_rate" in bt_summary else "📊 Backtest: veri toplanıyor...")
    )


# ════════════════════════════════════════════════════════════════════════════
# 18) ZAMANLAYICI + BAŞLATMA
# ════════════════════════════════════════════════════════════════════════════

# ════════════════════════════════════════════════════════════════════════════
# TARAMA PROGRAMI
# Günde 2 tarama — NY saatiyle:
#   🌅 11:00  — Açılış gürültüsü geçti, gerçek momentum görünür
#   🌆 15:30  — Kapanış öncesi kurumsal akış + ertesi gün setup'ları
#
# 15:30 taramasında bulunan setup'lar ERTESI GÜN içindir.
# scan() bunu SCAN_SESSION flag'iyle raporda belirtir.
# ════════════════════════════════════════════════════════════════════════════

# Günlük tarama saatleri (NY saat dilimi, (hour, minute) formatı)
DAILY_RUN_TIMES = [
    (11,  0),   # 11:00 NY — gündüz taraması
    (15, 30),   # 15:30 NY — kapanış öncesi tarama
]

# Aktif tarama oturumunu global olarak tut (scan() raporda kullanır)
SCAN_SESSION: str = "morning"   # "morning" | "eod"


def get_next_run_utc() -> Tuple[datetime, str]:
    """
    DAILY_RUN_TIMES içindeki saatlerden bir sonrakini bul.
    Şu anki zamandan ilerideki ilk tarama saatini döner.
    Bugün kalan tarama yoksa yarının ilk saatine atlar (hafta sonu skip).
    Döner: (UTC datetime, session_label)
    """
    from datetime import timezone as tz

    now_ny = datetime.now(tz.utc).astimezone(NY_TZ)
    session_labels = ["morning", "eod"]

    # Bugün için kalan tarama saatlerini dene
    for (h, m), label in zip(DAILY_RUN_TIMES, session_labels):
        candidate = now_ny.replace(hour=h, minute=m, second=0, microsecond=0)
        if candidate > now_ny:
            return candidate.astimezone(tz.utc), label

    # Bugün bitti — yarının ilk saatine atla, hafta sonu geç
    next_day = now_ny + timedelta(days=1)
    while next_day.weekday() >= 5:   # Cumartesi=5, Pazar=6
        next_day += timedelta(days=1)

    h, m   = DAILY_RUN_TIMES[0]
    label  = session_labels[0]
    target = next_day.replace(hour=h, minute=m, second=0, microsecond=0)
    return target.astimezone(tz.utc), label


async def run_scanner():
    from datetime import timezone as tz

    await send_tg(
        "🚀 <b>BOGA AI v242 BAŞLATILDI!</b>\n"
        "📅 Günde 2 tarama — NY saatiyle:\n"
        "  🌅 11:00  — Gündüz (açılış gürültüsü geçtikten sonra)\n"
        "  🌆 15:30  — Kapanış öncesi (ertesi gün setup'ları)\n\n"
        f"✅ Sektör-önce pipeline ({', '.join(f'{h}:{m:02d}' for h, m in DAILY_RUN_TIMES)} NY)\n"
        f"✅ Earnings &lt;{EARNINGS_HARD_BLOCK_DAYS}g = HARD BLOCK\n"
        "✅ Gamma/Theta oranı kontrat puanlamada\n"
        "✅ Backtesting gerçek sonuç takibi"
    )

    while True:
        try:
            next_run_utc, session = get_next_run_utc()
            wait_sec = (next_run_utc - datetime.now(tz.utc)).total_seconds()

            # Güvenlik: bekleyiş süresi mantıklı aralıkta olmalı
            if wait_sec < 0 or wait_sec > 86400:
                logging.warning(f"Bekleyiş süresi anormal: {wait_sec:.0f}sn — 1 saat bekleniyor")
                await asyncio.sleep(3600)
                continue

            next_ny_str = next_run_utc.astimezone(NY_TZ).strftime("%Y-%m-%d %H:%M NY")
            logging.info(f"⏰ Sonraki tarama: {next_ny_str} ({session}) — {wait_sec/60:.0f} dakika sonra")

            await asyncio.sleep(wait_sec)

            # Global session flag'i ayarla — scan() raporda kullanır
            global SCAN_SESSION
            SCAN_SESSION = session

            await scan()

        except Exception as e:
            logging.error(f"Döngü hatası: {e}")
            await send_tg(f"🚨 Döngü hatası: {e}")
            await asyncio.sleep(3600)


if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    if "--oneshot" in sys.argv:
        # Tek seferlik çalıştırma
        # --eod parametresi ile: python opsiyon241.py --oneshot --eod
        SCAN_SESSION = "eod" if "--eod" in sys.argv else "morning"
        print(f"🚀 BOGA AI v242 (One-Shot) — session: {SCAN_SESSION}")
        print(f"   DTE {DTE_HARD_MIN}-{DTE_MAX}g  |  Earnings hard block: <{EARNINGS_HARD_BLOCK_DAYS}g")
        asyncio.run(scan())
        print("✅ Tamamlandı.")

    elif "--times" in sys.argv:
        # Bir sonraki tarama saatlerini göster
        from datetime import timezone as tz
        print("📅 Tarama programı (NY saatiyle):")
        for (h, m) in DAILY_RUN_TIMES:
            print(f"  {h:02d}:{m:02d} NY")
        next_utc, sess = get_next_run_utc()
        next_ny = next_utc.astimezone(NY_TZ).strftime("%Y-%m-%d %H:%M NY")
        wait    = (next_utc - datetime.now(tz.utc)).total_seconds()
        print(f"\nSonraki: {next_ny} ({sess}) — {wait/60:.0f} dakika sonra")

    else:
        try:
            asyncio.run(run_scanner())
        except KeyboardInterrupt:
            print("\nv242 durduruldu.")
        except Exception as e:
            print(f"Kritik hata: {e}")
