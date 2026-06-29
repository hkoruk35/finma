-- /contact formundan gelen mesajlar — önceden data/messages.json dosyasına yazılıyordu
-- (Vercel'de serverless dosya sistemi kalıcı olmadığı için güvenilmezdi).

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

alter table public.contact_messages enable row level security;

-- Public contact formu satır ekleyebilsin (yazma açık, okuma yok)
create policy "contact_messages_public_insert" on public.contact_messages
  for insert with check (true);

-- Okuma yalnızca service-role (/api/admin/inbox) üzerinden.
