import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

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
    myWatchlist: "İZLEME LİSTEM"
  },
  en: {
    swing: "TREND",
    watchlist: "TREND CANDIDATES",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MY WATCHLIST"
  },
  es: {
    swing: "TENDENCIA",
    watchlist: "CANDIDATOS",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MI LISTA"
  },
  fr: {
    swing: "TENDANCE",
    watchlist: "CANDIDATS",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MA LISTE"
  },
  pt: {
    swing: "TENDÊNCIA",
    watchlist: "CANDIDATOS",
    top7: "TOP 7",
    top100: "TOP 100",
    myWatchlist: "MINHA LISTA"
  }
};

export default function ListsNavigation({ locale, activePath }: Props) {
  const t = translations[locale] || translations.en;
  
  const links = [
    { id: "swing", label: t.swing, href: `/global/${locale}/swing` },
    { id: "watchlist", label: t.watchlist, href: `/global/${locale}/watchlist` },
    { id: "top7", label: t.top7, href: `/global/${locale}/top7` },
    { id: "top100", label: t.top100, href: `/global/${locale}/top100` },
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
            className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors whitespace-nowrap ${
              isActive
                ? "border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]"
                : "border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
