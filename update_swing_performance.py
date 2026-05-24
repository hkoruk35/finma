import json
import math
import os
import yfinance as yf
from datetime import datetime, timedelta
import time

MOJIBAKE_FIXES = {'â€"': '–', 'â€™': ''', 'â€˜': ''', 'â€œ': '"', 'â€¦': '…'}

def fix_encoding(text: str) -> str:
    if not text:
        return text
    for bad, good in MOJIBAKE_FIXES.items():
        text = text.replace(bad, good)
    try:
        return text.encode('latin-1').decode('utf-8')
    except Exception:
        return text

def fetch_ticker_meta(ticker: str) -> dict:
    """yfinance'den company name, sector ve subsector (industry) çeker."""
    try:
        info = yf.Ticker(ticker).info
        return {
            'company': info.get('longName') or info.get('shortName') or ticker,
            'sector':  info.get('sector', ''),
            'subsector': info.get('industry', ''),
        }
    except Exception:
        return {}

# Paths
performance_file = 'frontend/public/swing_performance.json'
picks_file = 'frontend/public/swing_all_picks.json'
log_file = 'logs/performance_update.log'

os.makedirs('logs', exist_ok=True)

def log(msg):
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {msg}")
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"[{timestamp}] {msg}\n")

def update_performance():
    if not os.path.exists(performance_file):
        log("Performance file not found.")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    history = data.get('history', [])
    
    # 1. Identify PENDING trades or trades from last 5 days
    today = datetime.now()
    pending_records = [r for r in history if r['result'] == 'PENDING']
    pending_tickers = list(set([r['ticker'] for r in pending_records]))

    if not pending_tickers:
        log("No pending trades to update.")
    else:
        log(f"Updating {len(pending_tickers)} pending tickers...")
        # Bulk download current prices
        try:
            # Get latest 2 days of data to ensure we have a valid close
            prices_df = yf.download(pending_tickers, period="2d", interval="1d", group_by='ticker', threads=True, progress=False)
            
            for record in pending_records:
                ticker = record['ticker']
                try:
                    if len(pending_tickers) == 1:
                        ticker_data = prices_df
                    else:
                        ticker_data = prices_df[ticker]
                    
                    if ticker_data.empty: continue
                    
                    current_price = float(ticker_data['Close'].iloc[-1])
                    if not current_price or math.isnan(current_price) or current_price <= 0: continue
                    
                    entry_price = float(record['entry'])
                    sl_pct = float(record.get('sl_pct', 5.26))
                    sl_price = entry_price * (1 - sl_pct / 100)
                    
                    # Update peak
                    peak_price = record.get('max_price', entry_price)
                    if current_price > peak_price:
                        record['max_price'] = round(current_price, 2)
                        record['peak_date'] = today.strftime('%Y-%m-%d')
                    
                    # Calculate return
                    current_ret = ((current_price - entry_price) / entry_price) * 100
                    record['return_pct'] = round(current_ret, 2)
                    
                    # Check Exit Conditions
                    # 1. Stop Loss
                    if current_price <= sl_price:
                        record['result'] = 'LOSS'
                        record['return_pct'] = round(-sl_pct, 2)
                        record['exit_date'] = today.strftime('%Y-%m-%d')
                    # 2. Profit Target (5% simple rule or you can use your specific logic)
                    elif current_ret >= 5.0:
                        record['result'] = 'WIN'
                        record['exit_date'] = today.strftime('%Y-%m-%d')
                    # 3. Time Limit (30 days)
                    else:
                        entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
                        days_held = (today - entry_date).days
                        record['days'] = days_held
                        if days_held >= 30:
                            record['result'] = 'WIN' if current_ret > 0 else 'LOSS'
                            record['exit_date'] = today.strftime('%Y-%m-%d')

                except Exception as e:
                    log(f"Error updating {ticker}: {str(e)}")
        except Exception as e:
            log(f"Bulk download failed: {str(e)}")

    # 2. Add NEW picks if any (with 5-day rule)
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            picks_data = json.load(f)
            json_date = picks_data.get('date', '')
            new_picks = picks_data.get('picks', [])
            
            if json_date:
                # 5-Day Rule check
                json_date_dt = datetime.strptime(json_date, '%Y-%m-%d')
                lookback = json_date_dt - timedelta(days=5)
                
                recent_tickers = [r['ticker'] for r in history if datetime.strptime(r['date'], '%Y-%m-%d') >= lookback]
                
                for p in new_picks:
                    ticker = p['ticker']
                    if ticker not in recent_tickers:
                        # Add as new PENDING trade
                        entry = p.get('current_price', 0)
                        if entry <= 0: continue

                        sl_high = p.get('tracker_logic', {}).get('stop_loss_high', entry * 0.9474)
                        sl_val = round(((entry - sl_high) / entry) * 100, 2) if entry > 0 else 5.26

                        # Get company/sector/subsector — fetch from yfinance if missing
                        company   = p.get('company', '') or ''
                        sector    = p.get('sector', '')   or ''
                        subsector = p.get('subsector', '') or ''
                        if not company or company == ticker or not subsector or subsector in ('N/A', 'Unknown'):
                            try:
                                meta = fetch_ticker_meta(ticker)
                                if not company or company == ticker:
                                    company = meta.get('company', ticker)
                                if not sector:
                                    sector = meta.get('sector', '')
                                if not subsector or subsector in ('N/A', 'Unknown'):
                                    subsector = meta.get('subsector', '')
                                time.sleep(0.2)
                            except Exception:
                                pass

                        history.insert(0, {
                            'date': json_date,
                            'ticker': ticker,
                            'company': company or ticker,
                            'sector': sector or 'Unknown',
                            'subsector': subsector or '',
                            'entry': round(entry, 2),
                            'max_price': round(entry, 2),
                            'sl_pct': abs(sl_val),
                            'return_pct': 0.0,
                            'days': 0,
                            'result': 'PENDING',
                            'peak_date': json_date
                        })
                        recent_tickers.append(ticker)

    # 3. Fix encoding in all string fields
    for entry in history:
        for field in ('company', 'sector', 'subsector'):
            if entry.get(field):
                entry[field] = fix_encoding(entry[field])

    # 4. Update Stats
    all_completed = [r for r in history if r['result'] != 'PENDING']
    wins = [r for r in all_completed if r['result'] == 'WIN']

    data['stats']['total_picks'] = len(history)
    data['stats']['completed_count'] = len(all_completed)
    data['stats']['pending_count'] = len(history) - len(all_completed)
    data['stats']['win_rate'] = round((len(wins) / len(all_completed) * 100), 1) if all_completed else 0
    valid_rets = [r['return_pct'] for r in history if r.get('return_pct') is not None and not (isinstance(r['return_pct'], float) and math.isnan(r['return_pct']))]
    data['stats']['avg_return_pct'] = round(sum(valid_rets) / len(valid_rets), 2) if valid_rets else 0
    data['stats']['last_updated'] = today.strftime('%Y-%m-%dT%H:%M:%S')

    data['history'] = history

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    log("Performance update cycle completed.")

if __name__ == "__main__":
    update_performance()
