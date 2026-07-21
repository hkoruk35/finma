"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n/copy";

interface Props {
  locale: Locale;
  onClose: () => void;
}

const COPY = {
  tr: {
    title: "Premium Üyelik Gerekiyor",
    desc: "Bu içeriğe erişmek için Premium üyelik gereklidir. Tüm hisse sinyallerine, analizlere ve listelere sınırsız erişin.",
    offer: "İLK AY SADECE $9",
    sub: "Sınırlı sayıda — normal fiyat $39/ay",
    cta: "Şimdi Başla →",
    close: "Kapat",
    upgradeHref: "/global/tr/hesabim?tab=subscription",
  },
  en: {
    title: "Premium Membership Required",
    desc: "A Premium membership is required to access this content. Get unlimited access to all stock signals, analyses, and lists.",
    offer: "FIRST MONTH ONLY $9",
    sub: "Limited offer — regular price $39/mo",
    cta: "Get Started →",
    close: "Close",
    upgradeHref: "/global/en/account?tab=subscription",
  },
  es: {
    title: "Se Requiere Membresía Premium",
    desc: "Se requiere una membresía Premium para acceder a este contenido. Obtén acceso ilimitado a todas las señales de acciones, análisis y listas.",
    offer: "PRIMER MES SOLO $9",
    sub: "Oferta limitada — precio normal $39/mes",
    cta: "Comenzar Ahora →",
    close: "Cerrar",
    upgradeHref: "/global/es/account?tab=subscription",
  },
  fr: {
    title: "Adhésion Premium Requise",
    desc: "Une adhésion Premium est requise pour accéder à ce contenu. Obtenez un accès illimité à tous les signaux d'actions, analyses et listes.",
    offer: "PREMIER MOIS SEULEMENT 9$",
    sub: "Offre limitée — prix normal 39$/mois",
    cta: "Commencer Maintenant →",
    close: "Fermer",
    upgradeHref: "/global/fr/account?tab=subscription",
  },
  pt: {
    title: "Assinatura Premium Necessária",
    desc: "É necessária uma assinatura Premium para acessar este conteúdo. Tenha acesso ilimitado a todos os sinais de ações, análises e listas.",
    offer: "PRIMEIRO MÊS POR APENAS $9",
    sub: "Oferta limitada — preço normal $39/mês",
    cta: "Começar Agora →",
    close: "Fechar",
    upgradeHref: "/global/pt/account?tab=subscription",
  },
};

export default function PremiumModal({ locale, onClose }: Props) {
  const c = COPY[locale];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md bg-[#0d1117] border border-[#1e2a3a] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#3b82f6]" />

        <div className="p-6">
          {/* Lock icon */}
          <div className="w-12 h-12 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-lg font-black text-white mb-2">{c.title}</h2>
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">{c.desc}</p>

          {/* Offer block */}
          <div className="bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 rounded-xl p-4 mb-5">
            <div className="text-[#3b82f6] font-black text-xl tracking-tight">{c.offer}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.sub}</div>
          </div>

          <div className="flex gap-3">
            <a
              href={c.upgradeHref}
              className="flex-1 text-center py-3 rounded-xl font-black text-sm bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
            >
              {c.cta}
            </a>
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-black text-sm bg-[#1e2a3a] text-slate-400 hover:text-white border border-[#1e2a3a] hover:border-[#30363d] transition-colors"
            >
              {c.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
