"""
Force-close all PENDING trades that have been open >= 30 days.
Uses the already-stored max_price (peak) as the exit return.
If max_price is missing, fetches historical data for that ticker.
"""
import json, math, sys, time
from datetime import datetime, timedelta
import yfinance as yf

sys.stdout.reconfigure(encoding='utf-8')

f = 'frontend/public/swing_performance.json'
today = datetime.now()

with open(f, encoding='utf-8') as fh:
    data = json.load(fh)

history = data.get('history', [])

# Collect all pending >= 30 days
to_fix = [r for r in history if r.get('result') == 'PENDING'
          and (today - datetime.strptime(r['date'], '%Y-%m-%d')).days >= 30]

print(f"Found {len(to_fix)} PENDING trades >= 30 days old. Processing...")

# Group by ticker for bulk download of any that are missing max_price
missing_tickers = list({r['ticker'] for r in to_fix
                        if not r.get('max_price') or r['max_price'] is None})

bulk = {}
if missing_tickers:
    print(f"  Fetching historical data for {len(missing_tickers)} tickers with missing peak...")
    dl = yf.download(missing_tickers, period="1y", group_by='ticker', threads=True, progress=False)
    for tkr in missing_tickers:
        try:
            td = dl[tkr] if len(missing_tickers) > 1 else dl
            bulk[tkr] = td
        except Exception:
            pass

fixed = 0
for r in to_fix:
    entry_price = float(r['entry'])
    entry_date  = r['date']
    days_held   = (today - datetime.strptime(entry_date, '%Y-%m-%d')).days

    # Determine peak price
    raw_peak = r.get('max_price')
    if raw_peak is not None and not math.isnan(float(raw_peak)):
        peak_price = float(raw_peak)
    else:
        # Try to get it from bulk download
        tkr = r['ticker']
        if tkr in bulk and not bulk[tkr].empty:
            mask = bulk[tkr].index >= entry_date
            period = bulk[tkr][mask]
            if not period.empty:
                highs = period['High'].dropna()
                closes = period['Close'].dropna()
                peak_price = float(highs.max()) if not highs.empty else entry_price
                peak_date  = highs.idxmax().strftime('%Y-%m-%d') if not highs.empty else entry_date
                r['max_price'] = round(peak_price, 2)
                r['peak_date']  = peak_date
                if not closes.empty:
                    r['return_pct'] = round(((float(closes.iloc[-1]) - entry_price) / entry_price) * 100, 2)
            else:
                peak_price = entry_price
        else:
            peak_price = entry_price

    peak_pct = round(((peak_price - entry_price) / entry_price) * 100, 2)
    r['result']     = 'WIN' if peak_pct > 0 else 'LOSS'
    r['return_pct'] = peak_pct
    r['days']       = days_held
    r['max_price']  = round(peak_price, 2)
    r['exit_date']  = today.strftime('%Y-%m-%d')
    fixed += 1
    print(f"  Closed {r['ticker']} ({entry_date}): {days_held}d → {peak_pct:+.2f}% [{r['result']}]")

with open(f, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, indent=2, allow_nan=False)

print(f"\nDone. Force-closed {fixed} trades.")
