"""
Yanlış LOSS kayıtlarını düzeltir.
- EMA50 stop loss seviyesi, entry'den %5'ten az kayıpsa → PENDING'e geri döndür
- EMA50 stop loss pozitif getiri üzerindeyse (EMA50 > entry) → PENDING'e geri döndür
Düzelttikten sonra update_swing_performance.py çalıştırılır.
"""

import json
import math

performance_file = 'frontend/public/swing_performance.json'

with open(performance_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

history = data.get('history', [])

fixed_count = 0
for record in history:
    if record.get('result') != 'LOSS':
        continue

    ema50 = record.get('ema50_1d')
    if ema50 is None:
        continue  # Eski kayıtlar (N/A), dokunma

    try:
        entry = float(record['entry'])
        ema50 = float(ema50)
    except (ValueError, TypeError):
        continue

    # EMA50 stop loss'ta potansiyel kayıp yüzdesi
    potential_loss_pct = ((ema50 - entry) / entry) * 100

    # Eğer EMA50 stop loss seviyesi %5'ten az kayıp temsil ediyorsa → PENDING
    if potential_loss_pct > -5.0:
        ticker = record.get('ticker', '?')
        old_ret = record.get('return_pct', 'N/A')
        print(f"FIX: {ticker} | entry={entry} | ema50={ema50} | "
              f"potential_loss={round(potential_loss_pct,2)}% | old_return={old_ret}% → PENDING")
        record['result'] = 'PENDING'
        record.pop('exit_date', None)
        record['return_pct'] = 0.0
        fixed_count += 1

print(f"\nToplam {fixed_count} kayıt PENDING'e döndürüldü.")

data['history'] = history

with open(performance_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("JSON kaydedildi.")
