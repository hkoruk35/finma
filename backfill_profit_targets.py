"""
Backfills profit_target and max_hold_days into swing_performance.json
by matching each record's (date, ticker) against historical swing JSON files.

profit_target = profit_zone['low']  (bot's conservative TP)
max_hold_days = tracker_logic['max_hold_days']  (usually 5)
"""
import json
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

PERFORMANCE_FILE = 'frontend/public/swing_performance.json'
SWING_DIR = 'frontend/public/data/swing2026'

def load_swing_lookup():
    """Returns dict: (date_str, ticker) -> {profit_target, max_hold_days}"""
    lookup = {}
    for fname in os.listdir(SWING_DIR):
        if not fname.startswith('swing_') or not fname.endswith('.json'):
            continue
        fpath = os.path.join(SWING_DIR, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            date_str = data.get('date', '')
            for pick in data.get('picks', []):
                ticker = pick.get('ticker', '')
                if not ticker or not date_str:
                    continue
                profit_zone = pick.get('profit_zone', {})
                tracker = pick.get('tracker_logic', {})
                profit_target = profit_zone.get('low') or tracker.get('profit_target_tp1')
                max_hold_days = tracker.get('max_hold_days', 5)
                # Also grab stop_loss_high to optionally verify
                stop_loss_high = tracker.get('stop_loss_high')
                lookup[(date_str, ticker)] = {
                    'profit_target': profit_target,
                    'max_hold_days': max_hold_days,
                    'stop_loss_high': stop_loss_high,
                }
        except Exception as e:
            print(f"Error reading {fname}: {e}")
    return lookup

def main():
    with open(PERFORMANCE_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    history = data.get('history', [])
    lookup = load_swing_lookup()

    filled = 0
    not_found = 0
    already_had = 0

    for record in history:
        if record.get('profit_target') and record.get('max_hold_days'):
            already_had += 1
            continue

        key = (record['date'], record['ticker'])
        if key in lookup:
            info = lookup[key]
            if info['profit_target']:
                record['profit_target'] = round(float(info['profit_target']), 2)
            record['max_hold_days'] = int(info['max_hold_days'])
            # Also update stop_loss_high if present (for accurate SL price tracking)
            if info['stop_loss_high'] and not record.get('stop_loss_high'):
                record['stop_loss_high'] = round(float(info['stop_loss_high']), 2)
            filled += 1
        else:
            # No matching swing file — use fallback: entry * 1.05 TP, 5 days
            entry = record.get('entry', 0)
            if entry and not record.get('profit_target'):
                record['profit_target'] = round(entry * 1.05, 2)
            if not record.get('max_hold_days'):
                record['max_hold_days'] = 5
            not_found += 1

    data['history'] = history

    with open(PERFORMANCE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Done. filled={filled}, not_found(fallback)={not_found}, already_had={already_had}")
    print(f"Total records: {len(history)}")

if __name__ == '__main__':
    main()
