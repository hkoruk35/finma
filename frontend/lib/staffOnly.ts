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
