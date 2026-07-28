# 003 — Supabase migration backfill

Status: active
Created: 2026-07-27
Risk: low (documentation/reproducibility work, doesn't touch live data) if done correctly; medium if column types are guessed wrong
Touches live system: no — writes new migration files only, doesn't alter live tables

## Context

`docs/DATA_CONTRACTS.md` documents 5 tables used in live code with no migration file — created out-of-band (Supabase dashboard), meaning `supabase/migrations/` doesn't reproduce production schema.

## Current state (verified facts only)

`frontend/supabase/migrations/` has exactly 1 file: `001_create_site_visitors.sql`. These 5 tables are referenced in code with no corresponding `CREATE TABLE`:

| Table | Used by |
|---|---|
| `shared_store` | `app/api/store/[key]/route.ts`, `lib/themeOverrides.ts`, `lib/smartTracker.ts` |
| `site_visitors` | `lib/visitor-store.ts` (note: a migration file NAME suggests this exists already — confirm whether `001_create_site_visitors.sql`'s actual schema matches what `visitor-store.ts` expects, since the audit flagged this as needing double-checking, not assumed correct) |
| `csp_watchlists` | `app/api/csp-watchlist/[slug]/route.ts` |
| `custom_watchlists` | `lib/copilot/personalization.ts`, `app/api/watchlist/custom/route.ts` |
| `removed_hot_themes` | `app/api/hot-themes/remove/route.ts` |

## Proposed change

For each table: query live Supabase `information_schema.columns` (via `supabaseAdmin` or the dashboard) to get the exact column list/types/constraints, then write a matching `CREATE TABLE IF NOT EXISTS` migration file. Do this one table at a time, verifying against live schema each time.

## Why deferred

**Must not guess column types or write speculative migration SQL** — a migration that doesn't exactly match live schema could break local dev (`supabase db reset`) without anyone noticing until it's needed, which defeats the purpose. Requires direct schema introspection, not code-reading alone.

## Acceptance criteria

- [ ] One migration file per table, each verified against live `information_schema` output (paste the actual query result into the task/PR for review).
- [ ] `001_create_site_visitors.sql` cross-checked against live `site_visitors` schema — confirm it's not already stale/incomplete.
- [ ] Local `supabase db reset` (if a local Supabase instance is used) reproduces all 5 tables correctly.

## Verification steps

1. For each table: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '<table>';` against the live DB, compare to the migration file written.
2. Confirm no live route breaks after applying migrations to a fresh local/staging DB.
