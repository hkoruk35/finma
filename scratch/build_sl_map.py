import json
import os
import glob
from datetime import datetime

def build_sl_map():
    sl_map = {} # ticker -> {date -> sl_pct}
    
    # Paths to scan
    paths = [
        'frontend/public/data/swing2026/*.json',
        'frontend/public/data/2026-*/*.json',
        'frontend/public/analysis-archive/*/*.json',
        'frontend/public/swing_all_picks.json'
    ]
    
    for path_pattern in paths:
        for filepath in glob.glob(path_pattern):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                    
                    # Case 1: swing_all_picks format
                    picks = content.get('picks', [])
                    # Case 2: Some files might be a single pick
                    if not picks and content.get('ticker'):
                        picks = [content]
                    
                    date_str = content.get('date')
                    if not date_str:
                        # Try to get date from filename or content
                        date_str = filepath.split('\\')[-1].split('.')[0].replace('swing_', '')
                        if len(date_str) > 10: date_str = date_str[:10]
                    
                    for p in picks:
                        ticker = p.get('ticker')
                        if not ticker: continue
                        
                        entry = p.get('current_price', p.get('entry', 1))
                        # stop_loss_high is the common field
                        sl_high = p.get('tracker_logic', {}).get('stop_loss_high')
                        if not sl_high:
                            # Try stop_zone
                            sz = p.get('stop_zone', {})
                            sl_high = sz.get('high')
                        
                        if entry > 0 and sl_high > 0:
                            sl_pct = abs(round(((sl_high - entry) / entry) * 100, 2))
                            if ticker not in sl_map: sl_map[ticker] = {}
                            # Store by date
                            sl_map[ticker][date_str] = sl_pct
            except: pass
            
    # Save the map for reuse
    with open('scratch/ticker_sl_map.json', 'w', encoding='utf-8') as f:
        json.dump(sl_map, f, indent=2)
    
    print(f"Discovered SL data for {len(sl_map)} tickers.")
    return sl_map

if __name__ == "__main__":
    build_sl_map()
