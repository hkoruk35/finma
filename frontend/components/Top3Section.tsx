"use client";

import Link from "next/link";
import { MasterData, StockQuickView, getSignalBadgeClass, getChangeColor, formatPrice } from "@/lib/data";

interface Props {
  master: MasterData;
  allTickers: StockQuickView[];
}

export default function Top3Section({ master, allTickers }: Props) {
  const tickerMap = new Map(allTickers.map((t) => [t.ticker, t]));

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-[#f59e0b] text-2xl">&#9733;</span>
        Top 3 of the Day
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {master.top_3_overall.map((item, idx) => {
          const stock = tickerMap.get(item.ticker);
          const medals = ["bg-gradient-to-br from-[#f59e0b] to-[#d97706]",
                          "bg-gradient-to-br from-[#94a3b8] to-[#64748b]",
                          "bg-gradient-to-br from-[#d97706] to-[#92400e]"];
          return (
            <Link
              key={item.ticker}
              href={`/stock/${item.ticker}`}
              className="glass-card p-5 hover:bg-[#1a2030] transition-all duration-200 group relative overflow-hidden"
            >
              {/* Rank badge */}
              <div className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${medals[idx]}`}>
                {idx + 1}
              </div>

              {/* Ticker & Company */}
              <div className="mb-3">
                <div className="text-2xl font-bold text-white group-hover:text-[#3b82f6] transition-colors">
                  {item.ticker}
                </div>
                <div className="text-sm text-[#64748b]">
                  {stock?.company || item.ticker}
                </div>
              </div>

              {/* Score + Signal (Moved up for prominence) */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-4xl font-mono font-black text-[#3b82f6]">
                    {item.score.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest leading-none">FinMA AI Score</div>
                </div>
                <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${getSignalBadgeClass(item.signal)}`}>
                  {item.signal.replace("_", " ")}
                </span>
              </div>

              {/* Price & change (No price) */}
              {stock && (
                <div className="flex items-center gap-3">
                  <span className={`text-4xl font-mono font-black ${getChangeColor(stock.change_pct)}`}>
                    {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest">24H Change</span>
                </div>
              )}

              {/* Score bar */}
              <div className="relative w-full h-2.5 bg-[#1e2a3a] rounded-full overflow-hidden mt-3">
                <div
                  className="h-full rounded-full score-gradient"
                  style={{ width: `${Math.min(item.score, 100)}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
