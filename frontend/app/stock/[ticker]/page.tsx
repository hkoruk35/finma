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
    metadataBase: new URL("https://bogarunner.com"),
    title,
    description,
    alternates: {
      canonical: `https://bogarunner.com/stock/${ticker.toLowerCase()}`,
    },
    openGraph: {
      title,
      description,
      url: `https://bogarunner.com/stock/${ticker.toLowerCase()}`,
      images: [
        {
          url: "https://bogarunner.com/finmawave.png",
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
            "image": "https://bogarunner.com/finmawave.png",
            "author": {
              "@type": "Organization",
              "name": "BOGA Daily +500"
            },
            "publisher": {
              "@type": "Organization",
              "name": "BOGA",
              "logo": {
                "@type": "ImageObject",
                "url": "https://bogarunner.com/finmawave.png"
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
                       { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://bogarunner.com" },
                       { "@type": "ListItem", "position": 2, "name": stock.ticker, "item": `https://bogarunner.com/stock/${ticker.toLowerCase()}` }
                    ]
                 })
              }}
           />
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">{stock.ticker}</span>
        </nav>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-2xl bg-[#1e2a3a] overflow-hidden border border-[#3b82f6]/20">
              <img src="/finmawave.png" alt="BOGA" className="w-full h-full object-cover opacity-50 absolute inset-0" />
              <div className="relative z-10 w-full h-full flex items-center justify-center text-3xl font-black text-white">
                {stock.ticker[0]}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter">
                  {stock.ticker} — {stock.company} Stock Analysis
                </h1>
                <span className={`px-4 py-1 rounded-xl text-xs font-black uppercase tracking-widest ${getScoreBadgeClass(stock.scores.score_type)}`}>
                  {stock.scores.score_type.replace("_", " ")}
                </span>
              </div>
              <p className="text-[#94a3b8] font-bold text-lg">{stock.company} &middot; {stock.sector}</p>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end p-4 rounded-2xl bg-[#3b82f6]/5 border border-[#3b82f6]/10">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-mono font-black text-white leading-none">
                ${formatPrice(stock.price.current)}
              </span>
              <span className={`text-2xl font-mono font-black ${getChangeColor(stock.price.change_pct)}`}>
                {stock.price.change_pct >= 0 ? "+" : ""}
                {stock.price.change_pct.toFixed(2)}%
              </span>
            </div>
            <p className="text-sm font-bold text-[#64748b] mt-1 uppercase tracking-widest">Last Close Price</p>
          </div>
        </div>

        {/* Time-Period Returns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "24H CHANGE", value: stock.price.change_pct },
            { label: "1-WEEK RETURN", value: stock.price.change_pct_1w },
            { label: "1-MONTH RETURN", value: stock.price.change_pct_1m },
            { label: "1-YEAR RETURN", value: stock.price.change_pct_1y },
          ].map((period) => (
            <div
              key={period.label}
              className="glass-card p-4 flex flex-col items-center justify-center border-l-4"
              style={{
                borderLeftColor: period.value !== undefined && period.value !== null
                  ? (period.value >= 0 ? '#22c55e' : '#ef4444')
                  : '#1e2a3a'
              }}
            >
              <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mb-2">
                {period.label}
              </p>
              <p className={`text-2xl font-mono font-black ${
                period.value !== undefined && period.value !== null
                  ? getChangeColor(period.value)
                  : 'text-[#64748b]'
              }`}>
                {period.value !== undefined && period.value !== null
                  ? `${period.value >= 0 ? '+' : ''}${period.value.toFixed(2)}%`
                  : '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Chart Area */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="glass-card p-3 md:p-4 flex flex-col">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-3">
                <h3 className="font-bold text-white flex items-center gap-2 text-sm md:text-base">
                  <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Live Market Chart
                </h3>
                <div className="flex gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-[9px] md:text-[10px] text-[#94a3b8]">1D</span>
                  <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-[9px] md:text-[10px] text-[#94a3b8]">NY TIME</span>
                </div>
              </div>
              <div className="w-full overflow-hidden rounded-xl border border-[#1e2a3a] flex-1 min-h-[300px] md:min-h-[450px]">
                <TradingViewWidget symbol={stock.ticker} />
              </div>
            </div>

            {/* AI Summary Card */}
            <div className="glass-card p-6 border-l-4 border-l-[#3b82f6]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white text-gradient">BOGA AI Daily Brief</h3>
              </div>
              <p className="text-[#94a3b8] leading-relaxed text-lg italic">
                "{stock.ai_summary}"
              </p>
              <div className="mt-6 pt-6 border-t border-[#1e2a3a] flex items-center justify-between">
                <div className="flex gap-4">
                   <div className="text-center">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Confidence</p>
                      <p className="font-mono font-bold text-white">{(stock.scores.confidence * 100).toFixed(0)}%</p>
                   </div>
                   <div className="text-center border-l border-[#1e2a3a] pl-4">
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Sentiment</p>
                      <p className="font-mono font-bold text-[#22c55e]">Bullish</p>
                   </div>
                </div>
                <Link href="#social-share-section" className="text-[#3b82f6] text-sm font-semibold hover:underline flex items-center gap-1">
                  Share Analysis
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
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
              <h3 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-4">BOGA AI Model Projection</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a]">
                   <span className="text-[12px] font-bold text-[#64748b] uppercase tracking-widest">Strategic Observation Zone</span>
                   <span className="font-mono font-black text-xl text-white">
                      ${formatPrice(stock.scores_detail.entry_range_low)} - ${formatPrice(stock.scores_detail.entry_range_high)}
                   </span>
                </div>
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a]">
                   <span className="text-[12px] font-bold text-[#64748b] uppercase tracking-widest">Projected Growth Objective</span>
                   <span className="font-mono font-black text-xl text-[#22c55e]">
                      ${formatPrice(stock.scores_detail.target_range_low)} - ${formatPrice(stock.scores_detail.target_range_high)}
                   </span>
                </div>
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a]">
                   <span className="text-[12px] font-bold text-[#64748b] uppercase tracking-widest">Model Invalidation Level</span>
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
           <div className="glass-card p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                 <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                 </svg>
                 Technical Indicators
              </h3>
              <div className="grid grid-cols-2 gap-4">
                 {[
                    { label: "RSI (14)", value: stock.technical.rsi_14, status: stock.technical.rsi_14 > 70 ? "Overbought" : stock.technical.rsi_14 < 30 ? "Oversold" : "Neutral" },
                    { label: "MACD", value: stock.technical.macd_histogram.toFixed(3), status: stock.technical.macd_crossover.toUpperCase() },
                    { label: "RVOL", value: stock.technical.rvol + "x", status: stock.technical.rvol > 1.2 ? "High" : "Normal" },
                    { label: "Trends", value: stock.technical.obv_trend, status: "UP" },
                    { label: "EMA Stack", value: stock.technical.ema_stack_bullish ? "Bullish" : "Bearish", status: "STABLE" },
                    { label: "BB Squeeze", value: stock.breakout.squeeze_intensity, status: "MONITOR" }
                 ].map((item, i) => (
                    <div key={i} className="bg-[#141924] p-4 rounded-xl border border-[#1e2a3a]">
                       <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">{item.label}</p>
                       <p className="text-lg font-mono font-bold text-white">{item.value}</p>
                       <p className="text-[10px] font-bold text-[#3b82f6] mt-1">{item.status}</p>
                    </div>
                 ))}
              </div>
           </div>

           {/* Fundamentals */}
           <div className="glass-card p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                 <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                 </svg>
                 Fundamentals & Margins
              </h3>
              <div className="space-y-3">
                 {[
                    { label: "Market Cap", value: `$${(stock.fundamental.market_cap / 1e12).toFixed(2)}T` },
                    { label: "P/E Ratio", value: stock.fundamental.pe_ratio, sub: `vs Sector: ${stock.fundamental.sector_pe_median}` },
                    { label: "FCF Yield", value: (stock.fundamental.fcf_yield * 100).toFixed(1) + "%" },
                    { label: "Gross Margin", value: (stock.fundamental.gross_margin * 100).toFixed(1) + "%" },
                    { label: "Operating Margin", value: (stock.fundamental.operating_margin * 100).toFixed(1) + "%" },
                    { label: "Net Margin", value: (stock.fundamental.net_margin * 100).toFixed(1) + "%" }
                 ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-[#1e2a3a] last:border-0">
                       <div>
                          <p className="text-sm text-[#94a3b8]">{item.label}</p>
                          {item.sub && <p className="text-[10px] text-[#64748b]">{item.sub}</p>}
                       </div>
                       <span className="font-mono font-bold text-white">{item.value}</span>
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

        {/* Social Share */}
        <div id="social-share-section" className="glass-card p-8 border-t-2 border-t-[#3b82f6] mb-8">
           <div className="flex flex-col gap-6">
             <div>
               <h3 className="text-2xl font-black text-white mb-2">Share This Insight</h3>
               <p className="text-[#94a3b8] text-sm">Help others discover this score. Professional analysts share high-conviction data.</p>
             </div>
             <SocialShare
               ticker={stock.ticker}
               score={stock.scores.master_score}
               scoreType={stock.scores.score_type}
             />
           </div>
        </div>

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
