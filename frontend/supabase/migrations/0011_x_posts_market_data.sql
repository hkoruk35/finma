-- Cycle basinda bir kez cekilen piyasa verisini (sparkline, degisim%, EMA50,
-- trend) 5 dilin taslaklarinda saklamak icin — her post render'inda tekrar
-- API cagirmaya gerek kalmaz, cycle boyunca tutarli kalir.

alter table public.x_posts
  add column if not exists change_pct numeric,
  add column if not exists ema50 numeric,
  add column if not exists trend text,
  add column if not exists points jsonb;
