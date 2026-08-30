import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  classifySource,
  sessionStage,
  sessionAudience,
  isTrackablePageRequest,
  isScannerProbePath,
  diagnosticSignals,
  isSuspectedAutomation,
  parseTimeframe,
  timeframeHours,
  timeframeBucketMs,
  EXCLUDED_PATH_PATTERN_SOURCES,
  X_PAID_LABEL,
  type TrafficSession,
  type Timeframe,
} from "@/lib/trafficAudit";

export const dynamic = "force-dynamic";
// 30 gunluk/tum-zaman pencerelerinde on binlerce satir sayfa sayfa taraniyor —
// varsayilan sureye sigmayabilir (olculen: 30d ~6sn, tum zamanlar ~13sn dev'de).
export const maxDuration = 60;

function requireAdmin(req: NextRequest): boolean {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin" || role === "readonly";
}

// PostgREST'in `max-rows` ayari 1000 — eski koddaki `.limit(2000)` demek
// SESSIZCE 1000'de kesilmek demekti (24 saatte bile 2300+ session var, yani
// dashboard gercek rakami degil "ilk 1000"i gosteriyordu). Artik pencerenin
// tamami sayfa sayfa taraniyor.
const PAGE_SIZE = 1000;
// Ust sinir: bir raporun sunucuda tarayacagi maksimum session satiri. Asilirsa
// EN YENI satirlar taranir ve response `scan.truncated` ile isaretlenir —
// sessizce yanlis sayi dondurmek yerine kesildigini SOYLER.
const MAX_SCAN_ROWS = 60_000;
const PAGE_CONCURRENCY = 6;
// Dashboard periyodik yeniliyor; ayni pencereyi her seferinde bastan cekmek
// yerine ham satirlar kisa sureli cache'leniyor. Filtreler JS tarafinda
// uygulandigi icin filtre degistirmek yeni bir veritabani taramasi ACMAZ.
const CACHE_TTL_MS = 60_000;
const VISITOR_DETAIL_LIMIT = 500;

// Detay tablosunda kullanilmayan alanlar (utm_term, signup_*_at, created_at)
// bilerek cekilmiyor — 30 gunluk pencerede on binlerce satir tasiniyor.
const SESSION_COLUMNS = [
  "session_id",
  "visitor_id",
  "first_seen",
  "last_activity",
  "landing_pathname",
  "referrer",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "twclid",
  "ip",
  "country",
  "city",
  "user_agent",
  "device",
  "suspected_bot_ua",
  "page_loaded",
  "active_5s",
  "active_15s",
  "active_30s",
  "interacted",
  "signup_started",
  "signup_completed",
].join(",");

type ScanRow = Pick<
  TrafficSession,
  | "session_id"
  | "visitor_id"
  | "first_seen"
  | "last_activity"
  | "landing_pathname"
  | "referrer"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "utm_content"
  | "twclid"
  | "ip"
  | "country"
  | "city"
  | "user_agent"
  | "device"
  | "suspected_bot_ua"
  | "page_loaded"
  | "active_5s"
  | "active_15s"
  | "active_30s"
  | "interacted"
  | "signup_started"
  | "signup_completed"
>;

interface WindowScan {
  rows: ScanRow[];
  totalRowsInWindow: number;
  truncated: boolean;
  fetchedAt: number;
}

const scanCache = new Map<Timeframe, WindowScan>();

/* eslint-disable @typescript-eslint/no-explicit-any */

function excludeNoisePaths<T>(query: T, column: string): T {
  let q: any = query;
  for (const src of EXCLUDED_PATH_PATTERN_SOURCES) {
    q = q.not(column, "imatch", src);
  }
  return q as T;
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

async function scanWindow(timeframe: Timeframe, since: number | null): Promise<WindowScan> {
  const cached = scanCache.get(timeframe);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;

  const base = () => {
    let q: any = supabaseAdmin.from("traffic_sessions").select(SESSION_COLUMNS, { count: "exact" });
    if (since !== null) q = q.gte("first_seen", since);
    return q.order("first_seen", { ascending: false });
  };

  const first = await base().range(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);

  const totalRowsInWindow: number = first.count ?? first.data?.length ?? 0;
  const scanTarget = Math.min(totalRowsInWindow, MAX_SCAN_ROWS);
  const rows = ((first.data ?? []) as ScanRow[]).slice();

  if (scanTarget > rows.length) {
    const pageTasks: (() => Promise<ScanRow[]>)[] = [];
    for (let offset = PAGE_SIZE; offset < scanTarget; offset += PAGE_SIZE) {
      const from = offset;
      const to = Math.min(offset + PAGE_SIZE, scanTarget) - 1;
      pageTasks.push(async () => {
        const page = await base().range(from, to);
        if (page.error) throw new Error(page.error.message);
        return (page.data ?? []) as ScanRow[];
      });
    }
    for (const pageRows of await runWithConcurrency(pageTasks, PAGE_CONCURRENCY)) {
      rows.push(...pageRows);
    }
  }

  const scan: WindowScan = {
    rows,
    totalRowsInWindow,
    truncated: totalRowsInWindow > MAX_SCAN_ROWS,
    fetchedAt: Date.now(),
  };
  scanCache.set(timeframe, scan);
  return scan;
}

async function countSessions(from: number, to: number, extra?: (q: any) => any): Promise<number> {
  let q: any = supabaseAdmin
    .from("traffic_sessions")
    .select("session_id", { count: "exact", head: true })
    .gte("first_seen", from)
    .lt("first_seen", to);
  q = excludeNoisePaths(q, "landing_pathname");
  if (extra) q = extra(q);
  const { count } = await q;
  return count ?? 0;
}

async function countPageViews(from: number, to: number | null): Promise<number> {
  let q: any = supabaseAdmin
    .from("traffic_events")
    .select("id", { count: "exact", head: true })
    .eq("event_name", "landing_request")
    .gte("timestamp", from);
  if (to !== null) q = q.lt("timestamp", to);
  q = excludeNoisePaths(q, "pathname");
  const { count } = await q;
  return count ?? 0;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

const FUNNEL_STAGES: { key: keyof ScanRow | "session"; label: string }[] = [
  { key: "session", label: "Landing Requests" },
  { key: "page_loaded", label: "Browser Loaded" },
  { key: "active_5s", label: "Active 5s" },
  { key: "active_15s", label: "Active 15s" },
  { key: "active_30s", label: "Active 30s" },
  { key: "interacted", label: "Interacted" },
  { key: "signup_started", label: "Signup Started" },
  { key: "signup_completed", label: "Signup Completed" },
];

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = onceki donem 0, oran tanimsiz
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function topN<T>(map: Map<string, T>, pick: (v: T) => number, n: number): [string, T][] {
  return Array.from(map.entries())
    .sort((a, b) => pick(b[1]) - pick(a[1]))
    .slice(0, n);
}

function referrerHost(referrer: string): string {
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

interface Bucketed {
  sessions: number;
  visitors: Set<string>;
  human: number;
  bot: number;
  loaded: number;
  engaged: number;
  conversions: number;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const timeframe = parseTimeframe(searchParams.get("timeframe"));
  const country = searchParams.get("country") || "";
  const source = searchParams.get("source") || "";
  const campaign = searchParams.get("campaign") || "";
  const content = searchParams.get("content") || "";
  const device = searchParams.get("device") || "";
  const segment = searchParams.get("segment") || "all"; // all | verified_human | bot | unverified

  const hours = timeframeHours(timeframe);
  const windowEnd = Date.now();
  const windowStart = hours === null ? null : windowEnd - hours * 60 * 60 * 1000;

  let scan: WindowScan;
  try {
    scan = await scanWindow(timeframe, windowStart);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "scan failed" }, { status: 500 });
  }

  // ── Gurultu temizligi ────────────────────────────────────────────────────
  // 1) Asset/non-page istekleri (proxy fix'inden ONCE olusmus /logo/*.png vb.)
  // 2) Guvenlik tarayici probe'lari (/wp-admin, /xmlrpc.php ...) — BOGASTOCK'a
  //    ait degil. Ham kayitlar Supabase'de duruyor, sadece rapordan cikiyor.
  const assetNoise = scan.rows.filter((s) => !isTrackablePageRequest(s.landing_pathname)).length;
  let clean = scan.rows.filter((s) => isTrackablePageRequest(s.landing_pathname));
  const scannerCount = clean.filter((s) => isScannerProbePath(s.landing_pathname)).length;
  clean = clean.filter((s) => !isScannerProbePath(s.landing_pathname));

  // Filtre secenekleri FILTRELENMEMIS kumeden uretilir — aksi halde bir kaynak
  // secildiginde dropdown tek secenege duserdi (eski davranistaki hata).
  const options = {
    countries: Array.from(new Set(clean.map((s) => s.country).filter(Boolean))).sort() as string[],
    sources: Array.from(new Set(clean.map((s) => classifySource(s)))).sort(),
    campaigns: Array.from(new Set(clean.map((s) => s.utm_campaign).filter(Boolean))).sort() as string[],
    contents: Array.from(new Set(clean.map((s) => s.utm_content).filter(Boolean))).sort() as string[],
    devices: Array.from(new Set(clean.map((s) => s.device).filter(Boolean))).sort() as string[],
  };

  const sessions = clean.filter((s) => {
    if (country && s.country !== country) return false;
    if (campaign && s.utm_campaign !== campaign) return false;
    if (content && s.utm_content !== content) return false;
    if (device && s.device !== device) return false;
    if (source && classifySource(s) !== source) return false;
    if (segment !== "all" && sessionAudience(s) !== segment) return false;
    return true;
  });

  // ── Tek gecis: tum kirilimlar ────────────────────────────────────────────
  const visitorSessionCount = new Map<string, number>();
  const humanVisitors = new Set<string>();
  const bucketMs = timeframeBucketMs(timeframe);
  const buckets = new Map<number, Bucketed>();
  const sourceMap = new Map<string, ScanRow[]>();
  const countryMap = new Map<string, ScanRow[]>();
  const deviceMap = new Map<string, ScanRow[]>();
  const pageMap = new Map<string, ScanRow[]>();
  const referrerMap = new Map<string, ScanRow[]>();
  const botAgentMap = new Map<string, number>();

  let verifiedHuman = 0;
  let bots = 0;
  let unverified = 0;
  let engagementMsTotal = 0;
  let engagementSamples = 0;

  const push = (map: Map<string, ScanRow[]>, key: string, row: ScanRow) => {
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  };

  for (const s of sessions) {
    visitorSessionCount.set(s.visitor_id, (visitorSessionCount.get(s.visitor_id) ?? 0) + 1);

    const audience = sessionAudience(s);
    if (audience === "verified_human") {
      verifiedHuman++;
      humanVisitors.add(s.visitor_id);
    } else if (audience === "bot") {
      bots++;
      const ua = s.user_agent ?? "(bilinmiyor)";
      botAgentMap.set(ua, (botAgentMap.get(ua) ?? 0) + 1);
    } else {
      unverified++;
    }

    const bucketTs = Math.floor(s.first_seen / bucketMs) * bucketMs;
    let bucket = buckets.get(bucketTs);
    if (!bucket) {
      bucket = { sessions: 0, visitors: new Set(), human: 0, bot: 0, loaded: 0, engaged: 0, conversions: 0 };
      buckets.set(bucketTs, bucket);
    }
    bucket.sessions++;
    bucket.visitors.add(s.visitor_id);
    if (audience === "verified_human") bucket.human++;
    if (audience === "bot") bucket.bot++;
    if (s.page_loaded) bucket.loaded++;
    if (s.active_5s) bucket.engaged++;
    if (s.signup_completed) bucket.conversions++;

    push(sourceMap, classifySource(s), s);
    push(countryMap, s.country || "Bilinmiyor", s);
    push(deviceMap, s.device || "Bilinmiyor", s);
    push(pageMap, s.landing_pathname, s);
    push(referrerMap, s.referrer ? referrerHost(s.referrer) : "(doğrudan)", s);

    if (s.page_loaded && s.last_activity > s.first_seen) {
      engagementMsTotal += s.last_activity - s.first_seen;
      engagementSamples++;
    }
  }

  const uniqueVisitors = visitorSessionCount.size;
  const returningVisitors = Array.from(visitorSessionCount.values()).filter((n) => n > 1).length;
  const loaded = sessions.filter((s) => s.page_loaded).length;
  const engaged = sessions.filter((s) => s.active_5s).length;
  const conversions = sessions.filter((s) => s.signup_completed).length;

  // ── Sayfa goruntuleme + onceki donem karsilastirmasi ─────────────────────
  // count(*) sorgulariyla alinir (satir cekilmez). Ayni path eleme kurallari
  // PostgREST tarafinda da uygulanir — filtre string'i EXCLUDED_PATH_PATTERN_
  // SOURCES ile ayni kaynaktan uretildigi icin iki taraf sapamaz.
  const filtersActive = !!(country || source || campaign || content || device) || segment !== "all";
  const previousStart = windowStart === null ? null : windowStart - (windowEnd - windowStart);

  const [pageViews, prevSessions, prevLoaded, prevEngaged, prevConversions, prevPageViews, firstSessionRows] =
    await Promise.all([
      countPageViews(windowStart ?? 0, null),
      previousStart === null ? Promise.resolve(0) : countSessions(previousStart, windowStart as number),
      previousStart === null
        ? Promise.resolve(0)
        : countSessions(previousStart, windowStart as number, (q) => q.eq("page_loaded", true)),
      previousStart === null
        ? Promise.resolve(0)
        : countSessions(previousStart, windowStart as number, (q) => q.eq("active_5s", true)),
      previousStart === null
        ? Promise.resolve(0)
        : countSessions(previousStart, windowStart as number, (q) => q.eq("signup_completed", true)),
      previousStart === null ? Promise.resolve(0) : countPageViews(previousStart, windowStart as number),
      supabaseAdmin.from("traffic_sessions").select("first_seen").order("first_seen", { ascending: true }).limit(1),
    ]);

  // Karsilastirma SADECE filtresiz gorunumde anlamli: onceki donem rakamlari
  // count(*) ile geliyor ve UTM/segment filtreleri o sorgulara uygulanmiyor.
  // Filtre varken yanlis kiyas gostermektense karsilastirma gizlenir.
  const comparison =
    previousStart === null
      ? null
      : {
          previousStart,
          previousEnd: windowStart,
          suppressedByFilter: filtersActive,
          metrics: filtersActive
            ? []
            : [
                {
                  key: "sessions",
                  label: "Oturum",
                  current: sessions.length,
                  previous: prevSessions,
                  changePct: changePct(sessions.length, prevSessions),
                },
                {
                  key: "pageViews",
                  label: "Sayfa Görüntüleme",
                  current: pageViews,
                  previous: prevPageViews,
                  changePct: changePct(pageViews, prevPageViews),
                },
                {
                  key: "loaded",
                  label: "Tarayıcıda Yüklendi",
                  current: loaded,
                  previous: prevLoaded,
                  changePct: changePct(loaded, prevLoaded),
                },
                {
                  key: "engaged",
                  label: "5sn Aktif",
                  current: engaged,
                  previous: prevEngaged,
                  changePct: changePct(engaged, prevEngaged),
                },
                {
                  key: "conversions",
                  label: "Kayıt Tamamlandı",
                  current: conversions,
                  previous: prevConversions,
                  changePct: changePct(conversions, prevConversions),
                },
              ],
        };

  const funnel = (() => {
    const counts = FUNNEL_STAGES.map((stage) =>
      stage.key === "session" ? sessions.length : sessions.filter((s) => s[stage.key as keyof ScanRow]).length
    );
    return FUNNEL_STAGES.map((stage, i) => ({
      stage: stage.label,
      count: counts[i],
      pctOfPrev: i === 0 ? null : counts[i - 1] > 0 ? Math.round((counts[i] / counts[i - 1]) * 1000) / 10 : 0,
      pctOfTop: counts[0] > 0 ? Math.round((counts[i] / counts[0]) * 1000) / 10 : 0,
    }));
  })();

  const series = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, b]) => ({
      ts,
      sessions: b.sessions,
      visitors: b.visitors.size,
      human: b.human,
      bot: b.bot,
      loaded: b.loaded,
      engaged: b.engaged,
      conversions: b.conversions,
    }));

  const breakdown = (map: Map<string, ScanRow[]>, limit: number) =>
    topN(map, (rows) => rows.length, limit).map(([key, rows]) => ({
      key,
      sessions: rows.length,
      human: rows.filter((r) => sessionAudience(r) === "verified_human").length,
      bot: rows.filter((r) => sessionAudience(r) === "bot").length,
      loaded: rows.filter((r) => r.page_loaded).length,
      engaged: rows.filter((r) => r.active_5s).length,
      conversions: rows.filter((r) => r.signup_completed).length,
    }));

  const sources = Array.from(sourceMap.entries())
    .map(([label, rows]) => ({
      source: label,
      sessions: rows.length,
      browserLoaded: rows.filter((r) => r.page_loaded).length,
      active5s: rows.filter((r) => r.active_5s).length,
      active15s: rows.filter((r) => r.active_15s).length,
      interacted: rows.filter((r) => r.interacted).length,
      signupStarted: rows.filter((r) => r.signup_started).length,
      signupCompleted: rows.filter((r) => r.signup_completed).length,
      human: rows.filter((r) => sessionAudience(r) === "verified_human").length,
      withTwclid: label === X_PAID_LABEL ? rows.filter((r) => !!r.twclid).length : null,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // abnormal_navigation_rate sinyali icin gorunur session'larin gercek
  // navigasyon (landing_request) sayisi. `.in()` listesi 100'luk parcalara
  // bolunuyor — 500 UUID'lik tek bir IN sorgusu URL uzunlugu sinirina takilip
  // sessizce bos donebiliyordu.
  const detailRows = sessions.slice(0, VISITOR_DETAIL_LIMIT);
  const requestCountBySession = new Map<string, number>();
  if (detailRows.length > 0) {
    const ids = detailRows.map((s) => s.session_id);
    const chunkTasks: (() => Promise<void>)[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      chunkTasks.push(async () => {
        const { data: eventRows } = await supabaseAdmin
          .from("traffic_events")
          .select("session_id")
          .eq("event_name", "landing_request")
          .in("session_id", chunk)
          .limit(PAGE_SIZE);
        for (const row of eventRows ?? []) {
          requestCountBySession.set(row.session_id, (requestCountBySession.get(row.session_id) ?? 0) + 1);
        }
      });
    }
    await runWithConcurrency(chunkTasks, PAGE_CONCURRENCY);
  }

  const visitors = detailRows.map((s) => {
    const signals = diagnosticSignals(s, requestCountBySession.get(s.session_id) ?? 0);
    return {
      sessionId: s.session_id,
      visitorId: s.visitor_id,
      firstSeen: s.first_seen,
      lastActivity: s.last_activity,
      country: s.country,
      city: s.city,
      source: classifySource(s),
      campaign: s.utm_campaign,
      content: s.utm_content,
      page: s.landing_pathname,
      stage: sessionStage(s),
      audience: sessionAudience(s),
      ip: s.ip,
      device: s.device,
      userAgent: s.user_agent,
      twclid: !!s.twclid,
      pageRequests: requestCountBySession.get(s.session_id) ?? 0,
      diagnosticSignals: signals,
      suspectedAutomation: isSuspectedAutomation(signals),
    };
  });

  return NextResponse.json({
    timeframe,
    generatedAt: Date.now(),
    dataFetchedAt: scan.fetchedAt,
    windowStart,
    windowEnd,
    bucketMs,
    auditLiveSince: firstSessionRows.data?.[0]?.first_seen ?? null,
    scan: {
      totalRowsInWindow: scan.totalRowsInWindow,
      scanned: scan.rows.length,
      truncated: scan.truncated,
      maxScanRows: MAX_SCAN_ROWS,
    },
    excluded: { assetNoise, scannerProbes: scannerCount },
    overview: {
      sessions: sessions.length,
      uniqueVisitors,
      returningVisitors,
      pageViews,
      pageViewsPerSession: sessions.length > 0 ? Math.round((pageViews / sessions.length) * 100) / 100 : 0,
      verifiedHumanSessions: verifiedHuman,
      humanUniqueVisitors: humanVisitors.size,
      botSessions: bots,
      unverifiedSessions: unverified,
      loadedSessions: loaded,
      engagedSessions: engaged,
      deepEngagedSessions: sessions.filter((s) => s.active_30s).length,
      interactedSessions: sessions.filter((s) => s.interacted).length,
      signupStarted: sessions.filter((s) => s.signup_started).length,
      conversions,
      bounceRate: loaded > 0 ? Math.round(((loaded - engaged) / loaded) * 1000) / 10 : null,
      avgEngagementSeconds: engagementSamples > 0 ? Math.round(engagementMsTotal / engagementSamples / 1000) : 0,
      conversionRate: loaded > 0 ? Math.round((conversions / loaded) * 10000) / 100 : 0,
    },
    comparison,
    series,
    funnel,
    sources,
    countries: breakdown(countryMap, 25),
    devices: breakdown(deviceMap, 10),
    landingPages: breakdown(pageMap, 25),
    referrers: breakdown(referrerMap, 15),
    botAgents: topN(botAgentMap, (n) => n, 15).map(([agent, count]) => ({ agent, sessions: count })),
    options,
    visitors,
    visitorLimit: VISITOR_DETAIL_LIMIT,
  });
}
