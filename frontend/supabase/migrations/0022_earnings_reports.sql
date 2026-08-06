-- SEC EDGAR + DeepSeek destekli kamuya açık Earnings (Bilanço) sayfası.
-- Redis yerine bu tablo önbellek görevi görür: DeepSeek her ticker/dönem için
-- SADECE BİR KEZ çağrılır (arka planda, cron ile), gerçek kullanıcı isteği
-- hiçbir zaman DeepSeek'i tetiklemez — /api/earnings sadece bu tablodan okur.

create table public.earnings_reports (
    id uuid primary key default gen_random_uuid(),
    ticker varchar(10) not null,
    company_name text,
    period varchar(20), -- örn: 'Q2 2026'
    report_date date not null,
    sec_form_type varchar(10), -- '10-Q' veya '10-K'
    sec_accession_no text,
    raw_metrics jsonb, -- SEC'den gelen EPS, Gelir vb. ham veriler
    ai_summary jsonb, -- DeepSeek çıktısı: her locale için { summary, revenue_status, eps_status, key_takeaways, bullish_signals, bearish_signals, ai_score }
    created_at timestamp with time zone default now(),
    unique (ticker, report_date, sec_form_type)
);

create index idx_earnings_report_date on public.earnings_reports(report_date desc);
create index idx_earnings_ticker on public.earnings_reports(ticker);

alter table public.earnings_reports enable row level security;

-- Herkese açık sayfa — anonim okuma serbest, yazma yalnızca service-role
-- (cron endpoint'i üzerinden).
create policy "earnings_reports_select_all" on public.earnings_reports
  for select using (true);
