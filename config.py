# ============================================================
# FinMA Daily — Bot Configuration
# config.py v2.0 | April 2026
# ============================================================
# This file is the single source of truth for the bot.
# The ticker universe is also stored in Supabase for admin
# management. Bot reads from Supabase at startup if available,
# falls back to this static list.
# ============================================================

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# ENVIRONMENT VARIABLES
# ============================================================

GEMINI_API_KEY       = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL         = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

SUPABASE_URL         = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # Service role key for bot

ADMIN_PASSWORD       = os.getenv("ADMIN_PASSWORD", "changeme")
JWT_SECRET           = os.getenv("JWT_SECRET", "changeme-jwt-secret")

CONTACT_EMAIL        = os.getenv("CONTACT_EMAIL", "contact@finmasmart.com")

# Telegram — enabled for daily notifications
ENABLE_TELEGRAM                  = True
TELEGRAM_BOT_TOKEN               = "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k"
TELEGRAM_CHAT_ID                 = "-1003569445341"
ENABLE_TELEGRAM_NOTIFICATIONS    = True

# ============================================================
# SCHEDULER SETTINGS
# ============================================================

DAILY_RUN_HOUR   = 9   # 09:00 New York time
DAILY_RUN_MINUTE = 0
NY_TIMEZONE      = "America/New_York"
WEEKDAY_SET      = {0, 1, 2, 3, 4}  # Mon=0 ... Fri=4

# ============================================================
# PATHS
# ============================================================

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR     = os.path.join(BASE_DIR, "data")
TRANSFER_DIR = os.path.join(BASE_DIR, "transfer")
LOG_DIR      = os.path.join(BASE_DIR, "logs")

TRANSFER_LATEST  = os.path.join(TRANSFER_DIR, "latest")
TRANSFER_ARCHIVE = os.path.join(TRANSFER_DIR, "archive")

# ============================================================
# EXPANDED TICKER UNIVERSE — 350+ US Equities
# (Admin can modify via Supabase DB; this is the fallback)
# Organized by GICS Sector for maintainability
# ============================================================

FIXED_TICKERS_TECHNOLOGY = [
    # Mega-cap Platform & Cloud
    "AAPL", "MSFT", "GOOGL", "META", "AMZN",
    # Semiconductors & Hardware
    "NVDA", "AMD", "AVGO", "QCOM", "TXN", "MU", "LRCX", "AMAT", "KLAC",
    "MRVL", "MCHP", "SWKS", "MPWR", "ON", "WOLF", "SMCI", "ARM",
    "ADI", "STX", "WDC", "SNDK", "COHR", "LITE",
    # Software & Cloud Applications
    "ORCL", "CRM", "ADBE", "NOW", "INTU", "WDAY", "TEAM", "ZM", "DDOG",
    "MDB", "SNOW", "HUBS", "VEEV", "BILL", "GTLB", "TTD", "SMAR", "ZS",
    # Cybersecurity
    "PANW", "CRWD", "FTNT", "OKTA", "S", "CYBR",
    # AI & Data
    "PLTR", "MSTR", "IBM", "ANSS", "CDNS", "SNPS",
    # Infrastructure & Networking
    "CSCO", "NET", "AKAM", "ANET", "JNPR", "NTAP",
    # Hardware & Devices
    "DELL", "INTC", "TSM", "GLW", "GRMN", "KEYS", "VRT",
]

FIXED_TICKERS_COMMUNICATION = [
    # Social & Search
    "GOOGL", "META",
    # Streaming & Entertainment
    "NFLX", "DIS", "SPOT", "ROKU", "WBD", "PARA",
    # Telecom — US
    "T", "VZ", "TMUS", "CHTR", "CMCSA",
    # Telecom — Global
    "NOK", "ERIC", "VOD", "AMX",
    # Gaming
    "EA", "TTWO", "RBLX",
    # Interactive & Social
    "SNAP", "PINS", "MTCH", "TKO",
    # Advertising
    "OMC",
    # EM Digital
    "BIDU",
]

FIXED_TICKERS_CONSUMER_DISCRETIONARY = [
    # E-commerce & Marketplace
    "AMZN", "EBAY", "ETSY", "W", "BABA",
    # Automotive & EV
    "TSLA", "F", "GM", "RIVN", "LCID",
    # Home Improvement
    "HD", "LOW", "WSM",
    # Fast Food & Restaurant
    "MCD", "SBUX", "CMG", "YUM", "QSR", "DPZ", "WEN",
    # Apparel & Footwear
    "NKE", "LULU", "RL", "PVH", "TPR", "VFC", "UAA",
    # Travel & Leisure
    "BKNG", "ABNB", "EXPE", "MAR", "HLT", "H", "RCL", "CCL", "NCLH", "LYV", "FUN",
    # Retail
    "TJX", "ROST", "FIVE", "DLTR", "DG",
    # Delivery & Gig
    "UBER", "LYFT", "DASH",
    # Luxury & Other
    "TSCO", "SIG", "ANF", "CAVA", "CAR",
]

FIXED_TICKERS_CONSUMER_STAPLES = [
    # Household & Personal Care
    "PG", "CL", "KMB", "CHD",
    # Beverages
    "KO", "PEP", "MNST", "STZ", "BF.B",
    # Food & Snacks
    "MDLZ", "GIS", "CPB", "HRL", "CAG", "SJM", "K", "HSY", "TSN",
    # Tobacco
    "PM", "MO", "BTI",
    # Retail / Wholesale
    "WMT", "COST", "TGT", "KR", "SFM",
    # Beauty & Cosmetics
    "EL", "ULTA", "COTY",
    # Agriculture
    "ADM", "BG", "MOS", "CTVA",
    # Food Service Distribution
    "SYY",
]

FIXED_TICKERS_HEALTHCARE = [
    # Large-cap Pharma — US
    "LLY", "JNJ", "ABBV", "MRK", "PFE", "BMY", "AMGN", "REGN", "GILD",
    "BIIB", "VRTX", "ALNY", "MRNA", "EXEL",
    # Large-cap Pharma — Global
    "AZN", "NVS", "TAK", "TEVA", "BNTX",
    # Medical Devices & Equipment
    "UNH", "ABT", "MDT", "ISRG", "BSX", "SYK", "EW", "ZBH", "HOLX",
    "BDX", "BAX", "DXCM", "PODD", "INSP", "NVCR",
    # Diagnostics & Services
    "TMO", "DHR", "A", "IQV", "PKI", "ILMN", "LH", "DGX",
    # Health Insurance & Services
    "CVS", "CI", "ELV", "HCA", "THC",
    # Veterinary
    "ZTS", "IDEXX",
    # Biotech Emerging
    "SRPT", "RARE", "ACAD",
]

FIXED_TICKERS_FINANCIALS = [
    # Money-Center Banks — US
    "JPM", "BAC", "WFC", "C", "USB", "TFC", "PNC",
    # Money-Center Banks — Canada
    "RY", "TD", "BNS", "CM", "BMO",
    # Money-Center Banks — Europe/Asia
    "HSBC", "ING", "BCS", "SAN", "BBVA", "SMFG", "MUFG", "NWG", "LYG",
    # Investment Banking & Asset Management
    "GS", "MS", "BLK", "BX", "KKR", "APO", "ARES", "CG",
    "AMP", "NTRS", "BK",
    # Insurance
    "BRK.B", "AIG", "MET", "PRU", "AFL", "ALL", "CB", "TRV", "HIG", "PUK",
    # Payment Networks
    "V", "MA", "AXP", "PYPL", "SQ", "FIS", "FISV", "GPN",
    # Brokerage & Exchange
    "SCHW", "IBKR", "ICE", "CME", "CBOE", "NDAQ",
    # Fintech & Crypto
    "COIN", "HOOD", "SOFI", "NU",
    # Data & Ratings
    "MCO", "SPGI", "MSCI",
    # Business Services
    "RBA",
    # Regional Banks — US
    "RF", "HBAN", "CFG", "FITB", "MTB", "KEY",
]

FIXED_TICKERS_ENERGY = [
    # Integrated Majors — US
    "XOM", "CVX",
    # Integrated Majors — International
    "SHEL", "TTE", "BP", "EQNR",
    # E&P — US
    "COP", "EOG", "OXY", "DVN", "FANG", "HES", "APA", "MRO",
    "MTDR", "CHRD", "CRGY", "EQT", "MUR",
    # E&P — Canada
    "CNQ", "CVE", "SU", "OVV",
    # E&P — International/EM
    "PBR", "EC",
    # Oilfield Services
    "SLB", "HAL", "BKR", "OII",
    # Refining & Marketing
    "MPC", "VLO", "PSX", "PARR",
    # Midstream & Pipeline — US
    "KMI", "WMB", "ET", "EPD", "MPLX", "OKE", "TRGP", "DTM", "KNTK",
    # Midstream & Pipeline — Canada
    "ENB", "TRP",
    # LNG & Shipping
    "LNG", "GLNG", "FLNG", "WDS",
    # Offshore & Support
    "VAL", "RIG", "TDW", "AROC",
    # Coal
    "BTU", "ARCH",
    # Renewables
    "BEP",
    # Uranium (nükleer talep)
    "CCJ",
    # TPL (arazi & enerji)
    "TPL",
]

FIXED_TICKERS_MATERIALS = [
    # Copper & Base Metals
    "FCX", "SCCO", "TECK",
    # Diversified Mining
    "RIO", "BHP", "VALE", "MT",
    # Gold Mining
    "NEM", "GOLD", "AEM", "WPM", "RGLD", "FNV", "KGC", "GFI", "AU", "SSRM",
    # Silver Mining
    "PAAS", "FSM",
    # Lithium & Battery Metals
    "ALB", "SQM", "LTHM", "SGML",
    # Industrial Gases
    "LIN", "APD", "CE",
    # Specialty Chemicals
    "SHW", "ECL", "PPG", "DD", "DOW", "LYB", "EMN",
    # Agriculture Chemicals
    "CF", "NTR",
    # Steel & Aluminum
    "NUE", "STLD", "X", "AA", "CENX",
    # Construction Materials
    "MLM", "VMC", "CRH", "EXP",
    # Paper & Packaging
    "IP", "PKG", "WRK",
    # Other
    "NEXA", "BVN",
]

FIXED_TICKERS_INDUSTRIALS = [
    # Aerospace & Defense
    "BA", "LMT", "RTX", "NOC", "GD", "HII", "TDG", "AXON", "LHX", "KTOS",
    # Engines & Power
    "GE", "GEV", "CMI",
    # Precision Instruments & Test
    "TDY", "AME", "KEYS",
    # Machinery & Equipment
    "CAT", "DE", "EMR", "ETN", "ROK", "PH", "IR", "XYL", "DOV", "HUBB",
    "HWM", "WAB", "ALSN",
    # Conglomerate
    "HON", "MMM",
    # Transportation — Rail
    "UNP", "CSX", "NSC", "CNI",
    # Transportation — Parcel & Air
    "UPS", "FDX",
    # Transportation — Trucking
    "ODFL", "PCAR",
    # Transportation — Airlines
    "DAL", "UAL", "AAL", "LUV", "ALK",
    # Freight Brokerage & Logistics
    "CHRW", "EXPD",
    # Staffing & Business Services
    "WM", "RSG", "CTAS", "ROP", "FAST", "GWW", "ROL", "MSCI",
    # Construction & Engineering
    "PWR", "FLR", "J", "PRIM", "MTZ", "STRL",
    # Leasing & Rental
    "URI", "AL", "AER", "WSC",
    # Commercial Services
    "BR", "VRSK", "DNB",
    # Aviation MRO
    "AIR",
    # Other
    "SYM", "FTAI",
]

FIXED_TICKERS_UTILITIES = [
    # Electric — Regulated
    "NEE", "DUK", "SO", "AEP", "EXC", "PEG", "XEL", "ED", "ES", "WEC",
    "ETR", "CMS", "DTE", "EVRG", "OGE", "AEE", "ATO", "EIX", "FE", "PPL",
    # Electric — UK/International
    "NGG",
    # Electric — Clean/Nuclear (AI Power Demand)
    "VST", "CEG", "NRG", "AES",
    # Gas & Multi-Utility
    "SRE", "PCG", "NI", "OGS", "CNP",
    # Water
    "AWK", "WTRG", "CWT", "MSEX",
    # Renewable / YieldCo
    "CWEN", "AY",
    # Bloom Energy (fuel cell)
    "BE",
]

FIXED_TICKERS_REAL_ESTATE = [
    # Diversified REIT
    "PLD", "O", "VICI", "EPRT", "GOOD", "GTY",
    # Data Center REIT
    "EQIX", "AMT", "DLR", "CCI", "SBAC",
    # Industrial / Logistics REIT
    "EGP", "FR",
    # Office REIT
    "BXP", "VNO",
    # Retail REIT
    "SPG", "MAC", "KIM", "REG", "FRT", "KRG",
    # Residential REIT
    "AVB", "EQR", "MAA", "UDR", "CPT", "NMI", "AMH",
    # Healthcare REIT
    "WELL", "VTR", "HR", "OHI",
    # Storage REIT
    "PSA", "EXR", "CUBE", "LSI",
    # Specialty REIT
    "IRM", "ARE", "CBRE", "HST", "LAMR", "SUI", "RHP", "PEB",
    # Timber REIT
    "WY", "PCH",
    # Hotels
    "DHI",
]

# ============================================================
# MASTER TICKER LIST (deduplicated, combined)
# ============================================================

_all_tickers_raw = (
    FIXED_TICKERS_TECHNOLOGY
    + FIXED_TICKERS_COMMUNICATION
    + FIXED_TICKERS_CONSUMER_DISCRETIONARY
    + FIXED_TICKERS_CONSUMER_STAPLES
    + FIXED_TICKERS_HEALTHCARE
    + FIXED_TICKERS_FINANCIALS
    + FIXED_TICKERS_ENERGY
    + FIXED_TICKERS_MATERIALS
    + FIXED_TICKERS_INDUSTRIALS
    + FIXED_TICKERS_UTILITIES
    + FIXED_TICKERS_REAL_ESTATE
)

# Deduplicate while preserving first-occurrence order
_seen = set()
FIXED_100_TICKERS = []
for _t in _all_tickers_raw:
    if _t not in _seen:
        _seen.add(_t)
        FIXED_100_TICKERS.append(_t)

# ============================================================
# TICKER → SECTOR MAPPING
# ============================================================

TICKER_SECTOR_MAP = {}

_sector_lists = {
    "Technology":               FIXED_TICKERS_TECHNOLOGY,
    "Communication Services":   FIXED_TICKERS_COMMUNICATION,
    "Consumer Discretionary":   FIXED_TICKERS_CONSUMER_DISCRETIONARY,
    "Consumer Staples":         FIXED_TICKERS_CONSUMER_STAPLES,
    "Healthcare":               FIXED_TICKERS_HEALTHCARE,
    "Financials":               FIXED_TICKERS_FINANCIALS,
    "Energy":                   FIXED_TICKERS_ENERGY,
    "Materials":                FIXED_TICKERS_MATERIALS,
    "Industrials":              FIXED_TICKERS_INDUSTRIALS,
    "Utilities":                FIXED_TICKERS_UTILITIES,
    "Real Estate":              FIXED_TICKERS_REAL_ESTATE,
}

for _sector, _tickers in _sector_lists.items():
    for _t in _tickers:
        # First-write wins (matches dedup logic above)
        if _t not in TICKER_SECTOR_MAP:
            TICKER_SECTOR_MAP[_t] = _sector

# ============================================================
# SECTOR → ETF MAPPING
# ============================================================

SECTOR_ETF_MAP = {
    "Technology":               "XLK",
    "Financials":               "XLF",
    "Healthcare":               "XLV",
    "Consumer Discretionary":   "XLY",
    "Industrials":              "XLI",
    "Communication Services":   "XLC",
    "Energy":                   "XLE",
    "Consumer Staples":         "XLP",
    "Real Estate":              "XLRE",
    "Materials":                "XLB",
    "Utilities":                "XLU",
}

# ============================================================
# MASTER SCORE WEIGHTS
# ============================================================

SCORE_WEIGHTS = {
    "technical":    0.35,
    "fundamental":  0.25,
    "momentum":     0.20,
    "sentiment":    0.10,
    "sector":       0.10,
}

# ============================================================
# SIGNAL THRESHOLDS
# ============================================================

SIGNAL_THRESHOLDS = {
    "STRONG_BUY":  0.85,
    "BUY":         0.70,
    "NEUTRAL":     0.55,
    "SELL":        0.40,
    # Below 0.40 → STRONG_SELL
}

# ============================================================
# CATEGORY MENU LIMITS
# ============================================================

CATEGORY_LIMITS = {
    "breakout":    {"min": 3, "max": 20},
    "value":       {"min": 3, "max": 20},
    "reversal":    {"min": 3, "max": 20},
    "momentum":    {"min": 3, "max": 20},
    "dividend":    {"min": 3, "max": 20},
    "top_signals": {"min": 3, "max": 20},
}

TOP_SIGNALS_MIN_CONFIDENCE = 0.85  # Minimum confidence for top_signals list

# ============================================================
# TECHNICAL INDICATOR PARAMETERS
# ============================================================

RSI_PERIOD      = 14
MACD_FAST       = 12
MACD_SLOW       = 26
MACD_SIGNAL     = 9
EMA_SHORT       = 20
EMA_MID         = 50
EMA_LONG        = 200
BB_PERIOD       = 20
BB_STD          = 2
ATR_PERIOD      = 14
ADX_PERIOD      = 14
OBV_TREND_DAYS  = 10
MFI_PERIOD      = 14
STOCH_K         = 14
STOCH_D         = 3
LOOKBACK_DAYS   = 270   # 252 trading days (1Y) + buffer for holidays/weekends

# RSI optimal range for scoring
RSI_BULLISH_MIN = 45
RSI_BULLISH_MAX = 70

# RVOL calculation periods
RVOL_SHORT_DAYS = 5
RVOL_LONG_DAYS  = 30

# ============================================================
# GEMINI AI SETTINGS
# ============================================================

GEMINI_BATCH_SIZE         = 10    # Process N stocks per Gemini batch
GEMINI_BATCH_DELAY_SEC    = 0     # Wait between batches (rate limit: 15 req/min)
GEMINI_MAX_TOKENS         = 300   # ~150 words output
GEMINI_SUMMARY_WORD_LIMIT = 150

# Regenerate AI summary only if score changes by this many points
GEMINI_REGEN_THRESHOLD = 5.0

# ============================================================
# INDEX BENCHMARKS (fetched for master.json)
# ============================================================

INDEX_TICKERS = {
    "SP500":   "^GSPC",
    "NASDAQ":  "^IXIC",
    "DOW":     "^DJI",
    "VIX":     "^VIX",
    "RUSSELL": "^RUT",
}

# ============================================================
# MARKET REGIME THRESHOLDS
# ============================================================

MARKET_REGIME_THRESHOLDS = {
    # Based on SP500 5-day performance
    "BULL":       0.005,   # > +0.5% = Bull
    "BEAR":      -0.005,   # < -0.5% = Bear
    # Between = Neutral
}

# ============================================================
# QUICK STATS (auto-computed at import time)
# ============================================================

TICKER_COUNT    = len(FIXED_100_TICKERS)
SECTOR_COUNTS   = {s: sum(1 for t in FIXED_100_TICKERS if TICKER_SECTOR_MAP.get(t) == s)
                   for s in SECTOR_ETF_MAP}
