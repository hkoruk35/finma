export default function AdminDashboard() {
  return (
    <div className="animate-fade-in">
      <div className="mb-8">
         <h1 className="text-2xl font-black text-white mb-2">System Overview</h1>
         <p className="text-sm text-[#64748b]">Monitor bot status and key platform performance metrics.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
         {[
            { label: "Bot Status", value: "SUCCESS", sub: "Last run: Today 09:02 AM", color: "text-[#22c55e]" },
            { label: "Total Members", value: "1,284", sub: "+24 today", color: "text-white" },
            { label: "Daily Page Views", value: "42.5K", sub: "85% from US", color: "text-white" },
            { label: "Active Scores", value: "47", sub: "12 High Conviction", color: "text-[#3b82f6]" },
         ].map((stat, i) => (
            <div key={i} className="glass-card p-6">
               <p className="text-[10px] text-[#64748b] uppercase tracking-widest mb-1">{stat.label}</p>
               <p className={`text-2xl font-black mb-1 ${stat.color}`}>{stat.value}</p>
               <p className="text-[10px] text-[#64748b]">{stat.sub}</p>
            </div>
         ))}
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Recent Activity */}
         <div className="lg:col-span-2 glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e2a3a]">
               <h3 className="font-bold">Recent System Logs</h3>
            </div>
            <div className="divide-y divide-[#1e2a3a]">
               {[
                  { time: "09:02:15", msg: "Bot task completed successfully.", type: "INFO" },
                  { time: "09:01:42", msg: "Generating AI summaries for Top Scores...", type: "INFO" },
                  { time: "09:00:05", msg: "YFinance data fetch initiated.", type: "INFO" },
                  { time: "08:55:00", msg: "Scheduler wake up score trigger received.", type: "SYSTEM" },
               ].map((log, i) => (
                  <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-[#141924] transition-colors">
                     <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono text-[#64748b]">{log.time}</span>
                        <span className="text-xs text-[#94a3b8]">{log.msg}</span>
                     </div>
                     <span className="text-[10px] font-bold text-[#3b82f6] uppercase">{log.type}</span>
                  </div>
               ))}
            </div>
            <div className="px-6 py-3 bg-[#141924]/50 text-center">
               <button className="text-[10px] font-bold text-[#64748b] hover:text-white uppercase tracking-widest">View Full Logs</button>
            </div>
         </div>

         {/* Sector Pulse */}
         <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e2a3a]">
               <h3 className="font-bold">Top Trending Stocks</h3>
            </div>
            <div className="p-6 space-y-4">
               {[
                  { ticker: "NVDA", score: 91, volume: "1.5M" },
                  { ticker: "PLTR", score: 88, volume: "840K" },
                  { ticker: "AAPL", score: 78, volume: "920K" },
                  { ticker: "TSLA", score: 69, volume: "450K" },
               ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                     <span className="text-sm font-bold text-white">{item.ticker}</span>
                     <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-[#64748b]">{item.volume}</span>
                        <span className="text-xs font-mono font-bold text-[#22c55e]">{item.score}</span>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
