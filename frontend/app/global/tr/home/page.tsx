import { Metadata } from "next";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume, getLastUpdated, getLiveIndices } from "@/lib/homeFeed";
import { getSwingPerformance } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import TickerTape from "@/components/TickerTape";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Swing trade adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

export default async function TrHomePage() {
  const [swingByVolume, trendByVolume, top100ByVolume, lastUpdated, indices, swingStats] = await Promise.all([
    getTopSwingByVolume(5),
    getTopTrendByVolume(5),
    getTopTop100ByVolume(5),
    getLastUpdated(),
    getLiveIndices(),
    getSwingPerformance(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Performance Banner */}
        <SwingPerformanceBanner stats={swingStats?.stats} />

        {/* Swing omurga + Trend/Top100 destekleyiciler */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Swing kartı - tam genişlik / lg'de 2 kolon kapla */}
          <div className="lg:col-span-2">
            <HomeSimpleCard
              title="GÜNCEL FIRSATLAR"
              subtitle="Swing Alım Sinyalleri"
              accent="#3b82f6"
              stocks={swingByVolume}
              viewAllHref="/global/tr/swing"
              locale="tr"
              sortLabel="Swing skoruna göre sıralandı"
            />
          </div>

          {/* Trend kartı */}
          <HomeSimpleCard
            title="Trend Hisseleri"
            accent="#a78bfa"
            stocks={trendByVolume}
            viewAllHref="/global/tr/trend"
            locale="tr"
            sortLabel="Hacim sırasına göre"
          />
        </div>

        {/* Top 100 - kendi satır */}
        <div className="mt-6">
          <HomeSimpleCard
            title="Top 100 Takip"
            accent="#f59e0b"
            stocks={top100ByVolume}
            viewAllHref="/global/tr/top100"
            locale="tr"
            sortLabel="En aktif işlem gören hisseler"
          />
        </div>

        {/* Güncelleme bilgisi */}
        <div className="mt-10 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Son güncelleme: <span className="font-mono text-white/60">{lastUpdated}</span> (ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Veriler 15 dakika gecikmeli kaynaklardan analiz edilir. Sayfa, borsanın açık olduğu günlerde saat başı güncellenir.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
