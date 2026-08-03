"use client";

import Link from "next/link";
import { HOT_THEMES_2026, themeShortName } from "@/lib/hotThemes2026";

type Locale = "tr" | "en" | "es" | "fr" | "pt";

export const THEMES_BANNER_LABELS: Record<Locale, { title: string; browseAll: string; more: string }> = {
  tr: { title: "Tematik Analiz", browseAll: "Tüm Temaları Gözat", more: "daha" },
  en: { title: "Thematic Analysis", browseAll: "Browse All Themes", more: "more" },
  es: { title: "Análisis Temático", browseAll: "Explorar Todos los Temas", more: "más" },
  fr: { title: "Analyse Thématique", browseAll: "Explorer Tous les Thèmes", more: "de plus" },
  pt: { title: "Análise Temática", browseAll: "Explorar Todos os Temas", more: "mais" },
};

// PC'de daha fazla, mobilde daha az tema adı sığdırılıp geri kalanı
// "+N daha" ile özetlenir — tek satırda kalması için.
const DESKTOP_VISIBLE_COUNT = 6;
const MOBILE_VISIBLE_COUNT = 2;

export default function ThemesBanner({ locale, showBrowseAll = true }: { locale: Locale; showBrowseAll?: boolean }) {
  const label = THEMES_BANNER_LABELS[locale];
  const firstThemeHref = `/global/${locale}/themes/${HOT_THEMES_2026[0].slug}`;

  const renderThemeList = (visibleCount: number, extraClassName: string) => {
    const visible = HOT_THEMES_2026.slice(0, visibleCount);
    const remaining = HOT_THEMES_2026.length - visibleCount;
    return (
      <div className={`items-center gap-1.5 text-xs shrink-0 ${extraClassName}`}>
        {visible.map((theme, i) => (
          <span key={theme.slug} className="whitespace-nowrap">
            <Link href={`/global/${locale}/themes/${theme.slug}`} className="text-slate-300 hover:text-[#58a6ff] transition-colors">
              {themeShortName(theme.slug, locale)}
            </Link>
            {i < visible.length - 1 && <span className="text-slate-600">,</span>}
          </span>
        ))}
        {remaining > 0 && (
          <Link href={firstThemeHref} className="whitespace-nowrap text-slate-500 hover:text-[#58a6ff] transition-colors">
            +{remaining} {label.more}
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="mb-4 mt-4 rounded-lg border border-[#30363d] bg-gradient-to-r from-[#161b22] to-[#0d1117] py-2.5 px-3 md:px-4 overflow-hidden relative">
      {/* Animated background accent */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center gap-2.5 md:gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <h2 className="shrink-0 text-sm md:text-base font-medium text-white whitespace-nowrap">{label.title}</h2>

        {renderThemeList(MOBILE_VISIBLE_COUNT, "flex sm:hidden")}
        {renderThemeList(DESKTOP_VISIBLE_COUNT, "hidden sm:flex")}

        {showBrowseAll && (
          <Link
            href={firstThemeHref}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 bg-[#0f1117] border border-[#58a6ff] text-[#58a6ff] font-medium text-xs rounded hover:bg-[#58a6ff]/10 transition-colors whitespace-nowrap"
          >
            {label.browseAll}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
