import fs from "fs";
import path from "path";

export interface PerformanceTrade {
  date: string;
  ticker: string;
  company: string;
  sector: string;
  subsector: string;
  entry: number;
  max_price: number;
  sl_pct: number;
  return_pct: number;
  days: number;
  result: "PENDING" | "WIN" | "LOSS";
  peak_date: string;
}

export interface ArchivePick {
  ticker: string;
  selected_system: string;
  system_category: string;
  selection_reasons: string[];
  score: number;
  boga_score: number;
  trend_status: {
    trend: string;
    rsi_14: number;
    adx: number;
    macd_hist: number;
    mfi: number;
    cmf: number;
    rvol_today: number;
    entry_trigger: string;
    is_exhausted: boolean;
  };
  moving_averages: {
    ema_20: number;
    ema_50: number;
    ema_200: number;
    price_vs_ema20: number;
    price_vs_ema50: number;
    price_vs_ema200: number;
    ema20_slope: string;
  };
  boga_zones: {
    buying_zone: { low: number; high: number };
    sell_zone: { low: number; high: number };
    stop_loss_zone: { low: number; high: number };
    risk_reward: number;
    support_1h: number;
    resistance_1h: number;
    atr_1d: number;
    atr_pct: number;
    risk_usd: number;
    reward_usd: number;
  };
  hourly_analysis: {
    rsi_1h: number;
    adx_1h: number;
    rvol_1h: string;
    ema_structure: string;
    pivot_structure: string;
  };
  factor_scores: {
    trend_score: number;
    momentum_score: number;
    volatility_score: number;
    volume_score: number;
    financial_score: number;
    catalyst_score: number;
    insider_score: number;
    composite: number;
    raw_score: number;
  };
  current_price: number;
}

export interface DerivedFields {
  ema_stack_status: "FULL" | "MIXED" | "BELOW";
  rvol_category: "HIGH" | "NORMAL" | "LOW";
  trend_strength: "STRONG" | "MODERATE" | "WEAK";
  rsi_zone: "OVERBOUGHT" | "NEUTRAL" | "OVERSOLD";
  had_bb_squeeze: boolean;
  signal_confidence: number;
  days_to_resolution: number | null;
}

export type EnrichmentStatus = "OK" | "MISSING_ARCHIVE" | "MISSING_TICKER" | "ERROR";

export interface EnrichedTrade extends PerformanceTrade {
  snapshot: ArchivePick | null;
  enrichmentStatus: EnrichmentStatus;
  derived: DerivedFields | null;
}

export interface AggregateStats {
  total: number;
  win: number;
  loss: number;
  pending: number;
  win_rate: number;
  avg_return_win: number;
  avg_return_all: number;
  momentum_total: number;
  momentum_win: number;
  momentum_win_rate: number;
  breakout_total: number;
  breakout_win: number;
  breakout_win_rate: number;
  full_ema_stack_total: number;
  full_ema_stack_win: number;
  full_ema_stack_win_rate: number;
  high_rvol_total: number;
  high_rvol_win: number;
  high_rvol_win_rate: number;
  enrichment_coverage: number;
  date_range: { from: string; to: string };
}

export interface SignalMatrix {
  signal: string;
  count: number;
  win: number;
  loss: number;
  pending: number;
  win_rate: number;
  avg_return: number;
}

export interface DailyStats {
  date: string;
  total: number;
  win: number;
  loss: number;
  pending: number;
  win_rate: number;
  dominant_system: string;
}

export interface CompressedTrade {
  id: string;
  date: string;
  result: string;
  return_pct: number;
  system: string | null;
  system_category: string | null;
  sector: string;
  subsector: string;
  rsi: number | null;
  adx: number | null;
  rvol: number | null;
  ema_stack: string | null;
  composite_score: number | null;
  atr_pct: number | null;
  risk_reward: number | null;
  selection_reasons: string[] | null;
  days_held: number | null;
  sl_hit: boolean;
  sl_pct: number;
  macd_hist: number | null;
  mfi: number | null;
  trend: string | null;
}

// ── Son N rapor günü (performance.json'daki unique date'ler) ──────────────────
export function getLastNReportDays(
  history: PerformanceTrade[],
  n = 10
): string[] {
  const uniqueDates = [...new Set(history.map((t) => t.date))];
  return uniqueDates.sort().slice(-n);
}

// ── Archive JSON okuma (swing2026/swing_YYYYMMDD.json) ──────────────────────
function sanitizeNaN(raw: string): string {
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace !== -1) raw = raw.substring(0, lastBrace + 1);
  return raw
    .replace(/:\s*NaN/g, ": null")
    .replace(/:\s*Infinity/g, ": null")
    .replace(/:\s*-Infinity/g, ": null");
}

function getArchiveCandidates(dateStr: string): string[] {
  const yyyymmdd = dateStr.replace(/-/g, "");
  const filename = `swing_${yyyymmdd}.json`;
  const subfolder = path.join("swing2026", filename);

  const bases: string[] = [];
  const dirBase = path.resolve(__dirname, "..", "..", "..", "..");
  bases.push(path.join(dirBase, "public", "data", subfolder));
  bases.push(path.resolve(process.cwd(), "public", "data", subfolder));

  // also check date-folder pattern (2026-04-25/swing_20260425.json)
  const dateFolder = path.join(dateStr, filename);
  bases.push(path.join(dirBase, "public", "data", dateFolder));
  bases.push(path.resolve(process.cwd(), "public", "data", dateFolder));

  return bases;
}

export function readArchiveForDate(dateStr: string): ArchivePick[] | null {
  for (const fullPath of getArchiveCandidates(dateStr)) {
    try {
      if (fs.existsSync(fullPath)) {
        const raw = sanitizeNaN(fs.readFileSync(fullPath, "utf-8"));
        const parsed = JSON.parse(raw);
        return parsed.picks ?? null;
      }
    } catch {
      // try next
    }
  }
  return null;
}

// ── Türetilmiş alanlar ────────────────────────────────────────────────────────
export function computeDerivedFields(
  trade: PerformanceTrade,
  pick: ArchivePick
): DerivedFields {
  const price = pick.current_price;
  const ma = pick.moving_averages;

  // EMA Stack
  let ema_stack_status: DerivedFields["ema_stack_status"] = "BELOW";
  if (price > ma.ema_20 && price > ma.ema_50 && price > ma.ema_200) {
    ema_stack_status = "FULL";
  } else if (price > ma.ema_50 || price > ma.ema_200) {
    ema_stack_status = "MIXED";
  }

  // RVOL
  const rvol = pick.trend_status?.rvol_today ?? 0;
  const rvol_category: DerivedFields["rvol_category"] =
    rvol >= 1.5 ? "HIGH" : rvol >= 0.8 ? "NORMAL" : "LOW";

  // ADX trend strength
  const adx = pick.trend_status?.adx ?? 0;
  const trend_strength: DerivedFields["trend_strength"] =
    adx >= 25 ? "STRONG" : adx >= 20 ? "MODERATE" : "WEAK";

  // RSI zone
  const rsi = pick.trend_status?.rsi_14 ?? 50;
  const rsi_zone: DerivedFields["rsi_zone"] =
    rsi >= 60 ? "OVERBOUGHT" : rsi <= 40 ? "OVERSOLD" : "NEUTRAL";

  // BB Squeeze
  const had_bb_squeeze = (pick.selection_reasons ?? []).some((r) =>
    r.toLowerCase().includes("bb_squeeze")
  );

  // Signal confidence (normalize composite 0-100)
  const composite = pick.factor_scores?.composite ?? 0;
  const raw = pick.factor_scores?.raw_score ?? 0;
  const signal_confidence = Math.min(100, Math.max(0, Math.round((raw / 150) * 100)));

  // Days to resolution
  let days_to_resolution: number | null = null;
  if (trade.result !== "PENDING" && trade.days > 0) {
    days_to_resolution = trade.days;
  }

  return {
    ema_stack_status,
    rvol_category,
    trend_strength,
    rsi_zone,
    had_bb_squeeze,
    signal_confidence,
    days_to_resolution,
  };
}

// ── Trade enrichment ─────────────────────────────────────────────────────────
export function enrichTrade(
  trade: PerformanceTrade,
  archivePicks: ArchivePick[] | null
): EnrichedTrade {
  if (!archivePicks) {
    return { ...trade, snapshot: null, enrichmentStatus: "MISSING_ARCHIVE", derived: null };
  }

  const pick = archivePicks.find(
    (p) => p.ticker.toUpperCase() === trade.ticker.toUpperCase()
  );

  if (!pick) {
    return { ...trade, snapshot: null, enrichmentStatus: "MISSING_TICKER", derived: null };
  }

  return {
    ...trade,
    snapshot: pick,
    enrichmentStatus: "OK",
    derived: computeDerivedFields(trade, pick),
  };
}

// ── Compress for Claude prompt ────────────────────────────────────────────────
export function compressTradeForPrompt(trade: EnrichedTrade): CompressedTrade {
  const s = trade.snapshot;
  return {
    id: trade.ticker,
    date: trade.date,
    result: trade.result,
    return_pct: trade.return_pct,
    system: s?.selected_system ?? null,
    system_category: s?.system_category ?? null,
    sector: trade.sector,
    subsector: trade.subsector,
    rsi: s?.trend_status?.rsi_14 ?? null,
    adx: s?.trend_status?.adx ?? null,
    rvol: s?.trend_status?.rvol_today ?? null,
    ema_stack: trade.derived?.ema_stack_status ?? null,
    composite_score: s?.factor_scores?.composite ?? null,
    atr_pct: s?.boga_zones?.atr_pct ?? null,
    risk_reward: s?.boga_zones?.risk_reward ?? null,
    selection_reasons: s?.selection_reasons ?? null,
    days_held: trade.derived?.days_to_resolution ?? null,
    sl_hit: trade.result === "LOSS",
    sl_pct: trade.sl_pct,
    macd_hist: s?.trend_status?.macd_hist ?? null,
    mfi: s?.trend_status?.mfi ?? null,
    trend: s?.trend_status?.trend ?? null,
  };
}

// ── Aggregate stats ───────────────────────────────────────────────────────────
export function computeAggregateStats(
  trades: EnrichedTrade[],
  reportDays: string[]
): AggregateStats {
  const enriched = trades.filter((t) => t.enrichmentStatus === "OK");
  const wins = trades.filter((t) => t.result === "WIN");
  const losses = trades.filter((t) => t.result === "LOSS");
  const pending = trades.filter((t) => t.result === "PENDING");

  const win_rate = trades.length > 0
    ? +((wins.length / trades.filter((t) => t.result !== "PENDING").length || 0) * 100).toFixed(1)
    : 0;

  const avg_return_win = wins.length > 0
    ? +(wins.reduce((s, t) => s + t.return_pct, 0) / wins.length).toFixed(2)
    : 0;
  const avg_return_all = trades.length > 0
    ? +(trades.reduce((s, t) => s + t.return_pct, 0) / trades.length).toFixed(2)
    : 0;

  // Sistem bazlı
  const systemWinRate = (systemFilter: (t: EnrichedTrade) => boolean) => {
    const group = enriched.filter(systemFilter);
    const groupWins = group.filter((t) => t.result === "WIN");
    const completed = group.filter((t) => t.result !== "PENDING");
    return {
      total: group.length,
      win: groupWins.length,
      win_rate: completed.length > 0 ? +((groupWins.length / completed.length) * 100).toFixed(1) : 0,
    };
  };

  const momentum = systemWinRate(
    (t) => (t.snapshot?.system_category ?? "").toLowerCase().includes("momentum")
  );
  const breakout = systemWinRate(
    (t) => (t.snapshot?.system_category ?? "").toLowerCase().includes("breakout")
  );
  const fullEma = systemWinRate((t) => t.derived?.ema_stack_status === "FULL");
  const highRvol = systemWinRate((t) => t.derived?.rvol_category === "HIGH");

  const enriched_pct =
    trades.length > 0 ? +((enriched.length / trades.length) * 100).toFixed(1) : 0;

  const dates = reportDays.sort();

  return {
    total: trades.length,
    win: wins.length,
    loss: losses.length,
    pending: pending.length,
    win_rate,
    avg_return_win,
    avg_return_all,
    momentum_total: momentum.total,
    momentum_win: momentum.win,
    momentum_win_rate: momentum.win_rate,
    breakout_total: breakout.total,
    breakout_win: breakout.win,
    breakout_win_rate: breakout.win_rate,
    full_ema_stack_total: fullEma.total,
    full_ema_stack_win: fullEma.win,
    full_ema_stack_win_rate: fullEma.win_rate,
    high_rvol_total: highRvol.total,
    high_rvol_win: highRvol.win,
    high_rvol_win_rate: highRvol.win_rate,
    enrichment_coverage: enriched_pct,
    date_range: { from: dates[0] ?? "", to: dates[dates.length - 1] ?? "" },
  };
}

// ── Signal matrix ─────────────────────────────────────────────────────────────
export function computeSignalMatrix(trades: EnrichedTrade[]): SignalMatrix[] {
  const map = new Map<string, { win: number; loss: number; pending: number; returns: number[] }>();

  for (const trade of trades) {
    if (!trade.snapshot) continue;
    for (const signal of trade.snapshot.selection_reasons ?? []) {
      if (!map.has(signal)) map.set(signal, { win: 0, loss: 0, pending: 0, returns: [] });
      const entry = map.get(signal)!;
      if (trade.result === "WIN") { entry.win++; entry.returns.push(trade.return_pct); }
      else if (trade.result === "LOSS") { entry.loss++; entry.returns.push(trade.return_pct); }
      else entry.pending++;
    }
  }

  const result: SignalMatrix[] = [];
  for (const [signal, data] of map.entries()) {
    const completed = data.win + data.loss;
    result.push({
      signal,
      count: data.win + data.loss + data.pending,
      win: data.win,
      loss: data.loss,
      pending: data.pending,
      win_rate: completed > 0 ? +((data.win / completed) * 100).toFixed(1) : 0,
      avg_return: data.returns.length > 0
        ? +(data.returns.reduce((a, b) => a + b, 0) / data.returns.length).toFixed(2)
        : 0,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

// ── Daily trend ───────────────────────────────────────────────────────────────
export function computeDailyTrend(
  trades: EnrichedTrade[],
  reportDays: string[]
): DailyStats[] {
  return reportDays.map((date) => {
    const dayTrades = trades.filter((t) => t.date === date);
    const wins = dayTrades.filter((t) => t.result === "WIN");
    const losses = dayTrades.filter((t) => t.result === "LOSS");
    const pending = dayTrades.filter((t) => t.result === "PENDING");
    const completed = wins.length + losses.length;
    const win_rate = completed > 0 ? +((wins.length / completed) * 100).toFixed(1) : 0;

    // Dominant system
    const sysCounts: Record<string, number> = {};
    for (const t of dayTrades) {
      const sys = t.snapshot?.system_category ?? "Unknown";
      sysCounts[sys] = (sysCounts[sys] ?? 0) + 1;
    }
    const dominant_system = Object.entries(sysCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

    return {
      date,
      total: dayTrades.length,
      win: wins.length,
      loss: losses.length,
      pending: pending.length,
      win_rate,
      dominant_system,
    };
  });
}
