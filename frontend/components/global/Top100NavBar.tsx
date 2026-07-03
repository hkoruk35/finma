"use client";

import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

export default function Top100NavBar({ locale }: { locale: Locale }) {
  const base = `/global/${locale}`;

  return (
    <div className="flex gap-2 mb-4">
      <Link
        href={`${base}/top100`}
        className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]"
      >
        TOP 100
      </Link>
      <Link
        href={`${base}/swing`}
        className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
      >
        SWING
      </Link>
      <Link
        href={`${base}/trend`}
        className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
      >
        TREND
      </Link>
    </div>
  );
}
