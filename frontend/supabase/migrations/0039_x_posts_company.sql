-- Homepage "Stock Analysis" cards (HomeLatestAnalysis.tsx) needed the company
-- name alongside the ticker — x_posts never stored it (only x_content_pool
-- did). Backfilled forward only; older rows stay null and the card simply
-- omits the company line for those (see AI_BEHAVIOR.md — never invent it).

alter table public.x_posts add column if not exists company text;
