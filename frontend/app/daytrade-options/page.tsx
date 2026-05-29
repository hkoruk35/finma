"use client";

import { getDayTradeAllPicks } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { useState, useEffect } from "react";
import OptionStrategyCard from "@/components/OptionStrategyCard";

/**
 * DayTrade Options Portal
 * Focused on Zero-DTE or Next-Expiration strategies for intraday momentum.
 */
export default function DayTradeOptionsPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [liveOptions, setLiveOptions] = useState<any>({});
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [master, setMaster] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { getMasterData } = await import("@/lib/data");
        const [m, data, optsData] = await Promise.all([
          getMasterData(),
          getDayTradeAllPicks(),
          fetch("/latest_options_prices.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))
        ]);

        setMaster(m);
        const rawPicks = (data?.picks || []).filter((p: any) => p.dt_score >= 50);
        // Sort by dt_score
        rawPicks.sort((a: any, b: any) => (b.dt_score || 0) - (a.dt_score || 0));

        setPicks(rawPicks);
        setGeneratedAt(data?.generated_at || null);
        setLiveOptions(optsData);
        if (rawPicks.length > 0) {
          setSelectedTicker(rawPicks[0].ticker);
        }
      } catch (err) {
        setError("DayTrade data could not be loaded.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const currentPick = picks.find(p => p.ticker === selectedTicker);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#00d2ff] font-bold animate-pulse uppercase tracking-widest text-xs">Initializing DayTrade Options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      {master && <TickerTape data={master} />}

      <div className="max-w-6xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col gap-1 mb-8">
          <div className="flex items-center gap-2 text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em]">
            <span className="w-2 h-2 bg-[#10b981] rounded-full animate-ping"></span>
            DayTrade Option Portal
          </div>
          <h1 className="text-lg md:text-xl font-black tracking-tighter text-white uppercase italic">Intraday Option Strategies</h1>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
             <p className="text-sm text-[#475569]">Momentum scalping strategies for top DayTrade candidates</p>
             {generatedAt && (
               <p className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded border border-[#10b981]/20">
                 LAST SYNC: {new Date(generatedAt).toLocaleString()}
               </p>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-[#475569] uppercase tracking-widest px-2">Active Candidates</h3>
            <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {picks.map((pick) => (
                <button
                  key={pick.ticker}
                  onClick={() => setSelectedTicker(pick.ticker)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    selectedTicker === pick.ticker
                      ? "bg-[#10b981]/10 border-[#10b981]/40 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      : "bg-[#1e293b]/50 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="text-left">
                    <div className="text-sm font-black text-white">{pick.ticker}</div>
                    <div className="text-[10px] text-[#475569] font-bold truncate max-w-[120px]">{pick.company}</div>
                  </div>
                  <div className={`text-xs font-black ${pick.change_pct >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                    {pick.change_pct >= 0 ? "+" : ""}{pick.change_pct.toFixed(1)}%
                  </div>
                </button>
              ))}
              {picks.length === 0 && (
                <div className="p-4 text-center text-[#475569] text-xs font-bold uppercase">No candidates found</div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="space-y-6">
            {currentPick ? (
              <>
                <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-[#10b981]">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                       <h2 className="text-4xl font-black text-white tracking-tighter">{currentPick.ticker}</h2>
                       <span className="bg-[#10b981] text-black text-[10px] font-black px-2 py-0.5 rounded">DT SCORE: {currentPick.dt_score}</span>
                    </div>
                    <p className="text-[#475569] text-sm font-bold uppercase tracking-wide">{currentPick.company}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-[#475569] font-black uppercase tracking-widest">Price</div>
                      <div className="text-2xl font-mono font-black text-white">${currentPick.current_price.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#475569] font-black uppercase tracking-widest">VWAP Bias</div>
                      <div className={`text-2xl font-mono font-black ${currentPick.price_vs_vwap >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                        {currentPick.price_vs_vwap > 0 ? "+" : ""}{currentPick.price_vs_vwap.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Strategy 1: Momentum Call */}
                  <OptionStrategyCard 
                    title="Intraday Momentum Call"
                    ticker={currentPick.ticker}
                    price={currentPick.current_price}
                    type="CALL"
                    sentiment="BULLISH"
                    risk="MEDIUM"
                    strike={currentPick.current_price * 1.01}
                    optionData={liveOptions[currentPick.ticker]}
                    reason="Targeting a break of high-of-day with tight stops. High delta calls for maximum exposure to trend continuation."
                  />

                  {/* Strategy 2: VWAP Bounce Put (Hedge or Reversal) */}
                  <OptionStrategyCard 
                    title="VWAP Rejection Put"
                    ticker={currentPick.ticker}
                    price={currentPick.current_price}
                    type="PUT"
                    sentiment="BEARISH"
                    risk="HIGH"
                    strike={currentPick.current_price * 0.99}
                    optionData={liveOptions[currentPick.ticker]}
                    reason="If price fails to hold VWAP, a rapid flush to entry zones is likely. Tailored for quick scalp on reversal."
                  />
                </div>
              </>
            ) : (
              <div className="glass-card p-12 text-center flex flex-col items-center justify-center border-dashed border-white/10">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-3xl mb-4">🔎</div>
                 <h3 className="text-xl font-bold text-white mb-2 uppercase">Select a Candidate</h3>
                 <p className="text-[#475569] text-sm max-w-sm">Pick a ticker from the list to view intraday option strategies based on BOGA DayTrade analytics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
