"""
================================================================
⚡ ATMACA DAYTRADE BOT V1.0
================================================================
SWING115 BOGA botundan türetildi. Swing'e özgü her şey çıkarıldı.
Daytrade'e özgü her şey eklendi.

MİMARİ:
  LAYER 0 → Finviz scrape → Premarket gapper listesi (~200-300 aday)
             + Fallback: yfinance ile hacim patlaması taraması
  LAYER 1 → yfinance bulk 1D + 5m veri çek → Vektörel ön filtre
             (ATR%, float proxy, hacim oranı, fiyat aralığı)
  LAYER 2 → Her adaya daytrade skorlama:
             VWAP pozisyonu, premarket gap%, intraday momentum,
             relative volume, short float, bid/ask proxy
  LAYER 3 → Top 15 → Giriş/Stop/Hedef zonu hesapla (ATR bazlı)
  OUTPUT  → JSON kayıt + Telegram bildirim (09:15 ET'de hazır)

ZAMANLAMAЯ:
  08:45–09:10 ET → Finviz scrape + yfinance premarket veri
  09:10–09:15 ET → Skorlama + zone hesaplama
  09:15 ET       → Telegram raporu

SWING115'TEN ÇIKARILAN:
  - Haftalık universe build (8-15 dk)
  - Insider activity (swing-only)
  - Financial health (fundamental, swing-only)
  - Options sentiment (overnight pozisyon için)
  - Gemini AI özetleri
  - 5Y history cache
  - Ichimoku (günlük timeframe)
  - SQUEEZE/SPRING/AWAKENING sinyalleri

EKLENEN:
  - Finviz gapper scraper (ücretsiz, kırılgan — fallback var)
  - Premarket gap% hesabı
  - VWAP (intraday)
  - 5m momentum ve hacim patlaması
  - PDT uyarısı
  - Gap and Go / Pullback to VWAP / Reversal sinyal tipleri
  - ATR bazlı dar daytrade stop (swing gibi 1ATR değil, 0.5ATR)
  - Günlük R/R hedef: minimum 2:1

================================================================
"""

import json
import asyncio
import logging
import time
import os
import random
import re

import aiohttp
import pandas as pd
import numpy as np
import yfinance as yf

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

from ta.volatility import AverageTrueRange, BollingerBands
from ta.trend import EMAIndicator, MACD
from ta.momentum import RSIIndicator
from ta.volume import OnBalanceVolumeIndicator

# ================================================================
# 🔹 LOGGING
# ================================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# ================================================================
# 🔹 ZAMAN
# ================================================================
NY_TZ = ZoneInfo("America/New_York")

# ================================================================
# 🔹 TELEGRAM
# ================================================================
TELEGRAM_API_KEY = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID = "-1003569445341"
ENABLE_TELEGRAM_NOTIFICATIONS = True

# ================================================================
# 🔹 DAYTRADE FİLTRE PARAMETRELERİ
# ================================================================

# Fiyat aralığı — çok ucuz hisseler spread'den ölür, çok pahallılar margin yer
PRICE_MIN = 5.0
PRICE_MAX = 300.0

# Minimum günlük hacim (1M+ = güvenli spread)
MIN_AVG_VOLUME_10D  = 500_000    # 10 günlük ortalama
MIN_RVOL_PREMARKET  = 1.5        # Premarket'te ortalamaya göre min hacim oranı

# Premarket gap — pozitif katalizör için minimum gap
GAP_MIN_PCT   = 2.0   # %2 altı zayıf gapper
GAP_IDEAL_PCT = 5.0   # %5+ güçlü gapper (ideal)
GAP_DANGER_PCT = 20.0 # %20+ genellikle açılışta dump olur (dikkat)

# ATR filtresi — daytrade için hisse yeterince hareket etmeli
ATR_MIN_PCT_1D = 0.015  # Günlük ATR en az fiyatın %1.5'i
ATR_MAX_PCT_1D = 0.12   # %12 üzeri çok volatil, stop yönetimi zorlaşır

# RSI — daytrade'de aşırı alım/satım tradeleri de geçerli
RSI_MIN = 30   # 30 altı reversal trade için
RSI_MAX = 80   # 80 üstü sadece çok güçlü momentum varsa geç

# Minimum R/R
MIN_RR_DAYTRADE = 2.0

# Final çıktı
TOP_GAPPERS    = 250  # Finviz'den max bu kadar aday çek
TOP_CANDIDATES = 15   # Son analizde bu kadar aday tut

# ================================================================
# 🔹 OUTPUT
# ================================================================
OUTPUT_DIR      = r"C:\Users\afksm\finma\frontend\public"
OUTPUT_JSON     = "daytrade_picks.json"
OUTPUT_ALL_JSON = "daytrade_all_picks.json"

# ================================================================
# 🔹 CACHE
# ================================================================
BULK_1D_CACHE: Dict[str, pd.DataFrame] = {}   # 1D bar cache (ön filtre için)
FINVIZ_CACHE:  Dict[str, Any] = {"ts": 0.0, "data": []}
FINVIZ_CACHE_TTL = 1800  # 30 dakika — gün içinde 1 kez yeterli

# ================================================================
# ================================================================
# SECTION 1: TELEGRAM
# ================================================================
# ================================================================

async def send_telegram(msg: str) -> bool:
    if not ENABLE_TELEGRAM:
        return True
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": msg[:4096],
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }
    for attempt in range(3):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        return True
                    logging.warning(f"TG HTTP {resp.status}")
        except Exception as e:
            logging.warning(f"TG attempt {attempt+1}: {e}")
        await asyncio.sleep(2 ** attempt)
    return False

# ================================================================
# ================================================================
# SECTION 2: LAYER 0 — FİNVİZ SCRAPER (Premarket Gapper)
# ================================================================
# ================================================================

async def scrape_finviz_gappers(session: aiohttp.ClientSession) -> List[Dict]:
    """
    Finviz ücretsiz screener'dan gapper listesi çeker.
    URL: Hacim > 500K, Fiyat 5-300, Değişim > %2, ABD hisseleri
    Kırılgan — Finviz HTML değişirse parse bozulabilir.
    Fallback: yfinance_premarket_scan() devreye girer.
    """
    url = (
        "https://finviz.com/screener.ashx"
        "?v=111"
        "&f=geo_usa,sh_price_5to300,sh_avgvol_500o,ta_change_u2"
        "&o=-change"          # En yüksek değişim önce
        "&r=1"
    )
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finviz.com/",
    }

    results = []
    # Finviz sayfalama: her sayfa 20 hisse, 5 sayfa = 100 hisse yeterli
    for page in range(1, 6):
        r_param = (page - 1) * 20 + 1
        page_url = url.replace("&r=1", f"&r={r_param}")
        try:
            async with session.get(page_url, headers=headers, timeout=aiohttp.ClientTimeout(total=12)) as resp:
                if resp.status != 200:
                    logging.warning(f"Finviz HTTP {resp.status} page {page}")
                    break
                html_text = await resp.text()
                soup = BeautifulSoup(html_text, "html.parser")

                # Finviz tablosu: class="screener-body-table-nw" veya "table-light"
                rows = soup.select("tr.styled-row-cp") or soup.select("tr[class*='screener']")
                if not rows:
                    # Genel tablo parse — daha kırılgan ama fallback
                    table = soup.find("table", {"id": "screener-content"})
                    if table:
                        rows = table.find_all("tr")[1:]  # header atla

                for row in rows:
                    cells = row.find_all("td")
                    if len(cells) < 9:
                        continue
                    try:
                        ticker  = cells[1].get_text(strip=True)
                        price_s = cells[8].get_text(strip=True).replace(",", "")
                        chg_s   = cells[9].get_text(strip=True).replace("%", "").replace(",", "")
                        vol_s   = cells[10].get_text(strip=True).replace(",", "")

                        if not ticker.isalpha() or not (1 <= len(ticker) <= 5):
                            continue

                        price  = float(price_s)
                        change = float(chg_s)
                        volume = float(vol_s) if vol_s.isdigit() else 0.0

                        if not (PRICE_MIN <= price <= PRICE_MAX):
                            continue
                        if change < GAP_MIN_PCT:
                            continue

                        results.append({
                            "ticker":      ticker,
                            "price":       price,
                            "change_pct":  change,
                            "volume":      volume,
                            "source":      "finviz"
                        })
                    except (ValueError, IndexError):
                        continue

            await asyncio.sleep(random.uniform(1.5, 2.5))  # Finviz rate limit koruması
        except Exception as e:
            logging.warning(f"Finviz page {page} error: {e}")
            break

    logging.info(f"[Finviz] {len(results)} gapper scraped")
    return results


async def yfinance_premarket_scan() -> List[Dict]:
    """
    Finviz scrape başarısız olursa devreye giren fallback.
    Bilinen likit hisse listesinden (S&P 500 + Russell 2000 örneklemi)
    yfinance ile premarket değişimini çeker.

    NOT: Bu liste sabit — gerçek bir gapper tarayıcısı değildir.
    Ama Finviz'e erişim yoksa en hızlı alternatiftir.
    """
    # S&P 500 + yüksek hareket potansiyeli olan hisseler
    WATCHLIST = [
        # Mega cap — her zaman likit
        "AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","NFLX","CRM",
        # Yüksek beta / volatil
        "MARA","RIOT","COIN","HOOD","SOFI","LCID","RIVN","PLUG","FCEL","BLNK",
        "UPST","AFRM","SQ","PYPL","RBLX","SNAP","PINS","SPOT","LYFT","UBER",
        "PLTR","SOUN","JOBY","ACHR","CLOV","SPCE","BBBY","AMC","GME",
        # Biotech / Pharma (yüksek gap potansiyeli)
        "MRNA","BNTX","VKTX","SAVA","AVXL","PRTA","SRPT","IONS","INCY","BMRN",
        # Small/Mid cap momentum
        "SMCI","CELH","HIMS","CPRX","GRND","SIRI","FFIE","MULN","IDAI",
        # Seçili ETF'ler (pazar yönü için)
        "SPY","QQQ","IWM","ARKK",
    ]

    results = []
    try:
        # Hepsini birden indir — hızlı
        data = await asyncio.to_thread(
            yf.download,
            WATCHLIST,
            period="2d",
            interval="1d",
            progress=False,
            group_by="ticker",
            ignore_tz=True,
        )

        for ticker in WATCHLIST:
            try:
                if ticker not in data or data[ticker].empty:
                    continue
                df = data[ticker].dropna()
                if len(df) < 2:
                    continue
                prev_close = float(df["Close"].iloc[-2])
                last_close = float(df["Close"].iloc[-1])
                volume     = float(df["Volume"].iloc[-1])
                chg_pct    = (last_close - prev_close) / prev_close * 100

                if not (PRICE_MIN <= last_close <= PRICE_MAX):
                    continue
                if chg_pct < GAP_MIN_PCT:
                    continue

                results.append({
                    "ticker":     ticker,
                    "price":      round(last_close, 2),
                    "change_pct": round(chg_pct, 2),
                    "volume":     volume,
                    "source":     "yf_fallback"
                })
                BULK_1D_CACHE[ticker] = data[ticker].copy()
            except Exception:
                continue
    except Exception as e:
        logging.error(f"yfinance fallback scan error: {e}")

    results.sort(key=lambda x: x["change_pct"], reverse=True)
    logging.info(f"[yf_fallback] {len(results)} gappers found")
    return results


async def get_gapper_universe() -> List[Dict]:
    """
    LAYER 0 ana fonksiyon.
    1) Cache kontrol
    2) Finviz scrape dene
    3) Başarısızsa yfinance fallback
    4) Dedup + sırala
    """
    now = time.time()
    if FINVIZ_CACHE["data"] and (now - FINVIZ_CACHE["ts"]) < FINVIZ_CACHE_TTL:
        logging.info(f"[Cache] Gapper listesi cache'den yüklendi ({len(FINVIZ_CACHE['data'])})")
        return FINVIZ_CACHE["data"]

    gappers = []
    async with aiohttp.ClientSession() as session:
        try:
            gappers = await scrape_finviz_gappers(session)
        except Exception as e:
            logging.warning(f"Finviz scrape failed: {e}")

    if len(gappers) < 10:
        logging.warning("[Finviz] Yeterli gapper yok, yfinance fallback çalışıyor...")
        gappers = await yfinance_premarket_scan()

    # Dedup
    seen = set()
    deduped = []
    for g in gappers:
        if g["ticker"] not in seen:
            seen.add(g["ticker"])
            deduped.append(g)

    # Gap büyüklüğüne göre sırala, ama %20+ üstünü sona at (pump dump riski)
    safe    = [g for g in deduped if g["change_pct"] <= GAP_DANGER_PCT]
    danger  = [g for g in deduped if g["change_pct"] >  GAP_DANGER_PCT]
    safe.sort(key=lambda x: x["change_pct"], reverse=True)

    final = (safe + danger)[:TOP_GAPPERS]

    FINVIZ_CACHE["ts"]   = now
    FINVIZ_CACHE["data"] = final
    logging.info(f"[LAYER 0] {len(final)} aday hazır ({len(danger)} tehlikeli gap işaretlendi)")
    return final

# ================================================================
# ================================================================
# SECTION 3: LAYER 1 — HIZLI VEKTÖRİYEL ÖN FİLTRE
# ================================================================
# ================================================================

async def bulk_fetch_1d(tickers: List[str]) -> None:
    """
    Gapper listesi için 1D bar'larını toplu indir.
    BULK_1D_CACHE'e yazar — Layer 1 filtre buradan okur.
    """
    missing = [t for t in tickers if t not in BULK_1D_CACHE]
    if not missing:
        return

    CHUNK = 100
    logging.info(f"[LAYER 1] {len(missing)} ticker için 1D veri indiriliyor...")
    for i in range(0, len(missing), CHUNK):
        chunk = missing[i:i + CHUNK]
        try:
            data = await asyncio.to_thread(
                yf.download,
                chunk,
                period="30d",   # ATR, RSI, hacim ortalamasi için 30 gün yeterli
                interval="1d",
                progress=False,
                group_by="ticker",
                ignore_tz=True,
                threads=True,
            )
            # Single ticker edge case
            if not isinstance(data.columns, pd.MultiIndex) and len(chunk) == 1:
                sym = chunk[0]
                data.columns = pd.MultiIndex.from_tuples([(sym, c) for c in data.columns])

            for sym in chunk:
                try:
                    if sym in data and not data[sym].empty:
                        BULK_1D_CACHE[sym] = data[sym].dropna().copy()
                except Exception:
                    pass
        except Exception as e:
            logging.warning(f"Bulk 1D chunk {i} error: {e}")

        await asyncio.sleep(0.5)

    logging.info(f"[LAYER 1] Bulk 1D tamamlandı. Cache: {len(BULK_1D_CACHE)} ticker")


def layer1_filter(ticker: str, gap_info: Dict) -> Optional[Dict]:
    """
    Hızlı vektöryel filtre — 1D bar'lardan hesaplanır, network yok.
    Geçen hisseler Layer 2'ye taşınır.
    """
    df = BULK_1D_CACHE.get(ticker)
    if df is None or len(df) < 10:
        return None

    try:
        close  = df["Close"]
        high   = df["High"]
        low    = df["Low"]
        volume = df["Volume"]

        last_price = float(close.iloc[-1])

        # --- Fiyat aralığı ---
        if not (PRICE_MIN <= last_price <= PRICE_MAX):
            return None

        # --- Hacim filtresi ---
        avg_vol_10 = float(volume.tail(10).mean())
        avg_vol_5  = float(volume.tail(5).mean())
        avg_vol_20 = float(volume.tail(20).mean()) if len(volume) >= 20 else avg_vol_10

        if avg_vol_10 < MIN_AVG_VOLUME_10D:
            return None

        # Relative Volume (RVOL) — bugünkü hacim ortalamanın kaç katı
        rvol = avg_vol_5 / avg_vol_20 if avg_vol_20 > 0 else 0.0

        # --- ATR filtresi ---
        if len(close) >= 14:
            atr_series = AverageTrueRange(high, low, close, 14).average_true_range()
            atr_val    = float(atr_series.iloc[-1])
        else:
            atr_val = last_price * 0.03

        atr_pct = atr_val / last_price
        if not (ATR_MIN_PCT_1D <= atr_pct <= ATR_MAX_PCT_1D):
            return None

        # --- RSI ---
        rsi_val = 50.0
        if len(close) >= 14:
            rsi_val = float(RSIIndicator(close, 14).rsi().iloc[-1])
        if rsi_val < RSI_MIN or rsi_val > RSI_MAX:
            return None

        # --- Dollar hacim ---
        dollar_vol = last_price * avg_vol_10
        if dollar_vol < 1_000_000:   # $1M altı daytrade için çok ince
            return None

        return {
            "ticker":      ticker,
            "price":       round(last_price, 2),
            "atr":         round(atr_val, 4),
            "atr_pct":     round(atr_pct * 100, 2),
            "rsi":         round(rsi_val, 1),
            "rvol":        round(rvol, 2),
            "avg_vol_10d": int(avg_vol_10),
            "dollar_vol":  round(dollar_vol / 1e6, 2),   # Milyon $
            "change_pct":  gap_info.get("change_pct", 0.0),
            "gap_source":  gap_info.get("source", "unknown"),
            "df_1d":       df,
        }
    except Exception as e:
        logging.debug(f"layer1_filter {ticker}: {e}")
        return None

# ================================================================
# ================================================================
# SECTION 4: LAYER 2 — İNTRADAY VERİ + DAYTRADE SKORLAMA
# ================================================================
# ================================================================

def calculate_vwap(df: pd.DataFrame) -> Optional[float]:
    """
    Intraday VWAP hesabı.
    Formül: Σ(Typical Price × Volume) / Σ(Volume)
    """
    try:
        tp = (df["High"] + df["Low"] + df["Close"]) / 3
        vwap = (tp * df["Volume"]).cumsum() / df["Volume"].cumsum()
        return float(vwap.iloc[-1])
    except Exception:
        return None


async def fetch_intraday_5m(ticker: str) -> Optional[pd.DataFrame]:
    """
    5 dakikalık intraday bar'ları çeker.
    yfinance: period="1d", interval="5m" → bugünün tüm 5m bar'ları
    3 deneme, exponential backoff.
    """
    for attempt in range(3):
        try:
            await asyncio.sleep(random.uniform(0.1, 0.3) + attempt * 0.5)
            df = await asyncio.to_thread(
                yf.download,
                ticker,
                period="1d",
                interval="5m",
                progress=False,
                ignore_tz=True,
            )
            if df is None or df.empty or len(df) < 3:
                continue
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df = df.rename(columns=str.capitalize)
            df = df.dropna()
            if len(df) >= 3:
                return df
        except Exception as e:
            if attempt == 2:
                logging.debug(f"{ticker} 5m fetch failed: {e}")
    return None


def score_daytrade_candidate(candidate: Dict, df_5m: Optional[pd.DataFrame]) -> Dict:
    """
    Daytrade skorlama motoru.
    MAX puan: 100
    
    FAKTÖRLER:
      1. Gap büyüklüğü ve kalitesi           (0-20 puan)
      2. RVOL (hacim patlaması)               (0-20 puan)
      3. VWAP pozisyonu (intraday)            (0-20 puan)
      4. 5m momentum (açılış baskısı)         (0-15 puan)
      5. ATR uyumu (hedef ulaşılabilirliği)   (0-10 puan)
      6. RSI konumu                           (0-10 puan)
      7. Gap tehlike cezası                   (0 veya -15)
    """
    score   = 0.0
    details = []
    signals = []   # GAP_AND_GO / PULLBACK_VWAP / REVERSAL

    ticker    = candidate["ticker"]
    gap_pct   = candidate.get("change_pct", 0.0)
    rvol      = candidate.get("rvol", 1.0)
    atr_pct   = candidate.get("atr_pct", 2.0)
    rsi       = candidate.get("rsi", 50.0)
    price     = candidate.get("price", 0.0)
    atr_abs   = candidate.get("atr", price * 0.02)

    # ── 1. GAP PUANI ──────────────────────────────────────────────
    if gap_pct >= 10.0:
        score += 18.0
        details.append(f"🚀 Güçlü Gap: +{gap_pct:.1f}%")
        signals.append("GAP_AND_GO")
    elif gap_pct >= 5.0:
        score += 14.0
        details.append(f"📈 Gap: +{gap_pct:.1f}%")
        signals.append("GAP_AND_GO")
    elif gap_pct >= 2.0:
        score += 8.0
        details.append(f"↗️ Zayıf Gap: +{gap_pct:.1f}%")
    else:
        score += 2.0

    # %20+ gap = pump dump riski → ceza
    if gap_pct > GAP_DANGER_PCT:
        score -= 15.0
        details.append(f"⚠️ TEHLİKELİ GAP ({gap_pct:.0f}%) — Pump/Dump riski!")

    # ── 2. RVOL PUANI ─────────────────────────────────────────────
    if rvol >= 3.0:
        score += 20.0
        details.append(f"🔥 RVOL: {rvol:.1f}x (Kurumsal İlgi)")
    elif rvol >= 2.0:
        score += 14.0
        details.append(f"💪 RVOL: {rvol:.1f}x (Güçlü)")
    elif rvol >= 1.5:
        score += 8.0
        details.append(f"📊 RVOL: {rvol:.1f}x (Ortalama Üstü)")
    elif rvol >= 1.0:
        score += 3.0
        details.append(f"📉 RVOL: {rvol:.1f}x (Zayıf)")
    else:
        score -= 5.0
        details.append(f"⚠️ RVOL: {rvol:.1f}x (Hacimsiz!)")

    # ── 3. VWAP POZİSYONU (5m verisi gerekir) ─────────────────────
    vwap = None
    price_vs_vwap = 0.0

    if df_5m is not None and len(df_5m) >= 3:
        vwap = calculate_vwap(df_5m)

    if vwap and vwap > 0:
        price_vs_vwap = (price - vwap) / vwap * 100
        if price_vs_vwap > 0.5:
            score += 20.0
            details.append(f"✅ VWAP Üstünde: +{price_vs_vwap:.2f}% (Long Bias)")
            signals.append("GAP_AND_GO") if "GAP_AND_GO" not in signals else None
        elif price_vs_vwap > 0:
            score += 12.0
            details.append(f"🟡 VWAP Hemen Üstünde: +{price_vs_vwap:.2f}%")
        elif price_vs_vwap > -0.5:
            score += 6.0
            details.append(f"🔄 VWAP'a Test: {price_vs_vwap:.2f}% (Pullback Fırsatı)")
            signals.append("PULLBACK_VWAP")
        else:
            score -= 5.0
            details.append(f"🔴 VWAP Altında: {price_vs_vwap:.2f}% (Zayıf)")
    else:
        # VWAP hesaplanamadı — nötr
        details.append("⚪ VWAP: Hesaplanamadı")

    # ── 4. 5M MOMENTUM ────────────────────────────────────────────
    if df_5m is not None and len(df_5m) >= 5:
        try:
            close_5m = df_5m["Close"] if "Close" in df_5m.columns else df_5m["close"]
            vol_5m   = df_5m["Volume"] if "Volume" in df_5m.columns else df_5m["volume"]

            # Son 5 bar'ın kaçı yeşil?
            opens  = df_5m["Open"] if "Open" in df_5m.columns else df_5m["open"]
            greens = sum(1 for i in range(-5, 0) if close_5m.iloc[i] > opens.iloc[i])

            # Son bar hacmi ortalamaya göre
            avg_5m_vol = float(vol_5m.mean())
            last_5m_vol = float(vol_5m.iloc[-1])
            vol_ratio = last_5m_vol / avg_5m_vol if avg_5m_vol > 0 else 1.0

            # Son bar momentum (son 2 bar fiyat değişimi)
            mom_pct = (float(close_5m.iloc[-1]) - float(close_5m.iloc[-3])) / float(close_5m.iloc[-3]) * 100

            if greens >= 4 and mom_pct > 0.5:
                score += 15.0
                details.append(f"⚡ Güçlü 5m Momentum ({greens}/5 yeşil, +{mom_pct:.2f}%)")
                if "GAP_AND_GO" not in signals:
                    signals.append("GAP_AND_GO")
            elif greens >= 3 and mom_pct > 0:
                score += 8.0
                details.append(f"📈 5m Pozitif ({greens}/5 yeşil, +{mom_pct:.2f}%)")
            elif greens <= 1:
                score -= 5.0
                details.append(f"🔴 5m Zayıf ({greens}/5 yeşil)")
                if "REVERSAL" not in signals:
                    signals.append("REVERSAL")
            else:
                score += 3.0
                details.append(f"⚪ 5m Nötr ({greens}/5 yeşil)")

            # Hacim patlaması puanı
            if vol_ratio >= 2.0:
                score += 5.0
                details.append(f"💥 5m Hacim Patlaması: {vol_ratio:.1f}x")
        except Exception as e:
            logging.debug(f"5m momentum {ticker}: {e}")

    # ── 5. ATR UYUMU ──────────────────────────────────────────────
    # Daytrade'de hedef en az 1 ATR olmalı, stop 0.5 ATR
    if atr_pct >= 3.0:
        score += 10.0
        details.append(f"🎯 ATR Geniş: %{atr_pct:.1f} (Hedef ulaşılabilir)")
    elif atr_pct >= 2.0:
        score += 6.0
        details.append(f"📏 ATR Normal: %{atr_pct:.1f}")
    elif atr_pct >= 1.5:
        score += 3.0
        details.append(f"📏 ATR Dar: %{atr_pct:.1f}")
    else:
        score -= 3.0
        details.append(f"⚠️ ATR Çok Dar: %{atr_pct:.1f}")

    # ── 6. RSI KONUMU ─────────────────────────────────────────────
    if 50 <= rsi <= 70:
        score += 10.0
        details.append(f"🟢 RSI: {rsi:.0f} (Momentum Bölgesi)")
    elif 40 <= rsi < 50:
        score += 5.0
        details.append(f"🟡 RSI: {rsi:.0f} (Nötr)")
    elif rsi > 70:
        score += 3.0
        details.append(f"🔶 RSI: {rsi:.0f} (Yüksek — Momentum Devam Edebilir)")
    elif rsi < 35:
        score += 4.0
        details.append(f"🔵 RSI: {rsi:.0f} (Aşırı Satım — Reversal İzle)")
        if "REVERSAL" not in signals:
            signals.append("REVERSAL")
    else:
        score += 2.0

    # ── SİNYAL BELİRLE ────────────────────────────────────────────
    primary_signal = signals[0] if signals else "MOMENTUM"

    candidate["dt_score"]       = round(min(score, 100.0), 1)
    candidate["details"]        = details
    candidate["primary_signal"] = primary_signal
    candidate["vwap"]           = round(vwap, 2) if vwap else None
    candidate["price_vs_vwap"]  = round(price_vs_vwap, 2)

    return candidate

# ================================================================
# ================================================================
# SECTION 5: LAYER 3 — GİRİŞ/STOP/HEDEF ZONLARI (ATR Bazlı)
# ================================================================
# ================================================================

def calculate_daytrade_zones(candidate: Dict, df_5m: Optional[pd.DataFrame]) -> Dict:
    """
    Daytrade için ATR bazlı dar stop + hedefe göre zone hesabı.

    SWING115'TEN FARK:
      Swing: Stop = support - 0.5 ATR (1-2 günlük swing)
      DayTrade: Stop = 0.3-0.5 ATR (aynı gün kapatılacak)
      Hedef: Minimum 2:1 R/R (gap yönünde)

    Sinyal tipine göre farklı zone:
      GAP_AND_GO  → Açılış breakoutunu kovalama, stop düşük
      PULLBACK_VWAP → VWAP'tan sekme bekle
      REVERSAL    → Oversold hisse, stop dip altı
    """
    price      = candidate.get("price", 0.0)
    atr        = candidate.get("atr", price * 0.02)
    signal     = candidate.get("primary_signal", "GAP_AND_GO")
    vwap       = candidate.get("vwap")
    gap_pct    = candidate.get("change_pct", 0.0)

    # 5m'den intraday high/low al
    intraday_high = price
    intraday_low  = price

    if df_5m is not None and len(df_5m) >= 1:
        try:
            high_col = "High" if "High" in df_5m.columns else "high"
            low_col  = "Low"  if "Low"  in df_5m.columns else "low"
            intraday_high = float(df_5m[high_col].max())
            intraday_low  = float(df_5m[low_col].min())
        except Exception:
            pass

    if signal == "GAP_AND_GO":
        # Açılış momentum — stop intraday düşük veya 0.5 ATR altı
        stop      = round(max(intraday_low - atr * 0.2, price - atr * 0.5), 2)
        entry_low = round(price - atr * 0.1, 2)
        entry_hi  = round(price + atr * 0.15, 2)

    elif signal == "PULLBACK_VWAP":
        # VWAP desteğinden sekme — stop VWAP altı
        vwap_ref  = vwap if vwap else price - atr * 0.3
        stop      = round(vwap_ref - atr * 0.3, 2)
        entry_low = round(vwap_ref - atr * 0.05, 2)
        entry_hi  = round(vwap_ref + atr * 0.1, 2)

    else:  # REVERSAL
        # Oversold — stop son dip altı
        stop      = round(intraday_low - atr * 0.3, 2)
        entry_low = round(price - atr * 0.2, 2)
        entry_hi  = round(price + atr * 0.1, 2)

    # Güvenlik: stop fiyatın çok yakınına gelmesin
    if price - stop < atr * 0.25:
        stop = round(price - atr * 0.35, 2)

    avg_entry = (entry_low + entry_hi) / 2
    risk      = max(avg_entry - stop, atr * 0.3)

    # Hedef: minimum 2:1 R/R, ideal 3:1
    tp1 = round(avg_entry + risk * 2.0, 2)
    tp2 = round(avg_entry + risk * 3.0, 2)

    actual_rr = round((tp1 - avg_entry) / risk, 2) if risk > 0 else 0.0

    return {
        "entry_zone":  {"low": entry_low, "high": entry_hi},
        "stop":        stop,
        "tp1":         tp1,
        "tp2":         tp2,
        "rr_ratio":    actual_rr,
        "avg_entry":   round(avg_entry, 2),
        "risk_per_sh": round(risk, 2),
        "signal":      signal,
    }

# ================================================================
# ================================================================
# SECTION 6: ANA TARAMA FONKSİYONU
# ================================================================
# ================================================================

async def scan_daytrade():
    """
    ATMACA DAYTRADE MASTER SCANNER

    WORKFLOW:
    0. Finviz gapper scrape → ~200-300 aday
    1. yfinance bulk 1D → vektörel ön filtre
    2. Paralel 5m veri çek + daytrade skorlama (semaphore=8)
    3. Top 15 → zone hesapla
    4. JSON kaydet + Telegram gönder
    """
    start_time = time.time()
    now_ny     = datetime.now(NY_TZ)
    logging.info("=" * 60)
    logging.info("⚡ ATMACA DAYTRADE V1.0 — Tarama Başladı")
    logging.info(f"🕒 NY Saati: {now_ny.strftime('%Y-%m-%d %H:%M %Z')}")
    logging.info("=" * 60)

    await send_telegram(
        "⚡ <b>ATMACA DAYTRADE V1.0 — Tarama Başladı</b>\n"
        f"🕒 {now_ny.strftime('%Y-%m-%d %H:%M %Z')}\n"
        "🔍 Finviz gapper scrape + yfinance 5m analizi..."
    )

    # ── LAYER 0: GAPPER UNIVERSE ─────────────────────────────────
    logging.info("[LAYER 0] Finviz gapper listesi çekiliyor...")
    gappers = await get_gapper_universe()
    if not gappers:
        await send_telegram("❌ Gapper listesi boş — Finviz ve fallback ikisi de başarısız.")
        return

    tickers_0 = [g["ticker"] for g in gappers]
    gap_map    = {g["ticker"]: g for g in gappers}
    logging.info(f"[LAYER 0] {len(tickers_0)} aday scrape edildi")

    # ── LAYER 1: BULK 1D + VEKTÖRİYEL FİLTRE ────────────────────
    logging.info("[LAYER 1] Bulk 1D veri indiriliyor...")
    await bulk_fetch_1d(tickers_0)

    layer1_passed = []
    for ticker in tickers_0:
        result = layer1_filter(ticker, gap_map.get(ticker, {}))
        if result:
            layer1_passed.append(result)

    logging.info(f"[LAYER 1] {len(tickers_0)} → {len(layer1_passed)} filtreden geçti")

    if not layer1_passed:
        await send_telegram("⚠️ Layer 1 filtre: Hiç aday geçemedi. Parametreleri gevşetin.")
        return

    # ── LAYER 2: PARALEL 5m + DAYTRADE SKORLAMA ──────────────────
    logging.info(f"[LAYER 2] {len(layer1_passed)} aday için 5m veri çekiliyor...")

    # Semaphore = 8: yfinance'i bunmadan 8 paralel çekiş
    sem = asyncio.Semaphore(8)

    async def analyze_one(candidate: Dict) -> Optional[Dict]:
        async with sem:
            ticker = candidate["ticker"]
            try:
                df_5m = await fetch_intraday_5m(ticker)
                scored = score_daytrade_candidate(candidate, df_5m)
                scored["df_5m"] = df_5m   # Zone hesabı için sakla
                return scored
            except Exception as e:
                logging.debug(f"{ticker} layer2: {e}")
                return None

    tasks   = [analyze_one(c) for c in layer1_passed]
    results = await asyncio.gather(*tasks)
    scored_candidates = [r for r in results if r is not None]

    # Skora göre sırala
    scored_candidates.sort(key=lambda x: x.get("dt_score", 0.0), reverse=True)
    logging.info(f"[LAYER 2] {len(scored_candidates)} aday skorlandı")

    # ── LAYER 3: TOP 15 → ZONE HESAPLA ───────────────────────────
    top_candidates = scored_candidates[:TOP_CANDIDATES]

    for c in top_candidates:
        df_5m = c.pop("df_5m", None)   # JSON'a yazılmayacak
        c["df_1d"] = None              # JSON'a yazılmayacak
        zones = calculate_daytrade_zones(c, df_5m)
        c["zones"]    = zones
        c["rr_ratio"] = zones["rr_ratio"]

    # R/R < 2 olanları filtrele
    top_candidates = [c for c in top_candidates if c.get("rr_ratio", 0) >= MIN_RR_DAYTRADE]

    if not top_candidates:
        await send_telegram("⚠️ R/R 2:1 altında kalan adaylar elendi. Bugün işlem yok.")
        return

    duration = time.time() - start_time
    logging.info(f"[OK] {len(top_candidates)} final aday | Süre: {duration:.1f}s")

    # ── JSON KAYIT ────────────────────────────────────────────────
    output_data = {
        "generated_at": now_ny.isoformat(),
        "scan_duration_s": round(duration, 1),
        "total_scanned": len(tickers_0),
        "layer1_passed": len(layer1_passed),
        "final_picks": len(top_candidates),
        "picks": []
    }

    for c in top_candidates:
        output_data["picks"].append({
            "ticker":         c["ticker"],
            "price":          c["price"],
            "change_pct":     c["change_pct"],
            "dt_score":       c["dt_score"],
            "signal":         c["primary_signal"],
            "rsi":            c["rsi"],
            "rvol":           c["rvol"],
            "atr_pct":        c["atr_pct"],
            "vwap":           c.get("vwap"),
            "price_vs_vwap":  c.get("price_vs_vwap"),
            "zones":          c["zones"],
            "details":        c["details"],
        })

    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        # Ana dosya (dashboard)
        with open(os.path.join(OUTPUT_DIR, OUTPUT_JSON), "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)
        # Tüm adaylar (debug/terminal)
        all_data = output_data.copy()
        all_data["picks"] = [
            {k: v for k, v in c.items() if k not in ("df_1d", "df_5m")}
            for c in scored_candidates
        ]
        with open(os.path.join(OUTPUT_DIR, OUTPUT_ALL_JSON), "w", encoding="utf-8") as f:
            json.dump(all_data, f, indent=2, ensure_ascii=False, default=str)
        logging.info(f"✅ JSON kaydedildi: {OUTPUT_DIR}")
    except Exception as e:
        logging.error(f"JSON kayıt hatası: {e}")

    # ── TERMINAL TABLOSU ──────────────────────────────────────────
    logging.info("=" * 70)
    logging.info(f"⚡ ATMACA DAYTRADE V1.0 — SONUÇLAR ({len(top_candidates)} hisse)")
    logging.info(f"{'#':<4} {'TKR':<6} {'SİNYAL':<14} {'SKOR':>5} {'GAP%':>6} {'RVOL':>5} {'RSI':>5} {'R/R':>5}")
    logging.info("-" * 70)
    for i, c in enumerate(top_candidates):
        z = c.get("zones", {})
        logging.info(
            f"{i+1:<4} {c['ticker']:<6} {c['primary_signal']:<14} "
            f"{c['dt_score']:>5.1f} {c['change_pct']:>5.1f}% "
            f"{c['rvol']:>4.1f}x {c['rsi']:>5.1f} {c.get('rr_ratio',0):>5.2f}"
        )
    logging.info("=" * 70)

    # ── TELEGRAM RAPORU ───────────────────────────────────────────
    # Header
    header = (
        f"⚡ <b>ATMACA DAYTRADE V1.0 — TOP {min(5, len(top_candidates))} PICKS</b>\n"
        f"🕒 <i>{now_ny.strftime('%Y-%m-%d %H:%M %Z')}</i> | ⏱ {duration:.0f}s\n"
        f"📊 <i>{len(tickers_0)} scrape → {len(layer1_passed)} filtre → {len(top_candidates)} final</i>\n\n"
        "<pre>"
        f"#  TKRR  [SİNYAL      ] SKOR  GAP%  RVOL\n"
        f"─────────────────────────────────────────\n"
    )
    rows = []
    for i, c in enumerate(top_candidates[:5]):
        sig_short = {
            "GAP_AND_GO":    "GAP&GO  ",
            "PULLBACK_VWAP": "PB_VWAP ",
            "REVERSAL":      "REVERSAL",
            "MOMENTUM":      "MOMENTM ",
        }.get(c["primary_signal"], c["primary_signal"][:8])

        emoji = "🦅" if c["dt_score"] >= 70 else "🔥" if c["dt_score"] >= 50 else "🎯"
        rows.append(
            f"{i+1}. {emoji} {c['ticker']:<5} [{sig_short}] "
            f"{c['dt_score']:>4.0f}  {c['change_pct']:>4.1f}% {c['rvol']:>4.1f}x"
        )
    header += "\n".join(rows) + "\n─────────────────────────────────────────\n</pre>\n"
    await send_telegram(header)

    # Her hisse için detay bloğu (ilk 5)
    for i, c in enumerate(top_candidates[:5]):
        z = c.get("zones", {})
        block = (
            f"{'🦅' if c['dt_score'] >= 70 else '🔥'} <b>#{i+1} {c['ticker']}</b> "
            f"[{c['primary_signal']}]\n"
            f"💰 Fiyat: <b>${c['price']:.2f}</b> | Gap: <b>+{c['change_pct']:.1f}%</b>\n"
            f"📊 SKOR: <b>{c['dt_score']:.0f}/100</b> | RVOL: {c['rvol']:.1f}x | RSI: {c['rsi']:.0f}\n"
            f"📐 ATR: %{c['atr_pct']:.1f} | VWAP: ${c.get('vwap') or 'N/A'}\n\n"
            f"<b>🎯 ZONLAR:</b>\n"
            f"  Giriş:  ${z.get('entry_zone',{}).get('low',0):.2f} – ${z.get('entry_zone',{}).get('high',0):.2f}\n"
            f"  TP1:    <b>${z.get('tp1',0):.2f}</b>\n"
            f"  TP2:    <b>${z.get('tp2',0):.2f}</b>\n"
            f"  Stop:   <b>${z.get('stop',0):.2f}</b>\n"
            f"  R/R:    <b>{z.get('rr_ratio',0):.1f}:1</b>\n\n"
            f"<i>{'  '.join(c.get('details', [])[:4])}</i>\n"
        )
        await send_telegram(block)
        await asyncio.sleep(0.5)

    await send_telegram(
        f"⚠️ <i>Bu bir finans tavsiyesi değildir. "
        f"PDT kuralı: Margin hesapta 5 günde 4+ daytrade için $25.000 bakiye şartı vardır.</i>"
    )

    logging.info(f"[OK] ATMACA DAYTRADE tarama tamamlandı. ({duration:.1f}s)")

# ================================================================
# ================================================================
# SECTION 7: SCHEDULER
# ================================================================
# ================================================================

def get_next_scan_time_ny(target_hour: int = 9, target_minute: int = 15) -> datetime:
    """
    Sonraki iş günü NY 09:15 zamanını UTC olarak döndürür.
    09:15 ET = piyasa açılışından 15 dakika sonra (ilk fiyat keşfi bitti).
    """
    now_utc  = datetime.now(timezone.utc)
    now_ny   = now_utc.astimezone(NY_TZ)
    candidate = now_ny.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)

    if candidate <= now_ny:
        candidate += timedelta(days=1)

    # Hafta sonu atla
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)

    return candidate.astimezone(timezone.utc)


async def run_scheduler():
    """
    Ana scheduler döngüsü.
    Her iş günü NY 09:15'te tarama yapar.
    """
    await send_telegram(
        "⚡ <b>ATMACA DAYTRADE V1.0 Başlatıldı!</b>\n"
        "📅 Zamanlama: Her iş günü NY 09:15\n"
        "🎯 Hedef: Günlük Top 5 Daytrade Fırsatı\n"
        "🔍 Finviz Gapper + yfinance 5m Analizi"
    )

    # İlk tarama — hemen
    try:
        await scan_daytrade()
    except Exception as e:
        logging.error(f"İlk tarama hatası: {e}")
        await send_telegram(f"🚨 İlk tarama hatası: {e}")

    # Döngü
    while True:
        try:
            now_utc      = datetime.now(timezone.utc)
            next_run_utc = get_next_scan_time_ny()
            wait_s       = (next_run_utc - now_utc).total_seconds()

            if wait_s < 0 or wait_s > 90_000:
                next_run_utc = get_next_scan_time_ny()
                wait_s       = (next_run_utc - datetime.now(timezone.utc)).total_seconds()

            next_run_ny = next_run_utc.astimezone(NY_TZ)
            logging.info(
                f"🕒 Sonraki tarama: {next_run_ny.strftime('%Y-%m-%d %H:%M %Z')} "
                f"(~{wait_s/3600:.2f} saat)"
            )
            await asyncio.sleep(wait_s)
            await scan_daytrade()

        except Exception as e:
            logging.error(f"Döngü hatası: {e}")
            await send_telegram(f"🚨 Döngü hatası: {e}")
            await asyncio.sleep(3600)

# ================================================================
# ================================================================
# SECTION 8: STARTUP
# ================================================================
# ================================================================

if __name__ == "__main__":
    import sys

    try:
        if os.name == "nt":
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        if "--oneshot" in sys.argv or "--now" in sys.argv:
            print("[START] ATMACA DAYTRADE V1.0 — Tek Tarama Modu")
            asyncio.run(scan_daytrade())
            print("[OK] Tarama tamamlandı.")
        else:
            print("[START] ATMACA DAYTRADE V1.0 — Scheduler Modu (NY 09:15)")
            asyncio.run(run_scheduler())

    except KeyboardInterrupt:
        print("\n⚡ ATMACA DAYTRADE V1.0 durduruldu.")
    except Exception as e:
        print(f"Kritik başlatma hatası: {e}")
        raise
