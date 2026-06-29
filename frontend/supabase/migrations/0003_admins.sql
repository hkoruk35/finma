-- Admin yönetimi: env-var tabanlı boga_auth kullanıcılarının yerini alır.
-- Yazma/okuma yalnızca service-role (API route'ları üzerinden) yapılır.

create table public.admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('admin','readonly')) default 'admin',
  created_at timestamptz not null default now(),
  created_by text
);

alter table public.admins enable row level security;
-- Hiçbir public/anon/authenticated policy tanımlı değil — sadece service-role erişebilir.
