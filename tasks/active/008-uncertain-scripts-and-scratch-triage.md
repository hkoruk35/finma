# 008 — Uncertain scripts and scratch/ triage

Status: active
Created: 2026-07-27
Risk: low per-item once triaged, but requires human judgment per file — not automatable
Touches live system: possibly — some of these may be live manual tools

## Context

The 2026-07-27 cleanup pass only touched files with **confirmed zero references** anywhere in the repo. A second tier of files couldn't be confirmed dead (not scheduled, but not proven unused either — likely manual/on-demand tools) and was explicitly left alone.

## Current state (verified facts only)

**Root-level UNCERTAIN scripts** (not in Task Scheduler, not proven dead):
`apply_5pct_sl_floor.py`, `backfill_profit_targets.py`, `fix_incorrect_losses.py`, `reopen_false_losses.py`, `reopen_false_losses_ema50.py`, `restore_watchlist.py`, `single_ticker_analyser.py`, `make_themes.py`, `send_x_queue.py`, `top100_sync_common.py`, `update_and_push.py`.

**Paired with**: `BASLAT_X_GONDERI.bat` (manual trigger for `send_x_queue.py`) — triage together.

**`scratch/` folder** (59 files, gitignored since 2026-07-13 due to a past leaked-credential incident): confirmed **not** pure clutter — `scratch/refresh_terminal_data.py` is live (called by `run_all_bots.py`... wait, `run_all_bots.py` was archived as dead in this pass; confirm what *actually* still calls `refresh_terminal_data.py` post-archival — likely `run_terminal_pulse.py`, re-verify), and `scratch/setup_boga_tasks.ps1` + `scratch/setup_performance_hourly.ps1` are the current live task-registration source (see `docs/ARCHITECTURE.md`). The other ~56 files need individual review.

**Also untriaged, found but not verified**: `test.html`, `test.js`, `test_universe.py`, `sync_swing_stocks.js`, `update_nav.js`, `swing_debug.js`, `parse_themes.js`, `debug_dates.js`, `check_losses.py`, `boga_screener_cockpit.html`, `get-pip.py`, `113out/` (30 files, zero references found but not part of the confirmed-safe cleanup this round).

## Proposed change

Go through each file/folder above with the user (they'll know which manual tools they still run by hand): confirm still-in-use vs. safe to archive. For `scratch/`, list all 59 filenames with mtimes and ask which are recognized as active vs. forgotten.

## Why deferred

These files are not scheduled and not imported by anything, but that's not proof of deadness for manual/on-demand tools — only the person who runs them knows. Auto-archiving based on "no scheduled reference found" risks losing a tool the user runs by hand periodically.

## Acceptance criteria

- [ ] Each UNCERTAIN file has an explicit user decision: keep, archive, or delete.
- [ ] `scratch/` fully inventoried and triaged (not just the 3 known-live files).
- [ ] `113out/` decision made (archive vs. delete vs. keep).

## Verification steps

After archiving anything from this list: re-run the same live-reference verification used in the 2026-07-27 pass (`git grep` for the filename, cross-check against `Get-ScheduledTask` state) before finalizing.
