# 006 — Financial calculations doc backfill

Status: active
Created: 2026-07-27
Risk: none (documentation only)
Touches live system: no

## Context

`docs/FINANCIAL_CALCULATIONS.md` is a skeleton with pointers to source files, not real formula documentation — writing it properly requires tracing actual code, which wasn't done as part of the 2026-07-27 reorg to avoid guessing.

## Current state (verified facts only)

Known source-of-truth locations (see `docs/FINANCIAL_CALCULATIONS.md` for the current pointer table): `frontend/app/api/preorder-analysis/route.ts` (BOGA score/conviction/Weinstein/Wyckoff), `frontend/lib/tradePlanEngine.ts` (entry/stop/TP zones), `frontend/lib/top100-engine.ts` (ranking score), root `build_swing_performance.py`/`update_swing_performance.py` (backtest P&L), `options_pnl_tracker.py`, `apply_5pct_sl_floor.py` (on the UNCERTAIN list — confirm it's still invoked by something live before documenting it as authoritative).

## Proposed change

Read each source file listed above in full, and write out the actual formulas/thresholds/weightings into `docs/FINANCIAL_CALCULATIONS.md`, with file:line citations for every claim. Where two files compute a similar-sounding number, explicitly verify (don't assume) whether they're the same calculation.

## Why deferred

This is inherently a careful, code-tracing task that shouldn't be rushed as a side effect of a broader reorg — a wrong or guessed formula written into a "canonical" doc is worse than no doc, since future work would trust it.

## Acceptance criteria

- [ ] Every formula in `docs/FINANCIAL_CALCULATIONS.md` has a file:line citation.
- [ ] `apply_5pct_sl_floor.py`'s live status confirmed (referenced by task 008) before its formula is documented as current.
- [ ] No two documented formulas are silently assumed identical without an explicit diff/comparison note.

## Verification steps

Spot-check 2-3 documented formulas against the live code after writing, confirm they match exactly (not just "close enough").
