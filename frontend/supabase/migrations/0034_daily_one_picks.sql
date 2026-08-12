-- "Daily One" — the single AI-selected candle+volume formation pick of the day,
-- shown teaser-only to anonymous visitors on Home and full-detail to any
-- logged-in (free-tier or above) member at /global/{locale}/dailyone.
-- period_key = NY calendar date the pick becomes effective at 12:12 PM ET
-- (computed in lib/dailyOnePick.ts, not by a scheduled job — selected lazily
-- on first request after the 12:12 boundary each day).
create table if not exists daily_one_picks (
  period_key text primary key,
  ticker text not null,
  company text,
  sector text,
  score numeric,
  current_price numeric,
  target_price numeric,
  target_pct numeric,
  entry_low numeric,
  entry_high numeric,
  risk_reward numeric,
  selection_reasons jsonb,
  formation_score numeric,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table daily_one_picks enable row level security;

create policy "daily_one_picks_public_read" on daily_one_picks
  for select using (true);
