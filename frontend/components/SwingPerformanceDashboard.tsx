"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Trade {
  date: string;
  ticker: string;
  company: string;
  sector: string;
  subsector: string;
  entry: number;
  current_price: number | null;
  max_price: number | null;
  return_pct: number | null;
  days: number | null;
  result: string;
  peak_date: string | null;
}

interface Props {
  initialHistory: Trade[];
  lastUpdated?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RESULT_COLORS: Record<string, string> = {
  WIN:     "text-[#22c55e] bg-[#22c55e]/10",
  LOSS:    "text-[#ef4444] bg-[#ef4444]/10",
  PENDING: "text-[#3b82f6] bg-[#3b82f6]/10",
  NO_DATA: "text-[#64748b] bg-transparent",
};

function fmt(n: number | null | undefined, dec = 2): string {
  if (n == null) return "—";
  return n.toFixed(dec);
}

function retColor(n: number | null | undefined): string {
  if (n == null) return "text-[#64748b]";
  return n > 0 ? "text-[#22c55e]" : n < 0 ? "text-[#ef4444]" : "text-[#94a3b8]";
}

function pnlFromReturn(ret: number | null): number | null {
  if (ret == null) return null;
  return parseFloat((1000 * ret / 100).toFixed(2));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SwingPerformanceDashboard({ initialHistory, lastUpdated }: Props) {
  const [selectedSector,    setSelectedSector]    = useState("All");
  const [selectedSubsector, setSelectedSubsector] = useState("All");
  const [selectedYear,      setSelectedYear]      = useState("All");
  const [selectedMonth,     setSelectedMonth]     = useState("All");
  const [selectedDate,      setSelectedDate]      = useState("");

  // Format last updated time
  const formatLastUpdated = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
        " " +
        date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return "—";
    }
  };

  // ── Derived filter options ─────────────────────────────────────────────────
  const sectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => {
      if (t.sector && t.sector !== "Unknown") s.add(t.sector);
    });
    return Array.from(s).sort();
  }, [initialHistory]);

  const subsectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => {
      if (
        t.subsector &&
        t.subsector.trim() !== "" &&
        t.subsector !== "Unknown" &&
        (selectedSector === "All" || t.sector === selectedSector)
      ) s.add(t.subsector);
    });
    return Array.from(s).sort();
  }, [initialHistory, selectedSector]);

  const years = useMemo(() => {
    const y = new Set<string>();
    initialHistory.forEach(t => { if (t.date) y.add(t.date.slice(0, 4)); });
    return Array.from(y).sort((a, b) => b.localeCompare(a));
  }, [initialHistory]);

  const months = useMemo(() => {
    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const m = new Set<string>();
    initialHistory.forEach(t => {
      if (t.date && (selectedYear === "All" || t.date.startsWith(selectedYear))) {
        m.add(t.date.slice(5, 7));
      }
    });
    return Array.from(m).sort().map(mm => ({
      value: mm,
      label: MONTH_NAMES[parseInt(mm) - 1] ?? mm,
    }));
  }, [initialHistory, selectedYear]);

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return initialHistory
      .filter(t => {
        if (selectedSector    !== "All" && t.sector    !== selectedSector)    return false;
        if (selectedSubsector !== "All" && t.subsector !== selectedSubsector) return false;
        if (selectedYear      !== "All" && !t.date.startsWith(selectedYear))  return false;
        if (selectedMonth     !== "All" && t.date.slice(5, 7) !== selectedMonth) return false;
        if (selectedDate && t.date !== selectedDate)                           return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [initialHistory, selectedSector, selectedSubsector, selectedYear, selectedMonth, selectedDate]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = filtered.length;
    const pending = filtered.filter(t => t.result === "PENDING").length;
    const wins    = filtered.filter(t => (t.return_pct ?? 0) > 0).length;
    const sumRet  = filtered.reduce((s, t) => s + (t.return_pct ?? 0), 0);
    const above5  = filtered.filter(t => (t.return_pct ?? 0) >= 5).length;
    const above10 = filtered.filter(t => (t.return_pct ?? 0) >= 10).length;
    return {
      totalSignals: total,
      pending,
      winRate:      total > 0 ? (wins / total * 100).toFixed(1) : "—",
      avgReturn:    total > 0 ? (sumRet / total).toFixed(1)      : "—",
      above5Rate:   total > 0 ? (above5  / total * 100).toFixed(1) : "—",
      above10Rate:  total > 0 ? (above10 / total * 100).toFixed(1) : "—",
    };
  }, [filtered]);

  // ── Sector heatmap ────────────────────────────────────────────────────────
  const heatmap = useMemo(() => {
    const map: Record<string, { total: number; sumRet: number }> = {};
    filtered.forEach(t => {
      if (!t.sector || t.sector === "Unknown") return;
      if (!map[t.sector]) map[t.sector] = { total: 0, sumRet: 0 };
      map[t.sector].total++;
      map[t.sector].sumRet += t.return_pct ?? 0;
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        total:     d.total,
        avgReturn: d.total > 0 ? (d.sumRet / d.total) : 0,
      }))
      .sort((a, b) => b.avgReturn - a.avgReturn);
  }, [filtered]);

  function heatColor(avg: number) {
    if (avg >= 15) return "bg-[#22c55e]/25 border-[#22c55e]/60";
    if (avg >= 8)  return "bg-[#22c55e]/15 border-[#22c55e]/40";
    if (avg > 0)   return "bg-[#22c55e]/10 border-[#22c55e]/30";
    if (avg < 0)   return "bg-[#ef4444]/20 border-[#ef4444]/50";
    return "bg-[#141924] border-[#1e2a3a]";
  }

  function resetFilters() {
    setSelectedSector("All");
    setSelectedSubsector("All");
    setSelectedYear("All");
    setSelectedMonth("All");
    setSelectedDate("");
  }

  const hasActiveFilter =
    selectedSector !== "All" || selectedSubsector !== "All" ||
    selectedYear !== "All" || selectedMonth !== "All" || selectedDate !== "";

  return (
    <>
      {/* ── Last Updated ────────────────────────────────────────────────── */}
      {lastUpdated && (
        <div className="mb-6 p-4 rounded-xl bg-[#1a2030] border border-[#1e2a3a]">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Prices Last Updated</p>
          <p className="text-sm font-mono text-white">{formatLastUpdated(lastUpdated)}</p>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <select
          value={selectedSector}
          onChange={e => { setSelectedSector(e.target.value); setSelectedSubsector("All"); }}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
        >
          <option value="All">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={selectedSubsector}
          onChange={e => setSelectedSubsector(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
        >
          <option value="All">All Subsectors</option>
          {subsectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={selectedYear}
          onChange={e => { setSelectedYear(e.target.value); setSelectedMonth("All"); }}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
        >
          <option value="All">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
        >
          <option value="All">All Months</option>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
          title="Filter by exact date"
        />

        {hasActiveFilter && (
          <button
            onClick={resetFilters}
            className="px-4 py-2.5 rounded-xl text-sm border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────────────── */}
      <div className="glass-card grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[#1e2a3a] mb-10 overflow-hidden">
        <div className="p-4 md:p-6 text-center">
          <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Total Signals</p>
          <p className="text-2xl md:text-3xl font-mono font-black text-white">{stats.totalSignals}</p>
          {stats.pending > 0 && (
            <p className="text-[9px] text-[#3b82f6] mt-1">{stats.pending} pending</p>
          )}
        </div>
        <div className="p-4 md:p-6 text-center">
          <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Win Rate (Max)</p>
          <p className="text-2xl md:text-3xl font-mono font-black text-[#22c55e]">
            {stats.winRate === "—" ? "—" : `${stats.winRate}%`}
          </p>
        </div>
        <div className="p-4 md:p-6 text-center">
          <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Avg Return (Max)</p>
          <p className={`text-2xl md:text-3xl font-mono font-black ${
            stats.avgReturn === "—" ? "text-white" :
            parseFloat(stats.avgReturn) >= 0 ? "text-white" : "text-[#ef4444]"
          }`}>
            {stats.avgReturn === "—" ? "—" : `${parseFloat(stats.avgReturn) >= 0 ? "+" : ""}${stats.avgReturn}%`}
          </p>
        </div>
        <div className="p-4 md:p-6 text-center">
          <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Picks &gt; 10% Return</p>
          <p className="text-2xl md:text-3xl font-mono font-black text-[#3b82f6]">
            {stats.above10Rate === "—" ? "—" : `${stats.above10Rate}%`}
          </p>
        </div>
      </div>

      {/* ── Sector Heatmap ───────────────────────────────────────────────── */}
      {heatmap.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-bold text-white mb-6">Sector Profitability Heatmap</h3>
          <div className="flex overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-3 lg:grid-cols-6 gap-4 no-scrollbar">
            {heatmap.map(s => (
              <button
                key={s.name}
                onClick={() => setSelectedSector(s.name === selectedSector ? "All" : s.name)}
                className={`rounded-xl border p-4 ${heatColor(s.avgReturn)} flex flex-col gap-2 transition-all hover:scale-105 shadow-xl text-left min-w-[160px] md:min-w-0 ${s.name === selectedSector ? "ring-2 ring-white" : ""}`}
              >
                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest truncate w-full" title={s.name}>{s.name}</p>
                <div className="flex items-end justify-between w-full">
                  <div>
                    <p className={`text-xl font-black font-mono ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
                    </p>
                    <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest mt-1">Avg Return</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white leading-none">{s.total}</p>
                    <p className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest mt-1">Picks</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Trade History ─────────────────────────────────────────────────── */}
      <div className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h3 className="text-xl font-bold text-white">Historical Trade Log</h3>
          <p className="text-xs text-[#94a3b8]">Showing {filtered.length} trades</p>
        </div>

        {/* ── Mobile Card View ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filtered.map((t, i) => {
            const resultCls = RESULT_COLORS[t.result] ?? "text-[#94a3b8]";
            const pnl = pnlFromReturn(t.return_pct);
            return (
              <div key={i} className="glass-card p-4 border-l-4 border-l-[#3b82f6]">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Link href={`/stock/${t.ticker}`} className="text-xl font-black text-[#3b82f6] hover:underline">
                      {t.ticker}
                    </Link>
                    <p className="text-[10px] text-[#64748b] mt-0.5">{t.date} · {t.sector}</p>
                    {t.subsector && t.subsector !== t.sector && (
                      <p className="text-[9px] text-[#475569]">{t.subsector}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${resultCls}`}>{t.result}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[#1e2a3a]/40 pt-3 text-sm">
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Entry</p>
                    <p className="font-mono font-bold text-white">${fmt(t.entry)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Peak</p>
                    <p className="font-mono text-white">{t.max_price != null ? `$${fmt(t.max_price)}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Days to Peak</p>
                    <p className="font-mono text-[#94a3b8]">{t.days != null ? `${t.days}d` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">PnL/$1000</p>
                    <p className={`font-mono font-black ${retColor(pnl)}`}>
                      {pnl != null ? `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(0)}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop Table View ───────────────────────────────────────────── */}
        <div className="hidden md:block glass-card overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-[#1a2030] border-b border-[#1e2a3a] text-[#64748b]">
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Symbol</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right text-[#22c55e]">Max Return</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Entry Price</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Peak Price</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Days to Peak</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right text-[#3b82f6]">PnL/$1000</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Sector</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Subsector</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Result</th>
                </tr>
              </thead>
              <tbody className="text-white font-mono divide-y divide-[#1e2a3a]">
                {filtered.map((t, i) => {
                  const resultCls = RESULT_COLORS[t.result] ?? "text-[#94a3b8]";
                  const pnl = pnlFromReturn(t.return_pct);
                  return (
                    <tr key={i} className="hover:bg-[#1a2030]/50 transition-colors">
                      <td className="px-4 py-3 text-[#94a3b8]">{t.date}</td>
                      <td className="px-4 py-3">
                        <Link href={`/stock/${t.ticker}`} className="font-bold text-[#3b82f6] hover:underline">
                          {t.ticker}
                        </Link>
                        {t.company && t.company !== t.ticker && (
                          <p className="text-[9px] text-[#475569] truncate max-w-[100px]">{t.company}</p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-black text-sm ${retColor(t.return_pct)}`}>
                        {t.return_pct != null
                          ? `${t.return_pct >= 0 ? "+" : ""}${fmt(t.return_pct, 2)}%`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">${fmt(t.entry)}</td>
                      <td className="px-4 py-3 text-right">
                        {t.max_price != null ? (
                          <span>
                            ${fmt(t.max_price)}
                            {t.peak_date && (
                              <span className="block text-[9px] text-[#475569]">{t.peak_date}</span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-[#94a3b8]">
                        {t.result === "PENDING"
                          ? <span className="text-[#3b82f6] font-bold text-[10px]">PENDING</span>
                          : t.days != null ? `${t.days}d` : "—"}
                      </td>
                      <td className={`px-4 py-3 text-right font-black text-sm ${retColor(pnl)}`}>
                        {pnl != null ? `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(0)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] text-[10px] uppercase">{t.sector || "—"}</td>
                      <td className="px-4 py-3 text-[#64748b] text-[10px] max-w-[140px]">
                        <span className="truncate block" title={t.subsector}>{t.subsector || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${resultCls}`}>
                          {t.result}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-[#64748b]">No trades found for selected filters.</div>
          )}
        </div>
      </div>
    </>
  );
}
