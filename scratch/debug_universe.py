import os
import sys
import json
import re
import logging

# Mock logging
logging.basicConfig(level=logging.INFO)

AI_SWING_ZONES = {}

def load_swing_universe():
    global AI_SWING_ZONES
    AI_SWING_ZONES.clear()
    symbols = set()
    
    public_data_base = r"C:\Users\afksm\finma\frontend\public\data"
    if not os.path.exists(public_data_base):
        print(f"❌ Public data dizini bulunamadı: {public_data_base}")
        return []

    # 1. Son 5 günün klasörlerini bul (YYYY-MM-DD formatında olanlar)
    import re
    date_pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    dated_dirs = [d for d in os.listdir(public_data_base) 
                  if os.path.isdir(os.path.join(public_data_base, d)) and date_pattern.match(d)]
    
    dated_dirs.sort(reverse=True)
    recent_dirs = dated_dirs[:5]
    
    print(f"Son 5 gunun klasorleri taraniyor: {recent_dirs}")

    for d_dir in recent_dirs:
        # Her klasorde swing_all_picks.json ara
        json_path = os.path.join(public_data_base, d_dir, "swing_all_picks.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for c in data.get("picks", []):
                        sym = c.get("ticker")
                        if sym:
                            symbols.add(sym)
                            if sym not in AI_SWING_ZONES:
                                AI_SWING_ZONES[sym] = c.get("boga_zones", {})
            except Exception as e:
                print(f"Archive {json_path} read error: {e}")
    
    # 2. Mevcut (Bugunku) swing_all_picks.json'i da ekle (Henuz arsivlenmemis olabilir)
    live_json = r"C:\Users\afksm\finma\frontend\public\swing_all_picks.json"
    if os.path.exists(live_json):
        try:
            with open(live_json, "r", encoding="utf-8") as f:
                data = json.load(f)
                for c in data.get("picks", []):
                    sym = c.get("ticker")
                    if sym:
                        symbols.add(sym)
                        if sym not in AI_SWING_ZONES:
                            AI_SWING_ZONES[sym] = c.get("boga_zones", {})
        except Exception as e:
            print(f"Live {live_json} read error: {e}")

    final_symbols = sorted(list(symbols))
    print(f"Total {len(final_symbols)} symbols loaded: {final_symbols}")
    return final_symbols

load_swing_universe()
