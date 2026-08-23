"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

interface DailyOnePick {
  ticker: string;
  company: string;
  score: number;
  targetPct: number;
  currentPrice: number;
  targetPrice: number;
}

const COPY: Record<Locale, {
  badge: string; scoreLabel: string; targetLabel: string;
  lockedTitle: string; lockedDesc: string; lockedCta: string;
  loading: string; empty: string;
}> = {
  en: {
    badge: "Today's Trending Stocks",
    scoreLabel: "BS Score",
    targetLabel: "AI Target Gain",
    lockedTitle: "Unlock the Full Breakdown",
    lockedDesc: "Sign in with Google or create a free account to see the chart, technical analysis, and full trade plan.",
    lockedCta: "Sign Up Free to Unlock",
    loading: "Loading today's trending stocks...",
    empty: "No picks are available right now — check back soon.",
  },
  tr: {
    badge: "Günün Trend Hisselerinden",
    scoreLabel: "BS Puanı",
    targetLabel: "AI Hedef Kazanç",
    lockedTitle: "Tam Analizi Açın",
    lockedDesc: "Grafiği, teknik analizi ve tam işlem kurgusunu görmek için Google ile giriş yapın veya ücretsiz kaydolun.",
    lockedCta: "Açmak İçin Ücretsiz Kaydol",
    loading: "Günün trend hisseleri yükleniyor...",
    empty: "Şu anda uygun bir hisse yok — kısa süre sonra tekrar kontrol edin.",
  },
  es: {
    badge: "Acciones en Tendencia de Hoy",
    scoreLabel: "Puntuación BS",
    targetLabel: "Ganancia Objetivo AI",
    lockedTitle: "Desbloquea el Análisis Completo",
    lockedDesc: "Inicia sesión con Google o crea una cuenta gratuita para ver el gráfico, el análisis técnico y el plan de operación completo.",
    lockedCta: "Regístrate Gratis para Desbloquear",
    loading: "Cargando las acciones en tendencia de hoy...",
    empty: "No hay ninguna selección disponible ahora — vuelve pronto.",
  },
  fr: {
    badge: "Actions Tendance du Jour",
    scoreLabel: "Score BS",
    targetLabel: "Gain Cible IA",
    lockedTitle: "Débloquez l'Analyse Complète",
    lockedDesc: "Connectez-vous avec Google ou créez un compte gratuit pour voir le graphique, l'analyse technique et le plan de trading complet.",
    lockedCta: "Inscrivez-vous Gratuitement",
    loading: "Chargement des actions tendance du jour...",
    empty: "Aucune sélection disponible pour le moment — revenez bientôt.",
  },
  pt: {
    badge: "Ações em Tendência de Hoje",
    scoreLabel: "Pontuação BS",
    targetLabel: "Ganho Alvo IA",
    lockedTitle: "Desbloqueie a Análise Completa",
    lockedDesc: "Entre com o Google ou crie uma conta gratuita para ver o gráfico, a análise técnica e o plano de operação completo.",
    lockedCta: "Cadastre-se Grátis para Desbloquear",
    loading: "Carregando as ações em tendência de hoje...",
    empty: "Nenhuma seleção disponível agora — volte em breve.",
  },
  id: {
    badge: "Saham Tren Hari Ini",
    scoreLabel: "Skor BS",
    targetLabel: "Target Keuntungan AI",
    lockedTitle: "Buka Analisis Lengkap",
    lockedDesc: "Masuk dengan Google atau buat akun gratis untuk melihat grafik, analisis teknikal, dan rencana perdagangan lengkap.",
    lockedCta: "Daftar Gratis untuk Membuka",
    loading: "Memuat saham tren hari ini...",
    empty: "Belum ada saham tersedia saat ini — periksa kembali nanti.",
  },
};

// 2026-08-23: bu sayfa artik giris yapmamis ziyaretciye de acik — ana
// sayfadaki "Gunun Trend Hisselerinden" karti Google/anonim ziyaretciye de
// tikanabilir olsun diye eskiden buradaki "Google ile giris yap" duvari
// kaldirildi (kullanici talebi: "Detay sayfasini da anonim kullaniciya ac.
// Siteye giren herkes ulassin.").
export default function DailyOneDetailContent({ locale }: { locale: Locale }) {
  const c = COPY[locale] ?? COPY.en;
  const searchParams = useSearchParams();
  const requestedTicker = searchParams?.get("ticker")?.toUpperCase();
  const { loading: planLoading } = useMemberPlan();
  const [picks, setPicks] = useState<DailyOnePick[] | undefined>(undefined);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/daily-one", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const list: DailyOnePick[] = Array.isArray(d?.picks) ? d.picks : [];
        setPicks(list);
        const match = requestedTicker ? list.find((p) => p.ticker === requestedTicker) : undefined;
        setActiveTicker((match ?? list[0])?.ticker ?? null);
      })
      .catch(() => { if (active) setPicks([]); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = picks?.find((p) => p.ticker === activeTicker) ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <p className="text-sm font-bold text-[#3b82f6] tracking-tight mb-2">{c.badge}</p>

        {picks === undefined || planLoading ? (
          <div className="h-[400px] rounded-xl bg-[#0f1117] border border-[#1e2a3a]/60 animate-pulse" />
        ) : picks.length === 0 || !active ? (
          <div className="glass-card p-10 text-center text-white/60">{c.empty}</div>
        ) : (
          <>
            {picks.length > 1 && (
              <div className="flex gap-2 mb-4">
                {picks.map((p) => (
                  <button
                    key={p.ticker}
                    onClick={() => setActiveTicker(p.ticker)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                      p.ticker === active.ticker
                        ? "bg-[#3b82f6] border-[#3b82f6] text-white"
                        : "bg-[#1e2a3a] border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    {p.ticker}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <h1 className="text-3xl md:text-4xl font-black text-white">{active.ticker}</h1>
              {active.company && active.company !== active.ticker && (
                <span className="text-white/50">{active.company}</span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e2a3a] border border-white/10 text-sm">
                <span className="text-white/70">{c.scoreLabel}:</span>
                <span className="font-bold text-white">{Math.round(active.score)}/100</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/40 text-sm">
                <span className="text-white/70">{c.targetLabel}:</span>
                <span className="font-bold text-[#10b981]">
                  {active.targetPct >= 0 ? "+" : ""}{active.targetPct.toFixed(1)}%
                </span>
              </span>
            </div>

            <div className="glass-card overflow-hidden mb-4" style={{ minHeight: isMobile === null ? 420 : undefined }}>
              {isMobile !== null && (
                <BogaChartEngine
                  symbol={active.ticker}
                  lang={locale}
                  detailMode
                  height={isMobile ? 420 : 600}
                  defaultTimeframe="D"
                  premiumGate={false}
                />
              )}
            </div>
            <div className="glass-card overflow-hidden">
              <TickerDetailPanel ticker={active.ticker} locale={locale} hideChart hidePermalink />
            </div>
          </>
        )}
      </main>
      <Footer hidePlatform locale={locale} />
    </div>
  );
}
