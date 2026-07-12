-- Kullanicinin belirli bir NY saatine ve dile gore onceden planladigi
-- gonderiler icin custom_prompt kolonu (hedefe yonelik AI talimati, denetim
-- amacli) ve 'publishing' ara durumu (yeni cron'un atomik claim adimi icin).
--
-- Not: mevcut otomasyon akisi (x-scheduler) 'scheduled' durumunu scheduled_at
-- set etmeden gecici claim icin kullaniyor; yeni zamanlama akisi her zaman
-- scheduled_at IS NOT NULL ile filtrelenecegi icin iki akis asla çakışmaz.

alter table public.x_posts add column if not exists custom_prompt text;

alter table public.x_posts drop constraint if exists x_posts_status_check;
alter table public.x_posts add constraint x_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'posted', 'failed'));
