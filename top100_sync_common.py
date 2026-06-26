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

SUPABASE_URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = ENV.get("SUPABASE_SERVICE_KEY")
BOT_SECRET = ENV.get("BOT_INTERNAL_SECRET")

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
        raise RuntimeError("BOT_INTERNAL_SECRET bulunamadi — frontend/.env.local kontrol et.")
    res = requests.post(
        SYNC_URL,
        json={"tickers": tickers, "source": source},
        headers={"x-bot-secret": BOT_SECRET, "Content-Type": "application/json"},
        timeout=300,
    )
    try:
        data = res.json()
    except Exception:
        data = {"error": res.text}
    if res.status_code != 200:
        raise RuntimeError(f"top100-sync HTTP {res.status_code}: {data}")
    return data
