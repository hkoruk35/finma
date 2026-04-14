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
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Process pending membership notification
      if (currentUser) {
        const pendingPlan = localStorage.getItem('pending_membership_notify');
        if (pendingPlan) {
          fetch('/api/membership/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: pendingPlan === 'pro' ? 'pro_join' : 'free_join',
              details: { email: currentUser.email || "Unknown User" } 
            }),
          }).catch(console.error);
          localStorage.removeItem('pending_membership_notify');
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Handle login events specifically
      if (event === 'SIGNED_IN' && currentUser) {
        const pendingPlan = localStorage.getItem('pending_membership_notify');
        if (pendingPlan) {
          fetch('/api/membership/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              event: pendingPlan === 'pro' ? 'pro_join' : 'free_join',
              details: { email: currentUser.email || "Unknown User" } 
            }),
          }).catch(console.error);
          localStorage.removeItem('pending_membership_notify');
        }
      }
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
      href={href} 
      className={`flex items-center gap-1 ${className}`}
      onClick={() => setIsOpen(false)}
    >
      {children}
    </Link>
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative w-9 h-9 group-hover:scale-110 transition-transform">
            <img src="/finmawave.png" alt="BOGA AI - Blue One Global Analysis" className="w-full h-full object-contain rounded-lg shadow-lg shadow-blue-500/10" />
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
              Daily Analysis
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden xl:flex items-center gap-8">
          <NavLink href="/" className="text-xs font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors">Top 3 Swing Picks</NavLink>
          <NavLink href="/swing-performance" className="text-xs font-black uppercase tracking-widest text-[#3b82f6] hover:text-white transition-colors">⚡ Performance</NavLink>
          <NavLink href="/academy" className="text-xs font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-colors">🎓 Academy</NavLink>
        </nav>

        {/* Auth + Toggle */}
        <div className="flex items-center gap-3">
          {!user ? (
            <div className="flex items-center gap-1 md:gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-white transition-all"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white text-black hover:bg-[#3b82f6] hover:text-white transition-all shadow-xl"
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link href="/watchlist" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                  {user.email?.[0].toUpperCase()}
                </div>
                <span className="hidden md:block text-[10px] font-black text-[#94a3b8] group-hover:text-white uppercase tracking-widest">Watchlist</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="text-[10px] font-black uppercase tracking-widest text-[#ef4444] hover:text-red-400 transition-colors border border-red-500/20 px-3 py-1.5 rounded-lg"
              >
                Sign Out
              </button>
            </div>
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
            <NavLink href="/" className="text-base font-black uppercase tracking-widest text-[#94a3b8]">Top 3 Swing Picks</NavLink>
            <NavLink href="/swing-performance" className="text-base font-black uppercase tracking-widest text-[#3b82f6]">⚡ Performance</NavLink>
            <NavLink href="/academy" className="text-base font-black uppercase tracking-widest text-[#94a3b8]">🎓 Academy</NavLink>
            
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
