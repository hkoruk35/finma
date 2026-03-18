-- Portfolio Settings Table for Initial Capital and Risk Limits
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS portfolio_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    initial_capital NUMERIC DEFAULT 10000.0,
    risk_per_trade NUMERIC DEFAULT 2.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Ensure columns exist if table already exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='portfolio_settings' AND column_name='risk_per_trade') THEN
        ALTER TABLE portfolio_settings ADD COLUMN risk_per_trade NUMERIC DEFAULT 2.0;
    END IF;
END $$;
