import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def get_sector_info(ticker, cache):
    """Try to get sector info from cache or live yfinance."""
    ticker = ticker.upper()
    if ticker in cache and cache[ticker].get('sector') and cache[ticker]['sector'] != 'Unknown':
        return cache[ticker]['sector']
    
    try:
        logging.info(f"Fetching sector for {ticker} live...")
        info = yf.Ticker(ticker).info
        sector = info.get('sector', 'Unknown')
        return sector
    except:
        return 'Unknown'

def update_performance_live():
    performance_file = 'frontend/public/swing_performance.json'
    picks_file = 'frontend/public/swing_picks.json'
    cache_file = r'C:\Users\afksm\finma\scratch\financial_tracker\watchlists\persistent_info_cache.json'
    if not os.path.exists(cache_file):
        # try the other path mentioned in swing113_boga.py
        cache_file = r'C:\Users\afksm\.gemini\antigravity\scratch\financial_tracker\watchlists\persistent_info_cache.json'

    # 1. Load history
    if os.path.exists(performance_file):
        with open(performance_file, 'r', encoding='utf-8') as f:
            perf_data = json.load(f)
            history = perf_data.get('history', [])
    else:
        history = []
        perf_data = {}

    # 2. Load Cache
    info_cache = {}
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                info_cache = json.load(f)
        except: pass

    today_str = datetime.now().strftime('%Y-%m-%d')
    today_date = datetime.strptime(today_str, '%Y-%m-%d')

    # 3. Identify tickers that need updates (active in last 30 days)
    # We also include today's new picks
    tickers_to_update = set()
    for record in history:
        try:
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            # Only update if within last 30 days
            if (today_date - entry_date).days <= 30:
                tickers_to_update.add(record['ticker'])
                
                # Fix missing sector/company while we are at it
                if not record.get('sector') or record['sector'] == 'Unknown' or record['sector'] == '—':
                    record['sector'] = get_sector_info(record['ticker'], info_cache)
                if not record.get('company') or record['company'] == record['ticker']:
                    if record['ticker'] in info_cache:
                        record['company'] = info_cache[record['ticker']].get('companyName', record['ticker'])
        except: pass

    # 4. Load today's picks and add to tickers
    today_picks_list = []
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            today_picks_list = json.load(f).get('picks', [])
            for p in today_picks_list:
                tickers_to_update.add(p['ticker'])

    # 5. Fetch live prices via yfinance
    live_prices = {}
    if tickers_to_update:
        logging.info(f"Fetching live prices for {len(tickers_to_update)} tickers...")
        # Download in bulk
        try:
            # Using 5d to ensure we get at least one close
            data = yf.download(list(tickers_to_update), period="5d", interval="1d", group_by='ticker', auto_adjust=True, progress=False)
            for ticker in tickers_to_update:
                try:
                    if len(tickers_to_update) == 1:
                        price = data['Close'].iloc[-1]
                    else:
                        price = data[ticker]['Close'].iloc[-1]
                    if not pd.isna(price):
                        live_prices[ticker] = float(price)
                except:
                    pass
        except Exception as e:
            logging.error(f"Error fetching live prices: {e}")

    # 6. Update history records
    for record in history:
        ticker = record['ticker']
        try:
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            # STRICT REQUIREMENT: Only update records <= 30 days old
            if (today_date - entry_date).days > 30:
                continue

            if ticker in live_prices:
                current_price = live_prices[ticker]
                # Update max price achieved
                if current_price > record.get('max_price', 0):
                    record['max_price'] = current_price
                
                # Update current return based on max price
                if record.get('entry', 0) > 0:
                    record['return_pct'] = round(((record['max_price'] - record['entry']) / record['entry']) * 100, 2)
                
                record['days'] = (today_date - entry_date).days
        except: pass

    # 7. Add today's new picks if not already there today
    existing_today_tickers = [r['ticker'] for r in history if r['date'] == today_str]
    for p in today_picks_list:
        ticker = p['ticker']
        if ticker not in existing_today_tickers:
            # Check 5-day rule
            skip = False
            for r in reversed(history):
                if r['ticker'] == ticker:
                    try:
                        r_date = datetime.strptime(r['date'], '%Y-%m-%d')
                        if (today_date - r_date).days < 5:
                            skip = True
                            break
                    except: pass
            
            if not skip:
                price = live_prices.get(ticker, p.get('current_price', 0))
                if price > 0:
                    history.append({
                        'date': today_str,
                        'ticker': ticker,
                        'company': p.get('company', ticker),
                        'sector': p.get('sector', get_sector_info(ticker, info_cache)),
                        'entry': price,
                        'max_price': price,
                        'return_pct': 0.0,
                        'days': 0,
                        'result': 'PENDING'
                    })

    # 8. Finalize and Save
    history.sort(key=lambda x: (x['date'], x['ticker']), reverse=True)
    perf_data['history'] = history
    
    # Recalculate stats based on full history (or filtered?)
    # Generally stats should be based on what's visible
    total = len(history)
    wins = sum(1 for x in history if x.get('return_pct', 0) > 0)
    perf_data['stats'] = {
        'total_picks': total,
        'win_rate': round((wins / total * 100), 1) if total > 0 else 0,
        'avg_return_pct': round(sum(x.get('return_pct', 0) for x in history) / total, 1) if total > 0 else 0,
        'period_days': 180, # Extended historical view
        'above_5pct_rate': round(sum(1 for x in history if x.get('return_pct', 0) >= 5) / total * 100, 1) if total > 0 else 0,
        'above_10pct_rate': round(sum(1 for x in history if x.get('return_pct', 0) >= 10) / total * 100, 1) if total > 0 else 0
    }
    perf_data['generated_at'] = datetime.now().isoformat()

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(perf_data, f, indent=2, ensure_ascii=False)
    logging.info(f"Performance updated. Total records: {len(history)}")

if __name__ == "__main__":
    update_performance_live()
