import type { SignalReport, PortfolioSnapshot, MarketIndex, Trade, WatchlistItem } from '@/types'

export const mockPortfolio: PortfolioSnapshot = {
  net_liquidation: 1401.13,
  active_pnl: 0.00,
  drawdown: -0.00,
  liquidity_pct: 100.0,
  gross_exposure: 0.0,
  cash_available: 1401.13,
  margin_used: 0.00,
  current_24h_pnl: 0.00,
  last_7_days_pnl: 0.00,
  mtd_pnl: -2.88,
  ytd_pnl: 12.13,
}

export const mockIndices: MarketIndex[] = [
  { symbol: 'DJI', name: 'Dow Jones', price: 466.41, change: 8.23, change_pct: 1.80 },
  { symbol: 'SPX', name: 'S&P 500', price: 662.29, change: 10.39, change_pct: 1.59 },
  { symbol: 'NDX', name: 'Nasdaq', price: 593.72, change: 6.30, change_pct: 1.07 },
  { symbol: 'RUT', name: 'Russell', price: 246.59, change: 5.13, change_pct: 2.12 },
  { symbol: 'VIX', name: 'VIX', price: 24.74, change: -0.37, change_pct: -1.34 },
  { symbol: 'BTC', name: 'Bitcoin', price: 71664, change: 410.41, change_pct: 0.58 },
  { symbol: 'ETH', name: 'Ethereum', price: 2113, change: -28.75, change_pct: -1.34 },
  { symbol: 'GC', name: 'Altın', price: 468.84, change: 5.76, change_pct: 1.24 },
  { symbol: 'SI', name: 'Gümüş', price: 72.69, change: -0.46, change_pct: -0.63 },
  { symbol: 'BLK', name: 'BLK', price: 136.88, change: 2.35, change_pct: 1.75 },
  { symbol: 'BLC', name: 'BLC', price: 57.78, change: -0.45, change_pct: -0.77 },
  { symbol: 'XLF', name: 'XLF', price: 48.89, change: 0.88, change_pct: 1.83 },
  { symbol: 'XLV', name: 'XLV', price: 149.79, change: 1.12, change_pct: 0.75 },
  { symbol: 'XLY', name: 'XLY', price: 118.86, change: -0.36, change_pct: -0.30 },
  { symbol: 'XLI', name: 'XLI', price: 164.65, change: 2.40, change_pct: 1.48 },
  { symbol: 'XLE', name: 'XLE', price: 46.96, change: 0.36, change_pct: 0.77 },
  { symbol: 'XLK', name: 'XLK', price: 49.19, change: -0.24, change_pct: -0.49 },
  { symbol: 'XLB', name: 'XLB', price: 42.25, change: 0.58, change_pct: 1.39 },
  { symbol: 'XLC', name: 'XLC', price: 84.74, change: -0.58, change_pct: -0.68 },
  { symbol: 'XLRE', name: 'XLRE', price: 114.46, change: 1.72, change_pct: 1.53 },
]

export const mockSignals: SignalReport = {
  timestamp: '2026-03-05 14:35:59',
  market_regime: 'Bull',
  sector_leaders: ['Utilities', 'Materials'],
  vix_level: 24.74,
  candidates: [
    { ticker: 'OUT', score: 12.7, price: 26.71, action: 'CLOSE', entry_zone: '28.37 - 29.25', stop_loss: 27.05, target: 32.34, potential_pct: 12.25, sector: 'Real Estate', notes: ['RS: Strong Decoupling', 'Phase: EXPANSION'] },
    { ticker: 'FANG', score: 11.2, price: 182.43, action: 'BUY', entry_zone: '174.60 - 180.00', stop_loss: 168.50, target: 198.00, potential_pct: 4.48, sector: 'Energy', notes: ['Momentum: Strong', 'Volume: Above Average'] },
    { ticker: 'GFS', score: 10.5, price: 41.88, action: 'BUY', entry_zone: '46.37 - 48.00', stop_loss: 43.20, target: 52.50, potential_pct: -9.68, sector: 'Technology', notes: ['Breakout Candidate', 'Sector Rotation'] },
    { ticker: 'NOC', score: 9.8, price: 733.41, action: 'BUY', entry_zone: '728.99 - 735.00', stop_loss: 715.00, target: 765.00, potential_pct: 0.61, sector: 'Industrials', notes: ['Defense Rally', 'RS: Positive'] },
    { ticker: 'OKE', score: 9.3, price: 85.36, action: 'BUY', entry_zone: '83.70 - 85.50', stop_loss: 81.00, target: 92.00, potential_pct: 1.99, sector: 'Energy', notes: ['Dividend Play', 'Support Hold'] },
    { ticker: 'PSA', score: 8.7, price: 297.72, action: 'HOLD', entry_zone: '302.04 - 305.00', stop_loss: 290.00, target: 320.00, potential_pct: -1.43, sector: 'Real Estate', notes: ['REIT Leader', 'Consolidation'] },
    { ticker: 'TIGO', score: 8.4, price: 72.16, action: 'BUY', entry_zone: '69.77 - 71.50', stop_loss: 66.00, target: 80.00, potential_pct: 3.43, sector: 'Communication', notes: ['Emerging Market', 'Growth'] },
    { ticker: 'EQNR', score: 8.1, price: 35.25, action: 'BUY', entry_zone: '31.29 - 33.00', stop_loss: 29.50, target: 38.50, potential_pct: 12.66, sector: 'Energy', notes: ['Energy Recovery', 'Undervalued'] },
    { ticker: 'TGT', score: 7.5, price: 117.37, action: 'HOLD', entry_zone: '116.69 - 118.00', stop_loss: 112.00, target: 125.00, potential_pct: 0.58, sector: 'Consumer', notes: ['Retail Bounce', 'Support Test'] },
    { ticker: 'DELL', score: 7.2, price: 151.70, action: 'BUY', entry_zone: '139.69 - 145.00', stop_loss: 132.00, target: 168.00, potential_pct: 8.60, sector: 'Technology', notes: ['AI Server Play', 'Earnings Beat'] },
    { ticker: 'LMT', score: 6.8, price: 646.10, action: 'HOLD', entry_zone: '642.21 - 648.00', stop_loss: 630.00, target: 670.00, potential_pct: 0.61, sector: 'Industrials', notes: ['Defense Sector', 'Range Bound'] },
    { ticker: 'NTR', score: 6.5, price: 82.86, action: 'BUY', entry_zone: '72.49 - 76.00', stop_loss: 68.00, target: 90.00, potential_pct: 14.31, sector: 'Materials', notes: ['Agriculture Play', 'Oversold Bounce'] },
  ],
}

export const mockTrades: Trade[] = [
  {
    id: '1', ticker: 'AAPL', direction: 'LONG', type: 'SWING', strategy: 'Momentum',
    entry_price: 178.50, current_price: 182.30, stop_loss: 174.00, target_price: 195.00,
    qty: 10, status: 'OPEN', entry_date: '2026-03-01', pnl: 38.00, pnl_pct: 2.13,
  },
  {
    id: '2', ticker: 'MSFT', direction: 'LONG', type: 'SWING', strategy: 'Breakout',
    entry_price: 415.00, current_price: 420.50, stop_loss: 405.00, target_price: 440.00,
    qty: 5, status: 'OPEN', entry_date: '2026-03-03', pnl: 27.50, pnl_pct: 1.33,
  },
]

export const mockWatchlist: WatchlistItem[] = [
  { symbol: 'OUT', entry: 28.37, live: 26.71, pnl: -1.66, pnl_pct: -5.85, sector: 'Real Estate' },
  { symbol: 'FANG', entry: 174.60, live: 182.43, pnl: 7.83, pnl_pct: 4.48, sector: 'Energy' },
  { symbol: 'GFS', entry: 46.37, live: 41.88, pnl: -4.49, pnl_pct: -9.68, sector: 'Technology' },
  { symbol: 'NOC', entry: 728.99, live: 733.41, pnl: 4.42, pnl_pct: 0.61, sector: 'Industrials' },
  { symbol: 'OKE', entry: 83.70, live: 85.36, pnl: 1.66, pnl_pct: 1.99, sector: 'Energy' },
  { symbol: 'PSA', entry: 302.04, live: 297.72, pnl: -4.32, pnl_pct: -1.43, sector: 'Real Estate' },
  { symbol: 'TIGO', entry: 69.77, live: 72.16, pnl: 2.39, pnl_pct: 3.43, sector: 'Communication' },
  { symbol: 'EQNR', entry: 31.29, live: 35.25, pnl: 3.96, pnl_pct: 12.66, sector: 'Energy' },
  { symbol: 'TGT', entry: 116.69, live: 117.37, pnl: 0.68, pnl_pct: 0.58, sector: 'Consumer' },
  { symbol: 'DELL', entry: 139.69, live: 151.70, pnl: 12.01, pnl_pct: 8.60, sector: 'Technology' },
  { symbol: 'LMT', entry: 642.21, live: 646.10, pnl: 3.89, pnl_pct: 0.61, sector: 'Industrials' },
  { symbol: 'NTR', entry: 72.49, live: 82.86, pnl: 10.37, pnl_pct: 14.31, sector: 'Materials' },
]
