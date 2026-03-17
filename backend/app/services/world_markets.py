"""
World Markets Intelligence Service
Live data for 30+ global stock exchanges with AI analysis

Endpoints:
  GET /api/market/world          → Canlı dünya borsası verileri (3dk cache)
  GET /api/market/world/analysis → AI destekli global piyasa analizi (3dk cache)
"""

import time
import logging
import threading
import requests
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


# ─── TTL Cache ───
class _TTLCache:
    """Thread-safe TTL cache"""
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

    def set(self, key: str, value: Any):
        with self._lock:
            self._store[key] = value
            self._expiry[key] = time.time() + self._ttl


_world_cache = _TTLCache(ttl=180)   # 3 dakika — fiyat verileri
_ai_cache = _TTLCache(ttl=180)      # 3 dakika — AI analiz

_YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


# ═══════════════════════════════════════════════════════════════════════
# BORSA TANIMLARı — Yahoo Finance sembolleri + seans bilgileri
# ═══════════════════════════════════════════════════════════════════════

WORLD_EXCHANGES = [
    # ─── Okyanusya ───
    {"id": "nzx", "symbol": "^NZ50", "name": "NZX 50", "country": "Yeni Zelanda", "city": "Wellington",
     "region": "okyanusya", "flag": "🇳🇿", "local_open": "10:00", "local_close": "16:45", "tz": "NZDT"},
    {"id": "asx", "symbol": "^AXJO", "name": "ASX 200", "country": "Avustralya", "city": "Sidney",
     "region": "okyanusya", "flag": "🇦🇺", "local_open": "10:00", "local_close": "16:00", "tz": "AEDT"},

    # ─── Asya-Pasifik ───
    {"id": "nikkei", "symbol": "^N225", "name": "Nikkei 225", "country": "Japonya", "city": "Tokyo",
     "region": "asya", "flag": "🇯🇵", "local_open": "09:00", "local_close": "15:00", "tz": "JST"},
    {"id": "kospi", "symbol": "^KS11", "name": "KOSPI", "country": "Güney Kore", "city": "Seul",
     "region": "asya", "flag": "🇰🇷", "local_open": "09:00", "local_close": "15:30", "tz": "KST"},
    {"id": "sti", "symbol": "^STI", "name": "STI", "country": "Singapur", "city": "Singapur",
     "region": "asya", "flag": "🇸🇬", "local_open": "09:00", "local_close": "17:00", "tz": "SGT"},
    {"id": "shanghai", "symbol": "000001.SS", "name": "Shanghai Composite", "country": "Çin", "city": "Şanghay",
     "region": "asya", "flag": "🇨🇳", "local_open": "09:30", "local_close": "15:00", "tz": "CST"},
    {"id": "hsi", "symbol": "^HSI", "name": "Hang Seng", "country": "Hong Kong", "city": "Hong Kong",
     "region": "asya", "flag": "🇭🇰", "local_open": "09:30", "local_close": "16:00", "tz": "HKT"},
    {"id": "taiex", "symbol": "^TWII", "name": "TAIEX", "country": "Tayvan", "city": "Taipei",
     "region": "asya", "flag": "🇹🇼", "local_open": "09:00", "local_close": "13:30", "tz": "CST"},
    {"id": "sensex", "symbol": "^BSESN", "name": "Sensex", "country": "Hindistan", "city": "Mumbai",
     "region": "asya", "flag": "🇮🇳", "local_open": "09:15", "local_close": "15:30", "tz": "IST"},

    # ─── Orta Doğu ───
    {"id": "tadawul", "symbol": "^TASI", "name": "Tadawul", "country": "S. Arabistan", "city": "Riyad",
     "region": "orta_dogu", "flag": "🇸🇦", "local_open": "10:00", "local_close": "15:00", "tz": "AST"},
    {"id": "bist", "symbol": "XU100.IS", "name": "BIST 100", "country": "Türkiye", "city": "İstanbul",
     "region": "orta_dogu", "flag": "🇹🇷", "local_open": "09:40", "local_close": "18:10", "tz": "TRT"},

    # ─── Afrika ───
    {"id": "jse", "symbol": "^J203.JO", "name": "JSE All Share", "country": "G. Afrika", "city": "Johannesburg",
     "region": "afrika", "flag": "🇿🇦", "local_open": "09:00", "local_close": "17:00", "tz": "SAST"},

    # ─── Avrupa ───
    {"id": "ftse", "symbol": "^FTSE", "name": "FTSE 100", "country": "İngiltere", "city": "Londra",
     "region": "avrupa", "flag": "🇬🇧", "local_open": "08:00", "local_close": "16:30", "tz": "GMT"},
    {"id": "dax", "symbol": "^GDAXI", "name": "DAX 40", "country": "Almanya", "city": "Frankfurt",
     "region": "avrupa", "flag": "🇩🇪", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},
    {"id": "cac", "symbol": "^FCHI", "name": "CAC 40", "country": "Fransa", "city": "Paris",
     "region": "avrupa", "flag": "🇫🇷", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},
    {"id": "ibex", "symbol": "^IBEX", "name": "IBEX 35", "country": "İspanya", "city": "Madrid",
     "region": "avrupa", "flag": "🇪🇸", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},
    {"id": "mib", "symbol": "FTSEMIB.MI", "name": "FTSE MIB", "country": "İtalya", "city": "Milano",
     "region": "avrupa", "flag": "🇮🇹", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},
    {"id": "aex", "symbol": "^AEX", "name": "AEX", "country": "Hollanda", "city": "Amsterdam",
     "region": "avrupa", "flag": "🇳🇱", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},
    {"id": "smi", "symbol": "^SSMI", "name": "SMI", "country": "İsviçre", "city": "Zürih",
     "region": "avrupa", "flag": "🇨🇭", "local_open": "09:00", "local_close": "17:20", "tz": "CET"},
    {"id": "bel20", "symbol": "^BFX", "name": "BEL 20", "country": "Belçika", "city": "Brüksel",
     "region": "avrupa", "flag": "🇧🇪", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},
    {"id": "omx", "symbol": "^OMXS30", "name": "OMX Stockholm", "country": "İsveç", "city": "Stokholm",
     "region": "avrupa", "flag": "🇸🇪", "local_open": "09:00", "local_close": "17:25", "tz": "CET"},
    {"id": "athex", "symbol": "GD.AT", "name": "ATHEX", "country": "Yunanistan", "city": "Atina",
     "region": "avrupa", "flag": "🇬🇷", "local_open": "10:30", "local_close": "17:20", "tz": "EET"},
    {"id": "stoxx50", "symbol": "^STOXX50E", "name": "Euro Stoxx 50", "country": "Avrupa", "city": "—",
     "region": "avrupa", "flag": "🇪🇺", "local_open": "09:00", "local_close": "17:30", "tz": "CET"},

    # ─── Güney Amerika ───
    {"id": "bovespa", "symbol": "^BVSP", "name": "Bovespa", "country": "Brezilya", "city": "Sao Paulo",
     "region": "g_amerika", "flag": "🇧🇷", "local_open": "10:00", "local_close": "18:00", "tz": "BRT"},
    {"id": "merval", "symbol": "^MERV", "name": "MERVAL", "country": "Arjantin", "city": "Buenos Aires",
     "region": "g_amerika", "flag": "🇦🇷", "local_open": "11:00", "local_close": "17:00", "tz": "ART"},

    # ─── Kuzey Amerika ───
    {"id": "sp500", "symbol": "^GSPC", "name": "S&P 500", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00", "tz": "ET"},
    {"id": "djia", "symbol": "^DJI", "name": "Dow Jones", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00", "tz": "ET"},
    {"id": "nasdaq", "symbol": "^IXIC", "name": "Nasdaq", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00", "tz": "ET"},
    {"id": "russell", "symbol": "^RUT", "name": "Russell 2000", "country": "ABD", "city": "New York",
     "region": "k_amerika", "flag": "🇺🇸", "local_open": "09:30", "local_close": "16:00", "tz": "ET"},
    {"id": "ipc", "symbol": "^MXX", "name": "IPC Mexico", "country": "Meksika", "city": "Mexico City",
     "region": "k_amerika", "flag": "🇲🇽", "local_open": "08:30", "local_close": "15:00", "tz": "CT"},
    {"id": "tsx", "symbol": "^GSPTSE", "name": "S&P/TSX", "country": "Kanada", "city": "Toronto",
     "region": "k_amerika", "flag": "🇨🇦", "local_open": "09:30", "local_close": "16:00", "tz": "ET"},
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
# MARKET STATUS
# ═══════════════════════════════════════════════════════════════════════

def _status_tr(state: str) -> str:
    """Yahoo marketState → Türkçe"""
    return {
        "REGULAR": "Acik",
        "PRE": "Acilis Oncesi",
        "POST": "Kapanis Sonrasi",
        "PREPRE": "Acilis Oncesi",
        "POSTPOST": "Kapanis Sonrasi",
        "CLOSED": "Kapali",
    }.get(state, "Kapali")


def _status_key(state: str) -> str:
    """Yahoo marketState → key"""
    return {
        "REGULAR": "open",
        "PRE": "pre",
        "POST": "post",
        "PREPRE": "pre",
        "POSTPOST": "post",
        "CLOSED": "closed",
    }.get(state, "closed")


# ═══════════════════════════════════════════════════════════════════════
# LIVE DATA FETCH
# ═══════════════════════════════════════════════════════════════════════

def get_world_market_data() -> Dict:
    """
    Dünya borsalarının canlı verilerini getir.
    30+ endeks + 10 emtia/döviz/kripto — Yahoo v7 batch API.
    Cache: 3 dakika.
    """
    cached = _world_cache.get("world_data")
    if cached:
        return cached

    # Tüm sembolleri topla
    index_symbols = [ex["symbol"] for ex in WORLD_EXCHANGES]
    commodity_symbols = [c["symbol"] for c in COMMODITIES_FX]
    all_symbols = index_symbols + commodity_symbols

    # Yahoo Finance v7 batch fetch
    quotes_map: Dict[str, Dict] = {}
    try:
        # Split into chunks of 20 to avoid URL length limits
        for i in range(0, len(all_symbols), 20):
            chunk = all_symbols[i:i+20]
            url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={','.join(chunk)}"
            resp = requests.get(url, headers=_YF_HEADERS, timeout=12)
            if resp.status_code == 200:
                data = resp.json()
                for q in data.get("quoteResponse", {}).get("result", []):
                    quotes_map[q.get("symbol", "")] = q
    except Exception as e:
        logger.error(f"World markets batch fetch error: {e}")

    # Bölgeler
    regions_data = []
    for region in REGIONS:
        exchanges = [ex for ex in WORLD_EXCHANGES if ex["region"] == region["id"]]
        exchange_list = []

        for ex in exchanges:
            q = quotes_map.get(ex["symbol"], {})
            price = q.get("regularMarketPrice", 0) or 0
            change = q.get("regularMarketChange", 0) or 0
            change_pct = q.get("regularMarketChangePercent", 0) or 0
            market_state = q.get("marketState", "CLOSED")
            prev_close = q.get("regularMarketPreviousClose", 0) or 0
            day_high = q.get("regularMarketDayHigh", 0) or 0
            day_low = q.get("regularMarketDayLow", 0) or 0
            volume = q.get("regularMarketVolume", 0) or 0
            short_name = q.get("shortName", ex["name"])

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
                "day_high": round(day_high, 2),
                "day_low": round(day_low, 2),
                "volume": volume,
                "status": _status_key(market_state),
                "status_tr": _status_tr(market_state),
                "local_open": ex["local_open"],
                "local_close": ex["local_close"],
                "tz": ex["tz"],
            })

        if exchange_list:
            # Bölge özeti: kaç açık, ortalama değişim
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

    # Emtia / Döviz / Kripto
    commodities_data = []
    for c in COMMODITIES_FX:
        q = quotes_map.get(c["symbol"], {})
        price = q.get("regularMarketPrice", 0) or 0
        change_pct = q.get("regularMarketChangePercent", 0) or 0
        change = q.get("regularMarketChange", 0) or 0

        # Döviz çiftleri için 4 ondalık
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
- Her bölge için 2-3 cümle yorum yaz
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
[2-3 cümle Okyanusya borsaları yorumu]

ASYA:
[2-3 cümle Asya borsaları yorumu]

ORTA_DOGU:
[2-3 cümle Orta Doğu ve Türkiye borsaları yorumu]

AFRIKA:
[1-2 cümle Afrika borsaları yorumu]

AVRUPA:
[2-3 cümle Avrupa borsaları yorumu]

G_AMERIKA:
[2-3 cümle Güney Amerika borsaları yorumu]

K_AMERIKA:
[3-4 cümle Kuzey Amerika borsaları yorumu — ABD sektörleri dahil]

EMTIA:
[2-3 cümle Emtia, döviz, kripto yorumu]"""


def _build_analysis_context(market_data: Dict) -> str:
    """Market data → AI context string"""
    lines = [f"TARIH: {datetime.now().strftime('%Y-%m-%d %H:%M UTC')}", ""]

    for region in market_data.get("regions", []):
        lines.append(f"--- {region['name'].upper()} ({region['open_count']}/{region['total_count']} acik, ort: {region['avg_change_pct']:+.2f}%) ---")
        for ex in region["exchanges"]:
            vol_str = ""
            if ex["volume"] > 0:
                vol_str = f", Hacim={ex['volume']:,.0f}"
            lines.append(
                f"  {ex['flag']} {ex['name']} ({ex['country']}): "
                f"Fiyat={ex['price']}, Degisim={ex['change_pct']:+.2f}%, "
                f"Durum={ex['status_tr']}, "
                f"Gun Yuksek={ex['day_high']}, Gun Dusuk={ex['day_low']}"
                f"{vol_str}"
            )
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

    # Section header mapping
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
        "BOLGELER:": None,  # skip
    }

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            if current_key:
                current_lines.append("")
            continue

        # Check for section header
        found_header = False
        for header, key in header_map.items():
            if stripped.upper().startswith(header):
                # Save previous section
                if current_key and current_lines:
                    sections[current_key] = "\n".join(current_lines).strip()
                current_key = key
                current_lines = []
                # Content after header on same line
                after = stripped[len(header):].strip()
                if after:
                    current_lines.append(after)
                found_header = True
                break

        if not found_header and current_key is not None:
            current_lines.append(stripped)

    # Save last section
    if current_key and current_lines:
        sections[current_key] = "\n".join(current_lines).strip()

    # Map to result
    if "_trend" in sections:
        result["trend"] = sections["_trend"].upper()
    for key in ["summary", "strong", "weak", "risks", "opportunities"]:
        if key in sections:
            result[key] = sections[key]

    # Region analyses
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
