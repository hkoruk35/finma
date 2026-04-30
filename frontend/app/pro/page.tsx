import { getMasterData, getAllTickers } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import StatsBar from "@/components/StatsBar";
import SectorScreener from "@/components/SectorScreener";
import MarketExplorer from "@/components/MarketExplorer";
import SectorHeatMap from "@/components/SectorHeatMap";
import { Metadata } from "next";
import Link from "next/link";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA PRO | Professional Market Analytics",
  description: "Advanced market analytics, sector heatmaps, and institutional-grade stock screening. The alternative professional dashboard for BOGA AI.",
  alternates: { canonical: "https://bogastock.com/pro" },
};

export default async function ProPage() {
  const [master, allTickers] = await Promise.all([
    getMasterData(),
    getAllTickers()
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
        {/* Pro Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase">
              Market <span className="text-[#3b82f6]">Pro</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-2 max-w-xl">
              Professional-grade market explorer. Real-time sector rotation, heatmaps, and institutional screening filters.
            </p>
          </div>
          
          <Link 
            href="/terminal"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#3b82f6]/20 uppercase tracking-widest text-xs"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Open Terminal
          </Link>
        </div>

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
              <h3 className="text-white font-black text-lg uppercase">Options Scanner</h3>
              <p className="text-slate-500 text-xs">Unusual options activity and flow</p>
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
