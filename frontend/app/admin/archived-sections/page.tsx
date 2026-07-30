import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import StatsBar from "@/components/StatsBar";
import SectorScreener from "@/components/SectorScreener";
import MarketExplorer from "@/components/MarketExplorer";
import SectorHeatMap from "@/components/SectorHeatMap";
import AIWidget from "@/components/AIWidget";

export default async function ArchivedSectionsPage() {
  const [master, allTickers] = await Promise.all([
    getMasterData(),
    getAllTickers()
  ]);

  if (!master) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TickerTape data={master} />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <section className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 text-center">
          <p className="font-medium">ARCHIVED SECTIONS</p>
          <p className="text-xs">These sections are currently hidden from the homepage.</p>
        </section>

        {/* AI Widget */}
        <section className="mb-10">
          <AIWidget />
        </section>

        {/* Hero */}
        <section className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
            Find the Best US Stocks
            <span className="text-[#3b82f6]"> with BOGA AI</span>
          </h1>
        </section>

        {/* Stats Bar */}
        <section className="mb-10">
          <StatsBar data={master} />
        </section>

        {/* Smart Sector Screener */}
        <section className="mb-12">
          <SectorScreener />
        </section>

        {/* Market Themes & Category Tabs Explorer */}
        <section className="mb-12">
           <MarketExplorer master={master} allTickers={allTickers} />
        </section>

        {/* Sector Heat Map */}
        <section className="mb-10">
          <SectorHeatMap data={master} allTickers={allTickers} />
        </section>

        {/* Trading Disciplines */}
        <section className="mb-12">
            <div className="glass-card p-8 border-l-4 border-l-[#f59e0b]">
                <h2 className="text-2xl font-black text-white mb-4">Trading Disciplines</h2>
                <p className="text-white leading-relaxed text-sm">
                    Our AI categorizes stocks into five distinct trading regimes to suit your strategy:
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                    {[
                    { tag: "Breakout", color: "text-[#22c55e]" },
                    { tag: "Momentum", color: "text-[#3b82f6]" },
                    { tag: "Undervalued", color: "text-[#f59e0b]" },
                    { tag: "Reversal", color: "text-[#8b5cf6]" },
                    { tag: "Passive Income", color: "text-[#10b981]" }
                    ].map((cat) => (
                    <div key={cat.tag} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${cat.color.replace('text-', 'bg-')}`} />
                        <span className={`text-[13px] font-black uppercase tracking-wider ${cat.color}`}>{cat.tag}</span>
                    </div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
