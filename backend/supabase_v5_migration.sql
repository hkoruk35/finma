-- FinMA v5.0 Migration — Yeni tablolar
-- Çalıştırma: Supabase SQL Editor'da çalıştır

-- 1. notifications tablosu
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'system',  -- system, signal, alert, news
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);

-- 2. smart_watchlist tablosu
CREATE TABLE IF NOT EXISTS smart_watchlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    company_name TEXT,
    sector TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    alert_price NUMERIC,
    notes TEXT,
    UNIQUE(user_id, ticker)
);
CREATE INDEX IF NOT EXISTS idx_smart_watchlist_user ON smart_watchlist(user_id);

-- 3. opportunities tablosu (swing113 çıktısı)
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_timestamp TIMESTAMPTZ NOT NULL,
    run_time_ny TEXT,
    rank INTEGER,
    ticker TEXT NOT NULL,
    company_name TEXT,
    sector TEXT,
    price NUMERIC,
    score NUMERIC,
    entry_zone TEXT,
    stop_loss NUMERIC,
    target NUMERIC,
    potential_pct NUMERIC,
    reason TEXT,
    visible_to TEXT DEFAULT 'pro',  -- 'free' = rank 1 görünür, 'pro' = tümü
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_run_timestamp ON opportunities(run_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_ticker ON opportunities(ticker);

-- 4. user_portfolios tablosu (çoklu portföy)
CREATE TABLE IF NOT EXISTS user_portfolios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Portföy 1',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_portfolios_user ON user_portfolios(user_id);

-- 5. portfolio_holdings tablosu
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_id UUID REFERENCES user_portfolios(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    company_name TEXT,
    qty NUMERIC DEFAULT 0,
    avg_cost NUMERIC DEFAULT 0,
    product_type TEXT DEFAULT 'stock',  -- stock, etf, call, put, forex, oil, bitcoin, ethereum
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_portfolio ON portfolio_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user ON portfolio_holdings(user_id);

-- 6. screener_results tablosu
CREATE TABLE IF NOT EXISTS screener_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filter_params JSONB,
    results JSONB,
    result_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_screener_results_user ON screener_results(user_id);

-- 7. trades tablosuna product_type kolonu ekle (yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trades' AND column_name = 'product_type') THEN
        ALTER TABLE trades ADD COLUMN product_type TEXT DEFAULT 'stock';
    END IF;
END $$;

-- 8. users tablosuna scan_credits ve watch_slots ekle (yoksa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'scan_credits') THEN
        ALTER TABLE users ADD COLUMN scan_credits INTEGER DEFAULT 10;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'watch_slots') THEN
        ALTER TABLE users ADD COLUMN watch_slots INTEGER DEFAULT 10;
    END IF;
END $$;

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_portfolios_updated_at ON user_portfolios;
CREATE TRIGGER update_user_portfolios_updated_at
    BEFORE UPDATE ON user_portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_portfolio_holdings_updated_at ON portfolio_holdings;
CREATE TRIGGER update_portfolio_holdings_updated_at
    BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Service role full access)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE screener_results ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "service_role_all_notifications" ON notifications FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_watchlist" ON smart_watchlist FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_opportunities" ON opportunities FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_portfolios" ON user_portfolios FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_holdings" ON portfolio_holdings FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all_screener" ON screener_results FOR ALL TO service_role USING (true);
