// Bot Signal Types
export interface BotSignal {
  ticker: string
  score: number
  price: number
  action: string
  atr?: number
  rvol?: number
  rs_score?: number
  setup?: string
  trend_phase?: string
  entry_zone: string
  stop_loss: number
  target: number
  potential_pct: number
  sector: string
  market_cap?: number
  notes?: string[]
}

export interface SignalReport {
  timestamp: string
  bot_name?: string
  market_regime: string
  sector_leaders?: string[]
  vix_level: number
  candidates: BotSignal[]
}

// Portfolio Types
export interface PortfolioSnapshot {
  net_liquidation: number
  active_pnl?: number
  drawdown?: number
  liquidity_pct?: number
  gross_exposure: number
  cash_available: number
  margin_used: number
  current_24h_pnl: number
  last_7_days_pnl: number
  mtd_pnl: number
  ytd_pnl: number
  open_positions?: number
}

export interface Trade {
  id: string
  ticker: string
  direction: string
  type: string
  strategy: string
  entry_price: number
  current_price: number
  stop_loss: number
  target_price: number
  qty: number
  status: string
  entry_date: string
  exit_date?: string
  exit_price?: number
  pnl: number
  pnl_pct: number
  notes?: string
}

// Market Types
export interface MarketIndex {
  symbol: string
  name?: string
  price: number
  change: number
  change_pct: number
}

export interface WatchlistItem {
  symbol: string
  entry: number
  live: number
  pnl: number
  pnl_pct: number
  sector?: string
}

// User Types
export type UserRole = 'admin' | 'pro' | 'free'

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  subscription_tier: 'free' | 'pro' | 'admin'
}
