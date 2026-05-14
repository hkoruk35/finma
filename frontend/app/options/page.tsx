import { getMasterData, getOptionsData, getOptionsDates } from "@/lib/data";
import { OptionsData, OptionPick } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Option Scanner | BOGA AI — Institutional Flow & Winner Formula",
  description:
    "Professional options scanner utilizing the Winner Formula (Sector + PE + BP + Flow + Gamma). High-conviction call opportunities with institutional flow confirmation.",
  alternates: { canonical: "https://bogastock.com/options" },
};

function fmt(n: number | null | undefined, decimals = 2, prefix = "") {
  if (n == null) return "—";
  return prefix + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

export default async function OptionsPage() {
  const [master, allDates] = await Promise.all([
    getMasterData(),
    getOptionsDates()
  ]);

  // Show last 3 days in the main list
  const recentDates = allDates.slice(0, 3);
  const results = await Promise.all(recentDates.map(d => getOptionsData(d)));
  
  // Aggregate all picks
  const allPicks: OptionPick[] = results.flatMap(r => r?.picks ?? []);
  const latestData = results[0];

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) + " ET";
    } catch { return iso; }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#060a12] text-slate-200">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-10 bg-[#3b82f6] rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic">
                Option <span className="text-[#3b82f6]">Scanner</span>
              </h1>
            </div>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl font-medium">
              Institutional-grade scanning engine. v222 Winner Formula: 
              <span className="text-white"> Sector + Pre-Explosion + Breakout Proximity + High-Gamma Flow.</span>
            </p>
          </div>
        </div>

        {/* Market Context Stats */}
        {latestData && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-10">
            {[
              { label: "VIX INDEX", val: `${latestData.vix.toFixed(1)}`, sub: latestData.vix_regime,
                cls: latestData.vix < 18 ? "text-emerald-400" : latestData.vix < 25 ? "text-amber-400" : "text-red-400" },
              { label: "SPY 60D RET", val: fmtPct(latestData.spy_return_60d), sub: "Market Bias",
                cls: latestData.spy_return_60d >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "SCAN UNIVERSE", val: latestData.universe_size, sub: "Stocks Analyzed", cls: "text-white" },
              { label: "IDENTIFIED", val: allPicks.length, sub: "Active Setups", cls: "text-[#3b82f6]" },
              { label: "TREND BIAS", val: latestData.regime_summary.trend, sub: "Bullish Setups", cls: "text-emerald-400" },
              { label: "LATEST SCAN", val: formatTime(latestData.generated_at), sub: "NY Server Time", cls: "text-slate-400" },
            ].map((m) => (
              <div key={m.label} className="bg-[#0d1117] border border-white/5 p-4 rounded-2xl shadow-inner group hover:border-[#3b82f6]/30 transition-all">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{m.label}</div>
                <div className={`text-xl font-black ${m.cls}`}>{m.val}</div>
                <div className="text-[9px] font-bold text-slate-600 uppercase mt-1">{m.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Main List */}
        <div className="bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl mb-12">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Ticker / Score</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Setup / Regime</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Price / IV</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Winner Formula</th>
                  <th className="px-6 py-5 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Optimal Contract</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Greeks / Edge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allPicks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="text-4xl mb-4">🦅</div>
                      <h3 className="text-xl font-black text-white uppercase italic">Awaiting Market Movement</h3>
                      <p className="text-slate-500 text-sm mt-2">Run the scanner or check back during market hours.</p>
                    </td>
                  </tr>
                ) : (
                  allPicks.map((pick) => {
                    const best = pick.institutional || pick.asymmetric;
                    const isV220 = !!pick.l2;
                    const scoreColor = pick.score >= 75 ? "text-amber-400" : pick.score >= 60 ? "text-[#3b82f6]" : "text-emerald-400";
                    
                    return (
                      <tr key={`${pick.date}-${pick.ticker}`} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Ticker & Score */}
                        <td className="px-6 py-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2 ${
                              pick.score >= 75 ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]"
                            }`}>
                              {pick.score.toFixed(0)}
                            </div>
                            <div>
                              <Link href={`/stock/${pick.ticker}`} className="text-2xl font-black text-white hover:text-[#3b82f6] transition-colors block leading-none">
                                {pick.ticker}
                              </Link>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{pick.date}</span>
                            </div>
                          </div>
                        </td>

                        {/* Setup */}
                        <td className="px-6 py-6">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase">
                                {pick.entry_mode_label}
                              </span>
                              {pick.earnings_warning && (
                                <span className="text-[10px] font-black text-red-500 animate-pulse">⚠️ EARN</span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-slate-400 italic">
                              {pick.grade}
                            </div>
                          </div>
                        </td>

                        {/* Price / IV */}
                        <td className="px-6 py-6 text-center">
                          <div className="text-lg font-black text-white">${pick.current_price.toFixed(2)}</div>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-500">IVR:</span>
                            <span className={`text-[11px] font-black ${
                              (pick.iv_rank || 0) < 20 ? "text-emerald-400" : (pick.iv_rank || 0) < 40 ? "text-amber-400" : "text-red-400"
                            }`}>
                              {pick.iv_rank?.toFixed(0) || "—"}
                            </span>
                          </div>
                        </td>

                        {/* Winner Formula Metrics */}
                        <td className="px-6 py-6">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-center">
                            <div>
                              <div className="text-[9px] font-black text-slate-600 uppercase">PE Score</div>
                              <div className="text-xs font-black text-white">{pick.breakout_base_score?.toFixed(0) || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-600 uppercase">Prox.</div>
                              <div className="text-xs font-black text-[#3b82f6]">{pick.l3?.bp_score?.toFixed(0) || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-600 uppercase">UOA</div>
                              <div className="text-xs font-black text-amber-500">{pick.uoa_score?.toFixed(0) || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-black text-slate-600 uppercase">RVOL</div>
                              <div className="text-xs font-black text-emerald-500">{pick.rvol?.toFixed(1) || "1.0"}x</div>
                            </div>
                          </div>
                        </td>

                        {/* Contract Details */}
                        <td className="px-6 py-6 text-center">
                          {best ? (
                            <div className="inline-block bg-[#1a212e] border border-[#3b82f6]/20 rounded-2xl p-3">
                              <div className="text-sm font-black text-white">${best.strike} CALL</div>
                              <div className="text-[10px] font-bold text-[#3b82f6] uppercase mt-0.5">
                                {best.expiration} · {best.dte}D
                              </div>
                              <div className="text-xs font-black text-white mt-1">
                                Cost: ${best.contract_cost?.toFixed(0)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Greeks / Edge */}
                        <td className="px-6 py-6 text-right">
                          {best && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[10px] font-bold text-slate-500">Δ</span>
                                <span className="text-xs font-black text-white">{best.delta?.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-[10px] font-bold text-slate-500">Γ</span>
                                <span className="text-xs font-black text-white">{best.gamma?.toFixed(4)}</span>
                              </div>
                              <div className="mt-2 text-xs font-black text-emerald-400">
                                SIM: {best.sim_gain_pct != null ? (best.sim_gain_pct >= 0 ? "+" : "") + best.sim_gain_pct.toFixed(0) + "%" : "—"}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend / Info */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="glass-card p-6 border-white/5">
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Winner Formula Core</h4>
            <ul className="space-y-3 text-xs text-slate-400 font-medium">
              <li className="flex justify-between"><span>Pre-Explosion (PE)</span> <span className="text-white font-bold">BB Squeeze + ATR Crush</span></li>
              <li className="flex justify-between"><span>Breakout Proximity</span> <span className="text-white font-bold">Within 3% of 20D High</span></li>
              <li className="flex justify-between"><span>Institutional Flow</span> <span className="text-white font-bold">$100K+ Notional Sweeps</span></li>
              <li className="flex justify-between"><span>Gamma Efficiency</span> <span className="text-white font-bold">Δ 0.30 - 0.45 Sweet Spot</span></li>
            </ul>
          </div>

          <div className="glass-card p-6 border-white/5">
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Exit Strategy</h4>
            <ul className="space-y-3 text-xs text-slate-400 font-medium">
              <li className="flex justify-between"><span>Take Profit</span> <span className="text-emerald-400 font-bold">+40% to +80%</span></li>
              <li className="flex justify-between"><span>Stop Loss</span> <span className="text-red-400 font-bold">-25% to -35%</span></li>
              <li className="flex justify-between"><span>Time Stop</span> <span className="text-amber-400 font-bold">60% of DTE Consumed</span></li>
              <li className="flex justify-between"><span>Market Exit</span> <span className="text-white font-bold">EMA8/21 Trend Breakdown</span></li>
            </ul>
          </div>

          <div className="glass-card p-6 border-white/5">
            <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">Archive & Performance</h4>
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Scan data is archived daily. BOGA AI tracks every pick from entry to outcome using real-time price updates.
              </p>
              <div className="flex gap-3">
                <Link href="/options/archive" className="flex-1 text-center py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase hover:bg-white/10 transition-colors">
                  Full Archive
                </Link>
                <Link href="/options/performance" className="flex-1 text-center py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] rounded-lg text-[10px] font-black uppercase hover:bg-[#3b82f6]/20 transition-colors">
                  Performance
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

