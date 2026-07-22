/**
 * Centralized Ticker to Yahoo Finance symbol mapping helper
 * Ensures Commodities (GOLD -> GC=F), Forex (EURUSD -> EURUSD=X),
 * Crypto (BTCUSD -> BTC-USD), and Indices (VIX -> ^VIX) fetch exact data.
 */

export const TICKER_TO_YAHOO_MAP: Record<string, string> = {
  // Commodities
  GOLD: "GC=F",
  SILVER: "SI=F",
  USOIL: "CL=F",
  NATGAS: "NG=F",

  // Crypto
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
  SOLUSD: "SOL-USD",
  XRPUSD: "XRP-USD",

  // Currencies / Forex
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  NZDUSD: "NZDUSD=X",

  // Indices
  VIX: "^VIX",
  SPX: "^GSPC",
  NDX: "^NDX",
  DJI: "^DJI",
};

export function resolveYahooSymbol(ticker: string): string {
  if (!ticker) return "";
  const clean = ticker.trim().toUpperCase();
  return TICKER_TO_YAHOO_MAP[clean] || clean;
}

export type AssetCategory = "forex" | "commodity" | "crypto" | "stock";

export function getAssetCategory(ticker: string): AssetCategory {
  const clean = ticker.trim().toUpperCase();
  if (["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD"].includes(clean) || clean.endsWith("=X")) {
    return "forex";
  }
  if (["GOLD", "SILVER", "USOIL", "NATGAS"].includes(clean) || clean.endsWith("=F")) {
    return "commodity";
  }
  if (["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD"].includes(clean) || clean.endsWith("-USD")) {
    return "crypto";
  }
  return "stock";
}

export function formatAssetPrice(price: number, ticker: string): string {
  const category = getAssetCategory(ticker);
  if (category === "forex") {
    return price >= 10 ? price.toFixed(2) : price.toFixed(4);
  }
  if (category === "crypto" && price < 10) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}
