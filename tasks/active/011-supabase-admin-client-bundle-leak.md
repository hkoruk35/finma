# 011 — `supabase-admin.ts` is confirmed bundled into the client, not just theoretically at risk

Status: active
Created: 2026-07-27
Risk: high — confirmed architectural issue, not speculative
Touches live system: yes — every page's client JS bundle (the import chain runs through the root layout)

## Context

During the 2026-07-27 reorg, Phase 4 planned to add `import "server-only";` to `frontend/lib/supabase-admin.ts` as a defensive guard, on the theory that the risky import chain (`CopilotDrawer.tsx` → `lib/copilot/tasksEngine.ts` → `supabase-admin.ts`) was probably already being stripped correctly by Next.js and the guard would be a no-op safety net. **The build failed immediately with `'server-only' cannot be imported from a Client Component module`, proving this is a real, currently-active client-bundle inclusion — not a false alarm.** The one-line guard was reverted per the plan's own instructions (`docs/RELEASE_CHECKLIST.md`), and this task was created instead of attempting a quick fix mid-cleanup.

## Current state (verified facts only)

Full import trace from the build error output:
```
lib/supabase-admin.ts
  → lib/copilot/tasksEngine.ts
    → components/global/CopilotDrawer.tsx ("use client")
      → components/global/CopilotShell.tsx ("use client", also a Server Component wrapper)
        → app/layout.tsx (root layout — every single page in the app)
```

Additional confirmed import sites of `supabase-admin.ts` beyond this chain (all server-side today): `app/api/picks/route.ts`, `app/api/members/subscription/checkout/route.ts`, `lib/x/publicPosts.ts` (via `app/global/pt/news/page.tsx`).

Next.js strips non-`NEXT_PUBLIC_`-prefixed env vars from client bundles by default, so `process.env.SUPABASE_SERVICE_KEY` likely evaluates to `undefined` client-side rather than leaking the literal key value. However: the module-level code `createClient(supabaseUrl || "https://none.supabase.co", serviceRoleKey || "none")` **does execute in the browser** as part of `tasksEngine.ts`'s client bundle, and the `console.warn` on missing credentials would fire client-side too. This is a real architectural smell even if the literal secret isn't confirmed leaked — it means a service-role-client-constructing module ships to every visitor's browser.

## Proposed change

Break the import chain so `supabase-admin.ts` is never reachable from a `"use client"` file:
1. Read `lib/copilot/tasksEngine.ts` in full — identify exactly what `CopilotDrawer.tsx` actually needs from it (the earlier audit noted it imports `TASK_LABELS`, a real runtime `const`, not just a type).
2. Split `tasksEngine.ts` into a client-safe part (constants/types/labels only) and a server-only part (anything touching `supabaseAdmin`), or move the `supabaseAdmin`-dependent logic behind a server action / API route that `CopilotDrawer.tsx` calls instead of importing directly.
3. Once the chain is broken, re-add `import "server-only";` to `supabase-admin.ts` and confirm `npm run build` passes — this becomes the permanent regression guard.

## Why deferred

Requires understanding `tasksEngine.ts`'s full API surface and `CopilotDrawer.tsx`'s actual usage before splitting it — a rushed split mid-cleanup risks breaking the Copilot drawer UI (a live, user-facing feature the user is actively iterating on — see `docs/AI_BEHAVIOR.md`). Needs its own focused session with the Copilot UI tested afterward.

## Acceptance criteria

- [ ] `import "server-only";` added to `lib/supabase-admin.ts` and `npm run build` passes with it in place.
- [ ] `CopilotDrawer.tsx` and the Copilot chat drawer tested end-to-end in the browser after the split (open drawer, view tasks, confirm `TASK_LABELS`-dependent UI still renders correctly).
- [ ] No new circular-import or client/server boundary errors introduced.

## Verification steps

1. `npx tsc --noEmit && npm run build` — must pass with the `server-only` guard permanently in place.
2. Browser test: load any page (confirms the guard didn't break the global layout), then open the Copilot drawer and exercise its task-list UI specifically.
3. `git grep -n "supabaseAdmin" frontend/components frontend/lib` — spot-check that no remaining `"use client"` file's import chain reaches it.
