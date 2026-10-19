/**
 * GEÇİCİ KAPATMA ANAHTARI (2026-10-04): üyelik sistemi, Boga Copilot ve
 * "My Watchlist" uygulaması pasif; admin hariç tüm sayfalar herkese açık.
 *
 * Geri almak için: MEMBERSHIP_DISABLED = false. Hem sunucu (lib/apiAuth.ts)
 * hem istemci (hooks/useMemberPlan.ts, header/menü/Copilot/watchlist
 * bileşenleri) bu tek bayrağı okur. Admin (boga_auth) akışına dokunmaz.
 */
export const MEMBERSHIP_DISABLED = true
export const COPILOT_DISABLED = MEMBERSHIP_DISABLED
/**
 * 2026-10-15 (kullanıcı talebi): Boga Copilot yalnız admin hesaplarına (boga_auth: admin / readonly) açık —
 * SPY odaklı, esprili anlatım. Ziyaretçi/üye için kapalı kalır. Sunucu: copilot/chat + usage route'ları
 * boga_auth rolüyle kapı tutar; istemci: CopilotShell /api/auth/me rolüne bakar.
 */
export const COPILOT_ADMIN_ONLY = true
/**
 * 2026-10-19 (kullanıcı talebi, GEÇİCİ): Boga Copilot admin hesapları dahil herkese kapalı — üzerinde çalışılıyor.
 * Düğme/çekmece hiç gösterilmez, copilot/chat + usage 503 döner. Geri açmak için: COPILOT_PAUSED = false.
 */
export const COPILOT_PAUSED = true
export const MY_WATCHLIST_DISABLED = MEMBERSHIP_DISABLED
