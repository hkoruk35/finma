import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "About BOGA AI - Blue One Global Analysis - Daily +8000 | AI-Powered US Stock Market Analysis",
  description: "BOGA AI - Blue One Global Analysis - Daily +8000 stocks scans 8,000+ US stocks daily, identifies the top candidates, and delivers daily AI-powered financial analysis on the highest-conviction opportunities in the US market.",
  alternates: {
    canonical: "https://bogastock.com/global/en/about",
    languages: {
      "en-US": "https://bogastock.com/global/en/about",
      "tr-TR": "https://bogastock.com/global/en/about/tr",
    },
  },
  openGraph: {
    title: "About BOGA AI - Blue One Global Analysis - Daily +8000 | AI-Powered US Stock Market Analysis",
    description: "BOGA AI - Blue One Global Analysis - Daily +8000 stocks scans 8,000+ US stocks daily, identifies the top candidates, and delivers daily AI-powered financial analysis on the highest-conviction opportunities in the US market.",
    url: "https://bogastock.com/global/en/about",
  },
};

// Public page — no auth required
export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <Header hideMenus={true} logoHref="/global/en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        <div className="flex justify-end mb-6">
          <Link href="/global/en/about/tr" className="text-xs font-bold text-[#3b82f6] hover:text-white transition-colors">Türkçe →</Link>
        </div>

        {/* Hero */}
        <div className="text-center mb-20">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">US Stock Market Intelligence</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            Daily Financial Analysis.<br />
            <span className="text-[#3b82f6]">Built for US Markets.</span>
          </h1>
          <p className="text-xl text-white max-w-2xl mx-auto leading-relaxed">
            BOGA AI - Blue One Global Analysis - Daily +8000 stocks is a proprietary multi-stage stock screening and scoring system that turns the entire US equity universe into a focused shortlist of high-probability opportunities — every single trading day.
          </p>
        </div>

        {/* 3-Stage Process */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">How the BOGA AI System Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Stage 1 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6 text-2xl font-black">1</div>
              <h3 className="text-lg font-bold text-white mb-3">Daily Universe Scan</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Every day, the BOGA AI algorithm sweeps through <strong className="text-white">8,000+ US-listed equities</strong> across all major exchanges — NYSE, NASDAQ, and AMEX — applying liquidity, volatility, and structural filters to isolate the most tradeable candidates.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6 text-2xl font-black">2</div>
              <h3 className="text-lg font-bold text-white mb-3">Top 8000+ Daily Watchlist</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                From the daily scan, the system selects <strong className="text-white">8,000+ high-priority stocks</strong> for daily monitoring. These candidates are re-evaluated each morning at 09:00 NY time with fresh market data, technical readings, and fundamental metrics.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="glass-card p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6 text-2xl font-black">3</div>
              <h3 className="text-lg font-bold text-white mb-3">Highest-Conviction Candidates — Individually Scored</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                The BOGA AI scoring engine ranks every daily candidate and selects the highest-conviction setups. Each receives a unique AI-generated analysis covering technicals, fundamentals, and score rationale — not a template, but a stock-specific brief.
              </p>
            </div>
          </div>
        </div>

        {/* Scoring System */}
        <div className="mb-20">
          <h2 className="text-2xl font-black text-white text-center mb-12 uppercase tracking-widest">The BOGA AI Scoring System</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Multi-Factor Technical Engine</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                The BOGA AI Master Score is computed from a weighted blend of technical indicators — RSI, MACD, relative volume, EMA cross-multiples, ADX trend strength, and Bollinger Band squeeze intensity — engineered specifically for US equity momentum structures.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Fundamental & Sector Overlay</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Every score is cross-referenced with fundamental data: P/E ratio vs. sector median, FCF yield, gross margins, and revenue growth momentum. Sector performance context ensures scores are always relative — not absolute — to current market conditions.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Proprietary AI Commentary</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                Each shortlisted stock receives a plain-language analysis brief generated by the BOGA AI engine. The brief explains <em>why</em> a specific score was assigned — referencing the stock's own data, not generics — so you understand the rationale behind every rating.
              </p>
            </div>

            <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e] mb-6">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Five-Tier Score Ratings</h3>
              <p className="text-[#00d2ff] text-sm leading-relaxed">
                BOGA AI scores are classified into five professional tiers: <strong className="text-white">High Conviction</strong>, <strong className="text-white">Positive Bias</strong>, <strong className="text-white">Neutral Stay</strong>, <strong className="text-white">Negative Bias</strong>, and <strong className="text-white">Underperform</strong> — giving you institutional-grade clarity without ambiguity.
              </p>
            </div>
          </div>
        </div>

        {/* Focus Statement */}
        <div className="glass-card p-10 text-center mb-12">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#3b82f6] rounded-t-2xl"></div>
          <h2 className="text-2xl font-bold text-white mb-4">100% Focused on US Equity Markets</h2>
          <p className="text-white max-w-2xl mx-auto leading-relaxed mb-6">
            BOGA AI - Blue One Global Analysis - Daily +8000 stocks is purpose-built for the US stock market. Every algorithm, every weight, and every score category is calibrated against NYSE, NASDAQ, and US market structure — not a generic global model adapted for the US.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-bold uppercase tracking-widest">
            {["NYSE", "NASDAQ", "AMEX", "S&P 500", "NASDAQ 100", "Russell 2000"].map(ex => (
              <span key={ex} className="px-3 py-1.5 bg-[#3b82f6]/10 text-[#3b82f6] rounded-full border border-[#3b82f6]/20">{ex}</span>
            ))}
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
          <p className="text-white max-w-2xl mx-auto italic leading-relaxed">
            "We make the analytical power of institutional funds and professionals accessible to every investor. Through our advanced market screening and scoring technology, identifying the right opportunities in the US stock market is no longer a complex task—it's a daily routine."
          </p>
        </div>

      </main>

      <Footer hidePlatform={true} />
    </div>
  );
}
