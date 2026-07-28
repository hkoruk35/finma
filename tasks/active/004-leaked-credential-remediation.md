# 004 — Leaked credential remediation

Status: active
Created: 2026-07-27
Risk: high — live, already-exposed credentials
Touches live system: yes — Telegram bot, Alpha Vantage API, GitHub Actions

## Context

Found during the 2026-07-27 repo audit: multiple live secrets committed to git (some still tracked as of this writing, minus the one item fixed in this same pass — see below).

## Current state (verified facts only)

1. **Fixed in this pass**: root file `env` (bare, no dot — distinct from the correctly-gitignored `.env`) was tracked in git (e.g. commit `54badeb7`) containing a Telegram bot token and an Alpha Vantage API key, despite its own header comment saying "GIT'E EKLENMEMELİ" (must not be committed). `git rm --cached env` was run and `env`/`venv313/` added to `.gitignore` — the file is now untracked going forward, but **still exists in git history** on GitHub (`github.com/hkoruk35/finma`).
2. **Not fixed — still live in source**: `frontend/lib/telegram.ts` line 3 hardcodes a fallback Telegram bot token literal: `process.env.TELEGRAM_API_KEY || "<token>"`. This file is actively used (not dead code).
3. **Not fixed — still live**: `.github/workflows/telegram-report.yml` hardcodes a cron secret directly in the committed YAML as a URL query param (`?secret=...`), unlike the other two X-related workflows which correctly use `secrets.X_CRON_SECRET`.

## Proposed change

1. **User's own action (external accounts, cannot be done by an agent)**: rotate the Telegram bot token (via @BotFather) and the Alpha Vantage API key.
2. Once rotated: remove the hardcoded fallback literal in `frontend/lib/telegram.ts` line 3 (replace with a required env var + explicit error if missing — no silent fallback to a literal).
3. Generate a new random cron secret, add it as a GitHub Actions repo secret (e.g. `TELEGRAM_CRON_SECRET`), update `.github/workflows/telegram-report.yml` to use `${{ secrets.TELEGRAM_CRON_SECRET }}` instead of the hardcoded value, and update whatever `/api/cron/telegram-report` checks against.
4. **Explicitly out of scope, standing decision for the user**: rewriting git history to purge the old `env` file / old token values from past commits. This requires a force-push and coordination (anyone who's cloned the repo would need to re-clone). Given the tokens will be rotated anyway (making the historical values inert), the standard recommendation is: rotate + move on, skip the history rewrite, unless the user has a specific reason to want it scrubbed (e.g. compliance).

## Why deferred

Steps 1 requires the user's own external-account access (Telegram, Alpha Vantage) — not something an agent can do. Steps 2-3 are safe to do immediately *after* rotation, but doing them *before* rotation would just replace one exposed value with a "missing env var" error in production (the token is still the live one, so removing the code fallback doesn't reduce exposure until the underlying token is rotated).

## Acceptance criteria

- [ ] Telegram bot token rotated.
- [ ] Alpha Vantage API key rotated.
- [ ] `frontend/lib/telegram.ts` no longer contains a hardcoded token literal.
- [ ] `.github/workflows/telegram-report.yml` uses a GitHub Actions secret, not a literal in the YAML.
- [ ] Decision recorded on whether git history gets rewritten (default recommendation: no, rotate instead).

## Verification steps

1. `git grep -i "AAF-\|AAHM"` (or similar token-shaped strings) across the repo returns nothing after remediation.
2. Telegram bot still posts successfully with the new token (manual trigger of `run_copilot_tasks_cron.py` or the relevant workflow).
3. `.github/workflows/telegram-report.yml` diff shows `secrets.*` usage, not a literal.
