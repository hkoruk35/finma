import asyncio
import logging
import time
import aiohttp
import random
import pandas as pd
import numpy as np
import yfinance as yf
import os
import math
import html
import re
from bs4 import BeautifulSoup
import matplotlib
import matplotlib.pyplot as plt
matplotlib.use('Agg')
from datetime import datetime, timedelta, time as dtime, timezone
from typing import List, Dict, Any, Optional, Literal
from zoneinfo import ZoneInfo
from ta.volatility import AverageTrueRange, BollingerBands
from ta.trend import EMAIndicator, ADXIndicator
from ta.volume import OnBalanceVolumeIndicator
from ta.momentum import RSIIndicator


# ================================================================
# 🦅 ATMACA SWING TRADE MODELİ V112 — 3 KATMANLI FİLTRE SİSTEMİ
# ================================================================
# V112 YENİLİKLER (V112 tabanlı, Yahoo mimarisi korundu):
# ✅ 🥇 KATMAN 1 — Statik Likidite Filtresi (Günlük güncelleme):
#    — Fiyat: $5–$1000 | Market Cap > 300M | 30g Avg DV > 5M USD
#    — Beta: 0.6–3.0 filtresi eklendi
# ✅ 🥈 KATMAN 2 — Akış & Momentum Filtresi (Dinamik Hard Filter):
#    — RVOL = 5g Ort. / 30g Ort. > 1.2 (agresif: >1.5 bonus puan)
#    — 1D Close > EMA20 > EMA50 zorunlu
#    — ADX > 18 zorunlu
#    — Son 10 günde en az 6 yeşil mum
#    — CMF > 0 (Para girişi onayı)
# ✅ 🥉 KATMAN 3 — Composite Ranking Motoru:
#    — RVOL_zscore*0.35 + Trend*0.25 + 5g_Accel*0.15
#      + ADX*0.10 + DollarVol*0.10 + VolExpand*0.05
#    — En iyi 200 hisse seçilir (önceki: 20)
# ✅ UNIVERSE TTL: 168 saat → 24 saat (Her gün güncellenir)
# ================================================================

# 🔹 Log ve Uyarı Ayarları (v112 Optimized)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logging.getLogger("yfinance").setLevel(logging.CRITICAL)

# 🔹 Zaman Dilimi ve Çalışma Saatleri (New York)
NY_TZ = ZoneInfo("America/New_York")
DAILY_RUN_HOUR = 13          # Her gün NY saati ile 13:00
DAILY_RUN_MINUTE = 0
WEEKDAY_SET = {0, 1, 2, 3, 4}  # Pazartesi=0 ... Cuma=4

# 🔹 Zaman ve Cache Ayarları
UNIVERSE_TTL = 24 * 3600        # 24 saatte bir liste güncellenir (her gün)
UNIVERSE_CACHE: Dict[str, Any] = {"ts": 0.0, "data": []}

# Eski saatlik tarama kalıntısı (bazı yerlerde kullanılabilir, şimdilik koruyoruz)
SCAN_INTERVAL_SEC = 3600       # (Gerekirse kaldırılacak)
EXCLUDED_STOCKS = set()
LOOKBACK_DAYS = 200
INDEX_BENCHMARK = "^GSPC"   # S&P500
MAX_PER_SECTOR = 6
sector_map = {}
RS_LOOKBACK = 30

# --------------------------------------------------------
# YENİ EKLENEN: Sektör ETF Haritası ve Global Durum Değişkenleri
# --------------------------------------------------------
SECTOR_ETF_MAP = {
    "Technology": "XLK",
    "Energy": "XLE",
    "Financial Services": "XLF", "Financials": "XLF",
    "Healthcare": "XLV",
    "Consumer Cyclical": "XLY", "Consumer Discretionary": "XLY",
    "Industrials": "XLI",
    "Utilities": "XLU",
    "Basic Materials": "XLB", "Materials": "XLB",
    "Real Estate": "XLRE",
    "Consumer Defensive": "XLP", "Consumer Staples": "XLP",
    "Communication Services": "XLC"
}

# Piyasa Analiz Sonuçlarını Tutacak Global Değişkenler
MARKET_STATUS = {"regime": "Bull", "min_score_modifier": 0.0}
SECTOR_PERFORMANCE = {} # Sektörlerin 5 günlük getirisi burada tutulacak

ATR_PERIOD = 14
ATR_MIN_PCT_1H = 0.025
ATR_MAX_PCT_1H = 0.25

ADX_MIN_LEVEL_1D = 18
ADX_MIN_LEVEL_1H = 16

OBV_TREND_DAYS = 10
VOLUME_INCREASE_LOOKBACK = 5

MIN_DAILY_GAIN_FOR_MOMENTUM = 0.01
PRICE_INCREASE_DAYS = 10

# --- v112 SWING TRADE ODAKLI AYARLAR ---
MIN_RR_RATIO = 1.2
MIN_RR_RATIO_RELAXED = 1.3
MIN_ATMACA_SCORE = 2

# RSI LİMİTLERİ (Geniş bant - yükselmeye başlayanları da yakala)
RSI_MIN_SWING = 38
RSI_MAX_SWING = 78

ATMACA_MAX_SHORT_FLOAT = 0.25

ATMACA_MIN_BETA = 0.4
ATMACA_MAX_BETA = 2.8

# 🔹 ALPHA VANTAGE API
ENABLE_ALPHA_VALIDATION = False
ALPHA_VALIDATION_THRESHOLD = 6.0
ALPHA_VANTAGE_API_KEY = "8S8ZRE3EPTKH0EPJ"


# 🔹 ATMACA Filtre Parametreleri
ATMACA_MIN_MARKET_CAP = 300_000_000   # Katman 1: Min 300M USD Market Cap
ATMACA_MIN_AVG_VOLUME = 500_000       # Katman 1: Min ortalama işlem hacmi
ATMACA_MIN_DOLLAR_VOLUME = 5_000_000  # Katman 1: Min 5M USD günlük nakit akışı
PRICE_MIN = 5.0                        # Katman 1: Min $5
PRICE_MAX = 1000.0                     # Katman 1: Max $1000
ATMACA_MIN_BETA = 0.6                 # Katman 1: Beta min (güncellendi)
ATMACA_MAX_BETA = 3.0                 # Katman 1: Beta max (güncellendi)

MAX_TICKERS_FINAL = 200  # Analiz edilecek en kaliteli hisse sayısı

WATCHLIST_DIR = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists"
WATCHLIST_ROLLING_FILE = os.path.join(WATCHLIST_DIR, "watchlist_rolling.txt")
WATCHLIST_KEEP_DAYS = 30
WATCHLIST_MAX_ROLLING = 600

# ======================================================
#  ULTIMATE US UNIVERSE BUILDER (NASDAQ, NYSE, AMEX)
#  - Russell 20002000 ve Tüm ABD Borsalarını Kapsar
#  - 168 Saatlik Dinamik Güncelleme (UNIVERSE_TTL)
#  - ATMACA v103 Standartlarında Filtreleme
# ======================================================

# Borsa Listesi Kaynakları (EN KAPSAMLI VE GÜNCEL)
EXCHANGE_SOURCES: List[str] = [
    # 1. Kaynak: Yaklaşık 8.000+ US Sembolü (Ham liste)
    "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/all/all_tickers.txt",
    # 2. Kaynak: NASDAQ resmi çalışma listesi
    "https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed-symbols.csv",
    # 3. Kaynak: Alternatif US Verisi
    "https://raw.githubusercontent.com/shilewenuw/get_all_tickers/master/get_all_tickers/tickers.csv"
]

# EĞER YUKARIDAKİLER YİNE 404 VERİRSE (Alternatif Stabil Kaynak):
# EXCHANGE_SOURCES = ["https://raw.githubusercontent.com/dataprofessor/nasdaq-listing/master/nasdaq_screener_16112020.csv"]

# ============================================================
# 1) ABD Tüm Borsa Sembollerini Çekme (NASDAQ + NYSE + AMEX)
# ============================================================

async def fetch_all_us_tickers() -> List[str]:
    """
    NASDAQ, NYSE ve AMEX borsalarından tüm sembolleri çeker.
    - Warrant / Unit / Rights gibi yan ürünleri elemek için
      sadece 1–4 harfli alfabeye uygun semboller alınır.
    """
    all_tickers: set[str] = set()
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko)"
        )
    }

    async with aiohttp.ClientSession() as session:
        for url in EXCHANGE_SOURCES:
            market_name = url.split("/")[-2].upper()
            try:
                logging.info(f"📡 Semboller çekiliyor: {market_name} ...")

                async with session.get(url, headers=headers, timeout=15) as resp:
                    if resp.status != 200:
                        logging.error(f"⚠️ {market_name} sembol listesi alınamadı (HTTP {resp.status})")
                        continue

                    content = await resp.text()
                    symbols = [
                        s.strip().upper()
                        for s in content.splitlines()
                        if s.strip()
                    ]

                    # Ana hisseleri filtrele: sadece 1–4 harfli alfabetik ticker’lar
                    for sym in symbols:
                        if sym.isalpha() and 1 <= len(sym) <= 4:
                            all_tickers.add(sym)

            except Exception as e:
                logging.error(f"⚠️ {market_name} liste çekme hatası: {e}")

    logging.info(f"✅ Toplam alınan ham sembol sayısı: {len(all_tickers)}")
    return list(all_tickers)

# ============================================================
# 2) ATMACA FİLTRELİ US UNIVERSE OLUŞTURMA
# ============================================================

async def build_atmaca_universe_full() -> List[str]:
    """
    ABD borsalarındaki tüm sembolleri alır.

    YENİ STRATEJİ (v112):
    ─────────────────────────────────────────────────────────
    AŞAMA 1 — TOPLU OHLCV İNDİRME  (saniyeler içinde biter)
      • 8000+ tickerın tamamını 1000'lik chunk'larla yf.download ile indir.
      • Market Cap sorulmaz → tek tek fast_info çağrısı YOK → ban riski yok.

    AŞAMA 2 — VEKTÖRELFİLTRELEME  (Pandas, anlık)
      • Fiyat $5–$1000
      • Ortalama Hacim ≥ ATMACA_MIN_AVG_VOLUME
      • Dollar Volume ≥ ATMACA_MIN_DOLLAR_VOLUME
      • RVOL = son5g_ort / son30g_ort ≥ 1.0   (en azından aktif)
      • ROC5 = 5 günlük getiri > 0             (düşüşte değil)

    AŞAMA 3 — SIRALAMA & KESME
      • (RVOL × DollarVolume) çarpımına göre büyükten küçüğe sırala.
      • En iyi MAX_TICKERS_FINAL adeti gönder.

    Market Cap + Beta zaten apply_atmaca_filters içinde kontrol ediliyor.
    Burada tekrar sormak hem yavaşlatır hem ban yer.
    ─────────────────────────────────────────────────────────
    """
    now = time.time()

    # ── CACHE kontrolü ──────────────────────────────────────
    if UNIVERSE_CACHE["data"] and (now - UNIVERSE_CACHE["ts"] < UNIVERSE_TTL):
        logging.info(f"📦 Evren cache'den alındı ({len(UNIVERSE_CACHE['data'])} hisse)")
        return UNIVERSE_CACHE["data"]

    # ── AŞAMA 1: Ticker listesi ─────────────────────────────
    raw_list = await fetch_all_us_tickers()
    if not raw_list:
        logging.error("❌ US ticker listesi alınamadı.")
        return []

    logging.info(
        f"🚀 {len(raw_list)} hisse için TOPLU OHLCV indirmesi başlıyor "
        f"(chunk=1000, period=35d)..."
    )

    # ── AŞAMA 2: Toplu indirme + vektörel filtreleme ────────
    CHUNK = 1000
    PERIOD = "35d"   # 30g RVOL için en az 35 gün gerekli

    all_rows: list[dict] = []

    for i in range(0, len(raw_list), CHUNK):
        chunk = raw_list[i: i + CHUNK]
        logging.info(f"📥 İndiriliyor: {i}–{i + len(chunk)} ...")

        try:
            data = await asyncio.to_thread(
                yf.download,
                chunk,
                period=PERIOD,
                progress=False,
                threads=True,
                ignore_tz=True,
                group_by="ticker",
            )

            # ── Sütun yapısı: MultiIndex (ticker, field) ──
            if not isinstance(data.columns, pd.MultiIndex):
                if len(chunk) == 1:
                    sym = chunk[0]
                    data.columns = pd.MultiIndex.from_tuples(
                        [(sym, c) for c in data.columns]
                    )
                else:
                    logging.warning(f"⚠️ Chunk {i}: Beklenmedik sütun yapısı, atlandı.")
                    continue

            tickers_in_data = data.columns.get_level_values(0).unique().tolist()

            for sym in tickers_in_data:
                try:
                    close  = data[sym]["Close"].dropna()
                    volume = data[sym]["Volume"].dropna()

                    if len(close) < 6 or len(volume) < 6:
                        continue

                    last_price  = float(close.iloc[-1])
                    avg_vol_10  = float(volume.tail(10).mean())
                    avg_vol_5   = float(volume.tail(5).mean())
                    avg_vol_30  = float(volume.tail(30).mean()) if len(volume) >= 30 else avg_vol_10
                    dollar_vol  = last_price * avg_vol_10

                    # ── Katman 1 vektörel filtreler ──
                    if not (PRICE_MIN <= last_price <= PRICE_MAX):
                        continue
                    if avg_vol_10 < ATMACA_MIN_AVG_VOLUME:
                        continue
                    if dollar_vol < ATMACA_MIN_DOLLAR_VOLUME:
                        continue

                    # RVOL: son 5g ort / son 30g ort (≥ 1.0 → en azından aktif)
                    rvol = (avg_vol_5 / avg_vol_30) if avg_vol_30 > 0 else 0.0
                    if rvol < 1.0:
                        continue

                    # ROC5: 5 günlük getiri (düşüşte olmasın)
                    roc5 = float(
                        (close.iloc[-1] - close.iloc[-6]) / close.iloc[-6]
                    ) if len(close) >= 6 else 0.0
                    if roc5 <= 0:
                        continue

                    all_rows.append({
                        "sym":        sym,
                        "price":      last_price,
                        "dollar_vol": dollar_vol,
                        "rvol":       rvol,
                        "roc5":       roc5,
                        # Sıralama skoru: RVOL × DollarVolume (~akış gücü)
                        "rank_score": rvol * dollar_vol,
                    })

                except Exception:
                    continue

        except Exception as e:
            logging.warning(f"⚠️ Chunk {i} indirme hatası: {e}")
            continue

    if not all_rows:
        logging.error("❌ Toplu indirme sonrası hiç hisse kalmadı.")
        return []

    logging.info(
        f"⚡ Vektörel filtre sonucu: {len(all_rows)} hisse geçti "
        f"({len(raw_list)} içinden)"
    )

    # ── AŞAMA 3: Sıralama ve kesme ──────────────────────────
    all_rows.sort(key=lambda r: r["rank_score"], reverse=True)
    selected = [r["sym"] for r in all_rows[:MAX_TICKERS_FINAL]]

    logging.info(
        f"🏆 Evren oluşturuldu: {len(selected)} hisse "
        f"detaylı analize gönderiliyor."
    )

    # ── Cache ve TXT kaydı ───────────────────────────────────
    if selected:
        UNIVERSE_CACHE["ts"] = now
        UNIVERSE_CACHE["data"] = selected
        try:
            with open("atmaca_full_us_universe.txt", "w") as f:
                for s in selected:
                    f.write(f"{s}\n")
            logging.info(f"📁 Evren dosyası güncellendi – {len(selected)} hisse.")
        except Exception:
            logging.warning("⚠️ TXT kayıt yapılamadı.")

    return selected


# ======================================================
#  TEKNİK ANALİZ VE ANA DÖNGÜ (SEMAPHORE 5 - RATE LIMIT KORUMALI)
# ======================================================

ANALYSIS_SEMAPHORE = asyncio.Semaphore(5)

async def analyze_atmaca_ticker(ticker: str):
    """
    Burada senin teknik analiz modüllerin (RSI, ADX, ATR vb.) çalışacak.
    Şimdilik placeholder şeklinde bırakıyoruz.
    """
    async with ANALYSIS_SEMAPHORE:
        try:
            # Buraya gerçek analiz gelecektir
            await asyncio.sleep(0.1)
            return {"ticker": ticker, "status": "ANALYZED"}
        except Exception as e:
            logging.error(f"❌ {ticker} analiz hatası: {e}")
            return None

# ============================================================
# 🦅 ATMACA 8-FACTOR BALANCED RANKING ENGINE v112 (Profit-Focused)
# ============================================================
def compute_multi_factor_score(c: dict) -> float:
    """
    🥉 KATMAN 3 — ATMACA RANKING MOTORU V112
    
    Final Score =
      RVOL_zscore       * 0.35
    + Trend Strength    * 0.25
    + 5g Return Accel   * 0.15
    + ADX               * 0.10
    + Dollar Volume     * 0.10
    + Volatility Expand * 0.05
    
    En iyi 200 hisse bu formülle sıralanır.
    """
    base_score = c.get("score", 0.0)
    meta = c.get("meta", {})
    d1 = meta.get("1d", {})
    h1 = meta.get("1h", {})
    details = c.get("details", [])

    # ------------------------------------------------
    # FAKTÖR 1: RVOL Z-Score (0–3.5) [%35 ağırlık]
    # Katman 2'den geçen RVOL değeri zaten 1.2+ garantili
    # ------------------------------------------------
    rvol_raw = c.get("rvol_5_30", 1.0)  # apply_atmaca_filters'dan alınacak
    if rvol_raw <= 0:
        rvol_raw = 1.0
    # Z-score benzeri normalize: (rvol - 1.0) / 0.5, 0-3.5 arasına kapat
    rvol_zscore = min(max((rvol_raw - 1.0) / 0.5, 0.0), 3.5)

    # ------------------------------------------------
    # FAKTÖR 2: Trend Gücü (0–3) [%25 ağırlık]
    # ------------------------------------------------
    trend_score = 0.0
    if d1.get("EMA20 Eğimi") == "Pozitif":
        trend_score += 1.0
    adx_val = float(d1.get("ADX", 0) or 0)
    if adx_val >= 30:
        trend_score += 2.0
    elif adx_val >= 25:
        trend_score += 1.5
    elif adx_val >= 18:
        trend_score += 1.0
    # Trend yapısı bonusu
    trend_durumu = str(d1.get("Trend Durumu", ""))
    if "Makro" in trend_durumu:
        trend_score = min(trend_score + 1.0, 3.0)
    elif "Yükseliş" in trend_durumu:
        trend_score = min(trend_score + 0.5, 3.0)

    # ------------------------------------------------
    # FAKTÖR 3: 5 Günlük Getiri İvmesi (0–3) [%15 ağırlık]
    # ------------------------------------------------
    ret_5g = c.get("ret_5g_pct", 0.0)  # apply_atmaca_filters'dan alınacak
    if ret_5g >= 8.0:
        ret_accel = 3.0
    elif ret_5g >= 5.0:
        ret_accel = 2.0
    elif ret_5g >= 3.0:
        ret_accel = 1.5
    elif ret_5g >= 1.5:
        ret_accel = 1.0
    elif ret_5g > 0:
        ret_accel = 0.5
    else:
        ret_accel = 0.0

    # ------------------------------------------------
    # FAKTÖR 4: ADX Normalize (0–3) [%10 ağırlık]
    # ------------------------------------------------
    adx_norm = min(adx_val / 40.0 * 3.0, 3.0)

    # ------------------------------------------------
    # FAKTÖR 5: Dollar Volume Normalize (0–3) [%10 ağırlık]
    # 5M = 1.0, 20M = 2.0, 50M+ = 3.0
    # ------------------------------------------------
    dollar_vol = c.get("dollar_volume", 0.0) or 0.0
    if dollar_vol >= 50_000_000:
        dv_norm = 3.0
    elif dollar_vol >= 20_000_000:
        dv_norm = 2.0
    elif dollar_vol >= 10_000_000:
        dv_norm = 1.5
    elif dollar_vol >= 5_000_000:
        dv_norm = 1.0
    else:
        dv_norm = 0.5

    # ------------------------------------------------
    # FAKTÖR 6: Volatility Expansion (0–3) [%5 ağırlık]
    # ATR% genişlemesi: ideal swing bölgesi 4-8%
    # ------------------------------------------------
    atr_str = str(d1.get("ATR%", "3%")).replace("%", "")
    try:
        atr_pct = float(atr_str)
    except:
        atr_pct = 3.0
    if 4.0 <= atr_pct <= 8.0:
        vol_expand = 3.0
    elif 3.0 <= atr_pct < 4.0 or 8.0 < atr_pct <= 10.0:
        vol_expand = 2.0
    elif 2.5 <= atr_pct < 3.0 or 10.0 < atr_pct <= 12.0:
        vol_expand = 1.0
    else:
        vol_expand = 0.5

# ------------------------------------------------
    # 🎯 KATMAN 3 FİNAL COMPOSITE FORMÜL VE HARMANLAMA
    # ------------------------------------------------
    layer3_composite = (
        rvol_zscore * 0.40 +    # RVOL ağırlığını artırdık (Gerçek momentum)
        trend_score * 0.25 +    # Trend yapısı korundu
        ret_accel   * 0.20 +    # 5 Günlük ivme artırıldı (Swing için kritik)
        adx_norm    * 0.05 +    # ADX double-counting etkisini düşürdük
        dv_norm     * 0.05 +    # Dollar Vol ağırlığı azaltıldı (Mega-cap bias önlendi)
        vol_expand  * 0.05      # Volatilite genişlemesi korundu
    )

    # KRİTİK DÜZELTME: apply_atmaca_filters'dan gelen devasa analizi (base_score)
    # Katman 3 Momentum Skoru ile birleştiriyoruz. 
    # Katman 3 skoru (~0-3 arası) burada 2.5 çarpanı ile ana skoru besleyecek.
    final_score = base_score + (layer3_composite * 2.5)

    # Exhausted hisselere ceza (Cezayı tüm toplam skora uyguluyoruz)
    if c.get("is_exhausted"):
        final_score *= 0.70 # %30 Puan Kır (Hisse listeye girse bile altlara düşer)

    # Raporlama
    c.update({
        "rvol_zscore": round(rvol_zscore, 2),
        "trend_score": round(trend_score, 2),
        "ret_accel": round(ret_accel, 2),
        "adx_norm": round(adx_norm, 2),
        "dv_norm": round(dv_norm, 2),
        "vol_expand": round(vol_expand, 2),
        # Eski uyumluluk alanları (rapor blokları için)
        "tsi": round(trend_score, 2),
        "msi": round(ret_accel, 2),
        "vrs": round(vol_expand, 2),
        "vps": round(rvol_zscore, 2),
        "nfi": round(dv_norm, 2),
        "sss": round(trend_score, 2),
        "rcs": c.get("rcs", 1.0),
        "pfi": c.get("pfi", 1.0),
        "ifi": c.get("ifi", 0.0),
        "ffi": c.get("ffi", 0.0),
        "composite_score": round(layer3_composite, 2)
    })
    
    # Skoru ezmiyoruz, nihai harmanlanmış skoru atıyoruz!
    c["score"] = round(final_score, 2)

    return final_score
    
# ======================================================
#  NY SAATİ 13:00 ZAMAN KONTROLÜ
# ======================================================

def is_time_to_run() -> bool:
    """Her gün sadece NY saatiyle 13:00'de çalışır."""
    now = datetime.now(NY_TZ)
    
    # Hafta sonları çalışmaz
    if now.weekday() not in WEEKDAY_SET:
        return False
    
    # Tam 13:00 dakikasında çalış
    return (now.hour == DAILY_RUN_HOUR and now.minute == DAILY_RUN_MINUTE)


# ======================================================
#  ANA ÇALIŞMA MOTORU (GÜNLÜK TEK TETİK)
# ======================================================

    
# 🔹 Telegram Bildirim Ayarları
TELEGRAM_API_KEY = "8182098187:AAF-jtWMJK07ZdZdyusiE1RqyQkwegb0Uhc"
TELEGRAM_CHAT_ID = "-1003406973271"
ENABLE_TELEGRAM_NOTIFICATIONS = True

# 🔹 ALPHA VANTAGE API (Cross-Validation)
# Not: Üstte zaten tanımlı, burada override edilebilir
ENABLE_ALPHA_VALIDATION = False
ALPHA_VALIDATION_THRESHOLD = 6.0

# 🔹 Basit info cache (Değişmedi)
stock_info_cache: dict[str, dict] = {}

# ============================================================
# 1) TELEGRAM HTML SANITIZER – Güvenli Mesaj Oluşturucu
# ============================================================

def tg(text: str) -> str:
    """
    Telegram HTML modunda güvenli mesaj oluşturur.
    - <b>, <i>, <u>, <code>, <pre> tag'lerine izin verir.
    - Diğer tüm tag'leri escape eder (örn: <script> → &lt;script&gt;).
    - HTML bozulmasını engeller.
    """
    if not text:
        return ""

    # Temel HTML escape
    escaped = html.escape(text)

    # İzin verilen tag'leri geri dönüştür
    allowed_tags = {
        "&lt;b&gt;": "<b>",
        "&lt;/b&gt;": "</b>",
        "&lt;i&gt;": "<i>",
        "&lt;/i&gt;": "</i>",
        "&lt;u&gt;": "<u>",
        "&lt;/u&gt;": "</u>",
        "&lt;code&gt;": "<code>",
        "&lt;/code&gt;": "</code>",
        "&lt;pre&gt;": "<pre>",
        "&lt;/pre&gt;": "</pre>",
    }
    for k, v in allowed_tags.items():
        escaped = escaped.replace(k, v)

    return escaped


# ============================================================
# 2) HTML SAFE SPLIT — Uzun Mesajları Güvenli Şekilde Böl
# ============================================================

def split_html_safe(text: str, max_len: int = 3500) -> list[str]:
    """
    Telegram'ın maksimum mesaj uzunluğu için HTML bozulmadan bölme yapar.
    Tag ortasının kesilmesi engellenir.
    """
    if len(text) <= max_len:
        return [text]

    parts = []
    current = []

    def balanced(s: str) -> bool:
        """Açık-kapalı HTML tag dengesi sağlanmış mı?"""
        return (s.count("<b>") == s.count("</b>")
                and s.count("<i>") == s.count("</i>")
                and s.count("<u>") == s.count("</u>")
                and s.count("<code>") == s.count("</code>")
                and s.count("<pre>") == s.count("</pre>")
        )

    for char in text:
        current.append(char)
        if len(current) >= max_len:
            chunk = "".join(current)
            if balanced(chunk):
                parts.append(chunk)
                current = []

    if current:
        parts.append("".join(current))

    return parts


# ============================================================
# 3) TELEGRAM METİN MESAJ GÖNDERİCİ (Async – Pro Sürüm)
# ============================================================

async def send_telegram_message(message: str):
    """
    Telegram'a HTML modunda güvenli uzun mesaj gönderir.
    Rate-limit / network error durumlarında hata loglar.
    """
    if not ENABLE_TELEGRAM_NOTIFICATIONS or not TELEGRAM_API_KEY:
        return

    safe_text = tg(message)
    parts = split_html_safe(safe_text)

    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"

    async with aiohttp.ClientSession() as session:
        for idx, part in enumerate(parts, start=1):
            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": part,
                "parse_mode": "HTML"
            }

            try:
                async with session.post(url, data=payload, timeout=15) as resp:
                    if resp.status != 200:
                        err = await resp.text()
                        logging.error(f"❌ Telegram mesaj hatası [{idx}]: {err}")
                    else:
                        logging.info(f"📩 Telegram mesajı gönderildi ({idx}/{len(parts)})")
            except Exception as e:
                logging.error(f"⚠️ Telegram bağlantı hatası ({idx}): {e}")


# ============================================================
# 4) TELEGRAM FOTOĞRAF GÖNDERİCİ (HTML caption destekli)
# ============================================================

async def send_telegram_photo(photo_path: str, caption: str = ""):
    """
    Telegram'a fotoğraf + HTML caption gönderir.
    - Dosya yoksa hata verir.
    - HTML caption sanitizer ile güvenli hâle getirilir.
    """
    if not TELEGRAM_API_KEY or not os.path.exists(photo_path):
        logging.error("❌ Telegram fotoğraf gönderilemedi: API key veya dosya eksik.")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendPhoto"
    caption_safe = tg(caption)

    async with aiohttp.ClientSession() as session:
        try:
            with open(photo_path, "rb") as img:
                form = aiohttp.FormData()
                form.add_field("chat_id", TELEGRAM_CHAT_ID)
                form.add_field("caption", caption_safe)
                form.add_field("parse_mode", "HTML")
                form.add_field("photo", img, filename=os.path.basename(photo_path),
                               content_type="image/png")

                async with session.post(url, data=form, timeout=20) as resp:
                    if resp.status != 200:
                        err = await resp.text()
                        logging.error(f"❌ Telegram fotoğraf hatası: {err}")
                    else:
                        logging.info("📸 Telegram fotoğraf gönderildi.")

        except Exception as e:
            logging.error(f"⚠️ Telegram Photo Error: {e}")

# ============================================================
# v112 YENİ MODÜLLER: Black-Scholes, Smart Money, Insider, Finansal Sağlık
# ============================================================

# ============================================================
# 🎯 BLACK-SCHOLES & GREEKS MOTORU (Agresif bottan alınan)
# ============================================================

def norm_cdf(x: float) -> float:
    """Standart normal dağılım kümülatif fonksiyonu (SciPy bağımlılığı olmadan)"""
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0


def calculate_bs_greeks(S: float, K: float, t_days: int, iv: float, r: float = 0.04) -> dict:
    """Black-Scholes modeli ile Delta, Gamma, Theta ve Vega hesaplar"""
    if t_days <= 0 or iv <= 0 or K <= 0 or S <= 0:
        return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
    
    t = t_days / 365.0
    sqrt_t = math.sqrt(t)
    d1 = (math.log(S / K) + (r + 0.5 * iv**2) * t) / (iv * sqrt_t)
    d2 = d1 - iv * sqrt_t
    
    pdf = math.exp(-d1**2 / 2) / math.sqrt(2 * math.pi)
    
    delta = norm_cdf(d1)
    gamma = pdf / (S * iv * sqrt_t)
    theta = -(S * pdf * iv) / (2 * sqrt_t) - r * K * math.exp(-r * t) * norm_cdf(d2)
    vega = S * pdf * sqrt_t
    
    return {
        "delta": round(delta, 2),
        "gamma": round(gamma, 4),
        "theta": round(theta / 365.0, 4),
        "vega": round(vega / 100.0, 4)
    }


async def scan_option_chain(ticker: str, current_price: float, profit_target: float = 0.0) -> dict:
    """
    🦅 V112 OPSİYON RADARI: Greeks, Breakeven, ITM/OTM analizi (Agresiften alınan + geliştirilmiş)
    """
    try:
        stock = yf.Ticker(ticker)
        exp_dates = await asyncio.to_thread(lambda: stock.options)
        if not exp_dates: return {}

        now_date = datetime.now(NY_TZ).date()
        target_date, target_dte = None, 0
        for d in exp_dates:
            try:
                exp_dt = datetime.strptime(d, "%Y-%m-%d").date()
                dte = (exp_dt - now_date).days
                if 25 <= dte <= 50:
                    target_date, target_dte = d, dte
                    break
            except: continue
        
        if not target_date: return {}

        chain = await asyncio.to_thread(lambda: stock.option_chain(target_date))
        calls = chain.calls
        if calls.empty: return {}

        calls = calls[(calls['bid'] > 0) & (calls['ask'] > 0) & (calls['openInterest'] > 20)].copy()
        if calls.empty: return {}

        best_safe, best_agg = None, None
        min_score_safe, min_score_agg = 999.0, 999.0

        for _, row in calls.iterrows():
            strike, iv, bid, ask = row['strike'], row['impliedVolatility'], row['bid'], row['ask']
            if iv < 0.01: continue

            greeks = calculate_bs_greeks(current_price, strike, target_dte, iv)
            delta = greeks['delta']
            
            breakeven = strike + ask
            profit_at_target = (profit_target - breakeven) if profit_target > 0 else 0
            
            spread_pct = (ask - bid) / ask if ask > 0 else 1.0
            spread_penalty = spread_pct * 3.0

            # GÜVENLİ ITM (Delta: 0.65 - 0.75)
            score_safe = abs(delta - 0.70) + spread_penalty
            if score_safe < min_score_safe:
                min_score_safe = score_safe
                best_safe = {
                    "strike": strike, "delta": delta, "bid": bid, "ask": ask,
                    "spread": round(spread_pct * 100, 1), "iv": round(iv * 100, 1),
                    "oi": int(row['openInterest']), "breakeven": round(breakeven, 2),
                    "greeks": greeks
                }

            # AGRESİF OTM (Delta: 0.30 - 0.40)
            score_agg = abs(delta - 0.35) + spread_penalty
            if score_agg < min_score_agg:
                min_score_agg = score_agg
                best_agg = {
                    "strike": strike, "delta": delta, "bid": bid, "ask": ask,
                    "spread": round(spread_pct * 100, 1), "iv": round(iv * 100, 1),
                    "oi": int(row['openInterest']), "breakeven": round(breakeven, 2),
                    "greeks": greeks
                }

        return {
            "date": target_date, "dte": target_dte,
            "safe": best_safe if (best_safe and best_safe['delta'] > 0.40) else None,
            "agg": best_agg if (best_agg and best_agg['delta'] < 0.60) else None
        }
    except Exception as e:
        logging.error(f"❌ Opsiyon Tarama Hatası ({ticker}): {e}")
        return {}


# ============================================================
# 🏦 V112 INSIDER İŞLEM TESPİT MOTORU (YENİ)
# ============================================================

def detect_insider_activity(ticker: str, info: dict) -> dict:
    """
    Insider alım/satımlarını tespit eder.
    CEO/CFO/Director alımları özellikle güçlü sinyal.
    """
    try:
        stock = yf.Ticker(ticker)
        
        # Insider Transactions
        insider_data = stock.insider_transactions
        if insider_data is None or insider_data.empty:
            return {'has_insider': False, 'score': 0.0, 'details': []}
        
        recent = insider_data.head(20)
        buy_count = 0
        sell_count = 0
        buy_value = 0.0
        executive_buys = 0
        
        for _, row in recent.iterrows():
            text = str(row.get('Text', '')).lower()
            shares = abs(float(row.get('Shares', 0) or 0))
            insider_name = str(row.get('Insider', '')).lower()
            
            if 'purchase' in text or 'buy' in text or 'acquisition' in text:
                buy_count += 1
                buy_value += shares
                if any(title in insider_name for title in ['ceo', 'cfo', 'cto', 'president', 'director', 'officer']):
                    executive_buys += 1
            elif 'sale' in text or 'sell' in text:
                sell_count += 1
        
        score = 0.0
        details = []
        
        # Net alıcı mı?
        if buy_count > sell_count:
            score += 1.0
            details.append(f"🏦 Insider Net Alıcı ({buy_count} alım / {sell_count} satım)")
        
        # Executive (C-Suite) alımı çok güçlü sinyal
        if executive_buys >= 2:
            score += 1.5
            details.append(f"👔 C-Suite Güçlü Alım ({executive_buys} yönetici)")
        elif executive_buys >= 1:
            score += 0.8
            details.append(f"👔 C-Suite Alım Sinyali")
        
        # Cluster Buying (Birden fazla insider aynı anda alıyorsa)
        if buy_count >= 3:
            score += 0.8
            details.append(f"🎯 Insider Cluster Buying ({buy_count} kişi)")
        
        return {
            'has_insider': score > 0,
            'score': min(score, 3.0),
            'details': details,
            'buy_count': buy_count,
            'sell_count': sell_count,
            'executive_buys': executive_buys
        }
        
    except Exception as e:
        logging.debug(f"Insider tespiti hatası ({ticker}): {e}")
        return {'has_insider': False, 'score': 0.0, 'details': []}


# ============================================================
# 💰 V112 GELİŞMİŞ KURUMSAL PARA AKIŞI (Smart Money Flow)
# ============================================================

def analyze_smart_money_flow(df_1d: pd.DataFrame, ticker: str, info: dict) -> dict:
    """
    V112: Gelişmiş kurumsal para akışı analizi.
    - Accumulation/Distribution Line (Chaikin)
    - Money Flow Index (MFI)
    - VWAP bazlı kurumsal alım tespiti
    - Hacim-Fiyat korelasyonu
    """
    try:
        if len(df_1d) < 20:
            return {'has_smart_flow': False, 'score': 0.0, 'details': []}
        
        close = df_1d['Close']
        high = df_1d['High']
        low = df_1d['Low']
        volume = df_1d['Volume']
        
        score = 0.0
        details = []
        
        # 1) CHAIKIN MONEY FLOW (CMF) — 20 periyot
        mf_mult = ((close - low) - (high - close)) / (high - low)
        mf_mult = mf_mult.replace([np.inf, -np.inf], 0).fillna(0)
        mf_volume = mf_mult * volume
        cmf_20 = mf_volume.rolling(20).sum() / volume.rolling(20).sum()
        cmf_val = float(cmf_20.iloc[-1]) if not pd.isna(cmf_20.iloc[-1]) else 0.0
        
        if cmf_val > 0.15:
            score += 1.5
            details.append(f"💰 Smart Money: Güçlü Kurumsal Akümülasyon (CMF: {cmf_val:.2f})")
        elif cmf_val > 0.05:
            score += 0.8
            details.append(f"📈 Smart Money: Pozitif Para Akışı (CMF: {cmf_val:.2f})")
        elif cmf_val < -0.10:
            score -= 0.8
            details.append(f"⚠️ Smart Money: Kurumsal Dağıtım (CMF: {cmf_val:.2f})")
        
        # 2) MONEY FLOW INDEX (MFI) — RSI'nin hacim ağırlıklı versiyonu
        typical_price = (high + low + close) / 3
        raw_mf = typical_price * volume
        
        mf_positive = raw_mf.where(typical_price > typical_price.shift(1), 0)
        mf_negative = raw_mf.where(typical_price < typical_price.shift(1), 0)
        
        mf_pos_sum = mf_positive.rolling(14).sum()
        mf_neg_sum = mf_negative.rolling(14).sum()
        
        mf_ratio = mf_pos_sum / mf_neg_sum
        mf_ratio = mf_ratio.replace([np.inf, -np.inf], 100).fillna(50)
        mfi = 100 - (100 / (1 + mf_ratio))
        mfi_val = float(mfi.iloc[-1]) if not pd.isna(mfi.iloc[-1]) else 50.0
        
        if 40 <= mfi_val <= 60:
            score += 0.5
            details.append(f"📊 MFI: Nötr Bölge ({mfi_val:.0f})")
        elif mfi_val > 60:
            score += 1.0
            details.append(f"💪 MFI: Güçlü Para Girişi ({mfi_val:.0f})")
        elif mfi_val < 30:
            score += 0.3  # Oversold MFI dönüş sinyali olabilir
            details.append(f"🔄 MFI: Aşırı Satım Dönüş Potansiyeli ({mfi_val:.0f})")
        
        # 3) KURUMSAL SAHİPLİK DEĞİŞİMİ
        inst_pct = info.get('heldPercentInstitutions', 0) or 0
        if inst_pct > 0.80:
            score += 1.0
            details.append(f"🏛️ Kurumsal Sahiplik: %{inst_pct*100:.0f} (Çok Yüksek)")
        elif inst_pct > 0.60:
            score += 0.5
            details.append(f"🏦 Kurumsal Sahiplik: %{inst_pct*100:.0f}")
        
        # 4) ON-UP VOLUME vs ON-DOWN VOLUME (Son 10 gün)
        recent = df_1d.tail(10)
        up_days = recent[recent['Close'] > recent['Open']]
        down_days = recent[recent['Close'] < recent['Open']]
        
        up_vol = up_days['Volume'].sum() if len(up_days) > 0 else 0
        down_vol = down_days['Volume'].sum() if len(down_days) > 0 else 0
        
        vol_ratio = up_vol / down_vol if down_vol > 0 else 2.0
        
        if vol_ratio > 2.0:
            score += 1.2
            details.append(f"🐋 Hacim Asimetri: Alıcı Baskın ({vol_ratio:.1f}x)")
        elif vol_ratio > 1.3:
            score += 0.5
            details.append(f"📊 Hacim Asimetri: Hafif Alıcı ({vol_ratio:.1f}x)")
        elif vol_ratio < 0.5:
            score -= 0.6
            details.append(f"⚠️ Hacim Asimetri: Satıcı Baskın ({vol_ratio:.1f}x)")
        
        return {
            'has_smart_flow': score > 0,
            'score': min(score, 4.0),
            'details': details,
            'cmf': round(cmf_val, 3),
            'mfi': round(mfi_val, 1),
            'vol_asymmetry': round(vol_ratio, 2)
        }
        
    except Exception as e:
        logging.debug(f"Smart Money Flow hatası ({ticker}): {e}")
        return {'has_smart_flow': False, 'score': 0.0, 'details': []}


# ============================================================
# 📊 V112 FİNANSAL SAĞLIK ANALİZİ (Ticari Yaklaşım)
# ============================================================

def analyze_financial_health(ticker: str, info: dict) -> dict:
    """
    V112: Akademik değil TİCARİ yaklaşımla şirket finansal sağlık analizi.
    Hedge fund ve prop trading'de kullanılan pratik metrikler.
    """
    try:
        score = 0.0
        details = []
        
        # 1) GELİR BÜYÜME MODELİ (Üst satır büyümesi)
        rev_growth = info.get('revenueGrowth', 0) or 0
        if rev_growth > 0.20:
            score += 1.5
            details.append(f"🚀 Gelir Büyümesi: %{rev_growth*100:.0f} (Hypergrowth)")
        elif rev_growth > 0.10:
            score += 1.0
            details.append(f"📈 Gelir Büyümesi: %{rev_growth*100:.0f} (Güçlü)")
        elif rev_growth > 0.05:
            score += 0.5
            details.append(f"📊 Gelir Büyümesi: %{rev_growth*100:.0f} (Stabil)")
        elif rev_growth < -0.05:
            score -= 0.8
            details.append(f"⚠️ Gelir Daralması: %{rev_growth*100:.0f}")
        
        # 2) KÂRLILIK (EPS büyümesi + marj)
        earnings_growth = info.get('earningsGrowth', 0) or 0
        if earnings_growth > 0.25:
            score += 1.0
            details.append(f"💰 EPS Büyüme: %{earnings_growth*100:.0f}")
        elif earnings_growth > 0.10:
            score += 0.5
        
        profit_margin = info.get('profitMargins', 0) or 0
        if profit_margin > 0.20:
            score += 0.5
            details.append(f"💎 Kâr Marjı: %{profit_margin*100:.0f}")
        
        # 3) NAKİT AKIŞI (Free Cash Flow) — Gerçek kâr göstergesi
        fcf = info.get('freeCashflow', 0) or 0
        mcap = info.get('marketCap', 1) or 1
        fcf_yield = fcf / mcap if mcap > 0 else 0
        
        if fcf > 0 and fcf_yield > 0.05:
            score += 1.0
            details.append(f"💵 Pozitif FCF Yield: %{fcf_yield*100:.1f}")
        elif fcf > 0:
            score += 0.3
            details.append("✅ Pozitif FCF")
        elif fcf < 0:
            score -= 0.5
            details.append("⚠️ Negatif FCF")
        
        # 4) BİLANÇO SAĞLIĞI (Borç/Özkaynak)
        debt_equity = info.get('debtToEquity', 0) or 0
        if 0 < debt_equity < 50:
            score += 0.5
            details.append(f"🏦 Güçlü Bilanço (D/E: {debt_equity:.0f}%)")
        elif debt_equity > 200:
            score -= 0.5
            details.append(f"⚠️ Yüksek Borç (D/E: {debt_equity:.0f}%)")
        
        # 5) ROE (Return on Equity) — Yönetim kalitesi
        roe = info.get('returnOnEquity', 0) or 0
        if roe > 0.20:
            score += 0.8
            details.append(f"👑 ROE: %{roe*100:.0f} (Üst Düzey)")
        elif roe > 0.10:
            score += 0.3
            details.append(f"✅ ROE: %{roe*100:.0f}")
        
        # 6) DEĞERLEME (P/E Forward vs Trailing)
        pe_trailing = info.get('trailingPE', 0) or 0
        pe_forward = info.get('forwardPE', 0) or 0
        
        if pe_forward > 0 and pe_trailing > 0 and pe_forward < pe_trailing * 0.85:
            score += 0.5
            details.append(f"📉 Forward P/E düşüyor ({pe_forward:.0f} vs {pe_trailing:.0f})")
        
        # 7) ANALIST KONSENSÜSi
        rec = str(info.get('recommendationKey', '')).lower()
        target_price = info.get('targetMeanPrice', 0) or 0
        current_price = info.get('currentPrice', 0) or info.get('regularMarketPrice', 0) or 0
        
        if rec in ['strong_buy', 'buy']:
            score += 0.5
            details.append(f"📈 Analist: {rec.replace('_', ' ').title()}")
        
        if target_price > 0 and current_price > 0:
            upside = ((target_price - current_price) / current_price) * 100
            if upside > 20:
                score += 0.5
                details.append(f"🎯 Hedef Fiyat Upside: %{upside:.0f}")
        
        return {
            'health_score': min(score, 5.0),
            'details': details,
            'rev_growth': rev_growth,
            'fcf_yield': round(fcf_yield * 100, 1) if fcf_yield else 0,
            'roe': round(roe * 100, 1) if roe else 0
        }
        
    except Exception as e:
        logging.debug(f"Finansal sağlık hatası ({ticker}): {e}")
        return {'health_score': 0.0, 'details': []}


# ============================================================
# 📈 V112 YÜKSELEN HİSSE TESPİT MOTORU (Rising Stocks)
# ============================================================

def detect_rising_stock(df_1d: pd.DataFrame) -> dict:
    """
    V112 YENİ: Sadece en güçlüleri değil, yükselmeye BAŞLAYAN hisseleri tespit eder.
    - Pullback sonrası toparlanma
    - Baz oluşturup kırılım yapan
    - Momentum ivmesi kazanan
    """
    try:
        if len(df_1d) < 30:
            return {'is_rising': False, 'score': 0.0, 'pattern': 'N/A'}
        
        close = df_1d['Close']
        high = df_1d['High']
        low = df_1d['Low']
        
        score = 0.0
        pattern = "Nötr"
        details = []
        
        # Son 5 gün vs son 20 gün performans karşılaştırması
        pct_5d = (close.iloc[-1] - close.iloc[-5]) / close.iloc[-5] if close.iloc[-5] > 0 else 0
        pct_20d = (close.iloc[-1] - close.iloc[-20]) / close.iloc[-20] if close.iloc[-20] > 0 else 0
        
        # 1) PULLBACK DÖNÜŞ: 20 günde pozitif, son 5 günde güçlü
        if pct_20d > 0 and pct_5d > 0.02:
            score += 1.5
            pattern = "Pullback Dönüş"
            details.append(f"🔄 Pullback Dönüş (5G: +%{pct_5d*100:.1f})")
        
        # 2) BAZ KIRILIMI: Son 10 günde dar bant, son 2 günde çıkış
        range_10d = (high.tail(10).max() - low.tail(10).min()) / close.iloc[-1]
        pct_2d = (close.iloc[-1] - close.iloc[-2]) / close.iloc[-2] if close.iloc[-2] > 0 else 0
        
        if range_10d < 0.06 and pct_2d > 0.015:
            score += 1.8
            pattern = "Baz Kırılımı"
            details.append(f"💥 Baz Kırılımı (Dar Bant → Çıkış)")
        
        # 3) İVME KAZANAN: Son 3 günde artan daily change
        if len(close) >= 4:
            chg1 = (close.iloc[-1] - close.iloc[-2]) / close.iloc[-2]
            chg2 = (close.iloc[-2] - close.iloc[-3]) / close.iloc[-3]
            chg3 = (close.iloc[-3] - close.iloc[-4]) / close.iloc[-4]
            
            if chg1 > chg2 > chg3 > 0:
                score += 1.2
                pattern = "İvme Kazanıyor"
                details.append("🚀 Artan Momentum (Her gün daha güçlü)")
        
        # 4) DİP DÖNÜŞ: 20 günün dibinden %5+ toparlanma
        low_20d = low.tail(20).min()
        recovery = (close.iloc[-1] - low_20d) / low_20d if low_20d > 0 else 0
        if recovery > 0.05 and pct_5d > 0:
            score += 1.0
            if pattern == "Nötr":
                pattern = "Dip Dönüş"
            details.append(f"📈 Dip'ten Dönüş: +%{recovery*100:.1f}")
        
        # 5) HIGHER-HIGH / HIGHER-LOW yapısı (Son 20 bar)
        highs_20 = high.tail(20)
        lows_20 = low.tail(20)
        
        # Basit pivot tespiti
        pivot_highs = []
        pivot_lows = []
        for i in range(2, len(highs_20) - 2):
            if highs_20.iloc[i] > highs_20.iloc[i-1] and highs_20.iloc[i] > highs_20.iloc[i+1]:
                pivot_highs.append(highs_20.iloc[i])
            if lows_20.iloc[i] < lows_20.iloc[i-1] and lows_20.iloc[i] < lows_20.iloc[i+1]:
                pivot_lows.append(lows_20.iloc[i])
        
        if len(pivot_highs) >= 2 and pivot_highs[-1] > pivot_highs[-2]:
            score += 0.5
            details.append("📊 Higher-High yapısı")
        if len(pivot_lows) >= 2 and pivot_lows[-1] > pivot_lows[-2]:
            score += 0.5
            details.append("📊 Higher-Low yapısı")
        
        return {
            'is_rising': score > 0.5,
            'score': min(score, 4.0),
            'pattern': pattern,
            'details': details,
            'pct_5d': round(pct_5d * 100, 1),
            'pct_20d': round(pct_20d * 100, 1)
        }
        
    except Exception as e:
        logging.debug(f"Rising stock tespiti hatası: {e}")
        return {'is_rising': False, 'score': 0.0, 'pattern': 'N/A'}


# ============================================================
# ÖNCEKİ MODÜLLER (güncellenerek devam)
# ============================================================

async def analyze_market_and_sectors():
    """
    TARAMA ÖNCESİ PİYASA RÖNTGENİ:
    1. SPY Analizi (Market Regime): Ayı mı Boğa mı?
    2. Sektör Analizi: Hangi sektörler akıyor (Momentum var)?
    """
    logging.info("🌍 Piyasa Rejimi ve Sektör Rotasyonu Analiz Ediliyor...")  
    
    # 1) MARKET REGIME (SPY EMA200 KONTROLÜ)
    try:
        spy = yf.Ticker("SPY")
        hist = spy.history(period="1y")
        if not hist.empty:
            close = hist["Close"]
            current_price = float(close.iloc[-1])

            # ema200_series'i tanımlıyoruz
            ema200_series = EMAIndicator(close, 200).ema_indicator()
            ema200 = float(ema200_series.iloc[-1])
            
            # EMA50 ve Eğim analizi ekle (v105+ MARKET REGIME İYİLEŞTİRME)
            ema50_series = EMAIndicator(close, 50).ema_indicator()
            last_ema50 = float(ema50_series.iloc[-1])
            
            # EMA200 Eğimi (son 15 gün)
            ema200_15d_ago = float(ema200_series.iloc[-15])
            ema200_slope = (ema200 - ema200_15d_ago) / ema200_15d_ago if ema200_15d_ago > 0 else 0.0
            
            # EMA50 Eğimi (son 10 gün)
            ema50_10d_ago = float(ema50_series.iloc[-10]) if len(ema50_series) >= 10 else last_ema50
            ema50_slope = (last_ema50 - ema50_10d_ago) / ema50_10d_ago if ema50_10d_ago > 0 else 0.0
            
            # EMA Spread
            ema_spread = (last_ema50 - ema200) / ema200 if ema200 > 0 else 0.0
            
            # MARKET REGIME TESPİTİ (4 SEVİYE)
            if current_price > ema200 and ema200_slope > 0.002 and last_ema50 > ema200:
                MARKET_STATUS["regime"] = "STRONG"
                MARKET_STATUS["min_score_modifier"] = 0.0
                logging.info(f"✅ STRONG MARKET (SPY > EMA50 > EMA200 + Eğim Pozitif). Filtreler Normal.")
            elif current_price > ema200 and ema_spread > 0.01:
                MARKET_STATUS["regime"] = "BULLISH"
                MARKET_STATUS["min_score_modifier"] = 0.3
                logging.info(f"⚠️ BULLISH MARKET (SPY > EMA200, ama EMA eğimi zayıf). Filtreler Biraz Sıkı.")
            elif current_price > ema200:
                MARKET_STATUS["regime"] = "CHOPPY"
                MARKET_STATUS["min_score_modifier"] = 0.5
                logging.info(f"🟡 CHOPPY MARKET (SPY > EMA200 ama momentum zayıf). Filtreler Sıkı.")
            else:
                MARKET_STATUS["regime"] = "WEAK"
                MARKET_STATUS["min_score_modifier"] = 1.0
                logging.warning(f"🐻 WEAK MARKET (SPY < EMA200). Screening DURDURULACAK.")
    except Exception as e:
        logging.error(f"Piyasa rejimi hatası: {e}")

    # 2) SEKTÖR PERFORMANSI (SON 5 GÜN)
    # Hangi sektör ETF'i son 5 günde ne yapmış?
    async with aiohttp.ClientSession() as session:
        for sector_name, etf_ticker in SECTOR_ETF_MAP.items():
            try:
                # Basitçe son 5 günü çekip yüzde değişime bakıyoruz
                etf = yf.Ticker(etf_ticker)
                hist = etf.history(period="5d")
                if len(hist) >= 2:
                    start_p = float(hist["Close"].iloc[0])
                    end_p = float(hist["Close"].iloc[-1])
                    change_pct = ((end_p - start_p) / start_p) * 100
                    SECTOR_PERFORMANCE[sector_name] = change_pct
            except Exception:
                continue
    
    logging.info("✅ Piyasa ve Sektör Analizi Tamamlandı.")
    
from typing import Literal

# ============================================
# 1) YF VERİ ÇEKİCİ — 1D / 1H (V112 - Agresiften alınan)
# ============================================

def get_stock_data(
    ticker: str,
    interval: Literal["1d", "1h"] = "1d"
) -> pd.DataFrame | None:
    """
    Yahoo Finance'ten optimize edilmiş veri çekme motoru.
    V112: 4H yerine 1H kullanılıyor (agresif bottan alınan).
    """
    
    time.sleep(random.uniform(2.5, 4.5))
    
    try:
        t = ticker.strip().upper()
        stock = yf.Ticker(t)

        period_map = {
            "1d": "250d", 
            "1h": "7d"  
        }

        logging.info(f"📡 {t} ({interval}) {period_map[interval]} veri talep ediliyor...")

        try:
            df = stock.history(
                period=period_map[interval],
                interval=interval,
                auto_adjust=True,
                timeout=12 
            )
        except Exception as fetch_err:
            if "Too Many Requests" in str(fetch_err):
                logging.error(f"🚨 RATE LIMIT! Yahoo bizi durdurdu ({t}).")
            else:
                logging.error(f"❌ {t} ({interval}) history() hatası: {fetch_err}")
            return None

        if df is None or df.empty:
            return None

        df.columns = [c.capitalize() for c in df.columns]
        df = df.dropna()

        if interval == "1d":
            if len(df) < 50:
                logging.warning(f"⚠️ {t} Yetersiz 1D barı ({len(df)})")
                return None
            lookback = globals().get('LOOKBACK_DAYS', 200)
            df = df.tail(lookback)

        elif interval == "1h":
            if len(df) < 10: 
                logging.warning(f"⚠️ {t} Yetersiz 1H barı ({len(df)})")
                return None

        logging.info(f"✅ {t} ({interval}) {len(df)} bar başarıyla alındı.")
        return df

    except Exception as e:
        logging.error(f"❌ {ticker} ({interval}) genel hata: {e}")
        return None
        
# ============================================
# 2) YF INFO ÇEKİCİ — MARKET CAP, VOLUME, BETA, SHORT FLOAT
# ============================================

stock_info_cache: dict[str, dict] = {}

def get_stock_info(ticker: str) -> dict:
    """
    YF info sözlüğünden:
    - marketCap
    - averageVolume10days
    - beta
    - shortPercentOfFloat
    verilerini güvenli şekilde çeker.

    YF info bazen boş dict döndürdüğü için güçlü hata koruması eklenmiştir.
    """

    t = ticker.strip().upper()

    # ----------------------------------------------
    # Cache kontrolü
    # ----------------------------------------------
    if t in stock_info_cache:
        return stock_info_cache[t]

    try:
        stock = yf.Ticker(t)

        try:
            info = stock.info or {}
        except Exception as info_err:
            logging.warning(f"⚠️ {t}: info() hatası → {info_err}")
            info = {}

        market_cap = info.get("marketCap") or 0
        avg_volume = info.get("averageVolume10days") or 0
        beta = info.get("beta") or 0.0
        short_float = info.get("shortPercentOfFloat") or 0.0

        data = {
            "market_cap": market_cap,
            "avg_volume": avg_volume,
            "beta": float(beta),
            "short_float": float(short_float)
        }

        stock_info_cache[t] = data
        return data

    except Exception as e:
        logging.warning(f"⚠️ {t}: Bilgi çekme hatası → {e}, default değerler atanıyor.")

        fallback = {
            "market_cap": 0,
            "avg_volume": 0,
            "beta": 0.0,
            "short_float": 1.0
        }
        stock_info_cache[t] = fallback
        return fallback


def calculate_profit_target(
    entry_price: float,
    atr_value: float,
    momentum_score: float,
    is_exhausted: bool = False,
    beta: float = 1.0
) -> tuple[float, float]:
    """
    V112 — ATR-Based Dinamik Tavan Sistemi (Precision TP/SL)
    
    Kural: TP çarpanı 1.8x–2.5x ATR bandına sabitlendi.
    Kural: Beklenen kâr %12 üzerindeyse otomatik olarak %10–12 bandına tıraşlanır.
    Kural: Exhausted hisselerde TP %40 daraltılır.
    """

    # ---------------------------------------------------
    # 0) ATR yoksa → konservatif yedek TP/SL
    # ---------------------------------------------------
    if pd.isna(atr_value) or atr_value == 0:
        fallback_tp_pct = 0.07 if not is_exhausted else 0.04
        return entry_price * (1 + fallback_tp_pct), entry_price * 0.98

    # ---------------------------------------------------
    # 1) ATR tabanlı SL (1.5x–2.0x ATR)
    # ---------------------------------------------------
    atr_multiplier_sl = 1.5 if atr_value < entry_price * 0.01 else 2.0
    sl_distance = atr_value * atr_multiplier_sl
    stop_loss = entry_price - sl_distance

    # ---------------------------------------------------
    # 2) ATR tabanlı TP (V112: 1.8x–2.5x bant)
    # Normal momentum → 2.0x ATR
    # Güçlü momentum → 2.5x ATR (üst sınır)
    # Exhausted       → 1.8x ATR (daraltılmış)
    # ---------------------------------------------------
    m = min(1.0, momentum_score / 12.0)

    if is_exhausted:
        tp_atr_mult = 1.8  # Yorgun hisse: dar hedef
    else:
        # 1.8 → 2.5 arası dinamik (momentum ile ölçeklenir)
        tp_atr_mult = 1.8 + (0.7 * m)  # max 2.5

    tp_distance = atr_value * tp_atr_mult
    profit_target_raw = entry_price + tp_distance

    # ---------------------------------------------------
    # 3) Kâr Yüzdesi Hesabı ve %10–12 Tavan (V112 Tavan Sistemi)
    # ---------------------------------------------------
    profit_pct_raw = (profit_target_raw - entry_price) / entry_price * 100

    # Beta'ya göre üst tavan belirle:
    #   Beta > 1.5 → volatil hisse, %12'ye kadar izin
    #   Beta ≤ 1.5 → daha konservatif, %10'da kes
    max_profit_pct = 12.0 if beta > 1.5 else 10.0

    if profit_pct_raw > max_profit_pct:
        profit_target = entry_price * (1 + max_profit_pct / 100)
    else:
        profit_target = profit_target_raw

    # ---------------------------------------------------
    # 4) Exhausted hisse: TP'yi %40 daralt (final kontrol)
    # Tavan uygulandıktan sonra ayrıca daral
    # ---------------------------------------------------
    if is_exhausted:
        capped = entry_price + (profit_target - entry_price) * 0.60
        profit_target = capped

    # ---------------------------------------------------
    # 5) Minimum R/R kontrolü (1.5x) — SADECE tavan/exhaust
    # limitleri uygulanmamışsa devreye girer
    # (Tavan/exhaust limiti zaten geçerliyse, override etme)
    # ---------------------------------------------------
    raw_profit_pct = (profit_target - entry_price) / entry_price * 100
    if sl_distance > 0 and raw_profit_pct < 4.0:
        # Sadece gerçekten yetersiz R/R'de (hedef %4'ten az) uygula
        min_rr_target = entry_price + sl_distance * 1.5
        min_rr_pct = (min_rr_target - entry_price) / entry_price * 100
        if min_rr_pct <= max_profit_pct:
            profit_target = min_rr_target

    return float(round(profit_target, 4)), float(round(stop_loss, 4))

# -----------------------------------------------------
# RELATIVE STRENGTH (SPY/QQQ) CACHE HELPER
# -----------------------------------------------------

index_cache: dict[str, pd.Series] = {}

def get_index_close_series(symbol: str = INDEX_BENCHMARK) -> pd.Series | None:
    """
    Benchmark endeksin (SPY / QQQ) 1D kapanış serisini cache'ler.
    Böylece her hisse için tekrar tekrar SPY verisi çekilmez,
    performans 10–15 kat artar.
    """
    symbol = symbol.upper()

    # Cache varsa direkt dön
    if symbol in index_cache:
        return index_cache[symbol]

    # Yoksa veriyi çek
    df_idx = get_stock_data(symbol, interval="1d")

    if df_idx is None or df_idx.empty:
        logging.warning(f"{symbol}: Endeks verisi alınamadı, RS hesaplanmadı.")
        return None

    # Sadece Close serisini saklıyoruz
    index_cache[symbol] = df_idx["Close"]
    return index_cache[symbol]

# -----------------------------------------------------
# 🦁 ALPHA VANTAGE CROSS-VALIDATION
# -----------------------------------------------------
alpha_vantage_cache = {}

async def verify_with_alpha_vantage(ticker: str, yahoo_price: float) -> dict:
    """
    Alpha Vantage ile Yahoo Finance verilerini cross-validate et.
    Sadece high-conviction candidates için (score > 8.5)
    
    Returns:
        {
            'validated': bool,
            'av_price': float,
            'price_diff_pct': float,
            'warning': str or None
        }
    """
    # Cache kontrolü (günlük)
    cache_key = f"{ticker}_{datetime.now().date()}"
    if cache_key in alpha_vantage_cache:
        return alpha_vantage_cache[cache_key]
    
    # API KEY Kontrolü
    if not globals().get("ALPHA_VANTAGE_API_KEY"):
        return {'validated': True, 'av_price': 0, 'warning': 'No API Key'}

    try:
        api_key = globals()["ALPHA_VANTAGE_API_KEY"]
        url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as resp:
                if resp.status != 200:
                    return {'validated': False, 'av_price': 0, 'price_diff_pct': 0, 'warning': 'AV API error'}
                
                data = await resp.json()
                
        quote = data.get('Global Quote', {})
        av_price = float(quote.get('05. price', 0))
        
        if av_price == 0:
            return {'validated': False, 'av_price': 0, 'price_diff_pct': 0, 'warning': 'AV no data'}
        
        # Fiyat farkı hesapla
        price_diff_pct = abs((yahoo_price - av_price) / yahoo_price) * 100
        
        # %5'ten fazla fark varsa uyarı (Veri hatası riski)
        validated = price_diff_pct < 5.0
        warning = None if validated else f"Fiyat farkı %{price_diff_pct:.1f} (Yahoo: ${yahoo_price:.2f} vs AV: ${av_price:.2f})"
        
        result = {
            'validated': validated,
            'av_price': av_price,
            'price_diff_pct': price_diff_pct,
            'warning': warning
        }
        
        alpha_vantage_cache[cache_key] = result
        return result
        
    except Exception as e:
        logging.warning(f"Alpha Vantage validation error for {ticker}: {e}")
        # Hata durumunda akışı bozma, validated False dön
        return {'validated': False, 'av_price': 0, 'price_diff_pct': 0, 'warning': str(e)}

def estimate_hold_time(
    momentum_score: float,
    vol_increase: float,
    profit_pct: float = 0.0,
    atr_pct: float = 0.0,
    is_exhausted: bool = False
) -> int:
    """
    V112 — Piyasa Direnci Hesabı (Directional Efficiency)
    
    Formül: hold_days = profit_pct / (atr_pct × 0.20)
    Mantık: Günlük ATR'nin yalnızca %20'si net yukarı yöne hizmet eder.
    
    Kesin Kural: min 3 gün, max 15 gün.
    Exhausted hisse: +3 gün ceza.
    """

    # ---------------------------------------------------------
    # 1) Temel Gün Hesabı (Directional Efficiency Formülü)
    # ---------------------------------------------------------
    directional_daily = atr_pct * 0.20  # Günlük net yukarı hareket tahmini

    if directional_daily > 0 and profit_pct > 0:
        hold = int(profit_pct / directional_daily)
        hold = max(3, min(20, hold))  # Ham hesap için geçici sınır
    else:
        hold = 7  # Fallback

    # ---------------------------------------------------------
    # 2) Momentum düzeltmesi (hız faktörü)
    # ---------------------------------------------------------
    m = min(1.0, momentum_score / 14.0)

    if m >= 0.90:
        hold -= 2
    elif m >= 0.75:
        hold -= 1
    elif m < 0.35:
        hold += 2
    elif m < 0.50:
        hold += 1

    # ---------------------------------------------------------
    # 3) Hacim Rejimi Düzeltmesi
    # ---------------------------------------------------------
    if vol_increase >= 2.2:
        hold -= 2   # Hacim patlama → hızlı tükenme
    elif vol_increase >= 1.8:
        hold -= 1
    elif 1.4 <= vol_increase < 1.8:
        hold += 0   # İdeal swing hızı
    elif vol_increase < 0.8:
        hold += 2   # Hacimsiz → sabır

    # ---------------------------------------------------------
    # 4) Exhaustion Cezası (+3 gün)
    # ---------------------------------------------------------
    if is_exhausted:
        hold += 3

    # ---------------------------------------------------------
    # 5) Kesin Sınırlar: min 3, max 15 (V112 kuralı)
    # ---------------------------------------------------------
    hold = max(3, min(15, hold))

    return int(hold)


def calculate_ema_slope(ema_series: pd.Series, periods: int = 10) -> bool:
    """EMA'nın son X barda yükselip yükselmediğini kontrol eder."""
    if len(ema_series) < periods:
        return False
    
    # Son 'periods' kadar barın eğimini kontrol et (Hafif bir eğim yeterli)
    recent_ema = ema_series.tail(periods).copy()
    
    # Eğim hesapla (Basit lineer regresyon)
    return recent_ema.iloc[-1] > recent_ema.iloc[0]


# ============================================================
# 🛠️ YARDIMCI MOTORLAR (v104 UPGRADE)
# ============================================================

# 1. GÜVENLİ EARNINGS KONTROLÜ
def get_earnings_date_safe(ticker: str) -> Optional[datetime]:
    """Yahoo Finance'dan earnings tarihini güvenli şekilde çeker."""
    try:
        stock = yf.Ticker(ticker)
        # Yöntem 1: Calendar
        if hasattr(stock, 'calendar') and stock.calendar:
            earnings_date = stock.calendar.get('Earnings Date', None)
            if earnings_date:
                if isinstance(earnings_date, list): earnings_date = earnings_date[0]
                return pd.to_datetime(earnings_date)
        # Yöntem 2: Earnings Dates Tablosu
        if hasattr(stock, 'earnings_dates') and stock.earnings_dates is not None:
            upcoming = stock.earnings_dates[stock.earnings_dates.index >= datetime.now(NY_TZ)]
            if not upcoming.empty: return upcoming.index[0]
        return None
    except: return None

def is_earnings_safe_for_swing(ticker: str, min_days_away: int = 7) -> bool:
    """Swing trade için earnings güvenli mi? (7 gün kuralı + Post-Earnings Volatilite)"""
    try:
        earnings_date = get_earnings_date_safe(ticker)
        if earnings_date is None: return True # Tarih yoksa risk alıp devam et
        
        now = datetime.now(NY_TZ)
        # Earnings tarihi timezone-aware değilse çevir
        if earnings_date.tzinfo is None:
            earnings_date = earnings_date.replace(tzinfo=NY_TZ)
            
        days_until = (earnings_date - now).days
        
        # 1) Çok yakın earnings (Forward Risk)
        if 0 <= days_until < min_days_away:
            logging.info(f"⛔ {ticker} RED: Earnings {days_until} gün sonra!")
            return False
        # 2) Yeni açıklanmış earnings (Backward Risk - Volatilite)
        if -2 <= days_until < 0:
            logging.info(f"⛔ {ticker} RED: Earnings {abs(days_until)} gün önceydi (Volatilite)!")
            return False
            
        return True
    except: return True

# 2. KATALİZÖR TESPİT MOTORU (V112 GELİŞTİRİLMİŞ)
def check_silent_catalysts(ticker: str, info: dict) -> dict:
    """V112: Insider buying, Short Squeeze, Analyst Upgrade, Buyback tespiti."""
    catalysts = []
    score = 0.0
    
    # Short Squeeze Potansiyeli
    short_pct = info.get('shortPercentOfFloat', 0) or 0
    if short_pct > 0.20:
        catalysts.append(f"⚡ Short Float: %{short_pct*100:.1f}")
        score += 1.0
    elif short_pct > 0.10:
        catalysts.append(f"📊 Short Float: %{short_pct*100:.1f}")
        score += 0.3

    # Kurumsal Sahiplik (Smart Money onayı)
    inst_pct = info.get('heldPercentInstitutions', 0) or 0
    if inst_pct > 0.80:
        catalysts.append(f"🏛️ Kurumsal: %{inst_pct*100:.0f} (Çok Yüksek)")
        score += 0.8
    elif inst_pct > 0.60:
        catalysts.append(f"🏦 Kurumsal: %{inst_pct*100:.0f}")
        score += 0.3
        
    # Analist Tavsiyesi (Genişletilmiş)
    rec = str(info.get('recommendationKey', '')).lower()
    if 'strong_buy' in rec:
        catalysts.append("📈 Analist: Güçlü Al")
        score += 0.8
    elif 'buy' in rec:
        catalysts.append("📈 Analist: Al")
        score += 0.4
    
    # Buyback Programı (Hisse Geri Alımı)
    shares_outstanding = info.get('sharesOutstanding', 0) or 0
    float_shares = info.get('floatShares', 0) or 0
    if shares_outstanding > 0 and float_shares > 0:
        float_ratio = float_shares / shares_outstanding
        if float_ratio < 0.85:  # Düşük float = potansiyel geri alım
            catalysts.append(f"🔄 Düşük Float Oranı: %{float_ratio*100:.0f}")
            score += 0.3
    
    # PEG Ratio (Büyüme/Değerleme dengesi)
    peg = info.get('pegRatio', 0) or 0
    if 0 < peg < 1.5:
        catalysts.append(f"💎 PEG: {peg:.1f} (Ucuz Büyüme)")
        score += 0.5

    return {'has_catalyst': len(catalysts) > 0, 'score': min(score, 3.5), 'reasons': catalysts}

# 3. GELİŞMİŞ SEKTÖR ANALİZİ
async def analyze_sector_momentum_advanced():
    """Tüm sektörlerin 5 günlük momentumunu analiz eder."""
    logging.info("🌍 Gelişmiş Sektör Momentum Analizi Başlıyor...")
    sector_scores = {}
    
    async with aiohttp.ClientSession() as session:
        for sector_name, etf in SECTOR_ETF_MAP.items():
            try:
                # Sadece son 5 günü hızlıca çek
                stock = yf.Ticker(etf)
                hist = await asyncio.to_thread(stock.history, period="5d")
                
                if len(hist) >= 2:
                    chg = ((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100
                    
                    # Momentum Puanı
                    s_score = chg  # Basitçe % değişim (şimdilik)
                    if chg > 2.0: s_score += 1.0 # Bonus
                    
                    sector_scores[sector_name] = {'score': s_score, 'pct': chg}
                    
            except Exception: continue
            
    # Global değişkene kaydet
    global SECTOR_PERFORMANCE
    SECTOR_PERFORMANCE = {k: v['pct'] for k, v in sector_scores.items()} # Eski format uyumu
    
    # En iyiler ve en kötüler
    sorted_secs = sorted(sector_scores.items(), key=lambda x: x[1]['score'], reverse=True)
    top3 = [x[0] for x in sorted_secs[:3]]
    logging.info(f"🔥 HOT Sektörler: {', '.join(top3)}")
    
    return sector_scores
 
# 4. VOLUME ANALYSIS (KURUMSAL PARA AKIŞI - MOMENTUM ODAKLI)
def analyze_volume_profile_flow(df_1d: pd.DataFrame, ticker: str) -> dict:
    """Kurumsal para giriş/çıkışını ve erken swing hacim akışını analiz eder."""
    try:
        # Son 20 gün ve 5 gün ortalaması
        vol_20d = df_1d['Volume'].iloc[-20:].mean()
        vol_5d = df_1d['Volume'].iloc[-5:].mean()
        vol_ratio = vol_5d / vol_20d if vol_20d > 0 else 1.0
        
        # Accumulation / Distribution (yeşil vs kırmızı hacim)
        recent = df_1d.iloc[-5:].copy()
        recent['chg'] = recent['Close'] - recent['Open']
        green_vol = recent[recent['chg'] > 0]['Volume'].sum()
        red_vol = recent[recent['chg'] < 0]['Volume'].sum()
        accum_score = green_vol / red_vol if red_vol > 0 else 2.0
        
        has_flow = False
        msg = ""
        bonus = 0.0
        
        # 1️⃣ ERKEN AKÜMÜLASYON (swing öncesi en değerli)
        if 1.1 <= vol_ratio <= 1.4 and accum_score > 1.1:
            bonus = 1.2
            msg = f"🐋 Erken Akümülasyon: Sessiz Para Girişi (+%{(vol_ratio-1)*100:.0f})"
            has_flow = True

        # 2️⃣ GÜÇLÜ MOMENTUM AKIŞI (uyanış)
        elif vol_ratio > 1.4 and accum_score > 1.3:
            bonus = 1.6
            msg = f"💰 Momentum Para Girişi: Hacim Patlaması (+%{(vol_ratio-1)*100:.0f})"
            has_flow = True

        # 3️⃣ NÖTR / DAĞINIK HACİM (cezasız)
        else:
            msg = ""

        return {'has_flow': has_flow, 'bonus': bonus, 'msg': msg}
    except:
        return {'has_flow': False, 'bonus': 0.0, 'msg': ""}

# 5. ICHIMOKU CLOUD ANALİZİ (SWING ODAKLI)
def calculate_ichimoku(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    high9 = df['High'].rolling(9).max()
    low9 = df['Low'].rolling(9).min()
    df['tenkan'] = (high9 + low9) / 2

    high26 = df['High'].rolling(26).max()
    low26 = df['Low'].rolling(26).min()
    df['kijun'] = (high26 + low26) / 2

    df['span_a'] = ((df['tenkan'] + df['kijun']) / 2).shift(26)

    high52 = df['High'].rolling(52).max()
    low52 = df['Low'].rolling(52).min()
    df['span_b'] = ((high52 + low52) / 2).shift(26)

    df['chikou'] = df['Close'].shift(-26)
    return df


def check_ichimoku_setup(df: pd.DataFrame) -> dict:
    """Ichimoku ile swing continuation / early breakout kontrolü."""
    try:
        last = df.iloc[-1]
        price = last['Close']
        cloud_top = max(last['span_a'], last['span_b'])
        cloud_bottom = min(last['span_a'], last['span_b'])

        # 1️⃣ ERKEN SWING: fiyat buluta temas + Tenkan>Kijun
        if cloud_bottom <= price <= cloud_top and last['tenkan'] > last['kijun']:
            return {
                'valid': True,
                'bonus': 0.8,
                'msg': "🟡 Ichimoku: Bulut İçi Swing Uyanışı (+0.8)"
            }

        # 2️⃣ BULLISH DEVAM: fiyat bulut üstü
        if price > cloud_top:
            if last['tenkan'] > last['kijun']:
                return {
                    'valid': True,
                    'bonus': 1.4,
                    'msg': "✅ Ichimoku: Güçlü Bullish Devam (+1.4)"
                }
            else:
                return {
                    'valid': True,
                    'bonus': 0.6,
                    'msg': "✅ Ichimoku: Bulut Üstü (+0.6)"
                }

        return {'valid': False, 'bonus': 0.0, 'msg': ""}
    except:
        return {'valid': False, 'bonus': 0.0, 'msg': ""}

# 6. VOLUME PROFILE (POC - SWING DESTEK / BREAKOUT)
def check_volume_profile(df: pd.DataFrame) -> dict:
    """POC'a göre swing destek / breakout kontekstini değerlendirir."""
    try:
        data = df.tail(30)
        price_min = data['Low'].min()
        price_max = data['High'].max()
        bins = np.linspace(price_min, price_max, 20)

        vol_dist = np.zeros(19)
        for i in range(len(data)):
            row = data.iloc[i]
            for b in range(19):
                if bins[b] <= row['Close'] < bins[b+1]:
                    vol_dist[b] += row['Volume']
                    break

        max_vol_idx = vol_dist.argmax()
        poc_price = (bins[max_vol_idx] + bins[max_vol_idx+1]) / 2
        current = df['Close'].iloc[-1]

        dist_pct = (current - poc_price) / poc_price

        # 1️⃣ POC ÜZERİNDE + YAKIN → swing desteği
        if current > poc_price and abs(dist_pct) < 0.04:
            return {
                'valid': True,
                'bonus': 1.2,
                'msg': f"🟢 VP: POC Üzeri Destek (+{dist_pct*100:.1f}%)"
            }

        # 2️⃣ POC ÜZERİ AMA UZAK → momentum devam
        if current > poc_price:
            return {
                'valid': True,
                'bonus': 0.5,
                'msg': f"📈 VP: POC Üzeri Momentum (+{dist_pct*100:.1f}%)"
            }

        # 3️⃣ POC ALTINDA → uyarı ama veto değil
        return {
            'valid': False,
            'bonus': 0.0,
            'msg': "⚠️ VP: POC Altı (Direnç Bölgesi)"
        }

    except:
        return {'valid': False, 'bonus': 0.0, 'msg': ""}


# 7. YASAL RİSK KONTROLÜ (Web Scraping)
async def check_legal_risk_live(ticker: str) -> dict:
    """Yahoo Finance press releases üzerinden dava/soruşturma tarar."""
    keywords = ['class action', 'lawsuit', 'sec investigation', 'fraud', 'shareholder rights']
    url = f"https://finance.yahoo.com/quote/{ticker}/press-releases"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=5) as resp:
                if resp.status == 200:
                    text = await resp.text()
                    text_lower = text.lower()
                    
                    for kw in keywords:
                        if kw in text_lower:
                            # Yakın tarihli mi diye basit bir kontrol (ilk 2000 karakterde mi)
                            if text_lower.find(kw) < 5000: 
                                return {'has_risk': True, 'penalty': 5.0, 'msg': f"⚠️ YASAL RİSK: '{kw}' tespit edildi!"}
    except:
        pass
    return {'has_risk': False, 'penalty': 0.0, 'msg': ""}
    
async def apply_atmaca_filters(ticker: str) -> dict | None:
    """
    ATMACA Master Stratejisi — PRO+ Sürüm (v106 KARTAL ALPHA)
    
    🎯 YENİ FELSEFE:
    - ELEME yapma, PUANLA ve sırala
    - Her hisse bir momentum skoruna sahip olmalı
    - Sadece gerçek kırılganlar elenir (earnings riski, market crash, ölü para)
    - Geri kalan herşey puanlama sistemiyle değerlendirilir
    """
    try:
        ticker = ticker.strip().upper()
        
        # ========================================
        # HARD FILTERS (Gerçek Riskler - SADECE BUNLAR ELER)
        # ========================================
        
        # 🔥 1. EARNINGS RİSKİ (Hayati Güvenlik)
        if not await asyncio.to_thread(is_earnings_safe_for_swing, ticker):
            logging.info(f"🚫 {ticker}: Yaklaşan earnings riski -> ELEME")
            return None

        # 🔥 2. MARKET CRASH KORUMASI
        if MARKET_STATUS.get("regime") == "WEAK":
            logging.info(f"🚫 {ticker}: Market WEAK rejiminde -> ELEME")
            return None

        # ========================================
        # VERİ TOPLAMA (Paralel I/O - Katman 2 Hafifleştirildi)
        # ========================================
        stock = yf.Ticker(ticker)
        # YF BAN KORUMASI: 200 hisse için ağır olan info() çağrısını siliyoruz.
        # Temel veriler Katman 3'te (Sadece en iyi 40 hisse için) çekilecek.
        info = {}

        # 🔥 3. EARNINGS TIMESTAMP DOUBLE-CHECK
        import time
        current_ts = time.time()
        earnings_ts = info.get("earningsTimestamp", None)
        earnings_start = info.get("earningsTimestampStart", None)
        check_ts = earnings_ts if earnings_ts else earnings_start
        
        if check_ts:
            seconds_to_earnings = check_ts - current_ts
            if 0 < seconds_to_earnings < 864000:  # 7 gün
                logging.info(f"🚫 {ticker}: Yaklaşan Bilanço ({seconds_to_earnings/3600:.1f}h) -> ELEME")
                return None

        # ========================================
        # TEMEL VERİLER
        # ========================================
        # fast_info rate limitlere karşı daha dayanıklıdır
        try:
            fast_info = await asyncio.to_thread(lambda: stock.fast_info)
            market_cap = fast_info.get("marketCap", info.get("marketCap", 0))
        except:
            market_cap = info.get("marketCap", 0) or 0

        avg_volume_10d = info.get("averageVolume10days", 0) or 0
        beta = info.get("beta", 0.0) or 0.0
        short_float = info.get("shortPercentOfFloat", 0.0) or 0.0
        sector_name = info.get("sector", "Unknown")

        # ========================================
        # FİYAT VERİSİ (Ardışık Fetch - YF Ban Koruması)
        # ========================================
        df_1d = await asyncio.to_thread(get_stock_data, ticker, "1d")
        
        # Eğer 1D verisi başarıyla çekildiyse, kısa bir süre bekleyip 1H verisini çek
        if df_1d is not None and len(df_1d) >= 50:
            await asyncio.sleep(1.0) # YF'ye 1 saniye nefes ver
            df_1h = await asyncio.to_thread(get_stock_data, ticker, "1h")
        else:
            df_1h = None
            
        # 🔥 5. VERİ BÜTÜNLÜĞÜ KONTROLÜ
        if df_1d is None or len(df_1d) < 50:
            logging.warning(f"🚫 {ticker}: 1D veri yetersiz -> ELEME")
            return None

        # 🔥 4. LİKİDİTE BARAJI (Minimum Oynanabilirlik) - KARTAL ALPHA DÜZELTMESİ
        # Eğer Yahoo Finance info() rate limit yerse avg_volume_10d = 0 gelir.
        # Bu yüzden hacmi grafikten (df_1d) kendimiz hesaplıyoruz!
        calc_avg_vol_10d = float(df_1d["Volume"].tail(10).mean())
        
        # Eğer YF veriyi gizlediyse kendi hesapladığımızı kullan
        if avg_volume_10d == 0:
            avg_volume_10d = calc_avg_vol_10d

        if calc_avg_vol_10d < ATMACA_MIN_AVG_VOLUME:
            logging.info(f"🚫 {ticker}: Hacim yetersiz (Vol: {calc_avg_vol_10d:.0f}) -> ELEME")
            return None
            
        # Sadece market cap verisi başarıyla çekilmişse (0 değilse) ve sınırın altındaysa ele
        # (Sıfır veya None geldiyse, rate limit yemiş demektir, hisseyi yakma devam et)
        if market_cap is not None and market_cap > 0 and market_cap < ATMACA_MIN_MARKET_CAP:
            logging.info(f"🚫 {ticker}: Market Cap yetersiz (MCap: {market_cap}) -> ELEME")
            return None

        # ========================================
        # SKOR SİSTEMİ BAŞLANGICI
        # ========================================
        close_1d = df_1d["Close"]
        volume_1d = df_1d["Volume"]
        high_1d = df_1d["High"]
        low_1d = df_1d["Low"]
        current_price = float(close_1d.iloc[-1])
        
        score = 0.0  # Momentum skoru (negatif olabilir)
        details: list[str] = []

        # ✅ Likidite/Yapısal Koşullar Tamam
        details.append("✅ EVREN: Likidite/Yapısal Koşullar Tamam")
        score += 1.0

        # ========================================
        # SEKTÖR ROTASYON ANALİZİ
        # ========================================
        sec_perf = globals().get("SECTOR_PERFORMANCE", {}).get(sector_name, 0.0)

        if sec_perf > 2.0:
            score += 1.5
            details.append(f"🔥 Sektör: {sector_name} HOT (Son 5G: +{sec_perf:.1f}%)")
        elif sec_perf > 0:
            score += 0.3
            details.append(f"📊 Sektör: {sector_name} Pozitif (+{sec_perf:.1f}%)")
        elif sec_perf < -2.0:
            score -= 0.8
            details.append(f"🥶 Sektör: {sector_name} SOĞUK ({sec_perf:.1f}%)")
        else:
            score -= 0.2
            details.append(f"➖ Sektör: {sector_name} Nötr ({sec_perf:.1f}%)")

        # ========================================
        # RELATIVE STRENGTH (Index Karşısında)
        # ========================================
        rs_slope = 0.0
        rs_label = "N/A"

        index_close = get_index_close_series(INDEX_BENCHMARK)
        if index_close is not None:
            idx_aligned = index_close.reindex(close_1d.index, method="ffill").dropna()
            common_idx = close_1d.index.intersection(idx_aligned.index)

            if len(common_idx) >= 20:
                rs_series = (close_1d.loc[common_idx] / idx_aligned.loc[common_idx])
                rs_tail = rs_series.tail(min(RS_LOOKBACK, len(rs_series)))
                try:
                    rs_slope = np.polyfit(range(len(rs_tail)), rs_tail.values, 1)[0]
                except:
                    rs_slope = 0.0

                if rs_slope > 0.0005:
                    score += 1.2
                    rs_label = "Güçlü Outperform"
                    details.append(f"💪 RS: {INDEX_BENCHMARK} üstünde (Güçlü)")
                elif rs_slope > 0:
                    score += 0.5
                    rs_label = "Hafif Outperform"
                    details.append(f"📈 RS: {INDEX_BENCHMARK} üstünde (Hafif)")
                elif rs_slope > -0.0005:
                    score -= 0.3
                    rs_label = "Nötr"
                    details.append(f"➖ RS: {INDEX_BENCHMARK} ile paralel")
                else:
                    score -= 0.8
                    rs_label = "Underperform"
                    details.append(f"⚠️ RS: {INDEX_BENCHMARK} altında (Zayıf)")

        # ========================================
        # 1D TREND ANALİZİ (EMA Sistemi)
        # ========================================
        ema20_1d = EMAIndicator(close_1d, 20).ema_indicator()
        ema50_1d = EMAIndicator(close_1d, 50).ema_indicator()
        ema200_1d = EMAIndicator(close_1d, 200).ema_indicator()

        last_ema20 = float(ema20_1d.iloc[-1])
        last_ema50 = float(ema50_1d.iloc[-1])
        last_ema200 = float(ema200_1d.iloc[-1])

        trend_durumu_1d = "N/A"

        # 🏆 MAKRO TREND (En Güçlü)
        if current_price > last_ema50 and last_ema50 > last_ema200:
            score += 3.5
            details.append("🏆 1D TREND: Makro Bullish (P > EMA50 > EMA200)")
            trend_durumu_1d = "Makro Bullish"
            
            # Bonus: Geniş EMA spread
            try:
                ema_spread = (last_ema50 - last_ema200) / last_ema200 if last_ema200 > 0 else 0.0
                if ema_spread > 0.03:
                    score += 0.4
                    details.append("🔥 EMA50-200 Spread Geniş (Sağlam Trend)")
            except:
                pass

        # 📈 YÜKSELİŞ SIRASI (İyi)
        elif current_price > last_ema20 and last_ema20 > last_ema50 and last_ema50 > last_ema200:
            score += 2.2
            details.append("📈 1D TREND: Yükseliş Sırası (EMA20>50>200)")
            trend_durumu_1d = "Yükseliş"

        # 🟢 EMA200 ÜSTÜ (Kabul Edilebilir)
        elif current_price > last_ema200:
            score += 0.8
            details.append("🟢 1D TREND: EMA200 Üstü (Uzun Vadeli Pozitif)")
            trend_durumu_1d = "EMA200 Üstü"

        # 🟡 EMA50 ÜSTÜ (Marjinal)
        elif current_price > last_ema50:
            score += 0.3
            details.append("🟡 1D TREND: EMA50 Üstü (Marjinal Pozitif)")
            trend_durumu_1d = "EMA50 Üstü"

        # 🔴 DOWNTREND (Ceza)
        else:
            score -= 1.5
            details.append("🔴 1D TREND: Downtrend (Tüm EMA'lar altında)")
            trend_durumu_1d = "Downtrend"

        # ========================================
        # EMA20 EĞİMİ (Trend Dinamiği)
        # ========================================
        cond_ema20_slope_positive = calculate_ema_slope(ema20_1d, periods=10)
        
        if cond_ema20_slope_positive:
            score += 1.0
            details.append("📈 EMA20: Pozitif eğim (Trend yukarı)")
        else:
            score -= 0.4
            details.append("📉 EMA20: Negatif/Yatay eğim")

        # ========================================
        # ADX MOMENTUM ANALİZİ
        # ========================================
        try:
            adx_series_1d = ADXIndicator(high_1d, low_1d, close_1d, 14).adx()
            adx_1d = float(adx_series_1d.iloc[-1])
        except:
            adx_series_1d = pd.Series(index=df_1d.index, data=0.0)
            adx_1d = 0.0

        if adx_1d >= 30:
            score += 1.5
            details.append(f"🔥 ADX: Çok Güçlü Trend ({adx_1d:.1f})")
        elif adx_1d >= 25:
            score += 1.0
            details.append(f"💪 ADX: Güçlü Trend ({adx_1d:.1f})")
        elif adx_1d >= 20:
            score += 0.5
            details.append(f"📊 ADX: Orta Güç ({adx_1d:.1f})")
        elif adx_1d >= 15:
            score += 0.1
            details.append(f"🟡 ADX: Zayıf Trend ({adx_1d:.1f})")
        else:
            score -= 0.5
            details.append(f"⚠️ ADX: Çok Zayıf ({adx_1d:.1f})")

        # ADX Momentum (Eğim)
        try:
            adx_slope = adx_series_1d.diff().tail(5).mean()
            if adx_slope > 0.5:
                score += 0.4
                details.append("🚀 ADX Momentum: Hızlanıyor")
            elif adx_slope < -0.5:
                score -= 0.3
                details.append("🐌 ADX Momentum: Yavaşlıyor")
        except:
            pass

        # 🔥 DEAD MONEY KORUMASI (Tek Hard Filter)
        if len(ema20_1d) >= 10:
            ema20_slope_numeric = (ema20_1d.iloc[-1] - ema20_1d.iloc[-10]) / ema20_1d.iloc[-10] if ema20_1d.iloc[-10] > 0 else 0.0
        else:
            ema20_slope_numeric = 0.0
        
        is_ema_flat = abs(ema20_slope_numeric) < 0.008
        if is_ema_flat and adx_1d < 15:
            logging.info(f"🚫 {ticker}: DEAD MONEY (EMA yatay + ADX<15) -> ELEME")
            return None

        # ========================================
        # 🥈 KATMAN 2: AKİŞ & MOMENTUM FİLTRESİ (Dinamik)
        # RVOL = Son 5 Günlük Ortalama Hacim / Son 30 Günlük Ortalama Hacim
        # Şartlar: 1D Close > EMA20 > EMA50, ADX > 12,
        #          Son 10 günde min 5 yeşil mum, CMF > 0
        # ========================================
        layer2_pass = True
        layer2_reasons = []

        # RVOL hesabı (5g/30g)
        try:
            vol_5g_avg = float(volume_1d.tail(5).mean()) if len(volume_1d) >= 5 else 0.0
            vol_30g_avg = float(volume_1d.tail(30).mean()) if len(volume_1d) >= 30 else vol_5g_avg
            rvol_5_30 = (vol_5g_avg / vol_30g_avg) if vol_30g_avg > 0 else 0.0
        except:
            rvol_5_30 = 0.0

        if rvol_5_30 < 1.20:
            layer2_pass = False
            layer2_reasons.append(f"RVOL(5g/30g)={rvol_5_30:.2f} < 1.20")

        
        # 1D Close > EMA50 ve EMA20 > EMA50 (Fiyatın EMA20 altına sarkmasına yani Pullback'e izin ver)
        try:
            ema20_val = float(ema20_1d.iloc[-1])
            ema50_val = float(ema50_1d.iloc[-1])
            if not np.isnan(ema20_val) and not np.isnan(ema50_val):
                # Ana trend bozulmadığı (EMA20 > EMA50) ve fiyat 50 günlük ortalamanın üstünde olduğu sürece kabul et
                if not (current_price > ema50_val and ema20_val > ema50_val):
                    layer2_pass = False
                    layer2_reasons.append(f"Trend kırık (P:{current_price:.2f} EMA50:{ema50_val:.2f})")
        except:
            pass # Veri okunamadıysa es geç

        # ADX > 12 (Veri sıfırsa/hesaplanamadıysa tolere et)
        if adx_1d > 0 and adx_1d < 12:
            layer2_pass = False
            layer2_reasons.append(f"ADX={adx_1d:.1f} < 12")

        # Son 10 günde en az 5 yeşil mum
        try:
            last10 = df_1d.tail(10)
            green_candles = int((last10['Close'] > last10['Open']).sum())
        except:
            green_candles = 0
        if green_candles < 5:
            layer2_pass = False
            layer2_reasons.append(f"Yeşil mum={green_candles} < 5 (son 10 gün)")

        # CMF (Chaikin Money Flow) > 0
        # CMF = sum(MF_Volume, n) / sum(Volume, n)
        # Money Flow Multiplier = ((Close - Low) - (High - Close)) / (High - Low)
        try:
            cmf_period = 20
            df_cmf = df_1d.tail(cmf_period)
            hl_range = df_cmf['High'] - df_cmf['Low']
            hl_range = hl_range.replace(0, np.nan)
            mfm = ((df_cmf['Close'] - df_cmf['Low']) - (df_cmf['High'] - df_cmf['Close'])) / hl_range
            mfv = mfm * df_cmf['Volume']
            cmf_val = float(mfv.sum() / df_cmf['Volume'].sum()) if df_cmf['Volume'].sum() > 0 else 0.0
        except:
            cmf_val = 0.0

        # CMF (Veri hesaplanamadıysa 0.0 gelir, haksız eleme yapmasını engelle)
        if cmf_val != 0.0 and cmf_val <= 0:
            layer2_pass = False
            layer2_reasons.append(f"CMF={cmf_val:.3f} <= 0 (para çıkışı)")
            
        if not layer2_pass:
            logging.info(f"🚫 {ticker}: Katman 2 Filtre → ELEME ({'; '.join(layer2_reasons)})")
            return None

        # Katman 2 geçti — bonus puan ekle
        score += 1.5
        details.append(f"✅ KATMAN 2: Akış & Momentum Onaylı (RVOL:{rvol_5_30:.2f}x | Yeşil:{green_candles}/10 | CMF:{cmf_val:.3f})")
        if rvol_5_30 >= 1.5:
            score += 0.5
            details.append(f"🔥 RVOL(5g/30g) Agresif: {rvol_5_30:.2f}x")

        # ========================================
        # VOLATİLİTE REJİMİ (ATR + Bollinger)
        # ========================================
        try:
            atr_1d_series = AverageTrueRange(high_1d, low_1d, close_1d, ATR_PERIOD).average_true_range()
            atr_1d = float(atr_1d_series.iloc[-1])
        except:
            atr_1d = 0.0

        atr_pct_1d = (atr_1d / current_price) if current_price > 0 else 0.0

        # 🔥 GERÇEK DEAD MONEY & KAOS KORUMASI (Kritik Eleme)
        if atr_pct_1d > 0:
            if atr_pct_1d < 0.015:
                logging.info(f"🚫 {ticker}: Volatilite ölü (ATR% {atr_pct_1d*100:.2f} < %1.5) -> ELEME")
                return None
            if atr_pct_1d > 0.080:
                logging.info(f"🚫 {ticker}: Volatilite çok yüksek/Kaos (ATR% {atr_pct_1d*100:.2f} > %8.0) -> ELEME")
                return None
            
        # Bollinger Width
        try:
            bb_1d = BollingerBands(close_1d, 20, 2)
            bb_width_1d = (
                (bb_1d.bollinger_hband().iloc[-1] - bb_1d.bollinger_lband().iloc[-1])
                / current_price if current_price > 0 else 0.0
            )
        except:
            bb_width_1d = 0.0

        # Volatilite Rejim Puanlama
        if atr_pct_1d < 0.020 and bb_width_1d < 0.045:
            score += 0.8
            details.append("🟦 VOL Rejim: LOW-VOL Sıkışma (Breakout Adayı)")
        elif 0.020 <= atr_pct_1d < 0.040:
            score += 1.0
            details.append("🟩 VOL Rejim: Erken Swing / Normal")
        elif 0.040 <= atr_pct_1d <= 0.080:
            score += 1.5
            details.append("⚡ VOL Rejim: Swing İdeal Bölgesi")
        elif 0.080 < atr_pct_1d <= 0.10:
            score += 0.3
            details.append("🟨 VOL Rejim: Yüksek (Dikkatli)")
        else:
            score -= 0.5
            details.append("🟥 VOL Rejim: Extreme (News/Fake Riski)")

        # ========================================
        # RSI MOMENTUM (Eleme Değil, Puanlama)
        # ========================================
        try:
            rsi_1d_series = RSIIndicator(close_1d, 14).rsi()
            rsi_1d_val = float(rsi_1d_series.iloc[-1])
        except:
            rsi_1d_val = 50.0

        if 40 <= rsi_1d_val <= 55:
            score += 1.5
            details.append(f"🌀 RSI: Momentum Başlangıcı ({rsi_1d_val:.1f})")
        elif 55 < rsi_1d_val <= 70:
            score += 0.8
            details.append(f"📈 RSI: Momentum Devamı ({rsi_1d_val:.1f})")
        elif 70 < rsi_1d_val <= 82:
            score += 0.3
            details.append(f"⚠️ RSI: Aşırıya Yakın ({rsi_1d_val:.1f})")
        elif rsi_1d_val < 35:
            score -= 0.8
            details.append(f"❄️ RSI: Zayıf Momentum ({rsi_1d_val:.1f})")
        elif rsi_1d_val > 82:
            score -= 0.5
            details.append(f"🔴 RSI: Aşırı Alım ({rsi_1d_val:.1f})")
        else:
            score += 0.1
            details.append(f"➖ RSI: Nötr ({rsi_1d_val:.1f})")

        # RSI Divergence (Negatif Sinyal)
        try:
            if len(close_1d) > 5:
                p_chg = close_1d.iloc[-1] > close_1d.iloc[-5]
                r_chg = rsi_1d_series.iloc[-1] < rsi_1d_series.iloc[-5]
                if p_chg and r_chg:
                    score -= 1.0
                    details.append("⚠️ RSI Divergence: Negatif (Fiyat↑ RSI↓)")
        except:
            pass

        # ========================================
        # V112 YORULMA SENSÖRÜ (Exhaustion Check)
        # ========================================
        is_exhausted = False

        try:
            # ROC (Rate of Change) son 3 gün
            if len(close_1d) >= 4:
                roc_3d = (float(close_1d.iloc[-1]) - float(close_1d.iloc[-4])) / float(close_1d.iloc[-4]) * 100
            else:
                roc_3d = 0.0

            # Yorulma koşulları:
            # 1) Son 3 günde %12+ yükseliş (parabolik)
            # 2) RSI > 75 (aşırı alım)
            exhaustion_by_roc = roc_3d > 12.0
            exhaustion_by_rsi = rsi_1d_val > 75.0

            if exhaustion_by_roc or exhaustion_by_rsi:
                is_exhausted = True
                reasons = []
                if exhaustion_by_roc:
                    reasons.append(f"3G ROC: +%{roc_3d:.1f}")
                if exhaustion_by_rsi:
                    reasons.append(f"RSI: {rsi_1d_val:.1f}")
                score -= 2.0  # Puan düşürme (listeye girse de alt sıralara)
                details.append(f"🔴 EXHAUSTED (Yorgun Hisse): {', '.join(reasons)} → TP Daraltılacak")
                logging.info(f"⚠️ {ticker}: Exhausted ({', '.join(reasons)})")
            elif 45 <= rsi_1d_val <= 55:
                # Erken Uyanış Bonusu: En tatlı giriş bölgesi
                score += 1.0
                details.append(f"🌅 Erken Uyanış: RSI {rsi_1d_val:.1f} (Optimal Giriş Bölgesi)")

        except Exception:
            is_exhausted = False

        # ========================================
        # 1D ÖZET
        # ========================================
        try:
            d1_summary = {
                "Trend Durumu": trend_durumu_1d,
                "EMA20 Eğimi": "Pozitif" if cond_ema20_slope_positive else "Negatif/Yatay",
                "RSI(14)": f"{rsi_1d_val:.1f}",
                "ADX": f"{adx_1d:.1f}",
                "ATR%": f"{atr_pct_1d * 100:.2f}%",
                "BB Width": f"{bb_width_1d * 100:.1f}%",
            }
        except:
            d1_summary = {}

        # ========================================
        # 1H MİKRO / TETİK ANALİZİ (V112: 4H yerine 1H)
        # ========================================
        h1_summary = {"Durum": "Yetersiz Veri"}

        if df_1h is not None and len(df_1h) >= 10:
            close_1h = df_1h["Close"]
            high_1h = df_1h["High"]
            low_1h = df_1h["Low"]
            volume_1h = df_1h["Volume"]

            ema20_1h = EMAIndicator(close_1h, 20).ema_indicator()
            ema50_1h = EMAIndicator(close_1h, 50).ema_indicator()

            try:
                rsi_1h = float(RSIIndicator(close_1h, 14).rsi().iloc[-1])
            except:
                rsi_1h = 50.0
            
            try:
                adx_1h = float(ADXIndicator(high_1h, low_1h, close_1h, 14).adx().iloc[-1])
            except:
                adx_1h = 0.0
            
            try:
                atr_1h_series = AverageTrueRange(high_1h, low_1h, close_1h, ATR_PERIOD).average_true_range()
                atr_1h = float(atr_1h_series.iloc[-1])
            except:
                atr_1h = 0.0
            
            atr_pct_1h = (atr_1h / float(close_1h.iloc[-1])) if float(close_1h.iloc[-1]) > 0 else 0.0

            # 1H RVOL
            try:
                vol_ma_1h = volume_1h.rolling(window=10).mean()
                current_vol_1h = float(volume_1h.iloc[-1])
                avg_vol_1h = float(vol_ma_1h.iloc[-1]) if len(vol_ma_1h) > 0 else 0
                rvol_1h = (current_vol_1h / avg_vol_1h) if avg_vol_1h > 0 else 0.0
            except:
                rvol_1h = 0.0

            rvol_durumu = "Normal"
            if rvol_1h > 3.0:
                rvol_durumu = "🔥 AŞIRI YOĞUN"
            elif rvol_1h > 1.5:
                rvol_durumu = "✅ Yüksek Aktivite"
            elif rvol_1h < 0.7:
                rvol_durumu = "❄️ Hacimsiz"

            # 1H ADX Puanlama
            if adx_1h >= 30:
                score += 2.5
                details.append(f"🔥 1H ADX: Çok Güçlü ({adx_1h:.1f})")
            elif adx_1h >= 20:
                score += 1.5
                details.append(f"💪 1H ADX: Güçlü Momentum ({adx_1h:.1f})")
            elif adx_1h >= 14:
                score += 0.6
                details.append(f"🟡 1H ADX: Erken Kırılım ({adx_1h:.1f})")
            else:
                score -= 0.8
                details.append(f"⚠️ 1H ADX: Zayıf ({adx_1h:.1f})")

            # 1H EMA Yapı ve Lastik Bant (Rubber Band) Kontrolü
            close_now_1h = float(close_1h.iloc[-1])
            ema20_now_1h = float(ema20_1h.iloc[-1])
            ema50_now_1h = float(ema50_1h.iloc[-1])
            
            # Fiyat 1H EMA20'den %5'ten fazla uzaklaştıysa kesin düzeltme yer
            ema20_distance = (close_now_1h - ema20_now_1h) / ema20_now_1h if ema20_now_1h > 0 else 0.0

            if ema20_distance > 0.05:
                score -= 2.0
                details.append(f"🔴 1H YAPI: EMA20'den Çok Uzaklaştı (+%{ema20_distance*100:.1f} FOMO Riski)")
            elif close_now_1h > ema50_now_1h:
                score += 1.2
                details.append("🏗️ 1H Yapı: EMA50 Üstü (Güçlü)")
            elif close_now_1h > ema20_now_1h:
                score += 0.5
                details.append("🟡 1H Yapı: EMA20 Üstü (Erken)")
            else:
                score -= 0.6
                details.append("⚠️ 1H Yapı: EMA Altı (Zayıf)")
                
            # 1H EMA Slope
            cond_ema20_slope_1h = calculate_ema_slope(ema20_1h, periods=5)
            if cond_ema20_slope_1h:
                score += 0.5
                details.append("📈 1H EMA20: Pozitif Eğim")

            # 1H RSI (Geliştirilmiş FOMO & Aşırı Alım Koruması)
            if 45 <= rsi_1h <= 72:
                score += 0.6
                details.append(f"🌀 1H RSI: Optimal Momentum ({rsi_1h:.1f})")
            elif 72 < rsi_1h <= 82:
                score -= 1.0
                details.append(f"⚠️ 1H RSI: Aşırı Alım / Düzeltme Riski ({rsi_1h:.1f})")
            elif rsi_1h > 82:
                score -= 2.5
                details.append(f"🔴 1H RSI: FOMO Zirvesi / Tavan Yapmış ({rsi_1h:.1f})")
            elif rsi_1h < 35:
                score -= 0.5
                details.append(f"❄️ 1H RSI: Zayıf Momentum ({rsi_1h:.1f})")

            # 1H RVOL Puanlama (Agresiften alınan)
            if rvol_1h >= 2.5:
                score += 1.8
                details.append(f"🐳 1H RVOL: Para Girişi ({rvol_1h:.1f}x)")
            elif rvol_1h >= 1.5:
                score += 0.8
                details.append(f"📊 1H RVOL: Yüksek ({rvol_1h:.1f}x)")
            elif rvol_1h < 0.7:
                score -= 0.4
                details.append(f"❄️ 1H RVOL: Hacimsiz ({rvol_1h:.1f}x)")

            # Pivot Higher-Low (1H)
            lows = df_1h["Low"].tail(20)
            pivots = []
            for i in range(2, len(lows) - 2):
                if lows.iloc[i] < lows.iloc[i-1] and lows.iloc[i] < lows.iloc[i+1]:
                    pivots.append(lows.iloc[i])
            
            if len(pivots) >= 2 and pivots[-1] > pivots[-2]:
                score += 0.6
                details.append("🔰 1H Yapı: Pivot Higher-Low")

            if ATR_MIN_PCT_1H <= atr_pct_1h <= ATR_MAX_PCT_1H:
                score += 0.5

            h1_summary = {
                "Durum": "Analiz Edildi",
                "Fiyat/EMA": "EMA50 Üstü" if float(close_1h.iloc[-1]) > float(ema50_1h.iloc[-1]) else "EMA Altı",
                "EMA20 Slope": "Pozitif" if cond_ema20_slope_1h else "Negatif/Yatay",
                "RVOL(1H)": f"{rvol_1h:.1f}x ({rvol_durumu})",
                "RSI(14)": f"{rsi_1h:.1f}",
                "ADX(14)": f"{adx_1h:.1f}",
                "ATR%": f"{atr_pct_1h * 100:.2f}%",
                "Yapı": "Pivot HL" if len(pivots) >= 2 and pivots[-1] > pivots[-2] else "Normal",
            }
        else:
            score -= 1.2
            details.append("⚠️ 1H Veri Yok (Mikro Analiz Eksik)")

        # ========================================
        # V112 ÇİFT ZAMAN DİLİMİ KİLİDİ (Hard MTF Filter)
        # ========================================
        # Kural: 1D VE 1H aynı anda yukarı bakmıyorsa → HİSSE LİSTEYE GİREMEZ
        #   1D Şartı: Fiyat > EMA50 ve Fiyat > EMA200 (Ölü hisseleri engellemek için EMA200 zorunlu)
        #   1H Şartı: Fiyat > EMA50 (Mikro trend onayı)
        # ========================================
        try:
            is_1d_bullish = (
                current_price > last_ema50 and current_price > last_ema200
            ) # Makro trend filtresi: Stabil ve ölü hisseleri engellemek için EMA200 kilidi aktif edildi.

            if df_1h is not None and len(df_1h) >= 10:
                # 1H fiyatı EMA50 altında olsa bile ELEME YAPMA. 
                # Dipten dönüşleri (Pullback) yakalayabilmek için saatlik hard-filter kaldırıldı.
                is_1h_bullish = True
            else:
                # 1H veri yoksa bu filtreyi atla (sadece uyarı ver)
                is_1h_bullish = True
                details.append("⚠️ MTF Kilidi: 1H veri yetersiz (filtre atlandı)")

            if not (is_1d_bullish and is_1h_bullish):
                mtf_reason = []
                if not is_1d_bullish:
                    mtf_reason.append(f"1D trend kırık (P:{current_price:.2f} EMA50:{last_ema50:.2f} EMA200:{last_ema200:.2f})")
                if not is_1h_bullish:
                    mtf_reason.append(f"1H fiyat EMA50 altında")
                logging.info(f"🚫 {ticker}: MTF Kilidi → ELEME ({'; '.join(mtf_reason)})")
                return None

        except Exception as mtf_err:
            logging.debug(f"MTF kilidi hatası ({ticker}): {mtf_err}")

        # ========================================
        # HACİM & OBV ANALİZİ
        # ========================================
        try:
            obv_obj_1d = OnBalanceVolumeIndicator(close_1d, volume_1d)
            obv_1d = obv_obj_1d.on_balance_volume()
            obv_tail = obv_1d.tail(OBV_TREND_DAYS).values
            obv_slope = np.polyfit(range(len(obv_tail)), obv_tail, 1)[0]
        except:
            obv_slope = 0.0

        if obv_slope > 1000:
            score += 1.5
            details.append("✅ OBV: Güçlü Akümülasyon")
        elif obv_slope > 0:
            score += 0.6
            details.append("📈 OBV: Pozitif Trend")
        elif obv_slope < -1000:
            score -= 0.8
            details.append("⚠️ OBV: Dağıtım Riski")
        else:
            score -= 0.2
            details.append("➖ OBV: Nötr/Zayıf")

        # ========================================
        # RVOL ANALİZİ (1D)
        # ========================================
        vol_today = float(volume_1d.iloc[-1])
        vol_ma_1d = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_today
        rvol_today = (vol_today / vol_ma_1d) if vol_ma_1d > 0 else 0.0

        # RVOL 5d ortalama
        rvol_5d_list = []
        for i in range(1, 6):
            if len(volume_1d) > i:
                v_day = float(volume_1d.iloc[-(i+1)])
                v_ma_day = float(volume_1d.iloc[:-i].tail(20).mean()) if len(volume_1d) > (i+20) else v_day
                rvol_5d_list.append((v_day / v_ma_day) if v_ma_day > 0 else 0.0)
        rvol_5d_avg = sum(rvol_5d_list) / len(rvol_5d_list) if rvol_5d_list else 0.0

        close_change_pct = (
            (close_1d.iloc[-1] - close_1d.iloc[-2]) / close_1d.iloc[-2]
            if len(close_1d) > 1 else 0.0
        )

        # 🔥 FAKE SPIKE KORUMASI (Tek Hard Filter)
        if rvol_today > 2.5 and close_change_pct < -0.015:
            logging.info(f"🚫 {ticker}: Fake Spike (RVOL {rvol_today:.2f}x + Dump {close_change_pct*100:.1f}%) -> ELEME")
            return None
        
        # 🔥 KRONİK STABİL/HACİMSİZ KORUMASI (Güçlendirilmiş Hard Filter)
        try:
            price_20d_range = (high_1d.tail(20).max() - low_1d.tail(20).min()) / current_price
            # Son 20 günde fiyat marjı %5'in altındaysa hisse ölüdür, o gün hacim yapsa bile ele.
            if price_20d_range > 0 and price_20d_range < 0.05:
                logging.info(f"🚫 {ticker}: Kronik Stabil Hisse (20G Range: %{price_20d_range*100:.1f} < %5.0) -> ELEME")
                return None
        except Exception:
            pass

        # RVOL Rejim Puanlama
        if 1.2 <= rvol_today <= 1.8 and abs(close_change_pct) < 0.006:
            score += 1.6
            details.append(f"🐋 RVOL Rejim: Sessiz Birikim ({rvol_today:.2f}x)")
        elif rvol_today > 2.0 and close_change_pct > 0.008:
            score += 2.0
            details.append(f"🚀 RVOL Rejim: Swing Uyanışı ({rvol_today:.2f}x)")
        elif rvol_today > 1.5:
            score += 0.8
            details.append(f"📊 RVOL Rejim: Aktif ({rvol_today:.2f}x)")
        elif rvol_today < 0.6 and rvol_5d_avg < 0.7:
            score -= 0.8
            details.append(f"🐢 RVOL Rejim: Kronik Hacimsiz ({rvol_today:.2f}x)")
        else:
            score += 0.2
            details.append(f"➖ RVOL Rejim: Normal ({rvol_today:.2f}x)")

        # ========================================
        # HACİM TRENDİ (5d vs 20d)
        # ========================================
        vol_recent = volume_1d.tail(VOLUME_INCREASE_LOOKBACK)
        vol_avg5 = float(vol_recent.mean()) if len(vol_recent) > 0 else 0.0
        vol_avg20 = float(volume_1d.tail(20).mean()) if len(volume_1d) >= 20 else vol_avg5
        vol_increase_ratio = (vol_avg5 / vol_avg20) if vol_avg20 > 0 else 0.0

        vol_20d = vol_avg20
        vol_5d = vol_avg5

        if vol_increase_ratio > 1.4:
            score += 1.8
            details.append(f"🔥 Hacim Trendi: Sürekli Artış ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio > 1.1:
            score += 1.0
            details.append(f"📈 Hacim Trendi: Erken Artış ({vol_increase_ratio:.2f}x)")
        elif vol_increase_ratio < 0.8:
            score -= 0.6
            details.append(f"📉 Hacim Trendi: Zayıf ({vol_increase_ratio:.2f}x)")
        else:
            score += 0.2
            details.append(f"➖ Hacim Trendi: Stabil ({vol_increase_ratio:.2f}x)")

        # ========================================
        # MARKET REGIME UYUMLULUĞU
        # ========================================
        market_regime = MARKET_STATUS.get("regime", "UNKNOWN")

        try:
            ema50_10d_ago = float(ema50_1d.iloc[-10]) if len(ema50_1d) >= 10 else float(ema50_1d.iloc[-1])
            ema50_slope_check = (
                (float(ema50_1d.iloc[-1]) - ema50_10d_ago) / ema50_10d_ago
                if ema50_10d_ago > 0 else 0.0
            )
        except:
            ema50_slope_check = 0.0

        vol_5d_trend = (vol_5d / vol_20d) if vol_20d > 0 else 1.0

        # EMA50 + Hacim Senkronizasyon Bonusu
        if ema50_slope_check > 0 and vol_5d_trend > 1.1:
            score += 0.8
            details.append("🟢 Trend-Hacim Senkron")

        # Market Regime Filtresi (Puanlama)
        if market_regime == "STRONG":
            if ema50_slope_check > 0:
                score += 0.8
                details.append(f"💎 STRONG Market Uyumu (EMA50↑)")
            else:
                score -= 0.5
                details.append(f"⚠️ STRONG Market ama EMA50 zayıf")
                
            if vol_5d_trend < 0.85:
                score -= 0.6
                details.append(f"⚠️ STRONG Market ama Hacim zayıf ({vol_5d_trend:.2f}x)")

        elif market_regime == "BULLISH":
            if vol_5d_trend >= 0.80:
                score += 0.4
                details.append(f"✅ Bullish Market Uyumu (Vol {vol_5d_trend:.2f}x)")
            else:
                score -= 0.6
                details.append(f"⚠️ Bullish ama Hacim zayıf ({vol_5d_trend:.2f}x)")

        elif market_regime == "CHOPPY":
            if vol_5d_trend >= 0.75 and ema50_slope_check > 0:
                score += 0.8
                details.append(f"✅ Choppy'de Sağlam Sinyal")
            else:
                score -= 0.8
                details.append(f"⚠️ Choppy Market'te Zayıf Yapı")

        # ========================================
        # v112 MODÜLLERİ (Katman 2: Sadece Grafik Bazlı Olanlar)
        # ========================================
        
        # 🏦 SMART MONEY FLOW ANALİZİ (Sadece hacim/fiyat verisiyle çalışır)
        smart_money = analyze_smart_money_flow(df_1d, ticker, info)
        if smart_money['has_smart_flow']:
            score += smart_money['score'] * 0.8
            details.extend(smart_money['details'])

        # 📈 YÜKSELEN HİSSE TESPİTİ (Sadece grafik verisi kullanır)
        rising = detect_rising_stock(df_1d)
        if rising['is_rising']:
            score += rising['score'] * 0.6
            details.extend(rising['details'])

        # ⚠️ YF BAN KORUMASI: Insider, Finansal Sağlık ve Katalizör Tespiti
        # API'yi çok yorduğu için burada çalıştırılmıyor. 
        # Katman 3'te sadece Top 40 hisse için özel olarak tetiklenecek.
        insider = {'has_insider': False, 'score': 0.0, 'details': []}
        fin_health = {'health_score': 0.0, 'details': []}
        catalyst_result = {'has_catalyst': False, 'score': 0.0, 'reasons': []}

        # ========================================
        # TP/SL HESAPLAMA
        # ========================================
        profit_target, stop_loss = calculate_profit_target(
            entry_price=current_price, 
            atr_value=atr_1d, 
            momentum_score=score,
            is_exhausted=is_exhausted,
            beta=beta
        )
        
        risk = max(current_price - stop_loss, 0.0)
        reward = max(profit_target - current_price, 0.0)
        rr_ratio_calc = (reward / risk) if risk > 0 else 0.0
        
        profit_expectation_pct = (reward / current_price) * 100 if current_price > 0 else 0.0
        volume_regime_str = "Expansion" if vol_increase_ratio > 1.4 else "Early" if vol_increase_ratio > 1.1 else "Flat"
        hold_days = estimate_hold_time(
            score, vol_increase_ratio, profit_expectation_pct,
            atr_pct_1d * 100, is_exhausted=is_exhausted
        )
        
        details.append(f"💰 TP/SL: ${profit_target:.2f} / ${stop_loss:.2f} (R/R: {rr_ratio_calc:.2f})")

        # ========================================
        # GİRİŞ TETİKLEYİCİ ANALİZİ
        # ========================================
        entry_trigger = None

        try:
            ema9_now = float(EMAIndicator(close_1d, 9).ema_indicator().iloc[-1])
            ema9_prev = float(EMAIndicator(close_1d, 9).ema_indicator().iloc[-2])
            ema20_now = float(ema20_1d.iloc[-1])
            ema20_prev = float(ema20_1d.iloc[-2])
            ema50_now = float(ema50_1d.iloc[-1])
        except:
            ema9_now = ema9_prev = ema20_now = ema20_prev = ema50_now = 0.0

        ema_cross = ema9_now > ema20_now and ema9_prev <= ema20_prev
        ema_stack = ema9_now > ema20_now > ema50_now

        try:
            bb_width_now = (
                (bb_1d.bollinger_hband().iloc[-1] - bb_1d.bollinger_lband().iloc[-1])
                / current_price if current_price > 0 else 0.0
            )
        except:
            bb_width_now = 0.0

        bb_squeeze = bb_width_now < 0.05
        ema9_slope = (ema9_now - ema9_prev) / ema9_prev if ema9_prev > 0 else 0.0
        micro_volume = rvol_today > 1.2

        # Entry Tetikleyici Puanlama (Genişletilmiş)
        if bb_squeeze and ema_stack and rvol_today > 1.3:
            score += 2.5
            entry_trigger = "BB Sıkışma + EMA Stack + Hacim"
            details.append("💥 ENTRY: Sıkışma → Breakout (Güçlü)")
        elif ema_cross and 1.2 <= rvol_today <= 1.8:
            score += 2.0
            entry_trigger = "EMA9/20 Kesişim + Mikro Hacim"
            details.append("🎯 ENTRY: EMA9/20 Cross + Mikro Hacim")
        elif ema9_slope > 0.003 and bb_squeeze and micro_volume:
            score += 1.6
            entry_trigger = "EMA9 Eğim + Sıkışma + Mikro Hacim"
            details.append("⚡ ENTRY: EMA9 Dinamik Başlangıç")
        elif ema20_now > ema50_now and close_change_pct > 0.006:
            score += 1.2
            entry_trigger = "Trend Devam Swing"
            details.append("↗️ ENTRY: Trend Devamı")
        # v112 YENİ: Rising stock tetikleyicisi
        elif rising.get('is_rising') and rising.get('pattern') in ['Pullback Dönüş', 'Baz Kırılımı', 'İvme Kazanıyor']:
            score += 1.0
            entry_trigger = f"Rising: {rising['pattern']}"
            details.append(f"📈 ENTRY: {rising['pattern']}")
        else:
            score -= 0.3
            details.append("⏳ ENTRY: Henüz tetik yok (izleme)")

        # ========================================
        # R/R RATIO KALİTE KONTROLÜ
        # ========================================
        if entry_trigger:
            required_rr = MIN_RR_RATIO_RELAXED
        else:
            required_rr = MIN_RR_RATIO

        if rr_ratio_calc < required_rr:
            score -= 1.0
            details.append(f"⚠️ R/R Yetersiz ({rr_ratio_calc:.2f} < {required_rr})")

        # ========================================
        # FİNAL SONUÇ (V112 GENİŞLETİLMİŞ)
        # ========================================

        # 5 günlük getiri ivmesi hesapla
        try:
            ret_5g_pct = float(
                (close_1d.iloc[-1] - close_1d.iloc[-6]) / close_1d.iloc[-6] * 100
            ) if len(close_1d) >= 6 else 0.0
        except:
            ret_5g_pct = 0.0

        # Dollar volume (mevcut fiyat * 10 günlük ortalama hacim)
        dollar_volume_val = current_price * avg_volume_10d

        result = {
            "ticker": ticker,
            "score": round(score, 2),
            "df_1d": df_1d,
            "df_1h": df_1h,
            "current_price": current_price,
            "entry_price": current_price,
            "profit_expectation_pct": profit_expectation_pct,
            "hold_days": hold_days,
            "sector": sector_name,
            "market_cap": market_cap,
            "avg_volume": avg_volume_10d,
            "beta": beta,
            "short_float": short_float,
            "atr_pct": round(atr_pct_1d * 100, 2),
            "rsi_1d": round(rsi_1d_val, 1),
            "adx_1d": round(adx_1d, 1),
            "relative_strength": rs_label,
            "profit_target": round(profit_target, 2),
            "stop_loss": round(stop_loss, 2),
            "rr_ratio": round(rr_ratio_calc, 2),
            "entry_trigger": entry_trigger or "Henüz Yok",
            "volume_regime": "Expansion" if vol_increase_ratio > 1.4 else "Early" if vol_increase_ratio > 1.1 else "Flat",
            "rvol_today": round(rvol_today, 2),
            "details": details,
            "d1_summary": d1_summary,
            "h1_summary": h1_summary,
            # v112 Yeni veriler
            "smart_money": smart_money,
            "insider_data": insider,
            "rising_data": rising,
            "financial_health": fin_health,
            "catalyst_data": catalyst_result,
            # V112 Yeni alanlar
            "is_exhausted": is_exhausted,
            # V112 Katman 2 & 3 için yeni alanlar
            "rvol_5_30": round(rvol_5_30, 3),
            "ret_5g_pct": round(ret_5g_pct, 2),
            "dollar_volume": dollar_volume_val,
            "cmf": round(cmf_val, 4),
            "green_candles_10d": green_candles,
            "meta": {
                "1d": d1_summary,
                "1h": h1_summary,
                "volume_regime": volume_regime_str
            }
        }

        exhaust_tag = " [EXHAUSTED]" if is_exhausted else ""
        logging.info(f"✅ {ticker}: V112 Analiz tamamlandı (Skor: {score:.2f}{exhaust_tag})")
        return result

    except Exception as e:
        logging.error(f"🔴 apply_atmaca_filters({ticker}) - Beklenmedik Hata: {str(e)}")
        return None

import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import os
import logging
import yfinance as yf
from datetime import datetime
from zoneinfo import ZoneInfo
from matplotlib.gridspec import GridSpec
from ta.trend import EMAIndicator, MACD
from ta.volatility import BollingerBands, AverageTrueRange
from ta.momentum import RSIIndicator

# Log ayarı
logging.basicConfig(level=logging.INFO)

# ============================================================
# 1. DATABASE & HELPERS
# ============================================================

COMPANY_DATABASE = {
    "AAPL": {"name": "Apple Inc", "exchange": "NASDAQ", "sector": "Technology", "industry": "Consumer Electronics", "cap": "Mega"},
    "MSFT": {"name": "Microsoft Corp", "exchange": "NASDAQ", "sector": "Technology", "industry": "Software", "cap": "Mega"},
    "CAT": {"name": "Caterpillar Inc", "exchange": "NYSE", "sector": "Industrials", "industry": "Industrial Machinery", "cap": "Large"},
    "TSLA": {"name": "Tesla Inc", "exchange": "NASDAQ", "sector": "Consumer Cyclical", "industry": "Automotive", "cap": "Large"},
    "NVDA": {"name": "NVIDIA Corp", "exchange": "NASDAQ", "sector": "Technology", "industry": "Semiconductors", "cap": "Mega"},
}

def get_company_info(ticker: str) -> dict:
    try:
        ticker_upper = ticker.strip().upper()
        if ticker_upper in COMPANY_DATABASE:
            db_data = COMPANY_DATABASE[ticker_upper]
            return {
                'name': db_data['name'], 'exchange': db_data['exchange'],
                'sector': db_data['sector'], 'industry': db_data['industry'],
                'market_cap': f"{db_data['cap']} Cap"
            }
        stock = yf.Ticker(ticker_upper)
        info = stock.info or {}
        return {
            'name': info.get('longName', ticker_upper),
            'exchange': info.get('exchange', 'UNK'),
            'sector': info.get('sector', 'Unknown'),
            'industry': info.get('industry', 'Unknown'),
            'market_cap': 'Unknown'
        }
    except:
        return {'name': ticker, 'exchange': '', 'sector': '', 'industry': '', 'market_cap': ''}

def rsi_color(rsi_val: float) -> str:
    if rsi_val >= 70: return "#FF4444" 
    elif rsi_val >= 60: return "#FFB84D"
    elif rsi_val >= 40: return "#00FF00"
    elif rsi_val >= 30: return "#87CEEB"
    else: return "#FF1744"

def trend_color(value: float, ref: float = 0) -> str:
    return "#00FF00" if value >= ref else "#FF5252"

# ============================================================
# 2. MAIN CHART ENGINE
# ============================================================

def generate_stock_chart(ticker: str, df_1d, df_1h=None, full_name: str = "", candidate_data: dict = None):
    """
    ATMACA DASHBOARD CHART ENGINE (v3.0 - SMART TIMEFRAME & KARTAL EDITION)
    Revizyon: 1H verisi varsa swing detaylarını göstermek için grafiği 4H çizer.
    Performans metriklerini ise her zaman 1D verisinden alır.
    """
    fig = None
    try:
# ---------------------------------------------------------
        # A) GRAFİK VERİ SEÇİMİ (MACRO VIEW)
        # ---------------------------------------------------------
        # Swing trade büyük resim analizi için her zaman 1D kullanılır.
        df = df_1d.copy()  
        use_1h = False
        tf_label = "Timeframe: 1D (Macro View)"
        LOOKBACK = 100

        # MultiIndex sütun temizliği (Yahoo Finance bazen böyle getirir)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        # ---------------------------------------------------------
        # B) İNDİKATÖR HESAPLAMALARI (SEÇİLEN ZAMAN DİLİMİNE GÖRE)
        # ---------------------------------------------------------
        close = df["Close"]
        high = df["High"]
        low = df["Low"]
        opens = df["Open"]
        volume = df["Volume"]
        
        ema20 = EMAIndicator(close, window=20).ema_indicator()
        ema50 = EMAIndicator(close, window=50).ema_indicator()
        ema100 = EMAIndicator(close, window=100).ema_indicator()
        
        bb_obj = BollingerBands(close, window=20, window_dev=2)
        bb_h = bb_obj.bollinger_hband()
        bb_l = bb_obj.bollinger_lband()
        
        rsi = RSIIndicator(close, window=14).rsi()
        atr = AverageTrueRange(high, low, close, window=14).average_true_range()
        macd = MACD(close)
        macd_line = macd.macd()
        signal_line = macd.macd_signal()

        # Destek / Direnç (Grafikteki son 20 muma göre)
        recent_window = 20
        support_level = low.tail(recent_window).min()
        resistance_level = high.tail(recent_window).max()

        # ---------------------------------------------------------
        # C) PERFORMANS METRİKLERİ (HER ZAMAN 1D KULLANILIR)
        # ---------------------------------------------------------
        # Grafik 4H olsa bile "1 Yıllık Değişim" hesaplamak için 1D verisine ihtiyacımız var.
        
        # Güncel fiyatı grafiğin son kapanışından al
        curr_price = float(close.iloc[-1])
        
        # Değişim fonksiyonu (Sadece 1D verisi kullanır)
        def calc_change_1d(days_idx):
            if len(df_1d) > days_idx:
                prev = float(df_1d["Close"].iloc[-days_idx])
                return ((curr_price - prev) / prev) * 100
            return 0.0

        chg_7d = calc_change_1d(6)
        chg_30d = calc_change_1d(22)
        chg_1y = calc_change_1d(252) if len(df_1d) > 252 else calc_change_1d(len(df_1d)-1)

        c_7d = trend_color(chg_7d)
        c_30d = trend_color(chg_30d)
        c_1y = trend_color(chg_1y)
        a_7d = "▲" if chg_7d >= 0 else "▼"
        a_30d = "▲" if chg_30d >= 0 else "▼"
        a_1y = "▲" if chg_1y >= 0 else "▼"

        # Anlık Göstergeler (Grafik verisinden)
        atr_now = atr.iloc[-1]
        atr_pct = (atr_now / curr_price) * 100
        rsi_now = rsi.iloc[-1]
        
        vol_now = volume.iloc[-1]
        vol_ma = volume.rolling(20).mean().iloc[-1]
        rvol = vol_now / vol_ma if vol_ma > 0 else 0
        vol_tag = f"RVOL {rvol:.1f}x" + (" 💥" if rvol > 1.8 else "")

        # ---------------------------------------------------------
        # D) PLOT DATA & GAPLESS INDEXING
        # ---------------------------------------------------------
        df_plot = df.tail(LOOKBACK)
        
        # GAPLESS LOGIC: Tarih yerine 0,1,2... integer dizisi
        x_vals = np.arange(len(df_plot)) 
        
        # Verileri kes
        o_plot = opens.tail(LOOKBACK).values
        h_plot = high.tail(LOOKBACK).values
        l_plot = low.tail(LOOKBACK).values
        c_plot = close.tail(LOOKBACK).values
        v_plot = volume.tail(LOOKBACK).values
        
        ema20_p = ema20.tail(LOOKBACK).values
        ema50_p = ema50.tail(LOOKBACK).values
        ema100_p = ema100.tail(LOOKBACK).values
        bb_h_p = bb_h.tail(LOOKBACK).values
        bb_l_p = bb_l.tail(LOOKBACK).values
        
        rsi_p = rsi.tail(LOOKBACK).values
        macd_p = macd_line.tail(LOOKBACK).values
        sig_p = signal_line.tail(LOOKBACK).values
        
        # Tarih Stringleri (Bugünün Tarihi)
        now_ny = datetime.now(ZoneInfo("America/New_York"))
        date_str = now_ny.strftime('%Y-%m-%d')
        time_str = now_ny.strftime('%H:%M NY')

        # ---------------------------------------------------------
        # E) LAYOUT & CANVAS
        # ---------------------------------------------------------
        plt.style.use("dark_background")
        plt.rcParams["font.family"] = "DejaVu Sans"

        fig = plt.figure(figsize=(28, 18))
        
        gs = GridSpec(4, 2, figure=fig, 
                      width_ratios=[1.0, 4], 
                      height_ratios=[4, 1, 1, 1],
                      left=0.02, right=0.98, top=0.88, bottom=0.05, wspace=0.1, hspace=0.1)

        ax_info = fig.add_subplot(gs[:, 0])      
        ax_price = fig.add_subplot(gs[0, 1])     
        ax_vol = fig.add_subplot(gs[1, 1], sharex=ax_price)
        ax_rsi = fig.add_subplot(gs[2, 1], sharex=ax_price)
        ax_macd = fig.add_subplot(gs[3, 1], sharex=ax_price)
        ax_info.axis("off")

        # ---------------------------------------------------------
        # F) HEADER & SOL PANEL
        # ---------------------------------------------------------
        company_info = get_company_info(ticker)
        header_title = f"{ticker}  •  {company_info['name']}  •  {company_info['exchange']}"
        
        fig.text(0.70, 0.94, header_title, 
                 fontsize=52, fontweight="bold", 
                 color="#00B0FF", ha="center", va="top", 
                 family='monospace')

        info_lines = [
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("DATE", f"📅 {date_str}"),
            ("TIME", f"🕒 {time_str}"), 
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("PRICE_LBL", "CURRENT PRICE"),
            ("SPACER", ""), 
            ("PRICE", f"${curr_price:,.2f}"),
            ("HEADER_MAIN", ""),
            ("SUBHEAD", "📊 PERFORMANCE"),
            ("CHG", f"7D:   {a_7d} %{abs(chg_7d):.1f}", c_7d),
            ("CHG", f"30D:  {a_30d} %{abs(chg_30d):.1f}", c_30d),
            ("CHG", f"1Y:   {a_1y} %{abs(chg_1y):.1f}", c_1y),
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("SUBHEAD", "📈 INDICATORS"),
            ("RSI_LEVEL", f"RSI(14): {rsi_now:.1f}", rsi_color(rsi_now)),
            ("ATR", f"ATR: {atr_now:.2f}"),
            ("VOL", f"{vol_tag}"),
            ("HEADER_MAIN", "━━━━━━━━━━━━━━"),
            ("SUBHEAD", "📐 MOVING AVG"),
            ("LEVEL", f"EMA 20: ${ema20_p[-1]:,.2f}"),
            ("LEVEL", f"EMA 50: ${ema50_p[-1]:,.2f}"),
            ("LEVEL", f"EMA 100: ${ema100_p[-1]:,.2f}"),
        ]

        # Text Rendering Loop
        y = 0.95
        bright_blue = "#00B0FF"
        
        for item in info_lines:
            tag = item[0]
            text = item[1]
            color = item[2] if len(item) > 2 else "white"
            
            if tag == "HEADER_MAIN":
                ax_info.text(0.02, y, text, fontsize=18, color="#444444", fontweight="bold"); y -= 0.025
            elif tag == "DATE":
                ax_info.text(0.02, y, text, fontsize=26, fontweight="bold", color="#FFFFFF"); y -= 0.045
            elif tag == "TIME":
                ax_info.text(0.02, y, text, fontsize=20, color="#AAAAAA"); y -= 0.045
            elif tag == "PRICE_LBL":
                ax_info.text(0.02, y, text, fontsize=22, color="#888888", fontweight="bold", style='italic'); y -= 0.020
            elif tag == "SPACER":
                y -= 0.030 
            elif tag == "PRICE":
                ax_info.text(0.02, y, text, fontsize=56, fontweight="bold", color="#FFFFFF", family='monospace'); y -= 0.080
            elif tag == "SUBHEAD":
                ax_info.text(0.02, y, text, fontsize=32, fontweight="bold", color=bright_blue); y -= 0.050
            elif tag in ["RSI_LEVEL", "CHG", "LEVEL", "ATR", "VOL"]:
                ax_info.text(0.02, y, text, fontsize=26, fontweight="bold", color=color, family='monospace'); y -= 0.045
            else:
                ax_info.text(0.02, y, text, fontsize=24, color=color); y -= 0.045

        # FOOTER (Kartal Markası)
        ax_info.text(0.02, 0.045, "Created by", fontsize=18, color=bright_blue, alpha=0.8, style='italic')
        ax_info.text(0.02, 0.015, "AFK DaSYS", fontsize=42, fontweight="bold", color=bright_blue, family='monospace')

        # ---------------------------------------------------------
        # G) MAIN PRICE CHART
        # ---------------------------------------------------------
        up = c_plot >= o_plot
        down = c_plot < o_plot
        col_up = "#00E676"
        col_down = "#FF5252"
        
        ax_price.vlines(x_vals, l_plot, h_plot, color="white", linewidth=1.5, zorder=3, alpha=0.8)
        ax_price.bar(x_vals[up], c_plot[up]-o_plot[up], bottom=o_plot[up], width=0.8, color=col_up, zorder=3)
        ax_price.bar(x_vals[down], o_plot[down]-c_plot[down], bottom=c_plot[down], width=0.8, color=col_down, zorder=3)

        # EMA Lines
        ax_price.plot(x_vals, ema20_p, color='#FF9500', linewidth=3.0, label='EMA 20', alpha=1.0)
        ax_price.plot(x_vals, ema50_p, color='#673AB7', linewidth=3.0, label='EMA 50', alpha=0.95)
        ax_price.plot(x_vals, ema100_p, color='#F57C00', linewidth=2.5, label='EMA 100', alpha=0.90, linestyle='--')

        # Bollinger
        ax_price.fill_between(x_vals, bb_h_p, bb_l_p, alpha=0.15, color='#CCCCCC', label='Bollinger')

        # Destek / Direnç (Dinamik Pozisyonlama)
        # Metin pozisyonunu dinamik yap (Verinin %10'u kadar içeride)
        text_offset = x_vals[int(len(x_vals) * 0.1)] if len(x_vals) > 10 else x_vals[0]
        
        ax_price.axhline(support_level, color="#00E676", linestyle="--", linewidth=2.0, alpha=0.8)
        ax_price.text(text_offset, support_level, f" SUP: ${support_level:.2f}", 
                      color="#00E676", fontsize=24, fontweight='bold', va='bottom', ha='left', backgroundcolor='#00000080')
        
        ax_price.axhline(resistance_level, color="#FF5252", linestyle="--", linewidth=2.0, alpha=0.8)
        ax_price.text(text_offset, resistance_level, f" RES: ${resistance_level:.2f}", 
                      color="#FF5252", fontsize=24, fontweight='bold', va='bottom', ha='left', backgroundcolor='#00000080')

        # Timeframe Label (Dinamik)
        ax_price.text(0.99, 0.02, tf_label, transform=ax_price.transAxes, 
                      fontsize=20, color="#AAAAAA", ha='right', fontweight='bold')

        # Grid & Legend
        ax_price.grid(True, alpha=0.2, color='#444444', linestyle='--', linewidth=1.0)
        ax_price.set_axisbelow(True)
        ax_price.legend(loc='upper left', framealpha=0.9, fancybox=True, fontsize=20, facecolor='#000000', edgecolor='#444444') 
        ax_price.axhline(curr_price, color="white", linestyle="--", linewidth=1.5, alpha=0.7)

        # Eksen Yazıları
        ax_price.tick_params(axis='y', labelsize=16, colors='#DDDDDD')

        # Watermark
        fig.text(0.55, 0.55, "AFK DaSYS", fontsize=110, color='white', 
                 alpha=0.07, ha='center', va='center', rotation=10, weight='bold', zorder=0)

        # ---------------------------------------------------------
        # H) SUBPLOTS
        # ---------------------------------------------------------
        v_colors = np.where(c_plot >= o_plot, col_up, col_down)
        ax_vol.bar(x_vals, v_plot, color=v_colors, alpha=0.8, width=0.8)
        ax_vol.set_ylabel("Vol", color="white", fontsize=16)
        ax_vol.grid(True, alpha=0.2)

        ax_rsi.plot(x_vals, rsi_p, color="#FFD700", linewidth=2.0)
        ax_rsi.axhline(70, color="#FF5252", linestyle="--", alpha=0.6)
        ax_rsi.axhline(30, color="#00E676", linestyle="--", alpha=0.6)
        ax_rsi.set_ylabel("RSI", color="white", fontsize=16)
        ax_rsi.set_ylim(0, 100)
        
        hist_val = macd_p - sig_p
        ax_macd.plot(x_vals, macd_p, color="#00B0FF", linewidth=2.0, label="MACD")
        ax_macd.plot(x_vals, sig_p, color="#FF9100", linewidth=2.0, label="Signal")
        hist_colors = np.where(hist_val >= 0, "#00E676", "#FF5252")
        ax_macd.bar(x_vals, hist_val, color=hist_colors, alpha=0.7, width=0.8)
        ax_macd.set_ylabel("MACD", color="white", fontsize=16)

        # ---------------------------------------------------------
        # I) DINAMIK EKSEN ETİKETLERİ (SAAT vs TARİH)
        # ---------------------------------------------------------
        tick_interval = max(1, len(x_vals) // 8)
        ticks_to_show = x_vals[::tick_interval]
        
        # 4H ise Saat:Dakika, 1D ise Yıl-Ay-Gün göster
        if use_1h:
            tick_labels = df_plot.index[::tick_interval].strftime('%m-%d %H:%M')
        else:
            tick_labels = df_plot.index[::tick_interval].strftime('%Y-%m-%d')
        
        ax_macd.set_xticks(ticks_to_show)
        ax_macd.set_xticklabels(tick_labels, rotation=0, ha='center')
        ax_macd.tick_params(axis='x', labelsize=14, colors='#DDDDDD')

        plt.setp(ax_price.get_xticklabels(), visible=False)
        plt.setp(ax_vol.get_xticklabels(), visible=False)
        plt.setp(ax_rsi.get_xticklabels(), visible=False)

        # ---------------------------------------------------------
        # J) KAYDETME
        # ---------------------------------------------------------
        target_dir = r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\bots\chart"
        if not os.path.exists(target_dir):
            os.makedirs(target_dir, exist_ok=True)

        mmdd = datetime.now().strftime("%m%d")
        file_name = f"{ticker.upper()}{mmdd}.png"
        full_path = os.path.join(target_dir, file_name)

        plt.savefig(full_path, dpi=150, facecolor="#121212", bbox_inches="tight")
        plt.close(fig)

        return full_path

    except Exception as e:
        logging.error(f"Chart error: {e}", exc_info=True)
        try: plt.close(fig)
        except: pass
        return None
        
# ---------------------------------------------------------
# RİSK SINIFI (GLOBAL KULLANILIR)
# ---------------------------------------------------------
def classify_risk(rr: float) -> str:
    """
    R/R oranına göre basit risk sınıflandırması.
    """
    if rr >= 2.2:
        return "A+ (Premium)"
    if rr >= 1.8:
        return "A (Strong)"
    if rr >= 1.5:
        return "B (Moderate)"
    return "C (Weak)"

# ---------------------------------------------------------
# DETAY BLOĞU ÜRETEN FONKSİYON (TEK VE DOĞRU SÜRÜM)
# ---------------------------------------------------------
def build_candidate_block(rank: int, c: dict) -> str:
    ticker = c["ticker"]
    sector = sector_map.get(ticker, "Çeşitli/Diğer")

    score = c.get("score", 0.0)
    rr = c.get("rr_ratio", 0.0)
    risk_class = classify_risk(rr)
    comp = c.get("composite_score", 0.0)

    pct = c.get("profit_expectation_pct", 0.0)
    entry = c.get("entry_price", 0.0)
    tp = c.get("profit_target", 0.0)
    sl = c.get("stop_loss", 0.0)
    hold = c.get("hold_days", 0)

    # ✅ DÜZELTME 1: Market Cap — ham sayıyı okunabilir formata çevir
    mcap_raw = c.get("market_cap", 0) or 0
    if mcap_raw >= 1_000_000_000_000:
        mcap_str = f"{mcap_raw / 1_000_000_000_000:.2f}T"
    elif mcap_raw >= 1_000_000_000:
        mcap_str = f"{mcap_raw / 1_000_000_000:.2f}B"
    elif mcap_raw >= 1_000_000:
        mcap_str = f"{mcap_raw / 1_000_000:.1f}M"
    else:
        mcap_str = f"{mcap_raw:,.0f}"

    # V112: Exhausted etiketi
    exhaust_tag = " ⚠️ EXHAUSTED" if c.get("is_exhausted") else ""

    d1 = c.get("d1_summary", {})
    h1 = c.get("h1_summary", {})

    # --------------------------
    # 1D TREND
    # --------------------------
    trend_block = (
        "📌 <b>1D Trend Analizi</b>\n"
        f"• Trend Yapısı: <b>{d1.get('Trend Durumu', 'N/A')}</b>\n"
        f"• EMA20 Eğim: {d1.get('EMA20 Eğimi', 'N/A')}\n"
        f"• RSI(14): {d1.get('RSI(14)', 'N/A')}\n"
        f"• ADX: {d1.get('ADX', 'N/A')}\n"
        f"• ATR%: {d1.get('ATR%', 'N/A')}\n"
        f"• BB Width: {d1.get('BB Width', 'N/A')}\n"
    )

    # --------------------------
    # 1H SWING
    # ✅ DÜZELTME 2: Başlık "4H" → "1H" düzeltildi.
    #    RVOL anahtarı h1_summary'de "RVOL(1H)" olarak kaydediliyor.
    #    Hem yeni anahtarı hem eski "RVOL(4H)" fallback olarak dene.
    # --------------------------
    rvol_val = h1.get("RVOL(1H)") or h1.get("RVOL(4H)") or "N/A"
    swing_block = (
        "📌 <b>1H Swing Analizi</b>\n"
        f"• Fiyat/EMA Durumu: {h1.get('Fiyat/EMA', 'N/A')}\n"
        f"• RVOL (Hacim): {rvol_val}\n"
        f"• EMA20 Eğim: {h1.get('EMA20 Slope', 'N/A')}\n"
        f"• RSI(14): {h1.get('RSI(14)', 'N/A')}\n"
        f"• ADX(14): {h1.get('ADX(14)', 'N/A')}\n"
        f"• ATR%: {h1.get('ATR%', 'N/A')}\n"
        f"• Yapı: {h1.get('Yapı', 'N/A')}\n"
    )

    # --------------------------
    # MOMENTUM & GİRİŞ
    # ✅ DÜZELTME 3: details listesindeki gerçek mesajları doğru keyword'lerle çek
    # --------------------------
    details_list = c.get("details", [])

    # OBV: details'teki OBV satırlarını yakala
    obv_up = any(
        kw in d for d in details_list
        for kw in ("✅ OBV:", "📈 OBV:", "Güçlü Akümülasyon", "Pozitif Trend")
        if "OBV" in d
    )

    # Hacim: RVOL Rejim veya Hacim Trendi satırını bul (OBV satırları hariç)
    hacim_keywords = ("RVOL Rejim:", "Hacim Trendi:", "Para Girişi",
                      "Sessiz Birikim", "Swing Uyanışı", "Erken Artış", "Sürekli Artış",
                      "Momentum Para", "Erken Akümülasyon")
    vol_info = next(
        (d.strip() for d in details_list if any(kw in d for kw in hacim_keywords)),
        "Belirgin hacim sinyali yok"
    )

    # Giriş Tetikleyici: önce c dict'indeki entry_trigger alanını kullan
    entry_trigger_raw = c.get("entry_trigger", "")
    if entry_trigger_raw and entry_trigger_raw not in ("Henüz Yok", ""):
        trig_info = entry_trigger_raw
    else:
        entry_detail = next(
            (d for d in details_list if "ENTRY:" in d or "Tetik" in d),
            "Net Tetikleyici Yok"
        )
        trig_info = entry_detail.strip()

    momentum_block = (
        "📌 <b>Momentum & Giriş</b>\n"
        f"• OBV Eğilim: {'📈 Yükseliş' if obv_up else '➖ Nötr/Zayıf'}\n"
        f"• Hacim: {vol_info}\n"
        f"• Giriş Tetikleyici: {trig_info}\n"
    )

    # --------------------------
    # FAKTÖR SKORLARI
    # --------------------------
    tsi = c.get("tsi", 0.0)
    msi = c.get("msi", 0.0)
    vrs = c.get("vrs", 0.0)
    vps = c.get("vps", 0.0)
    nfi = c.get("nfi", 0.0)
    sss = c.get("sss", 0.0)
    rcs = c.get("rcs", 0.0)
    pfi = c.get("pfi", 0.0)
    ifi = c.get("ifi", 0.0)
    ffi = c.get("ffi", 0.0)

    eight_factor_block = (
        "📌 <b>Kurumsal Faktör Skorları</b>\n"
        f"• 🔵 TSI: {tsi:.1f} — {'📈 Güçlü trend' if tsi >= 2.0 else '⚠️ Trend zayıf/orta'}\n"
        f"• 🟣 MSI: {msi:.1f} — {'🚀 Momentum stabil' if msi >= 1.5 else '⚠️ Momentum kırılgan'}\n"
        f"• 🟢 VRS: {vrs:.1f} — {'💚 Sağlıklı volatilite' if vrs >= 1.5 else '🟡 Volatilite riskli'}\n"
        f"• 🟡 VPS: {vps:.1f} — {'📊 Kurumsal hacim akışı' if vps >= 1.5 else '⚠️ Hacim zayıf/dağınık'}\n"
        f"• 🧊 NFI: {nfi:.1f} — {'🔇 Temiz fiyat yapısı' if nfi >= 1.5 else '🔊 Gürültü/fake-out riski'}\n"
        f"• 🔶 SSS: {sss:.1f} — {'📈 HL güçlü swing' if sss >= 2.0 else '⚠️ Swing yapısı zayıf'}\n"
        f"• 🔴 RCS: {rcs:.1f} — {'🟢 RR iyi' if rcs >= 1.5 else '⚠️ RR düşük/limitli'}\n"
        f"• 💰 PFI: {pfi:.1f} — {'🟢 Yüksek kar potansiyeli' if pfi >= 1.5 else '⚠️ Kar profili sınırlı'}\n"
        f"• 🏦 IFI: {ifi:.1f} — {'🏛️ Kurumsal/Insider Akış' if ifi >= 1.0 else '➖ Kurumsal sinyal yok'}\n"
        f"• 📊 FFI: {ffi:.1f} — {'💎 Güçlü finansal sağlık' if ffi >= 1.0 else '➖ Finansal sinyal yok'}\n"
        f"🎯 <b>Composite:</b> {comp:.2f}\n"
    )

    # --------------------------
    # FINAL RETURN BLOCK
    # --------------------------
    return (
        f"<b>{rank:02d}. {ticker}</b> ({sector}){exhaust_tag}\n"
        f"💼 Cap: {mcap_str} | 🧠 Risk: {risk_class}\n"
        f"💵 Entry: {entry:.2f} | TP: {tp:.2f} | SL: {sl:.2f}\n"
        f"📈 Beklenen Kar: %{pct:.1f} | R/R: {rr:.2f}x | Skor: {score:.1f}\n"
        f"⏳ Bekleme: {hold} gün\n"
        f"{trend_block}{swing_block}{momentum_block}{eight_factor_block}"
        "------------------------------------------------------------\n"
    )

def build_diversified_toplist(
    candidates: list[dict],
    max_per_sector: int = 6, 
    total: int = 20
) -> list[dict]:
    """
    [KARTAL ALPHA COMMANDER v5.0]: 20 Aday Zorunluluğu Modu.
    1. Aşama: Sektör kotasına (max_per_sector) uyarak kaliteli seçim yapar.
    2. Aşama: Eğer liste 20'den az kalırsa, kotayı yok sayarak en yüksek puanlılarla listeyi tamamlar.
    """
    if not candidates: 
        return []
    
    # 1. Tüm adayları puana göre sırala (En yüksek momentum en üstte)
    sorted_candidates = sorted(
        [c for c in candidates if c.get("score", -99) > -50], # Çok ekstrem negatifler hariç hepsini al
        key=lambda x: x.get("score", 0.0), 
        reverse=True
    )
    
    final_list = []
    sector_counts = {}
    remaining_candidates = []
    
    # --- 1. TUR: SEKTÖR KOTASINA UYGUN SEÇİM ---
    for cand in sorted_candidates:
        sec = cand.get("sector", "Unknown")
        current_count = sector_counts.get(sec, 0)
        
        if current_count < max_per_sector and len(final_list) < total:
            final_list.append(cand)
            sector_counts[sec] = current_count + 1
        else:
            # Kotaya takılanları yedek listeye at
            remaining_candidates.append(cand)
            
    # --- 2. TUR: 20 ADAY ZORUNLULUĞU (BACKFILL) ---
    # Eğer ilk turda 20 aday bulunamadıysa, yedek listeden en iyileri çek
    if len(final_list) < total and remaining_candidates:
        needed = total - len(final_list)
        # Yedekleri de puan sırasına göre ekle
        final_list.extend(remaining_candidates[:needed])
        logging.info(f"⚠️ Sektör kotası nedeniyle 20 aday bulunamadı. Liste en iyi {needed} yedekle zorunlu tamamlandı.")
            
    return final_list[:total]
    
# ============================================================
# WATCHLIST EXPORT – NİHAİ VERSİYON (ZAMAN SINIRI YOK & FİLTRE YOK)
# ============================================================
async def export_watchlists_after_scan(candidates_all: list[dict], now_ny: datetime):
    """
    Her tarama sonrası çalışır. Zaman kısıtlaması yoktur.
    Telegram listesi ile birebir aynı (filtresiz) TXT dosyası oluşturur.
    """

    if not candidates_all:
        logging.info("📭 Watchlist export: aday bulunamadı.")
        return

    try:
        # -----------------------------------------------------
        # Klasör güvenliği
        # -----------------------------------------------------
        _ensure_dir(WATCHLIST_DIR)

        # -----------------------------------------------------
        # Skora göre sıralama (Telegram ile aynı mantık)
        # -----------------------------------------------------
        candidates_sorted = sorted(
            [
                c for c in candidates_all
                if c.get("ticker") and float(c.get("score", 0)) > 0
            ],
            key=lambda x: float(x.get("score", 0.0)),
            reverse=True
        )

        if not candidates_sorted:
            logging.info("📭 Watchlist export: skorlu aday yok.")
            return

        # -----------------------------------------------------
        # FİLTRELEME İPTAL (Telegram ile Eşit)
        # -----------------------------------------------------
        # exclude_set=set() göndererek dünkü hisseleri eleme özelliğini kapattık.
        daily_new = _select_daily_40(
            candidates_sorted,
            exclude_set=set() 
        )

        if not daily_new:
            logging.warning("⚠️ Listeye eklenecek hisse bulunamadı.")
            return

        # -----------------------------------------------------
        # Günlük dosya yazımı
        # -----------------------------------------------------
        date_tag = now_ny.strftime("%Y%m%d")
        daily_path = os.path.join(
            WATCHLIST_DIR,
            f"watchlist_{date_tag}.txt"
        )

        # Score aralığı hesaplama
        top_score = float(candidates_sorted[0].get("score", 0))
        idx_last = min(len(candidates_sorted) - 1, len(daily_new) - 1)
        bottom_score = float(candidates_sorted[idx_last].get("score", 0))

        header_lines = [
            f"# ATMACA Swing Watchlist - {now_ny.strftime('%Y-%m-%d %H:%M')}",
            f"# Top 20 Seçimi (Telegram Listesi ile Eşit)",
            f"# Skor Aralığı: {top_score:.1f} – {bottom_score:.1f}",
            "#",
        ]

        _write_tickers_to_file(
            daily_path,
            header_lines + daily_new
        )

        logging.info(
            f"✅ Günlük watchlist yazıldı (Telegram ile aynı) → {daily_path} "
            f"({len(daily_new)} hisse)"
        )

        # -----------------------------------------------------
        # Eski günlük dosyaları temizle
        # -----------------------------------------------------
        _purge_old_daily_files()

        # -----------------------------------------------------
        # Rolling Watchlist oluştur
        # -----------------------------------------------------
        rolling_tickers = _build_rolling_list()

        rolling_header = [
            f"# ATMACA ROLLING WATCHLIST (Son {WATCHLIST_KEEP_DAYS} Gün)",
            f"# Toplam: {len(rolling_tickers)} (max {WATCHLIST_MAX_ROLLING})",
            f"# Güncelleme: {now_ny.strftime('%Y-%m-%d %H:%M')} NY",
            "#",
        ]

        _write_tickers_to_file(
            WATCHLIST_ROLLING_FILE,
            rolling_header + rolling_tickers
        )

        logging.info(
            f"♻️ Rolling watchlist güncellendi → "
            f"{len(rolling_tickers)} ticker"
        )

    except Exception as e:
        logging.error(
            f"🚨 Watchlist export hatası: {e}",
            exc_info=True
        )


# scan_top_stocks içinde çağırım mutlaka şu şekilde olmalı:
# await export_watchlists_after_scan(candidates, now_ny, is_afternoon_scan=is_afternoon_scan)

# ============================================================
# EKSİK YARDIMCI FONKSİYONLAR (WATCHLIST & DOSYA YÖNETİMİ)
# ============================================================

def _ensure_dir(path: str):
    if not os.path.exists(path):
        os.makedirs(path)

def _write_tickers_to_file(filepath: str, lines: list[str]):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            for line in lines:
                f.write(line + "\n")
    except Exception as e:
        logging.error(f"Dosya yazma hatası ({filepath}): {e}")

def _load_yesterday_set() -> set:
    """Dün oluşturulan watchlist dosyasını bulup tickerları okur."""
    if not os.path.exists(WATCHLIST_DIR):
        return set()
    
    files = sorted([f for f in os.listdir(WATCHLIST_DIR) if f.startswith("watchlist_") and f.endswith(".txt")])
    if not files:
        return set()
    
    # En son dosya bugünün olabilir, bir öncekine bakmaya çalış
    # Basitlik için en son dosyayı "önceki" kabul edelim (eğer bugün henüz yazılmadıysa)
    last_file = os.path.join(WATCHLIST_DIR, files[-1])
    
    loaded = set()
    try:
        with open(last_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"): continue
                loaded.add(line.split()[0]) # Sadece sembolü al
    except Exception:
        pass
    return loaded

def _select_daily_40(sorted_candidates: list, exclude_set: set) -> list[str]:
    """En yüksek puanlılardan, hariç tutulanlar dışındakileri seçer."""
    selected = []
    for c in sorted_candidates:
        t = c.get("ticker")
        if t and t not in exclude_set:
            selected.append(t)
            if len(selected) >= 20:
                break
    return selected

def _purge_old_daily_files():
    """Eski dosyaları temizle."""
    if not os.path.exists(WATCHLIST_DIR):
        return
    
    files = sorted([f for f in os.listdir(WATCHLIST_DIR) if f.startswith("watchlist_") and f.endswith(".txt")])
    while len(files) > WATCHLIST_KEEP_DAYS:
        try:
            os.remove(os.path.join(WATCHLIST_DIR, files[0]))
            files.pop(0)
        except Exception:
            break

def _build_rolling_list() -> list[str]:
    """Son X günün tüm dosyalarını birleştirir."""
    combined_set = set()
    if not os.path.exists(WATCHLIST_DIR):
        return []
    
    files = sorted([f for f in os.listdir(WATCHLIST_DIR) if f.startswith("watchlist_") and f.endswith(".txt")])
    
    for fname in files:
        path = os.path.join(WATCHLIST_DIR, fname)
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        combined_set.add(line.split()[0])
        except Exception:
            pass
            
    return list(combined_set)[:WATCHLIST_MAX_ROLLING]


# ============================================================
# ATMACA SWING MASTER – HEDGE FUND TARAYICI (v103 Optimized)
# NY 13:00, Hafta içi çalışma, 168h Universe Cache, Faster I/O
# ============================================================

UNIVERSE_CACHE = {"ts": 0, "data": []}
UNIVERSE_TTL = 24 * 3600        # 24 saat (1 Gün) - Her gün güncellenir

# ============================================================
# ATMACA SWING MASTER – HEDGE FUND TARAYICI (v103 Optimized)
# ============================================================

async def push_results_to_finma(top_candidates: list, now_ny, duration: float):
    """
    Tarama sonuçlarını FinMA sitesine push et.
    frontend/data/signals-latest.json dosyasını günceller ve git push yapar.
    Vercel otomatik deploy eder (~2 dakika).
    """
    import json as _json
    import subprocess as _sp

    # Proje kökünü bul (bots/ → finma/)
    bots_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(bots_dir)
    signals_json = os.path.join(project_root, "frontend", "data", "signals-latest.json")

    # Bot output'u FinMA formatına dönüştür
    candidates_data = []
    for c in top_candidates:
        ticker = c.get("ticker", "")
        score = c.get("score", 0)
        price = c.get("current_price", 0)
        stop_loss = c.get("stop_loss", 0)
        tp2 = c.get("profit_target", price * 1.10)
        tp1 = price + (tp2 - price) * 0.40
        sector = c.get("sector", "Unknown")
        potential_pct = round(((tp2 - price) / price) * 100, 2) if price > 0 else 0

        candidates_data.append({
            "ticker": ticker,
            "score": round(score, 1),
            "price": round(price, 4),
            "action": "BUY",
            "entry_zone": f"{price:.2f} - {tp1:.2f}",
            "stop_loss": round(stop_loss, 4),
            "target": round(tp2, 2),
            "potential_pct": potential_pct,
            "sector": sector,
            "trend_phase": "Expansion",
        })

    # Score'a göre sırala
    candidates_data.sort(key=lambda x: x["score"], reverse=True)

    timestamp = now_ny.strftime("%Y-%m-%d %H:%M:%S")
    regime = MARKET_STATUS.get("regime", "Bull")
    vix = MARKET_STATUS.get("vix", 20.0)

    signals_payload = {
        "timestamp": timestamp,
        "bot_name": "swing112",
        "market_regime": regime,
        "vix_level": round(vix, 1),
        "candidates": candidates_data,
    }

    # JSON dosyasına yaz
    os.makedirs(os.path.dirname(signals_json), exist_ok=True)
    with open(signals_json, "w", encoding="utf-8") as f:
        _json.dump(signals_payload, f, indent=2, ensure_ascii=False)

    logging.info(f"📄 signals-latest.json güncellendi: {len(candidates_data)} aday")

    # Git push (Vercel otomatik deploy eder)
    try:
        os.chdir(project_root)
        _sp.run(["git", "add", "frontend/data/signals-latest.json"], check=True, capture_output=True)

        # Değişiklik var mı kontrol
        result = _sp.run(["git", "diff", "--cached", "--quiet"], capture_output=True)
        if result.returncode == 0:
            logging.info("📄 Sinyal verisi aynı — git push atlanıyor.")
            return

        msg = f"bot: swing112 sinyal guncelleme — {timestamp}"
        _sp.run(["git", "commit", "-m", msg], check=True, capture_output=True)
        _sp.run(["git", "push"], check=True, capture_output=True)
        logging.info("🚀 Git push başarılı! Vercel ~2 dk içinde deploy edecek.")

        await send_telegram_message(
            f"📡 <b>FinMA Push Başarılı</b>\n"
            f"🌐 {len(candidates_data)} sinyal siteye gönderildi\n"
            f"⏱ Vercel ~2 dk içinde güncellenecek"
        )
    except _sp.CalledProcessError as e:
        err_msg = e.stderr.decode() if e.stderr else str(e)
        logging.warning(f"Git push hatası: {err_msg}")
        await send_telegram_message(f"⚠️ Git push hatası: {err_msg[:200]}")


async def scan_top_stocks():
    """
    ATMACA MASTER TARAYICI:
    - New York 13:00 zamanlamasıyla uyumlu çalışır.
    - build_atmaca_universe_full() üzerinden dinamik evren kullanır.
    - 8-Faktörlü Composite skora göre sıralama ve raporlama yapar.
    - Alpha Vantage doğrulama verilerini grafiğe işler.
    """
    start_time = time.time()
    scanned_count = 0

    # ---------------------------------------------------------
    # ADIM 0: PİYASA VE GELİŞMİŞ SEKTÖR ANALİZİNİ ÇALIŞTIR
    # ---------------------------------------------------------
    await analyze_market_and_sectors() # Eski basit fonksiyon iptal
    await analyze_sector_momentum_advanced() # Yeni v104 motoru
    
    # Piyasa Rejimine Göre Global Baraj Puanını Güncelle
    global MIN_ATMACA_SCORE 
    base_threshold = 2.0  # Standart baraj (Boğa Piyasası için)
    
    # Eğer Ayı piyasasıysa baraja +2.0 ekler, Boğaysa +0.0
    MIN_ATMACA_SCORE = base_threshold + MARKET_STATUS["min_score_modifier"]
    
    logging.info(f"⚙️ Tarama Modu: {MARKET_STATUS['regime']} | Yeni Puan Barajı: {MIN_ATMACA_SCORE}")
    
    # ---------------------------------------------------------
    # 1) EVREN HAZIRLIĞI (Dinamik 168 Saatlik Cache)
    # ---------------------------------------------------------
    # Statik FOCUS_STOCKS yerine tüm ABD borsasını tarayan dinamik evreni alıyoruz.
    MASTER_UNIVERSE = await build_atmaca_universe_full()
    
    if not MASTER_UNIVERSE:
        logging.error("❌ US Evreni oluşturulamadı veya boş döndü, tarama iptal.")
        return

    universe_size = len(MASTER_UNIVERSE)
    # Hariç tutulan sembolleri filtrele
    tickers_to_scan = [t for t in MASTER_UNIVERSE if t not in EXCLUDED_STOCKS]

    if not tickers_to_scan:
        logging.error("❌ Taranacak hisse bulunamadı (Tüm liste filtrelenmiş olabilir).")
        return

    # ---------------------------------------------------------
    # 2) PARALEL ANALİZ MOTORU (Semaphore 2)
    # ---------------------------------------------------------
    # Yahoo rate-limitlerine (429 Ban) takılmamak için 2 eşzamanlı işlem daha güvenlidir.
    semaphore = asyncio.Semaphore(2)

    async def sem_analyze(ticker: str):
        nonlocal scanned_count
        async with semaphore:
            # YF ban riskine karşı her işlem öncesi organik asenkron nefes alma
            await asyncio.sleep(random.uniform(1.5, 3.2))
            try:
                # apply_atmaca_filters: RSI, ADX, ATR, Likidite ve AV Analizi yapar.
                result = await apply_atmaca_filters(ticker)
                scanned_count += 1
                
                # Her 50 hissede bir konsola ilerleme durumu basar.
                if scanned_count % 50 == 0:
                    logging.info(f"⏳ Analiz İlerleme: {scanned_count}/{universe_size}")
                
                return {"ticker": ticker, "result": result, "error": None}
            except Exception as e:
                return {"ticker": ticker, "result": None, "error": str(e)}

    # Tüm analiz görevlerini başlat ve sonuçları bekle
    tasks = [sem_analyze(t) for t in tickers_to_scan]
    raw_results = await asyncio.gather(*tasks)

    # ---------------------------------------------------------
    # 3) ADAY TOPLAMA VE 8-FAKTÖR SKORLAMA
    # ---------------------------------------------------------
    candidates = [r["result"] for r in raw_results if r["result"]]

    if not candidates:
        duration = time.time() - start_time
        await send_telegram_message(
            f"⚠️ <b>ATMACA SWING TARAYICI</b>\n"
            f"❗ Kriterlere uygun aday bulunamadı.\n"
            f"⏱ Süre: {duration:.1f}s"
        )
        return

    # 8-Faktörlü Composite skoru hesapla (TSI, MSI, VRS, VPS vb.)
    for c in candidates:
        compute_multi_factor_score(c)

    # ============================================================
    # 🥈 KATMAN 2 SONUCU: En iyi 40 adayı seç (Teknik + Momentum)
    # ============================================================
    candidates_ranked = sorted(
        [c for c in candidates if c.get("composite_score", -99) > -50],
        key=lambda x: x.get("score", 0.0),
        reverse=True
    )
    top_40 = candidates_ranked[:40]
    logging.info(f"🏆 Katman 2 Tamamlandı: {len(candidates)} adaydan en iyi 40 hisse Katman 3'e geçiyor.")

    # ============================================================
    # 🥉 KATMAN 3: AĞIR VERİLER (Insider, Finansal, Info, Yasal Risk) SADECE TOP 40 İÇİN
    # ============================================================
    logging.info("🏦 Katman 3 Başlıyor: Top 40 hisse için Ağır Veriler (Insider, Finansal, Yasal) çekiliyor...")
    
    async def fetch_heavy_data_for_candidate(c: dict):
        ticker = c["ticker"]
        try:
            await asyncio.sleep(random.uniform(0.5, 1.5)) # API Nefes Payı
            stock = yf.Ticker(ticker)
            info = await asyncio.to_thread(lambda: stock.info or {})
            
            # Info'dan gelen sektör ve beta verisini güncelle
            c["sector"] = info.get("sector", c.get("sector", "Unknown"))
            c["beta"] = info.get("beta", c.get("beta", 1.0))

            # 👔 INSIDER İŞLEM TESPİTİ
            insider = await asyncio.to_thread(detect_insider_activity, ticker, info)
            if insider['has_insider']:
                c["score"] += insider['score']
                c["details"].extend(insider['details'])
                c["insider_data"] = insider
            
            # 📊 FİNANSAL SAĞLIK ANALİZİ
            fin_health = await asyncio.to_thread(analyze_financial_health, ticker, info)
            if fin_health['health_score'] > 0:
                c["score"] += fin_health['health_score'] * 0.4
                c["details"].extend(fin_health['details'])
                c["financial_health"] = fin_health
            
            # 🎯 KATALİZÖR TESPİTİ
            catalyst_result = await asyncio.to_thread(check_silent_catalysts, ticker, info)
            if catalyst_result['has_catalyst']:
                c["score"] += catalyst_result['score']
                c["details"].extend(catalyst_result['reasons'])
                c["catalyst_data"] = catalyst_result
                
            # ⚖️ YASAL RİSK TARAMASI (Katman 3'e Entegre Edildi)
            # Yalnızca ön skoru belli bir seviyenin üstünde olanlara (örneğin 5.0) bakarak zaman kazanıyoruz
            if c.get('score', 0) > 5.0:
                risk_res = await check_legal_risk_live(ticker)
                if risk_res['has_risk']:
                    c['score'] -= risk_res['penalty']
                    c['details'].append(risk_res['msg'])
                    logging.warning(f"🚨 {ticker} Dava Riski Nedeniyle Puan Kaybetti!")
                
        except Exception as e:
            logging.debug(f"Katman 3 Veri Çekim Hatası ({ticker}): {e}")

    # Eşzamanlı maksimum 3 istek ile (Ban riskini sıfırlar) işle
    sem_k3 = asyncio.Semaphore(3)
    async def sem_fetch_heavy(c):
        async with sem_k3:
            await fetch_heavy_data_for_candidate(c)

    # Top 40 hisse için paralel veri çekimini başlat
    await asyncio.gather(*(sem_fetch_heavy(c) for c in top_40))

    # Ağır veriler eklendikten ve yasal riskler düşüldükten sonra skorlar değişti, YENİDEN SIRALA
    top_40.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    
    # Rapor ve işlemler için ilk 20'yi Sektör Kotasıyla al (Diversified)
    top_candidates = build_diversified_toplist(top_40, total=20)
    logging.info(f"🎯 Katman 3 Tamamlandı: Nihai Top 20 Hisse Belirlendi.")

    # ❌ PHASE 4: OPSİYON ZİNCİRİ TARAMASI KALDIRILDI ❌
    # (Performans optimizasyonu amacıyla iptal edilmiştir.)

    # ============================================================
    # 🦁 ALPHA VANTAGE FİYAT DOĞRULAMASI (Sadece Top 20 İçin)
    # ============================================================
    if ENABLE_ALPHA_VALIDATION:
        logging.info("🦁 Seçilen Top 20 aday için Alpha Vantage fiyat doğrulaması yapılıyor...")
        
        for c in top_candidates:
            # Sadece eşik puanı geçenleri doğrula
            if c.get('score', 0) >= ALPHA_VALIDATION_THRESHOLD:
                
                # API Çağrısı
                av_result = await verify_with_alpha_vantage(c['ticker'], c['current_price'])
                
                # Sonucu adayın verisine kaydet (Grafikte rozet çıkması için)
                c['alpha_validation'] = av_result
                
                # Eğer doğrulama başarısızsa ve fiyat farkı %5'ten büyükse puan kır
                if not av_result.get('validated', True) and av_result.get('av_price', 0) > 0:
                    c['score'] -= 10.0 # Listeden düşürmek için cezalandır
                    logging.warning(f"⛔ {c['ticker']} elendi: Fiyat uyuşmazlığı.")
                
                # Rate Limit (Kota) yememek için her sorguda 12 saniye bekle
                # (Ücretsiz key dakikada 5 istek limiti vardır)
                await asyncio.sleep(12) 
    
    # ============================================================
    # 💾 WATCHLIST KAYDETME
    # ============================================================
    now_ny = datetime.now(ZoneInfo("America/New_York"))
    try:
        await export_watchlists_after_scan(candidates, now_ny)
    except Exception as e:
        logging.warning(f"Watchlist export hatası: {e}")
        
    # ---------------------------------------------------------
    # 4) TELEGRAM RAPORLAMA (Mesaj 1: TOP 20 Tablo + İlk 10 Detay)
    # ---------------------------------------------------------
    now_str = now_ny.strftime("%Y-%m-%d %H:%M %Z")
    duration = time.time() - start_time
    layer3_count = len(layer3_candidates) if 'layer3_candidates' in locals() else 0

    header = (
        f"🦅 <b>ATMACA SWING MASTER V112 – TOP 20 PROJEKSİYON</b>\n"
        f"🕒 <i>Zaman (NY): {now_str}</i>\n"
        f"⏱ <i>Tarama Süresi: {duration:.1f} sn</i>\n"
        f"📊 <i>Katman 3: {layer3_count} aday → Top 20 raporlanıyor</i>\n"
        "<pre>"
        f"#  SEMBOL   PUAN    GİRİŞ      SL        TP1       TP2\n"
        f"---------------------------------------------------------\n"
    )

    rows = []
    for i, c in enumerate(top_candidates):
        score = c.get("score", 0.0)
        tag = "🚀" if score >= 10 else ("🔥" if score >= 8.5 else "🔍")
        exhaust_mark = "[E]" if c.get("is_exhausted") else "   "
        
        # TP2 profiti, TP1 ise %40'lık ilk hedef bölgesidir.
        tp2 = c['profit_target']
        tp1 = c['current_price'] + (tp2 - c['current_price']) * 0.40

        rows.append(
            f"{i+1:02d}. {tag} {c['ticker']:<6} {score:>5.1f} {exhaust_mark}  "
            f"{c['current_price']:>8.2f}   {c['stop_loss']:>8.2f}   "
            f"{tp1:>8.2f}   {tp2:>8.2f}"
        )

    toplist_msg = (
        header + "\n".join(rows) +
        "\n---------------------------------------------------------\n"
        "</pre><i>💡 Stop: 2xATR | Hedef: 1.8–2.5xATR | Max Kâr: %10–12 | [E]=Exhausted</i>\n\n"
        "<b>Aşağıda İlk 10 Adayın Derin Analiz Raporu Mevcuttur:</b>\n\n"
    )

    # İlk 10 detay raporu ve grafikleri
    first_batch = top_candidates[:10]
    report1_details = "".join([build_candidate_block(i + 1, c) for i, c in enumerate(first_batch)])
    
    await send_telegram_message(toplist_msg + report1_details)
    
    # Grafik gönderimleri
    for c in first_batch:
        # 🔥 ÖNEMLİ GÜNCELLEME: candidate_data=c parametresi eklendi
        chart_file = generate_stock_chart(c['ticker'], c['df_1d'], c['df_1h'], candidate_data=c)
        
        if chart_file:
            await send_telegram_photo(chart_file)
            await asyncio.sleep(0.5) # Spam önleme

    # ---------------------------------------------------------
    # 5) TELEGRAM RAPORLAMA (Mesaj 2: Son 10 Detay)
    # ---------------------------------------------------------
    second_batch = top_candidates[10:20]
    if second_batch:
        report2_header = "🦅 <b>ATMACA SWING MASTER V112 – SON 10 DETAY RAPORU</b>\n"
        report2_details = "".join([build_candidate_block(i + 11, c) for i, c in enumerate(second_batch)])
        
        await send_telegram_message(report2_header + report2_details)
        
        for c in second_batch:
            # 🔥 ÖNEMLİ GÜNCELLEME: candidate_data=c parametresi eklendi
            chart_file = generate_stock_chart(c['ticker'], c['df_1d'], c['df_1h'], candidate_data=c)
            
            if chart_file:
                await send_telegram_photo(chart_file)
                await asyncio.sleep(0.5)

    logging.info(f"✅ NY 13:00 Taraması başarıyla tamamlandı. ({scanned_count} hisse taranmış)")

    # ─── FinMA PUSH: Sonuçları siteye gönder ───
    try:
        await push_results_to_finma(top_candidates, now_ny, duration)
    except Exception as e:
        logging.warning(f"FinMA push hatası (site yine de çalışır): {e}")

from zoneinfo import ZoneInfo
from datetime import datetime, timedelta, timezone

def get_next_weekday_run_time_ny(target_hour=13, target_minute=0):
    """
    New York saatine göre bir sonraki hafta içi (Pzt–Cuma) hedef zamanı hesaplar.
    ASLA geçmiş tarih döndürmez ve DST/UTC dönüşüm kayması yaşamaz.
    Dönüş: UTC timezone-aware datetime.
    """

    now_utc = datetime.now(timezone.utc)
    now_ny = now_utc.astimezone(ZoneInfo("America/New_York"))

    # 1) Bugün için hedef saat
    candidate_ny = now_ny.replace(
        hour=target_hour,
        minute=target_minute,
        second=0,
        microsecond=0
    )

    # 2) Eğer saat geçmişse → bir gün ileri
    if candidate_ny <= now_ny:
        candidate_ny += timedelta(days=1)

    # 3) Hafta sonu → Pazartesiye ilerlet
    while candidate_ny.weekday() >= 5:  # 5 = Cumartesi, 6 = Pazar
        candidate_ny += timedelta(days=1)

    # 4) NY → UTC dönüşümü (DST güvenli)
    candidate_utc = candidate_ny.astimezone(timezone.utc)

    # 5) Her ihtimale karşı UTC tarihi yine geçmiş olursa (çok nadir bir DST glitch)
    if candidate_utc <= now_utc:
        candidate_utc = (now_ny + timedelta(days=1)).replace(
            hour=target_hour,
            minute=target_minute,
            second=0,
            microsecond=0
        ).astimezone(timezone.utc)

    return candidate_utc


async def run_scanner():

    await send_telegram_message(
        "🦅 ATMACA Master Swing Trade V112 Tarayıcı Başlatıldı!\n"
        "⏱ Çalışma: Hafta içi her gün New York 13:00 tam tarama.\n"
        "🆕 V112: 3 Katmanlı Filtre Sistemi\n"
        "  • 🥇 Katman 1: Statik Likidite ($5-$1000, MCap>300M, DV>5M, Beta 0.6-3.0)\n"
        "  • 🥈 Katman 2: Akış & Momentum (RVOL 5g/30g>1.2, EMA sıralaması, ADX>12, 4/10 yeşil, CMF>0)\n"
        "  • 🥉 Katman 3: Composite Ranking → En İyi 200 (Günlük güncelleme)"
    )

    # İlk tarama

    try:
        logging.info("▶ İlk tarama çalıştırılıyor...")
        await scan_top_stocks()
    except Exception as e:
        logging.error(f"Başlangıç tarama hatası: {str(e)}")
        await send_telegram_message(f"🚨 Başlangıç tarama hatası: `{str(e)}`")
   

    # Sonsuz döngü
    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            next_run_utc = get_next_weekday_run_time_ny()

            # Ham bekleme süresi
            wait_seconds = (next_run_utc - now_utc).total_seconds()

            # Güvenlik filtresi (asla negatif veya 25 saatten büyük olamaz)
            if wait_seconds < 0 or wait_seconds > 90000:  # 25 saat
                logging.warning(
                    f"Scheduler düzeltildi (wait={wait_seconds:.2f}). "
                    f"Zaman yeniden hesaplanıyor."
                )
                next_run_utc = get_next_weekday_run_time_ny()
                wait_seconds = (next_run_utc - datetime.now(timezone.utc)).total_seconds()

            # Bilgi mesajı
            logging.info(
                f"🕒 Bir sonraki tarama: "
                f"{next_run_utc.strftime('%Y-%m-%d %H:%M %Z')} "
                f"(~{wait_seconds/3600:.2f} saat sonra)"
            )

            # Uyku
            await asyncio.sleep(wait_seconds)

            # Tarama başlat
            logging.info("▶ NY 13:00 taraması başlıyor...")
            await scan_top_stocks()

        except Exception as e:
            logging.error(f"Tarayıcı döngü hatası: {str(e)}")
            await send_telegram_message(f"🚨 Tarayıcı döngü hatası: `{str(e)}`")

            # 1 saat dinlen (otomatik kurtarma)
            await asyncio.sleep(3600)


# ================================================================
# 🚀 STREAMLIT VE TERMINAL UYUMLU BAŞLATMA
# ================================================================

if __name__ == "__main__":
    # Eğer bu dosya doğrudan terminalden çalıştırılırsa (python family305.py)
    # Standart sonsuz döngüyü başlat.
    try:
        # Windows event loop fix
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
        asyncio.run(run_scanner())
        
    except KeyboardInterrupt:
        print("\n🦅 Bot manuel olarak durduruldu.")
    except Exception as e:
        print(f"Kritik Başlatma Hatası: {e}")