import { getMasterData, getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Swing Engine Performance | BOGA AI",
  description: "Detailed performance records for the BOGA AI Swing Engine. Transparent historical trading data.",
  alternates: { canonical: "https://bogastock.com/performance" },
};

export default async function SwingPerformancePage() {
  const [master, performanceData, swingPicksData] = await Promise.all([
    getMasterData(),
    getSwingPerformance(),
    getSwingAllPicks(),
  ]);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#000036] text-white p-8 flex items-center justify-center font-bold text-xl uppercase animate-pulse">Loading Performance Data...</div>;
  }

  const history: any[] = performanceData.history ?? [];
  const todayPicks = swingPicksData?.picks ?? [];
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/" className="hover:text-[#3b82f6] transition-colors">Ana Sayfa</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Sistem Performansı</span>
        </nav>

        {/* Dashboard Client Component */}
        <div className="relative z-10">
          <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} todayPicks={todayPicks} picksGeneratedAt={picksGeneratedAt} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
