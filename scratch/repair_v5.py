import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def repair_v5():
    performance_file = 'frontend/public/swing_performance.json'
    picks_file = 'frontend/public/swing_all_picks.json'
    
    if not os.path.exists(performance_file):
        print("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        history = data.get('history', [])

    # Load current SLs to use as reference for recent ones
    ref_sl_pcts = {}
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            p_list = json.load(f).get('picks', [])
            for p in p_list:
                # Calculate sl_pct from entry_zone and stop_zone if sl_pct not directly there
                entry = p.get('current_price', 0)
                sl_high = p.get('tracker_logic', {}).get('stop_loss_high', 0)
                if entry > 0 and sl_high > 0:
                    ref_sl_pcts[p['ticker']] = abs(round(((sl_high - entry) / entry) * 100, 2))

    print(f"Repairing {len(history)} records with V5 Rules...")

    fixed_count = 0
    for i, record in enumerate(history):
        ticker = record['ticker']
        date_str = record['date'] # Day 0
        
        try:
            entry_date_0 = datetime.strptime(date_str, '%Y-%m-%d')
            
            # Rule 1: Entry is Day 1 OPEN
            # We fetch data from Day 0 + 1 to Day 0 + 40 (to ensure we get Day 1 and the 30-day window)
            time.sleep(0.02)
            full_hist = yf.Ticker(ticker).history(start=(entry_date_0 + timedelta(days=1)).strftime('%Y-%m-%d'), 
                                                 end=(entry_date_0 + timedelta(days=45)).strftime('%Y-%m-%d'))
            
            if full_hist.empty:
                record['result'] = 'PENDING'
                continue

            full_hist.index = full_hist.index.tz_localize(None) if full_hist.index.tzinfo else full_hist.index
            
            # Day 1 is the first available trading day after Day 0
            day_1_idx = full_hist.index[0]
            entry_price = float(full_hist.iloc[0]['Open'])
            
            # Rule 3: SL pct
            # Default to 3.5 if not found in ref or record
            sl_pct = record.get('sl_pct') or ref_sl_pcts.get(ticker) or 3.5
            sl_pct = abs(sl_pct) # Ensure positive
            sl_price = entry_price * (1 - sl_pct / 100)
            
            # Rule 5: Peak tracking (Daily Close only)
            peak_price = entry_price
            peak_date = day_1_idx.strftime('%Y-%m-%d')
            
            final_result = 'PENDING'
            final_ret = 0.0
            exit_date = None
            
            # Process bars from Day 1 to Day 30
            # Note: Day 1 is the first bar in full_hist
            for idx, row in full_hist.iterrows():
                # Rule 6: 30 Calendar Day Limit
                days_from_day_1 = (idx - day_1_idx).days
                if days_from_day_1 > 30:
                    break

                day_close = float(row['Close'])
                
                # Update Peak (Closing based)
                if day_close > peak_price:
                    peak_price = day_close
                    peak_date = idx.strftime('%Y-%m-%d')
                
                current_ret = ((day_close - entry_price) / entry_price) * 100

                # Rule 4 & 3: Check WIN and SL (SL has priority if both on same day)
                # Rule 3: SL check on CLOSE
                if day_close <= sl_price:
                    final_result = 'LOSS'
                    final_ret = -sl_pct
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
                
                # Rule 4: WIN check on CLOSE (>= +5%)
                if current_ret >= 5.0:
                    final_result = 'WIN'
                    final_ret = current_ret
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
                
                # Rule 6: End of 30 days
                if days_from_day_1 >= 29: # Close to 30 days or the last available bar within 30 days
                    # We continue the loop to find if a later bar (but still <=30 days) triggers something
                    # If the NEXT bar is > 30 days, we'll use this one as the 30th day.
                    pass

            # Finalize if 30 days reached without trigger
            if final_result == 'PENDING':
                # Find the bar closest to 30 days (but not over)
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
                        # Still pending within 30 days
                        final_result = 'PENDING'
                        final_ret = f_ret
                        exit_date = None

            # Update Record
            record['entry'] = round(entry_price, 2)
            record['max_price'] = round(peak_price, 2)
            record['peak_date'] = peak_date
            record['return_pct'] = round(final_ret, 2)
            record['result'] = final_result
            record['sl_pct'] = sl_pct
            if exit_date:
                record['exit_date'] = exit_date
                record['days'] = (datetime.strptime(exit_date, '%Y-%m-%d') - day_1_idx).days
            else:
                record['days'] = (datetime.now() - day_1_idx).days
            
            fixed_count += 1
            if i % 20 == 0: print(f" Processed {i}/{len(history)}...")

        except Exception as e:
            # print(f" Error {ticker}: {e}")
            pass

    # Final Stats
    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    completed = [r for r in history if r.get('result') in ['WIN', 'LOSS']]
    c_count = len(completed)
    wins = sum(1 for r in completed if r.get('result') == 'WIN')
    
    # Target Hit Rate: WIN / (WIN + LOSS)
    # Avg Return: Avg of all closed (WIN+LOSS)
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': c_count,
        'pending_count': len(history) - c_count,
        'win_rate': round((wins / c_count * 100), 1) if c_count > 0 else 0,
        'avg_return_pct': round(sum(r['return_pct'] for r in completed) / c_count, 1) if c_count > 0 else 0,
        'period_days': 180, 
        'above_5pct_rate': round(sum(1 for r in completed if r.get('return_pct', 0) >= 5) / c_count * 100, 1) if c_count > 0 else 0,
        'above_10pct_rate': round(sum(1 for r in completed if r.get('return_pct', 0) >= 10) / c_count * 100, 1) if c_count > 0 else 0,
        'last_updated': datetime.now().isoformat()
    }
    data['generated_at'] = datetime.now().isoformat()
    data['history'] = history

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Repair V5 complete. Fixed {fixed_count} records. Win Rate: {data['stats']['win_rate']}%")

if __name__ == "__main__":
    repair_v5()
