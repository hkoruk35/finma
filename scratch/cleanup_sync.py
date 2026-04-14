import json
import os

def cleanup_and_sync():
    perf_path = 'frontend/public/swing_performance.json'
    picks_path = 'frontend/public/swing_picks.json'
    
    # 1. Update Performance History
    with open(perf_path, 'r', encoding='utf-8') as f:
        perf_data = json.load(f)
    
    # Valid Afternoon Picks
    afternoon = [
        {"ticker": "GSAT", "entry": 77.49, "max_price": 77.49, "sector": "Communication Services"},
        {"ticker": "SGI", "entry": 81.71, "max_price": 81.71, "sector": "Consumer Cyclical"},
        {"ticker": "BBIO", "entry": 77.63, "max_price": 77.63, "sector": "Healthcare"},
        {"ticker": "SNDK", "entry": 907.58, "max_price": 907.58, "sector": "Technology"},
        {"ticker": "CROX", "entry": 100.01, "max_price": 100.01, "sector": "Consumer Cyclical"},
        {"ticker": "SQM", "entry": 88.02, "max_price": 88.02, "sector": "Basic Materials"},
        {"ticker": "AVT", "entry": 72.49, "max_price": 72.49, "sector": "Technology"},
        {"ticker": "MOD", "entry": 246.19, "max_price": 246.19, "sector": "Consumer Cyclical"},
        {"ticker": "FUTU", "entry": 159.33, "max_price": 159.33, "sector": "Financial Services"},
        {"ticker": "INTC", "entry": 62.22, "max_price": 62.22, "sector": "Technology"}
    ]
    
    # Valid Morning Picks (only distinct ones)
    morning = [
        {"ticker": "CRH", "entry": 116.29, "max_price": 116.29, "sector": "Basic Materials"},
        {"ticker": "FORM", "entry": 124.63, "max_price": 124.63, "sector": "Technology"},
        {"ticker": "ORKA", "entry": 61.04, "max_price": 61.04, "sector": "Healthcare"},
        {"ticker": "RY", "entry": 172.23, "max_price": 172.23, "sector": "Financial Services"},
        {"ticker": "LEVI", "entry": 21.87, "max_price": 21.87, "sector": "Consumer Cyclical"},
        {"ticker": "CRUS", "entry": 159.48, "max_price": 159.48, "sector": "Technology"}
    ]
    
    # Combine
    valid_tickers = {p['ticker'] for p in afternoon} | {p['ticker'] for p in morning}
    all_valid_picks = afternoon + morning
    
    # Remove old 2026-04-14 entries and incorrect ones
    new_history = [p for p in perf_data['history'] if p['date'] != '2026-04-14']
    
    # Add new valid ones
    for p in all_valid_picks:
        new_history.insert(0, {
            "date": "2026-04-14",
            "ticker": p['ticker'],
            "company": p['ticker'],
            "sector": p['sector'],
            "entry": p['entry'],
            "max_price": p['max_price'],
            "return_pct": 0.0,
            "days": 0,
            "result": "PENDING"
        })
    
    perf_data['history'] = new_history
    perf_data['generated_at'] = "2026-04-14T15:36:00"
    
    with open(perf_path, 'w', encoding='utf-8') as f:
        json.dump(perf_data, f, indent=2, ensure_ascii=False)

    # 2. Update Swing Picks (Active)
    with open(picks_path, 'r', encoding='utf-8') as f:
        picks_data = json.load(f)
    
    # Keep only 10 afternoon picks as main active
    active_picks = []
    for p in afternoon:
        active_picks.append({
            "ticker": p['ticker'], "rank": len(active_picks)+1, "sector": p['sector'],
            "current_price": p['entry'], "buy_zone": {"low": p['entry']*0.98, "high": p['entry']*1.02},
            "score": 0, "boga_score": 0, "ai_summary": {"homepage_summary": {"en": "Active swing pick", "tr": "Aktif swing fırsatı"}}
        })
    
    picks_data['picks'] = active_picks
    picks_data['date'] = "2026-04-14"
    
    with open(picks_path, 'w', encoding='utf-8') as f:
        json.dump(picks_data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    cleanup_and_sync()
