"""
Market Data Service
Yahoo Finance v8/v7 API (direct HTTP) + yfinance fast_info
Technical indicators: RSI, EMA, ADX, ATR, RVOL, CMF, Bollinger
"""

import yfinance as yf
import pandas as pd
import numpy as np
import logging
import time
import threading
import httpx
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from functools import lru_cache

# Yahoo Finance doğrudan HTTP endpoint'leri
_YF_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
_YF_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"
_YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
}

logger = logging.getLogger(__name__)


# ─── In-Memory TTL Cache ───
# yfinance çağrılarını 30sn cache'le — aynı ticker için tekrar istek gitmez
class TTLCache:
    """Thread-safe TTL cache for market data"""
    def __init__(self, ttl: int = 30):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._ttl = ttl
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._store and time.time() < self._expiry.get(key, 0):
                return self._store[key]
            # Expired — temizle
            self._store.pop(key, None)
            self._expiry.pop(key, None)
            return None

    def set(self, key: str, value: Any):
        with self._lock:
            self._store[key] = value
            self._expiry[key] = time.time() + self._ttl

    def clear(self):
        with self._lock:
            self._store.clear()
            self._expiry.clear()


# Quote: 30sn, Technicals: 45sn, Indices: 30sn, Sectors: 120sn
_quote_cache = TTLCache(ttl=30)
_tech_cache = TTLCache(ttl=45)
_indices_cache = TTLCache(ttl=30)
_sector_cache = TTLCache(ttl=120)

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
    """Fetch OHLCV via Yahoo Finance v8 Chart API (direct HTTP — yf.download bypass)"""
    cache_key = f"ohlcv:{ticker}:{period}:{interval}"
    cached = _tech_cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        url = _YF_CHART_URL.format(symbol=ticker)
        params = {"range": period, "interval": interval, "includePrePost": "false"}
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            resp = client.get(url, params=params, headers=_YF_HEADERS)
            resp.raise_for_status()
            data = resp.json()

        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        q = result["indicators"]["quote"][0]

        df = pd.DataFrame({
            "Open":   q.get("open",   [None] * len(timestamps)),
            "High":   q.get("high",   [None] * len(timestamps)),
            "Low":    q.get("low",    [None] * len(timestamps)),
            "Close":  q.get("close",  [None] * len(timestamps)),
            "Volume": q.get("volume", [0]    * len(timestamps)),
        }, index=pd.to_datetime(timestamps, unit="s", utc=True).tz_convert(None))

        df = df.dropna(subset=["Close"])
        if df.empty:
            return None
        _tech_cache.set(cache_key, df)
        return df

    except Exception as e:
        logger.error(f"Veri çekilemedi {ticker} (v8 chart): {e}")
        # Fallback: yfinance download
        try:
            df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
            if not df.empty:
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                return df
        except Exception as e2:
            logger.error(f"Fallback yf.download da başarısız {ticker}: {e2}")
        return None


def get_ticker_info(ticker: str) -> Dict[str, Any]:
    """Get comprehensive ticker info — 30sn cache"""
    cached = _quote_cache.get(ticker)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fast = t.fast_info

        price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
        prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
        change = price - prev if prev else 0
        change_pct = (change / prev * 100) if prev else 0

        result = {
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
        _quote_cache.set(ticker, result)
        return result
    except Exception as e:
        logger.error(f"Ticker bilgisi alınamadı {ticker}: {e}")
        return {"symbol": ticker.upper(), "error": str(e)}


def get_technical_analysis(ticker: str) -> Dict[str, Any]:
    """Full technical analysis for a ticker — 45sn cache"""
    cached = _tech_cache.get(ticker)
    if cached:
        return cached
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

    result = {
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
    _tech_cache.set(ticker, result)
    return result


def get_sector_performance(period: str = "1mo") -> List[Dict[str, Any]]:
    """Get performance of all sector ETFs — 120sn cache"""
    cache_key = f"sectors_{period}"
    cached = _sector_cache.get(cache_key)
    if cached:
        return cached
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

    sorted_results = sorted(results, key=lambda x: x["change_pct"], reverse=True)
    _sector_cache.set(cache_key, sorted_results)
    return sorted_results


def get_market_regime() -> Dict[str, Any]:
    """Determine market regime based on VIX and S&P 500"""
    try:
        spy_data = get_ticker_data("^GSPC", period="1mo")

        # VIX: fast_info kullan (yf.download ^VIX hatalı veri döndürebilir)
        vix_level = 20.0
        try:
            vix_ticker = yf.Ticker("^VIX")
            vix_fast = vix_ticker.fast_info
            raw_vix = float(vix_fast.get("lastPrice", 0) or vix_fast.get("last_price", 0) or 0)
            # Sanity check: VIX tarihsel max ~89 (COVID). 90+ kesinlikle hatalı veri.
            if 5 <= raw_vix <= 90:
                vix_level = raw_vix
            else:
                # Fallback: yf.download ile dene
                vix_data = get_ticker_data("^VIX", period="5d")
                if vix_data is not None and not vix_data.empty:
                    raw_vix2 = float(vix_data["Close"].iloc[-1])
                    if 5 <= raw_vix2 <= 90:
                        vix_level = raw_vix2
                logger.warning(f"VIX geçersiz değer ({raw_vix}), fallback: {vix_level}")
        except Exception as e:
            logger.warning(f"VIX fast_info alınamadı: {e}")

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


# ─── Background Prefetch Service ───
# Popüler ticker'ları arka planda cache'e yükler
# Böylece kullanıcı ilk tıklamada anında veri alır

POPULAR_TICKERS = [
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA",
    "AMD", "AVGO", "NFLX", "DELL", "FANG", "LMT", "EQNR",
    "JPM", "V", "UNH", "XOM", "JNJ", "PG", "HD",
]

_prefetch_running = False


def prefetch_popular_tickers():
    """Arka planda popüler ticker'ların verisini cache'e yükle"""
    global _prefetch_running
    if _prefetch_running:
        return
    _prefetch_running = True

    def _worker():
        global _prefetch_running
        logger.info(f"Prefetch başlatılıyor: {len(POPULAR_TICKERS)} ticker")
        for ticker in POPULAR_TICKERS:
            try:
                # Quote cache'le
                if not _quote_cache.get(ticker):
                    get_ticker_info(ticker)
                # Technicals cache'le
                if not _tech_cache.get(ticker):
                    get_technical_analysis(ticker)
            except Exception as e:
                logger.warning(f"Prefetch hatası {ticker}: {e}")
        logger.info("Prefetch tamamlandı")
        _prefetch_running = False

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()


def start_periodic_prefetch(interval_minutes: int = 5):
    """Her N dakikada bir popüler ticker'ları arka planda yenile"""
    def _loop():
        while True:
            try:
                prefetch_popular_tickers()
            except Exception as e:
                logger.error(f"Periodic prefetch hatası: {e}")
            time.sleep(interval_minutes * 60)

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
    logger.info(f"Periodic prefetch başladı ({interval_minutes}dk aralıkla)")


def get_batch_quotes(symbols: List[str]) -> List[Dict[str, Any]]:
    """Get real-time quotes via yfinance (more reliable than failing v7 quote API)"""
    cache_key = ",".join(sorted(symbols))
    cached = _indices_cache.get(cache_key)
    if cached:
        return cached

    results = []
    try:
        # yfinance.Tickers use specialized fast_info for batch fetching
        tickers_obj = yf.Tickers(" ".join(symbols))
        for symbol in symbols:
            try:
                t = tickers_obj.tickers[symbol]
                fast = t.fast_info
                
                # Robust price fetching: try multiple fields
                price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or 0)
                if price <= 0:
                    # Fallback to history if fast_info fails
                    hist = t.history(period="1d")
                    if not hist.empty:
                        price = float(hist["Close"].iloc[-1])

                prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or 0)
                if prev <= 0:
                    hist_prev = t.history(period="2d")
                    if len(hist_prev) >= 2:
                        prev = float(hist_prev["Close"].iloc[-2])

                change = price - prev if prev else 0
                change_pct = (change / prev * 100) if prev else 0
                
                if price <= 0:
                    continue

                display = symbol.replace("^", "").replace("-USD", "").replace("=F", "")
                results.append({
                    "symbol": display,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 4),
                })
            except Exception as e:
                logger.warning(f"Batch quote error for {symbol}: {e}")
                continue

    except Exception as e:
        logger.error(f"Toplu fiyat alınamadı (yfinance batch): {e}")

    if results:
        _indices_cache.set(cache_key, results)
    return results


# ─── New Data Functions ───

_search_cache = TTLCache(ttl=300)  # 5 dakika
_extra_cache = TTLCache(ttl=120)   # 2 dakika


def get_ticker_info(ticker: str) -> Dict[str, Any]:
    """Get comprehensive ticker info — Multi-layer price fallback"""
    cached = _quote_cache.get(ticker)
    if cached:
        return cached
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        fast = t.fast_info

        # Improved Price Fallback Logic
        price = float(fast.get("lastPrice", 0) or fast.get("last_price", 0) or info.get("regularMarketPrice", 0) or 0)
        prev = float(fast.get("previousClose", 0) or fast.get("previous_close", 0) or info.get("regularMarketPreviousClose", 0) or 0)
        
        # Final fallback: history
        if price <= 0:
            hist = t.history(period="1d")
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
        
        if prev <= 0:
            hist_prev = t.history(period="5d")
            if len(hist_prev) >= 2:
                prev = float(hist_prev["Close"].iloc[-2])

        change = price - prev if prev else 0
        change_pct = (change / prev * 100) if prev else 0

        result = {
            "symbol": ticker.upper(),
            "name": info.get("shortName") or info.get("longName", ticker),
            "price": round(price, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume": info.get("volume") or fast.get("lastVolume", 0),
            "market_cap": info.get("marketCap") or fast.get("marketCap", 0),
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
        _quote_cache.set(ticker, result)
        return result
    except Exception as e:
        logger.error(f"Ticker bilgisi alınamadı {ticker}: {e}")
        return {"symbol": ticker.upper(), "error": str(e)}


def get_market_movers(period: str = "1d") -> Dict[str, List[Dict[str, Any]]]:
    """Get top gainers, losers and volume leaders from major US stocks for a given period"""
    cache_key = f"market_movers_{period}"
    cached = _indices_cache.get(cache_key)
    if cached:
        return cached

    major_tickers = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "BRK-B", "JPM", "V", 
        "JNJ", "WMT", "MA", "PG", "UNH", "XOM", "LLY", "HD", "AVGO", "ORCL",
        "COST", "CVX", "ABBV", "MRK", "BAC", "PEP", "KO", "ADBE", "CRM", "AMD",
        "NFLX", "WFC", "TMO", "ACN", "CSCO", "INTC", "ABT", "DHR", "MCD", "DIS",
        "PFE", "VZ", "AMGN", "INTU", "LOW", "PM", "CAT", "TXN", "MS", "IBM",
        "AMAT", "COP", "NEE", "GS", "HON", "RTX", "GE", "BKNG", "SPGI", "UNP",
        "LRCX", "VRTX", "ETN", "ISRG", "ELV", "SYK", "PGR", "TJX", "CB", "REGN",
        "MU", "MMC", "PLD", "BSX", "LMT", "PANW", "DE", "ADI", "CI", "BA",
        "MDT", "FI", "KLAC", "GILD", "T", "SNPS", "CDNS", "ICE", "CRWD", "MAR",
        "COIN", "MSTR", "ARM", "SMCI", "RDDT"
    ]

    try:
        results = []
        if period == "1d":
            results = get_batch_quotes(major_tickers)
        else:
            # For longer periods, we use get_price_changes which is cached
            for t in major_tickers[:30]: 
                changes = get_price_changes(t)
                change_val = 0
                if period == "1w": change_val = changes.get("week") or 0
                elif period == "1m": change_val = changes.get("month") or 0
                elif period == "1y": change_val = changes.get("year") or 0
                
                if change_val != 0:
                    results.append({
                        "symbol": t,
                        "name": t,
                        "change_pct": change_val
                    })

        if not results:
            return {"gainers": [], "losers": [], "volume": []}

        # Enrich data with names and sectors from cache if available
        for item in results:
            cached_info = _quote_cache.get(item["symbol"])
            if cached_info:
                item["name"] = cached_info.get("name", item["symbol"])
                item["price"] = cached_info.get("price", 0)
                item["sector"] = cached_info.get("sector", "Diğer")
            else:
                item["name"] = item["symbol"]
                item["sector"] = "Diğer"

        # Sort and filter
        gainers = sorted([q for q in results if q["change_pct"] > 0], key=lambda x: x["change_pct"], reverse=True)[:10]
        losers = sorted([q for q in results if q["change_pct"] < 0], key=lambda x: x["change_pct"])[:10]
        volume = sorted(results, key=lambda x: x.get("change_pct", 0), reverse=True)[:10] # Placeholder for volume

        res_final = {"gainers": gainers, "losers": losers, "volume": volume}
        _indices_cache.set(cache_key, res_final)
        return res_final
    except Exception as e:
        logger.error(f"Market movers hatası ({period}): {e}")
        return {"gainers": [], "losers": [], "volume": []}
