"""
Robinhood -> BOGA overnight SPY veri koprusu.

NEDEN: Yahoo Finance, SPY icin overnight seansini (20:00-04:00 ET) hic
tasimiyor. Premarket (04:00-09:30) ve afterhours (16:00-20:00) zaten
Yahoo'dan geliyor -- bu script SADECE aradaki gece penceresini doldurur.
Calismadiginda site hicbir sey kaybetmez, sadece o saatlerde mum cizilmez.

NASIL CALISIR:
  1) robin_stocks ile BIR KERE interaktif login yapilir (ilk calistirmada
     kullanici adi/sifre/MFA sorar) -> oturum ~/.tokens/robinhood.pickle
     icinde onbelleklenir, sonraki calistirmalarda tekrar sormaz.
  2) Her dongude SPY'in son ~1 gunluk 5 dakikalik barlarini (overnight
     dahil, bounds=24_5) ceker.
  3) Barlari DOGRUDAN Supabase'e (robinhood_spy_bars) upsert eder.
  4) Site (frontend/lib/spyengine/market.ts) bu tabloyu okur ve SADECE
     20:00-04:00 ET araligindaki barlari Yahoo'nun uzerine bindirir.

NEDEN DOGRUDAN SUPABASE (eski surumden fark):
  Onceki surum barlari /api/internal/robinhood-spy-sync uzerinden
  gonderiyordu ve x-revalidate-secret ile dogruluyordu. Ama kok .env'deki
  REVALIDATE_SECRET, Vercel'deki degerle ESLESMIYOR (Vercel'de "Sensitive"
  isaretli oldugu icin geri okunamiyor, ayrica ayni adli bir GitHub Actions
  secret'i da var) -- yani o yol 403 doner. Diger botlar (bkz.
  index_analysis_common.py) zaten Supabase'e ham REST ile dogrudan yaziyor;
  bu script de ayni yola gecti. Boylece senkronize edilmesi gereken bir sir
  ve araya giren bir HTTP ucu kalmadi.

KURULUM:
  pip install robin_stocks requests python-dotenv
  python robinhood_spy_sync.py --selftest   # Robinhood'suz: Supabase yolunu dogrula
  python robinhood_spy_sync.py --once       # tek seferlik cekim (ilk kez: login sorar)
  python robinhood_spy_sync.py              # sonsuz dongu, POLL_SECONDS'ta bir

Bu script SIFRENI hicbir yere yazmaz/gondermez -- sadece robin_stocks'un
kendi interaktif login akisina girer (terminalde sana sorar).
"""

import sys
import json
import time
import calendar
import argparse
import urllib.parse
from pathlib import Path

import requests
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent
ROOT_ENV = dotenv_values(REPO_ROOT / ".env")
FRONTEND_ENV = dotenv_values(REPO_ROOT / "frontend" / ".env.local")


def env(key: str):
    return ROOT_ENV.get(key) or FRONTEND_ENV.get(key)


SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_KEY")

TABLE = "robinhood_spy_bars"
SYMBOL = "SPY"
POLL_SECONDS = 90
#

# Tablo sinirsiz buyumesin: bu pencereden eskisi her donguде silinir.
# Site zaten son 3 gunu sorguluyor, 10 gun fazlasiyla yeterli.
RETENTION_DAYS = 10


# ── Supabase ──────────────────────────────────────────────────────

def supabase_headers(upsert: bool = False) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or ''}",
        "Content-Type": "application/json",
    }
    if upsert:
        # PostgREST'te "Prefer: resolution=merge-duplicates" TEK BASINA
        # yetmiyor; hangi unique constraint uzerinden merge edilecegini
        # bilmesi icin ayrica on_conflict query param'i gerekiyor
        # (bkz. index_analysis_common.py'deki ayni tuzak).
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
    return headers


def check_env() -> list:
    missing = []
    if not SUPABASE_URL:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    return missing


def upsert_bars(rows: list) -> int:
    if not rows:
        return 0
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        params={"on_conflict": "time"},
        headers=supabase_headers(upsert=True),
        data=json.dumps(rows),
        timeout=30,
    )
    if res.status_code not in (200, 201, 204):
        raise RuntimeError(f"Supabase upsert HTTP {res.status_code}: {res.text[:400]}")
    return len(rows)


def prune_old(cutoff_unix: int) -> None:
    requests.delete(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        params={"time": f"lt.{cutoff_unix}"},
        headers=supabase_headers(),
        timeout=30,
    )


def count_rows() -> int:
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/{TABLE}",
        params={"select": "time", "limit": "1"},
        headers={**supabase_headers(), "Prefer": "count=exact"},
        timeout=20,
    )
    rng = res.headers.get("content-range", "")
    return int(rng.split("/")[-1]) if "/" in rng else -1


# ── Robinhood ─────────────────────────────────────────────────────

def login_once() -> bool:
    """
    robin_stocks oturumu diskte onbelleklidir; varsa tekrar sifre sormaz.

    BILINEN SORUN: Robinhood'un telefon-onayi (push) dogrulama akisinda
    robin_stocks ilk denemede genelde "Error during login verification:
    'token_type'" hatasi veriyor (kutuphanenin yeni "workflow" tipi
    dogrulama yanitini parse edememesi) -- ama telefonda onayi verdikten
    sonra ayni oturum artik guvenilir sayildigi icin HEMEN ARDINDAN
    yapilan ikinci deneme genelde basariyla geciyor. Bu yuzden birkac
    deneme hakki taniyoruz.
    """
    import robin_stocks.robinhood as r

    last_err = None
    for attempt in range(1, 4):
        try:
            info = r.login()
            if isinstance(info, dict) and info.get("access_token"):
                return True
            last_err = f"beklenmeyen login yaniti: {info}"
        except Exception as e:  # noqa: BLE001 - kutuphane cesitli tipler firlatiyor
            last_err = e
        print(
            f"Giris denemesi {attempt}/3 basarisiz ({last_err}). Telefonundaki "
            f"Robinhood bildirimini onayladiysan birkac saniye icinde tekrar deniyorum..."
        )
        time.sleep(4)
    print(f"Giris 3 denemede de basarisiz oldu: {last_err}")
    return False


def parse_rh_time(begins_at: str) -> int:
    """
    Robinhood 'begins_at' alanini UTC olarak dondurur ("...Z").

    ONEMLI: Onceki surum bunu `time.mktime(...) - time.timezone` ile
    ceviriyordu; mktime naif struct'i YEREL saat sayar ve DST uygular,
    time.timezone ise DST'siz ofsettir -- yaz saatinde sonuc TAM 1 SAAT
    kayiyordu. calendar.timegm dogrudan UTC struct'i epoch'a cevirir,
    makinenin saat dilimi ve DST durumu ne olursa olsun dogrudur.
    """
    return calendar.timegm(time.strptime(begins_at, "%Y-%m-%dT%H:%M:%SZ"))


def fetch_bars() -> list:
    """
    Overnight dahil son ~1 gunun barlarini ceker (bounds=24_5).

    robin_stocks.stocks.get_stock_historicals()'un kendi bounds dogrulamasi
    Robinhood'un yeni 24 saatlik islem parametrelerini ("24_5"/"24_7")
    tanimiyor ve reddediyor -- bu yuzden kutuphanenin zaten kimlik
    dogrulanmis oturumunu kullanarak ayni ham API'ye dogrudan istek
    atiyoruz. Bu, Robinhood'un kendi web uygulamasinin attigi istegin
    birebir ayni sekli.

    NOT: En ince granularite 5 DAKIKA. Site bu barlari yalnizca Yahoo'nun
    hic veri vermedigi 20:00-04:00 ET penceresinde kullanir; pre/after
    saatlerinde Yahoo'nun gercek 1 dakikalik barlari gecerlidir.
    """
    from robin_stocks.robinhood.helper import request_get

    url = f"https://api.robinhood.com/marketdata/historicals/{SYMBOL}/"
    payload = {"interval": "5minute", "span": "day", "bounds": "24_5"}
    data = request_get(url, "regular", payload, jsonify_data=True)

    rows = []
    for b in (data or {}).get("historicals") or []:
        try:
            ts = parse_rh_time(b["begins_at"])
            rows.append(
                {
                    "time": ts,
                    "open": float(b["open_price"]),
                    "high": float(b["high_price"]),
                    "low": float(b["low_price"]),
                    "close": float(b["close_price"]),
                    "volume": int(float(b.get("volume") or 0)),
                    "session": b.get("session"),
                    "interpolated": bool(b.get("interpolated", False)),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue
    return rows


# ── Kendi kendini test ────────────────────────────────────────────

def selftest() -> int:
    """
    Robinhood'a HIC dokunmadan Supabase yolunu dogrular: yaz -> oku -> sil.

    Sonda kullanilan zaman damgasi 2001 yilindan (site yalnizca son 3 gunu
    sorgular), dolayisiyla bu satir hicbir an canli grafige karisamaz;
    ayrica test bitiminde siliniyor.
    """
    missing = check_env()
    if missing:
        print(f"HATA: eksik env degiskeni: {', '.join(missing)} (kok .env dosyasina bak)")
        return 1

    print(f"Supabase: {urllib.parse.urlparse(SUPABASE_URL).netloc}")
    probe_time = 1000000000  # 2001-09-09, canli sorgu penceresinin cok disinda
    probe = [{
        "time": probe_time, "open": 1.0, "high": 1.0, "low": 1.0, "close": 1.0,
        "volume": 0, "session": "selftest", "interpolated": True,
    }]
    try:
        before = count_rows()
        print(f"  tablo okunabiliyor  -> mevcut satir: {before}")
        upsert_bars(probe)
        print("  yazma (upsert)      -> OK")
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            params={"select": "time,session", "time": f"eq.{probe_time}"},
            headers=supabase_headers(), timeout=20,
        )
        found = res.json()
        print(f"  geri okuma          -> {found}")
        requests.delete(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            params={"time": f"eq.{probe_time}"},
            headers=supabase_headers(), timeout=20,
        )
        print("  temizlik (delete)   -> OK")
        if not found:
            print("SONUC: yazma gorunuyor ama geri okunamadi -- tabloyu kontrol et.")
            return 1
    except Exception as e:  # noqa: BLE001
        print(f"SONUC: Supabase yolu CALISMIYOR -> {e}")
        return 1

    print("\nSONUC: Supabase yolu calisiyor. Geriye tek adim kaldi:")
    print("  python robinhood_spy_sync.py --once   (ilk kez calistirinca Robinhood girisi sorar)")
    return 0


# ── Ana dongu ─────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Robinhood -> Supabase overnight SPY koprusu")
    parser.add_argument("--once", action="store_true", help="Tek seferlik cek ve cik")
    parser.add_argument("--selftest", action="store_true",
                        help="Robinhood'a dokunmadan sadece Supabase yolunu dogrula")
    args = parser.parse_args()

    if args.selftest:
        return selftest()

    missing = check_env()
    if missing:
        print(f"HATA: eksik env degiskeni: {', '.join(missing)} (kok .env dosyasina bak)")
        return 1

    try:
        import robin_stocks.robinhood  # noqa: F401
    except ImportError:
        print("robin_stocks kurulu degil. Once calistir: pip install robin_stocks")
        return 1

    if not login_once():
        print("Giris basarisiz -- script durduruluyor. Tekrar calistirmayi dene.")
        return 1
    print("Robinhood oturumu hazir. SPY overnight koprusu basliyor...")

    while True:
        try:
            rows = fetch_bars()
            n = upsert_bars(rows)
            prune_old(int(time.time()) - RETENTION_DAYS * 86400)
            newest = max((r["time"] for r in rows), default=0)
            newest_str = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(newest)) if newest else "-"
            print(f"[{time.strftime('%H:%M:%S')}] {n} bar yazildi (en yeni: {newest_str})")
        except Exception as e:  # noqa: BLE001
            print(f"[{time.strftime('%H:%M:%S')}] hata: {e}")
        if args.once:
            break
        time.sleep(POLL_SECONDS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
