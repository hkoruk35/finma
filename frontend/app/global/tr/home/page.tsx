import { Metadata } from "next";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume } from "@/lib/homeFeed";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Swing trade adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

export default async function TrHomePage() {
  const [swingByVolume, trendByVolume, top100ByVolume] = await Promise.all([
    getTopSwingByVolume(5),
    getTopTrendByVolume(5),
    getTopTop100ByVolume(5),
  ]);

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
