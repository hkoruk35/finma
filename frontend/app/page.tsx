import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import IndexCards from "@/components/IndexCards";
import StatsBar from "@/components/StatsBar";
import TopSwingPicks from "@/components/TopSwingPicks";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import SectorScreener from "@/components/SectorScreener";
import MarketExplorer from "@/components/MarketExplorer";
import SectorHeatMap from "@/components/SectorHeatMap";
import { Metadata } from "next";

export const revalidate = 60; // ISR: 1 dakikada bir yenile

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "US Stock AI Analysis & Daily Trading Scores | BOGA - Blue One Global Analysis - Daily +500 Stocks",
  description: "Discover the strongest US stocks with BOGA AI. Daily 1D scan of +500 equities — breakout, momentum, reversal, and passive income picks updated every morning.",
  keywords: ["US stock AI analysis", "daily stock scores", "stock screener today", "best stocks to buy", "BOGA AI"],
  alternates: {
    canonical: "https://bogastock.com",
  },
  openGraph: {
    title: "BOGA - Blue One Global Analysis - Daily +500 | AI-Powered US Stock Scores",
    description: "High-conviction trading scores for +500 top US stocks.",
    url: "https://bogastock.com",
    siteName: "BOGA - Blue One Global Analysis - Daily +500 stocks",
    images: [{ url: "https://bogastock.com/finmawave.png", width: 1200, height: 630, alt: "BOGA - Blue One Global Analysis" }],
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
          <TopSwingPicks picks={swingPicks?.picks || []} allTickers={allTickers} />
        </section>

        {/* Hero - Repositioned */}
        <section className="text-center mb-10 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">
            Find the Best US Stocks
            <span className="text-[#3b82f6]"> with BOGA AI</span>
          </h1>
        </section>

        {/* Stats Bar */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <StatsBar data={master} />
        </section>

        {/* Smart Sector Screener */}
        <section className="mb-12 animate-fade-in" style={{ animationDelay: "225ms" }}>
          <SectorScreener />
        </section>

        {/* Market Themes & Category Tabs Explorer */}
        <section className="mb-12 animate-fade-in" style={{ animationDelay: "250ms" }}>
           <MarketExplorer master={master} allTickers={allTickers} />
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
        {/* SEO & Topical Authority Content */}
        <section className="mt-16 mb-12 animate-fade-in" style={{ animationDelay: "500ms" }}>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass-card p-8 border-l-4 border-l-[#3b82f6]">
              <h2 className="text-2xl font-black text-white mb-4">How BOGA AI Works</h2>
              <p className="text-[#94a3b8] leading-relaxed mb-4 text-sm">
                BOGA AI is an advanced analysis engine that scans over 500 US stocks every day. 
                Using a combination of technical momentum, fundamental valuation, and sentiment analysis, 
                our system identifies high-probability trading setups.
              </p>
              <ul className="space-y-3">
                {[
                  { title: "Daily 1D Scans", desc: "Every morning before market open, our engine analyzes the previous day's closing data." },
                  { title: "Multi-Factor Scoring", desc: "Stocks are scored on a scale of 0-100 based on price action and volume profiles." },
                  { title: "Risk-Managed Entries", desc: "Every pick includes suggested entry zones, targets, and stop-loss levels." }
                ].map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-[#3b82f6] font-bold">✓</span>
                    <div>
                      <h4 className="text-white text-[13px] font-bold">{item.title}</h4>
                      <p className="text-[#64748b] text-[12px]">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-card p-8 border-l-4 border-l-[#f59e0b]">
              <h2 className="text-2xl font-black text-white mb-4">Trading Disciplines</h2>
              <p className="text-[#94a3b8] leading-relaxed text-sm">
                Our AI categorizes stocks into five distinct trading regimes to suit your strategy:
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {[
                  { tag: "Breakout", color: "text-[#22c55e]" },
                  { tag: "Momentum", color: "text-[#3b82f6]" },
                  { tag: "Undervalued", color: "text-[#f59e0b]" },
                  { tag: "Reversal", color: "text-[#8b5cf6]" },
                  { tag: "Passive Income", color: "text-[#10b981]" }
                ].map((cat) => (
                  <div key={cat.tag} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${cat.color.replace('text-', 'bg-')}`} />
                    <span className={`text-[13px] font-black uppercase tracking-wider ${cat.color}`}>{cat.tag}</span>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs text-[#64748b] italic">
                *Note: AI analysis is for informational purposes only. Always conduct your own research before trading.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
