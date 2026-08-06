"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import type { Locale } from "@/lib/i18n/copy";

interface CalendarItem {
  ticker: string;
  companyName: string | null;
  earningsDate: string;
  isEstimate: boolean;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

const LABELS: Record<Locale, {
  title: string;
  subtitle: string;
  empty: string;
  loading: string;
  epsEst: string;
  revEst: string;
  estimated: string;
  confirmed: string;
  viewEarnings: string;
}> = {
  tr: {
    title: "Bilanço Takvimi",
    subtitle: "Önümüzdeki günlerde bilanço açıklaması beklenen şirketler",
    empty: "Önümüzdeki dönemde takvime alınmış bir bilanço bulunmuyor.",
    loading: "Yükleniyor...",
    epsEst: "Tahmini EPS", revEst: "Tahmini Gelir",
    estimated: "Tahmini Tarih", confirmed: "Kesinleşmiş Tarih",
    viewEarnings: "Açıklanmış Bilançoları Gör →",
  },
  en: {
    title: "Earnings Calendar",
    subtitle: "Companies expected to report earnings in the coming days",
    empty: "No scheduled earnings in this period yet.",
    loading: "Loading...",
    epsEst: "EPS Estimate", revEst: "Revenue Estimate",
    estimated: "Estimated Date", confirmed: "Confirmed Date",
    viewEarnings: "View Reported Earnings →",
  },
  es: {
    title: "Calendario de Resultados",
    subtitle: "Empresas que se espera reporten resultados próximamente",
    empty: "Aún no hay resultados programados en este período.",
    loading: "Cargando...",
    epsEst: "BPA Estimado", revEst: "Ingresos Estimados",
    estimated: "Fecha Estimada", confirmed: "Fecha Confirmada",
    viewEarnings: "Ver Resultados Reportados →",
  },
  fr: {
    title: "Calendrier des Résultats",
    subtitle: "Entreprises devant publier leurs résultats prochainement",
    empty: "Aucun résultat prévu dans cette période pour le moment.",
    loading: "Chargement...",
    epsEst: "BPA Estimé", revEst: "Chiffre d'Affaires Estimé",
    estimated: "Date Estimée", confirmed: "Date Confirmée",
    viewEarnings: "Voir les Résultats Publiés →",
  },
  pt: {
    title: "Calendário de Resultados",
    subtitle: "Empresas com expectativa de divulgar resultados em breve",
    empty: "Ainda não há resultados agendados neste período.",
    loading: "Carregando...",
    epsEst: "LPA Estimado", revEst: "Receita Estimada",
    estimated: "Data Estimada", confirmed: "Data Confirmada",
    viewEarnings: "Ver Resultados Divulgados →",
  },
};

function fmtMoney(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
}

function groupByDate(items: CalendarItem[]): [string, CalendarItem[]][] {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) {
    if (!map.has(item.earningsDate)) map.set(item.earningsDate, []);
    map.get(item.earningsDate)!.push(item);
  }
  return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export default function EarningsCalendarBoard({ locale }: { locale: Locale }) {
  const t = LABELS[locale] ?? LABELS.en;
  const [items, setItems] = useState<CalendarItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/earnings-calendar?days=30`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => { if (active) setItems(d.data || []); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, []);

  const grouped = items ? groupByDate(items) : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-[1000px] mx-auto w-full px-4 py-8">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">{t.title}</h1>
            <p className="text-sm text-white/50">{t.subtitle}</p>
          </div>
          <Link
            href={`/global/${locale}/earning`}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6] hover:text-white transition-all"
          >
            {t.viewEarnings}
          </Link>
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

        {grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([date, dayItems]) => (
              <div key={date}>
                <div className="text-[13px] font-bold text-[#3b82f6] uppercase tracking-wide mb-2 pb-2 border-b border-[#1e2a3a]">
                  {new Date(date + "T00:00:00").toLocaleDateString(
                    locale === "tr" ? "tr-TR" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : locale === "pt" ? "pt-BR" : "en-US",
                    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {dayItems.map((item) => (
                    <Link
                      key={item.ticker}
                      href={`/global/${locale}/graphic/${item.ticker}`}
                      className="bg-[#0f1117] border border-[#1e2a3a]/60 rounded-xl p-3 hover:border-[#3b82f6]/40 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{item.ticker}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              item.isEstimate
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30"
                            }`}
                          >
                            {item.isEstimate ? t.estimated : t.confirmed}
                          </span>
                        </div>
                        <div className="text-[11px] text-white/40 truncate">{item.companyName || item.ticker}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-white/40">{t.epsEst}</div>
                        <div className="text-[12px] font-mono font-bold text-white/80">
                          {item.epsEstimate != null ? `$${item.epsEstimate.toFixed(2)}` : "—"}
                        </div>
                        <div className="text-[9px] text-white/30 mt-0.5">{fmtMoney(item.revenueEstimate)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer hidePlatform={true} locale={locale} />
    </div>
  );
}
