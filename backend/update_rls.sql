-- ═══════════════════════════════════════════════════════
-- FinMA Terminal — RLS Policy Update
-- Supabase SQL Editor'da çalıştırın.
-- Anon key kullanan backend'in veri yazabilmesi içindir.
-- ═══════════════════════════════════════════════════════

DO $$ BEGIN
  -- market_news için INSERT yetkisi
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon insert news' AND tablename = 'market_news') THEN
    CREATE POLICY "Anon insert news" ON market_news FOR INSERT WITH CHECK (true);
  END IF;
  
  -- market_insider için INSERT yetkisi
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anon insert insider' AND tablename = 'market_insider') THEN
    CREATE POLICY "Anon insert insider" ON market_insider FOR INSERT WITH CHECK (true);
  END IF;

  -- Anon key ile update/delete yetkilerine şimdilik gerek yok, botlar sadece insert ve select yapar.
END $$;
