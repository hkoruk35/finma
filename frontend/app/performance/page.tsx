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

        {/* Header Section */}
        <header className="mb-5 relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#3b82f6]/10 blur-[100px] rounded-full" />
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
                 <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-[0.3em]">Institutional Grade</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
                SWING <span className="text-[#3b82f6]">PERFORMANS</span> RAPORU
              </h1>
              <p className="text-slate-500 text-xs mt-1.5 max-w-2xl font-medium leading-relaxed">
                Algoritmik swing modellerimizin tüm tarihsel sinyal kayıtları. Şeffaflık ilkemiz gereği her başarılı ve başarısız setup, bot tarafından hesaplanan Stop-Loss verileriyle birlikte listelenir.
              </p>
            </div>
          </div>
        </header>

        {/* Kriter Analizi Butonu */}
        <div className="mb-4 flex">
          <Link
            href="/performance/kriter"
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-[#3b82f6]/40 text-[#3b82f6] text-xs font-mono font-bold hover:bg-[#3b82f6]/10 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
            KRİTER ANALİZİ — swing117 bot optimizasyon raporu
            <span className="opacity-60">→</span>
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
