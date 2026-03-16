"""
Market Data API Router — Cache-First Architecture

Flow:
  1. Supabase stock_cache tablosundan bak (< 10ms)
  2. Cache hit → anında döndür
  3. Cache miss → yfinance'ten hesapla, cache'e yaz, döndür
  4. Background worker her 5dk'da top 30 hisseyi yeniler

10000 concurrent user → hepsi cache'den döner
"""

from fastapi import APIRouter, HTTPException, Query
from app.services.market_data import (
    get_ticker_info,
    get_technical_analysis,
    get_sector_performance,
    get_market_regime,
    get_batch_quotes,
    INDEX_SYMBOLS,
    SECTOR_ETFS,
    CRYPTO_SYMBOLS,
    COMMODITY_SYMBOLS,
)
from app.services.stock_cache import (
    get_cached_quote,
    get_cached_technicals,
    save_to_cache,
)

router = APIRouter()

ALL_DEFAULT_SYMBOLS = INDEX_SYMBOLS + CRYPTO_SYMBOLS + COMMODITY_SYMBOLS


@router.get("/indices")
async def get_indices():
    """Endeks, kripto ve emtia fiyatlarını getir (TopBar ticker strip)"""
    return get_batch_quotes(ALL_DEFAULT_SYMBOLS)


@router.get("/quote/{ticker}")
async def get_quote(ticker: str):
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
async def get_batch(tickers: str = Query(..., description="Virgülle ayrılmış ticker listesi")):
    """Virgülle ayrılmış birden fazla ticker için toplu fiyat getir"""
    symbols = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if len(symbols) > 50:
        raise HTTPException(status_code=400, detail="Maksimum 50 ticker")
    return get_batch_quotes(symbols)


@router.get("/sectors")
async def get_sectors(period: str = Query("1mo", description="Periyot: 1d, 5d, 1mo, 3mo, 6mo, 1y, ytd")):
    """Sektörel performans verilerini getir"""
    return get_sector_performance(period)


@router.get("/regime")
async def get_regime():
    """Mevcut piyasa rejimini getir (Bull/Bear/Cautious)"""
    return get_market_regime()


@router.get("/technicals/{ticker}")
async def get_technicals(ticker: str):
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
async def get_full_analysis(ticker: str):
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
