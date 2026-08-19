import { Metadata } from "next";
import { getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Link from "next/link";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskPerformanceHistory, maskTrendPicks } from "@/lib/pickMasking";

export const revalidate = 86400; // Updated once a day

export const metadata: Metadata = {
  title: "Swingperformance",
  alternates: { canonical: "https://bogastock.com/global/es/swingperformance", languages: {
      en: "https://bogastock.com/global/en/swingperformance",
      es: "https://bogastock.com/global/es/swingperformance",
      fr: "https://bogastock.com/global/fr/swingperformance",
      id: "https://bogastock.com/global/id/swingperformance",
      pt: "https://bogastock.com/global/pt/swingperformance",
      tr: "https://bogastock.com/global/tr/swingperformance",
      "x-default": "https://bogastock.com/global/en/swingperformance",
    } }
};


const LAST_N_DAYS = 10;

export default async function EsSwingPerformancePage() {
  const [performanceData, swingPicksData, access] = await Promise.all([
    getSwingPerformance(),
    getSwingAllPicks(),
    getMemberAccess(),
  ]);
  const tier = resolveMemberTierFromAccess(access);

  if (!performanceData) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-medium text-xl uppercase animate-pulse">
        Cargando datos de rendimiento...
      </div>
    );
  }

  const fullHistory: any[] = performanceData.history ?? [];
  const uniqueDates = Array.from(new Set(fullHistory.map((t) => t.date))).sort((a, b) => b.localeCompare(a));
  const recentDates = new Set(uniqueDates.slice(0, LAST_N_DAYS));
  const recentHistory = fullHistory.filter((t) => recentDates.has(t.date));
  const history = maskPerformanceHistory(recentHistory, tier, { anonymousMaskCount: 100, freeMaskCount: 20 });

  const todayPicks = maskTrendPicks(swingPicksData?.picks ?? [], tier, { stripTradePlan: true });
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/watchlist" className="hover:text-[#3b82f6] transition-colors">Watchlist</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Rendimiento de Acciones en Tendencia — Últimos 10 Días</span>
        </nav>

        <div className="relative z-10">
          <SwingPerformanceDashboard
            initialHistory={history}
            stats={performanceData.stats}
            todayPicks={todayPicks}
            picksGeneratedAt={picksGeneratedAt}
            hideBotLink
            locale="es"
          />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
