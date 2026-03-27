import yfinance as yf
from typing import Dict, List
from datetime import datetime
import pytz
import logging

logger = logging.getLogger(__name__)

# ABD Borsası Sektor ETF'leri
SECTOR_ETFS = {
    "XLK": "Teknoloji",        # Technology
    "XLV": "Sağlık",          # Healthcare
    "XLF": "Finansal",        # Financials
    "XLI": "Endüstri",        # Industrials
    "XLY": "İhtiyari",        # Consumer Discretionary
    "XLP": "Temel",           # Consumer Staples
    "XLRE": "Gayrimenkul",    # Real Estate
    "XLU": "Kamu Hizmetleri", # Utilities
    "XLE": "Enerji",          # Energy
    "XLNX": "Malzeme",        # Materials (Communication Services)
}

# Büyük İndeksler
MAJOR_INDEXES = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq-100",
    "IWM": "Russell 2000",
}


async def get_sector_heatmap() -> Dict:
    """
    ABD Borsası sektor verilerini çekir.
    Fiyat değil, değişim oranını (%) döndürür.
    """
    try:
        all_data = []

        # Sektor ETF'leri
        for ticker, name in SECTOR_ETFS.items():
            try:
                data = yf.Ticker(ticker)
                hist = data.history(period="2d")

                if len(hist) >= 2:
                    yesterday_close = hist.iloc[-2]["Close"]
                    today_close = hist.iloc[-1]["Close"]
                    change_percent = ((today_close - yesterday_close) / yesterday_close) * 100

                    all_data.append({
                        "ticker": ticker,
                        "name": name,
                        "price": round(today_close, 2),
                        "change_percent": round(change_percent, 2),
                        "type": "sector"
                    })
                    logger.info(f"✓ {ticker} ({name}): {change_percent:+.2f}%")
                else:
                    logger.warning(f"✗ {ticker}: Veri yetersiz")
            except Exception as e:
                logger.error(f"✗ {ticker}: {str(e)}")

        # Büyük İndeksler
        for ticker, name in MAJOR_INDEXES.items():
            try:
                data = yf.Ticker(ticker)
                hist = data.history(period="2d")

                if len(hist) >= 2:
                    yesterday_close = hist.iloc[-2]["Close"]
                    today_close = hist.iloc[-1]["Close"]
                    change_percent = ((today_close - yesterday_close) / yesterday_close) * 100

                    all_data.append({
                        "ticker": ticker,
                        "name": name,
                        "price": round(today_close, 2),
                        "change_percent": round(change_percent, 2),
                        "type": "index"
                    })
                    logger.info(f"✓ {ticker} ({name}): {change_percent:+.2f}%")
                else:
                    logger.warning(f"✗ {ticker}: Veri yetersiz")
            except Exception as e:
                logger.error(f"✗ {ticker}: {str(e)}")

        # NY saatinde timestamp ekle
        ny_tz = pytz.timezone("America/New_York")
        ny_time = datetime.now(ny_tz)

        return {
            "success": True,
            "timestamp": ny_time.isoformat(),
            "last_update_ny": ny_time.strftime("%H:%M:%S"),
            "data": all_data
        }

    except Exception as e:
        logger.error(f"Sektor verisi hatası: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


def is_market_hours() -> bool:
    """
    NY saat ile pazartesi-cuma 09:30 ile 16:00 arasında olup olmadığını kontrol eder.
    """
    ny_tz = pytz.timezone("America/New_York")
    ny_time = datetime.now(ny_tz)

    # Pazartesi = 0, Pazar = 6
    weekday = ny_time.weekday()

    # Hafta içi (Pazartesi-Cuma) = 0-4
    if weekday >= 5:
        return False

    # 09:30 - 16:00 arası
    hour = ny_time.hour
    minute = ny_time.minute
    time_in_minutes = hour * 60 + minute

    market_open = 9 * 60 + 30  # 09:30
    market_close = 16 * 60     # 16:00

    return market_open <= time_in_minutes < market_close
