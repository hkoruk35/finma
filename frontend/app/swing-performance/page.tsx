import { getMasterData, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Swing Engine Performance | BOGA AI",
  description: "Detailed performance records for the BOGA AI Swing Engine. Transparent historical trading data.",
  alternates: { canonical: "https://bogastock.com/swing-performance" },
};

export default async function SwingPerformancePage() {
  const [master, performanceData] = await Promise.all([
    getMasterData(),
    getSwingPerformance()
  ]);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#080b12] text-white p-8 flex items-center justify-center font-bold text-xl uppercase animate-pulse">Loading Performance Data...</div>;
  }

  const history: any[] = performanceData.history ?? [];
  
  return (
    <div className="min-h-screen flex flex-col bg-[#080b12]">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8">
          <Link href="/" className="hover:text-[#3b82f6] transition-colors">Ana Sayfa</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Sistem Performansı</span>
        </nav>

        {/* Header Section */}
        <header className="mb-12 relative">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#3b82f6]/10 blur-[100px] rounded-full" />
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]" />
                 <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-[0.3em]">Institutional Grade</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                SWING <span className="text-[#3b82f6]">PERFORMANS</span> RAPORU
              </h1>
              <p className="text-slate-500 text-sm mt-4 max-w-2xl font-medium leading-relaxed">
                Algoritmik swing modellerimizin tüm tarihsel sinyal kayıtları. Şeffaflık ilkemiz gereği her başarılı ve başarısız setup, bot tarafından hesaplanan Stop-Loss verileriyle birlikte listelenir.
              </p>
            </div>
          </div>
        </header>

        {/* Dashboard Client Component */}
        <div className="relative z-10">
          <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
