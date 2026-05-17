import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance, getOptionsData, getOptionsOutcomes } from "@/lib/data";
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
import { MARKET_THEMES } from "@/lib/themeData";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA PRO | Professional Market Analytics",
  description: "Advanced market analytics, sector heatmaps, and institutional-grade stock screening. The alternative professional dashboard for BOGA AI.",
  alternates: { canonical: "https://bogastock.com/pro" },
};

export default async function ProPage() {
  const [master, allTickers, swingPicks, swingStats, optionsData, optionsOutcomes] = await Promise.all([
    getMasterData(),
    getAllTickers(),
    getSwingPicks(),
    getSwingPerformance(),
    getOptionsData("latest"),
    getOptionsOutcomes()
  ]);

  if (!master) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Loading professional data...</p>
      </div>
    );
  }

  // Combine ALL stocks from: allTickers + MARKET_THEMES (config.py) + swingPicks + swingStats + optionsData + optionsOutcomes
  const combinedTickersSet = new Set<string>();
  
  // 1. allTickers
  allTickers.forEach(t => { if (t.ticker) combinedTickersSet.add(t.ticker.toUpperCase()); });
  
  // 2. config.py (MARKET_THEMES)
  MARKET_THEMES.forEach(theme => {
    theme.tickers.forEach(t => { if (t) combinedTickersSet.add(t.toUpperCase()); });
  });
  
  // 3. swingPicks
  if (swingPicks && Array.isArray(swingPicks.picks)) {
    swingPicks.picks.forEach((p: any) => { if (p.ticker) combinedTickersSet.add(p.ticker.toUpperCase()); });
  }
  
  // 4. swingStats
  if (swingStats && Array.isArray(swingStats.history)) {
    swingStats.history.forEach((h: any) => { if (h.ticker) combinedTickersSet.add(h.ticker.toUpperCase()); });
  }
  
  // 5. optionsData
  if (optionsData && Array.isArray(optionsData.picks)) {
    optionsData.picks.forEach((p: any) => { if (p.ticker) combinedTickersSet.add(p.ticker.toUpperCase()); });
  }
  
  // 6. optionsOutcomes
  if (optionsOutcomes && Array.isArray(optionsOutcomes.positions)) {
    optionsOutcomes.positions.forEach((pos: any) => { if (pos.ticker) combinedTickersSet.add(pos.ticker.toUpperCase()); });
  }

  const combinedTickers = Array.from(combinedTickersSet);

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
           <MarketExplorer master={master} allTickers={allTickers} customActiveTickers={combinedTickers} />
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
