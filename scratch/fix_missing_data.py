import json
import yfinance as yf
from datetime import datetime, timedelta
import math

f = 'frontend/public/swing_performance.json'
with open(f, encoding='utf-8') as file:
    data = json.load(file)

history = data.get('history', [])
fixed_count = 0

tickers_to_fix = {}
for r in history:
    if r.get('return_pct') is None:
        ticker = r['ticker']
        if ticker not in tickers_to_fix:
            tickers_to_fix[ticker] = []
        tickers_to_fix[ticker].append(r)

if not tickers_to_fix:
    print("No missing data to fix.")
    exit(0)

# bulk download 1 year of data for these tickers
all_tickers = list(tickers_to_fix.keys())
print(f"Downloading data for {len(all_tickers)} tickers...")
bulk_data = yf.download(all_tickers, period="1y", group_by='ticker', threads=True)

for ticker, records in tickers_to_fix.items():
    ticker_data = bulk_data[ticker] if len(all_tickers) > 1 else bulk_data
    if ticker_data.empty:
        print(f"Failed to fetch data for {ticker}")
        continue
        
    for r in records:
        entry_date = r.get('date')
        exit_date = r.get('exit_date') or datetime.now().strftime('%Y-%m-%d')
        
        # Filter data between entry and exit
        mask = (ticker_data.index >= entry_date) & (ticker_data.index <= exit_date)
        period_data = ticker_data[mask]
        
        if period_data.empty:
            continue
            
        entry_price = float(r['entry'])
        highs = period_data['High'].dropna()
        closes = period_data['Close'].dropna()
        
        if highs.empty or closes.empty:
            continue
            
        max_price = float(highs.max())
        peak_date_idx = highs.idxmax()
        peak_date_str = peak_date_idx.strftime('%Y-%m-%d') if hasattr(peak_date_idx, 'strftime') else None
        
        # Determine exit price based on result
        if r.get('result') == 'LOSS':
            # It hit SL, so exit price is target_sl or we can just use the min low
            # but ideally if we know target_sl:
            sl_price = r.get('active_sl_level') or (entry_price * (1 - r.get('sl_pct', 5.0) / 100))
            exit_price = sl_price
        elif r.get('result') == 'WIN':
            # It hit TP or time limit
            exit_price = float(closes.iloc[-1])
        else:
            exit_price = float(closes.iloc[-1])
            
        return_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
        
        r['max_price'] = round(max_price, 2)
        r['peak_date'] = peak_date_str
        r['return_pct'] = return_pct
        
        if r.get('days') is None:
            r['days'] = (datetime.strptime(exit_date, '%Y-%m-%d') - datetime.strptime(entry_date, '%Y-%m-%d')).days

        fixed_count += 1
        print(f"Fixed {ticker} from {entry_date}: return_pct={return_pct}%")

with open(f, 'w', encoding='utf-8') as file:
    json.dump(data, file, indent=2, allow_nan=False)

print(f"Fixed {fixed_count} missing return_pct entries.")
