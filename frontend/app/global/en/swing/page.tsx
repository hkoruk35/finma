import { Metadata } from "next";
import Link from "next/link";
import { getSwingAllPicks } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Daily Swing Trade Candidates — BOGA AI",
  description: "All daily swing trade candidates with detailed analysis and signals.",
  alternates: { canonical: "https://bogastock.com/global/en/swing" },
};

const SIGNAL_STYLE: Record<string, string> = {
  BUY: "bg-green-500/15 border-green-500/50 text-green-400",
  SELL: "bg-red-500/15 border-red-500/50 text-red-400",
  WATCH: "bg-amber-500/15 border-amber-500/50 text-amber-400",
  WAIT: "bg-white/5 border-white/15 text-white/40",
};

interface SwingRow {
  ticker: string;
  company: string;
  price: string;
  change: string;
  changeNum: number;
  rsi: string;
  signal: string;
  volume?: string;
  avgVolume?: string;
}

export default async function EnSwingPage() {
  const swingPicks = await getSwingAllPicks();

  const swingRows: SwingRow[] = (swingPicks?.picks ?? []).map((pick: any) => ({
    ticker: pick.ticker,
    company: pick.company || pick.ticker,
    price: `$${(pick.price || 0).toFixed(2)}`,
    change: `${pick.change_pct >= 0 ? "+" : ""}${(pick.change_pct || 0).toFixed(2)}%`,
    changeNum: pick.change_pct || 0,
    rsi: (pick.rsi || 0).toFixed(1),
    signal: pick.signal || "WATCH",
    volume: pick.volume ? `${(pick.volume / 1000000).toFixed(1)}M` : "N/A",
    avgVolume: pick.avg_volume_30d ? `${(pick.avg_volume_30d / 1000000).toFixed(1)}M` : "N/A",
  }));

  const generatedAt = swingPicks?.generated_at || swingPicks?.date || new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:py-8">
        {/* Navigation */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Daily Swing Trade Candidates</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white mb-2">Daily Swing Trade Candidates</h1>
          <p className="text-white/50">
            All swing trade picks selected today
            {generatedAt && <span className=" ml-2 text-[#3b82f6]">— Generated: {generatedAt}</span>}
          </p>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50 bg-[#111620]">
          <div className="bg-[#0d1117] px-4 py-3 border-b border-[#1e2a3a]">
            <span className="text-xs font-black text-white/70 uppercase tracking-wider">
              {swingRows.length} Candidates
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0d1117] text-white/30 uppercase text-[10px] tracking-wider border-t border-[#1e2a3a]">
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Company</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Chg %</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">RSI</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Volume</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Avg Vol 30d</th>
                  <th className="px-4 py-3 text-center">Signal</th>
                </tr>
              </thead>
              <tbody>
                {swingRows.length > 0 ? (
                  swingRows.map((r) => (
                    <tr key={r.ticker} className="border-t border-[#1e2a3a] bg-[#0a0e17] hover:bg-[#0d1117] transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/global/en/${r.ticker}`}
                          className="font-black text-white hover:text-[#3b82f6] transition-colors"
                        >
                          {r.ticker}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/50 hidden sm:table-cell text-xs">{r.company}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/90 font-semibold">{r.price}</td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold ${
                          r.changeNum >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {r.change}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/70 hidden md:table-cell">{r.rsi}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/50 hidden lg:table-cell text-[9px]">{r.volume}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/50 hidden lg:table-cell text-[9px]">{r.avgVolume}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${SIGNAL_STYLE[r.signal] || SIGNAL_STYLE["WATCH"]}`}>
                          {r.signal}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-white/50">
                      No swing candidates available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
