import { getMasterData, getSwingAllPicks } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TopSwingPicks from "@/components/TopSwingPicks";
import TrackerButtonWrapper from "@/components/TrackerButtonWrapper";
import Link from "next/link";
import { Metadata } from "next";
import { LANG_CONFIG } from "@/lib/analysis-langs";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Daily Swing Trade Candidates | BOGA AI",
  description: "Full algorithmic candidate list from the BOGA AI V114 engine — high-conviction swing trade setups with entries, targets, and stop levels.",
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
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">Today&apos;s Swing Picks</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-2 tracking-tight">
                Daily Swing Picks
                <span className="ml-3 text-[#3b82f6]">— {dateStr}</span>
              </h1>
              <p className="text-white text-base">
                Full algorithmic candidate list from the BOGA AI V114 Engine •{" "}
                {generatedAt && (
                  <span className="text-[#00d2ff]">Updated {formatTime(generatedAt)}</span>
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
            <p className="text-white text-sm">The Atmaca bot runs at 13:00 NY time on weekdays. Check back after the scan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block glass-card overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[#00d2ff] text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-4 text-left">#</th>
                    <th className="px-4 py-4 text-left">Ticker</th>
                    <th className="px-4 py-4 text-left">Sector</th>
                    <th className="px-4 py-4 text-right">Score</th>
                    <th className="px-4 py-4 text-right">Price</th>
                    <th className="px-4 py-4 text-right">Buy Zone</th>
                    <th className="px-4 py-4 text-right">Target</th>
                    <th className="px-4 py-4 text-right">Stop</th>
                    <th className="px-4 py-4 text-right">1D</th>
                    <th className="px-4 py-4 text-right">1W</th>
                    <th className="px-4 py-4 text-right">1M</th>
                    <th className="px-4 py-4 text-right">1Y</th>
                    <th className="px-4 py-4 text-right">5Y</th>
                    <th className="px-4 py-4 text-right">Tracker</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick: any, idx: number) => (
                    <tr
                      key={pick.ticker}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx < 5 ? "bg-[#3b82f6]/5" : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] font-black ${idx < 5 ? "text-[#3b82f6]" : "text-[#00d2ff]"}`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/stock/${pick.ticker}`} className="group">
                          <div className="text-white font-black text-sm tracking-tight group-hover:text-[#3b82f6] transition-colors">
                            {pick.ticker}
                          </div>
                          <div className="text-[#00d2ff] text-[10px] truncate max-w-[120px]">{pick.company}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-white text-[11px]">{pick.sector || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <ScoreBadge score={pick.score} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-white font-mono font-semibold text-[13px]">${formatPrice(pick.current_price)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-white font-mono text-[11px]">
                        ${formatPrice(pick.buy_zone.low)}–${formatPrice(pick.buy_zone.high)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#10b981] font-mono font-semibold text-[11px]">
                        ${formatPrice(pick.profit_zone.low)}–${formatPrice(pick.profit_zone.high)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#ef4444] font-mono text-[11px]">
                        ${formatPrice(pick.stop_zone.low)}–${formatPrice(pick.stop_zone.high)}
                      </td>
                      {[
                        { field: "change_1d", label: "1D" },
                        { field: "change_1w", label: "1W" },
                        { field: "change_1m", label: "1M" },
                        { field: "change_1y", label: "1Y" },
                        { field: "change_5y", label: "5Y" },
                      ].map((perf) => (
                        <td key={perf.field} className="px-3 py-2.5 text-right">
                          {pick[perf.field] !== undefined ? (
                            <span className={`font-mono text-[11px] font-bold ${pick[perf.field] >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                              {pick[perf.field] >= 0 ? "+" : ""}{pick[perf.field].toFixed(1)}%
                            </span>
                          ) : <span className="text-[#00d2ff] text-[11px]"> —</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        <TrackerButtonWrapper pick={pick} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-6 mb-6">
              {picks.map((pick: any, idx: number) => (
                <Link
                  key={pick.ticker}
                  href={`/stock/${pick.ticker}`}
                  className={`glass-card p-6 block hover:border-[#3b82f6]/40 border-2 border-[#1e2a3a] transition-all relative overflow-hidden ${idx < 5 ? "border-[#3b82f6]/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]" : ""}`}
                >
                  {/* Rank Badge for Mobile */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black text-white ${idx < 5 ? "bg-[#3b82f6]" : "bg-[#1e2a3a]"} rounded-bl-xl`}>
                    #{idx + 1}
                  </div>

                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className="text-white font-black text-3xl tracking-tighter uppercase mb-0.5">{pick.ticker}</div>
                      <div className="text-[#00d2ff] text-xs font-bold uppercase tracking-wider opacity-80">{pick.company}</div>
                    </div>
                    <div className="scale-125 origin-right">
                       <ScoreBadge score={pick.score} />
                    </div>
                  </div>

                  {/* Enhanced Info Blocks with Borders */}
                  <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 rounded-xl bg-black/20 overflow-hidden mb-5">
                    <div className="py-3 px-2 text-center">
                      <div className="text-[9px] text-[#00d2ff] font-black uppercase tracking-widest mb-1.5 opacity-60">BUY ZONE</div>
                      <div className="text-white font-mono text-[13px] font-bold">${formatPrice(pick.buy_zone.low)}</div>
                    </div>
                    <div className="py-3 px-2 text-center bg-white/5">
                      <div className="text-[9px] text-[#10b981] font-black uppercase tracking-widest mb-1.5 opacity-60">TARGET</div>
                      <div className="text-[#10b981] font-mono text-[13px] font-black">${formatPrice(pick.profit_zone.high)}</div>
                    </div>
                    <div className="py-3 px-2 text-center">
                      <div className="text-[9px] text-[#ef4444] font-black uppercase tracking-widest mb-1.5 opacity-60">STOP LOSS</div>
                      <div className="text-[#ef4444] font-mono text-[13px] font-bold">${formatPrice(pick.stop_zone.low)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-[12px] font-bold text-[#00d2ff]">
                      {[
                        { label: "1D", val: pick.change_1d },
                        { label: "1W", val: pick.change_1w },
                        { label: "1M", val: pick.change_1m },
                      ].map(p => (
                        <div key={p.label} className="flex flex-col">
                           <span className="text-[8px] uppercase opacity-50 mb-0.5">{p.label}</span>
                           <span className={p.val !== undefined ? (p.val >= 0 ? "text-[#10b981]" : "text-[#ef4444]") : ""}>
                             {p.val !== undefined ? (p.val >= 0 ? "+" : "") + p.val.toFixed(1) + "%" : "—"}
                           </span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg text-[10px] font-black text-[#3b82f6] uppercase tracking-widest">
                       DETAILS →
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Legend */}
            <div className="glass-card p-4 flex flex-wrap gap-6 text-[11px] text-[#00d2ff]">
              <span>📈 <b className="text-white">Zones</b> = BOGA AI defined price ranges</span>
              <span>🎯 <b className="text-white">Hold</b> = Estimated swing duration</span>
              <span>⚡ <b className="text-white">Top 5</b> candidates highlighted</span>
              <span className="ml-auto">
                <Link href="/" className="text-[#3b82f6] hover:underline">← Back to Dashboard</Link>
              </span>
            </div>
            
            {/* Featured Cards Section - Under the list */}
            <div className="mt-12">
               <TopSwingPicks picks={picks} />
            </div>

            {/* SEO Localized Index (60 Links) */}
            <div className="mt-12 glass-card p-6 md:p-10 border-t-2 border-t-[#3b82f6]/40">
               <div className="flex flex-col gap-2 mb-8">
                  <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">📈 BOGA AI Global SEO Index</h2>
                  <p className="text-sm text-[#00d2ff]">Daily institutional swing trade briefings in 6 languages. Total of 60 active analysis landings.</p>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Object.entries(LANG_CONFIG).map(([lang, cfg]) => (
                    <div key={lang} className="flex flex-col gap-3">
                       <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                          <span className="text-xl">{cfg.flag}</span>
                          <span className="text-[11px] font-black text-white uppercase tracking-widest">{cfg.name}</span>
                       </div>
                       <div className="flex flex-col gap-1.5">
                          {picks.slice(0, 10).map((p: any) => (
                            <Link 
                              key={p.ticker}
                              href={`/${lang}/${cfg.slug}/${p.ticker.toLowerCase()}`}
                              className="text-[10px] text-[#00d2ff] hover:text-[#3b82f6] font-bold transition-all truncate"
                            >
                               {p.ticker} · {cfg.slug.charAt(0).toUpperCase() + cfg.slug.slice(1)}
                            </Link>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
