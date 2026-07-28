# 002 — Public route consolidation investigation

Status: active
Created: 2026-07-27
Risk: high — live URLs, SEO, potential traffic loss if done wrong
Touches live system: yes — public-facing routing on bogastock.com

## Context

`docs/ARCHITECTURE.md` / `docs/LOCALIZATION_RULES.md` document that public routes are split across 4 parallel schemes, almost certainly incremental-migration debris rather than deliberate design.

## Current state (verified facts only)

- `app/global/{en,es,fr,pt,tr}/**` — 118 `page.tsx` files, 5 hand-duplicated locale folders (not a real dynamic segment). Only `app/global/[locale]/themes/[theme]/page.tsx` uses actual Next.js dynamic `[locale]` routing.
- `app/en/`, `app/tr/` — 221-line full page implementations (not thin redirects).
- `app/daily/` — standalone route, relationship to `global/` unclear.
- `app/[lang]/[slug]/[ticker]/page.tsx` — separate multi-lang deep-dive/analysis route.
- No investigation has been done yet into: which of these actually receive live traffic (analytics), which are indexed by Google (Search Console), or whether they serve genuinely different content vs. true duplicates.

## Proposed change

**Investigation first, no code changes yet:**
1. Check analytics/Search Console for real traffic + indexing status on `app/en/*`, `app/tr/*`, `app/daily/*`, `app/[lang]/[slug]/[ticker]/*`.
2. Diff each legacy route's rendered output against its `app/global/{locale}` equivalent (if one exists) to determine: true duplicate, or genuinely different content?
3. Only after that: propose a consolidation plan with 301 redirects for anything with real traffic/indexing, before removing anything.

## Why deferred

High SEO/live-URL risk. Removing or redirecting the wrong route could tank organic traffic to a live financial platform. Needs traffic data the codebase alone can't provide, plus a careful redirect strategy — not a code-cleanup task.

## Acceptance criteria

- [ ] Traffic/indexing report for each legacy route family.
- [ ] Explicit decision per family: keep as-is, redirect, or consolidate into `global/[locale]`.
- [ ] If consolidating: 301 redirect plan reviewed before implementation, sitemap updated in the same change.

## Verification steps

After any actual consolidation (future, separate task): confirm old URLs 301 (not 404) to their new equivalents, confirm sitemap.xml reflects the final URL set, monitor Search Console for crawl errors for 2+ weeks post-change.
