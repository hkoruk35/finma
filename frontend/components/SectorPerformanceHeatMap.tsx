"use client";

import Link from "next/link";
import { useMemo } from "react";

interface Trade {
  ticker: string;
  sector: string;
  return_pct: number | null;
  result: string;
}

interface Props {
  history: Trade[];
}

export default function SectorPerformanceHeatMap({ history }: Props) {
  const SL_PCT = -3.5;

  const heatmap = useMemo(() => {
    const map: Record<string, { total: number; sumRet: number }> = {};
    
    history.forEach(t => {
      if (!t.sector || t.sector === "Unknown") return;
      
      const effRet = t.return_pct != null 
        ? (t.return_pct < SL_PCT ? SL_PCT : t.return_pct)
        : 0;

      if (!map[t.sector]) map[t.sector] = { total: 0, sumRet: 0 };
      map[t.sector].total++;
      map[t.sector].sumRet += effRet;
    });

    return Object.entries(map)
      .map(([name, d]) => ({ 
        name, 
        total: d.total, 
        avgReturn: d.total > 0 ? (d.sumRet / d.total) : 0 
      }))
      .sort((a, b) => b.avgReturn - a.avgReturn);
  }, [history]);

  function heatColor(avg: number) {
    if (avg >= 12) return "border-[#22c55e]/60 bg-[#22c55e]/5";
    if (avg >= 8)  return "border-[#22c55e]/40 bg-[#22c55e]/5";
    if (avg > 0)   return "border-[#22c55e]/20 bg-[#22c55e]/5";
    return "border-[#ef4444]/30 bg-[#ef4444]/5";
  }

  if (heatmap.length === 0) return null;

  return (
    <div className="mt-8 mb-12">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        Sector Profitability Heatmap
      </h3>
      
      <div className="flex overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-6 gap-4 pb-4 md:pb-0 scrollbar-hide snap-x">
        {heatmap.map((s) => (
          <Link
            key={s.name}
            href="/swing-performance"
            className={`glass-card p-4 border rounded-xl flex flex-col gap-3 transition-all hover:border-[#3b82f6]/50 hover:bg-[#1a2030] group shrink-0 w-[160px] md:w-auto snap-center ${heatColor(s.avgReturn)}`}
          >
            <p className="text-[10px] font-black text-white/90 uppercase tracking-[0.15em] truncate">
              {s.name}
            </p>
            
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-2xl font-black font-mono leading-none ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
                </p>
                <p className="text-[9px] text-[#00d2ff] font-black uppercase tracking-wider mt-1.5">
                  AVG RETURN
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-lg font-black text-white leading-none">
                  {s.total}
                </p>
                <p className="text-[9px] text-[#00d2ff] font-black uppercase tracking-wider mt-1.5">
                  PICKS
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
