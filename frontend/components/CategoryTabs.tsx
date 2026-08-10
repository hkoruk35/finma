"use client";

import { useState } from "react";
import Link from "next/link";
import { StockQuickView, MasterData, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";
import MiniChart from "./stock/MiniChart";
import { formatNumber } from "@/lib/formatNumber";

const TABS = [
  { key: "top_scores", label: "Top Scores" },
  { key: "breakout", label: "Breakout" },
  { key: "value", label: "Undervalued" },
  { key: "momentum", label: "Momentum" },
  { key: "reversal", label: "Reversal" },
  { key: "dividend", label: "Passive Income" },
];

interface Props {
  master: MasterData;
  allTickers: StockQuickView[];
  customFilter?: string[];
  onClear?: () => void;
}

export default function CategoryTabs({ master, allTickers, customFilter, onClear }: Props) {
  const [active, setActive] = useState("top_scores");

  // Map ticker strings to full data
  const tickerMap = new Map(allTickers.map((t) => [t.ticker, t]));

  // Determine what cards to show
  let cards: StockQuickView[] = [];
  const menu = master.menus[active] || { tickers: [] };

  if (customFilter && customFilter.length > 0) {
    // Show intersection of customFilter and active category
    const intersection = customFilter.filter(t => menu.tickers.includes(t));
    
    // If we have an intersection, show it. Otherwise show all in theme but warn.
    const displayTickers = intersection.length > 0 ? intersection : customFilter;
    
    cards = displayTickers
      .map((t) => tickerMap.get(t))
      .filter(Boolean) as StockQuickView[];
  } else {
    const tickersInMenu = menu.tickers.slice(0, 20);
    cards = tickersInMenu
      .map((t) => tickerMap.get(t))
      .filter(Boolean) as StockQuickView[];
  }

  const isThemeFilter = !!(customFilter && customFilter.length > 0);

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                active === tab.key
                  ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                  : "bg-[#141924] text-white hover:bg-[#1a2030] hover:text-white border border-[#1e2a3a]"
              }`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">
                ({master.menus[tab.key]?.count || 0})
              </span>
            </button>
          ))}
        </div>
        
        {isThemeFilter && (
           <div className="flex items-center gap-3 bg-[#3b82f6]/10 border border-[#3b82f6]/30 px-3 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-pulse"></span>
              <p className="text-[10px] font-medium text-[#3b82f6] uppercase tracking-widest whitespace-nowrap">Theme Focus: {active.replace('_', ' ')} Applied</p>
              <button 
                onClick={() => onClear?.()}
                className="text-[10px] bg-[#3b82f6]/20 hover:bg-[#3b82f6]/40 text-white px-2 py-0.5 rounded transition-colors uppercase font-medium"
              >
                Reset
              </button>
           </div>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((stock, idx) => (
          <Link
            href={`/stock/${stock.ticker}`}
            key={stock.ticker}
            className="glass-card p-3 hover:bg-[#1a2030] transition-all duration-200 group cursor-pointer animate-fade-in border border-[#1e2a3a] hover:border-[#3b82f6]/30"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Top row: ticker + score */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xl font-medium text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter">
                  {stock.ticker}
                </span>
                <p className="text-[11px] text-[#00d2ff] font-medium uppercase tracking-wider truncate max-w-[120px]">
                  {stock.company}
                </p>
              </div>
            </div>

            {/* Chart Section */}
            <div className="mb-4 rounded-lg overflow-hidden bg-black/20 border border-white/5 h-[160px]">
               <MiniChart symbol={stock.ticker} height="160" />
            </div>

            {/* Status badge — prominent, primary */}
            <div className="mb-3">
              <span className={`inline-block px-3 py-1 rounded-md text-sm font-medium uppercase tracking-wide ${getScoreBadgeClass(stock.score_type)}`}>
                {stock.score_type.replace(/_/g, " ")}
              </span>
            </div>


            {/* AI Summary One-Liner */}
            <div className="mb-4">
              <p className="text-[12px] text-[#f1f5f9] leading-[1.3] italic line-clamp-2 min-h-[2.6em]">
                {stock.ai_short_summary || `${stock.ticker} shows a ${stock.score_type.replace(/_/g, " ").toLowerCase()} setup based on current 1D technicals.`}
              </p>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-[#00d2ff] font-medium uppercase tracking-widest">BOGA SCORE</span>
              <span className="text-[11px] font-mono font-medium text-[#3b82f6]">{formatNumber(stock.master_score, 0)} / 100</span>
            </div>
            <div className="relative w-full h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-[#3b82f6] transition-all duration-500"
                style={{ width: `${Math.min(stock.master_score, 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>

      {/* View all link */}
      <div className="text-center mt-6">
        <Link
          href={`/category/${active === "value" ? "undervalued" : active === "dividend" ? "passive-income" : active.replace("_", "-")}`}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#141924] border border-[#1e2a3a] rounded-lg text-sm font-medium text-[#3b82f6] hover:bg-[#1a2030] hover:border-[#3b82f6]/30 transition-all"
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
