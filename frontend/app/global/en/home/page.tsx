import { Metadata } from "next";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume } from "@/lib/homeFeed";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Dashboard with swing trade candidates, trending stocks, and top 100 tracker.",
  alternates: { canonical: "https://bogastock.com/global/en/home" },
};

export default async function EnHomePage() {
  const [swingByVolume, trendByVolume, top100ByVolume] = await Promise.all([
    getTopSwingByVolume(5),
    getTopTrendByVolume(5),
    getTopTop100ByVolume(5),
  ]);

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
