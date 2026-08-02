-- Kredi bazli kullanim sistemi: $39/ay pakete dahil aylik kredi + ayrica
-- satin alinabilen, suresi dolmayan top-up kredi. Copilot/BogaSmart sorgu
-- tipine gore agirlikli dusum (FAST_ANSWER=1, DEEP_RESEARCH=5).
--
-- NOT: public.user_credits (0015_copilot.sql) ile KARISTIRILMAMALI — o,
-- gunluk AI sohbet kotasidir (200/gun, sabit 1/mesaj), bu tabloyla ilgisizdir.
-- copilot/chat/route.ts artik get_copilot_credit_status/increment_copilot_credit
-- yerine bu dosyadaki consume_credits() RPC'sini cagiriyor; eski tablo/fonksiyonlar
-- veri kaybini onlemek icin silinmedi, sadece kullanilmiyor.

alter table public.members
  add column monthly_credit_balance int not null default 0,
  add column topup_credit_balance int not null default 0,
  add column billing_cycle_start timestamptz,
  add column billing_cycle_end timestamptz;

create table public.credit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  query_type text not null,       -- 'FAST_ANSWER' | 'DEEP_RESEARCH'
  credits_deducted int not null,
  source text not null,           -- 'monthly' | 'topup' -- hangi havuzdan dustu
  created_at timestamptz not null default now()
);

create index credit_logs_user_idx on public.credit_logs (user_id, created_at desc);

alter table public.credit_logs enable row level security;

create policy "credit_logs_select_own" on public.credit_logs
  for select using (auth.uid() = user_id);
-- yazma yalnizca service-role, asagidaki consume_credits() RPC'si uzerinden


create table public.credit_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  credits_purchased int not null,
  amount_paid numeric(10,2) not null,
  stripe_payment_id text,
  created_at timestamptz not null default now()
);

alter table public.credit_topups enable row level security;

create policy "credit_topups_select_own" on public.credit_topups
  for select using (auth.uid() = user_id);
-- yazma yalnizca service-role, Stripe webhook'u uzerinden


-- ── Atomik kredi tuketimi — once aylik havuz, sonra top-up havuzu ────────────
-- increment_copilot_credit'teki gibi (0015_copilot.sql) tek satir UPDATE
-- Postgres'te satir kilidi ile atomiktir; ayrica "for update" ile okuma aninda
-- da satiri kilitleyerek ayni kullanicinin es zamanli iki istekte kredisini
-- iki kere harcamasini (lost update) engeller.
create or replace function public.consume_credits(
  p_user_id uuid,
  p_amount int,
  p_query_type text
)
returns table(success boolean, monthly_remaining int, topup_remaining int)
language plpgsql security definer set search_path = public as $$
declare
  v_monthly int;
  v_topup int;
  v_from_monthly int;
  v_from_topup int;
begin
  select monthly_credit_balance, topup_credit_balance
    into v_monthly, v_topup
    from public.members
    where id = p_user_id
    for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  if v_monthly + v_topup < p_amount then
    return query select false, v_monthly, v_topup;
    return;
  end if;

  v_from_monthly := least(v_monthly, p_amount);
  v_from_topup := p_amount - v_from_monthly;

  update public.members
    set monthly_credit_balance = monthly_credit_balance - v_from_monthly,
        topup_credit_balance = topup_credit_balance - v_from_topup
    where id = p_user_id
    returning monthly_credit_balance, topup_credit_balance into v_monthly, v_topup;

  insert into public.credit_logs (user_id, query_type, credits_deducted, source)
  values (p_user_id, p_query_type, v_from_monthly, 'monthly');

  if v_from_topup > 0 then
    insert into public.credit_logs (user_id, query_type, credits_deducted, source)
    values (p_user_id, p_query_type, v_from_topup, 'topup');
  end if;

  return query select true, v_monthly, v_topup;
end;
$$;


-- ── Top-up kredi ekleme — Stripe checkout.session.completed (mode=payment) ──
create or replace function public.add_topup_credits(
  p_user_id uuid,
  p_credits int
)
returns int
language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  update public.members
    set topup_credit_balance = topup_credit_balance + p_credits
    where id = p_user_id
    returning topup_credit_balance into v_balance;
  return v_balance;
end;
$$;


-- ── Aylik kredi sifirlama — Stripe invoice.payment_succeeded webhook'u ───────
-- Top-up bakiyesine DOKUNMAZ (devreder, expire olmaz) — sadece aylik havuzu
-- yeni fatura donemi degerine sifirlar.
create or replace function public.reset_monthly_credits(
  p_user_id uuid,
  p_amount int,
  p_cycle_start timestamptz,
  p_cycle_end timestamptz
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.members
    set monthly_credit_balance = p_amount,
        billing_cycle_start = p_cycle_start,
        billing_cycle_end = p_cycle_end
    where id = p_user_id;
end;
$$;
