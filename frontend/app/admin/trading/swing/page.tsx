import { getMasterData, getSwingAllPicks, getSwingArchiveDates, getOptionsData } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TopSwingPicks from "@/components/TopSwingPicks";
import TrackerButtonWrapper from "@/components/TrackerButtonWrapper";
import { WatchlistButtonWrapper } from "@/components/WatchlistButtonWrapper";
import Link from "next/link";
import { Metadata } from "next";
import { LANG_CONFIG } from "@/lib/analysis-langs";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Daily Swing Trade Candidates | BOGA AI",
  description: "Full algorithmic candidate list from the BOGA AI V116 engine — high-conviction swing trade setups with entries, targets, and stop levels.",
  alternates: { canonical: "https://bogastock.com/swing" },
};

function formatPrice(n: number | null | undefined) {
  if (n == null) return "—";
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

import SwingTableActions from "@/components/SwingTableActions";
import TickerHoverChart from "@/components/TickerHoverChart";

export default async function SwingPicksPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: selectedDate } = await searchParams;

  const [master, allPicksData, archiveDates, optionsData] = await Promise.all([
    getMasterData(),
    getSwingAllPicks(selectedDate),
    getSwingArchiveDates(),
    getOptionsData(selectedDate),
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
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3 border-b border-white/5 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00d2ff] font-mono">BOGA AI · SWING ENGINE</span>
            </div>
            <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white leading-none">
              Daily Swing Picks
              <span className="text-[#3b82f6] ml-2 not-italic">— {dateStr}</span>
            </h1>
            {generatedAt && (
              <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest mt-1">Updated {formatTime(generatedAt)}</p>
            )}
          </div>
          <Link
            href="/admin/analytics/performance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[#3b82f6]/30 rounded text-[10px] font-black text-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all uppercase tracking-widest font-mono"
          >
            ↗ PERF HISTORY
          </Link>
        </div>

        {/* Archive Bar */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
           <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] whitespace-nowrap font-mono">ARCHIVE:</span>
           <Link
             href="/admin/trading/swing"
             className={`px-2.5 py-1 text-[10px] font-black font-mono border transition-all uppercase ${!selectedDate ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10" : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"}`}
           >
             LATEST
           </Link>
           {archiveDates.slice(0, 10).map(d => (
             <Link
               key={d}
               href={`/swing?date=${d}`}
               className={`px-2.5 py-1 text-[10px] font-black font-mono border transition-all ${selectedDate === d ? "border-[#3b82f6] text-[#3b82f6] bg-[#3b82f6]/10" : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"}`}
             >
               {d.split('-').slice(1).join('/')}
             </Link>
           ))}
           <div className="h-3 w-px bg-white/10 mx-1" />
           <Link href="/admin/analytics/performance" className="text-[10px] font-black text-[#3b82f6]/60 hover:text-[#3b82f6] transition-colors whitespace-nowrap uppercase tracking-widest font-mono">
             FULL HISTORY →
           </Link>
        </div>

        <SwingTableActions picks={picks} dateStr={dateStr} />

        {picks.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="text-5xl mb-4">🦅</div>
            <h2 className="text-xl font-medium text-white mb-2">No Data Yet</h2>
            <p className="text-white text-sm">The Atmaca bot runs at 13:00 NY time on weekdays. Check back after the scan.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block glass-card overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[#00d2ff] text-[10px] uppercase tracking-[0.12em] font-mono">
                    <th className="px-3 py-3 text-left">#</th>
                    <th className="px-3 py-3 text-left">Ticker</th>
                    <th className="px-3 py-3 text-left">Sector</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right">Buy Zone</th>
                    <th className="px-3 py-3 text-right">Target</th>
                    <th className="px-3 py-3 text-right">Stop</th>
                    <th className="px-3 py-3 text-right">1D</th>
                    <th className="px-3 py-3 text-right">1W</th>
                    <th className="px-3 py-3 text-right">1M</th>
                    <th className="px-3 py-3 text-right">1Y</th>
                    <th className="px-3 py-3 text-right">5Y</th>
                    <th className="px-3 py-3 text-right">Opt</th>
                    <th className="px-3 py-3 text-center">Act</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick: any, idx: number) => (
                    <tr
                      key={pick.ticker}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx < 5 ? "bg-[#3b82f6]/5" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <span className={`text-[11px] font-black font-mono ${idx < 5 ? "text-[#3b82f6]" : "text-white/30"}`}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/stock/${pick.ticker}`} className="group">
                          <TickerHoverChart ticker={pick.ticker}>
                            <div className="text-white font-black text-base tracking-tight group-hover:text-[#3b82f6] transition-colors font-mono uppercase">
                              {pick.ticker}
                            </div>
                          </TickerHoverChart>
                          <div className="text-white/30 text-[10px] truncate max-w-[120px] font-mono">{pick.company}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-white/50 text-[11px] font-mono">{pick.sector || "—"}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-white font-mono font-medium text-[15px]">${formatPrice(pick.current_price)}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-white/70 font-mono text-[13px]">
                        ${formatPrice(pick.buy_zone.low)}–${formatPrice(pick.buy_zone.high)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#10b981] font-mono font-medium text-[13px]">
                        ${formatPrice(pick.profit_zone.low)}–${formatPrice(pick.profit_zone.high)}
                      </td>
                      <td className="px-3 py-3 text-right text-[#ef4444] font-mono text-[13px]">
                        ${formatPrice(pick.stop_zone.low)}–${formatPrice(pick.stop_zone.high)}
                      </td>
                      {[
                        { field: "change_1d" },
                        { field: "change_1w" },
                        { field: "change_1m" },
                        { field: "change_1y" },
                        { field: "change_5y" },
                      ].map((perf) => (
                        <td key={perf.field} className="px-3 py-3 text-right">
                          {pick[perf.field] != null ? (
                            <span className={`font-mono text-[13px] font-medium ${pick[perf.field] >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                              {pick[perf.field] >= 0 ? "+" : ""}{pick[perf.field].toFixed(1)}%
                            </span>
                          ) : <span className="text-white/20 text-[13px] font-mono">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          href={`/optanaliz?symbol=${pick.ticker}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded text-[10px] font-black text-[#8b5cf6] hover:bg-[#8b5cf6]/20 transition-all uppercase tracking-widest"
                        >
                          Option
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1.5 items-end">
                          <TrackerButtonWrapper pick={pick} />
                          <WatchlistButtonWrapper ticker={pick.ticker} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-6 mb-6">
              {picks.map((pick: any, idx: number) => (
                <div
                  key={pick.ticker}
                  className={`glass-card p-6 block border-2 border-[#1e2a3a] relative overflow-hidden ${idx < 5 ? "border-[#3b82f6]/40 shadow-[0_0_20px_rgba(59,130,246,0.1)]" : ""}`}
                >
                  {/* Rank Badge for Mobile */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-black text-white ${idx < 5 ? "bg-[#3b82f6]" : "bg-[#1e2a3a]"} rounded-bl-xl`}>
                    #{idx + 1}
                  </div>

                  <div className="flex items-start justify-between mb-5">
                    <Link href={`/stock/${pick.ticker}`} className="group flex-1">
                      <TickerHoverChart ticker={pick.ticker}><div className="text-white font-black text-3xl tracking-tighter uppercase mb-0.5 group-hover:text-[#3b82f6] transition-colors">{pick.ticker}</div></TickerHoverChart>
                      <div className="text-[#00d2ff] text-xs font-medium uppercase tracking-wider opacity-80">{pick.company}</div>
                    </Link>
                    <div className="scale-125 origin-right">
                       <ScoreBadge score={pick.score} />
                    </div>
                  </div>

                  {/* Enhanced Info Blocks with Borders */}
                  <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 rounded-xl bg-black/20 overflow-hidden mb-5">
                    <div className="py-3 px-2 text-center">
                      <div className="text-[9px] text-[#00d2ff] font-black uppercase tracking-widest mb-1.5 opacity-60">BUY ZONE</div>
                      <div className="text-white font-mono text-[13px] font-medium">${formatPrice(pick.buy_zone.low)}</div>
                    </div>
                    <div className="py-3 px-2 text-center bg-white/5">
                      <div className="text-[9px] text-[#10b981] font-black uppercase tracking-widest mb-1.5 opacity-60">TARGET</div>
                      <div className="text-[#10b981] font-mono text-[13px] font-black">${formatPrice(pick.profit_zone.high)}</div>
                    </div>
                    <div className="py-3 px-2 text-center">
                      <div className="text-[9px] text-[#ef4444] font-black uppercase tracking-widest mb-1.5 opacity-60">STOP LOSS</div>
                      <div className="text-[#ef4444] font-mono text-[13px] font-medium">${formatPrice(pick.stop_zone.low)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[12px] font-medium text-[#00d2ff] overflow-hidden">
                      {[
                        { label: "1D", val: pick.change_1d },
                        { label: "1W", val: pick.change_1w },
                        { label: "1M", val: pick.change_1m },
                      ].map(p => (
                        <div key={p.label} className="flex flex-col">
                           <span className="text-[8px] uppercase opacity-50 mb-0.5">{p.label}</span>
                           <span className={p.val != null ? (p.val >= 0 ? "text-[#10b981]" : "text-[#ef4444]") : ""}>
                             {p.val != null ? (p.val >= 0 ? "+" : "") + p.val.toFixed(1) + "%" : "—"}
                           </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/optanaliz?symbol=${pick.ticker}`}
                        className="px-3 py-2 bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 rounded-lg text-[10px] font-black text-[#8b5cf6] uppercase tracking-widest whitespace-nowrap"
                      >
                        Option →
                      </Link>
                      <Link 
                        href={`/stock/${pick.ticker}`}
                        className="px-3 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg text-[10px] font-black text-[#3b82f6] uppercase tracking-widest whitespace-nowrap"
                      >
                        DETAILS →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card p-4 flex flex-wrap gap-6 text-[11px] text-[#00d2ff]">
              <span>📈 <b className="text-white">Zones</b> = BOGA AI defined price ranges</span>
              <span>🎯 <b className="text-white">Hold</b> = Estimated swing duration</span>
              <span>⚡ <b className="text-white">Top 5</b> candidates highlighted</span>
              <span className="ml-auto">
                <Link href="/" className="text-[#3b82f6] hover:underline">← Back to Dashboard</Link>
              </span>
            </div>

            {/* Options Picks Section */}
            {optionsData?.picks && optionsData.picks.length > 0 && (
              <div className="mt-12">
                <div className="mb-6">
                  <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-1 tracking-tight">
                    Options Picks
                    <span className="ml-3 text-[#8b5cf6]">— {optionsData.date ?? dateStr}</span>
                  </h2>
                  <p className="text-white text-sm">
                    BOGA AI Options Scanner •{" "}
                    {optionsData.generated_at && (
                      <span className="text-[#a78bfa]">Updated {formatTime(optionsData.generated_at)}</span>
                    )}
                  </p>
                </div>

                {/* Desktop Options Table */}
                <div className="hidden md:block glass-card overflow-hidden mb-6" style={{ borderColor: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-[#a78bfa] text-[11px] uppercase tracking-wider">
                        <th className="px-4 py-4 text-left">#</th>
                        <th className="px-4 py-4 text-left">Ticker</th>
                        <th className="px-4 py-4 text-right">Score</th>
                        <th className="px-4 py-4 text-right">Grade</th>
                        <th className="px-4 py-4 text-right">Price</th>
                        <th className="px-4 py-4 text-right">Strike</th>
                        <th className="px-4 py-4 text-right">Expiry</th>
                        <th className="px-4 py-4 text-right">DTE</th>
                        <th className="px-4 py-4 text-right">Premium</th>
                        <th className="px-4 py-4 text-right">TP</th>
                        <th className="px-4 py-4 text-right">SL</th>
                        <th className="px-4 py-4 text-right">Delta</th>
                        <th className="px-4 py-4 text-right">IV Rank</th>
                        <th className="px-4 py-4 text-right">Cost/Cont</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optionsData.picks.map((op: any, idx: number) => {
                        const best = op.opt?.best ?? {};
                        return (
                          <tr key={op.ticker} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] font-black text-[#a78bfa]">#{idx + 1}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <Link href={`/stock/${op.ticker}`} className="group">
                                <div className="text-white font-black text-sm tracking-tight group-hover:text-[#8b5cf6] transition-colors">{op.ticker}</div>
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white text-xs font-black px-3 py-1 rounded-full">{op.score?.toFixed(1)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="text-[#a78bfa] font-medium text-xs">{op.grade ?? "—"}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-white font-mono text-[13px] font-semibold">${formatPrice(op.current_price)}</td>
                            <td className="px-3 py-2.5 text-right text-white font-mono text-[11px]">{best.strike ? `$${best.strike}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-[#a78bfa] font-mono text-[11px]">{best.expiration ?? "—"}</td>
                            <td className="px-3 py-2.5 text-right text-white text-[11px]">{best.dte ?? "—"}d</td>
                            <td className="px-3 py-2.5 text-right text-[#f59e0b] font-mono text-[11px] font-medium">{best.mid != null ? `$${best.mid.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-[#10b981] font-mono text-[11px] font-semibold">{best.tp_price ? `$${formatPrice(best.tp_price)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-[#ef4444] font-mono text-[11px]">{best.sl_price ? `$${formatPrice(best.sl_price)}` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-white text-[11px]">{best.delta != null ? best.delta.toFixed(2) : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-[#a78bfa] text-[11px]">{best.iv_rank != null ? `${best.iv_rank.toFixed(0)}%` : "—"}</td>
                            <td className="px-3 py-2.5 text-right text-white font-mono text-[11px]">{best.cost_per_contract != null ? `$${best.cost_per_contract.toFixed(0)}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Options Cards */}
                <div className="md:hidden flex flex-col gap-5 mb-6">
                  {optionsData.picks.map((op: any, idx: number) => {
                    const best = op.opt?.best ?? {};
                    return (
                      <div key={op.ticker} className="glass-card p-5 border border-[#8b5cf6]/30 relative">
                        <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-black text-white bg-[#8b5cf6] rounded-bl-xl">#{idx + 1}</div>
                        <div className="flex items-center justify-between mb-4">
                          <Link href={`/stock/${op.ticker}`}>
                            <div className="text-white font-black text-2xl tracking-tighter">{op.ticker}</div>
                          </Link>
                          <div className="flex items-center gap-2">
                            <span className="text-[#a78bfa] font-medium text-sm">{op.grade ?? ""}</span>
                            <span className="bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] text-white text-xs font-black px-3 py-1 rounded-full">{op.score?.toFixed(1)}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[11px]">
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-[#a78bfa] font-black uppercase tracking-widest text-[9px] mb-1">Contract</div>
                            <div className="text-white font-mono">{best.strike ? `$${best.strike} ` : ""}{best.expiration ?? "—"}</div>
                            <div className="text-white/60">{best.dte != null ? `${best.dte}d DTE` : ""}</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-[#f59e0b] font-black uppercase tracking-widest text-[9px] mb-1">Premium</div>
                            <div className="text-[#f59e0b] font-mono font-medium">{best.mid != null ? `$${best.mid.toFixed(2)}` : "—"}</div>
                            <div className="text-white/60">{best.cost_per_contract != null ? `$${best.cost_per_contract.toFixed(0)}/contract` : ""}</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-[#10b981] font-black uppercase tracking-widest text-[9px] mb-1">Target</div>
                            <div className="text-[#10b981] font-mono font-semibold">{best.tp_price ? `$${formatPrice(best.tp_price)}` : "—"}</div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <div className="text-[#ef4444] font-black uppercase tracking-widest text-[9px] mb-1">Stop Loss</div>
                            <div className="text-[#ef4444] font-mono">{best.sl_price ? `$${formatPrice(best.sl_price)}` : "—"}</div>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-3 text-[11px] text-white/60">
                          <span>Delta: <b className="text-white">{best.delta != null ? best.delta.toFixed(2) : "—"}</b></span>
                          <span>IV Rank: <b className="text-[#a78bfa]">{best.iv_rank != null ? `${best.iv_rank.toFixed(0)}%` : "—"}</b></span>
                          <span>Price: <b className="text-white">${formatPrice(op.current_price)}</b></span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="glass-card p-4 flex flex-wrap gap-6 text-[11px] text-[#a78bfa]" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
                  <span>🔮 <b className="text-white">Options Picks</b> = BOGA AI Options Scanner</span>
                  <span>💰 <b className="text-white">Cost/Cont</b> = Premium × 100 shares</span>
                  <span>📊 <b className="text-white">IV Rank</b> = Implied volatility percentile</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
