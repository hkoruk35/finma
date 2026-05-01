import json
import os
import sys

# Add the project root to sys.path so we can import build_option_block
sys.path.append(r"c:\Users\afksm\finma")
from opsiyon218v7 import build_option_block

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

        # Generate Full AI Analysis Text (Telegram Style)
        # Mocking l2, l3 structures needed by build_option_block if they are not fully in pick
        # The bot expects l2 and l3 which contain entry_mode, high_60, etc.
        # We can reconstruct them from pick fields
        mock_l2 = {"entry_mode": pick.get("entry_mode", "UNKNOWN")}
        mock_l3 = {
            "high_60": high,
            "rs_60d": rs_60d,
            "distance_to_high": dist,
            "higher_highs": pick.get("higher_highs"),
            "volume_spike": pick.get("volume_spike")
        }
        
        # The 'opt' expected by build_option_block is the pick object or something similar
        # Looking at save_options_picks: pick_obj uses 'opt' as 'options'
        # Let's adjust pick for build_option_block
        report_opt = pick.copy()
        report_opt['atm_iv'] = pick.get('iv_rank', 0) # approximation for display
        report_opt['iv_rank'] = pick.get('iv_rank', 0)
        report_opt['max_pain'] = pick.get('max_pain', 0)
        report_opt['em'] = pick.get('expected_move', 0)
        report_opt['em_upper'] = price + pick.get('expected_move', 0)
        
        # Institutional
        if inst:
            report_opt['institutional'] = inst.copy()
            report_opt['institutional']['mid'] = inst.get('premium', 0)
            report_opt['institutional']['cost_per_contract'] = inst.get('contract_cost', 0)
            report_opt['institutional']['breakeven'] = inst.get('breakeven', 0)
            
        # Asymmetric
        if asym:
            report_opt['asymmetric'] = asym.copy()
            report_opt['asymmetric']['mid'] = asym.get('premium', 0)
            report_opt['asymmetric']['cost_per_contract'] = asym.get('contract_cost', 0)
            report_opt['asymmetric']['breakeven'] = asym.get('breakeven', 0)
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
            print(f"Error generating text for {pick['ticker']}: {e}")

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Updated {filepath}")
