import { getMasterData, getAllTickers, getSwingPicks, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TopSwingPicks from "@/components/TopSwingPicks";
import SwingPerformanceBanner from "@/components/SwingPerformanceBanner";
import SectorPerformanceHeatMap from "@/components/SectorPerformanceHeatMap";
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
        <p className="text-white">Loading market data...</p>
      </div>
    );
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Swing Performance Stats */}
        <section className="animate-fade-in" style={{ animationDelay: "50ms" }}>
          <SwingPerformanceBanner stats={swingStats?.stats} />
          
          {/* Synchronized Sector Profitability Heatmap */}
          <SectorPerformanceHeatMap history={swingStats?.history || []} />
        </section>

        {/* Top 3 Swing of the Day */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <TopSwingPicks picks={swingPicks?.picks || []} allTickers={allTickers} minimal={true} />
        </section>

        {/* Archive Preview */}
        <section className="mb-8">
          <div className="glass-card p-6 text-center">
            <h3 className="text-lg font-bold text-white mb-2">
              Access Past Analysis
            </h3>
            <p className="text-sm text-white mb-4">
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

        {/* How BOGA Finance AI Works */}
        <section className="mt-16 mb-12 animate-fade-in" style={{ animationDelay: "500ms" }}>
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter">
                How BOGA Finance AI Works
              </h2>
              <p className="text-white/70 max-w-3xl mx-auto leading-relaxed text-sm md:text-base">
                BOGA Finance AI is an institutional-grade intelligence engine designed for precision swing trading. 
                Rather than reacting blindly to opening bell noise, our system operates on a rigorous, 
                three-phase algorithmic pipeline that filters the entire U.S. market down to a highly curated, actively managed portfolio.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 px-2">
              {/* Phase 1 */}
              <div className="glass-card p-8 border-t-4 border-t-[#3b82f6] relative overflow-hidden group hover:bg-[#3b82f6]/5 transition-all duration-300">
                <div className="absolute -right-4 -top-4 text-white/5 text-8xl font-black group-hover:text-[#3b82f6]/10 transition-colors">1</div>
                <h3 className="text-lg font-black text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                   <span className="text-[#3b82f6]">✓</span> Phase 1
                </h3>
                <h4 className="text-[#3b82f6] text-[13px] font-black mb-4 uppercase tracking-widest border-b border-[#3b82f6]/20 pb-2">Nightly Macro Scan</h4>
                <p className="text-white/80 text-[13px] leading-relaxed mb-6">
                  Every night, our engine scans over <strong>7,000 U.S. equities</strong>. We apply strict fundamental filters to isolate the top 500 robust companies, then use proprietary algorithms to distill an elite watchlist of 20 prime candidates.
                </p>
                <div className="mt-auto text-[#00d2ff] text-[11px] font-bold bg-[#3b82f6]/10 p-3 rounded-xl border border-[#3b82f6]/30 text-center uppercase tracking-widest">
                  7,000+ Stocks → 20 Elite
                </div>
              </div>

              {/* Phase 2 */}
              <div className="glass-card p-8 border-t-4 border-t-[#f59e0b] relative overflow-hidden group hover:bg-[#f59e0b]/5 transition-all duration-300">
                 <div className="absolute -right-4 -top-4 text-white/5 text-8xl font-black group-hover:text-[#f59e0b]/10 transition-colors">2</div>
                <h3 className="text-lg font-black text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                   <span className="text-[#f59e0b]">✓</span> Phase 2
                </h3>
                <h4 className="text-[#f59e0b] text-[13px] font-black mb-4 uppercase tracking-widest border-b border-[#f59e0b]/20 pb-2">11:00 AM Sniper Execution</h4>
                <p className="text-white/80 text-[13px] leading-relaxed mb-6">
                  We bypass the chaotic first 90 minutes. At <strong>11:00 AM (EST)</strong>, our sniper algorithm evaluates the watchlist using intraday volume absorption and Smart Money footprints to pick the top 5 setups.
                </p>
                <div className="mt-auto text-[#fbbf24] text-[11px] font-bold bg-[#f59e0b]/10 p-3 rounded-xl border border-[#f59e0b]/30 text-center uppercase tracking-widest">
                  20 Candidates → Top 5 Picks
                </div>
              </div>

              {/* Phase 3 */}
              <div className="glass-card p-8 border-t-4 border-t-[#10b981] relative overflow-hidden group hover:bg-[#10b981]/5 transition-all duration-300">
                 <div className="absolute -right-4 -top-4 text-white/5 text-8xl font-black group-hover:text-[#10b981]/10 transition-colors">3</div>
                <h3 className="text-lg font-black text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                   <span className="text-[#10b981]">✓</span> Phase 3
                </h3>
                <h4 className="text-[#10b981] text-[13px] font-black mb-4 uppercase tracking-widest border-b border-[#10b981]/20 pb-2">360° Smart Rolling Tracking</h4>
                <p className="text-white/80 text-[13px] leading-relaxed mb-6">
                   BOGA AI monitors today's 5 selections alongside picks from the previous 4 days, maintaining a <strong>dynamic 25-stock rolling portfolio</strong> with precise Entry, Target, and Stop-Loss levels.
                </p>
                <div className="mt-auto text-[#34d399] text-[11px] font-bold bg-[#10b981]/10 p-3 rounded-xl border border-[#10b981]/30 text-center uppercase tracking-widest">
                  Rolling Matrix: 25 Active
                </div>
              </div>
            </div>

            <div className="mt-10 glass-card p-8 border-l-4 border-l-[#a78bfa] bg-[#a78bfa]/5 relative group overflow-hidden">
              <div className="absolute right-4 bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-12 h-12 text-[#a78bfa]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM14.017 14V11C14.017 9.89543 14.9124 9 16.017 9H19.017C20.1216 9 21.017 9.89543 21.017 11V14C21.017 15.1046 20.1216 16 19.017 16H16.017C14.9124 16 14.017 15.1046 14.017 14ZM5.017 21L5.017 18C5.017 16.8954 5.91242 16 7.017 16H10.017C11.1216 16 12.017 16.8954 12.017 18V21C12.017 22.1046 11.1216 23 10.017 23H7.017C5.91242 23 5.017 22.1046 5.017 21ZM5.017 14V11C5.017 9.89543 5.91242 9 7.017 9H10.017C11.1216 9 12.017 9.89543 12.017 11V14C12.017 15.1046 11.1216 16 10.017 16H7.017C5.91242 16 5.017 15.1046 5.017 14ZM14.017 7V4C14.017 2.89543 14.9124 2 16.017 2H19.017C20.1216 2 21.017 2.89543 21.017 4V7C21.017 8.10457 20.1216 9 19.017 9H16.017C14.9124 9 14.017 8.10457 14.017 7ZM5.017 7V4C5.017 2.89543 5.91242 2 7.017 2H10.017C11.1216 2 12.017 2.89543 12.017 4V7C12.017 8.10457 11.1216 9 10.017 9H7.017C5.91242 9 5.017 8.10457 5.017 7Z" />
                </svg>
              </div>
              <p className="text-white/90 text-[14px] md:text-[15px] leading-relaxed italic pr-12 font-medium">
                "Each of these 25 stocks is continuously monitored in real-time across all dimensions—fundamental shifts, technical momentum, and breaking news/sentiment. Whether a stop-loss is triggered, a target is hit, or a trend needs adjustment, BOGA AI processes the data and updates you instantly."
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
