import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def repair_performance_sl():
    performance_file = 'frontend/public/swing_performance.json'
    SL_THRESHOLD = -3.5
    
    if not os.path.exists(performance_file):
        print("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        history = data.get('history', [])

    print(f"Repairing SL for {len(history)} total records...")

    fixed_count = 0
    for i, record in enumerate(history):
        ticker = record['ticker']
        entry_date_str = record['date']
        entry_price = record.get('entry', 0)
        
        # We skip records that are already explicitly stopped unless user wants a full re-audit
        # But we definitely check PENDING and successful ones that might have hit SL first.
        
        if entry_price <= 0: continue
        
        sl_price = entry_price * (1 + (SL_THRESHOLD / 100))
        
        try:
            entry_date = datetime.strptime(entry_date_str, '%Y-%m-%d')
            
            # Fetch intraday data from entry until today (or until peak date)
            # To be efficient, we only fetch if the record is within last 180 days (yfinance 1h limit)
            if (datetime.now() - entry_date).days > 720: # yfinance limit for 1h is usually 730 days
                continue
                
            print(f"[{i+1}/{len(history)}] Auditing SL for {ticker} on {entry_date_str}...")
            
            # Fetch 1h data
            # End date is today or peak date + 2 days
            end_date = datetime.now()
            if record.get('peak_date'):
                end_date = min(end_date, datetime.strptime(record['peak_date'], '%Y-%m-%d') + timedelta(days=2))

            sl_hist = yf.Ticker(ticker).history(
                start=entry_date.strftime('%Y-%m-%d'),
                end=end_date.strftime('%Y-%m-%d'),
                interval='1h'
            )
            
            if not sl_hist.empty:
                sl_hist.index = sl_hist.index.tz_convert('America/New_York') if sl_hist.index.tzinfo else sl_hist.index
                
                # Filter for bars occurring AFTER entry time (approx 13:00 on entry day)
                mask = (sl_hist.index.normalize() > pd.Timestamp(entry_date)) | \
                       ((sl_hist.index.normalize() == pd.Timestamp(entry_date)) & (sl_hist.index.hour >= 13))
                relevant_bars = sl_hist[mask]
                
                if not relevant_bars.empty:
                    # Check if ANY bar low hit or crossed the SL price
                    sl_hits = relevant_bars[relevant_bars['Low'] <= sl_price]
                    if not sl_hits.empty:
                        first_hit_time = sl_hits.index[0]
                        first_hit_date = first_hit_time.strftime('%Y-%m-%d')
                        
                        # If SL was hit BEFORE the current max_price date, then the trade was STOPPED earlier!
                        current_peak_date = record.get('peak_date', '2099-12-31')
                        
                        if first_hit_date <= current_peak_date:
                            if record.get('result') != 'STOPPED' or record.get('return_pct', 0) != SL_THRESHOLD:
                                old_res = record.get('result')
                                old_ret = record.get('return_pct')
                                
                                record['result'] = 'STOPPED'
                                record['return_pct'] = SL_THRESHOLD
                                record['exit_date'] = first_hit_date
                                record['days'] = int((first_hit_time.normalize() - pd.Timestamp(entry_date)).days)
                                fixed_count += 1
                                print(f"  ❌ REPAIRED: {ticker} was STOPPED on {first_hit_date} (Was {old_res}, {old_ret}%)")
        except Exception as e:
            # print(f"  Error auditing {ticker}: {e}")
            pass

    print(f"SL Repair complete. Fixed {fixed_count} records.")

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
    
    print("Stats updated and saved.")

if __name__ == "__main__":
    repair_performance_sl()
