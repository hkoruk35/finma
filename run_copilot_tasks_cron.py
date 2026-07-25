"""
BOGA Copilot Akilli Gorevler zamanlayicisi.
Diger saatlik bot'larla (top100_sync_common.py) ayni desen: CRON_SECRET
frontend/.env.local'den okunur, /api/cron/copilot-tasks'e Bearer token ile
GET atilir. Endpoint kendi icinde piyasa saati/tatil kontrolu yapar (off-hours
veya tatil gunu ise no-op doner) ve idempotency_key sayesinde ayni periyot
icin iki kez calismaz — bu yuzden saatlik (piyasa disi saatler dahil)
calistirilmasi guvenlidir.
"""
import sys
from pathlib import Path
from datetime import datetime, timezone

import requests
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent
ENV = dotenv_values(REPO_ROOT / "frontend" / ".env.local")

CRON_SECRET = ENV.get("CRON_SECRET")
BASE_URL = ENV.get("NEXT_PUBLIC_SITE_URL") or "https://bogastock.com"
URL = f"{BASE_URL}/api/cron/copilot-tasks"


def main() -> int:
    if not CRON_SECRET:
        print("[copilot-tasks-cron] HATA: CRON_SECRET frontend/.env.local icinde bulunamadi.")
        return 1

    ts = datetime.now(timezone.utc).isoformat()
    try:
        res = requests.get(
            URL,
            headers={"Authorization": f"Bearer {CRON_SECRET}"},
            timeout=60,
        )
        print(f"[copilot-tasks-cron] {ts} -> HTTP {res.status_code}: {res.text[:500]}")
        res.raise_for_status()
        return 0
    except requests.RequestException as e:
        print(f"[copilot-tasks-cron] {ts} -> HATA: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
