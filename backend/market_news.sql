-- Market News Table for Hourly Aggregation
-- Run this in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS market_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    publisher TEXT,
    date TEXT, 
    ticker TEXT DEFAULT 'MARKET',
    impact TEXT DEFAULT 'neutral',
    category TEXT DEFAULT 'market',
    lang TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eğer tablo zaten varsa "lang" kolonunu manuel eklemek için:
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='market_news' AND column_name='lang') THEN
        ALTER TABLE market_news ADD COLUMN lang TEXT DEFAULT 'en';
    END IF;
END $$;

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_market_news_date ON market_news(date DESC);
CREATE INDEX IF NOT EXISTS idx_market_news_category ON market_news(category);
CREATE INDEX IF NOT EXISTS idx_market_news_lang ON market_news(lang);
