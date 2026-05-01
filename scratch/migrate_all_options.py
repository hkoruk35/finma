import json
import os
import sys

# Add the project root to sys.path so we can import build_option_block
sys.path.append(r"c:\Users\afksm\finma")
from opsiyon218v7 import build_option_block

base_dir = r"c:\Users\afksm\finma\frontend\public\data"
data_archive_dir = r"c:\Users\afksm\finma\data"

def process_file(filepath):
    if not os.path.exists(filepath):
        return False
        
    print(f"Processing: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
            return False

    if 'picks' not in data:
        return False

    for pick in data['picks']:
        inst = pick.get('institutional')
        asym = pick.get('asymmetric')
        
        pick_date = pick.get('date', data.get('date', '2026-04-30'))
        
        if not pick.get('exp_date') or not pick.get('dte'):
            if inst:
                pick['exp_date'] = inst.get('expiry', inst.get('expiration'))
                pick['dte'] = inst.get('dte')
            elif asym:
                pick['exp_date'] = asym.get('expiry', asym.get('expiration'))
                pick['dte'] = asym.get('dte')

        if inst and 'expiry' in inst:
            inst['expiration'] = inst.pop('expiry')
        if asym and 'expiry' in asym:
            asym['expiration'] = asym.pop('expiry')
        
        iv_vs_hv = pick.get('iv_vs_hv')
        if iv_vs_hv is None: iv_vs_hv = 1.0
        pick['iv_vs_hv_label'] = "💰 ULTRA UCUZ" if iv_vs_hv < 0.85 else ("🟢 UCUZ" if iv_vs_hv < 0.95 else ("🟡 FAIR" if iv_vs_hv < 1.15 else "🔴 PAHALI"))
        
        rs_60d = pick.get('rs_vs_spy_60d')
        if rs_60d is None: rs_60d = 0.0
        pick['rs_vs_spy_label'] = "💪 PAZAR LİDERİ" if rs_60d >= 5 else ("🟡 GÜÇLÜ" if rs_60d >= 2 else ("😐 NÖTR" if rs_60d >= -2 else "😟 ZAYIF"))
        
        price = pick.get('current_price', 1.0)
        high = pick.get('high_60d')
        if high is None: high = price
        dist = ((high - price) / price * 100) if price > 0 else 0
        pick['upside_label'] = f"📈 %{dist:.1f} YUKARISI" if dist > 0 else "⚠️ ZIRVE YAKINI"
        
        pick['higher_highs'] = pick.get('higher_highs', False)
        pick['volume_spike'] = pick.get('volume_spike', False)

        mock_l2 = {"entry_mode": pick.get("entry_mode", "UNKNOWN")}
        mock_l3 = {
            "high_60": high,
            "rs_60d": rs_60d,
            "distance_to_high": dist,
            "higher_highs": pick.get("higher_highs"),
            "volume_spike": pick.get("volume_spike")
        }
        
        report_opt = pick.copy()
        report_opt['atm_iv'] = pick.get('iv_rank', 0)
        report_opt['iv_rank'] = pick.get('iv_rank', 0)
        report_opt['max_pain'] = pick.get('max_pain', 0)
        report_opt['em'] = pick.get('expected_move', 0)
        report_opt['em_upper'] = price + (pick.get('expected_move') or 0)
        
        report_opt['exp_date'] = pick.get('exp_date')
        report_opt['dte'] = pick.get('dte')

        if inst:
            report_opt['institutional'] = inst.copy()
            report_opt['institutional']['mid'] = inst.get('premium', 0)
            report_opt['institutional']['cost_per_contract'] = inst.get('contract_cost', 0)
            report_opt['institutional']['breakeven'] = inst.get('breakeven', 0)
            report_opt['institutional']['expiry'] = inst.get('expiration')
            
        if asym:
            report_opt['asymmetric'] = asym.copy()
            report_opt['asymmetric']['mid'] = asym.get('premium', 0)
            report_opt['asymmetric']['cost_per_contract'] = asym.get('contract_cost', 0)
            report_opt['asymmetric']['breakeven'] = asym.get('breakeven', 0)
            report_opt['asymmetric']['expiry'] = asym.get('expiration')
            report_opt['asymmetric']['em_upper'] = report_opt['em_upper']

        try:
            pick['ai_analysis_text'] = build_option_block(
                report_opt, 
                pick['ticker'], 
                price, 
                pick.get('grade', '🏆 MÜKEMMEL'), 
                mock_l2, 
                mock_l3, 
                uoa=pick.get('uoa')
            )
        except Exception as e:
            print(f"Error generating text for {pick['ticker']} in {filepath}: {e}")

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return True

# Process folders
if os.path.exists(base_dir):
    for item in os.listdir(base_dir):
        item_path = os.path.join(base_dir, item)
        if os.path.isdir(item_path):
            json_path = os.path.join(item_path, "options_picks.json")
            process_file(json_path)

if os.path.exists(data_archive_dir):
    for item in os.listdir(data_archive_dir):
        item_path = os.path.join(data_archive_dir, item)
        if os.path.isdir(item_path):
            json_path = os.path.join(item_path, "options_picks.json")
            process_file(json_path)

print("Migration complete.")
