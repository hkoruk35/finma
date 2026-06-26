-- Top 100 Tracker — şirket adı kolonu
-- Snapshot tablosunda yok; tabloda "Şirket" kolonu için gerekli, ticker eklenirken bir kere yazılır.

alter table public.top100_tickers add column company text;
