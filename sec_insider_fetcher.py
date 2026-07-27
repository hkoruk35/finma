"""
SEC EDGAR Form 4 Insider Transaction Fetcher
Fetches insider transactions from SEC EDGAR and stores in Supabase.
Runs daily at 04:30 AM NY time (after market close).
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import json

from edgartools.client import EdgarClient
from supabase import create_client
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/insider_fetcher.log"),
    ],
)
logger = logging.getLogger(__name__)

# Load environment
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MIN_SHARES_THRESHOLD = 1000  # Filter transactions below this

# Hardcoded SEC ticker-CIK mapping (partial, for fallback)
SEC_TICKER_CIK_MAP = {
    "AAPL": "0000320193",
    "MSFT": "0000789019",
    "GOOGL": "0001652044",
    "AMZN": "0001018724",
    "TSLA": "0001018724",  # Note: placeholder, actual needs lookup
    "META": "0001326801",
    "NVDA": "0001045810",
    "JPM": "0000047281",
    "V": "0001403161",
    "JNJ": "0000200406",
    # Add more as needed; edgartools will handle missing ones
}

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Initialize Edgar client (edgartools)
edgar = EdgarClient()


def get_cik_for_ticker(ticker: str) -> Optional[str]:
    """
    Hybrid CIK lookup: cache → edgartools API → hardcoded fallback
    """
    try:
        # 1. Check Supabase cache
        response = supabase.table("cik_ticker_map").select("cik").eq("ticker", ticker).execute()
        if response.data and len(response.data) > 0:
            logger.info(f"CIK cache hit for {ticker}: {response.data[0]['cik']}")
            return response.data[0]["cik"]

        # 2. Lookup via edgartools
        logger.info(f"Looking up CIK for {ticker} via EDGAR...")
        company = edgar.get_company(ticker)
        if company and company.cik:
            cik = str(company.cik).zfill(10)
            logger.info(f"Found CIK for {ticker}: {cik}")

            # Cache it
            supabase.table("cik_ticker_map").upsert({
                "cik": cik,
                "ticker": ticker,
                "company_name": company.name if hasattr(company, "name") else None,
                "last_edgar_check": datetime.utcnow().isoformat(),
            }).execute()
            return cik

        # 3. Fallback to hardcoded
        if ticker in SEC_TICKER_CIK_MAP:
            logger.warning(f"CIK lookup failed for {ticker}, using fallback")
            return SEC_TICKER_CIK_MAP[ticker]

        logger.warning(f"Could not find CIK for {ticker}")
        return None

    except Exception as e:
        logger.error(f"Error looking up CIK for {ticker}: {e}")
        return SEC_TICKER_CIK_MAP.get(ticker)


def fetch_form4_filings(cik: str, days_back: int = 90) -> List[Dict]:
    """
    Fetch Form 4 filings from SEC EDGAR for a specific CIK.
    Returns list of parsed insider transactions.
    """
    transactions = []
    try:
        logger.info(f"Fetching Form 4 filings for CIK {cik} (last {days_back} days)...")

        # Fetch Form 4 filings
        filings = edgar.get_filings_by_cik(cik, form_type="4")
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        for filing in filings:
            if not hasattr(filing, "filing_date") or filing.filing_date < cutoff_date.date():
                continue

            try:
                # Get filing document
                doc = filing.full_submission_text
                if not doc:
                    continue

                # Parse transactions from filing
                parsed = parse_form4_xml(doc, cik, filing.filing_date)
                transactions.extend(parsed)

            except Exception as e:
                logger.warning(f"Error parsing filing {cik}: {e}")
                continue

        logger.info(f"Fetched {len(transactions)} transactions for CIK {cik}")
        return transactions

    except Exception as e:
        logger.error(f"Error fetching filings for CIK {cik}: {e}")
        return []


def parse_form4_xml(xml_text: str, cik: str, filing_date) -> List[Dict]:
    """
    Parse Form 4 XML and extract insider transactions.
    Filters transactions >= MIN_SHARES_THRESHOLD.
    """
    transactions = []
    try:
        from xml.etree import ElementTree as ET

        root = ET.fromstring(xml_text)
        # Navigate to transaction entries (XML structure varies)
        # Common path: derivativeTable/derivativeTransaction or nonDerivativeTable/nonDerivativeTransaction

        ns = {"": "http://www.sec.gov/cgi-bin"}  # Namespace handling

        for trans in root.findall(".//nonDerivativeTransaction"):
            try:
                # Extract fields
                security_title = trans.findtext(".//securityTitle/value", "").strip()
                if not security_title:
                    continue

                transaction_date = trans.findtext(".//transactionDate/value", "").strip()
                if not transaction_date:
                    continue

                shares = int(trans.findtext(".//transactionShares/value", "0").replace(",", ""))
                if shares < MIN_SHARES_THRESHOLD:
                    continue

                price = trans.findtext(".//transactionPricePerShare/value", "")
                price = float(price) if price and price != "" else None

                transaction_code = trans.findtext(".//transactionCode/value", "").strip()
                transaction_type = map_transaction_code(transaction_code)

                # Officer/Director info
                officer_title = trans.findtext(".//officerTitle/value", "").strip()
                exec_name = trans.findtext(".//rptOwnerName/value", "").strip()
                is_director = trans.findtext(".//isDirector/value", "true").lower() == "true"
                is_officer = trans.findtext(".//isOfficer/value", "true").lower() == "true"
                is_ten_pct = trans.findtext(".//isTenPercent/value", "false").lower() == "true"

                transactions.append({
                    "cik": cik,
                    "executive_name": exec_name or "Unknown",
                    "title": officer_title or "Officer",
                    "transaction_type": transaction_type,
                    "shares_transacted": shares,
                    "transaction_price": price,
                    "transaction_date": transaction_date,
                    "filed_date": str(filing_date),
                    "form_type": "Form 4",
                    "is_director": is_director,
                    "is_officer": is_officer,
                    "is_ten_pct_owner": is_ten_pct,
                })
            except Exception as e:
                logger.debug(f"Error parsing transaction: {e}")
                continue

    except Exception as e:
        logger.warning(f"Error parsing Form 4 XML: {e}")

    return transactions


def map_transaction_code(code: str) -> str:
    """
    Map SEC transaction codes to readable types.
    P=Purchase, S=Sale, G=Grant, etc.
    """
    code_map = {
        "P": "BUY",
        "S": "SELL",
        "G": "GRANT",
        "E": "EXERCISE",
        "D": "SELL",  # Disposition
        "F": "EXERCISE",  # Expire
        "M": "EXERCISE",  # Conversion
        "C": "SELL",  # Conversion
        "X": "EXERCISE",  # Exercise
        "H": "SELL",  # Expire (put)
        "O": "EXERCISE",  # Exercise (out of money)
    }
    return code_map.get(code.upper(), "UNKNOWN")


def load_ticker_universe() -> List[str]:
    """
    Load ticker universe from Supabase top100_tickers.
    """
    try:
        response = supabase.table("top100_tickers").select("ticker").execute()
        tickers = [row["ticker"] for row in response.data]
        logger.info(f"Loaded {len(tickers)} tickers from database")
        return tickers
    except Exception as e:
        logger.error(f"Error loading ticker universe: {e}")
        # Fallback to config.py if available
        try:
            import config
            return config.FIXED_100_TICKERS
        except Exception:
            return []


def store_transactions(ticker: str, transactions: List[Dict]) -> int:
    """
    Store insider transactions in Supabase.
    Returns count of successfully stored transactions.
    """
    if not transactions:
        return 0

    stored_count = 0
    for trans in transactions:
        try:
            # Add ticker to transaction data
            trans["ticker"] = ticker

            # Upsert (UNIQUE constraint handles duplicates)
            supabase.table("insider_transactions").upsert(trans).execute()
            stored_count += 1
        except Exception as e:
            # Log but don't fail on duplicate/error
            logger.debug(f"Error storing transaction for {ticker}: {e}")

    if stored_count > 0:
        logger.info(f"Stored {stored_count} transactions for {ticker}")

    return stored_count


def run_fetch_cycle(days_back: int = 90, initial_run: bool = True):
    """
    Main fetch cycle: fetch insider data for all tickers and store.
    """
    logger.info(f"Starting insider data fetch (days_back={days_back}, initial_run={initial_run})")

    tickers = load_ticker_universe()
    if not tickers:
        logger.error("No tickers found, exiting")
        return

    total_stored = 0
    total_errors = 0

    for ticker in tickers:
        try:
            # Get CIK
            cik = get_cik_for_ticker(ticker)
            if not cik:
                logger.warning(f"Skipping {ticker}: no CIK found")
                total_errors += 1
                continue

            # Fetch Form 4s
            transactions = fetch_form4_filings(cik, days_back)

            # Store
            stored = store_transactions(ticker, transactions)
            total_stored += stored

        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}")
            total_errors += 1

    logger.info(f"Fetch cycle complete: {total_stored} stored, {total_errors} errors")
    return {"stored": total_stored, "errors": total_errors}


if __name__ == "__main__":
    # Run full cycle
    # Initial run: 90 days back
    # Daily runs: 7 days back (incremental)
    is_initial = not os.path.exists("logs/insider_fetcher.log") or os.path.getsize("logs/insider_fetcher.log") == 0
    days = 90 if is_initial else 7

    result = run_fetch_cycle(days_back=days, initial_run=is_initial)
    logger.info(f"Result: {result}")
