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
    <div className="py-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-2 h-10 bg-[#f59e0b] rounded-full shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
        <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">
          Top 3 of the Day
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {master.top_3_overall.map((item, idx) => {
          const stock = tickerMap.get(item.ticker);
          const medals = ["bg-gradient-to-br from-[#f59e0b] to-[#d97706]",
                          "bg-gradient-to-br from-[#94a3b8] to-[#64748b]",
                          "bg-gradient-to-br from-[#d97706] to-[#92400e]"];
          return (
            <Link
              key={item.ticker}
              href={`/stock/${item.ticker}`}
              className="glass-card p-6 hover:bg-[#1a2030] transition-all duration-300 group relative overflow-hidden border-2 border-transparent hover:border-[#3b82f6]/20"
            >
              {/* Rank badge */}
              <div className={`absolute top-0 right-0 w-14 h-14 rounded-bl-3xl flex items-center justify-center text-lg font-black text-white shadow-2xl ${medals[idx]}`}>
                #{idx + 1}
              </div>

              {/* Ticker & Company */}
              <div className="mb-4">
                <div className="text-4xl font-black text-white group-hover:text-[#3b82f6] transition-colors tracking-tighter uppercase">
                  {item.ticker}
                </div>
                <div className="text-sm font-bold text-[#64748b] tracking-wider mt-1">
                   {stock?.company || item.ticker}
                </div>
              </div>

              {/* Score + Signal */}
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-end gap-2">
                   <div className="text-6xl font-mono font-black text-[#3b82f6] leading-none">
                     {item.score.toFixed(1)}
                   </div>
                   <div className="text-[9px] text-[#64748b] font-black uppercase tracking-[0.2em] mb-2">FinMA AI SCORE</div>
                </div>
                <div className="flex">
                  <span className={`px-5 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl ${getSignalBadgeClass(item.signal)}`}>
                    {item.signal.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Time-Period Returns */}
              <div className="mb-6">
                 <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest mb-3 block">PERIOD RETURNS</span>
                 <div className="grid grid-cols-4 gap-2">
                   {[
                     { label: "24H", value: stock?.change_pct },
                     { label: "1W", value: stock?.change_pct_1w },
                     { label: "1M", value: stock?.change_pct_1m },
                     { label: "1Y", value: stock?.change_pct_1y },
                   ].map((period) => (
                     <div key={period.label} className="text-center">
                       <div className={`text-sm font-mono font-black ${
                         period.value !== undefined && period.value !== null
                           ? getChangeColor(period.value)
                           : 'text-[#64748b]'
                       }`}>
                         {period.value !== undefined && period.value !== null
                           ? `${period.value >= 0 ? '+' : ''}${period.value.toFixed(1)}%`
                           : '—'}
                       </div>
                       <div className="text-[8px] text-[#4b5563] font-bold mt-1">{period.label}</div>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Score bar */}
              <div className="relative w-full h-3 bg-[#1e2a3a] rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full score-gradient-premium shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-1000"
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
