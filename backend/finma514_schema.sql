-- ═══════════════════════════════════════════════════════════════════
-- FinMA514 — Sprint 1 Supabase Şeması
-- Supabase SQL Editor'da çalıştır (tek seferlik migration)
-- Mevcut tablolar korunur (IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. daily_scores ────────────────────────────────────────────────
-- finma514 botunun her çalışmasında ürettiği 54 hisse skoru
CREATE TABLE IF NOT EXISTS daily_scores (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    run_timestamp TIMESTAMPTZ NOT NULL,
    market_date   DATE        NOT NULL,
    run_time_ny   TEXT        NOT NULL,          -- '06:30' | '12:00'
    ticker        TEXT        NOT NULL,
    company_name  TEXT,
    sector        TEXT,
    industry      TEXT,
    exchange      TEXT,
    market_cap    BIGINT      DEFAULT 0,
    tag           TEXT        NOT NULL,          -- CORE | SECTOR | VOLUME | GAINER | LOSER
    tier          TEXT        NOT NULL,          -- STRONG | HIGH | WATCH | IGNORE
    score         INTEGER     NOT NULL,
    score_trend   INTEGER     DEFAULT 0,
    score_volume  INTEGER     DEFAULT 0,
    score_momentum INTEGER    DEFAULT 0,
    score_context INTEGER     DEFAULT 0,
    price         NUMERIC(12,4),
    change_1d     NUMERIC(8,4),
    change_5d     NUMERIC(8,4),
    change_1m     NUMERIC(8,4),
    rvol          NUMERIC(8,4),
    rsi           NUMERIC(8,4),
    adx           NUMERIC(8,4),
    atr_pct       NUMERIC(8,4),
    bb_width      NUMERIC(8,4),
    ema20         NUMERIC(12,4),
    ema50         NUMERIC(12,4),
    ema200        NUMERIC(12,4),
    interest_zone TEXT,
    stop_loss     NUMERIC(12,4),
    target_1      NUMERIC(12,4),
    target_2      NUMERIC(12,4),
    market_regime TEXT,
    vix           NUMERIC(6,2),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tarih + ticker üzerinden hızlı arama
CREATE INDEX IF NOT EXISTS idx_daily_scores_date        ON daily_scores(market_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_scores_ticker      ON daily_scores(ticker);
CREATE INDEX IF NOT EXISTS idx_daily_scores_run         ON daily_scores(run_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_daily_scores_tag         ON daily_scores(market_date, tag);
CREATE INDEX IF NOT EXISTS idx_daily_scores_tier        ON daily_scores(market_date, tier);

-- Unique constraint: aynı run içinde aynı ticker bir kez
CREATE UNIQUE INDEX IF NOT EXISTS uix_daily_scores_run_ticker
    ON daily_scores(run_timestamp, ticker);


-- ─── 2. ai_insights ─────────────────────────────────────────────────
-- Her hisse için AI üretimi metin (7 alan × 7 dil)
CREATE TABLE IF NOT EXISTS ai_insights (
    id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    ticker           TEXT        NOT NULL,
    market_date      DATE        NOT NULL,
    run_timestamp    TIMESTAMPTZ NOT NULL,
    lang             TEXT        NOT NULL DEFAULT 'tr',   -- tr | en | es | pt | ar | id | ja
    market_context   TEXT,
    interest_zone_text TEXT,
    scenario_bull    TEXT,
    scenario_bear    TEXT,
    scenario_neutral TEXT,
    risk_reference   TEXT,
    strategy_note    TEXT,
    generated_by     TEXT        DEFAULT 'template_v1',  -- template_v1 | gemini-1.5-flash
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_ticker_date ON ai_insights(ticker, market_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_lang        ON ai_insights(market_date, lang);

-- Aynı run için aynı ticker + dil kombinasyonu bir kez
CREATE UNIQUE INDEX IF NOT EXISTS uix_ai_insights_run_ticker_lang
    ON ai_insights(run_timestamp, ticker, lang);


-- ─── 3. tracking_list ───────────────────────────────────────────────
-- Kullanıcı takip listesi (Smart Tracking add-on)
CREATE TABLE IF NOT EXISTS tracking_list (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        REFERENCES users(id) ON DELETE CASCADE,
    ticker       TEXT        NOT NULL,
    company_name TEXT,
    entry_price  NUMERIC(12,4),
    entry_date   DATE        DEFAULT CURRENT_DATE,
    profile      TEXT        DEFAULT 'swing' CHECK (profile IN ('day', 'swing')),
    notes        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_tracking_list_user ON tracking_list(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_list_ticker ON tracking_list(ticker);


-- ─── 4. tracking_state ──────────────────────────────────────────────
-- Canlı state machine direktifleri (5dk'da bir güncellenir)
CREATE TABLE IF NOT EXISTS tracking_state (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
    ticker          TEXT        NOT NULL,
    current_state   TEXT        NOT NULL DEFAULT 'TAKIP_ET',
    -- TAKIP_ET | BEKLE | KADEMELI_AL | AL | TUT | MALIYET_DUŞUR | KADEMELI_SAT | SAT
    score           INTEGER,
    tp              NUMERIC(12,4),
    sl              NUMERIC(12,4),
    state_reason    TEXT,
    prev_state      TEXT,
    state_changed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_tracking_state_user   ON tracking_state(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_state_ticker ON tracking_state(ticker);


-- ─── 5. usage_log ───────────────────────────────────────────────────
-- Kullanım analizi ve Free plan kota kontrolü
CREATE TABLE IF NOT EXISTS usage_log (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT        NOT NULL,
    -- view_detail | view_sector | export | tracking_add | api_call
    ticker      TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_log_user_date
    ON usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_action
    ON usage_log(user_id, action_type, created_at DESC);


-- ─── 6. subscriptions ───────────────────────────────────────────────
-- Stripe abonelik yönetimi
CREATE TABLE IF NOT EXISTS subscriptions (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID        REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    plan           TEXT        NOT NULL DEFAULT 'free'
                               CHECK (plan IN ('free', 'pro', 'tracking')),
    stripe_id      TEXT,       -- Stripe subscription ID
    stripe_cust_id TEXT,       -- Stripe customer ID
    status         TEXT        DEFAULT 'active'
                               CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    trial_ends_at  TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_id)
    WHERE stripe_id IS NOT NULL;


-- ─── Row Level Security (RLS) ────────────────────────────────────────
-- Kullanıcı kendi verisini görür; daily_scores ve ai_insights herkese açık (read)

ALTER TABLE daily_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_list  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;

-- daily_scores: herkes okuyabilir (anon + authenticated)
CREATE POLICY "daily_scores_select_all" ON daily_scores
    FOR SELECT USING (true);

-- ai_insights: herkes okuyabilir
CREATE POLICY "ai_insights_select_all" ON ai_insights
    FOR SELECT USING (true);

-- tracking_list: sadece sahibi
CREATE POLICY "tracking_list_owner" ON tracking_list
    FOR ALL USING (auth.uid() = user_id);

-- tracking_state: sadece sahibi
CREATE POLICY "tracking_state_owner" ON tracking_state
    FOR ALL USING (auth.uid() = user_id);

-- usage_log: sadece sahibi
CREATE POLICY "usage_log_owner" ON usage_log
    FOR ALL USING (auth.uid() = user_id);

-- subscriptions: sadece sahibi
CREATE POLICY "subscriptions_owner" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);
