"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="relative w-9 h-9">
            <img src="/finmaicon1.png" alt="FinMA" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="hidden sm:block">
            <span className="text-xl font-black text-white tracking-tighter">FinMA</span>
            <span className="text-xl font-light text-[#3b82f6] ml-0.5">Daily 100</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link href="/" className="text-sm font-bold text-[#94a3b8] hover:text-white transition-colors">Dashboard</Link>
          <Link href="/category/top-signals" className="text-sm font-bold text-[#94a3b8] hover:text-white transition-colors">Signals</Link>
          <Link href="/category/breakout" className="text-sm font-bold text-[#94a3b8] hover:text-white transition-colors">Breakout</Link>
          <Link href="/category/momentum" className="text-sm font-bold text-[#94a3b8] hover:text-white transition-colors">Momentum</Link>
          <Link href="/archive" className="text-sm font-bold text-[#94a3b8] hover:text-white transition-colors">Archive</Link>
        </nav>

        {/* Auth + Toggle */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:block px-4 py-2 text-sm font-bold rounded-xl bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all shadow-lg shadow-blue-500/20"
          >
            Sign In
          </Link>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-[#94a3b8] hover:text-white transition-colors"
          >
            {isOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden bg-[#0d1117] border-b border-[#1e2a3a] px-4 py-4 animate-in slide-in-from-top duration-300">
          <nav className="flex flex-col gap-4">
            <Link href="/" onClick={() => setIsOpen(false)} className="text-base font-bold text-[#94a3b8] hover:text-white py-2">Dashboard</Link>
            <Link href="/category/top-signals" onClick={() => setIsOpen(false)} className="text-base font-bold text-[#94a3b8] hover:text-white py-2">Signals</Link>
            <Link href="/category/breakout" onClick={() => setIsOpen(false)} className="text-base font-bold text-[#94a3b8] hover:text-white py-2">Breakout</Link>
            <Link href="/category/momentum" onClick={() => setIsOpen(false)} className="text-base font-bold text-[#94a3b8] hover:text-white py-2">Momentum</Link>
            <Link href="/archive" onClick={() => setIsOpen(false)} className="text-base font-bold text-[#94a3b8] hover:text-white py-2">Archive</Link>
            <Link href="/login" onClick={() => setIsOpen(false)} className="mt-2 w-full py-3 bg-[#3b82f6] text-white text-center rounded-xl font-bold">Sign In</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
