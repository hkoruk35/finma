import json
outcomes = json.load(open('transfer/latest/options_outcomes.json', encoding='utf-8'))
open_pos = [p for p in outcomes['positions'] if p['status'] == 'open']
print(f'Open: {len(open_pos)}')
for p in open_pos[:10]:
    print(f"  {p['ticker']:6} {p['expiration']}  entry=${p['entry_premium']}  current=${p['current_premium']}  unrlzd={p['unrealized_pnl_pct']}")
