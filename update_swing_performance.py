import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def update_performance_live():
    performance_file = 'frontend/public/swing_performance.json'
    picks_file = 'frontend/public/swing_picks.json'
    
    # 1. Load history
    if os.path.exists(performance_file):
        with open(performance_file, 'r', encoding='utf-8') as f:
            perf_data = json.load(f)
            history = perf_data.get('history', [])
    else:
        history = []
        perf_data = {}

    today_str = datetime.now().strftime('%Y-%m-%d')
    today_date = datetime.strptime(today_str, '%Y-%m-%d')

    # 2. Identify tickers that need updates (active in last 30 days)
    # We also include today's new picks
    tickers_to_update = set()
    for record in history:
        try:
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            if (today_date - entry_date).days <= 32:
                tickers_to_update.add(record['ticker'])
        except: pass

    # 3. Load today's picks and add to tickers
    today_picks_list = []
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            today_picks_list = json.load(f).get('picks', [])
            for p in today_picks_list:
                tickers_to_update.add(p['ticker'])

    # 4. Fetch live prices via yfinance
    live_prices = {}
    if tickers_to_update:
        logging.info(f"Fetching live prices for {len(tickers_to_update)} tickers...")
        # Download in bulk
        try:
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

    # 5. Update history records
    for record in history:
        ticker = record['ticker']
        if ticker in live_prices:
            current_price = live_prices[ticker]
            # Update max price achieved
            if current_price > record.get('max_price', 0):
                record['max_price'] = current_price
            
            # Update current return based on max price (as used in this specific UI)
            # Or based on current price? The UI seems to show "MAX RETURN"
            if record.get('entry', 0) > 0:
                record['return_pct'] = round(((record['max_price'] - record['entry']) / record['entry']) * 100, 2)
            
            try:
                entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
                record['days'] = (today_date - entry_date).days
            except: pass

    # 6. Add today's new picks if not already there today
    existing_today_tickers = [r['ticker'] for r in history if r['date'] == today_str]
    for p in today_picks_list:
        ticker = p['ticker']
        if ticker not in existing_today_tickers:
            # Check 5-day rule (optional, but keep for consistency)
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
                        'sector': p.get('sector', 'Unknown'),
                        'entry': price,
                        'max_price': price,
                        'return_pct': 0.0,
                        'days': 0,
                        'result': 'PENDING'
                    })

    # 7. Finalize and Save
    history.sort(key=lambda x: x['date'], reverse=True)
    perf_data['history'] = history
    
    # Recalculate stats
    total = len(history)
    wins = sum(1 for x in history if x.get('return_pct', 0) > 0)
    perf_data['stats'] = {
        'total_picks': total,
        'win_rate': round((wins / total * 100), 1) if total > 0 else 0,
        'avg_return_pct': round(sum(x.get('return_pct', 0) for x in history) / total, 1) if total > 0 else 0,
        'period_days': 90,
        'above_5pct_rate': round(sum(1 for x in history if x.get('return_pct', 0) >= 5) / total * 100, 1) if total > 0 else 0
    }
    perf_data['generated_at'] = datetime.now().isoformat()

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(perf_data, f, indent=2, ensure_ascii=False)
    logging.info(f"Performance updated. Total records: {len(history)}")

if __name__ == "__main__":
    update_performance_live()
