/**
 * Yalnızca yönetim hesaplarına (boga_auth: admin / readonly / engine) açık herkese-açık sayfalar.
 * 2026-10-12 kullanıcı talebi: Terminal, Top 7, Top 100, Yükselenler, Düşenler, Trend (swing + arşiv),
 * Temalar, Performans (+ Swing Performansı), Günün Trend Hisseleri (dailyone) ve Eğitim Rehberi artık ziyaretçilere kapalı; menü/bağlantıları da gizlenir.
 * Sayfalar yerinde kalır — yalnız erişim daralır. Hesaplar: 2 admin + engine rolündeki afk2351@outlook.com.
 *
 * Tek kaynak: proxy.ts (sunucu tarafı kilit) ve hooks/useIsStaff.ts (istemci tarafı gizleme) bunu kullanır.
 */

export const STAFF_ROLES = ["admin", "readonly", "engine"] as const;

export const isStaffRole = (role: string | null | undefined): boolean =>
  !!role && (STAFF_ROLES as readonly string[]).includes(role);

/** /global/{locale}/ altındaki yönetim-yalnız ilk yol parçaları (alt yolları dahil) */
export const STAFF_ONLY_SEGMENTS = [
  "top7", "top100", "gainers", "losers",
  "swing",        // + /swing/arsiv, /swing/archive
  "themes",       // + /themes/{slug}
  "performance",
  "swingperformance",
  "dailyone",     // Günün Trend Hisseleri detay sayfası
  "terminal",
  "egitim",
] as const;

/** `/global/{locale}/{segment}[/...]` yönetim-yalnız mı? */
export function isStaffOnlyPath(pathname: string): boolean {
  const m = pathname.match(/^\/global\/[a-z]{2}\/([^/]+)/);
  return !!m && (STAFF_ONLY_SEGMENTS as readonly string[]).includes(m[1]);
}

/** Bağlantı hedefi yönetim-yalnız mı (href, query/hash kırpılır) */
export function isStaffOnlyHref(href: string): boolean {
  return isStaffOnlyPath(href.split(/[?#]/)[0]);
}

/**
 * "engine" rolünün (afk2351@outlook.com) açabildiği yönetim sayfaları: SPY/QQQ/IWM/NVDA/AAPL/TSLA/AMZN Engine, site menüsü (Piyasalar),
 * Pro paneli ve Pro'dan bağlanan detay sayfaları. Diğer tüm /admin/** motor ekranına yönlendirilir (proxy.ts).
 * Not: engine rolü isStaffAuthed'e girmez — bu sayfaların yazma API'leri ona kapalı kalır, yalnız görüntüleme açılır.
 */
export const ENGINE_ADMIN_PREFIXES = [
  "/admin/spyengine", "/admin/qqqengine",
  "/admin/iwmengine", "/admin/nvdaengine", "/admin/aaplengine", "/admin/tslaengine", "/admin/amznengine",
  "/admin/piyasalar",
  "/admin/pro",
  "/admin/ai",
  "/admin/analytics/screener", "/admin/analytics/performance",
  "/admin/trading/options", "/admin/trading/csp", "/admin/trading/swing",
] as const;

export function isEngineAdminPath(pathname: string): boolean {
  return ENGINE_ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
