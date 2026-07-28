# finma / bogastock.com

Live financial trading/analysis platform. Two independent halves in this repo — see `docs/ARCHITECTURE.md` for the full map:

1. **Root**: Python bots/scanners run by Windows Task Scheduler (swing scanner, options scanner, intraday scanner, daytrade bot). Nothing here is deployed via CI — it runs on this machine's scheduler.
2. **`frontend/`**: Next.js 16 app (bogastock.com). Has its own `AGENTS.md` with build-specific notes — read it before touching frontend code, its Next.js APIs differ from what you may expect.

## Before making changes

- Read `docs/ARCHITECTURE.md` for the current structure and known architectural debt (things intentionally not yet fixed — check `tasks/active/` before "fixing" them as a side effect).
- Read `docs/AI_BEHAVIOR.md` before touching Copilot, any scoring/threshold engine, or any "list" feature (theme/tracker/watchlist) — it documents 3 real consistency bugs and the rules that prevent them recurring.
- Read `docs/RELEASE_CHECKLIST.md` before shipping anything, and before touching the root Python/Task Scheduler layer.
- `docs/DATA_CONTRACTS.md` documents the Supabase schema (including known drift) and the `shared_store` KV key registry.

## Hard constraint

This is a live system with real users. Never take an action (delete, force-push, unregister a scheduled task, rewrite git history) that could stop it running, without the user's explicit confirmation for that specific action. Prefer `git mv` into `archive/` over `rm` for anything not proven to have zero live references.

## Task tracking

`tasks/active/` holds known, deliberately-deferred work (each file: context, current state, why deferred, acceptance criteria). `tasks/completed/` is the archive once done. Check `tasks/active/` before starting speculative cleanup — it may already be tracked with reasons it wasn't done yet.
