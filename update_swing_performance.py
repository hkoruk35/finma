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

    # 3. Update PENDING records (V5 Rules)
    for record in history:
        ticker = record['ticker']
        if record.get('result') not in ['PENDING', None]:
            # Optional: Allow re-updating if within 40 days to catch data corrections
            entry_date_0 = datetime.strptime(record['date'], '%Y-%m-%d')
            if (today_date - entry_date_0).days > 40:
                continue

        try:
            entry_date_0 = datetime.strptime(record['date'], '%Y-%m-%d')
            # Fetch data from Day 0 + 1 to today
            # We fetch up to 45 days to be safe
            hist = yf.Ticker(ticker).history(start=(entry_date_0 + timedelta(days=1)).strftime('%Y-%m-%d'),
                                             end=(entry_date_0 + timedelta(days=45)).strftime('%Y-%m-%d'))
            
            if hist.empty: continue
            hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
            
            # Rule 1: Entry is Day 1 OPEN
            day_1_idx = hist.index[0]
            entry_price = float(hist.iloc[0]['Open'])
            
            # Rule 3: SL pct (default 3.5 if missing)
            sl_pct = abs(record.get('sl_pct', 3.5))
            sl_price = entry_price * (1 - sl_pct / 100)
            
            peak_price = record.get('max_price', entry_price)
            peak_date = record.get('peak_date', day_1_idx.strftime('%Y-%m-%d'))
            final_result = 'PENDING'
            final_ret = 0.0
            exit_date = None

            # Process Day 1 onwards
            for idx, row in hist.iterrows():
                days_from_day_1 = (idx - day_1_idx).days
                if days_from_day_1 > 30: break

                day_close = float(row['Close'])
                
                # Update Peak (Close based)
                if day_close > peak_price:
                    peak_price = day_close
                    peak_date = idx.strftime('%Y-%m-%d')
                
                current_ret = ((day_close - entry_price) / entry_price) * 100

                # Rule 3: SL Check (Priority)
                if day_close <= sl_price:
                    final_result = 'LOSS'
                    final_ret = -sl_pct
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
                
                # Rule 4: WIN Check (>= +5%)
                if current_ret >= 5.0:
                    final_result = 'WIN'
                    final_ret = current_ret
                    exit_date = idx.strftime('%Y-%m-%d')
                    break
                
            # Rule 6: 30 Day Limit
            if final_result == 'PENDING':
                valid_bars = hist[(hist.index - day_1_idx).days <= 30]
                if not valid_bars.empty:
                    last_bar = valid_bars.iloc[-1]
                    f_close = float(last_bar['Close'])
                    f_ret = ((f_close - entry_price) / entry_price) * 100
                    
                    if (today_date - day_1_idx).days >= 30:
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
            if exit_date:
                record['exit_date'] = exit_date
                record['days'] = (datetime.strptime(exit_date, '%Y-%m-%d') - day_1_idx).days
            else:
                record['days'] = (today_date - day_1_idx).days

        except Exception as e:
            logging.warning(f"Update error for {ticker}: {e}")

    # 4. Add Today's Picks (Day 0)
    # They stay PENDING until Day 1 data is available
    existing_today = [r['ticker'] for r in history if r['date'] == today_str]
    for ticker, p in today_picks.items():
        if ticker not in existing_today:
            info = get_ticker_info(ticker, info_cache)
            # Find sl_pct from bot output
            entry_ref = p.get('current_price', 1)
            sl_ref = p.get('tracker_logic', {}).get('stop_loss_high', entry_ref * 0.965)
            sl_pct = abs(round(((sl_ref - entry_ref) / entry_ref) * 100, 2))
            
            history.append({
                'date': today_str,
                'ticker': ticker,
                'company': info['company'],
                'sector': info['sector'],
                'subsector': info['industry'],
                'entry': 0, # To be filled on Day 1
                'max_price': 0,
                'sl_pct': sl_pct,
                'return_pct': 0.0,
                'days': 0,
                'result': 'PENDING'
            })

    # 5. Save and Stats
    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    data['history'] = history
    
    comp = [r for r in history if r.get('result') in ['WIN', 'LOSS']]
    c_count = len(comp)
    wins = sum(1 for r in comp if r.get('result') == 'WIN')
    
    data['stats'] = {
        'total_picks': len(history),
        'completed_count': c_count,
        'pending_count': len(history) - c_count,
        'win_rate': round((wins / c_count * 100), 1) if c_count > 0 else 0,
        'avg_return_pct': round(sum(r['return_pct'] for r in comp) / c_count, 1) if c_count > 0 else 0,
        'last_updated': datetime.now().isoformat()
    }
    
    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(info_cache, f, indent=2, ensure_ascii=False)
    except: pass
    logging.info(f"V5 Performance updated. Win Rate: {data['stats']['win_rate']}%")

if __name__ == "__main__":
    update_performance_live()
