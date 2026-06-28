import { Metadata } from "next";
import { getSwingAllPicks, getAllTickers } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Swing trade adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

interface Stock {
  ticker: string;
  sector: string;
  price: number;
  change_pct: number;
  volume?: number;
}

export default async function TrHomePage() {
  const [swingPicks, allTickers] = await Promise.all([
    getSwingAllPicks(),
    getAllTickers(),
  ]);

  // Swing trade - en hacimli ilk 5
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

  // Trend hisseleri - en hacimli ilk 5
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

  // Top 100 - en hacimli ilk 5
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
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Üç sütun grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HomeSimpleCard
            title="Swing Trade"
            stocks={swingByVolume}
            viewAllHref="/global/tr/swing"
            locale="tr"
          />

          <HomeSimpleCard
            title="Trend Hisseleri"
            stocks={trendByVolume}
            viewAllHref="/global/tr/trend"
            locale="tr"
          />

          <HomeSimpleCard
            title="Top 100"
            stocks={top100ByVolume}
            viewAllHref="/global/tr/top100"
            locale="tr"
          />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
