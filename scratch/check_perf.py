# -*- coding: utf-8 -*-
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'frontend\public\swing_performance.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
history = data.get('history', [])

print('=== FIELD KEYS ===')
if history:
    print(list(history[0].keys()))

print('\n=== SAMPLE ENTRIES (first 5) ===')
for h in history[:5]:
    print(f"  ticker={h.get('ticker')} company={repr(h.get('company','MISSING'))} sector={h.get('sector')} subsector={repr(h.get('subsector','MISSING'))}")

missing_company = sum(1 for h in history if not h.get('company'))
missing_subsector = sum(1 for h in history if not h.get('subsector') or h.get('subsector') == 'N/A')
print(f'\nMissing company: {missing_company}/{len(history)}')
print(f'Missing/NA subsector: {missing_subsector}/{len(history)}')

# Show unique subsectors
unique_sub = sorted(set(h.get('subsector','') for h in history))
print(f'\nUnique subsectors ({len(unique_sub)}): {unique_sub[:20]}')
