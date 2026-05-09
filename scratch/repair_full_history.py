import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def repair_full_history():
    performance_file = 'frontend/public/swing_performance.json'
    
    if not os.path.exists(performance_file):
        print("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        history = data.get('history', [])

    print(f"Analyzing {len(history)} total records...")

    # Identify records where peak_date == date
    to_fix = [r for r in history if r.get('peak_date') == r.get('date')]
    print(f"Found {len(to_fix)} records with same-day peaks.")

    for i, record in enumerate(to_fix):
        ticker = record['ticker']
        date_str = record['date']
        entry_price = record.get('entry', 0)
        
        print(f"[{i+1}/{len(to_fix)}] Repairing {ticker} on {date_str}...")
        
        try:
            # Fetch intraday data for that day
            start_date = date_str
            end_date = (datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
            
            # Use 1h interval for speed and enough precision
            hist = yf.Ticker(ticker).history(start=start_date, end=end_date, interval='1h')
            
            if not hist.empty:
                hist.index = hist.index.tz_convert('America/New_York')
                # Signals are usually at 13:30 NY. We'll use 13:00 as the cutoff.
                valid_data = hist[hist.index.hour >= 13]
                
                if not valid_data.empty:
                    new_max = float(valid_data['High'].max())
                else:
                    # If signal was very late, use the close price of the day or entry price
                    new_max = entry_price
                
                # Update record if needed
                if new_max < record.get('max_price', 0):
                    old_max = record['max_price']
                    old_ret = record['return_pct']
                    
                    record['max_price'] = round(new_max, 2)
                    if entry_price > 0:
                        record['return_pct'] = round(((new_max - entry_price) / entry_price) * 100, 2)
                    else:
                        record['return_pct'] = 0.0
                    
                    print(f"  FIXED: {ticker} Max {old_max} -> {record['max_price']} | Ret {old_ret}% -> {record['return_pct']}%")
                else:
                    print(f"  OK: {ticker} peak was valid or higher later in the day.")
            else:
                print(f"  WARNING: No intraday data for {ticker} on {date_str}. Keeping original.")
        except Exception as e:
            print(f"  ERROR: {ticker}: {e}")

    # Re-calculate overall stats
    SL_PCT = -3.5
    completed = [r for r in history if r.get('result') != 'PENDING']
    completed_count = len(completed)
    
    def get_effective_ret(r):
        ret = r.get('return_pct', 0)
        return max(ret, SL_PCT)

    wins = sum(1 for r in completed if get_effective_ret(r) > 0)
    sum_ret = sum(get_effective_ret(r) for r in completed)
    
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': completed_count,
        'pending_count': len(history) - completed_count,
        'win_rate': round((wins / completed_count * 100), 1) if completed_count > 0 else 0,
        'avg_return_pct': round(sum_ret / completed_count, 1) if completed_count > 0 else 0,
        'period_days': 180, 
        'above_5pct_rate': round(sum(1 for r in completed if get_effective_ret(r) >= 5) / completed_count * 100, 1) if completed_count > 0 else 0,
        'above_10pct_rate': round(sum(1 for r in completed if get_effective_ret(r) >= 10) / completed_count * 100, 1) if completed_count > 0 else 0,
        'stop_loss_pct': SL_PCT,
        'last_updated': datetime.now().isoformat()
    }
    data['generated_at'] = datetime.now().isoformat()

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Full repair complete. Stats updated.")

if __name__ == "__main__":
    repair_full_history()
