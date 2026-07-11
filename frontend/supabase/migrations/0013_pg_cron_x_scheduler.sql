-- GitHub Actions'in "schedule" tetikleyicisi garantisiz (yuk altinda erteleniyor/
-- atlaniyor — bu repoda 5 dk icin ayarlanmis bir cron, gercekte 1-3.5 saat
-- araliklarla calisti). Bunun yerine veritabaninin kendisi (pg_cron + pg_net)
-- /api/cron/x-scheduler'i dogrudan ve guvenilir sekilde cagirir.
--
-- ONEMLI — GUVENLIK: Bu repo public. CRON_SECRET'in gercek degerini ASLA bu
-- dosyaya yazip commitlemeyin. Asagidaki 'YOUR_CRON_SECRET_HERE' yerine gercek
-- degeri koyup SADECE Supabase SQL Editor'de calistirin; bu dosyayi placeholder
-- ile oldugu gibi birakin.

-- Not: net.http_get'in varsayilan timeout'u 5 saniye — endpoint yeni bir
-- cycle baslatirken (AI metni + piyasa verisi + gorsel render + X'e post)
-- bunu asabiliyor, bu yuzden asagida 90 saniyeye (Vercel route'un maxDuration'i
-- ile ayni) cikartildi. cron.schedule ayni job adiyla tekrar cagrilirsa yeni
-- bir is olusturmaz, mevcut isi gunceller — bu dosyayi tekrar calistirmak guvenli.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'x-scheduler-tick',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://bogastock.com/api/cron/x-scheduler',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET_HERE'),
    timeout_milliseconds := 90000
  );
  $$
);

-- Dogrulama:
--   select * from cron.job;                                        -- is kayitli mi
--   select * from cron.job_run_details order by start_time desc limit 20;  -- calisma gecmisi
--   select * from net._http_response order by created desc limit 20;      -- HTTP yanitlari (200 mu?)
--
-- Kaldirmak icin: select cron.unschedule('x-scheduler-tick');
