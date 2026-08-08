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
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/global/fr/performance" },
};

export default async function FrPerformancePage() {
  const [master, performanceData, swingPicksData, access] = await Promise.all([
    getMasterData(),
    getSwingPerformance(),
    getSwingAllPicks(),
    getMemberAccess(),
  ]);
  const tier = resolveMemberTierFromAccess(access);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-medium text-xl uppercase animate-pulse">Chargement des données de performance...</div>;
  }

  const fullHistory: any[] = performanceData.history ?? [];
  const sortedHistory: any[] = [...fullHistory].reverse();
  const history = maskPerformanceHistory(sortedHistory, tier, { anonymousMaskCount: 100, freeMaskCount: 20 });
  const todayPicks = maskTrendPicks(swingPicksData?.picks ?? [], tier, { stripTradePlan: true });
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/fr/home" className="hover:text-[#3b82f6] transition-colors">Tableau de Bord</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Performance Historique Complète</span>
        </nav>
        <div className="relative z-10">
          <SwingPerformanceDashboard
            initialHistory={history}
            stats={performanceData.stats}
            todayPicks={todayPicks}
            picksGeneratedAt={picksGeneratedAt}
            locale="fr"
            applySlPct={-10}
          />
        </div>
      </main>
      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
