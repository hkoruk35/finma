#!/usr/bin/env python3
"""
swing_performance.json temizleyici:
1. Aynı gün aynı hisse tekrarlarını kaldır (ilkini tut)
2. Bir hisse verdiyse 5 gün boyunca tekrar görünmemesini sağla (ilk görüntüsünü tut)
"""

import json
from datetime import datetime, timedelta

# Dosya yolunu ayarla
perf_file = r"C:\Users\afksm\finma\frontend\public\swing_performance.json"

print("[*] swing_performance.json yukleniyor...")
with open(perf_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

history = data.get('history', [])
print(f"[INFO] Toplam history entries: {len(history)}")

# --- ADIM 0: Aynı gün aynı hisse tekrarlarını kaldır (ilkini tut) ---
seen_same_day = {}  # {"2026-03-16:UNFI": True}
dedup_same_day = []
for entry in history:
    date_str = entry.get('date', '')
    ticker = entry.get('ticker', '').upper()
    key = f"{date_str}:{ticker}"

    if key not in seen_same_day:
        dedup_same_day.append(entry)
        seen_same_day[key] = True

print(f"[REMOVED-SAME-DAY] Same-day duplicates removed: {len(history) - len(dedup_same_day)}")
history = dedup_same_day

# --- ADIM 1: Tarihe göre sırala (en yeni ilk) ---
history_sorted = sorted(history, key=lambda x: x.get('date', ''), reverse=True)

# --- ADIM 2: 5 gün kuralını enforce et (5 günü geçmişse sadece ilkini tut) ---
seen_tickers = {}  # {"TICKER": last_date_object}
cleaned_history = []

for entry in history_sorted:
    ticker = entry.get('ticker', '').upper()
    date_str = entry.get('date', '')

    try:
        entry_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        entry_date = None

    # İlk kez gördüğümüz hisse
    if ticker not in seen_tickers:
        cleaned_history.append(entry)
        seen_tickers[ticker] = entry_date
    else:
        # Daha önce gördüğümüz hisse - 5 gün geçti mi?
        last_date = seen_tickers[ticker]
        if entry_date and last_date:
            days_diff = (last_date - entry_date).days
            if days_diff >= 5:
                # 5 günü geçti - bu girişi ekle
                cleaned_history.append(entry)
                seen_tickers[ticker] = entry_date
            # else: 5 günü geçmedi - skip (kaldır)
        # else: tarih parse edilemedi - güvenlik için skip

# Sonuçları tersine çevir (eski tarihlerin solda kalması için)
cleaned_history = list(reversed(cleaned_history))

removed_count = len(dedup_same_day) - len(cleaned_history)
print(f"[REMOVED-5DAY] 5-day rule duplicates: {removed_count}")
print(f"[OK] New history entries: {len(cleaned_history)}")

# Check for remaining duplicates
ticker_counts = {}
for entry in cleaned_history:
    ticker = entry.get('ticker', '').upper()
    ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1

repeated = {k: v for k, v in ticker_counts.items() if v > 1}
if repeated:
    print(f"\n[REPEATED] Still repeated stocks (5+ days apart):")
    for ticker, count in sorted(repeated.items(), key=lambda x: x[1], reverse=True):
        print(f"   {ticker}: {count}x")
else:
    print(f"\n[OK] No remaining duplicates!")

# Update history and stats
data['history'] = cleaned_history
data['stats']['total_picks'] = len(cleaned_history)

# Save file
print(f"\n[SAVE] Saving file...")
with open(perf_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"[SUCCESS] Complete! {len(cleaned_history)} clean entries saved.")
