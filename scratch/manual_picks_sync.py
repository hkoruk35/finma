import json
import os

def update_manual_picks_json():
    path = 'frontend/public/swing_picks.json'
    if not os.path.exists(path):
        return

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Simplified mock structures for the tracking feed
    new_picks = [
        {"ticker": "CGON", "company": "CGON", "sector": "Energy", "score": 35.1, "current_price": 68.64, "buy_zone": {"low": 64.0, "high": 65.0}, "profit_zone": {"low": 72.0, "high": 75.0}, "stop_zone": {"low": 60.0, "high": 61.0}, "change_1d": 5.89},
        {"ticker": "LXU", "company": "LXU", "sector": "Basic Materials", "score": 33.5, "current_price": 14.77, "buy_zone": {"low": 14.0, "high": 14.8}, "profit_zone": {"low": 16.5, "high": 17.0}, "stop_zone": {"low": 13.5, "high": 13.8}, "change_1d": 0.14},
        {"ticker": "ADEA", "company": "ADEA", "sector": "Technology", "score": 32.5, "current_price": 23.46, "buy_zone": {"low": 22.5, "high": 23.2}, "profit_zone": {"low": 26.0, "high": 27.0}, "stop_zone": {"low": 21.5, "high": 22.0}, "change_1d": 1.56},
        {"ticker": "PBR", "company": "PBR", "sector": "Energy", "score": 30.4, "current_price": 19.51, "buy_zone": {"low": 18.0, "high": 18.8}, "profit_zone": {"low": 21.5, "high": 22.5}, "stop_zone": {"low": 17.0, "high": 17.5}, "change_1d": 5.06},
        {"ticker": "STGW", "company": "STGW", "sector": "Technology", "score": 30.0, "current_price": 6.07, "buy_zone": {"low": 5.8, "high": 6.0}, "profit_zone": {"low": 6.8, "high": 7.2}, "stop_zone": {"low": 5.4, "high": 5.6}, "change_1d": 2.02},
        {"ticker": "BP", "company": "BP", "sector": "Energy", "score": 29.6, "current_price": 43.85, "buy_zone": {"low": 42.0, "high": 42.8}, "profit_zone": {"low": 47.0, "high": 48.5}, "stop_zone": {"low": 40.0, "high": 41.0}, "change_1d": 2.77},
        {"ticker": "DNTH", "company": "DNTH", "sector": "Healthcare", "score": 29.3, "current_price": 78.90, "buy_zone": {"low": 77.5, "high": 79.0}, "profit_zone": {"low": 85.0, "high": 88.0}, "stop_zone": {"low": 75.0, "high": 76.0}, "change_1d": 0.01},
        {"ticker": "UNFI", "company": "UNFI", "sector": "Consumer Defensive", "score": 27.8, "current_price": 40.17, "buy_zone": {"low": 41.0, "high": 42.0}, "profit_zone": {"low": 45.0, "high": 47.0}, "stop_zone": {"low": 39.0, "high": 40.0}, "change_1d": -3.65}
    ]

    # Prepend to picks
    existing_tickers = {p['ticker'] for p in data['picks']}
    for np in reversed(new_picks):
        if np['ticker'] not in existing_tickers:
            # Add missing fields to avoid breaking UI
            np.update({
                "rank": 0, "company": np['company'], "score": np['score'], "boga_score": np['score'],
                "ai_summary": {"homepage_summary": {"en": "Manual sync", "tr": "Manuel senkronize"}}
            })
            data['picks'].insert(0, np)

    data['generated_at'] = "2026-04-14T15:22:30"
    data['date'] = "2026-04-14"

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Picks updated.")

if __name__ == "__main__":
    update_manual_picks_json()
