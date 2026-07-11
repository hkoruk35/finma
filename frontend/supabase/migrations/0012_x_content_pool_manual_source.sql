-- x_content_pool.source kisitini genisletir: X Studio'da kullanicinin
-- tek tek elle ekledigi ticker'lar icin 'manual' degeri eklenir
-- (page.tsx PoolItem tipinde zaten 'manual' tanimliydi, DB kisiti eksikti).

alter table public.x_content_pool drop constraint if exists x_content_pool_source_check;
alter table public.x_content_pool add constraint x_content_pool_source_check
  check (source in ('top100', 'swing', 'trend', 'manual'));
