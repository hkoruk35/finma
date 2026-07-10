-- Cycle basinda bir kez cekilen piyasa verisini (gunluk OHLC+hacim mumlari,
-- degisim%, goreli hacim, trend, firsat isareti) 5 dilin taslaklarinda
-- saklamak icin — her post render'inda tekrar API cagirmaya gerek kalmaz,
-- cycle boyunca tutarli kalir. Bu dosya birden fazla kez calistirilabilir
-- (onceki entry_low/entry_high kolonlari kaldirildiysa da sorun olmaz).

alter table public.x_posts
  add column if not exists change_pct numeric,
  add column if not exists rvol numeric,
  add column if not exists opportunity boolean not null default false,
  add column if not exists trend text,
  add column if not exists bars jsonb,
  drop column if exists entry_low,
  drop column if exists entry_high;
