# 007 — Product rules doc backfill

Status: active
Created: 2026-07-27
Risk: none (documentation only)
Touches live system: no

## Context

`docs/PRODUCT_RULES.md` is a skeleton — it already lists a few rules confirmed directly from live code, but the full strategy/business-rule documentation needs the user's own domain confirmation on which rules are current vs. superseded.

## Current state (verified facts only)

Reference material exists at `docs/reference/tracker_strategy.md`, `docs/reference/ichimoku_analiz_rehberi.md`, `docs/reference/DERIN_HISSE_ANALIZ_SABLONU.md` — all moved from repo root during the 2026-07-27 reorg (they were reusable strategy docs, not disposable reports). These were written at various points and may not all reflect current live behavior.

## Proposed change

Go through each reference doc with the user, section by section: for each stated rule, confirm (a) is this still how the system actually behaves, (b) if not, what changed, (c) should this rule move into `docs/PRODUCT_RULES.md` as current, or be marked superseded. Cross-check against live code where a rule claims specific behavior (e.g. the Ichimoku parameter set, the options premium-harvesting checklist).

## Why deferred

Requires the user's own domain judgment — an agent reading `tracker_strategy.md` cannot tell whether a documented rule from months ago is still the intended behavior or was quietly changed since. Guessing here would produce a confidently-wrong "product rules" doc.

## Acceptance criteria

- [ ] Every rule in `docs/PRODUCT_RULES.md`'s "not yet backfilled" section is either confirmed current (with a code cross-reference) or explicitly marked superseded/removed.
- [ ] `docs/reference/*.md` files that turn out to be fully superseded get a header note pointing to their replacement, rather than being silently trusted by a future reader.

## Verification steps

None (documentation) — the acceptance criteria above are the verification.
