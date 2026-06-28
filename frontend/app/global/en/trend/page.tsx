import { Metadata } from "next";
import Link from "next/link";
import { getAllTickers } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "2026 Trend Stocks — BOGA AI",
  description: "Stocks following 2026 market trends with strong momentum and sector leadership.",
  alternates: { canonical: "https://bogastock.com/global/en/trend" },
};

const SIGNAL_STYLE: Record<string, string> = {
  BUY: "bg-green-500/15 border-green-500/50 text-green-400",
  SELL: "bg-red-500/15 border-red-500/50 text-red-400",
  WATCH: "bg-amber-500/15 border-amber-500/50 text-amber-400",
  WAIT: "bg-white/5 border-white/15 text-white/40",
  TREND: "bg-blue-500/15 border-blue-500/50 text-blue-400",
};

interface TrendRow {
  ticker: string;
  company: string;
  price: string;
  change: string;
  changeNum: number;
  rsi: string;
  score: string;
  sector: string;
}

export default async function EnTrendPage() {
  const allTickers = await getAllTickers();

  // Filter trend stocks
  const trendRows: TrendRow[] = (allTickers || [])
    .filter((t: any) => t.score_type === "TREND" || t.score_type?.includes("TREND"))
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      price: `$${(t.price || 0).toFixed(2)}`,
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      rsi: (t.technical?.rsi || 0).toFixed(1),
      score: (t.master_score || 0).toFixed(0),
      sector: t.sector || "N/A",
    }));

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:py-8">
        {/* Navigation */}
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">2026 Trend Stocks</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-white mb-2">2026 Trend Stocks</h1>
          <p className="text-white/50">
            Stocks following major 2026 market themes with strong momentum and sector positioning
          </p>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-[#1e2a3a] overflow-hidden shadow-2xl shadow-black/50 bg-[#111620]">
          <div className="bg-[#0d1117] px-4 py-3 border-b border-[#1e2a3a]">
            <span className="text-xs font-black text-white/70 uppercase tracking-wider">
              {trendRows.length} Trend Stocks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0d1117] text-white/30 uppercase text-[10px] tracking-wider border-t border-[#1e2a3a]">
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Company</th>
                  <th className="px-4 py-3 hidden md:table-cell">Sector</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Chg %</th>
                  <th className="px-4 py-3 text-right">RSI</th>
                  <th className="px-4 py-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {trendRows.length > 0 ? (
                  trendRows.map((r) => (
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
                      <td className="px-4 py-3 text-white/50 hidden md:table-cell text-xs">{r.sector}</td>
                      <td className="px-4 py-3 text-right font-mono text-white/90 font-semibold">{r.price}</td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-semibold ${
                          r.changeNum >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {r.change}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white/70">{r.rsi}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${SIGNAL_STYLE["TREND"]}`}>
                          {r.score}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-white/50">
                      No trend stocks available
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
