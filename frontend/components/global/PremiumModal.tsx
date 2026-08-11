"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

interface Props {
  locale: Locale;
  onClose: () => void;
}

const COPY = {
  tr: {
    title: "Premium Üyelik Gerekiyor",
    desc: "Bu içeriğe erişmek için Premium üyelik gereklidir. Tüm hisse sinyallerine, analizlere ve listelere sınırsız erişin.",
    sub: "Normal fiyat $39/ay",
    cta: "Şimdi Başla →",
    close: "Kapat",
  },
  en: {
    title: "Premium Membership Required",
    desc: "A Premium membership is required to access this content. Get unlimited access to all stock signals, analyses, and lists.",
    sub: "Regular price $39/mo",
    cta: "Get Started →",
    close: "Close",
  },
  es: {
    title: "Se Requiere Membresía Premium",
    desc: "Se requiere una membresía Premium para acceder a este contenido. Obtén acceso ilimitado a todas las señales de acciones, análisis y listas.",
    sub: "Precio normal $39/mes",
    cta: "Comenzar Ahora →",
    close: "Cerrar",
  },
  fr: {
    title: "Adhésion Premium Requise",
    desc: "Une adhésion Premium est requise pour accéder à ce contenu. Obtenez un accès illimité à tous les signaux d'actions, analyses et listes.",
    sub: "Prix normal 39$/mois",
    cta: "Commencer Maintenant →",
    close: "Fermer",
  },
  pt: {
    title: "Assinatura Premium Necessária",
    desc: "É necessária uma assinatura Premium para acessar este conteúdo. Tenha acesso ilimitado a todos os sinais de ações, análises e listas.",
    sub: "Preço normal $39/mês",
    cta: "Começar Agora →",
    close: "Fechar",
  },
  id: {
    title: "Diperlukan Keanggotaan Premium",
    desc: "Diperlukan keanggotaan Premium untuk mengakses konten ini. Dapatkan akses tak terbatas ke semua sinyal saham, analisis, dan daftar.",
    sub: "Harga normal $39/bln",
    cta: "Mulai Sekarang →",
    close: "Tutup",
  },
};

export default function PremiumModal({ locale, onClose }: Props) {
  const c = COPY[locale] ?? COPY.en;
  const { plan } = useMemberPlan();
  const isLoggedIn = plan !== null;

  const registerHref = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
  const accountHref = locale === "tr" ? "/global/tr/hesabim?tab=subscription" : `/global/${locale}/account?tab=subscription`;
  const upgradeHref = isLoggedIn ? accountHref : registerHref;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-14 sm:pt-28 overflow-y-auto"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md bg-[#0d1117] border border-[#1e2a3a] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#3b82f6]" />

        <div className="p-6">
          {/* Header row with lock icon and close button */}
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-white/10"
              aria-label={c.close}
            >
              ✕
            </button>
          </div>

          <h2 className="text-lg font-semibold text-white mb-2 tracking-tight">{c.title}</h2>
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">{c.desc}</p>

          {/* Regular Price Box */}
          <div className="bg-[#161f30] border border-[#3b82f6]/30 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-300">{c.sub}</div>
            <div className="text-sm font-bold text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-3 py-1 rounded-lg">
              $39{locale === "tr" ? "/ay" : "/mo"}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={upgradeHref}
              className="flex-1 text-center py-3 rounded-xl font-medium text-sm bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-all active:scale-[0.98] shadow-lg shadow-blue-500/20"
            >
              {c.cta}
            </a>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-medium text-sm bg-[#1e2a3a] text-slate-300 hover:text-white border border-[#1e2a3a] hover:border-[#30363d] transition-colors"
            >
              {c.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
