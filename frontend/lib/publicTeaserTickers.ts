/**
 * Anonim/free ziyaretçiye kilitli listelerde (Top100, Trend Hisseleri, Trend
 * Adayı, Tema sayfaları) her zaman gerçek göründürülen, sabit "vitrin"
 * ticker'lar. Pozisyona (idx>0) göre kilitleme, client tarafında serbestçe
 * yeniden sıralanabilen tablolarda hangi satırın "0. sıra" olduğu sürekli
 * değiştiği için sunucu tarafındaki maskeleme ile uyuşmuyordu — bunun yerine
 * ticker kimliğine göre sabit bir kural kullanılıyor. TickerDetailPanel.tsx'in
 * önceden var olan "NVDA her zaman açık" davranışıyla aynı liste.
 */
export const PUBLIC_TEASER_TICKERS: readonly string[] = ["NVDA"];

export function isPublicTeaserTicker(ticker: string | null | undefined): boolean {
  if (!ticker) return false;
  return PUBLIC_TEASER_TICKERS.includes(ticker.toUpperCase());
}

/**
 * Top100 ticker-kimliği maskeleme kuralının tek kaynağı (bkz.
 * docs/AI_BEHAVIOR.md Rule 3 — bir liste yüzeyinin tam olarak bir ticker
 * kaynağı olmalı). Anonim ziyaretçi sadece PUBLIC_TEASER_TICKERS'ı gerçek
 * görür, free/premium/admin (herhangi bir giriş yapmış üye) tam listeyi
 * görür — bu Trend Hisseleri'nin premium-only kuralından (pickMasking.ts)
 * FARKLI: burada "free" zaten unlockAll sayılır. Ticker kimliğine göre
 * kilitlenir (idx'e göre değil), çünkü client tabloyu serbestçe yeniden
 * sıralayabiliyor.
 */
export function maskTop100Ticker<T extends { ticker: string; company?: string | null }>(
  row: T,
  idx: number,
  tier: "anonymous" | "free" | "premium" | "admin"
): T {
  const isUnlocked =
    tier === "premium" ||
    tier === "admin" ||
    (tier === "free" && idx < 20) ||
    (tier === "anonymous" && (idx < 10 || isPublicTeaserTicker(row.ticker)));

  if (isUnlocked) return row;
  return { ...row, ticker: `LOCKED-${idx}`, company: null };
}
