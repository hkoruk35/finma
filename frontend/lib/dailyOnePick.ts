import { getSwingPicksBackfilled } from "./data";
import { supabaseAdmin } from "./supabase-admin";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

export interface DailyOnePick {
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
}

const TABLE = "daily_one_picks";
const PICKS_COUNT = 2;
// How many top static candidates get a live 15m/1h confirmation check
// before picking the final 2 — kept small to limit live-quote fetches.
const LIVE_CHECK_POOL = 8;
// 12:12 PM New York time — the picks become effective for the day at/after
// this boundary; before it, the previous day's picks are still shown.
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

/** The calendar date whose 12:12 PM ET rollover currently governs the active picks. */
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
  if (!(typeof pick?.current_price === "number" && typeof tp1 === "number" && tp1 > pick.current_price)) {
    return false;
  }
  // RSI and relative volume must both be trending up on the 1h timeframe —
  // this is the "RSI ve rvol yukarı yönlü olmalı" screening criterion.
  const rsi1h = pick?.hourly_analysis?.rsi_1h;
  if (typeof rsi1h === "number" && rsi1h < 50) return false;
  if (parseRvol(pick) < 1.0) return false;
  return true;
}

function toDailyOnePick(pick: any, formation: number): DailyOnePick {
  const currentPrice = pick.current_price;
  const targetPrice = pick.tracker_logic?.profit_target_tp1 ?? pick.profit_zone?.low;
  return {
    ticker: pick.ticker,
    company: pick.company || pick.ticker,
    sector: pick.sector || "",
    score: pick.boga_score ?? pick.score ?? 0,
    currentPrice,
    targetPrice,
    targetPct: ((targetPrice - currentPrice) / currentPrice) * 100,
    entryLow: pick.tracker_logic?.entry_zone_low ?? pick.buy_zone?.low ?? currentPrice,
    entryHigh: pick.tracker_logic?.entry_zone_high ?? pick.buy_zone?.high ?? currentPrice,
    riskReward: pick.boga_zones?.risk_reward ?? 0,
    selectionReasons: pick.selection_reasons ?? [],
    formationScore: formation,
  };
}

/** Live 15m candle+volume confirmation via the same engine watchlist-data
 * uses (check15mMicroTrend) — returns a score delta, or null if the live
 * fetch failed (caller should fall back to the static ranking only). */
async function get15mConfirmation(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/watchlist-data?tickers=${ticker}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    const micro = row?.scores?.micro_15m;
    if (!micro) return null;
    if (micro.is_valid === false) return -100; // hard reject: 15m distribution
    return typeof micro.score_bonus === "number" ? micro.score_bonus : 0;
  } catch {
    return null;
  }
}

async function selectFreshPicks(): Promise<DailyOnePick[]> {
  const data = await getSwingPicksBackfilled(30);
  const picks: any[] = Array.isArray(data?.picks) ? data.picks : [];
  const eligible = picks.filter(isEligible);
  if (eligible.length === 0) return [];

  const ranked = eligible
    .map((p) => ({ pick: p, formation: formationScore(p) }))
    .sort((a, b) => b.formation - a.formation);

  const pool = ranked.slice(0, LIVE_CHECK_POOL);
  const confirmations = await Promise.all(pool.map((r) => get15mConfirmation(r.pick.ticker)));

  const withLiveScore = pool
    .map((r, i) => {
      const bonus = confirmations[i];
      return { ...r, live: bonus, combined: r.formation + (bonus ?? 0) };
    })
    .filter((r) => r.live !== -100) // hard-reject 15m distribution candidates
    .sort((a, b) => b.combined - a.combined);

  // If live confirmation wiped out the whole pool (Yahoo down, etc.), fall
  // back to the static ranking rather than showing nothing.
  const finalList = withLiveScore.length > 0 ? withLiveScore : ranked;

  return finalList.slice(0, PICKS_COUNT).map((r) => toDailyOnePick(r.pick, r.formation));
}

function rowToPicks(row: any): DailyOnePick[] {
  if (Array.isArray(row.picks) && row.picks.length > 0) return row.picks as DailyOnePick[];
  // Legacy single-pick row (pre-multi-pick migration) — wrap for compatibility.
  if (row.ticker) {
    return [{
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
    }];
  }
  return [];
}

/**
 * Returns the active Daily One picks (up to 2), persisting a freshly
 * selected list the first time it's requested after each day's 12:12 PM ET
 * rollover so every visitor sees the same stocks for the rest of that
 * window.
 */
export async function getDailyOnePicks(): Promise<DailyOnePick[]> {
  const periodKey = getEffectivePeriodKey();

  try {
    const { data: existing } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("period_key", periodKey)
      .maybeSingle();
    if (existing) {
      const picks = rowToPicks(existing);
      if (picks.length > 0) return picks;
    }
  } catch {
    // fall through to fresh selection if Supabase is unreachable
  }

  const fresh = await selectFreshPicks();
  if (fresh.length === 0) return [];

  const first = fresh[0];
  try {
    await supabaseAdmin.from(TABLE).upsert({
      period_key: periodKey,
      ticker: first.ticker,
      company: first.company,
      sector: first.sector,
      score: first.score,
      current_price: first.currentPrice,
      target_price: first.targetPrice,
      target_pct: first.targetPct,
      entry_low: first.entryLow,
      entry_high: first.entryHigh,
      risk_reward: first.riskReward,
      selection_reasons: first.selectionReasons,
      formation_score: first.formationScore,
      picks: fresh,
      payload: { generatedAt: new Date().toISOString() },
    });
  } catch {
    // best-effort persistence — still return the freshly computed picks
  }

  return fresh;
}
