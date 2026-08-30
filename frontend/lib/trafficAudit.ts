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

// Regex KAYNAK STRING'i olarak tutulur (RegExp literal degil): admin dashboard
// ayni eleme kuralini PostgREST tarafinda da (`landing_pathname=not.imatch.<src>`)
// uygulayabilsin diye — boylece "hangi istek sayfa sayilir" tanimi tek yerde
// kalir, JS tarafi ile veritabani tarafi birbirinden SAPMAZ.
export const STATIC_ASSET_PATTERN_SOURCE =
  String.raw`\.(png|jpe?g|gif|svg|ico|webp|avif|css|js|mjs|map|woff2?|ttf|eot|xml|txt|json|webmanifest|pdf|mp4|webm)$`;
const STATIC_FILE_EXT = new RegExp(STATIC_ASSET_PATTERN_SOURCE, "i");

// proxy.ts landing_request'i SADECE gercek sayfa navigasyonlarinda loglamali —
// /logo/*.png, /robots.txt gibi statik dosya istekleri page-view sayisini
// kirletmesin diye burada eleniyor (matcher zaten _next/static'i haric
// tutuyor ama public/ altindaki dosyalar route olarak matcher'a takiliyor).
export function isTrackablePageRequest(pathname: string): boolean {
  if (NON_PAGE_PATHS.has(pathname)) return false;
  if (STATIC_FILE_EXT.test(pathname)) return false;
  return true;
}

// Next.js App Router, <Link> viewport/hover prefetch'i ve client-side RSC
// navigasyonlari icin arka planda gercek HTTP istekleri atar — bunlar
// kullanicinin GERCEKTEN gordugu bir sayfa degildir ("meaningful
// document/navigation" degil), landing_request/session sayimina KATILMAMALI.
// Next.js bu istekleri sabit header'larla isaretler (App Router sozlesmesi).
export function isPrefetchOrDataRequest(headers: { get(name: string): string | null }): boolean {
  if (headers.get("next-router-prefetch")) return true;
  if (headers.get("purpose") === "prefetch" || headers.get("x-purpose") === "prefetch") return true;
  if (headers.get("rsc")) return true; // RSC payload fetch (client-side route değişimi), ayrı bir HTML document değil
  return false;
}

// Bilinen exploit/scanner probe path'leri (bkz. TASK point 5) — bunlar
// BOGASTOCK uygulamasina ait degil, otomatik guvenlik taramalarindan gelir.
// Ham loglar SILINMEZ (proxy.ts hala normal sekilde kaydeder); bu fonksiyon
// SADECE dashboard'un funnel/source/visitor sayimlarindan hariç tutmak icin
// kullanilir (bkz. admin route).
export const SCANNER_PROBE_PATTERN_SOURCES = [
  "^/wp-admin",
  String.raw`^/wp-login\.php`,
  "^/wp-content",
  "^/wp-includes",
  String.raw`^/xmlrpc\.php`,
  String.raw`^/\.env`,
  String.raw`^/\.git`,
  "^/phpmyadmin",
  "^/administrator",
  "^/wordpress",
  String.raw`^/\.aws`,
  String.raw`^/config\.php`,
  "^/vendor/phpunit",
  "^/cgi-bin",
];

const SCANNER_PROBE_PATTERNS = SCANNER_PROBE_PATTERN_SOURCES.map((src) => new RegExp(src, "i"));

export function isScannerProbePath(pathname: string): boolean {
  return SCANNER_PROBE_PATTERNS.some((re) => re.test(pathname));
}

// Dashboard'un funnel/rapor sayimlarindan cikardigi TUM path desenleri, tek
// listede. NON_PAGE_PATHS'in dort uyesi (/robots.txt, /sitemap.xml,
// /manifest.json, /favicon.ico) zaten STATIC_ASSET_PATTERN_SOURCE'a takildigi
// icin ayrica listelenmez — NON_PAGE_PATHS'e uzantisiz bir path eklenirse
// buraya da eklenmelidir.
export const EXCLUDED_PATH_PATTERN_SOURCES = [STATIC_ASSET_PATTERN_SOURCE, ...SCANNER_PROBE_PATTERN_SOURCES];

// Ayni elemenin PostgREST sorgu-string karsiligi. count(*) sorgularinda
// (satirlari cekmeden) kullanilir — bkz. admin traffic-audit route.
export function excludedPathQueryFilter(column = "landing_pathname"): string {
  return EXCLUDED_PATH_PATTERN_SOURCES.map((src) => `&${column}=not.imatch.${encodeURIComponent(src)}`).join("");
}

// ── Timeframe ──────────────────────────────────────────────────────────────
export const TIMEFRAMES = ["24h", "7d", "30d", "all"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const TIMEFRAME_HOURS: Record<Timeframe, number | null> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30, all: null };

export function parseTimeframe(raw: string | null | undefined): Timeframe {
  return (TIMEFRAMES as readonly string[]).includes(raw ?? "") ? (raw as Timeframe) : "24h";
}

export function timeframeHours(tf: Timeframe): number | null {
  return TIMEFRAME_HOURS[tf];
}

// Zaman serisi kova boyutu: 24 saatlik rapor saatlik, digerleri gunluk kirilim.
export function timeframeBucketMs(tf: Timeframe): number {
  return tf === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

// ── Bot siniflandirmasi (SADECE dashboard raporlamasi icin) ────────────────
// DIKKAT: botUserAgents.ts'teki ALLOWED_CRAWLER_USER_AGENTS listesi robots.ts
// izin listesini ve proxy.ts'in olcumlu giris kapisini besler — oraya bir UA
// eklemek o crawler'in site davranisini degistirir. Bu liste ise SADECE
// "gelen trafigin ne kadari bot" raporunu uretir, hicbir erisim karari vermez;
// bu yuzden ayri ve cok daha genis tutulur.
const REPORTING_BOT_UA_PATTERN =
  /(bot|crawler|spider|crawl|slurp|scrap(er|y)|feedfetcher|archiver|archive\.org|monitor|uptime|preview|headless|phantomjs|selenium|playwright|puppeteer|python|curl\/|wget|java\/|go-http|okhttp|axios|node-fetch|aiohttp|httpx|libwww|lynx|zgrab|masscan|nmap|censys|expanse|internet-measurement|facebookexternalhit|whatsapp|telegram|discord|slackbot|embedly|semrush|ahrefs|mj12|dotbot|dataprovider|netcraft)/i;

// Bozuk "(HTML, like Gecko" imzasi: gercek tarayicilar HER ZAMAN
// "(KHTML, like Gecko" gonderir — bu tipo, UA'sini elle uyduran tarayici
// taklidi istemcilerin guvenilir bir isaretidir.
const MALFORMED_GECKO_TOKEN = /\(HTML, like Gecko/i;

export function isLikelyBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === "" || userAgent === "Unknown") return true;
  return REPORTING_BOT_UA_PATTERN.test(userAgent) || MALFORMED_GECKO_TOKEN.test(userAgent);
}

export type TrafficAudience = "bot" | "verified_human" | "unverified";

// Bir session'in kitle sinifi:
//  - bot           → User-Agent kendini bot olarak tanitiyor (veya bos/bozuk)
//  - verified_human→ tarayicida JS calisti (page_loaded beacon'i geldi)
//  - unverified    → UA insan gorunuyor ama JS hic calismadi (headless scraper
//                    ya da sayfa acilmadan terk edilmis istek). "Insan" olarak
//                    SAYILMAZ, ayri raporlanir.
export function sessionAudience(
  s: Pick<TrafficSession, "suspected_bot_ua" | "user_agent" | "page_loaded">
): TrafficAudience {
  // Bot kontrolu ONCE gelir: Googlebot/Bingbot gibi renderlayan crawler'lar
  // page_loaded beacon'ini da gonderebilir — bunlari "dogrulanmis insan"
  // saymak insan trafigi rakamini sisirir.
  if (s.suspected_bot_ua || isLikelyBotUserAgent(s.user_agent)) return "bot";
  if (s.page_loaded) return "verified_human";
  return "unverified";
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

// ── Diagnostic signals (bkz. TASK point 4) ─────────────────────────────────
// Tek bir zayif sinyal (orn. sadece "5sn'de active event gelmedi") artik
// otomatik "suspected_automation" ETIKETLEMEZ — sinyaller ayri ayri raporlanir,
// suspected_automation SADECE 2+ BAGIMSIZ guclu sinyal ayni anda varsa true olur.
export const DIAGNOSTIC_AGE_GATE_MS = 5 * 60 * 1000; // sinyal icin en az 5dk gecmis olmali (hala yukleniyor olabilir)
// "Abnormal navigation rate": landing_request SADECE gercek document
// navigasyonlarinda olusur (proxy.ts artik prefetch/RSC isteklerini
// isPrefetchOrDataRequest() ile eliyor) — analytics/telemetry POST'lari zaten
// /api/* altinda oldugu icin proxy'den hic gecmiyor, bu sayima hic girmiyor.
export const ABNORMAL_NAVIGATION_RATE_THRESHOLD = 15;

export type DiagnosticSignal = "request_only" | "loaded_no_engagement" | "known_bot" | "scanner_probe" | "abnormal_navigation_rate";

export function diagnosticSignals(
  s: Pick<TrafficSession, "suspected_bot_ua" | "page_loaded" | "active_5s" | "first_seen" | "landing_pathname">,
  navigationRequestCount = 0
): DiagnosticSignal[] {
  const signals: DiagnosticSignal[] = [];
  const ageMs = Date.now() - s.first_seen;
  if (s.suspected_bot_ua) signals.push("known_bot");
  if (isScannerProbePath(s.landing_pathname)) signals.push("scanner_probe");
  if (!s.page_loaded && ageMs > DIAGNOSTIC_AGE_GATE_MS) signals.push("request_only");
  else if (s.page_loaded && !s.active_5s && ageMs > DIAGNOSTIC_AGE_GATE_MS) signals.push("loaded_no_engagement");
  if (navigationRequestCount > ABNORMAL_NAVIGATION_RATE_THRESHOLD) signals.push("abnormal_navigation_rate");
  return signals;
}

export function isSuspectedAutomation(signals: DiagnosticSignal[]): boolean {
  return signals.length >= 2;
}
