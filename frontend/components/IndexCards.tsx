"use client";

import { MasterData } from "@/lib/data";

const INDEX_COLORS: Record<string, string> = {
  SP500: "from-blue-500/10 to-transparent",
  NASDAQ: "from-purple-500/10 to-transparent",
  DOW: "from-indigo-500/10 to-transparent",
  VIX: "from-orange-500/10 to-transparent",
  RUSSELL: "from-cyan-500/10 to-transparent",
};

// Short labels that fit in narrow mobile cards (max 4 chars)
const INDEX_SHORT_LABELS: Record<string, string> = {
  SP500: "SP500",
  NASDAQ: "NASDAQ",
  DOW: "DOW",
  RUSSELL: "RUSSEL",
  VIX: "VIX",
};

export default function IndexCards({ data }: { data: MasterData }) {
  // Support both "RUSSELL" and "RUSSELL 2000" keys from different bot versions
  const normalizedIndices: Record<string, any> = {};
  for (const [key, val] of Object.entries(data.market_indices || {})) {
    const normKey = key === "RUSSELL 2000" ? "RUSSELL" : key;
    normalizedIndices[normKey] = val;
  }

  const indexOrder = ["SP500", "NASDAQ", "DOW", "RUSSELL", "VIX"];
  const indices = indexOrder.map(name => [name, normalizedIndices[name]]).filter(([_, val]) => val);

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2 lg:gap-3 overflow-x-auto pb-2">
      {indices.map(([key, idx]: any) => (
        <div
          key={key}
          className={`glass-card p-2 sm:p-3 lg:p-4 border-l-2 ${idx.change_pct >= 0 ? 'border-l-[#22c55e]' : 'border-l-[#ef4444]'} overflow-hidden relative group h-20 sm:h-24 lg:h-28 flex flex-col justify-between flex-shrink-0 min-w-0`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${INDEX_COLORS[key] || 'from-blue-500/10'}`} />
          <div className="relative z-10 w-full h-full flex flex-col justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] sm:text-[11px] lg:text-[13px] font-black text-white uppercase tracking-[0.05em] leading-tight">{INDEX_SHORT_LABELS[key] ?? key}</span>
              <span className={`text-[10px] sm:text-[12px] lg:text-[14px] font-mono font-black px-1 py-0.25 sm:px-1.5 sm:py-0.5 lg:px-2 rounded whitespace-nowrap ${idx.change_pct >= 0 ? 'bg-green-500/10 text-[#22c55e]' : 'bg-red-500/10 text-[#ef4444]'}`}>
                {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
              </span>
            </div>

            <div className="flex items-center justify-between gap-0.5">
               <div className={`${idx.change_pct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} group-hover:scale-110 transition-transform flex-shrink-0`}>
                  {idx.change_pct >= 0 ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-8 lg:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
               </div>
               <span className="text-[6px] sm:text-[7px] lg:text-[10px] font-medium text-[#00d2ff] uppercase tracking-[0.05em] lg:tracking-widest bg-[#141924] px-1 sm:px-1.5 lg:px-2 py-0.25 sm:py-0.5 lg:py-1 rounded-md border border-[#1e2a3a] whitespace-nowrap">
                 {idx.change_pct >= 0 ? 'UP' : 'DN'}
               </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
