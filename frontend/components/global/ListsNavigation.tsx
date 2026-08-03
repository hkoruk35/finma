import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

interface Props {
  locale: Locale;
  activePath: string; // e.g. "swing", "watchlist", "top7", "top100", "my-watchlist"
  /** Optional extra control appended to the same scrollable pill row (e.g. home page's "Browse All Themes"). */
  trailingAction?: React.ReactNode;
}

const translations: Record<string, Record<string, string>> = {
  tr: {
    top7: "TOP 7",
    top100: "TOP 100",
    gainers: "ARTANLAR",
    losers: "DÜŞENLER",
    mostActive: "İŞLEM GÖRENLER",
    swing: "TREND HİSSELERİ",
    themes: "TEMA LİSTESİ",
    myWatchlist: "İZLEME LİSTEM"
  },
  en: {
    top7: "TOP 7",
    top100: "TOP 100",
    gainers: "GAINERS",
    losers: "LOSERS",
    mostActive: "MOST ACTIVE",
    swing: "TRENDING STOCKS",
    themes: "THEME LIST",
    myWatchlist: "MY WATCHLIST"
  },
  es: {
    top7: "TOP 7",
    top100: "TOP 100",
    gainers: "ALZAS",
    losers: "BAJAS",
    mostActive: "MÁS ACTIVAS",
    swing: "EN TENDENCIA",
    themes: "LISTA DE TEMAS",
    myWatchlist: "MI LISTA"
  },
  fr: {
    top7: "TOP 7",
    top100: "TOP 100",
    gainers: "HAUSSES",
    losers: "BAISSES",
    mostActive: "PLUS ÉCHANGÉES",
    swing: "ACTIONS TENDANCE",
    themes: "LISTE DE THÈMES",
    myWatchlist: "MA LISTE"
  },
  pt: {
    top7: "TOP 7",
    top100: "TOP 100",
    gainers: "ALTAS",
    losers: "BAIXAS",
    mostActive: "MAIS ATIVAS",
    swing: "AÇÕES EM TENDÊNCIA",
    themes: "LISTA DE TEMAS",
    myWatchlist: "MINHA LISTA"
  }
};

export default function ListsNavigation({ locale, activePath, trailingAction }: Props) {
  const t = translations[locale] || translations.en;

  const links = [
    { id: "top7", label: t.top7, href: `/global/${locale}/top7` },
    { id: "top100", label: t.top100, href: `/global/${locale}/top100` },
    { id: "gainers", label: t.gainers, href: `/global/${locale}/gainers` },
    { id: "losers", label: t.losers, href: `/global/${locale}/losers` },
    { id: "mostactive", label: t.mostActive, href: `/global/${locale}/mostactive` },
    { id: "swing", label: t.swing, href: `/global/${locale}/swing` },
    { id: "themes", label: t.themes, href: `/global/${locale}/themes/${HOT_THEMES_2026[0].slug}` },
    { id: "my-watchlist", label: t.myWatchlist, href: `/global/${locale}/my-watchlist` }
  ];

  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
      {links.map(link => {
        const isActive = activePath === link.id;
        return (
          <Link
            key={link.id}
            href={link.href}
            className={`text-[10px] font-semibold px-3 py-1.5 rounded border transition-colors whitespace-nowrap !text-[#38bdf8] ${
              isActive
                ? "border-[#38bdf8] bg-[#38bdf8]/15 shadow-sm shadow-[#38bdf8]/20"
                : "border-[#1e2a3a] bg-[#0f1117] hover:border-[#38bdf8]/50 hover:bg-[#38bdf8]/5"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      {trailingAction}
    </div>
  );
}
