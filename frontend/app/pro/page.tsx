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

  const getDynamicScoreType = (score: number, setup: string): string => {
    const s = setup.toUpperCase();
    if (s.includes("BREAKOUT")) return "BREAKOUT";
    if (s.includes("MOMENTUM")) return "MOMENTUM";
    if (s.includes("TREND")) return "TREND_CONT";
    if (s.includes("REVERSAL")) return "REVERSAL";
    if (s.includes("AWAKENING")) return "AWAKENING";
    if (s.includes("BOTTOM")) return "BOTTOM_FISH";
    if (s.includes("PULLBACK")) return "PULLBACK";
    
    if (score >= 75) return "STRONG_BUY";
    if (score >= 60) return "BUY";
    if (score >= 53) return "POSITIVE_BIAS";
    if (score <= 40) return "SELL";
    return "NEUTRAL_STAY";
  };

  // Create a comprehensive list of StockQuickView elements for SectorHeatMap and CategoryTabs
  const comprehensiveTickersList: StockQuickView[] = Array.from(tickerMap.entries()).map(([ticker, val]) => {
    const swingPick = swingPicks?.picks?.find((p: any) => p.ticker?.toUpperCase() === ticker);
    const setupName = swingPick?.setup || "";
    return {
      ticker,
      company: val.company,
      sector: val.sector,
      master_score: val.score,
      score_type: getDynamicScoreType(val.score, setupName),
      price: 0,
      change_pct: val.change_pct,
      entry_range_low: 0,
      entry_range_high: 0,
      volume: val.volume,
      ai_short_summary: ""
    };
  });

  // Dynamically categorize ALL system tickers into Category Tabs
  const topScoresTickers: string[] = [];
  const breakoutTickers: string[] = [];
  const valueTickers: string[] = [];
  const reversalTickers: string[] = [];
  const momentumTickers: string[] = [];
  const dividendTickers: string[] = [];

  // Sort all system tickers by score descending
  const sortedComprehensive = [...comprehensiveTickersList].sort((a, b) => b.master_score - a.master_score);

  sortedComprehensive.forEach(stock => {
    const key = stock.ticker.toUpperCase();
    
    // 1. Top Scores - Include everything, sorted by score!
    topScoresTickers.push(key);

    const swingPick = swingPicks?.picks?.find((p: any) => p.ticker?.toUpperCase() === key);
    const optionPick = optionsData?.picks?.find((p: any) => p.ticker?.toUpperCase() === key);
    const setupName = (swingPick?.setup || "").toUpperCase();
    const scoreVal = stock.master_score;

    // 2. Breakout Setup
    if (setupName.includes("BREAKOUT") || setupName.includes("SQUEEZE") || scoreVal >= 70 || optionPick) {
      breakoutTickers.push(key);
    }

    // 3. Value / Undervalued Setup
    if (setupName.includes("VALUE") || setupName.includes("UNDERVALUED") || setupName.includes("PULLBACK") || (scoreVal >= 55 && scoreVal < 65 && stock.sector === "Financials")) {
      valueTickers.push(key);
    }

    // 4. Momentum Setup
    if (setupName.includes("MOMENTUM") || setupName.includes("TREND") || scoreVal >= 65) {
      momentumTickers.push(key);
    }

    // 5. Reversal Setup
    if (setupName.includes("REVERSAL") || setupName.includes("BOTTOM") || setupName.includes("AWAKENING")) {
      reversalTickers.push(key);
    }

    // 6. Dividend / Passive Income
    if (stock.sector === "Utilities" || stock.sector === "Real Estate" || stock.sector === "Consumer Staples" || setupName.includes("DIVIDEND")) {
      dividendTickers.push(key);
    }
  });

  // Mutate master.menus to include counts and tickers for all categories dynamically
  master.menus = {
    top_scores: {
      count: topScoresTickers.length,
      tickers: topScoresTickers
    },
    breakout: {
      count: breakoutTickers.length,
      tickers: breakoutTickers.length > 0 ? breakoutTickers : topScoresTickers.slice(0, 30)
    },
    value: {
      count: valueTickers.length,
      tickers: valueTickers.length > 0 ? valueTickers : topScoresTickers.slice(30, 60)
    },
    reversal: {
      count: reversalTickers.length,
      tickers: reversalTickers.length > 0 ? reversalTickers : topScoresTickers.slice(60, 90)
    },
    momentum: {
      count: momentumTickers.length,
      tickers: momentumTickers.length > 0 ? momentumTickers : topScoresTickers.slice(90, 120)
    },
    dividend: {
      count: dividendTickers.length,
      tickers: dividendTickers.length > 0 ? dividendTickers : topScoresTickers.slice(120, 150)
    }
  };

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
           <MarketExplorer master={master} allTickers={comprehensiveTickersList} customActiveTickers={combinedTickers} />
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
