"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-9 h-9 group-hover:scale-110 transition-transform">
            <img src="/finmaicon1.png" alt="FinMA" className="w-full h-full object-contain rounded-lg shadow-lg shadow-blue-500/10" />
          </div>
          <div className="flex items-center">
            <span className="text-xl font-black text-white tracking-tighter uppercase italic">FinMA</span>
            <span className="hidden xs:block text-xl font-light text-[#3b82f6] ml-1">Daily 100</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/" className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#3b82f6] pb-1">Home Page</Link>
          <Link href="/category/top-signals" className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#3b82f6] pb-1">Signals</Link>
          <Link href="/category/breakout" className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#3b82f6] pb-1">Breakout</Link>
          <Link href="/category/momentum" className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#3b82f6] pb-1">Momentum</Link>
          <Link href="/archive" className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors border-b-2 border-transparent hover:border-[#3b82f6] pb-1">Archive</Link>
        </nav>

        {/* Auth + Toggle */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden sm:inline-flex px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-white text-black hover:bg-[#3b82f6] hover:text-white transition-all shadow-xl"
          >
            Sign In
          </Link>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-[#94a3b8] hover:text-white transition-colors bg-[#141924] rounded-lg border border-[#1e2a3a]"
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
        <div className="lg:hidden bg-[#0d1117] border-b border-[#1e2a3a] px-4 py-8 animate-in slide-in-from-top duration-300">
          <nav className="flex flex-col gap-6">
            <Link href="/" onClick={() => setIsOpen(false)} className="text-xl font-black uppercase tracking-widest text-white">Home Page</Link>
            <Link href="/category/top-signals" onClick={() => setIsOpen(false)} className="text-xl font-black uppercase tracking-widest text-[#94a3b8]">Signals</Link>
            <Link href="/category/breakout" onClick={() => setIsOpen(false)} className="text-xl font-black uppercase tracking-widest text-[#94a3b8]">Breakout</Link>
            <Link href="/category/momentum" onClick={() => setIsOpen(false)} className="text-xl font-black uppercase tracking-widest text-[#94a3b8]">Momentum</Link>
            <Link href="/archive" onClick={() => setIsOpen(false)} className="text-xl font-black uppercase tracking-widest text-[#94a3b8]">Archive</Link>
            <Link href="/login" onClick={() => setIsOpen(false)} className="mt-4 w-full py-4 bg-[#3b82f6] text-white text-center rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/40">Sign In</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
