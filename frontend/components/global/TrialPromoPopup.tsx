"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

const AUTO_CLOSE_SECS = 8;

export default function TrialPromoPopup({ locale }: { locale: Locale }) {
  const { isFreeTrial, loading } = useMemberPlan();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [secsLeft, setSecsLeft] = useState(AUTO_CLOSE_SECS);

  // MemberHeader is mounted fresh on every page — show popup on each mount for free-trial members
  useEffect(() => {
    if (loading || !isFreeTrial) return;

    const accountSeg = locale === "tr" ? "/hesabim" : "/account";
    if (pathname?.includes(accountSeg)) return;

    const t = setTimeout(() => {
      setSecsLeft(AUTO_CLOSE_SECS);
      setShow(true);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isFreeTrial]);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!show) return;
    if (secsLeft <= 0) { setShow(false); return; }
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [show, secsLeft]);

  if (loading || !isFreeTrial || !show) return null;

  const upgradeHref = locale === "tr"
    ? "/global/tr/hesabim?tab=subscription"
    : locale === "es"
    ? "/global/es/account?tab=subscription"
    : locale === "fr"
    ? "/global/fr/account?tab=subscription"
    : locale === "pt"
    ? "/global/pt/account?tab=subscription"
    : "/global/en/account?tab=subscription";

  const features = locale === "tr"
    ? ["AI destekli derin hisse analizi", "Swing & trend sinyalleri (günlük)", "Top 100 hisse tam erişim", "Kurumsal akım & 13F verileri"]
    : locale === "es"
    ? ["Análisis profundo de acciones con IA", "Señales diarias de swing & tendencia", "Acceso completo a Top 100 acciones", "Flujo institucional & datos 13F"]
    : locale === "pt"
    ? ["Análise profunda de ações com IA", "Sinais diários de swing & tendência", "Acesso total às ações do Top 100", "Fluxo institucional & dados 13F"]
    : ["AI-powered deep stock analysis", "Daily swing & trend signals", "Full Top 100 stocks access", "Institutional flow & 13F data"];

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={() => setShow(false)}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-[#0a0e17] border border-[#f59e0b]/40 shadow-2xl shadow-black/80 p-5 z-10 pointer-events-auto">
        <button
          onClick={() => setShow(false)}
          className="absolute top-3 right-3 text-white/40 hover:text-white/80 text-xl leading-none"
        >
          ×
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#f59e0b] text-lg">⚡</span>
          <span className="text-white text-sm font-bold uppercase tracking-wider">
            {locale === "tr" ? "Özel Fırsat" : locale === "es" ? "Oferta Especial" : locale === "pt" ? "Oferta Especial" : "Special Offer"}
          </span>
        </div>
        <p className="text-white/50 text-[11px] mb-4">
          {locale === "tr"
            ? "Deneme süreniz devam ederken en iyi fiyatı kilitleyin."
            : locale === "es"
            ? "Consigue el mejor precio mientras tu prueba está activa."
            : locale === "pt"
            ? "Garanta o melhor preço enquanto seu teste está ativo."
            : "Lock in the best price while your trial is active."}
        </p>

        <div className="space-y-1.5 mb-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-white/70">
              <span className="text-[#22c55e] font-bold flex-shrink-0">✓</span>
              {f}
            </div>
          ))}
        </div>

        <div className="flex items-baseline gap-2 mb-4 px-4 py-3 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20">
          <span className="text-white/40 text-sm line-through">$39</span>
          <span className="text-[#22c55e] text-3xl font-black">$19</span>
          <span className="text-white/50 text-[11px]">
            {locale === "tr" ? "/ ilk ay" : locale === "es" ? "/ primer mes" : locale === "pt" ? "/ primeiro mês" : "/ first month"}
          </span>
        </div>

        <a
          href={upgradeHref}
          onClick={() => setShow(false)}
          className="block w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-black text-[12px] font-black uppercase tracking-wider hover:opacity-90 transition-opacity mb-3"
        >
          {locale === "tr" ? "Hemen Yükselt →" : locale === "es" ? "Mejorar Ahora →" : locale === "pt" ? "Fazer Upgrade Agora →" : "Upgrade Now →"}
        </a>

        {/* Auto-dismiss progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f59e0b]/60 transition-all duration-1000 ease-linear"
              style={{ width: `${(secsLeft / AUTO_CLOSE_SECS) * 100}%` }}
            />
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-[10px] text-white/30 hover:text-white/60 flex-shrink-0"
          >
            {locale === "tr" ? `${secsLeft}s kapat` : locale === "es" ? `cerrar en ${secsLeft}s` : locale === "pt" ? `fechar em ${secsLeft}s` : `close in ${secsLeft}s`}
          </button>
        </div>
      </div>
    </div>
  );
}
