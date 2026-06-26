-- Top 100 Tracker — şirket adı + sektör kolonları
-- Snapshot tablosunda yok; tabloda "Şirket" kolonu ve sektör trend sekmesi için gerekli,
-- ticker eklenirken (admin POST /api/admin/top100) bir kere yazılır.

alter table public.top100_tickers add column company text;
alter table public.top100_tickers add column sector text;
