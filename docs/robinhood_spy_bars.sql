-- Robinhood -> BOGA overnight SPY bar cache.
-- Bir kere Supabase SQL editor'de çalıştırılır (frontend/docs veya Supabase dashboard'dan).
create table if not exists robinhood_spy_bars (
  time bigint primary key,        -- unix saniye (bar başlangıcı)
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume bigint not null default 0,
  session text,                   -- robinhood'un döndürdüğü session etiketi (pre/reg/post)
  interpolated boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Sık sorgulanan "son N saat" sorgusu için.
create index if not exists robinhood_spy_bars_time_idx on robinhood_spy_bars (time desc);

-- service-role dışında hiç kimse okuyup yazamasın (RLS kapalı bırakmak istemiyorsak):
alter table robinhood_spy_bars enable row level security;
-- (Politika eklemiyoruz — sadece supabaseAdmin/service-role bu tabloya erişebilir, bu da istediğimiz şey.)
