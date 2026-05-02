"use client";

import Link from "next/link";
import Image from "next/image";

export default function Header() {
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

        {/* Development Status Badge */}
        <div className="hidden md:flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b] border border-[#1e2a3a] px-3 py-1.5 rounded-lg bg-[#0d1117]">
             DEVELOPMENT PHASE
          </span>
        </div>
      </div>
    </header>
  );
}
