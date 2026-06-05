import json
import os
import yfinance as yf
from datetime import datetime, timedelta

performance_file = 'frontend/public/swing_performance.json'

def repair_sl():
    if not os.path.exists(performance_file):
        print(f"File not found: {performance_file}")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    history = data.get('history', [])
    today = datetime.now()

    # Find closed LOSS trades that were stopped out recently (e.g., last 30 days)
    # We will re-evaluate them with HDSL rules
    cutoff_date = today - timedelta(days=60)
    
    # We want to re-evaluate ALL LOSS trades if they are false positives based on their entry date vs today.
    # Actually, the user specifically mentioned AVT, ZM, IBKR but we can check all of them.
    # If a trade is LOSS but currently current_price > EMA50 or > entry*0.95, it should be PENDING.
    
    # Let's collect tickers to download
    tickers_to_check = [r['ticker'] for r in history if r['result'] == 'LOSS' and datetime.strptime(r['date'], '%Y-%m-%d') >= cutoff_date]
    tickers_to_check = list(set(tickers_to_check))
    
    if not tickers_to_check:
        print("No recent LOSS trades found to check.")
        return

    print(f"Checking {len(tickers_to_check)} tickers for false SL triggers...")
    prices_df = yf.download(tickers_to_check, period="150d", interval="1d", group_by='ticker', threads=True, progress=False)

    fixed_count = 0

    for record in history:
        if record['result'] != 'LOSS' or datetime.strptime(record['date'], '%Y-%m-%d') < cutoff_date:
            continue
            
        ticker = record['ticker']
        try:
            if len(tickers_to_check) == 1:
                ticker_data = prices_df
            else:
                ticker_data = prices_df[ticker]
            
            if ticker_data.empty: continue
            
            current_price = float(ticker_data['Close'].iloc[-1])
            entry_price = float(record['entry'])
            
            ema_series = ticker_data['Close'].ewm(span=50, adjust=False).mean()
            ema50_1d = float(ema_series.iloc[-1])
            record['ema50_1d'] = round(ema50_1d, 2)
            
            math_sl_limit = entry_price * 0.95
            
            if current_price > ema50_1d:
                hdsl_status = "PENDING"
                target_sl = ema50_1d
            else:
                if current_price <= math_sl_limit:
                    hdsl_status = "LOSS"
                    target_sl = math_sl_limit
                else:
                    hdsl_status = "PENDING"
                    target_sl = ema50_1d
                    
            record['active_sl_level'] = round(target_sl, 2)

            # If it should be PENDING, fix it
            if hdsl_status == "PENDING":
                print(f"Fixing {ticker}: Was LOSS, now PENDING (Price: {current_price:.2f}, EMA50: {ema50_1d:.2f}, SL Limit: {math_sl_limit:.2f})")
                record['result'] = 'PENDING'
                # Clear exit date and return pct for now, the update script will recalculate it properly next time
                record.pop('exit_date', None)
                record['return_pct'] = round(((current_price - entry_price) / entry_price) * 100, 2)
                fixed_count += 1
                
        except Exception as e:
            print(f"Error processing {ticker}: {e}")

    if fixed_count > 0:
        with open(performance_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Fixed {fixed_count} records. Wrote to {performance_file}")
    else:
        print("No records needed fixing.")

if __name__ == "__main__":
    repair_sl()
