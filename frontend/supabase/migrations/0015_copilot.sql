-- BOGA AI Copilot — kredi sistemi, sohbet devamlılığı, kişiselleştirme, arama geçmişi.
-- Desen: custom_watchlists ile aynı (select-own RLS + service-role yazma).

create table public.user_credits (
  user_id uuid primary key references public.members(id) on delete cascade,
  daily_limit int not null default 20,
  current_usage int not null default 0,
  last_reset_date date not null default (now() at time zone 'utc')::date,
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

create policy "user_credits_select_own" on public.user_credits
  for select using (auth.uid() = user_id);
-- yazma yalnızca service-role, aşağıdaki RPC'ler üzerinden


create table public.copilot_chats (
  user_id uuid primary key references public.members(id) on delete cascade,
  chat_state jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.copilot_chats enable row level security;

create policy "copilot_chats_select_own" on public.copilot_chats
  for select using (auth.uid() = user_id);


create table public.copilot_profiles (
  user_id uuid primary key references public.members(id) on delete cascade,
  display_name text,
  avatar_id text not null default 'aylin',
  updated_at timestamptz not null default now()
);

alter table public.copilot_profiles enable row level security;

create policy "copilot_profiles_select_own" on public.copilot_profiles
  for select using (auth.uid() = user_id);


create table public.copilot_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  query text not null,
  ticker text,
  sector text,
  created_at timestamptz not null default now()
);

create index copilot_search_history_user_idx on public.copilot_search_history (user_id, created_at desc);

alter table public.copilot_search_history enable row level security;

create policy "copilot_search_history_select_own" on public.copilot_search_history
  for select using (auth.uid() = user_id);


-- ── Kredi kontrolü — Gemini'yi çağırmadan ÖNCE, atomik (yeni gün ise sıfırlar) ──
-- Sadece durumu okur/sıfırlar, artırmaz — artırma yalnızca başarılı üretimden
-- sonra increment_copilot_credit ile yapılır (kredi sadece başarılı sonuçta düşsün diye).
create or replace function public.get_copilot_credit_status(p_user_id uuid, p_default_limit int)
returns table(current_usage int, daily_limit int)
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  insert into public.user_credits (user_id, daily_limit, current_usage, last_reset_date)
  values (p_user_id, p_default_limit, 0, v_today)
  on conflict (user_id) do nothing;

  update public.user_credits
    set current_usage = 0, last_reset_date = v_today, updated_at = now()
    where user_id = p_user_id and last_reset_date <> v_today;

  return query
    select uc.current_usage, uc.daily_limit
    from public.user_credits uc
    where uc.user_id = p_user_id;
end;
$$;

-- ── Kredi artırımı — yalnızca başarılı /api/copilot/chat yanıtından sonra çağrılır ──
-- Tek bir UPDATE ... SET x = x + 1 ifadesi Postgres'te satır bazında atomiktir,
-- eşzamanlı isteklerde kayıp güncelleme (lost update) olmaz.
create or replace function public.increment_copilot_credit(p_user_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_usage int;
begin
  update public.user_credits
    set current_usage = current_usage + 1, updated_at = now()
    where user_id = p_user_id
    returning current_usage into v_usage;
  return v_usage;
end;
$$;
