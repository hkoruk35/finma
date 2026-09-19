# spy_signal_engine

Standalone FastAPI + asyncio service: polls SPY 5m bars from Yahoo Finance,
runs `signal_engine.SignalEngine` (30m opening-range regime -> 15m primary
trigger -> 5m entry-timing refinement — see
`tasks/active/014-spy-signal-engine-realtime.md`),
writes every result to Supabase (`spy_signals` table) and broadcasts it over
a WebSocket. Deployed on the Hetzner Ubuntu box, independent of the Next.js
app and of every other root-level Python bot (no imports either direction —
communicates only via Supabase, per repo `AGENTS.md`).

## Deploy checklist (run on the server, as root, from `/root/finma`)

```bash
cd /root/finma/spy_signal_engine
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

cp .env.example .env
# edit .env: fill SUPABASE_URL + SUPABASE_SERVICE_KEY (same values already
# used by spy_0dte_options_sync.py / robinhood_spy_sync.py), and set
# SPY_ENGINE_SECRET to a fresh random value:
openssl rand -hex 32   # paste the output as SPY_ENGINE_SECRET= in .env

# apply the Supabase migration (from repo root, via the Supabase SQL editor
# or CLI — this repo has no automated migration runner):
#   supabase/migrations/003_create_spy_signals.sql

cp spy-signal-engine.service /etc/systemd/system/spy-signal-engine.service
systemctl daemon-reload
systemctl enable --now spy-signal-engine
systemctl status spy-signal-engine   # confirm it's active/running

# insert nginx_snippet.conf's location block (WS path ONLY, an exact
# `location =` match — do not widen it to a prefix) into the existing
# HTTPS server {} block in /etc/nginx/sites-available/bogastock.com, then:
nginx -t && systemctl reload nginx

# add the SAME SPY_ENGINE_SECRET value to the frontend's server-only env
# (wherever PM2 loads bogastock-next's environment from, e.g. .env.local /
# ecosystem config on the server) so the Next.js API routes below can
# authenticate to this service. Then restart: pm2 restart bogastock-next --update-env

curl -s http://127.0.0.1:8787/health          # {"status":"ok"}
curl -s -H "X-Spy-Engine-Secret: <the secret>" http://127.0.0.1:8787/history?limit=1
```

## Local sanity checks (before shipping to the server)

```bash
python -m py_compile data_source.py signal_engine.py db.py scheduler.py app.py
```

## Auth model

`/admin/spyengine/live/ws` is served by nginx directly (exact-match
location, WS upgrade only), outside Next.js/proxy.ts entirely — nginx has
no way to check the `boga_auth` cookie there. Instead:

- `/ws` requires `?token=<SPY_ENGINE_SECRET>`; a missing/wrong token gets
  the handshake closed (code 4401) before `accept()`.
- `/history` requires an `X-Spy-Engine-Secret` header — and is not exposed
  via nginx at all; it's only ever called server-side, over localhost, by
  `frontend/app/api/admin/spyengine/live-history` (which itself checks
  `boga_auth` via `isStaffAuthed`).
- The browser learns the token by calling
  `frontend/app/api/admin/spyengine/live-token` (also `isStaffAuthed`-gated)
  — the secret is never baked into the JS bundle or a `NEXT_PUBLIC_*` var.

Both sides read the same `SPY_ENGINE_SECRET` — set it identically in
`spy_signal_engine/.env` and the frontend's server-only environment.
See `tasks/active/014-spy-signal-engine-realtime.md`.
