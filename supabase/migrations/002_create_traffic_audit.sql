-- First-Party Traffic Audit & Conversion Funnel
-- Two tables:
--   traffic_sessions: one row per session (first-touch UTM/twclid attribution,
--     frozen at landing; denormalized funnel-stage booleans for fast counting)
--   traffic_events: append-only raw event log (server landing_request per
--     page view + client milestone/interaction/signup events)

CREATE TABLE IF NOT EXISTS traffic_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  first_seen BIGINT NOT NULL,
  last_activity BIGINT NOT NULL,
  landing_pathname TEXT NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  twclid TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  device TEXT,
  suspected_bot_ua BOOLEAN DEFAULT FALSE,
  page_loaded BOOLEAN DEFAULT FALSE,
  active_5s BOOLEAN DEFAULT FALSE,
  active_15s BOOLEAN DEFAULT FALSE,
  active_30s BOOLEAN DEFAULT FALSE,
  interacted BOOLEAN DEFAULT FALSE,
  signup_started BOOLEAN DEFAULT FALSE,
  signup_completed BOOLEAN DEFAULT FALSE,
  signup_started_at BIGINT,
  signup_completed_at BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_sessions_first_seen ON traffic_sessions(first_seen DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_utm_source ON traffic_sessions(utm_source);
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_utm_campaign ON traffic_sessions(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_country ON traffic_sessions(country);
CREATE INDEX IF NOT EXISTS idx_traffic_sessions_visitor_id ON traffic_sessions(visitor_id);

CREATE TABLE IF NOT EXISTS traffic_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  request_id TEXT,
  event_name TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  pathname TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_events_session_id ON traffic_events(session_id);
CREATE INDEX IF NOT EXISTS idx_traffic_events_event_name ON traffic_events(event_name);
CREATE INDEX IF NOT EXISTS idx_traffic_events_timestamp ON traffic_events(timestamp DESC);

-- One-time milestone events must not duplicate per session (landing_request is
-- intentionally excluded — every page view logs its own row for page-view counts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_traffic_events_session_milestone
  ON traffic_events(session_id, event_name)
  WHERE event_name IN (
    'page_loaded', 'active_5s', 'active_15s', 'active_30s',
    'user_interaction', 'signup_started', 'signup_completed'
  );

ALTER TABLE traffic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_events ENABLE ROW LEVEL SECURITY;

-- Writes go through API routes / proxy.ts using the service-role key (bypasses RLS).
-- These policies just block direct anon/authenticated writes; reads are open for the admin UI.
CREATE POLICY "Allow read sessions" ON traffic_sessions FOR SELECT USING (true);
CREATE POLICY "Block direct insert sessions" ON traffic_sessions FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct update sessions" ON traffic_sessions FOR UPDATE USING (false);

CREATE POLICY "Allow read events" ON traffic_events FOR SELECT USING (true);
CREATE POLICY "Block direct insert events" ON traffic_events FOR INSERT WITH CHECK (false);
