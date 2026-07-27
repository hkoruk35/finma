-- Create insider_transactions table
create table if not exists public.insider_transactions (
  id uuid primary key default gen_random_uuid(),
  cik text not null,
  ticker text not null references public.top100_tickers(ticker) on delete cascade,
  executive_name text not null,
  title text,
  transaction_type text not null check (transaction_type in ('BUY', 'SELL', 'GRANT', 'EXERCISE')),
  shares_transacted integer not null,
  transaction_price numeric(10,2),
  transaction_date date not null,
  filed_date date not null,
  form_type text default 'Form 4',
  is_director boolean default false,
  is_officer boolean default false,
  is_ten_pct_owner boolean default false,
  created_at timestamp with time zone default now(),

  unique(cik, ticker, transaction_date, executive_name, transaction_type, shares_transacted)
);

-- Create indexes for query performance
create index if not exists idx_insider_ticker on public.insider_transactions(ticker);
create index if not exists idx_insider_ticker_date on public.insider_transactions(ticker, transaction_date desc);
create index if not exists idx_insider_date on public.insider_transactions(transaction_date desc);
create index if not exists idx_insider_cik on public.insider_transactions(cik);

-- Enable RLS (read-only for public, similar to top100_snapshot)
alter table public.insider_transactions enable row level security;

create policy "Allow public read access" on public.insider_transactions
  for select
  using (true);

-- Create cik_ticker_map table for caching CIK lookups
create table if not exists public.cik_ticker_map (
  id uuid primary key default gen_random_uuid(),
  cik text unique not null,
  ticker text unique not null references public.top100_tickers(ticker) on delete cascade,
  company_name text,
  last_edgar_check timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index on ticker for lookup performance
create index if not exists idx_cik_map_ticker on public.cik_ticker_map(ticker);

-- Enable RLS on cik_ticker_map
alter table public.cik_ticker_map enable row level security;

create policy "Allow public read access" on public.cik_ticker_map
  for select
  using (true);
