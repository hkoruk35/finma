-- X Studio: kuyruğa artık sadece hisse (top100/swing/trend/manual) değil,
-- Terminal ana sayfasındaki sektör/endeks/emtia/döviz/kripto varlıkları da
-- "listeden seç" akışıyla eklenebiliyor — source kısıtı buna göre genişletilir.

alter table public.x_content_pool drop constraint if exists x_content_pool_source_check;
alter table public.x_content_pool add constraint x_content_pool_source_check
  check (source in ('top100', 'swing', 'trend', 'manual', 'watchlist', 'sector', 'index', 'commodity', 'fx', 'crypto'));
