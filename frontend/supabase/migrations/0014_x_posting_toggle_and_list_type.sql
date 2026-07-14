-- X posting on/off kill switch: when false, content is still generated and
-- published to the internal /news feed (status='posted', tweet_id null),
-- but postTweet() is never called. Separate from x_automation_settings.enabled,
-- which only gates whether the automated cron *cycle* runs at all.
alter table public.x_automation_settings
  add column if not exists x_posting_enabled boolean not null default true;

-- 'list' content_type: a summary post for a site section (Swing Trade,
-- Trend Stocks, Top 100, Sector Heat Map) rather than a single ticker.
alter table public.x_posts drop constraint if exists x_posts_content_type_check;
alter table public.x_posts add constraint x_posts_content_type_check
  check (content_type in ('stock', 'promo', 'list'));

alter table public.x_posts
  add column if not exists list_type text
  check (list_type in ('swing', 'trend', 'top100', 'sector_heatmap') or list_type is null);
