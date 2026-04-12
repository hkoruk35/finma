import json

with open('frontend/public/swing_performance.json', 'r') as f:
    data = json.load(f)

history = data.get('history', [])
print(f"Total entries: {len(history)}")

# Check for duplicates (same ticker same date)
seen = {}
duplicates = []
for entry in history:
    key = (entry['date'], entry['ticker'])
    if key in seen:
        duplicates.append(entry)
    seen[key] = entry

print(f"Duplicates found: {len(duplicates)}")
if duplicates:
    for d in duplicates[:5]:
        print(f"Duplicate: {d['date']} {d['ticker']}")

# Check for zero/negative returns marked as WIN
weird_results = [e for e in history if e['return_pct'] <= 0 and e['result'] == 'WIN']
print(f"Weird results (<=0 return but WIN): {len(weird_results)}")

# Check for "Unknown" sectors
unknown_sectors = [e for e in history if e['sector'] == 'Unknown']
print(f"Unknown sectors: {len(unknown_sectors)}")
if unknown_sectors:
    print("Tickers with Unknown sectors:", set([u['ticker'] for u in unknown_sectors]))
