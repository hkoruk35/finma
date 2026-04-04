-- ═══════════════════════════════════════════════════════════════════════════════
-- FinMA V6+ Multilingual Architecture - Phase 1: Migrate tracking_state to enum
-- Task 1.2: Convert Turkish state values to language-agnostic enum keys
-- Supabase SQL Editor'da çalıştır (migration file)
-- Tarih: 2026-04-04
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Backup current Turkish values to legacy column
-- This is already done in migration 001 (added current_state_legacy column)
-- ─────────────────────────────────────────────────────────────────────────────

-- Copy current Turkish values to legacy column (safe backup)
UPDATE tracking_state
SET current_state_legacy = current_state
WHERE current_state_legacy IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Map Turkish state values to English enum keys
-- Mapping:
--   TAKIP_ET (Monitoring) → track
--   BEKLE (Wait) → wait
--   KADEMELI_AL (Scale in) → scale_in
--   AL (Buy) → buy
--   TUT (Hold) → hold
--   MALIYET_DUŞUR (Cost down) → cost_down
--   KADEMELI_SAT (Scale out) → scale_out
--   SAT (Sell) → sell
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 2a: Update state_key column from current_state values
UPDATE tracking_state
SET state_key = CASE
    WHEN current_state = 'TAKIP_ET' THEN 'track'::tracking_state_key
    WHEN current_state = 'BEKLE' THEN 'wait'::tracking_state_key
    WHEN current_state = 'KADEMELI_AL' THEN 'scale_in'::tracking_state_key
    WHEN current_state = 'AL' THEN 'buy'::tracking_state_key
    WHEN current_state = 'TUT' THEN 'hold'::tracking_state_key
    WHEN current_state = 'MALIYET_DUŞUR' THEN 'cost_down'::tracking_state_key
    WHEN current_state = 'KADEMELI_SAT' THEN 'scale_out'::tracking_state_key
    WHEN current_state = 'SAT' THEN 'sell'::tracking_state_key
    ELSE NULL
END
WHERE state_key IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Replace current_state with enum keys
-- Replace Turkish values with English enum keys in current_state column
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE tracking_state
SET current_state = CASE
    WHEN current_state = 'TAKIP_ET' THEN 'track'
    WHEN current_state = 'BEKLE' THEN 'wait'
    WHEN current_state = 'KADEMELI_AL' THEN 'scale_in'
    WHEN current_state = 'AL' THEN 'buy'
    WHEN current_state = 'TUT' THEN 'hold'
    WHEN current_state = 'MALIYET_DUŞUR' THEN 'cost_down'
    WHEN current_state = 'KADEMELI_SAT' THEN 'scale_out'
    WHEN current_state = 'SAT' THEN 'sell'
    ELSE current_state
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: Update prev_state column with enum keys
-- Migrate prev_state (previous state history) to enum keys as well
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE tracking_state
SET prev_state = CASE
    WHEN prev_state = 'TAKIP_ET' THEN 'track'
    WHEN prev_state = 'BEKLE' THEN 'wait'
    WHEN prev_state = 'KADEMELI_AL' THEN 'scale_in'
    WHEN prev_state = 'AL' THEN 'buy'
    WHEN prev_state = 'TUT' THEN 'hold'
    WHEN prev_state = 'MALIYET_DUŞUR' THEN 'cost_down'
    WHEN prev_state = 'KADEMELI_SAT' THEN 'scale_out'
    WHEN prev_state = 'SAT' THEN 'sell'
    ELSE prev_state
END
WHERE prev_state IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: Change current_state column type to ENUM
-- Now that all values are migrated, change the column type
-- ─────────────────────────────────────────────────────────────────────────────

-- First, convert current_state TEXT column to tracking_state_key ENUM type
ALTER TABLE tracking_state
  ALTER COLUMN current_state TYPE tracking_state_key USING current_state::tracking_state_key;

-- Also convert prev_state to ENUM if needed (optional, keep as TEXT for flexibility)
-- ALTER TABLE tracking_state
--   ALTER COLUMN prev_state TYPE tracking_state_key USING NULLIF(prev_state, '')::tracking_state_key;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: Update state_reason to reflect new keys
-- Optionally update state_reason references from Turkish to English
-- For now, keep as-is and let frontend translate via enum_translations
-- ─────────────────────────────────────────────────────────────────────────────

-- Example: state_reason might contain Turkish descriptions
-- We can leave this as-is since state_reason is user-facing and can stay in Turkish
-- Or translate it using enum_translations lookup

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: Verification Queries
-- Run these to verify migration is complete
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify all values are now enum keys
-- SELECT DISTINCT current_state FROM tracking_state ORDER BY current_state;
-- Expected: 'track', 'wait', 'scale_in', 'buy', 'hold', 'cost_down', 'scale_out', 'sell'

-- Verify state_key column is populated
-- SELECT COUNT(*) as with_key, COUNT(state_key) as with_enum_key FROM tracking_state;
-- Expected: same count (all rows should have state_key)

-- Verify legacy column has old Turkish values (backup)
-- SELECT DISTINCT current_state_legacy FROM tracking_state ORDER BY current_state_legacy;
-- Expected: original Turkish values (TAKIP_ET, BEKLE, etc.)

-- Verify no NULL values in critical columns
-- SELECT COUNT(*) FROM tracking_state WHERE current_state IS NULL OR state_key IS NULL;
-- Expected: 0

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: Deprecation notes
-- After running for 1 week in production (verify everything works):
-- 1. Drop current_state_legacy column (contains old Turkish values)
-- 2. Drop state_key column (current_state is now the enum)
-- 3. Update any references in Python code to use current_state directly
-- ─────────────────────────────────────────────────────────────────────────────

-- Future deprecation (run in 1 week migration):
-- ALTER TABLE tracking_state DROP COLUMN IF EXISTS current_state_legacy;
-- ALTER TABLE tracking_state DROP COLUMN IF EXISTS state_key;
