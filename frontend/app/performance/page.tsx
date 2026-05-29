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
    return <div className="min-h-screen bg-[#080b12] text-white p-8 flex items-center justify-center font-bold text-xl uppercase animate-pulse">Loading Performance Data...</div>;
  }

  const history: any[] = performanceData.history ?? [];
  const todayPicks = swingPicksData?.picks ?? [];
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#080b12]">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/" className="hover:text-[#3b82f6] transition-colors">Ana Sayfa</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Sistem Performansı</span>
        </nav>

        {/* Header + Bot Analiz Butonu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
            BOGA AI <span className="text-[#3b82f6]">SWING ENGINE</span> PERFORMANCE SYSTEM
          </h1>
          <Link
            href="/performance/kriter"
            className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/20 hover:border-[#3b82f6]/60 transition-all duration-200 shrink-0"
          >
            <span className="relative flex items-center justify-center w-5 h-5 rounded-md bg-[#3b82f6]/20 border border-[#3b82f6]/40 group-hover:bg-[#3b82f6]/30">
              <svg className="w-3 h-3 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            </span>
            <span className="text-[11px] font-black text-[#3b82f6] uppercase tracking-widest">BOT ANALİZ SİSTEMİ</span>
            <svg className="w-3 h-3 text-[#3b82f6]/60 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>

        {/* Dashboard Client Component */}
        <div className="relative z-10">
          <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} todayPicks={todayPicks} picksGeneratedAt={picksGeneratedAt} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
