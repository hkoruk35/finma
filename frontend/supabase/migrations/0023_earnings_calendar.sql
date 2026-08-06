-- Bilanço Takvimi (Earnings Calendar) — Yahoo Finance'ten çekilen, YAKLAŞAN
-- bilanço tarihleri. earnings_reports (0022) SEC EDGAR'dan GEÇMİŞ/gerçekleşmiş
-- bildirimleri tutar; bu tablo ise henüz gerçekleşMEmiş, tahmini tarihleri
-- tutar — iki tablo birbirinin yerine geçmez, ayrı amaçlara hizmet eder.

create table public.earnings_calendar (
    id uuid primary key default gen_random_uuid(),
    ticker varchar(10) not null unique,
    company_name text,
    earnings_date date not null,
    is_estimate boolean not null default true,
    eps_estimate numeric,
    revenue_estimate_usd numeric,
    updated_at timestamp with time zone default now()
);

create index idx_earnings_calendar_date on public.earnings_calendar(earnings_date);

alter table public.earnings_calendar enable row level security;

create policy "earnings_calendar_select_all" on public.earnings_calendar
  for select using (true);
