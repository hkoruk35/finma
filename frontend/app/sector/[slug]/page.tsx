import { getMasterData, getAllTickers, getSignalBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sectorName = SECTOR_NAME_MAP[slug];
  if (!sectorName) return { title: "Sector Not Found | FinMA" };

  const title = `${sectorName} Stocks Analysis & AI Signals | Daily ${SECTOR_ETF[sectorName]} Reports — FinMA`;
  const description = `Real-time analysis of the top equities in the ${sectorName} sector. Compare ${SECTOR_ETF[sectorName]} performance, AI scores, and daily trading signals for the strongest stocks in this industry.`;

  return {
    metadataBase: new URL("https://finmasmart.com"),
    title,
    description,
    alternates: {
      canonical: `https://finmasmart.com/sector/${slug}`,
    },
  };
}

const SECTOR_NAME_MAP: Record<string, string> = {
  "technology": "Technology",
  "financials": "Financials",
  "healthcare": "Healthcare",
  "consumer-discretionary": "Consumer Discretionary",
  "industrials": "Industrials",
  "communication-services": "Communication Services",
  "consumer-staples": "Consumer Staples",
  "energy": "Energy",
  "real-estate": "Real Estate",
  "high-growth": "High-Growth",
  "materials": "Materials",
  "utilities": "Utilities",
};

const SECTOR_ETF: Record<string, string> = {
  "Technology": "XLK",
  "Financials": "XLF",
  "Healthcare": "XLV",
  "Consumer Discretionary": "XLY",
  "Industrials": "XLI",
  "Communication Services": "XLC",
  "Consumer Staples": "XLP",
  "Energy": "XLE",
  "Real Estate": "XLRE",
  "High-Growth": "QQQ",
  "Materials": "XLB",
  "Utilities": "XLU",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SectorPage({ params }: Props) {
  const { slug } = await params;
  const sectorName = SECTOR_NAME_MAP[slug];

  if (!sectorName) {
    notFound();
  }

  const [master, allTickers] = await Promise.all([
    getMasterData(),
    getAllTickers()
  ]);

  if (!master) {
    return <div className="min-h-screen bg-[#0d1117]" />;
  }

  const stocks = allTickers.filter((t) => t.sector === sectorName);
  const sectorStats = master.sector_summary[sectorName] || { avg_score: 0, top_ticker: "N/A", stock_count: 0 };
  const etf = SECTOR_ETF[sectorName];

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <TickerTape data={master} />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">{sectorName}</span>
        </nav>

        {/* Hero Section */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <h1 className="text-3xl md:text-5xl font-extrabold text-white">
                  {sectorName}
               </h1>
               <span className="px-2 py-0.5 rounded bg-[#1e2a3a] text-xs font-mono text-[#3b82f6] border border-[#3b82f6]/20">
                  {etf}
               </span>
            </div>
            <p className="text-[#94a3b8] text-lg max-w-2xl">
               In-depth analysis of the {stocks.length} top equities within the {sectorName} sector.
            </p>
          </div>
          
          <div className="flex gap-4">
             <div className="glass-card p-4 text-center min-w-[120px]">
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Sector Avg</p>
                <p className="text-2xl font-mono font-bold text-white">{sectorStats.avg_score.toFixed(1)}</p>
             </div>
             <div className="glass-card p-4 text-center min-w-[120px]">
                <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Top Pick</p>
                <p className="text-2xl font-mono font-bold text-[#22c55e]">{sectorStats.top_ticker}</p>
             </div>
          </div>
        </header>

        {/* Sector Health / Market Indices Snippet */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
           <div className="lg:col-span-3 glass-card p-6">
              <h3 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-6">Sector Momentum Items</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                       </svg>
                    </div>
                    <div>
                       <p className="text-xs text-[#64748b]">Outperforming</p>
                       <p className="text-sm font-bold text-white">S&P 500 Index</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                    </div>
                    <div>
                       <p className="text-xs text-[#64748b]">Median Volatility</p>
                       <p className="text-sm font-bold text-white">Normal Range</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6]">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                       </svg>
                    </div>
                    <div>
                       <p className="text-xs text-[#64748b]">Risk Status</p>
                       <p className="text-sm font-bold text-white">Low Systematic Risk</p>
                    </div>
                 </div>
              </div>
           </div>
           {/* Ad Slot */}
           <div className="glass-card flex items-center justify-center h-full min-h-[140px] text-[#64748b] text-sm">
              AD-S1 &middot; Sidebar
           </div>
        </div>

        {/* Ticker Table */}
        <div className="glass-card overflow-hidden">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-[#141924] border-b border-[#1e2a3a]">
                    <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase">Ticker</th>
                    <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase">Change (%)</th>
                    <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase">FinMA Score</th>
                    <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase">Signal</th>
                    <th className="px-6 py-4 text-xs font-bold text-[#64748b] uppercase text-right">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]">
                 {stocks.map((stock) => (
                    <tr key={stock.ticker} className="hover:bg-[#1a2030] transition-colors group">
                       <td className="px-6 py-4">
                          <div className="flex flex-col">
                             <span className="text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors">{stock.ticker}</span>
                             <span className="text-[10px] text-[#64748b] truncate max-w-[200px]">{stock.company}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <span className={`text-xl font-mono font-black ${getChangeColor(stock.change_pct)}`}>
                             {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                          </span>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-24 h-2 bg-[#141924] rounded-full overflow-hidden border border-[#1e2a3a]">
                                <div className="h-full score-gradient rounded-full" style={{ width: `${stock.master_score}%` }}></div>
                             </div>
                             <span className="text-xl font-mono font-black text-[#3b82f6] truncate">{stock.master_score.toFixed(1)}</span>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getSignalBadgeClass(stock.signal_type)}`}>
                             {stock.signal_type.replace("_", " ")}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-right">
                          <Link href={`/stock/${stock.ticker}`} className="text-[#3b82f6] text-xs font-bold hover:underline">
                             Details &rarr;
                          </Link>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </main>

      <Footer />
    </div>
  );
}
