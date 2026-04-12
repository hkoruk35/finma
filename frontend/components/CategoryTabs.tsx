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
}

export default function CategoryTabs({ master, allTickers, customFilter }: Props) {
  const [active, setActive] = useState("top_scores");

  // Map ticker strings to full data
  const tickerMap = new Map(allTickers.map((t) => [t.ticker, t]));

  // Determine what cards to show
  let cards: StockQuickView[] = [];
  let isThemeFilter = false;

  if (customFilter && customFilter.length > 0) {
    cards = customFilter
      .map((t) => tickerMap.get(t))
      .filter(Boolean) as StockQuickView[];
    isThemeFilter = true;
  } else {
    const menu = master.menus[active] || { tickers: [] };
    const tickersInMenu = menu.tickers.slice(0, 8);
    cards = tickersInMenu
      .map((t) => tickerMap.get(t))
      .filter(Boolean) as StockQuickView[];
  }

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              disabled={isThemeFilter}
              className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                !isThemeFilter && active === tab.key
                  ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                  : "bg-[#141924] text-[#94a3b8] hover:bg-[#1a2030] hover:text-white border border-[#1e2a3a]"
              } ${isThemeFilter ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
            >
              {tab.label}
              <span className="ml-2 text-xs opacity-70">
                ({master.menus[tab.key]?.count || 0})
              </span>
            </button>
          ))}
        </div>
        
        {isThemeFilter && (
           <div className="flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 px-3 py-1.5 rounded-lg animate-pulse">
              <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full"></span>
              <p className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest whitespace-nowrap">Theme Focus Active</p>
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
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-lg font-black text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter">
                  {stock.ticker}
                </span>
                <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-wider truncate max-w-[120px]">
                  {stock.company}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${getScoreBadgeClass(stock.score_type)}`}>
                {stock.score_type.replace("_", " ")}
              </span>
            </div>

            {/* Score */}
            <div className="mb-3">
              <div className="text-2xl font-mono font-black text-[#3b82f6] leading-none">
                {stock.master_score.toFixed(1)}
              </div>
              <div className="text-[8px] text-[#64748b] font-bold uppercase tracking-[0.2em] mt-0.5 leading-none">SCORE</div>
            </div>

            {/* Time-Period Returns */}
            <div className="mb-4">
              <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-[0.2em] mb-2 leading-none">RETURNS</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "24H", value: stock.change_pct },
                  { label: "1W", value: stock.change_pct_1w },
                  { label: "1M", value: stock.change_pct_1m },
                  { label: "1Y", value: stock.change_pct_1y },
                ].map((period) => (
                  <div key={period.label} className="text-center">
                    <div className={`text-[11px] font-mono font-black ${
                      period.value !== undefined && period.value !== null
                        ? getChangeColor(period.value)
                        : 'text-[#64748b]'
                    }`}>
                      {period.value !== undefined && period.value !== null
                        ? `${period.value >= 0 ? '+' : ''}${period.value.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="text-[8px] text-[#4b5563] font-bold mt-0.5">{period.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary One-Liner */}
            <div className="mb-4">
              <p className="text-[10px] text-[#94a3b8] leading-tight italic line-clamp-2 min-h-[2.5em]">
                {stock.ai_short_summary || `Analysis for ${stock.ticker} points to a ${stock.score_type.replace(/_/g, " ").toLowerCase()} bias based on market metrics.`}
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
