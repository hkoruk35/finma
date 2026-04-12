"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const categories = [
    { name: "Breakout", href: "/category/breakout" },
    { name: "Undervalued", href: "/category/undervalued" },
    { name: "Momentum", href: "/category/momentum" },
    { name: "Reversal", href: "/category/reversal" },
    { name: "Passive Income", href: "/category/passive-income" },
  ];

  const NavLink = ({ href, children, isMemberOnly = false, className = "" }: any) => (
    <Link 
      href={!user && isMemberOnly ? "/login" : href} 
      className={`flex items-center gap-1 ${className}`}
      onClick={() => setIsOpen(false)}
    >
      {children}
    </Link>
  );

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-9 h-9 group-hover:scale-110 transition-transform">
            <img src="/finmawave.png" alt="BOGA - Blue One Global Analysis" className="w-full h-full object-contain rounded-lg shadow-lg shadow-blue-500/10" />
          </div>
          <div className="hidden sm:flex items-center">
            <span className="text-2xl text-white tracking-tighter font-black" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              BOGA AI
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center gap-8">
          <NavLink href="/" className="text-xs font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors">Home</NavLink>
          <NavLink href="/academy" className="text-xs font-black uppercase tracking-widest text-[#3b82f6] hover:text-white transition-colors">🎓 Academy</NavLink>
          <NavLink href="/category/top-scores" isMemberOnly className="text-xs font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors">Top Scores</NavLink>
          
          {/* Categories Dropdown */}
          <div className="relative" onMouseEnter={() => setCatOpen(true)} onMouseLeave={() => setCatOpen(false)}>
            <button className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors">
              Categories
              <svg className={`w-3 h-3 transition-transform ${catOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {catOpen && (
              <div className="absolute top-full left-0 w-48 pt-4">
                <div className="bg-[#0f1520] border border-[#1e2a3a] rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                  {categories.map((cat) => (
                    <NavLink key={cat.href} href={cat.href} isMemberOnly className="px-4 py-3 text-[10px] font-bold text-[#94a3b8] hover:bg-[#3b82f6]/10 hover:text-white transition-all border-b border-[#1e2a3a] last:border-0 uppercase tracking-widest">
                      {cat.name}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </div>

          <NavLink href="/archive" isMemberOnly className="text-xs font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors">Archive</NavLink>
        </nav>

        {/* Auth + Toggle */}
        <div className="flex items-center gap-4">
          {!user ? (
            <Link
              href="/login"
              className="px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white text-black hover:bg-[#3b82f6] hover:text-white transition-all shadow-xl"
            >
              Sign In
            </Link>
          ) : (
            <Link href="/watchlist" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                {user.email?.[0].toUpperCase()}
              </div>
              <span className="hidden md:block text-[10px] font-black text-[#94a3b8] group-hover:text-white uppercase tracking-widest">Watchlist</span>
            </Link>
          )}

          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="xl:hidden p-2 text-[#94a3b8] hover:text-white transition-colors bg-[#141924] rounded-lg border border-[#1e2a3a]"
          >
            {isOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="xl:hidden bg-[#0d1117] border-b border-[#1e2a3a] px-4 py-8 animate-in slide-in-from-top duration-300 max-h-[80vh] overflow-y-auto">
          <nav className="flex flex-col gap-6">
            <NavLink href="/" className="text-base font-black uppercase tracking-widest text-white">Home</NavLink>
            <NavLink href="/academy" className="text-base font-black uppercase tracking-widest text-[#3b82f6]">🎓 Academy</NavLink>
            <div className="h-px bg-[#1e2a3a] w-full my-1"></div>
            <NavLink href="/category/top-scores" isMemberOnly className="text-base font-black uppercase tracking-widest text-[#94a3b8]">Top Scores</NavLink>
            
            <div className="flex flex-col gap-4 pl-4 border-l-2 border-[#1e2a3a]">
              {categories.map((cat) => (
                <NavLink key={cat.href} href={cat.href} isMemberOnly className="text-sm font-bold uppercase tracking-widest text-[#64748b]">
                  {cat.name}
                </NavLink>
              ))}
            </div>

            <NavLink href="/archive" isMemberOnly className="text-base font-black uppercase tracking-widest text-[#94a3b8]">Archive</NavLink>
            
            {!user && (
              <Link href="/login" onClick={() => setIsOpen(false)} className="mt-4 w-full py-4 bg-[#3b82f6] text-white text-center rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-500/40">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
