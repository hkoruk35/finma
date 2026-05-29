"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  {
    name: "Screener",
    href: "/screener",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h18M3 12h10m4 4h4M3 16h4m4 0h2" />
        <rect x="13" y="13" width="8" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    name: "Terminal",
    href: "/terminal",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
      </svg>
    ),
  },
  {
    name: "Themes",
    href: "/theme",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    name: "Stock Search",
    href: "/ai",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
      </svg>
    ),
  },
  {
    name: "Swing",
    href: "/swing",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
      </svg>
    ),
  },
  {
    name: "Tracker",
    href: "/tracker",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    name: "Option",
    href: "/options",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function Header({
  hideMenus = false,
  onLogoClick,
  onNewQueryClick,
}: {
  hideMenus?: boolean;
  onLogoClick?: () => void;
  onNewQueryClick?: () => void;
}) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(true);

  const logoContent = (
    <>
      <div className="relative w-9 h-9 group-hover:scale-110 transition-transform">
        <Image
          src="/finmawave.png"
          alt="BOGA AI - Blue One Global Analysis"
          width={36}
          height={36}
          priority
          className="object-contain rounded-lg shadow-lg shadow-blue-500/10"
        />
      </div>
      <div className="flex flex-col md:flex-row md:items-baseline">
        <span
          className="text-xl md:text-2xl text-white tracking-tighter"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
        >
          BOGA AI
        </span>
        <span className="text-[9px] md:text-xs text-[#3b82f6] md:ml-2 font-black uppercase tracking-[0.2em] -mt-1 md:mt-0">
          Financial Analysis
        </span>
      </div>
    </>
  );

  const showNav = !isHomePage && !hideMenus;

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full max-w-[1800px] mx-auto px-3 py-3 flex items-center justify-between">
        {/* Logo — flush left */}
        {onLogoClick ? (
          <button onClick={onLogoClick} className="flex items-center gap-2 group text-left focus:outline-none">
            {logoContent}
          </button>
        ) : hideMenus ? (
          <div className="flex items-center gap-2 group cursor-default">{logoContent}</div>
        ) : (
          <Link href="/" className="flex items-center gap-2 group">
            {logoContent}
          </Link>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {onNewQueryClick && (
            <button
              onClick={onNewQueryClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/30 text-[#3b82f6] hover:text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all animate-pulse"
            >
              <span>+</span>
              <span>YENİ ARAMA</span>
            </button>
          )}

          {(isHomePage || hideMenus) && !onNewQueryClick ? (
            <span className="hidden md:flex text-[10px] font-black uppercase tracking-widest text-[#64748b] border border-[#1e2a3a] px-3 py-1.5 rounded-lg bg-[#0d1117]">
              DEVELOPMENT PHASE
            </span>
          ) : showNav ? (
            /* Hamburger — shown on all screen sizes */
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-[#64748b] hover:text-white transition-colors rounded-lg hover:bg-white/5"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown menu — all screen sizes */}
      {showNav && menuOpen && (
        <div className="border-t border-[#1e2a3a] bg-[#0a0e17] px-4 py-3 animate-fade-in">
          <nav className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-black uppercase tracking-wider transition-all ${
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
