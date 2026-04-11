import { getMasterData, getAllTickers } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import IndexCards from "@/components/IndexCards";
import StatsBar from "@/components/StatsBar";
import CategoryTabs from "@/components/CategoryTabs";
import SectorHeatMap from "@/components/SectorHeatMap";
import Top3Section from "@/components/Top3Section";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogarunner.com"),
  title: "US Stock AI Analysis & Daily Trading Scores | BOGA - Blue One Global Analysis - Daily +500",
  description: "Discover the strongest US stocks with BOGA AI. Daily analysis of +500 top equities, breakout scores, and momentum picks updated daily at 9:00 AM ET.",
  keywords: ["US stock AI analysis", "daily stock scores", "stock screener today", "best stocks to buy", "BOGA AI"],
  alternates: {
    canonical: "https://bogarunner.com",
  },
  openGraph: {
    title: "BOGA - Blue One Global Analysis - Daily +500 | AI-Powered US Stock Scores",
    description: "High-conviction trading scores for +500 top US stocks.",
    url: "https://bogarunner.com",
    siteName: "BOGA - Blue One Global Analysis - Daily +500 stocks",
    images: [{ url: "https://bogarunner.com/finmawave.png", width: 1200, height: 630, alt: "BOGA - Blue One Global Analysis" }],
    type: "website",
  },
};

export default async function HomePage() {
  const [master, allTickers] = await Promise.all([
    getMasterData(),
    getAllTickers(),
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
        {/* Index Quick View */}
        <section className="mb-8 animate-fade-in">
          <IndexCards data={master} />
        </section>
        {/* Hero */}
        <section className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3">
            Find the Best +500 US Stocks
            <span className="text-[#3b82f6]"> with BOGA AI</span>
          </h1>
        </section>

        {/* Top 3 of the Day */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <Top3Section master={master} allTickers={allTickers} />
        </section>

        {/* Stats Bar */}
        <section className="mb-8 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <StatsBar data={master} />
        </section>

        {/* Category Tabs */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <CategoryTabs master={master} allTickers={allTickers} />
        </section>

        {/* Sector Heat Map */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <SectorHeatMap data={master} allTickers={allTickers} />
        </section>

        {/* Ad Slot Placeholder */}
        <section className="mb-8">
          <div className="glass-card flex items-center justify-center h-24 text-[#64748b] text-sm hidden md:flex">
            AD-H1 &middot; 728&times;90 Leaderboard
          </div>
          <div className="glass-card flex items-center justify-center h-16 text-[#64748b] text-[10px] md:hidden">
            AD-M1 &middot; 320&times;50 Mobile Banner
          </div>
        </section>

        {/* Archive Preview */}
        <section className="mb-8">
          <div className="glass-card p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">
              Access Past Analysis
            </h3>
            <p className="text-sm text-[#94a3b8] mb-4">
              View historical BOGA scores from the last 30 days.
              Sign in with Google for free access.
            </p>
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#3b82f6] rounded-lg text-sm font-semibold text-white hover:bg-[#2563eb] transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              Sign in with Google
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
