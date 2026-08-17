-- Teknik ve Analist Görünümü paneli (bkz. components/public/TechnicalAnalystConsensus.tsx)
-- için gerçek veri önbelleği. earnings_reports (0022) ile aynı desen: DeepSeek ve
-- Yahoo Finance hesaplaması bir ticker için 30 günde EN FAZLA bir kez tetiklenir,
-- o pencere içindeki tüm kullanıcılar (ilk sorgulayan kim olursa olsun) aynı
-- satırı okur. /api/technical-analyst-consensus dışında hiçbir yol bu tabloya
-- yazmaz; kullanıcı isteği asla doğrudan Yahoo/DeepSeek'i her seferinde tetiklemez.

create table public.technical_analyst_consensus (
    id uuid primary key default gen_random_uuid(),
    ticker varchar(12) not null unique,
    price_at_computation numeric,

    -- 26 göstergenin (11 osilatör + 15 hareketli ortalama) gerçek hesaplanmış dağılımı
    osc_pos smallint not null default 0,
    osc_neu smallint not null default 0,
    osc_neg smallint not null default 0,
    ma_pos smallint not null default 0,
    ma_neu smallint not null default 0,
    ma_neg smallint not null default 0,
    indicators jsonb, -- şeffaflık: her göstergenin adı, ham değeri, sınıfı (buy/sell/neutral)

    -- Yahoo Finance recommendationTrend + financialData'dan GERÇEK analist verisi.
    -- Kapsam yoksa (küçük/az takip edilen ticker) has_analyst_coverage=false olur,
    -- hiçbir zaman sahte sayı üretilmez.
    has_analyst_coverage boolean not null default false,
    analyst_strong_buy smallint,
    analyst_buy smallint,
    analyst_hold smallint,
    analyst_sell smallint,
    analyst_strong_sell smallint,
    analyst_count smallint,
    target_mean numeric,
    target_low numeric,
    target_high numeric,
    target_median numeric,

    -- DeepSeek: yalnızca yukarıdaki GERÇEK rakamları 6 dilde kısa bir yoruma
    -- döken sentez metni. Rakam uydurmaz (bkz. lib/analystConsensus/deepseekSynthesis.ts).
    ai_summary jsonb,

    computed_at timestamptz not null default now()
);

create index idx_tac_ticker on public.technical_analyst_consensus(ticker);
create index idx_tac_computed_at on public.technical_analyst_consensus(computed_at desc);

alter table public.technical_analyst_consensus enable row level security;

-- Herkese açık panel — anonim okuma serbest, yazma yalnızca service-role
-- (/api/technical-analyst-consensus route'u üzerinden).
create policy "technical_analyst_consensus_select_all" on public.technical_analyst_consensus
  for select using (true);
