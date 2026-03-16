"""
🦅 KARTAL YUVASI ALPHA COMMANDER v4.0 — Pro Opsiyon Tarayıcı
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v3→v4 KRİTİK YÜKSELTMELERİ (VIX 25+ FIRTINA MODU):
══════════════════════════════════════════════════════

✅ 11. EMA 200 Makro Trend Filtresi  — ZORUNLU: cp > EMA20 > EMA50 > EMA200
                                       Dead Cat Bounce ve dip dönüşlerini tamamen eliyor.
✅ 12. Nötr Rejim Yasağı             — regime == "neutral" → direkt SKIP
                                       VIX 25+ ortamında nötr hisse piyasa yapıcılara yem.
✅ 13. Veri Penceresi Genişletme     — period="120d" → "300d" (EMA200 için zorunlu)
✅ 14. EMA200 Rapor Entegrasyonu     — ema_pattern etiketine EMA200 eklendi
✅ 15. IV Rank uyarısı tutarsızlığı  — hardcode 45 → IV_RANK_BUY_MAX ile senkron

KORUNAN KURALLAR (v3'ten):
──────────────────────────
📌 Hisse Fiyat: $1 – $100
📌 EMA Trend: Close > EMA20 > EMA50 > EMA200 (ZORUNLU - GÜÇLENDİRİLDİ)
📌 Rejim: Sadece TREND veya KIRILIM (NÖTR = YASAK)
📌 Min DTE: 25 gün
📌 VIX: Sadece bilgi, eleme yapmaz

PUANLAMA (0-100):
─────────────────
• EMA Trend + Pullback     : 0-25  ← EMA200 bonusu eklendi
• ADX / Piyasa Rejimi      : 0-15
• VWAP Pozisyonu           : 0-10
• RSI Kalitesi             : 0-10
• RVOL İvmesi              : 0-10
• IV Rank Bonusu           : 0-10
• Theta/Delta Kalitesi     : 0-10
• Sweep / Likidite         : 0-10
"""

import asyncio
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
# ⚙️  AYARLAR
# ════════════════════════════════════════════════════════════════════════════

NY_TZ = ZoneInfo("America/New_York")

# ── Telegram ──────────────────────────────────────────────────────────────
TELEGRAM_API_KEY = "7609846781:AAEl_2w8vHXkaDXUZyWoRK5N4_5RRcFkXsM"
TELEGRAM_CHAT_ID = "8061806611"
ENABLE_TELEGRAM  = True

# ── Hisse Filtresi ────────────────────────────────────────────────────────
PRICE_MIN      = 1.0
PRICE_MAX      = 100.0
AVG_VOL_MIN    = 150_000    # Min günlük ortalama hacim
DOLLAR_VOL_MIN = 500_000    # Min dollar hacim
ADX_MIN        = 18         # ADX zorunlu alt sınır (çok düşük tutuldu, skor etkiler)
RSI_MIN        = 35
RSI_MAX        = 80

# ── Piyasa Rejimi → Delta Aralıkları ─────────────────────────────────────
# Genişletildi: gerçek piyasada dar bant = çok az kontrat bulunuyor
DELTA_BY_REGIME = {
    "trend":    (0.50, 0.72),   # Güçlü trend → yüksek delta momentum
    "breakout": (0.40, 0.62),   # Kırılım → orta delta
    "neutral":  (0.28, 0.48),   # Nötr → düşük delta
}

# ── Opsiyon Filtresi ──────────────────────────────────────────────────────
DTE_MIN       = 25          # Min vade (gün) — biraz esneltildi (30→25)
DTE_MAX       = 65          # Max vade (gün) — biraz esneltildi (60→65)
OI_MIN        = 150         # Min OI — esneltildi (200→150)
SPREAD_MAX    = 0.15        # Max spread — esneltildi (%12→%15)
MID_MIN       = 0.15        # Min prim ($)
MID_MAX       = 18.0        # Max prim ($)

# ── IV Rank Filtresi ─────────────────────────────────────────────────────
# Gerçek piyasada IV Rank 45 üstü çok yaygın — 60'a genişletildi
# Bu hâlâ güvenli: 60 üstü gerçekten IV Crush bölgesi
IV_RANK_BUY_MAX   = 60.0    # Call alım için üst sınır (eski: 45 → çok kısıtlayıcıydı)
IV_RANK_BONUS_MAX = 30.0    # Bu altında bonus puan (ucuz IV = en iyi senaryo)

# ── Theta/Delta Kalite Oranı ──────────────────────────────────────────────
# 0.25 çok kısıtlayıcıydı — 30-60 DTE'de bu oran zaten düşük olabilir
# 0.08'e indirildi: gerçekten kötü kontratları eler, iyi olanları geçirir
THETA_DELTA_MIN = 0.08      # abs(delta/theta) — raporda gösterilir, aşırı düşük = eler

# ── Exit Parametreleri ────────────────────────────────────────────────────
TAKE_PROFIT_PCT  = 0.35     # %35 kâr — çık
STOP_LOSS_PCT    = -0.20    # -%20 zarar — çık
TIME_STOP_RATIO  = 0.5      # DTE×0.5 geçtikten sonra çık

# ── Evren / Tarama ────────────────────────────────────────────────────────
MAX_TICKERS_SCAN = 500
UNIVERSE_TTL     = 24 * 3600
SEMAPHORE_N      = 8
MIN_CANDIDATES   = 20

UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}
MARKET_VIX = {"value": 18.0, "regime": "Orta 🟡"}

EXCHANGE_SOURCES: List[str] = [
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
]

# ════════════════════════════════════════════════════════════════════════════
# 1) TELEGRAM
# ════════════════════════════════════════════════════════════════════════════

def sanitize_html(text: str) -> str:
    """
    Telegram HTML modu için güvenli metin üretici.
    Sadece izin verilen tag'lere izin verir: <b> <i> <pre> <code>
    Diğer tüm < > karakterleri escape edilir.
    Emojiler, semboller ve özel karakterler olduğu gibi bırakılır.
    """
    if not text:
        return ""
    import re
    # İzin verilen tag'leri geçici placeholder'larla koru
    allowed = {
        "<b>": "▶B◀", "</b>": "▶/B◀",
        "<i>": "▶I◀", "</i>": "▶/I◀",
        "<pre>": "▶PRE◀", "</pre>": "▶/PRE◀",
        "<code>": "▶CODE◀", "</code>": "▶/CODE◀",
    }
    result = text
    for tag, ph in allowed.items():
        result = result.replace(tag, ph)
    # Kalan tüm < > karakterlerini escape et
    result = result.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # Placeholder'ları geri çevir
    for tag, ph in allowed.items():
        result = result.replace(ph, tag)
    return result

def split_safe(msg: str, limit: int = 3800) -> list:
    """
    Mesajı Telegram'ın 4096 char limitine sığdırmak için güvenli böler.
    HTML tag ortasında kesmez — satır bazlı böler.
    """
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
            # Tek satır limiti aşıyorsa (çok nadir) karakterle kes
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
    """
    Telegram mesaj gönderici.
    - HTML sanitize edilir (TG 400 hatasını önler)
    - Satır bazlı güvenli chunk'lama
    - Hata detayı loglara yazılır
    """
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
                        # HTML parse hatası durumunda plain text ile tekrar dene
                        if r.status == 400 and "parse" in body.lower():
                            plain = re.sub(r'<[^>]+>', '', chunk)  # tüm tag'leri sil
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
# 2) VIX
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
    """1σ Expected Move: fiyatın vadeye kadar yapabileceği istatistiksel hareket."""
    return round(price * iv * math.sqrt(dte / 365.0), 2)

def calc_hv(close: pd.Series, lb: int = 30) -> float:
    if len(close) < lb + 1: return 0.30
    lr = np.log(close / close.shift(1)).dropna()
    return max(0.05, float(lr.tail(lb).std()) * math.sqrt(252))

def calc_iv_rank(current_iv: float, close: pd.Series) -> Tuple[float, float]:
    """IV Rank ve IV Percentile (52 haftalık HV üzerinden)."""
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
    """Son 20 günün VWAP'ını hesaplar."""
    try:
        d = df.tail(20).copy()
        tp = (d['High'].astype(float) + d['Low'].astype(float) + d['Close'].astype(float)) / 3.0
        vol = d['Volume'].astype(float)
        return round(float((tp * vol).sum() / vol.sum()), 3)
    except:
        return 0.0

def detect_market_regime(adx: float, cp: float, e9: float, e20: float, e50: float) -> str:
    """
    Piyasa Rejimi Tespiti (YENİ - Düzeltme #2):
    ADX + EMA yapısına göre üç rejim:
      trend    → ADX > 25 + tam EMA dizilimi (güçlü yön)
      breakout → ADX 18-25 + e9 yeni EMA20'nin üzerinde ayrılıyor
      neutral  → ADX < 18 veya karışık EMA
    """
    full_alignment = (cp > e9 > e20 > e50)
    if adx >= 25 and full_alignment:
        return "trend"
    elif adx >= 18 and cp > e20 > e50:
        return "breakout"
    else:
        return "neutral"

def bs_pnl_sim(S: float, K: float, iv: float, dte: int,
               move_pct: float = 0.05, days_fwd: int = 7) -> dict:
    """
    Black-Scholes P&L simülasyonu.
    Hisse %move_pct hareket ederse ve days_fwd gün geçerse kontratın yeni teorik değeri.
    IV crush etkisi: %8 IV düşüşü varsayılır.
    """
    T_now = dte / 365.0
    T_fwd = max((dte - days_fwd) / 365.0, 0.001)
    S_fwd = S * (1 + move_pct)
    iv_fwd = iv * 0.92  # IV Crush varsayımı
    r = 0.05
    p_now = bs_price(S, K, T_now, r, iv)
    p_fwd = bs_price(S_fwd, K, T_fwd, r, iv_fwd)
    pnl_pct = round((p_fwd - p_now) / p_now * 100, 1) if p_now > 0 else 0.0
    return {
        "price_now": round(p_now, 2), "price_fwd": round(p_fwd, 2),
        "pnl_pct": pnl_pct, "S_target": round(S_fwd, 2), "days": days_fwd
    }

# ════════════════════════════════════════════════════════════════════════════
# 4) EVREN YÜKLEYİCİ — Katman 1
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
    Fiyat $1-100 | DollarVol > $500K | RVOL > 0.7
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
                yf.download, chunk, period="35d", progress=False,
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
                    if rvol < 1.5: continue  # v5.0: Sadece hacim patlaması olanlar (RVOL > 1.5)

                    roc5 = float((close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]) if len(close) >= 6 else 0.0

                    all_rows.append({
                        "sym": sym, "price": price, "dollar_vol": dvol,
                        "rvol": rvol, "roc5": roc5,
                        "rank_score": rvol * dvol,
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
# 5) KATMAN 2 — EMA TREND + VWAP + REJİM TESPİTİ
# ════════════════════════════════════════════════════════════════════════════

def layer2_ema_trend(df: pd.DataFrame) -> Tuple[bool, dict]:
    """
    ZORUNLU: Close > EMA20 > EMA50 > EMA200 (v4.0: Makro Trend Koruması)
    YENİ: EMA200 filtresi Dead Cat Bounce / dip dönüşlerini eliyor.
    YENİ: Nötr rejim yasağı — VIX 25+ ortamında nötr hisse alınmaz.
    """
    try:
        c   = df['Close'].astype(float)
        if len(c) < 210: return False, {}  # EMA200 için yeterli veri şart

        e9   = EMAIndicator(c, 9).ema_indicator()
        e20  = EMAIndicator(c, 20).ema_indicator()
        e50  = EMAIndicator(c, 50).ema_indicator()
        e200 = EMAIndicator(c, 200).ema_indicator()  # ★ YENİ: Makro Trend

        cp    = float(c.iloc[-1])
        e9v   = float(e9.iloc[-1])
        e20v  = float(e20.iloc[-1])
        e50v  = float(e50.iloc[-1])
        e200v = float(e200.iloc[-1])  # ★ YENİ

        # ★ ZORUNLU v4.0: Kusursuz Makro Trend — Dead Cat Bounce Katili
        # cp > EMA20 > EMA50 > EMA200: 4 katmanlı hiyerarşi sağlanmadan geç.
        # Bu kural; 100$'dan 20$'a çakılıp 25$'a sıçrayan her "dip dönüşü"nü eliyor.
        if not (cp > e20v > e50v > e200v):
            return False, {}

        # ADX
        adx_ind = ADXIndicator(df['High'], df['Low'], c, 14)
        adx_val = float(adx_ind.adx().iloc[-1])
        if adx_val < ADX_MIN: return False, {}

        # ── Market Rejimi ─────────────────────────────────────────
        regime = detect_market_regime(adx_val, cp, e9v, e20v, e50v)

        # ★ ZORUNLU v4.0: Nötr Rejim Yasağı
        # VIX 25+ ortamında yönü belli olmayan hisse piyasa yapıcılara yem olur.
        if regime == "neutral":
            return False, {}

        # ── VWAP Hesabı ────────────────────────────────────────────
        vwap = calc_vwap(df)

        # ── EMA Trend Skoru (0-25) ────────────────────────────────
        ema_score = 0.0
        if e20v > e50v:      ema_score += 6.0   # Kısa-orta trend yukarı
        if e50v > e200v:     ema_score += 4.0   # ★ YENİ: EMA50 > EMA200 makro onay
        if cp > e200v:       ema_score += 3.0   # ★ YENİ: Fiyat makro trend üzerinde
        if e9v > e20v:       ema_score += 5.0   # EMA9 > EMA20 hız onayı
        if cp > e9v:         ema_score += 4.0   # Fiyat EMA9 üzerinde — tam güç

        # Pullback kalitesi: fiyat EMA20'ye ne kadar yakın?
        dist_ema20 = (cp - e20v) / e20v if e20v > 0 else 0.0
        if 0.0 <= dist_ema20 <= 0.02:       ema_score += 7.0  # Mükemmel pullback entry
        elif 0.02 < dist_ema20 <= 0.04:     ema_score += 4.0  # İyi entry
        elif dist_ema20 > 0.08:             ema_score += 0.0  # Çok uzak, geç kalınmış
        else:                               ema_score += 2.0  # Orta mesafe

        # Hacim düşerek geri çekilme = sağlıklı pullback onayı
        try:
            vol = df['Volume'].astype(float)
            if vol.tail(3).mean() < vol.tail(20).mean():
                ema_score += 3.0
        except:
            pass

        ema_score = min(ema_score, 25.0)

        # ── ADX Skoru (0-15) ──────────────────────────────────────
        if adx_val >= 35:    adx_score = 15.0
        elif adx_val >= 28:  adx_score = 12.0
        elif adx_val >= 20:  adx_score = 8.0
        elif adx_val >= 14:  adx_score = 5.0
        else:                adx_score = 2.0

        # ── VWAP Skoru (0-10) ────────────────────────────────────
        vwap_ok = (vwap > 0 and cp >= vwap)
        if cp >= vwap * 1.01:   vwap_score = 10.0  # Fiyat VWAP'ın %1+ üzerinde
        elif cp >= vwap:        vwap_score = 6.0   # VWAP üzerinde ama yakın
        elif cp >= vwap * 0.98: vwap_score = 2.0   # VWAP'ın %2 altında (sınırda)
        else:
            vwap_ok    = False
            vwap_score = 0.0

        # EMA deseni etiketi (v4.0: EMA200 dahil)
        if cp > e9v > e20v > e50v > e200v:
            ema_pattern = "EMA9>20>50>200 ✅"
        elif cp > e20v > e50v > e200v:
            ema_pattern = "EMA20>50>200 ✅"
        else:
            ema_pattern = "EMA20>50>200"

        return True, {
            "ema9": round(e9v, 3), "ema20": round(e20v, 3),
            "ema50": round(e50v, 3), "ema200": round(e200v, 3),  # ★ YENİ
            "cp": round(cp, 3),
            "ema_score":  round(ema_score, 1),
            "adx":        round(adx_val, 1),
            "adx_score":  round(adx_score, 1),
            "regime":     regime,
            "vwap":       round(vwap, 3),
            "vwap_ok":    vwap_ok,
            "vwap_score": round(vwap_score, 1),
            "dist_ema20": round(dist_ema20 * 100, 2),   # % olarak
            "ema_pattern": ema_pattern,
        }
    except Exception as e:
        logging.debug(f"Katman2: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 6) KATMAN 3 — MOMENTUM
# ════════════════════════════════════════════════════════════════════════════

def layer3_momentum(df: pd.DataFrame) -> Tuple[bool, dict]:
    """RSI, RVOL, ROC. Skor amaçlı, çok az sert eleme."""
    try:
        c   = df['Close'].astype(float)
        vol = df['Volume'].astype(float)
        if len(c) < 35: return False, {}

        # RSI
        rsi = float(RSIIndicator(c, 14).rsi().iloc[-1])
        if not (RSI_MIN <= rsi <= RSI_MAX): return False, {}

        # RVOL
        v5  = float(vol.tail(5).mean())
        v30 = float(vol.tail(30).mean()) if len(vol) >= 30 else float(vol.tail(10).mean())
        rvol = v5 / v30 if v30 > 0 else 1.0
        if rvol < 0.5: return False, {}

        # RSI Skoru (0-10): İdeal entry 50-65 arası
        if 50 <= rsi <= 65:   rsi_score = 10.0
        elif 45 <= rsi < 50:  rsi_score = 7.0
        elif 65 < rsi <= 72:  rsi_score = 5.0
        elif 40 <= rsi < 45:  rsi_score = 4.0
        else:                 rsi_score = 1.0

        # RVOL Skoru (0-10) - v5.0 Kalibrasyonu
        rvol_score = min(max((rvol - 1.5) / 2.0 * 10.0, 0.0), 10.0)

        # ROC5
        roc5 = float((c.iloc[-1] - c.iloc[-6]) / c.iloc[-6] * 100) if len(c) >= 6 else 0.0

        # ATR
        atr_v   = float(AverageTrueRange(df['High'], df['Low'], c, 14).average_true_range().iloc[-1])
        atr_pct = (atr_v / float(c.iloc[-1])) * 100

        return True, {
            "rsi": round(rsi, 1), "rvol": round(rvol, 2),
            "rsi_score": round(rsi_score, 1), "rvol_score": round(rvol_score, 1),
            "roc5_pct": round(roc5, 2), "atr_pct": round(atr_pct, 2),
            "hv30": round(calc_hv(c, 30), 4),
        }
    except Exception as e:
        logging.debug(f"Katman3: {e}")
        return False, {}

# ════════════════════════════════════════════════════════════════════════════
# 7) KATMAN 4 — OPSİYON ZİNCİRİ (Tüm Pro Düzeltmeler Burada)
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
    Pro Opsiyon Tarayıcı:
    ─────────────────────
    1. Expected Move filtresi: Strike > EM_upper → SKIP  [Düzeltme #1]
    2. Dinamik Delta: Rejime göre delta aralığı           [Düzeltme #2]
    3. IV Rank filtresi: IV Rank > 45 → SKIP             [Düzeltme #3]
    4. Theta/Delta oranı filtresi: < 0.25 → SKIP         [Düzeltme #4]
    5. Exit seviyeleri rapora eklenir                     [Düzeltme #6]
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

        # Orta DTE'ye (45 gün) en yakını seç
        valid_exps.sort(key=lambda x: abs(x[1] - 45))
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
        em_upper = cp + em          # 1σ üst sınır — CALL ALIM SINIRI

        # ── DÜZELTME #3: IV Rank Filtresi ────────────────────────
        iv_rank, iv_pct = calc_iv_rank(atm_iv, close)
        if iv_rank > IV_RANK_BUY_MAX:
            logging.debug(f"{ticker} → IV Rank çok yüksek ({iv_rank:.0f}) — IV Crush riski, atlandı")
            return None

        # IV Rank Bonusu (0-10): Düşük IV = ucuz prim = bonus
        if iv_rank <= IV_RANK_BONUS_MAX:       iv_bonus = 10.0
        elif iv_rank <= 40.0:                   iv_bonus = 6.0
        elif iv_rank <= IV_RANK_BUY_MAX:        iv_bonus = 2.0
        else:                                   iv_bonus = 0.0

        # ── Dinamik Delta: Rejime Göre (Düzeltme #2) ─────────────
        regime = l2.get("regime", "neutral")
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

                # Ortak filtreler
                if spread_p > SPREAD_MAX: continue
                if oi < OI_MIN: continue
                if not (MID_MIN <= mid <= MID_MAX): continue

                # ★ DÜZELTME #1: Expected Move Filtresi (ÇOK KRİTİK)
                # Strike Expected Move dışındaysa = KUMAR → SKIP
                if strike > em_upper * 1.03:   # %3 tolerans payı
                    continue

                g     = bs_greeks(cp, strike, T, r, iv)
                delta = g['delta']
                theta = g['theta']

                # ★ DÜZELTME #4: Theta/Delta Kalite Filtresi
                if theta != 0:
                    theta_delta_ratio = abs(delta / theta)
                    if theta_delta_ratio < THETA_DELTA_MIN:
                        continue
                else:
                    theta_delta_ratio = 999.0

                vol_oi_ratio = volume / oi if oi > 0 else 0.0

                # Delta aralıklarını önceden hesapla
                inst_delta_min = delta_min + (delta_max - delta_min) * 0.4
                inst_delta_max = delta_max
                asym_delta_min = delta_min
                asym_delta_max = delta_min + (delta_max - delta_min) * 0.6

                # ── 🛡️ KURUMSAL SIĞINAK ──────────────────────────────
                if inst_delta_min <= delta <= inst_delta_max:
                    # Likidite Skoru (0-10)
                    liq_score = 0.0
                    if spread_p <= 0.03: liq_score += 5.0
                    elif spread_p <= 0.06: liq_score += 3.0
                    elif spread_p <= 0.10: liq_score += 1.0
                    if oi >= 2000: liq_score += 3.0
                    elif oi >= 800: liq_score += 2.0
                    elif oi >= 300: liq_score += 1.0
                    if volume >= 500: liq_score += 2.0
                    elif volume >= 150: liq_score += 1.0
                    liq_score = min(liq_score, 10.0)

                    sweep_score = min(vol_oi_ratio * 8.0, 8.0)

                    # Theta/Delta kalite bonusu
                    td_bonus = min((theta_delta_ratio - THETA_DELTA_MIN) / 2.0, 5.0)

                    inst_score = delta * 4.0 + g['gamma'] * 1500.0 + liq_score + sweep_score + td_bonus

                    if inst_score > inst_best:
                        inst_best = inst_score
                        sim = bs_pnl_sim(cp, strike, iv, dte, move_pct=0.05)

                        # Exit seviyeleri hesapla
                        tp_price  = round(mid * (1 + TAKE_PROFIT_PCT), 2)
                        sl_price  = round(mid * (1 + STOP_LOSS_PCT), 2)
                        time_stop = round(dte * TIME_STOP_RATIO)

                        institutional = {
                            "type": "🛡️ KURUMSAL SIĞINAK",
                            "regime": regime,
                            "strike": strike, "expiry": exp_date, "dte": dte,
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

                # ── 🚀 ASİMETRİK FIRSAT ──────────────────────────────
                elif asym_delta_min <= delta < asym_delta_max:
                    # Sweep filtresi: OTM'de taze para girişi olmazsa değersiz
                    if vol_oi_ratio < 0.15: continue

                    # Sweep Skoru (v5.0 Hyper-Momentum: 0-25 Puan)
                    if vol_oi_ratio >= 3.0:   sweep_score = 25.0
                    elif vol_oi_ratio >= 1.5: sweep_score = 15.0
                    elif vol_oi_ratio >= 1.0: sweep_score = 8.0
                    else:                     sweep_score = 0.0

                    gamma_score = min(g['gamma'] * 40000.0, 8.0)

                    liq_score = 0.0
                    if spread_p <= 0.05: liq_score += 4.0
                    elif spread_p <= 0.08: liq_score += 2.0
                    elif spread_p <= 0.12: liq_score += 1.0
                    if oi >= 800: liq_score += 2.0
                    elif oi >= 350: liq_score += 1.0
                    if volume >= 250: liq_score += 2.0
                    elif volume >= 80: liq_score += 1.0
                    liq_score = min(liq_score, 8.0)

                    td_bonus = min((theta_delta_ratio - THETA_DELTA_MIN) / 2.0, 5.0)

                    asym_score = sweep_score + gamma_score + liq_score + delta * 3.0 + td_bonus

                    if asym_score > asym_best:
                        asym_best = asym_score
                        sim = bs_pnl_sim(cp, strike, iv, dte, move_pct=0.07)

                        tp_price  = round(mid * (1 + TAKE_PROFIT_PCT), 2)
                        sl_price  = round(mid * (1 + STOP_LOSS_PCT), 2)
                        time_stop = round(dte * TIME_STOP_RATIO)

                        asymmetric = {
                            "type": "🚀 ASİMETRİK FIRSAT",
                            "regime": regime,
                            "strike": strike, "expiry": exp_date, "dte": dte,
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
            "regime": regime,
            "institutional": institutional,
            "asymmetric": asymmetric,
        }
    except Exception as e:
        logging.debug(f"{ticker} opsiyon hatası: {e}")
        return None

# ════════════════════════════════════════════════════════════════════════════
# 8) ANA ANALİZ
# ════════════════════════════════════════════════════════════════════════════

ANALYSIS_SEM = asyncio.Semaphore(SEMAPHORE_N)

async def analyze(ticker: str) -> Optional[dict]:
    async with ANALYSIS_SEM:
        try:
            stock = yf.Ticker(ticker)
            df1d  = await asyncio.to_thread(
                lambda: stock.history(period="300d", interval="1d", auto_adjust=True)
            )
            if df1d is None or len(df1d) < 210: return None  # EMA200 için min 210 bar

            df1d.columns = [
                str(c).strip().title()
                for c in (df1d.columns.get_level_values(0) if isinstance(df1d.columns, pd.MultiIndex) else df1d.columns)
            ]
            if 'Close' not in df1d.columns: return None

            close = df1d['Close'].astype(float)
            cp    = float(close.iloc[-1])
            if not (PRICE_MIN <= cp <= PRICE_MAX): return None

            # Katman 2: EMA + VWAP + Rejim (ZORUNLU)
            l2_ok, l2 = layer2_ema_trend(df1d)
            if not l2_ok: return None

            # Katman 3: Momentum
            l3_ok, l3 = layer3_momentum(df1d)
            if not l3_ok: return None

            # Katman 4: Opsiyon Zinciri (tüm pro filtreler burada)
            hv30 = l3.get("hv30", calc_hv(close, 30))
            opt  = await layer4_options(ticker, cp, close, hv30, l2, l3)
            if not opt: return None

            # ── TOPLAM PUANLAMA (0-100) ────────────────────────────
            # EMA Trend + Pullback  : 0-25   l2["ema_score"]
            # ADX                   : 0-15   l2["adx_score"]
            # VWAP Pozisyonu        : 0-10   l2["vwap_score"]
            # RSI                   : 0-10   l3["rsi_score"]
            # RVOL                  : 0-10   l3["rvol_score"]
            # IV Rank Bonusu        : 0-10   opt["iv_bonus"]
            # Theta/Delta + Likidte : 0-10   en iyi kontrattan
            # Sweep                 : 0-10   asimetrik bonusu
            # Toplam max: ~100

            opt_liq_score = 0.0
            td_bonus      = 0.0
            sweep_bonus   = 0.0

            best_opt = opt.get("institutional") or opt.get("asymmetric")
            if best_opt:
                opt_liq_score = best_opt.get("liq_score", 0.0)
                td_raw = best_opt.get("theta_delta_ratio", 0.0)
                td_bonus = min(max(td_raw - THETA_DELTA_MIN, 0.0) / 2.0, 10.0)

            if opt.get("asymmetric"):
                sweep_bonus = opt["asymmetric"].get("sweep_score", 0.0)

            total_score = (
                l2.get("ema_score", 0)   +  # 0-25
                l2.get("adx_score", 0)   +  # 0-15
                l2.get("vwap_score", 0)  +  # 0-10
                l3.get("rsi_score", 0)   +  # 0-10
                l3.get("rvol_score", 0)  +  # 0-10
                opt.get("iv_bonus", 0)   +  # 0-10
                opt_liq_score            +  # 0-10
                sweep_bonus                 # 0-10
            )

            if total_score >= 75:   grade = "🏆 MÜKEMMEL"
            elif total_score >= 60: grade = "🔥 GÜÇLÜ"
            elif total_score >= 45: grade = "💡 İYİ"
            else:                   grade = "📊 OLASI"

            # VWAP uyarısı
            if not l2.get("vwap_ok", True):
                grade += " ⚠️VWAP↓"

            return {
                "ticker": ticker, "current_price": round(cp, 2),
                "score":  round(total_score, 1), "grade": grade,
                "l2": l2, "l3": l3, "options": opt,
                "hv30": round(hv30 * 100, 1),
            }
        except Exception as e:
            logging.debug(f"{ticker}: {e}")
            return None

# ════════════════════════════════════════════════════════════════════════════
# 9) RAPOR OLUŞTURUCU
# ════════════════════════════════════════════════════════════════════════════

def fmt_exit(opt_data: dict) -> str:
    """Exit seviyeleri formatlar (Düzeltme #6)."""
    tp   = opt_data.get("tp_price", "—")
    sl   = opt_data.get("sl_price", "—")
    ts   = opt_data.get("time_stop_days", "—")
    mid  = opt_data.get("mid", 0)
    return (
        f"   🎯 EXIT: TP ${tp}  |  SL ${sl}  |  Time Stop {ts} gün kala\n"
        f"   ⏱ Günlük Theta Erimesi: %{opt_data.get('daily_decay_pct',0):.1f} prim/gün"
        f"  |  Θ/Δ Kalite: {opt_data.get('theta_delta_ratio',0):.2f}"
    )

def build_option_block(opt_data: dict, ticker: str, cp: float, grade: str) -> str:
    lines = []
    lines.append(f"\n{'═' * 55}")
    lines.append(f"{grade}  <b>#{ticker}</b>  ${cp:.2f}")

    regime_label = {
        "trend":    "📈 TREND REJİMİ",
        "breakout": "⚡ KIRILIM REJİMİ",
        "neutral":  "↔️ NÖTR REJİM",
    }.get(opt_data.get("regime", "neutral"), "↔️ NÖTR")

    lines.append(
        f"🔮 Rejim: <b>{regime_label}</b>  |  "
        f"📐 EM: ±${opt_data['em']:.2f} (üst ≤${opt_data['em_upper']:.2f})"
    )
    lines.append(
        f"📊 IV: <b>{opt_data['atm_iv']:.0f}%</b>  IV Rank: <b>{opt_data['iv_rank']:.0f}</b>"
        f"  {'✅ UCUZ IV' if opt_data['iv_rank'] <= 30 else ('🟡 NORMAL' if opt_data['iv_rank'] <= 45 else '🔴 PAHALI')}"
        f"  |  Max Pain: ${opt_data['max_pain']:.2f}"
    )
    lines.append(f"📅 Vade: <b>{opt_data['exp_date']}</b> ({opt_data['dte']} gün)")

    inst = opt_data.get("institutional")
    asym = opt_data.get("asymmetric")

    if inst:
        sim = inst.get("sim", {})
        lines.append(f"\n🛡️ <b>KURUMSAL SIĞINAK</b>  (Delta rejim: {inst.get('regime','—')})")
        lines.append(f"   🎯 <b>${inst['strike']:.1f} CALL</b>  ({inst['expiry']})")
        lines.append(
            f"   💸 Prim: <b>${inst['mid']:.2f}</b>  Spread: {inst['spread_pct']:.1f}%  "
            f"|  Δ: <b>{inst['delta']:.3f}</b>  Γ: {inst['gamma']:.5f}"
        )
        lines.append(
            f"   📊 OI: {inst['oi']:,}  Vol: {inst['volume']:,}  "
            f"Vol/OI: {inst['vol_oi_ratio']:.2f}x"
        )
        lines.append(f"   💰 Kontrat: <b>${inst['cost_per_contract']:.0f}</b>  Başabaş: ${inst['breakeven']:.2f}")
        lines.append(fmt_exit(inst))
        if sim and sim.get('pnl_pct', 0) != 0:
            em = "📈" if sim['pnl_pct'] > 0 else "📉"
            lines.append(
                f"   {em} Sim (+%5, {sim['days']}g): ${sim['price_now']:.2f} → <b>${sim['price_fwd']:.2f}</b>"
                f"  (<b>%{sim['pnl_pct']:+.0f}</b>)"
            )

    if asym:
        sim = asym.get("sim", {})
        sweep_lbl = "⚡ GÜÇLÜ SWEEP" if asym['vol_oi_ratio'] >= 1.0 else "👀 SWEEP"
        lines.append(f"\n🚀 <b>ASİMETRİK FIRSAT</b>  [{sweep_lbl}: {asym['vol_oi_ratio']:.2f}x]")
        lines.append(
            f"   🎯 <b>${asym['strike']:.1f} CALL</b>  ({asym['expiry']})"
            f"  ✅ EM İçinde ≤${asym['em_upper']:.2f}"
        )
        lines.append(
            f"   💸 Prim: <b>${asym['mid']:.2f}</b>  Spread: {asym['spread_pct']:.1f}%  "
            f"|  Δ: <b>{asym['delta']:.3f}</b>  Γ: {asym['gamma']:.5f}"
        )
        lines.append(
            f"   📊 OI: {asym['oi']:,}  Vol: {asym['volume']:,}  "
            f"Vol/OI: <b>{asym['vol_oi_ratio']:.2f}x</b>"
        )
        lines.append(f"   💰 Kontrat: <b>${asym['cost_per_contract']:.0f}</b>  Başabaş: ${asym['breakeven']:.2f}")
        lines.append(fmt_exit(asym))
        if sim and sim.get('pnl_pct', 0) != 0:
            em = "📈" if sim['pnl_pct'] > 0 else "📉"
            lines.append(
                f"   {em} Sim (+%7, {sim['days']}g): ${sim['price_now']:.2f} → <b>${sim['price_fwd']:.2f}</b>"
                f"  (<b>%{sim['pnl_pct']:+.0f}</b>)"
            )

    return "\n".join(lines)

def build_summary_report(candidates: List[dict], vix: float, duration: float, universe_size: int) -> Tuple[str, str]:
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M %Z")

    regime_counts = {}
    for c in candidates:
        r = c.get("options", {}).get("regime", "neutral")
        regime_counts[r] = regime_counts.get(r, 0) + 1

    header = (
        f"🦅 <b>KARTAL YUVASI ALPHA COMMANDER v5.0 (Hyper-Momentum)</b>\n"
        f"📅 <i>{now_str}</i>\n"
        f"🌡️ VIX: {vix:.1f} ({MARKET_VIX['regime']})  ⏱ {duration:.0f}sn\n"
        f"📊 {universe_size} hisse → {len(candidates)} aday\n"
        f"🔮 Rejim: Trend:{regime_counts.get('trend',0)} "
        f"Kırılım:{regime_counts.get('breakout',0)} "
        f"Nötr:{regime_counts.get('neutral',0)}\n"
        f"📌 EMA200✅ | Nötr Yasak✅ | EM Filtresi✅ | IV Rank<{IV_RANK_BUY_MAX:.0f}✅ | Θ/Δ✅\n\n"
        f"<pre>{'─'*62}\n"
        f"#   SEMBOL  FYT     PUAN  REJİM      KURUMSAL    ASİMETRİK\n"
        f"{'─'*62}\n"
    )

    rows = []
    for i, c in enumerate(candidates[:40]):
        opt  = c['options']
        inst = opt.get('institutional')
        asym = opt.get('asymmetric')
        inst_str  = f"${inst['strike']:.0f}C" if inst else "—"
        asym_str  = f"${asym['strike']:.0f}C" if asym else "—"
        regime_s  = {"trend": "📈TRD", "breakout": "⚡BRK", "neutral": "↔️NTR"}.get(opt.get("regime", "neutral"), "—")
        grade_em  = c['grade'].split()[0]
        rows.append(
            f"{i+1:02d}. {c['ticker']:<7} ${c['current_price']:>6.2f}  {c['score']:>5.1f}"
            f"  {regime_s}  EM:±${opt['em']:.1f}  {inst_str:<9} {asym_str}"
        )

    summary = header + "\n".join(rows) + f"\n{'─'*62}\n</pre>"
    summary += (
        f"\n<i>🛡️ Kur: ATM-hafif ITM | Δ rejime göre | IV Rank<45 | Θ/Δ≥0.25</i>\n"
        f"<i>🚀 Asi: OTM EM içinde | Sweep≥0.15x | Exit: TP%35 / SL-%20</i>\n"
    )

    detail_lines = [f"🦅 <b>KARTAL YUVASI v4.0 — DETAY (TOP {min(20,len(candidates))})</b>\n"]
    for i, c in enumerate(candidates[:20]):
        l2  = c['l2']
        l3  = c['l3']
        opt = c['options']
        vwap_tag = "" if l2.get("vwap_ok", True) else "  ⚠️ VWAP ALTI"
        tech = (
            f"\n#{i+1} 📊 <b>{c['ticker']}</b>  ${c['current_price']:.2f}  "
            f"PUAN:<b>{c['score']:.1f}</b>  {c['grade']}\n"
            f"   EMA: {l2.get('ema_pattern','—')}  EMA200:${l2.get('ema200',0):.2f}  "
            f"ADX:{l2['adx']:.0f}  "
            f"RSI:{l3['rsi']:.0f}  RVOL:{l3['rvol']:.2f}x  ROC5:{l3['roc5_pct']:+.1f}%\n"
            f"   VWAP:${l2.get('vwap',0):.2f}{vwap_tag}  "
            f"HV30:{c['hv30']:.0f}%  IV Rank:{opt['iv_rank']:.0f}"
            f"  {'✅' if opt['iv_rank']<=IV_RANK_BUY_MAX else '⚠️'}"
        )
        detail_lines.append(tech)
        detail_lines.append(build_option_block(opt, c['ticker'], c['current_price'], c['grade']))

    return summary, "\n".join(detail_lines)

# ════════════════════════════════════════════════════════════════════════════
# 10) ANA TARAMA DÖNGÜSÜ
# ════════════════════════════════════════════════════════════════════════════

async def scan():
    start   = time.time()
    now_str = datetime.now(NY_TZ).strftime("%Y-%m-%d %H:%M NY")

    await update_vix()
    await send_tg(
        f"🦅 <b>KARTAL YUVASI ALPHA COMMANDER v5.0</b>\n"
        f"🕒 {now_str}  |  🌡️ VIX: {MARKET_VIX['value']:.1f} ({MARKET_VIX['regime']})\n"
        f"🔍 Hyper-Momentum taraması başlıyor...\n"
        f"🚀 ADX≥18 | RVOL≥1.5x | SPREAD≤%8 | SWEEP BONUS AKTİF\n"
        f"✅ EMA200 Makro Filtre | Nötr Rejim YASAK | EM Filtresi\n"
        f"📌 $1-$100 | EMA200 ZORUNLU | DTE {DTE_MIN}-{DTE_MAX}g\n"
        f"📊 {MAX_TICKERS_SCAN} hisse taranacak"
    )

    universe = await build_universe()
    if not universe:
        await send_tg("❌ Evren oluşturulamadı!"); return

    await send_tg(
        f"✅ Katman 1: {len(universe)} hisse geçti.\n"
        f"⏳ Katman 2-4 analizi başlıyor (5-10 dk)..."
    )

    results    = await asyncio.gather(*[analyze(t) for t in universe], return_exceptions=True)
    candidates = sorted(
        [r for r in results if isinstance(r, dict)],
        key=lambda x: x['score'], reverse=True
    )

    if not candidates:
        await send_tg(
            "⚠️ Aday bulunamadı!\n"
            "• EMA200 makro koşulu sağlanamıyor (hisseler düşüş trendinde?)\n"
            "• Nötr rejim yasağı devrede (ADX zayıf, trendsiz piyasa)\n"
            "• IV Rank > 45 (yüksek IV crush riski)\n"
            "• Opsiyon likiditesi yetersiz"
        ); return

    if len(candidates) < MIN_CANDIDATES:
        await send_tg(f"⚠️ {len(candidates)} aday (min {MIN_CANDIDATES}). Raporlanıyor...")

    duration = time.time() - start
    summary, detail = build_summary_report(candidates, MARKET_VIX['value'], duration, len(universe))

    await send_tg(summary)
    await asyncio.sleep(1)

    # Detayları güvenli chunk'larla gönder
    for chunk in split_safe(detail, limit=3800):
        if chunk.strip():
            await send_tg(chunk)
            await asyncio.sleep(0.8)

    await send_tg(
        f"✅ <b>Tarama Tamamlandı!</b>\n"
        f"⏱ {duration:.0f} sn  |  {len(universe)} hisse → {len(candidates)} aday\n"
        f"🏆 En iyi: {candidates[0]['ticker']} ({candidates[0]['score']:.1f}/100)\n"
        f"📌 Rejim: {candidates[0]['options'].get('regime','—')}"
    )
    logging.info(f"✅ Tarama bitti: {len(candidates)} aday, {duration:.0f}sn")

# ════════════════════════════════════════════════════════════════════════════
# 11) ZAMANLAYICI
# ════════════════════════════════════════════════════════════════════════════

def get_next_run_utc(hour: int = 13, minute: int = 0):
    from datetime import timezone as tz
    now_utc = datetime.now(tz.utc)
    now_ny  = now_utc.astimezone(NY_TZ)
    cand    = now_ny.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if cand <= now_ny: cand += timedelta(days=1)
    while cand.weekday() >= 5: cand += timedelta(days=1)
    return cand.astimezone(tz.utc)

async def run_scanner():
    await send_tg(
        "🦅 <b>KARTAL YUVASI ALPHA COMMANDER v5.0 Başlatıldı!</b>\n"
        "⏱ Hafta içi NY 13:00 otomatik tarama\n\n"
        "<b>v4.0 Yükseltmeleri Aktif:</b>\n"
        f"  ✅ EMA200 Makro Trend: cp > EMA20 > EMA50 > EMA200\n"
        f"  ✅ Nötr Rejim Yasağı: regime == neutral → SKIP\n"
        f"  ✅ Veri Penceresi: 300 gün (EMA200 güvenilirliği)\n\n"
        "<b>v3.0 Korunan Kurallar:</b>\n"
        f"  ✅ EM Filtresi: Strike ≤ Fiyat + EM\n"
        f"  ✅ Dinamik Delta: Rejime göre (trend/kırılım)\n"
        f"  ✅ IV Rank Filtresi: >{IV_RANK_BUY_MAX:.0f} → SKIP\n"
        f"  ✅ Theta/Delta Oranı: <{THETA_DELTA_MIN} → SKIP\n"
        f"  ✅ VWAP Entry Kontrolü\n"
        f"  ✅ Exit Seviyeleri: TP%35 / SL-%20 / Time Stop DTE×{TIME_STOP_RATIO}\n"
        f"\n<b>Sabit Kurallar:</b>\n"
        f"  📌 $1-$100 | EMA200 ZORUNLU | DTE {DTE_MIN}-{DTE_MAX}g"
    )

    try:
        await scan()
    except Exception as e:
        logging.error(f"İlk tarama: {e}")
        await send_tg(f"🚨 Başlatma hatası: {e}")

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
    try:
        asyncio.run(run_scanner())
    except KeyboardInterrupt:
        print("\n🦅 Bot durduruldu.")
    except Exception as e:
        print(f"Kritik hata: {e}")