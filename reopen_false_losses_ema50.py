import json
import math
import sys
import yfinance as yf
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

PERFORMANCE_FILE = 'frontend/public/swing_performance.json'

def main():
    with open(PERFORMANCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    history = data['history']
    today = datetime.now()
    
    reopened = 0
    tickers_to_update = []
    
    # 1. Identify FALSE LOSS records
    for record in history:
        if record['result'] == 'LOSS':
            entry = float(record['entry'])
            ret = float(record.get('return_pct', 0))
            exit_price = entry * (1 + ret / 100)
            ema50 = record.get('ema50_1d')
            
            # If we have EMA50, and exit_price was strictly higher than EMA50, this is a false loss under the strict 1D EMA50 SL rule!
            if ema50 is not None and exit_price > float(ema50):
                print(f"False LOSS detected: {record['date']} {record['ticker']} | Exit Price: ${exit_price:.2f} > EMA50: ${ema50:.2f} (marked as LOSS with {ret}%)")
                
                # Reopen the trade
                record['result'] = 'PENDING'
                record['active_sl_level'] = round(float(ema50), 2)
                if 'exit_date' in record:
                    del record['exit_date']
                
                tickers_to_update.append(record['ticker'])
                reopened += 1

    print(f"\nTotal false losses reopened: {reopened}")
    
    if reopened > 0:
        # Get unique tickers to fetch latest prices
        tickers_to_update = list(set(tickers_to_update))
        print(f"Fetching latest prices for {len(tickers_to_update)} reopened tickers...")
        
        try:
            prices_df = yf.download(tickers_to_update, period="5d", interval="1d", group_by='ticker', threads=True, progress=False)
            
            for record in history:
                if record['result'] == 'PENDING' and record['ticker'] in tickers_to_update:
                    ticker = record['ticker']
                    try:
                        if len(tickers_to_update) == 1:
                            ticker_data = prices_df
                        else:
                            ticker_data = prices_df[ticker]
                        
                        if ticker_data.empty:
                            continue
                        
                        current_price = float(ticker_data['Close'].iloc[-1])
                        entry_price = float(record['entry'])
                        
                        # Recalculate return
                        current_ret = ((current_price - entry_price) / entry_price) * 100
                        record['return_pct'] = round(current_ret, 2)
                        
                        entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
                        days_held = (today - entry_date).days
                        record['days'] = days_held
                        
                        print(f"  Updated {ticker}: Current Price = ${current_price:.2f}, Return = {record['return_pct']}%")
                    except Exception as e:
                        print(f"  Error updating price for {ticker}: {e}")
        except Exception as e:
            print(f"Bulk price download failed: {e}")

    # 2. Recalculate Stats based on updated history
    all_completed = [r for r in history if r['result'] != 'PENDING']
    wins = [r for r in all_completed if r['result'] == 'WIN']
    
    data['stats']['total_picks'] = len(history)
    data['stats']['completed_count'] = len(all_completed)
    data['stats']['pending_count'] = len(history) - len(all_completed)
    data['stats']['win_rate'] = round((len(wins) / len(all_completed) * 100), 1) if all_completed else 0
    
    completed_rets = [r['return_pct'] for r in all_completed if r.get('return_pct') is not None and not (isinstance(r['return_pct'], float) and math.isnan(r['return_pct']))]
    data['stats']['avg_return_pct'] = round(sum(completed_rets) / len(completed_rets), 2) if completed_rets else 0
    
    above_5 = [r for r in all_completed if (r.get('return_pct') or 0) >= 5]
    above_10 = [r for r in all_completed if (r.get('return_pct') or 0) >= 10]
    data['stats']['above_5pct_rate'] = round((len(above_5) / len(all_completed) * 100), 1) if all_completed else 0
    data['stats']['above_10pct_rate'] = round((len(above_10) / len(all_completed) * 100), 1) if all_completed else 0
    data['stats']['last_updated'] = today.strftime('%Y-%m-%dT%H:%M:%S')

    data['history'] = history
    
    with open(PERFORMANCE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print("\nStats recalculated and swing_performance.json saved.")

if __name__ == '__main__':
    main()
