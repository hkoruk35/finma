# ============================================================
# FinMA Daily 100 — Bot Configuration
# config.py v1.0 | April 2026
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

# Telegram — disabled by default
ENABLE_TELEGRAM      = os.getenv("ENABLE_TELEGRAM", "false").lower() == "true"
TELEGRAM_BOT_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID     = os.getenv("TELEGRAM_CHAT_ID", "")

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
# FIXED 100-STOCK UNIVERSE
# (Admin can modify via Supabase DB; this is the fallback)
# ============================================================

FIXED_100_TICKERS = [
    # Top 100 US Equities by Market Cap & Performance
    "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "ADBE", "CRM", "AMD", "QCOM", "TXN",
    "INTU", "IBM", "NOW", "MU", "LRCX", "AMAT", "PANW", "SNOW", "PLTR", "MSTR",
    "GOOGL", "META", "NFLX", "DIS", "CMCSA", "T", "VZ", "TMUS", "CHTR", "SPOT",
    "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX", "ABNB",
    "JPM", "V", "MA", "BAC", "WFC", "MS", "GS", "BLK", "BX", "PYPL",
    "COIN", "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "PFE", "ABT", "DHR",
    "ISRG", "XOM", "CVX", "COP", "OXY", "SLB", "EOG", "FANG", "WMT", "PG",
    "KO", "PEP", "COST", "PM", "EL", "CAT", "GE", "UNP", "HON", "RTX",
    "LMT", "DE", "BA", "UPS", "NEE", "DUK", "SO", "AEP", "EXC", "PLD",
    "AMT", "EQIX", "SPG", "CCI", "LIN", "FCX", "APD", "NEM", "SHW", "SMCI",
]

# ============================================================
# TICKER → SECTOR MAPPING (Accurate Industry Standards)
# ============================================================

TICKER_SECTOR_MAP = {
    # Technology
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", "AVGO": "Technology",
    "ORCL": "Technology", "ADBE": "Technology", "CRM": "Technology", "AMD": "Technology",
    "QCOM": "Technology", "TXN": "Technology", "INTU": "Technology", "IBM": "Technology",
    "NOW": "Technology", "MU": "Technology", "LRCX": "Technology", "AMAT": "Technology",
    "PANW": "Technology", "SNOW": "Technology", "PLTR": "Technology", "MSTR": "Technology",
    "SMCI": "Technology",
    # Communication Services
    "GOOGL": "Communication Services", "META": "Communication Services", "NFLX": "Communication Services",
    "DIS": "Communication Services", "CMCSA": "Communication Services", "T": "Communication Services",
    "VZ": "Communication Services", "TMUS": "Communication Services", "CHTR": "Communication Services",
    "SPOT": "Communication Services",
    # Consumer Discretionary
    "AMZN": "Consumer Discretionary", "TSLA": "Consumer Discretionary", "HD": "Consumer Discretionary",
    "MCD": "Consumer Discretionary", "NKE": "Consumer Discretionary", "SBUX": "Consumer Discretionary",
    "LOW": "Consumer Discretionary", "BKNG": "Consumer Discretionary", "TJX": "Consumer Discretionary",
    "ABNB": "Consumer Discretionary",
    # Financials
    "JPM": "Financials", "V": "Financials", "MA": "Financials", "BAC": "Financials",
    "WFC": "Financials", "MS": "Financials", "GS": "Financials", "BLK": "Financials",
    "BX": "Financials", "PYPL": "Financials", "COIN": "Financials",
    # Healthcare
    "LLY": "Healthcare", "UNH": "Healthcare", "JNJ": "Healthcare", "ABBV": "Healthcare",
    "MRK": "Healthcare", "TMO": "Healthcare", "PFE": "Healthcare", "ABT": "Healthcare",
    "DHR": "Healthcare", "ISRG": "Healthcare",
    # Energy
    "XOM": "Energy", "CVX": "Energy", "COP": "Energy", "OXY": "Energy", "SLB": "Energy",
    "EOG": "Energy", "FANG": "Energy",
    # Consumer Staples
    "WMT": "Consumer Staples", "PG": "Consumer Staples", "KO": "Consumer Staples",
    "PEP": "Consumer Staples", "COST": "Consumer Staples", "PM": "Consumer Staples",
    "EL": "Consumer Staples",
    # Industrials
    "CAT": "Industrials", "GE": "Industrials", "UNP": "Industrials", "HON": "Industrials",
    "RTX": "Industrials", "LMT": "Industrials", "DE": "Industrials", "BA": "Industrials",
    "UPS": "Industrials",
    # Utilities
    "NEE": "Utilities", "DUK": "Utilities", "SO": "Utilities", "AEP": "Utilities", "EXC": "Utilities",
    # Real Estate
    "PLD": "Real Estate", "AMT": "Real Estate", "EQIX": "Real Estate", "SPG": "Real Estate", "CCI": "Real Estate",
    # Materials
    "LIN": "Materials", "FCX": "Materials", "APD": "Materials", "NEM": "Materials", "SHW": "Materials",
}

# ============================================================
# SECTOR → ETF MAPPING
# ============================================================

SECTOR_ETF_MAP = {
    "Technology": "XLK",
    "Financials": "XLF",
    "Healthcare": "XLV",
    "Consumer Discretionary": "XLY",
    "Industrials": "XLI",
    "Communication Services": "XLC",
    "Energy": "XLE",
    "Consumer Staples": "XLP",
    "Real Estate": "XLRE",
    "Materials": "XLB",
    "Utilities": "XLU",
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
GEMINI_BATCH_DELAY_SEC    = 0    # Wait between batches (rate limit: 15 req/min)
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
