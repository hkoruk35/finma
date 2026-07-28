# 010 — Orphaned `.claude/worktrees/` cleanup

Status: active
Created: 2026-07-27
Risk: low for 9 of 11 directories, but 2 need human review first
Touches live system: no (agent-session artifacts only, unrelated to the deployed app)

## Context

`.claude/worktrees/` accumulated 11 directories from past isolated agent sessions on this repo. Found during the 2026-07-27 reorg; out of scope for that pass since it's unrelated to the application code the user asked about, but worth tracking for disk hygiene.

## Current state (verified facts only)

- `git worktree list` shows only **2 registered** worktrees: `agent-a3f86f14f056b4c3d` and `agent-a79a3cb6f2949e36f`, both on their own auto-generated branches. Checked directly: these have **real uncommitted changes** (41 and 17 files respectively) and 0 commits ahead of `main` — meaning there's in-progress, never-committed work sitting in them. Contents include at least a copy of `frontend/app/api/preorder-analysis/route.ts` (seen during this session's earlier work), suggesting a past attempt at similar analysis-engine work.
- The other **9 directories** (`bold-ritchie`, `cranky-wing-b3177c`, `frosty-margulis`, `gracious-napier-421666`, `lucid-hopper`, `practical-leakey`, `romantic-nash-095b5c`, `stoic-grothendieck`, `thirsty-mestorf-0bd79b`) have **no `.git` of their own** — they're not registered git worktrees at all (git commands run inside them silently defer to the outer repo). This is consistent with the Agent tool's documented behavior ("the worktree is automatically cleaned up if the agent makes no changes") having partially completed: the git-worktree registration was removed, but the checked-out files were left behind instead of the directory being deleted.
- Not independently diff-verified byte-for-byte against `main` — inferred safe-to-delete from the git-worktree-cleanup behavior, not proven with a direct `diff -rq`.

## Proposed change

1. **The 2 registered worktrees with uncommitted changes**: do NOT delete automatically. Show the user a diff/summary of what's in each (`git -C .claude/worktrees/agent-<id> diff`) so they can decide if it's worth keeping/committing/cherry-picking, or safe to discard.
2. **The 9 no-`.git` directories**: run `diff -rq .claude/worktrees/<name> <corresponding path in main repo>` for each before deleting, to get direct confirmation (not just inference) that they're byte-identical / contain nothing unique, then `rm -rf`.

## Why deferred

The 2 registered worktrees may contain valuable abandoned work — per this repo's own safety principle (see `docs/RELEASE_CHECKLIST.md`'s git-safety section), unfamiliar uncommitted state should be investigated, not silently discarded. The 9 others are very likely safe but weren't given a direct byte-for-byte diff before this task was written — do that verification at execution time, not just trust this note.

## Acceptance criteria

- [ ] User has reviewed (or explicitly declined to review) the contents of the 2 registered worktrees before either is deleted.
- [ ] Each of the 9 no-`.git` directories diffed and confirmed to add nothing unique before deletion.
- [ ] `.claude/worktrees/` disk usage before/after recorded (the original `du -sh` attempt timed out, suggesting this is a non-trivial amount of space).

## Verification steps

1. `git worktree list` — should show 0 or only intentionally-kept entries after cleanup.
2. `diff -rq` output attached/reviewed for each of the 9 before deletion.
3. Confirm nothing under `.claude/worktrees/` is referenced by any active tooling (should be none — these are dev-session artifacts only).
