// Semantic Route Registry — BOGA Copilot Üye Operasyon Mimarisi böl. 11.
// LLM asla ham URL üretmez; sadece bu registry'deki route_key'leri kullanır.
// Her locale kendi slug'ını kullanır (TR/PT diğerlerinden farklı) — bu yüzden
// URL'yi asla elle birleştirmeyin, her zaman buildRoute() üzerinden geçirin.

import type { CopilotLocale } from "@/lib/copilot/i18n";

export type RouteKey =
  | "dashboard"
  | "trend_list" // Trend Listesi (swing picks)
  | "trend_candidate_watchlist" // Trend Adayı İzleme Listesi
  | "top7"
  | "top100"
  | "my_watchlist" // Kişisel İzleme Listesi
  | "graphic" // {ticker} parametresi gerekir
  | "themes" // {themeSlug} parametresi gerekir — HOT_THEMES_2026 tema sayfaları
  | "faq"
  | "news"
  | "account";

const SLUGS: Record<RouteKey, Record<CopilotLocale, string>> = {
  dashboard: { tr: "home", en: "home", es: "home", fr: "home", pt: "home" },
  trend_list: { tr: "swing", en: "swing", es: "swing", fr: "swing", pt: "swing" },
  trend_candidate_watchlist: { tr: "watchlist", en: "watchlist", es: "watchlist", fr: "watchlist", pt: "watchlist" },
  top7: { tr: "top7", en: "top7", es: "top7", fr: "top7", pt: "top7" },
  top100: { tr: "top100", en: "top100", es: "top100", fr: "top100", pt: "top100" },
  my_watchlist: { tr: "my-watchlist", en: "my-watchlist", es: "my-watchlist", fr: "my-watchlist", pt: "my-watchlist" },
  graphic: { tr: "graphic", en: "graphic", es: "graphic", fr: "graphic", pt: "graphic" },
  themes: { tr: "themes", en: "themes", es: "themes", fr: "themes", pt: "themes" },
  faq: { tr: "sss", en: "faq", es: "faq", fr: "faq", pt: "Perguntas_Frequentes" },
  news: { tr: "news", en: "news", es: "news", fr: "news", pt: "news" },
  account: { tr: "hesabim", en: "account", es: "account", fr: "account", pt: "account" },
};

/** route_key (+opsiyonel ticker/themeSlug) -> gerçek, locale'e göre doğru site içi yol. */
export function buildRoute(key: RouteKey, locale: string, ticker?: string): string {
  const loc = (["tr", "en", "es", "fr", "pt"].includes(locale) ? locale : "en") as CopilotLocale;
  const slug = SLUGS[key]?.[loc] ?? SLUGS[key]?.en ?? key;
  const base = `/global/${loc}/${slug}`;
  if (key === "graphic" && ticker) return `${base}/${ticker.trim().toUpperCase()}`;
  // Tema slug'ları (hotThemes2026.ts) küçük harf/tireli — ticker'ın aksine BÜYÜTÜLMEZ.
  if (key === "themes" && ticker) return `${base}/${ticker.trim()}`;
  return base;
}

/** Bir pathname'i (örn. "/global/tr/top7") route_key'e çözer — Page Context Service için. */
export function resolveRouteKey(pathname: string): { key: RouteKey | "unknown"; ticker: string | null; themeSlug?: string | null } {
  const parts = pathname.split("/").filter(Boolean); // ["global","tr","top7", ...]
  if (parts[0] !== "global" || !parts[1]) return { key: "unknown", ticker: null };
  const locale = parts[1];
  const rest = parts.slice(2);
  if (rest.length === 0) return { key: "dashboard", ticker: null };

  const seg = rest[0];
  for (const key of Object.keys(SLUGS) as RouteKey[]) {
    const localeSlug = SLUGS[key][(["tr", "en", "es", "fr", "pt"].includes(locale) ? locale : "en") as CopilotLocale];
    if (seg === localeSlug || seg.toLowerCase() === localeSlug.toLowerCase()) {
      if (key === "graphic") return { key, ticker: rest[1] ? rest[1].toUpperCase() : null };
      // Tema slug'ı küçük harf/tireli (getHotTheme tam eşleşme arar) — BÜYÜTÜLMEZ.
      if (key === "themes") return { key, ticker: null, themeSlug: rest[1] ? rest[1].trim() : null };
      return { key, ticker: null };
    }
  }
  return { key: "unknown", ticker: null };
}

/** Beş liste ile route_key eşlemesi (spec böl. 4). */
export const LIST_KEY_TO_ROUTE: Record<
  "personal_watchlist" | "trend_list" | "trend_candidate_watchlist" | "top7" | "top100",
  RouteKey
> = {
  personal_watchlist: "my_watchlist",
  trend_list: "trend_list",
  trend_candidate_watchlist: "trend_candidate_watchlist",
  top7: "top7",
  top100: "top100",
};
