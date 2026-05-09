import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def repair_v6():
    performance_file = 'frontend/public/swing_performance.json'
    sl_map_file = 'scratch/ticker_sl_map.json'
    
    if not os.path.exists(performance_file):
        print("Performance file not found.")
        return
    if not os.path.exists(sl_map_file):
        print("SL Map not found. Run build_sl_map.py first.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        history = data.get('history', [])
    
    with open(sl_map_file, 'r', encoding='utf-8') as f:
        sl_map = json.load(f)

    # Global Average SL as ultimate fallback
    global_sl_avg = 5.26 

    print(f"Repairing {len(history)} records with V6 Rules (Dynamic SL)...")

    fixed_count = 0
    for i, record in enumerate(history):
        ticker = record['ticker']
        date_str = record['date']
        
        try:
            entry_date_0 = datetime.strptime(date_str, '%Y-%m-%d')
            
            # Rule 1: Entry is Day 1 OPEN
            time.sleep(0.02)
            full_hist = yf.Ticker(ticker).history(start=(entry_date_0 + timedelta(days=1)).strftime('%Y-%m-%d'), 
                                                 end=(entry_date_0 + timedelta(days=45)).strftime('%Y-%m-%d'))
            
            if full_hist.empty:
                record['result'] = 'PENDING'
                continue

            full_hist.index = full_hist.index.tz_localize(None) if full_hist.index.tzinfo else full_hist.index
            day_1_idx = full_hist.index[0]
            entry_price = float(full_hist.iloc[0]['Open'])
            
            # Rule 3: Dynamic SL
            # Try 1: Exact date in sl_map
            # Try 2: Any date for this ticker in sl_map (use avg of ticker)
            # Try 3: Global average
            sl_pct = 5.26
            if ticker in sl_map:
                if date_str in sl_map[ticker]:
                    sl_pct = sl_map[ticker][date_str]
                else:
                    t_vals = list(sl_map[ticker].values())
                    sl_pct = sum(t_vals) / len(t_vals)
            else:
                sl_pct = global_sl_avg
            
            sl_pct = abs(sl_pct)
            sl_price = entry_price * (1 - sl_pct / 100)
            
            peak_price = entry_price
            peak_date = day_1_idx.strftime('%Y-%m-%d')
            
            final_result = 'PENDING'
            final_ret = 0.0
            exit_date = None
            
            for idx, row in full_hist.iterrows():
                days_from_day_1 = (idx - day_1_idx).days
                if days_from_day_1 > 30: break

                day_close = float(row['Close'])
                if day_close > peak_price:
                    peak_price = day_close
                    peak_date = idx.strftime('%Y-%m-%d')
                
                current_ret = ((day_close - entry_price) / entry_price) * 100

                # Check SL on CLOSE
                if day_close <= sl_price:
                    final_result = 'LOSS'
                    final_ret = -sl_pct
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
                
                # Check WIN on CLOSE (>= +5%)
                if current_ret >= 5.0:
                    final_result = 'WIN'
                    final_ret = current_ret
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
                
            if final_result == 'PENDING':
                valid_bars = full_hist[(full_hist.index - day_1_idx).days <= 30]
                if not valid_bars.empty:
                    last_bar = valid_bars.iloc[-1]
                    f_close = float(last_bar['Close'])
                    f_ret = ((f_close - entry_price) / entry_price) * 100
                    
                    if (datetime.now() - day_1_idx).days >= 30:
                        final_result = 'WIN' if f_ret > 0 else 'LOSS'
                        final_ret = f_ret
                        exit_date = valid_bars.index[-1].strftime('%Y-%m-%d')
                    else:
                        final_result = 'PENDING'
                        final_ret = f_ret
                        exit_date = None

            # Update Record
            record['entry'] = round(entry_price, 2)
            record['max_price'] = round(peak_price, 2)
            record['peak_date'] = peak_date
            record['return_pct'] = round(final_ret, 2)
            record['result'] = final_result
            record['sl_pct'] = round(sl_pct, 2)
            if exit_date:
                record['exit_date'] = exit_date
                record['days'] = (datetime.strptime(exit_date, '%Y-%m-%d') - day_1_idx).days
            else:
                record['days'] = (datetime.now() - day_1_idx).days
            
            fixed_count += 1
            if i % 20 == 0: print(f" Processed {i}/{len(history)}...")

        except Exception as e: pass

    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    completed = [r for r in history if r.get('result') in ['WIN', 'LOSS']]
    c_count = len(completed)
    wins = sum(1 for r in completed if r.get('result') == 'WIN')
    
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': c_count,
        'pending_count': len(history) - c_count,
        'win_rate': round((wins / c_count * 100), 1) if c_count > 0 else 0,
        'avg_return_pct': round(sum(r['return_pct'] for r in completed) / c_count, 1) if c_count > 0 else 0,
        'stop_loss_pct': "Dynamic", # Label for frontend
        'last_updated': datetime.now().isoformat()
    }
    data['history'] = history

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Repair V6 complete. Fixed {fixed_count} records. Win Rate: {data['stats']['win_rate']}%")

if __name__ == "__main__":
    repair_v6()
