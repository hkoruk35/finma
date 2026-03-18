-- Market News Table for Hourly Aggregation
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS market_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    publisher TEXT,
    date TEXT, 
    ticker TEXT DEFAULT 'MARKET',
    impact TEXT DEFAULT 'neutral',
    category TEXT DEFAULT 'market',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_market_news_date ON market_news(date DESC);
CREATE INDEX IF NOT EXISTS idx_market_news_category ON market_news(category);
