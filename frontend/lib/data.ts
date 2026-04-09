/**
 * FinMA Data Loader — reads JSON from transfer/latest/ or public/mock/
 * In production, this reads from the deployed static JSON endpoint.
 * In dev, it reads from local mock data.
 */

export interface StockQuickView {
  ticker: string;
  company: string;
  sector: string;
  master_score: number;
  signal_type: string;
  price: number;
  change_pct: number;
  entry_range_low: number;
  entry_range_high: number;
}

export interface MasterData {
  date: string;
  generated_at: string;
  total_tickers_scanned: number;
  active_signals_count: number;
  market_regime: string;
  menus: Record<string, { count: number; tickers: string[] }>;
  sector_summary: Record<string, { avg_score: number; top_ticker: string; stock_count: number }>;
  top_3_overall: { ticker: string; score: number; signal: string }[];
  market_indices: Record<string, { value: number; change_pct: number }>;
}

export interface StockDetail {
  ticker: string;
  company: string;
  date: string;
  sector: string;
  industry: string;
  price: {
    current: number;
    open: number;
    high: number;
    low: number;
    prev_close: number;
    change: number;
    change_pct: number;
    volume: number;
    avg_volume_30d: number;
  };
  scores: {
    master_score: number;
    technical_score: number;
    fundamental_score: number;
    momentum_score: number;
    sentiment_score: number;
    sector_score: number;
    breakout_score: number;
    value_score: number;
    reversal_score: number;
    dividend_score: number;
    confidence: number;
    signal_type: string;
  };
  technical: Record<string, any>;
  fundamental: Record<string, any>;
  breakout: {
    squeeze_intensity: string;
    breakout_direction: string;
    breakout_score: number;
    previous_breakouts_2y: number;
  };
  sector_context: {
    sector_etf: string;
    sector_performance_5d: number;
  };
  insider_activity: {
    last_90_days_buys: number;
    last_90_days_sells: number;
    net_direction: string;
    last_transaction: string;
  };
  signals: {
    signal_type: string;
    entry_range_low: number;
    entry_range_high: number;
    target_price: number;
    target_range_low: number;
    target_range_high: number;
    stop_loss: number;
    stop_range_low: number;
    stop_range_high: number;
    risk_reward_ratio: number;
    categories: string[];
  };
  news: { headline: string; url: string; source: string; published: string; sentiment: string }[];
  ai_summary: string;
  quick_view: {
    signal_badge: string;
    score_bar: number;
    price_change_display: string;
    key_metrics: Record<string, any>;
  };
}

const DATA_BASE_URL = process.env.NEXT_PUBLIC_DATA_URL || "";
const IS_DEV = process.env.NODE_ENV === "development";

export async function getMasterData(): Promise<MasterData | null> {
  if (IS_DEV && !DATA_BASE_URL) return getMockMaster();
  try {
    const res = await fetch(`${DATA_BASE_URL}/master.json`, { 
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000) // 5s timeout
    });
    if (!res.ok) return getMockMaster();
    return res.json();
  } catch {
    return getMockMaster();
  }
}

export async function getStockData(ticker: string): Promise<StockDetail | null> {
  if (IS_DEV && !DATA_BASE_URL) return getMockStockDetail(ticker);
  try {
    const res = await fetch(`${DATA_BASE_URL}/stocks/${ticker}.json`, { 
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return getMockStockDetail(ticker);
    return res.json();
  } catch {
    return getMockStockDetail(ticker);
  }
}

export async function getAllTickers(): Promise<StockQuickView[]> {
  if (IS_DEV && !DATA_BASE_URL) return getMockTickers();
  try {
    const res = await fetch(`${DATA_BASE_URL}/all_tickers_list.json`, { 
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) return getMockTickers();
    const data = await res.json();
    return data.tickers || [];
  } catch {
    return getMockTickers();
  }
}

// ── Mock data for development ────────────────────────────────

const FULL_100_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "AMD", "AVGO", "ORCL",
  "ADBE", "CRM", "QCOM", "MU", "NOW", "SNOW", "PLTR", "MSTR", "ARM", "UBER", "NET", "PANW",
  "JPM", "BAC", "GS", "MS", "V", "MA", "PYPL", "COIN", "BX", "BLK",
  "LLY", "UNH", "JNJ", "ABBV", "MRK", "PFE", "AMGN", "GILD", "ISRG", "DXCM",
  "NKE", "SBUX", "MCD", "COST", "NFLX", "DIS", "ABNB", "BKNG",
  "CAT", "DE", "BA", "RTX", "LMT", "GE", "HON", "UPS",
  "T", "VZ", "TMUS", "SPOT", "SNAP",
  "XOM", "CVX", "COP", "OXY", "SLB", "FANG", "MPC",
  "WMT", "PG", "KO", "PEP", "MDLZ",
  "PLD", "AMT", "EQIX", "SPG", "O",
  "FCX", "NEM", "LIN", "APD", "NUE",
  "NEE", "DUK", "SO", "AEP", "EXC",
  "SHOP", "SQ", "HOOD", "MARA", "RBLX", "RIVN", "SOFI", "SMCI", "CELH", "IONQ"
];

const TICKER_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", NVDA: "NVIDIA Corp.", GOOGL: "Alphabet Inc.",
  META: "Meta Platforms", AMZN: "Amazon.com", TSLA: "Tesla Inc.", AMD: "Advanced Micro Devices",
  NFLX: "Netflix Inc.", JPM: "JPMorgan Chase", LLY: "Eli Lilly", DIS: "Walt Disney Co.",
  CAT: "Caterpillar Inc.", XOM: "Exxon Mobil", WMT: "Walmart Inc.", PLD: "Prologis Inc.",
  FCX: "Freeport-McMoRan", NEE: "NextEra Energy", SHOP: "Shopify Inc.", PLTR: "Palantir Technologies"
};

const TICKER_SECTORS: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", GOOGL: "Technology",
  META: "Technology", AMZN: "Technology", TSLA: "Technology", AMD: "Technology",
  AVGO: "Technology", ORCL: "Technology", ADBE: "Technology", CRM: "Technology",
  QCOM: "Technology", MU: "Technology", NOW: "Technology", SNOW: "Technology",
  PLTR: "Technology", MSTR: "Technology", ARM: "Technology", UBER: "Technology",
  NET: "Technology", PANW: "Technology",
  JPM: "Financials", BAC: "Financials", GS: "Financials", MS: "Financials",
  V: "Financials", MA: "Financials", PYPL: "Financials", COIN: "Financials",
  BX: "Financials", BLK: "Financials",
  LLY: "Healthcare", UNH: "Healthcare", JNJ: "Healthcare", ABBV: "Healthcare",
  MRK: "Healthcare", PFE: "Healthcare", AMGN: "Healthcare", GILD: "Healthcare",
  ISRG: "Healthcare", DXCM: "Healthcare",
  NKE: "Consumer Discretionary", SBUX: "Consumer Discretionary", MCD: "Consumer Discretionary",
  COST: "Consumer Discretionary", NFLX: "Consumer Discretionary", DIS: "Consumer Discretionary",
  ABNB: "Consumer Discretionary", BKNG: "Consumer Discretionary",
  CAT: "Industrials", DE: "Industrials", BA: "Industrials", RTX: "Industrials",
  LMT: "Industrials", GE: "Industrials", HON: "Industrials", UPS: "Industrials",
  T: "Communication Services", VZ: "Communication Services", TMUS: "Communication Services",
  SPOT: "Communication Services", SNAP: "Communication Services",
  XOM: "Energy", CVX: "Energy", COP: "Energy", OXY: "Energy", SLB: "Energy",
  FANG: "Energy", MPC: "Energy",
  WMT: "Consumer Staples", PG: "Consumer Staples", KO: "Consumer Staples",
  PEP: "Consumer Staples", MDLZ: "Consumer Staples",
  PLD: "Real Estate", AMT: "Real Estate", EQIX: "Real Estate", SPG: "Real Estate", O: "Real Estate",
  FCX: "Materials", NEM: "Materials", LIN: "Materials", APD: "Materials", NUE: "Materials",
  NEE: "Utilities", DUK: "Utilities", SO: "Utilities", AEP: "Utilities", EXC: "Utilities",
  SHOP: "High-Growth", SQ: "High-Growth", HOOD: "High-Growth", MARA: "High-Growth",
  RBLX: "High-Growth", RIVN: "High-Growth", SOFI: "High-Growth", SMCI: "High-Growth",
  CELH: "High-Growth", IONQ: "High-Growth"
};

function getMockMaster(): MasterData {
  return {
    date: new Date().toISOString().split("T")[0],
    generated_at: new Date().toISOString(),
    total_tickers_scanned: 100,
    active_signals_count: 58,
    market_regime: "Bull",
    menus: {
      top_signals: { count: 12, tickers: ["NVDA","PLTR","META","SOFI","MARA","COIN","AMD","TSLA","MSTR","SMCI","SHOP","ARM"] },
      breakout:    { count: 18, tickers: ["NVDA","AMD","PLTR","MARA","COIN","SQ","HOOD","SOFI","SMCI","ARM","NET","IONQ","SNOW","TSLA","AMZN","META","UBER","RBLX"] },
      value:       { count: 15, tickers: ["PFE","BAC","T","VZ","KO","PG","JNJ","MRK","GILD","WMT","UPS","CVX","NEE","BLK","JPM"] },
      reversal:    { count: 8, tickers: ["NKE","SNAP","RIVN","DIS","BA","PYPL","SBUX","ADBE"] },
      momentum:    { count: 20, tickers: ["NVDA","META","PLTR","JPM","GS","COST","NFLX","AVGO","LLY","BKNG","SPOT","UBER","CRM","NOW","MSFT","AAPL","AMZN","PANW","GOOGL","BX"] },
      dividend:    { count: 14, tickers: ["T","VZ","KO","PEP","PG","JNJ","MRK","O","DUK","SO","NEE","ABBV","XOM","CVX"] },
    },
    sector_summary: {
      Technology:               { avg_score: 74.2, top_ticker: "NVDA", stock_count: 22 },
      Financials:               { avg_score: 68.1, top_ticker: "GS",   stock_count: 10 },
      Healthcare:               { avg_score: 62.5, top_ticker: "LLY",  stock_count: 10 },
      "Consumer Discretionary":  { avg_score: 58.3, top_ticker: "NFLX", stock_count: 8 },
      Industrials:              { avg_score: 55.9, top_ticker: "CAT",  stock_count: 8 },
      "Communication Services":  { avg_score: 52.1, top_ticker: "SPOT", stock_count: 5 },
      Energy:                   { avg_score: 60.4, top_ticker: "XOM",  stock_count: 7 },
      "Consumer Staples":        { avg_score: 54.8, top_ticker: "WMT",  stock_count: 5 },
      "Real Estate":             { avg_score: 48.2, top_ticker: "EQIX", stock_count: 5 },
      Materials:                { avg_score: 51.3, top_ticker: "LIN",  stock_count: 5 },
      Utilities:                { avg_score: 46.7, top_ticker: "NEE",  stock_count: 5 },
      "High-Growth":             { avg_score: 65.8, top_ticker: "SMCI", stock_count: 10 },
    },
    top_3_overall: [
      { ticker: "NVDA", score: 91.2, signal: "STRONG_BUY" },
      { ticker: "PLTR", score: 88.7, signal: "STRONG_BUY" },
      { ticker: "META", score: 85.4, signal: "BUY" },
    ],
    market_indices: {
      SP500:  { value: 5420.30, change_pct: 0.87 },
      NASDAQ: { value: 17840.20, change_pct: 1.24 },
      DOW:    { value: 40120.50, change_pct: 0.54 },
      VIX:    { value: 18.40, change_pct: -5.32 },
    },
  };
}

function getMockTickers(): StockQuickView[] {
  return FULL_100_TICKERS.map((ticker) => {
    const seed = ticker.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const score = 40 + (seed % 55); // Randomish but stable score 40-95
    const change = -3 + (seed % 7) + (seed % 100) / 100; // -3% to +4% change
    
    return {
      ticker,
      company: TICKER_NAMES[ticker] || `${ticker} Corp.`,
      sector: TICKER_SECTORS[ticker] || "Technology",
      master_score: score,
      signal_type: score >= 85 ? "STRONG_BUY" : score >= 70 ? "BUY" : score >= 55 ? "NEUTRAL" : "SELL",
      price: 50 + (seed % 400),
      change_pct: change,
      entry_range_low: 45 + (seed % 400),
      entry_range_high: 55 + (seed % 400)
    };
  });
}

// Signal badge class helper
export function getSignalBadgeClass(signal: string): string {
  const s = signal.toUpperCase().replace(/ /g, "_");
  if (s === "STRONG_BUY" || s === "STRONG BUY") return "badge-strong-buy";
  if (s === "BUY") return "badge-buy";
  if (s === "NEUTRAL") return "badge-neutral";
  if (s === "SELL") return "badge-sell";
  if (s === "STRONG_SELL" || s === "STRONG SELL") return "badge-strong-sell";
  return "badge-neutral";
}

export function getChangeColor(pct: number): string {
  if (pct > 0) return "text-[#22c55e]";
  if (pct < 0) return "text-[#ef4444]";
  return "text-[#94a3b8]";
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMockStockDetail(ticker: string): StockDetail {
  return {
    ticker: ticker.toUpperCase(),
    company: ticker.toUpperCase() === "AAPL" ? "Apple Inc." : `${ticker.toUpperCase()} Corp.`,
    date: new Date().toISOString().split("T")[0],
    sector: "Technology",
    industry: "Consumer Electronics",
    price: {
      current: 195.50,
      open: 193.20,
      high: 196.80,
      low: 192.50,
      prev_close: 194.10,
      change: 1.40,
      change_pct: 0.72,
      volume: 62450000,
      avg_volume_30d: 58000000
    },
    scores: {
      master_score: 78.4,
      technical_score: 82.1,
      fundamental_score: 71.3,
      momentum_score: 79.5,
      sentiment_score: 68.0,
      sector_score: 74.2,
      breakout_score: 65.2,
      value_score: 58.7,
      reversal_score: 22.1,
      dividend_score: 45.3,
      confidence: 0.87,
      signal_type: "STRONG_BUY"
    },
    technical: {
      rsi_14: 58.3,
      macd: 1.23,
      macd_signal: 0.98,
      macd_histogram: 0.25,
      macd_crossover: "bullish",
      ema_20: 192.40,
      ema_50: 188.70,
      ema_200: 175.30,
      ema_stack_bullish: true,
      bb_upper: 198.20,
      bb_middle: 192.40,
      bb_lower: 186.60,
      bb_width: 0.059,
      bb_squeeze: false,
      bb_squeeze_intensity: "LOW",
      adx: 28.4,
      atr: 3.21,
      atr_pct: 0.0164,
      obv_trend: "UP",
      mfi: 63.2,
      stoch_k: 67.4,
      stoch_d: 62.1,
      cmf: 0.14,
      rvol: 1.34,
      volume_5d_avg: 58000000,
      green_days_10d: 7,
      "52w_high": 199.62,
      "52w_low": 164.08,
      "52w_high_proximity_pct": 0.021
    },
    fundamental: {
      pe_ratio: 28.4,
      sector_pe_median: 32.1,
      pe_vs_sector: "discount",
      pb_ratio: 42.1,
      de_ratio: 1.76,
      fcf_yield: 0.038,
      eps_growth_5y: 0.142,
      revenue_growth_ttm: 0.086,
      gross_margin: 0.434,
      operating_margin: 0.296,
      net_margin: 0.253,
      market_cap: 3020000000000,
      enterprise_value: 3180000000000,
      dividend_yield: 0.0054,
      payout_ratio: 0.157,
      insider_ownership_pct: 0.028,
      institutional_ownership_pct: 0.601
    },
    breakout: {
      squeeze_intensity: "LOW",
      breakout_direction: "UPWARD",
      breakout_score: 85,
      previous_breakouts_2y: 2
    },
    sector_context: {
      sector_etf: "XLK",
      sector_performance_5d: 2.45
    },
    insider_activity: {
      last_90_days_buys: 12,
      last_90_days_sells: 4,
      net_direction: "Buying",
      last_transaction: "April 02, 2026"
    },
    signals: {
      signal_type: "STRONG_BUY",
      entry_range_low: 193.50,
      entry_range_high: 196.00,
      target_price: 208.50,
      stop_loss: 188.20,
      risk_reward_ratio: 2.1,
      categories: ["momentum", "top_signals"]
    },
    news: [
      {
        headline: "Apple Reports Record Q1 Revenue",
        url: "#",
        source: "Reuters",
        published: "2026-04-07T14:30:00Z",
        sentiment: "positive"
      },
      {
        headline: "New iPhone Features AI Integration",
        url: "#",
        source: "Bloomberg",
        published: "2026-04-07T12:00:00Z",
        sentiment: "positive"
      }
    ],
    ai_summary: "Apple maintains a dominant position in consumer electronics and services, with AI-powered features driving iPhone upgrade cycles. The stock's RSI of 58 and positive MACD histogram suggest continued bullish momentum without entering overbought territory. Institutional ownership at 60% and declining short interest confirm smart money accumulation. The 52-week high proximity of 2.1% indicates breakout potential if the $196 resistance level is cleared on volume. Suggested entry: $193–$196 zone, target $208, stop-loss below $188.",
    quick_view: {
      signal_badge: "STRONG BUY",
      score_bar: 87,
      price_change_display: "+0.72%",
      key_metrics: {
        RSI: 58.3,
        MACD: "Bullish",
        Volume: "Above avg",
        Trend: "Uptrend"
      }
    }
  };
}
