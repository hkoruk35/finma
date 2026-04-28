"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useSmartTracker } from "@/components/SmartTrackerContext";
import { TrackerPosition, SizeUnit, computePnl } from "@/lib/smartTracker";

type HourlySignal = {
  ticker: string;
  status: string;
  status_detail: string;
  alert_level: string;
  current_price: number;
  intraday: { rsi_1h: number; trend_1h: string; volume_ratio: number };
};

const SIGNAL_CFG: Record<string, { label: string; color: string; border: string }> = {
  ENTRY_NOW:      { label: "Entry Now",      color: "text-emerald-400", border: "border-emerald-500/40" },
  ENTRY_WATCH:    { label: "Watch",          color: "text-blue-400",    border: "border-blue-500/30" },
  HOLD:           { label: "Hold",           color: "text-teal-400",    border: "border-teal-500/30" },
  TIGHTEN_STOP:   { label: "Tighten Stop",   color: "text-cyan-400",    border: "border-cyan-500/30" },
  PARTIAL_PROFIT: { label: "Partial Profit", color: "text-amber-400",   border: "border-amber-500/40" },
  TAKE_PROFIT:    { label: "Take Profit",    color: "text-purple-400",  border: "border-purple-500/40" },
  WAIT:           { label: "Wait",           color: "text-slate-400",   border: "border-slate-500/20" },
  STOP_ALERT:     { label: "Stop Alert",     color: "text-red-400",     border: "border-red-500/50" },
  STOP_HIT:       { label: "Stop Hit",       color: "text-red-500",     border: "border-red-600/60" },
};

const f = (n: number, d = 2) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pColor = (v: number) => v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";
const sgn = (v: number) => v > 0 ? "+" : "";

function StatCard({ label, val, sub, color = "text-white" }: { label: string; val: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-3">
      <div className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-lg font-black font-mono leading-none ${color}`}>{val}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function PositionCard({ pos, simple, signal }: { pos: TrackerPosition; simple: boolean; signal?: HourlySignal }) {
  const { openTrade, closeTrade, removeFromTracker } = useSmartTracker();
  const [closeInput, setCloseInput] = useState("");
  const [entryInput, setEntryInput] = useState("");
  const pnl = computePnl(pos, pos.currentPrice);
  const isClosed = pos.status === "closed";
  const isOpen = pos.status === "open";
  const pnlUsd = isClosed ? (pos.realizedPnlUsd ?? 0) : pnl.pnlUsd;
  const pnlPct = isClosed ? (pos.realizedPnlPct ?? 0) : pnl.pnlPct;

  const badge = { open: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", closed: "bg-slate-500/20 text-slate-400 border-slate-500/30", pending: "bg-amber-500/20 text-amber-400 border-amber-500/30" }[pos.status];

  if (simple) {
    const simpleCfg = signal ? (SIGNAL_CFG[signal.status] ?? SIGNAL_CFG.WAIT) : null;
    return (
      <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#1e2a3a] hover:bg-white/[0.02] transition-colors ${isClosed ? "opacity-50" : ""}`}>
        <div className="w-16 shrink-0">
          <div className="text-white font-black text-sm">{pos.ticker}</div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge}`}>{pos.status}</span>
          {simpleCfg && !isClosed && (
            <div className={`text-[8px] font-bold mt-0.5 ${simpleCfg.color}`}>{simpleCfg.label}</div>
          )}
        </div>
        <div className="flex-1 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div><div className="text-slate-500 text-[9px] uppercase">Entry</div><div className="text-white font-mono font-bold">${f(pos.entryPrice ?? pos.buyZoneLow)}</div></div>
          <div><div className="text-emerald-500 text-[9px] uppercase">Target</div><div className="text-emerald-400 font-mono font-bold">${f(pos.profitZoneHigh)}</div></div>
          <div><div className="text-red-500 text-[9px] uppercase">Stop</div><div className="text-red-400 font-mono font-bold">${f(pos.stopZoneLow)}</div></div>
        </div>
        <div className="text-right shrink-0 w-24">
          <div className={`text-sm font-black font-mono ${pColor(pnlUsd)}`}>{sgn(pnlUsd)}${f(Math.abs(pnlUsd))}</div>
          <div className={`text-[10px] font-mono ${pColor(pnlPct)}`}>{sgn(pnlPct)}{f(Math.abs(pnlPct))}%</div>
        </div>
        <div className="flex gap-1 shrink-0">
          {pos.status === "pending" && <button onClick={() => openTrade(pos.id, parseFloat(entryInput) || pos.buyZoneLow)} className="px-2 py-1 text-[9px] font-black uppercase bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded hover:bg-[#3b82f6]/20">Open</button>}
          {isOpen && <button onClick={() => closeTrade(pos.id, parseFloat(closeInput) || (pos.currentPrice ?? pos.signalPrice))} className="px-2 py-1 text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20">Close</button>}
          {!isClosed && <button onClick={() => removeFromTracker(pos.id)} className="px-2 py-1 text-[9px] text-slate-500 border border-[#1e2a3a] rounded hover:text-red-400">✕</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-4 ${isClosed ? "opacity-55" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link href={`/stock/${pos.ticker}`} className="text-white font-black text-base hover:text-[#3b82f6] transition-colors tracking-tight">{pos.ticker}</Link>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>{pos.status}</span>
        </div>
        <div className="text-right">
          <div className={`text-base font-black font-mono ${pColor(pnlUsd)}`}>{sgn(pnlUsd)}${f(Math.abs(pnlUsd))}</div>
          <div className={`text-[11px] font-mono font-bold ${pColor(pnlPct)}`}>{sgn(pnlPct)}{f(Math.abs(pnlPct))}%</div>
        </div>
      </div>
      <div className="text-[10px] text-slate-500 mb-3">{pos.company} · {pos.sector} · {pos.addedDate}</div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "ENTRY", val: `$${f(pos.entryPrice ?? pos.buyZoneLow)}`, color: "text-white", bg: "bg-[#141924]" },
          { label: "TARGET", val: `$${f(pos.profitZoneHigh)}`, color: "text-emerald-400", bg: "bg-emerald-500/5 border border-emerald-500/10" },
          { label: "STOP", val: `$${f(pos.stopZoneLow)}`, color: "text-red-400", bg: "bg-red-500/5 border border-red-500/10" },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-lg p-2 text-center`}>
            <div className="text-[9px] font-black text-slate-500 uppercase mb-0.5">{label}</div>
            <div className={`text-[12px] font-mono font-black ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {signal && !isClosed && (() => {
        const cfg = SIGNAL_CFG[signal.status] ?? SIGNAL_CFG.WAIT;
        const isAlert = signal.status === "STOP_HIT" || signal.status === "STOP_ALERT";
        const isProfit = signal.status === "TAKE_PROFIT" || signal.status === "PARTIAL_PROFIT";
        return (
          <div className={`rounded-lg px-3 py-2 mb-3 border ${isAlert ? "bg-red-500/5 border-red-500/30" : isProfit ? "bg-amber-500/5 border-amber-500/20" : "bg-[#141924] border-[#1e2a3a]"}`}>
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
              <span className="text-[9px] text-slate-500 font-mono">RSI {signal.intraday.rsi_1h.toFixed(0)} · {signal.intraday.trend_1h} · Vol {signal.intraday.volume_ratio.toFixed(1)}x</span>
            </div>
            {signal.status_detail && (
              <p className="text-[10px] text-slate-400 leading-relaxed">{signal.status_detail}</p>
            )}
          </div>
        );
      })()}

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">Size: <span className="text-white font-mono">{pos.sizeUnit === "usd" ? `$${f(pos.sizeValue, 0)}` : `${pos.sizeValue} sh`}</span>
          {isOpen && pos.currentPrice && <span className="text-slate-500 ml-1">@ ${f(pos.currentPrice)}</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {pos.status === "pending" && (
            <>
              <input type="number" placeholder={`$${f(pos.buyZoneLow)}`} value={entryInput} onChange={e => setEntryInput(e.target.value)}
                className="w-20 bg-[#141924] border border-[#1e2a3a] rounded px-2 py-1 text-white text-[10px] font-mono focus:outline-none focus:border-[#3b82f6]" />
              <button onClick={() => openTrade(pos.id, parseFloat(entryInput) || pos.buyZoneLow)}
                className="px-2.5 py-1 text-[10px] font-black uppercase bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded hover:bg-[#3b82f6]/20">▶ Open</button>
            </>
          )}
          {isOpen && (
            <>
              <input type="number" placeholder="Close $" value={closeInput} onChange={e => setCloseInput(e.target.value)}
                className="w-20 bg-[#141924] border border-[#1e2a3a] rounded px-2 py-1 text-white text-[10px] font-mono focus:outline-none focus:border-[#3b82f6]" />
              <button onClick={() => closeTrade(pos.id, parseFloat(closeInput) || (pos.currentPrice ?? pos.signalPrice))}
                className="px-2.5 py-1 text-[10px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20">■ Close</button>
            </>
          )}
          {!isClosed && (
            <button onClick={() => removeFromTracker(pos.id)} className="px-2 py-1 text-[10px] text-slate-500 border border-[#1e2a3a] rounded hover:text-red-400">✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SmartTrackerDashboard() {
  const { activeTracker, stats, store, openTracker, closeTracker, refreshPrices, loading } = useSmartTracker();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("My Smart Tracker");
  const [budget, setBudget] = useState(10000);
  const [filter, setFilter] = useState<"all" | "open" | "pending" | "closed">("all");
  const [view, setView] = useState<"card" | "list">("card");
  const refreshed = useRef(false);
  const [signalMap, setSignalMap] = useState<Record<string, HourlySignal>>({});

  useEffect(() => {
    if (!refreshed.current && activeTracker) { refreshed.current = true; refreshPrices(); }
  }, [activeTracker, refreshPrices]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/intraday_signals.json?v=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const map: Record<string, HourlySignal> = {};
        const priceOverrides: Record<string, number> = {};
        
        for (const s of json.signals ?? []) {
          map[s.ticker] = s;
          priceOverrides[s.ticker] = s.current_price;
        }
        setSignalMap(map);

        // Refresh prices from intraday signals to auto-update stats (live sync with hourly page)
        // This ensures the tracker stays in sync with the data shown on /hourly
        await refreshPrices(priceOverrides);
      } catch { /* no signals available */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [refreshPrices]);

  if (!activeTracker) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-5 py-16">
      <nav className="self-start flex items-center gap-2 text-sm text-[#3b82f6] mb-4">
        <Link href="/" className="hover:text-white">Home</Link><span className="text-slate-600">/</span><span className="text-white">Smart Tracker</span>
      </nav>
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3b82f6]/20 to-[#6366f1]/20 border border-[#3b82f6]/20 flex items-center justify-center text-4xl">🚀</div>
      <h1 className="text-3xl font-black text-white">Smart Tracker</h1>
      <p className="text-slate-400 text-center max-w-sm text-sm">Paper-trade your swing picks. Track PnL, sector allocation and stats — no real money.</p>
      <button onClick={() => setShowCreate(true)} className="px-8 py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-black text-sm rounded-xl uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-blue-500/20">
        🚀 Create Tracker
      </button>
      {store.archivedTrackers.length > 0 && (
        <div className="w-full max-w-lg mt-2">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Past Trackers</p>
          {store.archivedTrackers.map(c => (
            <div key={c.id} className="border border-[#1e2a3a] rounded-xl p-3 mb-2 flex justify-between items-center">
              <div><div className="text-white font-bold text-sm">{c.name}</div><div className="text-slate-500 text-[10px]">{c.positions.length} positions</div></div>
              <span className="text-slate-600 text-[9px] font-black uppercase border border-[#1e2a3a] px-2 py-1 rounded">Archived</span>
            </div>
          ))}
        </div>
      )}
      {showCreate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg mb-4">New Tracker</h3>
            <label className="text-[10px] text-[#3b82f6] font-black uppercase tracking-wider block mb-1">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-2.5 text-white text-sm mb-3 focus:outline-none focus:border-[#3b82f6]" />
            <label className="text-[10px] text-[#3b82f6] font-black uppercase tracking-wider block mb-1">Budget (USD)</label>
            <input type="number" value={budget} onChange={e => setBudget(+e.target.value)} className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-2.5 text-white font-mono text-sm mb-4 focus:outline-none focus:border-[#3b82f6]" />
            <button onClick={() => { openTracker(name, budget); setShowCreate(false); }} className="w-full py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-black text-sm rounded-xl uppercase tracking-widest hover:opacity-90">Create</button>
          </div>
        </div>
      )}
    </div>
  );

  const positions = activeTracker.positions;
  const filtered = filter === "all" ? positions : positions.filter(p => p.status === filter);
  const totalPnl = (stats?.totalUnrealizedPnl ?? 0) + (stats?.totalRealizedPnl ?? 0);
  const budgetUsed = stats?.totalInvested ?? 0;
  const budgetPct = Math.min((budgetUsed / activeTracker.totalBudgetUsd) * 100, 100);
  const sectorColors = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444","#06b6d4","#ec4899"];

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-[#3b82f6] mb-5">
        <Link href="/" className="hover:text-white">Home</Link><span className="text-slate-600">/</span><span className="text-white">Smart Tracker</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">🚀 {activeTracker.name}</h1>
          <p className="text-slate-500 text-xs mt-0.5">Paper Trade · Budget: <span className="text-white font-mono">${f(activeTracker.totalBudgetUsd, 0)}</span> · {activeTracker.updatedAt.split("T")[0]}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => refreshPrices()} disabled={loading} className="px-3 py-1.5 bg-[#141924] border border-[#1e2a3a] text-slate-300 text-xs font-bold rounded-lg hover:border-[#3b82f6]/40 disabled:opacity-50">
            {loading ? "⟳..." : "⟳ Refresh"}
          </button>
          <Link href="/swing-picks" className="px-3 py-1.5 bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-bold rounded-lg hover:bg-[#3b82f6]/20">+ Add Picks</Link>
          <button onClick={() => { if (confirm("Archive this tracker?")) closeTracker(); }} className="px-3 py-1.5 text-slate-500 border border-[#1e2a3a] text-xs font-bold rounded-lg hover:text-red-400 hover:border-red-500/30">Archive</button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total PnL" val={`${sgn(totalPnl)}$${f(Math.abs(totalPnl))}`} sub="Unrealized + Realized" color={pColor(totalPnl)} />
        <StatCard label="Unrealized" val={`${sgn(stats?.totalUnrealizedPnl??0)}$${f(Math.abs(stats?.totalUnrealizedPnl??0))}`} sub={`${sgn(stats?.totalUnrealizedPnlPct??0)}${f(Math.abs(stats?.totalUnrealizedPnlPct??0))}%`} color={pColor(stats?.totalUnrealizedPnl??0)} />
        <StatCard label="Realized" val={`${sgn(stats?.totalRealizedPnl??0)}$${f(Math.abs(stats?.totalRealizedPnl??0))}`} sub={`${stats?.closedCount??0} closed`} color={pColor(stats?.totalRealizedPnl??0)} />
        <StatCard label="Win Rate" val={`${f(stats?.winRate??0,1)}%`} sub={`${f(stats?.avgHoldingDays??0,0)}d avg hold`} color={(stats?.winRate??0)>=50?"text-emerald-400":"text-red-400"} />
      </div>

      {/* Budget bar */}
      <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-3 mb-5">
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-[#3b82f6] font-bold uppercase tracking-wider">Budget Used</span>
          <span className="text-white font-mono">${f(budgetUsed,0)} / ${f(activeTracker.totalBudgetUsd,0)} · {budgetPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-[#1e2a3a] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${budgetPct>90?"bg-red-500":budgetPct>70?"bg-amber-500":"bg-gradient-to-r from-[#3b82f6] to-[#6366f1]"}`} style={{width:`${budgetPct}%`}} />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-slate-600">
          <span>{stats?.openCount} open · {stats?.pendingCount} pending · {stats?.closedCount} closed</span>
          <span>Free: ${f(Math.max(0,activeTracker.totalBudgetUsd-budgetUsed),0)}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid md:grid-cols-3 gap-5">
        {/* Positions */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {(["all","open","pending","closed"] as const).map(f2=>(
              <button key={f2} onClick={()=>setFilter(f2)} className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${filter===f2?"bg-[#3b82f6] text-white border-[#3b82f6]":"text-slate-400 border-[#1e2a3a] hover:border-[#3b82f6]/40"}`}>
                {f2} ({f2==="all"?positions.length:positions.filter(p=>p.status===f2).length})
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 bg-[#0d1117] border border-[#1e2a3a] rounded-lg p-0.5">
              <button onClick={()=>setView("card")} className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${view==="card"?"bg-[#3b82f6] text-white":"text-slate-500 hover:text-white"}`}>Card</button>
              <button onClick={()=>setView("list")} className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${view==="list"?"bg-[#3b82f6] text-white":"text-slate-500 hover:text-white"}`}>List</button>
            </div>
          </div>

          {filtered.length===0 ? (
            <div className="border border-dashed border-[#1e2a3a] rounded-xl p-10 text-center">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-slate-500 text-sm">No positions. Go to <Link href="/swing-picks" className="text-[#3b82f6] hover:underline">Swing Picks</Link> and click <b className="text-white">Add Smart Tracker</b>.</p>
            </div>
          ) : view==="list" ? (
            <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 bg-[#141924] border-b border-[#1e2a3a]">
                <div className="w-16 text-[9px] font-black text-[#3b82f6] uppercase">Ticker</div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-center text-[9px] font-black text-[#3b82f6] uppercase">
                  <span>Entry</span><span>Target</span><span>Stop</span>
                </div>
                <div className="w-24 text-right text-[9px] font-black text-[#3b82f6] uppercase">PnL</div>
                <div className="w-24 text-[9px] font-black text-[#3b82f6] uppercase">Action</div>
              </div>
              {filtered.map(pos=><PositionCard key={pos.id} pos={pos} simple={true} signal={signalMap[pos.ticker]}/>)}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(pos=><PositionCard key={pos.id} pos={pos} simple={false} signal={signalMap[pos.ticker]}/>)}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-4">
            <h3 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-3">Sector Allocation</h3>
            {Object.entries(stats?.sectorDistribution??{}).length===0
              ? <p className="text-slate-600 text-xs">No open positions</p>
              : Object.entries(stats?.sectorDistribution??{}).sort(([,a],[,b])=>b-a).map(([s,amt],i)=>{
                  const tot=Object.values(stats?.sectorDistribution??{}).reduce((a,b)=>a+b,0);
                  const pct=tot>0?(amt/tot*100):0;
                  return (
                    <div key={s} className="mb-2">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-white font-semibold truncate">{s}</span>
                        <span className="text-slate-400 font-mono shrink-0 ml-2">${f(amt,0)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${pct}%`,background:sectorColors[i%sectorColors.length]}}/>
                      </div>
                    </div>
                  );
                })
            }
          </div>

          {stats?.bestPosition && (
            <div className="bg-[#0d1117] border border-emerald-500/20 rounded-xl p-3">
              <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">🏆 Best</div>
              <div className="flex justify-between items-center">
                <span className="text-white font-black text-base">{stats.bestPosition.ticker}</span>
                <span className={`text-sm font-mono font-black ${pColor(computePnl(stats.bestPosition).pnlUsd)}`}>
                  {sgn(computePnl(stats.bestPosition).pnlUsd)}${f(Math.abs(computePnl(stats.bestPosition).pnlUsd))}
                </span>
              </div>
            </div>
          )}

          {stats?.worstPosition && (
            <div className="bg-[#0d1117] border border-red-500/20 rounded-xl p-3">
              <div className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">📉 Worst</div>
              <div className="flex justify-between items-center">
                <span className="text-white font-black text-base">{stats.worstPosition.ticker}</span>
                <span className={`text-sm font-mono font-black ${pColor(computePnl(stats.worstPosition).pnlUsd)}`}>
                  {sgn(computePnl(stats.worstPosition).pnlUsd)}${f(Math.abs(computePnl(stats.worstPosition).pnlUsd))}
                </span>
              </div>
            </div>
          )}

          <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-xl p-4">
            <h3 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-3">Statistics</h3>
            {[
              ["Open", stats?.openCount??0],
              ["Pending", stats?.pendingCount??0],
              ["Closed", stats?.closedCount??0],
              ["Win Rate", `${f(stats?.winRate??0,1)}%`],
              ["Avg Hold", `${f(stats?.avgHoldingDays??0,1)}d`],
              ["Invested", `$${f(stats?.totalInvested??0,0)}`],
            ].map(([l,v])=>(
              <div key={String(l)} className="flex justify-between items-center py-1.5 border-b border-[#1e2a3a] last:border-0">
                <span className="text-slate-500 text-xs">{l}</span>
                <span className="text-white font-mono font-bold text-xs">{v}</span>
              </div>
            ))}
          </div>

          <Link href="/swing-picks" className="block w-full text-center py-2.5 bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-xs font-black uppercase tracking-widest rounded-xl hover:bg-[#3b82f6]/20 transition-all">
            📋 Today's Picks →
          </Link>
        </div>
      </div>
    </div>
  );
}
