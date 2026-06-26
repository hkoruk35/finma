-- BOGA AI Top 100 Tracker + Public Member Section
-- Supabase Auth (auth.users) ile bağlantılı, boga_auth (özel terminal) ile tamamen ayrı.

create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique not null,
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  plan text not null default 'starter',
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

create policy "members_select_own" on public.members
  for select using (auth.uid() = id);

create policy "members_update_own" on public.members
  for update using (auth.uid() = id);

-- auth.users'a yeni kayıt girince otomatik members satırı oluşturur (service-role insert'e gerek kalmaz)
create function public.handle_new_member()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.members (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_member();


create table public.top100_tickers (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  source text not null check (source in ('fixed','swing_daily')),  -- 90 sabit / 10 günlük swing
  added_by text,
  added_at timestamptz not null default now(),
  active boolean not null default true
);

create index top100_tickers_active_source_idx on public.top100_tickers (active, source);

alter table public.top100_tickers enable row level security;

-- Public, salt-okunur: Top 100 Tracker anonim ziyaretçiye de açık (Karar A/I)
create policy "top100_tickers_public_read" on public.top100_tickers
  for select using (true);

-- Yazma: yalnızca service-role (boga_auth==='admin' kontrolünden geçen /api/admin/top100)


create table public.top100_snapshot (
  ticker text primary key references public.top100_tickers(ticker) on delete cascade,
  price numeric,
  volume numeric,
  change_pct numeric,
  ema20 numeric,
  ema50 numeric,
  ema200 numeric,
  rsi numeric,
  macd numeric,
  adx numeric,
  pattern text,
  signal text,                                                    -- Bekle/İzle/AL/SAT
  character text check (character in ('investment','swing')),     -- hesaplanan, kaynaktan bağımsız
  updated_at timestamptz not null default now()
);

alter table public.top100_snapshot enable row level security;

create policy "top100_snapshot_public_read" on public.top100_snapshot
  for select using (true);

-- Yazma: yalnızca service-role (saatlik snapshot job'u)


create table public.member_messages (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  email text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false,
  read_by text,
  read_at timestamptz
);

alter table public.member_messages enable row level security;

-- Hem okuma hem yazma yalnızca service-role üzerinden (/api/members/feedback, /api/admin/member-messages);
-- anon/authenticated rol için herhangi bir public policy tanımlı değil.
