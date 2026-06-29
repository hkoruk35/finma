-- Ülke/dil bazlı kampanyalar (banner mesajları).

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  country_code text,           -- null = tüm ülkeler
  lang text,                   -- null = tüm diller
  title text not null,
  message text not null,
  cta_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "campaigns_public_read_active" on public.campaigns
  for select using (active = true);
