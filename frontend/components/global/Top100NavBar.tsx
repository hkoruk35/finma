"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import PremiumModal from "./PremiumModal";

export default function Top100NavBar({ locale }: { locale: Locale }) {
  const { isFreeTrial } = useMemberPlan();
  const [showModal, setShowModal] = useState(false);

  const base = `/global/${locale}`;
  const top100Label = "TOP 100";
  const swingLabel = "SWING";
  const trendLabel = "TREND";

  return (
    <>
      {showModal && <PremiumModal locale={locale} onClose={() => setShowModal(false)} />}

      <div className="flex gap-2 mb-4">
        <Link
          href={`${base}/top100`}
          className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]"
        >
          {top100Label}
        </Link>

        {isFreeTrial ? (
          <>
            <button
              onClick={() => setShowModal(true)}
              className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {swingLabel}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {trendLabel}
            </button>
          </>
        ) : (
          <>
            <Link
              href={`${base}/swing`}
              className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
            >
              {swingLabel}
            </Link>
            <Link
              href={`${base}/trend`}
              className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors"
            >
              {trendLabel}
            </Link>
          </>
        )}
      </div>
    </>
  );
}
