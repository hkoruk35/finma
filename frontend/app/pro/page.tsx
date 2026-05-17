import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import StatsBar from "@/components/StatsBar";
import SectorScreener from "@/components/SectorScreener";
import MarketExplorer from "@/components/MarketExplorer";
import SectorHeatMap from "@/components/SectorHeatMap";
import TopSwingPicks from "@/components/TopSwingPicks";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import SectorPerformanceHeatMap from "@/components/SectorPerformanceHeatMap";
import { Metadata } from "next";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA PRO | Professional Market Analytics",
  description: "Advanced market analytics, sector heatmaps, and institutional-grade stock screening. The alternative professional dashboard for BOGA AI.",
  alternates: { canonical: "https://bogastock.com/pro" },
};

export default async function ProPage() {
  const [master, allTickers, swingPicks, swingStats] = await Promise.all([
    getMasterData(),
    getAllTickers(),
    getSwingPicks(),
    getSwingPerformance()
  ]);

  if (!master) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Loading professional data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#060a12]">
      <TickerTape data={master} />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">


        {/* Swing Performance Stats from Homepage */}
        <section className="mb-12">
          <SwingPerformanceBanner stats={swingStats?.stats} />
          <SectorPerformanceHeatMap history={swingStats?.history || []} />
        </section>

        {/* Top 3 Swing of the Day from Homepage */}
        <section className="mb-4">
          <TopSwingPicks picks={swingPicks?.picks || []} allTickers={allTickers} minimal={true} />
        </section>

        {/* Stats Bar */}
        <section className="mb-12">
          <StatsBar data={master} />
        </section>

        {/* Market Themes & Category Tabs Explorer */}
        <section className="mb-16">
           <div className="flex items-center gap-3 mb-6">
             <div className="w-1 h-8 bg-[#3b82f6] rounded-full" />
             <h2 className="text-2xl font-black text-white uppercase tracking-tight">Market Categories</h2>
           </div>
           <MarketExplorer master={master} allTickers={allTickers} />
        </section>

        {/* Sector Heat Map */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-1 h-8 bg-emerald-500 rounded-full" />
             <h2 className="text-2xl font-black text-white uppercase tracking-tight">Sector Heatmap</h2>
           </div>
          <SectorHeatMap data={master} allTickers={allTickers} />
        </section>

        {/* Smart Sector Screener */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-1 h-8 bg-amber-500 rounded-full" />
             <h2 className="text-2xl font-black text-white uppercase tracking-tight">Institutional Screener</h2>
           </div>
          <SectorScreener />
        </section>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 gap-6 mt-20 mb-10">
          <Link href="/options" className="glass-card p-6 flex items-center justify-between group hover:bg-[#3b82f6]/5 transition-colors">
            <div>
              <h3 className="text-white font-black text-lg uppercase">Option Scanner</h3>
              <p className="text-slate-500 text-xs">Winner Formula: Sector + PE + BP + Flow</p>
            </div>
            <span className="text-[#3b82f6] group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <Link href="/ai" className="glass-card p-6 flex items-center justify-between group hover:bg-[#a78bfa]/5 transition-colors">
            <div>
              <h3 className="text-white font-black text-lg uppercase">BOGA AI Analysis</h3>
              <p className="text-slate-500 text-xs">Daily algorithmic stock scores</p>
            </div>
            <span className="text-[#a78bfa] group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
