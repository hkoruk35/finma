# 014 — SPY Signal Engine, Real-Time (replaces Tier1-5 "SPY Option" tab)

Status: active
Created: 2026-09-18
Risk: medium — new standalone Python service (new deploy surface: systemd unit + nginx route on the Hetzner box), new Supabase table, and a new nginx route outside proxy.ts (mitigated via a shared-secret token, see below — not left open)
Touches live system: yes — new Supabase table (`spy_signals`), a new systemd service to be installed on the production Hetzner box, a new nginx `location` block on the live `bogastock.com` server config, and a rewritten "SPY Option" tab in `frontend/app/admin/spyengine/v1/page.tsx`

## Context

`tasks/completed/013-spy-options-decision-page.md` built a Tier1-5 Monte Carlo / delta-implied / heuristic-score / Black-Scholes decision panel entirely inside the Next.js app (`frontend/lib/spyengine/monteCarlo.ts`, `heuristics.ts`, plus the Phase-2 `spy_0dte_options_sync.py` Greeks bridge). The user asked for a different, simpler approach for the "SPY Option" tab specifically: a real 5m-trend + 1m-trigger CALL/PUT SETUP signal, computed by a dedicated always-on Python service (not computed per-request inside a Next.js API route), pushed to the browser live over a WebSocket. This task implements that, replacing only the SPY Option tab's contents — the Tier1-5 computation code in `frontend/lib/spyengine/` (`monteCarlo.ts`, `heuristics.ts`, `decisionLogStore.ts`, etc.) is untouched and keeps feeding the "Faz 1 (ham veri)" disclosure on the Kumanda Merkezi tab.

## Current state (verified facts only)

- `frontend/app/admin/spyengine/v1/page.tsx` lines 1074-1413 held the old SPY Option tab (Tier1-5 panels + `SpyChart` with `levelLines`). Replaced 2026-09-18 — new content keeps only `SpyChart` (no `levelLines`) plus a new live signal-status card and history table.
- `spy_0dte_options_sync.py` and `opsiyon242.py` (repo root) are untouched — out of scope for this task per explicit instruction.
- `spx_engine/` (repo root, abandoned) is untouched — out of scope, confirmed unrelated.
- Root Python bots and the Next.js frontend communicate only through Supabase/static JSON (root `AGENTS.md`) — `spy_signal_engine/` follows the same rule: it never imports frontend code, and the frontend never imports it; they share only the `spy_signals` Supabase table and the nginx-proxied HTTP/WS endpoints.
- Yahoo Finance's `v8/finance/chart/SPY` endpoint is already the data source for `spy_0dte_options_sync.py` (repo root) and `frontend/lib/spyengine/market.ts` — `spy_signal_engine/data_source.py` reuses the same API/pattern, independently (no shared code, per the two-system rule).

## Proposed change / What was built

New top-level directory `spy_signal_engine/` (Python, sibling to other root bot scripts):

- `signal_engine.py` — the user-specified 5m trend+filter -> 1m trigger signal engine, copied verbatim (math/thresholds unchanged).
- `data_source.py` — `YahooDataSource.get_bars(symbol, interval, lookback_minutes)`, reshapes Yahoo's `v8/finance/chart` response into the Robinhood-historicals bar shape (`begins_at`, `open_price`/`close_price`/`high_price`/`low_price`, `volume`, `session`) already used elsewhere in this repo. Session (pre/regular/post) derived from NYSE hours via `zoneinfo`, no market-calendar dependency.
- `db.py` — raw-REST Supabase helpers (`insert_signal`, `fetch_recent`), modeled on `spy_0dte_options_sync.py`/`robinhood_spy_sync.py`'s existing header/URL pattern. Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- `scheduler.py` — 5m-candle-aligned loop (fires at `minute % 5 == 0, second >= 5`, deduped by last-processed bar's `begins_at`) + a 1m trigger loop that only runs while the last 5m trend is UP/DOWN. Runs through market-closed hours, tags every result with `market_status` (open/closed/pre/post). Writes every result (including `NO TRADE`) to Supabase and broadcasts it.
- `app.py` — FastAPI app (`GET /health`, `GET /history?limit=`, `WS /ws`), scheduler launched as an asyncio background task in the same uvicorn process via a `lifespan` context manager. Binds `127.0.0.1:8787` only.
- `requirements.txt`, `.env.example`, `spy-signal-engine.service` (systemd unit, `Restart=on-failure`, runs as root per this box's existing bot convention), `nginx_snippet.conf` (documented `location /admin/spyengine/live/` block for a human to paste into the live nginx config — not applied automatically), `README.md` (deploy checklist).

Supabase: `supabase/migrations/003_create_spy_signals.sql` creates `spy_signals` (dedicated table, not `shared_store`), documented in `docs/DATA_CONTRACTS.md`.

Frontend: `frontend/app/admin/spyengine/v1/page.tsx`'s SPY Option tab (was lines 1074-1413) rewritten to keep only the `SpyChart` (no `levelLines`, Tier1-5 removed) plus a new live status card + "Geçmiş sinyaller" table, fed by `frontend/lib/spyengine/useSpySignalSocket.ts` (WebSocket hook with reconnect/backoff) connecting to `wss://<host>/admin/spyengine/live/ws`, with an initial `GET /admin/spyengine/live/history?limit=20` on mount. Browser `Notification` + a Web Audio API beep fire on CALL/PUT SETUP pushes (not on NO TRADE).

## Why deferred

Not deferred — implemented in this pass. Remaining work is **deployment only** (explicitly out of scope for the implementing session — code/config is complete, a human runs the actual `scp`/`systemctl`/`nginx -t` steps per `spy_signal_engine/README.md`).

## Auth gap — flagged during implementation, closed same session

`/admin/spyengine/live/ws` is served by nginx directly, in front of Next.js — `frontend/proxy.ts`'s `boga_auth` cookie check cannot run for this path (nginx has no way to inspect it). Initial implementation shipped this open (undocumented-path-only "protection"); the user was asked and chose a shared-secret token fix, applied before deploy:

- `spy_signal_engine/app.py`: `/ws` requires `?token=<SPY_ENGINE_SECRET>` (rejected pre-`accept()` with close code 4401 if missing/wrong); `/history` requires an `X-Spy-Engine-Secret` header. Both compared with `hmac.compare_digest`, fail closed if the env var is unset.
- `nginx_snippet.conf` now exposes **only** `/admin/spyengine/live/ws` (exact `location =` match) — `/history` is no longer nginx-reachable at all.
- `frontend/app/api/admin/spyengine/live-token/route.ts` and `.../live-history/route.ts` are new `isStaffAuthed`-gated Next.js routes: the browser gets the WS token only after passing `boga_auth`, and `/history` is fetched server-side over `127.0.0.1:8787` (never exposed publicly).
- Both sides read the same `SPY_ENGINE_SECRET` env var — must be set identically in `spy_signal_engine/.env` and the frontend's server-only env (see `spy_signal_engine/README.md`).

Residual risk: the secret is still fetched into browser JS memory (unavoidable for a direct browser→WS connection) rather than never leaving the server, so a browser-side compromise (XSS) on this admin page could exfiltrate it. Acceptable for now given the page is already staff-only; a future task could move to short-lived signed tokens if this becomes a concern.

## Acceptance criteria

- [x] `signal_engine.py` math is byte-identical to the spec (verbatim copy, only wrapped as a module)
- [x] Data source is Yahoo Finance chart API only — no Robinhood MCP, no robin_stocks, no IBKR
- [x] `spy_signals` is a real dedicated Supabase table with a migration file, documented in `docs/DATA_CONTRACTS.md`
- [x] Every scheduler result (CALL SETUP / PUT SETUP / NO TRADE) is persisted and broadcast — panel always has a heartbeat
- [x] Scheduler keeps running outside RTH, tags `market_status` instead of stopping
- [x] `spy_signal_engine/app.py` binds `127.0.0.1:8787` only (no public direct binding)
- [x] Old Tier1-5 SPY Option tab content removed; `SpyChart` kept, no `levelLines`
- [x] Tier1-5 computation code in `frontend/lib/spyengine/` (monteCarlo.ts, heuristics.ts, decisionLogStore.ts) untouched — still feeds Kumanda Merkezi's Faz 1 disclosure
- [x] No other tab in `page.tsx` modified
- [x] `opsiyon242.py`, `spy_0dte_options_sync.py`, `spx_engine/` untouched
- [x] Auth gap on the new nginx-only route explicitly documented, then closed with a shared-secret token (`SPY_ENGINE_SECRET`) gating `/ws` and `/history`, fetched by the browser only through `isStaffAuthed`-protected Next.js routes
- [ ] Deployed and verified end-to-end on the Hetzner box (pending — human-run per `spy_signal_engine/README.md`)

## Verification steps

- `python -m py_compile` clean for every file in `spy_signal_engine/`
- `cd frontend && npx tsc --noEmit` clean (or only pre-existing unrelated errors)
- Manual confirmation that `page.tsx`'s Kumanda Merkezi / Daily Forecast / 15m vs 5m / Sinyaller & Arşiv / 15m Bağlam & Veri / 15 Gün OHLC tabs are byte-identical to before this change
- After deployment: `curl https://bogastock.com/admin/spyengine/live/health` returns `{"status":"ok"}`; the SPY Option tab shows a connected WebSocket indicator and a populated history table within 5 minutes of market open
