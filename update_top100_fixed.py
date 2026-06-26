"""
Top 100 Tracker — 90'lik sabit liste guncellemesi.
Kaynak: /tracker sayfasinin admin listesi (shared_store.tracker_v1), hacme gore Top 90.
Zamanlama: haftalik, Cuma 23:59 NY (Windows Task Scheduler).
"""
import sys
import yfinance as yf
from top100_sync_common import get_shared_store, sync_top100

TOP_N = 90


def fetch_volume(ticker: str) -> float:
    try:
        fi = yf.Ticker(ticker).fast_info
        vol = fi.get("last_volume") if hasattr(fi, "get") else getattr(fi, "last_volume", None)
        return float(vol) if vol else 0.0
    except Exception:
        return 0.0


def main():
    store = get_shared_store("tracker_v1")
    if not store or not store.get("tickers"):
        print("tracker_v1 bos veya bulunamadi — durduruluyor.")
        sys.exit(1)

    tickers = list(dict.fromkeys(store["tickers"]))  # tekillesir, sirayi korur
    print(f"/tracker admin listesinde {len(tickers)} ticker bulundu. Hacim cekiliyor...")

    volumes = {}
    for i, t in enumerate(tickers, 1):
        volumes[t] = fetch_volume(t)
        if i % 20 == 0:
            print(f"  {i}/{len(tickers)} hacim cekildi...")

    ranked = sorted(tickers, key=lambda t: volumes.get(t, 0), reverse=True)
    top90 = ranked[:TOP_N]
    print(f"Top {len(top90)} hacme gore secildi. Sync ediliyor...")

    result = sync_top100(top90, source="fixed")
    print(f"Tamamlandi. Guncellenen: {len(result.get('updated', []))}, "
          f"Kaldirilan: {len(result.get('removed', []))}, "
          f"Basarisiz: {result.get('failed', [])}")


if __name__ == "__main__":
    main()
