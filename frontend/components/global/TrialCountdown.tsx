"use client";

import { useState, useEffect } from "react";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

export default function TrialCountdown({ locale }: { locale: Locale }) {
  const { isFreeTrial, trialSecondsLeft, loading } = useMemberPlan();
  const [secsLeft, setSecsLeft] = useState(trialSecondsLeft);

  useEffect(() => {
    setSecsLeft(trialSecondsLeft);
    if (trialSecondsLeft <= 0) return;
    const id = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [trialSecondsLeft]);

  if (loading || !isFreeTrial) return null;

  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  const secs = secsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const countdownStr = locale === "tr"
    ? `${days}g ${pad(hours)}s ${pad(mins)}d ${pad(secs)}sn`
    : `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;

  const upgradeHref = locale === "tr" ? "/global/tr/hesabim" : "/global/en/account";

  return (
    <a
      href={upgradeHref}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#f59e0b]/40 hover:border-[#f59e0b]/80 transition-all group flex-shrink-0"
      title={locale === "tr" ? "Premium'a yükselt" : "Upgrade to Premium"}
    >
      {/* Timer */}
      <span className="font-mono text-[10px] font-black text-[#f59e0b] tracking-wider">
        {countdownStr}
      </span>
      <span className="hidden sm:block w-px h-3 bg-white/10" />
      {/* CTA */}
      <span className="hidden sm:block text-[9px] font-black uppercase tracking-wider text-[#f59e0b]/80 group-hover:text-[#f59e0b] transition-colors leading-tight">
        {locale === "tr" ? (
          <>$39 yerine <span className="text-[#22c55e]">$19</span> ilk ay →</>
        ) : (
          <>$39 → <span className="text-[#22c55e]">$19</span> first month →</>
        )}
      </span>
    </a>
  );
}
