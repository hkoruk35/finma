# AI Behavior Rules (BOGA Copilot / "Lora")

Rules below were each written after a real, user-reported bug — not speculative guidance. Keep this file updated whenever a new Copilot consistency bug is fixed, since the user actively keeps training/extending Copilot and this is where those lessons need to persist.

## Rule 1 — One numeric source per fact, never let the model or a second code path re-derive it

**Incident**: Copilot's "İşlem Kurgusu" (trade setup) answer for a ticker disagreed with the same ticker's own analysis page — the model was inventing an entry/trigger from `get_technical_levels`'s generic pivot support/resistance instead of the page's real `tradePlan.entryZone`.

**Rule**: any entry/stop/target/trigger/risk-reward question **must** call `get_trade_plan` (backed by `frontend/lib/copilot/liveAnalysis.ts:getTradePlanSummary()`, which reads the same `/api/preorder-analysis` the page renders). Never derive a trade plan from `get_technical_levels`'s generic S/R. If `valid:false`, say so honestly — don't invent numbers to fill the gap.

**Generalize**: before adding any new Copilot tool that surfaces a number/verdict already shown somewhere on the site, check whether that number already has a canonical function. If yes, call it — don't recompute.

## Rule 2 — Stock verdict/score must not flip on closed-market noise

**Incident**: Copilot showed YÜKSELİŞ (78/100) then DÜŞÜŞ (83/100) for the same ticker 2 minutes apart, market closed, chart unchanged.

**Root cause**: `/api/preorder-analysis` recomputed fully on every request (30s cache — far shorter than realistic message gaps), and Yahoo's still-settling post-close daily bar caused cent-level revisions that crossed hard thresholds (Weinstein stage sign, Wyckoff phase bucket).

**Rule**: `/api/preorder-analysis` cache TTL is 30 min while the market is closed (30s while open — see `isMarketOpenET()`), and `weinsteinStage()`/`wyckoff()` apply hysteresis (keep the ticker's last-reported classification when the raw value is within a small band of its decision boundary). **Do not** remove either safeguard when touching this file, and apply the same pattern (freeze-while-closed + hysteresis near thresholds) to any new bucketed/threshold-based signal.

## Rule 3 — A "list" surface (theme, tracker, category) must have exactly one ticker source

**Incident**: admin's theme page showed 18 tickers (10 base + 8 custom), the public theme page showed 10 — the public page read the static `HOT_THEMES_2026` array directly and never saw admin's Supabase-stored additions/removals.

**Rule**: any code that needs a theme's ticker list calls `frontend/lib/themeOverrides.ts:getEffectiveThemeTickers()` — never `HOT_THEMES_2026[...].stocks` directly for anything user-facing (admin panel, public page, or Copilot's `getThemeStocksList`). If you add a new "list" feature (new tracker, new category), ask: is there already an admin-editable version of this list? If yes, reuse its merge function; don't let a new consumer read the static/base data.

## Cross-cutting principle

Whenever the same fact (a score, a list, a verdict) is rendered on two different surfaces (admin vs public, page vs Copilot, one locale vs another), those two surfaces must call the **same function**, not two independently-written computations that happen to agree today. Two independent implementations of the same logic *will* drift — it's a matter of when, not if. When reviewing a Copilot tool or a new page, grep for whether the number/list it shows already has a canonical source before writing new logic.
