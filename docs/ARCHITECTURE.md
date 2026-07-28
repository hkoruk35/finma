# Architecture

Two independent systems share this repo. Neither imports the other directly — they communicate through Supabase and static JSON files written to `frontend/public/`.

```
finma/                      Root: Python bot/scanner layer (Windows Task Scheduler)
├── swing117_boga.py            LIVE — hourly swing scanner (see run_swing_hourly.py)
├── run_*.py                    Orchestrators, each with a live scheduled task
├── opsiyon242.py                LIVE — options scanner
├── inday313.py                  LIVE — intraday/terminal-pulse scanner
├── data/, logs/, transfer/      Active runtime output (git-tracked)
├── scratch/                     Mixed: some live scripts, some clutter — gitignored, see tasks/active/008
├── archive/                     Confirmed-dead code, kept for history — never imported by anything live
└── frontend/                Next.js 16 app (bogastock.com)
    ├── app/admin/**             Admin panel, auth via proxy.ts (page routes only)
    ├── app/global/[locale]/**   Public app (see docs/LOCALIZATION_RULES.md — inconsistent today)
    ├── app/api/**                86 routes: public, member-gated, admin, cron, bot-pipeline
    ├── lib/                      Data fetching, scoring engines, Copilot subsystem, Supabase clients
    └── components/               public/, global/, admin/, and ~72 flat top-level files
```

## Root Python layer — live orchestration map

Confirmed against actual `Get-ScheduledTask` state (2026-07-27), not just script claims:

| Orchestrator | Scheduled task | Runs |
|---|---|---|
| `run_morning_cycle.py` | `BOGA_AI_Morning_Cycle` | `daytrade_atmaca_v2.py`, `update_daytrade_performance.py`, `fetch_daytrade_options.py` |
| `run_afternoon_cycle.py` | `BOGA_AI_Afternoon_Cycle` | `append_trend_candidates.py`, `update_swing_performance.py`, `fix_swing_performance.py`, `fetch_live_options.py`, `options_pnl_tracker.py`, `site_health_checker.py` |
| `run_swing_hourly.py` | `BOGA_AI_Swing_Hourly` | **`swing117_boga.py`** (the only live variant — see `docs/RELEASE_CHECKLIST.md` for the archived backup family) |
| `run_performance_hourly.py` | `BOGA_AI_Performance_Hourly` | `update_swing_performance.py`, `update_heatmap_prices.py`, `options_pnl_tracker.py` |
| `run_terminal_pulse.py` | `BOGA_AI_Terminal_Pulse` | `inday313.py --force`, `scratch/refresh_terminal_data.py` |
| `run_midnight_update.py` | `BOGA_MidnightUniverseUpdate` | `universe_builder.py`, `update_top100_fixed.py` |
| `run_copilot_tasks_cron.py` | `BOGA_Copilot_Tasks_Cron` | Calls the Next.js Copilot task API (not a Python script) |
| `run_options_scanner.py` | `BOGA_AI_Options_Scanner` | `opsiyon242.py` |

Standalone scheduled scripts: `site_health_checker.py`, `inday313.py`, `update_top100_hourly.py`, `update_top100_swing.py`, `pre_catalyst_scanner.py`.

**Task registration source of truth**: `SISTEMI_GUNCELLE.bat` runs `scratch/setup_boga_tasks.ps1` + `scratch/setup_performance_hourly.ps1` + `setup_options_task_v241.ps1`. Older `.bat`/`.ps1`/`.xml` setup scripts at root that predate this are archived under `archive/legacy-task-setup/` — deleting/archiving those *files* never touches an already-registered Task Scheduler job (OS scheduler state is independent of the script file existing).

**Emergency tools — do not delete, see `docs/RELEASE_CHECKLIST.md`**: `BOTLARI_TAMAMEN_DURDUR.bat`, `TAM_TEMIZLIK.bat`, `FIX_TASKS_ADMIN.bat`.

Also two CI-driven schedules independent of Windows Task Scheduler: `.github/workflows/daily-price-update.yml` (`update_swing_performance.py`) and two X/social-post workflows (Next.js API triggers, not Python).

## Frontend — route boundary

- **Admin** (`app/admin/**`, 90 pages): cleanly isolated. Page-level auth centralized in `frontend/proxy.ts` (Next.js 16's renamed `middleware.ts`) checking the `boga_auth` cookie. **Known gap**: `proxy.ts`'s matcher excludes `/api/*`, so ~24 admin API routes reimplement their own inline `boga_auth` check instead of the shared `lib/apiAuth.ts` helpers (`isStaffAuthed`/`isStaffWriteAuthed`). See `tasks/active/001-admin-api-auth-consolidation.md`.
- **Public**: split across 4 parallel schemes — `app/global/{en,es,fr,pt,tr}/**` (current, but only `themes/[theme]` uses real dynamic `[locale]` routing; the other ~23 pages per locale are hand-duplicated folders) plus legacy `app/en/`, `app/tr/`, `app/daily/`, `app/[lang]/[slug]/[ticker]/`. This is migration debris, not a deliberate design — see `tasks/active/002-public-route-consolidation-investigation.md` before touching any of it (SEO/live-URL risk).

## lib/ — by category (73 files)

| Category | Examples |
|---|---|
| Core data fetching | `data.ts`, `data-server.ts`, `symbols.ts`, `homeFeed.ts` |
| Scoring/analysis engines | `tradePlanEngine.ts`, `top100-engine.ts`, `indicators.ts`, `marketCommentaryEngine.ts` |
| Theme/content | `hotThemes2026.ts` (static base list), `themeOverrides.ts` (Supabase merge — **always use this for tickers, never read `HOT_THEMES_2026[...].stocks` directly**, see `docs/AI_BEHAVIOR.md`) |
| Copilot subsystem | `lib/copilot/*` (22 files — liveAnalysis, deepAnalysis, personalization, stockData, tasksEngine, persona) |
| Supabase/infra | `supabase.ts`, `supabase-admin.ts` (service-role, server-only), `supabase-browser.ts`, `supabase-server.ts` |
| i18n | `i18n/copy.ts`, `analysis-langs.ts`, `translationHelpers.ts` |

## Data layer — see `docs/DATA_CONTRACTS.md`

Supabase schema has confirmed drift: 5 tables used in code with no migration file. Treat any `shared_store`-backed feature as a de facto schema even though it's not in `supabase/migrations/`.

## Known architectural debt (tracked, not yet fixed)

- `tasks/active/001` — admin API auth consolidation
- `tasks/active/002` — public route consolidation investigation
- `tasks/active/003` — Supabase migration backfill
- `tasks/active/009` — duplicate Vercel config (root `vercel.json` vs `frontend/vercel.json`)
