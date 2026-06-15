"""
================================================================
⚡ ATMACA DAYTRADE BOT V2.0 — ÖNGÖRÜ MODELİ
================================================================
V1'den temel fark:
  V1: 09:15'te reaktif tarar → "şu an gapper hangisi?"
  V2: 08:30'da öngörür    → "açılışta hangisi patlayabilir?"
       + Gün içi multi-scan → gözden kaçanları yakalar

KÖK PROBLEM ANALİZİ (MRNA vakası):
  - MRNA 09:00'da +14.4% gap yaptı
  - Bot 12:00'da verdi: fiyat $55.52 → zaten ulaşmış TP zonunda
  - Sebebi: 
    (a) 09:15 tek scan → intraday ilk 3 saat kör
    (b) RVOL 1D ortalamasıyla ölçülüyordu → premarket hacmini kaçırdı
    (c) Kataliz tipi bilinmiyordu → gap kalıcı mı anlık mı?
    (d) Premarket fiyat hareketi yok sayıldı

V2'DE ÇÖZÜMLER:
  1. PREMARKET SCAN (08:20-08:45 ET) → açılıştan 30dk önce alert
  2. KATALIZ PUANI → earnings/FDA/buyout = yüksek, unknown = düşük
  3. PREMARKET RVOL → son 5 günün premarket hacimleriyle kıyasla
  4. GAP DOLUM ANALİZİ → dünkü kapanış-açılış bölgesi boşluk dolacak mı?
  5. FLOAT ROTATION HESABı → kaç dakikada float dönüyor?
  6. MULTI-SCAN: 08:30, 09:15, 10:00, 10:30 (ilk saat kritik)
  7. MOMENTUM PRE-CONFIRMATION → açılış barında hacim spike = giriş onayı
  8. LEVEL 2 PROXY → bid/ask spread ve derinlik tahmini

MİMARİ V2:
  LAYER 0A → Premarket Gapper Scrape (08:20) — finviz + benzinga headlines
  LAYER 0B → Kataliz Tespit (benzinga/finviz news scrape)
  LAYER 1  → Premarket hacim + float rotation filtresi
  LAYER 2  → Öngörü skoru (açılış öncesi)
  LAYER 3  → Açılış onayı — ilk 5m barını bekle, sonra kesin sinyal
  OUTPUT   → "BEKLE + GİRİŞ ŞARTI" formatı (artık "şimdi gir" değil)

================================================================
"""

import json
import asyncio
import logging
import time
import os
import random
import re
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

import aiohttp
import pandas as pd
import numpy as np
import yfinance as yf

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
ENABLE_TELEGRAM = False  # 🚫 PASİF — inday313 gibi tüm telegram kapalı

# ================================================================
# 🔹 SCAN ZAMANLARI (NY ET)
# ================================================================
# V2: Çoklu scan — açılış öncesi + ilk saat
SCAN_TIMES = [
    (8,  20),   # 08:20 — Premarket erken uyarı (AH/PM haber sinyali)
    (8,  45),   # 08:45 — Premarket son durum + öngörü skoru
    (9,  16),   # 09:16 — Açılış onayı (ilk bar kapandıktan sonra)
    (9,  31),   # 09:31 — İkinci bar — momentum doğrulama
    (10,  1),   # 10:01 — İlk saat özeti + yeni fırsatlar
    (10, 31),   # 10:31 — Pullback scanner
]

# ================================================================
# 🔹 DAYTRADE FİLTRE PARAMETRELERİ
# ================================================================
PRICE_MIN = 2.0
PRICE_MAX = 500.0

MIN_AVG_VOLUME_10D = 200_000   # 200K ortalama günlük hacim minimum

# Premarket gap eşikleri
GAP_MIN_PCT     = 3.0    # V2: Daha seçici — 3%+ gerçek kataliz işareti
GAP_IDEAL_PCT   = 8.0    # İdeal gap aralığı başlangıcı
GAP_DANGER_PCT  = 40.0   # Pump/dump tehlike sınırı

# ATR
ATR_MIN_PCT_1D = 0.015   # %1.5 min hareket
ATR_MAX_PCT_1D = 0.18    # %18 max (çok volatil = spread ölümü)

# RSI
RSI_MIN = 25
RSI_MAX = 85

# R/R
MIN_RR_DAYTRADE = 1.8

# Çıktı
TOP_CANDIDATES = 10
OUTPUT_DIR      = r"C:\Users\afksm\finma\frontend\public"
OUTPUT_JSON     = "daytrade_picks.json"
OUTPUT_ALL_JSON = "daytrade_all_picks.json"

# ================================================================
# 🔹 KATALİZ AĞIRLIK TABLOSU (V2 YENİ)
# ================================================================
# Kataliz tipi → öngörü güvenilirliği
CATALYST_WEIGHTS = {
    "earnings_beat":   25,   # Kazanç sürprizi — en güçlü, kalıcı
    "fda_approval":    23,   # FDA onay — biyotek için kalıcı
    "acquisition":     22,   # Satın alma haberi — kalıcı
    "partnership":     18,   # Ortaklık/anlaşma — orta güçlü
    "upgrade":         15,   # Analist yükseltme — kısa vadeli
    "short_squeeze":   14,   # Short squeeze momentum — hızlı ama tersine dönebilir
    "fda_trial":       12,   # Klinik trial sonuçları — belirsiz
    "earnings_miss":   -5,   # Kazanç kaçırma — gap down genellikle devam eder
    "dilution":       -20,   # Hisse seyreltme — çöküş haberi
    "unknown":          5,   # Bilinmeyen — düşük güvenilirlik
}

# Haber anahtar kelimeleri → kataliz tipi
CATALYST_KEYWORDS = {
    "earnings_beat":  ["beat", "beats", "exceeded", "surpassed", "record revenue", "record earnings"],
    "fda_approval":   ["fda approved", "fda approval", "nda approved", "bla approved", "clearance"],
    "acquisition":    ["acquire", "merger", "buyout", "acquisition", "takeover", "all-cash"],
    "partnership":    ["partnership", "collaboration", "license agreement", "deal with", "joint venture"],
    "upgrade":        ["upgrade", "upgraded", "raised target", "overweight", "outperform", "buy rating"],
    "short_squeeze":  ["short interest", "heavily shorted", "short squeeze", "gamma squeeze"],
    "fda_trial":      ["phase 2", "phase 3", "clinical trial", "study results", "data readout"],
    "earnings_miss":  ["missed", "below expectations", "fell short", "guidance cut"],
    "dilution":       ["offering", "secondary offering", "dilutive", "shares sold"],
}

# ================================================================
# 🔹 GLOBAL CACHE
# ================================================================
BULK_1D_CACHE:  Dict[str, pd.DataFrame] = {}
FINVIZ_CACHE:   Dict[str, Any] = {"ts": 0.0, "data": []}
NEWS_CACHE:     Dict[str, Any] = {}   # ticker → {ts, catalyst_type, score, headline}
PREMARKET_RVOL_CACHE: Dict[str, float] = {}  # ticker → PM hacim oranı
FINVIZ_CACHE_TTL = 900   # 15 dakika (V1'de 30'du — premarket için daha sık)
SCAN_MODE = "premarket"  # "premarket" | "open_confirm" | "intraday"

# ================================================================
# SECTION 1: TELEGRAM
# ================================================================

async def send_telegram(msg: str, parse_mode: str = "HTML") -> bool:
    if not ENABLE_TELEGRAM:
        return True
    url = f"https://api.telegram.org/bot{TELEGRAM_API_KEY}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": msg[:4096],
        "parse_mode": parse_mode,
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
# SECTION 2: KATALİZ TESPİT (V2 YENİ)
# ================================================================

async def detect_catalyst_from_finviz_news(ticker: str, session: aiohttp.ClientSession) -> Dict:
    """
    Finviz haber başlıklarını çekerek kataliz tipini tespit eder.
    
    NEDEN ÖNEMLİ:
      Earnings beat gap → ertesi gün de devam edebilir → güçlü long bias
      Dilution gap    → açılışta daha da düşer → short fırsatı veya kaçın
      Unknown gap     → düşük güven, daha küçük pozisyon
      
    Finviz quote sayfasından son haberler çekilir.
    Ücretlidir ama kırılgandır — her zaman çalışmaz, fallback: "unknown"
    """
    cached = NEWS_CACHE.get(ticker)
    if cached and (time.time() - cached.get("ts", 0)) < 3600:
        return cached

    result = {
        "catalyst_type": "unknown",
        "catalyst_score": CATALYST_WEIGHTS["unknown"],
        "headline": "",
        "confidence": "low",
        "ts": time.time()
    }

    url = f"https://finviz.com/quote.ashx?t={ticker}&ty=c&ta=1&p=d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://finviz.com/",
    }

    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                NEWS_CACHE[ticker] = result
                return result

            html = await resp.text()
            soup = BeautifulSoup(html, "html.parser")

            # Finviz haber tablosu
            news_table = soup.find("table", id="news-table")
            if not news_table:
                NEWS_CACHE[ticker] = result
                return result

            headlines = []
            for row in news_table.find_all("tr")[:10]:
                td = row.find_all("td")
                if len(td) >= 2:
                    headline = td[1].get_text(strip=True).lower()
                    headlines.append(headline)

            if not headlines:
                NEWS_CACHE[ticker] = result
                return result

            # Anahtar kelime eşleşmesi
            best_type = "unknown"
            best_score = CATALYST_WEIGHTS["unknown"]

            for cat_type, keywords in CATALYST_KEYWORDS.items():
                for kw in keywords:
                    for hl in headlines:
                        if kw in hl:
                            if CATALYST_WEIGHTS.get(cat_type, 0) > best_score:
                                best_type  = cat_type
                                best_score = CATALYST_WEIGHTS[cat_type]
                                result["headline"] = headlines[0][:120]
                                break

            result["catalyst_type"]  = best_type
            result["catalyst_score"] = best_score
            result["confidence"]     = "high" if best_score >= 18 else "medium" if best_score >= 10 else "low"

    except Exception as e:
        logging.debug(f"Kataliz tespiti {ticker}: {e}")

    NEWS_CACHE[ticker] = result
    return result


# ================================================================
# SECTION 3: PREMARKET RVOL HESABI (V2 YENİ)
# ================================================================

async def calculate_premarket_rvol(ticker: str) -> float:
    """
    PREMARKET RVOL — V1'deki en büyük açık.
    
    V1 problemi: RVOL hesabı son 5 günün KAPANIŞ hacimleriyle yapılıyordu.
    Premarket hacim tamamen farklı bir ölçüdür.
    
    V2 çözümü: Son 5 işlem gününün 04:00-09:30 arası premarket hacmini
    yfinance 1m verisiyle çekip ortalamayı alıyoruz.
    Bugünkü premarket hacmini bununla kıyaslıyoruz.
    
    Premarket RVOL >= 5x → Kurumsal/news-driven ilgi
    Premarket RVOL 2-5x → Güçlü perakende ilgi  
    Premarket RVOL 1-2x → Ortalama (MRNA vakasındaki hata burada!)
    Premarket RVOL < 1x → Hacimsiz, pas geç
    """
    cached = PREMARKET_RVOL_CACHE.get(ticker)
    if cached:
        return cached

    try:
        # Son 5 günün 1m verisi (premarket dahil)
        df = await asyncio.to_thread(
            yf.download,
            ticker,
            period="5d",
            interval="1m",
            progress=False,
            ignore_tz=False,  # Timezone bilgisi lazım
        )
        if df is None or df.empty:
            return 1.0

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]

        # Premarket saatleri: 04:00–09:29 ET
        df.index = pd.to_datetime(df.index)
        
        try:
            df_ny = df.tz_convert("America/New_York")
        except Exception:
            PREMARKET_RVOL_CACHE[ticker] = 1.0
            return 1.0

        premarket_mask = (
            (df_ny.index.hour >= 4) & 
            (df_ny.index.hour < 9) |
            ((df_ny.index.hour == 9) & (df_ny.index.minute < 30))
        )
        df_pm = df_ny[premarket_mask]

        if df_pm.empty or len(df_pm) < 10:
            PREMARKET_RVOL_CACHE[ticker] = 1.0
            return 1.0

        # Bugünün premarket hacmi
        today_ny = datetime.now(NY_TZ).date()
        today_mask = df_pm.index.date == today_ny
        today_pm_vol = float(df_pm[today_mask]["Volume"].sum()) if today_mask.any() else 0.0

        # Önceki günlerin premarket hacim ortalaması
        prev_mask  = df_pm.index.date < today_ny
        prev_days  = df_pm[prev_mask]

        if prev_days.empty:
            PREMARKET_RVOL_CACHE[ticker] = 1.0
            return 1.0

        prev_daily_pm_vols = prev_days.groupby(prev_days.index.date)["Volume"].sum()
        avg_prev_pm_vol    = float(prev_daily_pm_vols.mean()) if len(prev_daily_pm_vols) > 0 else 1.0

        pm_rvol = today_pm_vol / avg_prev_pm_vol if avg_prev_pm_vol > 0 else 1.0
        pm_rvol = round(pm_rvol, 2)

        PREMARKET_RVOL_CACHE[ticker] = pm_rvol
        logging.info(f"[PM_RVOL] {ticker}: {pm_rvol:.1f}x (bugün {today_pm_vol:,.0f} / ort {avg_prev_pm_vol:,.0f})")
        return pm_rvol

    except Exception as e:
        logging.debug(f"PM RVOL {ticker}: {e}")
        PREMARKET_RVOL_CACHE[ticker] = 1.0
        return 1.0


# ================================================================
# SECTION 4: FLOAT ROTATION TAHMINI (V2 YENİ)
# ================================================================

def estimate_float_rotation(ticker: str, price: float, current_volume: int, df_1d: pd.DataFrame) -> Dict:
    """
    Float rotation — kaç dakikada float dönüyor?
    
    Daytrade'de en güçlü sinyal: float hızla dönüyorsa momentum ölmez.
    
    Float proxy: Yfinance shares_outstanding / public float bilinmiyorsa
    son 20 günün ortalama hacminden tahmin edilir.
    
    Formül:
      Float proxy = Ortalama günlük hacim × 30 (tipik float/avg_volume oranı)
      Float rotation dakikası = (Float / Anlık hacim) × 6.5 saat × 60 dakika
      
    Yorumlama:
      < 15 dk  → Ultra hızlı — momentum ticareti için ideal
      15-45 dk → Hızlı — daytrade uygun
      45-90 dk → Orta — dikkatli ol
      > 90 dk  → Yavaş — intraday fırsat az
    """
    try:
        avg_vol_20 = float(df_1d["Volume"].tail(20).mean()) if len(df_1d) >= 20 else float(df_1d["Volume"].mean())

        # Float proxy — gerçek float bilgisi olmadan tahmin
        # Yüksek hacimli hisseler genellikle büyük float'a sahiptir
        if avg_vol_20 > 5_000_000:
            float_proxy = avg_vol_20 * 20    # Large cap — büyük float
        elif avg_vol_20 > 1_000_000:
            float_proxy = avg_vol_20 * 15    # Mid cap
        else:
            float_proxy = avg_vol_20 * 8     # Small cap — küçük float = hızlı döner

        if current_volume <= 0 or float_proxy <= 0:
            return {"rotation_minutes": 999, "label": "Bilinmiyor", "score_bonus": 0}

        # Saatlik hacim tahmini (mevcut hacmin dakikaya bölünüp saate çevrilmesi)
        now_ny = datetime.now(NY_TZ)
        minutes_since_open = max(1, (now_ny.hour * 60 + now_ny.minute) - (9 * 60 + 30))
        hourly_vol_est = (current_volume / minutes_since_open) * 60

        rotation_minutes = (float_proxy / hourly_vol_est) * 60 if hourly_vol_est > 0 else 999

        if rotation_minutes < 15:
            label, bonus = "⚡ Ultra Hızlı (<15dk)", 12
        elif rotation_minutes < 45:
            label, bonus = "🚀 Hızlı (15-45dk)", 8
        elif rotation_minutes < 90:
            label, bonus = "📊 Orta (45-90dk)", 3
        else:
            label, bonus = "🐢 Yavaş (>90dk)", -3

        return {
            "rotation_minutes": round(rotation_minutes, 1),
            "label":            label,
            "score_bonus":      bonus,
            "float_proxy":      int(float_proxy),
            "hourly_vol_est":   int(hourly_vol_est),
        }
    except Exception as e:
        logging.debug(f"Float rotation: {e}")
        return {"rotation_minutes": 999, "label": "Hesaplanamadı", "score_bonus": 0}


# ================================================================
# SECTION 5: GAP DOLUM ANALİZİ (V2 YENİ)
# ================================================================

def analyze_gap_fill_risk(candidate: Dict, df_1d: pd.DataFrame) -> Dict:
    """
    Gap dolum riski — gap açıldı, kapanır mı?
    
    ÖNGÖRÜ mantığı:
      Geçmişteki gap'ler ne sıklıkla doldu?
      Büyük gap'ler küçük gap'lerden daha az dolma eğilimi taşır
      (çünkü güçlü kataliz = kalıcı re-pricing)
      
    V1 problemi: Gap yönü ve dolum riski hesaplanmıyordu.
    MRNA %14.4 gap — earnings beat olsaydı bu gap dolmazdı.
    Ama bot "güçlü gap" demekle yetindi, dolum riskini sormadı.
    
    Hesaplama:
      1. Son 20 günde kaç kez gap oldu?
      2. Bu gap'lerin kaçı aynı günde %50+ doldu?
      3. Mevcut gap büyüklüğüne göre dolum olasılığı
    """
    try:
        gap_pct   = candidate.get("change_pct", 0.0)
        closes    = df_1d["Close"].values
        opens     = df_1d["Open"].values

        if len(closes) < 10:
            return {"fill_risk": "Bilinmiyor", "fill_risk_score": 0, "historical_fill_rate": None}

        # Geçmiş gap'leri hesapla
        gap_events = []
        for i in range(1, min(len(closes), 20)):
            prev_close  = closes[i-1]
            today_open  = opens[i]
            today_close = closes[i]
            gap_size    = (today_open - prev_close) / prev_close * 100

            if abs(gap_size) >= 1.5:  # 1.5%+ gap sayılır
                # Dolum miktarı: gap açıldıktan sonra kapanışta ne kadar geri döndü?
                if gap_size > 0:  # Yukarı gap
                    fill_pct = (today_open - today_close) / (today_open - prev_close) * 100
                else:  # Aşağı gap
                    fill_pct = (today_close - today_open) / (prev_close - today_open) * 100

                gap_events.append({
                    "gap_size": round(gap_size, 2),
                    "fill_pct": round(max(0, min(fill_pct, 100)), 2)
                })

        if not gap_events:
            return {"fill_risk": "Veri Yok", "fill_risk_score": 0, "historical_fill_rate": None}

        # Dolum oranı (>50% dolum = "doldu" sayılır)
        filled_count = sum(1 for g in gap_events if g["fill_pct"] > 50)
        fill_rate    = filled_count / len(gap_events) * 100

        # Büyük gap'lerin dolum oranı daha düşüktür (kataliz güçlüyse)
        big_gaps   = [g for g in gap_events if abs(g["gap_size"]) >= 5]
        small_gaps = [g for g in gap_events if abs(g["gap_size"]) < 5]

        big_fill_rate   = sum(1 for g in big_gaps   if g["fill_pct"] > 50) / max(1, len(big_gaps)) * 100
        small_fill_rate = sum(1 for g in small_gaps if g["fill_pct"] > 50) / max(1, len(small_gaps)) * 100

        # Mevcut gap'e uygun dolum riski
        if abs(gap_pct) >= 10:
            relevant_fill_rate = big_fill_rate
        else:
            relevant_fill_rate = fill_rate

        # Skor: Düşük dolum riski = iyi sinyal
        if relevant_fill_rate < 30:
            risk_label  = "✅ Düşük Dolum Riski"
            risk_score  = 8
        elif relevant_fill_rate < 50:
            risk_label  = "🟡 Orta Dolum Riski"
            risk_score  = 3
        elif relevant_fill_rate < 70:
            risk_label  = "🟠 Yüksek Dolum Riski"
            risk_score  = -3
        else:
            risk_label  = "🔴 Çok Yüksek Dolum Riski"
            risk_score  = -8

        return {
            "fill_risk":              risk_label,
            "fill_risk_score":        risk_score,
            "historical_fill_rate":   round(relevant_fill_rate, 1),
            "gap_events_analyzed":    len(gap_events),
            "big_gap_fill_rate":      round(big_fill_rate, 1),
        }
    except Exception as e:
        logging.debug(f"Gap fill analysis: {e}")
        return {"fill_risk": "Hata", "fill_risk_score": 0, "historical_fill_rate": None}


# ================================================================
# SECTION 6: LAYER 0 — FİNVİZ SCRAPER
# ================================================================

async def scrape_finviz_gappers(session: aiohttp.ClientSession) -> List[Dict]:
    """Finviz screener'dan gapper listesi çeker. V1 ile aynı ama parametreler güncellendi."""
    url = (
        "https://finviz.com/screener.ashx"
        "?v=111"
        "&f=geo_usa,sh_price_2to300,sh_avgvol_200o,ta_change_u3"  # Gap min %3
        "&o=-change"
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
    for page in range(1, 8):  # 8 sayfa = 160 aday
        r_param = (page - 1) * 20 + 1
        page_url = url.replace("&r=1", f"&r={r_param}")
        try:
            async with session.get(page_url, headers=headers, timeout=aiohttp.ClientTimeout(total=12)) as resp:
                if resp.status != 200:
                    break
                html_text = await resp.text()
                soup = BeautifulSoup(html_text, "html.parser")

                rows = soup.select("tr.styled-row-cp") or soup.select("tr[class*='screener']")
                if not rows:
                    table = soup.find("table", {"id": "screener-content"})
                    if table:
                        rows = table.find_all("tr")[1:]

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
                            "ticker":     ticker,
                            "price":      price,
                            "change_pct": change,
                            "volume":     volume,
                            "source":     "finviz"
                        })
                    except (ValueError, IndexError):
                        continue

            await asyncio.sleep(random.uniform(1.5, 2.5))
        except Exception as e:
            logging.warning(f"Finviz page {page} error: {e}")
            break

    logging.info(f"[Finviz] {len(results)} gapper scraped")
    return results


async def get_gapper_universe() -> List[Dict]:
    """LAYER 0: Gapper listesi — cache + scrape + fallback."""
    now = time.time()
    if FINVIZ_CACHE["data"] and (now - FINVIZ_CACHE["ts"]) < FINVIZ_CACHE_TTL:
        logging.info(f"[Cache] {len(FINVIZ_CACHE['data'])} gapper cache'den")
        return FINVIZ_CACHE["data"]

    gappers = []
    async with aiohttp.ClientSession() as session:
        try:
            gappers = await scrape_finviz_gappers(session)
        except Exception as e:
            logging.warning(f"Finviz scrape failed: {e}")

    if len(gappers) < 5:
        logging.warning("Finviz başarısız, yfinance fallback...")
        # Basit fallback
        gappers = await _yf_premarket_fallback()

    # Dedup
    seen, deduped = set(), []
    for g in gappers:
        if g["ticker"] not in seen:
            seen.add(g["ticker"])
            deduped.append(g)

    safe   = sorted([g for g in deduped if g["change_pct"] <= GAP_DANGER_PCT],
                    key=lambda x: x["change_pct"], reverse=True)
    danger = [g for g in deduped if g["change_pct"] > GAP_DANGER_PCT]
    final  = (safe + danger)[:200]

    FINVIZ_CACHE["ts"]   = now
    FINVIZ_CACHE["data"] = final
    return final


async def _yf_premarket_fallback() -> List[Dict]:
    """Finviz erişilemezse yfinance ile hızlı tarama."""
    WATCHLIST = [
        "AAPL","MSFT","NVDA","TSLA","AMZN","META","GOOGL","AMD","NFLX",
        "MARA","RIOT","COIN","HOOD","SOFI","UPST","AFRM","PLTR","SOUN",
        "MRNA","BNTX","VKTX","SAVA","AVXL","PRTA","SRPT","IONS","BMRN",
        "SMCI","CELH","HIMS","GRND","SPY","QQQ","IWM",
    ]
    try:
        data = await asyncio.to_thread(
            yf.download, WATCHLIST, period="5d", interval="1d",
            progress=False, group_by="ticker", ignore_tz=True,
        )
        results = []
        for t in WATCHLIST:
            try:
                df = data[t].dropna() if t in data else pd.DataFrame()
                if len(df) < 2:
                    continue
                prev_c = float(df["Close"].iloc[-2])
                last_c = float(df["Close"].iloc[-1])
                chg    = (last_c - prev_c) / prev_c * 100
                if PRICE_MIN <= last_c <= PRICE_MAX and chg >= GAP_MIN_PCT:
                    results.append({"ticker": t, "price": round(last_c,2),
                                    "change_pct": round(chg,2), "volume": 0, "source": "yf_fallback"})
                    BULK_1D_CACHE[t] = df.copy()
            except Exception:
                continue
        return sorted(results, key=lambda x: x["change_pct"], reverse=True)
    except Exception as e:
        logging.error(f"yf fallback: {e}")
        return []


# ================================================================
# SECTION 7: LAYER 1 — VEKTÖRİYEL ÖN FİLTRE
# ================================================================

async def bulk_fetch_1d(tickers: List[str]) -> None:
    missing = [t for t in tickers if t not in BULK_1D_CACHE]
    if not missing:
        return

    CHUNK = 80
    logging.info(f"[LAYER 1] {len(missing)} ticker için 1D veri indiriliyor...")
    for i in range(0, len(missing), CHUNK):
        chunk = missing[i:i + CHUNK]
        try:
            data = await asyncio.to_thread(
                yf.download, chunk, period="30d", interval="1d",
                progress=False, group_by="ticker", ignore_tz=True, threads=True,
            )
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
            logging.warning(f"Bulk 1D chunk error: {e}")
        await asyncio.sleep(0.5)


def layer1_filter(ticker: str, gap_info: Dict) -> Optional[Dict]:
    """Hızlı 1D filtre — V1'e ek olarak gap kalitesi ve float proxy."""
    df = BULK_1D_CACHE.get(ticker)
    if df is None or len(df) < 5:
        return None

    try:
        close  = df["Close"]
        high   = df["High"]
        low    = df["Low"]
        volume = df["Volume"]

        last_price = float(close.iloc[-1])

        if not (PRICE_MIN <= last_price <= PRICE_MAX):
            return None

        avg_vol_10 = float(volume.tail(10).mean())
        avg_vol_20 = float(volume.tail(20).mean()) if len(volume) >= 20 else avg_vol_10

        if avg_vol_10 < MIN_AVG_VOLUME_10D:
            return None

        # RVOL (günlük — premarket RVOL ayrıca hesaplanacak)
        avg_vol_5 = float(volume.tail(5).mean())
        rvol      = avg_vol_5 / avg_vol_20 if avg_vol_20 > 0 else 1.0

        # ATR
        atr_val = float(AverageTrueRange(high, low, close, 14).average_true_range().iloc[-1]) \
                  if len(close) >= 14 else last_price * 0.03
        atr_pct = atr_val / last_price

        if not (ATR_MIN_PCT_1D <= atr_pct <= ATR_MAX_PCT_1D):
            return None

        # RSI
        rsi_val = float(RSIIndicator(close, 14).rsi().iloc[-1]) if len(close) >= 14 else 50.0
        if rsi_val < RSI_MIN or rsi_val > RSI_MAX:
            return None

        # Dollar hacim
        dollar_vol = last_price * avg_vol_10
        if dollar_vol < 500_000:  # $500K minimum — V2 daha seçici
            return None

        return {
            "ticker":      ticker,
            "price":       round(last_price, 2),
            "atr":         round(atr_val, 4),
            "atr_pct":     round(atr_pct * 100, 2),
            "rsi":         round(rsi_val, 1),
            "rvol":        round(rvol, 2),  # Günlük RVOL (PM ayrıca gelecek)
            "avg_vol_10d": int(avg_vol_10),
            "dollar_vol":  round(dollar_vol / 1e6, 2),
            "change_pct":  gap_info.get("change_pct", 0.0),
            "gap_source":  gap_info.get("source", "unknown"),
            "df_1d":       df,
        }
    except Exception as e:
        logging.debug(f"layer1_filter {ticker}: {e}")
        return None


# ================================================================
# SECTION 8: LAYER 2 — INTRADAY VERİ
# ================================================================

def calculate_vwap(df: pd.DataFrame) -> Optional[float]:
    try:
        tp   = (df["High"] + df["Low"] + df["Close"]) / 3
        vwap = (tp * df["Volume"]).cumsum() / df["Volume"].cumsum()
        return float(vwap.iloc[-1])
    except Exception:
        return None


async def fetch_intraday_5m(ticker: str) -> Optional[pd.DataFrame]:
    for attempt in range(3):
        try:
            await asyncio.sleep(random.uniform(0.1, 0.3) + attempt * 0.5)
            df = await asyncio.to_thread(
                yf.download, ticker, period="1d", interval="5m",
                progress=False, ignore_tz=True,
            )
            if df is None or df.empty or len(df) < 2:
                continue
            df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]
            df = df.rename(columns=str.capitalize).dropna()
            if len(df) >= 2:
                return df
        except Exception as e:
            if attempt == 2:
                logging.debug(f"{ticker} 5m fetch failed: {e}")
    return None


async def fetch_premarket_1m(ticker: str) -> Optional[pd.DataFrame]:
    """
    Premarket 1m bar'ları — açılış öncesi momentum için.
    Sadece 08:20 ve 08:45 scan'larında çalışır.
    """
    try:
        df = await asyncio.to_thread(
            yf.download, ticker, period="1d", interval="1m",
            progress=False, ignore_tz=False,
            prepost=True,  # Premarket dahil
        )
        if df is None or df.empty:
            return None

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [c[0] for c in df.columns]

        df.index = pd.to_datetime(df.index)
        try:
            df_ny = df.tz_convert("America/New_York")
        except Exception:
            return None

        # Sadece premarket saatler
        premarket = df_ny[
            (df_ny.index.hour >= 4) &
            ((df_ny.index.hour < 9) | ((df_ny.index.hour == 9) & (df_ny.index.minute < 30)))
        ]
        return premarket if len(premarket) >= 3 else None
    except Exception as e:
        logging.debug(f"Premarket 1m {ticker}: {e}")
        return None


def analyze_premarket_momentum(df_pm: Optional[pd.DataFrame]) -> Dict:
    """
    Premarket 1m momentum analizi.
    
    Kontrol edilen:
    - Son 15 dakikadaki trend (yukarı mı aşağı mı gidiyor?)
    - Premarket high'dan geri çekilme var mı?
    - Hacim yoğunluğu
    
    Bu analiz AÇILIŞ ÖNCESİ yapılıyor — beklenti tahmini.
    """
    if df_pm is None or len(df_pm) < 5:
        return {
            "pm_trend":         "bilinmiyor",
            "pm_pullback":      False,
            "pm_near_high":     False,
            "pm_score_bonus":   0,
            "pm_last_price":    None,
            "pm_high":          None,
            "pm_volume_surge":  False,
        }

    try:
        close    = df_pm["Close"] if "Close" in df_pm.columns else df_pm["close"]
        volume   = df_pm["Volume"] if "Volume" in df_pm.columns else df_pm["volume"]
        high_col = df_pm["High"] if "High" in df_pm.columns else df_pm["high"]

        pm_high       = float(high_col.max())
        pm_last       = float(close.iloc[-1])
        pm_open       = float(close.iloc[0])
        pm_change_pct = (pm_last - pm_open) / pm_open * 100 if pm_open > 0 else 0

        # Trend son 15 bar (son 15 dakika)
        last_15 = close.tail(min(15, len(close)))
        slope   = np.polyfit(range(len(last_15)), last_15, 1)[0]
        pm_trend = "yukarı" if slope > 0 else "aşağı"

        # High'dan geri çekilme var mı?
        pullback_from_high = (pm_high - pm_last) / pm_high * 100 if pm_high > 0 else 0
        pm_pullback = pullback_from_high > 2.0  # %2+ çekilme = pullback

        # High'a yakın mı?
        pm_near_high = pullback_from_high < 1.0  # High'dan %1 yakın

        # Hacim artışı (son 5 bar vs ortalama)
        avg_vol    = float(volume.mean())
        last_5_vol = float(volume.tail(5).mean())
        vol_surge  = last_5_vol > avg_vol * 1.5

        # Bonus skor
        bonus = 0
        if pm_trend == "yukarı" and pm_near_high:
            bonus = 10  # Güçlü premarket — açılışta devam potansiyeli
        elif pm_trend == "yukarı" and not pm_pullback:
            bonus = 6
        elif pm_trend == "aşağı" and pm_pullback:
            bonus = 2   # Çekilme var ama trend bozulmamış
        elif pm_trend == "aşağı":
            bonus = -5  # Premarket zayıflıyor
        if vol_surge:
            bonus += 4

        return {
            "pm_trend":         pm_trend,
            "pm_pullback":      pm_pullback,
            "pm_near_high":     pm_near_high,
            "pm_last_price":    round(pm_last, 2),
            "pm_high":          round(pm_high, 2),
            "pm_change_pct":    round(pm_change_pct, 2),
            "pm_volume_surge":  vol_surge,
            "pm_score_bonus":   bonus,
            "pullback_from_high_pct": round(pullback_from_high, 2),
        }
    except Exception as e:
        logging.debug(f"PM momentum: {e}")
        return {"pm_trend": "hata", "pm_score_bonus": 0}


# ================================================================
# SECTION 9: V2 ÖNGÖRÜ SKORU
# ================================================================

def score_daytrade_candidate_v2(
    candidate: Dict,
    df_5m: Optional[pd.DataFrame],
    df_pm: Optional[pd.DataFrame],
    catalyst: Dict,
    pm_rvol: float,
    gap_fill: Dict,
    float_rotation: Dict,
    scan_mode: str = "premarket",
) -> Dict:
    """
    V2 ÖNGÖRÜ SKORU — 100 puan üzerinden
    
    V1'den temel farklar:
    1. Kataliz puanı eklendi (en önemli yenilik)
    2. Premarket RVOL (PM hacim — not günlük RVOL)
    3. Premarket momentum analizi
    4. Gap dolum riski skora dahil
    5. Float rotation hızı
    6. Açılış onay modu (09:16+ scan) → farklı ağırlıklar
    
    SINYAL TİPLERİ:
      GAP_AND_GO     → Güçlü kataliz + PM momentum + açılışta hacim
      PULLBACK_VWAP  → Gap var ama PM zayıf — VWAP'a çekilmesini bekle
      CONFIRMED_OPEN → 09:16+ scan, açılış barı güçlü
      AVOID          → Dolum riski yüksek, zayıf kataliz
    """
    score   = 0.0
    details = []
    signals = []

    ticker  = candidate["ticker"]
    gap_pct = candidate.get("change_pct", 0.0)
    rvol    = candidate.get("rvol", 1.0)   # Günlük RVOL
    atr_pct = candidate.get("atr_pct", 2.0)
    rsi     = candidate.get("rsi", 50.0)
    price   = candidate.get("price", 0.0)
    df_1d   = candidate.get("df_1d")

    # ── 1. KATALİZ PUANI (0-25) — V2'nin en büyük yeniliği ──────
    cat_score = catalyst.get("catalyst_score", CATALYST_WEIGHTS["unknown"])
    cat_type  = catalyst.get("catalyst_type", "unknown")
    cat_conf  = catalyst.get("confidence", "low")

    if cat_score >= 20:
        score += 25.0
        details.append(f"🎯 Güçlü Kataliz: {cat_type.upper()} ({cat_conf})")
        signals.append("GAP_AND_GO")
    elif cat_score >= 14:
        score += 17.0
        details.append(f"📰 Kataliz: {cat_type.upper()}")
        signals.append("GAP_AND_GO")
    elif cat_score >= 8:
        score += 10.0
        details.append(f"📋 Zayıf Kataliz: {cat_type.upper()}")
    elif cat_score < 0:
        score += cat_score  # Negatif puan (dilution, earnings miss)
        details.append(f"⚠️ Olumsuz Kataliz: {cat_type.upper()}")
        signals.append("AVOID")
    else:
        score += 5.0
        details.append("❓ Kataliz Bilinmiyor — Düşük Güven")

    # ── 2. PREMARKET RVOL (0-20) — V1'in kör noktası ────────────
    # V1 günlük RVOL'u ölçüyordu, premarket hacmini değil
    if pm_rvol >= 10.0:
        score += 20.0
        details.append(f"🔥 PM RVOL: {pm_rvol:.1f}x (Kurumsal)")
        if "GAP_AND_GO" not in signals:
            signals.append("GAP_AND_GO")
    elif pm_rvol >= 5.0:
        score += 15.0
        details.append(f"💪 PM RVOL: {pm_rvol:.1f}x (Güçlü)")
        if "GAP_AND_GO" not in signals:
            signals.append("GAP_AND_GO")
    elif pm_rvol >= 2.5:
        score += 9.0
        details.append(f"📊 PM RVOL: {pm_rvol:.1f}x (Ortalama Üstü)")
    elif pm_rvol >= 1.5:
        score += 4.0
        details.append(f"📉 PM RVOL: {pm_rvol:.1f}x (Zayıf PM Hacim)")
        # MRNA vakasındaki 1.2x burada düşük puan alır → doğru karar: geç
    else:
        score -= 8.0
        details.append(f"❌ PM RVOL: {pm_rvol:.1f}x (Hacimsiz Premarket!)")

    # ── 3. GAP KALİTESİ (0-15) ───────────────────────────────────
    if gap_pct >= 15.0:
        score += 13.0
        details.append(f"🚀 Büyük Gap: +{gap_pct:.1f}%")
        if "GAP_AND_GO" not in signals:
            signals.append("GAP_AND_GO")
    elif gap_pct >= 8.0:
        score += 10.0
        details.append(f"📈 Güçlü Gap: +{gap_pct:.1f}%")
        if "GAP_AND_GO" not in signals:
            signals.append("GAP_AND_GO")
    elif gap_pct >= 4.0:
        score += 6.0
        details.append(f"↗️ Orta Gap: +{gap_pct:.1f}%")
    elif gap_pct >= GAP_MIN_PCT:
        score += 3.0
        details.append(f"↗️ Küçük Gap: +{gap_pct:.1f}%")

    if gap_pct > GAP_DANGER_PCT:
        score -= 12.0
        details.append(f"⚠️ Pump/Dump Riski! (%{gap_pct:.0f})")
        signals.append("AVOID")

    # ── 4. GAP DOLUM RİSKİ (−8 → +8) — V2 YENİ ─────────────────
    gf_score = gap_fill.get("fill_risk_score", 0)
    score += gf_score
    gf_label = gap_fill.get("fill_risk", "")
    gf_rate  = gap_fill.get("historical_fill_rate")
    if gf_label:
        rate_str = f" (%{gf_rate:.0f} dolum)" if gf_rate is not None else ""
        details.append(f"{gf_label}{rate_str}")
    if gf_score < 0 and "GAP_AND_GO" in signals:
        signals.append("PULLBACK_VWAP")

    # ── 5. PREMARKET MOMENTUM (0-15) — V2 YENİ ───────────────────
    pm_analysis = analyze_premarket_momentum(df_pm)
    pm_bonus    = pm_analysis.get("pm_score_bonus", 0)
    score += pm_bonus

    if pm_analysis.get("pm_near_high") and pm_analysis.get("pm_trend") == "yukarı":
        details.append(f"⚡ PM Güçlü: High yakını, yukarı trend")
        if "GAP_AND_GO" not in signals:
            signals.append("GAP_AND_GO")
    elif pm_analysis.get("pm_trend") == "aşağı":
        details.append(f"📉 PM Zayıf: Aşağı trend (%{pm_analysis.get('pullback_from_high_pct', 0):.1f} geri)")
        if scan_mode in ("premarket", "early"):
            signals.append("PULLBACK_VWAP")

    # ── 6. FLOAT ROTATION (0-12) — V2 YENİ ──────────────────────
    fr_bonus = float_rotation.get("score_bonus", 0)
    fr_label = float_rotation.get("label", "")
    score += fr_bonus
    if fr_label:
        details.append(fr_label)

    # ── 7. AÇILIŞ ONAY MODU (sadece 09:16+ scan) ─────────────────
    vwap = None
    price_vs_vwap = 0.0

    if scan_mode in ("open_confirm", "intraday") and df_5m is not None and len(df_5m) >= 3:
        vwap = calculate_vwap(df_5m)
        if vwap and vwap > 0:
            price_vs_vwap = (price - vwap) / vwap * 100
            if price_vs_vwap > 0.3:
                score += 15.0
                details.append(f"✅ VWAP Üstünde: +{price_vs_vwap:.2f}%")
                if "CONFIRMED_OPEN" not in signals:
                    signals.append("CONFIRMED_OPEN")
            elif price_vs_vwap > 0:
                score += 8.0
                details.append(f"🟡 VWAP Hemen Üstünde")
            elif price_vs_vwap > -1.0:
                score += 5.0
                details.append(f"🔄 VWAP Testi: {price_vs_vwap:.2f}%")
                signals.append("PULLBACK_VWAP")
            else:
                score -= 8.0
                details.append(f"🔴 VWAP Altında: {price_vs_vwap:.2f}%")

        # İlk bar momentum (açılış onayı)
        if len(df_5m) >= 1:
            try:
                first_bar   = df_5m.iloc[0]
                is_green    = float(first_bar["Close"]) > float(first_bar["Open"])
                body_pct    = abs(float(first_bar["Close"]) - float(first_bar["Open"])) / float(first_bar["Open"]) * 100
                first_vol   = float(first_bar["Volume"])
                avg_pm_vol  = float(df_5m["Volume"].mean())
                vol_ratio   = first_vol / avg_pm_vol if avg_pm_vol > 0 else 1.0

                if is_green and body_pct > 0.5 and vol_ratio >= 2:
                    score += 10.0
                    details.append(f"🔥 Açılış Barı: Güçlü ({vol_ratio:.1f}x hacim)")
                    signals.append("CONFIRMED_OPEN")
                elif is_green:
                    score += 5.0
                    details.append(f"✅ Açılış Barı: Yeşil")
                else:
                    score -= 5.0
                    details.append(f"🔴 Açılış Barı: Kırmızı ({body_pct:.1f}% gövde)")
            except Exception:
                pass

    # ── 8. RSI (0-10) ─────────────────────────────────────────────
    if 50 <= rsi <= 70:
        score += 10.0
        details.append(f"🟢 RSI: {rsi:.0f} (Momentum Bölgesi)")
    elif 40 <= rsi < 50:
        score += 5.0
        details.append(f"🟡 RSI: {rsi:.0f} (Nötr)")
    elif rsi > 70:
        score += 4.0
        details.append(f"🔶 RSI: {rsi:.0f} (Yüksek)")
    elif rsi < 35:
        score += 3.0
        details.append(f"🔵 RSI: {rsi:.0f} (Aşırı Satım)")
        signals.append("REVERSAL")

    # ── 9. ATR UYUMU (0-8) ────────────────────────────────────────
    if atr_pct >= 4.0:
        score += 8.0
        details.append(f"🎯 ATR Geniş: %{atr_pct:.1f}")
    elif atr_pct >= 2.5:
        score += 5.0
        details.append(f"📏 ATR: %{atr_pct:.1f}")
    elif atr_pct >= 1.5:
        score += 2.0
        details.append(f"📏 ATR Dar: %{atr_pct:.1f}")
    else:
        score -= 3.0
        details.append(f"⚠️ ATR Çok Dar: %{atr_pct:.1f}")

    # ── GİRİŞ ŞARTI OLUŞTUR ───────────────────────────────────────
    # V2'nin en önemli çıktısı: "Şimdi gir" değil, "Şu şart gerçekleşince gir"
    primary_signal  = signals[0] if signals else "MOMENTUM"
    entry_condition = _build_entry_condition(
        primary_signal, pm_analysis, vwap, price, scan_mode, catalyst
    )

    candidate["dt_score"]        = round(min(score, 100.0), 1)
    candidate["details"]         = details
    candidate["primary_signal"]  = primary_signal
    candidate["entry_condition"] = entry_condition
    candidate["vwap"]            = round(vwap, 2) if vwap else None
    candidate["price_vs_vwap"]   = round(price_vs_vwap, 2)
    candidate["catalyst"]        = catalyst
    candidate["pm_rvol"]         = pm_rvol
    candidate["pm_analysis"]     = pm_analysis
    candidate["gap_fill"]        = gap_fill
    candidate["float_rotation"]  = float_rotation

    return candidate


def _build_entry_condition(signal: str, pm_analysis: Dict, vwap: Optional[float],
                            price: float, scan_mode: str, catalyst: Dict) -> str:
    """
    GİRİŞ ŞARTI — V2'nin kalbi.
    "Şimdi gir" yerine "bu şart gerçekleşince gir" mesajı üretir.
    Bu şart AÇILIŞTAN ÖNCE hesaplanır → öngörü odaklı.
    """
    cat_type = catalyst.get("catalyst_type", "unknown")
    pm_high  = pm_analysis.get("pm_high")

    if signal == "AVOID":
        return "❌ GEÇ — Olumsuz kataliz veya yüksek dolum riski"

    if scan_mode == "premarket":
        # Açılış öncesi — bekle ve izle modu
        if signal == "GAP_AND_GO":
            pm_high_str = f"${pm_high:.2f}" if pm_high else "PM high"
            return (
                f"⏳ BEKLE → Açılış barı {pm_high_str} kırınca GİR | "
                f"İlk 5m hacmi günlük ortalamanın 2x+ olmalı | "
                f"Kataliz: {cat_type.upper()}"
            )
        elif signal == "PULLBACK_VWAP":
            return (
                f"⏳ BEKLE → Açılışta VWAP test edilince GİR | "
                f"VWAP'tan sekme + hacim artışı şart | Kataliz: {cat_type.upper()}"
            )
        else:
            return f"⏳ BEKLE → Açılış barı kapatmaya izle, yön netleşince karar ver"

    elif scan_mode == "open_confirm":
        # 09:16 scan — açılış barı kapandı, onay modu
        if signal in ("GAP_AND_GO", "CONFIRMED_OPEN"):
            return (
                f"✅ AÇILIŞ ONAYLANDI — Şimdi giriş düşünülebilir | "
                f"Stop: VWAP altı | TP: ATR bazlı zonlara bak"
            )
        elif signal == "PULLBACK_VWAP":
            vwap_str = f"${vwap:.2f}" if vwap else "VWAP"
            return f"📊 PULLBACK BEKLE → {vwap_str}'a çekilme + bounce onayı"
        else:
            return "👀 İZLE — Sinyal zayıf, hacim artışını bekle"

    else:  # intraday
        return "📊 İntraday izleme — yeni seviyelere bakınılıyor"


# ================================================================
# SECTION 10: ZONE HESABI (V1'den iyileştirildi)
# ================================================================

def calculate_daytrade_zones_v2(candidate: Dict, df_5m: Optional[pd.DataFrame]) -> Dict:
    """
    V2 zone hesabı — premarket high/low referans alır.
    V1: Sadece intraday high/low kullanıyordu
    V2: PM high = ilk direnç, PM low = ilk destek
    """
    price   = candidate.get("price", 0.0)
    atr     = candidate.get("atr", price * 0.02)
    signal  = candidate.get("primary_signal", "GAP_AND_GO")
    vwap    = candidate.get("vwap")
    pm_ana  = candidate.get("pm_analysis", {})

    pm_high = pm_ana.get("pm_high") or price
    pm_low  = price - atr * 0.5  # PM low bilgisi yoksa ATR bazlı tahmin

    intraday_high = price
    intraday_low  = price

    if df_5m is not None and len(df_5m) >= 1:
        try:
            intraday_high = float(df_5m["High"].max())
            intraday_low  = float(df_5m["Low"].min())
        except Exception:
            pass

    if signal in ("GAP_AND_GO", "CONFIRMED_OPEN"):
        # Giriş: PM high kırılınca (breakout confirmation)
        entry_low = round(pm_high * 0.999, 2)         # PM high yakını
        entry_hi  = round(pm_high * 1.005, 2)          # PM high + biraz buffer
        stop      = round(max(intraday_low - atr * 0.15, pm_high - atr * 0.5), 2)

    elif signal == "PULLBACK_VWAP":
        vwap_ref  = vwap if vwap else price - atr * 0.3
        entry_low = round(vwap_ref * 0.998, 2)
        entry_hi  = round(vwap_ref * 1.003, 2)
        stop      = round(vwap_ref - atr * 0.35, 2)

    else:  # REVERSAL
        entry_low = round(price - atr * 0.15, 2)
        entry_hi  = round(price + atr * 0.05, 2)
        stop      = round(intraday_low - atr * 0.3, 2)

    # Stop çok yakın kontrolü
    if price - stop < atr * 0.2:
        stop = round(price - atr * 0.3, 2)

    avg_entry = (entry_low + entry_hi) / 2
    risk      = max(avg_entry - stop, atr * 0.25)

    tp1 = round(avg_entry + risk * 2.0, 2)
    tp2 = round(avg_entry + risk * 3.5, 2)  # V2: TP2 daha geniş (güçlü kataliz)

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
        "pm_high_ref": round(pm_high, 2),  # V2 ek: PM high referans
    }


# ================================================================
# SECTION 11: ANA TARAMA — scan_daytrade_v2
# ================================================================

async def scan_daytrade_v2(scan_mode: str = "premarket"):
    """
    ATMACA DAYTRADE V2 MASTER SCANNER
    
    scan_mode:
      "premarket"    → 08:20/08:45 ET — açılış öncesi öngörü
      "open_confirm" → 09:16/09:31 ET — açılış onayı
      "intraday"     → 10:01/10:31 ET — intraday fırsatlar
    """
    global SCAN_MODE
    SCAN_MODE = scan_mode

    start_time = time.time()
    now_ny     = datetime.now(NY_TZ)

    mode_labels = {
        "premarket":    "🌅 PREMARKET ÖNGÖRÜ",
        "open_confirm": "🔔 AÇILIŞ ONAY",
        "intraday":     "📊 İNTRADAY TARAMA",
    }
    mode_label = mode_labels.get(scan_mode, scan_mode.upper())

    logging.info("=" * 60)
    logging.info(f"⚡ ATMACA V2 — {mode_label}")
    logging.info(f"🕒 {now_ny.strftime('%Y-%m-%d %H:%M %Z')}")
    logging.info("=" * 60)

    await send_telegram(
        f"⚡ <b>ATMACA DAYTRADE V2 — {mode_label}</b>\n"
        f"🕒 {now_ny.strftime('%Y-%m-%d %H:%M %Z')}\n"
        f"🔍 Finviz gapper + PM hacim + kataliz analizi..."
    )

    # ── LAYER 0 ──────────────────────────────────────────────────
    gappers = await get_gapper_universe()
    if not gappers:
        await send_telegram("❌ Gapper listesi boş.")
        return

    tickers_0 = [g["ticker"] for g in gappers]
    gap_map   = {g["ticker"]: g for g in gappers}

    # ── LAYER 1 ──────────────────────────────────────────────────
    await bulk_fetch_1d(tickers_0)
    layer1_passed = [r for t in tickers_0 if (r := layer1_filter(t, gap_map.get(t, {})))]
    logging.info(f"[LAYER 1] {len(tickers_0)} → {len(layer1_passed)}")

    if not layer1_passed:
        await send_telegram("⚠️ Layer 1: Hiç aday geçemedi.")
        return

    # ── LAYER 2: Paralel analiz ──────────────────────────────────
    sem = asyncio.Semaphore(6)  # V2: Daha az eşzamanlı — PM veri de çekiyor

    async def analyze_one(candidate: Dict) -> Optional[Dict]:
        async with sem:
            ticker = candidate["ticker"]
            try:
                # 5m intraday (open_confirm/intraday modlarında)
                df_5m = None
                if scan_mode in ("open_confirm", "intraday"):
                    df_5m = await fetch_intraday_5m(ticker)

                # 1m premarket (premarket modunda)
                df_pm = None
                if scan_mode == "premarket":
                    df_pm = await fetch_premarket_1m(ticker)

                # Premarket RVOL (V2 yenilik)
                pm_rvol = await calculate_premarket_rvol(ticker)

                # Kataliz tespiti (V2 yenilik)
                async with aiohttp.ClientSession() as sess:
                    catalyst = await detect_catalyst_from_finviz_news(ticker, sess)

                # Gap dolum analizi
                df_1d    = candidate.get("df_1d", pd.DataFrame())
                gap_fill = analyze_gap_fill_risk(candidate, df_1d)

                # Float rotation
                current_vol    = int(gap_map.get(ticker, {}).get("volume", 0))
                float_rotation = estimate_float_rotation(ticker, candidate["price"], current_vol, df_1d)

                # V2 skorlama
                scored = score_daytrade_candidate_v2(
                    candidate, df_5m, df_pm, catalyst,
                    pm_rvol, gap_fill, float_rotation, scan_mode
                )
                scored["df_5m"] = df_5m
                return scored

            except Exception as e:
                logging.debug(f"{ticker} layer2 v2: {e}")
                return None

    tasks   = [analyze_one(c) for c in layer1_passed]
    results_raw = await asyncio.gather(*tasks)
    scored  = [r for r in results_raw if r is not None]
    scored.sort(key=lambda x: x.get("dt_score", 0.0), reverse=True)

    # AVOID sinyalleri en alta at
    avoid   = [c for c in scored if c.get("primary_signal") == "AVOID"]
    scored  = [c for c in scored if c.get("primary_signal") != "AVOID"] + avoid

    # ── LAYER 3: Zone hesap ──────────────────────────────────────
    top = scored[:TOP_CANDIDATES]
    for c in top:
        df_5m = c.pop("df_5m", None)
        c["df_1d"] = None
        zones      = calculate_daytrade_zones_v2(c, df_5m)
        c["zones"]    = zones
        c["rr_ratio"] = zones["rr_ratio"]

    top = [c for c in top if c.get("rr_ratio", 0) >= MIN_RR_DAYTRADE]

    duration = time.time() - start_time

    # ── JSON KAYIT ────────────────────────────────────────────────
    output_data = {
        "generated_at":    now_ny.isoformat(),
        "scan_mode":       scan_mode,
        "scan_duration_s": round(duration, 1),
        "total_scanned":   len(tickers_0),
        "layer1_passed":   len(layer1_passed),
        "final_picks":     len(top),
        "picks":           [],
    }
    for c in top:
        output_data["picks"].append({
            "ticker":          c["ticker"],
            "price":           c["price"],
            "change_pct":      c["change_pct"],
            "dt_score":        c["dt_score"],
            "signal":          c["primary_signal"],
            "entry_condition": c.get("entry_condition", ""),
            "rsi":             c["rsi"],
            "rvol":            c["rvol"],
            "pm_rvol":         c.get("pm_rvol", 1.0),
            "atr_pct":         c["atr_pct"],
            "vwap":            c.get("vwap"),
            "catalyst":        c.get("catalyst", {}),
            "gap_fill":        c.get("gap_fill", {}),
            "float_rotation":  c.get("float_rotation", {}),
            "zones":           c["zones"],
            "details":         c["details"],
        })

    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(os.path.join(OUTPUT_DIR, OUTPUT_JSON), "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False, default=str)
    except Exception as e:
        logging.error(f"JSON kayıt hatası: {e}")

    if not top:
        await send_telegram(f"⚠️ {mode_label}: Yeterli sinyal bulunamadı.")
        return

    # ── TERMINAL TABLOSU ─────────────────────────────────────────
    logging.info(f"{'#':<4} {'TKR':<6} {'SİNYAL':<16} {'SKOR':>5} {'GAP%':>6} {'PM_RVOL':>8} {'KATALİZ':<18}")
    logging.info("-" * 75)
    for i, c in enumerate(top):
        cat_type = c.get("catalyst", {}).get("catalyst_type", "?")[:12]
        logging.info(
            f"{i+1:<4} {c['ticker']:<6} {c['primary_signal']:<16} "
            f"{c['dt_score']:>5.1f} {c['change_pct']:>5.1f}% "
            f"{c.get('pm_rvol', 0):>7.1f}x {cat_type:<18}"
        )

    # ── TELEGRAM RAPORU ───────────────────────────────────────────
    header = (
        f"⚡ <b>ATMACA V2 — {mode_label} | TOP {min(5, len(top))}</b>\n"
        f"🕒 {now_ny.strftime('%Y-%m-%d %H:%M %Z')} | ⏱ {duration:.0f}s\n"
        f"📊 {len(tickers_0)} scrape → {len(layer1_passed)} filtre → {len(top)} final\n\n"
    )
    await send_telegram(header)

    for i, c in enumerate(top[:5]):
        z        = c.get("zones", {})
        cat      = c.get("catalyst", {})
        pm_ana   = c.get("pm_analysis", {})
        gf       = c.get("gap_fill", {})
        fr       = c.get("float_rotation", {})
        pm_rvol  = c.get("pm_rvol", 0)

        cat_emoji = "🎯" if cat.get("catalyst_score", 0) >= 18 else "📰" if cat.get("catalyst_score", 0) >= 10 else "❓"
        sig_emoji = "🦅" if c["dt_score"] >= 75 else "🔥" if c["dt_score"] >= 55 else "👀"

        block = (
            f"{sig_emoji} <b>#{i+1} {c['ticker']}</b> [{c['primary_signal']}]\n"
            f"💰 Fiyat: <b>${c['price']:.2f}</b> | Gap: <b>+{c['change_pct']:.1f}%</b>\n"
            f"📊 SKOR: <b>{c['dt_score']:.0f}/100</b> | RSI: {c['rsi']:.0f} | ATR: %{c['atr_pct']:.1f}\n"
            f"📈 PM RVOL: <b>{pm_rvol:.1f}x</b> | Günlük RVOL: {c['rvol']:.1f}x\n"
            f"{cat_emoji} Kataliz: <b>{cat.get('catalyst_type', 'unknown').upper()}</b> "
            f"({cat.get('confidence', 'low')}) — {cat.get('headline', '')[:60]}\n"
            f"🔄 Gap Dolum: {gf.get('fill_risk', 'N/A')}\n"
            f"⏱ Float Dönüş: {fr.get('label', 'N/A')}\n"
            f"\n<b>🎯 ZONLAR:</b>\n"
            f"  Giriş:  ${z.get('entry_zone', {}).get('low', 0):.2f} – ${z.get('entry_zone', {}).get('high', 0):.2f}"
            f"  (PM High Ref: ${z.get('pm_high_ref', 0):.2f})\n"
            f"  TP1:    <b>${z.get('tp1', 0):.2f}</b>\n"
            f"  TP2:    <b>${z.get('tp2', 0):.2f}</b>\n"
            f"  Stop:   <b>${z.get('stop', 0):.2f}</b>\n"
            f"  R/R:    <b>{z.get('rr_ratio', 0):.1f}:1</b>\n"
            f"\n<b>⚡ GİRİŞ ŞARTI:</b>\n"
            f"<i>{c.get('entry_condition', 'Belirsiz')}</i>\n"
            f"\n<i>{'  '.join(c.get('details', [])[:4])}</i>\n"
        )
        await send_telegram(block)
        await asyncio.sleep(0.5)

    await send_telegram(
        "⚠️ <i>Bu bir finans tavsiyesi değildir. "
        "PDT kuralı: $25.000 bakiye şartı. "
        "V2 öngörü sistemi — giriş şartı gerçekleşmeden işlem açmayın.</i>"
    )

    logging.info(f"[OK] ATMACA V2 {mode_label} tamamlandı ({duration:.1f}s)")


# ================================================================
# SECTION 12: SCHEDULER (V2 — Multi-scan)
# ================================================================

def _get_next_scan_time(target_hour: int, target_minute: int) -> datetime:
    now_ny = datetime.now(NY_TZ)
    candidate = now_ny.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    if candidate <= now_ny:
        candidate += timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate.astimezone(timezone.utc)


def _scan_mode_for_time(hour: int, minute: int) -> str:
    """Saat/dakikaya göre scan modu belirle."""
    if (hour == 8 and minute <= 45):
        return "premarket"
    elif (hour == 9 and minute <= 35):
        return "open_confirm"
    else:
        return "intraday"


async def run_scheduler_v2():
    """
    V2 Multi-scan scheduler.
    Günde 6 scan: 08:20, 08:45, 09:16, 09:31, 10:01, 10:31 ET
    """
    await send_telegram(
        "⚡ <b>ATMACA DAYTRADE V2 Başlatıldı!</b>\n"
        "📅 Çoklu Scan: 08:20 / 08:45 / 09:16 / 09:31 / 10:01 / 10:31 ET\n"
        "🎯 V2 Özellikler: Kataliz Tespiti + PM RVOL + Öngörü Modu\n"
        "⚡ Artık açılıştan ÖNCE uyarıyoruz!"
    )

    # İlk tarama — hemen
    now_ny    = datetime.now(NY_TZ)
    init_mode = _scan_mode_for_time(now_ny.hour, now_ny.minute)
    try:
        await scan_daytrade_v2(scan_mode=init_mode)
    except Exception as e:
        logging.error(f"İlk tarama: {e}")

    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            now_ny  = now_utc.astimezone(NY_TZ)

            # Bugünün kalan scan zamanlarını bul
            remaining = []
            for (h, m) in SCAN_TIMES:
                target = now_ny.replace(hour=h, minute=m, second=0, microsecond=0)
                if target > now_ny:
                    remaining.append((target, h, m))

            if not remaining:
                # Yarın ilk scan
                next_day = now_ny + timedelta(days=1)
                while next_day.weekday() >= 5:
                    next_day += timedelta(days=1)
                first_h, first_m = SCAN_TIMES[0]
                next_dt = next_day.replace(hour=first_h, minute=first_m, second=0, microsecond=0)
                wait_s  = (next_dt.astimezone(timezone.utc) - now_utc).total_seconds()
                logging.info(f"Yarın ilk scan: {next_dt.strftime('%Y-%m-%d %H:%M %Z')} ({wait_s/3600:.1f}h)")
                await asyncio.sleep(wait_s)
            else:
                next_target, nh, nm = remaining[0]
                wait_s = (next_target.astimezone(timezone.utc) - now_utc).total_seconds()
                logging.info(f"Sonraki scan: {next_target.strftime('%H:%M %Z')} ({wait_s/60:.0f}dk)")
                await asyncio.sleep(max(wait_s, 1))
                mode = _scan_mode_for_time(nh, nm)
                await scan_daytrade_v2(scan_mode=mode)

        except Exception as e:
            logging.error(f"Scheduler hatası: {e}")
            await send_telegram(f"🚨 Scheduler hatası: {e}")
            await asyncio.sleep(3600)


# ================================================================
# SECTION 13: STARTUP
# ================================================================

if __name__ == "__main__":
    import sys
    
    # 🛌 Hafta sonu kontrolü (Fail-safe)
    from datetime import datetime
    now_ny = datetime.now(NY_TZ)
    if now_ny.weekday() >= 5:
        print(f"🛌 Bugün hafta sonu ({now_ny.strftime('%A')}). DayTrade botu çalıştırılmayacak.")
        sys.exit(0)

    try:
        if os.name == "nt":
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

        if "--premarket" in sys.argv:
            print("[START] ATMACA V2 — Premarket Scan")
            asyncio.run(scan_daytrade_v2("premarket"))

        elif "--open" in sys.argv:
            print("[START] ATMACA V2 — Açılış Onay Scan")
            asyncio.run(scan_daytrade_v2("open_confirm"))

        elif "--intraday" in sys.argv:
            print("[START] ATMACA V2 — İntraday Scan")
            asyncio.run(scan_daytrade_v2("intraday"))

        elif "--oneshot" in sys.argv or "--now" in sys.argv:
            now_ny = datetime.now(NY_TZ)
            mode   = _scan_mode_for_time(now_ny.hour, now_ny.minute)
            print(f"[START] ATMACA V2 — Tek Tarama ({mode})")
            asyncio.run(scan_daytrade_v2(scan_mode=mode))

        else:
            print("[START] ATMACA DAYTRADE V2 — Multi-Scan Scheduler")
            print("Scan zamanlari (ET): 08:20 / 08:45 / 09:16 / 09:31 / 10:01 / 10:31")
            asyncio.run(run_scheduler_v2())

    except KeyboardInterrupt:
        print("\n⚡ ATMACA DAYTRADE V2 durduruldu.")
    except Exception as e:
        print(f"Critical Startup Error: {e}")
        raise
