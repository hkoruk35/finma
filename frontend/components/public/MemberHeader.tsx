"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/copy";

export default function MemberHeader({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const top100Href = locale === "en" ? "/global/en/top100" : "/global/tr/top100";
  const accountHref = locale === "en" ? "/global/en/account" : "/global/tr/hesabim";
  const loginHref = locale === "en" ? "/global/en/login" : "/global/tr/giris";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/members/logout", { method: "POST" });
    } finally {
      router.push(loginHref);
    }
  };

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full max-w-[1800px] mx-auto px-3 h-12 flex items-center gap-3">
        <Link href={top100Href} className="flex items-center gap-2 group flex-shrink-0">
          <div className="relative w-8 h-8 group-hover:scale-110 transition-transform flex-shrink-0">
            <Image
              src="/finmawave.png"
              alt="BOGA AI"
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
              BOGA AI
            </span>
            <span className="hidden md:inline text-[9px] text-[#3b82f6] md:ml-2 font-black uppercase tracking-[0.2em]">
              Financial Analysis
            </span>
          </div>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={accountHref}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">{locale === "en" ? "Account" : "Hesabım"}</span>
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={locale === "en" ? "Log out" : "Çıkış Yap"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            <span className="hidden sm:inline">{loggingOut ? "..." : locale === "en" ? "Log out" : "Çıkış"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
