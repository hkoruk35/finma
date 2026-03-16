"""
Market Data Service - Ported from data_engine.py
yfinance wrapper with technical indicators (RSI, EMA, ADX, ATR, RVOL, CMF, Bollinger)
"""

import yfinance as yf
import pandas as pd
import numpy as np
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from functools import lru_cache

logger = logging.getLogger(__name__)

# ─── Sector ETF Mappings ───
SECTOR_ETFS = {
    "Technology": "XLK",
    "Energy": "XLE",
    "Financials": "XLF",
    "Healthcare": "XLV",
    "Consumer Discretionary": "XLY",
    "Industrials": "XLI",
    "Materials": "XLB",
    "Communication Services": "XLC",
    "Real Estate": "XLRE",
    "Utilities": "XLU",
    "Consumer Staples": "XLP",
}

INDEX_SYMBOLS = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX"]
CRYPTO_SYMBOLS = ["BTC-USD", "ETH-USD"]
COMMODITY_SYMBOLS = ["GC=F", "SI=F", "CL=F"]

# Turkish sector names
SECTOR_TR = {
    "Technology": "Teknoloji",
    "Energy": "Enerji",
    "Financials": "Finans",
    "Healthcare": "Sağlık",
    "Consumer Discretionary": "Tüketici İhtiyari",
    "Industrials": "Sanayi",
    "Materials": "Hammadde",
    "Communication Services": "İletişim Hizmetleri",
    "Real Estate": "Gayrimenkul",
    "Utilities": "Kamu Hizmetleri",
    "Consumer Staples": "Temel Tüketim",
}


# ─── Technical Indicators ───

def calc_ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calc_adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average Directional Index"""
    high, low, close = df["High"], df["Low"], df["Close"]
    plus_dm = high.diff()
    minus_dm = low.diff().abs()
    plus_dm[plus_dm < 0] = 0
    minus_dm[minus_dm < 0] = 0

    atr = calc_atr(df, period)
    plus_di = 100 * calc_ema(plus_dm, period) / atr
    minus_di = 100 * calc_ema(minus_dm, period) / atr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    adx = calc_ema(dx, period)
    return adx


def calc_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range"""
    high, low, close = df["High"], df["Low"], df["Close"]
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()


def calc_bollinger(series: pd.Series, period: int = 20, std_dev: float = 2.0):
    """Bollinger Bands: upper, middle, lower, bandwidth, %b"""
    middle = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    bandwidth = (upper - lower) / middle * 100
    pct_b = (series - lower) / (upper - lower)
    return upper, middle, lower, bandwidth, pct_b


def calc_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """MACD: macd_line, signal_line, histogram"""
    ema_fast = calc_ema(series, fast)
    ema_slow = calc_ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calc_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calc_cmf(df: pd.DataFrame, period: int = 20) -> pd.Series:
    """Chaikin Money Flow"""
    mfm = ((df["Close"] - df["Low"]) - (df["High"] - df["Close"])) / (df["High"] - df["Low"])
    mfm = mfm.fillna(0)
    mfv = mfm * df["Volume"]
    cmf = mfv.rolling(window=period).sum() / df["Volume"].rolling(window=period).sum()
    return cmf


def calc_obv(df: pd.DataFrame) -> pd.Series:
    """On-Balance Volume"""
    obv = (np.sign(df["Close"].diff()) * df["Volume"]).fillna(0).cumsum()
    return obv


def calc_rvol(df: pd.DataFrame, period: int = 20) -> float:
    """Relative Volume (current vs average)"""
    if len(df) < period + 1:
        return 1.0
    avg_vol = df["Volume"].iloc[-(period + 1):-1].mean()
    current_vol = df["Volume"].iloc[-1]
    return round(current_vol / avg_vol, 2) if avg_vol > 0 else 1.0


# ─── Data Fetching ───

def get_ticker_data(ticker: str, period: str = "6mo", interval: str = "1d") -> Optional[pd.DataFrame]:
    """Fetch OHLCV data for a ticker"""
    try:
        df = yf.download(ticker, period=period, interval=interval, progress=False)
        if df.empty:
            return None
        # Handle multi-level columns from yfinance
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df
    except Exception as e:
        logger.error(f"Veri çekilemedi {ticker}: {e}")
        return None


def get_ticker_info(ticker: str) -> Dict[str, Any]:
    """Get comprehensive ticker info"""
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fast = t.fast_info

        price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
        prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
        change = price - prev if prev else 0
        change_pct = (change / prev * 100) if prev else 0

        return {
            "symbol": ticker.upper(),
            "name": info.get("shortName") or info.get("longName", ticker),
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume": info.get("volume"),
            "market_cap": info.get("marketCap"),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "ps_ratio": info.get("priceToSalesTrailing12Months"),
            "pb_ratio": info.get("priceToBook"),
            "dividend_yield": info.get("dividendYield"),
            "roe": info.get("returnOnEquity"),
            "debt_to_equity": info.get("debtToEquity"),
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth": info.get("earningsGrowth"),
            "profit_margin": info.get("profitMargins"),
            "beta": info.get("beta"),
            "avg_volume": info.get("averageVolume"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "target_mean": info.get("targetMeanPrice"),
            "target_high": info.get("targetHighPrice"),
            "target_low": info.get("targetLowPrice"),
            "analyst_rating": info.get("recommendationKey"),
            "analyst_count": info.get("numberOfAnalystOpinions"),
            "institutional_pct": info.get("heldPercentInstitutions"),
        }
    except Exception as e:
        logger.error(f"Ticker bilgisi alınamadı {ticker}: {e}")
        return {"symbol": ticker.upper(), "error": str(e)}


def get_technical_analysis(ticker: str) -> Dict[str, Any]:
    """Full technical analysis for a ticker"""
    df = get_ticker_data(ticker, period="1y")
    if df is None or len(df) < 50:
        return {"error": "Yetersiz veri"}

    close = df["Close"]
    current_price = float(close.iloc[-1])

    # EMAs
    ema20 = calc_ema(close, 20)
    ema50 = calc_ema(close, 50)
    ema200 = calc_ema(close, 200)

    # RSI
    rsi = calc_rsi(close)

    # MACD
    macd_line, signal_line, histogram = calc_macd(close)

    # Bollinger Bands
    bb_upper, bb_middle, bb_lower, bb_bandwidth, bb_pctb = calc_bollinger(close)

    # ADX
    adx = calc_adx(df)

    # ATR
    atr = calc_atr(df)

    # CMF
    cmf = calc_cmf(df)

    # RVOL
    rvol = calc_rvol(df)

    # Trend determination
    ema20_val = float(ema20.iloc[-1])
    ema50_val = float(ema50.iloc[-1])
    ema200_val = float(ema200.iloc[-1]) if len(ema200.dropna()) > 0 else 0

    if current_price > ema20_val > ema50_val > ema200_val:
        trend = "Güçlü Yükseliş"
        trend_score = 5
    elif current_price > ema50_val:
        trend = "Yükseliş"
        trend_score = 4
    elif current_price > ema200_val:
        trend = "Nötr-Pozitif"
        trend_score = 3
    elif current_price < ema20_val < ema50_val < ema200_val:
        trend = "Güçlü Düşüş"
        trend_score = 1
    elif current_price < ema50_val:
        trend = "Düşüş"
        trend_score = 2
    else:
        trend = "Nötr"
        trend_score = 3

    # Support / Resistance (simple pivot)
    recent = df.tail(20)
    support = float(recent["Low"].min())
    resistance = float(recent["High"].max())

    rsi_val = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50
    adx_val = float(adx.iloc[-1]) if not pd.isna(adx.iloc[-1]) else 20
    atr_val = float(atr.iloc[-1]) if not pd.isna(atr.iloc[-1]) else 0
    cmf_val = float(cmf.iloc[-1]) if not pd.isna(cmf.iloc[-1]) else 0
    macd_val = float(macd_line.iloc[-1]) if not pd.isna(macd_line.iloc[-1]) else 0
    macd_signal_val = float(signal_line.iloc[-1]) if not pd.isna(signal_line.iloc[-1]) else 0
    macd_hist_val = float(histogram.iloc[-1]) if not pd.isna(histogram.iloc[-1]) else 0

    return {
        "ticker": ticker.upper(),
        "price": current_price,
        "trend": trend,
        "trend_score": trend_score,
        "indicators": {
            "ema20": round(ema20_val, 2),
            "ema50": round(ema50_val, 2),
            "ema200": round(ema200_val, 2),
            "rsi": round(rsi_val, 1),
            "adx": round(adx_val, 1),
            "atr": round(atr_val, 2),
            "atr_pct": round(atr_val / current_price * 100, 2) if current_price else 0,
            "cmf": round(cmf_val, 3),
            "rvol": rvol,
            "macd": round(macd_val, 3),
            "macd_signal": round(macd_signal_val, 3),
            "macd_histogram": round(macd_hist_val, 3),
            "bollinger_upper": round(float(bb_upper.iloc[-1]), 2) if not pd.isna(bb_upper.iloc[-1]) else 0,
            "bollinger_lower": round(float(bb_lower.iloc[-1]), 2) if not pd.isna(bb_lower.iloc[-1]) else 0,
            "bollinger_bandwidth": round(float(bb_bandwidth.iloc[-1]), 2) if not pd.isna(bb_bandwidth.iloc[-1]) else 0,
            "bollinger_pctb": round(float(bb_pctb.iloc[-1]), 2) if not pd.isna(bb_pctb.iloc[-1]) else 0,
        },
        "levels": {
            "support": round(support, 2),
            "resistance": round(resistance, 2),
        },
        "volume": {
            "current": int(df["Volume"].iloc[-1]) if not pd.isna(df["Volume"].iloc[-1]) else 0,
            "avg_20d": int(df["Volume"].tail(20).mean()),
            "rvol": rvol,
        },
    }


def get_sector_performance(period: str = "1mo") -> List[Dict[str, Any]]:
    """Get performance of all sector ETFs"""
    results = []
    etf_list = list(SECTOR_ETFS.values())

    try:
        data = yf.download(etf_list, period=period, progress=False)
        if data.empty:
            return results

        for sector, etf in SECTOR_ETFS.items():
            try:
                if isinstance(data.columns, pd.MultiIndex):
                    close = data["Close"][etf]
                else:
                    close = data["Close"]

                if close.empty or len(close) < 2:
                    continue

                first_price = float(close.iloc[0])
                last_price = float(close.iloc[-1])
                change_pct = ((last_price - first_price) / first_price * 100) if first_price else 0

                results.append({
                    "sector": sector,
                    "sector_tr": SECTOR_TR.get(sector, sector),
                    "etf": etf,
                    "price": round(last_price, 2),
                    "change_pct": round(change_pct, 2),
                })
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Sektör performansı alınamadı: {e}")

    return sorted(results, key=lambda x: x["change_pct"], reverse=True)


def get_market_regime() -> Dict[str, Any]:
    """Determine market regime based on VIX and S&P 500"""
    try:
        vix_data = get_ticker_data("^VIX", period="5d")
        spy_data = get_ticker_data("^GSPC", period="1mo")

        vix_level = float(vix_data["Close"].iloc[-1]) if vix_data is not None and not vix_data.empty else 20
        spy_close = spy_data["Close"] if spy_data is not None else pd.Series()

        if len(spy_close) >= 20:
            spy_ema20 = float(calc_ema(spy_close, 20).iloc[-1])
            spy_current = float(spy_close.iloc[-1])
        else:
            spy_ema20 = 0
            spy_current = 0

        if vix_level > 30:
            regime = "Bear"
            regime_tr = "🐻 Ayı"
        elif vix_level > 20:
            if spy_current > spy_ema20:
                regime = "Bull"
                regime_tr = "🐂 Boğa"
            else:
                regime = "Cautious"
                regime_tr = "⚠️ Temkinli"
        else:
            regime = "Bull"
            regime_tr = "🐂 Boğa"

        return {
            "regime": regime,
            "regime_tr": regime_tr,
            "vix": round(vix_level, 2),
            "spy_price": round(spy_current, 2),
            "spy_ema20": round(spy_ema20, 2),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Market rejimi hesaplanamadı: {e}")
        return {"regime": "Unknown", "regime_tr": "Bilinmiyor", "vix": 0}


def get_batch_quotes(symbols: List[str]) -> List[Dict[str, Any]]:
    """Get quotes for multiple symbols efficiently"""
    results = []
    try:
        tickers = yf.Tickers(" ".join(symbols))
        for symbol in symbols:
            try:
                t = tickers.tickers[symbol]
                fast = t.fast_info
                price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
                prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
                change = price - prev if prev else 0
                change_pct = (change / prev * 100) if prev else 0

                display = symbol.replace("^", "").replace("-USD", "").replace("=F", "")
                results.append({
                    "symbol": display,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                })
            except Exception:
                continue
    except Exception as e:
        logger.error(f"Toplu fiyat alınamadı: {e}")

    return results
