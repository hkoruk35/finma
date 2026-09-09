# 013 — SPY Options Decision Page ("Karar Sayfası")

Status: active
Created: 2026-09-09
Risk: low (new tab, no existing live logic modified) — but will introduce a new Supabase key and a new Python→Supabase writer
Touches live system: yes — new Supabase writes (opsiyon242.py bridge); no existing pipeline (bots → Supabase → frontend) is modified

## Context

User proposed a new tab in `/admin/spyengine/v1` (after "Kumanda Merkezi") that combines a 5-minute price-probability model, a market-implied anchor from option prices, two new heuristic scores (Reversal Score, Seller Exhaustion), and an option Greeks/premium panel, into one SPY-only 0DTE decision surface. The original proposal claimed this could mostly reuse existing infrastructure ("Monte Carlo tabanlı 5m tahmin modülü", "opsiyon_scalp_v1.py" IBKR connection). Verification in this session found both claims false. A separate, unrelated discovery (`spx_engine/`, an undocumented package with overlapping 0DTE SPX simulation logic) was confirmed by the user to be abandoned and is explicitly **not** reused here, to avoid resurrecting dead code.

This file is the Phase 0 scope/data-source document per the roadmap agreed with the user; it precedes any implementation.

## Current state (verified facts only)

- **`frontend/lib/spyengine/`** — the live SPY Engine V6.0 (15m veto, hacim vetosu/RVOL, 5m Layer 1 trend, 1m breakout+RSI7 trigger, priority-ordered exit). No Monte Carlo/GBM code exists anywhere in the repo for SPY 5-minute forecasting.
- **`frontend/lib/spyengine/manualForecastStore.ts`** — the "Tahmin Girişi" panel is a pure hand-entered 5m OHLC forecast (Supabase key `spyengine_manual_forecast`), zero simulation logic. Not a Monte Carlo source; at most its storage shape/comparison UI could inform the new panel's presentation, nothing computational.
- **`opsiyon242.py`** (repo root) — real, working Black-Scholes Greeks (`bs_greeks()`) + 5-engine 0-100 score (`trend_score`+`mom_score`+`bs_score`+`vol_score`+`opt_score`). Confirmed accurate. Scans a multi-ticker universe (sector ETFs / `boga_universe.txt`); SPY today is used only as a **regime reference** input (VIX/SPY/QQQ relative strength, gap detection), not as a scan target with its own contract recommendation.
- **No IBKR integration exists anywhere** (`opsiyon_scalp_v1.py` does not exist; no `ib_insync`/`ibapi` import found in the repo). Live data today comes from Yahoo Finance (`frontend/lib/spyengine/market.ts`) plus a Robinhood overnight-bars bridge (`robinhood_spy_sync.py` → Supabase table `robinhood_spy_bars`, read in `market.ts`).
- **Historical data ceiling**: Yahoo's live `fetchChart` gives ~5-7 days of 1m bars, up to 60 days of 5m bars (already exploited for the RVOL baseline — `fetchSpy5mHistory()` in `market.ts`). No root Python system stores a longer-running 1m/5m OHLCV archive. No true historical options-chain/IV series exists anywhere — `data/{date}/options_outcomes.json` and `frontend/public/*options*.json` are daily archives of live-fetched quotes/P&L outcomes, not a time series of premiums.
- **Two-system architecture is hard** (per root `AGENTS.md`): the Python bot layer and the Next.js frontend never import each other; they communicate only through Supabase and static JSON files. Any Python-computed value (e.g. opsiyon242's Greeks/score for SPY) must reach the frontend via a Supabase write + read, not a function call.
- **`docs/DATA_CONTRACTS.md`** documents no options-related `shared_store` key today. `robinhood_spy_bars` itself is undocumented drift on top of already-documented drift (noted here, not fixed here — out of scope).
- **`spx_engine/`** (root, ~2400 lines, SQLite-backed, background-loop worker) does 0DTE/1DTE SPX option simulation with meaningful overlap to this feature's goals — confirmed by the user to be abandoned/unused. Not referenced, not reused, not extended by this task.

## Decisions made (this session)

1. **Scope: SPY ETF only.** No generalization to other tickers.
2. **Data source: existing Yahoo Finance + Robinhood bridge** (the same pattern `market.ts` already uses). No IBKR integration.
3. **opsiyon242.py stays the Greeks/score engine of record.** Its SPY-specific output (once added — see Proposed change §5) reaches the frontend via a **new periodic Supabase write**, read by the frontend like every other bot-fed panel. No direct import either direction.
4. **The Monte Carlo density/touch model is new work, not an extension of anything that exists.** It will live entirely inside `frontend/lib/spyengine/` (pure TypeScript, computed per request in the API route) rather than as a new Python service — this avoids standing up new scheduling infrastructure for a model whose only inputs (spot, realized vol, 5m history) are already available to the frontend.
5. **`spx_engine/` and `opsiyon_scalp_v1.py` are out of scope** — not resurrected, not referenced.

## Proposed change (Phase 0 → Phase 1 boundary)

1. **Realized volatility estimator** — `sigma` from trailing 5m log-returns (window TBD at implementation, likely last 60-90 5m bars ≈ several trading hours), recomputed each poll from data already fetched for the engine (`m5All`/`chartM5`).
2. **Intraday seasonality multiplier** — reuse the *already-fetched* 60-day 5m history (`fetchSpy5mHistory()`, the exact same dataset the RVOL baseline uses) to build a time-of-day realized-vol curve (U-shape: high at open/close, low midday). No new fetch needed — this is an extension of existing infrastructure, unlike the plan's original (false) Monte Carlo claim.
3. **Monte Carlo density + touch simulation** — new pure function(s), e.g. `frontend/lib/spyengine/monteCarlo.ts`: GBM paths seeded from current spot + seasonality-adjusted sigma, producing (a) time-in-band density and (b) level-touch probability as two explicitly separate numbers (per the plan's §2.1 finding — these are not interchangeable and must never share a label).
4. **Market-implied anchor** — delta-implied probability read from the *already-fetched* live option chain (`fetchOptionSeries`/`fetchAtmContract` in `market.ts`). No new data source.
5. **opsiyon242.py → Supabase bridge for SPY** — opsiyon242.py needs a SPY-specific computation path (today SPY is regime-context only, not a scanned/scored ticker); its Greeks + score + a premium-sensitivity curve (multiple target prices, not one point estimate — per plan §2.5/§4) get written to a new `shared_store` key (proposed: `spyengine_option_decision`) on the existing scheduled-task cadence. Add the key to `docs/DATA_CONTRACTS.md` when implemented.
6. **Heuristic scores (Reversal Score, Seller Exhaustion)** — new TS functions, explicitly labeled **"Skor"** in the UI, never "olasılık/probability", until Phase 4 calibration. Every input (RSI reversal, MACD, price/EMA, VWAP, breadth, VIX — with the plan's own correction: short-horizon realized vol replaces VIX, SPX dropped as redundant with SPY) computed from data the engine already has.
7. **Backtest/calibration data gap — deliberately deferred, not blocking Phase 1.** No historical options-chain series exists and none will be retrofitted; recommendation is to start logging every decision-page snapshot (Monte Carlo output, scores, opsiyon242 output) to Supabase/JSON *going forward* from first ship, so Phase 4 calibration has real data to work with in weeks rather than needing a new historical-data project first.
8. **UI**: every displayed number carries its Tier (1 Fiyat Modeli / 2 Piyasa Beklentisi / 3 Rejim+Skor / 4 Opsiyon Motoru / 5 Edge Skoru) per the plan's §7 hierarchy — no unlabeled percentage anywhere. Edge Skoru is continuous 0-100, never a hard "NO TRADE" gate (matches the codebase's existing move away from binary AND-gates, e.g. the SPY Engine V6.0 simplification).

## Progress

- **Phase 0 — done** (this document).
- **Phase 1 — done**: `frontend/lib/spyengine/volatility.ts` (realized vol + seasonality, reusing the RVOL baseline's 60-day 5m dataset, no new fetch) and `frontend/lib/spyengine/monteCarlo.ts` (GBM density+touch, deterministic per closed 5m bar via `seedFromBar`) shipped. Wired into `/api/admin/spyengine/v2` as a `monteCarlo` response field and surfaced in a clearly-labeled "Faz 1 — 5m Monte Carlo (deneysel)" disclosure on the Kumanda Merkezi tab for verification — not yet a decision panel, no new tab yet.
- **Phase 2 — done**: `spy_0dte_options_sync.py` (repo root, new/standalone — `opsiyon242.py` untouched) fetches SPY's 0DTE (or nearest-available, with an automatic fallback loop if the "today" expiry has already closed — see `expiry_candidates()`) option chain, computes real Black-Scholes call+put Greeks (own implementation, not reused from `opsiyon242.bs_greeks` since that one is call-only) and a per-strike premium-sensitivity curve across ATM±3 target prices, and writes it directly to Supabase `shared_store` key `spyengine_option_decision` via raw REST (same pattern as `robinhood_spy_sync.py` — the `/api/internal/*-sync` + `x-revalidate-secret` path was avoided because that secret is documented elsewhere as not matching between local `.env` and the deploy host). **Scheduling revised 2026-09-09**: initially wired into `run_options_scanner.py` (11:00 & 15:30 NY), but the user asked for a much tighter cadence given 0DTE Greeks move fast intraday — moved to its own `run_spy_0dte_options_sync.py` wrapper + a dedicated `BOGA_AI_SPY_0DTE_Options` Task Scheduler entry (09:45 NY, then hourly through 15:45 NY, weekdays), added to `scratch/setup_boga_tasks.ps1` (the confirmed source of truth per root `AGENTS.md`). **Not yet actually registered** — requires running `SISTEMI_GUNCELLE.bat` as Administrator (cannot be done from an unattended/non-interactive session; UAC elevation required). Read side: `frontend/lib/spyengine/optionDecisionStore.ts` + a `optionDecision` field on the v2 route + a "Faz 2 (deneysel)" disclosure on the command tab. **Verified end-to-end against live Supabase and a live Yahoo 0DTE chain** (real Greeks confirmed non-zero, e.g. delta 0.55/-0.44 for a near-ATM 1-day contract) — an initial run exposed and fixed two real bugs: (a) Greeks degenerate to zero if the picked expiry has already closed for the day (T≤0) — now falls back to the next expiry automatically; (b) a Turkish-character `print()` crashed under Windows' default cp1252 console encoding *after* the Supabase write had already succeeded, misreporting a real success as a failure in the scheduler log — fixed via `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`.
- **Phase 3-5 — not started**: Reversal Score / Seller Exhaustion heuristics (labeled "Skor", not probability), calibration once data accumulates, dedicated Karar Sayfası tab combining Tiers 1-5.

## Why deferred

Not deferred — active, in progress per above.

## Acceptance criteria

- [x] Realized-vol estimator and seasonality multiplier ship as pure, warm-up-safe TS functions (return `null` on insufficient data, never fabricate) — `volatility.ts`
- [x] Monte Carlo density and touch probability are computed and displayed as two distinctly labeled numbers, never conflated — `monteCarlo.ts` + Faz 1 disclosure panel
- [ ] Market-implied anchor comes only from real live option-chain data; `null` if the chain fetch fails
- [x] SPY 0DTE Greeks/premium-curve output reaches Supabase and is documented in `docs/DATA_CONTRACTS.md` — via a standalone `spy_0dte_options_sync.py`, not a modification of `opsiyon242.py` (see rationale in Proposed change §5 and Progress above)
- [ ] No placeholder values (`-0.XX`, `+$XXX`) ship to production
- [ ] Reversal Score / Seller Exhaustion are labeled "Skor", not probability, until calibrated
- [ ] Every number on the new tab is visually tagged with its Tier (1-5)
- [ ] Edge Skoru is continuous (0-100); no hard-gated "NO TRADE" zone
- [ ] Decision-page snapshots are logged from first ship for future calibration
- [ ] New tab sits after "Kumanda Merkezi" in `/admin/spyengine/v1`

## Verification steps

- `npx tsc --noEmit` / `npx eslint` clean in `frontend/`
- Manual spot-check of Monte Carlo/seasonality output against a few real sessions (sanity, not full calibration — that's Phase 4)
- Confirm no direct Python↔TypeScript import is introduced anywhere (Supabase/JSON only, per `AGENTS.md`)
- Confirm `spx_engine/` and `opsiyon_scalp_v1.py` remain untouched/unreferenced
