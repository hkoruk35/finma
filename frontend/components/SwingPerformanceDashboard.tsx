"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Trade {
  date: string;
  ticker: string;
  company: string;
  sector: string;
  entry: number;
  max_price: number;
  return_pct: number;
  days: number;
}

interface Props {
  initialHistory: Trade[];
}

export default function SwingPerformanceDashboard({ initialHistory }: Props) {
  const [selectedSector, setSelectedSector] = useState<string>("All");
  const [selectedMonth, setSelectedMonth] = useState<string>("All");

  // Extract unique sectors and months for dropdowns
  const sectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => {
      if (t.sector) s.add(t.sector);
    });
    return Array.from(s).sort();
  }, [initialHistory]);

  const months = useMemo(() => {
    const m = new Set<string>();
    initialHistory.forEach(t => {
      if (t.date) {
        const parts = t.date.split("-");
        if (parts.length >= 2) m.add(`${parts[0]}-${parts[1]}`);
      }
    });
    return Array.from(m).sort((a,b) => b.localeCompare(a));
  }, [initialHistory]);

  // Filter history
  const filteredHistory = useMemo(() => {
    return initialHistory.filter(t => {
      const matchSector = selectedSector === "All" || t.sector === selectedSector;
      const matchMonth = selectedMonth === "All" || (t.date && t.date.startsWith(selectedMonth));
      return matchSector && matchMonth;
    });
  }, [initialHistory, selectedSector, selectedMonth]);

  // Calculate stats dynamically
  const stats = useMemo(() => {
    const total = filteredHistory.length;
    let wins = 0;
    let totalReturn = 0;
    let above10 = 0;

    filteredHistory.forEach(t => {
      if (t.return_pct > 0) wins++;
      if (t.return_pct >= 10) above10++;
      totalReturn += t.return_pct;
    });

    const winRate = total > 0 ? (wins / total * 100).toFixed(1) : "0.0";
    const avgReturn = total > 0 ? (totalReturn / total).toFixed(1) : "0.0";
    const above10Rate = total > 0 ? (above10 / total * 100).toFixed(1) : "0.0";

    return {
      total,
      winRate,
      avgReturn,
      above10Rate
    };
  }, [filteredHistory]);

  // Sector Map for Heatmap
  const sectorHeatmap = useMemo(() => {
    const map: Record<string, { total: number; wins: number; sumReturn: number; maxReturn: number }> = {};
    
    filteredHistory.forEach(t => {
      if (!t.sector) return;
      if (!map[t.sector]) {
        map[t.sector] = { total: 0, wins: 0, sumReturn: 0, maxReturn: -999 };
      }
      map[t.sector].total++;
      if (t.return_pct > 0) map[t.sector].wins++;
      map[t.sector].sumReturn += t.return_pct;
      if (t.return_pct > map[t.sector].maxReturn) map[t.sector].maxReturn = t.return_pct;
    });

    return Object.entries(map).map(([name, data]) => ({
      name,
      total: data.total,
      winRate: (data.wins / data.total) * 100,
      avgReturn: data.sumReturn / data.total,
      maxReturn: data.maxReturn
    })).sort((a, b) => b.avgReturn - a.avgReturn);
  }, [filteredHistory]);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <select 
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#3b82f6]"
        >
          <option value="All">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-3 rounded-xl focus:outline-none focus:border-[#3b82f6]"
        >
          <option value="All">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Stats Strip */}
      <div className="glass-card grid grid-cols-2 md:grid-cols-4 divide-x divide-[#1e2a3a] mb-12">
         <div className="p-6 text-center">
           <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Total Signals</p>
           <p className="text-3xl font-mono font-black text-white">{stats.total}</p>
         </div>
         <div className="p-6 text-center">
           <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Win Rate</p>
           <p className="text-3xl font-mono font-black text-[#22c55e]">{stats.winRate}%</p>
         </div>
         <div className="p-6 text-center border-t md:border-t-0 border-[#1e2a3a]">
           <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Avg Return (Max)</p>
           <p className="text-3xl font-mono font-black text-white">{stats.avgReturn}%</p>
         </div>
         <div className="p-6 text-center border-t md:border-t-0 border-[#1e2a3a]">
           <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Picks {'>'} 10% Return</p>
           <p className="text-3xl font-mono font-black text-[#3b82f6]">{stats.above10Rate}%</p>
         </div>
      </div>

      {/* Sector Profit Heatmap */}
      {sectorHeatmap.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-bold text-white mb-6">Sector Profitability Heatmap</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {sectorHeatmap.map(s => {
              // determine heat color based on avgReturn
              let bgColor = "bg-[#141924] border-[#1e2a3a]";
              if (s.avgReturn >= 15) bgColor = "bg-[#22c55e]/20 border-[#22c55e]/50";
              else if (s.avgReturn >= 8) bgColor = "bg-[#22c55e]/15 border-[#22c55e]/30";
              else if (s.avgReturn > 0) bgColor = "bg-[#22c55e]/5 border-[#22c55e]/20";
              else if (s.avgReturn < 0) bgColor = "bg-[#ef4444]/15 border-[#ef4444]/30";
              
              return (
                <div key={s.name} className={`rounded-xl border p-4 ${bgColor} flex flex-col gap-2 transition-all hover:scale-105 shadow-xl`}>
                  <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest truncate" title={s.name}>{s.name}</p>
                  <div className="flex items-end justify-between">
                     <div>
                        <p className={`text-xl font-black font-mono tracking-tighter ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                           {s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
                        </p>
                        <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest mt-1">Avg Return</p>
                     </div>
                     <div className="text-right">
                        <p className="text-lg font-bold text-white leading-none">{s.total}</p>
                        <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest mt-1">Picks</p>
                     </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Trade History Table */}
      <div className="glass-card overflow-hidden w-full">
         <div className="p-6 border-b border-[#1e2a3a] flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-xl font-bold text-white">Historical Trade Log</h3>
            <p className="text-xs text-[#94a3b8]">Showing {filteredHistory.length} trades</p>
         </div>
         <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-max">
               <thead>
                  <tr className="bg-[#1a2030] border-b border-[#1e2a3a] text-[#64748b]">
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Date</th>
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Symbol</th>
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Sector</th>
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Entry Price</th>
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Max Price</th>
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Days Held</th>
                     <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Max Return</th>
                  </tr>
               </thead>
               <tbody className="text-white font-mono divide-y divide-[#1e2a3a]">
                  {filteredHistory.map((t: any, i: number) => (
                     <tr key={i} className="hover:bg-[#1a2030]/50 transition-colors">
                        <td className="px-6 py-4 text-[#94a3b8]">{t.date}</td>
                        <td className="px-6 py-4">
                          <Link href={`/stock/${t.ticker}`} className="font-bold text-[#3b82f6] hover:underline">
                            {t.ticker}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-[#94a3b8] text-[10px] uppercase">{t.sector || "Unknown"}</td>
                        <td className="px-6 py-4 text-right">${t.entry.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">${t.max_price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-center text-[#64748b]">{t.days}</td>
                        <td className={`px-6 py-4 text-right font-bold ${t.return_pct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                           {t.return_pct >= 0 ? "+" : ""}{t.return_pct.toFixed(2)}%
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
            {filteredHistory.length === 0 && (
              <div className="p-12 text-center text-[#64748b]">No historical data found.</div>
            )}
         </div>
      </div>
    </>
  );
}
