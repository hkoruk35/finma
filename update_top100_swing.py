"""
Top 100 Tracker — 10'luk gunluk swing dilimi guncellemesi.
Kaynak: /swing sayfasinin en guncel verisi (public/swing_all_picks.json), skora gore Top 10.
Zamanlama: gunluk, NY 14:00 (Windows Task Scheduler).
"""
import json
import sys
from pathlib import Path
from top100_sync_common import sync_top100

TOP_N = 10
SWING_FILE = Path(__file__).resolve().parent / "frontend" / "public" / "swing_all_picks.json"


def main():
    if not SWING_FILE.exists():
        print(f"{SWING_FILE} bulunamadi — durduruluyor.")
        sys.exit(1)

    with open(SWING_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    picks = data.get("picks", [])
    if not picks:
        print("swing_all_picks.json'da pick bulunamadi — durduruluyor.")
        sys.exit(1)

    ranked = sorted(picks, key=lambda p: p.get("score", p.get("boga_score", 0)), reverse=True)
    top10 = [p["ticker"] for p in ranked[:TOP_N]]
    print(f"En guncel swing verisi ({data.get('date')}) icinden Top {len(top10)}: {top10}")

    result = sync_top100(top10, source="swing_daily")
    print(f"Tamamlandi. Guncellenen: {len(result.get('updated', []))}, "
          f"Kaldirilan: {len(result.get('removed', []))}, "
          f"Basarisiz: {result.get('failed', [])}")


if __name__ == "__main__":
    main()
