import { Metadata } from "next";
import { getSwingAllPicks, getAllTickers } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Dashboard with swing trade candidates, trending stocks, and top 100 tracker.",
  alternates: { canonical: "https://bogastock.com/global/en/home" },
};

interface Stock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
  volume?: number;
}

export default async function EnHomePage() {
  const [swingPicks, allTickers] = await Promise.all([
    getSwingAllPicks(),
    getAllTickers(),
  ]);

  // Swing trade - top 5 by volume
  const swingByVolume: Stock[] = (swingPicks?.picks ?? [])
    .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 5)
    .map((pick: any) => ({
      ticker: pick.ticker,
      sector: pick.sector || "—",
      price: pick.price || 0,
      change_pct: pick.change_pct || 0,
      volume: pick.volume,
    }));

  // Trend stocks - top 5 by volume
  const trendByVolume: Stock[] = (allTickers || [])
    .filter((t: any) => t.score_type === "TREND" || t.score_type?.includes("TREND"))
    .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      sector: t.sector || "—",
      price: t.price || 0,
      change_pct: t.change_pct || 0,
      volume: t.volume,
    }));

  // Top 100 - top 5 by volume
  const top100ByVolume: Stock[] = (allTickers || [])
    .sort((a: any, b: any) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      sector: t.sector || "—",
      price: t.price || 0,
      change_pct: t.change_pct || 0,
      volume: t.volume,
    }));

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Three column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HomeSimpleCard
            title="Swing Trade"
            stocks={swingByVolume}
            viewAllHref="/global/en/swing"
            locale="en"
          />

          <HomeSimpleCard
            title="Trend Stocks"
            stocks={trendByVolume}
            viewAllHref="/global/en/trend"
            locale="en"
          />

          <HomeSimpleCard
            title="Top 100"
            stocks={top100ByVolume}
            viewAllHref="/global/en/top100"
            locale="en"
          />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
