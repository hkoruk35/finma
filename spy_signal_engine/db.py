"""
Supabase REST helper for spy_signal_engine.

Raw-REST pattern, modeled directly on spy_0dte_options_sync.py /
robinhood_spy_sync.py (same headers, same PostgREST URL shape) — no new
Python Postgres driver, no supabase-py dependency. Writes to a real
dedicated table (`spy_signals`, see supabase/migrations/003_create_spy_signals.sql),
not a `shared_store` KV row.
"""
from __future__ import annotations

import os

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
TABLE = "spy_signals"


def _headers(prefer: str | None = None) -> dict:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def check_env() -> list[str]:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    return missing


def insert_signal(payload: dict) -> dict | None:
    """Inserts one row into spy_signals. Returns the inserted row (from
    Prefer: return=representation) or None on failure — never raises, so a
    transient Supabase hiccup never crashes the scheduler loop."""
    missing = check_env()
    if missing:
        raise RuntimeError(f"Supabase env eksik: {', '.join(missing)}")

    with httpx.Client(timeout=15.0) as client:
        res = client.post(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            headers=_headers(prefer="return=representation"),
            json=[payload],
        )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Supabase insert HTTP {res.status_code}: {res.text[:400]}")
    rows = res.json()
    return rows[0] if rows else None


def fetch_recent(limit: int = 50) -> list[dict]:
    missing = check_env()
    if missing:
        raise RuntimeError(f"Supabase env eksik: {', '.join(missing)}")

    with httpx.Client(timeout=15.0) as client:
        res = client.get(
            f"{SUPABASE_URL}/rest/v1/{TABLE}",
            headers=_headers(),
            params={
                "select": "*",
                "order": "time_utc.desc",
                "limit": str(limit),
            },
        )
    if res.status_code != 200:
        raise RuntimeError(f"Supabase read HTTP {res.status_code}: {res.text[:400]}")
    return res.json()
