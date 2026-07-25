-- X Studio "Listeden Seç": admin artık kuyruğa eklerken günlük/haftalık
-- modu ve hedef dili seçebiliyor — bu tercih öğeyle birlikte saklanır.

alter table public.x_content_pool add column if not exists weekly boolean not null default false;
alter table public.x_content_pool add column if not exists locale text;

alter table public.x_content_pool drop constraint if exists x_content_pool_locale_check;
alter table public.x_content_pool add constraint x_content_pool_locale_check
  check (locale is null or locale in ('en', 'es', 'fr', 'pt', 'tr'));
