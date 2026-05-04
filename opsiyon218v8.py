"""
🐂 BOGA AI v7.1 — Swing/Position Opportunity Scanner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v5.0→v5.1 KRİTİK YAMALAR (7 ELİT FİX):
═════════════════════════════════════════

✅ FIX-1: EMA200 ZORUNLULUĞU GEVŞETİLDİ (En Büyük Hata Giderildi)
       - Eski: cp < EMA200 → her zaman False (NVDA/TSLA gibi en güçlü runları kaçırıyordu)
       - YENİ: cp < EMA200 → SADECE breakout/golden_cross yoksa False
       - EMA200 altında breakout veya golden cross varsa = GEÇ (en erken yakalanır)

✅ FIX-2: ADX FİLTRESİ BREAKOUT'A ÖZEL TOLERANS
       - Trend başlangıcında ADX genelde 10-18 → eski eşik (15) erken trendleri siliyordu
       - YENİ: EMA200_BREAKOUT / GOLDEN_CROSS modlarında ADX_MIN = 10
       - Diğer modlar: ADX_MIN = 15 (korundu)

✅ FIX-3: BREAKOUT SKORU HACİM DOĞRULAMASI
       - Eski: sadece "dist_from_60h >= 0" = 10 puan (fake breakout'ı ayırt etmiyordu)
       - YENİ: hacim spike (v5 > v30 * 1.2) varsa 10, yoksa 7 puan
       - Hacimsiz breakout = büyük ihtimalle fake → cezalandırılıyor

✅ FIX-4: BASE FORMATION YÖN BIASI
       - Eski: sadece "dar bant" ölçüyordu (accumulation vs dead stock ayırt etmiyordu)
       - YENİ: range_pct < 0.08 AND roc20 > 0 → tam puan (yukarı yön bias şart)
       - range_pct < 0.08 AND roc20 <= 0 → sadece 5 puan (sıkışmış ama yönü belli değil)

✅ FIX-5: BREAKOUT+BASE PUAN AĞIRLIĞI ARTTIRILDI
       - Eski: 10 puan max (total score'un %10'u)
       - YENİ: 20 puan max (total score'un %20'si — trend kaynağı burası)
       - Ağırlıklar: breakout*0.7 + base*0.5 → max 20

✅ FIX-6: OPSİYON DTE SEÇİMİ DÜZELTİLDİ (Scalp Bias Giderildi)
       - Eski: abs(x[1] - 45) → 45 güne en yakın kontrat seçiliyordu (SCALP BIAS!)
       - YENİ: abs(x[1] - DTE_TARGET) → DTE_TARGET = 90g (doğru hedef)

✅ FIX-7: TREND DEVAM FİLTRESİ EKLENDİ (Higher Highs)
       - Eski: giriş yakalıyordu ama "devam eder mi?" bilinmiyordu
       - YENİ: higher_highs = c[-1] > c[-10] > c[-20] → doğruysa +10 bonus puan
       - False ise +0 (ceza yok, ama bonus da yok)

v5.0'dan Korunan Tüm Özellikler:
───────────────────────────────────
📌 EMA Giriş Modları: EMA200_BREAKOUT / GOLDEN_CROSS / NEAR_GOLDEN / TREND_BIRTH / EMA50_BOUNCE
📌 Relative Strength vs SPY (60g karşılaştırma)
📌 Base Formation (VCP - Volatilite Daralması)
📌 DTE 45-90 (hedef 67g) — 3-5 günde etkili swing, max $150 kontrat
📌 IV Rank < 40 (Vega koruması)
📌 Nötr Rejim Yasağı
📌 Time Stop DTE × 0.65

PUANLAMA (0-100):
─────────────────
• EMA Giriş Modu + Yapı       : 0-30
• ADX / Piyasa Rejimi         : 0-15
• VWAP Pozisyonu              : 0-10
• RSI Kalitesi                : 0-10
• Relative Strength (SPY)     : 0-10
• IV Rank Bonusu              : 0-10
• Breakout + Base (ARTTIRILDI): 0-20  ← FIX-5
• Trend Devam (Higher Highs)  : 0-10  ← FIX-7
• Sweep / Likidite            : 0-5
+ Golden Cross Bonusu         : +5
+ EMA200 Breakout Bonusu      : +7
"""

import asyncio
import sys
import io

# Windows konsolunda emoji (UTF-8) hatasını önlemek için
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import logging
import time
import math
import html
import os
import re
import aiohttp
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, date, timezone
from typing import List, Dict, Any, Optional, Tuple
from zoneinfo import ZoneInfo
from ta.volatility import AverageTrueRange
from ta.trend import EMAIndicator, ADXIndicator
from ta.momentum import RSIIndicator

# ─── SciPy / fallback ──────────────────────────────────────────────────────
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
# ⚙️  AYARLAR — v5.0 SWING MOD
# ════════════════════════════════════════════════════════════════════════════

NY_TZ = ZoneInfo("America/New_York")
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
LATEST_DIR = os.path.join(HERE, "transfer", "latest")

# ── Telegram ──────────────────────────────────────────────────────────────
TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"
ENABLE_TELEGRAM  = True

# ── Hisse Filtresi ────────────────────────────────────────────────────────
PRICE_MIN      = 5.0
PRICE_MAX      = 250.0
AVG_VOL_MIN    = 100_000        # ✅ Gevşetildi: 150K → 100K (daha az likit hisseler)
DOLLAR_VOL_MIN = 300_000        # ✅ Gevşetildi: 500K → 300K
ADX_MIN        = 12             # ✅ Gevşetildi: 15 → 12 (zayıf trendleri yakala)
RSI_MIN        = 30             # ✅ Gevşetildi: 35 → 30 (oversold bölgeler)
RSI_MAX        = 80             # Geçti: overbought toleransı

# ── Opsiyon Filtresi (SWING MOD) ──────────────────────────────────────────
DTE_MIN       = 45             # 🎯 3-5 günde etkili swing için min 45g vade
DTE_MAX       = 90             # 🎯 90g üstü uzun vadeli için ayrı mod gerekir
DTE_TARGET    = 67             # 🎯 45-90 ortası — theta/delta dengesi en iyi burada
OI_MIN        = 100            # ✅ Gevşetildi: 150 → 100 (daha az likit kontratlar)
SPREAD_MAX    = 0.08           # 🎯 %8 spread sınırı (ucuz kontrat koruması)
MID_MIN       = 0.10           # ✅ Gevşetildi: 0.15 → 0.10 (daha ucuz kontratlar)
MID_MAX       = 1.50           # 🎯 Max $150 kontrat (mid * 100) için sınır

# ── IV Rank Filtresi (SWING MOD: Daha toleranslı) ───────────────────────
IV_RANK_BUY_MAX   = 55.0       # ✅ Gevşetildi: 40 → 55 (yüksek IV da gat)
IV_RANK_BONUS_MAX = 30.0       # ✅ Gevşetildi: 20 → 30 (bonus aralığı genişletildi)

# ── Theta/Delta Kalite Oranı ──────────────────────────────────────────────
THETA_DELTA_MIN = 0.04         # ✅ Gevşetildi: 0.06 → 0.04 (daha gevşek kalite)

# ── Exit Parametreleri (SWING MOD) ────────────────────────────────────────
TAKE_PROFIT_PCT  = 0.40      # %40 kâr — biraz artırıldı (uzun vade daha fazla kazanır)
STOP_LOSS_PCT    = -0.25     # -%25 zarar — biraz genişletildi (dalgalanma toleransı)
TIME_STOP_RATIO  = 0.65      # ✅ Değişti (eski 0.5) — theta şelalesi son 30 günde başlar

# ── Evren / Tarama ────────────────────────────────────────────────────────
MAX_TICKERS_SCAN = 500
UNIVERSE_TTL     = 24 * 3600
SEMAPHORE_N      = 8
MIN_CANDIDATES   = 5            # ✅ Düşürüldü: 10 → 5 (az da olsa göster)

UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}
MARKET_VIX = {"value": 18.0, "regime": "Orta 🟡"}

# SPY karşılaştırma cache
SPY_RETURN_CACHE: Dict[str, Any] = {"ts": 0.0, "return_60d": 0.0, "return_20d": 0.0}

EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# ════════════════════════════════════════════════════════════════════════════
# 1) TELEGRAM
# ════════════════════════════════════════════════════════════════════════════

def sanitize_html(text: str) -> str:
    if not text:
        return ""
    import re
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
    if len(msg) <= limit:
        return [msg]
    chunks = []
    lines  = msg.split("\n")
    current = ""
    for line in lines:
        candidate = current + ("\n" if current else "") + line
        if len(candidate) > limit:
            if current:
                chunks.append(current)
            if len(line) > limit:
                for i in range(0, len(line), limit):
                    chunks.append(line[i:i+limit])
                current = ""
            else:
                current = line
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks

async def send_tg(msg: str):
    if not ENABLE_TELEGRAM:
        print(msg); return

    safe_msg = sanitize_html(msg)
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"

    async with aiohttp.ClientSession() as s:
        for chunk in split_safe(safe_msg):
            if not chunk.strip():
                continue
            try:
                async with s.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": chunk,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": True
                }, timeout=20) as r:
                    if r.status != 200:
                        body = await r.text()
                        logging.warning(f"TG {r.status}: {body[:200]}")
                        if r.status == 400 and "parse" in body.lower():
                            plain = re.sub(r'<[^>]+>', '', chunk)
                            async with s.post(url, json={
                                "chat_id": TELEGRAM_CHAT_ID,
                                "text": plain[:3800],
                            }, timeout=20) as r2:
                                if r2.status != 200:
                                    logging.warning(f"TG plain retry {r2.status}")
                await asyncio.sleep(0.4)
            except Exception as e:
                logging.error(f"TG gönderim: {e}")

# ════════════════════════════════════════════════════════════════════════════
# 2) VIX + SPY KARŞILAŞTIRMA
# ════════════════════════════════════════════════════════════════════════════

async def update_vix():
    try:
        vd = await asyncio.to_thread(lambda: yf.Ticker("^VIX").history(period="3d"))
        if vd is not None and not vd.empty:
            v = float(vd['Close'].iloc[-1])
            r = "Düşük 🟢" if v < 18 else ("Orta 🟡" if v < 25 else "Yüksek 🔴")
            MARKET_VIX.update({"value": v, "regime": r})
            logging.info(f"🌡️ VIX: {v:.1f} ({r})")
    except Exception as e:
        logging.warning(f"VIX: {e}")

async def update_spy_returns():
    """SPY'nin 60 günlük ve 20 günlük getirisini hesapla (Relative Strength için)."""
    now = time.time()
    if SPY_RETURN_CACHE["ts"] and (now - SPY_RETURN_CACHE["ts"] < 3600):
        return  # 1 saat cache
    try:
        spy_df = await asyncio.to_thread(lambda: yf.Ticker("SPY").history(period="100d", interval="1d"))
        if spy_df is not None and len(spy_df) >= 65:
            c = spy_df['Close'].astype(float)
            r60 = float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100) if len(c) >= 61 else 0.0
            r20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
            SPY_RETURN_CACHE.update({"ts": now, "return_60d": r60, "return_20d": r20})
            logging.info(f"📊 SPY 60g: %{r60:.1f} | 20g: %{r20:.1f}")
    except Exception as e:
        logging.warning(f"SPY: {e}")

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

def calc_hv(close: pd.Series, lb: int = 30) -> float:
    if len(close) < lb + 1: return 0.30
    lr = np.log(close / close.shift(1)).dropna()
    return max(0.05, float(lr.tail(lb).std()) * math.sqrt(252))

def calc_iv_rank(current_iv: float, close: pd.Series) -> Tuple[float, float]:
    try:
        if len(close) < 60: return 50.0, 50.0
        lr  = np.log(close / close.shift(1)).dropna()
        hvs = (lr.rolling(30).std() * math.sqrt(252)).dropna()
        if len(hvs) < 10: return 50.0, 50.0
        mn = float(hvs.min()); mx = float(hvs.max())
        rank = max(0.0, min(100.0, (current_iv - mn) / (mx - mn) * 100)) if (mx - mn) > 0.001 else 50.0
        pct  = float((hvs < current_iv).sum()) / len(hvs) * 100
        return round(rank, 1), round(pct, 1)
    except:
        return 50.0, 50.0

def calc_vwap(df: pd.DataFrame) -> float:
    try:
        d = df.tail(20).copy()
        tp = (d['High'].astype(float) + d['Low'].astype(float) + d['Close'].astype(float)) / 3.0
        vol = d['Volume'].astype(float)
        return round(float((tp * vol).sum() / vol.sum()), 3)
    except:
        return 0.0

def detect_market_regime_swing(adx: float, cp: float, e9: float, e20: float, e50: float,
                                 e200: float, prev_cp: float = 0.0) -> str:
    """
    v7.1 Swing Rejim Tespiti:
    - trend:    EMA dizilimi tam + ADX > 20
    - breakout: EMA200 üstüne yeni geçiş VEYA EMA20 EMA50 üstüne yeni çıkış (golden cross bölgesi)
    - neutral:  zayıf ADX veya karışık EMA
    """
    full_alignment = (e20 > e50 > e200) and (cp > e200)
    ema200_breakout = (prev_cp > 0) and (prev_cp < e200) and (cp >= e200)  # Yeni EMA200 kırılımı

    if ema200_breakout:
        return "breakout"  # En güçlü sinyal — öncelik ver
    elif adx >= 20 and full_alignment:
        return "trend"
    elif adx >= 15 and full_alignment:
        return "breakout"
    else:
        return "neutral"

def bs_pnl_sim(S: float, K: float, iv: float, dte: int,
               move_pct: float = 0.07, days_fwd: int = 21) -> dict:
    """
    ✅ v5.0: days_fwd=21 (eski 7). Swing trade için 3 haftalık simülasyon daha gerçekçi.
    """
    T_now = dte / 365.0
    T_fwd = max((dte - days_fwd) / 365.0, 0.001)
    S_fwd = S * (1 + move_pct)
    iv_fwd = iv * 0.95  # Uzun vadede IV crush daha az şiddetli
    r = 0.05
    p_now = bs_price(S, K, T_now, r, iv)
    p_fwd = bs_price(S_fwd, K, T_fwd, r, iv_fwd)
    pnl_pct = round((p_fwd - p_now) / p_now * 100, 1) if p_now > 0 else 0.0
    return {
        "price_now": round(p_now, 2), "price_fwd": round(p_fwd, 2),
        "pnl_pct": pnl_pct, "S_target": round(S_fwd, 2), "days": days_fwd
    }

# ════════════════════════════════════════════════════════════════════════════
# 4) EVREN YÜKLEYİCİ — Katman 1 (v5.0: RVOL eşiği düşürüldü)
# ════════════════════════════════════════════════════════════════════════════

async def fetch_all_us_tickers() -> List[str]:
    all_tickers: set = set()
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    async with aiohttp.ClientSession() as session:
        for url in EXCHANGE_SOURCES:
            try:
                async with session.get(url, headers=headers, timeout=20) as resp:
                    if resp.status != 200: continue
                    content = await resp.text()
                    for s in content.splitlines():
                        sym = s.strip().upper().split(",")[0].split("\t")[0]
                        if sym.isalpha() and 1 <= len(sym) <= 5:
                            all_tickers.add(sym)
            except Exception as e:
                logging.warning(f"Ticker kaynağı: {e}")
    logging.info(f"✅ Ham ticker: {len(all_tickers)}")
    return list(all_tickers)

async def build_universe() -> List[str]:
    """
    Katman 1: Hızlı toplu OHLCV filtresi.
    v5.0 Swing: RVOL eşiği 1.5x → 0.8x (büyük trendler sessiz başlar!)
    Sıralama: dollar_vol * rvol yerine dollar_vol * rs_score (daha istikrarlı hisseler)
    """
    now = time.time()
    if UNIVERSE_CACHE["data"] and (now - UNIVERSE_CACHE["ts"] < UNIVERSE_TTL):
        logging.info(f"📦 Evren cache: {len(UNIVERSE_CACHE['data'])} hisse")
        return UNIVERSE_CACHE["data"]

    raw = await fetch_all_us_tickers()
    if not raw: return []

    logging.info(f"🚀 {len(raw)} hisse Katman 1 taramasına giriyor...")
    all_rows = []

    for i in range(0, len(raw), 1000):
        chunk = raw[i: i + 1000]
        try:
            data = await asyncio.to_thread(
                yf.download, chunk, period="35d", progress=True,
                threads=True, ignore_tz=True, group_by="ticker"
            )
            if not isinstance(data.columns, pd.MultiIndex):
                if len(chunk) == 1:
                    sym = chunk[0]
                    data.columns = pd.MultiIndex.from_tuples([(sym, c) for c in data.columns])
                else:
                    continue

            for sym in data.columns.get_level_values(0).unique():
                try:
                    close  = data[sym]["Close"].dropna()
                    volume = data[sym]["Volume"].dropna()
                    if len(close) < 6: continue

                    price = float(close.iloc[-1])
                    if not (PRICE_MIN <= price <= PRICE_MAX): continue

                    avg10 = float(volume.tail(10).mean())
                    avg5  = float(volume.tail(5).mean())
                    avg30 = float(volume.tail(30).mean()) if len(volume) >= 30 else avg10
                    dvol  = price * avg10

                    if avg10 < AVG_VOL_MIN: continue
                    if dvol < DOLLAR_VOL_MIN: continue

                    rvol = avg5 / avg30 if avg30 > 0 else 0.0
                    # ✅ v8.0: 0.8 → 0.5 (büyük trendler sessiz başlar, daha fazla aday yakala)
                    if rvol < 0.5: continue

                    roc5 = float((close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]) if len(close) >= 6 else 0.0

                    all_rows.append({
                        "sym": sym, "price": price, "dollar_vol": dvol,
                        "rvol": rvol, "roc5": roc5,
                        "rank_score": dvol,  # ✅ v5.0: Sadece dollar vol ile sırala (liquidity öncelik)
                    })
                except:
                    continue
        except Exception as e:
            logging.warning(f"Chunk {i}: {e}")

    if not all_rows:
        logging.error("❌ Katman 1 sonuç yok.")
        return []

    all_rows.sort(key=lambda r: r["rank_score"], reverse=True)
    selected = [r["sym"] for r in all_rows[:MAX_TICKERS_SCAN]]
    logging.info(f"✅ Katman 1: {len(selected)} hisse geçti.")
    UNIVERSE_CACHE.update({"ts": now, "data": selected})
    return selected

# ════════════════════════════════════════════════════════════════════════════
# 5) KATMAN 2 — EMA TREND + SWING SINYALLER (v5.0 DEVRİM)
# ════════════════════════════════════════════════════════════════════════════

def layer2_ema_trend(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    v5.0 Swing Trend Detector:

    ÜÇ GİRİŞ MODU (birinden geçmek yeterli):
    ─────────────────────────────────────────
    MOD A — Trend Doğumu (En Değerli):
      EMA20 > EMA50 > EMA200 (makro sağlam)
      cp ≈ EMA20 (pullback veya yeni kırılım, %5 tolerans)
      EMA50 slope pozitif (yukarı ivmeli)

    MOD B — EMA200 Breakout (ALTIN SİNYAL):
      cp > EMA200 AND prev_cp < EMA200
      → Hisse EMA200'ü yeni geçiyor = 60-120g trendin başlangıcı

    MOD C — EMA50 Pullback (Swing Giriş):
      cp > EMA200 (makro sağlam)
      cp EMA50'ye yakın sekiyor (dist_ema50 < %4)

    ZORUNLU: cp > EMA200 (dead cat bounce killer — her modda geçerli)
    ZORUNLU: Nötr rejim yasağı
    """
    try:
        c   = df['Close'].astype(float)
        if len(c) < 210: return False, {}

        e9   = EMAIndicator(c, 9).ema_indicator()
        e20  = EMAIndicator(c, 20).ema_indicator()
        e50  = EMAIndicator(c, 50).ema_indicator()
        e200 = EMAIndicator(c, 200).ema_indicator()

        cp    = float(c.iloc[-1])
        e9v   = float(e9.iloc[-1])
        e20v  = float(e20.iloc[-1])
        e50v  = float(e50.iloc[-1])
        e200v = float(e200.iloc[-1])

        # Önceki günün değerleri (breakout tespiti için)
        prev_cp   = float(c.iloc[-2]) if len(c) >= 2 else cp
        prev_e20  = float(e20.iloc[-2]) if len(e20) >= 2 else e20v
        prev_e50  = float(e50.iloc[-2]) if len(e50) >= 2 else e50v

        # EMA50 slope (son 5 gün — breakout tespitinden önce)
        e50_slope = float((e50.iloc[-1] - e50.iloc[-6]) / e50.iloc[-6] * 100) if len(e50) >= 6 else 0.0

        # ────────────────────────────────────────────────────
        # ✅ EARLY TREND DETECTOR: EMA20 EMA50'yi yukarı kesti mi?
        # Bu = Golden Cross (kısa/orta vade) = trend doğumu sinyali
        # ────────────────────────────────────────────────────
        golden_cross = (prev_e20 <= prev_e50) and (e20v > e50v)  # Yeni kırılım
        near_golden  = (e20v > e50v) and ((e20v - e50v) / e50v < 0.03)  # Yeni kırılmış

        # MOD B: EMA200 Breakout tespiti
        ema200_breakout = (prev_cp < e200v) and (cp >= e200v)

        # Giriş modu tespiti
        dist_ema50 = (cp - e50v) / e50v if e50v > 0 else 0.0
        dist_ema20 = (cp - e20v) / e20v if e20v > 0 else 0.0

        # MOD A: Trend Doğumu
        mod_a = (e20v > e50v > e200v) and (dist_ema20 <= 0.08) and (e50_slope >= 0.0)
        # MOD B: EMA200 Breakout
        mod_b = ema200_breakout
        # MOD C: EMA50 Pullback
        mod_c = (e20v > e50v) and (-0.02 <= dist_ema50 <= 0.04)
        # MOD D: Oturmuş Güçlü Trend
        mod_d = (cp > e20v > e50v > e200v) and (e50_slope >= 0.0)

        entry_mode = None
        if mod_b:
            entry_mode = "EMA200_BREAKOUT"
        elif golden_cross:
            entry_mode = "GOLDEN_CROSS"
        elif mod_a and near_golden:
            entry_mode = "NEAR_GOLDEN"
        elif mod_a:
            entry_mode = "TREND_BIRTH"
        elif mod_c:
            entry_mode = "EMA50_BOUNCE"
        elif mod_d:
            entry_mode = "ESTABLISHED_TREND"
        else:
            return False, {}  # BOGA AI Opportunity Zone dışında kaldı

        # ✅ FIX-1: EMA200 ZORUNLULUĞu GEVŞETİLDİ
        # EMA200 altında ama breakout/golden_cross varsa geç — en erken yakalanır
        # EMA200 altında ve bu iki sinyalden biri yoksa → dead cat bounce riski → eله
        if cp < e200v:
            if entry_mode not in ("EMA200_BREAKOUT", "GOLDEN_CROSS"):
                return False, {}
            # EMA200 altında breakout/golden_cross: giriş modunu özel işaretle
            entry_mode = entry_mode + "_BELOW200"  # Raporda görünür uyarı

        # ADX — ✅ FIX-2: Breakout modlarında ADX toleransı gevşetildi
        adx_ind = ADXIndicator(df['High'], df['Low'], c, 14)
        adx_val = float(adx_ind.adx().iloc[-1])
        early_modes = ("EMA200_BREAKOUT", "EMA200_BREAKOUT_BELOW200",
                       "GOLDEN_CROSS", "GOLDEN_CROSS_BELOW200")
        adx_threshold = 10 if entry_mode in early_modes else ADX_MIN
        if adx_val < adx_threshold: return False, {}

        # ★ Rejim tespiti (v8.0)
        regime = detect_market_regime_swing(adx_val, cp, e9v, e20v, e50v, e200v, prev_cp)

        # ★ MODIFIED v8.0: Nötr Rejim - Tamamen yasak değil, ama penaltılı
        # Neutral regime şu hisse henüz trend başlamamışsa, ama hareket etmeye hazırlanıyorsa
        if regime == "neutral":
            # Tamamen reddetme yerine, neutral için entry mode var mı kontrol et
            if entry_mode not in ("EMA200_BREAKOUT", "GOLDEN_CROSS", "NEAR_GOLDEN"):
                # Golden Cross yok, breakout yok = gerçekten nötr = skip
                return False, {}
            # Ama EMA200 breakout veya golden cross varsa → izin ver (çok erken sinyal)
            # regime kalacak "neutral" ama entry_mode onaylanmış

        # VWAP
        vwap = calc_vwap(df)

        # ── EMA Trend Skoru v5.0 (0-30, artırıldı) ──────────────────────
        ema_score = 0.0

        # Giriş moduna göre temel puan
        mode_scores = {
            "EMA200_BREAKOUT": 15.0,  # En değerli — 60-120g trendin başlangıcı
            "GOLDEN_CROSS":    13.0,  # Çok değerli — kısa/orta vade crossover
            "NEAR_GOLDEN":     10.0,
            "TREND_BIRTH":      8.0,
            "ESTABLISHED_TREND": 7.0, # Oturmuş trend onayı
            "EMA50_BOUNCE":     6.0,
        }
        ema_score += mode_scores.get(entry_mode, 0.0)

        # EMA dizilim bonusu
        if e20v > e50v:   ema_score += 3.0
        if e50v > e200v:  ema_score += 3.0
        if e9v > e20v:    ema_score += 2.0

        # EMA50 slope bonusu
        if e50_slope >= 0.3:   ema_score += 4.0
        elif e50_slope >= 0.1: ema_score += 2.0
        elif e50_slope >= 0.0: ema_score += 1.0

        # Pullback kalitesi: fiyat EMA50'ye ne kadar yakın? (v5.0: EMA20 yerine EMA50)
        if 0.0 <= dist_ema50 <= 0.03:       ema_score += 5.0  # EMA50'den mükemmel sekme
        elif 0.03 < dist_ema50 <= 0.06:     ema_score += 3.0
        elif dist_ema50 > 0.15:             ema_score += 0.0  # Çok uzakta
        else:                               ema_score += 1.5

        # Düşük hacimli geri çekilme = sağlıklı konsolidasyon
        try:
            vol = df['Volume'].astype(float)
            if vol.tail(3).mean() < vol.tail(20).mean():
                ema_score += 2.0
        except:
            pass

        ema_score = min(ema_score, 30.0)

        # ── ADX Skoru (0-15) ───────────────────────────────────────────
        if adx_val >= 35:    adx_score = 15.0
        elif adx_val >= 28:  adx_score = 12.0
        elif adx_val >= 20:  adx_score = 8.0
        elif adx_val >= 14:  adx_score = 5.0
        else:                adx_score = 2.0

        # ── VWAP Skoru (0-10) ─────────────────────────────────────────
        vwap_ok = (vwap > 0 and cp >= vwap)
        if cp >= vwap * 1.01:   vwap_score = 10.0
        elif cp >= vwap:        vwap_score = 6.0
        elif cp >= vwap * 0.98: vwap_score = 2.0
        else:
            vwap_ok    = False
            vwap_score = 0.0

        # EMA pattern etiketi
        if entry_mode == "EMA200_BREAKOUT":
            ema_pattern = "⚡EMA200 KIRILIM ✅"
        elif entry_mode == "GOLDEN_CROSS":
            ema_pattern = "🌟GOLDEN CROSS ✅"
        elif entry_mode == "NEAR_GOLDEN":
            ema_pattern = "🔜NEAR GOLDEN ✅"
        elif cp > e9v > e20v > e50v > e200v:
            ema_pattern = "EMA9>20>50>200 ✅"
        elif e20v > e50v > e200v:
            ema_pattern = "EMA20>50>200 ✅"
        else:
            ema_pattern = f"MOD:{entry_mode}"

        return True, {
            "ema9":  round(e9v, 3), "ema20": round(e20v, 3),
            "ema50": round(e50v, 3), "ema200": round(e200v, 3),
            "cp":    round(cp, 3),
            "ema_score":   round(ema_score, 1),
            "adx":         round(adx_val, 1),
            "adx_score":   round(adx_score, 1),
            "regime":      regime,
            "vwap":        round(vwap, 3),
            "vwap_ok":     vwap_ok,
            "vwap_score":  round(vwap_score, 1),
            "dist_ema20":  round(dist_ema20 * 100, 2),
            "dist_ema50":  round(dist_ema50 * 100, 2),
            "ema_pattern": ema_pattern,
            "entry_mode":  entry_mode,
            "golden_cross": golden_cross,
            "ema200_breakout": ema200_breakout,
            "e50_slope":   round(e50_slope, 3),
        }
    except Exception as e:
        logging.debug(f"Katman2: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 6) KATMAN 3 — MOMENTUM + SWING GÖSTERGELER (v5.0)
# ════════════════════════════════════════════════════════════════════════════

def layer3_momentum(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    v5.0 Swing Momentum:
    + Relative Strength vs SPY (piyasadan güçlü mü?)
    + 60-Günlük Breakout Skoru (yeni zirve yakınında mı?)
    + Base Formation Skoru (sıkışma = patlama habercisi)
    + RSI "ideal giriş zonu" 45-65 (eski zirve değil, taze momentum)
    """
    try:
        c   = df['Close'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 65: return False, {}

        # RSI
        rsi_series = RSIIndicator(c, 14).rsi()
        rsi = float(rsi_series.iloc[-1])
        if not (RSI_MIN <= rsi <= RSI_MAX): return False, {}

        # RVOL (v5.0: 0.8 eşiği — büyük trendler sessiz başlar)
        v5  = float(vol.tail(5).mean())
        v30 = float(vol.tail(30).mean()) if len(vol) >= 30 else float(vol.tail(10).mean())
        rvol = v5 / v30 if v30 > 0 else 1.0
        if rvol < 0.5: return False, {}

        # RSI Skoru (0-10): v5.0 Swing için ideal = 45-65 (taze momentum, henüz aşırı alım yok)
        if 45 <= rsi <= 65:   rsi_score = 10.0
        elif 40 <= rsi < 45:  rsi_score = 7.0
        elif 65 < rsi <= 70:  rsi_score = 5.0
        elif 35 <= rsi < 40:  rsi_score = 3.0
        else:                 rsi_score = 1.0

        # RVOL Skoru (0-5): v5.0'da swing botta daha az ağırlık
        rvol_score = min(max((rvol - 0.8) / 2.0 * 5.0, 0.0), 5.0)

        # ROC
        roc5  = float((c.iloc[-1] - c.iloc[-6]) / c.iloc[-6] * 100) if len(c) >= 6 else 0.0
        roc20 = float((c.iloc[-1] - c.iloc[-21]) / c.iloc[-21] * 100) if len(c) >= 21 else 0.0
        roc60 = float((c.iloc[-1] - c.iloc[-61]) / c.iloc[-61] * 100) if len(c) >= 61 else 0.0

        # ────────────────────────────────────────────────────
        # ✅ FIX-3: 60-Günlük Breakout Skoru — HACİM DOĞRULAMASI EKLENDİ
        # Hacimsiz breakout = büyük ihtimalle fake → cezalandırılıyor
        # ────────────────────────────────────────────────────
        high_60 = float(c.tail(60).max())
        cp = float(c.iloc[-1])
        dist_from_60h = (cp - high_60) / high_60 if high_60 > 0 else -1.0
        volume_spike = v5 > v30 * 1.2  # Hacim spike: son 5g ortalaması 30g ortalamasının %20 üstünde

        if dist_from_60h >= 0 and volume_spike:  breakout_score = 10.0  # Hacimli kırılım — gerçek!
        elif dist_from_60h >= 0:                  breakout_score = 7.0   # Hacimsiz kırılım — şüpheli
        elif dist_from_60h >= -0.02:              breakout_score = 8.0   # %2 içinde, yakında kırabilir
        elif dist_from_60h >= -0.05:              breakout_score = 5.0
        elif dist_from_60h >= -0.10:              breakout_score = 2.0
        else:                                      breakout_score = 0.0

        # ────────────────────────────────────────────────────
        # ✅ YENİ: Base Formation Skoru (0-10)
        # ────────────────────────────────────────────────────
        # ✅ FIX-4: Base Formation — YÖN BIASI EKLENDİ (VCP - Minervini)
        # Sadece "dar bant" değil, "yukarı yönlü sıkışma" şart
        # accumulation vs dead stock ayrımı yapılıyor
        # ────────────────────────────────────────────────────
        range_30 = float(c.tail(30).max() - c.tail(30).min())
        range_pct = range_30 / cp if cp > 0 else 1.0

        if range_pct < 0.08 and roc20 > 0:    base_score = 10.0  # Sıkışmış + yukarı yön bias ✅
        elif range_pct < 0.08:                 base_score = 5.0   # Sıkışmış ama yön belirsiz
        elif range_pct < 0.12 and roc20 > 0:  base_score = 7.0
        elif range_pct < 0.12:                 base_score = 4.0
        elif range_pct < 0.18 and roc20 > 0:  base_score = 4.0
        elif range_pct < 0.18:                 base_score = 2.0
        elif range_pct < 0.25:                 base_score = 1.0
        else:                                  base_score = 0.0

        # ────────────────────────────────────────────────────
        # ✅ FIX-7: TREND DEVAM FİLTRESİ — Higher Highs (0-10)
        # Bot giriş yakalıyor, ama "devam eder mi?" bilmiyordu
        # Higher Highs = trendin canlı olduğunun en güçlü kanıtı
        # ────────────────────────────────────────────────────
        try:
            higher_highs = (float(c.iloc[-1]) > float(c.iloc[-10]) > float(c.iloc[-20]))
            
            # RSI ve Momentum İvmesi
            rsi_now = float(rsi)  # Katman 3 başında hesaplandı
            rsi_5ago = float(rsi_series.iloc[-6]) if len(rsi_series) >= 6 else rsi_now
            rsi_accelerating = (rsi_now > rsi_5ago) and (rsi_now > 50)
            momentum_accel = (roc5 > 0) and (abs(roc5) > abs(roc20) * 0.4)
            
            # Puanlama
            if higher_highs and rsi_accelerating and momentum_accel:
                trend_continuation_score = 10.0
            elif higher_highs and (rsi_accelerating or momentum_accel):
                trend_continuation_score = 7.0
            elif higher_highs:
                trend_continuation_score = 4.0
            elif rsi_accelerating and momentum_accel:
                trend_continuation_score = 2.0
            else:
                trend_continuation_score = 0.0
                
            # Hacim trendi (v5 ve v30 üstte mevcut)
            if v5 > v30 and trend_continuation_score > 0:
                trend_continuation_score = min(trend_continuation_score + 2.0, 10.0)
        except:
            higher_highs = False
            trend_continuation_score = 0.0

        # ────────────────────────────────────────────────────
        # ✅ Relative Strength vs SPY (0-10)
        # ────────────────────────────────────────────────────
        spy_r60 = SPY_RETURN_CACHE.get("return_60d", 0.0)
        spy_r20 = SPY_RETURN_CACHE.get("return_20d", 0.0)
        rs_60 = roc60 - spy_r60
        rs_20 = roc20 - spy_r20

        if rs_60 >= 10:     rs_score = 10.0
        elif rs_60 >= 5:    rs_score = 7.0
        elif rs_60 >= 2:    rs_score = 5.0
        elif rs_60 >= 0:    rs_score = 3.0
        elif rs_60 >= -3:   rs_score = 1.0
        else:               rs_score = 0.0

        # ────────────────────────────────────────────────────
        # ✅ v6-ENHANCEMENT-1: RISK/REWARD SCORE (Game Changer!)
        # Potansiyel kazanç puan ile — %80 potansiyeli %20'ye tercih et
        # ────────────────────────────────────────────────────
        distance_to_high = (cp - high_60) / high_60 if high_60 > 0 else -1.0
        
        if distance_to_high >= 0.0:          rr_score = 10.0  # Zirve kırıldı — momentum en güçlü
        elif distance_to_high >= -0.03:      rr_score = 8.0   # %3 içinde — kırılım yakın
        elif distance_to_high >= -0.08:      rr_score = 5.0   # %8 içinde — güçlü pullback bölgesi
        elif distance_to_high >= -0.15:      rr_score = 2.0   # %15 altında — zayıf
        else:                                rr_score = 0.0   # Uzak — momentum yok
        
        # ATR
        atr_v   = float(AverageTrueRange(df['High'], df['Low'], c, 14).average_true_range().iloc[-1])
        atr_pct = (atr_v / cp) * 100

        return True, {
            "rsi": round(rsi, 1), "rvol": round(rvol, 2),
            "rsi_score":     round(rsi_score, 1),
            "rvol_score":    round(rvol_score, 1),
            "roc5_pct":      round(roc5, 2),
            "roc20_pct":     round(roc20, 2),
            "roc60_pct":     round(roc60, 2),
            "atr_pct":       round(atr_pct, 2),
            "hv30":          round(calc_hv(c, 30), 4),
            "breakout_score": round(breakout_score, 1),
            "volume_spike":  volume_spike,
            "base_score":    round(base_score, 1),
            "rs_score":      round(rs_score, 1),
            "rs_60d":        round(rs_60, 1),
            "high_60":       round(high_60, 2),
            "range_pct_30":  round(range_pct * 100, 1),
            "higher_highs":  higher_highs,
            "trend_continuation_score": round(trend_continuation_score, 1),
            "distance_to_high": round(distance_to_high * 100, 1),
            "rr_score":      round(rr_score, 1),  # v6 enhancement
        }
    except Exception as e:
        logging.debug(f"Katman3: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 7) KATMAN 4 — OPSİYON ZİNCİRİ (v5.0: Uzun Vade Kalibrasyonu)
# ════════════════════════════════════════════════════════════════════════════

def max_pain(calls: pd.DataFrame, puts: pd.DataFrame, cp: float) -> float:
    try:
        strikes = sorted(set(list(calls['strike'].values) + list(puts['strike'].values)))
        bp = cp; bv = float('inf')
        for ts in strikes:
            cv = float(calls[calls['strike'] <= ts]['openInterest'].sum() * max(0, ts - cp))
            pv = float(puts[puts['strike'] >= ts]['openInterest'].sum() * max(0, cp - ts))
            if cv + pv < bv: bv = cv + pv; bp = ts
        return bp
    except:
        return cp

async def layer4_options(
    ticker: str, cp: float, close: pd.Series,
    hv30: float, l2: dict, l3: dict
) -> Optional[dict]:
    """
    v5.0 Swing Opsiyon Tarayıcı:
    ─────────────────────────────
    1. DTE hedefi 90g (eski 45g) — ✅ Değişti
    2. IV Rank < 40 (eski 60) — ✅ Daha sıkı (Vega riski)
    3. Delta aralığı düşürüldü — ✅ Daha ucuz + leverage
    4. P&L sim 21g (eski 7g) — ✅ Gerçekçi swing sim
    5. Time Stop DTE×0.65 (eski 0.5) — ✅ Theta şelalesi koruması
    """
    try:
        stock = yf.Ticker(ticker)
        exps  = await asyncio.to_thread(lambda: stock.options)
        if not exps: return None

        today = date.today()
        valid_exps = []
        for d in exps:
            try:
                dte_d = (datetime.strptime(d, "%Y-%m-%d").date() - today).days
                if DTE_MIN <= dte_d <= DTE_MAX:
                    valid_exps.append((d, dte_d))
            except:
                pass
        if not valid_exps: return None

        # ✅ v5.0: 90 güne en yakın vadeyi seç (eski 45g)
        valid_exps.sort(key=lambda x: abs(x[1] - DTE_TARGET))
        exp_date, dte = valid_exps[0]

        chain = await asyncio.to_thread(lambda: stock.option_chain(exp_date))
        calls = chain.calls
        puts  = chain.puts if hasattr(chain, 'puts') else pd.DataFrame()
        if calls is None or calls.empty: return None

        mp = max_pain(calls, puts if not puts.empty else pd.DataFrame(), cp)

        # ATM IV ve Expected Move
        atm_row = calls.iloc[(calls['strike'] - cp).abs().argsort().iloc[:1]]
        atm_iv  = float(atm_row['impliedVolatility'].values[0]) if not atm_row.empty else max(hv30 * 1.2, 0.15)
        em       = calc_expected_move(cp, atm_iv, dte)
        em_upper = cp + em

        # ✅ v5.0: IV Rank < 40 (eski 60) — uzun vadede yüksek IV intihardır
        iv_rank, iv_pct = calc_iv_rank(atm_iv, close)
        if iv_rank > IV_RANK_BUY_MAX:
            logging.debug(f"{ticker} → IV Rank çok yüksek ({iv_rank:.0f}) — Vega crush riski, atlandı")
            return None

        # IV Rank Bonusu (0-10)
        if iv_rank <= IV_RANK_BONUS_MAX:   iv_bonus = 10.0
        elif iv_rank <= 30.0:               iv_bonus = 6.0
        elif iv_rank <= IV_RANK_BUY_MAX:    iv_bonus = 2.0
        else:                               iv_bonus = 0.0

        # ────────────────────────────────────────────────────
        # ✅ v6-ENHANCEMENT-2: IV vs HV MISPRICING (Opsiyon Edge)
        # IV düşükse = ucuz opsiyon = daha iyi risk/reward
        # ────────────────────────────────────────────────────
        iv_vs_hv = atm_iv / hv30 if hv30 > 0 else 1.0
        
        if iv_vs_hv < 0.85:        mispricing_score = 10.0  # Çok ucuz opsiyon
        elif iv_vs_hv < 0.95:      mispricing_score = 7.0   # Ucuz
        elif iv_vs_hv < 1.15:      mispricing_score = 3.0   # Fair
        else:                      mispricing_score = 0.0   # Pahalı

        # ────────────────────────────────────────────────────
        # ✅ v6-ENHANCEMENT-4: DYNAMIC EXIT (Risk/Reward Bazlı)
        # Expected Move büyükse = daha büyük TP hedefle
        # ────────────────────────────────────────────────────
        # ── BOGA AI: DTE bazlı dinamik simülasyon ve zaman durağı ───────────
        if dte <= 14:
            sim_days_fwd = 2      # Haftalık kontratlar: 2 gün sim
            time_stop_ratio = 0.50
        elif dte <= 45:
            sim_days_fwd = 4      # Kısa vadeli: 4 gün swing
            time_stop_ratio = 0.55
        elif dte <= 90:
            sim_days_fwd = 5      # 🎯 HEDEF BÖLGE: 5 günlük swing sim (1 hafta)
            time_stop_ratio = 0.60
        elif dte <= 120:
            sim_days_fwd = 10     # Orta vadeli: 2 hafta
            time_stop_ratio = 0.65
        else:
            sim_days_fwd = 21     # Uzun vadeli: 3 hafta
            time_stop_ratio = 0.70

        em_to_price_ratio = em / cp if cp > 0 else 0.0
        
        if em_to_price_ratio > 0.20:      # Yüksek Expected Move
            dynamic_tp_pct = 0.60
            dynamic_sl_pct = -0.30
        elif em_to_price_ratio > 0.12:
            dynamic_tp_pct = 0.45
            dynamic_sl_pct = -0.25
        else:
            dynamic_tp_pct = 0.35
            dynamic_sl_pct = -0.20

        # ── BOGA AI: Dinamik Delta Rejime Göre ──────────────────────────────
        regime = l2.get("regime", "neutral")  # 🎯 ÖNCE ATAMA YAPILDI
        
        # trend: daha ATM (yüksek delta) — güçlü trend momentum'u al
        # breakout: biraz OTM — kırılım genişleme potansiyeli
        # neutral: ATM yakını — daha defansif
        DELTA_BY_REGIME = {
            "trend":    (0.45, 0.62),   # ATM odaklı — güçlü trend için
            "breakout": (0.40, 0.58),   # Biraz OTM — kırılım potansiyeli
            "neutral":  (0.42, 0.56),   # En defansif — ATM±1 strike bandı
        }
        
        # Momentum ivmesi kontrolü (`l3` içindeki verilerle)
        roc5_val = l3.get("roc5_pct", 0.0)
        roc20_val = l3.get("roc20_pct", 0.0)
        if roc5_val > 0 and (roc5_val / max(abs(roc20_val), 0.001) > 0.5):
            lo, hi = DELTA_BY_REGIME.get(regime, (0.42, 0.56))
            DELTA_BY_REGIME[regime] = (max(lo - 0.03, 0.30), min(hi + 0.05, 0.70))

        # ── BOGA AI: DTE bazlı dinamik vol_oi eşiği ─────────────────────────
        # Kısa vadeli (1-30g): yüksek likidite şart
        # Orta vadeli (31-90g): normal
        # Uzun vadeli (91-360g): çok daha az hacim normal
        if dte <= 30:
            vol_oi_threshold = 0.15
        elif dte <= 90:
            vol_oi_threshold = 0.08
        else:
            vol_oi_threshold = 0.04  # LEAPS için hacim şartı esnetildi

        delta_min, delta_max = DELTA_BY_REGIME.get(regime, DELTA_BY_REGIME["neutral"])

        # Temel filtre
        calls = calls[(calls['bid'] > 0.03) & (calls['ask'] > 0.03)].copy()
        if calls.empty: return None
        calls['mid']        = (calls['bid'] + calls['ask']) / 2.0
        calls['spread_pct'] = (calls['ask'] - calls['bid']) / calls['ask']

        r = 0.05
        T = dte / 365.0

        institutional = None
        asymmetric    = None
        inst_best     = -999.0
        asym_best     = -999.0

        for _, row in calls.iterrows():
            try:
                strike   = float(row['strike'])
                iv       = float(row.get('impliedVolatility', atm_iv) or atm_iv)
                bid      = float(row['bid'])
                ask      = float(row['ask'])
                mid      = float(row['mid'])
                spread_p = float(row['spread_pct'])
                oi       = int(row.get('openInterest', 0) or 0)
                volume   = int(row.get('volume', 0) or 0)

                if spread_p > SPREAD_MAX: continue
                if oi < OI_MIN: continue
                if mid < MID_MIN: continue             # Alt sınır: $0.10 minimum
                if (ask * 100.0) > 150.0: continue     # 🎯 Gerçek maliyet üst sınırı: ask * 100 <= $150

                # Expected Move Filtresi
                if strike > em_upper * 1.05:  # v5.0: %5 tolerans (uzun vadede EM daha geniş)
                    continue

                g     = bs_greeks(cp, strike, T, r, iv)
                delta = g['delta']
                theta = g['theta']

                # Theta/Delta Kalite Filtresi
                if theta != 0:
                    theta_delta_ratio = abs(delta / theta)
                    if theta_delta_ratio < THETA_DELTA_MIN:
                        continue
                else:
                    theta_delta_ratio = 999.0

                vol_oi_ratio = volume / oi if oi > 0 else 0.0

                # Delta aralıklarını hesapla
                inst_delta_min = delta_min + (delta_max - delta_min) * 0.4
                inst_delta_max = delta_max
                asym_delta_min = delta_min
                asym_delta_max = delta_min + (delta_max - delta_min) * 0.6

                # ── 🛡️ KURUMSAL SIĞINAK ──────────────────────────────────
                if inst_delta_min <= delta <= inst_delta_max:
                    liq_score = 0.0
                    if spread_p <= 0.02:   liq_score += 5.0   # < %2 mükemmel
                    elif spread_p <= 0.04: liq_score += 3.5   # < %4 çok iyi
                    elif spread_p <= 0.08: liq_score += 1.5   # < %8 kabul edilebilir
                    if oi >= 2000: liq_score += 3.0
                    elif oi >= 800: liq_score += 2.0
                    elif oi >= 300: liq_score += 1.0
                    if volume >= 500: liq_score += 2.0
                    elif volume >= 150: liq_score += 1.0
                    liq_score = min(liq_score, 10.0)

                    sweep_score = min(vol_oi_ratio * 5.0, 5.0)  # v5.0: sweep daha az ağırlık
                    td_bonus = min((theta_delta_ratio - THETA_DELTA_MIN) / 2.0, 5.0)

                    inst_score = delta * 4.0 + g['gamma'] * 1200.0 + liq_score + sweep_score + td_bonus

                    if inst_score > inst_best:
                        inst_best = inst_score
                        # ✅ v5.0: 21 günlük P&L sim (eski 7g)
                        atr_pct_val = l3.get("atr_pct", 2.0) / 100.0
                        swing_move_pct = min(max(atr_pct_val * 3.0, 0.03), 0.18)
                        sim = bs_pnl_sim(cp, strike, iv, dte, move_pct=swing_move_pct, days_fwd=sim_days_fwd)

                        # ✅ v6-ENHANCEMENT-4: DYNAMIC EXIT (expected move bazlı)
                        tp_price  = round(mid * (1 + dynamic_tp_pct), 2)
                        sl_price  = round(mid * (1 + dynamic_sl_pct), 2)
                        # BOGA AI: DTE bazlı dinamik time stop
                        time_stop = round(dte * (1 - time_stop_ratio))

                        institutional = {
                            "type": "🛡️ KURUMSAL SIĞINAK",
                            "regime": regime,
                            "strike": strike, "expiration": exp_date, "dte": dte,
                            "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                            "spread_pct": round(spread_p * 100, 1),
                            "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi_ratio, 3),
                            "iv_pct": round(iv * 100, 1),
                            "delta": round(delta, 3), "gamma": round(g['gamma'], 5),
                            "theta": round(theta, 4), "vega": round(g['vega'], 4),
                            "theta_delta_ratio": round(theta_delta_ratio, 2),
                            "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                            "cost_per_contract": round(ask * 100, 0),
                            "liq_score": round(liq_score, 1), "sweep_score": round(sweep_score, 1),
                            "score": round(inst_score, 2), "sim": sim,
                            "breakeven": round(strike + ask, 2),
                            "tp_price": tp_price, "sl_price": sl_price, "time_stop_days": time_stop,
                        }

                # ── 🚀 ASİMETRİK FIRSAT ────────────────────────────────
                elif asym_delta_min <= delta < asym_delta_max:
                    if vol_oi_ratio < vol_oi_threshold: continue  # BOGA AI: DTE bazlı dinamik eşik

                    if vol_oi_ratio >= 2.0:   sweep_score = 15.0
                    elif vol_oi_ratio >= 1.0: sweep_score = 8.0
                    elif vol_oi_ratio >= 0.5: sweep_score = 4.0
                    else:                     sweep_score = 0.0

                    gamma_score = min(g['gamma'] * 30000.0, 8.0)

                    liq_score = 0.0
                    if spread_p <= 0.03: liq_score += 4.0   # < %3 çok iyi
                    elif spread_p <= 0.06: liq_score += 2.5   # < %6 iyi
                    elif spread_p <= 0.08: liq_score += 1.0   # < %8 kabul edilebilir
                    if oi >= 800: liq_score += 2.0
                    elif oi >= 350: liq_score += 1.0
                    if volume >= 200: liq_score += 2.0
                    elif volume >= 80: liq_score += 1.0
                    liq_score = min(liq_score, 8.0)

                    td_bonus = min((theta_delta_ratio - THETA_DELTA_MIN) / 2.0, 5.0)
                    asym_score = sweep_score + gamma_score + liq_score + delta * 3.0 + td_bonus

                    if asym_score > asym_best:
                        asym_best = asym_score
                        atr_pct_val = l3.get("atr_pct", 2.0) / 100.0
                        swing_move_pct = min(max(atr_pct_val * 3.0, 0.04), 0.20)
                        sim = bs_pnl_sim(cp, strike, iv, dte, move_pct=swing_move_pct, days_fwd=sim_days_fwd)

                        # ✅ v6-ENHANCEMENT-4: DYNAMIC EXIT (expected move bazlı)
                        tp_price  = round(mid * (1 + dynamic_tp_pct), 2)
                        sl_price  = round(mid * (1 + dynamic_sl_pct), 2)
                        time_stop = round(dte * (1 - time_stop_ratio))  # BOGA AI: DTE bazlı dinamik

                        asymmetric = {
                            "type": "🚀 ASİMETRİK FIRSAT",
                            "regime": regime,
                            "strike": strike, "expiration": exp_date, "dte": dte,
                            "bid": round(bid, 2), "ask": round(ask, 2), "mid": round(mid, 2),
                            "spread_pct": round(spread_p * 100, 1),
                            "oi": oi, "volume": volume, "vol_oi_ratio": round(vol_oi_ratio, 3),
                            "iv_pct": round(iv * 100, 1),
                            "delta": round(delta, 3), "gamma": round(g['gamma'], 5),
                            "theta": round(theta, 4), "vega": round(g['vega'], 4),
                            "theta_delta_ratio": round(theta_delta_ratio, 2),
                            "daily_decay_pct": round(abs(theta) / mid * 100, 2) if mid > 0 else 0,
                            "cost_per_contract": round(ask * 100, 0),
                            "sweep_score": round(sweep_score, 1), "gamma_score": round(gamma_score, 1),
                            "liq_score": round(liq_score, 1), "score": round(asym_score, 2),
                            "sim": sim, "breakeven": round(strike + ask, 2),
                            "em_upper": round(em_upper, 2),
                            "tp_price": tp_price, "sl_price": sl_price, "time_stop_days": time_stop,
                        }
            except:
                continue

        if not institutional and not asymmetric:
            return None

        return {
            "exp_date": exp_date, "dte": dte,
            "max_pain": round(mp, 2),
            "em": em, "em_upper": round(em_upper, 2),
            "atm_iv": round(atm_iv * 100, 1),
            "iv_rank": iv_rank, "iv_pct_rank": iv_pct,
            "iv_bonus": iv_bonus,
            "iv_vs_hv": round(iv_vs_hv, 3),
            "mispricing_score": round(mispricing_score, 1),  # v6 enhancement
            "regime": regime,
            "institutional": institutional,
            "asymmetric": asymmetric,
        }
    except Exception as e:
        logging.debug(f"{ticker} opsiyon hatası: {e}")
        return None

# ════════════════════════════════════════════════════════════════════════════
# 7.5) BOGA AI — UNUSUAL OPTIONS ACTIVITY (UOA) + EARNINGS FILTER
# ════════════════════════════════════════════════════════════════════════════

async def detect_uoa(ticker: str, cp: float) -> dict:
    """
    🐂 BOGA AI UOA Dedektörü:
    Kurumsal para akışını yakala — büyük oyuncuların CALL alımını tespit et.

    UOA sinyalleri:
    1. Vol/OI oranı yüksek (günlük hacim açık pozisyonun %50'sinden fazla)
    2. Büyük CALL blokları (OTM kontratlar + yüksek premium)
    3. Put/Call oranı düşük (bullish akış dominant)
    4. IV spike (bir strike'ta anormal IV artışı = gizli alım)
    """
    result = {
        "uoa_score": 0.0,
        "uoa_signal": "—",
        "put_call_ratio": 0.0,
        "unusual_call_vol": False,
        "big_block_detected": False,
        "iv_spike_detected": False,
        "earnings_days": None,
        "earnings_warning": False,
    }
    try:
        stock = yf.Ticker(ticker)
        today = date.today()

        # ── Earnings tarihi kontrolü ──────────────────────────────────────
        try:
            cal = await asyncio.to_thread(lambda: stock.calendar)
            if cal is not None and not cal.empty:
                # yfinance calendar formatı değişken olabiliyor
                if isinstance(cal, dict):
                    earn_date = cal.get("Earnings Date", [None])[0]
                elif hasattr(cal, 'T'):
                    earn_row = cal.T.get("Earnings Date", None)
                    earn_date = earn_row.iloc[0] if earn_row is not None and len(earn_row) > 0 else None
                else:
                    earn_date = None

                if earn_date is not None:
                    import pandas as pd
                    if hasattr(earn_date, 'date'):
                        earn_date = earn_date.date()
                    elif isinstance(earn_date, str):
                        earn_date = datetime.strptime(earn_date[:10], "%Y-%m-%d").date()
                    days_to_earn = (earn_date - today).days
                    result["earnings_days"] = days_to_earn
                    # Earnings 1-14 gün içindeyse uyar (IV crush riski)
                    if 0 <= days_to_earn <= 14:
                        result["earnings_warning"] = True
        except Exception:
            pass

        # ── Opsiyon zinciri UOA analizi ──────────────────────────────────
        exps = await asyncio.to_thread(lambda: stock.options)
        if not exps:
            return result

        # En yakın 3 vade için analiz
        near_exps = []
        for d in exps:
            try:
                dte_d = (datetime.strptime(d, "%Y-%m-%d").date() - today).days
                if 1 <= dte_d <= 90:
                    near_exps.append((d, dte_d))
            except:
                pass
        near_exps.sort(key=lambda x: x[1])
        near_exps = near_exps[:3]

        total_call_vol = 0
        total_put_vol  = 0
        total_call_oi  = 0
        max_vol_oi     = 0.0
        big_premium_sum = 0.0
        iv_values = []

        for exp_d, dte_d in near_exps:
            try:
                chain = await asyncio.to_thread(lambda e=exp_d: stock.option_chain(e))
                calls = chain.calls
                puts  = chain.puts if hasattr(chain, 'puts') else pd.DataFrame()

                if calls is not None and not calls.empty:
                    calls = calls.copy()
                    calls['volume']       = pd.to_numeric(calls.get('volume', 0), errors='coerce').fillna(0)
                    calls['openInterest'] = pd.to_numeric(calls.get('openInterest', 0), errors='coerce').fillna(0)
                    calls['ask']          = pd.to_numeric(calls.get('ask', 0), errors='coerce').fillna(0)
                    calls['impliedVolatility'] = pd.to_numeric(calls.get('impliedVolatility', 0.3), errors='coerce').fillna(0.3)

                    cv = float(calls['volume'].sum())
                    co = float(calls['openInterest'].sum())
                    total_call_vol += cv
                    total_call_oi  += co

                    # Vol/OI oranı (her strike için)
                    for _, row in calls.iterrows():
                        oi_  = float(row['openInterest'])
                        vol_ = float(row['volume'])
                        iv_  = float(row['impliedVolatility'])
                        ask_ = float(row['ask'])
                        strike_ = float(row['strike'])

                        if oi_ > 50 and vol_ > 0:
                            voi = vol_ / oi_
                            if voi > max_vol_oi:
                                max_vol_oi = voi

                        # Büyük blok: OTM call + yüksek premium
                        if strike_ > cp * 1.05 and ask_ > 1.0 and vol_ > 100:
                            big_premium_sum += vol_ * ask_ * 100  # toplam dolar değeri

                        if iv_ > 0.05:
                            iv_values.append(iv_)

                if puts is not None and not puts.empty:
                    puts = puts.copy()
                    puts['volume'] = pd.to_numeric(puts.get('volume', 0), errors='coerce').fillna(0)
                    total_put_vol += float(puts['volume'].sum())

            except Exception:
                continue

        # ── UOA Sinyali Hesapla ───────────────────────────────────────────
        uoa_score = 0.0

        # 1. Put/Call oranı
        pc_ratio = total_put_vol / total_call_vol if total_call_vol > 0 else 1.0
        result["put_call_ratio"] = round(pc_ratio, 2)
        if pc_ratio < 0.5:    uoa_score += 20.0  # Çok bullish akış
        elif pc_ratio < 0.7:  uoa_score += 12.0
        elif pc_ratio < 1.0:  uoa_score += 6.0
        elif pc_ratio > 1.5:  uoa_score -= 5.0   # Bearish akış

        # 2. Anormal hacim spike
        if max_vol_oi > 3.0:
            result["unusual_call_vol"] = True
            uoa_score += 25.0
        elif max_vol_oi > 1.5:
            result["unusual_call_vol"] = True
            uoa_score += 15.0
        elif max_vol_oi > 0.8:
            uoa_score += 8.0

        # 3. Büyük premium blok (kurumsal akış)
        if big_premium_sum > 500_000:    # $500K+ OTM call alımı
            result["big_block_detected"] = True
            uoa_score += 30.0
        elif big_premium_sum > 100_000:  # $100K+
            result["big_block_detected"] = True
            uoa_score += 15.0
        elif big_premium_sum > 25_000:
            uoa_score += 7.0

        # 4. IV spike tespiti (ortalamanın üstünde IV = gizli alım)
        if len(iv_values) > 5:
            iv_mean = np.mean(iv_values)
            iv_std  = np.std(iv_values)
            if iv_std > 0 and iv_mean > 0:
                # Herhangi bir strike ortalamanın 2 standart sapma üstünde mi?
                iv_spikes = sum(1 for iv in iv_values if iv > iv_mean + 2 * iv_std)
                if iv_spikes > 0:
                    result["iv_spike_detected"] = True
                    uoa_score += 15.0

        uoa_score = min(uoa_score, 100.0)
        result["uoa_score"] = round(uoa_score, 1)

        # UOA sinyal etiketi
        if uoa_score >= 50:
            result["uoa_signal"] = "🔥 GÜÇLÜ KURUMSAL AKIŞ"
        elif uoa_score >= 30:
            result["uoa_signal"] = "📈 POZİTİF UOA"
        elif uoa_score >= 15:
            result["uoa_signal"] = "👀 HAFİF UOA"
        else:
            result["uoa_signal"] = "—"

    except Exception as e:
        logging.debug(f"UOA {ticker}: {e}")

    return result


# ════════════════════════════════════════════════════════════════════════════
# 8) ANA ANALİZ
# ════════════════════════════════════════════════════════════════════════════

ANALYSIS_SEM = asyncio.Semaphore(SEMAPHORE_N)
PROGRESS_COUNTER = 0
TOTAL_TO_SCAN = 0

async def analyze(ticker: str) -> Optional[dict]:
    global PROGRESS_COUNTER
    async with ANALYSIS_SEM:
        try:
            PROGRESS_COUNTER += 1
            if PROGRESS_COUNTER % 10 == 0 or PROGRESS_COUNTER == 1:
                print(f"🔍 [{PROGRESS_COUNTER}/{TOTAL_TO_SCAN}] {ticker} analiz ediliyor...")
            
            stock = yf.Ticker(ticker)
            # 30 saniye timeout ekleyelim
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

            # Katman 2: EMA + Swing Modları
            l2_ok, l2 = layer2_ema_trend(df1d)
            if not l2_ok: return None

            # Katman 3: Momentum + RS + Breakout + Base
            l3_ok, l3 = layer3_momentum(df1d)
            if not l3_ok: return None

            # Katman 4: Opsiyon Zinciri
            hv30 = l3.get("hv30", calc_hv(close, 30))
            opt  = await layer4_options(ticker, cp, close, hv30, l2, l3)
            if not opt: return None

            # Katman 5: UOA + Earnings (BOGA AI)
            uoa = await detect_uoa(ticker, cp)

            # ── TOPLAM PUANLAMA BOGA AI v8.0 ──────────────────────────────
            # EMA Giriş Modu + Yapı         : 0-30
            # ADX                           : 0-15
            # VWAP Pozisyonu                : 0-10
            # RSI Kalitesi                  : 0-10
            # Relative Strength (SPY)       : 0-10
            # Risk/Reward Skoru             : 0-10  ← v6 ENHANCEMENT-1
            # IV Rank Bonusu                : 0-10
            # IV/HV Mispricing              : 0-10  ← v6 ENHANCEMENT-2
            # Breakout + Base               : 0-20  ← FIX-5
            # Trend Devam (Higher Highs)    : 0-10  ← FIX-7
            # Sweep / Likidite              : 0-5
            # UOA Bonus                     : 0-10  ← BOGA AI YENİ
            # + Golden Cross bonus          : +5
            # + EMA200 Breakout bonus       : +7

            # ✅ FIX-5: Breakout + Base → max 20 puan (eski 10 — trendin %20'si buradan gelir)
            breakout_base_score = min(
                l3.get("breakout_score", 0) * 0.7 + l3.get("base_score", 0) * 0.5,
                20.0
            )

            opt_liq_score = 0.0
            sweep_bonus   = 0.0

            best_opt = opt.get("institutional") or opt.get("asymmetric")
            if best_opt:
                opt_liq_score = best_opt.get("liq_score", 0.0)

            if opt.get("asymmetric"):
                sweep_bonus = min(opt["asymmetric"].get("sweep_score", 0.0) / 5.0, 5.0)

            total_score = (
                l2.get("ema_score", 0)                          +  # 0-30
                l2.get("adx_score", 0)                          +  # 0-15
                l2.get("vwap_score", 0)                         +  # 0-10
                l3.get("rsi_score", 0)                          +  # 0-10
                l3.get("rs_score", 0)                           +  # 0-10
                l3.get("rr_score", 0)                           +  # 0-10  ← v6 ENHANCEMENT-1 (RR)
                opt.get("iv_bonus", 0)                          +  # 0-10
                opt.get("mispricing_score", 0)                  +  # 0-10  ← v6 ENHANCEMENT-2 (Mispricing)
                breakout_base_score                             +  # 0-20
                l3.get("trend_continuation_score", 0)           +  # 0-10
                sweep_bonus                                        # 0-5
            )

            # UOA Bonus (0-10) — Kurumsal akış ek puan
            uoa_bonus = min(uoa.get("uoa_score", 0) / 10.0, 10.0)
            # Earnings yakınsa ceza — IV crush riski
            if uoa.get("earnings_warning"):
                uoa_bonus -= 5.0
            total_score += uoa_bonus

            # Golden Cross ve EMA200 Breakout bonusları
            entry_mode_raw = l2.get("entry_mode", "")
            if l2.get("golden_cross") or "GOLDEN_CROSS" in entry_mode_raw:
                total_score += 5.0
            if l2.get("ema200_breakout") or "EMA200_BREAKOUT" in entry_mode_raw:
                total_score += 7.0

            total_score = min(total_score, 100.0)

            if total_score >= 75:   grade = "🏆 MÜKEMMEL"
            elif total_score >= 60: grade = "🔥 GÜÇLÜ"
            elif total_score >= 45: grade = "💡 İYİ"
            else:                   grade = "📊 OLASI"

            if not l2.get("vwap_ok", True):
                grade += " ⚠️VWAP↓"

            # Özel rozetler
            if l2.get("ema200_breakout"):
                grade = "⚡" + grade
            elif l2.get("golden_cross"):
                grade = "🌟" + grade

            # UOA rozeti — güçlü kurumsal akış görsel olarak belirt
            if uoa.get("uoa_score", 0) >= 50:
                grade = "🔥" + grade
            if uoa.get("earnings_warning"):
                grade += " ⚠️EARN"

            return {
                "ticker": ticker, "current_price": round(cp, 2),
                "score":  round(total_score, 1), "grade": grade,
                "l2": l2, "l3": l3, "options": opt, "uoa": uoa,
                "hv30": round(hv30 * 100, 1),
                "breakout_base_score": round(breakout_base_score, 1),
            }
        except Exception as e:
            logging.debug(f"{ticker}: {e}")
            return None

# ════════════════════════════════════════════════════════════════════════════
# 9) RAPOR OLUŞTURUCU (v5.0: Swing bilgileri eklendi)
# ════════════════════════════════════════════════════════════════════════════

def fmt_exit(opt_data: dict) -> str:
    tp   = opt_data.get("tp_price", "—")
    sl   = opt_data.get("sl_price", "—")
    ts   = opt_data.get("time_stop_days", "—")
    return (
        f"   🎯 BOGA AI PRICE TARGET: ${tp}  |  RISK LIMIT: ${sl}  |  Time Limit {ts} gün kala\n"
        f"   ⏱ Günlük Theta Erimesi: %{opt_data.get('daily_decay_pct',0):.1f} prim/gün"
        f"  |  Θ/Δ Kalite: {opt_data.get('theta_delta_ratio',0):.2f}"
    )

def build_option_block(opt_data: dict, ticker: str, cp: float, grade: str, l2: dict, l3: dict, uoa: dict = None) -> str:
    lines = []
    lines.append(f"\n{'═' * 55}")
    lines.append(f"{grade}  <b>#{ticker}</b>  ${cp:.2f}")

    regime_label = {
        "trend":    "📈 TREND REJİMİ",
        "breakout": "⚡ KIRILIM REJİMİ",
        "neutral":  "↔️ NÖTR REJİM",
    }.get(opt_data.get("regime", "neutral"), "↔️ NÖTR")

    mode_labels_display = {
        "EMA200_BREAKOUT": "⚡ EMA200 KIRILIM — ALTIN SİNYAL",
        "EMA200_BREAKOUT_BELOW200": "⚡ DİP KIRILIM (EMA200 ALTI) — ERKEN",
        "GOLDEN_CROSS":    "🌟 GOLDEN CROSS — TREND DOĞUMU",
        "GOLDEN_CROSS_BELOW200": "🌟 ERKEN GOLDEN CROSS (EMA200 ALTI)",
        "NEAR_GOLDEN":     "🔜 NEAR GOLDEN CROSS",
        "TREND_BIRTH":     "🌱 TREND BAŞLANGICI",
        "ESTABLISHED_TREND": "🐂 OTURMUŞ GÜÇLÜ TREND",
        "EMA50_BOUNCE":    "📉→📈 EMA50 SEKMESI",
    }

    # v5.0: Giriş modu ve swing sinyalleri
    entry_mode = l2.get("entry_mode", "—")
    mode_labels = {
        "EMA200_BREAKOUT": "⚡ EMA200 KIRILIM — ALTIN SİNYAL",
        "EMA200_BREAKOUT_BELOW200": "⚡ DİP KIRILIM (EMA200 ALTI) — ERKEN",
        "GOLDEN_CROSS":    "🌟 GOLDEN CROSS — TREND DOĞUMU",
        "GOLDEN_CROSS_BELOW200": "🌟 ERKEN GOLDEN CROSS (EMA200 ALTI)",
        "NEAR_GOLDEN":     "🔜 NEAR GOLDEN CROSS",
        "TREND_BIRTH":     "🌱 TREND BAŞLANGICI",
        "ESTABLISHED_TREND": "🐂 OTURMUŞ GÜÇLÜ TREND",
        "EMA50_BOUNCE":    "📉→📈 EMA50 SEKMESI",
    }
    mode_str = mode_labels.get(entry_mode, entry_mode)

    lines.append(f"🔮 Rejim: <b>{regime_label}</b>  |  Giriş: <b>{mode_str}</b>")  # mode_str zaten yukarıda tanımlandı
    lines.append(
        f"📐 EM: ±${opt_data['em']:.2f} (üst ≤${opt_data['em_upper']:.2f})"
        f"  |  60g Zirve: ${l3.get('high_60', 0):.2f}"
    )
    lines.append(
        f"📊 IV: <b>{opt_data['atm_iv']:.0f}%</b>  IV Rank: <b>{opt_data['iv_rank']:.0f}</b>"
        f"  {'✅ UCUZ IV' if opt_data['iv_rank'] <= 20 else ('🟡 NORMAL' if opt_data['iv_rank'] <= 35 else '🔴 PAHALI')}"
        f"  |  Max Pain: ${opt_data['max_pain']:.2f}"
    )
    
    # ✅ v6-ENHANCEMENT-2: IV vs HV Mispricing indicator
    iv_vs_hv = opt_data.get("iv_vs_hv", 1.0)
    mispricing_tag = "💰 ULTRA UCUZ" if iv_vs_hv < 0.85 else ("🟢 UCUZ" if iv_vs_hv < 0.95 else ("🟡 FAIR" if iv_vs_hv < 1.15 else "🔴 PAHALI"))
    lines.append(f"IV/HV Ratio: {iv_vs_hv:.2f}x  {mispricing_tag}")
    
    lines.append(f"📅 Vade: <b>{opt_data['exp_date']}</b> ({opt_data['dte']} gün)")

    # RS skoru
    rs_60 = l3.get("rs_60d", 0.0)
    rs_tag = "💪 PAZAR LİDERİ" if rs_60 >= 5 else ("🟡 GÜÇLÜ" if rs_60 >= 2 else ("😐 NÖTR" if rs_60 >= -2 else "😟 ZAYIF"))
    
    # ✅ v6-ENHANCEMENT-1: Risk/Reward Upside Potential
    rr_score = l3.get("rr_score", 0)
    distance_to_high = l3.get("distance_to_high", 0)
    rr_tag = f"📈 %{distance_to_high:.1f} YUKARISI" if distance_to_high > 0 else "⚠️ ZIRVE YAKINI"
    lines.append(f"📈 RS vs SPY: <b>{rs_60:+.1f}pp</b>  {rs_tag}  |  Upside: <b>{rr_tag}</b>")

    # ✅ FIX-7: Higher Highs + Volume Spike durumu raporda görünür
    hh_tag  = "✅ YÜKSELİYOR" if l3.get("higher_highs") else "⚠️ YOK"
    vol_tag = "✅ HACİMLİ" if l3.get("volume_spike") else "📉 sessiz"
    lines.append(f"📊 Higher Highs: <b>{hh_tag}</b>  |  Hacim Spike: <b>{vol_tag}</b>")

    # 🐂 BOGA AI UOA Bloğu
    # 🐂 BOGA AI UOA Bloğu
    if uoa and uoa.get("uoa_score", 0) > 0:
        uoa_score = uoa.get("uoa_score", 0)
        uoa_signal = uoa.get("uoa_signal", "—")
        pc_ratio = uoa.get("put_call_ratio", 0)
        earn_days = uoa.get("earnings_days")
        unusual = "✅" if uoa.get("unusual_call_vol") else "—"
        big_block = "✅ BLOK ALIM" if uoa.get("big_block_detected") else "—"
        iv_spike = "⚡ IV SPIKE" if uoa.get("iv_spike_detected") else "—"
        earn_str = f"⚠️ {earn_days}g" if uoa.get("earnings_warning") else (f"{earn_days}g" if earn_days else "—")
        lines.append(
            f"🐂 UOA: <b>{uoa_signal}</b>  Skor:{uoa_score:.0f}  P/C:{pc_ratio:.2f}"
            f"  Anormal:{unusual}  {big_block}  {iv_spike}  Earn:{earn_str}"
        )

    inst = opt_data.get("institutional")
    asym = opt_data.get("asymmetric")

    if inst:
        sim = inst.get("sim", {})
        lines.append(f"\n🛡️ <b>KURUMSAL SIĞINAK</b>  (Delta rejim: {inst.get('regime','—')})")
        lines.append(f"   🎯 <b>${inst['strike']:.1f} CALL</b>  ({inst['expiration']})")
        lines.append(
            f"   💸 Prim: <b>${inst['mid']:.2f}</b>  Spread: {inst['spread_pct']:.1f}%  "
            f"|  Δ: <b>{inst['delta']:.3f}</b>  Γ: {inst['gamma']:.5f}"
        )
        lines.append(
            f"   📊 OI: {inst['oi']:,}  Vol: {inst['volume']:,}  Vol/OI: {inst['vol_oi_ratio']:.2f}x"
        )
        lines.append(f"   💰 Kontrat: <b>${inst['cost_per_contract']:.0f}</b>  Başabaş: ${inst['breakeven']:.2f}")
        lines.append(fmt_exit(inst))
        if sim and sim.get('pnl_pct', 0) != 0:
            em = "📈" if sim['pnl_pct'] > 0 else "📉"
            lines.append(
                f"   {em} Sim (+%7, {sim['days']}g): ${sim['price_now']:.2f} → <b>${sim['price_fwd']:.2f}</b>"
                f"  (<b>%{sim['pnl_pct']:+.0f}</b>)"
            )

    if asym:
        sim = asym.get("sim", {})
        sweep_lbl = "⚡ GÜÇLÜ SWEEP" if asym['vol_oi_ratio'] >= 1.0 else "👀 SWEEP"
        lines.append(f"\n🚀 <b>ASİMETRİK FIRSAT</b>  [{sweep_lbl}: {asym['vol_oi_ratio']:.2f}x]")
        lines.append(
            f"   🎯 <b>${asym['strike']:.1f} CALL</b>  ({asym['expiration']})"
            f"  ✅ EM İçinde ≤${asym['em_upper']:.2f}"
        )
        lines.append(
            f"   💸 Prim: <b>${asym['mid']:.2f}</b>  Spread: {asym['spread_pct']:.1f}%  "
            f"|  Δ: <b>{asym['delta']:.3f}</b>  Γ: {asym['gamma']:.5f}"
        )
        # Fix lines.append
        lines.append(
            f"   📊 OI: {asym['oi']:,}  Vol: {asym['volume']:,}  Vol/OI: <b>{asym['vol_oi_ratio']:.2f}x</b>"
        )
        lines.append(f"   💰 Kontrat: <b>${asym['cost_per_contract']:.0f}</b>  Başabaş: ${asym['breakeven']:.2f}")
        lines.append(fmt_exit(asym))
        if sim and sim.get('pnl_pct', 0) != 0:
            em = "📈" if sim['pnl_pct'] > 0 else "📉"
            lines.append(
                f"   {em} Sim (+%10, {sim['days']}g): ${sim['price_now']:.2f} → <b>${sim['price_fwd']:.2f}</b>"
                f"  (<b>%{sim['pnl_pct']:+.0f}</b>)"
            )

    return "\n".join(lines)

def save_options_picks(candidates: List[dict]):
    """JSON kaydet: transfer/latest ve data/{date} klasörlerine."""
    import json
    try:
        now_ny = datetime.now(NY_TZ)
        today_str = now_ny.strftime("%Y-%m-%d")
        
        # Frontend'in beklediği format
        output = {
            "date": today_str,
            "timestamp": now_ny.isoformat(),
            "generated_at": now_ny.isoformat(),
            "vix": MARKET_VIX["value"],
            "vix_regime": MARKET_VIX["regime"],
            "spy_return_60d": SPY_RETURN_CACHE.get("return_60d", 0.0),
            "universe_size": MAX_TICKERS_SCAN,
            "scan_duration_sec": 0, # dolacak
            "regime_summary": {
                "trend": len([c for c in candidates if c['options'].get('regime') == 'trend']),
                "breakout": len([c for c in candidates if c['options'].get('regime') == 'breakout']),
                "neutral": len([c for c in candidates if c['options'].get('regime') == 'neutral']),
            },
            "picks": []
        }

        for c in candidates:
            l2 = c['l2']
            l3 = c['l3']
            opt = c['options']
            
            pick_obj = {
                "ticker": c['ticker'],
                "date": today_str,
                "current_price": c['current_price'],
                "score": c['score'],
                "grade": c['grade'],
                "entry_mode": l2.get("entry_mode"),
                "entry_mode_label": l2.get("ema_pattern"),
                "regime": opt.get("regime"),
                "ema_pattern": l2.get("ema_pattern"),
                "ema9": l2.get("ema9"),
                "ema20": l2.get("ema20"),
                "ema50": l2.get("ema50"),
                "ema200": l2.get("ema200"),
                "adx": l2.get("adx"),
                "rsi": l3.get("rsi"),
                "rvol": l3.get("rvol"),
                "roc20": l3.get("roc20_pct"),
                "roc60": l3.get("roc60_pct"),
                "hv30": c.get("hv30", 0) * 100, # 0.4 -> 40
                "iv_rank": opt.get("iv_rank"),
                "iv_vs_hv": opt.get("iv_vs_hv"),
                "vwap": l2.get("vwap"),
                "vwap_ok": l2.get("vwap_ok"),
                "rs_vs_spy_60d": l3.get("rs_60d"),
                "base_range_pct": l3.get("range_pct_30"),
                "high_60d": l3.get("high_60"),
                "expected_move": opt.get("em"),
                "em_upper": opt.get("em_upper"),
                "max_pain": opt.get("max_pain"),
                "exp_date": opt.get("exp_date"),
                "dte": opt.get("dte"),
                "institutional": opt.get("institutional"),
                "asymmetric": opt.get("asymmetric"),
                
                # BOGA AI v7.1 Enhanced Labels for Website
                "iv_vs_hv_label": "💰 ULTRA UCUZ" if opt.get("iv_vs_hv", 1.0) < 0.85 else ("🟢 UCUZ" if opt.get("iv_vs_hv", 1.0) < 0.95 else ("🟡 FAIR" if opt.get("iv_vs_hv", 1.0) < 1.15 else "🔴 PAHALI")),
                "rs_vs_spy_label": "💪 PAZAR LİDERİ" if l3.get("rs_60d", 0.0) >= 5 else ("🟡 GÜÇLÜ" if l3.get("rs_60d", 0.0) >= 2 else ("😐 NÖTR" if l3.get("rs_60d", 0.0) >= -2 else "😟 ZAYIF")),
                "upside_label": f"📈 %{l3.get('distance_to_high', 0):.1f} YUKARISI" if l3.get("distance_to_high", 0) > 0 else "⚠️ ZIRVE YAKINI",
                "higher_highs": l3.get("higher_highs", False),
                "volume_spike": l3.get("volume_spike", False),
                "uoa_score": c.get("uoa", {}).get("uoa_score", 0),
                "uoa_signal": c.get("uoa", {}).get("uoa_signal", ""),
                "earnings_warning": c.get("uoa", {}).get("earnings_warning", False),
                "ai_analysis_text": build_option_block(opt, c['ticker'], c['current_price'], c['grade'], l2, l3, uoa=c.get('uoa')),
            }
            output["picks"].append(pick_obj)

        # 1) transfer/latest
        os.makedirs(LATEST_DIR, exist_ok=True)
        latest_path = os.path.join(LATEST_DIR, "options_picks.json")
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
            
        # 2) data/{date}
        today_dir = os.path.join(DATA_DIR, today_str)
        os.makedirs(today_dir, exist_ok=True)
        date_path = os.path.join(today_dir, "options_picks.json")
        with open(date_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
            
        # 3) Sync to Frontend public/data (for immediate site update)
        frontend_dir = os.path.join(HERE, "frontend", "public", "data")
        if os.path.exists(frontend_dir):
            import shutil
            # Latest
            f_latest = os.path.join(frontend_dir, "latest")
            os.makedirs(f_latest, exist_ok=True)
            shutil.copy2(latest_path, os.path.join(f_latest, "options_picks.json"))
            # Date folder
            f_date = os.path.join(frontend_dir, today_str)
            os.makedirs(f_date, exist_ok=True)
            shutil.copy2(date_path, os.path.join(f_date, "options_picks.json"))
            logging.info(f"✅ Frontend senkronizasyonu başarılı.")

        # 4) PNL Tracker tetikle
        import subprocess
        tracker_script = os.path.join(HERE, "options_pnl_tracker.py")
        if os.path.exists(tracker_script):
            logging.info("🚀 PNL Tracker tetikleniyor...")
            subprocess.run([os.path.join(HERE, "venv313", "Scripts", "python.exe"), tracker_script], cwd=HERE)

        # 4) Git Push (Frontend'e yansıtmak için)
        try:
            logging.info("🚀 Değişiklikler GitHub'a itiliyor...")
            subprocess.run(["git", "add", "."], cwd=HERE, check=True)
            subprocess.run(["git", "commit", "-m", f"Automated Options Update: {today_str}"], cwd=HERE)
            subprocess.run(["git", "push", "origin", "main"], cwd=HERE, check=True)
            logging.info("✅ GitHub Push başarılı.")
        except Exception as ge:
            logging.error(f"Git Push hatası: {ge}")
            
    except Exception as e:
        logging.error(f"JSON kaydetme hatası: {e}")

def build_summary_report(candidates: List[dict], vix: float, duration: float, universe_size: int) -> Tuple[str, str]:
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M %Z")

    regime_counts = {}
    mode_counts   = {}
    for c in candidates:
        r = c.get("options", {}).get("regime", "neutral")
        regime_counts[r] = regime_counts.get(r, 0) + 1
        m = c.get("l2", {}).get("entry_mode", "—")
        mode_counts[m] = mode_counts.get(m, 0) + 1

    header = (
        f"🐂 <b>BOGA AI v7.1 (Option Scanner)</b>\n"
        f"📅 <i>{now_str}</i>\n"
        f"🌡️ VIX: {vix:.1f} ({MARKET_VIX['regime']})  ⏱ {duration:.0f}sn\n"
        f"📊 {universe_size} hisse → {len(candidates)} aday\n"
        f"🔮 Rejim: Trend:{regime_counts.get('trend',0)} "
        f"Kırılım:{regime_counts.get('breakout',0)} "
        f"Nötr:{regime_counts.get('neutral',0)}\n"
        f"🎯 Mod: EMA200Brk:{mode_counts.get('EMA200_BREAKOUT',0)} "
        f"GoldenX:{mode_counts.get('GOLDEN_CROSS',0)} "
        f"EMA50:{mode_counts.get('EMA50_BOUNCE',0)}\n"
        f"📌 EMA200✅ | Nötr Yasak✅ | IV Rank<{IV_RANK_BUY_MAX:.0f}✅ | DTE {DTE_MIN}-{DTE_MAX}g✅\n\n"
        f"<pre>{'─'*66}\n"
        f"#   SEMBOL  FYT     PUAN  MOD          KURUMSAL    ASİMETRİK\n"
        f"{'─'*66}\n"
    )

    rows = []
    for i, c in enumerate(candidates[:40]):
        opt      = c['options']
        inst     = opt.get('institutional')
        asym     = opt.get('asymmetric')
        inst_str = f"${inst['strike']:.0f}C" if inst else "—"
        asym_str = f"${asym['strike']:.0f}C" if asym else "—"
        mode_short = {
            "EMA200_BREAKOUT": "⚡E200",
            "EMA200_BREAKOUT_BELOW200": "⚡E200-",
            "GOLDEN_CROSS":    "🌟GX",
            "GOLDEN_CROSS_BELOW200": "🌟GX-",
            "NEAR_GOLDEN":     "🔜NGX",
            "TREND_BIRTH":     "🌱TRD",
            "ESTABLISHED_TREND": "🐂EST",
            "EMA50_BOUNCE":    "📉E50",
        }.get(c.get("l2", {}).get("entry_mode", "—"), "—")
        rows.append(
            f"{i+1:02d}. {c['ticker']:<7} ${c['current_price']:>6.2f}  {c['score']:>5.1f}"
            f"  {mode_short:<6}  EM:±${opt['em']:.1f}  {inst_str:<9} {asym_str}"
        )

    summary = header + "\n".join(rows) + f"\n{'─'*66}\n</pre>"
    summary += (
        f"\n<i>🛡️ Kur: Orta Delta | Δ rejime göre | IV Rank<{IV_RANK_BUY_MAX:.0f} | DTE {DTE_MIN}-{DTE_MAX}g (hedef {DTE_TARGET}g)</i>\n"
        f"<i>🚀 Asi: OTM EM içinde | Exit: TP%{int(TAKE_PROFIT_PCT*100)} / SL-%{int(abs(STOP_LOSS_PCT)*100)} / TimeStop DTE×dinamik</i>\n"
        f"<i>🐂 BOGA AI v8.0: DTE {DTE_MIN}-{DTE_MAX}g | UOA sweep | IV mispricing | Max $150 kontrat</i>\n"
    )

    detail_lines = [f"🐂 <b>BOGA AI v8.0 SWING — DETAY (TOP {min(20,len(candidates))})</b>\n"]
    for i, c in enumerate(candidates[:20]):
        l2  = c['l2']
        l3  = c['l3']
        opt = c['options']
        vwap_tag = "" if l2.get("vwap_ok", True) else "  ⚠️ VWAP ALTI"
        tech = (
            f"\n#{i+1} 📊 <b>{c['ticker']}</b>  ${c['current_price']:.2f}  "
            f"PUAN:<b>{c['score']:.1f}</b>  {c['grade']}\n"
            f"   EMA: {l2.get('ema_pattern','—')}  EMA200:${l2.get('ema200',0):.2f}  EMA50:${l2.get('ema50',0):.2f}\n"
            f"   ADX:{l2['adx']:.0f}  RSI:{l3['rsi']:.0f}  RVOL:{l3['rvol']:.2f}x  "
            f"ROC20:{l3.get('roc20_pct',0):+.1f}%  ROC60:{l3.get('roc60_pct',0):+.1f}%\n"
            f"   VWAP:${l2.get('vwap',0):.2f}{vwap_tag}  "
            f"HV30:{c['hv30']:.0f}%  IV Rank:{opt['iv_rank']:.0f}"
            f"  {'✅' if opt['iv_rank']<=IV_RANK_BUY_MAX else '⚠️'}\n"
            f"   RS vs SPY (60g): {l3.get('rs_60d',0):+.1f}pp  "
            f"Baz Aralığı:%{l3.get('range_pct_30',0):.1f}  "
            f"60g Zirve:${l3.get('high_60',0):.2f}"
        )
        detail_lines.append(tech)
        detail_lines.append(build_option_block(opt, c['ticker'], c['current_price'], c['grade'], l2, l3, uoa=c.get('uoa')))

    return summary, "\n".join(detail_lines)

# ════════════════════════════════════════════════════════════════════════════
# 10) ANA TARAMA DÖNGÜSÜ
# ════════════════════════════════════════════════════════════════════════════

async def scan():
    start   = time.time()
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")

    await update_vix()
    await update_spy_returns()  # ✅ v5.0: SPY RS için

    await send_tg(
        f"🐂 <b>BOGA AI v8.0 SWING</b>\n"
        f"🕒 {now_str}  |  🌡️ VIX: {MARKET_VIX['value']:.1f} ({MARKET_VIX['regime']})\n"
        f"📊 SPY 60g: {SPY_RETURN_CACHE.get('return_60d',0):+.1f}%\n"
        f"🔍 Swing/Position taraması başlıyor...\n"
        f"🎯 Hedef: 45-90 günlük trend başlangıçları (3-5g etkili swing)\n"
        f"⚡ EMA200 Kırılımı (EMA200 altında bile!) | 🌟 Golden Cross | 📉 EMA50 Sekmesi\n"
        f"✅ IV Rank<{IV_RANK_BUY_MAX} | DTE {DTE_MIN}-{DTE_MAX}g (hedef {DTE_TARGET}g) | RVOL>0.5\n"
        f"✅ Higher Highs | Hacimli Breakout | Base Formation (VCP)\n"
        f"📌 ${PRICE_MIN:.0f}-${PRICE_MAX:.0f} | Max $150 kontrat | Nötr Yasak | Breakout+Base max 20p\n"
        f"📊 {MAX_TICKERS_SCAN} hisse taranacak"
    )

    universe = await build_universe()
    if not universe:
        await send_tg("❌ Evren oluşturulamadı!"); return

    await send_tg(
        f"✅ Katman 1: {len(universe)} hisse geçti.\n"
        f"⏳ Katman 2-4 swing analizi başlıyor (5-10 dk)..."
    )

    global TOTAL_TO_SCAN, PROGRESS_COUNTER
    TOTAL_TO_SCAN = len(universe)
    PROGRESS_COUNTER = 0

    print(f"🚀 {TOTAL_TO_SCAN} hisse için detaylı analiz başlıyor...")
    results    = await asyncio.gather(*[analyze(t) for t in universe], return_exceptions=True)
    candidates = sorted(
        [r for r in results if isinstance(r, dict)],
        key=lambda x: x['score'], reverse=True
    )

    if not candidates:
        await send_tg(
            "⚠️ Swing adayı bulunamadı!\n"
            "• EMA200 breakout henüz oluşmadı (trend başlangıcı bekleniyor)\n"
            "• Golden Cross yok (EMA20 henüz EMA50'yi kesmedi)\n"
            "• IV Rank > 40 (piyasada volatilite yüksek, ucuz call az)\n"
            f"• DTE {DTE_MIN}-{DTE_MAX}g arasında opsiyon likiditesi yetersiz\n"
            "→ Bu NORMAL: swing bot az ama kaliteli fırsat üretir"
        ); return

    if len(candidates) < MIN_CANDIDATES:
        await send_tg(f"⚠️ {len(candidates)} swing adayı (min {MIN_CANDIDATES}). Raporlanıyor...")

    duration = time.time() - start
    
    # JSON Kaydet
    save_options_picks(candidates)

    summary, detail = build_summary_report(candidates, MARKET_VIX['value'], duration, len(universe))

    await send_tg(summary)
    await asyncio.sleep(1)

    for chunk in split_safe(detail, limit=3800):
        if chunk.strip():
            await send_tg(chunk)
            await asyncio.sleep(0.8)

    await send_tg(
        f"✅ <b>Swing Tarama Tamamlandı!</b>\n"
        f"⏱ {duration:.0f} sn  |  {len(universe)} hisse → {len(candidates)} aday\n"
        f"🏆 En iyi: {candidates[0]['ticker']} ({candidates[0]['score']:.1f}/100)\n"
        f"🎯 Mod: {candidates[0].get('l2',{}).get('entry_mode','—')}\n"
        f"📌 Rejim: {candidates[0]['options'].get('regime','—')}"
    )
    logging.info(f"✅ Swing tarama bitti: {len(candidates)} aday, {duration:.0f}sn")

# ════════════════════════════════════════════════════════════════════════════
# 11) ZAMANLAYICI
# ════════════════════════════════════════════════════════════════════════════

def get_next_run_utc(hour: int = 11, minute: int = 0):
    from datetime import timezone as tz
    now_utc = datetime.now(tz.utc)
    now_ny  = now_utc.astimezone(NY_TZ)
    cand    = now_ny.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if cand <= now_ny: cand += timedelta(days=1)
    while cand.weekday() >= 5: cand += timedelta(days=1)
    return cand.astimezone(tz.utc)

async def run_scanner():
    await send_tg(
        "🐂 <b>BOGA AI v8.0 OPTIONS BAŞLATILDI!</b>\n"
        "⏱ Hafta içi NY 11:00 otomatik tarama\n\n"
        "<b>v5.1 Elite Fix'leri Aktif:</b>\n"
        f"  ✅ FIX-1: EMA200 altında Breakout/GoldenCross → GEÇ (NVDA/TSLA yakalanır)\n"
        f"  ✅ FIX-2: ADX toleransı: Breakout modlarda min 10 (trend doğumunu kaçırmaz)\n"
        f"  ✅ FIX-3: Hacimli Breakout önceliği (fake breakout cezalandırılır)\n"
        f"  ✅ FIX-4: Base Formation yön bias'ı (VCP + yukarı momentum şart)\n"
        f"  ✅ FIX-5: Breakout+Base → 20 puan (trend kaynağı doğru ağırlıklandı)\n"
        f"  ✅ FIX-6: DTE hedefi 90g (scalp bias tamamen giderildi)\n"
        f"  ✅ FIX-7: Higher Highs trend devam filtresi (+10 puan)\n\n"
        "<b>v5.0'dan Korunan Özellikler:</b>\n"
        f"  ⚡ EMA Giriş Modları (5 mod)\n"
        f"  📊 Relative Strength vs SPY\n"
        f"  🔲 VCP Base Formation\n"
        f"  ✅ DTE {DTE_MIN}-{DTE_MAX}g | IV Rank<{IV_RANK_BUY_MAX} | Time Stop ×{TIME_STOP_RATIO}"
    )

    # Immediate scan removed to prevent duplicate runs on startup
    # try:
    #     await scan()
    # except Exception as e:
    #     logging.error(f"İlk tarama: {e}")
    #     await send_tg(f"🚨 Başlatma hatası: {e}")

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
# 12) BAŞLATMA
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    import sys
    if "--oneshot" in sys.argv:
        try:
            from zoneinfo import ZoneInfo
            ny_tz = ZoneInfo("America/New_York")
            now_ny = datetime.now(ny_tz)
            target_ny = now_ny.replace(hour=11, minute=0, second=0, microsecond=0)
            
            if now_ny < target_ny:
                wait_sec = (target_ny - now_ny).total_seconds()
                print(f"[WAIT] Saat henüz erken. NY 11:00 bekleniyor ({wait_sec/3600:.1f} saat)...")
                # time.sleep yerine ufak parçalarla bekleme veya direkt geçiş için uyarı
                # Kullanıcı hemen çalışmasını istiyor olabilir.
                if wait_sec > 0:
                    print(">>> İPUCU: Hemen çalıştırmak için sistem saatini kontrol edin veya bu bekleme kısmını atlayın.")
                    # 10 saniyede bir kontrol ederek bekleyelim ki kilitlenmiş gibi görünmesin
                    for _ in range(int(wait_sec / 10)):
                        time.sleep(10)
                        if os.path.exists("skip_wait.tmp"): break 
            
            print("🚀 BOGA AI v8.0 Options Scanner (One-Shot) başlatıldı...")
            asyncio.run(scan())
            print("✅ Tarama tamamlandı.")
        except Exception as e:
            print(f"Hata: {e}")
    else:
        try:
            asyncio.run(run_scanner())
        except KeyboardInterrupt:
            print("\n🐂 BOGA AI v8.0 durduruldu.")
        except Exception as e:
            print(f'Kritik hata: {e}')
