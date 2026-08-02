"use client";

import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

export default function Top100NavBar({ locale }: { locale: Locale }) {
  const base = `/global/${locale}`;

  return (
    <div className="flex gap-2 mb-4">
      <Link
        href={`${base}/swing`}
        className="text-[10px] font-medium px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]"
      >
        TREND
      </Link>
      <Link
        href={`${base}/watchlist`}
        className="text-[10px] font-medium px-3 py-1.5 rounded border border-[#30363d] text-[#3b82f6] hover:border-[#3b82f6] transition-colors"
      >
        WATCHLIST
      </Link>
    </div>
  );
}
