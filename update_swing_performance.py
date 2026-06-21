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

    # ── Metadata Backfill: subsector/sector boş olan kayıtları doldur ──────────
    meta_missing = [r for r in history if not r.get('subsector') or not r.get('sector') or r.get('sector') == 'Unknown']
    if meta_missing:
        log(f"Backfilling metadata for {len(meta_missing)} records with missing sector/subsector...")
        for record in meta_missing:
            ticker = record['ticker']
            try:
                meta = fetch_ticker_meta(ticker)
                if not record.get('subsector') and meta.get('subsector'):
                    record['subsector'] = meta['subsector']
                if (not record.get('sector') or record['sector'] == 'Unknown') and meta.get('sector'):
                    record['sector'] = meta['sector']
                if (not record.get('company') or record['company'] == ticker) and meta.get('company'):
                    record['company'] = meta['company']
                time.sleep(0.2)
            except Exception as e:
                log(f"Metadata backfill error for {ticker}: {e}")

    if not pending_tickers:
        log("No pending trades to update.")
    else:
        log(f"Updating {len(pending_tickers)} pending tickers...")
        # Bulk download current prices
        try:
            # Get latest 150 days of data to calculate EMA50 reliably
            prices_df = yf.download(pending_tickers, period="150d", interval="1d", group_by='ticker', threads=True, progress=False)
            
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
                    
                    # Update peak — ensure numeric
                    raw_peak = record.get('max_price')
                    peak_price = float(raw_peak) if raw_peak is not None and not math.isnan(float(raw_peak)) else entry_price
                    if current_price > peak_price:
                        peak_price = current_price
                        record['max_price'] = round(current_price, 2)
                        record['peak_date'] = today.strftime('%Y-%m-%d')
                    
                    # Calculate return
                    current_ret = ((current_price - entry_price) / entry_price) * 100
                    record['return_pct'] = round(current_ret, 2)
                    
                    # Check Exit Conditions using bot's own recorded targets
                    entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
                    days_held = (today - entry_date).days
                    record['days'] = days_held

                    profit_target = record.get('profit_target')
                    max_hold_days = record.get('max_hold_days', 5)

                    # 1. BOGA AI - Stop Loss based strictly on 1D EMA50 (no LOSS triggered above 1D EMA50)
                    ema_series = ticker_data['Close'].ewm(span=50, adjust=False).mean()
                    ema50_1d = float(ema_series.iloc[-1])
                    record['ema50_1d'] = round(ema50_1d, 2)

                    target_sl = ema50_1d
                    record['active_sl_level'] = round(target_sl, 2)

                    # Calculate loss at EMA50 level
                    potential_loss_pct = round(((target_sl - entry_price) / entry_price) * 100, 2)

                    # Only trigger LOSS if price is below EMA50 AND loss is significant (>= 5%)
                    # 1D EMA50 stop loss: need meaningful loss before marking as LOSS
                    min_loss_threshold = -5.0
                    if current_price <= target_sl and potential_loss_pct <= min_loss_threshold:
                        hdsl_status = "LOSS"
                    else:
                        hdsl_status = "PENDING"

                    if hdsl_status == "LOSS":
                        record['result'] = 'LOSS'
                        record['return_pct'] = potential_loss_pct
                        record['exit_date'] = today.strftime('%Y-%m-%d')
                    # 2. Profit Target — bot's recorded profit_zone.low
                    elif profit_target and current_price >= float(profit_target):
                        record['result'] = 'WIN'
                        record['exit_date'] = today.strftime('%Y-%m-%d')
                    # 3. Time Limit — 30 Days Auto-Close at Peak (peak_price guaranteed numeric above)
                    elif days_held >= 30:
                        peak_pct = round(((peak_price - entry_price) / entry_price) * 100, 2)
                        # Only LOSS if loss is significant (>= 5%), otherwise WIN (neutral/small loss = breakeven)
                        record['result'] = 'WIN' if peak_pct > -5.0 else 'LOSS'
                        record['return_pct'] = peak_pct
                        record['max_price'] = round(peak_price, 2)
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

                        tracker = p.get('tracker_logic', {})
                        sl_high = tracker.get('stop_loss_high', entry * 0.9474)
                        sl_val = round(((entry - sl_high) / entry) * 100, 2) if entry > 0 else 5.26

                        # Bot's own profit target and hold limit
                        profit_zone = p.get('profit_zone', {})
                        profit_target = profit_zone.get('low') or tracker.get('profit_target_tp1')
                        max_hold_days = tracker.get('max_hold_days', 5)

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
                            'stop_loss_high': round(float(sl_high), 2) if sl_high else None,
                            'profit_target': round(float(profit_target), 2) if profit_target else None,
                            'max_hold_days': int(max_hold_days),
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
    above_5 = [r for r in all_completed if (r.get('return_pct') or 0) >= 5]
    above_10 = [r for r in all_completed if (r.get('return_pct') or 0) >= 10]

    data['stats']['total_picks'] = len(history)
    data['stats']['completed_count'] = len(all_completed)
    data['stats']['pending_count'] = len(history) - len(all_completed)
    data['stats']['win_rate'] = round((len(wins) / len(all_completed) * 100), 1) if all_completed else 0
    
    completed_rets = [r['return_pct'] for r in all_completed if r.get('return_pct') is not None and not (isinstance(r['return_pct'], float) and math.isnan(r['return_pct']))]
    data['stats']['avg_return_pct'] = round(sum(completed_rets) / len(completed_rets), 2) if completed_rets else 0
    data['stats']['above_5pct_rate'] = round((len(above_5) / len(all_completed) * 100), 1) if all_completed else 0
    data['stats']['above_10pct_rate'] = round((len(above_10) / len(all_completed) * 100), 1) if all_completed else 0
    data['stats']['last_updated'] = today.strftime('%Y-%m-%dT%H:%M:%S')

    data['history'] = history

    def clean_nan(obj):
        if isinstance(obj, float) and math.isnan(obj):
            return None
        elif isinstance(obj, dict):
            return {k: clean_nan(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_nan(v) for v in obj]
        return obj

    data = clean_nan(data)

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    log("Performance update cycle completed.")

if __name__ == "__main__":
    update_performance()
