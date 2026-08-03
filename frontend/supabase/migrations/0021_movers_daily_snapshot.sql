-- Movers (gainers/losers/most-active/top100) daily archive.
-- Written once per trading day by POST /api/internal/movers-snapshot, called from
-- .github/workflows/movers-snapshot.yml — same bot-pipeline pattern as top100-sync.
-- Stored UNMASKED; the same tier-based ticker masking /api/top100 already applies
-- (see lib/publicTeaserTickers.ts:maskTop100Ticker) must be re-applied at READ time
-- by any archive page, never baked into storage.

create table public.movers_daily_snapshot (
  id bigint generated always as identity primary key,
  snapshot_date date not null,
  category text not null check (category in ('gainers', 'losers', 'mostActive', 'top100')),
  rank int not null,
  ticker text not null,
  sector text,
  price numeric,
  change_pct numeric,
  volume bigint,
  created_at timestamptz not null default now(),
  unique (snapshot_date, category, rank)
);

create index movers_daily_snapshot_date_idx on public.movers_daily_snapshot (snapshot_date desc);

-- RLS acik, HICBIR policy yok -> anon/authenticated rolleri icin varsayilan
-- deny. Bu tablo ham (maskesiz) veri icerdigi icin dogrudan public anon key
-- ile Supabase REST'ten okunabilir olmamali (bkz. docs/AI_BEHAVIOR.md Rule 3 —
-- maskeleme sadece uygulama katmaninda var, bu da top100_tickers/top100_snapshot'ta
-- zaten var olan ayni riski tekrarlamamak icin). service-role key (supabaseAdmin,
-- /api/internal/movers-snapshot'un kullandigi) RLS'i her zaman bypass eder, bu
-- yuzden yazma etkilenmez.
alter table public.movers_daily_snapshot enable row level security;
