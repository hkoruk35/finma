-- ═══════════════════════════════════════════════════════
-- FinMA — Stock Cache Table
-- Pre-computed analiz sonuçlarını saklar
-- Background worker her 5dk'da yeniler
-- Supabase SQL Editor'da çalıştırın
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stock_cache (
    ticker TEXT PRIMARY KEY,
    quote_data JSONB NOT NULL DEFAULT '{}',
    technicals_data JSONB NOT NULL DEFAULT '{}',
    ai_analysis TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Hızlı expiry sorgusu için index
CREATE INDEX IF NOT EXISTS idx_stock_cache_expires ON stock_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_cache_updated ON stock_cache(updated_at);

-- RLS
ALTER TABLE stock_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read stock cache" ON stock_cache FOR SELECT USING (true);
CREATE POLICY "Service write stock cache" ON stock_cache FOR ALL USING (true) WITH CHECK (true);

-- Auto-update trigger
CREATE OR REPLACE TRIGGER stock_cache_updated
    BEFORE UPDATE ON stock_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
