import json
import os
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def get_ticker_info(ticker, cache):
    """Try to get sector and industry info from cache or live yfinance."""
    ticker = ticker.upper()
    if ticker in cache:
        c = cache[ticker]
        # Return if we have the info
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
        # Update cache in-place
        if ticker not in cache: cache[ticker] = {}
        cache[ticker].update({
            'sector': res['sector'],
            'industry': res['industry'],
            'companyName': res['company'],
            'market_cap': info.get('marketCap', 0)
        })
        return res
    except:
        return {'sector': 'Unknown', 'industry': 'Unknown', 'company': ticker}

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
                
                # Fix missing sector/company/subsector
                needs_info = (not record.get('sector') or record['sector'] in ['Unknown', '—', 'None'] or
                             not record.get('subsector') or record['subsector'] in ['Unknown', '—', 'None'] or
                             not record.get('company') or record['company'] == record['ticker'])
                
                if needs_info:
                    info = get_ticker_info(record['ticker'], info_cache)
                    record['sector'] = info['sector']
                    record['subsector'] = info['industry']
                    record['company'] = info['company']
        except: pass

    # 4. Load today's picks and add to tickers
    today_picks_list = []
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            today_picks_list = json.load(f).get('picks', [])
            for p in today_picks_list:
                tickers_to_update.add(p['ticker'])

    # 5. Fetch live prices + peak within 30-day window via yfinance
    live_prices = {}
    peak_data   = {}   # ticker -> {price, date, days_to_peak}

    if tickers_to_update:
        logging.info(f"Fetching live prices for {len(tickers_to_update)} tickers...")
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

        # Per-ticker: fetch 30-day window High to find peak date
        for ticker in tickers_to_update:
            # Find earliest entry for this ticker in the active window
            relevant = [r for r in history
                        if r['ticker'] == ticker
                        and (today_date - datetime.strptime(r['date'], '%Y-%m-%d')).days <= 30]
            if not relevant:
                continue
            earliest_entry = min(datetime.strptime(r['date'], '%Y-%m-%d') for r in relevant)
            window_end = min(earliest_entry + timedelta(days=30), today_date)
            try:
                hist = yf.Ticker(ticker).history(
                    start=earliest_entry.strftime('%Y-%m-%d'),
                    end=(window_end + timedelta(days=1)).strftime('%Y-%m-%d')
                )
                if not hist.empty:
                    hist.index = hist.index.tz_localize(None) if hist.index.tzinfo else hist.index
                    peak_data[ticker] = {
                        'hist': hist,
                        'earliest_entry': earliest_entry,
                    }
            except Exception as e:
                logging.warning(f"Peak data fetch error for {ticker}: {e}")

    # 6. Update history records — days = days to peak (not days since entry)
    for record in history:
        ticker = record['ticker']
        try:
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            days_since_entry = (today_date - entry_date).days

            # STRICT: Only update records <= 30 days old
            if days_since_entry > 30:
                continue

            # Re-calculate peak within 30-day window from actual historical data
            if ticker in peak_data:
                hist = peak_data[ticker]['hist']
                mask = hist.index.normalize() >= pd.Timestamp(entry_date)
                window = hist[mask]

                if not window.empty:
                    peak_idx   = window['High'].idxmax()
                    peak_price = float(window['High'].max())
                    peak_date  = peak_idx.normalize()
                    days_to_peak = int((peak_date - pd.Timestamp(entry_date)).days)
                    days_to_peak = max(0, days_to_peak)

                    entry_price = record.get('entry', 0)
                    if entry_price > 0:
                        return_pct = round(((peak_price - entry_price) / entry_price) * 100, 2)
                    else:
                        return_pct = 0.0

                    record['max_price']  = round(peak_price, 2)
                    record['peak_date']  = peak_date.strftime('%Y-%m-%d')
                    record['days']       = days_to_peak
                    record['return_pct'] = return_pct
                    continue   # skip legacy fallback below

            # Fallback: use live close price if no peak data
            if ticker in live_prices:
                current_price = live_prices[ticker]
                if current_price > record.get('max_price', 0):
                    record['max_price'] = round(current_price, 2)
                entry_price = record.get('entry', 0)
                if entry_price > 0:
                    record['return_pct'] = round(((record['max_price'] - entry_price) / entry_price) * 100, 2)
                # Keep days as 0 (same day) rather than days_since_entry
                if not record.get('days'):
                    record['days'] = 0
        except Exception as e:
            logging.warning(f"Update error for {record.get('ticker')}: {e}")

    # 7. Add today's new picks if not already there today
    existing_today_tickers = [r['ticker'] for r in history if r['date'] == today_str]
    for p in today_picks_list:
        ticker = p['ticker']
        if ticker not in existing_today_tickers:
            price = live_prices.get(ticker, p.get('current_price', 0))
            if price > 0:
                info = get_ticker_info(ticker, info_cache)
                history.append({
                    'date': today_str,
                    'ticker': ticker,
                    'company': info['company'],
                    'sector': info['sector'],
                    'subsector': info['industry'],
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
    
    # 9. Save Cache
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(info_cache, f, indent=2, ensure_ascii=False)
        logging.info("Cache persisted.")
    except Exception as e:
        logging.warning(f"Cache save error: {e}")

    logging.info(f"Performance updated. Total records: {len(history)}")

if __name__ == "__main__":
    update_performance_live()
