# BOGASTOCK Terminal (frontend)

Next.js 16 app for bogastock.com. See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full system map (route structure, admin/public boundary, `lib/` layout, known architectural debt) and [`AGENTS.md`](./AGENTS.md) for Next.js-16-specific build notes.

## Dev

```bash
npm run dev      # dev server
npm run build    # production build — must pass before shipping, see ../docs/RELEASE_CHECKLIST.md
npm run lint
```

## Before making changes

- [`../docs/AI_BEHAVIOR.md`](../docs/AI_BEHAVIOR.md) — Copilot consistency rules, required reading before touching any scoring/threshold engine or "list" feature (theme/tracker/watchlist).
- [`../docs/DATA_CONTRACTS.md`](../docs/DATA_CONTRACTS.md) — Supabase schema (including known drift) and the `shared_store` key registry.
- [`../docs/LOCALIZATION_RULES.md`](../docs/LOCALIZATION_RULES.md) — the 5-locale pattern and its known inconsistencies.
- [`../docs/RELEASE_CHECKLIST.md`](../docs/RELEASE_CHECKLIST.md) — verification steps before shipping.
