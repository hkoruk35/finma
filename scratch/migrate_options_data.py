import json
import os

filepaths = [
    r"c:\Users\afksm\finma\data\2026-04-30\options_picks.json",
    r"c:\Users\afksm\finma\frontend\public\data\latest\options_picks.json"
]

for filepath in filepaths:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (not found)")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for pick in data['picks']:
        inst = pick.get('institutional')
        asym = pick.get('asymmetric')
        
        # Ensure expiry -> expiration and root dates
        if inst:
            pick['exp_date'] = inst.get('expiry', inst.get('expiration'))
            pick['dte'] = inst.get('dte')
            if 'expiry' in inst:
                inst['expiration'] = inst.pop('expiry')
        
        if asym:
            if not pick.get('exp_date'):
                pick['exp_date'] = asym.get('expiry', asym.get('expiration'))
            if not pick.get('dte'):
                pick['dte'] = asym.get('dte')
            if 'expiry' in asym:
                asym['expiration'] = asym.pop('expiry')
        
        # Enhanced Labels
        iv_vs_hv = pick.get('iv_vs_hv', 1.0)
        pick['iv_vs_hv_label'] = "💰 ULTRA UCUZ" if iv_vs_hv < 0.85 else ("🟢 UCUZ" if iv_vs_hv < 0.95 else ("🟡 FAIR" if iv_vs_hv < 1.15 else "🔴 PAHALI"))
        
        rs_60d = pick.get('rs_vs_spy_60d', 0.0)
        pick['rs_vs_spy_label'] = "💪 PAZAR LİDERİ" if rs_60d >= 5 else ("🟡 GÜÇLÜ" if rs_60d >= 2 else ("😐 NÖTR" if rs_60d >= -2 else "😟 ZAYIF"))
        
        price = pick.get('current_price', 1.0)
        high = pick.get('high_60d', price)
        dist = ((high - price) / price * 100) if price > 0 else 0
        pick['upside_label'] = f"📈 %{dist:.1f} YUKARISI" if dist > 0 else "⚠️ ZIRVE YAKINI"
        
        pick['higher_highs'] = pick.get('higher_highs', False)
        pick['volume_spike'] = pick.get('volume_spike', False)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Updated {filepath}")
