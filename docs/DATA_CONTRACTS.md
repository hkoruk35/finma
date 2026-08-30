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

## `traffic_sessions` / `traffic_events` — first-party traffic audit (2026-08-07)

Added by migration `002_create_traffic_audit.sql`. Independent of `site_visitors` (which keeps running unmodified) — this is the ad-spend/conversion-funnel audit pipeline, built to answer "what actually happened in the visitor's browser" without trusting GA4/X Pixel numbers.

- `traffic_sessions` — one row per session (`session_id` PK). First-touch `utm_source/medium/campaign/content/term` + `twclid` are written **once**, at session creation in `frontend/proxy.ts`, and never overwritten by later requests in the same session. Funnel-stage progress is denormalized as booleans (`page_loaded`, `active_5s/15s/30s`, `interacted`, `signup_started`, `signup_completed`) for cheap counting — `frontend/lib/trafficAudit.ts:sessionStage()` derives the single current stage from these flags.
- `traffic_events` — append-only raw log. `landing_request` gets one row per HTTP page request (no dedup — this is the page-view/request count). All other event names (`page_loaded`, `active_5s/15s/30s`, `user_interaction`, `signup_started`, `signup_completed`) are constrained by a **partial unique index** on `(session_id, event_name)` so each can only be recorded once per session, written via `upsert(..., { onConflict: "session_id,event_name", ignoreDuplicates: true })`.
- Identity: `boga_vid` (1yr cookie, httpOnly) = unique visitor across sessions/days. `boga_sid` (30min sliding cookie, httpOnly) = one funnel run. Both set only in `proxy.ts`; IP is stored but never used as an identity key.
- Write paths: `proxy.ts` (server `landing_request` + session create/touch, via `event.waitUntil()` — non-blocking), `POST /api/track/event` (client milestone events only — rejects `signup_completed`), `POST /api/members/register` (writes `signup_completed` directly after a real `supabase.auth.signUp()` success, never from a client claim).
- Read path: `GET /api/admin/traffic-audit` (admin-gated, same `boga_auth` check as `/api/admin/visitors`) powers every section of `/admin/analytics/visitors`: overview KPIs, previous-period comparison, hourly/daily time series, funnel, sources, country/device/referrer/landing-page breakdowns, bot-agent list and visitor detail. Params: `timeframe` (24h|7d|30d|all), `segment` (all|verified_human|bot|unverified) and the `country/source/campaign/content/device` drill-downs. **Row-limit contract:** PostgREST `max-rows` is 1000, so the window is read page-by-page (`.range()`, 1000/page, 6 concurrent) up to `MAX_SCAN_ROWS`=60,000; beyond that the response sets `scan.truncated` instead of silently under-counting. Raw rows are cached per timeframe for 60s in the route module; filters are applied in JS on the cached rows, so changing a filter costs no extra query. Page views and the previous-period figures come from `count(*)` head-queries; the same path-exclusion rules are pushed into PostgREST via `not.imatch` filters generated from `EXCLUDED_PATH_PATTERN_SOURCES` in `frontend/lib/trafficAudit.ts`, so the JS-side and DB-side definitions of "is this a real page request" cannot drift.
- Bot reporting: `sessionAudience()` in `frontend/lib/trafficAudit.ts` splits every session into `bot` / `verified_human` (page_loaded, non-bot UA) / `unverified` (human-looking UA that never ran JS). Its `isLikelyBotUserAgent()` pattern list is **reporting-only** and deliberately separate from `ALLOWED_CRAWLER_USER_AGENTS` in `botUserAgents.ts` — that one drives robots.txt and the proxy gate, so widening it would change crawler access, not just a chart.

## Copilot AI usage/credit system — two parallel tables (known duplication, not yet consolidated)

Two independent quota mechanisms both gate `frontend/app/api/copilot/chat/route.ts`, added by separate migrations and never merged (see the header comment in `0020_usage_credits.sql` for the original warning):

- **`user_credits`** (`0015_copilot.sql`, extended by `0024_copilot_token_quota.sql`) — the **free-tier daily quota**. One row per member (`user_id` PK). `current_usage`/`daily_limit` = flat query count (10/day, `FREE_DAILY_LIMIT` in `chat/route.ts`); `tokens_used_today` (added 2026-08-08) = cumulative `usage.totalTokens` from the AI SDK's `streamText` `onFinish` callback, capped at `FREE_DAILY_TOKEN_LIMIT` (15,000/day) in the same file. Both reset lazily on read via `get_copilot_credit_status(p_user_id, p_default_limit)` (compares `last_reset_date` to UTC today). Query count is incremented only outside `isExemptFreePage` (Trend/Theme pages); token count is incremented unconditionally for every free-tier response. Writes: `increment_copilot_credit(p_user_id)`, `increment_copilot_tokens(p_user_id, p_tokens)`.
- **`members.monthly_credit_balance` / `members.topup_credit_balance` + `credit_logs`** (`0020_usage_credits.sql`) — the **premium/paid weighted-credit system** ($39/mo plan credits + purchasable non-expiring top-ups), deducted via `consume_credits(p_user_id, p_amount, p_query_type)` (`FAST_ANSWER`=1, `DEEP_RESEARCH`=5). Also reused as the free tier's *overflow* path once the daily 10-query/15k-token cap is hit and the member has `topup_credit_balance ≥ 1` (`freeTierUsesTopup` in `chat/route.ts`). Premium fair-use (150 requests / rolling 120min) is measured by counting `credit_logs` rows directly, independent of the balance columns.
- **Anonymous (no account) visitors** are metered separately from both of the above: a signed-free httpOnly cookie (`boga_anon_copilot`, set in `chat/route.ts` and read-only in `usage/route.ts`) holds `{date, count}`, capped at 3 requests/day (`ANON_DAILY_LIMIT`). No DB row is created for anonymous usage — deliberately, to avoid a schema change for a soft, resettable-by-clearing-cookies limit. There is **no reliable per-request token cap for anonymous**: `cookies().set()` inside `onFinish` cannot attach a `Set-Cookie` header to a streaming `Response` that has already been returned, so token usage can only be capped for authenticated tiers (where the accumulator lives in Supabase, not a cookie).

When touching Copilot quota logic: update `FREE_DAILY_LIMIT`/`FREE_DAILY_TOKEN_LIMIT`/`ANON_DAILY_LIMIT`/`PREMIUM_FAU_LIMIT` constants in `chat/route.ts` (not hardcoded elsewhere except the mirrored anonymous-limit constant in `usage/route.ts`, which must be kept in sync manually).

## `movers_daily_snapshot` — gainers/losers/most-active archive

Added by migration `0021_movers_daily_snapshot.sql` (2026-08-02). One row per `(snapshot_date, category, rank)`, `category ∈ {gainers, losers, mostActive, top100}`. Written once daily by `POST /api/internal/movers-snapshot` (same `x-revalidate-secret`/`REVALIDATE_SECRET` bot-pipeline auth as `/api/internal/top100-sync`), triggered by `.github/workflows/movers-snapshot.yml`. Stored **unmasked** — ticker identity masking (`lib/publicTeaserTickers.ts:maskTop100Ticker`) must be re-applied at read time by any future archive page, exactly like `/api/top100` and `/api/home-movers` already do for the live view. No archive-viewing page exists yet as of 2026-08-02 (table starts empty; needs a few days of accumulated snapshots before one is useful) — ranking logic lives once in `lib/homeFeed.ts:buildTop100MoverRows`/`rankTop100Movers`, shared by both `/api/home-movers` (live, masked) and this snapshot writer (archival, unmasked).

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
| `home_movers_cache` | `{top7, top100, gainers, losers, mostActive}` (same shape `/api/home-movers` returns) | Last successful home-page movers snapshot, written by `/api/home-movers` itself on every healthy computation (not through `ALLOWED_KEYS`/the generic store route — read/written directly via `supabaseAdmin`). Served back when the live computation comes back empty/broken (DB or live-quote fetch failure), so the home page never shows "No data" — added 2026-08-11 after a Supabase blip left Top7/Gainers/Losers empty. |

**Effective theme ticker list** = `base (HOT_THEMES_2026[slug].stocks) ∪ theme_overrides[title] − hot_themes_removals.removedStocks[slug]`. Computed by `frontend/lib/themeOverrides.ts:getEffectiveThemeTickers()` — the single source of truth as of 2026-07-27 (see `theme_admin_public_ticker_sync` fix).

## JSON pick files (`data/`, synced to `frontend/public/`)

- `swing_all_picks.json` (read via `getSwingPicksBackfilled()`): each pick has `entry_status` — only `"ENTERED"` counts as an active ALIM (buy) signal; anything else ("Bekle"/wait) is still awaiting 15m confirmation. Never treat a non-ENTERED pick as an executed signal.
- `watchlist_picks.json` (read via `getWatchlistPicks()`): the "Trend Adayı" (trend candidate) pool — radar, not yet confirmed.
- Pool membership precedence: a ticker in `swing_all_picks.json` with `entry_status==ENTERED` → "Trend Listesi" (trend_list); otherwise if present in either file → "Trend Adayı" (trend_candidate); otherwise → not in any pool.

## `daily_one_picks` — Daily AI stock pick (2026-08-13)

Added by migration `0034_daily_one_picks.sql`. Backs the Home "Today's AI Stock Pick" widget and `/global/{locale}/dailyone` full-detail page. `period_key` (text, primary key) is a New York calendar date — `frontend/lib/dailyOnePick.ts:getEffectivePeriodKey()` rolls it over at 12:12 PM ET, not via a scheduled job: the first request to `GET /api/daily-one` after that boundary each day ranks the current `swing_all_picks.json` candidates by a candle+volume formation heuristic (`formationScore()` — relative volume, BOGA score, factor-score composite/momentum, risk/reward; excludes exhausted trends), upserts the winner, and every subsequent request that day reads the stored row instead of recomputing. Public read (RLS policy), service-role write only.

## BOGA score / conviction — where it's actually computed

`frontend/app/api/preorder-analysis/route.ts` is the single live-scoring engine (conviction 0–100, Weinstein stage, Wyckoff phase/score, trade-plan zones via `frontend/lib/tradePlanEngine.ts`). Everything else (Copilot's stock card, `TickerDetailPanel`, graphic pages) calls this endpoint — never reimplements the math. See `docs/FINANCIAL_CALCULATIONS.md` for the full formula trace (not yet written — `tasks/active/006`).
