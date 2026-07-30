# finma / bogastock.com

**Live financial trading/analysis platform.** Two independent systems share this repo — they communicate through Supabase and static JSON files, never through direct imports:

1. **Root (Python)**: Bots/scanners run by Windows Task Scheduler (swing, options, intraday, daytrade). No CI deployment — runs on this machine's scheduler only. See `docs/ARCHITECTURE.md` for the full orchestration map.
2. **`frontend/` (Next.js 16)**: bogastock.com web app. Has its own `frontend/AGENTS.md` with build-specific rules — **read it before touching any frontend code**. Next.js 16 APIs differ from earlier versions.

---

## 🔴 Hard Constraints (Do Not Override)

**This is a live system with real users.** Never take an action that could stop it running without explicit user confirmation for that specific action:
- ❌ Delete, force-push, unregister scheduled tasks, rewrite git history
- ❌ Modify Task Scheduler entries or bot activation/deactivation scripts without confirmation
- ❌ Change data pipeline flow (bots → Supabase → frontend) without testing
- ✅ Use `git mv` into `archive/` instead of `rm` for anything not proven to have zero live references
- ✅ Check `tasks/active/` before "fixing" debt — it may already be tracked with reasons it wasn't done yet

---

## Before Making Changes — Documentation Checklist

| When touching | Read first | Why |
|---|---|---|
| **Any code** | `docs/ARCHITECTURE.md` | Understand system structure and intentional debt |
| **Copilot, scoring, "list" features** | `docs/AI_BEHAVIOR.md` | Documents 3 real consistency bugs and the rules preventing recurrence |
| **Python bots, Task Scheduler, deployments** | `docs/RELEASE_CHECKLIST.md` | Shipping/rollback procedures and emergency tools |
| **Supabase, shared_store keys** | `docs/DATA_CONTRACTS.md` | Schema state (including known drift), KV registry |
| **i18n routes, locale layouts** | `docs/LOCALIZATION_RULES.md` | Locale-specific routing rules and inconsistencies |

---

## Work Discipline Rules

### 1. Request Scope — No Unauthorized Changes
**Rule:** Implement only what is explicitly requested. Do not modify UI, styling, or layout outside the stated task.

**Why:** Corrected 3+ times. Example: asked to reorder tracker columns on mobile — also hid 9 other columns/buttons without being asked. Had to revert everything and achieve mobile fit via text truncation only, leaving all columns visible.

**How:** When given "add X translation" or "swap columns Y/Z":
- Implement that literal change only
- Don't touch colors, backgrounds, visibility, layout, or unrelated elements
- If the requirement seems to require removing/hiding other things to fit, ask first — find a way that doesn't remove content
- Before committing, verify the change matches the request exactly and nothing else changed

**Special care:** Top100Tracker/SwingTracker/TrendTracker use Dark Grey (#0f1117) backgrounds — maintain this consistently. Swing page especially — user notes it's the page they're "most sensitive about" (hassas olduğu sayfa).

### 2. Navigation Links — Never Guess Routes
**Rule:** Before wiring any link/button/redirect, search the codebase for the actual route. Don't invent plausible-looking destinations.

**Why:** Corrected twice. Guessed `/admin/stocks/[ticker]` (admin-only, unreachable from public) when the real page was `/global/{locale}/graphic/[ticker]` for all locales.

**How:**
1. Grep/find for the literal route segment first
2. Try both `Glob` and Bash `find` — Glob doesn't match dynamic `[param]` segments literally
3. If the route doesn't exist, say so and ask the user where it should point
4. Never pick an admin equivalent for a public button

### 3. Output Language — Match User's Language
**Rule:** When the user writes in Turkish, respond in Turkish. When English, respond in English.

**Why:** User explicitly requested: "türkçe yazıyorum, türkçe cevap ver" (I write Turkish, answer Turkish) — they'd been getting English responses despite Turkish prompts.

**How:** Track the user's message language turn-by-turn. Code, file paths, commit messages, and technical terms stay in their original form (usually English); prose responses match the user's language choice.

### 4. Task Deferred Work — Check Active Tasks First
**Rule:** Before "fixing" architectural issues, cleaning up dead code, or refactoring, check `tasks/active/`.

**Why:** Known debt is deliberately deferred with reasons — refactoring them as a side effect wastes context and breaks planned work.

**How:**
- `tasks/active/` holds 12+ known issues (each file: context, state, why deferred, acceptance criteria)
- `tasks/completed/` is the archive
- Before starting any cleanup: grep the active list for the topic
- Example: `tasks/active/012-bot-commit-scope-leak.md` — scheduled bots sweep uncommitted code into their own commits — this is on the list with reasons it's deferred

---

## Root Python Layer — Live Orchestration

Confirmed against actual `Get-ScheduledTask` state (2026-07-27), not script claims:

| Orchestrator | Scheduled Task | Runs |
|---|---|---|
| `run_morning_cycle.py` | `BOGA_AI_Morning_Cycle` | daytrade_atmaca_v2.py, update_daytrade_performance.py, fetch_daytrade_options.py |
| `run_afternoon_cycle.py` | `BOGA_AI_Afternoon_Cycle` | append_trend_candidates.py, update_swing_performance.py, fix_swing_performance.py, fetch_live_options.py, options_pnl_tracker.py, site_health_checker.py |
| `run_swing_hourly.py` | `BOGA_AI_Swing_Hourly` | **swing117_boga.py** (only live variant; archived backups in docs/RELEASE_CHECKLIST.md) |
| `run_performance_hourly.py` | `BOGA_AI_Performance_Hourly` | update_swing_performance.py, update_heatmap_prices.py, options_pnl_tracker.py |
| `run_terminal_pulse.py` | `BOGA_AI_Terminal_Pulse` | inday313.py --force, scratch/refresh_terminal_data.py |
| `run_midnight_update.py` | `BOGA_MidnightUniverseUpdate` | universe_builder.py, update_top100_fixed.py |
| `run_copilot_tasks_cron.py` | `BOGA_Copilot_Tasks_Cron` | Calls Next.js Copilot API (not Python) |
| `run_options_scanner.py` | `BOGA_AI_Options_Scanner` | opsiyon242.py |

**Standalone scripts** (not orchestrated): site_health_checker.py, inday313.py, update_top100_hourly.py, update_top100_swing.py, pre_catalyst_scanner.py.

**Task registration source of truth:** `SISTEMI_GUNCELLE.bat` runs setup scripts. Older .bat/.ps1/.xml files at root are archived — deleting them never touches already-registered Task Scheduler jobs.

**Emergency tools** (do not delete; see docs/RELEASE_CHECKLIST.md): `BOTLARI_TAMAMEN_DURDUR.bat`, `TAM_TEMIZLIK.bat`, `FIX_TASKS_ADMIN.bat`.

**CI-driven schedules** (independent of Task Scheduler): `.github/workflows/daily-price-update.yml`, X/social-post workflows.

---

## Frontend Structure

See `frontend/AGENTS.md` for Next.js 16-specific rules and build conventions. See `docs/ARCHITECTURE.md` for route boundaries, lib/ organization, and known architectural debt (001–009).
