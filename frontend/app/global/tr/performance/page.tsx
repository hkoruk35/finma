import { getMasterData, getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Geçmiş İnteraktif Teknik Grafik Performans Analizi",
  description: "Geçmiş teknik grafik analizlerinin ve gösterge verilerinin performans takibi.",
  alternates: { canonical: "https://bogastock.com/global/tr/performance" },
};

export default async function TrPerformancePage() {
  const [master, performanceData, swingPicksData] = await Promise.all([
    getMasterData(),
    getSwingPerformance(),
    getSwingAllPicks(),
  ]);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#0d1117] text-white p-8 flex items-center justify-center font-bold text-xl uppercase animate-pulse">Performans Verileri Yükleniyor...</div>;
  }

  const fullHistory: any[] = performanceData.history ?? [];
  // Tüm history kullan, slice yok — home banner ile aynı metodoloji:
  // tüm geçmiş (736 tamamlanmış işlem), -%7 SL cap, duplicate ve PENDING hariç.
  const history: any[] = [...fullHistory]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const todayPicks = swingPicksData?.picks ?? [];
  const picksGeneratedAt: string | undefined = swingPicksData?.generated_at ?? swingPicksData?.date;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Ana Sayfa</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Sistem Performansı</span>
        </nav>

        {/* Dashboard Client Component */}
        <div className="relative z-10">
          <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} todayPicks={todayPicks} picksGeneratedAt={picksGeneratedAt} locale="tr" disableTickerLink hideBotLink hideExportButtons applySlPct={-7} />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
