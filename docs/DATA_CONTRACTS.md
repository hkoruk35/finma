# Data Contracts

## Supabase — schema drift (confirmed 2026-07-27)

`frontend/supabase/migrations/` has only 1 tracked migration (`001_create_site_visitors.sql`). These tables are used live in code with **no corresponding migration file** — they were created out-of-band (Supabase dashboard), so a fresh `supabase db reset` would not reproduce production schema:

| Table | Used by |
|---|---|
| `shared_store` | `frontend/app/api/store/[key]/route.ts`, `frontend/lib/themeOverrides.ts`, `frontend/lib/smartTracker.ts` |
| `site_visitors` | `frontend/lib/visitor-store.ts` |
| `csp_watchlists` | `frontend/app/api/csp-watchlist/[slug]/route.ts` |
| `custom_watchlists` | `frontend/lib/copilot/personalization.ts`, `frontend/app/api/watchlist/custom/route.ts` |
| `removed_hot_themes` | `frontend/app/api/hot-themes/remove/route.ts` |

Backfilling real migration files for these (by querying live `information_schema`, not guessing) is `tasks/active/003-supabase-migration-backfill.md`.

## `shared_store` — key registry

A generic `{key, value: jsonb, updated_at}` KV table, gated by an `ALLOWED_KEYS` whitelist in `frontend/app/api/store/[key]/route.ts`. Every key below is a de facto schema — treat changing its `value` shape as a breaking change to every reader.

| Key | Shape | Purpose |
|---|---|---|
| `theme_overrides` | `Record<themeTitle, ticker[]>` | Admin-added tickers per theme (keyed by theme **title**, not slug) |
| `hot_themes_removals` | `{removedSlugs: slug[], removedStocks: Record<themeSlug, ticker[]>}` | Admin-removed base tickers per theme (keyed by **slug**) |
| `watchlist`, `smart_tracker_v1`, `tracker_v1` | ticker arrays / basket objects | User/portfolio tracking state |
| `portfolio_swing`, `portfolio_longterm` | position objects | Paper-trade portfolios |
| `search_history`, `preorder_analyses` | arrays | Copilot/analysis history |
| `theme_final_tickers` | *(unused today)* | Was an intermediate snapshot; superseded by computing the merge live via `getEffectiveThemeTickers()` — see `docs/AI_BEHAVIOR.md`. Kept in `ALLOWED_KEYS` for backward compatibility only. |

**Effective theme ticker list** = `base (HOT_THEMES_2026[slug].stocks) ∪ theme_overrides[title] − hot_themes_removals.removedStocks[slug]`. Computed by `frontend/lib/themeOverrides.ts:getEffectiveThemeTickers()` — the single source of truth as of 2026-07-27 (see `theme_admin_public_ticker_sync` fix).

## JSON pick files (`data/`, synced to `frontend/public/`)

- `swing_all_picks.json` (read via `getSwingPicksBackfilled()`): each pick has `entry_status` — only `"ENTERED"` counts as an active ALIM (buy) signal; anything else ("Bekle"/wait) is still awaiting 15m confirmation. Never treat a non-ENTERED pick as an executed signal.
- `watchlist_picks.json` (read via `getWatchlistPicks()`): the "Trend Adayı" (trend candidate) pool — radar, not yet confirmed.
- Pool membership precedence: a ticker in `swing_all_picks.json` with `entry_status==ENTERED` → "Trend Listesi" (trend_list); otherwise if present in either file → "Trend Adayı" (trend_candidate); otherwise → not in any pool.

## BOGA score / conviction — where it's actually computed

`frontend/app/api/preorder-analysis/route.ts` is the single live-scoring engine (conviction 0–100, Weinstein stage, Wyckoff phase/score, trade-plan zones via `frontend/lib/tradePlanEngine.ts`). Everything else (Copilot's stock card, `TickerDetailPanel`, graphic pages) calls this endpoint — never reimplements the math. See `docs/FINANCIAL_CALCULATIONS.md` for the full formula trace (not yet written — `tasks/active/006`).
