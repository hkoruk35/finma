import json
import os

file_path = 'frontend/public/swing_performance.json'

if os.path.exists(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    history = data.get('history', [])
    # 🧹 TOTAL CLEANUP: No record should have entry date 2026-05-13
    # And we should also revert peak_date and exit_date if they are 2026-05-13?
    # Actually, user said "date kısmı hatalı". Usually refers to the primary Date column.
    
    original_len = len(history)
    new_history = []
    for r in history:
        if r['date'] >= '2026-05-13':
            continue
        
        # Also clean up internal dates to avoid confusion in this manual "revert"
        if r.get('peak_date') == '2026-05-13':
             # Revert peak date to previous or just hide it
             pass 
        if r.get('exit_date') == '2026-05-13':
             # If it exited today, it shouldn't have in this "revert to yesterday" state
             r['result'] = 'PENDING'
             r.pop('exit_date', None)
             r['return_pct'] = 0.0 # Will be recalculated by the bot later correctly
        
        new_history.append(r)
    
    data['history'] = new_history
    data['stats']['last_updated'] = "2026-05-12T23:59:59"
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Cleanup complete. Removed {original_len - len(new_history)} records with date >= 2026-05-13.")
else:
    print("File not found.")
