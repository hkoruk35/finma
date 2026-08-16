-- Migration: AI Challenge Engine Core Tables (Revised)
-- Purpose: Create auditable, secure, and state-managed tables for AI Portfolio Manager

-- 1. ai_challenges: Tracks overall portfolio health
CREATE TABLE IF NOT EXISTS public.ai_challenges (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_number serial NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    
    initial_capital numeric(12,2) DEFAULT 1000.00 NOT NULL,
    cash_balance numeric(12,2) DEFAULT 1000.00 NOT NULL,
    reserved_cash numeric(12,2) DEFAULT 0.00 NOT NULL,
    available_cash numeric(12,2) GENERATED ALWAYS AS (cash_balance - reserved_cash) STORED,
    
    current_equity numeric(12,2) DEFAULT 1000.00 NOT NULL,
    peak_equity numeric(12,2) DEFAULT 1000.00 NOT NULL,
    
    realized_pnl numeric(12,2) DEFAULT 0.00 NOT NULL,
    unrealized_pnl numeric(12,2) DEFAULT 0.00 NOT NULL,
    
    total_return_pct numeric(8,4) DEFAULT 0.0000 NOT NULL,
    target_return_pct numeric(8,4) DEFAULT 10.0000 NOT NULL,
    drawdown_pct numeric(8,4) DEFAULT 0.0000 NOT NULL,
    max_drawdown numeric(8,4) DEFAULT 0.0000 NOT NULL,
    
    benchmark_spy_return numeric(8,4) DEFAULT 0.0000,
    benchmark_qqq_return numeric(8,4) DEFAULT 0.0000,
    
    status text NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'STOPPED')),
    risk_state text NOT NULL DEFAULT 'NORMAL' CHECK (risk_state IN ('NORMAL', 'REDUCED', 'LOCKED', 'STOPPED')),
    
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. ai_challenge_decisions: Freezes the AI's intent and context
CREATE TABLE IF NOT EXISTS public.ai_challenge_decisions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id uuid NOT NULL REFERENCES public.ai_challenges(id) ON DELETE CASCADE,
    
    decision_window text,
    market_timestamp timestamp with time zone NOT NULL,
    
    portfolio_snapshot jsonb NOT NULL,
    market_snapshot jsonb NOT NULL,
    
    requested_action text NOT NULL,
    ticker text,
    requested_allocation numeric(12,2),
    requested_entry numeric(10,2),
    requested_stop numeric(10,2),
    requested_targets jsonb,
    
    confidence integer,
    reasoning_summary text,
    
    model_version text,
    prompt_version text,
    strategy_version text,
    scanner_version text,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. ai_challenge_orders: Tracks intent and partial fills before becoming a position
CREATE TABLE IF NOT EXISTS public.ai_challenge_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id uuid NOT NULL REFERENCES public.ai_challenges(id) ON DELETE CASCADE,
    decision_id uuid REFERENCES public.ai_challenge_decisions(id) ON DELETE SET NULL,
    
    ticker text NOT NULL,
    side text NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type text NOT NULL CHECK (order_type IN ('LIMIT', 'MARKET', 'STOP')),
    
    limit_price numeric(10,2),
    requested_quantity numeric(12,4) NOT NULL,
    filled_quantity numeric(12,4) DEFAULT 0.0000 NOT NULL,
    remaining_quantity numeric(12,4) NOT NULL,
    average_fill_price numeric(10,2),
    
    status text NOT NULL CHECK (status IN ('CREATED', 'APPROVED', 'PENDING', 'PARTIAL', 'FILLED', 'CANCELLED', 'EXPIRED', 'REJECTED')),
    
    reserved_cash numeric(12,2) DEFAULT 0.00 NOT NULL,
    reserved_at timestamp with time zone,
    released_at timestamp with time zone,
    expires_at timestamp with time zone,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. ai_challenge_positions: Tracks actual market exposure
CREATE TABLE IF NOT EXISTS public.ai_challenge_positions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id uuid NOT NULL REFERENCES public.ai_challenges(id) ON DELETE CASCADE,
    ticker text NOT NULL,
    
    status text NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
    close_reason text,
    
    initial_allocation numeric(12,2) NOT NULL,
    
    shares numeric(12,4) NOT NULL,
    average_cost numeric(10,2) NOT NULL,
    current_price numeric(10,2) NOT NULL,
    current_market_value numeric(12,2) NOT NULL,
    
    initial_stop numeric(10,2),
    current_stop numeric(10,2),
    target_1 numeric(10,2),
    target_2 numeric(10,2),
    
    unrealized_pnl numeric(12,2) DEFAULT 0.00 NOT NULL,
    realized_pnl numeric(12,2) DEFAULT 0.00 NOT NULL,
    
    max_favorable_excursion numeric(10,2),
    max_adverse_excursion numeric(10,2),
    
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. ai_challenge_ledger: Immutable audit trail with hashing
CREATE TABLE IF NOT EXISTS public.ai_challenge_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id uuid NOT NULL REFERENCES public.ai_challenges(id) ON DELETE CASCADE,
    sequence_number integer NOT NULL,
    
    decision_id uuid REFERENCES public.ai_challenge_decisions(id) ON DELETE SET NULL,
    position_id uuid REFERENCES public.ai_challenge_positions(id) ON DELETE SET NULL,
    order_id uuid REFERENCES public.ai_challenge_orders(id) ON DELETE SET NULL,
    
    event_type text NOT NULL,
    requested_action text NOT NULL,
    approved_action text NOT NULL,
    
    decision_price numeric(10,2),
    execution_price numeric(10,2),
    reference_price numeric(10,2),
    slippage_bps integer,
    
    quantity numeric(12,4),
    
    previous_state jsonb,
    new_state jsonb,
    
    reason text,
    confidence_score integer,
    risk_check_result jsonb,
    
    market_timestamp timestamp with time zone,
    
    hash text NOT NULL,
    previous_hash text,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(challenge_id, sequence_number)
);

-- Trigger to PREVENT updates or deletes on ledger to guarantee immutability
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates and deletes are strictly prohibited on ai_challenge_ledger table for audit integrity.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_challenge_ledger_no_update
    BEFORE UPDATE ON public.ai_challenge_ledger
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_mutation();

CREATE TRIGGER ai_challenge_ledger_no_delete
    BEFORE DELETE ON public.ai_challenge_ledger
    FOR EACH ROW
    EXECUTE FUNCTION prevent_ledger_mutation();


-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_challenges_modtime
    BEFORE UPDATE ON public.ai_challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER update_ai_challenge_orders_modtime
    BEFORE UPDATE ON public.ai_challenge_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER update_ai_challenge_positions_modtime
    BEFORE UPDATE ON public.ai_challenge_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_column();


-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_challenge_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_challenge_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_challenge_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_challenge_ledger ENABLE ROW LEVEL SECURITY;

-- Note: In production, access is purely managed by API server.
-- RLS policies could strictly limit read access to authenticated service_role only.
-- Here we add read-only for public just as baseline, but next.js handles resolving tiers.
CREATE POLICY "Allow public read ai_challenges" ON public.ai_challenges FOR SELECT USING (true);
CREATE POLICY "Allow public read ai_challenge_decisions" ON public.ai_challenge_decisions FOR SELECT USING (true);
CREATE POLICY "Allow public read ai_challenge_orders" ON public.ai_challenge_orders FOR SELECT USING (true);
CREATE POLICY "Allow public read ai_challenge_positions" ON public.ai_challenge_positions FOR SELECT USING (true);
CREATE POLICY "Allow public read ai_challenge_ledger" ON public.ai_challenge_ledger FOR SELECT USING (true);
