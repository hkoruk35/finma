"""
World Markets Intelligence Service v2
Live data for 30+ global stock exchanges with AI analysis

Features:
  - zoneinfo-based market status (DST-aware, not relying on Yahoo marketState)
  - yfinance fallback when Yahoo v7 API fails
  - Bellwether stocks per region (featured companies)
  - Session phase tracking (acilis / seans / kapanis)
  - Open price + intraday stats

Endpoints:
  GET /api/market/world          → Canlı dünya borsası verileri (3dk cache)
  GET /api/market/world/analysis → AI destekli global piyasa analizi (3dk cache)
"""

import time
import logging
import threading
import requests
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


# ─── TTL Cache ───
class _TTLCache:
    """Thread-safe TTL cache with stale-data fallback"""
    def __init__(self, ttl: int = 180):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._ttl = ttl
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._store and time.time() < self._expiry.get(key, 0):
                return self._store[key]
            self._store.pop(key, None)
            self._expiry.pop(key, None)
            return None

    def get_stale(self, key: str) -> Optional[Any]:
        """Return data even if expired (fallback)"""
        with self._lock:
            return self._store.get(key)

    def set(self, key: str, value: Any):
        with self._lock:
            self._store[key] = value
            self._expiry[key] = time.time() + self._ttl


_world_cache = _TTLCache(ttl=180)   # 3 dakika — fiyat verileri
_ai_cache = _TTLCache(ttl=180)      # 3 dakika — AI analiz

_YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0",
    "Accept": "application/json",
}


# ═══════════════════════════════════════════════════════════════════════
# BORSA TANIMLARI — Yahoo Finance sembolleri + seans bilgileri + IANA tz
# ═══════════════════════════════════════════════════════════════════════

WORLD_EXCHANGES = [
    # ─── Okyanusya ───
    {"id": "nzx", "symbol": "^NZ50", "name": "NZX 50", "country": "Yeni Zelanda", "city": "Wellington",
     "region": "okyanusya", "flag": "🇳🇿", "local_open": "10:00", "local_close": "16:45",
     "tz": "NZDT", "tz_iana": "Pacific/Auckland"},
    {"id": "asx", "symbol": "^AXJO", "name": "ASX 200", "country": "Avustralya", "city": "Sidney",
     "region": "okyanusya", "flag": "🇦🇺", "local_open": "10:00", "local_close": "16:00",
     "tz": "AEDT", "tz_iana": "Australia/Sydney"},

    # ─── Asya-Pasifik ───
    {"id": "nikkei", "symbol": "^N225", "name": "Nikkei 225", "country": "Japonya", "city": "Tokyo",
     "region": "asya", "flag": "🇯🇵", "local_open": "09:00", "local_close": "15:00",
     "tz": "JST", "tz_iana": "Asia/Tokyo"},
    {"id": "kospi", "symbol": "^KS11", "name": "KOSPI", "country": "Güney Kore", "city": "Seul",
     "region": "asya", "flag": "🇰🇷", "local_open": "09:00", "local_close": "15:30",
     "tz": "KST", "tz_iana": "Asia/Seoul"},
    {"id": "sti", "symbol": "^STI", "name": "STI", "country": "Singapur", "city": "Singapur",
     "region": "asya", "flag": "🇸🇬", "local_open": "09:00", "local_close": "17:00",
     "tz": "SGT", "tz_iana": "Asia/Singapore"},
    {"id": "shanghai", "symbol": "000001.SS", "name": "Shanghai Composite", "country": "Çin", "city": "Şanghay",
     "region": "asya", "flag": "🇨🇳", "local_open": "09:30", "local_close": "15:00",
     "tz": "CST", "tz_iana": "Asia/Shanghai"},
    {"id": "hsi", "symbol": "^HSI", "name": "Hang Seng", "country": "Hong Kong", "city": "Hong Kong",
     "region": "asya", "flag": "🇭🇰", "local_open": "09:30", "local_close": "16:00",
     "tz": "HKT", "tz_iana": "Asia/Hong_Kong"},
    {"id": "taiex", "symbol": "^TWII", "name": "TAIEX", "country": "Tayvan", "city": "Taipei",
     "region": "asya", "flag": "🇹🇼", "local_open": "09:00", "local_close": "13:30",
     "tz": "TST", "tz_iana": "Asia/Taipei"},
    {"id": "sensex", "symbol": "^BSESN", "name": "Sensex", "country": "Hindistan", "city": "Mumbai",
     "region": "asya", "flag": "🇮🇳", "local_open": "09:15", "local_close": "15:30",
     "tz": "IST", "tz_iana": "Asia/Kolkata"},

    # ─── Orta Doğu ───
    {"id": "tadawul", "symbol": "^TASI", "name": "Tadawul", "country": "S. Arabistan", "city": "Riyad",
     "region": "orta_dogu", "flag": "🇸🇦", "local_open": "10:00", "local_close": "15:00",
     "tz": "AST", "tz_iana": "Asia/Riyadh"},
    {"id": "bist", "symbol": "XU100.IS", "name": "BIST 100", "country": "Türkiye", "city": "İstanbul",
     "region": "orta_dogu", "flag": "🇹🇷", "local_open": "09:40", "local_close": "18:10",
     "tz": "TRT", "tz_iana": "Europe/Istanbul"},

    # ─── Afrika ───
    {"id": "jse", "symbol": "^J203.JO", "name": "JSE All Share", "country": "G. Afrika", "city": "Johannesburg",
     "region": "afrika", "flag": "🇿🇦", "local_open": "09:00", "local_close": "17:00",
     "tz": "SAST", "tz_iana": "Africa/Johannesburg"},

    # ─── Avrupa ───
    {"id": "ftse", "symbol": "^FTSE", "name": "FTSE 100", "country": "İngiltere", "city": "Londra",
     "region": "avrupa", "flag": "🇬🇧", "local_open": "08:00", "local_close": "16:30",
     "tz": "GMT", "tz_iana": "Europe/London"},
    {"id": "dax", "symbol": "^GDAXI", "name": "DAX 40", "country": "Almanya", "city": "Frankfurt",
     "region": "avrupa", "flag": "🇩🇪", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Berlin"},
    {"id": "cac", "symbol": "^FCHI", "name": "CAC 40", "country": "Fransa", "city": "Paris",
     "region": "avrupa", "flag": "🇫🇷", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Paris"},
    {"id": "ibex", "symbol": "^IBEX", "name": "IBEX 35", "country": "İspanya", "city": "Madrid",
     "region": "avrupa", "flag": "🇪🇸", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Madrid"},
    {"id": "mib", "symbol": "FTSEMIB.MI", "name": "FTSE MIB", "country": "İtalya", "city": "Milano",
     "region": "avrupa", "flag": "🇮🇹", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Rome"},
    {"id": "aex", "symbol": "^AEX", "name": "AEX", "country": "Hollanda", "city": "Amsterdam",
     "region": "avrupa", "flag": "🇳🇱", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Amsterdam"},
    {"id": "smi", "symbol": "^SSMI", "name": "SMI", "country": "İsviçre", "city": "Zürih",
     "region": "avrupa", "flag": "🇨🇭", "local_open": "09:00", "local_close": "17:20",
     "tz": "CET", "tz_iana": "Europe/Zurich"},
    {"id": "bel20", "symbol": "^BFX", "name": "BEL 20", "country": "Belçika", "city": "Brüksel",
     "region": "avrupa", "flag": "🇧🇪", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Brussels"},
    {"id": "omx", "symbol": "^OMXS30", "name": "OMX Stockholm", "country": "İsveç", "city": "Stokholm",
     "region": "avrupa", "flag": "🇸🇪", "local_open": "09:00", "local_close": "17:25",
     "tz": "CET", "tz_iana": "Europe/Stockholm"},
    {"id": "athex", "symbol": "GD.AT", "name": "ATHEX", "country": "Yunanistan", "city": "Atina",
     "region": "avrupa", "flag": "🇬🇷", "local_open": "10:30", "local_close": "17:20",
     "tz": "EET", "tz_iana": "Europe/Athens"},
    {"id": "stoxx50", "symbol": "^STOXX50E", "name": "Euro Stoxx 50", "country": "Avrupa", "city": "—",
     "region": "avrupa", "flag": "🇪🇺", "local_open": "09:00", "local_close": "17:30",
     "tz": "CET", "tz_iana": "Europe/Berlin"},

    # ─── Güney Amerika ───
    {"id": "bovespa", "symbol": "^BVSP", "name": "Bovespa", "country": "Brezilya", "city": "Sao Paulo",
     "region": "g_amerika", "flag": "🇧🇷", "local_open": "10:00", "local_close": "18:00",
     "tz": "BRT", "tz_iana": "America/Sao_Paulo"},
    {"id": "merval", "symbol": "^MERV", "name": "MERVAL", "country": "Arjantin", "city": "Buenos Aires",
     "region": "g_amerika", "flag": "🇦🇷", "local_open": "11:00", "local_close": "17:00",
     "tz": "ART", "tz_iana": "America/Argentina/Buenos_Aires"},

    # ─── Kuzey Amerika ───
    {"id": "sp500", "symbol": "^GSPC", "name": "S&P 500", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00",
     "tz": "ET", "tz_iana": "America/New_York"},
    {"id": "djia", "symbol": "^DJI", "name": "Dow Jones", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00",
     "tz": "ET", "tz_iana": "America/New_York"},
    {"id": "nasdaq", "symbol": "^IXIC", "name": "Nasdaq", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00",
     "tz": "ET", "tz_iana": "America/New_York"},
    {"id": "russell", "symbol": "^RUT", "name": "Russell 2000", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00",
     "tz": "ET", "tz_iana": "America/New_York"},
    {"id": "ipc", "symbol": "^MXX", "name": "IPC Mexico", "country": "Meksika", "city": "Mexico City",
     "region": "k_amerika", "flag": "🇲🇽", "local_open": "08:30", "local_close": "15:00",
     "tz": "CT", "tz_iana": "America/Mexico_City"},
    {"id": "tsx", "symbol": "^GSPTSE", "name": "S&P/TSX", "country": "Kanada", "city": "Toronto",
     "region": "k_amerika", "flag": "🇨🇦", "local_open": "09:30", "local_close": "16:00",
     "tz": "ET", "tz_iana": "America/Toronto"},
]

# ─── Emtia, Döviz, Kripto ───
COMMODITIES_FX = [
    {"id": "gold", "symbol": "GC=F", "name": "Altin", "flag": "🥇", "type": "emtia"},
    {"id": "silver", "symbol": "SI=F", "name": "Gumus", "flag": "🥈", "type": "emtia"},
    {"id": "oil", "symbol": "CL=F", "name": "Petrol (WTI)", "flag": "⛽", "type": "emtia"},
    {"id": "natgas", "symbol": "NG=F", "name": "Dogalgaz", "flag": "🔥", "type": "emtia"},
    {"id": "eurusd", "symbol": "EURUSD=X", "name": "EUR/USD", "flag": "💱", "type": "doviz"},
    {"id": "usdtry", "symbol": "TRY=X", "name": "USD/TRY", "flag": "🇹🇷", "type": "doviz"},
    {"id": "gbpusd", "symbol": "GBPUSD=X", "name": "GBP/USD", "flag": "🇬🇧", "type": "doviz"},
    {"id": "usdjpy", "symbol": "JPY=X", "name": "USD/JPY", "flag": "🇯🇵", "type": "doviz"},
    {"id": "btc", "symbol": "BTC-USD", "name": "Bitcoin", "flag": "₿", "type": "kripto"},
    {"id": "eth", "symbol": "ETH-USD", "name": "Ethereum", "flag": "⟠", "type": "kripto"},
]

# ─── Bellwether (Öne Çıkan) Hisseler ───
BELLWETHER_STOCKS = [
    # K. Amerika — ABD
    {"symbol": "AAPL", "name": "Apple", "region": "k_amerika"},
    {"symbol": "MSFT", "name": "Microsoft", "region": "k_amerika"},
    {"symbol": "NVDA", "name": "NVIDIA", "region": "k_amerika"},
    {"symbol": "TSLA", "name": "Tesla", "region": "k_amerika"},
    {"symbol": "AMZN", "name": "Amazon", "region": "k_amerika"},
    # Avrupa
    {"symbol": "SAP", "name": "SAP", "region": "avrupa"},
    {"symbol": "ASML", "name": "ASML", "region": "avrupa"},
    {"symbol": "SHEL.L", "name": "Shell", "region": "avrupa"},
    {"symbol": "MC.PA", "name": "LVMH", "region": "avrupa"},
    # Orta Doğu — Türkiye
    {"symbol": "THYAO.IS", "name": "THY", "region": "orta_dogu"},
    {"symbol": "ASELS.IS", "name": "ASELSAN", "region": "orta_dogu"},
    {"symbol": "SISE.IS", "name": "Sise Cam", "region": "orta_dogu"},
    # Asya
    {"symbol": "7203.T", "name": "Toyota", "region": "asya"},
    {"symbol": "005930.KS", "name": "Samsung", "region": "asya"},
    {"symbol": "9988.HK", "name": "Alibaba", "region": "asya"},
    {"symbol": "RELIANCE.NS", "name": "Reliance", "region": "asya"},
    # G. Amerika
    {"symbol": "VALE", "name": "Vale", "region": "g_amerika"},
    {"symbol": "PBR", "name": "Petrobras", "region": "g_amerika"},
]

REGIONS = [
    {"id": "okyanusya", "name": "Okyanusya", "icon": "🌊"},
    {"id": "asya", "name": "Asya-Pasifik", "icon": "🏯"},
    {"id": "orta_dogu", "name": "Orta Dogu & Turkiye", "icon": "🕌"},
    {"id": "afrika", "name": "Afrika", "icon": "🌍"},
    {"id": "avrupa", "name": "Avrupa", "icon": "🏰"},
    {"id": "g_amerika", "name": "Guney Amerika", "icon": "🌎"},
    {"id": "k_amerika", "name": "Kuzey Amerika", "icon": "🗽"},
]


# ═══════════════════════════════════════════════════════════════════════
# MARKET STATUS — zoneinfo-based (DST-aware, not relying on Yahoo)
# ═══════════════════════════════════════════════════════════════════════

def _calc_market_status(exchange: Dict) -> Dict[str, Any]:
    """
    Calculate market status from IANA timezone + local schedule.
    Returns: {status, status_tr, session_phase, session_pct}
    """
    tz_iana = exchange.get("tz_iana")
    if not tz_iana:
        return {"status": "closed", "status_tr": "Kapali", "session_phase": "kapali", "session_pct": 0}

    try:
        tz = ZoneInfo(tz_iana)
        local_now = datetime.now(tz)

        # Weekend check (Sat=5, Sun=6). Note: some Middle East markets trade Sun-Thu
        weekday = local_now.weekday()
        ex_id = exchange.get("id", "")

        # Saudi Tadawul: Sun-Thu (closed Fri-Sat)
        if ex_id == "tadawul":
            if weekday in (4, 5):  # Friday, Saturday
                return {"status": "closed", "status_tr": "Kapali", "session_phase": "kapali", "session_pct": 0}
        else:
            if weekday >= 5:  # Saturday, Sunday
                return {"status": "closed", "status_tr": "Kapali", "session_phase": "kapali", "session_pct": 0}

        # Parse open/close times
        open_h, open_m = map(int, exchange["local_open"].split(":"))
        close_h, close_m = map(int, exchange["local_close"].split(":"))

        open_time = local_now.replace(hour=open_h, minute=open_m, second=0, microsecond=0)
        close_time = local_now.replace(hour=close_h, minute=close_m, second=0, microsecond=0)

        # Pre-market: 15 min before open
        pre_time = open_time - timedelta(minutes=15)
        # Post-market: 15 min after close
        post_time = close_time + timedelta(minutes=15)

        if pre_time <= local_now < open_time:
            return {"status": "pre", "status_tr": "Acilis Oncesi", "session_phase": "acilis_oncesi", "session_pct": 0}
        elif open_time <= local_now <= close_time:
            # Calculate session percentage
            elapsed = (local_now - open_time).total_seconds()
            total = (close_time - open_time).total_seconds()
            pct = int((elapsed / total) * 100) if total > 0 else 50

            # Session phase
            if pct < 10:
                phase = "acilis"
                phase_tr = "Acilis"
            elif pct > 85:
                phase = "kapanis"
                phase_tr = "Kapanisa Yakin"
            elif 45 <= pct <= 55:
                phase = "gun_ortasi"
                phase_tr = "Gun Ortasi"
            else:
                phase = "seans"
                phase_tr = "Seans"

            return {"status": "open", "status_tr": f"Acik ({phase_tr})", "session_phase": phase, "session_pct": pct}
        elif close_time < local_now <= post_time:
            return {"status": "post", "status_tr": "Kapanis Sonrasi", "session_phase": "kapanis_sonrasi", "session_pct": 100}
        else:
            return {"status": "closed", "status_tr": "Kapali", "session_phase": "kapali", "session_pct": 0}

    except Exception as e:
        logger.warning(f"Market status calc error for {exchange.get('id')}: {e}")
        return {"status": "closed", "status_tr": "Kapali", "session_phase": "kapali", "session_pct": 0}


# ═══════════════════════════════════════════════════════════════════════
# DATA FETCH — Yahoo v7 primary + yfinance fallback
# ═══════════════════════════════════════════════════════════════════════

def _yahoo_batch_fetch(symbols: List[str]) -> Dict[str, Dict]:
    """Yahoo Finance v7 batch quote API"""
    quotes_map: Dict[str, Dict] = {}
    try:
        for i in range(0, len(symbols), 20):
            chunk = symbols[i:i+20]
            url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={','.join(chunk)}"
            resp = requests.get(url, headers=_YF_HEADERS, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                for q in data.get("quoteResponse", {}).get("result", []):
                    quotes_map[q.get("symbol", "")] = q
    except Exception as e:
        logger.error(f"Yahoo v7 batch error: {e}")
    return quotes_map


def _yfinance_fallback(symbols: List[str], existing_map: Dict[str, Dict]) -> Dict[str, Dict]:
    """yfinance fallback for symbols that Yahoo v7 missed"""
    missing = [s for s in symbols if s not in existing_map or not existing_map[s].get("regularMarketPrice")]
    if not missing:
        return existing_map

    logger.info(f"yfinance fallback for {len(missing)} symbols: {missing[:5]}...")
    try:
        import yfinance as yf
        for symbol in missing[:15]:  # Limit to avoid timeout
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.fast_info
                price = getattr(info, 'last_price', None) or 0
                prev = getattr(info, 'previous_close', None) or 0
                open_p = getattr(info, 'open', None) or 0
                day_h = getattr(info, 'day_high', None) or 0
                day_l = getattr(info, 'day_low', None) or 0

                change = price - prev if prev else 0
                change_pct = (change / prev * 100) if prev else 0

                existing_map[symbol] = {
                    "symbol": symbol,
                    "regularMarketPrice": price,
                    "regularMarketChange": change,
                    "regularMarketChangePercent": change_pct,
                    "regularMarketOpen": open_p,
                    "regularMarketPreviousClose": prev,
                    "regularMarketDayHigh": day_h,
                    "regularMarketDayLow": day_l,
                    "regularMarketVolume": 0,
                    "shortName": symbol,
                    "marketState": "UNKNOWN",
                    "_source": "yfinance",
                }
            except Exception as e2:
                logger.warning(f"yfinance fallback failed for {symbol}: {e2}")
    except ImportError:
        logger.warning("yfinance not installed for fallback")

    return existing_map


# ═══════════════════════════════════════════════════════════════════════
# MAIN DATA FUNCTION
# ═══════════════════════════════════════════════════════════════════════

def get_world_market_data() -> Dict:
    """
    Dünya borsalarının canlı verilerini getir.
    31 endeks + 10 emtia/döviz/kripto + 18 bellwether hisse.
    Primary: Yahoo v7 batch. Fallback: yfinance. Fallback2: stale cache.
    Cache: 3 dakika.
    """
    cached = _world_cache.get("world_data")
    if cached:
        return cached

    # Tüm sembolleri topla
    index_symbols = [ex["symbol"] for ex in WORLD_EXCHANGES]
    commodity_symbols = [c["symbol"] for c in COMMODITIES_FX]
    bellwether_symbols = [b["symbol"] for b in BELLWETHER_STOCKS]
    all_symbols = index_symbols + commodity_symbols + bellwether_symbols

    # 1. Primary: Yahoo v7 batch fetch
    quotes_map = _yahoo_batch_fetch(all_symbols)

    # 2. Fallback: yfinance for missing symbols
    if len(quotes_map) < len(all_symbols) * 0.7:
        logger.warning(f"Yahoo v7 returned only {len(quotes_map)}/{len(all_symbols)} quotes, trying yfinance fallback")
        quotes_map = _yfinance_fallback(all_symbols, quotes_map)

    # 3. Fallback: stale cache if still no data
    if len(quotes_map) < 5:
        stale = _world_cache.get_stale("world_data")
        if stale:
            logger.warning("Using stale cache data as all sources failed")
            stale["_stale"] = True
            return stale

    # ─── Build regions ───
    regions_data = []
    for region in REGIONS:
        exchanges = [ex for ex in WORLD_EXCHANGES if ex["region"] == region["id"]]
        exchange_list = []

        for ex in exchanges:
            q = quotes_map.get(ex["symbol"], {})
            price = q.get("regularMarketPrice", 0) or 0
            change = q.get("regularMarketChange", 0) or 0
            change_pct = q.get("regularMarketChangePercent", 0) or 0
            prev_close = q.get("regularMarketPreviousClose", 0) or 0
            open_price = q.get("regularMarketOpen", 0) or 0
            day_high = q.get("regularMarketDayHigh", 0) or 0
            day_low = q.get("regularMarketDayLow", 0) or 0
            volume = q.get("regularMarketVolume", 0) or 0
            short_name = q.get("shortName", ex["name"])

            # Open change (from open price)
            open_change_pct = ((price - open_price) / open_price * 100) if open_price > 0 and price > 0 else 0

            # Market status — zoneinfo-based (primary)
            status_info = _calc_market_status(ex)

            exchange_list.append({
                "id": ex["id"],
                "symbol": ex["symbol"],
                "name": ex["name"],
                "full_name": short_name,
                "country": ex["country"],
                "city": ex["city"],
                "flag": ex["flag"],
                "price": round(price, 2),
                "change": round(change, 2),
                "change_pct": round(change_pct, 2),
                "prev_close": round(prev_close, 2),
                "open_price": round(open_price, 2),
                "open_change_pct": round(open_change_pct, 2),
                "day_high": round(day_high, 2),
                "day_low": round(day_low, 2),
                "volume": volume,
                "status": status_info["status"],
                "status_tr": status_info["status_tr"],
                "session_phase": status_info["session_phase"],
                "session_pct": status_info["session_pct"],
                "local_open": ex["local_open"],
                "local_close": ex["local_close"],
                "tz": ex["tz"],
            })

        if exchange_list:
            open_count = sum(1 for e in exchange_list if e["status"] == "open")
            avg_change = sum(e["change_pct"] for e in exchange_list) / len(exchange_list)
            regions_data.append({
                "id": region["id"],
                "name": region["name"],
                "icon": region["icon"],
                "open_count": open_count,
                "total_count": len(exchange_list),
                "avg_change_pct": round(avg_change, 2),
                "exchanges": exchange_list,
            })

    # ─── Bellwether stocks per region ───
    bellwether_by_region: Dict[str, List] = {}
    for b in BELLWETHER_STOCKS:
        q = quotes_map.get(b["symbol"], {})
        price = q.get("regularMarketPrice", 0) or 0
        change_pct = q.get("regularMarketChangePercent", 0) or 0
        if price > 0:
            region_id = b["region"]
            if region_id not in bellwether_by_region:
                bellwether_by_region[region_id] = []
            bellwether_by_region[region_id].append({
                "symbol": b["symbol"],
                "name": b["name"],
                "price": round(price, 2),
                "change_pct": round(change_pct, 2),
            })

    # Sort each region's bellwethers by absolute change (most moved first)
    for rid in bellwether_by_region:
        bellwether_by_region[rid].sort(key=lambda x: abs(x["change_pct"]), reverse=True)

    # Attach bellwethers to regions
    for region in regions_data:
        region["featured_stocks"] = bellwether_by_region.get(region["id"], [])

    # ─── Emtia / Döviz / Kripto ───
    commodities_data = []
    for c in COMMODITIES_FX:
        q = quotes_map.get(c["symbol"], {})
        price = q.get("regularMarketPrice", 0) or 0
        change_pct = q.get("regularMarketChangePercent", 0) or 0
        change = q.get("regularMarketChange", 0) or 0
        decimals = 4 if c["type"] == "doviz" else 2

        commodities_data.append({
            "id": c["id"],
            "symbol": c["symbol"],
            "name": c["name"],
            "flag": c["flag"],
            "type": c["type"],
            "price": round(price, decimals),
            "change": round(change, decimals),
            "change_pct": round(change_pct, 2),
            "status": "24s",
        })

    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_exchanges": sum(len(r["exchanges"]) for r in regions_data),
        "total_open": sum(r["open_count"] for r in regions_data),
        "regions": regions_data,
        "commodities": commodities_data,
        "_stale": False,
    }

    _world_cache.set("world_data", result)
    return result


# ═══════════════════════════════════════════════════════════════════════
# AI ANALYSIS
# ═══════════════════════════════════════════════════════════════════════

WORLD_ANALYST_PROMPT = """Sen FinMA dünya piyasası baş analistisin. Bloomberg Terminal + Perplexity Finance seviyesinde global piyasa istihbaratı üretiyorsun.

GÖREV: Verilen dünya borsası verilerini analiz edip yapılandırılmış Türkçe istihbarat raporu oluştur.

KURALLAR:
- Her zaman Türkçe yaz
- Kısa, öz, aksiyon odaklı ol
- Veri bazlı yorum yap, varsayımlardan kaçın
- Her bölge için 2-3 cümle yorum yaz — o bölgedeki öne çıkan sektör ve şirketlerden bahset
- Sektör ve tema bazlı analiz ekle
- "Yatırım tavsiyesi değildir" uyarısı EKLEME

YANITINI TAM OLARAK ŞU FORMATTA VER:

TREND: [YUKARI veya ASAGI veya KARISIK]

OZET:
[3-4 cümle genel global piyasa özeti — günün ana temaları, öne çıkan hareketler]

GUCLU:
[Yükselen borsalar ve güçlü temalar — madde madde]

ZAYIF:
[Düşen borsalar ve zayıf temalar — madde madde]

RISK:
[Risk faktörleri — madde madde]

FIRSAT:
[Yatırım fırsatları ve izlenecek temalar — madde madde]

OKYANUSYA:
[2-3 cümle Okyanusya borsaları yorumu — öne çıkan sektör/şirket]

ASYA:
[2-3 cümle Asya borsaları yorumu — öne çıkan sektör/şirket]

ORTA_DOGU:
[2-3 cümle Orta Doğu ve Türkiye borsaları yorumu — BIST öne çıkan hisseler]

AFRIKA:
[1-2 cümle Afrika borsaları yorumu]

AVRUPA:
[2-3 cümle Avrupa borsaları yorumu — öne çıkan sektör/şirket]

G_AMERIKA:
[2-3 cümle Güney Amerika borsaları yorumu — öne çıkan sektör/şirket]

K_AMERIKA:
[3-4 cümle Kuzey Amerika borsaları yorumu — ABD sektörleri ve öne çıkan şirketler]

EMTIA:
[2-3 cümle Emtia, döviz, kripto yorumu]"""


def _build_analysis_context(market_data: Dict) -> str:
    """Market data → AI context string (includes bellwether stocks)"""
    lines = [f"TARIH: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}", ""]

    for region in market_data.get("regions", []):
        lines.append(f"--- {region['name'].upper()} ({region['open_count']}/{region['total_count']} acik, ort: {region['avg_change_pct']:+.2f}%) ---")
        for ex in region["exchanges"]:
            vol_str = f", Hacim={ex['volume']:,.0f}" if ex.get("volume", 0) > 0 else ""
            open_str = f", Acilis={ex.get('open_price', 0)}, Acilistan={ex.get('open_change_pct', 0):+.2f}%" if ex.get("open_price", 0) > 0 else ""
            lines.append(
                f"  {ex['flag']} {ex['name']} ({ex['country']}): "
                f"Fiyat={ex['price']}, Degisim={ex['change_pct']:+.2f}%, "
                f"Durum={ex['status_tr']}"
                f"{open_str}"
                f", Gun Yuksek={ex['day_high']}, Gun Dusuk={ex['day_low']}"
                f"{vol_str}"
            )

        # Bellwether stocks for this region
        featured = region.get("featured_stocks", [])
        if featured:
            lines.append(f"  >> One Cikan Hisseler: " + ", ".join(
                f"{s['name']}({s['symbol']}) {s['change_pct']:+.2f}%" for s in featured
            ))
        lines.append("")

    lines.append("--- EMTIA & DOVIZ & KRIPTO ---")
    for c in market_data.get("commodities", []):
        lines.append(f"  {c['flag']} {c['name']}: Fiyat={c['price']}, Degisim={c['change_pct']:+.2f}%")

    return "\n".join(lines)


async def get_world_analysis() -> Dict:
    """
    AI destekli dünya piyasası analizi.
    Gemini'ye tüm dünya borsası verileri + ABD sektör verileri gönderilir.
    Cache: 3 dakika.
    """
    cached = _ai_cache.get("world_analysis")
    if cached:
        return cached

    # Market data
    market_data = get_world_market_data()
    context = _build_analysis_context(market_data)

    # ABD sektör ve rejim verileri (varsa)
    extra_context = ""
    try:
        from app.services.market_data import get_sector_performance, get_market_regime
        sectors = get_sector_performance("1d")
        regime = get_market_regime()

        sectors_text = "\n".join(
            f"  - {s.get('sector_tr', s.get('sector', '?'))}: {s.get('change_pct', 0):+.2f}%"
            for s in (sectors or [])[:11]
        )
        extra_context = (
            f"\n\n--- ABD PIYASA REJIMI ---\n"
            f"Rejim: {regime.get('regime_tr', '?')}\n"
            f"VIX: {regime.get('vix', '?')}\n"
            f"S&P 500 EMA20: {regime.get('spy_ema20', '?')}\n"
            f"\n--- ABD SEKTORLER (1 gunluk) ---\n{sectors_text}"
        )
    except Exception as e:
        logger.warning(f"Sector/regime data unavailable: {e}")

    # Gemini call
    from app.services.gemini_ai import call_gemini

    prompt = f"""Asagidaki dunya piyasasi verilerini analiz et ve Turkce istihbarat raporu olustur:

{context}{extra_context}

Lutfen yukaridaki format sablonuna tam uygun sekilde yanit ver. Her bolum basligini buyuk harfle yaz ve iki nokta ile bitir."""

    try:
        response = await call_gemini(prompt, WORLD_ANALYST_PROMPT)
        analysis = _parse_analysis(response)
    except Exception as e:
        logger.error(f"World analysis AI error: {e}")
        analysis = {
            "trend": "KARISIK",
            "summary": "AI analiz su an kullanilamiyor. Lutfen tekrar deneyin.",
            "strong": "", "weak": "", "risks": "", "opportunities": "",
            "regions": {},
            "raw": "",
        }

    _ai_cache.set("world_analysis", analysis)
    return analysis


def _parse_analysis(text: str) -> Dict:
    """Parse AI response into structured sections"""
    result = {
        "trend": "KARISIK",
        "summary": "",
        "strong": "",
        "weak": "",
        "risks": "",
        "opportunities": "",
        "regions": {},
        "raw": text,
    }

    current_key = None
    current_lines: List[str] = []
    sections: Dict[str, str] = {}

    header_map = {
        "TREND:": "_trend",
        "OZET:": "summary",
        "GUCLU:": "strong",
        "ZAYIF:": "weak",
        "RISK:": "risks",
        "FIRSAT:": "opportunities",
        "OKYANUSYA:": "r_okyanusya",
        "ASYA:": "r_asya",
        "ORTA_DOGU:": "r_orta_dogu",
        "ORTA DOGU:": "r_orta_dogu",
        "AFRIKA:": "r_afrika",
        "AVRUPA:": "r_avrupa",
        "G_AMERIKA:": "r_g_amerika",
        "K_AMERIKA:": "r_k_amerika",
        "EMTIA:": "r_emtia",
        "BOLGELER:": None,
    }

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            if current_key:
                current_lines.append("")
            continue

        found_header = False
        for header, key in header_map.items():
            if stripped.upper().startswith(header):
                if current_key and current_lines:
                    sections[current_key] = "\n".join(current_lines).strip()
                current_key = key
                current_lines = []
                after = stripped[len(header):].strip()
                if after:
                    current_lines.append(after)
                found_header = True
                break

        if not found_header and current_key is not None:
            current_lines.append(stripped)

    if current_key and current_lines:
        sections[current_key] = "\n".join(current_lines).strip()

    if "_trend" in sections:
        result["trend"] = sections["_trend"].upper()
    for key in ["summary", "strong", "weak", "risks", "opportunities"]:
        if key in sections:
            result[key] = sections[key]

    region_map = {
        "r_okyanusya": "okyanusya",
        "r_asya": "asya",
        "r_orta_dogu": "orta_dogu",
        "r_afrika": "afrika",
        "r_avrupa": "avrupa",
        "r_g_amerika": "g_amerika",
        "r_k_amerika": "k_amerika",
        "r_emtia": "emtia",
    }
    for internal, region_id in region_map.items():
        if internal in sections:
            result["regions"][region_id] = sections[internal]

    return result
