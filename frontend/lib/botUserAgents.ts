/**
 * Tanınan arama/AI crawler User-Agent alt dizeleri — hem app/robots.ts'in
 * izin listesini hem de proxy.ts'in Faz 4 ölçümlü giriş kapısının bot
 * muafiyetini besler. Tek kaynak: ikisi ayrı ayrı güncellenirse (örn. yeni
 * bir crawler eklenince) birbirinden sapma riski olurdu (bkz. Faz 4 plan
 * notu — "iki liste birbirinden sapmasın").
 *
 * Not: User-Agent istemci tarafından serbestçe taklit edilebilir — bu
 * kontrol veri gizliliği için değil (o zaten sunucu tarafında ayrıca
 * korunuyor, bkz. Faz 0B), sadece "gerçek bir crawler'ı SEO/AI-atıf
 * amacıyla asla ölçme" niyeti için. Biri User-Agent'ı taklit ederek
 * ölçümlü kapıyı atlarsa bu düşük riskli bir sızıntı (dönüşüm hunisi
 * bypass), veri sızıntısı değil.
 */
export const ALLOWED_CRAWLER_USER_AGENTS = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "ClaudeBot",
  "Claude-Web", // eski/deprecated ama zararsız — bazı araçlar hâlâ bunu gönderebilir
  "CCBot",
  "PerplexityBot",
] as const;

export function isKnownCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return ALLOWED_CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot.toLowerCase()));
}
