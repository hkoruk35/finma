"use client";

import { useState } from "react";
import Link from "next/link";
import { StockQuickView, MasterData, getSignalBadgeClass, getChangeColor, formatPrice } from "@/lib/data";

const TABS = [
  { key: "top_signals", label: "Top Signals" },
  { key: "breakout", label: "Breakout" },
  { key: "value", label: "Undervalued" },
  { key: "momentum", label: "Momentum" },
  { key: "reversal", label: "Reversal (Dipten Dönüş)" },
  { key: "dividend", label: "Passive Income" },
];

interface Props {
  master: MasterData;
  allTickers: StockQuickView[];
}

export default function CategoryTabs({ master, allTickers }: Props) {
  const [active, setActive] = useState("top_signals");

  const menu = master.menus[active] || { tickers: [] };
  const tickersInMenu = menu.tickers.slice(0, 8);

  // Map ticker strings to full data
  const tickerMap = new Map(allTickers.map((t) => [t.ticker, t]));
  const cards = tickersInMenu
    .map((t) => tickerMap.get(t))
    .filter(Boolean) as StockQuickView[];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              active === tab.key
                ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                : "bg-[#141924] text-[#94a3b8] hover:bg-[#1a2030] hover:text-white border border-[#1e2a3a]"
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs opacity-70">
              ({master.menus[tab.key]?.count || 0})
            </span>
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((stock, idx) => (
          <Link
            href={`/stock/${stock.ticker}`}
            key={stock.ticker}
            className="glass-card p-4 hover:bg-[#1a2030] transition-all duration-200 group cursor-pointer animate-fade-in border border-[#1e2a3a] hover:border-[#3b82f6]/30"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Top row: ticker + signal */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xl font-black text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter">
                  {stock.ticker}
                </span>
                <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider truncate max-w-[120px]">
                  {stock.company}
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${getSignalBadgeClass(stock.signal_type)}`}>
                {stock.signal_type.replace("_", " ")}
              </span>
            </div>

            {/* Score + Change */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <div className="text-3xl font-mono font-black text-[#3b82f6] leading-none">
                  {stock.master_score.toFixed(1)}
                </div>
                <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-[0.2em] mt-1 leading-none">SCORE</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-mono font-black ${getChangeColor(stock.change_pct)} leading-none`}>
                  {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                </div>
                <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-[0.2em] mt-1 leading-none">24H CHANGE</div>
              </div>
            </div>

            {/* Entry Range */}
            <div className="mb-4 bg-[#0a0e17] p-2 rounded-lg border border-[#1e2a3a]">
               <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest mb-1">ENTRY RANGE</div>
               <div className="text-sm font-mono font-bold text-white tracking-tight">
                  ${formatPrice(stock.entry_range_low)} - ${formatPrice(stock.entry_range_high)}
               </div>
            </div>

            <div className="relative w-full h-2 bg-[#1e2a3a] rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full score-gradient-noble transition-all duration-500"
                style={{ width: `${Math.min(stock.master_score, 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* View all link */}
      <div className="text-center mt-6">
        <Link
          href={`/category/${active === "value" ? "undervalued" : active.replace("_", "-")}`}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#141924] border border-[#1e2a3a] rounded-lg text-sm font-semibold text-[#3b82f6] hover:bg-[#1a2030] hover:border-[#3b82f6]/30 transition-all"
        >
          View All {TABS.find((t) => t.key === active)?.label}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
