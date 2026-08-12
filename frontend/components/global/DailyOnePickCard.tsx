"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import FreeRegisterModal from "./FreeRegisterModal";

interface DailyOnePick {
  ticker: string;
  company: string;
  score: number;
  targetPct: number;
}

const COPY: Record<Locale, {
  badge: string; scoreLabel: string; targetLabel: string;
  lockedCta: string; googleHint: string; unlockedCta: string;
  modalTitle: string; modalDesc: string;
}> = {
  en: {
    badge: "TODAY'S AI STOCK PICK",
    scoreLabel: "BS Score",
    targetLabel: "AI Target Gain",
    lockedCta: "Sign Up Free to Unlock Full Analysis",
    googleHint: "Use Google Sign-In for Instant Access",
    unlockedCta: "View Full Analysis →",
    modalTitle: "Today's AI Stock Pick",
    modalDesc: "Sign in with Google or create a free account to see the full chart, analysis, and trade plan for today's pick.",
  },
  tr: {
    badge: "BUGÜNÜN AI HİSSE FIRSATI",
    scoreLabel: "BS Puanı",
    targetLabel: "AI Hedef Kazanç",
    lockedCta: "Tam Analizi Açmak İçin Ücretsiz Kaydol",
    googleHint: "Anında Erişim İçin Google ile Giriş Yapın",
    unlockedCta: "Tam Analizi Gör →",
    modalTitle: "Bugünün AI Hisse Fırsatı",
    modalDesc: "Bugünün fırsat hissesinin tam grafiğini, analizini ve işlem kurgusunu görmek için Google ile giriş yapın veya ücretsiz kaydolun.",
  },
  es: {
    badge: "SELECCIÓN AI DE HOY",
    scoreLabel: "Puntuación BS",
    targetLabel: "Ganancia Objetivo AI",
    lockedCta: "Regístrate Gratis para Ver el Análisis Completo",
    googleHint: "Usa Google para Acceso Instantáneo",
    unlockedCta: "Ver Análisis Completo →",
    modalTitle: "Selección AI de Hoy",
    modalDesc: "Inicia sesión con Google o crea una cuenta gratuita para ver el gráfico, análisis y plan de operación completos de la selección de hoy.",
  },
  fr: {
    badge: "SÉLECTION IA DU JOUR",
    scoreLabel: "Score BS",
    targetLabel: "Gain Cible IA",
    lockedCta: "Inscrivez-vous Gratuitement pour l'Analyse Complète",
    googleHint: "Utilisez Google pour un Accès Instantané",
    unlockedCta: "Voir l'Analyse Complète →",
    modalTitle: "Sélection IA du Jour",
    modalDesc: "Connectez-vous avec Google ou créez un compte gratuit pour voir le graphique, l'analyse et le plan de trading complets de la sélection du jour.",
  },
  pt: {
    badge: "SELEÇÃO IA DE HOJE",
    scoreLabel: "Pontuação BS",
    targetLabel: "Ganho Alvo IA",
    lockedCta: "Cadastre-se Grátis para Ver a Análise Completa",
    googleHint: "Use o Google para Acesso Instantâneo",
    unlockedCta: "Ver Análise Completa →",
    modalTitle: "Seleção IA de Hoje",
    modalDesc: "Entre com o Google ou crie uma conta gratuita para ver o gráfico, a análise e o plano de operação completos da seleção de hoje.",
  },
  id: {
    badge: "PELUANG SAHAM AI HARI INI",
    scoreLabel: "Skor BS",
    targetLabel: "Target Keuntungan AI",
    lockedCta: "Daftar Gratis untuk Membuka Analisis Lengkap",
    googleHint: "Gunakan Login Google untuk Akses Instan",
    unlockedCta: "Lihat Analisis Lengkap →",
    modalTitle: "Peluang Saham AI Hari Ini",
    modalDesc: "Masuk dengan Google atau buat akun gratis untuk melihat grafik, analisis, dan rencana perdagangan lengkap dari pilihan hari ini.",
  },
};

export default function DailyOnePickCard({ locale }: { locale: Locale }) {
  const c = COPY[locale] ?? COPY.en;
  const { plan, loading: planLoading } = useMemberPlan();
  const isLoggedIn = plan !== null;
  const [pick, setPick] = useState<DailyOnePick | null | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const detailHref = `/global/${locale}/dailyone`;

  useEffect(() => {
    let active = true;
    fetch("/api/daily-one", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (active) setPick(d?.pick ?? null); })
      .catch(() => { if (active) setPick(null); });
    return () => { active = false; };
  }, []);

  if (pick === undefined || planLoading) {
    return <div className="mt-4 h-[140px] rounded-xl bg-[#0f1117] border border-[#1e2a3a]/60 animate-pulse" />;
  }
  if (pick === null) return null;

  const initials = pick.ticker.slice(0, 4);
  const targetLabel = `${pick.targetPct >= 0 ? "+" : ""}${pick.targetPct.toFixed(1)}%`;

  const CardInner = (
    <div className="relative overflow-hidden rounded-xl border border-[#3b82f6]/40 bg-gradient-to-br from-[#0f1c2e] via-[#0f1117] to-[#0f1e17] p-4 sm:p-5">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]" />
      <p className="text-[11px] font-bold text-[#3b82f6] uppercase tracking-[0.2em] mb-3">{c.badge}</p>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-[#1e2a3a] border border-[#3b82f6]/30 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-black text-[#3b82f6]">{initials}</span>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black text-white truncate">{pick.ticker}</p>
          {pick.company && pick.company !== pick.ticker && (
            <p className="text-xs text-white/50 truncate">{pick.company}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e2a3a] border border-white/10 text-sm">
          <span className="text-white/60">↑</span>
          <span className="text-white/70">{c.scoreLabel}:</span>
          <span className="font-bold text-white">{Math.round(pick.score)}/100</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/40 text-sm">
          <span className="text-white/70">{c.targetLabel}:</span>
          <span className="font-bold text-[#10b981]">{targetLabel}</span>
        </span>
      </div>

      {isLoggedIn ? (
        <Link
          href={detailHref}
          className="block w-full text-center py-2.5 px-4 rounded-lg font-semibold text-sm bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
        >
          {c.unlockedCta}
        </Link>
      ) : (
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {c.lockedCta}
        </button>
      )}
      {!isLoggedIn && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span className="text-[11px] text-white/40">{c.googleHint}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-4">
      {CardInner}
      {showModal && (
        <FreeRegisterModal
          locale={locale}
          onClose={() => setShowModal(false)}
          titleOverride={c.modalTitle}
          descriptionOverride={c.modalDesc}
        />
      )}
    </div>
  );
}
