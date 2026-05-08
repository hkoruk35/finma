import { getDayTradePerformance, getMasterData } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";

export const revalidate = 60;

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function DayTradePerformancePage() {
  const [perfData, master] = await Promise.all([
    getDayTradePerformance(),
    getMasterData()
  ]);
  
  const stats = perfData?.stats || {};
  const history = perfData?.history || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      {master && <TickerTape data={master} />}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#10b981] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/daytrade" className="hover:text-white transition-colors">DayTrade</Link>
          <span>/</span>
          <span className="text-white">Performance</span>
        </nav>

        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card p-6 border-l-4 border-l-[#10b981]">
            <div className="text-[10px] text-[#00d2ff] font-black uppercase tracking-widest mb-1 opacity-60">WIN RATE</div>
            <div className="text-4xl font-black text-white leading-none">{stats.win_rate}%</div>
            <div className="text-[10px] text-[#10b981] font-bold mt-2 uppercase tracking-tighter">
              {stats.completed_count} COMPLETED TRADES
            </div>
          </div>
          <div className="glass-card p-6 border-l-4 border-l-[#3b82f6]">
            <div className="text-[10px] text-[#00d2ff] font-black uppercase tracking-widest mb-1 opacity-60">AVG RETURN</div>
            <div className="text-4xl font-black text-white leading-none">+{stats.avg_return_pct}%</div>
            <div className="text-[10px] text-[#3b82f6] font-bold mt-2 uppercase tracking-tighter">
              PER SCALPED TRADE
            </div>
          </div>
          <div className="glass-card p-6 border-l-4 border-l-[#f59e0b]">
            <div className="text-[10px] text-[#00d2ff] font-black uppercase tracking-widest mb-1 opacity-60">HITS 5%+</div>
            <div className="text-4xl font-black text-white leading-none">{stats.above_5pct_rate}%</div>
            <div className="text-[10px] text-[#f59e0b] font-bold mt-2 uppercase tracking-tighter">
              INTRADAY EXPLOSION RATE
            </div>
          </div>
          <div className="glass-card p-6 border-l-4 border-l-[#ef4444]">
            <div className="text-[10px] text-[#00d2ff] font-black uppercase tracking-widest mb-1 opacity-60">STOP LOSS</div>
            <div className="text-4xl font-black text-[#ef4444] leading-none">{stats.stop_loss_pct}%</div>
            <div className="text-[10px] text-white/40 font-bold mt-2 uppercase tracking-tighter">
              STRICT SYSTEM EXIT
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">⚡ DayTrade Execution History</h2>
          <div className="text-[11px] text-[#00d2ff] font-bold bg-white/5 px-4 py-2 rounded-lg border border-white/5 uppercase tracking-widest">
             LAST UPDATED: {stats.last_updated ? new Date(stats.last_updated).toLocaleString("en-US") : "N/A"}
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block glass-card overflow-hidden border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-[#00d2ff] text-[10px] uppercase tracking-widest bg-white/2">
                <th className="px-4 py-4 text-left">Date</th>
                <th className="px-4 py-4 text-left">Symbol</th>
                <th className="px-4 py-4 text-left">Sector</th>
                <th className="px-4 py-4 text-right">Entry</th>
                <th className="px-4 py-4 text-right">Max Price</th>
                <th className="px-4 py-4 text-right">Target</th>
                <th className="px-4 py-4 text-right">Stop</th>
                <th className="px-4 py-4 text-right">Return</th>
                <th className="px-4 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record: any, idx: number) => (
                <tr key={`${record.date}-${record.ticker}-${idx}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-[#00d2ff] font-mono text-[11px]">{record.date}</td>
                  <td className="px-4 py-3">
                    <div className="text-white font-black text-sm">{record.ticker}</div>
                    <div className="text-[#00d2ff] text-[9px] opacity-60 truncate max-w-[150px] font-bold">{record.company}</div>
                  </td>
                  <td className="px-4 py-3 text-white text-[11px] opacity-80">{record.sector || "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-white text-[12px] font-bold">${formatPrice(record.entry)}</td>
                  <td className="px-4 py-3 text-right font-mono text-white text-[12px] opacity-60">${formatPrice(record.max_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#10b981] text-[11px] font-black">${formatPrice(record.target)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#ef4444] text-[11px] font-semibold">${formatPrice(record.stop)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-[13px] font-black ${record.return_pct > 0 ? "text-[#10b981]" : record.return_pct < 0 ? "text-[#ef4444]" : "text-white"}`}>
                      {record.return_pct > 0 ? "+" : ""}{record.return_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest border ${
                      record.result === 'TARGET_HIT' ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30' :
                      record.result === 'STOPPED_OUT' ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30' :
                      'bg-white/10 text-white border-white/10'
                    }`}>
                      {record.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden flex flex-col gap-4">
           {history.map((record: any, idx: number) => (
             <div key={idx} className="glass-card p-4 border border-white/5 relative">
                <div className="flex justify-between items-start mb-3">
                   <div>
                      <div className="text-white font-black text-xl leading-none">{record.ticker}</div>
                      <div className="text-[#00d2ff] text-[10px] font-bold uppercase mt-1 opacity-60">{record.date}</div>
                   </div>
                   <div className={`text-lg font-black ${record.return_pct > 0 ? "text-[#10b981]" : record.return_pct < 0 ? "text-[#ef4444]" : "text-white"}`}>
                      {record.return_pct > 0 ? "+" : ""}{record.return_pct.toFixed(1)}%
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[10px] font-bold">
                   <div>
                      <span className="text-[#00d2ff] opacity-40 uppercase block mb-0.5">ENTRY</span>
                      <span className="text-white font-mono">${formatPrice(record.entry)}</span>
                   </div>
                   <div className="text-right">
                      <span className="text-[#00d2ff] opacity-40 uppercase block mb-0.5">STATUS</span>
                      <span className="text-white uppercase">{record.result}</span>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
