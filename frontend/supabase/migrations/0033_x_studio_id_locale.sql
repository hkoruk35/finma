-- 2026-08-11: X-Studio otomasyonu artik "id" (Endonezce) icin de metin
-- uretiyor (bkz. lib/x/generateContent.ts LOCALES = [...,'id']), ama bu 4
-- check constraint hala eski 5 dili listeliyordu. Sonuc: her cron
-- calismasinda x_posts'a 6 dilde satir eklenmeye calisiliyor, 'id' satiri
-- CHECK ihlaliyle reddediliyor, TUM batch insert basarisiz oluyor,
-- startNewCycle() pool item'ini "un-claim" edip null donuyor — otomasyon
-- disaridan "kuyruk bos" gibi gorunerek fiilen tamamen durmus oluyordu.
alter table public.x_posts drop constraint if exists x_posts_locale_check;
alter table public.x_posts add constraint x_posts_locale_check
  check (locale in ('en', 'es', 'fr', 'pt', 'tr', 'id'));

alter table public.x_language_queue drop constraint if exists x_language_queue_next_locale_check;
alter table public.x_language_queue add constraint x_language_queue_next_locale_check
  check (next_locale in ('en', 'es', 'fr', 'pt', 'tr', 'id'));

alter table public.x_content_pool drop constraint if exists x_content_pool_locale_check;
alter table public.x_content_pool add constraint x_content_pool_locale_check
  check (locale is null or locale in ('en', 'es', 'fr', 'pt', 'tr', 'id'));

alter table public.x_recurring_schedules drop constraint if exists x_recurring_schedules_locale_check;
alter table public.x_recurring_schedules add constraint x_recurring_schedules_locale_check
  check (locale in ('en', 'es', 'fr', 'pt', 'tr', 'id') or locale is null);
