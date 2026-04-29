import csv, json

rows = []
with open('2026-04-12T12-48_export.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for r in reader:
        try:
            profit = float(r['Profit %']) if r['Profit %'].strip() else 0
            pnl = float(r['PnL ($1k)']) if r['PnL ($1k)'].strip() else 0
            wait = int(r['Wait']) if r['Wait'].strip() else 0
            rows.append({'date': r['List Date'], 'ticker': r['Symbol'], 'company': r['Company'], 'profit_pct': profit, 'pnl_1k': pnl, 'wait': wait, 'sector': r['Sector']})
        except Exception as e:
            continue


total = len(rows)
winners = [r for r in rows if r['profit_pct'] > 0]
losers = [r for r in rows if r['profit_pct'] < 0]
neutral = [r for r in rows if r['profit_pct'] == 0]
win_rate = len(winners) / total * 100 if total else 0
avg_win = sum(r['profit_pct'] for r in winners) / len(winners) if winners else 0
avg_loss = sum(r['profit_pct'] for r in losers) / len(losers) if losers else 0
avg_return = sum(r['profit_pct'] for r in rows) / total if total else 0
best = max(rows, key=lambda x: x['profit_pct'])
worst = min(rows, key=lambda x: x['profit_pct'])
avg_hold = sum(r['wait'] for r in rows) / total if total else 0
total_pnl = sum(r['pnl_1k'] for r in rows)
above_5pct = [r for r in rows if r['profit_pct'] >= 5]
above_10pct = [r for r in rows if r['profit_pct'] >= 10]

# Sector breakdown
sectors = {}
for r in rows:
    s = r['sector']
    if s not in sectors:
        sectors[s] = {'count': 0, 'wins': 0, 'total_pct': 0}
    sectors[s]['count'] += 1
    sectors[s]['total_pct'] += r['profit_pct']
    if r['profit_pct'] > 0:
        sectors[s]['wins'] += 1

sector_stats = {
    k: {
        'count': v['count'],
        'win_rate': round(v['wins'] / v['count'] * 100, 0),
        'avg_pct': round(v['total_pct'] / v['count'], 1)
    }
    for k, v in sectors.items()
}

result = {
    'total_picks': total,
    'winners': len(winners),
    'losers': len(losers),
    'neutral': len(neutral),
    'win_rate': round(win_rate, 1),
    'avg_win_pct': round(avg_win, 2),
    'avg_loss_pct': round(avg_loss, 2),
    'avg_return_pct': round(avg_return, 2),
    'best_pick': {'ticker': best['ticker'], 'pct': best['profit_pct'], 'date': best['date']},
    'worst_pick': {'ticker': worst['ticker'], 'pct': worst['profit_pct'], 'date': worst['date']},
    'avg_hold_days': round(avg_hold, 1),
    'total_pnl_per_1k': round(total_pnl, 0),
    'above_5pct_count': len(above_5pct),
    'above_10pct_count': len(above_10pct),
    'above_5pct_rate': round(len(above_5pct)/total*100, 1) if total else 0,
    'above_10pct_rate': round(len(above_10pct)/total*100, 1) if total else 0,
    'sectors': sector_stats
}

print(json.dumps(result, indent=2))
