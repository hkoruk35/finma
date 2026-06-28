import { Metadata } from "next";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume, getLastUpdated } from "@/lib/homeFeed";
import { getSwingPerformance } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";
import SectorPerformanceHeatMap from "@/components/SectorPerformanceHeatMap";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Dashboard with swing trade candidates, trending stocks, and top 100 tracker.",
  alternates: { canonical: "https://bogastock.com/global/en/home" },
};

export default async function EnHomePage() {
  const [swingByVolume, trendByVolume, top100ByVolume, lastUpdated, swingPerf] = await Promise.all([
    getTopSwingByVolume(5),
    getTopTrendByVolume(5),
    getTopTop100ByVolume(5),
    getLastUpdated(),
    getSwingPerformance(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Sector ticker */}
        <SectorPerformanceHeatMap history={swingPerf?.history || []} />

        {/* Three column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HomeSimpleCard
            title="Swing Trade"
            accent="#3b82f6"
            stocks={swingByVolume}
            viewAllHref="/global/en/swing"
            locale="en"
          />

          <HomeSimpleCard
            title="Trend Stocks"
            accent="#a78bfa"
            stocks={trendByVolume}
            viewAllHref="/global/en/trend"
            locale="en"
          />

          <HomeSimpleCard
            title="Top 100"
            accent="#f59e0b"
            stocks={top100ByVolume}
            viewAllHref="/global/en/top100"
            locale="en"
          />
        </div>

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Last updated: <span className="font-mono text-white/60">{lastUpdated}</span> (ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Data is analyzed from sources delayed by 15 minutes. This page updates hourly on days the market is open.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
