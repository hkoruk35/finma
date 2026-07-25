#!/usr/bin/env python3
import json
import os
import glob

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    performance_file = os.path.join(base_dir, 'frontend', 'public', 'swing_performance.json')
    data_dir = os.path.join(base_dir, 'frontend', 'public', 'data', 'swing2026')

    if not os.path.exists(performance_file):
        print(f"Performance file not found at {performance_file}")
        return

    with open(performance_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    history = data.get('history', [])
    
    # Track existing picks by (date, ticker) to avoid duplicates
    existing = set((r.get('date'), r.get('ticker')) for r in history)
    
    # Find all daily swing picks files starting from July 21st, 2026
    # Pattern: swing_YYYYMMDD.json
    daily_files = glob.glob(os.path.join(data_dir, 'swing_*.json'))
    daily_files.sort()
    
    added_count = 0
    
    for df in daily_files:
        filename = os.path.basename(df)
        # Check if the file is from July 21st onwards
        # swing_20260721.json -> 20260721
        date_part = filename.replace('swing_', '').replace('.json', '')
        if not date_part.isdigit() or len(date_part) != 8:
            continue
            
        if date_part < '20260721':
            continue
            
        # Parse the JSON
        try:
            with open(df, 'r', encoding='utf-8') as f:
                daily_data = json.load(f)
        except Exception as e:
            print(f"Error reading {df}: {e}")
            continue
            
        picks = daily_data.get('picks', [])
        iso_date = daily_data.get('date')
        if not iso_date:
            # Fallback if date is not in JSON root
            iso_date = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:8]}"
            
        for pick in picks:
            ticker = pick.get('ticker')
            if not ticker:
                continue
                
            if (iso_date, ticker) in existing:
                continue
                
            # Determine entry price
            entry = pick.get('current_price')
            if entry is None or entry <= 0:
                buy_zone = pick.get('buy_zone', {})
                entry = buy_zone.get('low')
                
            if entry is None or entry <= 0:
                continue
                
            # Create a new history record
            new_record = {
                "date": iso_date,
                "ticker": ticker,
                "company": pick.get('company', ticker),
                "sector": pick.get('sector', 'Unknown'),
                "subsector": pick.get('subsector', 'Unknown'),
                "entry": entry
            }
            
            history.append(new_record)
            existing.add((iso_date, ticker))
            added_count += 1
            print(f"Added {ticker} from {iso_date}")
            
    if added_count > 0:
        data['history'] = history
        with open(performance_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Successfully added {added_count} new trend candidates to performance history.")
    else:
        print("No new trend candidates to add.")

if __name__ == '__main__':
    main()
