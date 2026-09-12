-- "Today's market picture" homepage card (bkz. components/global/TodaysMarketPicture.tsx)
-- için AI-üretilmiş, 6 dilde önbelleklenmiş genel ABD piyasa özeti.
-- Tek satır (id=1) tutulur — /api/cron/generate-market-picture dışında hiçbir
-- yol bu tabloya yazmaz. `facts` sütunu, AI'ya verilen GERÇEK verinin denetim
-- kaydıdır (bkz. docs/AI_BEHAVIOR.md — AI hiçbir zaman kendi rakamını üretmez).

create table public.market_picture (
    id smallint primary key default 1,
    mode text not null check (mode in ('intraday', 'day_close', 'week_close')),
    trade_date date not null,
    facts jsonb not null,
    texts jsonb not null, -- { en: "...", tr: "...", es: "...", fr: "...", pt: "...", id: "..." }
    generated_at timestamptz not null default now(),

    constraint market_picture_single_row check (id = 1)
);

alter table public.market_picture enable row level security;

-- Herkese açık kart — anonim okuma serbest, yazma yalnızca service-role
-- (/api/cron/generate-market-picture route'u üzerinden).
create policy "market_picture_select_all" on public.market_picture
  for select using (true);
