"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { name: "Swing", href: "/swing" },
  { name: "DayTrade", href: "/daytrade" },
  { name: "Long Term", href: "/long-term" },
  { name: "Performance", href: "/swing-performance" },
  { name: "Options", href: "/optanaliz" },
];

export default function Header() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
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
            <span
              className="text-[9px] md:text-xs text-[#3b82f6] md:ml-2 font-black uppercase tracking-[0.2em] -mt-1 md:mt-0"
            >
              Stock Analysis
            </span>
          </div>
        </Link>

        {/* Desktop Menu - ONLY show on internal pages or if not restricted */}
        {!isHomePage && (
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-xs font-black uppercase tracking-widest transition-colors ${
                  pathname === link.href ? "text-[#3b82f6]" : "text-[#64748b] hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        )}

        {/* Development Status / Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          {isHomePage ? (
            <span className="hidden md:flex text-[10px] font-black uppercase tracking-widest text-[#64748b] border border-[#1e2a3a] px-3 py-1.5 rounded-lg bg-[#0d1117]">
              DEVELOPMENT PHASE
            </span>
          ) : (
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#64748b] hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {!isHomePage && mobileMenuOpen && (
        <div className="md:hidden border-t border-[#1e2a3a] bg-[#0a0e17] px-4 py-4 space-y-4 animate-fade-in">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block text-sm font-black uppercase tracking-widest ${
                pathname === link.href ? "text-[#3b82f6]" : "text-[#64748b]"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
