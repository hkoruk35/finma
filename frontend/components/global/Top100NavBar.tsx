"use client";

import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

export default function Top100NavBar({ locale }: { locale: Locale }) {
  const base = `/global/${locale}`;

  return (
    <div className="flex gap-2 mb-4">
      <Link
        href={`${base}/swing`}
        className="text-[10px] font-semibold px-3 py-1.5 rounded border border-[#38bdf8] bg-[#38bdf8]/15 !text-[#38bdf8]"
      >
        TREND
      </Link>
      <Link
        href={`${base}/watchlist`}
        className="text-[10px] font-semibold px-3 py-1.5 rounded border border-[#1e2a3a] !text-[#38bdf8] hover:border-[#38bdf8] transition-colors"
      >
        WATCHLIST
      </Link>
    </div>
  );
}
