import json
import os
from datetime import datetime

def sync_performance():
    performance_file = 'frontend/public/swing_performance.json'
    picks_file = 'frontend/public/swing_picks.json'
    master_file = 'frontend/public/master.json'

    # 1. Load history
    if os.path.exists(performance_file):
        with open(performance_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            history = data.get('history', [])
    else:
        history = []
        data = {}

    # 2. Load latest prices
    prices_map = {}
    if os.path.exists(master_file):
        with open(master_file, 'r', encoding='utf-8') as f:
            master = json.load(f)
            for s in master.get('stocks', []):
                if s and 'ticker' in s and 'price' in s:
                    prices_map[s['ticker']] = s['price'].get('current', 0)

    today_str = datetime.now().strftime('%Y-%m-%d')
    today_date = datetime.strptime(today_str, '%Y-%m-%d')

    # 3. Update Existing Records (Evaluate Max Price up to 30 days)
    for record in history:
        try:
            entry_date = datetime.strptime(record['date'], '%Y-%m-%d')
            days_passed = (today_date - entry_date).days
            
            # We only evaluate actively for ~30 days
            if days_passed <= 30:
                ticker = record['ticker']
                current_price = prices_map.get(ticker, 0)
                
                if current_price > record.get('max_price', 0):
                    record['max_price'] = current_price
                    if record.get('entry', 0) > 0:
                        record['return_pct'] = round(((current_price - record['entry']) / record['entry']) * 100, 2)
                    record['days'] = days_passed
        except Exception as e:
            pass

    # 4. Process Today's Picks
    if os.path.exists(picks_file):
        with open(picks_file, 'r', encoding='utf-8') as f:
            picks_data = json.load(f)
            today_picks = picks_data.get('picks', [])

        for p in today_picks:
            ticker = p.get('ticker')
            # Check 5-day rule
            skip = False
            for record in reversed(history):
                # If we find this ticker in history
                if record['ticker'] == ticker:
                    try:
                        record_date = datetime.strptime(record['date'], '%Y-%m-%d')
                        if (today_date - record_date).days < 5:
                            skip = True  # Discard if within 5 days
                            break
                    except: pass
            
            if not skip:
                entry_p = p.get('current_price', prices_map.get(ticker, 0))
                if entry_p > 0:
                    history.append({
                        'date': today_str,
                        'ticker': ticker,
                        'company': p.get('company', ''),
                        'sector': p.get('sector', ''), # Bot might need to pass sector in picks
                        'entry': entry_p,
                        'max_price': entry_p,
                        'return_pct': 0.0,
                        'days': 0,
                        'result': 'WIN'
                    })

    # Auto generate stats structure even though UI calculates it
    total = len(history)
    wins = sum(1 for x in history if x.get('return_pct', 0) > 0)
    
    data['history'] = history
    data['stats'] = {
        'win_rate': round((wins / total * 100), 1) if total > 0 else 0,
        'avg_return_pct': round(sum(x.get('return_pct', 0) for x in history) / total, 1) if total > 0 else 0,
        'total_picks': total,
        'period_days': 90,
        'above_5pct_rate': round(sum(1 for x in history if x.get('return_pct', 0) >= 5) / total * 100, 1) if total > 0 else 0
    }
    data['generated_at'] = datetime.now().isoformat()

    with open(performance_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

if __name__ == "__main__":
    sync_performance()
