import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

interface Props {
  locale: Locale;
  activePath: string; // e.g. "swing", "watchlist", "top7", "top100", "my-watchlist"
}

const translations: Record<string, Record<string, string>> = {
  tr: {
    swing: "TREND",
    watchlist: "TREND ADAYLARI",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "İZLEME LİSTEM",
    themes: "TEMA"
  },
  en: {
    swing: "TREND",
    watchlist: "TREND CANDIDATES",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MY WATCHLIST",
    themes: "THEMES"
  },
  es: {
    swing: "TENDENCIA",
    watchlist: "CANDIDATOS",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MI LISTA",
    themes: "TEMAS"
  },
  fr: {
    swing: "TENDANCE",
    watchlist: "CANDIDATS",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MA LISTE",
    themes: "THÈMES"
  },
  pt: {
    swing: "TENDÊNCIA",
    watchlist: "CANDIDATOS",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MINHA LISTA",
    themes: "TEMAS"
  }
};

export default function ListsNavigation({ locale, activePath }: Props) {
  const t = translations[locale] || translations.en;

  const links = [
    { id: "swing", label: t.swing, href: `/global/${locale}/swing` },
    { id: "watchlist", label: t.watchlist, href: `/global/${locale}/watchlist` },
    { id: "top7", label: t.top7, href: `/global/${locale}/top7` },
    { id: "top100", label: t.top100, href: `/global/${locale}/top100` },
    { id: "my-watchlist", label: t.myWatchlist, href: `/global/${locale}/my-watchlist` },
    { id: "themes", label: t.themes, href: `/global/${locale}/themes/${HOT_THEMES_2026[0].slug}` }
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
    </div>
  );
}
