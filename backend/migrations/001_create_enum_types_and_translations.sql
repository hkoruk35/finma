-- ═══════════════════════════════════════════════════════════════════════════════
-- FinMA V6+ Multilingual Architecture - Phase 1: Enum Types & Translations
-- Supabase SQL Editor'da çalıştır (migration file)
-- Tarih: 2026-04-04
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Create ENUM Types (lowercase snake_case keys)
-- ─────────────────────────────────────────────────────────────────────────────

-- Sector classification (finance, technology, healthcare, etc.)
CREATE TYPE sector_key AS ENUM (
    'tech',
    'finance',
    'healthcare',
    'energy',
    'materials',
    'industrials',
    'consumer_discr',
    'consumer_staples',
    'telecom',
    'utilities'
);

-- Daily scores tags (classification)
CREATE TYPE daily_scores_tag AS ENUM (
    'core',
    'sector',
    'volume',
    'gainer',
    'loser'
);

-- Daily scores tier (investment grade)
CREATE TYPE daily_scores_tier AS ENUM (
    'strong',
    'high',
    'watch',
    'ignore'
);

-- Tracking state machine (portfolio states)
CREATE TYPE tracking_state_key AS ENUM (
    'track',
    'wait',
    'scale_in',
    'buy',
    'hold',
    'cost_down',
    'scale_out',
    'sell'
);

-- Market regime (bull, bear, sideways)
CREATE TYPE market_regime_key AS ENUM (
    'bull',
    'bear',
    'sideways',
    'accumulation',
    'distribution'
);

-- Interest zone (entry price zones)
CREATE TYPE interest_zone_key AS ENUM (
    'zone_a',
    'zone_b',
    'zone_c',
    'zone_d'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Create enum_translations Table
-- Maps enum keys to localized display values in all supported languages
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enum_translations (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    enum_type       TEXT        NOT NULL,   -- 'sector_key', 'daily_scores_tier', etc.
    enum_key        TEXT        NOT NULL,   -- 'tech', 'strong', 'buy', etc.
    language        TEXT        NOT NULL,   -- 'tr', 'en', 'es', 'pt-BR', 'de', 'fr', 'id', 'ms'
    display_value   TEXT        NOT NULL,   -- 'Teknoloji', 'Technology', 'Tecnología', etc.
    context         TEXT,                   -- Optional: additional context for translators
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure uniqueness: each enum_type + enum_key + language has one display value
    UNIQUE(enum_type, enum_key, language),

    -- Ensure language exists in language_meta
    CONSTRAINT fk_enum_trans_lang FOREIGN KEY (language) REFERENCES language_meta(code)
);

-- Indexes for fast lookups
CREATE INDEX idx_enum_trans_type_lang ON enum_translations(enum_type, language);
CREATE INDEX idx_enum_trans_lookup ON enum_translations(enum_type, enum_key, language);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Add New ENUM Columns to Existing Tables
-- Keep old TEXT columns for migration period, then deprecate
-- ─────────────────────────────────────────────────────────────────────────────

-- Daily Scores: Add enum key columns
ALTER TABLE daily_scores
ADD COLUMN IF NOT EXISTS sector_key sector_key,
ADD COLUMN IF NOT EXISTS tag_key daily_scores_tag,
ADD COLUMN IF NOT EXISTS tier_key daily_scores_tier,
ADD COLUMN IF NOT EXISTS market_regime_key market_regime_key,
ADD COLUMN IF NOT EXISTS interest_zone_key interest_zone_key;

-- Tracking State: Add enum key column
ALTER TABLE tracking_state
ADD COLUMN IF NOT EXISTS state_key tracking_state_key,
ADD COLUMN IF NOT EXISTS current_state_legacy TEXT;  -- Keep old Turkish values for migration

-- AI Insights: Add enum key column
ALTER TABLE ai_insights
ADD COLUMN IF NOT EXISTS interest_zone_key interest_zone_key;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Create Translation Lookup Function
-- Fast SQL function to get display value for an enum key in a language
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION translate_enum(
    p_enum_type TEXT,
    p_enum_key TEXT,
    p_language TEXT DEFAULT 'tr'
) RETURNS TEXT AS $$
DECLARE
    v_display_value TEXT;
BEGIN
    -- Try to find translation for requested language
    SELECT display_value INTO v_display_value
    FROM enum_translations
    WHERE enum_type = p_enum_type
      AND enum_key = p_enum_key
      AND language = COALESCE(p_language, 'tr')
    LIMIT 1;

    -- If found, return it
    IF v_display_value IS NOT NULL THEN
        RETURN v_display_value;
    END IF;

    -- Fallback to English if language not found
    IF p_language != 'en' THEN
        SELECT display_value INTO v_display_value
        FROM enum_translations
        WHERE enum_type = p_enum_type
          AND enum_key = p_enum_key
          AND language = 'en'
        LIMIT 1;

        IF v_display_value IS NOT NULL THEN
            RETURN v_display_value;
        END IF;
    END IF;

    -- Last resort: return the enum_key itself if no translation found
    RETURN p_enum_key;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Seed Initial Translations (English)
-- 8 languages will be populated via backend script in Task 1.3
-- ─────────────────────────────────────────────────────────────────────────────

-- Sector Keys
INSERT INTO enum_translations (enum_type, enum_key, language, display_value, context) VALUES
    ('sector_key', 'tech', 'en', 'Technology', 'Software, hardware, cloud, semiconductors'),
    ('sector_key', 'finance', 'en', 'Financials', 'Banks, insurance, investment firms'),
    ('sector_key', 'healthcare', 'en', 'Healthcare', 'Pharmaceuticals, biotech, medical devices'),
    ('sector_key', 'energy', 'en', 'Energy', 'Oil, gas, renewable energy'),
    ('sector_key', 'materials', 'en', 'Basic Materials', 'Mining, chemicals, metals'),
    ('sector_key', 'industrials', 'en', 'Industrials', 'Manufacturing, machinery, defense'),
    ('sector_key', 'consumer_discr', 'en', 'Consumer Discretionary', 'Retail, automotive, restaurants'),
    ('sector_key', 'consumer_staples', 'en', 'Consumer Staples', 'Food, beverages, household items'),
    ('sector_key', 'telecom', 'en', 'Telecommunications', 'Telecom services, wireless'),
    ('sector_key', 'utilities', 'en', 'Utilities', 'Electric, water, gas utilities')
ON CONFLICT(enum_type, enum_key, language) DO NOTHING;

-- Daily Scores Tags
INSERT INTO enum_translations (enum_type, enum_key, language, display_value, context) VALUES
    ('daily_scores_tag', 'core', 'en', 'Core', 'Core holdings in portfolio'),
    ('daily_scores_tag', 'sector', 'en', 'Sector Leader', 'Leading stock in sector'),
    ('daily_scores_tag', 'volume', 'en', 'High Volume', 'Unusual volume activity'),
    ('daily_scores_tag', 'gainer', 'en', 'Top Gainer', 'Top performing stock'),
    ('daily_scores_tag', 'loser', 'en', 'Top Loser', 'Worst performing stock')
ON CONFLICT(enum_type, enum_key, language) DO NOTHING;

-- Daily Scores Tiers
INSERT INTO enum_translations (enum_type, enum_key, language, display_value, context) VALUES
    ('daily_scores_tier', 'strong', 'en', 'Strong', 'High conviction buy'),
    ('daily_scores_tier', 'high', 'en', 'High', 'Good opportunity'),
    ('daily_scores_tier', 'watch', 'en', 'Watch', 'Monitor for entry'),
    ('daily_scores_tier', 'ignore', 'en', 'Ignore', 'Not recommended')
ON CONFLICT(enum_type, enum_key, language) DO NOTHING;

-- Tracking State Keys
INSERT INTO enum_translations (enum_type, enum_key, language, display_value, context) VALUES
    ('tracking_state_key', 'track', 'en', 'Track', 'Monitoring stock'),
    ('tracking_state_key', 'wait', 'en', 'Wait', 'Waiting for better entry'),
    ('tracking_state_key', 'scale_in', 'en', 'Scaling In', 'Building position gradually'),
    ('tracking_state_key', 'buy', 'en', 'Buy', 'Buy signal active'),
    ('tracking_state_key', 'hold', 'en', 'Hold', 'Hold current position'),
    ('tracking_state_key', 'cost_down', 'en', 'Cost Down', 'Reduce position cost'),
    ('tracking_state_key', 'scale_out', 'en', 'Scaling Out', 'Reducing position'),
    ('tracking_state_key', 'sell', 'en', 'Sell', 'Sell signal active')
ON CONFLICT(enum_type, enum_key, language) DO NOTHING;

-- Market Regime Keys
INSERT INTO enum_translations (enum_type, enum_key, language, display_value, context) VALUES
    ('market_regime_key', 'bull', 'en', 'Bull Market', 'Uptrend, positive sentiment'),
    ('market_regime_key', 'bear', 'en', 'Bear Market', 'Downtrend, negative sentiment'),
    ('market_regime_key', 'sideways', 'en', 'Sideways', 'Range-bound, no clear direction'),
    ('market_regime_key', 'accumulation', 'en', 'Accumulation', 'Smart money buying'),
    ('market_regime_key', 'distribution', 'en', 'Distribution', 'Smart money selling')
ON CONFLICT(enum_type, enum_key, language) DO NOTHING;

-- Interest Zone Keys
INSERT INTO enum_translations (enum_type, enum_key, language, display_value, context) VALUES
    ('interest_zone_key', 'zone_a', 'en', 'Zone A', 'Optimal entry zone (lowest)'),
    ('interest_zone_key', 'zone_b', 'en', 'Zone B', 'Secondary entry zone'),
    ('interest_zone_key', 'zone_c', 'en', 'Zone C', 'Tertiary entry zone'),
    ('interest_zone_key', 'zone_d', 'en', 'Zone D', 'Final entry zone (highest)')
ON CONFLICT(enum_type, enum_key, language) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Verification Queries
-- Run these to verify setup is correct
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify enum_translations table created and seeded with English
-- SELECT COUNT(*) as total_translations, COUNT(DISTINCT language) as languages FROM enum_translations;
-- Expected: 35 rows, 1 language (English)

-- Verify function works
-- SELECT translate_enum('sector_key', 'tech', 'en') as result;
-- Expected: 'Technology'

-- Verify all enum types have English translations
-- SELECT enum_type, COUNT(*) as count FROM enum_translations WHERE language='en' GROUP BY enum_type;
-- Expected: 6 types with correct counts

-- Verify new columns added to tables
-- \d daily_scores  -- Should show sector_key, tag_key, tier_key, market_regime_key, interest_zone_key
-- \d tracking_state -- Should show state_key, current_state_legacy

-- ─────────────────────────────────────────────────────────────────────────────
-- Notes for Task 1.2 (Next migration)
-- ─────────────────────────────────────────────────────────────────────────────
-- After this migration runs successfully:
-- 1. Migrate tracking_state Turkish values → English enum keys
-- 2. Map: TAKIP_ET→track, BEKLE→wait, KADEMELI_AL→scale_in, etc.
-- 3. Then populate remaining 7 languages via backend script in Task 1.3
-- 4. Finally drop current_state_legacy and old TEXT columns (after testing)
