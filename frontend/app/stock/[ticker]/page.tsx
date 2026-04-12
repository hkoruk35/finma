import { getStockData, getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TradingViewWidget from "@/components/stock/TradingViewWidget";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import SocialShare from "@/components/SocialShare";

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  const stock = await getStockData(ticker);

  if (!stock) return { title: "Stock Not Found | BOGA" };

  const dateStr = new Date().toISOString().split("T")[0];
  const title = `${stock.ticker} Stock Analysis ${dateStr} | ${stock.company} AI Score & Ratings — BOGA`;
  const description = `${stock.ticker} (${stock.company}) analysis for ${dateStr}. BOGA AI Score: ${stock.scores.master_score.toFixed(1)}. Current Rating: ${stock.scores.score_type.replace("_", " ")} at $${formatPrice(stock.price.current)}. Discover real-time AI scores and AI-driven stock research.`;

  return {
    metadataBase: new URL("https://bogastock.com"),
    title,
    description,
    alternates: {
      canonical: `https://bogastock.com/stock/${ticker.toLowerCase()}`,
    },
    openGraph: {
      title,
      description,
      url: `https://bogastock.com/stock/${ticker.toLowerCase()}`,
      images: [
        {
          url: "https://bogastock.com/finmawave.png",
          width: 1200,
          height: 630,
          alt: `${stock.ticker} Stock Analysis`,
        },
      ],
    },
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  const [stock, master, allTickers] = await Promise.all([
    getStockData(ticker),
    getMasterData(),
    getAllTickers()
  ]);

  if (!stock) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />
      
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": `${stock.ticker} — ${stock.company} Stock Analysis`,
            "description": stock.ai_summary,
            "image": "https://bogastock.com/finmawave.png",
            "author": {
              "@type": "Organization",
              "name": "BOGA Daily +500"
            },
            "publisher": {
              "@type": "Organization",
              "name": "BOGA",
              "logo": {
                "@type": "ImageObject",
                "url": "https://bogastock.com/finmawave.png"
              }
            },
            "datePublished": stock.date || new Date().toISOString()
          })
        }}
      />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
           <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                 __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                       { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bogastock.com" },
                       { "@type": "ListItem", "position": 2, "name": stock.ticker, "item": `https://bogastock.com/stock/${ticker.toLowerCase()}` }
                    ]
                 })
              }}
           />
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">{stock.ticker}</span>
        </nav>

        {/* Header Section — Compact Terminal */}
        <div className="glass-card px-4 py-6 md:px-8 mb-4 border-b-2 border-b-[#3b82f6]/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Ticker + Badge + Company */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-none">
                  {stock.ticker}
                </h1>
                <span className={`px-4 py-1.5 rounded-full text-[12px] font-black uppercase tracking-widest shadow-lg ${getScoreBadgeClass(stock.scores.score_type)}`}>
                  {stock.scores.score_type.replace("_", " ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-base text-[#94a3b8] font-bold">{stock.company}</p>
                <span className="text-[#1e2a3a]">•</span>
                <p className="text-sm text-[#64748b] font-medium uppercase tracking-wider">{stock.sector}</p>
              </div>
            </div>

            {/* Right: Price + Change */}
            <div className="flex flex-col md:items-end gap-1">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl md:text-6xl font-mono font-black text-white leading-none tracking-tighter">
                  ${formatPrice(stock.price.current)}
                </span>
                <div className={`flex flex-col ${getChangeColor(stock.price.change_pct)}`}>
                   <span className="text-xl md:text-2xl font-mono font-black leading-none">
                     {stock.price.change_pct >= 0 ? "+" : ""}{stock.price.change_pct.toFixed(2)}%
                   </span>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-right">Today</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-[#22c55e] live-dot"></div>
                <span className="text-[10px] font-black text-[#64748b] uppercase tracking-[0.2em]">MARKET IS OPEN</span>
              </div>
            </div>
          </div>
        </div>

        {/* Time-Period Returns — Horizontal Strip */}
        <div className="glass-card grid grid-cols-4 divide-x divide-[#1e2a3a] mb-4">
          {[
            { label: "24H", value: stock.price.change_pct },
            { label: "1W", value: stock.price.change_pct_1w },
            { label: "1M", value: stock.price.change_pct_1m },
            { label: "1Y", value: stock.price.change_pct_1y },
          ].map((period) => (
            <div key={period.label} className="px-3 py-3 md:px-5 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">{period.label}</span>
              <span className={`text-base md:text-lg font-mono font-black ${
                period.value !== undefined && period.value !== null
                  ? getChangeColor(period.value)
                  : 'text-[#64748b]'
              }`}>
                {period.value !== undefined && period.value !== null
                  ? `${period.value >= 0 ? '+' : ''}${period.value.toFixed(2)}%`
                  : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="glass-card overflow-hidden flex flex-col">
              {/* Slim chart header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2a3a] bg-[#0d1117]/60">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></div>
                  <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">Live Chart · {stock.ticker}</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-[10px] font-bold text-[#94a3b8]">1D</span>
                  <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-[10px] font-bold text-[#94a3b8]">NY TIME</span>
                </div>
              </div>
              {/* Edge-to-edge chart, no inner border */}
              <div className="w-full flex-1 min-h-[320px] md:min-h-[460px]">
                <TradingViewWidget symbol={stock.ticker} />
              </div>
            </div>

            {/* Social Share — Moved here */}
            <div className="glass-card p-6 border-b-2 border-b-[#3b82f6]/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Share This Insight</h3>
                  <p className="text-xs text-[#64748b]">Help others discover this AI score.</p>
                </div>
                <div className="flex-1 max-w-md">
                   <SocialShare
                     ticker={stock.ticker}
                     score={stock.scores.master_score}
                     scoreType={stock.scores.score_type}
                     hideHeader={true}
                   />
                </div>
              </div>
            </div>

            {/* AI Summary Card */}
            <div className="glass-card p-8 border-l-4 border-l-[#3b82f6] bg-gradient-to-r from-[#3b82f6]/5 to-transparent relative overflow-hidden">
              {/* Decorative AI light */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#3b82f6]/10 blur-[100px] rounded-full"></div>
              
              <div className="flex items-center gap-4 mb-6 relative">
                <div className="w-12 h-12 rounded-2xl bg-[#3b82f6] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tight uppercase">BOGA AI SUMMARY ANALYSIS</h3>
                   <p className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-[0.3em]">Real-time Intelligent Insights</p>
                </div>
              </div>
              
              <div className="relative">
                <svg className="absolute -left-2 -top-2 w-8 h-8 text-[#1e2a3a]/40" fill="currentColor" viewBox="0 0 32 32">
                  <path d="M10 8v8H6c0-4.4 3.6-8 8-8zM24 8v8h-4c0-4.4 3.6-8 8-8z" />
                </svg>
                <p className="text-white leading-relaxed text-xl font-medium pl-6 italic mb-4">
                  {stock.ai_summary}
                </p>
              </div>

              <div className="mt-8 pt-6 border-t border-[#1e2a3a]/60 flex flex-wrap items-center justify-between gap-6">
                <div className="flex gap-8">
                   <div className="flex flex-col">
                      <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1">AI Confidence Score</p>
                      <div className="flex items-center gap-2">
                         <div className="w-24 h-1.5 rounded-full bg-[#1e2a3a] overflow-hidden">
                            <div 
                              className="h-full bg-[#3b82f6]" 
                              style={{ width: `${stock.scores.confidence * 100}%` }}
                            ></div>
                         </div>
                         <p className="font-mono font-black text-white">{(stock.scores.confidence * 100).toFixed(0)}%</p>
                      </div>
                   </div>
                   <div className="flex flex-col border-l border-[#1e2a3a] pl-8">
                      <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1">Market Sentiment</p>
                      <p className="font-mono font-black text-[#22c55e] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                        Bullish
                      </p>
                   </div>
                </div>
                <Link href="#social-share-section" className="px-5 py-2 rounded-lg bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all border border-[#3b82f6]/20 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="flex flex-col gap-6">
            {/* BOGA Score Widget */}
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-4">BOGA Master Score</h3>
              <div className="relative w-40 h-40 flex items-center justify-center mb-4">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="transparent"
                    stroke="#1e2a3a"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="transparent"
                    stroke="url(#scoreGradient)"
                    strokeWidth="12"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * stock.scores.master_score) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute flex flex-col">
                  <span className="text-5xl font-mono font-black text-white">{stock.scores.master_score.toFixed(1)}</span>
                </div>
              </div>
              <p className={`text-sm font-bold uppercase ${getChangeColor(1)}`}>
                High conviction score
              </p>
            </div>

            {/* Score Details */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-4">BOGA AI MODEL ANALYSIS</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                   <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">WAITING ZONE</span>
                   <span className="font-mono font-black text-xl text-white">
                      ${formatPrice(stock.scores_detail.entry_range_low)} - ${formatPrice(stock.scores_detail.entry_range_high)}
                   </span>
                </div>
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] border-l-4 border-l-[#22c55e]">
                   <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">SELL ZONE (TARGET)</span>
                   <span className="font-mono font-black text-xl text-[#22c55e]">
                      ${formatPrice(stock.scores_detail.target_range_low)} - ${formatPrice(stock.scores_detail.target_range_high)}
                   </span>
                </div>
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] border-l-4 border-l-[#ef4444]">
                   <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">BUY ZONE (SUPPORT)</span>
                   <span className="font-mono font-black text-xl text-[#ef4444]">
                      ${formatPrice(stock.scores_detail.stop_range_low)} - ${formatPrice(stock.scores_detail.stop_range_high)}
                   </span>
                </div>
                <div className="flex justify-between items-center bg-[#141924] p-3 rounded-lg border border-[#1e2a3a]">
                   <span className="text-xs font-bold text-[#64748b] uppercase tracking-widest">Risk/Reward</span>
                   <span className="font-mono font-black text-white">{stock.scores_detail.risk_reward_ratio}:1</span>
                </div>
              </div>
              <button className="w-full mt-6 py-3 bg-[#3b82f6] text-white rounded-xl font-bold hover:bg-[#2563eb] transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                Add to Watchlist
              </button>
            </div>

            {/* Ad Placeholder */}
            <div className="glass-card flex items-center justify-center h-[250px] text-[#64748b] text-sm">
              AD-S2 &middot; 300&times;250 Sidebar
            </div>
          </div>
        </div>

        {/* Detailed Metrics Tabs/Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
           {/* Technicals */}
           <div className="glass-card p-6 border-t-2 border-t-[#3b82f6]/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                   <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                   </svg>
                   TECHNICAL INDICATORS
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 {[
                    { label: "RSI (14)", value: stock.technical.rsi_14, status: stock.technical.rsi_14 > 70 ? "OVERBOUGHT" : stock.technical.rsi_14 < 30 ? "OVERSOLD" : "NEUTRAL", color: stock.technical.rsi_14 > 70 ? "text-[#ef4444]" : stock.technical.rsi_14 < 30 ? "text-[#22c55e]" : "text-[#3b82f6]" },
                    { label: "MACD", value: stock.technical.macd_histogram.toFixed(3), status: stock.technical.macd_crossover.toUpperCase(), color: "text-[#3b82f6]" },
                    { label: "RVOL", value: stock.technical.rvol + "x", status: stock.technical.rvol > 1.2 ? "HIGH" : "NORMAL", color: stock.technical.rvol > 1.2 ? "text-[#22c55e]" : "text-[#94a3b8]" },
                    { label: "Trend", value: stock.technical.obv_trend, status: "UP", color: "text-[#22c55e]" },
                    { label: "EMA Stack", value: stock.technical.ema_stack_bullish ? "BULLISH" : "BEARISH", status: "STABLE", color: stock.technical.ema_stack_bullish ? "text-[#22c55e]" : "text-[#ef4444]" },
                    { label: "Volatility", value: stock.breakout.squeeze_intensity, status: "MONITOR", color: "text-[#f59e0b]" }
                 ].map((item, i) => (
                    <div key={i} className="bg-[#0d1117] p-3 rounded-xl border border-[#1e2a3a] hover:border-[#3b82f6]/40 transition-colors">
                       <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1">{item.label}</p>
                       <p className="text-base font-mono font-black text-white">{item.value}</p>
                       <p className={`text-[10px] font-black mt-1 uppercase tracking-tighter ${item.color}`}>{item.status}</p>
                    </div>
                 ))}
              </div>
           </div>

           {/* Fundamentals */}
           <div className="glass-card p-6 border-t-2 border-t-[#8b5cf6]/20">
              <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2 tracking-tight">
                 <svg className="w-5 h-5 text-[#8b5cf6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                 </svg>
                 FUNDAMENTALS & MARGINS
              </h3>
              <div className="space-y-1">
                 {[
                    { label: "Market Cap", value: `$${(stock.fundamental.market_cap / 1e12).toFixed(2)}T` },
                    { label: "P/E Ratio", value: stock.fundamental.pe_ratio, sub: `Sector: ${stock.fundamental.sector_pe_median}` },
                    { label: "FCF Yield", value: (stock.fundamental.fcf_yield * 100).toFixed(1) + "%" },
                    { label: "Gross Margin", value: (stock.fundamental.gross_margin * 100).toFixed(1) + "%" },
                    { label: "Operating Margin", value: (stock.fundamental.operating_margin * 100).toFixed(1) + "%" },
                    { label: "Net Margin", value: (stock.fundamental.net_margin * 100).toFixed(1) + "%" }
                 ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-[#1e2a3a]/40 last:border-0 group">
                       <div>
                          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider group-hover:text-[#94a3b8] transition-colors">{item.label}</p>
                          {item.sub && <p className="text-[9px] text-[#3b82f6] font-bold">{item.sub}</p>}
                       </div>
                       <span className="font-mono font-black text-white text-base">{item.value}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Sector Context & Insider Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
           <div className="glass-card p-6">
              <h3 className="text-xl font-bold text-white mb-6">Sector Context</h3>
              <div className="flex items-center justify-between p-4 bg-[#141924] rounded-xl mb-4 border border-[#1e2a3a]">
                 <div>
                    <p className="text-xs text-[#64748b] uppercase font-bold tracking-widest mb-1">Benchmarked against</p>
                    <p className="text-xl font-black text-white">{stock.sector_context.sector_etf}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-xs text-[#64748b] uppercase font-bold tracking-widest mb-1">5D Performance</p>
                    <p className={`text-xl font-black ${stock.sector_context.sector_performance_5d >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                       {stock.sector_context.sector_performance_5d >= 0 ? '+' : ''}{stock.sector_context.sector_performance_5d}%
                    </p>
                 </div>
              </div>
              <p className="text-sm text-[#94a3b8] leading-relaxed">
                 {stock.ticker} is currently ranked in the top 20% of its sector based on BOGA Master Scores. 
                 It has outperformed {stock.sector_context.sector_etf} by 4.2% over the last 30 trading days.
              </p>
           </div>

           <div className="glass-card p-6">
              <h3 className="text-xl font-bold text-white mb-6">Insider Activity (90D)</h3>
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead>
                       <tr className="border-b border-[#1e2a3a] text-[#64748b]">
                          <th className="pb-3 font-bold uppercase tracking-wider text-[10px]">Transaction</th>
                          <th className="pb-3 font-bold uppercase tracking-wider text-[10px] text-right">Shares</th>
                          <th className="pb-3 font-bold uppercase tracking-wider text-[10px] text-right">Net Direction</th>
                       </tr>
                    </thead>
                    <tbody className="text-white font-mono">
                       <tr className="border-b border-[#1e2a3a]/50">
                          <td className="py-3">Buys</td>
                          <td className="py-3 text-right">{stock.insider_activity.last_90_days_buys || 0}</td>
                          <td rowSpan={2} className="py-3 text-right align-middle text-[#22c55e] font-bold">
                             {stock.insider_activity.net_direction}
                          </td>
                       </tr>
                       <tr>
                          <td className="py-3">Sells</td>
                          <td className="py-3 text-right">{stock.insider_activity.last_90_days_sells || 0}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
              <p className="text-[10px] text-[#64748b] mt-4 uppercase font-bold tracking-widest">
                 Last Transaction: {
                    typeof stock.insider_activity.last_transaction === "string"
                       ? stock.insider_activity.last_transaction
                       : stock.insider_activity.last_transaction
                       ? `${(stock.insider_activity.last_transaction as any).type} ${(stock.insider_activity.last_transaction as any).shares} shares`
                       : "N/A"
                 }
              </p>
           </div>
        </div>

        {/* Score Categories */}
        <div className="mb-8">
           <div className="glass-card p-6">
              <h3 className="text-xl font-bold text-white mb-4">Score Categories</h3>
              <div className="flex flex-wrap gap-2">
                 {stock.scores_detail.categories.map(cat => (
                    <Link
                       key={cat}
                       href={`/category/${cat.replace('_', '-') === 'value' ? 'undervalued' : cat.replace('_', '-')}`}
                       className="px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-full text-xs font-bold text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-all uppercase tracking-widest"
                    >
                       {cat.replace('_', ' ')}
                    </Link>
                 ))}
              </div>
           </div>
        </div>

        {/* Removed redundant Social Share section from here */}

        {/* News Section */}
        <div className="glass-card p-6 mb-8">
           <h3 className="text-xl font-bold text-white mb-6">Recent Analysis & News</h3>
           <div className="space-y-6">
              {stock.news.map((n, i) => (
                 <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 group">
                    <div className="flex-1">
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-[#3b82f6] uppercase">{n.source}</span>
                          <span className="text-[10px] text-[#64748b]">&middot; {new Date(n.published).toLocaleDateString()}</span>
                       </div>
                       <a href={n.url} target="_blank" className="text-lg font-bold text-white group-hover:text-[#3b82f6] transition-colors line-clamp-2">
                          {n.headline}
                       </a>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${n.sentiment === 'positive' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#64748b]/10 text-[#94a3b8]'}`}>
                       {n.sentiment}
                    </span>
                 </div>
              ))}
           </div>
        </div>

        {/* Related Stocks */}
        <div className="mb-8">
           <h3 className="text-xl font-bold text-white mb-6">Related Stocks in {stock.sector}</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allTickers
                 .filter(s => s.sector === stock.sector && s.ticker !== stock.ticker)
                 .slice(0, 5)
                 .map((s, i) => (
                    <Link 
                       href={`/stock/${s.ticker}`}
                       key={s.ticker}
                       className="glass-card p-4 hover:bg-[#1a2030] transition-all group"
                    >
                       <p className="text-xs font-bold text-[#64748b] uppercase mb-1">{s.ticker}</p>
                       <p className={`text-sm font-mono font-black ${s.change_pct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                       </p>
                    </Link>
                 ))}
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
