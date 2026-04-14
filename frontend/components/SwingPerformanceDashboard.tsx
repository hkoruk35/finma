"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
// import ProfitSimulator from "./ProfitSimulator";

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
      if (t.sector && t.sector.trim().length > 0 && t.sector.toLowerCase() !== "unknown") s.add(t.sector);
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
      // Exclude unknown sectors completely
      const isUnknown = !t.sector || t.sector.trim() === "" || t.sector.toLowerCase().includes("unknown") || t.sector === "—";
      // if (isUnknown) return false; // Show even unknown sectors
      
      const matchSector = selectedSector === "All" || t.sector === selectedSector;
      const matchMonth = selectedMonth === "All" || (t.date && t.date.startsWith(selectedMonth));
      return matchSector && matchMonth;
    }).sort((a, b) => b.date.localeCompare(a.date));
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

  // Helper to check if a trade is within the last 3 days
  const isRestricted = (dateStr: string) => {
    return false; // TEMPORARILY DISABLED
  };

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
      <div className="glass-card grid grid-cols-2 lg:grid-cols-4 divide-[#1e2a3a] mb-12 overflow-hidden">
         <div className="p-4 md:p-6 text-center border-r border-b lg:border-b-0 border-[#1e2a3a]">
           <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Total Signals</p>
           <p className="text-2xl md:text-3xl font-mono font-black text-white">{stats.total}</p>
         </div>
         <div className="p-4 md:p-6 text-center border-b lg:border-b-0 lg:border-l lg:border-l-[#1e2a3a]/30">
           <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Win Rate</p>
           <p className="text-2xl md:text-3xl font-mono font-black text-[#22c55e]">{stats.winRate}%</p>
         </div>
         <div className="p-4 md:p-6 text-center border-r lg:border-r-0 lg:border-l lg:border-l-[#1e2a3a]/30">
           <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Avg Return (Max)</p>
           <p className="text-2xl md:text-3xl font-mono font-black text-white">{stats.avgReturn}%</p>
         </div>
         <div className="p-4 md:p-6 text-center lg:border-l lg:border-l-[#1e2a3a]/30">
           <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Picks {'>'} 10% Return</p>
           <p className="text-2xl md:text-3xl font-mono font-black text-[#3b82f6]">{stats.above10Rate}%</p>
         </div>
      </div>

      {/* Sector Profit Heatmap */}
      {sectorHeatmap.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-bold text-white mb-6">Sector Profitability Heatmap</h3>
          <div className="flex overflow-x-auto pb-4 md:pb-0 md:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 no-scrollbar">
            {sectorHeatmap.map(s => {
              // determine heat color based on avgReturn
              let bgColor = "bg-[#141924] border-[#1e2a3a]";
              if (s.avgReturn >= 15) bgColor = "bg-[#22c55e]/25 border-[#22c55e]/60";
              else if (s.avgReturn >= 8) bgColor = "bg-[#22c55e]/15 border-[#22c55e]/40";
              else if (s.avgReturn > 0) bgColor = "bg-[#22c55e]/10 border-[#22c55e]/30";
              else if (s.avgReturn < 0) bgColor = "bg-[#ef4444]/20 border-[#ef4444]/50";
              
              return (
                <button 
                  key={s.name} 
                  onClick={() => setSelectedSector(s.name === selectedSector ? "All" : s.name)}
                  className={`rounded-xl border p-4 ${bgColor} flex flex-col gap-2 transition-all hover:scale-105 shadow-xl text-left ${s.name === selectedSector ? "ring-2 ring-white" : ""} min-w-[160px] md:min-w-0`}
                >
                  <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest truncate w-full" title={s.name}>{s.name}</p>
                  <div className="flex items-end justify-between w-full">
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
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Dynamic Profit Simulator REMOVED TEMPORARILY */}
      {/* <ProfitSimulator /> */}

      {/* Trade History - Responsive View */}
      <div className="w-full">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h3 className="text-xl font-bold text-white">Historical Trade Log</h3>
            <div className="flex flex-col items-end gap-1">
               <p className="text-xs text-[#94a3b8]">Showing {filteredHistory.length} trades</p>
               <p className="text-[10px] text-[#3b82f6] font-bold uppercase tracking-wider bg-[#3b82f6]/10 px-2 py-0.5 rounded">
                 ⚠️ 5-Day Delay Applied for Free Users
               </p>
            </div>
         </div>

         {/* Mobile Card View (md:hidden) */}
         <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredHistory.map((t: any, i: number) => {
               const restricted = isRestricted(t.date);
               return (
               <div key={i} className={`glass-card p-5 border-l-4 border-l-[#3b82f6] ${restricted ? 'opacity-80' : ''}`}>
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        {restricted ? (
                          <div className="flex flex-col gap-1">
                             <span className="text-2xl font-black text-[#3b82f6] filter blur-sm cursor-not-allowed">
                               XXXX
                             </span>
                             <span className="text-[9px] text-[#3b82f6] font-black uppercase">PRO ACCESS ONLY</span>
                          </div>
                        ) : (
                          <Link href={`/stock/${t.ticker}`} className="text-2xl font-black text-[#3b82f6] hover:underline">
                             {t.ticker}
                          </Link>
                        )}
                        <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest mt-1">
                           {t.date} &middot; {t.sector || "Unknown"}
                        </p>
                     </div>
                     <div className={`text-xl font-mono font-black ${t.return_pct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                        {t.return_pct >= 0 ? "+" : ""}{t.return_pct.toFixed(2)}%
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 border-t border-[#1e2a3a]/40 pt-4">
                     <div>
                        <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-tighter mb-1">Entry</p>
                        <p className="font-mono font-bold text-white text-sm">${t.entry.toFixed(2)}</p>
                     </div>
                     <div>
                        <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-tighter mb-1">Peak</p>
                        <p className="font-mono font-bold text-white text-sm">${t.max_price.toFixed(2)}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-tighter mb-1">Days</p>
                        <p className="font-mono font-bold text-white text-sm">{t.days}</p>
                     </div>
                  </div>
               </div>
               );
            })}
         </div>

         {/* Desktop Table View (hidden md:block) */}
         <div className="hidden md:block glass-card overflow-hidden">
            <div className="overflow-x-auto w-full">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                     <tr className="bg-[#1a2030] border-b border-[#1e2a3a] text-[#64748b]">
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Date</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Symbol</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right text-[#3b82f6]">Max Return</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Entry Price</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Max Price</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Days Held</th>
                        <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Sector</th>
                     </tr>
                  </thead>
                  <tbody className="text-white font-mono divide-y divide-[#1e2a3a]">
                     {filteredHistory.map((t: any, i: number) => {
                        const restricted = isRestricted(t.date);
                        return (
                        <tr key={i} className="hover:bg-[#1a2030]/50 transition-colors">
                           <td className="px-6 py-4 text-[#94a3b8]">{t.date}</td>
                           <td className="px-6 py-4">
                              {restricted ? (
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-[#3b82f6] filter blur-sm cursor-not-allowed select-none">XXXXX</span>
                                    <span className="text-[9px] bg-[#3b82f6]/10 text-[#3b82f6] px-1.5 py-0.5 rounded font-black">LOCKED</span>
                                 </div>
                              ) : (
                                 <Link href={`/stock/${t.ticker}`} className="font-bold text-[#3b82f6] hover:underline">
                                    {t.ticker}
                                 </Link>
                              )}
                           </td>
                           <td className={`px-6 py-4 text-right font-black text-base ${t.return_pct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                              {t.return_pct >= 0 ? "+" : ""}{t.return_pct.toFixed(2)}%
                           </td>
                           <td className="px-6 py-4 text-right">${t.entry.toFixed(2)}</td>
                           <td className="px-6 py-4 text-right">${t.max_price.toFixed(2)}</td>
                           <td className="px-6 py-4 text-center text-[#64748b]">{t.days}</td>
                           <td className="px-6 py-4 text-[#94a3b8] text-[10px] uppercase">{t.sector || "Unknown"}</td>
                        </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
         {filteredHistory.length === 0 && (
            <div className="p-12 text-center text-[#64748b]">No historical data found.</div>
         )}
      </div>
    </>
  );
}
