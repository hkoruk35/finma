/**
 * Monthly + per-country traffic statistics (admin visitors page).
 *
 * Definitions (same noise rules as the main traffic-audit report):
 *  - Session  = traffic_sessions row whose landing path is a real page request
 *               (static-asset noise and scanner probes are excluded).
 *  - Page view = traffic_events row with event_name = 'landing_request'
 *               (noise paths excluded via the same PostgREST patterns).
 *  - Months are calendar months in UTC. The current month and the first month
 *    of measurement are partial — per-day averages normalise them.
 *
 * Sessions per country come from one light scan (country + path only).
 * Page views per country cannot be grouped in PostgREST, so they are counted
 * exactly with chunked count(*) queries (events of the sessions of each
 * country) in a BACKGROUND job and cached; the endpoint reports progress.
 * "Unknown" page views = period total − sum of all known countries, so the
 * table always adds up to the real total.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isTrackablePageRequest, isScannerProbePath, EXCLUDED_PATH_PATTERN_SOURCES } from "@/lib/trafficAudit";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY_MS = 86_400_000;
const PAGE_SIZE = 1000;
const MAX_SCAN_ROWS = 400_000;
const SCAN_CONCURRENCY = 6;
const SESSIONS_TTL_MS = 10 * 60_000;
const PV_TTL_MS = 60 * 60_000;
const CHUNK = 100;
const COUNT_CONCURRENCY = 4;
const UNKNOWN = "Unknown";
const WINDOW_STEP_MS = 6 * 3_600_000;

export interface PeriodDef {
  key: string; // "30d" | "2026-08"
  label: string; // "Last 30 days" | "Aug 2026"
  start: number;
  end: number;
  /** days actually covered by measurement inside [start,end) */
  days: number;
  partial: boolean;
}

export interface MonthRow extends PeriodDef {
  sessions: number;
  pageViews: number;
  pagesPerSession: number;
  sessionsPerDay: number;
  pageViewsPerDay: number;
}

export interface CountryRow {
  country: string;
  /** per period key */
  sessions: Record<string, number>;
  /** per period key; null while the background count is still running */
  pageViews: Record<string, number | null>;
}

export interface MonthlyReport {
  generatedAt: number;
  firstSeen: number | null;
  months: MonthRow[];
  periods: PeriodDef[];
  /** total page views per period (exact count) */
  periodPageViews: Record<string, number>;
  periodSessions: Record<string, number>;
  countries: CountryRow[];
  pageViewsStatus: { state: "ready" | "computing" | "error"; done: number; total: number; computedAt: number | null; error?: string };
  scan: { rows: number; truncated: boolean };
}

interface SessionLite {
  session_id: string;
  country: string | null;
  landing_pathname: string;
  first_seen: number;
}

const monthKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const monthStart = (y: number, m0: number) => Date.UTC(y, m0, 1);
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const i = cursor++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

function excludeNoise<T>(query: T, column: string): T {
  let q: any = query;
  for (const src of EXCLUDED_PATH_PATTERN_SOURCES) q = q.not(column, "imatch", src);
  return q as T;
}

// ── 1) Light session scan (cached, de-duplicated) ─────────────────────

interface SessionsSnapshot {
  rows: SessionLite[];
  truncated: boolean;
  fetchedAt: number;
}
let sessionsCache: SessionsSnapshot | null = null;
let sessionsInflight: Promise<SessionsSnapshot> | null = null;

async function loadSessions(): Promise<SessionsSnapshot> {
  if (sessionsCache && Date.now() - sessionsCache.fetchedAt < SESSIONS_TTL_MS) return sessionsCache;
  if (sessionsInflight) return sessionsInflight;
  sessionsInflight = (async () => {
    const base = () =>
      (supabaseAdmin as any)
        .from("traffic_sessions")
        .select("session_id,country,landing_pathname,first_seen", { count: "exact" })
        .order("first_seen", { ascending: true });
    const first = await base().range(0, PAGE_SIZE - 1);
    if (first.error) throw new Error(first.error.message);
    const total: number = first.count ?? first.data?.length ?? 0;
    const target = Math.min(total, MAX_SCAN_ROWS);
    const raw: SessionLite[] = (first.data ?? []).slice();
    const tasks: (() => Promise<SessionLite[]>)[] = [];
    for (let off = PAGE_SIZE; off < target; off += PAGE_SIZE) {
      tasks.push(async () => {
        const p = await base().range(off, Math.min(off + PAGE_SIZE, target) - 1);
        if (p.error) throw new Error(p.error.message);
        return (p.data ?? []) as SessionLite[];
      });
    }
    for (const rows of await runWithConcurrency(tasks, SCAN_CONCURRENCY)) raw.push(...rows);
    const rows = raw.filter((s) => isTrackablePageRequest(s.landing_pathname) && !isScannerProbePath(s.landing_pathname));
    const snapshot: SessionsSnapshot = { rows, truncated: total > MAX_SCAN_ROWS, fetchedAt: Date.now() };
    sessionsCache = snapshot;
    return snapshot;
  })().finally(() => {
    sessionsInflight = null;
  });
  return sessionsInflight;
}

// ── 2) Exact page-view counts ─────────────────────────────────────────

/** Count queries can hit the (small) database's statement timeout under load — retry with backoff. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr) || "count query failed");
}

async function countPageViews(from: number, to: number): Promise<number> {
  return withRetry(() => countPageViewsOnce(from, to));
}

async function countPageViewsOnce(from: number, to: number): Promise<number> {
  let q: any = (supabaseAdmin as any)
    .from("traffic_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "landing_request")
    .gte("timestamp", from)
    .lt("timestamp", to);
  q = excludeNoise(q, "pathname");
  const { count, error } = await q;
  if (error) throw new Error(error.message || `count query failed (${error.code ?? "unknown"})`);
  return count ?? 0;
}

async function countPageViewsForSessions(ids: string[], from: number, to: number): Promise<number> {
  return withRetry(() => countPageViewsForSessionsOnce(ids, from, to));
}

async function countPageViewsForSessionsOnce(ids: string[], from: number, to: number): Promise<number> {
  let q: any = (supabaseAdmin as any)
    .from("traffic_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "landing_request")
    .gte("timestamp", from)
    .lt("timestamp", to)
    .in("session_id", ids);
  q = excludeNoise(q, "pathname");
  const { count, error } = await q;
  if (error) throw new Error(error.message || `count query failed (${error.code ?? "unknown"})`);
  return count ?? 0;
}

interface PvCache {
  computedAt: number;
  /** period key -> country -> page views (Unknown is the remainder) */
  byPeriod: Record<string, Record<string, number>>;
  totals: Record<string, number>;
  /** which periods this cache was computed for + their sessions count signature */
  signature: string;
}

let pvCache: PvCache | null = null;
let pvJob: { signature: string; done: number; total: number; error?: string; errorAt?: number; finished?: boolean } | null = null;
const ERROR_RETRY_MS = 60_000;

const normCountry = (c: string | null | undefined) => (!c || c.trim() === "" ? UNKNOWN : c.trim());

function startPvJob(periods: PeriodDef[], rows: SessionLite[], signature: string) {
  if (pvJob && pvJob.signature === signature) {
    if (!pvJob.error) return; // running or finished for this snapshot
    if (Date.now() - (pvJob.errorAt ?? 0) < ERROR_RETRY_MS) return; // cool down after an error
  }
  const job: NonNullable<typeof pvJob> = { signature, done: 0, total: 0 };
  pvJob = job;

  // period -> country -> session ids (sessions that STARTED in the period)
  const plan: { period: PeriodDef; country: string; ids: string[] }[] = [];
  for (const p of periods) {
    const byCountry = new Map<string, string[]>();
    for (const s of rows) {
      if (s.first_seen < p.start || s.first_seen >= p.end) continue;
      const c = normCountry(s.country);
      if (c === UNKNOWN) continue; // remainder = total − known
      const list = byCountry.get(c);
      if (list) list.push(s.session_id);
      else byCountry.set(c, [s.session_id]);
    }
    for (const [country, ids] of byCountry) plan.push({ period: p, country, ids });
  }
  const tasks: (() => Promise<void>)[] = [];
  const acc: Record<string, Record<string, number>> = {};
  for (const p of periods) acc[p.key] = {};
  for (const item of plan) {
    for (let i = 0; i < item.ids.length; i += CHUNK) {
      const ids = item.ids.slice(i, i + CHUNK);
      tasks.push(async () => {
        const n = await countPageViewsForSessions(ids, item.period.start, item.period.end);
        acc[item.period.key][item.country] = (acc[item.period.key][item.country] ?? 0) + n;
        job.done++;
      });
    }
  }
  job.total = tasks.length;

  void (async () => {
    try {
      const totals: Record<string, number> = {};
      for (const p of periods) totals[p.key] = await countPageViews(p.start, p.end);
      await runWithConcurrency(tasks, COUNT_CONCURRENCY);
      const byPeriod: Record<string, Record<string, number>> = {};
      for (const p of periods) {
        const known = acc[p.key];
        const knownSum = Object.values(known).reduce((a, b) => a + b, 0);
        byPeriod[p.key] = { ...known, [UNKNOWN]: Math.max(0, totals[p.key] - knownSum) };
      }
      pvCache = { computedAt: Date.now(), byPeriod, totals, signature };
      job.finished = true;
    } catch (e) {
      job.error = e instanceof Error ? e.message : String(e);
      job.errorAt = Date.now();
    }
  })();
}

// ── 3) Report ─────────────────────────────────────────────────────────

interface Core {
  snapshotAt: number;
  now: number;
  rows: SessionLite[];
  truncated: boolean;
  firstSeen: number | null;
  months: MonthRow[];
  countryPeriods: PeriodDef[];
  periodSessions: Record<string, number>;
  periodPageViews: Record<string, number>;
  sessionsByCountry: Record<string, Record<string, number>>;
}
let coreCache: Core | null = null;
let coreInflight: Promise<Core> | null = null;

/** Heavy part (scan + exact monthly totals): rebuilt only when the session snapshot refreshes (10 min). */
async function computeCore(): Promise<Core> {
  const snap = await loadSessions();
  if (coreCache && coreCache.snapshotAt === snap.fetchedAt) return coreCache;
  if (coreInflight) return coreInflight;
  coreInflight = (async () => {
    const core = await computeCoreUncached(snap);
    coreCache = core;
    return core;
  })().finally(() => {
    coreInflight = null;
  });
  return coreInflight;
}

async function computeCoreUncached(snap: SessionsSnapshot): Promise<Core> {
  const { rows, truncated } = snap;
  const now = Date.now();
  const firstSeen = rows.length ? rows[0].first_seen : null;

  // Calendar months (UTC) from the first measured month to the current one.
  const months: PeriodDef[] = [];
  if (firstSeen !== null) {
    const f = new Date(firstSeen);
    let y = f.getUTCFullYear();
    let m = f.getUTCMonth();
    const cur = new Date(now);
    while (y < cur.getUTCFullYear() || (y === cur.getUTCFullYear() && m <= cur.getUTCMonth())) {
      const start = monthStart(y, m);
      const end = monthStart(m === 11 ? y + 1 : y, (m + 1) % 12);
      const covStart = Math.max(start, firstSeen);
      const covEnd = Math.min(end, now);
      months.push({
        key: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: `${MONTH_NAMES[m]} ${y}`,
        start,
        end,
        days: Math.max(0.01, (covEnd - covStart) / DAY_MS),
        partial: covStart > start || covEnd < end,
      });
      m++;
      if (m > 11) { m = 0; y++; }
    }
  }
  // The window ends at the last 6-hour boundary (UTC) so sessions and the
  // cached per-country page views always describe exactly the same period and
  // the (expensive) page-view count only reruns four times a day.
  const end30 = Math.floor(now / WINDOW_STEP_MS) * WINDOW_STEP_MS;
  const last30: PeriodDef = {
    key: "30d",
    label: "Last 30 days",
    start: end30 - 30 * DAY_MS,
    end: end30,
    days: Math.min(30, firstSeen !== null ? Math.max(0.01, (end30 - Math.max(firstSeen, end30 - 30 * DAY_MS)) / DAY_MS) : 30),
    partial: firstSeen !== null && firstSeen > end30 - 30 * DAY_MS,
  };
  const currentMonthKey = monthKey(now);
  // Country table: last 30 days + every PREVIOUS (completed) month, newest first
  const previousMonths = months.filter((m) => m.key !== currentMonthKey).reverse();
  const countryPeriods: PeriodDef[] = [last30, ...previousMonths];

  // Sessions per period
  const periodSessions: Record<string, number> = {};
  const allPeriods = [...months, last30];
  for (const p of allPeriods) periodSessions[p.key] = 0;
  const sessionsByCountry: Record<string, Record<string, number>> = {};
  for (const s of rows) {
    const c = normCountry(s.country);
    for (const p of allPeriods) {
      if (s.first_seen >= p.start && s.first_seen < p.end) {
        periodSessions[p.key]++;
        if (countryPeriods.includes(p)) {
          (sessionsByCountry[c] ??= {})[p.key] = (sessionsByCountry[c]?.[p.key] ?? 0) + 1;
        }
      }
    }
  }

  // Exact monthly page-view totals (cheap count queries)
  const periodPageViews: Record<string, number> = {};
  await Promise.all(allPeriods.map(async (p) => { periodPageViews[p.key] = await countPageViews(p.start, Math.min(p.end, now + 1)); }));

  const monthRows: MonthRow[] = months.map((p) => {
    const sessions = periodSessions[p.key];
    const pageViews = periodPageViews[p.key];
    return {
      ...p,
      sessions,
      pageViews,
      pagesPerSession: sessions ? Math.round((pageViews / sessions) * 100) / 100 : 0,
      sessionsPerDay: Math.round(sessions / p.days),
      pageViewsPerDay: Math.round(pageViews / p.days),
    };
  });

  return {
    snapshotAt: snap.fetchedAt,
    now,
    rows,
    truncated,
    firstSeen,
    months: monthRows,
    countryPeriods,
    periodSessions,
    periodPageViews,
    sessionsByCountry,
  };
}

/** Cheap, dynamic part: attaches the (background, hourly) per-country page views + job status. */
export async function buildMonthlyReport(): Promise<MonthlyReport> {
  const core = await computeCore();
  const now = Date.now();
  const { countryPeriods, rows, sessionsByCountry } = core;

  const signature = `${countryPeriods.map((p) => `${p.key}@${p.end}`).join(",")}`;
  if (!pvCache || pvCache.signature !== signature || now - pvCache.computedAt > PV_TTL_MS * 2) startPvJob(countryPeriods, rows, signature);
  const pv = pvCache && pvCache.signature === signature && countryPeriods.every((p) => pvCache!.byPeriod[p.key]) ? pvCache : null;

  const countryNames = new Set<string>([...Object.keys(sessionsByCountry), ...(pv ? Object.values(pv.byPeriod).flatMap((o) => Object.keys(o)) : [])]);
  const countries: CountryRow[] = [...countryNames].map((country) => ({
    country,
    sessions: Object.fromEntries(countryPeriods.map((p) => [p.key, sessionsByCountry[country]?.[p.key] ?? 0])),
    pageViews: Object.fromEntries(countryPeriods.map((p) => [p.key, pv ? pv.byPeriod[p.key]?.[country] ?? 0 : null])),
  }));
  countries.sort((a, b) => (b.sessions["30d"] ?? 0) - (a.sessions["30d"] ?? 0) || a.country.localeCompare(b.country));

  const job = pvJob;
  const status: MonthlyReport["pageViewsStatus"] = pv
    ? { state: "ready", done: job?.total ?? 0, total: job?.total ?? 0, computedAt: pv.computedAt }
    : job?.error
      ? { state: "error", done: job.done, total: job.total, computedAt: null, error: job.error }
      : { state: "computing", done: job?.done ?? 0, total: job?.total ?? 0, computedAt: null };

  return {
    generatedAt: now,
    firstSeen: core.firstSeen,
    months: core.months,
    periods: countryPeriods,
    periodPageViews: core.periodPageViews,
    periodSessions: core.periodSessions,
    countries,
    pageViewsStatus: status,
    scan: { rows: rows.length, truncated: core.truncated },
  };
}
