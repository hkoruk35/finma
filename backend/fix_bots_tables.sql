-- ═══════════════════════════════════════════════════════
-- FinMA Terminal — Missing Bots Storage Migration
-- market_news ve market_insider tablolarının eksiklerini giderir.
-- Lütfen Supabase SQL Editor'da çalıştırın.
-- ═══════════════════════════════════════════════════════

-- 1. MARKET NEWS GÜNCELLEMESİ
CREATE TABLE IF NOT EXISTS market_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    publisher TEXT,
    date TEXT, 
    ticker TEXT DEFAULT 'MARKET',
    impact TEXT DEFAULT 'neutral',
    category TEXT DEFAULT 'market',
    lang TEXT DEFAULT 'en',
    description TEXT,
    summary_tr TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(title)
);

-- Tablo zaten var ama summary_tr ve description eksikse ekle
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='market_news' AND column_name='summary_tr') THEN
        ALTER TABLE market_news ADD COLUMN summary_tr TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='market_news' AND column_name='description') THEN
        ALTER TABLE market_news ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='market_news' AND column_name='lang') THEN
        ALTER TABLE market_news ADD COLUMN lang TEXT DEFAULT 'en';
    END IF;
END $$;

-- Optimize edilmesi için indexler
CREATE INDEX IF NOT EXISTS idx_market_news_date ON market_news(date DESC);
CREATE INDEX IF NOT EXISTS idx_market_news_category ON market_news(category);
CREATE INDEX IF NOT EXISTS idx_market_news_lang ON market_news(lang);


-- 2. MARKET INSIDER GÜNCELLEMESİ
CREATE TABLE IF NOT EXISTS market_insider (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    owner TEXT,
    relationship TEXT,
    transaction TEXT,
    date TEXT,
    cost NUMERIC(12,4),
    shares BIGINT,
    value NUMERIC(16,2),
    shares_total BIGINT,
    sec_form_4_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hızlı erişim için
CREATE INDEX IF NOT EXISTS idx_market_insider_date ON market_insider(date DESC);
CREATE INDEX IF NOT EXISTS idx_market_insider_symbol ON market_insider(symbol);

-- Service Role erişimi ve public okuma (Dashboard için)
ALTER TABLE market_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_insider ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read market news' AND tablename = 'market_news') THEN
    CREATE POLICY "Public read market news" ON market_news FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service full access news' AND tablename = 'market_news') THEN
    CREATE POLICY "Service full access news" ON market_news FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read market insider' AND tablename = 'market_insider') THEN
    CREATE POLICY "Public read market insider" ON market_insider FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service full access insider' AND tablename = 'market_insider') THEN
    CREATE POLICY "Service full access insider" ON market_insider FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
