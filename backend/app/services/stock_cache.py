"""
Stock Cache Service — Pre-computed Analysis Engine

Mimari (ChatGPT'nin doğru tespit ettiği):
  MARKET DATA INGESTION → COMPUTE → CACHE → SERVE

Bu servis:
1. Popüler hisselerin quote + technicals verisini arka planda hesaplar
2. Sonuçları Supabase stock_cache tablosuna yazar
3. API istekleri önce cache'den döner — cache miss'te live hesaplar
4. Her 5dk'da otomatik yenilenir

Performans:
- Cache hit: <10ms (Supabase query)
- Cache miss: 3-5sn (yfinance + hesaplama, sonra cache'e yazar)
- 10000 user aynı anda DELL sorsa → hepsi cache'den <10ms'de döner
"""

import logging
import threading
import time
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# Supabase client
_supabase = None


def _get_db():
    """Lazy Supabase client"""
    global _supabase
    if _supabase is None:
        try:
            from app.database import get_supabase
            _supabase = get_supabase()
        except Exception:
            pass
    return _supabase


# ─── Cache Read ───

def get_cached_quote(ticker: str) -> Optional[Dict[str, Any]]:
    """Cache'den quote ver. Expired veya yoksa None döner."""
    db = _get_db()
    if not db:
        return None
    try:
        result = db.table("stock_cache").select("quote_data, expires_at").eq("ticker", ticker.upper()).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            # Expiry kontrolü
            expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if expires > datetime.now(timezone.utc):
                data = row["quote_data"]
                if data and data.get("price", 0) > 0:
                    return data
    except Exception as e:
        logger.debug(f"Cache read error {ticker}: {e}")
    return None


def get_cached_technicals(ticker: str) -> Optional[Dict[str, Any]]:
    """Cache'den technicals ver. Expired veya yoksa None döner."""
    db = _get_db()
    if not db:
        return None
    try:
        result = db.table("stock_cache").select("technicals_data, expires_at").eq("ticker", ticker.upper()).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if expires > datetime.now(timezone.utc):
                data = row["technicals_data"]
                if data and data.get("ticker"):
                    return data
    except Exception as e:
        logger.debug(f"Cache read error {ticker}: {e}")
    return None


def get_cached_ai_analysis(ticker: str) -> Optional[str]:
    """Cache'den AI analiz ver."""
    db = _get_db()
    if not db:
        return None
    try:
        result = db.table("stock_cache").select("ai_analysis, expires_at").eq("ticker", ticker.upper()).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            expires = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
            if expires > datetime.now(timezone.utc):
                analysis = row.get("ai_analysis", "")
                if analysis and len(analysis) > 50:
                    return analysis
    except Exception as e:
        logger.debug(f"Cache read error {ticker}: {e}")
    return None


# ─── Cache Write ───

def save_to_cache(ticker: str, quote_data: Dict = None, technicals_data: Dict = None, ai_analysis: str = None):
    """Cache'e yaz (upsert)"""
    db = _get_db()
    if not db:
        return
    try:
        row: Dict[str, Any] = {
            "ticker": ticker.upper(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        }
        if quote_data:
            row["quote_data"] = quote_data
        if technicals_data:
            row["technicals_data"] = technicals_data
        if ai_analysis:
            row["ai_analysis"] = ai_analysis

        db.table("stock_cache").upsert(row, on_conflict="ticker").execute()
    except Exception as e:
        logger.warning(f"Cache write error {ticker}: {e}")


# ─── Background Worker ───

# En çok aranan hisseler — Featured + Top 30
WATCHLIST_TICKERS = [
    # Mega caps
    "NVDA", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "AVGO",
    # Popular
    "AMD", "NFLX", "DELL", "CRM", "ORCL", "ADBE", "INTC", "QCOM",
    # Energy
    "FANG", "XOM", "EQNR", "CVX",
    # Finance
    "JPM", "V", "MA", "GS",
    # Defense / Industrial
    "LMT", "RTX", "BA", "CAT",
    # Healthcare
    "UNH", "JNJ",
]

_worker_running = False


def run_cache_worker():
    """Tüm watchlist ticker'larını hesapla ve cache'e yaz"""
    global _worker_running
    if _worker_running:
        logger.info("Cache worker zaten çalışıyor, atlanıyor")
        return
    _worker_running = True

    def _work():
        global _worker_running
        start = time.time()
        logger.info(f"📊 Cache worker başladı: {len(WATCHLIST_TICKERS)} ticker")
        success = 0
        errors = 0

        from app.services.market_data import get_ticker_info, get_technical_analysis

        for ticker in WATCHLIST_TICKERS:
            try:
                # Quote
                quote = get_ticker_info(ticker)
                if "error" not in quote:
                    save_to_cache(ticker, quote_data=quote)

                # Technicals
                tech = get_technical_analysis(ticker)
                if "error" not in tech:
                    save_to_cache(ticker, technicals_data=tech)

                success += 1
            except Exception as e:
                errors += 1
                logger.warning(f"Cache worker error {ticker}: {e}")

            # Rate limiting — yfinance'i aşırı yükleme
            time.sleep(0.5)

        elapsed = time.time() - start
        logger.info(f"📊 Cache worker bitti: {success}/{len(WATCHLIST_TICKERS)} başarılı, {errors} hata, {elapsed:.0f}sn")
        _worker_running = False

    thread = threading.Thread(target=_work, daemon=True)
    thread.start()


def start_cache_worker(interval_minutes: int = 5):
    """Periyodik cache worker başlat"""
    def _loop():
        # İlk çalışma hemen
        run_cache_worker()
        while True:
            time.sleep(interval_minutes * 60)
            run_cache_worker()

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
    logger.info(f"📊 Cache worker servisi başladı ({interval_minutes}dk aralıkla, {len(WATCHLIST_TICKERS)} ticker)")
