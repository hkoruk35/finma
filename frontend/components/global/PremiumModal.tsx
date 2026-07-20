"use client";

import { useEffect, useState } from "react";
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
    trialLabel: "Deneme süreniz bitiyor:",
    offer: "İLK AY SADECE $9",
    sub: "Sınırlı sayıda — normal fiyat $39/ay",
    cta: "Şimdi Başla →",
    close: "Kapat",
    upgradeHref: "/global/tr/hesabim?tab=subscription",
    dayUnit: "g",
    hourUnit: "s",
    minUnit: "d",
  },
  en: {
    title: "Premium Membership Required",
    desc: "A Premium membership is required to access this content. Get unlimited access to all stock signals, analyses, and lists.",
    trialLabel: "Your trial expires in:",
    offer: "FIRST MONTH ONLY $9",
    sub: "Limited offer — regular price $39/mo",
    cta: "Get Started →",
    close: "Close",
    upgradeHref: "/global/en/account?tab=subscription",
    dayUnit: "d",
    hourUnit: "h",
    minUnit: "m",
  },
  es: {
    title: "Se Requiere Membresía Premium",
    desc: "Se requiere una membresía Premium para acceder a este contenido. Obtén acceso ilimitado a todas las señales de acciones, análisis y listas.",
    trialLabel: "Tu prueba expira en:",
    offer: "PRIMER MES SOLO $9",
    sub: "Oferta limitada — precio normal $39/mes",
    cta: "Comenzar Ahora →",
    close: "Cerrar",
    upgradeHref: "/global/es/account?tab=subscription",
    dayUnit: "d",
    hourUnit: "h",
    minUnit: "m",
  },
  fr: {
    title: "Adhésion Premium Requise",
    desc: "Une adhésion Premium est requise pour accéder à ce contenu. Obtenez un accès illimité à tous les signaux d'actions, analyses et listes.",
    trialLabel: "Votre essai expire dans:",
    offer: "PREMIER MOIS SEULEMENT 9$",
    sub: "Offre limitée — prix normal 39$/mois",
    cta: "Commencer Maintenant →",
    close: "Fermer",
    upgradeHref: "/global/fr/account?tab=subscription",
    dayUnit: "j",
    hourUnit: "h",
    minUnit: "m",
  },
  pt: {
    title: "Assinatura Premium Necessária",
    desc: "É necessária uma assinatura Premium para acessar este conteúdo. Tenha acesso ilimitado a todos os sinais de ações, análises e listas.",
    trialLabel: "Seu teste expira em:",
    offer: "PRIMEIRO MÊS POR APENAS $9",
    sub: "Oferta limitada — preço normal $39/mês",
    cta: "Começar Agora →",
    close: "Fechar",
    upgradeHref: "/global/pt/account?tab=subscription",
    dayUnit: "d",
    hourUnit: "h",
    minUnit: "m",
  },
};

function TrialBadge({ locale }: { locale: Locale }) {
  const { isFreeTrial, trialSecondsLeft } = useMemberPlan();
  const [secsLeft, setSecsLeft] = useState(trialSecondsLeft);
  const c = COPY[locale];

  useEffect(() => {
    setSecsLeft(trialSecondsLeft);
    if (trialSecondsLeft <= 0) return;
    const id = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [trialSecondsLeft]);

  if (!isFreeTrial || secsLeft <= 0) return null;

  const days = Math.floor(secsLeft / 86400);
  const hours = Math.floor((secsLeft % 86400) / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);
  const secs = secsLeft % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="mb-5 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-4 py-3 flex items-center gap-3">
      <svg className="w-4 h-4 text-[#f59e0b] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] text-[#f59e0b]/70 font-semibold uppercase tracking-wider">{c.trialLabel}</p>
        <p className="font-mono font-black text-[#f59e0b] text-base tracking-wider mt-0.5">
          {days}{c.dayUnit} {pad(hours)}{c.hourUnit} {pad(mins)}{c.minUnit} {pad(secs)}sn
        </p>
      </div>
    </div>
  );
}

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

          {/* Trial countdown — only visible for free trial users */}
          <TrialBadge locale={locale} />

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
