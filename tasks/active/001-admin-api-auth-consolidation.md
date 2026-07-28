# 001 — Admin API auth consolidation

Status: active
Created: 2026-07-27
Risk: medium — touches live admin authorization on ~24 endpoints
Touches live system: yes — admin API routes on bogastock.com

## Context

`docs/ARCHITECTURE.md` documents the boundary: page-level admin auth is centralized in `frontend/proxy.ts` (checks the `boga_auth` cookie for any `/admin/*` page). But `proxy.ts`'s matcher explicitly excludes `/api/*`, so every admin API route has to enforce its own auth — and most don't use the shared helper.

## Current state (verified facts only)

- `frontend/lib/apiAuth.ts` already exports `isStaffAuthed(req)` (role `admin` or `readonly`) and `isStaffWriteAuthed(req)` (role `admin` only) — correct, reusable helpers.
- ~24 files under `app/api/admin/**` (and related routes like `app/api/store/[key]/route.ts`) instead reimplement the check inline, e.g. `req.cookies.get("boga_auth")?.value === "admin"`.
- Only 16 files import `lib/apiAuth.ts` at all, and mostly for the member-plan checks (`hasDataAccess`/`hasAnyAuth`), not the staff checks.
- No known exploit or bug from this today — it's an inconsistency risk (one of the ~24 could have a subtly different/wrong check) rather than a confirmed vulnerability.

## Proposed change

Route-by-route: replace each inline `boga_auth` check with `isStaffAuthed`/`isStaffWriteAuthed` from `lib/apiAuth.ts`, matching read vs. write semantics per route. Do NOT batch this as a single find/replace — each route's exact current check (does it accept `readonly`? does it require `admin` specifically?) must be read individually first, since a mechanical replace could silently loosen or tighten access.

## Why deferred

Touches live admin authorization on ~24 files in one pass — a single wrong substitution (e.g. downgrading a write-route from `admin`-only to accepting `readonly`) is a real security regression on a live admin panel. Needs a dedicated session with route-by-route review and testing, not bundled into a broad cleanup pass.

## Acceptance criteria

- [ ] Every route under `app/api/admin/**` uses `isStaffAuthed`/`isStaffWriteAuthed` from `lib/apiAuth.ts`, not an inline cookie check.
- [ ] For each route, the read/write semantics (readonly-allowed vs admin-only) match what the route had before — verified by diffing the old inline condition against the helper used.
- [ ] Manual smoke test: log in as `admin` and as `readonly` (if that role is used anywhere) and confirm each converted route still behaves the same.

## Verification steps

1. `grep -rn 'boga_auth' frontend/app/api/` before and after — count should only decrease as routes convert, never increase.
2. `npx tsc --noEmit && npm run build`.
3. Manual login as admin, click through the admin panel's main write actions (theme editing, top100 admin, member management) and confirm no new 403s.
