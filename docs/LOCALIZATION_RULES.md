# Localization Rules

5 supported locales: `en`, `es`, `fr`, `pt`, `tr`.

## Current pattern (target — use this for anything new)

`frontend/app/global/[locale]/**` with a real dynamic `[locale]` segment. Today only `themes/[theme]/page.tsx` actually uses this correctly (`generateStaticParams` fans it out over all 5 locales × all themes). Any new public page should follow this file's pattern, not the older ones below.

## Known inconsistency (do not extend, do not "fix" without reading `tasks/active/002` first)

- `app/global/{en,es,fr,pt,tr}/**` — 5 **hand-duplicated** locale folders (~23 near-identical pages each), not a dynamic segment.
- `app/en/`, `app/tr/`, `app/daily/`, `app/[lang]/[slug]/[ticker]/` — legacy parallel routing schemes predating the `global/` migration.

Consolidating these is a live-URL/SEO-risk project, tracked separately — don't casually "clean this up" as a side effect of an unrelated change.

## Translation rules (confirmed via real fixes)

- Any user-facing string added to a shared component must be translated to all 5 locales, not just `tr`/`en`. Past bug: sector names in the news feed were only translated for `en`, silently showing Turkish sector names in `es`/`fr`/`pt`.
- Category/theme names: use `ct(key, lang, params)` (`frontend/lib/copilot/i18n.ts`) or `localizedThemeTitle(title, locale)` (`frontend/lib/hotThemes2026.ts`) — never hardcode a Turkish string and assume it's fine for other locales because "it's just internal."
- `/api/preorder-analysis`'s `activeSignals`/`warnings`/candle `pattern` strings are generated in Turkish by default and translated post-computation (and post-cache-hit) for `en/es/fr/pt` via lookup tables in the route itself — translation must never mutate the cached (always-Turkish) data, only the response sent to the client.
