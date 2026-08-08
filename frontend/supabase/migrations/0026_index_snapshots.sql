-- Endeks (S&P 500, Nasdaq 100, Dow Jones, Russell 2000, DAX, FTSE 100, CAC 40,
-- IBEX 35, STOXX Europe 600) gunluk/haftalik quant + AI analiz arsivi.
-- Yazan: yeni index_daily_analyzer.py / index_weekly_analyzer.py botlari (root),
-- top100_sync_common.py ile ayni desen: Supabase REST'e service-role key ile
-- dogrudan upsert. Okuma: frontend/app/global/[locale]/index/** SSR sayfalari.
--
-- Tek quant_snapshot + cok dilli ai_narrative jsonb ayni satirda tutulur ki
-- Portekizce sayfada baska, Turkce sayfada baska RSI/EMA cikmasi yapisal
-- olarak imkansiz olsun (5 dilin hepsi ayni hesaptan turer).

create table public.index_daily_snapshot (
  id bigint generated always as identity primary key,
  index_symbol text not null check (index_symbol in (
    'SPX', 'NDX', 'DJI', 'RUT', 'DAX', 'FTSE100', 'CAC40', 'IBEX35', 'STOXX600'
  )),
  trade_date date not null,
  session text not null check (session in ('premarket', 'midday', 'closing')),
  close numeric,
  change_pct numeric,
  change_pct_1w numeric,
  change_pct_20d numeric,
  ema20 numeric,
  ema50 numeric,
  ema200 numeric,
  rsi14 numeric,
  atr14 numeric,
  volatility_20d numeric,
  distance_from_20d_high_pct numeric,
  advancers int,
  decliners int,
  sector_leaders jsonb,
  vix numeric,
  us10y numeric,
  dxy numeric,
  volume bigint,
  quant_snapshot jsonb not null,
  ai_narrative jsonb,
  data_as_of timestamptz,
  published_at timestamptz,
  analysis_version text not null default 'index-analysis-v1',
  model_provider text not null default 'deepseek',
  model_name text,
  prompt_version text not null default 'daily-v1',
  data_source text not null default 'yfinance',
  content_status text not null default 'draft' check (content_status in ('draft', 'published', 'archived')),
  generation_status text not null default 'pending' check (generation_status in ('pending', 'success', 'partial', 'failed')),
  generation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (index_symbol, trade_date, session)
);

create index index_daily_snapshot_symbol_date_idx
  on public.index_daily_snapshot (index_symbol, trade_date desc);

create table public.index_weekly_snapshot (
  id bigint generated always as identity primary key,
  index_symbol text not null check (index_symbol in (
    'SPX', 'NDX', 'DJI', 'RUT', 'DAX', 'FTSE100', 'CAC40', 'IBEX35', 'STOXX600'
  )),
  week_start date not null,
  week_label text not null,
  close numeric,
  change_pct_week numeric,
  sector_rotation jsonb,
  trend_strength text,
  volatility_regime text,
  breadth_change numeric,
  key_levels jsonb,
  macro_calendar jsonb,
  scenarios jsonb,
  prior_week_outlook_accuracy text,
  quant_snapshot jsonb not null,
  ai_narrative jsonb,
  data_as_of timestamptz,
  published_at timestamptz,
  analysis_version text not null default 'index-analysis-v1',
  model_provider text not null default 'deepseek',
  model_name text,
  prompt_version text not null default 'weekly-v1',
  data_source text not null default 'yfinance',
  content_status text not null default 'draft' check (content_status in ('draft', 'published', 'archived')),
  generation_status text not null default 'pending' check (generation_status in ('pending', 'success', 'partial', 'failed')),
  generation_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (index_symbol, week_start)
);

create index index_weekly_snapshot_symbol_week_idx
  on public.index_weekly_snapshot (index_symbol, week_start desc);

-- RLS acik, sadece anon/authenticated icin okuma policy'si var (public arsiv
-- sayfalari SSR'da anon key ile okuyacak). Yazma sadece service-role (RLS bypass).
alter table public.index_daily_snapshot enable row level security;
alter table public.index_weekly_snapshot enable row level security;

create policy "index_daily_snapshot_public_read"
  on public.index_daily_snapshot for select
  to anon, authenticated
  using (true);

create policy "index_weekly_snapshot_public_read"
  on public.index_weekly_snapshot for select
  to anon, authenticated
  using (true);
