import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance, getOptionsData, getOptionsOutcomes, StockQuickView } from "@/lib/data";
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

  // Compile a comprehensive map of all tickers in the system mapped to their GICS sector, company name, current change_pct, and score.
  const tickerMap = new Map<string, { sector: string; company: string; change_pct: number; score: number; volume: number }>();

  // Helper to map different sector naming conventions to GICS standard sector names used in SectorHeatMap's SECTOR_ORDER
  const normalizeGicsSector = (sec: string | undefined): string => {
    if (!sec) return "Other";
    const s = sec.trim();
    if (s === "Basic Materials") return "Materials";
    if (s === "Consumer Defensive") return "Consumer Staples";
    if (s === "Consumer Cyclical") return "Consumer Discretionary";
    if (s === "Financial Services") return "Financials";
    return s;
  };

  // 1. Load from MARKET_THEMES (config.py)
  MARKET_THEMES.forEach(theme => {
    const rawSector = theme.sector === "Sectors" ? theme.name : theme.sector;
    const sectorName = normalizeGicsSector(rawSector);
    theme.tickers.forEach(t => {
      if (!t) return;
      const key = t.toUpperCase();
      tickerMap.set(key, {
        sector: sectorName,
        company: t,
        change_pct: 0,
        score: 50,
        volume: 0
      });
    });
  });

  // 2. Load from allTickers
  allTickers.forEach(t => {
    if (!t.ticker) return;
    const key = t.ticker.toUpperCase();
    const existing = tickerMap.get(key);
    tickerMap.set(key, {
      sector: normalizeGicsSector(t.sector) || existing?.sector || "Other",
      company: t.company || existing?.company || t.ticker,
      change_pct: t.change_pct ?? existing?.change_pct ?? 0,
      score: t.master_score ?? existing?.score ?? 50,
      volume: t.volume ?? existing?.volume ?? 0
    });
  });

  // 3. Load from swingPicks
  if (swingPicks && Array.isArray(swingPicks.picks)) {
    swingPicks.picks.forEach((p: any) => {
      if (!p.ticker) return;
      const key = p.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(p.sector) || existing?.sector || "Other",
        company: p.company || existing?.company || p.ticker,
        change_pct: p.change_1d ?? p.change_pct ?? existing?.change_pct ?? 0,
        score: p.score ?? existing?.score ?? 50,
        volume: p.volume ?? existing?.volume ?? 0
      });
    });
  }

  // 4. Load from swingStats history (highly populated with sectors & historical returns)
  if (swingStats && Array.isArray(swingStats.history)) {
    swingStats.history.forEach((h: any) => {
      if (!h.ticker) return;
      const key = h.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      // We can use the historical return_pct as a proxy for ticker performance if daily change_pct is not active
      const changeVal = existing?.change_pct !== 0 ? existing?.change_pct : (h.return_pct ?? 0);
      tickerMap.set(key, {
        sector: normalizeGicsSector(h.sector) || existing?.sector || "Other",
        company: h.company || existing?.company || h.ticker,
        change_pct: changeVal ?? 0,
        score: existing?.score ?? 50,
        volume: existing?.volume ?? 0
      });
    });
  }

  // 5. Load from optionsData
  if (optionsData && Array.isArray(optionsData.picks)) {
    optionsData.picks.forEach((p: any) => {
      if (!p.ticker) return;
      const key = p.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(p.sector_info?.sector || p.sector) || existing?.sector || "Other",
        company: existing?.company || p.ticker,
        change_pct: p.change_pct ?? existing?.change_pct ?? 0,
        score: p.score ?? existing?.score ?? 50,
        volume: p.volume ?? existing?.volume ?? 0
      });
    });
  }

  // 6. Load from optionsOutcomes
  if (optionsOutcomes && Array.isArray(optionsOutcomes.positions)) {
    optionsOutcomes.positions.forEach((pos: any) => {
      if (!pos.ticker) return;
      const key = pos.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(pos.sector) || existing?.sector || "Other",
        company: existing?.company || pos.ticker,
        change_pct: pos.pnl_pct ?? existing?.change_pct ?? 0,
        score: pos.score ?? existing?.score ?? 50,
        volume: existing?.volume ?? 0
      });
    });
  }

  // Create activeTickers array
  const combinedTickers = Array.from(tickerMap.keys());

  // Create a comprehensive list of StockQuickView elements for SectorHeatMap
  const comprehensiveTickersList: StockQuickView[] = Array.from(tickerMap.entries()).map(([ticker, val]) => ({
    ticker,
    company: val.company,
    sector: val.sector,
    master_score: val.score,
    score_type: "NEUTRAL_STAY",
    price: 0,
    change_pct: val.change_pct,
    entry_range_low: 0,
    entry_range_high: 0,
    volume: val.volume,
    ai_short_summary: ""
  }));

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
          <SectorHeatMap data={master} allTickers={comprehensiveTickersList} />
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
