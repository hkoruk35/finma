import Link from "next/link";

interface Stats {
  win_rate: number;
  avg_return_pct: number;
  total_picks: number;
  period_days: number;
  above_5pct_rate: number;
  above_10pct_rate: number;
}

export default function SwingPerformanceBanner({ stats }: { stats?: Stats }) {
  if (!stats || typeof stats.total_picks === 'undefined') return null;

  return (
    <Link href="/admin/analytics/performance" className="block group w-full">
      <div className="bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 group-hover:border-[#3b82f6]/80 transition-colors rounded-2xl p-6 shadow-2xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3b82f6] blur-[80px] opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>
        
        <div className="flex-1 z-10 text-center md:text-left">
           <div className="flex items-center gap-3 mb-3 justify-center md:justify-start">
              <h3 className="text-[#3b82f6] font-black uppercase tracking-[0.2em] text-sm md:text-base">PROVEN PERFORMANCE</h3>
              <span className="px-3 py-1 rounded-full bg-[#3b82f6]/10 text-[10px] md:text-xs font-medium text-[#3b82f6] border border-[#3b82f6]/20 group-hover:bg-[#3b82f6] group-hover:text-white transition-colors">VIEW DETAILED LOGS &rarr;</span>
           </div>
           <p className="text-white text-xl md:text-2xl font-medium">
             BOGA AI Swing Engine: <span className="text-[#10b981]">{stats.win_rate}% Win Rate</span> Over {stats.period_days} Days
           </p>
           <p className="text-white text-sm mt-2">
             Based on {stats.total_picks} high-conviction trades generated exclusively by algorithmic criteria.
           </p>
        </div>

        <div className="flex justify-center gap-6 z-10">
          <div className="text-center">
             <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{stats.avg_return_pct}%</div>
             <div className="text-[10px] text-[#00d2ff] font-medium uppercase tracking-wider mt-1">Avg Max Return</div>
          </div>
          <div className="w-px bg-white/10 hidden md:block"></div>
          <div className="text-center">
             <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{stats.above_10pct_rate}%</div>
             <div className="text-[10px] text-[#00d2ff] font-medium uppercase tracking-wider mt-1">+10% Gains</div>
          </div>
          <div className="w-px bg-white/10 hidden md:block"></div>
          <div className="text-center">
             <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{stats.total_picks}</div>
             <div className="text-[10px] text-[#00d2ff] font-medium uppercase tracking-wider mt-1">Total Signals</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
