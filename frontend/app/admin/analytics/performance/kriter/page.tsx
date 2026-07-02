import { readPublicJson } from "@/lib/data-server";
import {
  getLastNReportDays,
  readArchiveForDate,
  enrichTrade,
  computeAggregateStats,
  computeSignalMatrix,
  computeDailyTrend,
  type PerformanceTrade,
  type EnrichedTrade,
} from "@/lib/kriter-helpers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import KriterDashboard from "@/components/KriterDashboard";
import { Metadata } from "next";

export const revalidate = 14400; // 4 saatte bir ISR

export const metadata: Metadata = {
  title: "Kriter Analizi | BOGA AI",
  description: "Son 10 rapor gününde açılan trade'lerin giriş günü teknik kriterleri ve AI destekli bot optimizasyon analizi.",
  alternates: { canonical: "https://bogastock.com/performance/kriter" },
};

export default async function KriterPage() {
  const perfData = readPublicJson("swing_performance.json");

  if (!perfData?.history) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-bold text-xl uppercase animate-pulse">
        Veri Yükleniyor...
      </div>
    );
  }

  const allHistory: PerformanceTrade[] = perfData.history;
  const reportDays = getLastNReportDays(allHistory, 10);
  const filteredTrades = allHistory.filter((t) => reportDays.includes(t.date));

  const archiveByDate: Record<string, ReturnType<typeof readArchiveForDate>> = {};
  for (const date of reportDays) {
    archiveByDate[date] = readArchiveForDate(date);
  }

  const enrichedTrades: EnrichedTrade[] = filteredTrades.map((t) =>
    enrichTrade(t, archiveByDate[t.date] ?? null)
  );

  const stats = computeAggregateStats(enrichedTrades, reportDays);
  const signal_matrix = computeSignalMatrix(enrichedTrades);
  const daily_trend = computeDailyTrend(enrichedTrades, reportDays);

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <KriterDashboard
          initialTrades={enrichedTrades}
          initialStats={stats}
          initialSignalMatrix={signal_matrix}
          initialDailyTrend={daily_trend}
          reportDays={reportDays}
        />
      </main>
      <Footer />
    </div>
  );
}
