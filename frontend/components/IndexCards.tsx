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
  const indices = Object.entries(data.market_indices);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {indices.map(([key, idx]) => (
        <div 
          key={key} 
          className={`glass-card p-4 border-l-2 ${key === 'VIX' ? 'border-l-orange-500' : 'border-l-[#3b82f6]'} overflow-hidden relative group`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${INDEX_COLORS[key] || 'from-blue-500/10'}`} />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">{key}</span>
              <span className={`text-xs font-mono font-bold ${idx.change_pct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
              </span>
            </div>
            <div className="text-xl font-mono font-black text-white group-hover:scale-105 transition-transform origin-left">
              {idx.value.toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
