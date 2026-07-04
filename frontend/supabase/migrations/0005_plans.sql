-- Paket/fiyatlandırma kataloğu — admin panelden yönetilir.
-- members.plan hâlâ serbest text (gevşek ilişki, FK yok — paket silinse de eski üyeler bozulmaz).

create table public.plans (
  key text primary key,
  name text not null,
  trial_days int not null default 0,
  price_usd numeric not null,
  intro_price_usd numeric,
  intro_months int,
  active boolean not null default true,
  sort_order int not null default 0
);

alter table public.plans enable row level security;

create policy "plans_public_read_active" on public.plans
  for select using (active = true);

insert into public.plans (key, name, trial_days, price_usd, intro_price_usd, intro_months, sort_order)
values
  ('free_trial', 'Free Trial', 7, 0, null, null, 1),
  ('premium', 'Premium', 0, 39, 19, 1, 2);

