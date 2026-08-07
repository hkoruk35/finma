// First-Party Traffic Audit — shared types + helpers used by proxy.ts,
// /api/track/event, /api/members/register, and the admin dashboard.
// See docs/DATA_CONTRACTS.md for the traffic_sessions/traffic_events schema
// (migration: supabase/migrations/002_create_traffic_audit.sql).

export const VISITOR_COOKIE = "boga_vid";
export const SESSION_COOKIE = "boga_sid";
export const SESSION_MAX_AGE_SECONDS = 60 * 30; // 30 min sliding window
export const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export const MILESTONE_EVENTS = [
  "page_loaded",
  "active_5s",
  "active_15s",
  "active_30s",
  "user_interaction",
  "signup_started",
  "signup_completed",
] as const;

export type MilestoneEvent = (typeof MILESTONE_EVENTS)[number];

export interface TrafficSession {
  session_id: string;
  visitor_id: string;
  first_seen: number;
  last_activity: number;
  landing_pathname: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  twclid: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  device: string | null;
  suspected_bot_ua: boolean;
  page_loaded: boolean;
  active_5s: boolean;
  active_15s: boolean;
  active_30s: boolean;
  interacted: boolean;
  signup_started: boolean;
  signup_completed: boolean;
  signup_started_at: number | null;
  signup_completed_at: number | null;
}

const NON_PAGE_PATHS = new Set(["/robots.txt", "/sitemap.xml", "/manifest.json", "/favicon.ico"]);
const STATIC_FILE_EXT = /\.(png|jpe?g|gif|svg|ico|webp|avif|css|js|mjs|map|woff2?|ttf|eot|xml|txt|json|webmanifest|pdf|mp4|webm)$/i;

// proxy.ts landing_request'i SADECE gercek sayfa navigasyonlarinda loglamali —
// /logo/*.png, /robots.txt gibi statik dosya istekleri page-view sayisini
// kirletmesin diye burada eleniyor (matcher zaten _next/static'i haric
// tutuyor ama public/ altindaki dosyalar route olarak matcher'a takiliyor).
export function isTrackablePageRequest(pathname: string): boolean {
  if (NON_PAGE_PATHS.has(pathname)) return false;
  if (STATIC_FILE_EXT.test(pathname)) return false;
  return true;
}

export function detectDevice(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

// Funnel stage bir sonraki fonksiyonun tek kaynagi — hem admin API hem
// dashboard ayni siralamayi kullanir, iki ayri kopya olmasin.
export function sessionStage(s: Pick<TrafficSession, "signup_completed" | "signup_started" | "interacted" | "active_30s" | "active_15s" | "active_5s" | "page_loaded">): string {
  if (s.signup_completed) return "Converted";
  if (s.signup_started) return "Signup Started";
  if (s.interacted) return "Interacted";
  if (s.active_15s) return "Active 15s";
  if (s.active_5s) return "Active 5s";
  if (s.page_loaded) return "Loaded";
  return "Request Only";
}

export const X_PAID_LABEL = "X / Paid";

const SOURCE_LABEL_OVERRIDES: Record<string, string> = {
  x: X_PAID_LABEL,
  twitter: X_PAID_LABEL,
};

// Kaynagi insan-okunur bir kategoriye ayirir: UTM > twclid > referrer > Direct.
// twclid VARSA session asla duz "Direct" olarak siniflandirilmaz — UTM yoksa
// bile X reklam tiklamasi oldugu biliniyor (medium=paid_social). Drill-down
// (campaign/content) bu kategoriden BAGIMSIZ, ayri filtre alanlari ile yapilir
// (bkz. admin route). Ham utm_source/medium/twclid alanlari asla silinmez —
// bu fonksiyon SADECE bir derived/goruntuleme etiketi uretir.
export function classifySource(s: Pick<TrafficSession, "utm_source" | "utm_medium" | "referrer" | "twclid">): string {
  const src = s.utm_source?.toLowerCase().trim();
  if (src) {
    if (SOURCE_LABEL_OVERRIDES[src]) return SOURCE_LABEL_OVERRIDES[src];
    if (s.utm_medium?.toLowerCase() === "email" || src.includes("email")) return "Email";
    if (s.utm_medium?.toLowerCase() === "organic") return "Organic";
    return s.utm_medium ? `${src} / ${s.utm_medium}` : src;
  }
  if (s.twclid) return X_PAID_LABEL;
  if (s.referrer) {
    try {
      const host = new URL(s.referrer).hostname.replace(/^www\./, "");
      if (host.includes("bogastock.com")) return "Direct";
      if (/google\./.test(host)) return "Organic";
      return `Referral (${host})`;
    } catch {
      return "Referral";
    }
  }
  return "Direct";
}

// ── Diagnostic signals (bkz. TASK point 3) ─────────────────────────────────
// Tek bir zayif sinyal (orn. sadece "5sn'de active event gelmedi") artik
// otomatik "suspected_automation" ETIKETLEMEZ — sinyaller ayri ayri raporlanir,
// suspected_automation SADECE 2+ sinyal ayni anda varsa true olur.
export const DIAGNOSTIC_AGE_GATE_MS = 5 * 60 * 1000; // sinyal icin en az 5dk gecmis olmali (hala yukleniyor olabilir)
export const HIGH_FREQUENCY_REQUEST_THRESHOLD = 15; // ayni session'da bu sayidan fazla landing_request

export type DiagnosticSignal = "request_only" | "loaded_no_engagement" | "known_bot_user_agent" | "high_frequency_requests";

export function diagnosticSignals(
  s: Pick<TrafficSession, "suspected_bot_ua" | "page_loaded" | "active_5s" | "first_seen">,
  landingRequestCount = 0
): DiagnosticSignal[] {
  const signals: DiagnosticSignal[] = [];
  const ageMs = Date.now() - s.first_seen;
  if (s.suspected_bot_ua) signals.push("known_bot_user_agent");
  if (!s.page_loaded && ageMs > DIAGNOSTIC_AGE_GATE_MS) signals.push("request_only");
  else if (s.page_loaded && !s.active_5s && ageMs > DIAGNOSTIC_AGE_GATE_MS) signals.push("loaded_no_engagement");
  if (landingRequestCount > HIGH_FREQUENCY_REQUEST_THRESHOLD) signals.push("high_frequency_requests");
  return signals;
}

export function isSuspectedAutomation(signals: DiagnosticSignal[]): boolean {
  return signals.length >= 2;
}
