import { getSwingPicksBackfilled } from "./data";
import { supabaseAdmin } from "./supabase-admin";

export interface DailyOnePick {
  periodKey: string;
  ticker: string;
  company: string;
  sector: string;
  score: number;
  currentPrice: number;
  targetPrice: number;
  targetPct: number;
  entryLow: number;
  entryHigh: number;
  riskReward: number;
  selectionReasons: string[];
  formationScore: number;
  generatedAt: string;
}

const TABLE = "daily_one_picks";
// 12:12 PM New York time — the pick becomes effective for the day at/after
// this boundary; before it, the previous day's pick is still shown.
const ROLLOVER_HOUR = 12;
const ROLLOVER_MINUTE = 12;

function getNyParts(): { date: string; hour: number; minute: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  fmt.formatToParts(now).forEach((p) => { if (p.type !== "literal") parts[p.type] = p.value; });
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

function previousNyDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** The calendar date whose 12:12 PM ET rollover currently governs the active pick. */
export function getEffectivePeriodKey(): string {
  const { date, hour, minute } = getNyParts();
  const isPastRollover = hour > ROLLOVER_HOUR || (hour === ROLLOVER_HOUR && minute >= ROLLOVER_MINUTE);
  return isPastRollover ? date : previousNyDate(date);
}

function parseRvol(pick: any): number {
  const direct = typeof pick?.rvol === "number" ? pick.rvol : 0;
  const hourlyRaw: string = pick?.hourly_analysis?.rvol_1h ?? "";
  const hourlyMatch = /([\d.]+)x/i.exec(hourlyRaw);
  const hourly = hourlyMatch ? parseFloat(hourlyMatch[1]) : 0;
  return Math.max(direct, hourly);
}

/**
 * Ranks Swing trend candidates by candle+volume formation quality: relative
 * volume confirmation, the engine's own composite/momentum factor scores,
 * and risk/reward — while excluding exhausted trends and stocks without a
 * valid entry setup. This is a ranking heuristic over swing117_boga.py's
 * existing output, not a new scanner.
 */
function formationScore(pick: any): number {
  const rvol = parseRvol(pick);
  const rvolNorm = Math.min(rvol / 3, 1); // 3x+ average volume = max score
  const bogaScore = (pick?.boga_score ?? pick?.score ?? 0) / 100;
  const composite = Math.min((pick?.factor_scores?.composite ?? 0) / 15, 1);
  const momentum = Math.min((pick?.factor_scores?.momentum_score ?? 0) / 10, 1);
  const riskReward = Math.min((pick?.boga_zones?.risk_reward ?? 0) / 3, 1);

  return rvolNorm * 35 + bogaScore * 30 + composite * 15 + momentum * 10 + riskReward * 10;
}

function isEligible(pick: any): boolean {
  if (!pick?.ticker) return false;
  if (pick?.trend_status?.is_exhausted) return false;
  if (pick?.entry_status === "STOPPED" || pick?.entry_status === "EXPIRED") return false;
  const tp1 = pick?.tracker_logic?.profit_target_tp1 ?? pick?.profit_zone?.low;
  return typeof pick?.current_price === "number" && typeof tp1 === "number" && tp1 > pick.current_price;
}

async function selectFreshPick(periodKey: string): Promise<DailyOnePick | null> {
  const data = await getSwingPicksBackfilled(30);
  const picks: any[] = Array.isArray(data?.picks) ? data.picks : [];
  const eligible = picks.filter(isEligible);
  if (eligible.length === 0) return null;

  eligible.sort((a, b) => formationScore(b) - formationScore(a));
  const best = eligible[0];

  const currentPrice = best.current_price;
  const targetPrice = best.tracker_logic?.profit_target_tp1 ?? best.profit_zone?.low;
  const targetPct = ((targetPrice - currentPrice) / currentPrice) * 100;

  return {
    periodKey,
    ticker: best.ticker,
    company: best.company || best.ticker,
    sector: best.sector || "",
    score: best.boga_score ?? best.score ?? 0,
    currentPrice,
    targetPrice,
    targetPct,
    entryLow: best.tracker_logic?.entry_zone_low ?? best.buy_zone?.low ?? currentPrice,
    entryHigh: best.tracker_logic?.entry_zone_high ?? best.buy_zone?.high ?? currentPrice,
    riskReward: best.boga_zones?.risk_reward ?? 0,
    selectionReasons: best.selection_reasons ?? [],
    formationScore: formationScore(best),
    generatedAt: new Date().toISOString(),
  };
}

function rowToPick(row: any): DailyOnePick {
  const payload = row.payload ?? {};
  return {
    periodKey: row.period_key,
    ticker: row.ticker,
    company: row.company || row.ticker,
    sector: row.sector || "",
    score: Number(row.score) || 0,
    currentPrice: Number(row.current_price) || 0,
    targetPrice: Number(row.target_price) || 0,
    targetPct: Number(row.target_pct) || 0,
    entryLow: Number(row.entry_low) || 0,
    entryHigh: Number(row.entry_high) || 0,
    riskReward: Number(row.risk_reward) || 0,
    selectionReasons: Array.isArray(row.selection_reasons) ? row.selection_reasons : [],
    formationScore: Number(row.formation_score) || 0,
    generatedAt: payload.generatedAt || row.created_at,
  };
}

/**
 * Returns the active Daily One pick, persisting a freshly-selected stock the
 * first time it's requested after each day's 12:12 PM ET rollover so the
 * same ticker is shown to every visitor for the rest of that window.
 */
export async function getDailyOnePick(): Promise<DailyOnePick | null> {
  const periodKey = getEffectivePeriodKey();

  try {
    const { data: existing } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("period_key", periodKey)
      .maybeSingle();
    if (existing) return rowToPick(existing);
  } catch {
    // fall through to fresh selection if Supabase is unreachable
  }

  const fresh = await selectFreshPick(periodKey);
  if (!fresh) return null;

  try {
    await supabaseAdmin.from(TABLE).upsert({
      period_key: fresh.periodKey,
      ticker: fresh.ticker,
      company: fresh.company,
      sector: fresh.sector,
      score: fresh.score,
      current_price: fresh.currentPrice,
      target_price: fresh.targetPrice,
      target_pct: fresh.targetPct,
      entry_low: fresh.entryLow,
      entry_high: fresh.entryHigh,
      risk_reward: fresh.riskReward,
      selection_reasons: fresh.selectionReasons,
      formation_score: fresh.formationScore,
      payload: { generatedAt: fresh.generatedAt },
    });
  } catch {
    // best-effort persistence — still return the freshly computed pick
  }

  return fresh;
}
