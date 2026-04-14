import json
import os
from datetime import datetime

def update_manual_picks():
    path = 'frontend/public/swing_performance.json'
    if not os.path.exists(path):
        print("File not found.")
        return

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # New picks from screenshot (2026-04-14)
    new_picks = [
        {"date": "2026-04-14", "ticker": "CGON", "company": "CGON", "sector": "Energy", "entry": 64.82, "max_price": 68.64, "return_pct": 5.89, "days": 0, "result": "WIN"},
        {"date": "2026-04-14", "ticker": "LXU", "company": "LXU", "sector": "Basic Materials", "entry": 14.75, "max_price": 14.77, "return_pct": 0.14, "days": 0, "result": "PENDING"},
        {"date": "2026-04-14", "ticker": "ADEA", "company": "ADEA", "sector": "Technology", "entry": 23.10, "max_price": 23.46, "return_pct": 1.56, "days": 0, "result": "WIN"},
        {"date": "2026-04-14", "ticker": "PBR", "company": "Petroleo Brasileiro S.A.", "sector": "Energy", "entry": 18.57, "max_price": 19.51, "return_pct": 5.06, "days": 0, "result": "WIN"},
        {"date": "2026-04-14", "ticker": "STGW", "company": "Stagwell Inc.", "sector": "Technology", "entry": 5.95, "max_price": 6.07, "return_pct": 2.02, "days": 0, "result": "WIN"},
        {"date": "2026-04-14", "ticker": "BP", "company": "BP p.l.c.", "sector": "Energy", "entry": 42.67, "max_price": 43.85, "return_pct": 2.77, "days": 0, "result": "WIN"},
        {"date": "2026-04-14", "ticker": "DNTH", "company": "Dianthus Therapeutics", "sector": "Healthcare", "entry": 78.89, "max_price": 78.90, "return_pct": 0.01, "days": 0, "result": "PENDING"},
        {"date": "2026-04-14", "ticker": "UNFI", "company": "United Natural Foods", "sector": "Consumer Defensive", "entry": 41.69, "max_price": 41.69, "return_pct": -3.65, "days": 0, "result": "LOSS"}
    ]

    # Prepend new picks (avoid duplicates by ticker on same date)
    existing_today = {p['ticker'] for p in data['history'] if p['date'] == '2026-04-14'}
    for np in reversed(new_picks):
        if np['ticker'] not in existing_today:
            data['history'].insert(0, np)

    # Sort history
    data['history'].sort(key=lambda x: (x['date'], x['ticker']), reverse=True)

    # Update stats
    total = len(data['history'])
    wins = sum(1 for x in data['history'] if x.get('return_pct', 0) > 0)
    data['stats'] = {
        'total_picks': total,
        'win_rate': round((wins / total * 100), 1) if total > 0 else 0,
        'avg_return_pct': round(sum(x.get('return_pct', 0) for x in data['history']) / total, 1) if total > 0 else 0,
        'period_days': 180,
        'above_5pct_rate': round(sum(1 for x in data['history'] if x.get('return_pct', 0) >= 5) / total * 100, 1) if total > 0 else 0,
        'above_10pct_rate': round(sum(1 for x in data['history'] if x.get('return_pct', 0) >= 10) / total * 100, 1) if total > 0 else 0
    }
    
    # Update generation time (NY time)
    data['generated_at'] = "2026-04-14T15:22:30" 

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Success. History count: {len(data['history'])}")

if __name__ == "__main__":
    update_manual_picks()
