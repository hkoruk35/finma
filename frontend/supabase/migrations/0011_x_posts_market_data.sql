-- Cycle basinda bir kez cekilen piyasa verisini (haftalik sparkline, degisim%,
-- tahmini giris araligi, trend) 5 dilin taslaklarinda saklamak icin — her post
-- render'inda tekrar API cagirmaya gerek kalmaz, cycle boyunca tutarli kalir.

alter table public.x_posts
  add column if not exists change_pct numeric,
  add column if not exists entry_low numeric,
  add column if not exists entry_high numeric,
  add column if not exists trend text,
  add column if not exists points jsonb;
