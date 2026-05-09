import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def repair_v4():
    performance_file = 'frontend/public/swing_performance.json'
    picks_file = 'frontend/public/swing_all_picks.json'
    
    if not os.path.exists(performance_file):
        print("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        history = data.get('history', [])

    # Load current SLs to use as reference for recent ones
    ref_sls = {}
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            p_list = json.load(f).get('picks', [])
            for p in p_list:
                # We store SL price and calculate pct later
                ref_sls[p['ticker']] = p.get('tracker_logic', {}).get('stop_loss_high')

    print(f"Repairing {len(history)} records with V4 Rules...")

    fixed_count = 0
    for i, record in enumerate(history):
        ticker = record['ticker']
        date_str = record['date']
        
        try:
            entry_date = datetime.strptime(date_str, '%Y-%m-%d')
            # 30-day window starts from entry_date + 1
            start_check = (entry_date + timedelta(days=1))
            end_check = (entry_date + timedelta(days=31))
            
            if entry_date > (datetime.now() - timedelta(days=1)):
                # Skip if only Day 0
                record['result'] = 'PENDING'
                record['days'] = 0
                continue

            # 1. Re-calculate Entry (Day 0 Average)
            time.sleep(0.02)
            d0_hist = yf.Ticker(ticker).history(start=entry_date.strftime('%Y-%m-%d'), 
                                               end=(entry_date + timedelta(days=1)).strftime('%Y-%m-%d'))
            
            if d0_hist.empty:
                # Fallback to existing entry if Day 0 data missing
                entry_price = record.get('entry', 0)
            else:
                entry_price = (float(d0_hist.iloc[0]['High']) + float(d0_hist.iloc[0]['Low'])) / 2
                record['entry'] = round(entry_price, 2)

            # 2. Re-calculate SL Price
            # Rule: SL should be bot-provided. 
            # If not found, we use a fallback logic (e.g. -5% if we don't know)
            sl_price = ref_sls.get(ticker)
            if not sl_price:
                # Heuristic: Find if we have sl_pct in record, or use -5%
                sl_pct = record.get('sl_pct', -5.0)
                sl_price = entry_price * (1 + (sl_pct / 100))
            else:
                sl_pct = round(((sl_price - entry_price) / entry_price) * 100, 2)
            
            record['sl_pct'] = sl_pct

            # 3. Monitor Day 1 to Day 30
            win_check_end = min(end_check, datetime.now())
            hist = yf.Ticker(ticker).history(start=start_check.strftime('%Y-%m-%d'), 
                                             end=(win_check_end + timedelta(days=1)).strftime('%Y-%m-%d'))
            
            if hist.empty:
                record['result'] = 'PENDING'
                continue

            hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
            
            # Simulation
            best_ret = 0.0
            peak_price = entry_price
            peak_date = date_str
            final_result = 'PENDING'
            exit_date = None
            
            for idx, row in hist.iterrows():
                day_high = float(row['High'])
                day_low = float(row['Low'])
                day_close = float(row['Close'])
                
                # Update peak within 30 days
                if day_high > peak_price:
                    peak_price = day_high
                    peak_date = idx.strftime('%Y-%m-%d')
                
                current_ret = ((day_high - entry_price) / entry_price) * 100
                if current_ret > best_ret:
                    best_ret = current_ret

                # Check SL
                if day_low <= sl_price:
                    # STOPPED
                    final_result = 'STOPPED'
                    exit_date = idx.strftime('%Y-%m-%d')
                    # Record the return at SL
                    record['return_pct'] = sl_pct
                    record['max_price'] = round(sl_price, 2)
                    break
                
                # Check WIN (+5% lock-in)
                if current_ret >= 5.0:
                    final_result = 'WIN'
                    # We continue to find the MAX peak within 30 days, but result is locked as WIN
                
                # Stop if reached Day 30
                if (idx - entry_date).days >= 30:
                    if final_result == 'PENDING':
                        final_ret = ((day_close - entry_price) / entry_price) * 100
                        final_result = 'WIN' if final_ret >= 5.0 else 'LOSS'
                        record['return_pct'] = round(final_ret, 2)
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
            
            # Update Record
            if final_result != 'STOPPED':
                # For WIN or LOSS or PENDING (if < 30 days)
                record['return_pct'] = round(best_ret, 2)
                record['max_price'] = round(peak_price, 2)
                record['peak_date'] = peak_date
                if final_result != 'PENDING':
                    record['result'] = final_result
                    record['exit_date'] = exit_date or hist.index[-1].strftime('%Y-%m-%d')
            
            record['days'] = min((datetime.now() - entry_date).days, 30)
            fixed_count += 1
            if i % 10 == 0: print(f" Processed {i}/{len(history)}...")

        except Exception as e:
            # print(f" Error {ticker}: {e}")
            pass

    # Final Stats
    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    completed = [r for r in history if r.get('result') not in ['PENDING', None]]
    c_count = len(completed)
    wins = sum(1 for r in completed if r.get('result') == 'WIN')
    sum_ret = sum(r.get('return_pct', 0) for r in completed)
    
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': c_count,
        'pending_count': len(history) - c_count,
        'win_rate': round((wins / c_count * 100), 1) if c_count > 0 else 0,
        'avg_return_pct': round(sum_ret / c_count, 1) if c_count > 0 else 0,
        'last_updated': datetime.now().isoformat()
    }
    
    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Repair V4 complete. Fixed {fixed_count} records. New Win Rate: {data['stats']['win_rate']}%")

if __name__ == "__main__":
    repair_v4()
