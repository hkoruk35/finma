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
            className="glass-card p-4 hover:bg-[#1a2030] transition-all duration-200 group cursor-pointer animate-fade-in"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* Top row: ticker + signal */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-lg font-bold text-white group-hover:text-[#3b82f6] transition-colors">
                  {stock.ticker}
                </span>
                <p className="text-xs text-[#64748b] truncate max-w-[140px]">
                  {stock.company}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getSignalBadgeClass(stock.signal_type)}`}>
                {stock.signal_type.replace("_", " ")}
              </span>
            </div>

            {/* Score + Change (No price) */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-2xl font-mono font-black text-[#3b82f6]">
                  {stock.master_score.toFixed(1)}
                </div>
                <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest leading-none">FinMA Score</div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-mono font-black ${getChangeColor(stock.change_pct)}`}>
                  {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                </div>
                <div className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest leading-none">Change</div>
              </div>
            </div>

            {/* Score bar */}
            <div className="relative w-full h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full score-gradient transition-all duration-500"
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
