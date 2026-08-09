-- x-scheduler (0013_pg_cron_x_scheduler.sql) ile ayni desen: /api/cron/
-- x-recurring-schedules'i pg_cron + pg_net ile dogrudan ve guvenilir sekilde
-- tetikler. 15 dakikalik aralik, "her N saatte bir" (interval_hours>=1) ve
-- haftalik (belirli gun+saat) programlarin makul bir hassasiyetle zamaninda
-- yakalanmasi icin yeterli.
--
-- ONEMLI — GUVENLIK: Bu repo public. CRON_SECRET'in gercek degerini ASLA bu
-- dosyaya yazip commitlemeyin. Asagidaki 'YOUR_CRON_SECRET_HERE' yerine gercek
-- degeri koyup SADECE Supabase SQL Editor'de calistirin; bu dosyayi placeholder
-- ile oldugu gibi birakin.

select cron.schedule(
  'x-recurring-schedules-tick',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://bogastock.com/api/cron/x-recurring-schedules',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET_HERE'),
    timeout_milliseconds := 90000
  );
  $$
);

-- Dogrulama:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--
-- Kaldirmak icin: select cron.unschedule('x-recurring-schedules-tick');
