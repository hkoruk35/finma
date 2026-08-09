-- X Studio "Tekrarlanan Programlama": bir ticker/varlık için periyodik
-- (her N saatte) veya haftalık (belirli NY gün+saat) otomatik gönderi
-- zamanlaması. cron/x-recurring-schedules bu tabloyu tarar ve zamanı gelmiş
-- satırları taze AI metniyle üretip yayınlar (bkz. lib/x/recurringSchedules.ts).

create table public.x_recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('stock', 'market_asset')),
  ticker text not null,
  category text check (category in ('sector', 'index', 'commodity', 'fx', 'crypto') or category is null),
  company text,
  sector text,
  theme text,
  weekly boolean not null default false,
  locale text check (locale in ('en', 'es', 'fr', 'pt', 'tr') or locale is null), -- null = 5 dilin hepsi
  recurrence_type text not null check (recurrence_type in ('interval', 'weekly')),
  interval_hours int check (interval_hours between 1 and 24),
  weekday int check (weekday between 0 and 6), -- 0=Pazar..6=Cumartesi (NY)
  time_of_day text, -- "HH:mm" NY duvar saati (sadece recurrence_type='weekly')
  enabled boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  constraint x_recurring_schedules_interval_fields check (
    (recurrence_type = 'interval' and interval_hours is not null and weekday is null and time_of_day is null)
    or
    (recurrence_type = 'weekly' and weekday is not null and time_of_day is not null and interval_hours is null)
  )
);

create index x_recurring_schedules_due_idx on public.x_recurring_schedules (next_run_at) where enabled = true;

alter table public.x_recurring_schedules enable row level security;
-- Bu tabloya sadece service-role (admin API) erişir, public policy yok.

-- Otomasyonun ürettiği gönderileri de mevcut geçmiş/loglama akışına (x_posts)
-- düşürebilmek için content_type ve source setlerini genişlet.
alter table public.x_posts drop constraint if exists x_posts_content_type_check;
alter table public.x_posts add constraint x_posts_content_type_check
  check (content_type in ('stock', 'promo', 'list', 'market_asset'));

alter table public.x_posts drop constraint if exists x_posts_source_check;
alter table public.x_posts add constraint x_posts_source_check
  check (source in ('top100', 'swing', 'trend', 'manual', 'watchlist', 'sector', 'index', 'commodity', 'fx', 'crypto', 'recurring') or source is null);
