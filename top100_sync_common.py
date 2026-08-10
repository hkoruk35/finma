"""
Top 100 Tracker — paylasilan yardimcilar.
Tum update_top100_*.py script'leri bu modulu kullanir; canli siteye (veya
TOP100_SYNC_BASE_URL ile lokale) /api/internal/top100-sync uzerinden POST atar.
Hesaplama (EMA/RSI/MACD/sinyal) tamamen o endpoint'in arkasindaki TS motorunda
(lib/top100-engine.ts) yapilir — burada ikinci bir kopyasi yok.
"""
import os
import requests
from pathlib import Path
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent
ENV = dotenv_values(REPO_ROOT / "frontend" / ".env.local")
ROOT_ENV = dotenv_values(REPO_ROOT / ".env")

SUPABASE_URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL") or ROOT_ENV.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = ENV.get("SUPABASE_SERVICE_KEY") or ROOT_ENV.get("SUPABASE_SERVICE_KEY")

# Bot-pipeline kimlik dogrulamasi (swing117_boga.py -> /api/revalidate-swing ile ayni).
#
# Onceden SADECE os.environ'dan okunuyordu ("OS ortam degiskeni olarak tanimli"
# varsayimiyla). Bu degisken isletim sisteminde hicbir kapsamda (Process/User/
# Machine) tanimli DEGIL — sadece kok `.env` dosyasinda var. Sonucu:
# update_top100_hourly.py ve update_top100_swing.py her calismada
# "REVALIDATE_SECRET ortam degiskeni bulunamadi" ile cokuyordu ve
# top100_snapshot 2026-07-27'de donmustu; /api/top100 iki haftalik fiyat, RSI
# ve sinyalleri guncelmis gibi servis ediyordu (2026-08-10'da tespit edildi).
#
# Oncelik sirasi korunuyor: OS ortam degiskeni varsa o kazanir, yoksa kok
# `.env`, en son frontend/.env.local.
BOT_SECRET = (
    os.environ.get("REVALIDATE_SECRET")
    or ROOT_ENV.get("REVALIDATE_SECRET")
    or ENV.get("REVALIDATE_SECRET")
)

BASE_URL = os.environ.get("TOP100_SYNC_BASE_URL", "https://bogastock.com")
SYNC_URL = f"{BASE_URL}/api/internal/top100-sync"


def supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }


def get_shared_store(key: str):
    """shared_store tablosundan bir key okur (orn. tracker_v1)."""
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/shared_store",
        params={"select": "value", "key": f"eq.{key}"},
        headers=supabase_headers(),
        timeout=15,
    )
    res.raise_for_status()
    rows = res.json()
    return rows[0]["value"] if rows else None


def sync_top100(tickers: list[str], source: str) -> dict:
    """Verilen ticker listesini ilgili source bucket'ina yazar (tam degisim) ve snapshot'lari hesaplar."""
    if not BOT_SECRET:
        raise RuntimeError("REVALIDATE_SECRET ortam degiskeni bulunamadi.")
    res = requests.post(
        SYNC_URL,
        json={"tickers": tickers, "source": source},
        headers={"x-revalidate-secret": BOT_SECRET, "Content-Type": "application/json"},
        timeout=300,
    )
    try:
        data = res.json()
    except Exception:
        data = {"error": res.text}
    if res.status_code != 200:
        raise RuntimeError(f"top100-sync HTTP {res.status_code}: {data}")
    return data
