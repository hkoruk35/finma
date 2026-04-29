import json
from collections import Counter
from datetime import datetime, timedelta

def audit_performance():
    with open('frontend/public/swing_performance.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    history = data.get('history', [])
    
    # 1. Filter for 2026
    history_2026 = [r for r in history if r['date'].startswith('2026')]
    
    print(f"Total entries in 2026: {len(history_2026)}")
    
    # 2. Count per day
    daily_counts = Counter(r['date'] for r in history_2026)
    
    print("\n--- Daily Counts (target is 5 per day) ---")
    inconsistent_days = {d: c for d, c in daily_counts.items() if c != 5}
    if inconsistent_days:
        for d in sorted(inconsistent_days.keys(), reverse=True):
            print(f"{d}: {inconsistent_days[d]} items")
    else:
        print("All days have exactly 5 items.")

    # 3. Check for duplicates (same ticker on same day)
    print("\n--- Duplicates (same ticker on same day) ---")
    dup_checks = Counter((r['date'], r['ticker']) for r in history_2026)
    dups = {k: v for k, v in dup_checks.items() if v > 1}
    if dups:
        for (d, t), c in dups.items():
            print(f"DUPLICATE: {t} on {d} ({c} times)")
    else:
        print("No duplicates found on any single day.")

    # 4. Check for ticker repetition in short windows (e.g. 3 days)
    # This might be normal but good to know
    print("\n--- Frequent Appearances (same ticker within 3 days) ---")
    sorted_hist = sorted(history_2026, key=lambda x: x['date'])
    for i in range(len(sorted_hist)):
        current = sorted_hist[i]
        for j in range(i + 1, min(i + 15, len(sorted_hist))): # check next 15 items (~3 days)
            future = sorted_hist[j]
            if current['ticker'] == future['ticker'] and current['date'] != future['date']:
                d1 = datetime.strptime(current['date'], '%Y-%m-%d')
                d2 = datetime.strptime(future['date'], '%Y-%m-%d')
                if (d2 - d1).days <= 3:
                    print(f"REPETITION: {current['ticker']} appeared on {current['date']} and {future['date']} ({(d2-d1).days} days apart)")

    # 6. Check PnL calculation consistency
    print("\n--- PnL Calculation Check (return_pct vs prices) ---")
    inconsistent_pnl = []
    for r in history_2026:
        try:
            entry = r.get('entry', 0)
            max_p = r.get('max_price', 0)
            ret = r.get('return_pct', 0)
            if entry > 0:
                expected_ret = round(((max_p - entry) / entry) * 100, 2)
                if abs(ret - expected_ret) > 0.05: # Allow small rounding difference
                    inconsistent_pnl.append(f"{r['ticker']} on {r['date']}: Record={ret}%, Expected={expected_ret}%")
        except: pass
    
    if inconsistent_pnl:
        print(f"Found {len(inconsistent_pnl)} inconsistent PnL records.")
        for item in inconsistent_pnl[:20]: # show first 20
            print(item)
    else:
        print("All PnL calculations are consistent.")

    # 7. Check for missing dates (gaps)
    print("\n--- Missing Trading Days Check ---")
    start_date = datetime(2026, 1, 1)
    end_date = datetime.now()
    all_dates = set(daily_counts.keys())
    
    missing_days = []
    curr = start_date
    while curr <= end_date:
        # Check if it's a weekday (0-4)
        if curr.weekday() < 5:
            d_str = curr.strftime('%Y-%m-%d')
            if d_str not in all_dates:
                missing_days.append(d_str)
        curr += timedelta(days=1)
    
    if missing_days:
        print(f"Found {len(missing_days)} missing weekdays in the history.")
        print(f"Missing: {', '.join(missing_days[:15])}...")
    else:
        print("No missing weekdays found in the history.")

if __name__ == "__main__":
    audit_performance()
