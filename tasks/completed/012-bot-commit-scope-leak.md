# 012 — Scheduled bots commit/push the whole working tree, not just their own output

Status: completed
Created: 2026-07-28
Completed: 2026-08-10
Risk: medium — already caused one incident, could commit/push broken in-progress work under a misleading message
Touches live system: yes — git history on `main`, pushed to GitHub automatically by a live scheduled task

## Context

Discovered by accident on 2026-07-28: while building the `/global/[locale]/search` feature, my uncommitted frontend source changes (new components, edited `AIContainer.tsx`/`Header.tsx`/`MemberHeader.tsx`/`proxy.ts`/`app/page.tsx`/`app/sitemap.ts`) were sitting in the working tree, verified and ready to commit. Before I could commit them, the `BOGA_AI_Morning_Cycle` scheduled task fired (`run_morning_cycle.py`, 09:15 NY) and its pipeline committed **everything in the working tree** — my full feature plus its own legitimate data updates (`data/latest/stocks/AAPL.json` and copies under `frontend/data/latest/` and `frontend/public/data/latest/`) — as a single commit titled `"Data: Morning Cycle Update 2026-07-28 09:15"`, and pushed it to `origin/main` automatically.

## Current state (verified facts only)

- Commit `0463b36f` (`git show --stat 0463b36f`) contains 14 changed files: 3 are the bot's own `AAPL.json` data copies, the other 11 are unrelated frontend source files from an in-progress, human-authored feature.
- This means one or more scripts in the `run_morning_cycle.py` chain (or a shared helper it calls, e.g. something resembling `update_and_push.py` at root) does an indiscriminate `git add -A` (or equivalent) followed by commit + push, rather than scoping to the specific data paths it actually generates.
- In this instance the swept-up code was already finished and manually verified (tsc/build/browser-tested) before the sweep happened, so no broken code reached `main` — but that was incidental timing, not a property of the pipeline.
- Not yet identified: exactly which script performs the `git add -A`/commit/push (candidates: `update_and_push.py`, or logic inside `run_morning_cycle.py` itself, or one of the sub-scripts it calls — `daytrade_atmaca_v2.py`, `update_daytrade_performance.py`, `fetch_daytrade_options.py`). Needs to be traced, not guessed.

## Proposed change

1. Find the exact script(s) responsible (grep for `git add`, `git commit`, `git push` across the root Python layer and `scratch/`).
2. Change it to stage only the specific paths it's supposed to update (e.g. `git add data/latest/ frontend/data/latest/ frontend/public/data/latest/` or the precise equivalent) instead of `git add -A` / `git add .`.
3. Apply the same audit to every other scheduled job's commit step (`run_afternoon_cycle.py`, `run_swing_hourly.py`, `run_performance_hourly.py`, `run_terminal_pulse.py`, `run_midnight_update.py`, etc.) — this is very likely not unique to the morning cycle.

## Why deferred

Requires tracing through the root Python orchestration layer to find the exact `git` invocation(s) before changing anything — guessing which script to fix risks editing the wrong one and leaving the real culprit (or siblings with the same bug) untouched. Also worth doing as a dedicated pass across *all* scheduled jobs at once rather than a one-off patch for just the morning cycle.

## Acceptance criteria

- [x] Every scheduled job's git-commit step stages only its own known output paths, never the full working tree.
- [x] Verified by manually leaving an unrelated uncommitted change in the working tree and confirming the next scheduled run's commit does NOT include it.

## Verification steps

`git show --stat <next automated commit>` after the fix should only ever list paths the job is actually responsible for.

## Resolution (2026-08-10)

It recurred: while the Supabase-outage fixes were still half-written in the
working tree, `run_terminal_pulse.py` fired and pushed them to `main` as
`9ebce091 "Data: Terminal Pulse 12:00"`.

Traced the `git add` call in every root Python script. Exactly **two** live
orchestrators used the indiscriminate form:

- `run_morning_cycle.py:72` — `run_git(["add", "."])`
- `run_terminal_pulse.py:64` — `run_git(["add", "."])`

Every other scheduled job already staged explicit paths (`run_swing_hourly.py`,
`run_performance_hourly.py`, `run_afternoon_cycle.py`, `run_options_scanner.py`,
`run_midnight_update.py`, `update_and_push.py`, `opsiyon242.py`), so no change
was needed there.

Both now use a shared `DATA_ONLY_PATHSPEC` constant: `git add -A -- .` plus
`:(exclude,glob)` entries for every source/config location. A **denylist** was
chosen over the allowlist this file originally proposed — with an allowlist, a
new data directory would silently stop being committed and the data pipeline
would break quietly, which is the worse failure (see AGENTS.md "Hard
Constraints"). With a denylist, data keeps flowing by default and code is
structurally blocked.

One trap worth recording: `scratch/` **cannot** be named in the pathspec. It is
in `.gitignore`, and naming an ignored path explicitly makes `git add` exit 1 —
both bots call it under `check=True`, so the data commit would never have been
created at all. Caught by dry-run before shipping; `scratch/` is deliberately
absent from the list.

Verified by the acceptance test above: with `frontend/lib/formatNumber.ts`,
`update_heatmap_prices.py`, both bot scripts and `frontend/next-env.d.ts` left
dirty in the working tree, plus a new `frontend/public/data/_scope_test.json`,
the bot pathspec staged 12 paths — all data, including the new JSON — and
**zero** code files. `git add .` staged all of them.
