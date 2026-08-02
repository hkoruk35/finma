import type { MemberTier } from "@/lib/apiAuth";
import { isPublicTeaserTicker } from "@/lib/publicTeaserTickers";

/**
 * Trend Hisseleri / Trend Adayı / performans geçmişi gibi "liste" yüzeylerinin
 * ortak sunucu-taraflı maskeleme kuralı: anonim VE free'de ticker kimliği
 * kapalı (sabit vitrin ticker'ları hariç), sadece premium/admin tam görür.
 * Bkz. Faz 0B — bu kural önceden sadece client'ta uygulanıyordu, bu yüzden
 * hem API route'ları hem server component'ler (SSR/RSC payload'a çıplak veri
 * koymamak için) aynı fonksiyonu çağırmalı.
 *
 * Not: girdi/çıktı türleri kasıtlı olarak `any` — swing_all_picks.json /
 * watchlist_picks.json / swing_performance.json bu kod tabanında hiçbir yerde
 * (lib/data.ts dahil) katı tiplenmemiş, ham Python bot çıktısı JSON'ları.
 */
export function isTrendPickTierUnlocked(tier: MemberTier): boolean {
  return tier === "premium" || tier === "admin";
}

/** swing_all_picks.json / watchlist_picks.json pick'lerindeki gömülü işlem planı alanları. */
export function stripTradePlanFields(pick: any): any {
  return {
    ...pick,
    tracker_logic: null,
    buy_zone: null,
    profit_zone: null,
    stop_zone: null,
    boga_zones: null,
    entry_zone: null,
    trigger_detail: null,
  };
}

/**
 * Bir pick dizisini (swing_all_picks.json / watchlist_picks.json şekli) tier'a
 * göre maskeler: unlockAll ise dokunmaz; değilse her pick için işlem planı
 * alanlarını sıfırlar ve (vitrin ticker'ları hariç) ticker/company kimliğini
 * sahte bir yer tutucuyla değiştirir.
 */
export function maskTrendPicks(
  picks: any[],
  tier: MemberTier,
  opts: { stripTradePlan?: boolean } = {}
): any[] {
  if (isTrendPickTierUnlocked(tier)) return picks;
  const stripTradePlan = opts.stripTradePlan ?? true;
  return picks.map((p, idx) => {
    const teaser = isPublicTeaserTicker(p?.ticker);
    const base = stripTradePlan ? stripTradePlanFields(p) : p;
    if (teaser) return base;
    return { ...base, ticker: `LOCKED-${idx}`, company: null };
  });
}

/**
 * Performans geçmişi (SwingPerformanceDashboard initialHistory) için sunucu
 * taraflı satır maskeleme — server component'ten client'a geçen prop, Next.js
 * RSC payload'ına gömülür; client-only maskeleme (eski davranış) bu payload'ı
 * korumuyordu (view-source ile "kilitli" ticker'lar okunabiliyordu). Konum
 * eşiği (idx < N) daha önce sadece client'taki `!isPremium` ile uygulanan
 * mantıkla aynı — burada katmana göre parametrize edildi (free daha az
 * maskeli, premium hiç maskeli değil).
 */
export function maskPerformanceHistory(
  history: any[],
  tier: MemberTier,
  opts: { anonymousMaskCount: number; freeMaskCount: number }
): any[] {
  if (isTrendPickTierUnlocked(tier)) return history;
  const maskCount = tier === "free" ? opts.freeMaskCount : opts.anonymousMaskCount;
  return history.map((t, idx) => (idx < maskCount ? { ...t, ticker: "", company: "" } : t));
}
