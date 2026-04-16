"use client";

import { useState } from "react";
import Link from "next/link";
import { StockQuickView, MasterData, getScoreBadgeClass, getChangeColor, formatPrice } from "@/lib/data";

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
    const tickersInMenu = menu.tickers.slice(0, 8);
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
        
        {isThemeFilter && (
           <div className="flex items-center gap-3 bg-[#3b82f6]/10 border border-[#3b82f6]/30 px-3 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-pulse"></span>
              <p className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest whitespace-nowrap">Theme Focus: {active.replace('_', ' ')} Applied</p>
              <button 
                onClick={() => onClear?.()}
                className="text-[10px] bg-[#3b82f6]/20 hover:bg-[#3b82f6]/40 text-white px-2 py-0.5 rounded transition-colors uppercase font-black"
              >
                Reset
              </button>
           </div>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <span className="text-xl font-black text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter">
                  {stock.ticker}
                </span>
                <p className="text-[11px] text-[#64748b] font-bold uppercase tracking-wider truncate max-w-[120px]">
                  {stock.company}
                </p>
              </div>
              {/* Score — compact, secondary */}
              <div className="text-right">
                <div className="text-lg font-mono font-black text-[#3b82f6] leading-none">
                  {stock.master_score.toFixed(0)}
                </div>
                <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest leading-none">PTS</div>
              </div>
            </div>

            {/* Status badge — prominent, primary */}
            <div className="mb-3">
              <span className={`inline-block px-3 py-1 rounded-md text-sm font-black uppercase tracking-wide ${getScoreBadgeClass(stock.score_type)}`}>
                {stock.score_type.replace(/_/g, " ")}
              </span>
            </div>

            {/* Time-Period Returns */}
            <div className="mb-5">
              <div className="text-[12px] text-[#64748b] font-bold uppercase tracking-[0.2em] mb-3 leading-none">RETURNS</div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "1D", value: stock.change_pct },
                  { label: "1W", value: stock.change_pct_1w },
                  { label: "1M", value: stock.change_pct_1m },
                  { label: "1Y", value: stock.change_pct_1y },
                ].map((period) => (
                  <div key={period.label} className="text-center">
                    <div className={`text-[17px] md:text-[18px] font-mono font-black ${
                      period.value !== undefined && period.value !== null
                        ? getChangeColor(period.value)
                        : 'text-[#64748b]'
                    }`}>
                      {period.value !== undefined && period.value !== null
                        ? `${period.value >= 0 ? '+' : ''}${period.value.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="text-[11px] text-[#94a3b8] font-black mt-1 uppercase">{period.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary One-Liner */}
            <div className="mb-4">
              <p className="text-[12px] text-[#f1f5f9] leading-[1.3] italic line-clamp-2 min-h-[2.6em]">
                {stock.ai_short_summary || `${stock.ticker} shows a ${stock.score_type.replace(/_/g, " ").toLowerCase()} setup based on current 1D technicals.`}
              </p>
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
