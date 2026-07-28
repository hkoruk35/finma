# BOGA SCREENER v2 — TAM MİMARİ & GELİŞTİRME KILAVUZU

> **Versiyon:** 2.0.0  
> **Proje Kodu:** BOGA-SCR  
> **Amaç:** Setup-centric, AI destekli, gerçek zamanlı ABD hisse senedi karar motoru  
> **Temel Felsefe:** Filtre sistemi değil — İşlem fırsatı motoru

---

## İÇİNDEKİLER

1. [Proje Vizyonu & Felsefe](#1-proje-vizyonu--felsefe)
2. [Sistem Mimarisi Genel Bakış](#2-sistem-mimarisi-genel-bakış)
3. [Veri Katmanı](#3-veri-katmanı)
4. [Multi-Stage Filtreleme Motoru](#4-multi-stage-filtreleme-motoru)
5. [Preset Strateji Sistemi](#5-preset-strateji-sistemi)
6. [BOGA Score Algoritması](#6-boga-score-algoritması)
7. [Opsiyon Modülü](#7-opsiyon-modülü)
8. [Market Rejim Motoru](#8-market-rejim-motoru)
9. [Backend API Tasarımı (FastAPI)](#9-backend-api-tasarımı-fastapi)
10. [Frontend UI Mimarisi](#10-frontend-ui-mimarisi)
11. [Gerçek Zamanlı Engine](#11-gerçek-zamanlı-engine)
12. [Veritabanı Şeması](#12-veritabanı-şeması)
13. [Telegram Alert Sistemi](#13-telegram-alert-sistemi)
14. [BOGA Bot Entegrasyonu](#14-boga-bot-entegrasyonu)
15. [Deployment & Altyapı](#15-deployment--altyapı)
16. [Geliştirme Yol Haritası](#16-geliştirme-yol-haritası)
17. [Kritik Başarı Faktörleri](#17-kritik-başarı-faktörleri)

---

## 1. Proje Vizyonu & Felsefe

### 1.1 Problem Tanımı

Mevcut screener araçlarının (Finviz, TradingView vb.) temel sorunu şudur: kullanıcıyı filtre yazarı olmak zorunda bırakırlar. Yanlış kombinasyon, çöp sonuç üretir. Kurumsal karmaşıklık, operasyonel hızı yok eder.

```
MEVCUT DURUM (Finviz yaklaşımı)
────────────────────────────────
Kullanıcı → 40+ filtre seçer → Bekler → Ham liste gelir → Manuel analiz yapar → Belki işlem

HEDEF DURUM (BOGA yaklaşımı)
─────────────────────────────
Kullanıcı → SETUP seçer → Top 10 aday gelir → Giriş/Stop/Hedef hazır → İşlem
```

### 1.2 Temel Tasarım İlkeleri

**Setup-First Architecture:** Kullanıcı filtre kurmaz, setup seçer. Her preset, onlarca filtrenin önceden optimize edilmiş kombinasyonudur.

**Noise Reduction:** Yanlış pozitif (false positive) sayısını minimize etmek için Market Rejim motoru, setup ağırlıklarını dinamik olarak ayarlar. Çöpçü bir pazarda breakout sinyali vermez.

**Operasyonel Hazırlık:** Sistem sadece "bu hisse iyi görünüyor" demez. Giriş fiyatı, stop seviyesi, hedef ve R/R oranı hazır olarak sunar.

**AI Destekli Skor:** Kural tabanlı filtrelerin ötesinde, BOGA Score her adayı çok boyutlu değerlendirir.

### 1.3 Sistemin Rakiplerine Karşı Konumu

| Özellik | Finviz | TradingView | BOGA Screener |
|---|---|---|---|
| Yaklaşım | Filtre bazlı | Gösterge bazlı | Setup bazlı |
| Kullanıcı eylemi | 40+ filtre seçer | Script yazar | Preset'e basar |
| Çıktı | Ham liste | Grafik | Hazır trade planı |
| Opsiyon analizi | Temel | Yok | Entegre modül |
| Market rejim adaptasyonu | Yok | Manuel | Otomatik |
| BOGA Bot entegrasyonu | Yok | Yok | Native |
| Gerçek zamanlı | 15dk gecikme | Var (ücretli) | 5dk refresh |

---

## 2. Sistem Mimarisi Genel Bakış

### 2.1 Yüksek Seviyeli Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        KULLANICI KATMANI                        │
│   Web UI (React)    │    Telegram Bot    │    BOGA Bot API      │
└────────────┬────────────────┬────────────────────┬─────────────┘
             │                │                    │
             ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY (FastAPI)                    │
│  /api/scan  │  /api/score  │  /api/options  │  /api/regime     │
└────────────────────────────┬────────────────────────────────────┘
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  STAGE 1    │  │  STAGE 2    │  │  STAGE 3    │
    │  Universe   │  │   Trend     │  │  Momentum   │
    │  Reduction  │  │   Engine    │  │   Engine    │
    │ 8000→1500   │  │ 1500→300    │  │  300→50     │
    └─────────────┘  └─────────────┘  └─────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   STAGE 4       │
                    │   AI Ranking    │
                    │   50 → Top 10   │
                    │   BOGA Score    │
                    └─────────────────┘
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   PostgreSQL │  │    Redis    │  │  TimeSeries │
    │   Ana DB    │  │    Cache    │  │     DB      │
    └─────────────┘  └─────────────┘  └─────────────┘
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │   Yahoo     │  │  Polygon.io │  │   Tradier   │
    │  Finance    │  │  (opsiyonel)│  │  (opsiyonel)│
    └─────────────┘  └─────────────┘  └─────────────┘
```

### 2.2 Teknoloji Stack

**Backend:**
- Python 3.11+
- FastAPI (async API framework)
- yfinance (ana veri kaynağı)
- pandas + pandas_ta (teknik analiz)
- numpy (sayısal hesaplama)
- APScheduler (zamanlanmış görevler)
- Redis (cache & pub/sub)
- PostgreSQL (kalıcı depolama)
- SQLAlchemy (ORM)

**Frontend:**
- React 18 + TypeScript
- Zustand (state management)
- TanStack Query (veri fetching)
- Recharts (grafikler)
- Tailwind CSS

**DevOps:**
- Docker + Docker Compose
- Nginx (reverse proxy)
- GitHub Actions (CI/CD)

---

## 3. Veri Katmanı

### 3.1 Hisse Evreni Yönetimi

Sistemin çalışabilmesi için 8000+ hissenin evreni yönetilmelidir. Bu evren statik değildir; yeni listelemeler, delistingler ve korporatif aksiyonlara göre güncellenir.

**Evren Tanımları:**

```python
# config/universe.py

UNIVERSE_SOURCES = {
    "sp500":     "S&P 500 bileşenleri (~503 hisse)",
    "nasdaq100": "Nasdaq 100 bileşenleri (~100 hisse)",
    "russell2000": "Russell 2000 küçük cap (~2000 hisse)",
    "all_nyse":  "NYSE tam listesi (~3000 hisse)",
    "all_nasdaq": "NASDAQ tam listesi (~3200 hisse)",
    "otc_major": "OTC büyük pazar (~500 hisse)",
}

# Filtrelenen kategoriler (evren dışı)
EXCLUDE_CATEGORIES = [
    "ETF",           # Exchange Traded Fund
    "FUND",          # Yatırım fonu
    "WARRANT",       # Varant
    "RIGHT",         # Hak belgesi
    "UNIT",          # Trust unit
    "PREFERRED",     # İmtiyazlı hisse
]

# Minimum kalite kriterleri
MINIMUM_QUALIFIERS = {
    "min_price":        0.10,    # Minimum $0.10 fiyat
    "min_avg_volume":   10000,   # Minimum günlük 10K hacim
    "min_market_cap":   1_000_000,  # Minimum $1M market cap
    "max_spread_pct":   5.0,     # Maksimum %5 spread
}
```

**Evren Güncelleme Zamanlaması:**

- Tam güncelleme: Her Pazar gecesi 23:00 ET
- Delisting kontrolü: Her gün 08:00 ET
- Yeni listeleme ekleme: Gerçek zamanlı (Polygon webhook ile)

### 3.2 Veri Toplama Katmanı

```python
# data/collector.py

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import asyncio
from typing import List, Dict

class DataCollector:
    """
    Yahoo Finance üzerinden çok katmanlı veri toplama.
    Rate limiting ve retry mekanizması dahil.
    """
    
    def __init__(self, redis_client, db_session):
        self.redis = redis_client
        self.db = db_session
        self.rate_limit_delay = 0.1  # saniye
        
    async def fetch_batch_ohlcv(
        self, 
        tickers: List[str], 
        period: str = "6mo",
        interval: str = "1d"
    ) -> Dict[str, pd.DataFrame]:
        """
        Toplu OHLCV verisi çeker.
        Batch boyutu 100 ticker ile sınırlıdır (Yahoo rate limit).
        """
        results = {}
        batch_size = 100
        
        for i in range(0, len(tickers), batch_size):
            batch = tickers[i:i + batch_size]
            batch_str = " ".join(batch)
            
            try:
                data = yf.download(
                    batch_str,
                    period=period,
                    interval=interval,
                    group_by='ticker',
                    auto_adjust=True,
                    threads=True,
                    progress=False
                )
                
                for ticker in batch:
                    if ticker in data.columns.get_level_values(0):
                        results[ticker] = data[ticker].dropna()
                        
            except Exception as e:
                # Hata logla, batch'i atla
                self._log_error(f"Batch fetch hatası: {e}")
                
            await asyncio.sleep(self.rate_limit_delay)
            
        return results
    
    async def fetch_ticker_info(self, ticker: str) -> Dict:
        """
        Fundamental ve metadata bilgilerini çeker.
        Önce Redis cache'e bakar.
        """
        cache_key = f"info:{ticker}"
        cached = await self.redis.get(cache_key)
        
        if cached:
            return json.loads(cached)
            
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            
            # Sadece gerekli alanları al
            filtered_info = {
                "market_cap":    info.get("marketCap", 0),
                "float_shares":  info.get("floatShares", 0),
                "short_interest": info.get("shortPercentOfFloat", 0),
                "avg_volume":    info.get("averageVolume", 0),
                "beta":          info.get("beta", 1.0),
                "sector":        info.get("sector", "Unknown"),
                "industry":      info.get("industry", "Unknown"),
                "earnings_date": info.get("earningsDate", None),
                "options_exist": len(stock.options) > 0,
                "option_dates":  list(stock.options)[:10],  # İlk 10 tarih
            }
            
            # 4 saat cache
            await self.redis.setex(
                cache_key, 
                14400, 
                json.dumps(filtered_info)
            )
            
            return filtered_info
            
        except Exception as e:
            return {}
```

### 3.3 Teknik Gösterge Hesaplama

Bu katman tüm göstergeleri önceden hesaplar. Runtime'da hesaplama yapılmaz — bu kritik performans kuralıdır.

```python
# data/indicators.py

import pandas as pd
import pandas_ta as ta
import numpy as np
from dataclasses import dataclass

@dataclass
class IndicatorSet:
    """Bir hisse için hesaplanan tüm teknik göstergeler"""
    ticker: str
    
    # Hareketli Ortalamalar
    ema8:   float
    ema13:  float
    ema20:  float
    ema21:  float
    ema50:  float
    ema200: float
    sma20:  float
    sma50:  float
    sma200: float
    vwap:   float
    
    # Momentum
    rsi14:     float
    macd:      float
    macd_signal: float
    macd_hist: float
    roc10:     float      # Rate of Change 10 periyot
    
    # Volatilite
    atr14:     float
    atr14_pct: float      # ATR / Fiyat yüzdesi
    bb_upper:  float      # Bollinger Üst Band
    bb_lower:  float      # Bollinger Alt Band
    bb_pct:    float      # Bollinger %B
    bb_width:  float      # Bollinger Genişliği
    
    # Hacim
    rvol:        float    # Relative Volume (mevcut / 20 gün ort.)
    obv:         float    # On Balance Volume
    volume_sma20: float
    
    # Trend Gücü
    adx14:     float
    plus_di:   float
    minus_di:  float
    
    # Fiyat Yapısı
    close:     float
    prev_close: float
    high_52w:  float
    low_52w:   float
    pct_from_52w_high: float
    
    # Hesaplanmış Durumlar (boolean)
    is_above_sma200:   bool
    is_above_ema50:    bool
    is_ema20_above_ema50: bool
    is_ema50_above_ema200: bool
    is_macd_positive:  bool
    is_adx_trending:   bool    # ADX > 25
    is_bb_squeeze:     bool    # BB genişliği < 20 periyot ortalamasının %20'si
    is_near_high:      bool    # 52 haftalık yüksekten %5 içinde


class IndicatorCalculator:
    
    def calculate_all(self, df: pd.DataFrame, ticker: str) -> IndicatorSet:
        """
        Bir hisse için tüm göstergeleri hesaplar.
        df: OHLCV DataFrame, en az 200 satır gerektirir.
        """
        if len(df) < 200:
            return None
            
        close = df['Close']
        high = df['High']
        low = df['Low']
        volume = df['Volume']
        
        # Hareketli Ortalamalar
        ema8   = ta.ema(close, length=8).iloc[-1]
        ema13  = ta.ema(close, length=13).iloc[-1]
        ema20  = ta.ema(close, length=20).iloc[-1]
        ema21  = ta.ema(close, length=21).iloc[-1]
        ema50  = ta.ema(close, length=50).iloc[-1]
        ema200 = ta.ema(close, length=200).iloc[-1]
        sma20  = ta.sma(close, length=20).iloc[-1]
        sma50  = ta.sma(close, length=50).iloc[-1]
        sma200 = ta.sma(close, length=200).iloc[-1]
        
        # VWAP (son gün için yaklaşık)
        typical_price = (high + low + close) / 3
        vwap = (typical_price * volume).sum() / volume.sum()
        
        # Momentum
        rsi = ta.rsi(close, length=14)
        rsi14 = rsi.iloc[-1]
        
        macd_df = ta.macd(close, fast=12, slow=26, signal=9)
        macd_val    = macd_df['MACD_12_26_9'].iloc[-1]
        macd_signal = macd_df['MACDs_12_26_9'].iloc[-1]
        macd_hist   = macd_df['MACDh_12_26_9'].iloc[-1]
        
        roc10 = ta.roc(close, length=10).iloc[-1]
        
        # Volatilite
        atr14 = ta.atr(high, low, close, length=14).iloc[-1]
        atr14_pct = (atr14 / close.iloc[-1]) * 100
        
        bb = ta.bbands(close, length=20, std=2)
        bb_upper = bb['BBU_20_2.0'].iloc[-1]
        bb_lower = bb['BBL_20_2.0'].iloc[-1]
        bb_width = bb['BBB_20_2.0'].iloc[-1]
        bb_pct   = bb['BBP_20_2.0'].iloc[-1]
        
        # BB Squeeze tespiti
        bb_width_20_avg = bb['BBB_20_2.0'].rolling(20).mean().iloc[-1]
        is_bb_squeeze = bb_width < (bb_width_20_avg * 0.80)
        
        # Hacim
        vol_sma20 = volume.rolling(20).mean().iloc[-1]
        rvol = volume.iloc[-1] / vol_sma20 if vol_sma20 > 0 else 1.0
        obv = ta.obv(close, volume).iloc[-1]
        
        # Trend Gücü
        adx_df = ta.adx(high, low, close, length=14)
        adx14   = adx_df['ADX_14'].iloc[-1]
        plus_di  = adx_df['DMP_14'].iloc[-1]
        minus_di = adx_df['DMN_14'].iloc[-1]
        
        # Fiyat Yapısı
        current_close = close.iloc[-1]
        prev_close    = close.iloc[-2]
        high_52w = high.rolling(252).max().iloc[-1]
        low_52w  = low.rolling(252).min().iloc[-1]
        pct_from_52w_high = ((current_close - high_52w) / high_52w) * 100
        
        return IndicatorSet(
            ticker=ticker,
            ema8=ema8, ema13=ema13, ema20=ema20, ema21=ema21,
            ema50=ema50, ema200=ema200,
            sma20=sma20, sma50=sma50, sma200=sma200,
            vwap=vwap,
            rsi14=rsi14,
            macd=macd_val, macd_signal=macd_signal, macd_hist=macd_hist,
            roc10=roc10,
            atr14=atr14, atr14_pct=atr14_pct,
            bb_upper=bb_upper, bb_lower=bb_lower,
            bb_pct=bb_pct, bb_width=bb_width,
            rvol=rvol, obv=obv, volume_sma20=vol_sma20,
            adx14=adx14, plus_di=plus_di, minus_di=minus_di,
            close=current_close, prev_close=prev_close,
            high_52w=high_52w, low_52w=low_52w,
            pct_from_52w_high=pct_from_52w_high,
            is_above_sma200=(current_close > sma200),
            is_above_ema50=(current_close > ema50),
            is_ema20_above_ema50=(ema20 > ema50),
            is_ema50_above_ema200=(ema50 > ema200),
            is_macd_positive=(macd_val > 0),
            is_adx_trending=(adx14 > 25),
            is_bb_squeeze=is_bb_squeeze,
            is_near_high=(pct_from_52w_high > -5.0),
        )
```

---

## 4. Multi-Stage Filtreleme Motoru

### 4.1 Pipeline Genel Bakış

8000 hisseyi tek seferde taramak hesaplama açısından imkansızdır. Pipeline yaklaşımı her aşamada evreni küçültür:

```
Aşama 1: Universe Reduction    8.000 → 1.500   (~%80 eleme)
Aşama 2: Trend Engine          1.500 →   300   (~%80 eleme)
Aşama 3: Momentum Engine         300 →    50   (~%83 eleme)
Aşama 4: AI Ranking               50 → Top 10  (~%80 seçim)
─────────────────────────────────────────────────────────
Toplam tarama süresi hedefi: < 30 saniye
```

### 4.2 Aşama 1 — Universe Reduction

```python
# engines/stage1_universe.py

class UniverseReducer:
    """
    8000+ hisseyi temel kriterlere göre filtreler.
    Sadece cache'lenmiş verileri kullanır — yavaş API çağrısı yok.
    Hedef süre: < 2 saniye
    """
    
    PRICE_RANGES = {
        "sub1":   (0.10, 1.00),
        "1to5":   (1.00, 5.00),
        "5to10":  (5.00, 10.00),
        "10to20": (10.00, 20.00),
        "20to50": (20.00, 50.00),
        "50plus": (50.00, 99999),
    }
    
    MARKET_CAP_RANGES = {
        "nano":   (0,          50_000_000),
        "micro":  (50_000_000, 300_000_000),
        "small":  (300_000_000, 2_000_000_000),
        "mid":    (2_000_000_000, 10_000_000_000),
        "large":  (10_000_000_000, 200_000_000_000),
        "mega":   (200_000_000_000, 999_999_999_999),
    }
    
    LIQUIDITY_TIERS = {
        "low":         (0,           500_000),     # Günlük dolar hacmi
        "medium":      (500_000,     5_000_000),
        "high":        (5_000_000,   50_000_000),
        "institutional":(50_000_000,  999_999_999),
    }
    
    def filter(
        self,
        universe: List[Dict],
        price_range: str = None,
        market_cap: str = None,
        liquidity: str = None,
        options_filter: str = None,
    ) -> List[str]:
        
        filtered = []
        
        for stock in universe:
            price     = stock['last_price']
            mkt_cap   = stock['market_cap']
            dol_vol   = stock['dollar_volume_avg']  # 20 gün ort.
            has_weekly_opt = stock['has_weekly_options']
            
            # Fiyat filtresi
            if price_range:
                min_p, max_p = self.PRICE_RANGES[price_range]
                if not (min_p <= price < max_p):
                    continue
                    
            # Piyasa değeri filtresi
            if market_cap:
                min_cap, max_cap = self.MARKET_CAP_RANGES[market_cap]
                if not (min_cap <= mkt_cap < max_cap):
                    continue
                    
            # Likidite filtresi
            if liquidity:
                min_liq, max_liq = self.LIQUIDITY_TIERS[liquidity]
                if not (min_liq <= dol_vol < max_liq):
                    continue
                    
            # Opsiyon filtresi
            if options_filter == "weekly" and not has_weekly_opt:
                continue
            if options_filter == "none" and has_weekly_opt:
                continue
                
            filtered.append(stock['ticker'])
            
        return filtered
```

### 4.3 Aşama 2 — Trend Engine

```python
# engines/stage2_trend.py

class TrendEngine:
    """
    Aşama 1'den gelen listeyi trend yapısına göre filtreler.
    Cache'lenmiş göstergeler kullanır.
    Hedef süre: < 5 saniye
    """
    
    def filter_by_trend_mode(
        self, 
        tickers: List[str], 
        mode: str
    ) -> List[str]:
        
        passing = []
        
        for ticker in tickers:
            ind = self._get_cached_indicators(ticker)
            if not ind:
                continue
                
            if mode == "swing":
                if self._passes_swing_trend(ind):
                    passing.append(ticker)
                    
            elif mode == "day":
                if self._passes_day_trend(ind):
                    passing.append(ticker)
                    
            elif mode == "position":
                if self._passes_position_trend(ind):
                    passing.append(ticker)
                    
            elif mode == "mean_reversion":
                if self._passes_mean_reversion(ind):
                    passing.append(ticker)
                    
        return passing
    
    def _passes_swing_trend(self, ind: IndicatorSet) -> bool:
        """
        Swing trade için ana trend kriterleri.
        Kural: Uzun vadeli yükseliş trendinde, kısa vadeli momentum başlıyor.
        """
        return (
            ind.is_above_sma200 and           # Ana trend yukarı
            ind.is_ema20_above_ema50 and       # Kısa vadeli momentum pozitif
            ind.adx14 > 20 and                 # Trend gücü var
            ind.close > ind.ema50              # Fiyat destek üzerinde
        )
    
    def _passes_day_trend(self, ind: IndicatorSet) -> bool:
        """
        Day trade için kısa vadeli momentum kriterleri.
        Daha gevşek trend kriterleri, yüksek momentum odağı.
        """
        return (
            ind.close > ind.vwap and           # Güne güçlü başlamış
            ind.rvol > 1.5 and                 # Normal üstü hacim
            ind.atr14_pct > 3.0                # Yeterli günlük hareket potansiyeli
        )
    
    def _passes_position_trend(self, ind: IndicatorSet) -> bool:
        """
        Position trade için güçlü uzun vadeli trend kriterleri.
        """
        return (
            ind.is_above_sma200 and
            ind.is_ema50_above_ema200 and
            ind.is_ema20_above_ema50 and
            ind.adx14 > 25 and                 # Güçlü trend
            ind.pct_from_52w_high > -15.0      # 52 hafta yüksekten çok uzakta değil
        )
    
    def _passes_mean_reversion(self, ind: IndicatorSet) -> bool:
        """
        Mean reversion için aşırı satış kriterleri.
        """
        return (
            ind.rsi14 < 35 and                 # Aşırı satış
            ind.bb_pct < 0.20 and              # Bollinger alt bandı yakını
            ind.close > ind.sma200 * 0.85 and  # Ana trend bozulmamış
            ind.adx14 < 25                     # Güçlü trend yok (mean reversion geçerli)
        )
```

### 4.4 Aşama 3 — Momentum Engine

```python
# engines/stage3_momentum.py

class MomentumEngine:
    """
    Aşama 2'den gelen 300 hisseyi momentum kırılımlarına göre filtreler.
    50'ye indirir.
    """
    
    def filter_by_preset(
        self, 
        tickers: List[str], 
        preset: str
    ) -> List[str]:
        
        candidates = []
        
        for ticker in tickers:
            ind  = self._get_cached_indicators(ticker)
            info = self._get_cached_info(ticker)
            
            if not ind or not info:
                continue
                
            score = self._score_momentum(ind, info, preset)
            
            if score > 0:
                candidates.append({
                    'ticker': ticker,
                    'momentum_score': score
                })
                
        # Skora göre sırala, top 50 döndür
        candidates.sort(key=lambda x: x['momentum_score'], reverse=True)
        return [c['ticker'] for c in candidates[:50]]
    
    def _score_momentum(
        self, 
        ind: IndicatorSet, 
        info: Dict, 
        preset: str
    ) -> float:
        """
        Preset'e göre momentum skoru hesaplar.
        0 döndürülürse aday elenir.
        """
        score = 0.0
        
        # --- SWING CONTINUATION ---
        if preset == "swing_cont":
            if not (ind.is_above_sma200 and ind.is_ema20_above_ema50):
                return 0.0  # Zorunlu kriter
            
            # RSI ideal bölgede mi?
            if 55 <= ind.rsi14 <= 70:
                score += 25
            elif 50 <= ind.rsi14 < 55:
                score += 10
            else:
                return 0.0
                
            # RVOL bonusu
            if ind.rvol >= 2.0:
                score += 25
            elif ind.rvol >= 1.5:
                score += 15
            else:
                return 0.0
                
            # MACD pozitif
            if ind.is_macd_positive:
                score += 20
                
            # Yakın yüksek
            if ind.is_near_high:
                score += 15
                
            # ADX trend gücü
            if ind.adx14 > 30:
                score += 15
            elif ind.adx14 > 25:
                score += 10
                
        # --- EARLY BREAKOUT ---
        elif preset == "early_break":
            if not ind.is_bb_squeeze:
                return 0.0  # BB sıkışması zorunlu
                
            # Hacim genişlemesi başlamış mı?
            if ind.rvol >= 1.3:
                score += 30
            else:
                return 0.0
                
            # ADX düşük bölgeden yükseliyor mu?
            if 15 < ind.adx14 < 30:
                score += 20
                
            # EMA stack sıkışıyor mu?
            ema_spread = abs(ind.ema20 - ind.ema50) / ind.close * 100
            if ema_spread < 2.0:
                score += 25
                
        # --- DAY TRADE MOMENTUM ---
        elif preset == "day_mom":
            if ind.rvol < 3.0:
                return 0.0  # Yüksek hacim zorunlu
                
            # Float küçük mü?
            float_shares = info.get('float_shares', 999_000_000)
            if float_shares < 50_000_000:
                score += 30
            elif float_shares < 100_000_000:
                score += 15
            else:
                return 0.0
                
            # RVOL bonusu
            score += min(ind.rvol * 5, 40)
            
            # ATR yüksek mi?
            if ind.atr14_pct > 8:
                score += 20
                
        # --- OPTIONS SNIPER ---
        elif preset == "opt_sniper":
            if not info.get('options_exist'):
                return 0.0
                
            option_dates = info.get('option_dates', [])
            has_weekly = self._has_weekly_chain(option_dates)
            
            if not has_weekly:
                return 0.0
                
            # IV expansion beklentisi
            if ind.is_bb_squeeze:
                score += 30  # Squeeze → IV expansion gelecek
                
            if ind.rvol >= 1.5:
                score += 20
                
            if ind.atr14_pct > 5:
                score += 20
                
            # Gamma sweet spot (hisse hareketli mi?)
            if 40 <= ind.atr14_pct * 10 <= 120:
                score += 30
                
        return score
    
    def _has_weekly_chain(self, option_dates: List[str]) -> bool:
        """Haftalık opsiyon zinciri var mı kontrol eder."""
        from datetime import datetime, timedelta
        today = datetime.now()
        
        for date_str in option_dates[:6]:  # İlk 6 tarihe bak
            try:
                exp_date = datetime.strptime(date_str, "%Y-%m-%d")
                days_to_exp = (exp_date - today).days
                
                # 1-8 gün arası = haftalık
                if 1 <= days_to_exp <= 8:
                    return True
                    
            except:
                pass
                
        return False
```

---

## 5. Preset Strateji Sistemi

### 5.1 Strateji JSON Formatı

Stratejiler JSON tabanlıdır. UI otomatik oluşturulur, yeni strateji eklemek sadece JSON dosyasına bir blok eklemektir.

```json
{
  "presets": [
    {
      "id": "swing_cont",
      "name": "Swing Continuation",
      "category": "swing",
      "description": "Uzun vadeli yükseliş trendinde, kısa vadeli momentum kırılımı",
      "icon": "activity",
      "color": "blue",
      
      "required_filters": [
        {
          "field": "close",
          "operator": ">",
          "value": "sma200",
          "description": "Ana trend yukarı (Fiyat > SMA 200)",
          "is_critical": true
        },
        {
          "field": "ema20",
          "operator": ">",
          "value": "ema50",
          "description": "Kısa vadeli momentum pozitif (EMA 20 > EMA 50)",
          "is_critical": true
        },
        {
          "field": "rsi14",
          "operator": "between",
          "value": [55, 70],
          "description": "RSI momentum bölgesinde (55-70)",
          "is_critical": true
        },
        {
          "field": "rvol",
          "operator": ">",
          "value": 1.5,
          "description": "Normalin üstü hacim (RVOL > 1.5)",
          "is_critical": true
        }
      ],
      
      "bonus_filters": [
        {
          "field": "macd",
          "operator": ">",
          "value": 0,
          "description": "MACD pozitif",
          "score_bonus": 15
        },
        {
          "field": "adx14",
          "operator": ">",
          "value": 25,
          "description": "Güçlü trend (ADX > 25)",
          "score_bonus": 20
        },
        {
          "field": "close",
          "operator": "within_pct",
          "value": [52w_high, 5],
          "description": "52 hafta yüksekten %5 içinde",
          "score_bonus": 15
        }
      ],
      
      "reject_conditions": [
        {
          "field": "earnings_days_away",
          "operator": "<",
          "value": 3,
          "description": "Earnings 3 günden yakın — yüksek risk"
        },
        {
          "field": "rvol",
          "operator": "<",
          "value": 0.5,
          "description": "Ölü hacim — tuzak olabilir"
        }
      ],
      
      "score_weights": {
        "trend":     30,
        "momentum":  25,
        "volume":    25,
        "options":   20
      },
      
      "trade_plan": {
        "entry_method":   "breakout_of_day_high",
        "stop_method":    "below_ema20",
        "stop_buffer_pct": 0.5,
        "target_method":  "atr_multiplier",
        "target_atr_mult": 3.0,
        "min_rr":         2.0,
        "position_size_method": "risk_pct",
        "risk_pct":       1.0
      },
      
      "market_regime_adjustments": {
        "bull_trending":   {"weight_multiplier": 1.2, "rsi_range": [55, 75]},
        "bull_choppy":     {"weight_multiplier": 0.8, "rsi_range": [55, 68]},
        "bear_trending":   {"weight_multiplier": 0.3, "rsi_range": [58, 68]},
        "bear_choppy":     {"weight_multiplier": 0.1, "active": false}
      }
    },
    
    {
      "id": "early_breakout",
      "name": "Early Breakout Detector",
      "category": "swing",
      "description": "Henüz patlamayan, BB sıkışması içindeki kırılım adayları",
      
      "required_filters": [
        {"field": "bb_squeeze",    "operator": "==", "value": true,  "is_critical": true},
        {"field": "rvol",          "operator": ">",  "value": 1.3,   "is_critical": true},
        {"field": "adx14",         "operator": "between", "value": [12, 28], "is_critical": false}
      ],
      
      "score_weights": {
        "squeeze_intensity": 35,
        "volume_expansion":  30,
        "trend_alignment":   20,
        "options":           15
      },
      
      "trade_plan": {
        "entry_method":    "above_bb_upper",
        "stop_method":     "below_bb_lower",
        "target_method":   "measured_move",
        "min_rr":          2.5
      }
    },
    
    {
      "id": "day_momentum",
      "name": "Day Trade Momentum",
      "category": "day",
      "description": "Premarket gapper, yüksek RVOL, küçük float — gün içi momentum",
      
      "required_filters": [
        {"field": "rvol",          "operator": ">",   "value": 3.0,         "is_critical": true},
        {"field": "float_shares",  "operator": "<",   "value": 100_000_000, "is_critical": true},
        {"field": "atr14_pct",     "operator": ">",   "value": 5.0,         "is_critical": false}
      ],
      
      "score_weights": {
        "rvol":         35,
        "float_size":   25,
        "gap_strength": 25,
        "news_catalyst": 15
      },
      
      "trade_plan": {
        "entry_method":  "vwap_reclaim",
        "stop_method":   "below_vwap",
        "target_method": "atr_multiplier",
        "target_atr_mult": 2.0,
        "min_rr":         1.8
      }
    },
    
    {
      "id": "options_sniper",
      "name": "Options Sniper",
      "category": "options",
      "description": "Haftalık zincir, IV expansion beklentisi, gamma ivmesi",
      
      "required_filters": [
        {"field": "has_weekly_options", "operator": "==", "value": true, "is_critical": true},
        {"field": "bb_squeeze",         "operator": "==", "value": true, "is_critical": false},
        {"field": "rvol",               "operator": ">",  "value": 1.3,  "is_critical": false}
      ],
      
      "options_specific": {
        "min_open_interest":   500,
        "max_spread_pct":      10.0,
        "ideal_iv_percentile": [30, 60],
        "target_delta_range":  [0.30, 0.45],
        "max_dte":             14,
        "min_dte":             2
      },
      
      "score_weights": {
        "iv_setup":      30,
        "option_quality": 30,
        "price_setup":   25,
        "timing":        15
      }
    },
    
    {
      "id": "institutional_trend",
      "name": "Institutional Trend",
      "category": "position",
      "description": "Büyük cap, güçlü trend, kurumsal para akışı, RS vs SPY",
      
      "required_filters": [
        {"field": "market_cap",    "operator": ">", "value": 10_000_000_000, "is_critical": true},
        {"field": "adx14",         "operator": ">", "value": 25,             "is_critical": true},
        {"field": "is_above_sma200","operator":"==","value": true,           "is_critical": true}
      ],
      
      "score_weights": {
        "trend_quality":    35,
        "relative_strength": 30,
        "volume_quality":   20,
        "fundamentals":     15
      }
    },
    
    {
      "id": "gamma_squeeze",
      "name": "Gamma Squeeze Hunter",
      "category": "options",
      "description": "Yüksek short interest, call ağırlıklı OI, potansiyel gamma sıkışması",
      
      "required_filters": [
        {"field": "short_pct_float", "operator": ">", "value": 0.15,         "is_critical": true},
        {"field": "has_weekly_options","operator":"==","value": true,         "is_critical": true},
        {"field": "float_shares",    "operator": "<", "value": 75_000_000,   "is_critical": false}
      ],
      
      "options_specific": {
        "min_call_put_ratio": 1.5,
        "min_oi_increase_1d": 0.10,
        "gamma_exposure_threshold": 0.05
      },
      
      "score_weights": {
        "short_squeeze_potential": 35,
        "gamma_exposure":          35,
        "momentum":                20,
        "float_quality":           10
      }
    }
  ]
}
```

---

## 6. BOGA Score Algoritması

### 6.1 Skor Bileşenleri

BOGA Score, 0-100 arası bir birleşik puan sistemidir. Dört ana bileşenden oluşur:

```
BOGA SCORE = (Trend × W_t) + (Momentum × W_m) + (Options × W_o) + (Liquidity × W_l)

W_t + W_m + W_o + W_l = 100
```

**Ağırlıklar preset'e göre değişir:**

| Preset | Trend (W_t) | Momentum (W_m) | Options (W_o) | Liquidity (W_l) |
|---|---|---|---|---|
| Swing Cont. | 30 | 25 | 20 | 25 |
| Early Breakout | 25 | 35 | 15 | 25 |
| Day Momentum | 15 | 45 | 10 | 30 |
| Options Sniper | 20 | 20 | 45 | 15 |
| Institutional Trend | 40 | 20 | 15 | 25 |
| Gamma Squeeze | 15 | 25 | 45 | 15 |

### 6.2 Skor Hesaplama Detayı

```python
# scoring/boga_score.py

class BOGAScorer:
    
    def calculate(
        self, 
        ticker: str,
        indicators: IndicatorSet,
        info: Dict,
        options_data: Dict,
        preset: str,
        regime: str
    ) -> Dict:
        
        # Alt skorları hesapla
        trend_score     = self._trend_score(indicators)
        momentum_score  = self._momentum_score(indicators)
        options_score   = self._options_score(options_data, indicators)
        liquidity_score = self._liquidity_score(indicators, info)
        
        # Preset ağırlıklarını al
        weights = self._get_weights(preset)
        
        # Market rejim düzeltmesi
        regime_mult = self._regime_multiplier(regime, preset)
        
        # Birleşik skor
        raw_score = (
            trend_score     * weights['trend']     / 100 +
            momentum_score  * weights['momentum']  / 100 +
            options_score   * weights['options']   / 100 +
            liquidity_score * weights['liquidity'] / 100
        ) * regime_mult
        
        # 0-100 aralığına normalize et
        final_score = min(100, max(0, raw_score))
        
        return {
            'total': round(final_score, 1),
            'components': {
                'trend':     round(trend_score, 1),
                'momentum':  round(momentum_score, 1),
                'options':   round(options_score, 1),
                'liquidity': round(liquidity_score, 1),
            },
            'regime_multiplier': regime_mult,
            'grade': self._to_grade(final_score)
        }
    
    def _trend_score(self, ind: IndicatorSet) -> float:
        """Trend skoru: 0-100"""
        score = 0
        
        # EMA hizalanması (40 puan)
        if ind.ema8 > ind.ema13 > ind.ema21 > ind.ema50 > ind.ema200:
            score += 40   # Mükemmel hizalanma
        elif ind.ema20 > ind.ema50 > ind.ema200:
            score += 30   # İyi hizalanma
        elif ind.ema20 > ind.ema50:
            score += 20   # Kısmi hizalanma
        
        # SMA 200 üzeri (20 puan)
        if ind.is_above_sma200:
            score += 20
            
        # ADX trend gücü (20 puan)
        if ind.adx14 >= 35:
            score += 20
        elif ind.adx14 >= 25:
            score += 15
        elif ind.adx14 >= 20:
            score += 10
            
        # 52 hafta yüksekten yakınlık (20 puan)
        if ind.pct_from_52w_high >= -3:
            score += 20   # Çok yakın
        elif ind.pct_from_52w_high >= -8:
            score += 15
        elif ind.pct_from_52w_high >= -15:
            score += 10
            
        return min(100, score)
    
    def _momentum_score(self, ind: IndicatorSet) -> float:
        """Momentum skoru: 0-100"""
        score = 0
        
        # RVOL (30 puan)
        if ind.rvol >= 4.0:
            score += 30
        elif ind.rvol >= 2.5:
            score += 22
        elif ind.rvol >= 1.5:
            score += 15
        elif ind.rvol >= 1.0:
            score += 5
            
        # RSI bölgesi (25 puan)
        if 60 <= ind.rsi14 <= 72:
            score += 25   # İdeal momentum bölgesi
        elif 55 <= ind.rsi14 < 60:
            score += 18
        elif 50 <= ind.rsi14 < 55:
            score += 10
            
        # MACD (25 puan)
        if ind.macd > 0 and ind.macd_hist > 0:
            score += 25   # MACD pozitif ve yükselen
        elif ind.macd > 0:
            score += 15   # MACD pozitif ama düşüyor
        elif ind.macd_hist > 0:
            score += 10   # MACD negatif ama yükselen
            
        # ROC (20 puan)
        if ind.roc10 >= 8:
            score += 20
        elif ind.roc10 >= 5:
            score += 15
        elif ind.roc10 >= 2:
            score += 8
            
        return min(100, score)
    
    def _options_score(self, opt_data: Dict, ind: IndicatorSet) -> float:
        """Opsiyon kalite skoru: 0-100"""
        if not opt_data or not opt_data.get('has_options'):
            return 0
            
        score = 0
        
        # Haftalık zincir varlığı (30 puan)
        if opt_data.get('has_weekly'):
            score += 30
            
        # Open Interest kalitesi (25 puan)
        max_oi = opt_data.get('max_open_interest', 0)
        if max_oi >= 10000:
            score += 25
        elif max_oi >= 5000:
            score += 18
        elif max_oi >= 1000:
            score += 10
            
        # Spread kalitesi (25 puan)
        avg_spread_pct = opt_data.get('avg_spread_pct', 100)
        if avg_spread_pct <= 2:
            score += 25
        elif avg_spread_pct <= 5:
            score += 18
        elif avg_spread_pct <= 10:
            score += 10
            
        # IV expansion sinyali (20 puan)
        iv_percentile = opt_data.get('iv_percentile', 50)
        if 30 <= iv_percentile <= 60:
            score += 20   # IV expansion için ideal bölge
        elif iv_percentile < 30:
            score += 15   # Düşük IV — ucuz opsiyonlar
            
        return min(100, score)
    
    def _liquidity_score(self, ind: IndicatorSet, info: Dict) -> float:
        """Likidite skoru: 0-100"""
        score = 0
        
        # Dolar hacmi (40 puan)
        dol_vol = ind.close * ind.volume_sma20
        if dol_vol >= 50_000_000:
            score += 40
        elif dol_vol >= 10_000_000:
            score += 30
        elif dol_vol >= 5_000_000:
            score += 20
        elif dol_vol >= 1_000_000:
            score += 10
            
        # Market cap (35 puan)
        mkt_cap = info.get('market_cap', 0)
        if mkt_cap >= 10_000_000_000:
            score += 35
        elif mkt_cap >= 2_000_000_000:
            score += 28
        elif mkt_cap >= 500_000_000:
            score += 20
        elif mkt_cap >= 100_000_000:
            score += 12
            
        # RVOL katkısı (25 puan)
        if ind.rvol >= 3.0:
            score += 25
        elif ind.rvol >= 2.0:
            score += 18
        elif ind.rvol >= 1.5:
            score += 12
            
        return min(100, score)
    
    def _to_grade(self, score: float) -> str:
        if score >= 85: return "A+"
        if score >= 75: return "A"
        if score >= 65: return "B+"
        if score >= 55: return "B"
        if score >= 45: return "C"
        return "D"
```

---

## 7. Opsiyon Modülü

### 7.1 Opsiyon Zinciri Analizi

```python
# options/analyzer.py

import yfinance as yf
from datetime import datetime, timedelta
import numpy as np

class OptionsAnalyzer:
    """
    Opsiyon zinciri analizi ve kalite skorlaması.
    Primary: Yahoo Finance
    Fallback: Polygon.io (isteğe bağlı)
    """
    
    def analyze_chain(self, ticker: str) -> Dict:
        """
        Bir hisse için tam opsiyon analizi yapar.
        """
        try:
            stock = yf.Ticker(ticker)
            
            if not stock.options:
                return {"has_options": False}
                
            option_dates = list(stock.options)
            
            result = {
                "has_options":   True,
                "has_weekly":    self._detect_weekly(option_dates),
                "option_dates":  option_dates[:8],
                "chain_quality": 0,
                "iv_data":       {},
                "oi_data":       {},
                "greeks_approx": {},
            }
            
            # En yakın expiration'ı analiz et
            nearest_date = option_dates[0]
            chain = stock.option_chain(nearest_date)
            
            calls = chain.calls
            puts  = chain.puts
            
            # Open Interest analizi
            total_call_oi = calls['openInterest'].sum()
            total_put_oi  = puts['openInterest'].sum()
            max_oi = max(
                calls['openInterest'].max(),
                puts['openInterest'].max()
            )
            
            result['oi_data'] = {
                'total_call_oi':  int(total_call_oi),
                'total_put_oi':   int(total_put_oi),
                'call_put_ratio': round(total_call_oi / max(total_put_oi, 1), 2),
                'max_open_interest': int(max_oi),
                'max_pain':       self._calculate_max_pain(calls, puts),
            }
            
            # IV analizi
            current_price = stock.info.get('currentPrice', 0)
            atm_calls = calls[
                (calls['strike'] >= current_price * 0.97) &
                (calls['strike'] <= current_price * 1.03)
            ]
            
            if len(atm_calls) > 0:
                avg_iv = atm_calls['impliedVolatility'].mean() * 100
                avg_spread_pct = (
                    (atm_calls['ask'] - atm_calls['bid']) / 
                    atm_calls['ask'] * 100
                ).mean()
                
                result['iv_data'] = {
                    'current_iv':     round(avg_iv, 1),
                    'avg_spread_pct': round(avg_spread_pct, 1),
                }
                
            # Gamma yaklaşık hesabı (ATM için)
            result['greeks_approx'] = self._approximate_greeks(
                calls, current_price
            )
            
            # Zincir kalite skoru
            result['chain_quality'] = self._quality_score(result)
            
            return result
            
        except Exception as e:
            return {"has_options": False, "error": str(e)}
    
    def _detect_weekly(self, option_dates: List[str]) -> bool:
        """7 gün veya daha az uzakta opsiyon tarihi var mı?"""
        today = datetime.now()
        
        for date_str in option_dates[:5]:
            try:
                exp = datetime.strptime(date_str, "%Y-%m-%d")
                days = (exp - today).days
                if 1 <= days <= 7:
                    return True
            except:
                continue
                
        return False
    
    def _calculate_max_pain(self, calls: pd.DataFrame, puts: pd.DataFrame) -> float:
        """
        Max Pain hesaplar: opsiyon sahiplerinin en çok zarar ettiği fiyat.
        Bu fiyat, büyük oyuncuların hisseyi yönlendirdiği nokta olarak kullanılır.
        """
        strikes = set(calls['strike'].tolist() + puts['strike'].tolist())
        min_pain = float('inf')
        max_pain_strike = 0
        
        for test_price in strikes:
            call_pain = 0
            put_pain  = 0
            
            for _, row in calls.iterrows():
                if test_price > row['strike']:
                    call_pain += (test_price - row['strike']) * row['openInterest']
                    
            for _, row in puts.iterrows():
                if test_price < row['strike']:
                    put_pain += (row['strike'] - test_price) * row['openInterest']
                    
            total_pain = call_pain + put_pain
            
            if total_pain < min_pain:
                min_pain = total_pain
                max_pain_strike = test_price
                
        return max_pain_strike
    
    def _approximate_greeks(
        self, 
        calls: pd.DataFrame, 
        current_price: float
    ) -> Dict:
        """Delta ve gamma yaklaşık değerleri."""
        atm = calls[
            abs(calls['strike'] - current_price) == 
            abs(calls['strike'] - current_price).min()
        ]
        
        if len(atm) == 0:
            return {}
            
        iv = atm.iloc[0].get('impliedVolatility', 0.5)
        
        return {
            'approx_delta': round(0.50, 2),     # ATM delta her zaman ~0.50
            'approx_gamma': round(0.08 * iv, 3), # IV ile yaklaşık gamma
            'iv_atm':       round(iv * 100, 1),
        }
    
    def _quality_score(self, data: Dict) -> int:
        """Opsiyon zinciri kalite skoru: 0-100"""
        score = 0
        
        if data.get('has_weekly'):
            score += 30
        if data.get('oi_data', {}).get('max_open_interest', 0) >= 1000:
            score += 25
        if data.get('iv_data', {}).get('avg_spread_pct', 100) <= 5:
            score += 25
        if data.get('oi_data', {}).get('call_put_ratio', 0) >= 1.2:
            score += 20
            
        return min(100, score)
```

### 7.2 Trade Planı Oluşturma

```python
# options/trade_planner.py

class OptionsTradePlanner:
    """
    Hisse analizi + opsiyon verisi birleştirerek somut trade planı üretir.
    """
    
    def generate_plan(
        self,
        ticker: str,
        indicators: IndicatorSet,
        options: Dict,
        preset: str
    ) -> Dict:
        
        entry  = self._calculate_entry(indicators, preset)
        stop   = self._calculate_stop(indicators, preset, entry)
        target = self._calculate_target(indicators, preset, entry, stop)
        rr     = (target - entry) / (entry - stop) if entry > stop else 0
        
        # Opsiyon önerisi
        opt_rec = None
        if options.get('has_weekly') and preset in ['swing_cont', 'options_sniper', 'gamma_squeeze']:
            opt_rec = self._recommend_option(ticker, indicators, options, entry, target, stop)
            
        return {
            "entry":       round(entry, 2),
            "stop":        round(stop, 2),
            "target":      round(target, 2),
            "rr_ratio":    round(rr, 1),
            "rr_label":    f"{round(rr, 1)}x",
            "risk_pct":    round((entry - stop) / entry * 100, 1),
            "option_rec":  opt_rec,
            "warnings":    self._generate_warnings(indicators, options),
        }
    
    def _calculate_entry(self, ind: IndicatorSet, preset: str) -> float:
        if preset in ['swing_cont', 'institutional_trend']:
            # Günün yüksek üzeri breakout girişi
            return ind.close * 1.002   # %0.2 buffer
            
        elif preset == 'early_breakout':
            return ind.bb_upper * 1.001
            
        elif preset == 'day_momentum':
            return ind.vwap * 1.001    # VWAP üzeri giriş
            
        return ind.close
    
    def _calculate_stop(self, ind: IndicatorSet, preset: str, entry: float) -> float:
        if preset == 'swing_cont':
            # EMA 20 altı
            return min(ind.ema20 * 0.995, entry * 0.97)
            
        elif preset == 'early_breakout':
            return ind.bb_lower * 0.999
            
        elif preset == 'day_momentum':
            return ind.vwap * 0.995
            
        # Varsayılan: %3 stop
        return entry * 0.97
    
    def _calculate_target(
        self, 
        ind: IndicatorSet, 
        preset: str, 
        entry: float, 
        stop: float
    ) -> float:
        risk = entry - stop
        
        if preset in ['swing_cont', 'institutional_trend']:
            return entry + (risk * 3.0)  # 3:1 R/R hedefi
            
        elif preset == 'options_sniper':
            # Direnç bölgesi hedef
            return min(ind.bb_upper * 1.01, entry + risk * 3.5)
            
        return entry + (risk * 2.5)
    
    def _recommend_option(
        self, 
        ticker: str,
        ind: IndicatorSet,
        options: Dict,
        entry: float,
        target: float,
        stop: float
    ) -> Dict:
        """
        Swing setup için en uygun opsiyon önerisini üretir.
        """
        pct_move = (target - entry) / entry
        
        # Strike seçimi: ATM yakını, hedef yönünde hafif OTM
        recommended_strike = round(entry * 1.02, 0)   # %2 OTM call
        
        # DTE seçimi
        if options.get('has_weekly'):
            dte = 7   # Haftalık
        else:
            dte = 30  # Aylık
            
        return {
            "type":    "CALL",
            "strike":  recommended_strike,
            "dte":     dte,
            "reason":  f"ATM yakını, {dte} gün DTE, ${recommended_strike} strike",
            "target_pct_gain": round(pct_move * 4 * 100, 0),  # Yaklaşık 4x leverage
        }
    
    def _generate_warnings(self, ind: IndicatorSet, options: Dict) -> List[str]:
        warnings = []
        
        if ind.rsi14 > 75:
            warnings.append("RSI aşırı alım bölgesinde (%d) — giriş riskli" % ind.rsi14)
        if ind.atr14_pct > 10:
            warnings.append("Yüksek ATR (%.1f%%) — pozisyon boyutunu küçük tut" % ind.atr14_pct)
        if options.get('iv_data', {}).get('current_iv', 0) > 100:
            warnings.append("IV çok yüksek (%.0f%%) — opsiyon primleri pahalı" % options['iv_data']['current_iv'])
            
        return warnings
```

---

## 8. Market Rejim Motoru

### 8.1 Rejim Sınıflandırması

```python
# regime/detector.py

class MarketRegimeDetector:
    """
    Mevcut piyasa koşullarını tespit eder.
    Setup ağırlıklarını dinamik olarak ayarlar.
    """
    
    REGIMES = {
        "bull_trending":    "Güçlü yükseliş trendi",
        "bull_choppy":      "Yükselen ama çalkantılı",
        "neutral":          "Yatay / belirsiz",
        "bear_choppy":      "Düşen ama çalkantılı",
        "bear_trending":    "Güçlü düşüş trendi",
        "high_volatility":  "Yüksek oynaklık rejimi",
        "low_volatility":   "Düşük oynaklık / sıkışma",
    }
    
    def detect(self) -> Dict:
        spy_data = self._get_spy_indicators()
        vix_data = self._get_vix_data()
        breadth   = self._get_market_breadth()
        
        regime = self._classify(spy_data, vix_data, breadth)
        adjustments = self._get_adjustments(regime)
        
        return {
            "regime":      regime,
            "label":       self.REGIMES[regime],
            "spy_above_200sma": spy_data['above_200sma'],
            "vix":         vix_data['current'],
            "vix_trend":   vix_data['trend'],
            "advance_decline": breadth['ad_ratio'],
            "adjustments": adjustments,
        }
    
    def _classify(self, spy: Dict, vix: Dict, breadth: Dict) -> str:
        # Yüksek volatilite kontrolü
        if vix['current'] > 30:
            return "high_volatility"
            
        if vix['current'] < 15 and spy['adx'] < 20:
            return "low_volatility"
            
        # Trend yönü
        if spy['above_200sma']:
            if spy['adx'] >= 25 and breadth['ad_ratio'] > 1.3:
                return "bull_trending"
            else:
                return "bull_choppy"
        else:
            if spy['adx'] >= 25 and breadth['ad_ratio'] < 0.7:
                return "bear_trending"
            else:
                return "bear_choppy"
                
        return "neutral"
    
    def _get_adjustments(self, regime: str) -> Dict:
        """
        Her rejim için strateji ağırlık düzenlemeleri.
        """
        adjustments = {
            "bull_trending": {
                "swing_cont":          {"multiplier": 1.20, "note": "İdeal ortam"},
                "early_breakout":      {"multiplier": 1.15},
                "day_momentum":        {"multiplier": 1.10},
                "mean_reversion":      {"multiplier": 0.50, "note": "Düşük verim"},
                "gamma_squeeze":       {"multiplier": 1.00},
            },
            "bull_choppy": {
                "swing_cont":          {"multiplier": 0.85},
                "early_breakout":      {"multiplier": 1.00},
                "day_momentum":        {"multiplier": 0.90},
                "mean_reversion":      {"multiplier": 1.10},
                "gamma_squeeze":       {"multiplier": 0.80},
            },
            "bear_trending": {
                "swing_cont":          {"multiplier": 0.20, "note": "Devre dışı önerilir"},
                "early_breakout":      {"multiplier": 0.30},
                "day_momentum":        {"multiplier": 0.70, "note": "Yalnızca short"},
                "mean_reversion":      {"multiplier": 1.20, "note": "Oversold bounce"},
                "gamma_squeeze":       {"multiplier": 0.40},
            },
            "high_volatility": {
                "swing_cont":          {"multiplier": 0.50},
                "options_sniper":      {"multiplier": 1.30, "note": "Yüksek IV = pahalı prim"},
                "day_momentum":        {"multiplier": 1.40, "note": "Yüksek ATR fırsatı"},
                "mean_reversion":      {"multiplier": 1.10},
            },
            "low_volatility": {
                "early_breakout":      {"multiplier": 1.40, "note": "Sıkışma çözülmesi yakın"},
                "options_sniper":      {"multiplier": 1.30, "note": "Ucuz IV = ucuz opsiyonlar"},
                "swing_cont":          {"multiplier": 0.80, "note": "Düşük momentum"},
                "day_momentum":        {"multiplier": 0.50, "note": "Yetersiz ATR"},
            },
        }
        
        return adjustments.get(regime, {})
```

---

## 9. Backend API Tasarımı (FastAPI)

### 9.1 Ana Endpoint'ler

```python
# api/main.py

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import asyncio

app = FastAPI(
    title="BOGA Screener API",
    version="2.0.0",
    description="Setup-centric ABD hisse karar motoru"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── TARAMA ENDPOINT'İ ───────────────────────────────────────────

@app.get("/api/scan")
async def scan(
    preset:       str  = Query("swing_cont", description="Strateji preset ID"),
    mode:         str  = Query("swing",      description="İşlem modu"),
    price_range:  Optional[str] = Query(None, description="Fiyat aralığı"),
    market_cap:   Optional[str] = Query(None, description="Piyasa değeri"),
    liquidity:    Optional[str] = Query(None, description="Likidite kademesi"),
    options:      Optional[str] = Query(None, description="Opsiyon filtresi"),
    limit:        int  = Query(20, ge=1, le=100),
    regime_aware: bool = Query(True),
):
    """
    Ana tarama endpoint'i.
    Multi-stage pipeline çalıştırır ve hazır trade planları döndürür.
    """
    pipeline = ScanPipeline()
    
    results = await pipeline.run(
        preset=preset,
        mode=mode,
        filters={
            "price_range":  price_range,
            "market_cap":   market_cap,
            "liquidity":    liquidity,
            "options":      options,
        },
        limit=limit,
        regime_aware=regime_aware,
    )
    
    return {
        "status":    "success",
        "timestamp": datetime.now().isoformat(),
        "regime":    results['regime'],
        "count":     len(results['candidates']),
        "candidates": results['candidates'],
    }


# ─── BOGA SCORE ENDPOINT'İ ──────────────────────────────────────

@app.get("/api/score/{ticker}")
async def get_score(
    ticker: str,
    preset: str = Query("swing_cont"),
):
    """
    Belirli bir hisse için detaylı BOGA Score döndürür.
    """
    scorer = BOGAScorer()
    result = await scorer.analyze_ticker(ticker.upper(), preset)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"{ticker} bulunamadı")
        
    return result


# ─── OPSİYON ANALİZ ENDPOINT'İ ──────────────────────────────────

@app.get("/api/options/{ticker}")
async def get_options(ticker: str):
    """
    Tam opsiyon zinciri analizi ve trade planı önerisi.
    """
    analyzer = OptionsAnalyzer()
    result = await analyzer.analyze_chain(ticker.upper())
    return result


# ─── MARKET REJİM ENDPOINT'İ ─────────────────────────────────────

@app.get("/api/regime")
async def get_regime():
    """
    Mevcut piyasa rejimi ve strateji önerileri.
    """
    detector = MarketRegimeDetector()
    return detector.detect()


# ─── CANLIYKEN HIZLI SKOR ─────────────────────────────────────────

@app.get("/api/watchlist/score")
async def score_watchlist(
    tickers: str = Query(..., description="Virgülle ayrılmış tickerlar"),
    preset:  str = Query("swing_cont"),
):
    """
    Watchlist hisselerini hızlıca skorlar.
    Maks 20 ticker.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",")][:20]
    scorer = BOGAScorer()
    
    tasks = [scorer.analyze_ticker(t, preset) for t in ticker_list]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    valid = [r for r in results if isinstance(r, dict)]
    valid.sort(key=lambda x: x['total_score'], reverse=True)
    
    return {"results": valid}


# ─── PRESET LİSTESİ ──────────────────────────────────────────────

@app.get("/api/presets")
async def list_presets():
    """
    Mevcut preset stratejileri döndürür.
    """
    return {"presets": PRESET_CONFIG['presets']}
```

### 9.2 Response Formatları

```python
# api/schemas.py

from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class ScoreComponents(BaseModel):
    trend:     float
    momentum:  float
    options:   float
    liquidity: float

class TradePlan(BaseModel):
    entry:       float
    stop:        float
    target:      float
    rr_ratio:    float
    rr_label:    str
    risk_pct:    float
    option_rec:  Optional[Dict]
    warnings:    List[str]

class CandidateResult(BaseModel):
    ticker:          str
    company_name:    str
    total_score:     float
    grade:           str             # A+, A, B+, B, C, D
    score_components: ScoreComponents
    
    # Fiyat bilgisi
    last_price:      float
    change_pct:      float
    rvol:            float
    
    # Teknik
    trend_direction: str             # up, down, neutral
    ema_alignment:   str             # perfect, good, partial, none
    rsi:             float
    
    # Opsiyon
    has_weekly_options: bool
    options_quality:    int           # 0-100
    
    # Trade planı
    trade_plan:      TradePlan
    
    # Setup etiketi
    primary_setup:   str
    setup_signals:   List[str]       # Aktif sinyaller listesi
    
    # Meta
    sector:          str
    market_cap:      int
    last_updated:    datetime

class ScanResponse(BaseModel):
    status:      str
    timestamp:   str
    regime:      Dict
    count:       int
    candidates:  List[CandidateResult]
```

---

## 10. Frontend UI Mimarisi

### 10.1 Component Yapısı

```
src/
├── components/
│   ├── cockpit/
│   │   ├── TopBar.tsx           # Logo, piyasa durumu, SPY/QQQ/VIX
│   │   ├── MarketUniverseBar.tsx # Fiyat/Cap/Likidite/Opsiyon seçiciler
│   │   ├── LeftPanel.tsx        # Mod switcher + preset listesi
│   │   ├── MainTable.tsx        # Ana sonuç tablosu
│   │   ├── ExpandedRow.tsx      # Tıklanınca açılan detay satırı
│   │   ├── Toolbar.tsx          # Aktif filtre pills + tara butonu
│   │   └── RegimeBar.tsx        # Alt market rejim çubuğu
│   │
│   ├── analysis/
│   │   ├── ScoreCard.tsx        # BOGA Score görsel kartı
│   │   ├── TradePlanCard.tsx    # Giriş/Stop/Hedef/R:R
│   │   ├── OptionsCard.tsx      # Opsiyon kalitesi ve önerisi
│   │   └── TechnicalCard.tsx    # EMA/SMA/RSI gösterge kartı
│   │
│   └── shared/
│       ├── ScoreBar.tsx         # Progress bar + renk
│       ├── TrendIcon.tsx        # ↑ ↓ → ikon bileşeni
│       ├── Badge.tsx            # Setup badge (swing/day/options)
│       └── FilterPill.tsx       # Aktif filtre etiketi
│
├── stores/
│   ├── screenerStore.ts         # Ana state (Zustand)
│   ├── settingsStore.ts         # Kullanıcı tercihleri
│   └── regimeStore.ts           # Market rejim state
│
├── hooks/
│   ├── useScan.ts               # Tarama API hook
│   ├── useScore.ts              # Tek ticker skor hook
│   ├── useOptions.ts            # Opsiyon analiz hook
│   └── useRegime.ts             # Market rejim hook (auto-refresh)
│
└── api/
    ├── client.ts                # Axios instance
    └── endpoints.ts             # Tüm API çağrıları
```

### 10.2 State Yönetimi

```typescript
// stores/screenerStore.ts

import { create } from 'zustand'

interface ScreenerState {
  // Filtre state
  selectedPreset:    string
  selectedMode:      string
  priceRange:        string | null
  marketCap:         string | null
  liquidity:         string | null
  optionsFilter:     string | null
  
  // Sonuçlar
  candidates:        CandidateResult[]
  isLoading:         boolean
  lastScanTime:      Date | null
  
  // UI state
  expandedTicker:    string | null
  sortColumn:        string
  sortDirection:     'asc' | 'desc'
  
  // Actions
  setPreset:         (preset: string) => void
  setMode:           (mode: string) => void
  togglePriceRange:  (range: string) => void
  runScan:           () => Promise<void>
  expandRow:         (ticker: string | null) => void
  sortBy:            (column: string) => void
}

export const useScreenerStore = create<ScreenerState>((set, get) => ({
  selectedPreset:  'swing_cont',
  selectedMode:    'swing',
  priceRange:      null,
  marketCap:       null,
  liquidity:       null,
  optionsFilter:   null,
  candidates:      [],
  isLoading:       false,
  lastScanTime:    null,
  expandedTicker:  null,
  sortColumn:      'total_score',
  sortDirection:   'desc',
  
  setPreset: (preset) => {
    set({ selectedPreset: preset })
    // Preset değişince otomatik tara
    get().runScan()
  },
  
  runScan: async () => {
    const state = get()
    set({ isLoading: true })
    
    try {
      const response = await scanAPI({
        preset:      state.selectedPreset,
        mode:        state.selectedMode,
        price_range: state.priceRange,
        market_cap:  state.marketCap,
        liquidity:   state.liquidity,
        options:     state.optionsFilter,
      })
      
      set({ 
        candidates:   response.candidates,
        lastScanTime: new Date(),
        isLoading:    false
      })
      
    } catch (err) {
      set({ isLoading: false })
    }
  },
  
  // ... diğer action'lar
}))
```

---

## 11. Gerçek Zamanlı Engine

### 11.1 Zamanlama & Refresh Stratejisi

```python
# scheduler/realtime_engine.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import pytz

ET = pytz.timezone('America/New_York')

class RealtimeEngine:
    """
    Piyasa saatlerine göre farklı refresh stratejileri uygular.
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone=ET)
        self._setup_jobs()
        
    def _setup_jobs(self):
        
        # ─── PREMARKET (04:00 - 09:30 ET) ───────────────────────
        self.scheduler.add_job(
            self.premarket_scan,
            'cron',
            hour='4-9',
            minute='*/5',    # Her 5 dakikada bir
            id='premarket',
        )
        
        # ─── AÇILIŞ YOĞUNLUK DÖNEMİ (09:30 - 10:30 ET) ─────────
        self.scheduler.add_job(
            self.open_high_frequency_scan,
            'cron',
            hour='9',
            minute='30-59',  # 30-59. dakikalar
            id='open_hf',
        )
        self.scheduler.add_job(
            self.open_high_frequency_scan,
            'cron',
            hour='10',
            minute='0-30',   # İlk yarım saat
            id='open_hf2',
        )
        
        # ─── NORMAL SEANS (10:30 - 15:30 ET) ─────────────────────
        self.scheduler.add_job(
            self.regular_scan,
            'cron',
            hour='10-15',
            minute='*/10',   # Her 10 dakika
            id='regular',
        )
        
        # ─── KAPANIŞ ÖNCESİ (15:30 - 16:00 ET) ──────────────────
        self.scheduler.add_job(
            self.close_scan,
            'cron',
            hour='15',
            minute='30-59',
            id='close',
        )
        
        # ─── GECE GÜNCELLEMELERİ ─────────────────────────────────
        self.scheduler.add_job(
            self.nightly_full_refresh,
            'cron',
            hour=22,         # 22:00 ET
            id='nightly',
        )
        
        # ─── HAFTALIK EVREN GÜNCELLEMESİ ─────────────────────────
        self.scheduler.add_job(
            self.weekly_universe_update,
            'cron',
            day_of_week='sun',
            hour=23,
            id='weekly',
        )
    
    async def premarket_scan(self):
        """
        Premarket odağı:
        - Büyük gap'lar (>4%)
        - Haber katalisti olanlar
        - Earnings öncesi/sonrası
        """
        pass
    
    async def nightly_full_refresh(self):
        """
        Gece tam yenileme:
        1. Tüm OHLCV verilerini çek
        2. Tüm göstergeleri yeniden hesapla
        3. Tüm fundamental verileri güncelle
        4. Opsiyon zincirlerini kontrol et
        5. Cache'i temizle ve yenile
        """
        pass
```

### 11.2 Cache Stratejisi

```python
# cache/strategy.py

CACHE_TTL = {
    # Göstergeler — 5 dakikada bir yenilenir
    "indicators:{ticker}":    300,     # 5 dakika
    
    # Fundamental bilgi — 4 saatte bir
    "info:{ticker}":          14400,   # 4 saat
    
    # Opsiyon özeti — 15 dakikada bir
    "options:{ticker}":       900,     # 15 dakika
    
    # Tarama sonuçları — preset bazlı
    "scan:{preset}:{filters_hash}": 300,  # 5 dakika
    
    # Market rejimi — 5 dakikada bir
    "regime:current":         300,
    
    # Hisse evreni listesi — günlük
    "universe:full":          86400,   # 24 saat
    "universe:active":        3600,    # 1 saat
}
```

---

## 12. Veritabanı Şeması

### 12.1 PostgreSQL Şema

```sql
-- Hisse ana tablosu
CREATE TABLE stocks (
    id              SERIAL PRIMARY KEY,
    ticker          VARCHAR(10) UNIQUE NOT NULL,
    company_name    VARCHAR(200),
    sector          VARCHAR(100),
    industry        VARCHAR(200),
    exchange        VARCHAR(20),
    is_active       BOOLEAN DEFAULT true,
    has_options     BOOLEAN DEFAULT false,
    has_weekly_options BOOLEAN DEFAULT false,
    market_cap      BIGINT,
    float_shares    BIGINT,
    short_pct_float DECIMAL(5,4),
    avg_volume_20d  BIGINT,
    beta            DECIMAL(5,2),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Günlük OHLCV verileri
CREATE TABLE daily_ohlcv (
    id          BIGSERIAL PRIMARY KEY,
    ticker      VARCHAR(10) REFERENCES stocks(ticker),
    date        DATE NOT NULL,
    open        DECIMAL(12,4),
    high        DECIMAL(12,4),
    low         DECIMAL(12,4),
    close       DECIMAL(12,4),
    volume      BIGINT,
    adj_close   DECIMAL(12,4),
    UNIQUE(ticker, date)
);

-- Hesaplanmış teknik göstergeler (günlük snapshot)
CREATE TABLE daily_indicators (
    id              BIGSERIAL PRIMARY KEY,
    ticker          VARCHAR(10) REFERENCES stocks(ticker),
    date            DATE NOT NULL,
    
    -- EMA
    ema8            DECIMAL(12,4),
    ema13           DECIMAL(12,4),
    ema20           DECIMAL(12,4),
    ema21           DECIMAL(12,4),
    ema50           DECIMAL(12,4),
    ema200          DECIMAL(12,4),
    
    -- SMA
    sma20           DECIMAL(12,4),
    sma50           DECIMAL(12,4),
    sma200          DECIMAL(12,4),
    
    -- Momentum
    rsi14           DECIMAL(6,2),
    macd            DECIMAL(12,6),
    macd_signal     DECIMAL(12,6),
    macd_hist       DECIMAL(12,6),
    roc10           DECIMAL(8,4),
    
    -- Volatilite
    atr14           DECIMAL(12,4),
    atr14_pct       DECIMAL(6,2),
    bb_upper        DECIMAL(12,4),
    bb_lower        DECIMAL(12,4),
    bb_width        DECIMAL(8,4),
    bb_pct          DECIMAL(6,4),
    
    -- Hacim
    rvol            DECIMAL(8,4),
    
    -- Trend
    adx14           DECIMAL(6,2),
    plus_di         DECIMAL(6,2),
    minus_di        DECIMAL(6,2),
    
    -- Boolean durumlar
    is_above_sma200 BOOLEAN,
    is_ema20_above_ema50 BOOLEAN,
    is_bb_squeeze   BOOLEAN,
    
    UNIQUE(ticker, date)
);

-- BOGA Score geçmişi
CREATE TABLE boga_scores (
    id              BIGSERIAL PRIMARY KEY,
    ticker          VARCHAR(10) REFERENCES stocks(ticker),
    date            DATE NOT NULL,
    preset          VARCHAR(50),
    total_score     DECIMAL(5,1),
    trend_score     DECIMAL(5,1),
    momentum_score  DECIMAL(5,1),
    options_score   DECIMAL(5,1),
    liquidity_score DECIMAL(5,1),
    regime          VARCHAR(30),
    grade           VARCHAR(3),
    UNIQUE(ticker, date, preset)
);

-- Market rejim geçmişi
CREATE TABLE market_regime_history (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMP NOT NULL,
    regime      VARCHAR(30),
    spy_price   DECIMAL(10,2),
    spy_sma200  DECIMAL(10,2),
    vix         DECIMAL(6,2),
    adv_decline DECIMAL(6,3)
);

-- Tarama geçmişi (audit trail)
CREATE TABLE scan_history (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMP DEFAULT NOW(),
    preset      VARCHAR(50),
    filters     JSONB,
    result_count INT,
    top_results JSONB,    -- Top 10 ticker array
    regime      VARCHAR(30),
    duration_ms INT
);

-- İndeksler
CREATE INDEX idx_daily_ohlcv_ticker_date ON daily_ohlcv(ticker, date DESC);
CREATE INDEX idx_daily_indicators_ticker ON daily_indicators(ticker, date DESC);
CREATE INDEX idx_boga_scores_date_preset ON boga_scores(date, preset, total_score DESC);
```

---

## 13. Telegram Alert Sistemi

### 13.1 Alert Motoru

```python
# alerts/telegram_bot.py

from telegram import Bot
from telegram.constants import ParseMode

class BOGATelegramAlerter:
    """
    Tarama sonuçlarını Telegram'a gönderir.
    BOGA Bot ile entegre çalışır.
    """
    
    def __init__(self, bot_token: str, channel_id: str):
        self.bot = Bot(token=bot_token)
        self.channel_id = channel_id
        
    async def send_scan_results(
        self, 
        candidates: List[CandidateResult],
        preset: str,
        regime: Dict
    ):
        """Top 3 adayı formatlanmış mesaj olarak gönderir."""
        
        if not candidates:
            return
            
        top3 = candidates[:3]
        
        # Rejim başlığı
        regime_emoji = {
            "bull_trending":  "🟢",
            "bull_choppy":    "🟡",
            "neutral":        "⚪",
            "bear_choppy":    "🟠",
            "bear_trending":  "🔴",
            "high_volatility": "⚡",
            "low_volatility":  "😴",
        }.get(regime['regime'], "⚪")
        
        header = (
            f"🤖 *BOGA SCREENER — {preset.upper()}*\n"
            f"{regime_emoji} Rejim: {regime['label']}\n"
            f"🕐 {datetime.now().strftime('%H:%M ET')}\n"
            f"{'─' * 30}\n\n"
        )
        
        body = ""
        for i, c in enumerate(top3, 1):
            plan = c['trade_plan']
            score_bar = "█" * int(c['total_score'] / 10) + "░" * (10 - int(c['total_score'] / 10))
            
            body += (
                f"*{i}. ${c['ticker']}* — {c['company_name']}\n"
                f"📊 Skor: `{c['total_score']}` [{score_bar}]\n"
                f"💵 Fiyat: `${c['last_price']:.2f}` ({c['change_pct']:+.2f}%)\n"
                f"📈 RVOL: `{c['rvol']:.1f}x`\n"
                f"🎯 Giriş: `${plan['entry']:.2f}` → Hedef: `${plan['target']:.2f}`\n"
                f"🛑 Stop: `${plan['stop']:.2f}` | R/R: `{plan['rr_label']}`\n"
            )
            
            if c['has_weekly_options']:
                body += f"⚡ Haftalık opsiyon zinciri mevcut\n"
                
            if plan['warnings']:
                body += f"⚠️ {plan['warnings'][0]}\n"
                
            body += "\n"
            
        message = header + body
        
        await self.bot.send_message(
            chat_id=self.channel_id,
            text=message,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def send_alert(
        self, 
        ticker: str, 
        alert_type: str,
        details: Dict
    ):
        """Anlık tekil alert gönderir."""
        
        icons = {
            "ema_cross":       "⚡ EMA CROSSOVER",
            "breakout":        "🚀 KIRILIM",
            "squeeze_release": "💥 BB SQUEEZE ÇÖZÜLDÜ",
            "high_rvol":       "🔥 AŞIRI HACİM",
            "gamma_spike":     "🎰 GAMMA ARTIŞI",
        }
        
        icon_label = icons.get(alert_type, "📡 SİNYAL")
        
        message = (
            f"{icon_label}: *${ticker}*\n\n"
            f"💵 Fiyat: `${details['price']:.2f}`\n"
            f"📊 BOGA Score: `{details['score']}`\n"
            f"📈 RVOL: `{details['rvol']:.1f}x`\n"
            f"🎯 Giriş: `${details['entry']:.2f}`\n"
            f"🛑 Stop: `${details['stop']:.2f}`\n"
            f"🏆 Hedef: `${details['target']:.2f}`\n"
        )
        
        await self.bot.send_message(
            chat_id=self.channel_id,
            text=message,
            parse_mode=ParseMode.MARKDOWN
        )
```

---

## 14. BOGA Bot Entegrasyonu

### 14.1 Screener → BOGA Bot JSON Formatı

```python
# integration/boga_bot_bridge.py

class BOGABotBridge:
    """
    BOGA Screener sonuçlarını BOGA Bot'un beklediği
    JSON formatına dönüştürür.
    """
    
    def candidate_to_bot_format(
        self, 
        candidate: CandidateResult
    ) -> Dict:
        """
        swing115_boga.py'nin beklediği format.
        """
        plan = candidate['trade_plan']
        
        return {
            "ticker":        candidate['ticker'],
            "source":        "BOGA_SCREENER_v2",
            "setup_type":    candidate['primary_setup'],
            "boga_score":    candidate['total_score'],
            "signal_time":   datetime.now().isoformat(),
            
            # Fiyat bilgisi
            "last_price":    candidate['last_price'],
            "rvol":          candidate['rvol'],
            
            # Trade parametreleri (bot direkt kullanır)
            "entry_price":   plan['entry'],
            "stop_loss":     plan['stop'],
            "target_price":  plan['target'],
            "rr_ratio":      plan['rr_ratio'],
            "risk_pct":      plan['risk_pct'],
            
            # Opsiyon parametreleri
            "options": {
                "has_weekly":   candidate['has_weekly_options'],
                "quality_score": candidate['options_quality'],
                "recommendation": plan.get('option_rec'),
            },
            
            # Teknik context
            "technicals": {
                "rsi":          candidate['rsi'],
                "trend":        candidate['trend_direction'],
                "ema_alignment": candidate['ema_alignment'],
            },
            
            # Meta
            "preset":        candidate.get('preset_used'),
            "regime":        candidate.get('regime'),
            "warnings":      plan['warnings'],
        }
    
    def batch_export(
        self, 
        candidates: List[CandidateResult],
        output_file: str = None
    ) -> str:
        """
        Toplu export — BOGA Bot'un watchlist JSON'u olarak kaydeder.
        """
        export_data = {
            "metadata": {
                "generated_by":  "BOGA_SCREENER_v2",
                "timestamp":     datetime.now().isoformat(),
                "total_candidates": len(candidates),
            },
            "candidates": [
                self.candidate_to_bot_format(c) 
                for c in candidates
            ]
        }
        
        json_str = json.dumps(export_data, indent=2)
        
        if output_file:
            with open(output_file, 'w') as f:
                f.write(json_str)
                
        return json_str
```

---

## 15. Deployment & Altyapı

### 15.1 Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  
  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://boga:password@postgres:5432/boga_screener
      - REDIS_URL=redis://redis:6379
      - TELEGRAM_TOKEN=${TELEGRAM_TOKEN}
      - TELEGRAM_CHANNEL=${TELEGRAM_CHANNEL}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
    command: uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
    
  scheduler:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://boga:password@postgres:5432/boga_screener
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    command: python -m scheduler.main
    
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:8000
    depends_on:
      - api
      
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=boga_screener
      - POSTGRES_USER=boga
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/db/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./certbot/conf:/etc/letsencrypt
    depends_on:
      - api
      - frontend

volumes:
  postgres_data:
  redis_data:
```

### 15.2 Performans Hedefleri

| Metrik | Hedef | Açıklama |
|---|---|---|
| Tam tarama süresi | < 30 sn | 8000 hisse, tüm pipeline |
| API response time | < 500 ms | Cache hit durumunda |
| API response time | < 5 sn | Cache miss, taze tarama |
| Veri güncellik | ≤ 5 dakika | Seans saatlerinde |
| Uptime | > 99.5% | Aylık SLA |
| Premarket veri | 04:00 ET | Her iş günü |

---

## 16. Geliştirme Yol Haritası

### Faz 1 — MVP (2-3 Hafta)

**Hedef:** Çalışan, gerçek veriyle beslenen temel screener

```
✅ Tamamlanacaklar:
   □ Python environment kurulumu
   □ yfinance entegrasyonu
   □ pandas_ta ile gösterge hesaplama
   □ Swing Continuation preset çalışır hale getirme
   □ FastAPI temel endpoint'ler (/scan, /score)
   □ Redis cache kurulumu
   □ React UI temel bileşenler
   □ Gece batch yenileme
```

**Test Kriterleri:**
- 500 büyük cap hissede swing_cont taraması çalışıyor
- Sonuçlar 10 saniye içinde geliyor
- Trade planı (giriş/stop/hedef) doğru hesaplanıyor

### Faz 2 — Core Feature Set (3-4 Hafta)

```
□ Tüm 8 preset aktif
□ Opsiyon modülü temel analiz
□ Market rejim tespiti
□ Telegram alert sistemi
□ Full universe (8000+ hisse) desteği
□ Multi-stage pipeline optimizasyonu
□ PostgreSQL tam şema
□ Docker compose deployment
```

### Faz 3 — Advanced Features (4-6 Hafta)

```
□ BOGA Score v2 (ML bileşeni)
□ Opsiyon greeks hesaplama (yaklaşık)
□ Gamma exposure haritası
□ Earnings takvimi entegrasyonu
□ Dark pool akış sinyalleri
□ Sektör relatif güç analizi
□ Backtesting modülü
□ BOGA Bot direkt entegrasyonu
```

### Faz 4 — Production Hardening

```
□ Rate limiting ve güvenlik
□ Monitoring ve alerting (Grafana)
□ Otomatik failover
□ Performans profiling
□ Load testing
□ Kapsamlı hata yönetimi
□ Kullanıcı yetkilendirme (opsiyonel)
```

---

## 17. Kritik Başarı Faktörleri

### 17.1 Teknik Başarı Kriterleri

**Cache-First Mimari:** Runtime'da asla ham hesaplama yapma. Tüm göstergeler önceden hesaplanmış olmalı. Bu kural çiğnendikçe sistem yavaşlar ve kullanılamaz hale gelir.

**Pipeline Disiplini:** Multi-stage filtreleme sırası korunmalı. Stage 1'i atlamak Stage 2'yi 5x yavaşlatır. Her aşama bir sonraki için evren boyutunu öngörülen oranda küçültmeli.

**Rejim Farkındalığı:** Market rejim kontrolü olmadan sistem aşırı yanlış pozitif üretir. Güçlü düşüş trendinde breakout sinyali vermemelidir.

**Opsiyon Kalitesi Kontrolü:** Opsiyon kalite skoru < 30 olan hisseler için opsiyon önerisi yapma. Geniş spread, düşük OI = tuzak.

### 17.2 Operasyonel Başarı Kriterleri

**Sinyalin Eyleme Hazır Olması:** Sistem "bu hisse potansiyel" diyemez. Giriş fiyatı, stop seviyesi, hedef fiyatı, pozisyon büyüklüğü ve R/R oranı hazır sunulmalıdır.

**False Positive Yönetimi:** Her setup için reject_conditions listesi kapsamlı tutulmalı. Earnings yaklaşımı, düşük likidite ve aşırı yayılmış spread otomatik elenmelidir.

**BOGA Bot Uyumluluğu:** Screener çıktısı, bot'un direkt işlem parametresi olarak kullanabilceği formatta olmalı. Manuel çeviri gerektirmemelidir.

### 17.3 Sistemin Asla Yapmaması Gerekenler

1. Earnings 3 günden yakın olan hisseye swing sinyali verme
2. Günlük dolar hacmi < $500K olan hissede opsiyon önerisi yapma
3. VIX > 35 iken agresif breakout stratejisi aktif tutma
4. Yüksek IV ortamında opsiyon alımını önerme (sat tarafını değerlendir)
5. Tüm setup'ları eşit ağırlıkla çalıştırma — market rejimi her zaman ağırlıkları ayarlamalı

---

*Bu doküman BOGA Screener v2 projesinin tam teknik referansıdır. Faz 1 başlangıcı için önce `3. Veri Katmanı` ve `4. Multi-Stage Filtreleme Motoru` bölümlerini implemente et.*

---

**Son güncelleme:** 2025  
**Versiyon:** 2.0.0  
**Proje:** BOGA-SCR
