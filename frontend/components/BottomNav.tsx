"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSmartCart } from "@/components/SmartCartContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { activeCart } = useSmartCart();
  const cartCount = activeCart?.positions.filter(p => p.status !== "closed").length ?? 0;

  const navItems = [
    { label: "Home", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ), href: "/" },
    { label: "Scores", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ), href: "/category/top-scores" },
    { label: "Picks", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ), href: "/swing-picks" },
    { label: `Cart${cartCount > 0 ? ` (${cartCount})` : ""}`, icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ), href: "/smart-cart" },
    { label: "Menu", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
      </svg>
    ), href: "/about" }
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
              <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                {item.icon}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-tight">{item.label}</span>
              {isActive && <div className="w-5 h-0.5 rounded-full bg-[#3b82f6]"></div>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
