"""
Top 100 Tracker — saatlik fiyat/sinyal tazeleme (Faz 6).
Kompozisyonu degistirmez; su an top100_tickers'da aktif olan her ticker icin
ayni sync endpoint'i tekrar cagirip snapshot'lari (fiyat/EMA/RSI/MACD/sinyal) tazeler.
Zamanlama: saatlik, piyasa saatleri (Windows Task Scheduler).
"""
import requests
from top100_sync_common import SUPABASE_URL, supabase_headers, sync_top100


def get_active_tickers(source: str) -> list[str]:
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/top100_tickers",
        params={"select": "ticker", "source": f"eq.{source}", "active": "eq.true"},
        headers=supabase_headers(),
        timeout=15,
    )
    res.raise_for_status()
    return [r["ticker"] for r in res.json()]


def main():
    for source in ("fixed", "swing_daily"):
        tickers = get_active_tickers(source)
        if not tickers:
            print(f"[{source}] aktif ticker yok, atlaniyor.")
            continue
        print(f"[{source}] {len(tickers)} ticker tazeleniyor...")
        result = sync_top100(tickers, source=source)
        print(f"[{source}] Tamamlandi. Guncellenen: {len(result.get('updated', []))}, "
              f"Basarisiz: {result.get('failed', [])}")


if __name__ == "__main__":
    main()
