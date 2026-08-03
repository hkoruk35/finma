export type ThemesBannerLocale = "tr" | "en" | "es" | "fr" | "pt";

/**
 * ThemesBanner.tsx'in metinleri — server component'lerin (home/page.tsx)
 * de kullanabilmesi için "use client" işaretli bir dosyadan DEĞİL, düz bir
 * lib dosyasından import edilir. Bir client component'in export ettiği bir
 * sabiti server component'e import etmek Turbopack'te prod build'de
 * ".browseAll" undefined hatasına yol açtı (dev'de/tsc'de görünmüyordu) —
 * bkz. Vercel build hatası 2026-08-02.
 */
export const THEMES_BANNER_LABELS: Record<ThemesBannerLocale, { title: string; browseAll: string; more: string }> = {
  tr: { title: "Tematik Analiz", browseAll: "Tüm Temaları Gözat", more: "daha" },
  en: { title: "Thematic Analysis", browseAll: "Browse All Themes", more: "more" },
  es: { title: "Análisis Temático", browseAll: "Explorar Todos los Temas", more: "más" },
  fr: { title: "Analyse Thématique", browseAll: "Explorer Tous les Thèmes", more: "de plus" },
  pt: { title: "Análise Temática", browseAll: "Explorar Todos os Temas", more: "mais" },
};
