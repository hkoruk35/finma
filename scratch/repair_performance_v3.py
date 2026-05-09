import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def repair_performance_v3():
    performance_file = 'frontend/public/swing_performance.json'
    SL_THRESHOLD = -3.5
    
    if not os.path.exists(performance_file):
        print("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        history = data.get('history', [])

    print(f"Auditing {len(history)} records for Intraday SL...")

    fixed_count = 0
    import time
    
    for i, record in enumerate(history):
        ticker = record['ticker']
        entry_date_str = record['date']
        entry_price = record.get('entry', 0)
        
        if entry_price <= 0: continue
        sl_price = round(entry_price * (1 + (SL_THRESHOLD / 100)), 2)
        
        try:
            entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d')
            if (datetime.now() - entry_date).days > 700: continue
            
            time.sleep(0.05)
            sl_hist = yf.Ticker(ticker).history(start=entry_date.strftime('%Y-%m-%d'), interval='1h')
            
            if sl_hist.empty:
                # print(f"  ? [{i+1}] {ticker}: No data.")
                continue
                
            sl_hist.index = sl_hist.index.tz_convert('America/New_York').tz_localize(None) if sl_hist.index.tzinfo else sl_hist.index
            
            mask = (sl_hist.index.normalize() > pd.Timestamp(entry_date)) | \
                   ((sl_hist.index.normalize() == pd.Timestamp(entry_date)) & (sl_hist.index.hour >= 13))
            relevant_bars = sl_hist[mask]
            
            if relevant_bars.empty:
                # print(f"  ? [{i+1}] {ticker}: No relevant bars.")
                continue

            sl_hit_row = None
            for idx, row in relevant_bars.iterrows():
                if row['Open'] <= sl_price:
                    sl_hit_row = (idx, row['Open'])
                    break
                if row['Low'] <= sl_price:
                    sl_hit_row = (idx, sl_price)
                    break
            
            if sl_hit_row:
                hit_time, hit_price = sl_hit_row
                hit_date = hit_time.strftime('%Y-%m-%d')
                new_ret = round(((hit_price - entry_price) / entry_price) * 100, 2)
                
                if record.get('result') != 'STOPPED' or abs(record.get('return_pct', 0) - new_ret) > 0.1:
                    print(f"  FIXING {ticker}: SL Hit at {hit_price} (Was {record.get('result')}, {record.get('return_pct')}%)")
                    record['result'] = 'STOPPED'
                    record['return_pct'] = new_ret
                    record['max_price'] = hit_price
                    record['peak_date'] = hit_date
                    record['exit_date'] = hit_date
                    record['days'] = int((hit_time.normalize() - pd.Timestamp(entry_date)).days)
                    fixed_count += 1
            else:
                # print(f"  ok [{i+1}] {ticker}")
                pass

        except Exception as e:
            print(f" Error {ticker}: {e}")

    print(f"Repair complete. Fixed {fixed_count} records.")

    # Re-calculate overall stats WITHOUT capping (honest stats)
    completed = [r for r in history if r.get('result') != 'PENDING']
    completed_count = len(completed)
    
    wins = sum(1 for r in completed if r.get('return_pct', 0) > 0)
    sum_ret = sum(r.get('return_pct', 0) for r in completed)
    
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': completed_count,
        'pending_count': len(history) - completed_count,
        'win_rate': round((wins / completed_count * 100), 1) if completed_count > 0 else 0,
        'avg_return_pct': round(sum_ret / completed_count, 1) if completed_count > 0 else 0,
        'period_days': 180, 
        'above_5pct_rate': round(sum(1 for r in completed if r.get('return_pct', 0) >= 5) / completed_count * 100, 1) if completed_count > 0 else 0,
        'above_10pct_rate': round(sum(1 for r in completed if r.get('return_pct', 0) >= 10) / completed_count * 100, 1) if completed_count > 0 else 0,
        'stop_loss_pct': SL_THRESHOLD,
        'last_updated': datetime.now().isoformat()
    }
    data['generated_at'] = datetime.now().isoformat()

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Also update the CSV if possible (or just let the user know)
    print("JSON stats updated. (Note: CSV remains as historical snapshot)")

if __name__ == "__main__":
    repair_performance_v3()
