import yfinance as yf
from typing import Dict, List
from datetime import datetime
import pytz
import logging

logger = logging.getLogger(__name__)

# ABD Borsası Sektor ETF'leri (11 Sektor) + Öne Çıkan Hisseler
SECTOR_ETFS = {
    "XLK": {
        "name": "Teknoloji",
        "stocks": ["AAPL", "MSFT", "NVDA", "TSLA"]
    },
    "XLV": {
        "name": "Sağlık",
        "stocks": ["JNJ", "UNH", "PFE", "ABBV"]
    },
    "XLF": {
        "name": "Finansal",
        "stocks": ["JPM", "BAC", "WFC", "GS"]
    },
    "XLI": {
        "name": "Endüstri",
        "stocks": ["BA", "CAT", "DE", "MMM"]
    },
    "XLY": {
        "name": "İhtiyari",
        "stocks": ["AMZN", "HD", "NKE", "MCD"]
    },
    "XLP": {
        "name": "Temel",
        "stocks": ["PG", "KO", "WMT", "PEP"]
    },
    "XLE": {
        "name": "Enerji",
        "stocks": ["XOM", "CVX", "COP", "SLB"]
    },
    "XLRE": {
        "name": "Gayrimenkul",
        "stocks": ["PLD", "AMT", "EQIX", "DLR"]
    },
    "XLU": {
        "name": "Kamu Hizmetleri",
        "stocks": ["NEE", "DUK", "SO", "EXC"]
    },
    "XLB": {
        "name": "Malzeme",
        "stocks": ["LIN", "ALB", "NEM", "FCX"]
    },
    "XLC": {
        "name": "Haberleşme",
        "stocks": ["GOOGL", "META", "NFLX", "CMCSA"]
    },
}

# Büyük İndeksler
MAJOR_INDEXES = {
    "SPY": "S&P 500",
    "QQQ": "Nasdaq-100",
    "IWM": "Russell 2000",
}


def get_change_percent(ticker: str) -> float:
    """Bir ticker'ın günlük yüzde değişimini hesapla."""
    try:
        data = yf.Ticker(ticker)
        hist = data.history(period="2d")
        if len(hist) >= 2:
            yesterday_close = hist.iloc[-2]["Close"]
            today_close = hist.iloc[-1]["Close"]
            change_percent = ((today_close - yesterday_close) / yesterday_close) * 100
            return round(change_percent, 2)
    except Exception as e:
        logger.error(f"✗ {ticker}: {str(e)}")
    return 0.0


async def get_sector_heatmap() -> Dict:
    """
    ABD Borsası sektor verilerini çekir.
    Her sektör için ETF'nin ve öne çıkan hisselerin değişim oranını döndürür.
    """
    try:
        all_data = []

        # Sektor ETF'leri + Alt Hisseler
        for ticker, sector_info in SECTOR_ETFS.items():
            try:
                # Sektor ETF'nin değişimi
                sector_change = get_change_percent(ticker)

                # Alt hisselerin değişimi
                stocks_data = []
                for stock_ticker in sector_info["stocks"]:
                    stock_change = get_change_percent(stock_ticker)
                    stocks_data.append({
                        "ticker": stock_ticker,
                        "change_percent": stock_change
                    })

                all_data.append({
                    "ticker": ticker,
                    "name": sector_info["name"],
                    "change_percent": sector_change,
                    "type": "sector",
                    "stocks": stocks_data
                })
                logger.info(f"✓ {ticker} ({sector_info['name']}): {sector_change:+.2f}%")
            except Exception as e:
                logger.error(f"✗ {ticker}: {str(e)}")

        # Büyük İndeksler
        for ticker, name in MAJOR_INDEXES.items():
            try:
                change_percent = get_change_percent(ticker)
                all_data.append({
                    "ticker": ticker,
                    "name": name,
                    "change_percent": change_percent,
                    "type": "index"
                })
                logger.info(f"✓ {ticker} ({name}): {change_percent:+.2f}%")
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
