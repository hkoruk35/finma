# Release Checklist

## Before shipping any `frontend/` change

1. `cd frontend && npx tsc --noEmit` — must pass.
2. `npm run build` — must succeed (catches server/client boundary issues `tsc` alone won't, e.g. accidental `supabase-admin` in a client bundle — see the `server-only` guard on `frontend/lib/supabase-admin.ts`).
3. `npm run lint` — no new warnings/errors vs. the last known-good baseline.
4. If the change is user-visible: start the dev server, exercise the actual feature in the browser tool (golden path + at least one edge case), check console/network for errors. Don't claim a UI fix works without having loaded it.
5. If the change touches a scoring/threshold engine (`/api/preorder-analysis`, `tradePlanEngine.ts`, `top100-engine.ts`): re-read `docs/AI_BEHAVIOR.md` Rule 2 first — threshold-based classifiers need hysteresis, not just a correctness check.
6. If the change touches a "list" feature (theme, tracker, watchlist): re-read `docs/AI_BEHAVIOR.md` Rule 3 — check whether admin and public read the same merge function.

## Before touching anything in the root Python layer

1. Never delete a script without confirming it against the live `Get-ScheduledTask` state (`schtasks /query /fo LIST /v` via PowerShell — Git Bash mangles the `/query` flag into a path, use the PowerShell tool) — a filename claiming to be "the current version" isn't proof.
2. Deleting/archiving a Task Scheduler *setup script* (`.bat`/`.ps1`/`.xml`) never touches an already-registered scheduled task — those live independently in Windows state. Only `Unregister-ScheduledTask`/`schtasks /Delete` touches the live registration; don't run those without explicit confirmation.
3. `python -m py_compile <file>` on anything you edit, at minimum.
4. Current task-registration source of truth: `SISTEMI_GUNCELLE.bat` → `scratch/setup_boga_tasks.ps1` + `scratch/setup_performance_hourly.ps1` + `setup_options_task_v241.ps1`. See `docs/ARCHITECTURE.md` for the full live-orchestrator map.

## Emergency tools — do not delete, do not run casually

| Script | What it does |
|---|---|
| `BOTLARI_TAMAMEN_DURDUR.bat` | Force-kills all `python.exe` processes — emergency stop |
| `TAM_TEMIZLIK.bat` | Bulk-deletes scheduled tasks — emergency reset |
| `FIX_TASKS_ADMIN.bat` | Re-runs `scratch/setup_boga_tasks.ps1` as admin — live task re-registration |

These are intentional, operationally dangerous tools, not dead code — never delete or archive them in a cleanup pass, and never run them without the user's explicit request.

## Git safety

- Never `git push --force`, `git reset --hard`, or rewrite history without explicit user confirmation — the leaked-credential item (`tasks/active/004`) is exactly the kind of thing that looks like it "should" be purged from history, but doing so without the user's sign-off is out of scope for any automated cleanup.
- Prefer `git mv` into `archive/` over `rm` for anything not proven to have zero references — re-verify with a fresh grep immediately before moving, don't trust an old audit.
