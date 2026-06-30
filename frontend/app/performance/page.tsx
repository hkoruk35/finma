import { getMasterData, getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import { getAllTop100Tickers } from "@/lib/homeFeed";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Swing Engine Performance | BOGA AI",
  description: "Detailed performance records for the BOGA AI Swing Engine. Transparent historical trading data.",
  alternates: { canonical: "https://bogastock.com/performance" },
};

export default async function SwingPerformancePage() {
  const [master, performanceData, swingPicksData, top100Tickers] = await Promise.all([
    getMasterData(),
    getSwingPerformance(),
    getSwingAllPicks(),
    getAllTop100Tickers(100),
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

        {/* Performance Banner */}
        <SwingPerformanceBanner stats={performanceData.stats} />

        {/* Top 100 Stocks Section */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Top 100 Stocks by Volume</h2>
            <p className="text-sm text-slate-400">Real-time tracking of the most actively traded stocks</p>
          </div>

          {/* Stocks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {top100Tickers.map((stock) => (
              <Link
                key={stock.ticker}
                href={`/ticker/${stock.ticker}`}
                className="group p-3 rounded-lg border border-slate-700 bg-slate-900/30 hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white group-hover:text-[#3b82f6]">{stock.ticker}</span>
                  <span className={`text-xs font-bold ${stock.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400 mb-1">{stock.sector}</div>
                <div className="text-xs font-mono text-slate-300">${stock.price.toFixed(2)}</div>
              </Link>
            ))}
          </div>
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
