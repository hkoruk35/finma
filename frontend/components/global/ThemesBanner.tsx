"use client";

import Link from "next/link";
import { HOT_THEMES_2026, localizedThemeTitle } from "@/lib/hotThemes2026";

type Locale = "tr" | "en" | "es" | "fr" | "pt";

const LABELS: Record<Locale, { title: string; subtitle: string; browseAll: string }> = {
  tr: { title: "Tematik Analiz", subtitle: "Gelecek fırsat alanlarına odaklanın", browseAll: "Tüm Temaları Gözat" },
  en: { title: "Thematic Analysis", subtitle: "Focus on emerging opportunity areas", browseAll: "Browse All Themes" },
  es: { title: "Análisis Temático", subtitle: "Enfóquese en áreas de oportunidades emergentes", browseAll: "Explorar Todos los Temas" },
  fr: { title: "Analyse Thématique", subtitle: "Concentrez-vous sur les domaines d'opportunités émergentes", browseAll: "Explorer Tous les Thèmes" },
  pt: { title: "Análise Temática", subtitle: "Concentre-se em áreas de oportunidades emergentes", browseAll: "Explorar Todos os Temas" },
};

export default function ThemesBanner({ locale }: { locale: Locale }) {
  const label = LABELS[locale];
  const displayThemes = HOT_THEMES_2026.slice(0, 6); // Show first 6 themes

  return (
    <div className="mb-8 mt-6 rounded-lg border border-[#30363d] bg-gradient-to-r from-[#161b22] to-[#0d1117] p-6 md:p-8 overflow-hidden relative">
      {/* Animated background accent */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{label.title}</h2>
          <p className="text-slate-400 text-sm">{label.subtitle}</p>
        </div>

        {/* Theme Pills */}
        <div className="flex flex-wrap gap-2 md:gap-3 mb-6">
          {displayThemes.map((theme) => {
            const themeTitle = localizedThemeTitle(theme.title, locale);
            return (
              <Link
                key={theme.slug}
                href={`/global/${locale}/themes/${theme.slug}`}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-[#30363d] text-white hover:bg-[#58a6ff] hover:text-[#0d1117] transition-all duration-200 whitespace-nowrap"
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
              className="px-4 py-2 rounded-full text-sm font-semibold bg-[#30363d] text-slate-400 hover:bg-[#58a6ff] hover:text-[#0d1117] transition-all duration-200 whitespace-nowrap"
            >
              +{HOT_THEMES_2026.length - 6} {locale === "tr" ? "daha" : "more"}
            </Link>
          )}
        </div>

        {/* Browse all button */}
        <Link
          href={`/global/${locale}/themes/${HOT_THEMES_2026[0].slug}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#58a6ff] text-[#0d1117] font-bold text-sm rounded hover:bg-[#79c0ff] transition-colors"
        >
          {label.browseAll}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
