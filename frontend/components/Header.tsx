"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  {
    name: "Screener",
    href: "/screener",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h18M3 12h10m4 4h4M3 16h4m4 0h2" />
        <rect x="13" y="13" width="8" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Terminal",
    href: "/terminal",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    name: "Themes",
    href: "/theme",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: "Stock Search",
    href: "/ai",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </svg>
    ),
  },
  {
    name: "Swing",
    href: "/swing",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
      </svg>
    ),
  },
  {
    name: "Tracker",
    href: "/tracker",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    name: "Option",
    href: "/options",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: "Daily",
    href: "/daily",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Pre-Order",
    href: "/preorder/swing",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Order",
    href: "/order/swing",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

export default function Header({
  hideMenus = false,
  onLogoClick,
  onNewQueryClick,
  globalLocale,
  logoHref,
}: {
  hideMenus?: boolean;
  onLogoClick?: () => void;
  onNewQueryClick?: () => void;
  /** When set, the logo becomes a smart link for the /global member area:
   * logged in -> /global/{locale}/top100, logged out -> /global/{locale} landing. */
  globalLocale?: "en" | "tr" | "es" | "fr" | "pt";
  /** Plain link target for the logo when hideMenus is true (no auth check needed). */
  logoHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isHomePage = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      localStorage.removeItem("user_email");
    } finally {
      router.push("/login");
    }
  };

  const handleGlobalLogoClick = async () => {
    const landingHref = globalLocale === "tr" ? "/global/tr" : globalLocale === "es" ? "/global/es" : globalLocale === "fr" ? "/global/fr" : globalLocale === "pt" ? "/global/pt" : "/global/en";
    const homeHref = globalLocale === "tr" ? "/global/tr/home" : globalLocale === "es" ? "/global/es/home" : globalLocale === "fr" ? "/global/fr/home" : globalLocale === "pt" ? "/global/pt/home" : "/global/en/home";
    try {
      const res = await fetch("/api/members/me");
      router.push(res.ok ? homeHref : landingHref);
    } catch {
      router.push(landingHref);
    }
  };

  const getLangHref = (targetLang: string) => {
    if (!pathname) return `/global/${targetLang.toLowerCase()}`;
    const targetLoc = targetLang.toLowerCase();
    
    const isFaqPage = pathname.endsWith('/Perguntas_Frequentes') || pathname.endsWith('/sss') || pathname.endsWith('/faq');
    if (isFaqPage) {
      const faqSuffix = targetLoc === 'pt' ? '/Perguntas_Frequentes' : targetLoc === 'tr' ? '/sss' : '/faq';
      return `/global/${targetLoc}${faqSuffix}`;
    }
    
    return pathname.replace(new RegExp(`^/global/${globalLocale}`), `/global/${targetLoc}`);
  };

  const showNav = !isHomePage && !hideMenus;

  const logoContent = (
    <>
      <div className="relative w-8 h-8 group-hover:scale-110 transition-transform flex-shrink-0">
        <Image
          src="/finmawave.png"
          alt="BOGASTOCK - Blue One Global Analysis"
          width={32}
          height={32}
          priority
          className="object-contain rounded-lg shadow-lg shadow-blue-500/10"
        />
      </div>
      <div className="flex flex-col md:flex-row md:items-baseline">
        <span
          className="text-lg md:text-xl text-white tracking-tighter"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
        >
          BOGA<span className="text-[#3b82f6]">STOCK</span>
        </span>
        <span className="hidden md:inline text-[9px] text-[#3b82f6] md:ml-2 font-black uppercase tracking-[0.2em]">
          {globalLocale === "tr" ? "FİNANSAL ANALİZ" : globalLocale === "es" ? "ANÁLISIS FINANCIERO" : globalLocale === "fr" ? "ANALYSE FINANCIÈRE" : globalLocale === "pt" ? "ANÁLISE FINANCEIRA" : "Financial Analysis"}
        </span>
      </div>
    </>
  );

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full max-w-[1800px] mx-auto px-3 h-12 flex items-center gap-3">

        {/* Logo */}
        <div className="flex-shrink-0">
          {globalLocale ? (
            <button onClick={handleGlobalLogoClick} className="flex items-center gap-2 group focus:outline-none">
              {logoContent}
            </button>
          ) : onLogoClick ? (
            <button onClick={onLogoClick} className="flex items-center gap-2 group focus:outline-none">
              {logoContent}
            </button>
          ) : hideMenus ? (
            logoHref ? (
              <Link href={logoHref} className="flex items-center gap-2 group">
                {logoContent}
              </Link>
            ) : (
              <div className="flex items-center gap-2 group cursor-default">{logoContent}</div>
            )
          ) : (
            <Link href="/" className="flex items-center gap-2 group">
              {logoContent}
            </Link>
          )}
        </div>

        {/* Divider */}
        {showNav && (
          <div className="hidden md:block w-px h-6 bg-[#1e2a3a] flex-shrink-0" />
        )}

        {/* Desktop nav — inline, always visible */}
        {showNav && (
          <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex-shrink-0 ${
                    active
                      ? "bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30"
                      : "text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className={active ? "text-[#3b82f6]" : "text-[#64748b] group-hover:text-white"}>
                    {link.icon}
                  </span>
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1 md:flex-none" />

        {/* Right side extras */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Language Selector */}
          {globalLocale && (
            <div className="flex items-center gap-0.5 bg-[#1e2a3a]/40 rounded-lg p-0.5 mr-1 border border-[#1e2a3a]/60">
              {['EN', 'ES', 'FR', 'PT', 'TR'].map((lang) => {
                const isActive = globalLocale.toUpperCase() === lang;
                const isAvailable = lang === 'EN' || lang === 'TR' || lang === 'ES' || lang === 'FR' || lang === 'PT';
                
                if (!isAvailable) {
                  return (
                    <span
                      key={lang}
                      className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#64748b]/40 cursor-not-allowed select-none"
                      title="Coming Soon"
                    >
                      {lang}
                    </span>
                  );
                }
                
                return (
                  <Link
                    key={lang}
                    href={getLangHref(lang)}
                    className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                      isActive
                        ? "bg-[#3b82f6] text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                        : "text-[#64748b] hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {lang}
                  </Link>
                );
              })}
            </div>
          )}

          {onNewQueryClick && (
            <button
              onClick={onNewQueryClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#3b82f6] hover:text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all animate-pulse"
            >
              <span>+</span>
              <span>YENİ ARAMA</span>
            </button>
          )}


          {/* Logout butonu — her zaman görünür */}
          {!isHomePage && !hideMenus && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Çıkış Yap"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
              <span className="hidden sm:inline">{loggingOut ? "..." : "Çıkış"}</span>
            </button>
          )}

          {/* Mobile hamburger — only on small screens */}
          {showNav && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 text-[#64748b] hover:text-white transition-colors rounded-lg hover:bg-white/5"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {showNav && mobileOpen && (
        <div className="md:hidden border-t border-[#1e2a3a] bg-[#0a0e17] px-3 py-2">
          <nav className="grid grid-cols-2 gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    active
                      ? "bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30"
                      : "text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className={active ? "text-[#3b82f6]" : "text-[#64748b]"}>{link.icon}</span>
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
