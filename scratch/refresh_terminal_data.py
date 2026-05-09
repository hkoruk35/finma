import json
import os
from datetime import datetime

# Paths
BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_PUBLIC = os.path.join(BASE_DIR, "frontend", "public")
LATEST_DATA = os.path.join(FRONTEND_PUBLIC, "data", "latest")

SWING_ALL_PICKS = os.path.join(FRONTEND_PUBLIC, "swing_all_picks.json")
MASTER_JSON = os.path.join(LATEST_DATA, "master.json")
ALL_TICKERS_LIST = os.path.join(LATEST_DATA, "all_tickers_list.json")

def refresh_terminal():
    print(f"Refreshing terminal data from {SWING_ALL_PICKS}...")
    
    if not os.path.exists(SWING_ALL_PICKS):
        print(f"Error: {SWING_ALL_PICKS} not found!")
        return

    with open(SWING_ALL_PICKS, 'r', encoding='utf-8') as f:
        data = json.load(f)

    picks = data.get("picks", [])
    date_str = data.get("date", datetime.now().strftime("%Y-%m-%d"))
    generated_at = data.get("generated_at", datetime.now().isoformat())

    # 1. Generate all_tickers_list.json
    tickers_list = []
    for p in picks:
        tickers_list.append({
            "ticker": p["ticker"],
            "company": p["company"],
            "sector": p.get("sector", "General"),
            "master_score": p.get("score", 50),
            "score_type": "HIGH_CONVICTION" if p.get("score", 0) >= 75 else "POSITIVE_BIAS",
            "price": p.get("current_price", 0),
            "change_pct": p.get("change_1d", 0),
            "volume": p.get("volume", 0),
            "ai_short_summary": p.get("reasoning", "")
        })

    tickers_data = {
        "date": date_str,
        "tickers": tickers_list
    }

    with open(ALL_TICKERS_LIST, 'w', encoding='utf-8') as f:
        json.dump(tickers_data, f, indent=2)
    print(f"Updated {ALL_TICKERS_LIST}")

    # 2. Generate master.json
    # Extract menus from categories
    menus = {
        "top_scores": {"count": len(picks[:10]), "tickers": [p["ticker"] for p in picks[:10]]},
        "breakout": {"count": 0, "tickers": []},
        "value": {"count": 0, "tickers": []},
        "reversal": {"count": 0, "tickers": []},
        "momentum": {"count": 0, "tickers": []},
        "dividend": {"count": 0, "tickers": []}
    }

    for p in picks:
        cat = p.get("selected_system", "").lower()
        if cat in menus:
            menus[cat]["count"] += 1
            menus[cat]["tickers"].append(p["ticker"])

    master_data = {
        "date": date_str,
        "generated_at": generated_at,
        "total_tickers_scanned": 500,
        "active_scores_count": len(picks),
        "market_regime": data.get("market_regime", "NEUTRAL"),
        "menus": menus,
        "top_3_overall": [
            {"ticker": p["ticker"], "score": p["score"], "score_type": "HIGH_CONVICTION" if p["score"] >= 75 else "POSITIVE_BIAS"}
            for p in picks[:3]
        ],
        "market_indices": {
            "SP500": {"value": 5200, "change_pct": 0.5},
            "NASDAQ": {"value": 16000, "change_pct": 0.8},
            "DOW": {"value": 39000, "change_pct": 0.2},
            "VIX": {"value": 15.0, "change_pct": -2.0}
        }
    }

    with open(MASTER_JSON, 'w', encoding='utf-8') as f:
        json.dump(master_data, f, indent=2)
    print(f"Updated {MASTER_JSON}")

    # 3. Copy swing_all_picks.json and swing_picks.json to latest
    import shutil
    shutil.copy2(SWING_ALL_PICKS, os.path.join(LATEST_DATA, "swing_all_picks.json"))
    
    # Also copy swing_picks.json if it exists
    SWING_PICKS = os.path.join(FRONTEND_PUBLIC, "swing_picks.json")
    if os.path.exists(SWING_PICKS):
        shutil.copy2(SWING_PICKS, os.path.join(LATEST_DATA, "swing_picks.json"))
        print(f"Copied swing_picks.json to latest")

    # 4. Copy daytrade_all_picks.json to latest
    DAYTRADE_ALL_PICKS = os.path.join(FRONTEND_PUBLIC, "daytrade_all_picks.json")
    if os.path.exists(DAYTRADE_ALL_PICKS):
        shutil.copy2(DAYTRADE_ALL_PICKS, os.path.join(LATEST_DATA, "daytrade_all_picks.json"))
        print(f"Copied daytrade_all_picks.json to latest")

if __name__ == "__main__":
    refresh_terminal()
