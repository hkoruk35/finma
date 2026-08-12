"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";
import FreeRegisterModal from "./FreeRegisterModal";
import Sparkline from "./Sparkline";

interface DailyOnePick {
  ticker: string;
  company: string;
  score: number;
}

interface LiveQuote {
  price: number;
  changePct: number;
  sparkline: number[];
}

// Copy is deliberately neutral: no "opportunity"/"pick", no target-return
// figure, no "catch it" call to action. This card is the ad-facing surface
// on Home (X/Meta ads can point here) and ad platform policy in some
// markets (e.g. X's securities-promotion rules) prohibits framing this as
// an investment tip or implying an expected gain — it's positioned purely
// as a market-data/analysis tool. Any specific target price/gain % is
// reserved for the gated detail page a logged-in member reaches after
// signing up, not shown on this public teaser.
const COPY: Record<Locale, {
  badge: string; scoreLabel: string; dataLabel: string;
  lockedCta: string; unlockedCta: string;
  modalTitle: string; modalDesc: string;
}> = {
  en: {
    badge: "TODAY'S AI MARKET SPOTLIGHT",
    scoreLabel: "AI Model Score",
    dataLabel: "Market Analysis & Data",
    lockedCta: "Sign In Free with Google to Unlock the Full Analysis",
    unlockedCta: "View Full Analysis →",
    modalTitle: "Today's AI Market Spotlight",
    modalDesc: "Sign in with Google or create a free account to see the full chart, technical analysis, and market data.",
  },
  tr: {
    badge: "BUGÜNÜN AI PİYASA ÖNE ÇIKANI",
    scoreLabel: "AI Model Puanı",
    dataLabel: "Piyasa Analizi & Verisi",
    lockedCta: "Tam Analizi Açmak İçin Google ile Ücretsiz Giriş Yap",
    unlockedCta: "Tam Analizi Gör →",
    modalTitle: "Bugünün AI Piyasa Öne Çıkanı",
    modalDesc: "Tam grafiği, teknik analizi ve piyasa verilerini görmek için Google ile giriş yapın veya ücretsiz kaydolun.",
  },
  es: {
    badge: "DESTACADO DE MERCADO AI DE HOY",
    scoreLabel: "Puntuación del Modelo AI",
    dataLabel: "Análisis y Datos de Mercado",
    lockedCta: "Inicia Sesión Gratis con Google para Desbloquear el Análisis Completo",
    unlockedCta: "Ver Análisis Completo →",
    modalTitle: "Destacado de Mercado AI de Hoy",
    modalDesc: "Inicia sesión con Google o crea una cuenta gratuita para ver el gráfico completo, el análisis técnico y los datos de mercado.",
  },
  fr: {
    badge: "TENDANCE MARCHÉ IA DU JOUR",
    scoreLabel: "Score du Modèle IA",
    dataLabel: "Analyse et Données de Marché",
    lockedCta: "Connectez-vous Gratuitement avec Google pour Débloquer l'Analyse Complète",
    unlockedCta: "Voir l'Analyse Complète →",
    modalTitle: "Tendance Marché IA du Jour",
    modalDesc: "Connectez-vous avec Google ou créez un compte gratuit pour voir le graphique complet, l'analyse technique et les données de marché.",
  },
  pt: {
    badge: "DESTAQUE DE MERCADO IA DE HOJE",
    scoreLabel: "Pontuação do Modelo IA",
    dataLabel: "Análise e Dados de Mercado",
    lockedCta: "Entre Grátis com o Google para Desbloquear a Análise Completa",
    unlockedCta: "Ver Análise Completa →",
    modalTitle: "Destaque de Mercado IA de Hoje",
    modalDesc: "Entre com o Google ou crie uma conta gratuita para ver o gráfico completo, a análise técnica e os dados de mercado.",
  },
  id: {
    badge: "SOROTAN PASAR AI HARI INI",
    scoreLabel: "Skor Model AI",
    dataLabel: "Analisis & Data Pasar",
    lockedCta: "Masuk Gratis dengan Google untuk Membuka Analisis Lengkap",
    unlockedCta: "Lihat Analisis Lengkap →",
    modalTitle: "Sorotan Pasar AI Hari Ini",
    modalDesc: "Masuk dengan Google atau buat akun gratis untuk melihat grafik lengkap, analisis teknikal, dan data pasar.",
  },
};

export default function DailyOnePickCard({ locale }: { locale: Locale }) {
  const c = COPY[locale] ?? COPY.en;
  const { plan, loading: planLoading } = useMemberPlan();
  const isLoggedIn = plan !== null;
  const [pick, setPick] = useState<DailyOnePick | null | undefined>(undefined);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
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

  useEffect(() => {
    if (!pick?.ticker) return;
    let active = true;
    fetch(`/api/watchlist-data?tickers=${pick.ticker}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!active) return;
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return;
        // Prefer whichever look-back window (1 week, then 1 day) is
        // currently positive, so the teaser doesn't default to a red
        // reading when a longer/shorter window is green.
        const weekly = row?.price?.change_pct_1w;
        const daily = row?.price?.change_pct ?? row?.tracker_1h?.change_pct_1d;
        const changePct = typeof weekly === "number" && weekly >= 0
          ? weekly
          : (typeof daily === "number" ? daily : (weekly ?? 0));
        setQuote({
          price: row?.price?.current ?? 0,
          changePct,
          sparkline: (row?.recent_closes ?? []).slice(-6),
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, [pick?.ticker]);

  if (pick === undefined || planLoading) {
    return <div className="mt-4 h-[140px] rounded-xl bg-[#0f1117] border border-[#1e2a3a]/60 animate-pulse" />;
  }
  if (pick === null) return null;

  const initials = pick.ticker.slice(0, 4);
  const changePositive = (quote?.changePct ?? 0) >= 0;

  const CardInner = (
    <div className="relative overflow-hidden rounded-xl border border-[#3b82f6]/40 bg-gradient-to-br from-[#0f1c2e] via-[#0f1117] to-[#0f1e17] p-4 sm:p-5">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]" />
      <p className="text-[11px] font-bold text-[#3b82f6] uppercase tracking-[0.2em] mb-3">{c.badge}</p>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1e2a3a] border border-[#3b82f6]/30 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-black text-[#3b82f6]">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-xl font-black text-white truncate">{pick.ticker}</p>
            {pick.company && pick.company !== pick.ticker && (
              <p className="text-xs sm:text-sm text-white/50 truncate">{pick.company}</p>
            )}
          </div>
        </div>

        {quote && (
          <div className="text-right shrink-0">
            <p className="text-base sm:text-2xl font-bold text-white font-mono leading-tight">
              {quote.price ? `$${quote.price.toFixed(2)}` : "—"}
            </p>
            <p className={`text-sm sm:text-lg font-semibold leading-tight ${changePositive ? "!text-[#22c55e]" : "!text-[#ef4444]"}`}>
              {changePositive ? "+" : ""}{quote.changePct.toFixed(2)}%
            </p>
          </div>
        )}
      </div>

      {quote && quote.sparkline.length > 1 && (
        <div className="w-full h-16 sm:h-20 mb-4">
          <Sparkline
            data={quote.sparkline}
            color={changePositive ? "#22c55e" : "#ef4444"}
            changePct={quote.changePct}
            width={400}
            height={64}
            responsive
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e2a3a] border border-white/10 text-sm">
          <span className="text-white/70">{c.scoreLabel}:</span>
          <span className="font-bold text-white">{Math.round(pick.score)}/100</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e2a3a] border border-white/10 text-sm text-white/70">
          {c.dataLabel}
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
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors text-center"
        >
          <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {c.lockedCta}
        </button>
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
