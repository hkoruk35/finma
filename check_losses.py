import json

with open('frontend/public/swing_performance.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

history = data.get('history', [])
losses = [r for r in history if r['result'] == 'LOSS']
pending = [r for r in history if r['result'] == 'PENDING']

print(f"Total records: {len(history)}")
print(f"LOSS records: {len(losses)}")
print(f"PENDING records: {len(pending)}")
print()
print("--- LOSS RECORDS ---")
for r in losses:
    ticker = r['ticker']
    entry = r['entry']
    ret = r['return_pct']
    ema50 = r.get('ema50_1d', 'N/A')
    sl = r.get('active_sl_level', 'N/A')
    print(f"  {ticker} | entry={entry} | return={ret}% | ema50={ema50} | sl={sl}")
