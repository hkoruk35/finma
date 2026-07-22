import json
import os

candidate_pool_path = r"C:\Users\afksm\finma\frontend\public\data\candidate_pool.json"
watchlist_picks_path = r"C:\Users\afksm\finma\frontend\public\watchlist_picks.json"

watch_items = [
    {"ticker": "ETSY", "sector": "Consumer Cyclical", "score": 36.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "NTRA", "sector": "Healthcare", "score": 36.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "GPN", "sector": "Financial Services", "score": 36.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "LYV", "sector": "Communication Services", "score": 36.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "NET", "sector": "Technology", "score": 34.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "WCC", "sector": "Industrials", "score": 34.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "ZM", "sector": "Technology", "score": 33.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "BURL", "sector": "Consumer Cyclical", "score": 30.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"},
    {"ticker": "ATI", "sector": "Basic Materials", "score": 26.0, "first_seen_date": "2026-07-21", "last_checked": "2026-07-21"}
]

# Read candidate pool if exists
pool = {"swing_candidates": [], "watchlist_candidates": [], "updated_at": "2026-07-21T22:25:00-04:00"}
if os.path.exists(candidate_pool_path):
    with open(candidate_pool_path, "r", encoding="utf-8") as f:
        pool = json.load(f)

# Update watchlist candidates
pool["watchlist_candidates"] = watch_items

with open(candidate_pool_path, "w", encoding="utf-8") as f:
    json.dump(pool, f, indent=2, ensure_ascii=False)

# Write watchlist_picks.json
watchlist_picks = {
    "generated_at": "2026-07-21T22:25:00-04:00",
    "picks": [
        {
            "ticker": item["ticker"],
            "sector": item["sector"],
            "date_added": item["first_seen_date"],
            "score": item["score"]
        }
        for item in watch_items
    ]
}

with open(watchlist_picks_path, "w", encoding="utf-8") as f:
    json.dump(watchlist_picks, f, indent=2, ensure_ascii=False)

print(f"Successfully restored {len(watch_items)} watchlist items!")
