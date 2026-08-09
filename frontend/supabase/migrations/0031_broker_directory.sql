-- "Brokers" sayfası (app/global/[locale]/brokers) için admin tarafından
-- yönetilen aracı kurum dizini. Marka logoları/telif hakkı gerektiren
-- pazarlama metinleri buraya OTOMATIK eklenmez — admin, her broker'ın kendi
-- resmi kaynağından/izinli varlıklarından logo_url'i elle girer.

create table public.broker_directory (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('stock', 'fx', 'crypto')),
  name text not null,
  website_url text,
  logo_url text,
  description text,
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index broker_directory_category_idx on public.broker_directory (category, sort_order);

alter table public.broker_directory enable row level security;

create policy "Allow public read access" on public.broker_directory
  for select
  using (enabled = true);

-- Yazma sadece service-role (admin API) — public policy yok.

-- Başlangıç seti — sadece halka açık şirket adları + özgün, kısa açıklama
-- (üçüncü taraf sitelerden metin/logo KOPYALANMADI). Admin, Broker Yönetimi
-- sayfasından resmi/izinli logo URL'lerini ve daha zengin açıklamaları
-- sonradan ekleyebilir.
insert into public.broker_directory (category, name, website_url, description, sort_order) values
  ('stock', 'Interactive Brokers', 'https://www.interactivebrokers.com', 'Geniş küresel piyasa erişimi ve düşük komisyonlarıyla bilinen kurumsal ağırlıklı bir aracı kurum.', 10),
  ('stock', 'Charles Schwab', 'https://www.schwab.com', 'ABD merkezli, komisyonsuz hisse/ETF işlemleri sunan köklü bir aracı kurum.', 20),
  ('stock', 'Fidelity', 'https://www.fidelity.com', 'Araştırma araçları ve emeklilik/yatırım hizmetleriyle tanınan büyük bir ABD aracı kurumu.', 30),
  ('fx', 'OANDA', 'https://www.oanda.com', 'Döviz ve CFD işlemlerinde uzun süredir faaliyet gösteren, düzenlemeye tabi bir forex brokerı.', 10),
  ('fx', 'Forex.com', 'https://www.forex.com', 'Çok sayıda döviz paritesi ve CFD sunan, birden fazla ülkede lisanslı bir forex brokerı.', 20),
  ('crypto', 'Coinbase', 'https://www.coinbase.com', 'ABD merkezli, halka açık büyük bir kripto para borsası.', 10),
  ('crypto', 'Kraken', 'https://www.kraken.com', 'Geniş kripto varlık yelpazesi sunan, köklü bir kripto para borsası.', 20)
on conflict do nothing;
