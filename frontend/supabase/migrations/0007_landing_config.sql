-- Run this in Supabase SQL Editor
create table if not exists public.landing_config (
  lang text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.landing_config enable row level security;
-- No public policy; only service-role (admin backend) can read/write
