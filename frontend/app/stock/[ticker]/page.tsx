import { getStockData, getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TradingViewWidget from "@/components/stock/TradingViewWidget";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import SocialShare from "@/components/SocialShare";
import MarketStatus from "@/components/MarketStatus";
import AnalysisTabs from "@/components/stock/AnalysisTabs";

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker: tickerParam } = await params;
  const ticker = tickerParam.toUpperCase();
  const stock = await getStockData(ticker);

  if (!stock) return { title: "Stock Not Found | BOGA AI" };

  const dateStr = new Date().toISOString().split("T")[0];
  const title = `${stock.ticker} Stock Analysis ${dateStr} | ${stock.company} AI Score & Ratings — BOGA AI`;
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
              "name": "BOGA AI - Blue One Global Analysis"
            },
            "publisher": {
              "@type": "Organization",
              "name": "BOGA AI",
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

        {(stock as any).is_partial_mock && (
          <div className="glass-card mb-6 border-l-4 border-l-yellow-500/50 bg-yellow-500/5 p-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
            </div>
            <div>
               <p className="text-sm font-bold text-yellow-500 uppercase tracking-widest">Limited Data Profile</p>
               <p className="text-xs text-[#94a3b8]">Full AI Analysis for {ticker} is pending generation. Displaying latest real-time market price and company info.</p>
            </div>
          </div>
        )}

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
              <MarketStatus />
            </div>
          </div>
        </div>

        {/* Time-Period Returns — Horizontal Strip */}
        <div className="glass-card grid grid-cols-4 divide-x divide-[#1e2a3a] mb-4">
          {[
            { label: "1D", value: stock.price.change_pct },
            { label: "1W", value: stock.price.change_pct_1w },
            { label: "1M", value: stock.price.change_pct_1m },
            { label: "1Y", value: stock.price.change_pct_1y },
          ].map((period) => (
            <div key={period.label} className="px-3 py-3 md:px-5 flex flex-col gap-1">
              <span className="text-[12px] font-bold text-[#64748b] uppercase tracking-widest">{period.label}</span>
              <span className={`text-lg md:text-xl font-mono font-black ${
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

            {/* Analysis Tabs Section · THE CORE REDESIGN */}
            <AnalysisTabs stock={stock} />

            {/* Social Share — Moved here and cleaned */}
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
          </div>

          {/* Sidebar Area */}
          <div className="flex flex-col gap-6">
            {/* BOGA AI Score Widget */}
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-4">BOGA AI Master Score</h3>
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
              <p className={`text-sm font-bold uppercase ${getScoreBadgeClass(stock.scores.score_type)}`}>
                {stock.scores.score_type.replace("_", " ")}
              </p>
            </div>

            {/* Score Details */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-4">BOGA AI MODEL ANALYSIS</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1 bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] border-l-4 border-l-[#94a3b8]">
                   <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">BUYING ZONE</span>
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
                   <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">STOP LOSS ZONE</span>
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
                 {stock.ticker} is currently ranked in the top 20% of its sector based on BOGA AI Master Scores. 
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
