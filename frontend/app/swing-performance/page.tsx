import { getMasterData, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swing Engine Performance | BOGA AI",
  description: "Detailed performance records for the BOGA AI Swing Engine. Transparent historical trading data.",
};

export default async function SwingPerformancePage() {
  const [master, performanceData] = await Promise.all([
    getMasterData(),
    getSwingPerformance()
  ]);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#0d1117] text-white p-8">Loading or No Data Available</div>;
  }

  const { stats, history = [] } = performanceData;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">System Performance</span>
        </nav>

        {/* Header Section */}
        <header className="mb-10 lg:w-2/3">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
            Swing Engine Performance
          </h1>
          <p className="text-[#94a3b8] text-lg leading-relaxed">
            Transparent and verifiable historical records of our algorithmic high-conviction swing setups. This log displays every signal the model has generated over the last {stats?.period_days || 90} days, emphasizing our commitment to real performance.
          </p>
        </header>

        {/* Stats Strip */}
        <div className="glass-card grid grid-cols-2 md:grid-cols-5 divide-x divide-[#1e2a3a] mb-12">
           <div className="p-6 text-center">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Total Signals</p>
             <p className="text-3xl font-mono font-black text-white">{stats?.total_picks || 0}</p>
           </div>
           <div className="p-6 text-center">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Win Rate</p>
             <p className="text-3xl font-mono font-black text-[#22c55e]">{stats?.win_rate || 0}%</p>
           </div>
           <div className="p-6 text-center">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Avg Return (Max)</p>
             <p className="text-3xl font-mono font-black text-white">{stats?.avg_return_pct || 0}%</p>
           </div>
           <div className="p-6 text-center">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Picks {'>'} 10% Return</p>
             <p className="text-3xl font-mono font-black text-[#3b82f6]">{stats?.above_10pct_rate || 0}%</p>
           </div>
           <div className="p-6 text-center col-span-2 md:col-span-1 border-t md:border-t-0 border-[#1e2a3a]">
             <p className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Track Record</p>
             <p className="text-3xl font-mono font-black text-white">{stats?.period_days || 90} Days</p>
           </div>
        </div>

        {/* Trade History Table */}
        <div className="glass-card overflow-hidden">
           <div className="p-6 border-b border-[#1e2a3a]">
              <h3 className="text-xl font-bold text-white">Historical Trade Log</h3>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead>
                    <tr className="bg-[#1a2030] border-b border-[#1e2a3a] text-[#64748b]">
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Date</th>
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Symbol</th>
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Company</th>
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Entry Price</th>
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Max Price</th>
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-center">Days Held</th>
                       <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] text-right">Max Return</th>
                    </tr>
                 </thead>
                 <tbody className="text-white font-mono divide-y divide-[#1e2a3a]">
                    {history.map((t: any, i: number) => (
                       <tr key={i} className="hover:bg-[#1a2030]/50 transition-colors">
                          <td className="px-6 py-4 text-[#94a3b8]">{t.date}</td>
                          <td className="px-6 py-4">
                            <Link href={`/stock/${t.ticker}`} className="font-bold text-[#3b82f6] hover:underline">
                              {t.ticker}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-[#94a3b8] text-xs font-sans max-w-[200px] truncate" title={t.company}>{t.company}</td>
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
              {history.length === 0 && (
                <div className="p-12 text-center text-[#64748b]">No historical data found.</div>
              )}
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
