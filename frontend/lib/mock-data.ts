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
  { symbol: 'DJI',  name: 'Dow Jones',  price: 41800,   change: -320.50, change_pct: -0.76 },
  { symbol: 'SPX',  name: 'S&P 500',    price: 5580,    change: -45.20,  change_pct: -0.80 },
  { symbol: 'NDX',  name: 'Nasdaq',     price: 19400,   change: -180.30, change_pct: -0.92 },
  { symbol: 'RUT',  name: 'Russell',    price: 2080,    change: -18.40,  change_pct: -0.88 },
  { symbol: 'VIX',  name: 'VIX',        price: 22.50,   change: 1.20,    change_pct: 5.63 },
  { symbol: 'BTC',  name: 'Bitcoin',    price: 83000,   change: -1200,   change_pct: -1.42 },
  { symbol: 'ETH',  name: 'Ethereum',   price: 1950,    change: -55,     change_pct: -2.74 },
  { symbol: 'GC',   name: 'Altın',      price: 2950,    change: 18.50,   change_pct: 0.63 },
  { symbol: 'SI',   name: 'Gümüş',      price: 33.20,   change: 0.25,    change_pct: 0.76 },
  { symbol: 'XLF',  name: 'XLF',        price: 47.20,   change: -0.35,   change_pct: -0.74 },
  { symbol: 'XLV',  name: 'XLV',        price: 142.80,  change: -1.10,   change_pct: -0.76 },
  { symbol: 'XLY',  name: 'XLY',        price: 198.40,  change: -2.80,   change_pct: -1.39 },
  { symbol: 'XLI',  name: 'XLI',        price: 131.60,  change: -1.20,   change_pct: -0.90 },
  { symbol: 'XLE',  name: 'XLE',        price: 88.40,   change: -0.90,   change_pct: -1.01 },
  { symbol: 'XLK',  name: 'XLK',        price: 210.50,  change: -3.20,   change_pct: -1.50 },
  { symbol: 'XLB',  name: 'XLB',        price: 87.30,   change: -0.60,   change_pct: -0.68 },
  { symbol: 'XLC',  name: 'XLC',        price: 96.80,   change: -1.40,   change_pct: -1.42 },
  { symbol: 'XLRE', name: 'XLRE',       price: 38.90,   change: -0.30,   change_pct: -0.77 },
  { symbol: 'XLU',  name: 'XLU',        price: 79.50,   change: 0.40,    change_pct: 0.51 },
  { symbol: 'XLP',  name: 'XLP',        price: 79.20,   change: 0.10,    change_pct: 0.13 },
]

export const mockSignals: SignalReport = {
  timestamp: '2026-03-16 14:35:59',
  bot_name: 'swing112',
  market_regime: 'Bull',
  sector_leaders: ['Energy', 'Materials'],
  vix_level: 20.5,
  candidates: [
    { ticker: 'CGON', score: 35.1, price: 64.82, action: 'BUY', entry_zone: '64.82 - 67.41', stop_loss: 58.41, target: 71.30, potential_pct: 10.00, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 35.1'] },
    { ticker: 'LXU',  score: 33.5, price: 14.75, action: 'BUY', entry_zone: '14.75 - 15.34', stop_loss: 13.02, target: 16.23, potential_pct: 10.03, sector: 'Materials', trend_phase: 'Expansion', notes: ['Swing112 skor: 33.5'] },
    { ticker: 'ADEA', score: 32.5, price: 23.10, action: 'BUY', entry_zone: '23.10 - 24.02', stop_loss: 21.07, target: 25.41, potential_pct: 9.96, sector: 'Technology', trend_phase: 'Expansion', notes: ['Swing112 skor: 32.5'] },
    { ticker: 'PBR',  score: 30.4, price: 18.57, action: 'BUY', entry_zone: '18.57 - 19.14', stop_loss: 17.43, target: 19.99, potential_pct: 7.65, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 30.4'] },
    { ticker: 'STGW', score: 30.0, price: 5.95,  action: 'BUY', entry_zone: '5.95 - 6.19',   stop_loss: 5.17,  target: 6.55,  potential_pct: 10.08, sector: 'Technology', trend_phase: 'Expansion', notes: ['Swing112 skor: 30.0'] },
    { ticker: 'BP',   score: 29.6, price: 42.67, action: 'BUY', entry_zone: '42.67 - 43.65', stop_loss: 40.70, target: 45.13, potential_pct: 5.76, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 29.6'] },
    { ticker: 'DNTH', score: 29.3, price: 78.89, action: 'BUY', entry_zone: '78.89 - 82.04', stop_loss: 68.49, target: 86.77, potential_pct: 9.99, sector: 'Healthcare', trend_phase: 'Expansion', notes: ['Swing112 skor: 29.3'] },
    { ticker: 'UNFI', score: 27.8, price: 41.69, action: 'BUY', entry_zone: '41.69 - 43.36', stop_loss: 37.98, target: 45.86, potential_pct: 10.00, sector: 'Consumer', trend_phase: 'Expansion', notes: ['Swing112 skor: 27.8'] },
    { ticker: 'OXY',  score: 27.4, price: 57.33, action: 'BUY', entry_zone: '57.33 - 59.26', stop_loss: 53.48, target: 62.15, potential_pct: 8.41, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 27.4'] },
    { ticker: 'EGY',  score: 27.3, price: 5.49,  action: 'BUY', entry_zone: '5.49 - 5.70',   stop_loss: 4.91,  target: 6.03,  potential_pct: 9.84, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 27.3'] },
    { ticker: 'ERIC', score: 27.2, price: 11.89, action: 'BUY', entry_zone: '11.89 - 12.20', stop_loss: 11.26, target: 12.67, potential_pct: 6.56, sector: 'Communication', trend_phase: 'Expansion', notes: ['Swing112 skor: 27.2'] },
    { ticker: 'CAPR', score: 26.9, price: 30.65, action: 'BUY', entry_zone: '30.65 - 31.88', stop_loss: 26.15, target: 33.72, potential_pct: 10.02, sector: 'Healthcare', trend_phase: 'Expansion', notes: ['Swing112 skor: 26.9'] },
    { ticker: 'UTHR', score: 26.8, price: 533.37, action: 'BUY', entry_zone: '533.37 - 551.08', stop_loss: 497.95, target: 577.64, potential_pct: 8.30, sector: 'Healthcare', trend_phase: 'Expansion', notes: ['Swing112 skor: 26.8'] },
    { ticker: 'NOK',  score: 26.5, price: 8.64,  action: 'BUY', entry_zone: '8.64 - 8.98',   stop_loss: 7.95,  target: 9.49,  potential_pct: 9.84, sector: 'Communication', trend_phase: 'Expansion', notes: ['Swing112 skor: 26.5'] },
    { ticker: 'DAR',  score: 26.0, price: 54.57, action: 'BUY', entry_zone: '54.57 - 56.36', stop_loss: 50.99, target: 59.05, potential_pct: 8.21, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 26.0'] },
    { ticker: 'NSSC', score: 25.6, price: 42.99, action: 'BUY', entry_zone: '42.99 - 44.61', stop_loss: 39.76, target: 47.03, potential_pct: 9.40, sector: 'Industrials', trend_phase: 'Expansion', notes: ['Swing112 skor: 25.6'] },
    { ticker: 'RLAY', score: 25.0, price: 10.30, action: 'BUY', entry_zone: '10.30 - 10.71', stop_loss: 8.80,  target: 11.32, potential_pct: 9.90, sector: 'Healthcare', trend_phase: 'Expansion', notes: ['Swing112 skor: 25.0'] },
    { ticker: 'APEI', score: 24.7, price: 54.12, action: 'BUY', entry_zone: '54.12 - 55.32', stop_loss: 48.55, target: 57.13, potential_pct: 5.56, sector: 'Consumer', trend_phase: 'Expansion', notes: ['Swing112 skor: 24.7'] },
    { ticker: 'PSX',  score: 24.5, price: 173.67, action: 'BUY', entry_zone: '173.67 - 178.93', stop_loss: 163.14, target: 186.83, potential_pct: 7.58, sector: 'Energy', trend_phase: 'Expansion', notes: ['Swing112 skor: 24.5'] },
    { ticker: 'TALK', score: 23.7, price: 5.14,  action: 'BUY', entry_zone: '5.14 - 5.35',   stop_loss: 4.73,  target: 5.66,  potential_pct: 10.12, sector: 'Technology', trend_phase: 'Expansion', notes: ['Swing112 skor: 23.7'] },
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
  { symbol: 'CGON', entry: 64.82, live: 64.82, pnl: 0.00, pnl_pct: 0.00, sector: 'Energy' },
  { symbol: 'LXU',  entry: 14.75, live: 14.75, pnl: 0.00, pnl_pct: 0.00, sector: 'Materials' },
  { symbol: 'ADEA', entry: 23.10, live: 23.10, pnl: 0.00, pnl_pct: 0.00, sector: 'Technology' },
  { symbol: 'PBR',  entry: 18.57, live: 18.57, pnl: 0.00, pnl_pct: 0.00, sector: 'Energy' },
  { symbol: 'STGW', entry: 5.95,  live: 5.95,  pnl: 0.00, pnl_pct: 0.00, sector: 'Technology' },
  { symbol: 'BP',   entry: 42.67, live: 42.67, pnl: 0.00, pnl_pct: 0.00, sector: 'Energy' },
  { symbol: 'DNTH', entry: 78.89, live: 78.89, pnl: 0.00, pnl_pct: 0.00, sector: 'Healthcare' },
  { symbol: 'UNFI', entry: 41.69, live: 41.69, pnl: 0.00, pnl_pct: 0.00, sector: 'Consumer' },
  { symbol: 'OXY',  entry: 57.33, live: 57.33, pnl: 0.00, pnl_pct: 0.00, sector: 'Energy' },
  { symbol: 'EGY',  entry: 5.49,  live: 5.49,  pnl: 0.00, pnl_pct: 0.00, sector: 'Energy' },
]
