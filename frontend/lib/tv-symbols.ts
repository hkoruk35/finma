/**
 * Centralized TradingView Symbol Mapping
 *
 * TradingView requires exchange-prefixed symbols for indices, crypto, and commodities.
 * Without the prefix, ambiguous symbols (like "SPX") may resolve to wrong tickers
 * (e.g., Stellar AfricaGold on TSXV instead of S&P 500).
 *
 * This file is the SINGLE SOURCE OF TRUTH for all TradingView symbol conversions.
 * Never hardcode TradingView symbols elsewhere — always import from here.
 */

/* ── Exchange-Prefixed Symbol Map ── */
const TV_SYMBOL_MAP: Record<string, string> = {
  // ── US Indices ──
  GSPC:  'FOREXCOM:SPXUSD',   // S&P 500 (backend sends ^GSPC)
  SPX:   'FOREXCOM:SPXUSD',   // S&P 500
  DJI:   'TVC:DJI',           // Dow Jones Industrial Average
  IXIC:  'TVC:IXIC',          // NASDAQ Composite
  NDX:   'NASDAQ:NDX',        // NASDAQ 100
  RUT:   'TVC:RUT',           // Russell 2000
  VIX:   'TVC:VIX',           // Volatility Index (CBOE)

  // ── Crypto ──
  BTC:   'COINBASE:BTCUSD',   // Bitcoin
  ETH:   'COINBASE:ETHUSD',   // Ethereum
  BTCUSD: 'COINBASE:BTCUSD',
  ETHUSD: 'COINBASE:ETHUSD',

  // ── Commodities (Futures) ──
  GC:    'COMEX:GC1!',        // Gold Futures
  SI:    'COMEX:SI1!',        // Silver Futures
  CL:    'NYMEX:CL1!',       // Crude Oil WTI Futures

  // ── Sector ETFs (AMEX — explicit prefix for safety) ──
  XLF:   'AMEX:XLF',          // Financials
  XLV:   'AMEX:XLV',          // Healthcare
  XLY:   'AMEX:XLY',          // Consumer Discretionary
  XLI:   'AMEX:XLI',          // Industrials
  XLE:   'AMEX:XLE',          // Energy
  XLK:   'AMEX:XLK',          // Technology
  XLB:   'AMEX:XLB',          // Materials
  XLC:   'AMEX:XLC',          // Communication Services
  XLRE:  'AMEX:XLRE',         // Real Estate
  XLU:   'AMEX:XLU',          // Utilities
  XLP:   'AMEX:XLP',          // Consumer Staples
}

/**
 * Convert any symbol to its TradingView-compatible form.
 * - Known indices/crypto/commodities → exchange-prefixed symbol
 * - Unknown symbols (individual stocks) → passed through as-is
 *   (TradingView resolves AAPL, MSFT, NVDA etc. correctly without prefix)
 */
export function toTvSymbol(symbol: string): string {
  if (!symbol) return symbol
  const upper = symbol.toUpperCase().trim()
  return TV_SYMBOL_MAP[upper] || upper
}

/**
 * Default chart symbol used across the terminal.
 * Always use this constant instead of hardcoding 'SPX' or similar.
 */
export const DEFAULT_CHART_SYMBOL = TV_SYMBOL_MAP.SPX  // FOREXCOM:SPXUSD

/* ── UI Display Name Map ──
 * Backend sends yfinance symbols (GSPC, IXIC, GC, SI, CL).
 * Users expect to see standard/recognizable names.
 * Use toDisplaySymbol() in ALL UI labels (TopBar ticker, Market cards, etc.)
 */
const DISPLAY_SYMBOL_MAP: Record<string, string> = {
  // Backend → UI label
  GSPC:  'SPX',       // ^GSPC → S&P 500
  IXIC:  'NASDAQ',    // ^IXIC → NASDAQ Composite
  GC:    'GOLD',      // Gold Futures
  SI:    'SILVER',    // Silver Futures
  CL:    'OIL',       // Crude Oil WTI
}

/**
 * Convert backend symbol to user-friendly display name.
 * GSPC → SPX, IXIC → NASDAQ, GC → GOLD, SI → SILVER, CL → OIL
 * Unknown symbols pass through unchanged (DJI, BTC, ETH, NVDA, etc.)
 */
export function toDisplaySymbol(symbol: string): string {
  if (!symbol) return symbol
  const upper = symbol.toUpperCase().trim()
  return DISPLAY_SYMBOL_MAP[upper] || upper
}
