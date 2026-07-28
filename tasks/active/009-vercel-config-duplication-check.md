# 009 — Vercel config duplication check

Status: active
Created: 2026-07-27
Risk: low to check, medium if resolved incorrectly (could disable a live cron)
Touches live system: possibly — Vercel cron jobs

## Context

Two `vercel.json` files exist in this repo with different cron definitions. Unclear which one is actually authoritative for the deployed project.

## Current state (verified facts only)

- Root `vercel.json`: defines a cron for `fetch-insider-data`.
- `frontend/vercel.json`: defines crons for `telegram-report` and `copilot-tasks`, plus its own `buildCommand`.

Both exist simultaneously; it's not established from code alone whether Vercel is deployed from the repo root or from `frontend/` as its root directory (which would determine which `vercel.json` actually takes effect), or whether these are two separate Vercel projects entirely.

## Proposed change

Check the Vercel dashboard (project settings → Root Directory, and the Cron Jobs tab) to determine: (a) which `vercel.json` is actually being read, (b) whether the other one is stale/orphaned or serves a genuinely separate second Vercel project. Document the answer in `docs/ARCHITECTURE.md`.

## Why deferred

Requires the user's Vercel dashboard access — not resolvable from repo contents alone, and guessing wrong could lead to "fixing" the wrong file and silently breaking a live cron.

## Acceptance criteria

- [ ] Confirmed which `vercel.json` is authoritative (or confirmed both are, for two separate projects).
- [ ] If one is orphaned/stale: archived, with `docs/ARCHITECTURE.md` updated to reflect the single source of truth.
- [ ] All 3 crons (`fetch-insider-data`, `telegram-report`, `copilot-tasks`) confirmed to actually be running (check Vercel's cron execution log), not just defined.

## Verification steps

Vercel dashboard → Cron Jobs → confirm each of the 3 crons shows recent successful executions.
