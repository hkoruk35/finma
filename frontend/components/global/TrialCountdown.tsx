"use client";

import { useState, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

export default function TrialCountdown({ locale }: { locale: Locale }) {
  const { isFreeTrial, trialSecondsLeft, loading } = useMemberPlan();
  const [secsLeft, setSecsLeft] = useState(trialSecondsLeft);
  const [showPopup, setShowPopup] = useState(false);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSecsLeft(trialSecondsLeft);
    if (trialSecondsLeft <= 0) return;
    const id = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [trialSecondsLeft]);

  useEffect(() => {
    return () => { if (dismissRef.current) clearTimeout(dismissRef.current); };
  }, []);

  const handleMouseEnter = () => {
    setShowPopup(true);
    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => setShowPopup(false), 10000);
  };

  if (loading || !isFreeTrial) return null;

  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  const secs = secsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const countdownStr = locale === "tr"
    ? `${days}g ${pad(hours)}s ${pad(mins)}d ${pad(secs)}sn`
    : `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;

  const upgradeHref = locale === "tr"
    ? "/global/tr/hesabim?tab=subscription"
    : "/global/en/account?tab=subscription";

  const features = locale === "tr"
    ? ["AI destekli derin hisse analizi", "Swing & trend sinyalleri", "Top 100 tam erişim", "Kurumsal akım verileri"]
    : ["AI-powered deep stock analysis", "Swing & trend signals", "Full Top 100 access", "Institutional flow data"];

  return (
    <div className="relative" onMouseEnter={handleMouseEnter}>
      <a
        href={upgradeHref}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#f59e0b]/40 hover:border-[#f59e0b]/80 transition-all group flex-shrink-0"
      >
        <span className="font-mono text-[10px] font-black text-[#f59e0b] tracking-wider">
          {countdownStr}
        </span>
        <span className="hidden sm:block w-px h-3 bg-white/10" />
        <span className="hidden sm:block text-[9px] font-black uppercase tracking-wider text-[#f59e0b]/80 group-hover:text-[#f59e0b] transition-colors leading-tight">
          {locale === "tr" ? (
            <>$39 yerine <span className="text-[#22c55e]">$19</span> ilk ay →</>
          ) : (
            <>$39 → <span className="text-[#22c55e]">$19</span> first month →</>
          )}
        </span>
      </a>

      {showPopup && (
        <div className="absolute right-0 top-full mt-2 z-[200] w-72 rounded-xl bg-[#0a0e17] border border-[#f59e0b]/50 shadow-2xl shadow-black/80 p-4">
          <button
            onClick={() => { setShowPopup(false); if (dismissRef.current) clearTimeout(dismissRef.current); }}
            className="absolute top-2.5 right-3 text-white/40 hover:text-white/80 text-xl leading-none"
          >
            ×
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#f59e0b]">⚡</span>
            <span className="text-white text-[11px] font-bold uppercase tracking-wider">
              {locale === "tr" ? "Sınırlı Süre Teklifi" : "Limited Time Offer"}
            </span>
          </div>
          <p className="text-white/50 text-[10px] mb-3">
            {locale === "tr"
              ? "Deneme süreniz dolmadan Premium'a geçin."
              : "Upgrade before your trial expires."}
          </p>

          <div className="space-y-1.5 mb-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] text-white/70">
                <span className="text-[#22c55e] font-bold">✓</span>
                {f}
              </div>
            ))}
          </div>

          <div className="flex items-baseline gap-2 mb-3 px-3 py-2 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20">
            <span className="text-white/40 text-xs line-through">$39</span>
            <span className="text-[#22c55e] text-2xl font-black">$19</span>
            <span className="text-white/40 text-[10px]">
              {locale === "tr" ? "/ ilk ay" : "/ first month"}
            </span>
          </div>

          <a
            href={upgradeHref}
            onClick={() => setShowPopup(false)}
            className="block w-full text-center py-2 rounded-lg bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-black text-[11px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            {locale === "tr" ? "Hemen Yükselt →" : "Upgrade Now →"}
          </a>
        </div>
      )}
    </div>
  );
}
