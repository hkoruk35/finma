"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSmartTracker } from "@/components/SmartTrackerContext";

export default function BottomNav() {
  const pathname = usePathname();
  const { activeTracker } = useSmartTracker();
  const trackerCount = activeTracker?.positions.filter(p => p.status !== "closed").length ?? 0;

  const navItems = [
    { label: "Home", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ), href: "/" },

    { label: "Picks", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ), href: "/swing" },
    { label: `Tracker${trackerCount > 0 ? ` (${trackerCount})` : ""}`, icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.96 14.96 0 01-5.96-5.96m0 0L2.25 2.25" />
      </svg>
    ), href: "/smart-tracker" },
    { label: "Terminal", icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ), href: "/terminal" },
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
