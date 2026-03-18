-- ═══════════════════════════════════════════════════════
-- FinMA — Market Intelligence Table
-- AI tarafından üretilen saatlik piyasa raporları
-- Supabase SQL Editor'da çalıştırın
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS market_intelligence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- En son raporu hızlı getirmek için index
CREATE INDEX IF NOT EXISTS idx_market_intelligence_created ON market_intelligence(created_at DESC);

-- RLS Ayarları
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (Dashboard için)
CREATE POLICY "Public read market intelligence" ON market_intelligence 
    FOR SELECT USING (true);

-- Backend (service_role) her şeyi yapabilir
CREATE POLICY "Service full access intelligence" ON market_intelligence 
    FOR ALL USING (true) WITH CHECK (true);
