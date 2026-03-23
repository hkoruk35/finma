"""
Market Data API Router — Cache-First Architecture

Flow:
  1. Supabase stock_cache tablosundan bak (< 10ms)
  2. Cache hit → anında döndür
  3. Cache miss → yfinance'ten hesapla, cache'e yaz, döndür
  4. Background worker her 5dk'da top 30 hisseyi yeniler

10000 concurrent user → hepsi cache'den döner
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
import json as _json
import os as _os
import time as _time
from app.services.market_data import (
    get_ticker_info,
    get_technical_analysis,
    get_sector_performance,
    get_market_regime,
    get_batch_quotes,
    search_tickers,
    get_price_changes,
    get_ticker_news,
    get_price_history,
    get_holders_info,
    get_market_movers,
    update_market_insiders,
    INDEX_SYMBOLS,
    SECTOR_ETFS,
    CRYPTO_SYMBOLS,
    COMMODITY_SYMBOLS,
)

# Bot output dosya yolları
_BOT_DIR = _os.path.abspath("bots/output")
_INDICES_904 = _os.path.join(_BOT_DIR, "indices_904.json")
_MOVERS_901  = _os.path.join(_BOT_DIR, "movers_901.json")
_DETAIL_907  = _os.path.join(_BOT_DIR, "detail_scan_907.json")
_FLOW_CACHE  = _os.path.join(_BOT_DIR, "flow_cache.json")

def _load_bot_file(path: str, max_age_sec: int = 300):
    """Bot çıktı dosyasını yükle, max_age_sec saniyeden eskiyse None döndür"""
    try:
        if not _os.path.exists(path):
            return None
        if _time.time() - _os.path.getmtime(path) > max_age_sec:
            return None
        with open(path, "r", encoding="utf-8") as f:
            return _json.load(f)
    except Exception:
        return None
from app.services.world_markets import get_world_market_data, get_world_analysis, get_exchange_analysis
from app.services.stock_cache import (
    get_cached_quote,
    get_cached_technicals,
    save_to_cache,
)

router = APIRouter()

ALL_DEFAULT_SYMBOLS = INDEX_SYMBOLS + CRYPTO_SYMBOLS + COMMODITY_SYMBOLS


@router.get("/indices")
def get_indices():
    """Endeks, kripto ve emtia fiyatlarını getir (TopBar ticker strip).
    Önce Bot 904 cache'i kontrol et (5dk TTL), miss'de yfinance'den canlı çek.
    SP500 (SPX) HER ZAMAN ilk sırada — ^GSPC kullanılmaz."""
    bot_data = _load_bot_file(_INDICES_904, max_age_sec=300)
    if bot_data and bot_data.get("indices"):
        return bot_data["indices"]
    # Fallback: canlı yfinance (SYMBOL_DISPLAY_MAP get_batch_quotes içinde uygulanır)
    return get_batch_quotes(ALL_DEFAULT_SYMBOLS)


@router.get("/quote/{ticker}")
def get_quote(ticker: str):
    """Cache-first hisse bilgisi — cache hit: <10ms, miss: 3-5sn"""
    t = ticker.upper()

    # 1. Cache'den bak
    cached = get_cached_quote(t)
    if cached:
        return cached

    # 2. Cache miss — live hesapla
    data = get_ticker_info(t)
    if "error" in data:
        raise HTTPException(status_code=404, detail=f"Ticker bulunamadı: {ticker}")

    # 3. Cache'e yaz (async olarak arka planda)
    try:
        save_to_cache(t, quote_data=data)
    except Exception:
        pass

    return data


@router.get("/batch")
def get_batch(tickers: str = Query(..., description="Virgülle ayrılmış ticker listesi")):
    """Virgülle ayrılmış birden fazla ticker için toplu fiyat getir"""
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(symbols) > 50:
        raise HTTPException(status_code=400, detail="Maksimum 50 ticker")
    return get_batch_quotes(symbols)


_SECTORS_CACHE_FILE = _os.path.join(_BOT_DIR, "sectors_cache.json")

def _load_sectors_file(period: str, max_age_sec: int = 300):
    """Sektör cache dosyasını oku. max_age_sec'dan eskiyse None."""
    try:
        if not _os.path.exists(_SECTORS_CACHE_FILE):
            return None
        if _time.time() - _os.path.getmtime(_SECTORS_CACHE_FILE) > max_age_sec:
            return None
        with open(_SECTORS_CACHE_FILE, "r", encoding="utf-8") as f:
            data = _json.load(f)
        return data.get(period)
    except Exception:
        return None

def _save_sectors_file(period: str, data):
    """Sektör verisini dosyaya yaz."""
    try:
        _os.makedirs(_BOT_DIR, exist_ok=True)
        existing = {}
        if _os.path.exists(_SECTORS_CACHE_FILE):
            with open(_SECTORS_CACHE_FILE, "r", encoding="utf-8") as f:
                existing = _json.load(f)
        existing[period] = data
        existing["_updated_at"] = _time.time()
        with open(_SECTORS_CACHE_FILE, "w", encoding="utf-8") as f:
            _json.dump(existing, f)
    except Exception:
        pass

@router.get("/sectors")
def get_sectors(period: str = Query("1d", description="Periyot: 1d, 5d, 1mo, 3mo, 6mo, 1y, ytd")):
    """Sektörel performans — cache-first: dosya (5dk TTL) → RAM cache → yfinance"""
    # 1. Dosya cache (5 dakika TTL — bot veya önceki istek tarafından yazılmış)
    from_file = _load_sectors_file(period, max_age_sec=300)
    if from_file:
        return from_file
    # 2. RAM cache veya yfinance hesapla
    result = get_sector_performance(period)
    # 3. Dosyaya yaz (sonraki istek anında gelir)
    if result:
        _save_sectors_file(period, result)
    return result


    # (get_movers was here, removed)


@router.get("/regime")
def get_regime():
    """Mevcut piyasa rejimini getir (Bull/Bear/Cautious)"""
    return get_market_regime()


@router.get("/technicals/{ticker}")
def get_technicals(ticker: str):
    """Cache-first teknik analiz — cache hit: <10ms, miss: 3-5sn"""
    t = ticker.upper()

    # 1. Cache'den bak
    cached = get_cached_technicals(t)
    if cached:
        return cached

    # 2. Cache miss — live hesapla
    data = get_technical_analysis(t)
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])

    # 3. Cache'e yaz
    try:
        save_to_cache(t, technicals_data=data)
    except Exception:
        pass

    return data


@router.get("/analysis/{ticker}")
def get_full_analysis(ticker: str):
    """Cache-first teknik + temel analiz birleşik rapor"""
    t = ticker.upper()

    # Try cache first
    cached_quote = get_cached_quote(t)
    cached_tech = get_cached_technicals(t)

    info = cached_quote or get_ticker_info(t)
    technicals = cached_tech or get_technical_analysis(t)

    if "error" in technicals:
        raise HTTPException(status_code=404, detail=technicals["error"])

    # Cache what we computed
    if not cached_quote and "error" not in info:
        try:
            save_to_cache(t, quote_data=info)
        except Exception:
            pass
    if not cached_tech:
        try:
            save_to_cache(t, technicals_data=technicals)
        except Exception:
            pass

    return {"info": info, "technicals": technicals}


@router.get("/sector-etfs")
async def get_sector_etf_list():
    """Sektör ETF eşleşmelerini getir"""
    return SECTOR_ETFS


@router.get("/search")
def search(q: str = Query(..., min_length=1, description="Arama terimi"), limit: int = Query(15, le=30)):
    """Ticker arama — hisse kodu, şirket adı, endeks ile eşleştir"""
    return search_tickers(q, limit)


@router.get("/price-changes/{ticker}")
def get_price_change_periods(ticker: str):
    """Haftalık, aylık, yıllık fiyat değişim oranları"""
    return get_price_changes(ticker.upper())


@router.get("/news/latest")
def get_latest_market_news(limit: int = Query(50, le=100), category: Optional[str] = None):
    """En son piyasa ve ekonomi haberlerini (toplu) getir"""
    from app.database import NewsDB
    news = NewsDB.get_latest(limit, category)
    
    # Haber yoksa anlık bir tarama tetikle (Boş sayfa kalmasın diye)
    if not news:
        try:
            from app.services.market_data import update_all_market_news
            update_all_market_news()
            news = NewsDB.get_latest(limit, category)
        except Exception:
            pass
            
    return news


@router.get("/news/refresh")
def refresh_market_news():
    """Haber crawler'ını anlık olarak tetikle"""
    from app.services.market_data import update_all_market_news
    count = update_all_market_news()
    return {"status": "success", "count": count, "message": f"{count} yeni haber eklendi."}


@router.get("/news/{ticker}")
def get_news(ticker: str, count: int = Query(10, le=20)):
    """Son haberleri getir"""
    return get_ticker_news(ticker.upper(), count)


@router.get("/insider/refresh")
def refresh_insider_data():
    """SEC crawler'ını anlık olarak tetikle ve veritabanını güncelle"""
    try:
        count = update_market_insiders()
        return {"status": "success", "count": count, "message": f"{count} yeni işlem eklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insider/latest")
def get_latest_insider_trades(limit: int = Query(50, le=100)):
    """En son yapılan insider işlemlerini (toplu) getir"""
    from app.database import InsiderDB
    return InsiderDB.get_latest(limit)


@router.get("/insider/{ticker}")
def get_insider(ticker: str, count: int = Query(10, le=20)):
    """Insider işlemlerini getir"""
    return get_insider_trades(ticker.upper(), count)


@router.get("/earnings/{ticker}")
def get_earnings(ticker: str):
    """Bilanço takvimi ve geçmiş sonuçları"""
    return get_earnings_calendar(ticker.upper())


@router.get("/history/{ticker}")
def get_history(
    ticker: str,
    period: str = Query("1y", description="1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max"),
    interval: str = Query("1d", description="1m|5m|15m|30m|1h|1d|1wk|1mo"),
):
    """OHLCV fiyat geçmişi — FinMAChart & grafik için"""
    import yfinance as yf
    import pandas as pd

    # Display adından gerçek yfinance ticker'ına çevir
    DISPLAY_TO_YF = {
        "SPX": "ES=F",    # S&P 500 Futures (^GSPC yerine)
        "DJI": "YM=F",    # Dow Jones Futures
        "NDX": "NQ=F",    # Nasdaq 100 Futures
        "RUT": "RTY=F",   # Russell 2000 Futures
        "VIX": "^VIX",    # VIX Index
        "BTC": "BTC-USD",
        "ETH": "ETH-USD",
        "GC":  "GC=F",    # Gold Futures
        "SI":  "SI=F",    # Silver Futures
        "CL":  "CL=F",    # Crude Oil Futures
    }
    real_ticker = DISPLAY_TO_YF.get(ticker.upper(), ticker.upper())

    try:
        t = yf.Ticker(real_ticker)
        hist = t.history(period=period, interval=interval)
        if hist is None or hist.empty:
            return {"history": [], "ticker": ticker.upper()}
        result = []
        for idx, row in hist.iterrows():
            ts = idx
            # Convert to unix timestamp (seconds) for lightweight-charts
            if hasattr(ts, 'timestamp'):
                time_val = int(ts.timestamp())
            else:
                time_val = str(ts.date()) if hasattr(ts, 'date') else str(ts)
            result.append({
                "time": time_val,
                "open": round(float(row["Open"]), 4) if pd.notna(row.get("Open")) else None,
                "high": round(float(row["High"]), 4) if pd.notna(row.get("High")) else None,
                "low": round(float(row["Low"]), 4) if pd.notna(row.get("Low")) else None,
                "close": round(float(row["Close"]), 4) if pd.notna(row.get("Close")) else None,
                "volume": int(row["Volume"]) if pd.notna(row.get("Volume")) else 0,
            })
        # Remove rows with null OHLC
        result = [r for r in result if r["open"] and r["close"]]
        return {"history": result, "ticker": ticker.upper(), "period": period, "interval": interval}
    except Exception as e:
        return {"history": [], "ticker": ticker.upper(), "error": str(e)}


@router.get("/holders/{ticker}")
def get_holders(ticker: str):
    """Kurumsal sahiplik ve büyük hissedarlar"""
    return get_holders_info(ticker.upper())


# ─── World Markets ───

@router.get("/world")
def get_world():
    """Dünya borsaları canlı verileri (30+ endeks + emtia/döviz/kripto)"""
    return get_world_market_data()


@router.get("/world/analysis")
async def get_world_ai_analysis():
    """AI destekli dünya piyasası istihbarat raporu"""
    return await get_world_analysis()


@router.get("/world/exchange/{exchange_id}")
async def get_exchange_detail(exchange_id: str):
    """Belirli bir borsa için detaylı AI analizi (açılış/gün ortası/kapanış + sektör/şirket + global etki)"""
    return await get_exchange_analysis(exchange_id)


@router.get("/movers")
def get_movers_v2(
    period: str = Query("1d"),
    limit: int = Query(10, ge=5, le=30),
):
    """
    Yükselenler/Düşenler/Hacim/Fırsatlar.
    Önce Bot 901 cache (5dk TTL), miss'de yfinance.
    """
    # 1. Bot 901 cache'den dene
    bot_data = _load_bot_file(_MOVERS_901, max_age_sec=300)
    if bot_data:
        gainers = bot_data.get("gainers", [])[:limit]
        losers  = bot_data.get("losers", [])[:limit]
        volume  = bot_data.get("volume", [])[:limit]
    else:
        # Fallback: yfinance canlı
        raw    = get_market_movers(period)
        gainers = raw.get("gainers", [])[:limit]
        losers  = raw.get("losers", [])[:limit]
        volume  = raw.get("most_active", raw.get("volume", []))[:limit]

    # 2. Opportunities (swing113)
    opportunities = []
    swing113_path = _os.path.join(_BOT_DIR, "swing113_latest.json")
    if _os.path.exists(swing113_path):
        try:
            with open(swing113_path, "r", encoding="utf-8") as f:
                data = _json.load(f)
            opportunities = data.get("opportunities", [])[:limit]
        except Exception:
            pass

    return {
        "gainers": gainers,
        "losers": losers,
        "volume": volume,
        "opportunities": opportunities,
        "timestamp": bot_data.get("updated_at") if bot_data else None,
        "period": period,
    }


@router.get("/analyzed-stocks")
def get_analyzed_stocks(
    source: str = Query("all", description="Filtre: all|swing113|gainer|loser|volume"),
    limit: int = Query(60, ge=1, le=60),
):
    """
    Bot 907 — 15 dakikada bir güncellenen 60 hisse teknik analiz sonuçları.
    Stock Analysis sayfası için kullanılır.
    """
    bot_data = _load_bot_file(_DETAIL_907, max_age_sec=1800)  # 30dk TTL
    if not bot_data:
        return {"stocks": [], "updated_at": None, "source": "none"}

    stocks = bot_data.get("stocks", [])

    if source != "all":
        stocks = [s for s in stocks if s.get("source") == source]

    stocks = stocks[:limit]
    return {
        "stocks": stocks,
        "updated_at": bot_data.get("updated_at"),
        "count": len(stocks),
        "source": source,
    }


# ─── Flow Bot Endpoints ───────────────────────────────────────────────────────

@router.get("/flow")
def get_flow_data():
    """
    Para akışı verileri — Flow Bot cache'den okur (4 saatte bir güncellenir).
    İçerik: sektör akışı, yükselenler/düşenler, unusual volume, insider işlemleri.
    """
    bot_data = _load_bot_file(_FLOW_CACHE, max_age_sec=14400 + 300)  # 4 saat + 5dk tolerans
    if not bot_data:
        # Dosya hiç yoksa veya çok eskiyse boş yapı döndür
        return {
            "updated_at": None,
            "updated_ts": None,
            "sector_flow": [],
            "gainers": [],
            "losers": [],
            "high_volume": [],
            "unusual_signals": [],
            "insiders": [],
            "summary": {
                "inflow_sectors": 0, "outflow_sectors": 0,
                "insider_buys": 0, "insider_sells": 0, "unusual_signals": 0
            },
            "stale": True,
        }
    return bot_data


@router.post("/flow/refresh")
def refresh_flow_data():
    """
    Flow Bot'u manuel tetikle (admin). Bot arka planda başlar, 3-5 dakikada tamamlanır.
    """
    try:
        from app.services.bot_runner import trigger_bot_manually
        ok = trigger_bot_manually("flow_bot")
        if ok:
            return {"status": "started", "message": "Flow bot başlatıldı — 3-5 dakika içinde veriler güncellenir."}
        else:
            return {"status": "error", "message": "flow_bot bulunamadı veya başlatılamadı."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bot başlatılamadı: {e}")
