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
