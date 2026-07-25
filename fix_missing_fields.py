import json

def main():
    file_path = 'C:/Users/afksm/finma/frontend/public/swing_performance.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for r in data.get('history', []):
        if 'result' not in r:
            r['result'] = 'PENDING'
            r['return_pct'] = 0.0
            r['realized_return_pct'] = 0.0
            r['max_price'] = r.get('entry', 0.0)
            r['days'] = 0
            r['holding_days'] = 0
            
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
if __name__ == '__main__':
    main()
