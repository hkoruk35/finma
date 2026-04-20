"use client";

import { useState, useMemo, useDeferredValue } from "react";
import Link from "next/link";

const PAGE_SIZE = 50; // İlk render'da kaç satır gösterilsin

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
  const [searchTicker,      setSearchTicker]      = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Trade; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [visibleCount,      setVisibleCount]      = useState(PAGE_SIZE); // Virtualization

  // Filtreler defer edilir — typing sırasında ana iş parçacığını bloke etmez
  const deferredSector    = useDeferredValue(selectedSector);
  const deferredSubsector = useDeferredValue(selectedSubsector);
  const deferredYear      = useDeferredValue(selectedYear);
  const deferredMonth     = useDeferredValue(selectedMonth);
  const deferredDate      = useDeferredValue(selectedDate);
  const deferredTicker    = useDeferredValue(searchTicker);

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

  // ── Filtered and Sorted data — defer kullanır, typing sırasında UI donmaz ──
  const filtered = useMemo(() => {
    let data = initialHistory.filter(t => {
      if (deferredSector    !== "All" && t.sector    !== deferredSector)    return false;
      if (deferredSubsector !== "All" && t.subsector !== deferredSubsector) return false;
      if (deferredYear      !== "All" && !t.date.startsWith(deferredYear))  return false;
      if (deferredMonth     !== "All" && t.date.slice(5, 7) !== deferredMonth) return false;
      if (deferredDate && t.date !== deferredDate)                           return false;
      if (deferredTicker && !t.ticker.toLowerCase().includes(deferredTicker.toLowerCase())) return false;
      return true;
    });

    if (sortConfig) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      data.sort((a, b) => b.date.localeCompare(a.date));
    }
    return data;
  }, [initialHistory, deferredSector, deferredSubsector, deferredYear, deferredMonth, deferredDate, deferredTicker, sortConfig]);

  // Filtre değişince sayfalamayı sıfırla
  const resetPagination = () => setVisibleCount(PAGE_SIZE);

  // Sayfada gösterilen trades (ilk 50, "Daha Fazla" ile artar)
  const visibleTrades = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

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
    resetPagination();
  }

  const hasActiveFilter =
    selectedSector !== "All" || selectedSubsector !== "All" ||
    selectedYear !== "All" || selectedMonth !== "All" || selectedDate !== "" || searchTicker !== "";

  const handleSort = (key: keyof Trade) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: keyof Trade }) => {
    if (sortConfig?.key !== column) return <span className="ml-1 opacity-20">⇅</span>;
    return <span className="ml-1 text-[#3b82f6] font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── Export Functions ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ["Date", "Ticker", "Company", "Sector", "Subsector", "Entry Price", "Peak Price", "Return %", "Days to Peak", "Result"];
    const csvRows = [headers.join(",")];
    
    filtered.forEach(t => {
      const row = [
        t.date,
        t.ticker,
        `"${(t.company || "").replace(/"/g, '""')}"`,
        `"${(t.sector || "").replace(/"/g, '""')}"`,
        `"${(t.subsector || "").replace(/"/g, '""')}"`,
        t.entry,
        t.max_price || 0,
        t.return_pct || 0,
        t.days || 0,
        t.result
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `finma_historical_trades_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    let tableHtml = `
      <table border="1">
        <thead>
          <tr style="background-color: #f3f4f6; font-weight: bold;">
            <th>Date</th>
            <th>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <th>Subsector</th>
            <th>Entry Price</th>
            <th>Peak Price</th>
            <th>Return %</th>
            <th>Days to Peak</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
    `;

    filtered.forEach(t => {
      tableHtml += `
        <tr>
          <td>${t.date}</td>
          <td>${t.ticker}</td>
          <td>${t.company || ""}</td>
          <td>${t.sector || ""}</td>
          <td>${t.subsector || ""}</td>
          <td>${t.entry}</td>
          <td>${t.max_price || 0}</td>
          <td>${t.return_pct || 0}</td>
          <td>${t.days || 0}</td>
          <td>${t.result}</td>
        </tr>
      `;
    });

    tableHtml += "</tbody></table>";

    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `finma_historical_trades_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        <div className="relative">
          <input
            type="text"
            placeholder="Search Ticker..."
            value={searchTicker}
            onChange={e => setSearchTicker(e.target.value)}
            className="bg-[#1a2030] border border-[#1e2a3a] text-white pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6] w-full md:w-40"
          />
          <svg className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>

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
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h3 className="text-xl font-bold text-white">Historical Trade Log</h3>
            <p className="text-xs text-[#94a3b8]">Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} trades</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e2a3a] text-[#94a3b8] border border-[#2d3a4b] hover:border-[#3b82f6] hover:text-white transition-all flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e2a3a] text-[#94a3b8] border border-[#2d3a4b] hover:border-[#22c55e] hover:text-white transition-all flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Excel (XLS)
            </button>
          </div>
        </div>

        {/* ── Mobile Card View ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {visibleTrades.map((t, i) => {
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
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[#1e2a3a] scrollbar-track-transparent">
            <table className="w-full min-w-[1100px] text-left text-xs whitespace-nowrap table-fixed">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[150px]" />
                <col className="w-[150px]" />
                <col className="w-[80px]" />
              </colgroup>
              <thead>
                <tr className="bg-[#1a2030] border-b border-[#1e2a3a] text-[#64748b]">
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('date')}>Date <SortIcon column="date" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('ticker')}>Symbol <SortIcon column="ticker" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right text-[#22c55e] cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('return_pct')}>Max Return <SortIcon column="return_pct" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('entry')}>Entry Price <SortIcon column="entry" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('max_price')}>Peak Price <SortIcon column="max_price" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('days')}>Days <SortIcon column="days" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right text-[#3b82f6] cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('return_pct')}>PnL/$1000 <SortIcon column="return_pct" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('sector')}>Sector <SortIcon column="sector" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('subsector')}>Subsector <SortIcon column="subsector" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-[#1e2a3a] transition-colors" onClick={() => handleSort('result')}>Result <SortIcon column="result" /></th>
                </tr>
              </thead>
              <tbody className="text-white font-mono divide-y divide-[#1e2a3a]">
                {visibleTrades.map((t, i) => {
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
                          <p className="text-[9px] text-[#475569] truncate">{t.company}</p>
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
                      <td className="px-4 py-3 text-[#64748b] text-[10px]">
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

        {/* ── Load More ───────────────────────────────────────────────────── */}
        {visibleCount < filtered.length && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-8 py-3 rounded-xl bg-[#1e2a3a] border border-[#2d3a4b] text-sm font-bold text-[#94a3b8] hover:border-[#3b82f6] hover:text-white transition-all"
            >
              Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              <span className="ml-2 text-[#64748b]">({filtered.length - visibleCount} remaining)</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
