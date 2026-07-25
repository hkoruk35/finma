-- BOGA Copilot Akıllı Görevler (Smart Tasks) — böl. 19-23.
-- KRİTİK: `copilot_tasks` tablosu şimdiye kadar HİÇ mevcut değildi.
-- frontend/lib/copilot/tasksEngine.ts zaten bu tabloya yazıyor/okuyordu ama
-- her çağrı catch{} ile sessizce yutuluyordu — yani görev oluşturma UI'da
-- "başarılı" görünüyordu ama hiçbir şey kalıcı olarak kaydedilmiyordu ve
-- hiçbir görev asla çalışmıyordu. Bu migration, tasksEngine.ts'in ZATEN
-- beklediği şemayı (id, user_id, task_type, subject, status, schedule
-- jsonb, alert_on_material_news, last_snapshot, ...) birebir karşılar.

create table public.copilot_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  task_type text not null,
  subject text,
  clarification_answer text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'muted')),
  mute_until timestamptz,
  mute_allow_critical boolean not null default true,
  language text not null default 'tr',
  schedule jsonb not null default '{}'::jsonb, -- { premarket, midday, closing } ET saatleri
  alert_on_material_news boolean not null default true,
  last_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index copilot_tasks_user_status_idx on public.copilot_tasks (user_id, status);

alter table public.copilot_tasks enable row level security;

create policy "copilot_tasks_select_own" on public.copilot_tasks
  for select using (auth.uid() = user_id);
-- yazma yalnızca service-role (API route'ları supabaseAdmin kullanıyor)


-- Görev çalıştırma geçmişi — spec böl. 21 (yaşam döngüsü) + idempotency.
create table public.copilot_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.copilot_tasks(id) on delete cascade,
  idempotency_key text not null unique,
  scheduled_for timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'retrying', 'alternative_source', 'partial_verified',
               'completed', 'delivered_partial', 'failed', 'recovery_scheduled', 'skipped')
  ),
  attempt_count int not null default 0,
  data_timestamp timestamptz,
  delivery_status text check (delivery_status in ('delivered', 'muted', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);

create index copilot_task_runs_task_idx on public.copilot_task_runs (task_id, scheduled_for desc);

alter table public.copilot_task_runs enable row level security;

create policy "copilot_task_runs_select_own" on public.copilot_task_runs
  for select using (
    exists (select 1 from public.copilot_tasks t where t.id = task_id and t.user_id = auth.uid())
  );


-- Snapshot geçmişi — bir önceki ile karşılaştırma için (spec böl. 22).
create table public.copilot_task_snapshots (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.copilot_tasks(id) on delete cascade,
  captured_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index copilot_task_snapshots_task_idx on public.copilot_task_snapshots (task_id, captured_at desc);

alter table public.copilot_task_snapshots enable row level security;

create policy "copilot_task_snapshots_select_own" on public.copilot_task_snapshots
  for select using (
    exists (select 1 from public.copilot_tasks t where t.id = task_id and t.user_id = auth.uid())
  );


-- Kurtarma görevleri — RUNNING -> FAILED -> RECOVERY_SCHEDULED (spec böl. 21).
create table public.copilot_recovery_jobs (
  id uuid primary key default gen_random_uuid(),
  task_run_id uuid not null references public.copilot_task_runs(id) on delete cascade,
  reason text,
  retry_after timestamptz not null,
  attempts int not null default 0,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.copilot_recovery_jobs enable row level security;
-- kullanıcıya doğrudan gösterilmez — sadece service-role/iç işleyiş


-- Üye tarafında (uygulama içi) görülecek bildirim kuyruğu — spec böl. 23
-- (LOW/MEDIUM/HIGH/CRITICAL). Push/e-posta değil, drawer içi bildirim rozeti.
create table public.copilot_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(id) on delete cascade,
  task_id uuid references public.copilot_tasks(id) on delete cascade,
  ticker text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  materiality_score int,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index copilot_alerts_user_unread_idx on public.copilot_alerts (user_id, is_read, created_at desc);

alter table public.copilot_alerts enable row level security;

create policy "copilot_alerts_select_own" on public.copilot_alerts
  for select using (auth.uid() = user_id);

create policy "copilot_alerts_update_own_read" on public.copilot_alerts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
