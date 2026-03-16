"""
Market Data API Router
Endpoints: indices, quotes, batch, sector performance, market regime, technical analysis
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

router = APIRouter()

ALL_DEFAULT_SYMBOLS = INDEX_SYMBOLS + CRYPTO_SYMBOLS + COMMODITY_SYMBOLS


@router.get("/indices")
async def get_indices():
    """Endeks, kripto ve emtia fiyatlarını getir (TopBar ticker strip)"""
    return get_batch_quotes(ALL_DEFAULT_SYMBOLS)


@router.get("/quote/{ticker}")
async def get_quote(ticker: str):
    """Tek bir hisse/endeks için detaylı bilgi getir"""
    data = get_ticker_info(ticker.upper())
    if "error" in data:
        raise HTTPException(status_code=404, detail=f"Ticker bulunamadı: {ticker}")
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
    """Teknik analiz göstergeleri: RSI, EMA, MACD, Bollinger, ADX, ATR, CMF, RVOL"""
    data = get_technical_analysis(ticker.upper())
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


@router.get("/analysis/{ticker}")
async def get_full_analysis(ticker: str):
    """Hisse için teknik + temel analiz birleşik rapor"""
    info = get_ticker_info(ticker.upper())
    technicals = get_technical_analysis(ticker.upper())
    if "error" in technicals:
        raise HTTPException(status_code=404, detail=technicals["error"])
    return {"info": info, "technicals": technicals}


@router.get("/sector-etfs")
async def get_sector_etf_list():
    """Sektör ETF eşleşmelerini getir"""
    return SECTOR_ETFS
