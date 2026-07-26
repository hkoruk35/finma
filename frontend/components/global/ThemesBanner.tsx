"use client";

import Link from "next/link";
import { HOT_THEMES_2026, localizedThemeTitle } from "@/lib/hotThemes2026";

type Locale = "tr" | "en" | "es" | "fr" | "pt";

const LABELS: Record<Locale, { title: string; browseAll: string }> = {
  tr: { title: "Tematik Analiz", browseAll: "Tüm Temaları Gözat" },
  en: { title: "Thematic Analysis", browseAll: "Browse All Themes" },
  es: { title: "Análisis Temático", browseAll: "Explorar Todos los Temas" },
  fr: { title: "Analyse Thématique", browseAll: "Explorer Tous les Thèmes" },
  pt: { title: "Análise Temática", browseAll: "Explorar Todos os Temas" },
};

export default function ThemesBanner({ locale }: { locale: Locale }) {
  const label = LABELS[locale];
  const displayThemes = HOT_THEMES_2026.slice(0, 6); // Show first 6 themes

  return (
    <div className="mb-4 mt-4 rounded-lg border border-[#30363d] bg-gradient-to-r from-[#161b22] to-[#0d1117] p-3 md:p-4 overflow-hidden relative">
      {/* Animated background accent */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <h2 className="text-lg md:text-xl font-bold text-white mb-2">{label.title}</h2>

        {/* Theme Pills */}
        <div className="flex flex-wrap gap-2 md:gap-3 mb-3">
          {displayThemes.map((theme) => {
            const themeTitle = localizedThemeTitle(theme.title, locale);
            return (
              <Link
                key={theme.slug}
                href={`/global/${locale}/themes/${theme.slug}`}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#30363d] text-white hover:bg-[#58a6ff] hover:text-[#0d1117] transition-all duration-200 whitespace-nowrap"
                style={{
                  borderLeft: `3px solid ${theme.accent}`,
                }}
              >
                {themeTitle}
              </Link>
            );
          })}

          {HOT_THEMES_2026.length > 6 && (
            <Link
              href={`/global/${locale}/themes/${HOT_THEMES_2026[0].slug}`}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#30363d] text-slate-400 hover:bg-[#58a6ff] hover:text-[#0d1117] transition-all duration-200 whitespace-nowrap"
            >
              +{HOT_THEMES_2026.length - 6} {locale === "tr" ? "daha" : "more"}
            </Link>
          )}
        </div>

        {/* Browse all button */}
        <Link
          href={`/global/${locale}/themes/${HOT_THEMES_2026[0].slug}`}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#58a6ff] text-[#0d1117] font-bold text-xs rounded hover:bg-[#79c0ff] transition-colors"
        >
          {label.browseAll}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
