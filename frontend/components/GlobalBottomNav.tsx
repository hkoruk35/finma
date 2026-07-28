"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

type Locale = "tr" | "en" | "es" | "fr" | "pt";

const HOME_LABEL: Record<Locale, string> = {
  tr: "Anasayfa", en: "Home", es: "Inicio", fr: "Accueil", pt: "Início",
};

const TOP7_LABEL: Record<Locale, string> = {
  tr: "Top 7", en: "Top 7", es: "Top 7", fr: "Top 7", pt: "Top 7",
};

const MY_WATCHLIST_LABEL: Record<Locale, string> = {
  tr: "İzleme Listem", en: "My Watchlist", es: "Mi Lista", fr: "Ma Liste", pt: "Minha Lista",
};

export default function GlobalBottomNav() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/members/me")
      .then((r) => setIsLoggedIn(r.ok))
      .catch(() => setIsLoggedIn(false));
  }, []);

  // Hide on search/landing page
  const isSearchPage = pathname.includes("/search");
  if (isSearchPage) return null;

  // Detect locale from pathname (/global/{locale}/...) — supports all 5 locales
  const segment = pathname.split("/")[2];
  const locale: Locale = (["tr", "en", "es", "fr", "pt"] as const).includes(segment as Locale)
    ? (segment as Locale)
    : "en";

  const navItems = [
    { label: HOME_LABEL[locale], href: `/global/${locale}/home` },
    isLoggedIn
      ? { label: MY_WATCHLIST_LABEL[locale], href: `/global/${locale}/my-watchlist` }
      : { label: TOP7_LABEL[locale], href: `/global/${locale}/top7` },
    { label: "Trend", href: `/global/${locale}/swing` },
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
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl flex-1 transition-all ${isActive ? 'text-[#3b82f6] bg-[#3b82f6]/5' : 'text-[#00d2ff] hover:text-white'}`}
            >
              <span className="text-sm font-bold uppercase tracking-tight text-center leading-tight whitespace-nowrap">{item.label}</span>
              {isActive && <div className="w-5 h-0.5 rounded-full bg-[#3b82f6]"></div>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
