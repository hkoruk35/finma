-- Header mega menu'sundeki (MemberHeader.tsx) sabit üst seviye öğelerin
-- açık/kapalı durumu — admin "Menü Yönetimi" sayfasından yönetilir. Menü
-- ağacının kendisi kodda sabit kalır (rota yapısı sabit), burada sadece
-- görünürlük ve opsiyonel etiket override'ı tutulur.

create table public.site_menu_toggles (
  key text primary key, -- "markets" | "watchlist" | "news" | "analysis" | "brokers"
  enabled boolean not null default true,
  label_override text, -- null ise header'daki varsayılan çeviri kullanılır
  updated_at timestamptz not null default now()
);

insert into public.site_menu_toggles (key, enabled) values
  ('markets', true),
  ('watchlist', true),
  ('news', true),
  ('analysis', true),
  ('brokers', true);

alter table public.site_menu_toggles enable row level security;

create policy "Allow public read access" on public.site_menu_toggles
  for select
  using (true);

-- Yazma sadece service-role (admin API) — public policy yok.
