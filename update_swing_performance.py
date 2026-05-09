import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def get_ticker_info(ticker, cache):
    """Try to get sector and industry info from cache or live yfinance."""
    ticker = ticker.upper()
    if ticker in cache:
        c = cache[ticker]
        if c.get('industry') and c.get('industry') != 'Unknown':
            return {
                'sector': c.get('sector', 'Unknown'),
                'industry': c.get('industry', 'Unknown'),
                'company': c.get('companyName', ticker)
            }
    
    try:
        logging.info(f"Fetching info for {ticker} live...")
        info = yf.Ticker(ticker).info
        res = {
            'sector': info.get('sector', 'Unknown'),
            'industry': info.get('industry', 'Unknown'),
            'company': info.get('longName', ticker)
        }
        if ticker not in cache: cache[ticker] = {}
        cache[ticker].update({
            'sector': res['sector'],
            'industry': res['industry'],
            'companyName': res['company']
        })
        return res
    except:
        return {'sector': 'Unknown', 'industry': 'Unknown', 'company': ticker}

def update_performance_live():
    performance_file = 'frontend/public/swing_performance.json'
    picks_file = 'frontend/public/swing_all_picks.json'
    cache_file = r'C:\Users\afksm\finma\scratch\financial_tracker\watchlists\persistent_info_cache.json'
    if not os.path.exists(cache_file):
        cache_file = r'C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists\persistent_info_cache.json'

    # 1. Load history
    if os.path.exists(performance_file):
        with open(performance_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            history = data.get('history', [])
    else:
        history = []
        data = {}

    # 2. Load Cache & Today's Picks
    info_cache = {}
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                info_cache = json.load(f)
        except: pass

    today_picks = {}
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            p_list = json.load(f).get('picks', [])
            for p in p_list:
                today_picks[p['ticker']] = p

    today_str = datetime.now().strftime('%Y-%m-%d')
    today_date = datetime.strptime(today_str, '%Y-%m-%d')

    # 3. Update PENDING records (and those within 30 days)
    for record in history:
        ticker = record['ticker']
        try:
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            days_passed = (today_date - entry_date).days
            
            if days_passed == 0:
                # Rule: No results on Day 0.
                continue
            
            # Monitoring window: Day 1 to Day 30
            if days_passed > 40 and record.get('result') != 'PENDING':
                continue # Skip old finalized records

            # Start and End for monitoring
            start_check = (entry_date + timedelta(days=1))
            end_check = (entry_date + timedelta(days=31))
            
            # Fetch daily data for the 30-day window
            fetch_end = min(end_check, today_date)
            hist = yf.Ticker(ticker).history(start=start_check.strftime('%Y-%m-%d'), 
                                             end=(fetch_end + timedelta(days=1)).strftime('%Y-%m-%d'))
            
            if hist.empty: continue
            hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
            
            entry_price = record.get('entry', 0)
            sl_pct = record.get('sl_pct', -5.0)
            sl_price = entry_price * (1 + (sl_pct / 100))
            
            best_ret = record.get('return_pct', 0.0)
            peak_price = record.get('max_price', entry_price)
            peak_date = record.get('peak_date', record['date'])
            final_result = record.get('result', 'PENDING')
            exit_date = record.get('exit_date')

            # We process ALL bars since Day 1 to ensure we don't miss a WIN/STOPPED trigger
            for idx, row in hist.iterrows():
                # Stop if reached Day 30
                if (idx - entry_date).days > 30:
                    break

                day_high = float(row['High'])
                day_low = float(row['Low'])
                day_close = float(row['Close'])
                
                # Update Peak within 30 days
                if day_high > peak_price:
                    peak_price = day_high
                    peak_date = idx.strftime('%Y-%m-%d')
                
                current_ret = ((day_high - entry_price) / entry_price) * 100
                if current_ret > best_ret:
                    best_ret = current_ret

                # Check SL (Only if not already a WIN)
                # Note: Rule says +5% hit is successful. Once success, it's locked.
                if final_result != 'WIN' and day_low <= sl_price:
                    final_result = 'STOPPED'
                    exit_date = idx.strftime('%Y-%m-%d')
                    best_ret = sl_pct
                    peak_price = sl_price
                    peak_date = exit_date
                    break
                
                # Check WIN (+5% lock-in)
                if current_ret >= 5.0:
                    final_result = 'WIN'
                    # Continue to track peak until Day 30 or SL
                
                # If reached 30 days and still PENDING
                if (idx - entry_date).days == 30 and final_result == 'PENDING':
                    f_ret = ((day_close - entry_price) / entry_price) * 100
                    final_result = 'WIN' if f_ret >= 5.0 else 'LOSS'
                    best_ret = f_ret
                    exit_date = idx.strftime('%Y-%m-%d')
            
            # Update Record
            record['max_price'] = round(peak_price, 2)
            record['peak_date'] = peak_date
            record['return_pct'] = round(best_ret, 2)
            record['result'] = final_result
            if exit_date: record['exit_date'] = exit_date
            record['days'] = min(days_passed, 30)

        except Exception as e:
            logging.warning(f"Update error for {ticker}: {e}")

    # 4. Add Today's Picks
    existing_today = [r['ticker'] for r in history if r['date'] == today_str]
    for ticker, p in today_picks.items():
        if ticker not in existing_today:
            try:
                # Fetch Day 0 Average
                d0 = yf.Ticker(ticker).history(period="1d")
                if not d0.empty:
                    avg_p = (float(d0.iloc[0]['High']) + float(d0.iloc[0]['Low'])) / 2
                    sl_high = p.get('tracker_logic', {}).get('stop_loss_high', avg_p * 0.95)
                    sl_pct = round(((sl_high - avg_p) / avg_p) * 100, 2)
                    
                    info = get_ticker_info(ticker, info_cache)
                    history.append({
                        'date': today_str,
                        'ticker': ticker,
                        'company': info['company'],
                        'sector': info['sector'],
                        'subsector': info['industry'],
                        'entry': round(avg_p, 2),
                        'max_price': round(avg_p, 2),
                        'sl_pct': sl_pct,
                        'return_pct': 0.0,
                        'days': 0,
                        'result': 'PENDING'
                    })
            except: pass

    # 5. Save and Stats
    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    data['history'] = history
    
    comp = [r for r in history if r.get('result') not in ['PENDING', None]]
    wins = sum(1 for r in comp if r.get('result') == 'WIN')
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': len(comp),
        'pending_count': len(history) - len(comp),
        'win_rate': round((wins / len(comp) * 100), 1) if comp else 0,
        'avg_return_pct': round(sum(r['return_pct'] for r in comp) / len(comp), 1) if comp else 0,
        'last_updated': datetime.now().isoformat()
    }
    
    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(info_cache, f, indent=2, ensure_ascii=False)
    except: pass
    logging.info(f"Performance updated. Win Rate: {data['stats']['win_rate']}%")

if __name__ == "__main__":
    update_performance_live()
