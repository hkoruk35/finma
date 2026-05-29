"""
Fixes sl_pct mismatch and re-evaluates LOSS records using historical prices.

For records with stop_loss_high: sl_pct = (entry - stop_loss_high) / entry * 100
For LOSS records that may have been wrongly closed: re-check with actual OHLCV data.
"""
import json, math, sys, time
import yfinance as yf
from datetime import datetime, timedelta

sys.stdout.reconfigure(encoding='utf-8')

PERFORMANCE_FILE = 'frontend/public/swing_performance.json'

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def main():
    with open(PERFORMANCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    history = data['history']

    # --- Step 1: Fix sl_pct for all records with stop_loss_high ---
    sl_fixed = 0
    for record in history:
        sl_high = record.get('stop_loss_high')
        entry = record.get('entry', 0)
        if sl_high and entry > 0:
            correct_sl_pct = round((entry - float(sl_high)) / entry * 100, 2)
            stored = record.get('sl_pct', 0)
            if abs(correct_sl_pct - (stored or 0)) > 0.01:
                record['sl_pct'] = correct_sl_pct
                sl_fixed += 1

    log(f"sl_pct fixed for {sl_fixed} records")

    # --- Step 2: Re-evaluate COMPLETED records that had wrong sl_pct ---
    # Only re-evaluate LOSS/WIN records with stop_loss_high (Apr-May 2026)
    # We check them with real historical OHLCV data
    to_reevaluate = [
        r for r in history
        if r['result'] in ('LOSS', 'WIN')
        and r.get('stop_loss_high')
        and r.get('profit_target')
        and r.get('exit_date')
        and r['date'] >= '2026-04-01'
    ]
    log(f"Records to re-evaluate: {len(to_reevaluate)}")

    if not to_reevaluate:
        log("Nothing to re-evaluate.")
    else:
        # Group by ticker to minimize API calls
        tickers = list(set(r['ticker'] for r in to_reevaluate))
        log(f"Fetching history for {len(tickers)} tickers...")

        # Download daily OHLCV from 2026-04-24 to today
        try:
            prices = yf.download(
                tickers, start='2026-04-24', end=(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
                interval='1d', group_by='ticker', threads=True, progress=False, auto_adjust=True
            )
        except Exception as e:
            log(f"Download failed: {e}")
            return

        reevaluated = 0
        for record in to_reevaluate:
            ticker = record['ticker']
            entry_price = float(record['entry'])
            sl_price = float(record['stop_loss_high'])
            profit_target = float(record['profit_target'])
            max_hold = int(record.get('max_hold_days', 5))
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            # Look at price bars from entry_date to entry_date + max_hold + 2 buffer
            end_date = entry_date + timedelta(days=max_hold + 3)

            try:
                if len(tickers) == 1:
                    ticker_df = prices
                else:
                    ticker_df = prices[ticker] if ticker in prices.columns.get_level_values(0) else None

                if ticker_df is None or ticker_df.empty:
                    continue

                # Filter to the trade window
                mask = (ticker_df.index >= entry_date.strftime('%Y-%m-%d')) & \
                       (ticker_df.index <= end_date.strftime('%Y-%m-%d'))
                window = ticker_df[mask]
                if window.empty:
                    continue

                # Walk through bars in order to determine outcome
                new_result = None
                new_exit_date = None
                new_return_pct = None

                for bar_date, row in window.iterrows():
                    try:
                        bar_low = float(row['Low'])
                        bar_high = float(row['High'])
                        bar_close = float(row['Close'])
                        days_held = (bar_date.to_pydatetime() - entry_date).days
                    except Exception:
                        continue

                    # SL check (low of bar)
                    if bar_low <= sl_price:
                        new_result = 'LOSS'
                        actual_return = round((sl_price - entry_price) / entry_price * 100, 2)
                        new_return_pct = actual_return
                        new_exit_date = bar_date.strftime('%Y-%m-%d')
                        break

                    # TP check (high of bar)
                    if bar_high >= profit_target:
                        new_result = 'WIN'
                        actual_return = round((profit_target - entry_price) / entry_price * 100, 2)
                        new_return_pct = actual_return
                        new_exit_date = bar_date.strftime('%Y-%m-%d')
                        break

                    # Time limit
                    if days_held >= max_hold:
                        ret = round((bar_close - entry_price) / entry_price * 100, 2)
                        new_result = 'WIN' if ret > 0 else 'LOSS'
                        new_return_pct = ret
                        new_exit_date = bar_date.strftime('%Y-%m-%d')
                        break

                if new_result and (new_result != record['result'] or abs((new_return_pct or 0) - (record.get('return_pct') or 0)) > 0.5):
                    log(f"  {record['date']} {ticker}: {record['result']}({record.get('return_pct')}%) → {new_result}({new_return_pct}%) exit={new_exit_date}")
                    record['result'] = new_result
                    record['return_pct'] = new_return_pct
                    record['exit_date'] = new_exit_date
                    reevaluated += 1

            except Exception as e:
                log(f"  Re-eval error {ticker}: {e}")

        log(f"Re-evaluated {reevaluated} records with updated results")

    # --- Step 3: Recalculate stats ---
    all_completed = [r for r in history if r['result'] != 'PENDING']
    wins = [r for r in all_completed if r['result'] == 'WIN']
    valid_rets = [r['return_pct'] for r in history
                  if r.get('return_pct') is not None
                  and not (isinstance(r['return_pct'], float) and math.isnan(r['return_pct']))]

    today_str = datetime.now().strftime('%Y-%m-%dT%H:%M:%S')
    data['stats']['total_picks'] = len(history)
    data['stats']['completed_count'] = len(all_completed)
    data['stats']['pending_count'] = len(history) - len(all_completed)
    data['stats']['win_rate'] = round(len(wins) / len(all_completed) * 100, 1) if all_completed else 0
    data['stats']['avg_return_pct'] = round(sum(valid_rets) / len(valid_rets), 2) if valid_rets else 0
    data['stats']['last_updated'] = today_str

    data['history'] = history
    with open(PERFORMANCE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    log(f"Done. WIN={len(wins)}, LOSS={len(all_completed)-len(wins)}, PENDING={len(history)-len(all_completed)}")
    log(f"Win rate: {data['stats']['win_rate']}%")

if __name__ == '__main__':
    main()
