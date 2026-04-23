"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSmartCart } from "@/components/SmartCartContext";
import { CartPosition, SizeUnit, computePnl } from "@/lib/smartCart";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function pctColor(v: number) {
  return v > 0 ? "text-[#10b981]" : v < 0 ? "text-[#ef4444]" : "text-[#00d2ff]";
}
function sign(v: number) {
  return v > 0 ? "+" : "";
}

// ─── Mini Stat Card ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "text-white" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#141924] border border-[#1e2a3a] rounded-xl p-4 flex flex-col gap-1">
      <span className="text-[10px] font-black text-[#00d2ff] uppercase tracking-widest">{label}</span>
      <span className={`text-xl font-black font-mono ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-[#00d2ff]">{sub}</span>}
    </div>
  );
}

// ─── Sector Donut (pure CSS) ─────────────────────────────────────────────────
function SectorBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="text-[#00d2ff] text-xs">No open positions</div>;

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899"];
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-2">
      {entries.map(([sector, amount], i) => {
        const pct = (amount / total) * 100;
        return (
          <div key={sector}>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white font-bold truncate">{sector}</span>
              <span className="text-[#00d2ff] font-mono">${fmt(amount, 0)} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: colors[i % colors.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Position Row ─────────────────────────────────────────────────────────────
function PositionRow({ pos }: { pos: CartPosition }) {
  const { openTrade, closeTrade, removeFromCart, updateSize } = useSmartCart();
  const [editMode, setEditMode] = useState(false);
  const [closePriceInput, setClosePriceInput] = useState("");
  const [entryPriceInput, setEntryPriceInput] = useState("");
  const [sizeVal, setSizeVal] = useState(pos.sizeValue);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>(pos.sizeUnit);

  const pnl = computePnl(pos, pos.currentPrice);
  const isClosed = pos.status === "closed";
  const isOpen = pos.status === "open";
  const isPending = pos.status === "pending";

  const pnlUsd = isClosed ? (pos.realizedPnlUsd ?? 0) : pnl.pnlUsd;
  const pnlPct = isClosed ? (pos.realizedPnlPct ?? 0) : pnl.pnlPct;

  const statusBadge = {
    open: "bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30",
    closed: "bg-[#475569]/20 text-[#94a3b8] border-[#475569]/30",
    pending: "bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30",
  }[pos.status];

  return (
    <div className={`border border-[#1e2a3a] rounded-xl p-4 ${isClosed ? "opacity-60" : "bg-[#0d1117]/50"} transition-all`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* Left: ticker info */}
        <div className="flex items-start gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Link href={`/stock/${pos.ticker}`} className="text-white font-black text-lg tracking-tighter hover:text-[#3b82f6] transition-colors">
                {pos.ticker}
              </Link>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${statusBadge}`}>
                {pos.status}
              </span>
            </div>
            <div className="text-[#00d2ff] text-[10px] font-bold truncate max-w-[160px]">{pos.company}</div>
            <div className="text-[#475569] text-[10px] mt-0.5">{pos.sector} · Added {pos.addedDate}</div>
          </div>
        </div>

        {/* Right: PnL */}
        <div className="text-right">
          <div className={`text-xl font-black font-mono ${pctColor(pnlUsd)}`}>
            {sign(pnlUsd)}${fmt(Math.abs(pnlUsd))}
          </div>
          <div className={`text-sm font-mono font-bold ${pctColor(pnlPct)}`}>
            {sign(pnlPct)}{fmt(Math.abs(pnlPct))}%
          </div>
          {isOpen && pos.currentPrice && (
            <div className="text-[10px] text-[#00d2ff] mt-0.5">@ ${fmt(pos.currentPrice)}</div>
          )}
        </div>
      </div>

      {/* Price levels */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center bg-[#141924] rounded-lg p-2">
        <div>
          <div className="text-[8px] text-[#3b82f6] font-black uppercase">Entry</div>
          <div className="text-white text-[11px] font-mono font-bold">${fmt(pos.entryPrice ?? pos.buyZoneLow)}</div>
        </div>
        <div>
          <div className="text-[8px] text-[#10b981] font-black uppercase">Target</div>
          <div className="text-[#10b981] text-[11px] font-mono font-bold">${fmt(pos.profitZoneHigh)}</div>
        </div>
        <div>
          <div className="text-[8px] text-[#ef4444] font-black uppercase">Stop</div>
          <div className="text-[#ef4444] text-[11px] font-mono font-bold">${fmt(pos.stopZoneLow)}</div>
        </div>
      </div>

      {/* Size & actions */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-[#00d2ff]">
          Size: <span className="text-white font-mono font-bold">
            {pos.sizeUnit === "usd" ? `$${fmt(pos.sizeValue, 0)}` : `${pos.sizeValue} shares`}
          </span>
          {pos.sizeUnit === "usd" && pos.entryPrice && (
            <span className="text-[#475569] ml-1">≈{fmt(pos.sizeValue / pos.entryPrice, 1)} sh</span>
          )}
        </div>

        <div className="flex gap-1.5">
          {isPending && (
            <button
              onClick={() => {
                const price = parseFloat(entryPriceInput) || pos.buyZoneLow;
                openTrade(pos.id, price);
              }}
              className="px-2.5 py-1 text-[10px] font-black uppercase bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-lg hover:bg-[#3b82f6]/20 transition-all"
            >
              ▶ Open Trade
            </button>
          )}
          {isOpen && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Close $"
                value={closePriceInput}
                onChange={e => setClosePriceInput(e.target.value)}
                className="w-20 bg-[#141924] border border-[#1e2a3a] rounded-lg px-2 py-1 text-white text-[10px] font-mono focus:outline-none focus:border-[#3b82f6]"
              />
              <button
                onClick={() => {
                  const price = parseFloat(closePriceInput) || (pos.currentPrice ?? pos.signalPrice);
                  closeTrade(pos.id, price);
                }}
                className="px-2.5 py-1 text-[10px] font-black uppercase bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded-lg hover:bg-[#ef4444]/20 transition-all"
              >
                ■ Close
              </button>
            </div>
          )}
          {!isClosed && (
            <button
              onClick={() => removeFromCart(pos.id)}
              className="px-2.5 py-1 text-[10px] font-black uppercase bg-transparent text-[#475569] border border-[#1e2a3a] rounded-lg hover:text-[#ef4444] hover:border-[#ef4444]/30 transition-all"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Pending: entry price input */}
      {isPending && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            placeholder={`Entry price (default: $${fmt(pos.buyZoneLow)})`}
            value={entryPriceInput}
            onChange={e => setEntryPriceInput(e.target.value)}
            className="flex-1 bg-[#141924] border border-[#1e2a3a] rounded-lg px-3 py-1.5 text-white text-[10px] font-mono focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function SmartCartDashboard() {
  const { activeCart, stats, store, openBasket, closeBasket, refreshPrices, loading } = useSmartCart();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [basketName, setBasketName] = useState("My Smart Cart");
  const [budget, setBudget] = useState(10000);
  const [filter, setFilter] = useState<"all" | "open" | "closed" | "pending">("all");
  const refreshed = useRef(false);

  useEffect(() => {
    if (!refreshed.current && activeCart) {
      refreshed.current = true;
      refreshPrices();
    }
  }, [activeCart, refreshPrices]);

  const positions = activeCart?.positions ?? [];
  const filtered = filter === "all" ? positions : positions.filter(p => p.status === filter);

  // ── No active cart ──────────────────────────────────────────────────────────
  if (!activeCart) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 py-20">
        {/* breadcrumb */}
        <nav className="absolute top-[6rem] left-4 flex items-center gap-2 text-sm text-[#00d2ff]">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">Smart Cart</span>
        </nav>

        {/* Hero icon */}
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#3b82f6]/20 to-[#6366f1]/20 border border-[#3b82f6]/20 flex items-center justify-center text-4xl shadow-2xl shadow-blue-500/10">
          🛒
        </div>
        <h1 className="text-3xl font-black text-white tracking-tighter text-center">Smart Cart</h1>
        <p className="text-[#00d2ff] text-center max-w-md text-sm leading-relaxed">
          Paper-trade your daily swing picks. Track PnL, sector allocation, and performance statistics — no real money involved.
        </p>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-8 py-4 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-black text-sm rounded-2xl uppercase tracking-widest hover:from-[#2563eb] hover:to-[#5b21b6] transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
        >
          🚀 Create New Basket
        </button>

        {/* Archived carts */}
        {store.archivedCarts.length > 0 && (
          <div className="w-full max-w-xl mt-4">
            <h3 className="text-xs font-black text-[#00d2ff] uppercase tracking-widest mb-3">Past Baskets</h3>
            {store.archivedCarts.map(c => (
              <div key={c.id} className="border border-[#1e2a3a] rounded-xl p-4 mb-2 bg-[#0d1117]/50 flex justify-between items-center">
                <div>
                  <div className="text-white font-bold text-sm">{c.name}</div>
                  <div className="text-[#00d2ff] text-[10px]">{c.positions.length} positions · Created {c.createdAt.split("T")[0]}</div>
                </div>
                <span className="text-[#475569] text-[10px] font-black uppercase px-2 py-1 border border-[#1e2a3a] rounded-lg">Archived</span>
              </div>
            ))}
          </div>
        )}

        {/* Create modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
            <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-black text-lg mb-4">New Basket</h3>
              <label className="text-[10px] text-[#00d2ff] font-black uppercase tracking-wider block mb-1.5">Basket Name</label>
              <input type="text" value={basketName} onChange={e => setBasketName(e.target.value)}
                className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white text-sm mb-4 focus:outline-none focus:border-[#3b82f6]" />
              <label className="text-[10px] text-[#00d2ff] font-black uppercase tracking-wider block mb-1.5">Total Budget (USD)</label>
              <input type="number" value={budget} min={100} step={500} onChange={e => setBudget(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#141924] border border-[#1e2a3a] rounded-xl px-4 py-3 text-white font-mono text-sm mb-5 focus:outline-none focus:border-[#3b82f6]" />
              <button
                onClick={() => { openBasket(basketName, budget); setShowCreateModal(false); }}
                className="w-full py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-black text-sm rounded-xl uppercase tracking-widest hover:opacity-90 transition-all"
              >
                Create Basket
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Active cart ─────────────────────────────────────────────────────────────
  const totalPnl = (stats?.totalUnrealizedPnl ?? 0) + (stats?.totalRealizedPnl ?? 0);
  const budgetUsed = stats?.totalInvested ?? 0;
  const budgetPct = activeCart.totalBudgetUsd > 0 ? (budgetUsed / activeCart.totalBudgetUsd) * 100 : 0;

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span>/</span>
        <span className="text-white">Smart Cart</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter flex items-center gap-3">
            🛒 {activeCart.name}
          </h1>
          <p className="text-[#00d2ff] text-sm mt-1">
            Paper Trade Basket · Budget: <span className="text-white font-mono font-bold">${fmt(activeCart.totalBudgetUsd, 0)}</span>
            <span className="text-[#475569] ml-2">· Updated {activeCart.updatedAt.split("T")[0]}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshPrices}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#141924] border border-[#1e2a3a] text-[#00d2ff] text-xs font-black uppercase tracking-wider rounded-xl hover:border-[#3b82f6]/40 transition-all disabled:opacity-50"
          >
            {loading ? "⟳ Updating..." : "⟳ Refresh Prices"}
          </button>
          <Link href="/swing-picks" className="flex items-center gap-1.5 px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#3b82f6] text-xs font-black uppercase tracking-wider rounded-xl hover:bg-[#3b82f6]/20 transition-all">
            + Add Picks
          </Link>
          <button
            onClick={() => { if (confirm("Archive this basket and start fresh?")) closeBasket(); }}
            className="px-4 py-2 bg-transparent text-[#475569] border border-[#1e2a3a] text-xs font-black uppercase tracking-wider rounded-xl hover:text-[#ef4444] hover:border-[#ef4444]/30 transition-all"
          >
            Archive
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Total PnL"
          value={`${sign(totalPnl)}$${fmt(Math.abs(totalPnl))}`}
          sub={`Unrealized + Realized`}
          color={pctColor(totalPnl)}
        />
        <StatCard
          label="Unrealized PnL"
          value={`${sign(stats?.totalUnrealizedPnl ?? 0)}$${fmt(Math.abs(stats?.totalUnrealizedPnl ?? 0))}`}
          sub={`${sign(stats?.totalUnrealizedPnlPct ?? 0)}${fmt(Math.abs(stats?.totalUnrealizedPnlPct ?? 0))}%`}
          color={pctColor(stats?.totalUnrealizedPnl ?? 0)}
        />
        <StatCard
          label="Realized PnL"
          value={`${sign(stats?.totalRealizedPnl ?? 0)}$${fmt(Math.abs(stats?.totalRealizedPnl ?? 0))}`}
          sub={`${stats?.closedCount ?? 0} closed trades`}
          color={pctColor(stats?.totalRealizedPnl ?? 0)}
        />
        <StatCard
          label="Win Rate"
          value={`${fmt(stats?.winRate ?? 0, 1)}%`}
          sub={`${stats?.closedCount ?? 0} closed · ${fmt(stats?.avgHoldingDays ?? 0, 0)}d avg hold`}
          color={stats && stats.winRate >= 50 ? "text-[#10b981]" : "text-[#ef4444]"}
        />
      </div>

      {/* Budget usage bar */}
      <div className="bg-[#141924] border border-[#1e2a3a] rounded-xl p-4 mb-8">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-[#00d2ff] font-black uppercase tracking-wider">Budget Allocation</span>
          <span className="text-white font-mono font-bold">${fmt(budgetUsed, 0)} / ${fmt(activeCart.totalBudgetUsd, 0)} ({budgetPct.toFixed(0)}%)</span>
        </div>
        <div className="h-3 bg-[#1e2a3a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${budgetPct > 90 ? "bg-[#ef4444]" : budgetPct > 70 ? "bg-[#f59e0b]" : "bg-gradient-to-r from-[#3b82f6] to-[#6366f1]"}`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[#475569]">
          <span>Open: {stats?.openCount} · Pending: {stats?.pendingCount}</span>
          <span>Available: ${fmt(Math.max(0, activeCart.totalBudgetUsd - budgetUsed), 0)}</span>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Positions (2/3 width) */}
        <div className="md:col-span-2">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["all", "open", "pending", "closed"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                  filter === f
                    ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                    : "text-[#00d2ff] border-[#1e2a3a] hover:border-[#3b82f6]/40"
                }`}
              >
                {f} ({f === "all" ? positions.length : positions.filter(p => p.status === f).length})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="border border-dashed border-[#1e2a3a] rounded-xl p-10 text-center">
              <div className="text-3xl mb-3">📭</div>
              <p className="text-[#00d2ff] text-sm">No positions yet. Go to <Link href="/swing-picks" className="text-[#3b82f6] hover:underline">Swing Picks</Link> and click <b className="text-white">Add Smart Cart</b>.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(pos => <PositionRow key={pos.id} pos={pos} />)}
            </div>
          )}
        </div>

        {/* Sidebar stats (1/3 width) */}
        <div className="space-y-4">
          {/* Sector distribution */}
          <div className="bg-[#141924] border border-[#1e2a3a] rounded-xl p-4">
            <h3 className="text-[10px] font-black text-[#00d2ff] uppercase tracking-widest mb-4">Sector Allocation</h3>
            <SectorBar distribution={stats?.sectorDistribution ?? {}} />
          </div>

          {/* Best / Worst */}
          {stats?.bestPosition && (
            <div className="bg-[#141924] border border-[#10b981]/20 rounded-xl p-4">
              <h3 className="text-[10px] font-black text-[#10b981] uppercase tracking-widest mb-2">🏆 Best Position</h3>
              <div className="text-white font-black text-lg">{stats.bestPosition.ticker}</div>
              <div className={`text-sm font-mono font-bold ${pctColor(computePnl(stats.bestPosition).pnlUsd)}`}>
                {sign(computePnl(stats.bestPosition).pnlUsd)}${fmt(Math.abs(computePnl(stats.bestPosition).pnlUsd))}
              </div>
            </div>
          )}
          {stats?.worstPosition && (
            <div className="bg-[#141924] border border-[#ef4444]/20 rounded-xl p-4">
              <h3 className="text-[10px] font-black text-[#ef4444] uppercase tracking-widest mb-2">📉 Worst Position</h3>
              <div className="text-white font-black text-lg">{stats.worstPosition.ticker}</div>
              <div className={`text-sm font-mono font-bold ${pctColor(computePnl(stats.worstPosition).pnlUsd)}`}>
                {sign(computePnl(stats.worstPosition).pnlUsd)}${fmt(Math.abs(computePnl(stats.worstPosition).pnlUsd))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="bg-[#141924] border border-[#1e2a3a] rounded-xl p-4 space-y-2">
            <h3 className="text-[10px] font-black text-[#00d2ff] uppercase tracking-widest mb-3">Statistics</h3>
            {[
              { label: "Open Trades", value: String(stats?.openCount ?? 0) },
              { label: "Pending", value: String(stats?.pendingCount ?? 0) },
              { label: "Closed", value: String(stats?.closedCount ?? 0) },
              { label: "Win Rate", value: `${fmt(stats?.winRate ?? 0, 1)}%` },
              { label: "Avg Hold Days", value: `${fmt(stats?.avgHoldingDays ?? 0, 1)}d` },
              { label: "Total Invested", value: `$${fmt(stats?.totalInvested ?? 0, 0)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-[#00d2ff] text-[11px]">{label}</span>
                <span className="text-white font-mono font-bold text-[11px]">{value}</span>
              </div>
            ))}
          </div>

          {/* Swing Picks link */}
          <Link
            href="/swing-picks"
            className="block w-full text-center py-3 bg-gradient-to-r from-[#3b82f6]/10 to-[#6366f1]/10 border border-[#3b82f6]/20 text-[#3b82f6] text-xs font-black uppercase tracking-widest rounded-xl hover:from-[#3b82f6]/20 hover:to-[#6366f1]/20 transition-all"
          >
            📋 View Today's Picks →
          </Link>
        </div>
      </div>
    </div>
  );
}
