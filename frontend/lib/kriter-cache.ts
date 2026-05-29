import type { EnrichedTrade, AggregateStats, SignalMatrix, DailyStats } from "./kriter-helpers";

export interface BotInsight {
  category: "FILTER_ADD" | "THRESHOLD_CHANGE" | "SECTOR_RULE" | "TIMING_RULE";
  priority: "HIGH" | "MEDIUM" | "LOW";
  current_behavior: string;
  suggested_change: string;
  expected_impact: string;
  confidence: "DATA_BACKED" | "HYPOTHESIS";
}

export interface KriterAnalysisResult {
  trades: EnrichedTrade[];
  stats: AggregateStats;
  signal_matrix: SignalMatrix[];
  daily_trend: DailyStats[];
  bot_insights: BotInsight[];
  ai_report: string;
  generated_at: string;
  cache_hit: boolean;
  enrichment_coverage: number;
  report_days: string[];
}

interface CacheEntry {
  data: KriterAnalysisResult;
  generated_at: number;
  trade_count: number;
  last_trade_date: string;
}

const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 saat

// Server-side in-memory cache (Next.js process yaşadığı sürece geçerli)
const cache = new Map<string, CacheEntry>();

function makeCacheKey(days: number, includePending: boolean): string {
  return `kriter_${days}_${includePending}`;
}

export function getCachedAnalysis(
  days: number,
  includePending: boolean,
  currentTradeCount: number,
  lastTradeDate: string
): KriterAnalysisResult | null {
  const key = makeCacheKey(days, includePending);
  const entry = cache.get(key);
  if (!entry) return null;

  const expired = Date.now() - entry.generated_at > CACHE_TTL;
  const staleCount = entry.trade_count !== currentTradeCount;
  const staleDate = entry.last_trade_date !== lastTradeDate;

  if (expired || staleCount || staleDate) {
    cache.delete(key);
    return null;
  }

  return { ...entry.data, cache_hit: true };
}

export function setCachedAnalysis(
  days: number,
  includePending: boolean,
  data: KriterAnalysisResult,
  tradeCount: number,
  lastTradeDate: string
): void {
  const key = makeCacheKey(days, includePending);
  cache.set(key, {
    data,
    generated_at: Date.now(),
    trade_count: tradeCount,
    last_trade_date: lastTradeDate,
  });
}

export function clearCache(): void {
  cache.clear();
}
