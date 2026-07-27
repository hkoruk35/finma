-- Create site_visitors table for tracking visitor analytics
CREATE TABLE IF NOT EXISTS site_visitors (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  page TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  user_agent TEXT NOT NULL,
  session_start BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_site_visitors_timestamp ON site_visitors(timestamp DESC);
CREATE INDEX idx_site_visitors_country ON site_visitors(country);
CREATE INDEX idx_site_visitors_page ON site_visitors(page);

-- Enable RLS (Row Level Security)
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

-- Public read for admin - allow unauthenticated reads (or you can restrict to logged-in users)
CREATE POLICY "Allow public read" ON site_visitors
  FOR SELECT USING (true);

-- Restrict writes to admin via service role (enforced at API level with requireAdmin check)
-- This table should only be written to via the API with proper authentication
CREATE POLICY "Admin only insert" ON site_visitors
  FOR INSERT WITH CHECK (false);  -- Disable direct inserts, use API endpoint instead
