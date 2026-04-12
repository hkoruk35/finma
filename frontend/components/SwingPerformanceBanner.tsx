"use client";

interface Stats {
  win_rate: number;
  avg_return_pct: number;
  total_picks: number;
  period_days: number;
  above_10pct_rate: number;
}

export default function SwingPerformanceBanner({ stats }: { stats?: Stats }) {
  if (!stats) return null;

  return (
    <div className="bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#ec4899]/30 rounded-2xl p-6 shadow-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#ec4899] blur-[80px] opacity-20 rounded-full"></div>
      
      <div className="flex-1 z-10 text-center md:text-left">
         <h3 className="text-[#ec4899] font-black uppercase tracking-[0.2em] text-xs mb-2">PROVEN PERFORMANCE</h3>
         <p className="text-white text-xl md:text-2xl font-bold">
           BOGA Swing Engine: <span className="text-[#10b981]">{stats.win_rate}% Win Rate</span> Over {stats.period_days} Days
         </p>
         <p className="text-[#94a3b8] text-sm mt-2">
           Based on {stats.total_picks} high-conviction trades generated exclusively by algorithmic criteria.
         </p>
      </div>

      <div className="flex justify-center gap-6 z-10">
        <div className="text-center group">
           <div className="text-3xl font-black text-white group-hover:text-[#ec4899] transition-colors">{stats.avg_return_pct}%</div>
           <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider mt-1">Avg Return</div>
        </div>
        <div className="w-px bg-white/10 hidden md:block"></div>
        <div className="text-center group">
           <div className="text-3xl font-black text-white group-hover:text-[#ec4899] transition-colors">{stats.above_10pct_rate}%</div>
           <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider mt-1">+10% Gaines</div>
        </div>
        <div className="w-px bg-white/10 hidden md:block"></div>
        <div className="text-center group">
           <div className="text-3xl font-black text-white group-hover:text-[#ec4899] transition-colors">{stats.total_picks}</div>
           <div className="text-[10px] text-[#64748b] font-bold uppercase tracking-wider mt-1">Total Signals</div>
        </div>
      </div>
    </div>
  );
}
