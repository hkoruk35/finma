import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  classifySource,
  sessionStage,
  isTrackablePageRequest,
  isScannerProbePath,
  diagnosticSignals,
  isSuspectedAutomation,
  X_PAID_LABEL,
  type TrafficSession,
} from "@/lib/trafficAudit";

function requireAdmin(req: NextRequest): boolean {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin" || role === "readonly";
}

const FUNNEL_STAGES: { key: keyof TrafficSession | "session"; label: string }[] = [
  { key: "session", label: "Landing Requests" },
  { key: "page_loaded", label: "Browser Loaded" },
  { key: "active_5s", label: "Active 5s" },
  { key: "active_15s", label: "Active 15s" },
  { key: "interacted", label: "Interacted" },
  { key: "signup_started", label: "Signup Started" },
  { key: "signup_completed", label: "Signup Completed" },
];

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const timeframe = searchParams.get("timeframe") || "24h";
  const country = searchParams.get("country") || "";
  const source = searchParams.get("source") || ""; // classified label, e.g. "X / paid_social"
  const campaign = searchParams.get("campaign") || "";
  const content = searchParams.get("content") || "";

  let query = supabaseAdmin.from("traffic_sessions").select("*").order("first_seen", { ascending: false }).limit(2000);

  if (timeframe !== "all") {
    const hours = timeframe === "24h" ? 24 : timeframe === "7d" ? 7 * 24 : timeframe === "30d" ? 30 * 24 : null;
    if (hours) query = query.gte("first_seen", Date.now() - hours * 60 * 60 * 1000);
  }
  if (country) query = query.eq("country", country);
  if (campaign) query = query.eq("utm_campaign", campaign);
  if (content) query = query.eq("utm_content", content);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sessions = (data ?? []) as TrafficSession[];

  // Dashboard-level asset-noise temizligi: /manifest.json, /logo/*.png vb.
  // dogrudan hit'lerin proxy fix'inden ONCE olusturdugu "session"lar var —
  // mevcut kayitlari SILMEDEN, sadece landing_pathname bir sayfa degilse
  // funnel/kaynak/visitor listelerinden cikar.
  sessions = sessions.filter((s) => isTrackablePageRequest(s.landing_pathname));

  // Security/Scanner probe trafigi (point 5): /wp-admin, /xmlrpc.php vb. —
  // BOGASTOCK'a ait degil, funnel/session/visitor sayimina hic girmemeli.
  // Ham kayitlar Supabase'de duruyor, sadece bu response'tan cikariliyor.
  const scannerCount = sessions.filter((s) => isScannerProbePath(s.landing_pathname)).length;
  sessions = sessions.filter((s) => !isScannerProbePath(s.landing_pathname));

  if (source) sessions = sessions.filter((s) => classifySource(s) === source);

  // ── Funnel (point 7) ─────────────────────────────────────────────────────
  const funnel = FUNNEL_STAGES.map((stage, i) => {
    const count = stage.key === "session" ? sessions.length : sessions.filter((s) => s[stage.key as keyof TrafficSession]).length;
    const prevCount = i === 0 ? count : (FUNNEL_STAGES[i - 1].key === "session" ? sessions.length : sessions.filter((s) => s[FUNNEL_STAGES[i - 1].key as keyof TrafficSession]).length);
    const pctOfPrev = i === 0 ? null : prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : 0;
    return { stage: stage.label, count, pctOfPrev };
  });

  // ── Traffic Sources (point 8 + X Ads audit, point 9) ────────────────────
  const sourceMap = new Map<string, TrafficSession[]>();
  for (const s of sessions) {
    const label = classifySource(s);
    if (!sourceMap.has(label)) sourceMap.set(label, []);
    sourceMap.get(label)!.push(s);
  }
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
      // X Ads audit (point 9): bu kaynak X ise twclid kapsamini goster.
      withTwclid: label === X_PAID_LABEL ? rows.filter((r) => !!r.twclid).length : null,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // ── Campaign/content drill-down secenekleri (point 8) ───────────────────
  const campaigns = Array.from(new Set(sessions.map((s) => s.utm_campaign).filter(Boolean))) as string[];
  const contents = Array.from(new Set(sessions.map((s) => s.utm_content).filter(Boolean))) as string[];
  const countries = Array.from(new Set(sessions.map((s) => s.country).filter(Boolean))) as string[];

  // ── abnormal_navigation_rate sinyali icin: bu session'larin landing_request
  // (gercek navigasyon) sayisi (JS'te aggregate ediliyor — REST API GROUP BY
  // yapamiyor, veri hacmi bu audit'in olcegi icin kucuk).
  const visibleSessionIds = sessions.slice(0, 500).map((s) => s.session_id);
  const requestCountBySession = new Map<string, number>();
  if (visibleSessionIds.length > 0) {
    const { data: eventRows } = await supabaseAdmin
      .from("traffic_events")
      .select("session_id")
      .eq("event_name", "landing_request")
      .in("session_id", visibleSessionIds)
      .limit(20000);
    for (const row of eventRows ?? []) {
      requestCountBySession.set(row.session_id, (requestCountBySession.get(row.session_id) ?? 0) + 1);
    }
  }

  // ── Instrumentation'in production'da ilk aktif oldugu an (point 4) ──────
  // Timeframe filtresinden BAGIMSIZ — "olcum ne zaman basladi" sorusunun
  // cevabi, o an secili filtreye gore degil, tum tarihe gore olmali.
  const { data: firstSessionRows } = await supabaseAdmin
    .from("traffic_sessions")
    .select("first_seen")
    .order("first_seen", { ascending: true })
    .limit(1);
  const auditLiveSince = firstSessionRows?.[0]?.first_seen ?? null;

  // ── Visitor Detail (point 11) — diagnostic sinyaller (point 3) ──────────
  const visitors = sessions.slice(0, 500).map((s) => {
    const signals = diagnosticSignals(s, requestCountBySession.get(s.session_id) ?? 0);
    return {
      sessionId: s.session_id,
      firstSeen: s.first_seen,
      lastActivity: s.last_activity,
      country: s.country,
      city: s.city,
      source: classifySource(s),
      campaign: s.utm_campaign,
      content: s.utm_content,
      page: s.landing_pathname,
      stage: sessionStage(s),
      ip: s.ip,
      device: s.device,
      twclid: !!s.twclid,
      diagnosticSignals: signals,
      suspectedAutomation: isSuspectedAutomation(signals),
    };
  });

  return NextResponse.json({
    timeframe,
    totalSessions: sessions.length,
    scannerTrafficExcluded: scannerCount,
    auditLiveSince,
    funnel,
    sources,
    campaigns,
    contents,
    countries,
    visitors,
  });
}
