"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import type { Locale } from "@/lib/i18n/copy";

type Range = "daily" | "weekly" | "monthly";

interface EarningsAi {
  summary: string;
  revenue_status: string;
  eps_status: string;
  key_takeaways: string[];
  bullish_signals: string[];
  bearish_signals: string[];
  ai_score: number;
}

interface EarningsItem {
  id: string;
  ticker: string;
  companyName: string;
  period: string;
  reportDate: string;
  formType: string;
  ai: EarningsAi | null;
}

const LABELS: Record<Locale, {
  title: string;
  subtitle: string;
  daily: string;
  weekly: string;
  monthly: string;
  empty: string;
  loading: string;
  revenue: string;
  eps: string;
  score: string;
  keyTakeaways: string;
  bullish: string;
  bearish: string;
  source: string;
  viewCalendar: string;
}> = {
  tr: {
    title: "Bilançolar",
    subtitle: "SEC EDGAR bildirimlerinden, yapay zekâ destekli otomatik analiz",
    viewCalendar: "Bilanço Takvimini Gör →",
    daily: "Günlük", weekly: "Haftalık", monthly: "Aylık",
    empty: "Bu aralıkta henüz işlenmiş bir bilanço bulunmuyor.",
    loading: "Yükleniyor...",
    revenue: "Gelir", eps: "Hisse Başı Kâr", score: "BOGA AI Skoru",
    keyTakeaways: "Öne Çıkanlar", bullish: "Boğa Sinyalleri", bearish: "Ayı Sinyalleri",
    source: "Kaynak: SEC EDGAR",
  },
  en: {
    title: "Earnings",
    subtitle: "AI-powered analysis, sourced directly from SEC EDGAR filings",
    viewCalendar: "View Earnings Calendar →",
    daily: "Daily", weekly: "Weekly", monthly: "Monthly",
    empty: "No processed earnings reports in this range yet.",
    loading: "Loading...",
    revenue: "Revenue", eps: "EPS", score: "BOGA AI Score",
    keyTakeaways: "Key Takeaways", bullish: "Bullish Signals", bearish: "Bearish Signals",
    source: "Source: SEC EDGAR",
  },
  es: {
    title: "Resultados Financieros",
    subtitle: "Análisis impulsado por IA, basado en presentaciones de SEC EDGAR",
    viewCalendar: "Ver Calendario de Resultados →",
    daily: "Diario", weekly: "Semanal", monthly: "Mensual",
    empty: "Aún no hay resultados procesados en este rango.",
    loading: "Cargando...",
    revenue: "Ingresos", eps: "BPA", score: "Puntuación BOGA AI",
    keyTakeaways: "Puntos Clave", bullish: "Señales Alcistas", bearish: "Señales Bajistas",
    source: "Fuente: SEC EDGAR",
  },
  fr: {
    title: "Résultats Financiers",
    subtitle: "Analyse alimentée par l'IA, basée sur les dépôts SEC EDGAR",
    viewCalendar: "Voir le Calendrier des Résultats →",
    daily: "Quotidien", weekly: "Hebdomadaire", monthly: "Mensuel",
    empty: "Aucun résultat traité dans cette période pour le moment.",
    loading: "Chargement...",
    revenue: "Chiffre d'Affaires", eps: "BPA", score: "Score BOGA AI",
    keyTakeaways: "Points Clés", bullish: "Signaux Haussiers", bearish: "Signaux Baissiers",
    source: "Source : SEC EDGAR",
  },
  pt: {
    title: "Resultados Financeiros",
    subtitle: "Análise com IA, baseada em registros da SEC EDGAR",
    viewCalendar: "Ver Calendário de Resultados →",
    daily: "Diário", weekly: "Semanal", monthly: "Mensal",
    empty: "Ainda não há resultados processados neste intervalo.",
    loading: "Carregando...",
    revenue: "Receita", eps: "LPA", score: "Pontuação BOGA AI",
    keyTakeaways: "Principais Pontos", bullish: "Sinais de Alta", bearish: "Sinais de Baixa",
    source: "Fonte: SEC EDGAR",
  },
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

export default function EarningsBoard({ locale }: { locale: Locale }) {
  const t = LABELS[locale] ?? LABELS.en;
  const [range, setRange] = useState<Range>("monthly");
  const [items, setItems] = useState<EarningsItem[] | null>(null);

  useEffect(() => {
    let active = true;
    setItems(null);
    fetch(`/api/earnings?range=${range}&locale=${locale}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => { if (active) setItems(d.data || []); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [range, locale]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 py-8">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">{t.title}</h1>
            <p className="text-sm text-white/50">{t.subtitle}</p>
          </div>
          <Link
            href={`/global/${locale}/earning-calendar`}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6] hover:text-white transition-all"
          >
            {t.viewCalendar}
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {(["monthly", "weekly", "daily"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold uppercase tracking-wide transition-all ${
                range === r
                  ? "bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                  : "bg-[#0f1117] text-[#64748b] border border-[#1e2a3a] hover:text-white hover:border-[#3b82f6]/40"
              }`}
            >
              {t[r]}
            </button>
          ))}
        </div>

        {items === null && (
          <div className="flex items-center justify-center py-24">
            <span className="text-[#3b82f6] font-mono text-sm animate-pulse">{t.loading}</span>
          </div>
        )}

        {items !== null && items.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <p className="text-white/40 text-sm">{t.empty}</p>
          </div>
        )}

        {items !== null && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => {
              const ai = item.ai;
              const revenuePositive = ai?.revenue_status && !/below|altı|bajas?|baisse|baixo/i.test(ai.revenue_status);
              return (
                <div
                  key={item.id}
                  className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl p-4 hover:border-[#3b82f6]/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">{item.ticker}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 uppercase">
                          {item.formType}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/40 truncate max-w-[220px]">{item.companyName}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-white/40">{item.period}</div>
                      <div className="text-[10px] text-white/30 font-mono">{item.reportDate}</div>
                    </div>
                  </div>

                  {ai && (
                    <>
                      <p className="text-[12px] text-white/70 leading-relaxed mb-3">{ai.summary}</p>

                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: revenuePositive ? "#22c55e" : "#ef4444",
                            backgroundColor: revenuePositive ? "#22c55e15" : "#ef444415",
                          }}
                        >
                          {t.revenue}: {ai.revenue_status}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/70">
                          {t.eps}: {ai.eps_status}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                          {t.score}: {ai.ai_score}/10
                        </span>
                      </div>

                      {ai.key_takeaways?.length > 0 && (
                        <div className="mb-2">
                          <div className="text-[10px] font-bold text-white/40 uppercase tracking-wide mb-1">{t.keyTakeaways}</div>
                          <ul className="space-y-0.5">
                            {ai.key_takeaways.map((k, i) => (
                              <li key={i} className="text-[11px] text-white/60 flex gap-1.5">
                                <span className="text-[#3b82f6]">•</span>
                                <span>{k}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#1e2a3a]/60">
                        {ai.bullish_signals?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-[#22c55e] uppercase tracking-wide mb-1">{t.bullish}</div>
                            <ul className="space-y-0.5">
                              {ai.bullish_signals.map((s, i) => (
                                <li key={i} className="text-[10px] text-white/50">↑ {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ai.bearish_signals?.length > 0 && (
                          <div>
                            <div className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wide mb-1">{t.bearish}</div>
                            <ul className="space-y-0.5">
                              {ai.bearish_signals.map((s, i) => (
                                <li key={i} className="text-[10px] text-white/50">↓ {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="mt-3 text-[9px] text-white/25">{t.source}</div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer hidePlatform={true} locale={locale} />
    </div>
  );
}
