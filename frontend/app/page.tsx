import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import IndexCards from "@/components/IndexCards";
import StatsBar from "@/components/StatsBar";
import TopSwingPicks from "@/components/TopSwingPicks";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "US Stock AI Analysis & Daily Trading Scores | BOGA AI - Blue One Global Analysis - Daily +500",
  description: "Discover the strongest US stocks with BOGA AI. Daily analysis of +500 top equities, breakout scores, and momentum picks updated daily at 9:00 AM ET.",
  keywords: ["US stock AI analysis", "daily stock scores", "stock screener today", "best stocks to buy", "BOGA AI"],
  alternates: {
    canonical: "https://bogastock.com",
  },
  openGraph: {
    title: "BOGA AI - Blue One Global Analysis - Daily +500 | AI-Powered US Stock Scores",
    description: "High-conviction trading scores for +500 top US stocks.",
    url: "https://bogastock.com",
    siteName: "BOGA AI - Blue One Global Analysis - Daily +500 stocks",
    images: [{ url: "https://bogastock.com/finmawave.png", width: 1200, height: 630, alt: "BOGA AI - Blue One Global Analysis" }],
    type: "website",
  },
};

export default async function HomePage() {
  const [master, allTickers, swingPicks, swingStats] = await Promise.all([
    getMasterData(),
    getAllTickers(),
    getSwingPicks(),
    getSwingPerformance()
  ]);

  if (!master) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#94a3b8]">Loading market data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ticker Tape */}
      <TickerTape data={master} />

      {/* Header */}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Index Quick View - Temporarily Hidden 
        <section className="mb-8 animate-fade-in">
          <IndexCards data={master} />
        </section>
        */}
        {/* Swing Performance Stats */}
        <section className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <SwingPerformanceBanner stats={swingStats?.stats} />
        </section>

        {/* Top 3 Swing of the Day */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <TopSwingPicks picks={(swingPicks?.picks || []).slice(0, 3)} allTickers={allTickers} />
        </section>

        {/* Hero - Repositioned */}
        <section className="text-center mb-10 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
            Find the Best +100 US Stocks
            <span className="text-[#3b82f6]"> with BOGA AI</span>
          </h1>
        </section>

        {/* Stats Bar */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <StatsBar data={master} />
        </section>

      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
