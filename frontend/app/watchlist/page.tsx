import { getMasterData, getAllTickers, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";

// Mock user watchlist for demonstration
const MOCK_WATCHLIST = ["AAPL", "NVDA", "TSLA", "PLTR", "SOFI", "META"];

export default async function WatchlistPage() {
  const [master, allTickers] = await Promise.all([
    getMasterData(),
    getAllTickers()
  ]);

  if (!master) {
    return <div className="min-h-screen bg-[#0d1117]" />;
  }

  const tickerMap = new Map(allTickers.map((t) => [t.ticker, t]));
  const stocks = MOCK_WATCHLIST
    .map((t) => tickerMap.get(t))
    .filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <TickerTape data={master} />
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
           <div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">Your Smart Watchlist</h1>
              <p className="text-[#94a3b8] text-lg max-w-2xl leading-relaxed">
                 Tracking {stocks.length} of 10 available slots. Monitor today's scores for your selected equities.
              </p>
           </div>
           <button className="flex items-center gap-2 px-6 py-3 bg-[#141924] border border-[#1e2a3a] rounded-xl text-sm font-bold text-white hover:bg-[#1a2030] transition-all">
              <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Ticker
           </button>
        </header>

        {/* Watchlist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {stocks.map((stock, idx) => (
              <div
                key={stock!.ticker}
                className="glass-card hover:border-[#3b82f6]/30 transition-all duration-300 group p-6 flex flex-col relative"
              >
                {/* Remove button */}
                <button className="absolute top-4 right-4 text-[#2c3e50] hover:text-[#ef4444] transition-colors">
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                   </svg>
                </button>

                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 rounded-xl bg-[#1e2a3a] flex items-center justify-center font-bold text-white border border-[#3b82f6]/10">
                      {stock!.ticker[0]}
                   </div>
                   <div>
                      <h3 className="font-bold text-white group-hover:text-[#3b82f6] transition-colors">{stock!.ticker}</h3>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-wider">{stock!.sector}</p>
                   </div>
                </div>

                <div className="flex justify-between items-end mb-6">
                   <div>
                      <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">Current Price</p>
                      <p className="text-2xl font-mono font-bold text-white">${formatPrice(stock!.price)}</p>
                   </div>
                   <div className="text-right">
                      <p className={`text-sm font-mono font-bold ${getChangeColor(stock!.change_pct)}`}>
                         {stock!.change_pct >= 0 ? "+" : ""}{stock!.change_pct.toFixed(2)}%
                      </p>
                   </div>
                </div>

                <div className="space-y-4 mb-6 pt-6 border-t border-[#1e2a3a]">
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748b]">Score Type</span>
                      <span className={`font-bold ${getScoreBadgeClass(stock!.score_type)} px-2 py-0.5 rounded`}>
                         {stock!.score_type.replace("_", " ")}
                      </span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-[#64748b]">FinMA AI Score</span>
                      <span className="font-mono font-bold text-white">{stock!.master_score.toFixed(1)}</span>
                   </div>
                </div>

                <Link 
                  href={`/stock/${stock!.ticker}`}
                  className="mt-auto w-full py-2.5 bg-[#141924] text-[#3b82f6] rounded-lg text-xs font-bold text-center border border-[#1e2a3a] hover:bg-[#1e2a3a] transition-all"
                >
                  Full Daily Analysis &rarr;
                </Link>
              </div>
            ))}

            {/* Empty Slot Card */}
            {stocks.length < 10 && (
               <div className="border-2 border-dashed border-[#1e2a3a] rounded-2xl flex flex-col items-center justify-center p-6 min-h-[300px] hover:border-[#3b82f6]/30 transition-all group cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-[#141924] flex items-center justify-center text-[#2c3e50] group-hover:text-[#3b82f6] transition-colors mb-4">
                     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                     </svg>
                  </div>
                  <p className="text-sm font-bold text-[#64748b] group-hover:text-white transition-colors">Add Ticker</p>
                  <p className="text-[10px] text-[#2c3e50] mt-1 uppercase tracking-widest">{10 - stocks.length} slots left</p>
               </div>
            )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
