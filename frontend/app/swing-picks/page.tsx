import { getMasterData, getSwingAllPicks } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Today's Top 20 Swing Picks | BOGA AI",
  description: "Full list of today's algorithmic top 20 swing trade picks from the ATMACA V112 engine — entries, targets, and stop levels.",
  alternates: { canonical: "https://bogastock.com/swing-picks" },
};

function formatPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 12 ? "from-[#f59e0b] to-[#ef4444]" :
    score >= 9  ? "from-[#3b82f6] to-[#6366f1]" :
    score >= 6  ? "from-[#10b981] to-[#06b6d4]" :
                  "from-[#64748b] to-[#475569]";
  return (
    <div className={`bg-gradient-to-r ${color} text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider`}>
      {score.toFixed(1)}
    </div>
  );
}

export default async function SwingPicksPage() {
  const [master, allPicksData] = await Promise.all([
    getMasterData(),
    getSwingAllPicks(),
  ]);

  const picks = allPicksData?.picks ?? [];
  const generatedAt = allPicksData?.generated_at;
  const dateStr = allPicksData?.date ?? new Date().toISOString().split("T")[0];

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) + " ET";
    } catch { return iso; }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#64748b] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[#94a3b8]">Today&apos;s Swing Picks</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                Daily Swing Picks
                <span className="ml-3 text-[#3b82f6]">— {dateStr}</span>
              </h1>
              <p className="text-[#94a3b8] text-base">
                Full Top {picks.length > 0 ? picks.length : 20} list from Atmaca V112 Engine •{" "}
                {generatedAt && (
                  <span className="text-[#64748b]">Updated {formatTime(generatedAt)}</span>
                )}
              </p>
            </div>
            <Link
              href="/swing-performance"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1e293b] border border-[#3b82f6]/30 rounded-xl text-sm font-semibold text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
            >
              📊 Performance History
            </Link>
          </div>
        </div>

        {picks.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-5xl mb-4">🦅</div>
            <h2 className="text-xl font-bold text-white mb-2">No Data Yet</h2>
            <p className="text-[#94a3b8] text-sm">The Atmaca bot runs at 13:00 NY time on weekdays. Check back after the scan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block glass-card overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[#64748b] text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-4 text-left">#</th>
                    <th className="px-4 py-4 text-left">Ticker</th>
                    <th className="px-4 py-4 text-left">Sector</th>
                    <th className="px-4 py-4 text-right">Score</th>
                    <th className="px-4 py-4 text-right">Price</th>
                    <th className="px-4 py-4 text-right">Buy Zone</th>
                    <th className="px-4 py-4 text-right">Target</th>
                    <th className="px-4 py-4 text-right">Stop</th>
                    <th className="px-4 py-4 text-right">ADX</th>
                    <th className="px-4 py-4 text-right">RSI</th>
                    <th className="px-4 py-4 text-right">RVOL</th>
                    <th className="px-4 py-4 text-right">1W</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick: any, idx: number) => (
                    <tr
                      key={pick.ticker}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx < 3 ? "bg-[#3b82f6]/5" : ""}`}
                    >
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-black ${idx < 3 ? "text-[#3b82f6]" : "text-[#64748b]"}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/stock/${pick.ticker}`} className="group">
                          <div className="text-white font-black text-base tracking-tight group-hover:text-[#3b82f6] transition-colors">
                            {pick.ticker}
                          </div>
                          <div className="text-[#64748b] text-[11px] truncate max-w-[140px]">{pick.company}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[#94a3b8] text-xs">{pick.sector || "—"}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ScoreBadge score={pick.score} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-white font-mono font-semibold">${formatPrice(pick.current_price)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[#94a3b8] font-mono text-xs">
                          ${formatPrice(pick.buy_zone.low)}–${formatPrice(pick.buy_zone.high)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[#10b981] font-mono font-semibold text-xs">
                          ${formatPrice(pick.profit_zone.low)}–${formatPrice(pick.profit_zone.high)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-[#ef4444] font-mono text-xs">
                          ${formatPrice(pick.stop_zone.low)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-mono text-xs ${(pick.adx || 0) >= 25 ? "text-[#3b82f6]" : "text-[#64748b]"}`}>
                          {pick.adx || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-mono text-xs ${(pick.rsi || 50) >= 55 ? "text-[#10b981]" : "text-[#64748b]"}`}>
                          {pick.rsi || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-mono text-xs font-bold ${(pick.rvol || 1) >= 1.5 ? "text-[#f59e0b]" : "text-[#64748b]"}`}>
                          {pick.rvol ? pick.rvol.toFixed(2) + "x" : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {pick.change_1w !== undefined ? (
                          <span className={`font-mono text-xs font-bold ${pick.change_1w >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                            {pick.change_1w >= 0 ? "+" : ""}{pick.change_1w.toFixed(1)}%
                          </span>
                        ) : <span className="text-[#64748b] text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4 mb-6">
              {picks.map((pick: any, idx: number) => (
                <Link
                  key={pick.ticker}
                  href={`/stock/${pick.ticker}`}
                  className={`glass-card p-4 block hover:border-[#3b82f6]/40 border-2 border-transparent transition-all ${idx < 3 ? "border-[#3b82f6]/20" : ""}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[#64748b] text-xs font-bold">#{idx + 1}</span>
                      <div className="text-white font-black text-2xl tracking-tight">{pick.ticker}</div>
                      <div className="text-[#64748b] text-xs">{pick.company}</div>
                    </div>
                    <ScoreBadge score={pick.score} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[10px] text-[#64748b] uppercase mb-1">Price</div>
                      <div className="text-white font-mono text-sm font-bold">${formatPrice(pick.current_price)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#10b981] uppercase mb-1">Target</div>
                      <div className="text-[#10b981] font-mono text-xs">${formatPrice(pick.profit_zone.high)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#ef4444] uppercase mb-1">Stop</div>
                      <div className="text-[#ef4444] font-mono text-xs">${formatPrice(pick.stop_zone.low)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-[#64748b]">
                    <span>ADX: <b className="text-[#94a3b8]">{pick.adx || "—"}</b></span>
                    <span>RSI: <b className="text-[#94a3b8]">{pick.rsi || "—"}</b></span>
                    <span>RVOL: <b className={pick.rvol >= 1.5 ? "text-[#f59e0b]" : "text-[#94a3b8]"}>{pick.rvol ? pick.rvol.toFixed(2) + "x" : "—"}</b></span>
                    {pick.change_1w !== undefined && (
                      <span className={`ml-auto font-bold ${pick.change_1w >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                        1W: {pick.change_1w >= 0 ? "+" : ""}{pick.change_1w.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Legend */}
            <div className="glass-card p-4 flex flex-wrap gap-6 text-[11px] text-[#64748b]">
              <span>🔵 <b className="text-[#94a3b8]">ADX &gt; 25</b> = Strong trend</span>
              <span>🟡 <b className="text-[#94a3b8]">RVOL &gt; 1.5x</b> = Volume surge</span>
              <span>🎯 <b className="text-[#94a3b8]">Score</b> = Composite 8-factor rank</span>
              <span>⚡ <b className="text-[#94a3b8]">Top 3</b> highlighted on homepage</span>
              <span className="ml-auto">
                <Link href="/" className="text-[#3b82f6] hover:underline">← Back to Dashboard</Link>
              </span>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
