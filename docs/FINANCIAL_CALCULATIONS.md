# Financial Calculations

**Status: skeleton.** Full formula trace is `tasks/active/006-financial-calculations-doc-backfill.md` — must be written by reading the actual source, never by guessing/recalling from memory of similar systems.

## Where the real math lives (confirmed 2026-07-27)

| Calculation | Source of truth |
|---|---|
| BOGA Score / conviction (0–100), Weinstein stage, Wyckoff phase/score, active signals/warnings | `frontend/app/api/preorder-analysis/route.ts` — single live-scoring engine, see `docs/AI_BEHAVIOR.md` Rule 2 for the hysteresis/cache-TTL safeguards around it |
| Trade plan zones (entry range, stop, TP1–3) | `frontend/lib/tradePlanEngine.ts` (`calculateTradePlanZones`, `buildTradePlanRationale`) |
| Public Top100 ranking score | `frontend/lib/top100-engine.ts` |
| Swing performance / backtest P&L | `build_swing_performance.py`, `update_swing_performance.py` (root) |
| Options P&L tracking | `options_pnl_tracker.py` (root) |
| 5% stop-loss floor rule | `apply_5pct_sl_floor.py` (root) — **on the UNCERTAIN list**, confirm it's still invoked by something live before treating it as authoritative (see `tasks/active/008`) |
| Day-trade signals | `daytrade_atmaca_v2.py` (root) |

## Rule for filling this doc in

Every formula written here must cite the exact file:line it was read from. If two files compute a similar-looking number (e.g. a "score"), don't assume they're the same calculation — diff them explicitly (this is exactly the class of bug documented in `docs/AI_BEHAVIOR.md`).
