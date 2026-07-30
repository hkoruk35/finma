# frontend/ — Next.js 16 Build & API Rules

**Read before touching any frontend code.** Next.js 16 has breaking changes from earlier versions — APIs, conventions, and routing all differ from standard training data.

---

## Core Rules

### 1. Next.js 16 Breaking Changes
- **middleware.ts → proxy.ts**: Next.js 16 renamed middleware to proxy. The file at `frontend/proxy.ts` is the request interceptor, not middleware.ts (which may not exist — "middleware.ts not found" is a false positive).
- Before writing any API route, component hook, or dynamic route: check `node_modules/next/dist/docs/` for the relevant guide.
- Deprecation notices in the Next.js version are binding — don't use deprecated patterns.

**Reference:** `docs/ARCHITECTURE.md` for route boundaries and known gaps (001–009 active tasks).

### 2. Route Structure — Three Parallel Schemes (Intentional Debt)
⚠️ **This is migration debris, not a design choice.** See `tasks/active/002` before touching routes.

Current state:
- **Dynamic locale** (preferred, partly implemented): `app/global/[locale]/**` with real `[locale]` routing (en/es/fr/pt/tr)
- **Hand-duplicated folders** (current): ~23 pages duplicated into `app/global/en/`, `app/global/es/`, etc. (not dynamic)
- **Legacy routes** (deprecated): `app/en/`, `app/tr/`, `app/daily/`, `app/[lang]/[slug]/[ticker]/`

**When adding a new public page:** add it to ONE of the above (preferably `app/global/[locale]/`), do NOT create it in all three schemes.

### 3. Admin Routes — Auth via proxy.ts
- **Path:** `app/admin/**` (90+ pages)
- **Auth centralized in:** `frontend/proxy.ts` (checks `boga_auth` cookie)
- **Known gap:** `proxy.ts` matcher excludes `/api/*`, so ~24 admin API routes reimplement inline `boga_auth` checks instead of using `lib/apiAuth.ts` helpers (isStaffAuthed/isStaffWriteAuthed). See `tasks/active/001`.
- **When adding admin API route:** use `lib/apiAuth.ts` if possible; if not, document inline check reason in `tasks/active/001`.

### 4. Public vs. Admin Navigation
- Public buttons/links: search for route with `Glob`/`find` first — dynamic `[param]` segments won't match literal patterns. Never guess `/admin/...` routes for public pages.
- Admin pages use proxy.ts auth; public pages do not. Don't wire public buttons to admin routes.

---

## Data & External Integration

### 5. Supabase Schema — Known Drift
`docs/DATA_CONTRACTS.md` documents the schema and `shared_store` KV registry.

**Critical:** 5 tables used in production code have no migration file. Treat `shared_store`-backed features as de facto schema even if not in `supabase/migrations/`.

**When adding a new Supabase feature:** first check DATA_CONTRACTS.md, then create a migration file AND update the DATA_CONTRACTS.md registry.

### 6. Copilot Subsystem — Consistency Rules
`docs/AI_BEHAVIOR.md` documents 3 real consistency bugs and the rules that prevent recurrence.

**When touching Copilot, scoring engines, or "list" features** (theme/tracker/watchlist): read AI_BEHAVIOR.md first. Don't bypass the rules even if it seems like a shortcut (e.g. reading `HOT_THEMES_2026[...].stocks` directly instead of `themeOverrides.ts`).

---

## Component & Code Patterns

### 7. Tracker Pages — Consistent Design & Colors
Three tracker pages maintain strict consistency:
- `Top100Tracker` (top-level)
- `SwingTracker` (top-level)
- `TrendTracker` (top-level)
- **All use Dark Grey (#0f1117) table backgrounds** — do not alter
- **All use ThemeSwingTracker design** — if changing one, update all three to match

**Extra care:** SwingTracker is the page the user is "most sensitive about" (hassas olduğu sayfa). Verify changes against all three pages before committing.

### 8. Shared Store & Theme Overrides
- `hotThemes2026.ts` = static base theme list
- `themeOverrides.ts` = Supabase-merged dynamic overrides (merge source of truth for tickers)
- **Always read from `themeOverrides.ts` when building lists**, never read `HOT_THEMES_2026[...].stocks` directly (can cause stale data)

### 9. i18n & Locale Data
- Locale-specific copy: `lib/i18n/copy.ts`
- Analysis translations: `lib/analysis-langs.ts`
- Helpers: `lib/translationHelpers.ts`
- **When adding new text:** add locale keys to copy.ts, not hardcoded strings

### 10. Scoring & Analysis Engines
Core scoring files (do not refactor without checking active tasks):
- `tradePlanEngine.ts` — single source of truth for trade plan logic (TP1-3, entry ranges, etc.)
- `top100-engine.ts` — Top 100 stock scoring
- `indicators.ts` — Technical analysis (EMA, RSI, etc.)
- `marketCommentaryEngine.ts` — Market context generation

---

## Build & Deployment

### 11. Build-Specific Checks
Before running `npm run build`:
- [ ] No `middleware.ts` files (use proxy.ts instead)
- [ ] No hardcoded API URLs — use environment variables
- [ ] Check `useSearchParams()` usage — SSG routes that use it will prerender fail (see `global_locale_layouts_required.md` in memory)
- [ ] Run `npx next build` in `frontend/` directory (not root)

### 12. Environment Variables
`frontend/.env.local` required for:
- Supabase keys (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
- Admin Supabase key (SUPABASE_SERVICE_ROLE_KEY — server-only)
- API endpoints (if not hardcoded)

See `.env.example` for required keys.

### 13. Vercel Deployment
- Root `vercel.json` and `frontend/vercel.json` both exist (duplication; see `tasks/active/009`)
- Deployment is currently via Vercel
- Before pushing: verify no breaking schema changes to Supabase (no migrations without testing first)

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| "middleware.ts not found" error | It's been renamed to proxy.ts — check proxy.ts instead |
| Admin route wired to public button | Search Grep/find for the route first; if admin-only, ask the user where it should link |
| Hardcoded API URL | Move to environment variable |
| Reading `HOT_THEMES_2026[...].stocks` directly | Use `themeOverrides.ts` to get merged Supabase data |
| Changing one tracker page's design | Update all three (Top100, Swing, Trend) to keep consistent |
| Adding new locale text | Add to `copy.ts`, don't hardcode strings |
| SSG route using `useSearchParams()` | Move to CSR or use dynamic rendering (SSG can't prerender dynamic search params) |

---

## When in Doubt

- **Route doesn't exist?** Ask the user where it should point (see root AGENTS.md rule #2: Never Guess Routes)
- **Supabase schema question?** Read `docs/DATA_CONTRACTS.md`
- **Copilot inconsistency?** Read `docs/AI_BEHAVIOR.md`
- **Build failing?** Check `docs/LOCALIZATION_RULES.md` for locale-specific layout issues
- **Tracker styling question?** Verify all three (Top100/Swing/Trend) match Dark Grey (#0f1117)
