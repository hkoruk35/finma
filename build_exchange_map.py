#!/usr/bin/env python3
"""
build_exchange_map.py
---------------------
Fetches exchange info for all tracked tickers via yfinance.
Stores exchange_map.json: { "AAPL": "NASDAQ", "SPIR": "NYSE", ... }
Also detects company name mismatches between stock JSONs and yfinance.
"""
import json, os, time, logging
from pathlib import Path
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# Exchange code → TradingView prefix
EXCHANGE_MAP = {
    "NMS":  "NASDAQ",   # NASDAQ Global Select Market
    "NGM":  "NASDAQ",   # NASDAQ Global Market
    "NCM":  "NASDAQ",   # NASDAQ Capital Market
    "NYQ":  "NYSE",     # New York Stock Exchange
    "NYA":  "NYSE",
    "ASE":  "AMEX",     # NYSE American (AMEX)
    "PCX":  "NYSE",     # NYSE Arca
    "BTS":  "CBOE",     # Cboe BZX
    "CBO":  "CBOE",
    "PNK":  "OTC",      # OTC Pink Sheets
    "OTC":  "OTC",
}

DATA_DIRS = [
    Path(r"C:\Users\afksm\finma\transfer\latest\stocks"),
    Path(r"C:\Users\afksm\finma\data\2026-04-15\stocks"),
    Path(r"C:\Users\afksm\finma\data\2026-04-08\stocks"),
]
OUTPUT = Path(r"C:\Users\afksm\finma\.claude\worktrees\stoic-grothendieck\frontend\public\exchange_map.json")

def get_stock_dir():
    for d in DATA_DIRS:
        if d.exists():
            return d
    return None

def load_all_tickers(stock_dir: Path) -> dict[str, str]:
    """Returns {ticker: company_name} from stock JSON files."""
    result = {}
    for f in stock_dir.glob("*.json"):
        try:
            with open(f, encoding="utf-8") as fp:
                d = json.load(fp)
            ticker  = d.get("ticker", f.stem).upper()
            company = d.get("company", "")
            result[ticker] = company
        except Exception:
            result[f.stem.upper()] = ""
    return result

def main():
    stock_dir = get_stock_dir()
    if not stock_dir:
        log.error("No stock data directory found.")
        return

    tickers_map = load_all_tickers(stock_dir)
    log.info(f"Loaded {len(tickers_map)} tickers from {stock_dir}")

    exchange_out = {}      # {ticker: "NASDAQ"/"NYSE"/...}
    mismatch_out = {}      # {ticker: {local_company, yf_company}}

    # Batch fetch via yfinance (single calls — fast enough)
    for i, (ticker, local_company) in enumerate(sorted(tickers_map.items())):
        try:
            info = yf.Ticker(ticker).fast_info
            exch_code = getattr(info, "exchange", None) or ""
            tv_exchange = EXCHANGE_MAP.get(exch_code, "")

            if tv_exchange:
                exchange_out[ticker] = tv_exchange

            # Company name mismatch check
            full_info = yf.Ticker(ticker).info
            yf_company = full_info.get("shortName", "") or full_info.get("longName", "")
            if (local_company and yf_company and
                local_company.lower().split()[0] not in yf_company.lower() and
                yf_company.lower().split()[0] not in local_company.lower()):
                mismatch_out[ticker] = {
                    "local":   local_company,
                    "yfinance": yf_company,
                    "exchange": tv_exchange or exch_code,
                }

            if (i + 1) % 50 == 0:
                log.info(f"Progress: {i+1}/{len(tickers_map)}")

        except Exception as e:
            log.warning(f"Skipping {ticker}: {e}")

    output = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "exchanges": exchange_out,
        "company_mismatches": mismatch_out,
    }
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    log.info(f"Done. {len(exchange_out)} exchanges, {len(mismatch_out)} mismatches → {OUTPUT}")
    if mismatch_out:
        log.warning("Company mismatches detected:")
        for t, v in list(mismatch_out.items())[:10]:
            log.warning(f"  {t}: local={v['local']!r} vs yf={v['yfinance']!r}")

if __name__ == "__main__":
    main()
