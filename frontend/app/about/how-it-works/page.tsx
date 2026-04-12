import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "How is the AI Score Calculated? | BOGA AI Analysis Methodology",
  description: "Discover the algorithm behind BOGA AI Score. Learn how momentum, volatility, fundamental data, and AI analysis combine to generate professional stock signals.",
  alternates: {
    canonical: "https://bogastock.com/about/how-it-works",
  },
  openGraph: {
    title: "How is the AI Score Calculated? | BOGA AI Analysis Methodology",
    description: "Learn how the BOGA AI Score is computed using technical and fundamental indicators.",
    url: "https://bogastock.com/about/how-it-works",
  },
};

export default function HowItWorksPage() {
  const dataSets = [
    {
      title: "Momentum & Trend Strength",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      description: "We measure the direction and strength of the trend using RSI, MACD, and EMA (20, 50, 200) averages. The ADX indicator helps analyze the sustainability of the price movement.",
      color: "from-blue-500 to-cyan-400"
    },
    {
      title: "Volatility & Risk Analysis",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      description: "Using Bollinger Bands (Squeeze detection) and ATR (Average True Range), we determine the breakout potential and specific risk levels for each stock.",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Volume & Money Flow",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      description: "Through RVOL (Relative Volume) and OBV (On-Balance Volume), we track institutional accumulation and high-conviction 'smart money' movements.",
      color: "from-orange-500 to-yellow-400"
    },
    {
      title: "Fundamentals & Sector Context",
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      description: "Metrics like P/E ratios, gross margins, and revenue growth are compared against sector medians to evaluate value vs. overextension.",
      color: "from-green-500 to-emerald-400"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#64748b]">
          <Link href="/about" className="hover:text-[#3b82f6] transition-colors">About Us</Link>
          <span>/</span>
          <span className="text-white">AI Score Methodology</span>
        </nav>

        {/* Hero Section */}
        <div className="mb-16">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
            How is BOGA AI Score <span className="text-[#3b82f6]">Calculated?</span>
          </h1>
          <p className="text-lg text-[#94a3b8] leading-relaxed">
            Every trading day at 09:00 AM ET, BOGA AI processes thousands of data points from the US equity markets to generate a score between 0 and 100. This score is a mathematical synthesis of technical, fundamental, and sentiment data points.
          </p>
        </div>

        {/* Score Components Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {dataSets.map((set, idx) => (
            <div key={idx} className="glass-card p-8 group hover:border-[#3b82f6]/30 transition-all">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${set.color} flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-500/10`}>
                {set.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{set.title}</h3>
              <p className="text-[#64748b] text-sm leading-relaxed">
                {set.description}
              </p>
            </div>
          ))}
        </div>

        {/* Weighted System Section */}
        <section className="mb-16 glass-card p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#3b82f6]/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <h2 className="text-2xl font-bold text-white mb-6">Weighted Scoring Model</h2>
          <div className="space-y-8">
            <p className="text-[#94a3b8] leading-relaxed">
              The BOGA Master Score is not built on a single data point. We use a dynamic weighting model to ensure signal accuracy:
            </p>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Technical Analysis (Momentum & Trend)</span>
                  <span className="text-sm font-black text-[#3b82f6]">35%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#3b82f6]" style={{ width: '35%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Fundamental Metrics & Ratios</span>
                  <span className="text-sm font-black text-[#8b5cf6]">25%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#8b5cf6]" style={{ width: '25%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Volume & Institutional Money Flow</span>
                  <span className="text-sm font-black text-[#f59e0b]">20%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#f59e0b]" style={{ width: '20%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Sector Performance & Sentiment</span>
                  <span className="text-sm font-black text-[#22c55e]">20%</span>
                </div>
                <div className="h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                  <div className="h-full bg-[#22c55e]" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Interpretation */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">How AI Commentary is Generated</h2>
          <div className="prose prose-invert max-w-none text-[#94a3b8] leading-relaxed space-y-4">
            <p>
              Calculated scores and data points are passed to BOGA's proprietary financial language models (Gemini AI). The AI doesn't just look at numbers; it analyzes what those numbers mean in the current market context.
            </p>
            <p>
              For example, an RSI of 70 isn't always "overbought." If there is a major sector rally confirmed by relative volume, the AI interprets this as a "strong trend" rather than a signal to sell. This contextual understanding is what sets BOGA AI apart from generic scanners.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="glass-card p-10 text-center">
          <h2 className="text-xl font-bold text-white mb-4">Discover the Power of Data</h2>
          <p className="text-[#64748b] text-sm mb-8">Access daily AI-powered scores for the top 500 US stocks today.</p>
          <Link 
            href="/"
            className="px-8 py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb] transition-all"
          >
            See Today's Signals
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
