"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Locale = "tr" | "en" | "es" | "fr" | "pt";

const HOME_LABEL: Record<Locale, string> = {
  tr: "Anasayfa", en: "Home", es: "Inicio", fr: "Accueil", pt: "Início",
};

export default function GlobalBottomNav() {
  const pathname = usePathname();

  // Detect locale from pathname (/global/{locale}/...) — supports all 5 locales
  const segment = pathname.split("/")[2];
  const locale: Locale = (["tr", "en", "es", "fr", "pt"] as const).includes(segment as Locale)
    ? (segment as Locale)
    : "en";

  const navItems = [
    { label: HOME_LABEL[locale], href: `/global/${locale}/home` },
    { label: "Swing", href: `/global/${locale}/swing` },
    { label: "Watchlist", href: `/global/${locale}/watchlist` },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden bg-[#0d1117]/97 backdrop-blur-xl border-t border-[#1e2a3a] px-2 pt-2 pb-safe">
      <div className="flex items-stretch justify-between max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl flex-1 transition-all ${isActive ? 'text-[#3b82f6] bg-[#3b82f6]/5' : 'text-[#00d2ff] hover:text-white'}`}
            >
              <span className="text-[11px] font-bold uppercase tracking-tight">{item.label}</span>
              {isActive && <div className="w-5 h-0.5 rounded-full bg-[#3b82f6]"></div>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
