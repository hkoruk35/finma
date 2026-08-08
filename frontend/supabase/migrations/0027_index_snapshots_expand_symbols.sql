-- Endeks kapsam genisletmesi (2026-08-08): US 4 (degismedi) + Avrupa 8
-- (5 mevcut + FTSEMIB/SMI/AEX) + Asya 6 (yeni) + Latin Amerika 3 (yeni;
-- IPSA/Sili yfinance'ta veri donmedigi icin roster'a eklenmedi) = 22 sembol.
--
-- index_symbol CHECK constraint'i orijinal 9-sembol listesinden 22-sembol
-- listesine genisletiliyor. Migration 0026 CANLI DB'ye zaten uygulanmis
-- durumda — bu migration ONU YENIDEN CALISTIRMAZ, sadece constraint'i
-- drop+recreate eder. Constraint adi Postgres varsayilan otomatik-isimlendirme
-- kuralina gore <table>_<column>_check seklinde (bkz. 0026'da inline
-- "check (...)" — isim CREATE TABLE sirasinda Postgres tarafindan otomatik
-- uretildi, bu yuzden IF EXISTS ile savunmaci drop kullanilir).

alter table public.index_daily_snapshot
  drop constraint if exists index_daily_snapshot_index_symbol_check;

alter table public.index_daily_snapshot
  add constraint index_daily_snapshot_index_symbol_check
  check (index_symbol in (
    -- US (4) — degismedi
    'SPX', 'NDX', 'DJI', 'RUT',
    -- Avrupa (8) — 5 mevcut + FTSEMIB/SMI/AEX
    'DAX', 'FTSE100', 'CAC40', 'IBEX35', 'STOXX600', 'FTSEMIB', 'SMI', 'AEX',
    -- Asya (6) — yeni
    'NIKKEI225', 'HANGSENG', 'SHANGHAI', 'KOSPI', 'NIFTY50', 'ASX200',
    -- Latin Amerika (3) — yeni (IPSA haric, yfinance'ta cozumlenmedi)
    'BOVESPA', 'IPCMEXICO', 'MERVAL'
  ));

alter table public.index_weekly_snapshot
  drop constraint if exists index_weekly_snapshot_index_symbol_check;

alter table public.index_weekly_snapshot
  add constraint index_weekly_snapshot_index_symbol_check
  check (index_symbol in (
    'SPX', 'NDX', 'DJI', 'RUT',
    'DAX', 'FTSE100', 'CAC40', 'IBEX35', 'STOXX600', 'FTSEMIB', 'SMI', 'AEX',
    'NIKKEI225', 'HANGSENG', 'SHANGHAI', 'KOSPI', 'NIFTY50', 'ASX200',
    'BOVESPA', 'IPCMEXICO', 'MERVAL'
  ));
