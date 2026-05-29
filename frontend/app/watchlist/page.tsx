"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTicker, setNewTicker] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    // Load watchlist on mount
    const watchlistStr = localStorage.getItem("watchlist");
    const wl = watchlistStr ? JSON.parse(watchlistStr) : ["AAPL", "NVDA", "TSLA", "PLTR", "SOFI", "META"];
    setWatchlist(wl);
    fetchWatchlistData(wl);
  }, []);

  const fetchWatchlistData = async (wl: string[]) => {
    if (wl.length === 0) {
      setStocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/watchlist-data?tickers=${wl.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(data);
      }
    } catch (e) {
      console.error("Error loading watchlist data:", e);
    } finally {
      setLoading(false);
    }
  };

  const removeTicker = (ticker: string) => {
    const updated = watchlist.filter(t => t !== ticker.toUpperCase());
    setWatchlist(updated);
    localStorage.setItem("watchlist", JSON.stringify(updated));
    setStocks(stocks.filter(s => s.ticker !== ticker.toUpperCase()));
  };

  const addTicker = () => {
    const t = newTicker.trim().toUpperCase();
    if (!t) return;
    if (watchlist.includes(t)) {
      setNewTicker("");
      setShowAddDialog(false);
      return;
    }
    const updated = [...watchlist, t];
    setWatchlist(updated);
    localStorage.setItem("watchlist", JSON.stringify(updated));
    setNewTicker("");
    setShowAddDialog(false);
    fetchWatchlistData(updated);
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 70) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    if (score >= 58) return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    if (score <= 42) return "bg-red-500/20 text-red-400 border border-red-500/30";
    if (score <= 49) return "bg-red-500/10 text-red-300 border border-red-500/20";
    return "bg-slate-800 text-slate-400 border border-slate-700";
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] font-mono text-slate-300">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-lg md:text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              YOUR LIVE WATCHLIST
            </h1>
            <p className="text-slate-400 text-xs mt-2 uppercase tracking-widest leading-relaxed">
              Track swing scores & live buy/sell zones for your personal watchlist tickers
            </p>
          </div>
          <button 
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0c121d] border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/15 rounded-lg text-xs font-bold text-white transition-all uppercase tracking-wider"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Ticker
          </button>
        </header>

        {showAddDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#0c121d] border border-white/15 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">ADD TO WATCHLIST</h3>
                <button onClick={() => setShowAddDialog(false)} className="text-slate-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticker Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. SVM, AAPL, PLTR"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTicker()}
                  className="w-full bg-[#05080f] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white uppercase outline-none focus:border-emerald-500/50 transition-colors"
                  autoFocus
                />
              </div>
              <button 
                onClick={addTicker}
                className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Add Symbol
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
            <div className="w-8 h-8 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Synchronizing real-time analytics...</p>
          </div>
        ) : stocks.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-12 min-h-[300px] text-center space-y-4 bg-[#080c14]">
            <div className="w-12 h-12 rounded-full bg-[#0c121d] flex items-center justify-center text-slate-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-wider">Your watchlist is empty</p>
              <p className="text-xs text-slate-500 mt-1">Add ticker symbols to monitor real-time swing setups.</p>
            </div>
            <button 
              onClick={() => setShowAddDialog(true)}
              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-lg text-xs font-bold text-emerald-400 transition-colors uppercase tracking-wider"
            >
              Add Your First Ticker
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stocks.map((stock) => {
              const pr = stock.price || {};
              const sc = stock.scores || {};
              const sd = stock.scores_detail || {};
              const tech = stock.technical || {};
              const changePct = pr.change_pct || 0;

              return (
                <div 
                  key={stock.ticker}
                  className="bg-[#080c14] border border-white/10 rounded-2xl p-6 relative hover:border-emerald-500/30 hover:shadow-2xl transition-all duration-300 group flex flex-col justify-between"
                >
                  <button 
                    onClick={() => removeTicker(stock.ticker)}
                    className="absolute top-4 right-4 text-slate-600 hover:text-rose-400 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-[#0c121d] flex items-center justify-center font-black text-white border border-white/10 uppercase italic">
                        {stock.ticker[0]}
                      </div>
                      <div>
                        <h3 className="font-black text-white text-base group-hover:text-emerald-400 transition-colors tracking-tight">{stock.ticker}</h3>
                        <p className="text-[9px] text-[#00d2ff] uppercase tracking-wider font-bold">{stock.sector}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-end mb-5">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Current Price</p>
                        <p className="text-xl font-bold text-white">${pr.current?.toFixed(2) || "N/A"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3.5 mb-6 pt-5 border-t border-white/5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">Signal Sentiment</span>
                        <span className={`font-black px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider ${getScoreBadgeClass(sc.master_score)}`}>
                          {sc.signal_type?.replace("_", " ") || "NEUTRAL"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">BOGA AI Score</span>
                        <span className="font-bold text-white text-xs">{sc.master_score?.toFixed(0) || "50"}/100</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">Buy Target Zone</span>
                        <span className="font-bold text-slate-300 font-mono">${sd.entry_range_low?.toFixed(2)} - ${sd.entry_range_high?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">Take Profit Target</span>
                        <span className="font-bold text-emerald-400 font-mono">${sd.target_range_low?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">Stop Loss</span>
                        <span className="font-bold text-rose-400 font-mono">${sd.stop_loss?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <Link 
                    href={`/stock/${stock.ticker}`}
                    className="w-full py-2.5 bg-[#0c121d] text-emerald-400 rounded-lg text-[10px] font-black text-center border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all uppercase tracking-wider"
                  >
                    Interactive Analysis &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
