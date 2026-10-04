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
export const MY_WATCHLIST_DISABLED = MEMBERSHIP_DISABLED
