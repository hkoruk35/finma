import { getMasterData, getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import Link from "next/link";
import { Metadata } from "next";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskPerformanceHistory, maskTrendPicks } from "@/lib/pickMasking";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Historial de Rendimiento de Análisis Gráfico Interactivo",
  description: "Seguimiento del historial de rendimiento del análisis gráfico técnico interactivo.",
  alternates: { canonical: "https://bogastock.com/global/es/performance" },
};

export default async function EsPerformancePage() {
  const [master, performanceData, swingPicksData, access] = await Promise.all([
    getMasterData(),
    getSwingPerformance(),
    getSwingAllPicks(),
    getMemberAccess(),
  ]);
  const tier = resolveMemberTierFromAccess(access);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-medium text-xl uppercase animate-pulse">Cargando datos de rendimiento...</div>;
  }

  const fullHistory: any[] = performanceData.history ?? [];
  const sortedHistory: any[] = [...fullHistory]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const history = maskPerformanceHistory(sortedHistory, tier, { anonymousMaskCount: 100, freeMaskCount: 20 });

  const todayPicks = maskTrendPicks(swingPicksData?.picks ?? [], tier, { stripTradePlan: true });
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Inicio</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Rendimiento del Sistema</span>
        </nav>

        <div className="relative z-10">
          <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} todayPicks={todayPicks} picksGeneratedAt={picksGeneratedAt} locale="es" disableTickerLink hideBotLink hideExportButtons applySlPct={-10} />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
