-- SPY Signal Engine — real-time 5m/1m trading-signal log
-- Written by spy_signal_engine/db.py:insert_signal() (raw REST, service
-- role key), one row per processed 5m-aligned or 1m-trigger analysis pass.
-- Read by spy_signal_engine/app.py's GET /history and by the frontend's
-- initial-load fetch (WS pushes cover live updates after that).

CREATE TABLE IF NOT EXISTS spy_signals (
  id BIGSERIAL PRIMARY KEY,
  time_utc TIMESTAMPTZ NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'SPY',
  decision TEXT NOT NULL,
  trend TEXT NOT NULL,
  rsi_prev NUMERIC,
  rsi_now NUMERIC,
  macd_dir TEXT,
  vol_ratio_pct NUMERIC,
  vwap NUMERIC,
  above_vwap BOOLEAN,
  candle_shape TEXT,
  support NUMERIC,
  resistance NUMERIC,
  trigger_1m TEXT,
  last_close NUMERIC,
  entry_zone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spy_signals_time_utc ON spy_signals(time_utc DESC);

ALTER TABLE spy_signals ENABLE ROW LEVEL SECURITY;

-- Writes go through spy_signal_engine/db.py using the service-role key
-- (bypasses RLS). This policy just blocks direct anon/authenticated writes;
-- reads are open (same convention as traffic_sessions/traffic_events) since
-- the admin panel reads via the service-backed /history endpoint, not
-- directly via the Supabase client.
CREATE POLICY "Allow read spy_signals" ON spy_signals FOR SELECT USING (true);
CREATE POLICY "Block direct insert spy_signals" ON spy_signals FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct update spy_signals" ON spy_signals FOR UPDATE USING (false);
