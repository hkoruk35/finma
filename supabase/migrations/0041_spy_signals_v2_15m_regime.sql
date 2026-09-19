-- SPY Signal Engine v2 — 30m opening-range regime + 15m primary trigger +
-- 5m entry-timing refinement (replaces the old 5m-trend/1m-trigger math in
-- spy_signal_engine/signal_engine.py — see tasks/active/014-spy-signal-engine-realtime.md
-- and the "toasty-sleeping-boot" plan, section 3).
--
-- Additive only: old columns (trend, rsi_prev, rsi_now, macd_dir,
-- vol_ratio_pct, support, resistance, trigger_1m) are NOT dropped, to avoid
-- losing historical rows written by the old engine. The scheduler simply
-- stops populating them going forward and starts populating the columns
-- added here instead.

ALTER TABLE spy_signals
  ADD COLUMN IF NOT EXISTS regime_30m TEXT,
  ADD COLUMN IF NOT EXISTS trigger_15m TEXT,
  ADD COLUMN IF NOT EXISTS chop_band_hi NUMERIC,
  ADD COLUMN IF NOT EXISTS chop_band_lo NUMERIC,
  ADD COLUMN IF NOT EXISTS atr_15m NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_vol_8_15m NUMERIC,
  ADD COLUMN IF NOT EXISTS vol_ratio_15m_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS stop_spy NUMERIC,
  ADD COLUMN IF NOT EXISTS stop_premium NUMERIC,
  ADD COLUMN IF NOT EXISTS refinement_5m TEXT,
  ADD COLUMN IF NOT EXISTS rsi_5m_prev NUMERIC,
  ADD COLUMN IF NOT EXISTS rsi_5m_now NUMERIC,
  ADD COLUMN IF NOT EXISTS reason TEXT;
