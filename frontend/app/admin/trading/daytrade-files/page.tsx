import { getMasterData, getDayTradeAllPicks } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import TopSwingPicks from "@/components/TopSwingPicks";
import TrackerButtonWrapper from "@/components/TrackerButtonWrapper";
import Link from "next/link";
import { Metadata } from "next";
import { LANG_CONFIG } from "@/lib/analysis-langs";
import SwingTableActions from "@/components/SwingTableActions";
import { formatNumber } from "@/lib/formatNumber";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Daily DayTrade Candidates | BOGA AI",
  description: "Algorithmic pgap and momentum list from the BOGA AI DayTrade engine.",
  alternates: { canonical: "https://bogastock.com/daytrade" },
};

function formatPrice(n: any) {
  if (n === undefined || n === null || isNaN(Number(n))) return "0.00";
  return formatNumber(Number(n), 2);
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "from-[#22c55e] to-[#10b981]" :
    score >= 60 ? "from-[#3b82f6] to-[#6366f1]" :
    score >= 45 ? "from-[#f59e0b] to-[#f97316]" :
                  "from-[#64748b] to-[#475569]";
  return (
    <div className={`bg-gradient-to-r ${color} text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider`}>
      {formatNumber(score || 0, 1)}
    </div>
  );
}

export default async function DayTradePicksPage() {
  const [master, allPicksData] = await Promise.all([
    getMasterData(),
    getDayTradeAllPicks(),
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
      {master && <TickerTape data={master} />}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3 border-b border-white/5 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#10b981] font-mono">BOGA AI · DAYTRADE ENGINE</span>
            </div>
            <h1 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-white leading-none">
              DayTrade Signals
              <span className="text-[#10b981] ml-2 not-italic">— {dateStr}</span>
            </h1>
            {generatedAt && (
              <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest mt-1">Updated {formatTime(generatedAt)}</p>
            )}
          </div>
          <Link
            href="/admin/trading/daytrade-performance"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[#10b981]/30 rounded text-[10px] font-black text-[#10b981] hover:bg-[#10b981]/10 transition-all uppercase tracking-widest font-mono"
          >
            ↗ PERF HISTORY
          </Link>
        </div>

        <SwingTableActions picks={picks} dateStr={dateStr} />

        {picks.length === 0 ? (
          <div className="glass-card p-12 text-center border-dashed border-white/10">
            <div className="text-5xl mb-4 animate-pulse">⚡</div>
            <h2 className="text-xl font-medium text-white mb-2">Premarket Scanning...</h2>
            <p className="text-white text-sm opacity-60">The DayTrade bot starts at 09:15 NY time. Check back during market open.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block glass-card overflow-hidden mb-6 border border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[#00d2ff] text-[11px] uppercase tracking-wider bg-white/2">
                    <th className="px-4 py-4 text-left">#</th>
                    <th className="px-4 py-4 text-left">Ticker</th>
                    <th className="px-4 py-4 text-left">Strategy</th>
                    <th className="px-4 py-4 text-right">DT Score</th>
                    <th className="px-4 py-4 text-right">Price</th>
                    <th className="px-4 py-4 text-right">Gap %</th>
                    <th className="px-4 py-4 text-right">VWAP Bias</th>
                    <th className="px-4 py-4 text-right">Entry</th>
                    <th className="px-4 py-4 text-right">Target</th>
                    <th className="px-4 py-4 text-right">Stop</th>
                    <th className="px-4 py-4 text-right">R/R</th>
                    <th className="px-4 py-4 text-right">RVOL</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((pick: any, idx: number) => {
                    const zones = pick.boga_zones || pick.zones || {};
                    const price = pick.current_price ?? pick.price ?? 0;
                    return (
                      <tr
                        key={pick.ticker}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx < 3 ? "bg-[#10b981]/5" : ""}`}
                      >
                        <td className="px-3 py-4">
                          <span className={`text-[11px] font-black ${idx < 3 ? "text-[#10b981]" : "text-[#00d2ff]"}`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <Link href={`/en/analysis/${pick.ticker.toLowerCase()}`} className="group">
                            <div className="text-white font-black text-base tracking-tight group-hover:text-[#10b981] transition-colors">
                              {pick.ticker}
                            </div>
                            <div className="text-[#00d2ff] text-[10px] opacity-60 truncate max-w-[120px]">{pick.company}</div>
                          </Link>
                        </td>
                        <td className="px-3 py-4">
                          <span className="text-white text-[11px] font-medium bg-white/10 px-2 py-0.5 rounded uppercase">{pick.primary_signal || pick.signal || "MOMENTUM"}</span>
                        </td>
                        <td className="px-3 py-4 text-right">
                          <ScoreBadge score={pick.dt_score} />
                        </td>
                        <td className="px-3 py-4 text-right">
                          <span className="text-white font-mono font-medium text-[14px]">${formatPrice(price)}</span>
                        </td>
                        <td className="px-3 py-4 text-right">
                           <span className={`font-mono text-[12px] font-black ${(pick.change_pct || 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                             {(pick.change_pct || 0) >= 0 ? "+" : ""}{formatNumber(pick.change_pct || 0, 1)}%
                           </span>
                        </td>
                        <td className="px-3 py-4 text-right">
                           <span className={`font-mono text-[11px] ${(pick.price_vs_vwap || 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                             {(pick.price_vs_vwap || 0) >= 0 ? "ABOVE" : "BELOW"} ({formatNumber(pick.price_vs_vwap || 0, 1)}%)
                           </span>
                        </td>
                        <td className="px-3 py-4 text-right text-white font-mono text-[12px] font-semibold">
                          ${formatPrice(zones.entry_zone?.low)}
                        </td>
                        <td className="px-3 py-4 text-right text-[#10b981] font-mono font-black text-[12px]">
                          ${formatPrice(zones.tp1)}
                        </td>
                        <td className="px-3 py-4 text-right text-[#ef4444] font-mono text-[12px]">
                          ${formatPrice(zones.stop)}
                        </td>
                        <td className="px-3 py-4 text-right">
                           <span className="bg-[#10b981]/10 text-[#10b981] text-[10px] font-black px-2 py-0.5 rounded">
                             {zones.rr_ratio || pick.rr_ratio || "2.0"}:1
                           </span>
                        </td>
                        <td className="px-3 py-4 text-right">
                           <span className="text-white font-mono text-[11px]">{pick.rvol}x</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden flex flex-col gap-4 mb-6">
              {picks.map((pick: any, idx: number) => {
                const zones = pick.boga_zones || pick.zones || {};
                const price = pick.current_price ?? pick.price ?? 0;
                return (
                  <div
                    key={pick.ticker}
                    className={`glass-card p-5 block border-l-4 ${idx < 3 ? "border-l-[#10b981] bg-[#10b981]/5" : "border-l-[#1e2a3a]"} transition-all`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-white font-black text-2xl tracking-tighter uppercase">{pick.ticker}</div>
                        <div className="text-[#00d2ff] text-[10px] font-medium uppercase tracking-widest opacity-60">{pick.primary_signal || pick.signal}</div>
                      </div>
                      <div className="text-right">
                         <div className="text-white font-mono font-medium text-lg">${formatPrice(price)}</div>
                         <div className={`text-[11px] font-black ${(pick.change_pct || 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                           {(pick.change_pct || 0) >= 0 ? "+" : ""}{formatNumber(pick.change_pct || 0, 1)}% GAP
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                       <div className="bg-black/20 p-2 rounded text-center border border-white/5">
                          <div className="text-[8px] text-[#00d2ff] uppercase font-black mb-1 opacity-50">ENTRY</div>
                          <div className="text-white font-mono text-xs font-medium">${formatPrice(zones.entry_zone?.low)}</div>
                       </div>
                       <div className="bg-[#10b981]/10 p-2 rounded text-center border border-[#10b981]/20">
                          <div className="text-[8px] text-[#10b981] uppercase font-black mb-1 opacity-60">TARGET</div>
                          <div className="text-[#10b981] font-mono text-xs font-black">${formatPrice(zones.tp1)}</div>
                       </div>
                       <div className="bg-[#ef4444]/10 p-2 rounded text-center border border-[#ef4444]/20">
                          <div className="text-[8px] text-[#ef4444] uppercase font-black mb-1 opacity-60">STOP</div>
                          <div className="text-[#ef4444] font-mono text-xs font-medium">${formatPrice(zones.stop)}</div>
                       </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-medium">
                       <div className="flex gap-3">
                          <span className="text-[#00d2ff] uppercase">SCORE: <b className="text-white">{pick.dt_score}</b></span>
                          <span className="text-[#00d2ff] uppercase">R/R: <b className="text-white">{zones.rr_ratio || pick.rr_ratio || "2.0"}:1</b></span>
                       </div>
                       <Link href={`/en/analysis/${pick.ticker.toLowerCase()}`} className="text-[#10b981] uppercase tracking-widest">
                         ANALYSIS →
                       </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend & Notes */}
            <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-[#00d2ff] border border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-white font-medium uppercase tracking-wider mb-1">⚡ DAYTRADE STRATEGY</span>
                <span><b>GAP & GO:</b> Strong premarket gap with momentum continuation.</span>
                <span><b>VWAP PULLBACK:</b> Entry on pullbacks to the Volume Weighted Average Price.</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-white font-medium uppercase tracking-wider mb-1">🛡️ RISK MANAGEMENT</span>
                <span><b>STOP LOSS:</b> Hard stop level (0.5x ATR). Exit immediately if hit.</span>
                <span><b>PDT RULE:</b> Ensure 25k+ balance if taking 4+ daytrades in 5 days.</span>
              </div>
              <div className="flex flex-col gap-1 md:text-right">
                <span className="text-white font-medium uppercase tracking-wider mb-1">📈 ARCHIVE</span>
                <Link href="/admin/trading/daytrade-performance" className="text-[#10b981] hover:underline font-black">VIEW DAYTRADE PERFORMANCE HISTORY →</Link>
                <Link href="/admin/trading/swing" className="text-[#3b82f6] hover:underline mt-1 font-medium">Switch to Swing Terminal</Link>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
