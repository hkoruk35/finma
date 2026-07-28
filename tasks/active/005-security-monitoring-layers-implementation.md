# 005 — Security monitoring layers implementation

Status: active
Created: 2026-07-27
Risk: low (net-new infrastructure, additive)
Touches live system: yes, once implemented — new Supabase table, possibly new rate-limiting provider (Upstash), possibly Cloudflare

## Context

`docs/SECURITY_MONITORING_PLAN.md` (relocated from `frontend/GUVENLIK_IZLEME.md`, dated 2026-07-13) is a real, current design document — but describes a system that is **not yet built**.

## Current state (verified facts only)

The plan proposes 4 layers, following a 2026-07-13 audit that fixed 4 "silent" vulnerabilities (public JSON score leakage, unauthenticated paid AI endpoints, missing security headers, unprotected admin pages):
1. A regression smoke-test script.
2. A Supabase `security_events` table + daily anomaly digest.
3. Moving the current in-memory (per-instance, unreliable on Vercel's multi-instance serverless) rate limiter to Upstash Redis.
4. Optional Cloudflare WAF.

None of the 4 are confirmed built as of this audit.

## Proposed change

Implement the 4 layers in priority order (2 and 3 likely matter most for a live financial platform with real user data — 1 and 4 are process/infra hardening). Read `docs/SECURITY_MONITORING_PLAN.md` in full before starting; it already has the design, this task is about execution.

## Why deferred

Net-new infrastructure work (new DB table, possibly a new paid third-party service for rate limiting) — needs its own scoped session, not a side effect of a cleanup pass. Also worth revisiting task 001 (admin API auth consolidation) first, since layer 2's anomaly detection would be more useful once admin auth is consistent.

## Acceptance criteria

- [ ] `security_events` table exists with a migration file (see task 003's pattern — write the migration properly this time, don't create the schema-drift problem again).
- [ ] Rate limiting works correctly across multiple Vercel instances (test by triggering it from two different regions/requests in quick succession).
- [ ] Daily anomaly digest actually sends (Telegram or email) and has been observed at least once with real data.

## Verification steps

Per `docs/SECURITY_MONITORING_PLAN.md`'s own testing section (read it — don't skip because this task file is short).
