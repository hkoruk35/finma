"""
SPX Live Engine — Market Data Provider Abstraction Layer
Decouples data sources from the core deterministic market engine.
Includes Futures Contract Rollover management.
"""

from abc import ABC, abstractmethod
import pandas as pd
import datetime
import logging
import yfinance as yf
from spx_engine.time_session import NY_TZ, localize_ny

logger = logging.getLogger("spx_engine.data_provider")

def get_futures_front_contract_symbol(root: str = "ES", dt: datetime.datetime = None) -> str:
    """
    Determines active front contract symbol for ES or NQ futures.
    ES contract codes: H (Mar), M (Jun), U (Sep), Z (Dec).
    Rollover occurs on the 2nd Thursday of the expiration month.
    """
    if dt is None:
        dt = datetime.datetime.now(NY_TZ)

    month = dt.month
    year_short = str(dt.year)[-2:]
    
    first_day = datetime.date(dt.year, month, 1)
    first_thursday_day = 1 + (3 - first_day.weekday()) % 7
    second_thursday_day = first_thursday_day + 7
    second_thursday = datetime.date(dt.year, month, second_thursday_day)

    target_code = None
    target_year = year_short

    rolled = False
    if month in (3, 6, 9, 12):
        if dt.date() >= second_thursday:
            rolled = True

    if month < 3 or (month == 3 and not rolled):
        target_code = 'H'
    elif month < 6 or (month == 6 and not rolled):
        target_code = 'M'
    elif month < 9 or (month == 9 and not rolled):
        target_code = 'U'
    elif month < 12 or (month == 12 and not rolled):
        target_code = 'Z'
    else:
        target_code = 'H'
        target_year = str(dt.year + 1)[-2:]

    if root == "ES":
        return f"ES{target_code}{target_year}.CME"
    elif root == "NQ":
        return f"NQ{target_code}{target_year}.CME"
    return f"{root}=F"


class MarketDataProvider(ABC):
    @abstractmethod
    def fetch_intraday_candles(self, symbol: str, interval: str = "1m", lookback_days: int = 5) -> pd.DataFrame:
        pass

    @abstractmethod
    def fetch_live_quote(self, symbol: str) -> dict:
        pass


class YFinanceProvider(MarketDataProvider):
    def __init__(self):
        self.source_name = "YFinance"

    def fetch_intraday_candles(self, symbol: str, interval: str = "1m", lookback_days: int = 5) -> pd.DataFrame:
        try:
            ticker_map = {
                "ES": "ES=F",
                "SPX": "^GSPC",
                "NQ": "NQ=F",
                "VIX": "^VIX",
                "SPY": "SPY",
                "ADD": "^ADD",
                "TICK": "^TICK"
            }
            yf_symbol = ticker_map.get(symbol, symbol)
            
            period = f"{min(lookback_days, 7)}d" if interval in ("1m", "2m", "5m") else f"{min(lookback_days, 60)}d"
            
            df = yf.download(
                yf_symbol,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=False
            )
            
            if df.empty:
                return pd.DataFrame(columns=['open', 'high', 'low', 'close', 'volume'])

            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df = df.rename(columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume"
            })
            
            df = df[['open', 'high', 'low', 'close', 'volume']].copy()

            if df.index.tz is None:
                df.index = df.index.tz_localize("UTC").tz_convert(NY_TZ)
            else:
                df.index = df.index.tz_convert(NY_TZ)

            df = df.sort_index()
            return df

        except Exception as e:
            logger.error(f"Error fetching intraday candles for {symbol} via yfinance: {e}")
            return pd.DataFrame(columns=['open', 'high', 'low', 'close', 'volume'])

    def fetch_live_quote(self, symbol: str) -> dict:
        try:
            ticker_map = {
                "ES": "ES=F",
                "SPX": "^GSPC",
                "NQ": "NQ=F",
                "VIX": "^VIX",
                "SPY": "SPY"
            }
            yf_symbol = ticker_map.get(symbol, symbol)
            t = yf.Ticker(yf_symbol)
            fast_info = getattr(t, 'fast_info', {})
            
            last_price = fast_info.get('lastPrice', None)
            if last_price is None:
                df = self.fetch_intraday_candles(symbol, interval="1m", lookback_days=1)
                if not df.empty:
                    last_row = df.iloc[-1]
                    last_price = float(last_row['close'])
                    ts = df.index[-1].to_pydatetime()
                else:
                    last_price = 0.0
                    ts = datetime.datetime.now(NY_TZ)
            else:
                ts = datetime.datetime.now(NY_TZ)

            return {
                "symbol": symbol,
                "price": float(last_price) if last_price else 0.0,
                "bid": float(fast_info.get('bid', last_price or 0.0)),
                "ask": float(fast_info.get('ask', last_price or 0.0)),
                "volume": float(fast_info.get('lastVolume', 0.0)),
                "timestamp": ts,
                "source": self.source_name,
                "status": "LIVE" if last_price else "MISSING"
            }
        except Exception as e:
            logger.error(f"Error fetching live quote for {symbol} via yfinance: {e}")
            return {
                "symbol": symbol,
                "price": 0.0,
                "bid": 0.0,
                "ask": 0.0,
                "volume": 0.0,
                "timestamp": datetime.datetime.now(NY_TZ),
                "source": self.source_name,
                "status": "MISSING"
            }
