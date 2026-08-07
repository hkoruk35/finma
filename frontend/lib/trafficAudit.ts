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

const SOURCE_LABEL_OVERRIDES: Record<string, string> = {
  x: "X / paid_social",
  twitter: "X / paid_social",
};

// Kaynagi insan-okunur bir kategoriye ayirir (point 8): Direct / X paid_social /
// Email / Organic / Referral / diger UTM kaynaklari. Drill-down (campaign/content)
// bu kategoriden BAGIMSIZ, ayri filtre alanlari ile yapilir (bkz. admin route).
export function classifySource(s: Pick<TrafficSession, "utm_source" | "utm_medium" | "referrer">): string {
  const src = s.utm_source?.toLowerCase().trim();
  if (src) {
    if (SOURCE_LABEL_OVERRIDES[src]) return SOURCE_LABEL_OVERRIDES[src];
    if (s.utm_medium?.toLowerCase() === "email" || src.includes("email")) return "Email";
    if (s.utm_medium?.toLowerCase() === "organic") return "Organic";
    return s.utm_medium ? `${src} / ${s.utm_medium}` : src;
  }
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
