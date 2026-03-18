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
    INDEX_SYMBOLS,
    SECTOR_ETFS,
    CRYPTO_SYMBOLS,
    COMMODITY_SYMBOLS,
)
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
    """Endeks, kripto ve emtia fiyatlarını getir (TopBar ticker strip)"""
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


@router.get("/sectors")
def get_sectors(period: str = Query("1mo", description="Periyot: 1d, 5d, 1mo, 3mo, 6mo, 1y, ytd")):
    """Sektörel performans verilerini getir"""
    return get_sector_performance(period)


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


@router.get("/news/{ticker}")
def get_news(ticker: str, count: int = Query(10, le=20)):
    """Son haberleri getir"""
    return get_ticker_news(ticker.upper(), count)


@router.get("/news/latest")
def get_latest_market_news(limit: int = Query(50, le=100), category: Optional[str] = None):
    """En son piyasa ve ekonomi haberlerini (toplu) getir"""
    from app.database import NewsDB
    return NewsDB.get_latest(limit, category)


@router.get("/news/refresh")
def refresh_market_news():
    """Haber crawler'ını anlık olarak tetikle"""
    from app.services.market_data import update_all_market_news
    count = update_all_market_news()
    return {"status": "success", "count": count, "message": f"{count} yeni haber eklendi."}


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
def get_history(ticker: str):
    """Son 5 yıllık aylık ve yıllık fiyat geçmişi"""
    return get_price_history(ticker.upper())


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
def get_movers(period: str = Query("1d")):
    """En çok yükselen, düşen ve hacimli hisseleri getir"""
    return get_market_movers(period)
