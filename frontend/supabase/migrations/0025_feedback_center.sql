-- Feedback Center — herkese açık (guest dahil) floating buton + admin iş
-- akışı (durum/öncelik/aksiyon/cevap). Mevcut member_messages'tan (sadece
-- giriş yapmış üye, kategori/durum yok) KASITLI olarak ayrı — o akış
-- (FeedbackForm.tsx, /api/members/feedback) hiç değiştirilmedi, yanına
-- kuruldu.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  member_id uuid references public.members(id) on delete set null,
  email text not null,
  category text not null,
  message text not null,
  page_url text,
  page_path text,
  locale text,
  device_type text,
  user_agent text,
  viewport text,
  plan text,
  screenshot_url text,
  status text not null default 'new',
  priority text not null default 'normal',
  action text,
  action_note text,
  assigned_to text,
  archived_at timestamptz
);

create index feedback_status_idx on public.feedback (status, created_at desc);
create index feedback_member_idx on public.feedback (member_id) where member_id is not null;

alter table public.feedback enable row level security;
-- Okuma/yazma yalnızca service-role üzerinden (/api/feedback, /api/admin/feedback);
-- anon/authenticated rol için herhangi bir public policy yok — member_messages ile aynı desen.

create table public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  sender_type text not null default 'admin',
  message text not null,
  created_at timestamptz not null default now(),
  email_sent boolean not null default false
);

create index feedback_replies_feedback_idx on public.feedback_replies (feedback_id, created_at);

alter table public.feedback_replies enable row level security;
-- Aynı şekilde yalnızca service-role.

-- Ekran görüntüsü yüklemeleri için Storage bucket — public read (URL doğrudan
-- admin panelinde <img> ile gösterilecek), yazma yalnızca service-role.
insert into storage.buckets (id, name, public)
values ('feedback-screenshots', 'feedback-screenshots', true)
on conflict (id) do nothing;
