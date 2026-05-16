import { getMasterData, getOptionsData, getOptionsDates } from "@/lib/data";
import { OptionsData, OptionPick } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Option Scanner | BOGA AI — v241 Terminal",
  description: "BOGA AI v241 Options Scanner. Institutional Flow & Winner Formula terminal.",
  alternates: { canonical: "https://bogastock.com/options" },
};

function n(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return Number(v).toFixed(d);
}
function pct(v: any, d = 1): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  const x = Number(v);
  return (x >= 0 ? "+" : "") + x.toFixed(d) + "%";
}
function dollar(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return "$" + Number(v).toFixed(d);
}
function num(v: any, d = 0): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default async function OptionsPage() {
  const [master, allDates] = await Promise.all([
    getMasterData(),
    getOptionsDates(),
  ]);

  const recentDates = allDates.slice(0, 3);
  const results = await Promise.all(recentDates.map((d) => getOptionsData(d)));
  const allPicks: OptionPick[] = results.flatMap((r) => r?.picks ?? []);
  const latestData = results[0];

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " ET";
    } catch { return iso; }
  };

  const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
    <th className={`px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap border-b border-white/10 ${right ? "text-right" : center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );

  const TD = ({ children, center, right, cls }: { children: React.ReactNode; center?: boolean; right?: boolean; cls?: string }) => (
    <td className={`px-2 py-1.5 text-[11px] font-medium whitespace-nowrap border-b border-white/[0.03] ${center ? "text-center" : right ? "text-right" : "text-left"} ${cls || "text-slate-300"}`}>
      {children}
    </td>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-4">
        
        {/* ── Minimal Header ────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white tracking-tighter uppercase italic">
              BOGA <span className="text-[#3b82f6]">OPTIONS</span> v241
            </span>
            <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest font-bold">
              Institutional Terminal
            </span>
          </div>
          <div className="flex items-center gap-4">
             {latestData && (
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <span>VIX: <span className={latestData.vix < 20 ? "text-emerald-400" : "text-red-400"}>{latestData.vix.toFixed(1)}</span></span>
                  <span className="hidden md:inline">|</span>
                  <span>UNIVERSE: <span className="text-white">{latestData.universe_size}</span></span>
                  <span className="hidden md:inline">|</span>
                  <span>UPDATED: <span className="text-[#3b82f6]">{formatTime(latestData.generated_at)}</span></span>
                </div>
             )}
          </div>
        </div>

        {/* ── Main Data Terminal ────────────────────────────── */}
        <div className="bg-[#080c14] border border-white/10 rounded overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse leading-none">
              <thead className="bg-[#0c121d]">
                <tr>
                  <TH>DATE</TH>
                  <TH>TICKER</TH>
                  <TH center>SCORE</TH>
                  <TH>SECTOR</TH>
                  <TH>SETUP</TH>
                  <TH right>PRICE</TH>
                  <TH right>IV%</TH>
                  <TH right>IVR</TH>
                  <TH right>RSI</TH>
                  <TH right>RVOL</TH>
                  <TH right>RS60</TH>
                  <TH center>TYPE</TH>
                  <TH>STRIKE</TH>
                  <TH>EXP</TH>
                  <TH right>DTE</TH>
                  <TH right>COST</TH>
                  <TH right>MID</TH>
                  <TH right>SPRD%</TH>
                  <TH right>Δ</TH>
                  <TH right>Γ</TH>
                  <TH right>Θ</TH>
                  <TH right>Γ/Θ</TH>
                  <TH right>OI</TH>
                  <TH right>VOL</TH>
                  <TH right>SIM%</TH>
                  <TH right>TP</TH>
                  <TH right>SL</TH>
                  <TH right>BEVEN</TH>
                  <TH right>DECAY</TH>
                  <TH>REMARKS</TH>
                </tr>
              </thead>
              <tbody>
                {allPicks.length === 0 ? (
                  <tr>
                    <td colSpan={30} className="px-6 py-20 text-center text-slate-500 uppercase tracking-widest font-black">
                      [ NO ACTIVE SIGNALS FOUND IN DATABASE ]
                    </td>
                  </tr>
                ) : (
                  allPicks.map((pick, i) => {
                    const raw: any = pick; // Original JSON access
                    const opts = raw.options || {};
                    
                    // We will render two rows if both gamma_sweet and institutional exist, or just one
                    const contracts = [];
                    if (opts.gamma_sweet) contracts.push({ ...opts.gamma_sweet, label: "GAMMA" });
                    if (opts.institutional) contracts.push({ ...opts.institutional, label: "INST." });
                    if (contracts.length === 0 && raw.institutional) contracts.push({ ...raw.institutional, label: "INST." });
                    if (contracts.length === 0) contracts.push({ label: "—" });

                    const scoreCls = raw.score >= 90 ? "text-amber-400" : raw.score >= 75 ? "text-[#3b82f6]" : "text-emerald-400";
                    
                    return contracts.map((c, cIdx) => (
                      <tr key={`${raw.date}-${raw.ticker}-${cIdx}`} className="hover:bg-white/[0.04] transition-colors">
                        {/* Static Info (only show on first contract row) */}
                        <TD cls={cIdx === 0 ? "text-slate-500" : "text-transparent"}>{cIdx === 0 ? raw.date : raw.date}</TD>
                        <TD cls={cIdx === 0 ? "text-white font-black" : "text-slate-700"}>
                          {cIdx === 0 ? (
                            <Link href={`/stock/${raw.ticker}`} className="hover:text-[#3b82f6]">{raw.ticker}</Link>
                          ) : raw.ticker}
                        </TD>
                        <TD center cls={cIdx === 0 ? `font-black ${scoreCls}` : "text-slate-700"}>{cIdx === 0 ? raw.score.toFixed(0) : ""}</TD>
                        <TD cls={cIdx === 0 ? "text-slate-400" : "text-transparent"}>
                          {cIdx === 0 ? (raw.sector_info?.etf || raw.sector || "—") : ""}
                        </TD>
                        <TD cls={cIdx === 0 ? "text-[#3b82f6] text-[10px]" : "text-transparent"}>
                          {cIdx === 0 ? (raw.s5?.setup_type || raw.entry_mode_label || "—") : ""}
                        </TD>
                        <TD right cls={cIdx === 0 ? "text-white" : "text-transparent"}>{cIdx === 0 ? dollar(raw.current_price) : ""}</TD>
                        
                        {/* Technicals (also static-ish per ticker) */}
                        <TD right cls={cIdx === 0 ? "text-amber-500/80" : "text-transparent"}>{cIdx === 0 ? n(opts.atm_iv || raw.iv_pct, 1) : ""}</TD>
                        <TD right cls={cIdx === 0 ? ((raw.iv_rank ?? 0) < 30 ? "text-emerald-500" : "text-red-500") : "text-transparent"}>
                           {cIdx === 0 ? n(raw.iv_rank || opts.iv_rank, 0) : ""}
                        </TD>
                        <TD right cls={cIdx === 0 ? "text-slate-400" : "text-transparent"}>{cIdx === 0 ? n(raw.mtf?.rsi_1d || raw.rsi, 1) : ""}</TD>
                        <TD right cls={cIdx === 0 ? "text-slate-400" : "text-transparent"}>{cIdx === 0 ? n(raw.s7?.today_rvol || raw.rvol, 1) + "x" : ""}</TD>
                        <TD right cls={cIdx === 0 ? (Number(raw.l4?.rs_60 || raw.rs_vs_spy_60d) >= 0 ? "text-emerald-500" : "text-red-500") : "text-transparent"}>
                          {cIdx === 0 ? pct(raw.l4?.rs_60 || raw.rs_vs_spy_60d) : ""}
                        </TD>

                        {/* Contract Specific Info */}
                        <TD center cls={c.label === "GAMMA" ? "text-emerald-400 font-bold" : c.label === "INST." ? "text-purple-400 font-bold" : "text-slate-600"}>
                          {c.label}
                        </TD>
                        <TD cls="text-white font-bold">{c.strike ? `$${c.strike} C` : "—"}</TD>
                        <TD cls="text-slate-400">{c.expiration || c.expiry || "—"}</TD>
                        <TD right cls="text-white">{c.dte ? `${c.dte}d` : "—"}</TD>
                        <TD right cls="text-white font-bold">{dollar(c.cost_per_contract || c.contract_cost || c.premium * 100, 0)}</TD>
                        <TD right cls="text-slate-500">{dollar(c.mid || c.premium, 2)}</TD>
                        <TD right cls={Number(c.spread_pct) < 15 ? "text-emerald-500" : "text-amber-500"}>{pct(c.spread_pct)}</TD>
                        <TD right cls="text-[#3b82f6]">{n(c.delta, 2)}</TD>
                        <TD right cls="text-purple-400">{n(c.gamma, 4)}</TD>
                        <TD right cls="text-red-400">{n(c.theta, 3)}</TD>
                        <TD right cls={Number(c.gt_ratio) >= 0.5 ? "text-emerald-400" : "text-slate-500"}>{n(c.gt_ratio, 2)}</TD>
                        <TD right cls="text-slate-500">{num(c.oi, 0)}</TD>
                        <TD right cls="text-slate-500">{num(c.volume, 0)}</TD>
                        
                        {/* Simulation & Targets */}
                        <TD right cls={Number(c.sim?.pnl_pct || c.sim_gain_pct) >= 0 ? "text-emerald-400 font-bold" : "text-red-400"}>
                          {pct(c.sim?.pnl_pct || c.sim_gain_pct, 0)}
                        </TD>
                        <TD right cls="text-emerald-500">{dollar(c.tp_price)}</TD>
                        <TD right cls="text-red-500">{dollar(c.sl_price)}</TD>
                        <TD right cls="text-slate-400">{dollar(c.breakeven)}</TD>
                        <TD right cls="text-orange-500">-{n(c.daily_decay_pct, 1)}%</TD>
                        
                        {/* Remarks */}
                        <TD cls="text-[9px] text-slate-500 max-w-[150px] truncate">
                          {cIdx === 0 ? (raw.grade || raw.quality || "—") : ""}
                        </TD>
                      </tr>
                    ));
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer Stats ──────────────────────────────────── */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Exit Policy</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between"><span>Target</span><span className="text-emerald-400">+40%</span></div>
                <div className="flex justify-between"><span>Stop</span><span className="text-red-400">-30%</span></div>
              </div>
           </div>
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Winner Formula</div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between"><span>Gamma/Theta</span><span className="text-white">≥ 0.50</span></div>
                <div className="flex justify-between"><span>Earnings</span><span className="text-white">Block &lt; 14d</span></div>
              </div>
           </div>
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded flex flex-col justify-center items-center">
              <Link href="/options/performance" className="text-[#3b82f6] text-[11px] font-black uppercase hover:underline">View Performance Dashboard →</Link>
           </div>
           <div className="bg-[#0d1420] border border-white/10 p-3 rounded flex flex-col justify-center items-center">
              <Link href="/options/archive" className="text-slate-400 text-[11px] font-black uppercase hover:underline">Historical Archive →</Link>
           </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
