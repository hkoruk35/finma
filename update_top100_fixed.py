"""
Top 100 Tracker — 'fixed' liste guncellemesi.
Kaynak: /tracker sayfasinin admin listesi (shared_store.tracker_v1) — TUMU, ust limit yok
(isim "Top100" olsa da hisse sayisi sabitlenmedi, tracker'a eklenen her sey buraya yansir).
Zamanlama: her gece NY 00:00 (run_midnight_update.py icinden, Windows Task Scheduler).
"""
import sys
from top100_sync_common import get_shared_store, sync_top100


def main():
    store = get_shared_store("tracker_v1")
    if not store or not store.get("tickers"):
        print("tracker_v1 bos veya bulunamadi — durduruluyor.")
        sys.exit(1)

    tickers = list(dict.fromkeys(store["tickers"]))  # tekillesir, sirayi korur
    print(f"/tracker admin listesinde {len(tickers)} ticker bulundu. Sync ediliyor...")

    result = sync_top100(tickers, source="fixed")
    print(f"Tamamlandi. Guncellenen: {len(result.get('updated', []))}, "
          f"Kaldirilan: {len(result.get('removed', []))}, "
          f"Basarisiz: {result.get('failed', [])}")


if __name__ == "__main__":
    main()
