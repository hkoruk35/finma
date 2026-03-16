-- ═══════════════════════════════════════════════════════
-- FinMA Terminal — Supabase PostgreSQL Migration
-- Binlerce eşzamanlı kullanıcı için optimize edilmiş şema
-- Supabase SQL Editor'da çalıştırın
-- ═══════════════════════════════════════════════════════

-- ─── USERS ───
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free', 'gold', 'premium', 'admin')),
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'gold', 'premium', 'admin')),
    full_name TEXT,
    account_type TEXT DEFAULT 'individual',
    company TEXT,
    google_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Username ve email hızlı arama
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;

-- ─── TRADES ───
CREATE TABLE IF NOT EXISTS trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
    type TEXT DEFAULT 'SWING',
    strategy TEXT DEFAULT '',
    entry_price NUMERIC(12,4) NOT NULL,
    current_price NUMERIC(12,4) NOT NULL,
    stop_loss NUMERIC(12,4) NOT NULL,
    target_price NUMERIC(12,4) NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
    entry_date DATE DEFAULT CURRENT_DATE,
    exit_date DATE,
    exit_price NUMERIC(12,4),
    pnl NUMERIC(12,4) DEFAULT 0,
    pnl_pct NUMERIC(8,4) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kullanıcı bazlı trade sorguları
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);

-- ─── SIGNALS ───
CREATE TABLE IF NOT EXISTS signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bot_name TEXT NOT NULL,
    timestamp TEXT,
    market_regime TEXT,
    vix_level NUMERIC(8,2),
    ticker TEXT NOT NULL,
    score NUMERIC(6,2),
    price NUMERIC(12,4),
    action TEXT,
    entry_zone TEXT,
    stop_loss NUMERIC(12,4),
    target NUMERIC(12,4),
    potential_pct NUMERIC(8,2),
    sector TEXT,
    trend_phase TEXT,
    rvol NUMERIC(6,2),
    notes JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sinyal sorguları
CREATE INDEX IF NOT EXISTS idx_signals_ticker ON signals(ticker);
CREATE INDEX IF NOT EXISTS idx_signals_bot ON signals(bot_name);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_sector ON signals(sector);
CREATE INDEX IF NOT EXISTS idx_signals_score ON signals(score DESC);

-- ─── PORTFOLIO SNAPSHOTS ───
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    net_liquidation NUMERIC(14,2),
    cash_available NUMERIC(14,2),
    margin_used NUMERIC(14,2),
    gross_exposure NUMERIC(14,2),
    daily_pnl NUMERIC(14,2),
    weekly_pnl NUMERIC(14,2),
    mtd_pnl NUMERIC(14,2),
    ytd_pnl NUMERIC(14,2),
    open_positions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON portfolio_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON portfolio_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_created ON portfolio_snapshots(user_id, created_at DESC);

-- ─── WATCHLISTS ───
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Ana Liste',
    tickers TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists(user_id);

-- ─── ROW LEVEL SECURITY (RLS) ───
-- Kullanıcılar sadece kendi verilerini görsün

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

-- Service role (backend) her şeye erişebilir
-- Not: Supabase service_role key kullanıyorsanız bu policy'ler
-- otomatik bypass edilir. Anon key kullanıyorsanız aşağıdakileri etkinleştirin:

-- Anon key ile tam erişim (backend için)
-- DROP ve CREATE ile idempotent hale getiriyoruz (IF NOT EXISTS desteklenmiyor)
DO $$ BEGIN
  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service full access users' AND tablename = 'users') THEN
    CREATE POLICY "Service full access users" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- trades
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service full access trades' AND tablename = 'trades') THEN
    CREATE POLICY "Service full access trades" ON trades FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- portfolio_snapshots
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service full access snapshots' AND tablename = 'portfolio_snapshots') THEN
    CREATE POLICY "Service full access snapshots" ON portfolio_snapshots FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- watchlists
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service full access watchlists' AND tablename = 'watchlists') THEN
    CREATE POLICY "Service full access watchlists" ON watchlists FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─── UPDATED_AT TRIGGER ───
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_watchlists_updated_at
    BEFORE UPDATE ON watchlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════
-- Hazır! Supabase Dashboard > SQL Editor'da çalıştırın.
-- Sonra .env dosyasına SUPABASE_URL ve SUPABASE_KEY ekleyin.
-- ═══════════════════════════════════════════════════════
