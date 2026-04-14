import json
import os

def cleanup_and_sync():
    perf_path = 'frontend/public/swing_performance.json'
    picks_path = 'frontend/public/swing_picks.json'
    
    # 1. Official Data from User
    # Afternoon (Latest)
    afternoon = [
        {"ticker": "GSAT", "entry": 77.49, "target": 88.59, "stop": 73.05, "score": 81.3, "sector": "Communication Services"},
        {"ticker": "SGI", "entry": 81.71, "target": 89.18, "stop": 78.72, "score": 73.5, "sector": "Consumer Cyclical"},
        {"ticker": "BBIO", "entry": 77.63, "target": 78.52, "stop": 77.34, "score": 63.5, "sector": "Healthcare"},
        {"ticker": "SNDK", "entry": 907.58, "target": 955.35, "stop": 895.77, "score": 53.4, "sector": "Technology"},
        {"ticker": "CROX", "entry": 100.01, "target": 104.97, "stop": 99.61, "score": 52.6, "sector": "Consumer Cyclical"},
        {"ticker": "SQM", "entry": 88.02, "target": 92.97, "stop": 87.06, "score": 51.5, "sector": "Basic Materials"},
        {"ticker": "AVT", "entry": 72.49, "target": 73.19, "stop": 72.28, "score": 50.5, "sector": "Technology"},
        {"ticker": "MOD", "entry": 246.19, "target": 254.98, "stop": 240.47, "score": 46.6, "sector": "Consumer Cyclical"},
        {"ticker": "FUTU", "entry": 159.33, "target": 162.41, "stop": 155.02, "score": 43.8, "sector": "Financial Services"},
        {"ticker": "INTC", "entry": 62.22, "target": 62.61, "stop": 61.91, "score": 40.8, "sector": "Technology"}
    ]
    
    # Morning
    morning = [
        {"ticker": "CRH", "entry": 116.29, "target": 118.59, "stop": 115.91, "score": 58.0, "sector": "Basic Materials"},
        {"ticker": "FORM", "entry": 124.63, "target": 133.90, "stop": 120.92, "score": 57.3, "sector": "Technology"},
        {"ticker": "ORKA", "entry": 61.04, "target": 62.48, "stop": 60.69, "score": 55.8, "sector": "Healthcare"},
        {"ticker": "RY", "entry": 172.23, "target": 175.82, "stop": 170.80, "score": 55.6, "sector": "Financial Services"},
        {"ticker": "LEVI", "entry": 21.87, "target": 23.01, "stop": 21.68, "score": 53.9, "sector": "Consumer Cyclical"},
        {"ticker": "CRUS", "entry": 159.48, "target": 160.88, "stop": 158.92, "score": 53.2, "sector": "Technology"}
    ]
    
    # Combined with Afternoon priority
    all_picks = {p['ticker']: p for p in morning}
    for p in afternoon:
        all_picks[p['ticker']] = p
    
    # 1. Update Performance History
    with open(perf_path, 'r', encoding='utf-8') as f:
        perf_data = json.load(f)
    
    new_history = [p for p in perf_data['history'] if p['date'] != '2026-04-14']
    for ticker, p in sorted(all_picks.items(), reverse=True):
        new_history.insert(0, {
            "date": "2026-04-14",
            "ticker": ticker,
            "company": ticker,
            "sector": p['sector'],
            "entry": p['entry'],
            "max_price": p['entry'],
            "return_pct": 0.0,
            "days": 0,
            "result": "PENDING"
        })
    
    perf_data['history'] = new_history
    perf_data['generated_at'] = "2026-04-14T15:36:00"
    
    with open(perf_path, 'w', encoding='utf-8') as f:
        json.dump(perf_data, f, indent=2, ensure_ascii=False)

    # 2. Update Swing Picks (Active)
    # We'll use the 10 Afternoon picks as the active ones
    with open(picks_path, 'r', encoding='utf-8') as f:
        picks_data = json.load(f)
    
    active_picks = []
    for i, p in enumerate(afternoon):
        active_picks.append({
            "ticker": p['ticker'],
            "rank": i + 1,
            "company": p['ticker'],
            "sector": p['sector'],
            "score": p['score'],
            "boga_score": p['score'],
            "current_price": p['entry'],
            "buy_zone": {"low": p['entry'] - 0.2, "high": p['entry'] + 0.2},
            "profit_zone": {"low": p['target'] - 0.1, "high": p['target']},
            "stop_zone": {"low": p['stop'], "high": p['stop'] + 0.1},
            "holding_period": "5-10 Days",
            "reasoning": "Official BOGA AI Afternoon Setup.",
            "ai_summary": {
                "homepage_summary": {"en": "Active high-conviction swing pick.", "tr": "Aktif yüksek güvenli swing fırsatı."}
            }
        })
    
    picks_data['picks'] = active_picks
    picks_data['date'] = "2026-04-14"
    picks_data['generated_at'] = "2026-04-14T15:36:00"
    
    with open(picks_path, 'w', encoding='utf-8') as f:
        json.dump(picks_data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    cleanup_and_sync()
