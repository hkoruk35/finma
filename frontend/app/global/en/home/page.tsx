import { Metadata } from "next";
import { getMasterData, getSwingAllPicks, getAllTickers } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import MarketIndicesTicker from "@/components/global/MarketIndicesTicker";
import HomeGridCard from "@/components/global/HomeGridCard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA AI Dashboard",
  description: "Dashboard with swing trade candidates, trending stocks, and top 100 tracker.",
  alternates: { canonical: "https://bogastock.com/global/en/home" },
};

interface StockRow {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  change: string;
  changeNum: number;
  signal: string;
}

export default async function EnHomePage() {
  const [masterData, swingPicks, allTickers] = await Promise.all([
    getMasterData(),
    getSwingAllPicks(),
    getAllTickers(),
  ]);

  // Extract swing trade candidates (first 5)
  const swingRows: StockRow[] = (swingPicks?.picks ?? []).slice(0, 5).map((pick: any) => ({
    ticker: pick.ticker,
    company: pick.company || pick.ticker,
    sector: pick.sector || "—",
    price: (pick.price || 0).toFixed(2),
    change: `${pick.change_pct >= 0 ? "+" : ""}${(pick.change_pct || 0).toFixed(2)}%`,
    changeNum: pick.change_pct || 0,
    signal: pick.signal || "WATCH",
  }));

  // Extract trend stocks - filter by trend themes (first 5)
  const trendRows: StockRow[] = (allTickers || [])
    .filter((t: any) => t.score_type === "TREND" || t.score_type?.includes("TREND"))
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      sector: t.sector || "—",
      price: (t.price || 0).toFixed(2),
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      signal: t.score_type || "WATCH",
    }));

  // Extract top 100 stocks (first 5)
  const top100Rows: StockRow[] = (allTickers || [])
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      sector: t.sector || "—",
      price: (t.price || 0).toFixed(2),
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      signal: t.score_type || "WATCH",
    }));

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      {/* Market Indices Ticker */}
      {masterData?.market_indices && (
        <MarketIndicesTicker indices={masterData.market_indices} locale="en" />
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white mb-2">Dashboard</h1>
          <p className="text-base text-white/60">Swing candidates, trending stocks, and top performers</p>
        </div>

        {/* Three column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Swing Trade Candidates */}
          <HomeGridCard
            title="Swing Trade"
            description="Daily trading opportunities"
            stocks={swingRows}
            viewAllHref="/global/en/swing"
            viewAllLabel="View All Swings"
            locale="en"
            icon="🚀"
          />

          {/* Trend Stocks */}
          <HomeGridCard
            title="Trend Stocks"
            description="Long-term trend tracking"
            stocks={trendRows}
            viewAllHref="/global/en/trend"
            viewAllLabel="View All Trends"
            locale="en"
            icon="📈"
          />

          {/* Top 100 */}
          <HomeGridCard
            title="Top 100"
            description="Most active today"
            stocks={top100Rows}
            viewAllHref="/global/en/top100"
            viewAllLabel="View All Top 100"
            locale="en"
            icon="⭐"
          />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
