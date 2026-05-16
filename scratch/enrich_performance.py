# -*- coding: utf-8 -*-
"""
BOGA AI - Performance Data Enrichment Script
1. Tüm eksik company name ve subsector verilerini yfinance'den çeker
2. Bozuk encoding'leri (mojibake) düzeltir
3. swing_performance.json'u günceller ve git'e push eder
"""
import json
import sys
import time
import yfinance as yf

sys.stdout.reconfigure(encoding='utf-8')

PERF_FILE = r'frontend\public\swing_performance.json'

# Mojibake düzeltme haritası
ENCODING_FIXES = {
    'â€"': '–',
    'â€"': '–',
    'â€™': ''',
    'â€˜': ''',
    'â€œ': '"',
    'â€\x9d': '"',
    'â€¦': '…',
    'Ã ': 'à',
    'Ã©': 'é',
    'Ãª': 'ê',
    'Ã¨': 'è',
    'Ã®': 'î',
    'Ã´': 'ô',
    'Ã¹': 'ù',
    'Ãµ': 'õ',
    'â€': '–',
}

def fix_encoding(text: str) -> str:
    if not text:
        return text
    for bad, good in ENCODING_FIXES.items():
        text = text.replace(bad, good)
    # Try byte-level fix for remaining mojibake
    try:
        fixed = text.encode('latin-1').decode('utf-8')
        return fixed
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text

def fetch_ticker_info(ticker: str) -> dict:
    """yfinance'den company name ve subsector çeker."""
    try:
        info = yf.Ticker(ticker).info
        company = info.get('longName') or info.get('shortName') or ticker
        sector = info.get('sector', '')
        subsector = info.get('industry', '')
        return {
            'company': company,
            'sector': sector,
            'subsector': subsector,
        }
    except Exception as e:
        print(f"  ⚠️  {ticker}: {e}")
        return {}

def main():
    print("Loading swing_performance.json...")
    with open(PERF_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    history = data.get('history', [])
    print(f"Total records: {len(history)}")

    # Phase 1: Fix encoding issues in all string fields
    print("\n=== Phase 1: Fixing encoding ===")
    encoding_fixes = 0
    for entry in history:
        for field in ['company', 'sector', 'subsector']:
            original = entry.get(field, '')
            if original:
                fixed = fix_encoding(original)
                if fixed != original:
                    entry[field] = fixed
                    encoding_fixes += 1
    print(f"Encoding fixes applied: {encoding_fixes}")

    # Phase 2: Find entries missing company or subsector
    print("\n=== Phase 2: Fetching missing data from yfinance ===")
    missing = [
        entry for entry in history
        if not entry.get('company') or entry.get('company') == entry.get('ticker')
        or not entry.get('subsector') or entry.get('subsector') in ('N/A', '', 'Unknown', None)
    ]
    
    # Group by ticker to avoid duplicate fetches
    unique_tickers = list(set(e['ticker'] for e in missing))
    print(f"Tickers needing enrichment: {len(unique_tickers)}")

    ticker_cache = {}
    for i, ticker in enumerate(unique_tickers):
        print(f"  [{i+1}/{len(unique_tickers)}] Fetching {ticker}...", end=' ')
        info = fetch_ticker_info(ticker)
        ticker_cache[ticker] = info
        if info.get('company'):
            print(f"✅ {info.get('company', '')} | {info.get('subsector', '')}")
        else:
            print("❌ No data")
        time.sleep(0.3)  # Rate limiting

    # Apply fetched data
    enriched = 0
    for entry in history:
        ticker = entry['ticker']
        if ticker not in ticker_cache:
            continue
        info = ticker_cache[ticker]
        if not info:
            continue
        
        # Update company if missing or same as ticker
        if (not entry.get('company') or entry['company'] == ticker) and info.get('company'):
            entry['company'] = info['company']
            enriched += 1

        # Update sector if missing
        if (not entry.get('sector') or entry['sector'] in ('Unknown', '', None)) and info.get('sector'):
            entry['sector'] = info['sector']

        # Update subsector if missing or N/A
        if (not entry.get('subsector') or entry['subsector'] in ('N/A', '', 'Unknown', None)) and info.get('subsector'):
            entry['subsector'] = info['subsector']

    print(f"\nEnriched {enriched} records")

    # Phase 3: Final verification
    still_missing_sub = sum(
        1 for h in history
        if not h.get('subsector') or h.get('subsector') in ('N/A', '', 'Unknown', None)
    )
    print(f"Still missing subsector: {still_missing_sub}/{len(history)}")

    # Save
    data['history'] = history
    with open(PERF_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Saved: {PERF_FILE}")

if __name__ == '__main__':
    main()
