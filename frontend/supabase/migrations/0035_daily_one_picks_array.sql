-- Daily One now selects 2 stocks per period instead of 1 — store them as a
-- JSON array on the existing per-period row instead of widening the table
-- to one-row-per-slot. The original scalar columns (ticker, score, ...)
-- are left in place holding the first pick for backward compatibility and
-- are no longer the primary read path (see lib/dailyOnePick.ts).
alter table daily_one_picks add column if not exists picks jsonb;
