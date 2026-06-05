#!/usr/bin/env python3
"""
build_swing_performance.py
--------------------------
Matches live bogastock.com logic exactly:
  - entry = Giris (Buy_L) column (with score-shift detection for CSV rows)
  - max_price = highest High within 30-day window from entry date
  - return_pct = (max_price - entry) / entry * 100
  - days = days from entry to peak
  - result: PENDING (window open), WIN (return > 0, window closed), LOSS (return <= 0, closed)

Enhancements over live:
  - subsector data (no blanks)
  - full 1054 records from swing_table.json
"""

import json
import re
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent
TABLE_FILE = BASE_DIR / "frontend" / "public" / "swing_table.json"
OUTPUT     = BASE_DIR / "frontend" / "public" / "swing_performance.json"
CACHE_FILE = Path(r"C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists\persistent_info_cache.json")

# ── Turkish month map ────────────────────────────────────────────────────────
TR_MONTHS = {
    "ocak": 1, "şubat": 2, "mart": 3, "nisan": 4, "mayıs": 5, "haziran": 6,
    "temmuz": 7, "ağustos": 8, "eylül": 9, "ekim": 10, "kasım": 11, "aralık": 12
}
TODAY = datetime.today().date()

def parse_tr_date(s: str) -> str | None:
    s = re.sub(r"[^\w\s]", " ", s).strip()
    parts = s.split()
    if len(parts) < 2:
        return None
    try:
        day = int(parts[0])
    except ValueError:
        return None
    month_tr = parts[1].lower()
    month = TR_MONTHS.get(month_tr)
    if not month:
        return None
    if len(parts) >= 3:
        year = int(parts[2])
    else:
        year = 2026
        if month > TODAY.month + 2:
            year = 2025
    try:
        return datetime(year, month, day).strftime("%Y-%m-%d")
    except ValueError:
        return None

def clean_ticker(s: str) -> str:
    return re.sub(r"[^\w.]", "", s).strip().upper()

# ── Static GICS subsector mapping ─────────────────────────────────────────────
STATIC_SECTOR: dict[str, tuple[str, str]] = {
    # Technology
    "AAPL":  ("Technology", "Consumer Electronics"),
    "MSFT":  ("Technology", "Software—Infrastructure"),
    "NVDA":  ("Technology", "Semiconductors"),
    "AMD":   ("Technology", "Semiconductors"),
    "INTC":  ("Technology", "Semiconductors"),
    "AVGO":  ("Technology", "Semiconductors"),
    "QCOM":  ("Technology", "Semiconductors"),
    "MU":    ("Technology", "Semiconductors"),
    "ARM":   ("Technology", "Semiconductors"),
    "SMCI":  ("Technology", "Computer Hardware"),
    "AMAT":  ("Technology", "Semiconductor Equipment"),
    "KLAC":  ("Technology", "Semiconductor Equipment"),
    "LRCX":  ("Technology", "Semiconductor Equipment"),
    "MRVL":  ("Technology", "Semiconductors"),
    "NXPI":  ("Technology", "Semiconductors"),
    "ON":    ("Technology", "Semiconductors"),
    "SWKS":  ("Technology", "Semiconductors"),
    "TXN":   ("Technology", "Semiconductors"),
    "ADI":   ("Technology", "Semiconductors"),
    "MCHP":  ("Technology", "Semiconductors"),
    "STX":   ("Technology", "Computer Hardware"),
    "WDC":   ("Technology", "Computer Hardware"),
    "SNDK":  ("Technology", "Computer Hardware"),
    "ORCL":  ("Technology", "Software—Infrastructure"),
    "SAP":   ("Technology", "Software—Infrastructure"),
    "NOW":   ("Technology", "Software—Infrastructure"),
    "SNOW":  ("Technology", "Software—Infrastructure"),
    "CRM":   ("Technology", "Software—Application"),
    "ADBE":  ("Technology", "Software—Application"),
    "INTU":  ("Technology", "Software—Application"),
    "PANW":  ("Technology", "Software—Infrastructure"),
    "CRWD":  ("Technology", "Software—Infrastructure"),
    "FTNT":  ("Technology", "Software—Infrastructure"),
    "ZS":    ("Technology", "Software—Infrastructure"),
    "NET":   ("Technology", "Software—Infrastructure"),
    "OKTA":  ("Technology", "Software—Infrastructure"),
    "PLTR":  ("Technology", "Software—Infrastructure"),
    "IBM":   ("Technology", "IT Services"),
    "ACN":   ("Technology", "IT Services"),
    "EPAM":  ("Technology", "IT Services"),
    "ANET":  ("Technology", "Computer Hardware"),
    "CSCO":  ("Technology", "Computer Hardware"),
    "HPE":   ("Technology", "Computer Hardware"),
    "HPQ":   ("Technology", "Computer Hardware"),
    "DELL":  ("Technology", "Computer Hardware"),
    "FORM":  ("Technology", "Semiconductor Equipment"),
    "NBIS":  ("Technology", "Semiconductors"),
    "IONQ":  ("Technology", "Quantum Computing"),
    "CLS":   ("Technology", "Electronic Components"),
    "DIOD":  ("Technology", "Semiconductors"),
    "CIEN":  ("Technology", "Communication Equipment"),
    "DOCN":  ("Technology", "Software—Infrastructure"),
    # Communication Services
    "GOOGL": ("Communication Services", "Internet Content & Information"),
    "GOOG":  ("Communication Services", "Internet Content & Information"),
    "META":  ("Communication Services", "Internet Content & Information"),
    "NFLX":  ("Communication Services", "Entertainment"),
    "DIS":   ("Communication Services", "Entertainment"),
    "SPOT":  ("Communication Services", "Entertainment"),
    "WBD":   ("Communication Services", "Entertainment"),
    "PARA":  ("Communication Services", "Entertainment"),
    "FOX":   ("Communication Services", "Entertainment"),
    "FOXA":  ("Communication Services", "Entertainment"),
    "T":     ("Communication Services", "Telecom Services"),
    "VZ":    ("Communication Services", "Telecom Services"),
    "TMUS":  ("Communication Services", "Telecom Services"),
    "LUMN":  ("Communication Services", "Telecom Services"),
    "SNAP":  ("Communication Services", "Internet Content & Information"),
    "PINS":  ("Communication Services", "Internet Content & Information"),
    "RDDT":  ("Communication Services", "Internet Content & Information"),
    "UBER":  ("Communication Services", "Internet Content & Information"),
    "NOK":   ("Communication Services", "Telecom Services"),
    "ERIC":  ("Communication Services", "Telecom Services"),
    "GSAT":  ("Communication Services", "Telecom Services"),
    "SATS":  ("Communication Services", "Telecom Services"),
    "VSAT":  ("Communication Services", "Telecom Services"),
    "AMX":   ("Communication Services", "Telecom Services"),
    "QXO":   ("Industrials", "Software—Application"),
    # Consumer Cyclical
    "AMZN":  ("Consumer Cyclical", "Internet Retail"),
    "TSLA":  ("Consumer Cyclical", "Auto Manufacturers"),
    "NKE":   ("Consumer Cyclical", "Footwear & Accessories"),
    "SBUX":  ("Consumer Cyclical", "Restaurants"),
    "MCD":   ("Consumer Cyclical", "Restaurants"),
    "COST":  ("Consumer Cyclical", "Discount Stores"),
    "TGT":   ("Consumer Cyclical", "Discount Stores"),
    "HD":    ("Consumer Cyclical", "Home Improvement Retail"),
    "LOW":   ("Consumer Cyclical", "Home Improvement Retail"),
    "BKNG":  ("Consumer Cyclical", "Travel Services"),
    "ABNB":  ("Consumer Cyclical", "Travel Services"),
    "MAR":   ("Consumer Cyclical", "Lodging"),
    "HLT":   ("Consumer Cyclical", "Lodging"),
    "RIVN":  ("Consumer Cyclical", "Auto Manufacturers"),
    "LCID":  ("Consumer Cyclical", "Auto Manufacturers"),
    "GM":    ("Consumer Cyclical", "Auto Manufacturers"),
    "F":     ("Consumer Cyclical", "Auto Manufacturers"),
    "CVNA":  ("Consumer Cyclical", "Auto & Truck Dealerships"),
    "CAR":   ("Consumer Cyclical", "Rental & Leasing Services"),
    "HTZ":   ("Consumer Cyclical", "Rental & Leasing Services"),
    "CROX":  ("Consumer Cyclical", "Footwear & Accessories"),
    "MOD":   ("Consumer Cyclical", "Auto Parts"),
    "SGI":   ("Consumer Cyclical", "Specialty Retail"),
    "ARW":   ("Consumer Cyclical", "Electronics Distribution"),
    "AVT":   ("Consumer Cyclical", "Electronics Distribution"),
    "SOBO":  ("Consumer Cyclical", "Specialty Retail"),
    # Consumer Defensive
    "PG":    ("Consumer Defensive", "Household & Personal Products"),
    "KO":    ("Consumer Defensive", "Beverages—Non-Alcoholic"),
    "PEP":   ("Consumer Defensive", "Beverages—Non-Alcoholic"),
    "WMT":   ("Consumer Defensive", "Discount Stores"),
    "MDLZ":  ("Consumer Defensive", "Confectioners"),
    "PM":    ("Consumer Defensive", "Tobacco"),
    "MO":    ("Consumer Defensive", "Tobacco"),
    "GIS":   ("Consumer Defensive", "Packaged Foods"),
    "K":     ("Consumer Defensive", "Packaged Foods"),
    "CPB":   ("Consumer Defensive", "Packaged Foods"),
    "CELH":  ("Consumer Defensive", "Beverages—Non-Alcoholic"),
    "UNFI":  ("Consumer Defensive", "Food Distribution"),
    # Healthcare
    "LLY":   ("Healthcare", "Drug Manufacturers—General"),
    "UNH":   ("Healthcare", "Healthcare Plans"),
    "JNJ":   ("Healthcare", "Drug Manufacturers—General"),
    "ABBV":  ("Healthcare", "Drug Manufacturers—General"),
    "MRK":   ("Healthcare", "Drug Manufacturers—General"),
    "PFE":   ("Healthcare", "Drug Manufacturers—General"),
    "AMGN":  ("Healthcare", "Drug Manufacturers—General"),
    "GILD":  ("Healthcare", "Drug Manufacturers—General"),
    "BMY":   ("Healthcare", "Drug Manufacturers—General"),
    "AZN":   ("Healthcare", "Drug Manufacturers—General"),
    "ISRG":  ("Healthcare", "Medical Devices"),
    "DXCM":  ("Healthcare", "Medical Devices"),
    "MRNA":  ("Healthcare", "Biotechnology"),
    "BNTX":  ("Healthcare", "Biotechnology"),
    "REGN":  ("Healthcare", "Biotechnology"),
    "BIIB":  ("Healthcare", "Biotechnology"),
    "BBIO":  ("Healthcare", "Biotechnology"),
    "AMLX":  ("Healthcare", "Biotechnology"),
    "CAPR":  ("Healthcare", "Biotechnology"),
    "MGTX":  ("Healthcare", "Biotechnology"),
    "RLAY":  ("Healthcare", "Biotechnology"),
    "DNTH":  ("Healthcare", "Biotechnology"),
    "UTHR":  ("Healthcare", "Drug Manufacturers—Specialty & Generic"),
    "TEVA":  ("Healthcare", "Drug Manufacturers—Specialty & Generic"),
    "ORKA":  ("Healthcare", "Medical Devices"),
    "HCA":   ("Healthcare", "Healthcare Plans"),
    # Financials
    "JPM":   ("Financial Services", "Banks—Diversified"),
    "BAC":   ("Financial Services", "Banks—Diversified"),
    "WFC":   ("Financial Services", "Banks—Diversified"),
    "C":     ("Financial Services", "Banks—Diversified"),
    "GS":    ("Financial Services", "Capital Markets"),
    "MS":    ("Financial Services", "Capital Markets"),
    "BX":    ("Financial Services", "Asset Management"),
    "BLK":   ("Financial Services", "Asset Management"),
    "V":     ("Financial Services", "Credit Services"),
    "MA":    ("Financial Services", "Credit Services"),
    "PYPL":  ("Financial Services", "Credit Services"),
    "SQ":    ("Financial Services", "Credit Services"),
    "COIN":  ("Financial Services", "Capital Markets"),
    "HOOD":  ("Financial Services", "Capital Markets"),
    "SOFI":  ("Financial Services", "Financial Data & Stock Exchanges"),
    "COF":   ("Financial Services", "Credit Services"),
    "RY":    ("Financial Services", "Banks—Diversified"),
    "TD":    ("Financial Services", "Banks—Diversified"),
    "BNS":   ("Financial Services", "Banks—Diversified"),
    "UBS":   ("Financial Services", "Capital Markets"),
    "BCS":   ("Financial Services", "Banks—Diversified"),
    "BBVA":  ("Financial Services", "Banks—Diversified"),
    "ING":   ("Financial Services", "Banks—Diversified"),
    "LYG":   ("Financial Services", "Banks—Diversified"),
    "NWG":   ("Financial Services", "Banks—Diversified"),
    "SAN":   ("Financial Services", "Banks—Diversified"),
    "ICE":   ("Financial Services", "Financial Data & Stock Exchanges"),
    "MSTR":  ("Financial Services", "Capital Markets"),
    "MARA":  ("Financial Services", "Capital Markets"),
    "CODI":  ("Financial Services", "Asset Management"),
    "GAIN":  ("Financial Services", "Asset Management"),
    "FUTU":  ("Financial Services", "Capital Markets"),
    "PUK":   ("Financial Services", "Insurance—Life"),
    "ASX":   ("Financial Services", "Banks—Diversified"),
    "NDAQ":  ("Financial Services", "Financial Data & Stock Exchanges"),
    "RKT":   ("Financial Services", "Mortgage Finance"),
    # Energy
    "XOM":   ("Energy", "Oil & Gas Integrated"),
    "CVX":   ("Energy", "Oil & Gas Integrated"),
    "COP":   ("Energy", "Oil & Gas E&P"),
    "OXY":   ("Energy", "Oil & Gas E&P"),
    "SLB":   ("Energy", "Oil & Gas Equipment & Services"),
    "HAL":   ("Energy", "Oil & Gas Equipment & Services"),
    "BKR":   ("Energy", "Oil & Gas Equipment & Services"),
    "MPC":   ("Energy", "Oil & Gas Refining & Marketing"),
    "VLO":   ("Energy", "Oil & Gas Refining & Marketing"),
    "PSX":   ("Energy", "Oil & Gas Refining & Marketing"),
    "FANG":  ("Energy", "Oil & Gas E&P"),
    "EOG":   ("Energy", "Oil & Gas E&P"),
    "DVN":   ("Energy", "Oil & Gas E&P"),
    "CTRA":  ("Energy", "Oil & Gas E&P"),
    "SU":    ("Energy", "Oil & Gas Integrated"),
    "BP":    ("Energy", "Oil & Gas Integrated"),
    "E":     ("Energy", "Oil & Gas Integrated"),
    "WDS":   ("Energy", "Oil & Gas E&P"),
    "EGY":   ("Energy", "Oil & Gas E&P"),
    "OVV":   ("Energy", "Oil & Gas E&P"),
    "PARR":  ("Energy", "Oil & Gas Refining & Marketing"),
    "FLNG":  ("Energy", "Oil & Gas Midstream"),
    "DTM":   ("Energy", "Oil & Gas Midstream"),
    "AROC":  ("Energy", "Oil & Gas Equipment & Services"),
    "BTU":   ("Energy", "Thermal Coal"),
    "OKE":   ("Energy", "Oil & Gas Midstream"),
    "NRG":   ("Energy", "Utilities—Independent Power Producers"),
    "CGON":  ("Energy", "Oil & Gas E&P"),
    # Industrials
    "CAT":   ("Industrials", "Farm & Heavy Construction Machinery"),
    "DE":    ("Industrials", "Farm & Heavy Construction Machinery"),
    "BA":    ("Industrials", "Aerospace & Defense"),
    "RTX":   ("Industrials", "Aerospace & Defense"),
    "LMT":   ("Industrials", "Aerospace & Defense"),
    "GE":    ("Industrials", "Aerospace & Defense"),
    "HON":   ("Industrials", "Diversified Industrials"),
    "UPS":   ("Industrials", "Integrated Freight & Logistics"),
    "FDX":   ("Industrials", "Integrated Freight & Logistics"),
    "GEV":   ("Industrials", "Specialty Industrial Machinery"),
    "JCI":   ("Industrials", "Building Products & Equipment"),
    "AIR":   ("Industrials", "Aerospace & Defense"),
    "CNR":   ("Industrials", "Railroads"),
    "SPIR":  ("Industrials", "Aerospace & Defense"),
    "ATMU":  ("Industrials", "Specialty Industrial Machinery"),
    "CTA":   ("Industrials", "Diversified Industrials"),
    "DAN":   ("Industrials", "Auto Parts"),
    "JBL":   ("Industrials", "Electronic Components"),
    "KODK":  ("Industrials", "Electronic Components"),
    "STGW":  ("Industrials", "Specialty Industrial Machinery"),
    "DLR":   ("Real Estate", "REIT—Specialty"),
    # Basic Materials
    "FCX":   ("Basic Materials", "Copper"),
    "NEM":   ("Basic Materials", "Gold"),
    "LIN":   ("Basic Materials", "Specialty Chemicals"),
    "APD":   ("Basic Materials", "Specialty Chemicals"),
    "NUE":   ("Basic Materials", "Steel"),
    "STLD":  ("Basic Materials", "Steel"),
    "X":     ("Basic Materials", "Steel"),
    "CLF":   ("Basic Materials", "Steel"),
    "AA":    ("Basic Materials", "Aluminum"),
    "ALB":   ("Basic Materials", "Specialty Chemicals"),
    "SQM":   ("Basic Materials", "Specialty Chemicals"),
    "CC":    ("Basic Materials", "Specialty Chemicals"),
    "ECVT":  ("Basic Materials", "Specialty Chemicals"),
    "MT":    ("Basic Materials", "Steel"),
    "BHP":   ("Basic Materials", "Other Industrial Metals & Mining"),
    "RIO":   ("Basic Materials", "Other Industrial Metals & Mining"),
    "KNF":   ("Basic Materials", "Other Industrial Metals & Mining"),
    "TS":    ("Basic Materials", "Steel"),
    "LXU":   ("Basic Materials", "Specialty Chemicals"),
    # Real Estate
    "PLD":   ("Real Estate", "REIT—Industrial"),
    "AMT":   ("Real Estate", "REIT—Specialty"),
    "EQIX":  ("Real Estate", "REIT—Specialty"),
    "SPG":   ("Real Estate", "REIT—Retail"),
    "O":     ("Real Estate", "REIT—Retail"),
    "SBAC":  ("Real Estate", "REIT—Specialty"),
    "CCI":   ("Real Estate", "REIT—Specialty"),
    "CBRE":  ("Real Estate", "Real Estate Services"),
    "ELVN":  ("Real Estate", "Real Estate Services"),
    # Utilities
    "NEE":   ("Utilities", "Utilities—Renewable"),
    "DUK":   ("Utilities", "Utilities—Regulated Electric"),
    "SO":    ("Utilities", "Utilities—Regulated Electric"),
    "AEP":   ("Utilities", "Utilities—Regulated Electric"),
    "EXC":   ("Utilities", "Utilities—Regulated Electric"),
    "D":     ("Utilities", "Utilities—Regulated Electric"),
    "PCG":   ("Utilities", "Utilities—Regulated Electric"),
    "SRE":   ("Utilities", "Utilities—Regulated Electric"),
    "SEDG":  ("Utilities", "Solar"),
    "ENPH":  ("Utilities", "Solar"),
    "FSLR":  ("Utilities", "Solar"),
    "BEP":   ("Utilities", "Utilities—Renewable"),
    "SNDX":  ("Healthcare", "Biotechnology"),
}

def load_info_cache():
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log.warning(f"Cannot load info cache: {e}")
    return {}

# ── Load swing_table.json ────────────────────────────────────────────────────
def clean_float(v) -> float:
    if v is None:
        return 0.0
    s = re.sub(r"\[.*?\]", "", str(v)).strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

def load_table():
    with open(TABLE_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    records = []
    for row in raw:
        date_str   = row.get("Tarih", "").strip()
        ticker_raw = row.get("Sembol", "").strip()
        ticker     = clean_ticker(ticker_raw)
        if not ticker or not date_str:
            continue
        iso = parse_tr_date(date_str)
        if not iso:
            log.warning(f"Cannot parse date: {date_str!r}")
            continue

        v0 = clean_float(row.get("Giriş (Buy_L)"))
        v1 = clean_float(row.get("Stop (SL)"))
        v2 = clean_float(row.get("Hedef 1 (TP1)"))
        v3 = clean_float(row.get("Hedef 2 (TP2)"))

        # Score-in-first-column detection:
        # Some CSV rows store a confidence score in column 0 (e.g. 33.2, 27.0).
        # Valid long entry: entry > stop > 0 AND tp1 > entry.
        # If not valid but shift pattern fits (v1 > v2 > 0 AND v3 > v1), use v1 as entry.
        entry = v0
        if not (v0 > v1 > 0 and v2 > v0):
            if v1 > v2 > 0 and v3 > v1:
                entry = v1  # use Stop column as real entry price

        if entry <= 0:
            continue

        records.append({
            "date":   iso,
            "ticker": ticker,
            "entry":  entry,
        })
    log.info(f"Loaded {len(records)} records from swing_table.json")
    return records

# ── Fetch price histories ────────────────────────────────────────────────────
def _flatten_df(df: pd.DataFrame, ticker: str | None = None) -> pd.DataFrame:
    """Normalize yfinance DataFrame to flat columns (High, Low, Close, Open, Volume)."""
    if isinstance(df.columns, pd.MultiIndex):
        # Single-ticker download returns (Price, Ticker) MultiIndex — drop ticker level
        if ticker and ticker in df.columns.get_level_values(1):
            df = df.xs(ticker, level=1, axis=1)
        elif ticker and ticker in df.columns.get_level_values(0):
            df = df[ticker]
        else:
            df.columns = df.columns.droplevel(1)
    return df

def fetch_histories(ticker_earliest: dict[str, str]) -> dict[str, pd.DataFrame]:
    result: dict[str, pd.DataFrame] = {}
    today_str = (datetime.today() + timedelta(days=1)).strftime("%Y-%m-%d")

    date_to_tickers: dict[str, list[str]] = defaultdict(list)
    for ticker, start in ticker_earliest.items():
        date_to_tickers[start].append(ticker)

    for start_iso, tickers in date_to_tickers.items():
        log.info(f"Fetching {len(tickers)} tickers from {start_iso} to {today_str}")
        try:
            if len(tickers) == 1:
                ticker = tickers[0]
                df = yf.download(
                    ticker, start=start_iso, end=today_str,
                    interval="1d", auto_adjust=True, progress=False
                )
                if not df.empty:
                    result[ticker] = _flatten_df(df, ticker)
            else:
                data = yf.download(
                    tickers, start=start_iso, end=today_str,
                    interval="1d", auto_adjust=True, progress=False,
                    group_by="ticker"
                )
                for t in tickers:
                    try:
                        df = data[t].dropna(how="all")
                        if not df.empty:
                            result[t] = df  # already flat from group_by
                    except (KeyError, TypeError):
                        pass
        except Exception as e:
            log.error(f"Download error for {tickers}: {e}")

    # Retry any missing tickers individually
    missing = [t for t in ticker_earliest if t not in result]
    if missing:
        log.info(f"Retrying {len(missing)} missing tickers individually...")
        for ticker in missing:
            try:
                df = yf.download(
                    ticker, start=ticker_earliest[ticker], end=today_str,
                    interval="1d", auto_adjust=True, progress=False
                )
                if not df.empty:
                    result[ticker] = _flatten_df(df, ticker)
                    log.info(f"Retry OK: {ticker} ({len(result[ticker])} rows)")
                else:
                    log.warning(f"No data for {ticker}")
            except Exception as e:
                log.error(f"Retry failed for {ticker}: {e}")

    return result

# ── Sector + subsector ────────────────────────────────────────────────────────
def get_sector_subsector(ticker: str, cache: dict) -> tuple[str, str]:
    if ticker in STATIC_SECTOR:
        return STATIC_SECTOR[ticker]
    c = cache.get(ticker, {})
    sector    = c.get("sector", "")
    subsector = c.get("industry", c.get("subsector", ""))
    if sector and sector not in ("Unknown", ""):
        return (sector, subsector or sector)
    try:
        info      = yf.Ticker(ticker).info
        sector    = info.get("sector", "")
        subsector = info.get("industry", "")
        if sector:
            return (sector, subsector or sector)
    except Exception:
        pass
    return ("Unknown", "Unknown")

def fetch_sector_info(tickers: list[str], cache: dict) -> dict[str, tuple[str, str]]:
    info_map: dict[str, tuple[str, str]] = {}
    live_needed = []
    for ticker in tickers:
        if ticker in STATIC_SECTOR:
            info_map[ticker] = STATIC_SECTOR[ticker]
        else:
            live_needed.append(ticker)

    log.info(f"Static map covers {len(info_map)} tickers. Fetching {len(live_needed)} from yfinance...")
    for ticker in live_needed:
        info_map[ticker] = get_sector_subsector(ticker, cache)

    # No blanks: fall back to sector name
    for ticker, (sec, sub) in info_map.items():
        if not sub or sub in ("Unknown", ""):
            info_map[ticker] = (sec, sec)

    log.info(f"Sector info complete for {len(info_map)} tickers")
    return info_map

# ── Trade evaluation (peak / MAX RETURN logic) ────────────────────────────────
def evaluate_trade(
    entry_iso: str,
    entry: float,
    ticker_history: pd.DataFrame | None,
) -> dict:
    """
    Same logic as bogastock.com live system:
      max_price  = highest High within 30-calendar-day window
      return_pct = (max_price - entry) / entry * 100
      days       = calendar days from entry to peak date
      result     = PENDING | WIN | LOSS
    """
    default = dict(max_price=None, return_pct=None, days=None, result="NO_DATA", peak_date=None)

    if entry <= 0:
        return default
    if ticker_history is None or ticker_history.empty:
        return default

    entry_dt   = datetime.strptime(entry_iso, "%Y-%m-%d").date()
    window_end = entry_dt + timedelta(days=30)
    window_open = TODAY <= window_end

    df = ticker_history.copy()
    df.index = pd.to_datetime(df.index).date
    df = df[(df.index >= entry_dt) & (df.index <= window_end)]

    if df.empty:
        return default

    try:
        peak_idx   = df["High"].idxmax()
        peak_price = float(df["High"].max())
        peak_date  = peak_idx
        days_to_peak = max(0, (peak_date - entry_dt).days)
    except Exception:
        return default

    return_pct = round((peak_price - entry) / entry * 100, 2)

    if window_open:
        result = "PENDING"
    elif return_pct > 0:
        result = "WIN"
    else:
        result = "LOSS"

    return dict(
        max_price  = round(peak_price, 2),
        return_pct = return_pct,
        days       = days_to_peak,
        result     = result,
        peak_date  = peak_date.strftime("%Y-%m-%d"),
    )

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    records    = load_table()
    info_cache = load_info_cache()

    # 1. Build per-ticker earliest date
    ticker_earliest: dict[str, str] = {}
    for r in records:
        t = r["ticker"]
        if t not in ticker_earliest or r["date"] < ticker_earliest[t]:
            ticker_earliest[t] = r["date"]

    log.info(f"Unique tickers: {len(ticker_earliest)}")

    # 2. Fetch price history: earliest date → TODAY
    histories = fetch_histories(ticker_earliest)
    log.info(f"Got price history for {len(histories)} tickers")

    # 3. Sector / subsector
    sector_map = fetch_sector_info(list(ticker_earliest.keys()), info_cache)

    # 4. Evaluate each trade
    history_out = []
    for r in records:
        ticker = r["ticker"]
        sector, subsector = sector_map.get(ticker, ("Unknown", "Unknown"))
        hist    = histories.get(ticker)
        outcome = evaluate_trade(r["date"], r["entry"], hist)

        record = {
            "date":      r["date"],
            "ticker":    ticker,
            "company":   info_cache.get(ticker, {}).get("companyName", ticker),
            "sector":    sector,
            "subsector": subsector,
            "entry":     r["entry"],
            **outcome,
        }
        history_out.append(record)

    # 5. Stats (matches live system exactly)
    completed = [h for h in history_out if h["result"] != "PENDING"]
    total    = len(history_out)
    wins     = sum(1 for h in completed if (h.get("return_pct") or 0) > 0)
    total_ret = sum(h.get("return_pct") or 0 for h in completed)
    above_5  = sum(1 for h in completed if (h.get("return_pct") or 0) >= 5)
    above_10 = sum(1 for h in completed if (h.get("return_pct") or 0) >= 10)

    stats = {
        "total_picks":      total,
        "completed_count":  len(completed),
        "pending_count":    total - len(completed),
        "win_rate":         round(wins / len(completed) * 100, 1) if completed else 0,
        "avg_return_pct":   round(total_ret / len(completed), 2)  if completed else 0,
        "period_days":      180,
        "above_5pct_rate":  round(above_5 / len(completed) * 100, 1) if completed else 0,
        "above_10pct_rate": round(above_10 / len(completed) * 100, 1) if completed else 0,
        "generated_at":     datetime.now().isoformat(),
    }

    output = {"stats": stats, "history": history_out}
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)

    from collections import Counter
    res_counts  = Counter(h["result"] for h in history_out)
    empty_sub   = sum(1 for h in history_out if not h.get("subsector", "").strip() or h.get("subsector") in ("Unknown", ""))
    log.info(f"Done. {len(history_out)} records → {OUTPUT}")
    log.info(f"Results: {dict(res_counts)}")
    log.info(f"Empty subsector: {empty_sub}")
    log.info(f"Stats: {stats}")

if __name__ == "__main__":
    main()
