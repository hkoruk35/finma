-- X (Twitter) Studio: otomatik/manuel hisse + promo gönderi kuyruğu ve zamanlayıcı.

create table public.x_content_pool (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('top100', 'swing', 'trend')),
  ticker text not null,
  company text,
  sector text,
  theme text,
  priority int not null default 0,
  added_at timestamptz not null default now(),
  used_at timestamptz
);

create index x_content_pool_unused_idx on public.x_content_pool (used_at) where used_at is null;
create index x_content_pool_ticker_idx on public.x_content_pool (ticker, added_at desc);

create table public.x_posts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null default gen_random_uuid(),
  content_type text not null check (content_type in ('stock', 'promo')),
  ticker text,
  sector text,
  theme text,
  source text check (source in ('top100', 'swing', 'trend', null)),
  locale text not null check (locale in ('en', 'es', 'fr', 'pt', 'tr')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'posted', 'failed')),
  content_text text,
  image_url text,
  tweet_id text,
  error_message text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

create index x_posts_cycle_idx on public.x_posts (cycle_id);
create index x_posts_scheduled_idx on public.x_posts (status, scheduled_at);

-- Dil rotasyonunu (EN -> ES -> FR -> PT -> TR -> ...) takip eden tekil satır.
create table public.x_language_queue (
  id int primary key default 1,
  next_locale text not null default 'en' check (next_locale in ('en', 'es', 'fr', 'pt', 'tr')),
  last_posted_at timestamptz,
  constraint x_language_queue_singleton check (id = 1)
);

insert into public.x_language_queue (id, next_locale) values (1, 'en');

-- Otomasyon açık/kapalı + aralık + kaynak oranları.
create table public.x_automation_settings (
  id int primary key default 1,
  enabled boolean not null default false,
  interval_minutes int not null default 12,
  ratio_top100 int not null default 40,
  ratio_swing int not null default 30,
  ratio_trend int not null default 30,
  updated_at timestamptz not null default now(),
  constraint x_automation_settings_singleton check (id = 1)
);

insert into public.x_automation_settings (id) values (1);

-- Free tier günlük gönderi sayacı (X API limit takibi).
create table public.x_api_usage (
  usage_date date primary key default current_date,
  post_count int not null default 0
);

alter table public.x_content_pool enable row level security;
alter table public.x_posts enable row level security;
alter table public.x_language_queue enable row level security;
alter table public.x_automation_settings enable row level security;
alter table public.x_api_usage enable row level security;

-- Bu tablolara sadece service-role (admin API) erişir, public policy yok.
