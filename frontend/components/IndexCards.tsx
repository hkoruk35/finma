"use client";

import { MasterData } from "@/lib/data";

const INDEX_COLORS: Record<string, string> = {
  SP500: "from-blue-500/10 to-transparent",
  NASDAQ: "from-purple-500/10 to-transparent",
  DOW: "from-indigo-500/10 to-transparent",
  VIX: "from-orange-500/10 to-transparent",
  RUSSELL: "from-cyan-500/10 to-transparent",
};

export default function IndexCards({ data }: { data: MasterData }) {
  const indexOrder = ["SP500", "NASDAQ", "DOW", "RUSSELL", "VIX"];
  const indices = indexOrder.map(name => [name, data.market_indices[name]]).filter(([_, val]) => val);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
      {indices.map(([key, idx]: any) => (
        <div
          key={key}
          className={`glass-card p-3 sm:p-4 border-l-2 ${idx.change_pct >= 0 ? 'border-l-[#22c55e]' : 'border-l-[#ef4444]'} overflow-hidden relative group h-24 sm:h-28 flex flex-col justify-between`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${INDEX_COLORS[key] || 'from-blue-500/10'}`} />
          <div className="relative z-10 w-full h-full flex flex-col justify-between">
            <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start">
              <span className="text-[8px] sm:text-[10px] font-black text-[#94a3b8] uppercase tracking-[0.15em] sm:tracking-[0.2em] leading-tight">{key === 'RUSSELL' ? 'R2000' : key}</span>
              <span className={`text-[9px] sm:text-[11px] font-mono font-black px-1.5 py-0.5 sm:px-2 rounded whitespace-nowrap ${idx.change_pct >= 0 ? 'bg-green-500/10 text-[#22c55e]' : 'bg-red-500/10 text-[#ef4444]'}`}>
                {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
              </span>
            </div>
            
            <div className="flex items-center justify-between mt-auto gap-1">
               <div className={`${idx.change_pct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} group-hover:scale-110 transition-transform flex-shrink-0`}>
                  {idx.change_pct >= 0 ? (
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
               </div>
               <span className="text-[7px] sm:text-[10px] font-bold text-[#64748b] uppercase tracking-[0.1em] sm:tracking-widest bg-[#141924] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-[#1e2a3a] whitespace-nowrap">
                 {idx.change_pct >= 0 ? 'BULLISH' : 'BEARISH'}
               </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
