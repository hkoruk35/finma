/**
 * BOGA AI Data Loader — reads JSON from transfer/latest/ or public/mock/
 * In production, this reads from the deployed static JSON endpoint.
 * In dev, it reads from local mock data.
 */

export interface StockQuickView {
  ticker: string;
  company: string;
  sector: string;
  master_score: number;
  score_type: string;
  price: number;
  change_pct: number;
  change_pct_1w?: number;
  change_pct_1m?: number;
  change_pct_1y?: number;
  entry_range_low: number;
  entry_range_high: number;
  volume?: number;
  avg_volume_30d?: number;
  ai_short_summary?: string;
  is_mock?: boolean;
}

export interface MasterData {
  date: string;
  generated_at: string;
  total_tickers_scanned: number;
  active_scores_count: number;
  market_regime: string;
  menus: Record<string, { count: number; tickers: string[] }>;
  sector_summary: Record<string, { avg_score: number; top_ticker: string; stock_count: number }>;
  top_3_overall: { ticker: string; score: number; score_type: string }[];
  market_indices: Record<string, {
    value: number;
    change_pct: number;
    change_pct_1w?: number;
    change_pct_1m?: number;
    change_pct_1y?: number;
  }>;
  is_mock?: boolean;
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
    change_pct_1w?: number;
    change_pct_1m?: number;
    change_pct_1y?: number;
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
    score_type: string;
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
    last_transaction: string | { type: string; shares: number; date: string } | null;
  };
  scores_detail: {
    score_type: string;
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
    score_badge: string;
    score_bar: number;
    price_change_display: string;
    key_metrics: Record<string, any>;
  };
  is_mock?: boolean;
  is_partial_mock?: boolean;
}

// Client-side fetch URL (browser only). On server, we read from disk via data-server.
const DATA_BASE_URL = process.env.NEXT_PUBLIC_DATA_URL || "";

// Dynamic import keeps fs/path out of the client bundle. Webpack creates a
// server-only chunk for data-server.ts which is never loaded in the browser.
async function readJsonServer(relPath: string, date?: string): Promise<any | null> {
  if (typeof window !== "undefined") return null;
  const mod = await import("./data-server");
  return mod.readJson(relPath, date);
}

// Compatibility: normalize old data format (signal) to new format (score_type)
function normalizeScoreType(value: string | undefined): string {
  if (!value) return "NEUTRAL_STAY";
  const normalized = String(value).toUpperCase().trim();
  // Map old field names to new ones
  if (normalized === "STRONG_BUY") return "HIGH_CONVICTION";
  if (normalized === "BUY") return "POSITIVE_BIAS";
  if (normalized === "SELL") return "NEGATIVE_BIAS";
  if (normalized === "STRONG_SELL") return "UNDERPERFORM";
  if (normalized === "HOLD" || normalized === "NEUTRAL") return "NEUTRAL_STAY";
  // Already new format
  return normalized;
}

// Normalize MasterData to ensure score_type fields and new menu keys exist
function normalizeMasterData(data: any): MasterData {
  if (!data) return getMockMaster();

  // Normalize menus: rename old keys (top_signals) to new keys (top_scores)
  const menus = { ...(data.menus || {}) };
  if (menus.top_signals && !menus.top_scores) {
    menus.top_scores = menus.top_signals;
    delete menus.top_signals;
  }

  return {
    ...data,
    menus,
    top_3_overall: (data.top_3_overall || []).map((item: any) => ({
      ...item,
      score_type: normalizeScoreType(item.score_type || item.signal),
    })),
  };
}

// Normalize StockQuickView to ensure score_type field exists
function normalizeStockQuickView(stock: any): StockQuickView {
  return {
    ...stock,
    is_mock: stock.is_mock || false,
    score_type: normalizeScoreType(stock.score_type || stock.signal_type || stock.signal),
  };
}

// Normalize StockDetail to ensure score_type fields exist
function normalizeStockDetail(data: any): StockDetail {
  if (!data) return {} as StockDetail;

  // Handle old 'signals' key renamed to 'scores_detail'
  const scoresDetail = data.scores_detail || data.signals || {};

  return {
    ...data,
    scores: {
      ...data.scores,
      score_type: normalizeScoreType(data.scores?.score_type || data.scores?.signal_type || data.scores?.signal),
    },
    scores_detail: {
      ...scoresDetail,
      score_type: normalizeScoreType(scoresDetail.score_type || scoresDetail.signal_type || scoresDetail.signal),
    },
  };
}

export async function getMasterData(date?: string): Promise<MasterData | null> {
  // Server-side: read directly from filesystem.
  if (typeof window === "undefined") {
    const data = await readJsonServer("master.json", date);
    return normalizeMasterData(data ?? (date ? null : getMockMaster()));
  }
  // Client-side: HTTP fetch
  try {
    const base = DATA_BASE_URL || "/api/data";
    const folder = date ? date : "latest";
    const res = await fetch(`${base}/${folder}/master.json`);
    if (!res.ok) return date ? null : getMockMaster();
    const json = await res.json();
    return normalizeMasterData(json);
  } catch {
    return date ? null : getMockMaster();
  }
}

// Exchange map cache (server-side only, loaded once per request lifecycle)
let _exchangeMapCache: { exchanges: Record<string, string>; company_mismatches: Record<string, any> } | null = null;

async function getExchangeMap(): Promise<{ exchanges: Record<string, string>; company_mismatches: Record<string, any> }> {
  if (_exchangeMapCache) return _exchangeMapCache;
  if (typeof window === "undefined") {
    try {
      const mod = await import("./data-server");
      const data = mod.readPublicJson("exchange_map.json");
      if (data) {
        _exchangeMapCache = { exchanges: data.exchanges || {}, company_mismatches: data.company_mismatches || {} };
        return _exchangeMapCache;
      }
    } catch {}
  } else {
    try {
      const res = await fetch("/exchange_map.json", { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        _exchangeMapCache = { exchanges: data.exchanges || {}, company_mismatches: data.company_mismatches || {} };
        return _exchangeMapCache;
      }
    } catch {}
  }
  return { exchanges: {}, company_mismatches: {} };
}

export async function getStockData(ticker: string): Promise<(StockDetail & { is_mock?: boolean }) | null> {
  const t = ticker.toUpperCase();
  let data: any = null;

  // 1. Try to read real JSON file (Deep Analysis)
  if (typeof window === "undefined") {
    data = await readJsonServer(`stocks/${t}.json`);
  } else {
    try {
      const base = DATA_BASE_URL || "/api/data";
      const res = await fetch(`${base}/stocks/${t}.json`);
      if (res.ok) data = await res.json();
    } catch (e) { console.warn("Fetch detailed stock err", e); }
  }

  // 2. Load other sources for synchronization (Summary list, Swing picks, Exchange map)
  const [allTickers, swingPicksData, exchangeMap, perfData] = await Promise.all([
    getAllTickers(),
    getSwingAllPicks(),
    getExchangeMap(),
    getSwingPerformance(),
  ]);

  const summary = allTickers.find(s => s.ticker === t);
  const swingPick = (swingPicksData?.picks || []).find((p: any) => p.ticker === t);

  // 3. Process if we have Deep Analysis data
  if (data) {
    const livePrice = swingPick?.current_price ?? summary?.price;
    if (livePrice && data.price?.current) {
      const ratio = livePrice / data.price.current;
      const drift = Math.abs(1 - ratio);
      // Sync prices across the app if they drift more than 2%
      if (drift > 0.02) {
        data.price.current = livePrice;
        if (data.scores_detail) {
          data.scores_detail.entry_range_low *= ratio;
          data.scores_detail.entry_range_high *= ratio;
          data.scores_detail.target_price *= ratio;
          data.scores_detail.target_range_low *= ratio;
          data.scores_detail.target_range_high *= ratio;
          data.scores_detail.stop_loss *= ratio;
          data.scores_detail.stop_range_low *= ratio;
          data.scores_detail.stop_range_high *= ratio;
        }
      }
    }
    
    // 🔥 UNIFICATION: Use BOGA AI Swing Score as the Master Score if it's a swing pick
    if (swingPick) {
      data.scores.master_score = swingPick.score;
      data.scores.score_type = swingPick.score >= 80 ? "HIGH_CONVICTION" : "POSITIVE_BIAS";
        // Sync zones with Swing Pick zones
      if (data.scores_detail) {
        data.scores_detail.entry_range_low = swingPick.buy_zone.low;
        data.scores_detail.entry_range_high = swingPick.buy_zone.high;
        data.scores_detail.target_range_low = swingPick.profit_zone.low;
        data.scores_detail.target_range_high = swingPick.profit_zone.high;
        data.scores_detail.stop_range_low = swingPick.stop_zone.low;
        data.scores_detail.stop_range_high = swingPick.stop_zone.high;
        data.scores_detail.risk_reward_ratio = swingPick.boga_zones?.risk_reward || 2.5;
      }

      // Update Technical Indicators
      if (data.technical) {
        data.technical.rsi_14 = swingPick.rsi;
        data.technical.adx = swingPick.adx;
        data.technical.rvol = swingPick.rvol;
      }

      // Update Change % from Swing Pick
      if (swingPick.change_1d !== undefined) data.price.change_pct = swingPick.change_1d;
      if (swingPick.change_1w !== undefined) data.price.change_pct_1w = swingPick.change_1w;
      if (swingPick.change_1m !== undefined) data.price.change_pct_1m = swingPick.change_1m;
      if (swingPick.change_1y !== undefined) data.price.change_pct_1y = swingPick.change_1y;
      if (swingPick.change_5y !== undefined) data.price.change_pct_5y = swingPick.change_5y;

      // 🌍 Propagate multilingual AI summary from swing pick (overrides string from bot)
      if (swingPick.ai_summary && typeof swingPick.ai_summary === "object") {
        data.ai_summary = swingPick.ai_summary;
      }

      // Attach rich swing pick data for the detail page
      data._swing = {
        rank: swingPick.rank,
        holding_period: swingPick.holding_period,
        trend_status: swingPick.trend_status,
        moving_averages: swingPick.moving_averages,
        factor_scores: swingPick.factor_scores,
        fundamentals: swingPick.fundamentals,
        hourly_analysis: swingPick.hourly_analysis,
        performance: swingPick.performance,
        boga_zones: swingPick.boga_zones,
        market_regime: swingPick.market_regime,
      };
    }

    // Attach exchange and company mismatch info for TradingView
    data._exchange = exchangeMap.exchanges[t] || null;
    data._company_mismatch = exchangeMap.company_mismatches[t] || null;

    return normalizeStockDetail(data);
  }

  // 4. Fallback: If deep analysis JSON missing, build a partial profile using data from summary/swing
  const realPrice = swingPick?.current_price ?? summary?.price;
  const mock = getMockStockDetail(t, realPrice);
  
  if (swingPick || summary) {
    mock.company = swingPick?.company ?? summary?.company ?? mock.company;
    mock.sector = swingPick?.sector ?? summary?.sector ?? mock.sector;
    mock.price.current = realPrice ?? mock.price.current;
    
    const target = mock as any;

    if (swingPick) {
      target.scores.master_score = swingPick.score;
      target.scores.score_type = swingPick.score >= 80 ? "HIGH_CONVICTION" : "POSITIVE_BIAS";
      
      if (target.scores_detail) {
        target.scores_detail.entry_range_low = swingPick.buy_zone.low;
        target.scores_detail.entry_range_high = swingPick.buy_zone.high;
        target.scores_detail.target_range_low = swingPick.profit_zone.low;
        target.scores_detail.target_range_high = swingPick.profit_zone.high;
        target.scores_detail.stop_range_low = swingPick.stop_zone.low;
        target.scores_detail.stop_range_high = swingPick.stop_zone.high;
        target.scores_detail.risk_reward_ratio = swingPick.boga_zones?.risk_reward || 2.5;
      }
      
      if (target.technical) {
        target.technical.rsi_14 = swingPick.rsi;
        target.technical.adx = swingPick.adx;
        target.technical.rvol = swingPick.rvol;
      }
      
      target.price.change_pct = swingPick.change_1d ?? 0;
      target.price.change_pct_1w = swingPick.change_1w;
      target.price.change_pct_1m = swingPick.change_1m;
      target.price.change_pct_1y = swingPick.change_1y;
      target.price.change_pct_5y = swingPick.change_5y;
      // Use multilingual ai_summary object if available, else fall back to string
      target.ai_summary = (swingPick.ai_summary && typeof swingPick.ai_summary === "object")
        ? swingPick.ai_summary
        : (swingPick.detail_reasoning || swingPick.reasoning);

      // Attach rich swing data for the detail page
      target._swing = {
        rank: swingPick.rank,
        holding_period: swingPick.holding_period,
        trend_status: swingPick.trend_status,
        moving_averages: swingPick.moving_averages,
        factor_scores: swingPick.factor_scores,
        fundamentals: swingPick.fundamentals,
        hourly_analysis: swingPick.hourly_analysis,
        performance: swingPick.performance,
        boga_zones: swingPick.boga_zones,
        market_regime: swingPick.market_regime,
      };

    } else if (summary) {
      target.scores.master_score = summary.master_score;
      target.scores.score_type = summary.score_type;
      target.price.change_pct = summary.change_pct;
    }
    target.is_partial_mock = swingPick ? false : true;
  } else {
    // Last resort: pull company/price info from swing_performance history
    const perfHistory: any[] = perfData?.history || [];
    const perfEntries = perfHistory.filter((e: any) => e.ticker === t);
    if (perfEntries.length > 0) {
      // Use most recent entry for company name; use last known market price (max_price or entry)
      const latest = perfEntries.sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      mock.company = latest.company || mock.company;
      mock.sector = latest.sector || mock.sector;
      // Use the most recent known price as a reference (entry price of the latest pick)
      const latestPrice = latest.entry ?? null;
      if (latestPrice && latestPrice > 0) mock.price.current = latestPrice;
      (mock as any).is_mock = true;
      (mock as any)._from_perf_history = true;
    } else {
      (mock as any).is_mock = true;
    }
  }

  // Attach exchange and company mismatch info for TradingView
  (mock as any)._exchange = exchangeMap.exchanges[t] || null;
  (mock as any)._company_mismatch = exchangeMap.company_mismatches[t] || null;

  return normalizeStockDetail(mock);
}

export async function getAllTickers(date?: string): Promise<StockQuickView[]> {
  if (typeof window === "undefined") {
    const data = await readJsonServer("all_tickers_list.json", date);
    const tickers = data?.tickers ?? (date ? [] : getMockTickers());
    return tickers.map(normalizeStockQuickView);
  }
  try {
    const base = DATA_BASE_URL || "/api/data";
    const folder = date ? date : "latest";
    const res = await fetch(`${base}/${folder}/all_tickers_list.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`Failed to fetch tickers list for ${folder}: ${res.status}`);
      return date ? [] : getMockTickers();
    }
    const data = await res.json();
    const tickers = data.tickers || [];
    return tickers.map(normalizeStockQuickView);
  } catch (e) {
    console.warn(`Tickers fetch error for ${date}: ${e}`);
    return date ? [] : getMockTickers();
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
    is_mock: true,
    date: new Date().toISOString().split("T")[0],
    generated_at: new Date().toISOString(),
    total_tickers_scanned: 100,
    active_scores_count: 58,
    market_regime: "Bull",
    menus: {
      top_scores: { count: 12, tickers: ["NVDA","PLTR","META","SOFI","MARA","COIN","AMD","TSLA","MSTR","SMCI","SHOP","ARM"] },
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
      { ticker: "NVDA", score: 91.2, score_type: "HIGH_CONVICTION" },
      { ticker: "PLTR", score: 88.7, score_type: "HIGH_CONVICTION" },
      { ticker: "META", score: 85.4, score_type: "POSITIVE_BIAS" },
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
      score_type: score >= 85 ? "HIGH_CONVICTION" : score >= 70 ? "POSITIVE_BIAS" : score >= 55 ? "NEUTRAL_STAY" : "NEGATIVE_BIAS",
      price: 50 + (seed % 400),
      change_pct: change,
      entry_range_low: 45 + (seed % 400),
      entry_range_high: 55 + (seed % 400),
      is_mock: true
    };
  });
}

// Score badge class helper
export function getScoreBadgeClass(score: string): string {
  const s = score.toUpperCase().replace(/ /g, "_");
  if (s === "HIGH_CONVICTION") return "badge-high-conviction";
  if (s === "POSITIVE_BIAS") return "badge-positive-bias";
  if (s === "NEUTRAL_STAY") return "badge-neutral-stay";
  if (s === "NEGATIVE_BIAS") return "badge-negative-bias";
  if (s === "UNDERPERFORM") return "badge-underperform";
  return "badge-neutral-stay";
}

export function getChangeColor(pct: number): string {
  if (pct > 0) return "text-[#22c55e]";
  if (pct < 0) return "text-[#ef4444]";
  return "text-[#94a3b8]";
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMockStockDetail(ticker: string, overridePrice?: number): StockDetail {
  const t = ticker.toUpperCase();
  const seed = t.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Procedural random values based on seed
  const basePrice = overridePrice ?? (10 + (seed % 450));
  const changePct = -2 + (seed % 5) + (seed % 10) / 10;
  const masterScore = 45 + (seed % 50);
  
  return {
    ticker: t,
    company: TICKER_NAMES[t] || `${t} Corp.`,
    date: new Date().toISOString().split("T")[0],
    sector: TICKER_SECTORS[t] || "Technology",
    industry: "General Industrials",
    price: {
      current: basePrice,
      open: basePrice * 0.99,
      high: basePrice * 1.02,
      low: basePrice * 0.98,
      prev_close: basePrice / (1 + changePct/100),
      change: basePrice * (changePct / 100),
      change_pct: changePct,
      volume: 1000000 + (seed * 1000),
      avg_volume_30d: 950000 + (seed * 1000)
    },
    scores: {
      master_score: masterScore,
      technical_score: masterScore + (seed % 10) - 5,
      fundamental_score: masterScore + (seed % 8) - 4,
      momentum_score: masterScore + (seed % 12) - 6,
      sentiment_score: 50 + (seed % 30),
      sector_score: 55 + (seed % 25),
      breakout_score: 40 + (seed % 50),
      value_score: 30 + (seed % 60),
      reversal_score: 10 + (seed % 80),
      dividend_score: seed % 5,
      confidence: 0.6 + (seed % 40) / 100,
      score_type: masterScore >= 85 ? "HIGH_CONVICTION" : masterScore >= 70 ? "POSITIVE_BIAS" : masterScore >= 55 ? "NEUTRAL_STAY" : "NEGATIVE_BIAS"
    },
    technical: {
      rsi_14: 30 + (seed % 40),
      macd: 0.5,
      macd_signal: 0.4,
      macd_histogram: 0.1,
      macd_crossover: "neutral",
      ema_20: basePrice * 0.98,
      ema_50: basePrice * 0.95,
      ema_200: basePrice * 0.90,
      ema_stack_bullish: true,
      bb_upper: basePrice * 1.05,
      bb_middle: basePrice,
      bb_lower: basePrice * 0.95,
      bb_width: 0.1,
      bb_squeeze: false,
      bb_squeeze_intensity: "LOW",
      adx: 20 + (seed % 15),
      atr: basePrice * 0.02,
      atr_pct: 0.02,
      obv_trend: "STABLE",
      mfi: 50,
      stoch_k: 50,
      stoch_d: 50,
      cmf: 0,
      rvol: 1.0,
      volume_5d_avg: 1000000,
      green_days_10d: 5,
      "52w_high": basePrice * 1.1,
      "52w_low": basePrice * 0.8,
      "52w_high_proximity_pct": 0.1
    },
    fundamental: {
      pe_ratio: 15 + (seed % 30),
      sector_pe_median: 20,
      pe_vs_sector: "neutral",
      pb_ratio: 2.5,
      de_ratio: 1.0,
      fcf_yield: 0.04,
      eps_growth_5y: 0.1,
      revenue_growth_ttm: 0.08,
      gross_margin: 0.35,
      operating_margin: 0.15,
      net_margin: 0.12,
      market_cap: 1000000000 * (seed % 100),
      enterprise_value: 1100000000 * (seed % 100),
      dividend_yield: 0.01,
      payout_ratio: 0.3,
      insider_ownership_pct: 0.05,
      institutional_ownership_pct: 0.55
    },
    breakout: {
      squeeze_intensity: "LOW",
      breakout_direction: "NONE",
      breakout_score: 50,
      previous_breakouts_2y: 1
    },
    sector_context: {
      sector_etf: "SPY",
      sector_performance_5d: 0.5
    },
    insider_activity: {
      last_90_days_buys: seed % 5,
      last_90_days_sells: seed % 3,
      net_direction: "Neutral",
      last_transaction: null
    },
    scores_detail: {
      score_type: masterScore >= 85 ? "HIGH_CONVICTION" : masterScore >= 70 ? "POSITIVE_BIAS" : masterScore >= 55 ? "NEUTRAL_STAY" : "NEGATIVE_BIAS",
      entry_range_low: basePrice * 0.97,
      entry_range_high: basePrice * 1.01,
      target_price: basePrice * 1.15,
      target_range_low: basePrice * 1.12,
      target_range_high: basePrice * 1.18,
      stop_loss: basePrice * 0.93,
      stop_range_low: basePrice * 0.90,
      stop_range_high: basePrice * 0.95,
      risk_reward_ratio: 2.5,
      categories: ["momentum"]
    },
    news: [],
    ai_summary: `AI analysis for ${t} suggests a ${masterScore >= 70 ? 'bullish' : 'neutral'} outlook based on current price action and volume patterns. Institutional accumulation is appearing stable, with technical indicators aligned for potential trend continuation. High conviction remains conditional on clearing major psychological resistance levels.`,
    quick_view: {
      score_badge: masterScore >= 70 ? "HIGH CONVICTION" : "NEUTRAL",
      score_bar: masterScore,
      price_change_display: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
      key_metrics: {
        RSI: 50,
        MACD: "Neutral",
        Volume: "Average",
        Trend: "Stable"
      }
    }
  };
}

export async function getSwingPicks(): Promise<any | null> {
  if (typeof window === "undefined") {
    const mod = await import("./data-server");
    return mod.readPublicJson("swing_picks.json");
  }
  try {
    const res = await fetch("/swing_picks.json");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function getSwingPerformance(): Promise<any | null> {
  if (typeof window === "undefined") {
    const mod = await import("./data-server");
    return mod.readPublicJson("swing_performance.json");
  }
  try {
    const res = await fetch("/swing_performance.json");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function getSwingAllPicks(): Promise<any | null> {
  if (typeof window === "undefined") {
    const mod = await import("./data-server");
    return mod.readPublicJson("swing_all_picks.json");
  }
  try {
    const res = await fetch("/swing_all_picks.json");
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Redeploy trigger: Wed Apr 15 06:15:36 DYS 2026
