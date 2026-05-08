import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def get_ticker_info(ticker, cache):
    ticker = ticker.upper()
    if ticker in cache:
        c = cache[ticker]
        return {
            'sector': c.get('sector', 'Unknown'),
            'industry': c.get('industry', 'Unknown'),
            'company': c.get('companyName', ticker)
        }
    return {'sector': 'Unknown', 'industry': 'Unknown', 'company': ticker}

def update_daytrade_performance():
    performance_file = 'frontend/public/daytrade_performance.json'
    picks_file = 'frontend/public/daytrade_all_picks.json'
    cache_file = r'C:\Users\afksm\finma\scratch\financial_tracker\watchlists\persistent_info_cache.json'

    # 1. Load history
    if os.path.exists(performance_file):
        with open(performance_file, 'r', encoding='utf-8') as f:
            perf_data = json.load(f)
            history = perf_data.get('history', [])
    else:
        history = []
        perf_data = {"stats": {}, "history": []}

    # 2. Load Cache
    info_cache = {}
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                info_cache = json.load(f)
        except: pass

    today_str = datetime.now().strftime('%Y-%m-%d')
    today_date = datetime.strptime(today_str, '%Y-%m-%d')

    # 3. Load today's picks
    today_picks_list = []
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            today_picks_list = json.load(f).get('picks', [])

    # 4. Update existing PENDING daytrades (from today)
    # Daytrade is usually resolved same day. We check today's High/Low.
    tickers_to_check = set(r['ticker'] for r in history if r.get('result') == 'PENDING')
    # Add today's picks to check list
    for p in today_picks_list:
        tickers_to_check.add(p['ticker'])

    live_data = {}
    if tickers_to_check:
        try:
            # Get today's 1m or 5m data? Let's use 1d for simplicity of peak/low today
            data = yf.download(list(tickers_to_check), period="1d", interval="5m", group_by='ticker', auto_adjust=True, progress=False)
            for t in tickers_to_check:
                try:
                    df = data[t].dropna() if len(tickers_to_check) > 1 else data.dropna()
                    if not df.empty:
                        live_data[t] = {
                            'high': float(df['High'].max()),
                            'low': float(df['Low'].min()),
                            'close': float(df['Close'].iloc[-1])
                        }
                except: pass
        except: pass

    # 5. Process History
    for record in history:
        if record.get('result') != 'PENDING':
            continue
        
        t = record['ticker']
        if t in live_data:
            ld = live_data[t]
            entry = record['entry']
            stop  = record['stop']
            tp    = record['target']
            
            # Check if stopped or target hit
            if ld['low'] <= stop:
                record['result'] = 'STOPPED_OUT'
                record['return_pct'] = round(((stop - entry) / entry) * 100, 2)
                record['max_price'] = ld['low']
            elif ld['high'] >= tp:
                record['result'] = 'TARGET_HIT'
                record['return_pct'] = round(((tp - entry) / entry) * 100, 2)
                record['max_price'] = tp
            # If it's end of day (post-market), we close it at 'close'
            # For now, we leave it PENDING unless hit.

    # 6. Add NEW picks for today
    existing_today = [r['ticker'] for r in history if r['date'] == today_str]
    for p in today_picks_list:
        ticker = p['ticker']
        if ticker not in existing_today:
            info = get_ticker_info(ticker, info_cache)
            history.append({
                'date': today_str,
                'ticker': ticker,
                'company': info['company'],
                'sector': info['sector'],
                'entry': p['current_price'],
                'stop': p['boga_zones']['stop'],
                'target': p['boga_zones']['tp1'],
                'max_price': p['current_price'],
                'return_pct': 0.0,
                'result': 'PENDING'
            })

    # 7. Update Stats
    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    perf_data['history'] = history
    
    completed = [r for r in history if r.get('result') != 'PENDING']
    c_count = len(completed)
    wins = sum(1 for r in completed if r.get('return_pct', 0) > 0)
    
    perf_data['stats'] = {
        'total_picks': len(history),
        'completed_count': c_count,
        'pending_count': len(history) - c_count,
        'win_rate': round((wins / c_count * 100), 1) if c_count > 0 else 0,
        'avg_return_pct': round(sum(r.get('return_pct', 0) for r in completed) / c_count, 1) if c_count > 0 else 0,
        'period_days': 30,
        'last_updated': datetime.now().isoformat()
    }
    
    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(perf_data, f, indent=2, ensure_ascii=False)
    
    logging.info(f"DayTrade Performance updated. Total: {len(history)}")

if __name__ == "__main__":
    update_daytrade_performance()
