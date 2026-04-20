"use client";

import { useState, useMemo, useDeferredValue, useRef } from "react";
import Link from "next/link";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const PAGE_SIZE = 50;
const SL_PCT = -3.5; // Stop-loss threshold

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

// %3.5 SL uygular — kayıpları -3.5 ile sınırlar
function effectiveReturn(t: Trade): number | null {
  if (t.return_pct == null) return null;
  return t.return_pct < SL_PCT ? SL_PCT : t.return_pct;
}

function effectiveResult(t: Trade): string {
  if (t.result === "PENDING") return "PENDING";
  const r = effectiveReturn(t);
  if (r == null) return t.result;
  if (r > 0) return "WIN";
  if (r <= SL_PCT) return "LOSS";
  return t.result;
}

function slTriggered(t: Trade): boolean {
  return t.return_pct != null && t.return_pct < SL_PCT;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SwingPerformanceDashboard({ initialHistory, lastUpdated }: Props) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [selectedSector,    setSelectedSector]    = useState("All");
  const [selectedSubsector, setSelectedSubsector] = useState("All");
  const [selectedYear,      setSelectedYear]      = useState("All");
  const [selectedMonth,     setSelectedMonth]     = useState("All");
  const [selectedDate,      setSelectedDate]      = useState("");
  const [searchTicker,      setSearchTicker]      = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof Trade; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pdfExporting, setPdfExporting] = useState(false);

  const deferredSector    = useDeferredValue(selectedSector);
  const deferredSubsector = useDeferredValue(selectedSubsector);
  const deferredYear      = useDeferredValue(selectedYear);
  const deferredMonth     = useDeferredValue(selectedMonth);
  const deferredDate      = useDeferredValue(selectedDate);
  const deferredTicker    = useDeferredValue(searchTicker);

  const formatLastUpdated = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
        " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return "—"; }
  };

  // ── Derived filter options ─────────────────────────────────────────────────
  const sectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => { if (t.sector && t.sector !== "Unknown") s.add(t.sector); });
    return Array.from(s).sort();
  }, [initialHistory]);

  const subsectors = useMemo(() => {
    const s = new Set<string>();
    initialHistory.forEach(t => {
      if (t.subsector && t.subsector.trim() !== "" && t.subsector !== "Unknown" &&
        (selectedSector === "All" || t.sector === selectedSector)) s.add(t.subsector);
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
      if (t.date && (selectedYear === "All" || t.date.startsWith(selectedYear))) m.add(t.date.slice(5, 7));
    });
    return Array.from(m).sort().map(mm => ({ value: mm, label: MONTH_NAMES[parseInt(mm) - 1] ?? mm }));
  }, [initialHistory, selectedYear]);

  // ── Filtered + Sorted ──────────────────────────────────────────────────────
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

  const resetPagination = () => setVisibleCount(PAGE_SIZE);
  const visibleTrades = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // ── Stats (SL uygulanmış) ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total    = filtered.length;
    const pending  = filtered.filter(t => t.result === "PENDING").length;
    const completed = filtered.filter(t => t.result !== "PENDING");
    const wins     = completed.filter(t => (effectiveReturn(t) ?? 0) > 0).length;
    const losses   = completed.filter(t => (effectiveReturn(t) ?? 0) <= SL_PCT).length;
    const slHits   = filtered.filter(slTriggered).length;
    const sumRet   = completed.reduce((s, t) => s + (effectiveReturn(t) ?? 0), 0);
    const above5   = completed.filter(t => (effectiveReturn(t) ?? 0) >= 5).length;
    const above10  = completed.filter(t => (effectiveReturn(t) ?? 0) >= 10).length;
    const above15  = completed.filter(t => (effectiveReturn(t) ?? 0) >= 15).length;
    const completedCount = completed.length;

    // Tamamlanmış işlemlerin ortalama gün
    const completedWithDays = completed.filter(t => t.days != null && t.days > 0 && (effectiveReturn(t) ?? 0) > 0);
    const avgDays = completedWithDays.length > 0
      ? completedWithDays.reduce((s, t) => s + (t.days ?? 0), 0) / completedWithDays.length
      : null;

    return {
      totalSignals: total,
      pending,
      completedCount,
      wins,
      losses,
      slHits,
      winRate:     completedCount > 0 ? (wins / completedCount * 100).toFixed(1) : "—",
      avgReturn:   completedCount > 0 ? (sumRet / completedCount).toFixed(1)     : "—",
      above5Rate:  completedCount > 0 ? (above5  / completedCount * 100).toFixed(1) : "—",
      above10Rate: completedCount > 0 ? (above10 / completedCount * 100).toFixed(1) : "—",
      above15Rate: completedCount > 0 ? (above15 / completedCount * 100).toFixed(1) : "—",
      avgDays:     avgDays != null ? avgDays.toFixed(1) : "—",
      avgPnl:      completedCount > 0 ? (sumRet / completedCount * 10).toFixed(0) : "—",
    };
  }, [filtered]);

  // ── Days-to-Profit Distribution ───────────────────────────────────────────
  const daysDistribution = useMemo(() => {
    const buckets = [
      { label: "1-5d",  min: 1,  max: 5  },
      { label: "6-10d", min: 6,  max: 10 },
      { label: "11-20d",min: 11, max: 20 },
      { label: "21-30d",min: 21, max: 30 },
      { label: "31-60d",min: 31, max: 60 },
      { label: "60d+",  min: 61, max: Infinity },
    ];

    return buckets.map(b => {
      const trades = filtered.filter(t =>
        t.result !== "PENDING" &&
        t.days != null && t.days >= b.min && t.days <= b.max &&
        (effectiveReturn(t) ?? 0) > 0
      );
      const sumRet = trades.reduce((s, t) => s + (effectiveReturn(t) ?? 0), 0);
      const avgRet = trades.length > 0 ? sumRet / trades.length : 0;
      return { ...b, count: trades.length, avgRet: parseFloat(avgRet.toFixed(1)) };
    });
  }, [filtered]);

  // ── Profit Target Breakdown ───────────────────────────────────────────────
  const profitTargets = useMemo(() => {
    const completed = filtered.filter(t => t.result !== "PENDING" && t.days != null);
    const targets = [3, 5, 7, 10, 15, 20];
    return targets.map(pct => {
      const reached = completed.filter(t => (effectiveReturn(t) ?? 0) >= pct);
      const avgD = reached.length > 0
        ? reached.reduce((s, t) => s + (t.days ?? 0), 0) / reached.length
        : null;
      return {
        pct,
        count: reached.length,
        rate: completed.length > 0 ? (reached.length / completed.length * 100).toFixed(1) : "0",
        avgDays: avgD != null ? avgD.toFixed(1) : "—",
      };
    });
  }, [filtered]);

  // ── Sector heatmap ────────────────────────────────────────────────────────
  const heatmap = useMemo(() => {
    const map: Record<string, { total: number; sumRet: number }> = {};
    filtered.forEach(t => {
      if (!t.sector || t.sector === "Unknown") return;
      if (!map[t.sector]) map[t.sector] = { total: 0, sumRet: 0 };
      map[t.sector].total++;
      map[t.sector].sumRet += effectiveReturn(t) ?? 0;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, total: d.total, avgReturn: d.total > 0 ? (d.sumRet / d.total) : 0 }))
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
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: keyof Trade }) => {
    if (sortConfig?.key !== column) return <span className="ml-1 opacity-20">⇅</span>;
    return <span className="ml-1 text-[#3b82f6] font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const maxDaysBucket = Math.max(...daysDistribution.map(b => b.avgRet), 1);

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ["Date","Ticker","Company","Sector","Subsector","Entry Price","Peak Price","Return % (w/ SL)","SL Triggered","Days to Peak","Result (w/ SL)"];
    const csvRows = [headers.join(",")];
    filtered.forEach(t => {
      const row = [
        t.date, t.ticker,
        `"${(t.company || "").replace(/"/g, '""')}"`,
        `"${(t.sector || "").replace(/"/g, '""')}"`,
        `"${(t.subsector || "").replace(/"/g, '""')}"`,
        t.entry, t.max_price || 0,
        effectiveReturn(t) ?? 0,
        slTriggered(t) ? "YES" : "NO",
        t.days || 0,
        effectiveResult(t)
      ];
      csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `finma_swing_trades_SL3.5pct_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    let tableHtml = `<table border="1"><thead><tr style="background-color:#f3f4f6;font-weight:bold;">
      <th>Date</th><th>Ticker</th><th>Company</th><th>Sector</th><th>Subsector</th>
      <th>Entry Price</th><th>Peak Price</th><th>Return % (SL -3.5%)</th><th>SL Hit</th><th>Days to Peak</th><th>Result</th>
    </tr></thead><tbody>`;
    filtered.forEach(t => {
      tableHtml += `<tr>
        <td>${t.date}</td><td>${t.ticker}</td><td>${t.company||""}</td>
        <td>${t.sector||""}</td><td>${t.subsector||""}</td>
        <td>${t.entry}</td><td>${t.max_price||0}</td>
        <td>${effectiveReturn(t)??0}</td><td>${slTriggered(t)?"YES":"NO"}</td>
        <td>${t.days||0}</td><td>${effectiveResult(t)}</td>
      </tr>`;
    });
    tableHtml += "</tbody></table>";
    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `finma_swing_trades_SL3.5pct_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setPdfExporting(true);
    try {
      const element = dashboardRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      pdf.save(`finma_swing_performance_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div ref={dashboardRef} className="space-y-8">
      {/* ── Hero Overview ──────────────────────────────────────────────────── */}
      <div className="mb-10 rounded-2xl overflow-hidden border border-[#1e2a3a] bg-gradient-to-br from-[#0d1521] via-[#111827] to-[#0d1521]">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-[#1e2a3a]">
          <div>
            <h2 className="text-2xl font-black text-white">BOGA AI Swing Engine</h2>
            <p className="text-xs text-[#64748b] mt-1">
              Performance overview · <span className="text-[#f59e0b] font-bold">−3.5% Stop-Loss Applied</span>
              {lastUpdated && <span className="ml-2">· Updated {formatLastUpdated(lastUpdated)}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] font-bold">
              SL −3.5%
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] font-bold">
              {stats.completedCount} Completed
            </span>
          </div>
        </div>

        {/* Big Numbers Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y md:divide-y-0 divide-[#1e2a3a]">
          <div className="p-5 md:p-6 text-center">
            <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Win Rate (w/ SL)</p>
            <p className="text-3xl md:text-4xl font-mono font-black text-[#22c55e]">
              {stats.winRate === "—" ? "—" : `${stats.winRate}%`}
            </p>
            <p className="text-[10px] text-[#475569] mt-1">{stats.wins} wins / {stats.losses} losses</p>
          </div>
          <div className="p-5 md:p-6 text-center">
            <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Avg Return (w/ SL)</p>
            <p className={`text-3xl md:text-4xl font-mono font-black ${stats.avgReturn === "—" ? "text-white" : parseFloat(stats.avgReturn) >= 0 ? "text-white" : "text-[#ef4444]"}`}>
              {stats.avgReturn === "—" ? "—" : `${parseFloat(stats.avgReturn) >= 0 ? "+" : ""}${stats.avgReturn}%`}
            </p>
            <p className="text-[10px] text-[#475569] mt-1">avg ${stats.avgPnl} per $1,000</p>
          </div>
          <div className="p-5 md:p-6 text-center">
            <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Avg Days to Peak</p>
            <p className="text-3xl md:text-4xl font-mono font-black text-[#3b82f6]">
              {stats.avgDays === "—" ? "—" : `${stats.avgDays}d`}
            </p>
            <p className="text-[10px] text-[#475569] mt-1">winning trades only</p>
          </div>
          <div className="p-5 md:p-6 text-center">
            <p className="text-[9px] md:text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Total Signals</p>
            <p className="text-3xl md:text-4xl font-mono font-black text-white">{stats.totalSignals}</p>
            {stats.pending > 0 && (
              <p className="text-[10px] text-[#3b82f6] mt-1">{stats.pending} pending</p>
            )}
          </div>
        </div>

        {/* Profit Target Breakdown */}
        <div className="px-6 py-5 border-t border-[#1e2a3a]">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-4 font-bold">Profit Target Breakdown — Avg Days & Hit Rate per Target</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {profitTargets.map(pt => (
              <div key={pt.pct} className="rounded-xl bg-[#141924] border border-[#1e2a3a] p-3 text-center hover:border-[#22c55e]/40 transition-colors">
                <p className="text-[10px] text-[#64748b] uppercase mb-1">+{pt.pct}% Target</p>
                <p className="text-xl font-black font-mono text-[#22c55e]">{pt.avgDays === "—" ? "—" : `${pt.avgDays}d`}</p>
                <p className="text-[10px] text-[#94a3b8] mt-0.5 font-bold">{pt.rate}%</p>
                <p className="text-[9px] text-[#475569]">{pt.count} trades</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#64748b] mt-3">
            Example: "+5% Target → 19.9d → 67.3%" means 67.3% of completed trades reached +5% or more, in an average of 19.9 days.
          </p>
        </div>

        {/* Days-to-Profit Distribution Bar Chart */}
        <div className="px-6 py-5 border-t border-[#1e2a3a]">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-4 font-bold">Days Distribution — Winning Trades (Avg Return)</p>
          <div className="flex items-end gap-3 h-28">
            {daysDistribution.map(b => {
              const barHeight = maxDaysBucket > 0 ? Math.max(4, (b.avgRet / maxDaysBucket) * 96) : 4;
              return (
                <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <p className="text-[9px] font-mono text-[#22c55e] font-bold">{b.avgRet > 0 ? `+${b.avgRet}%` : "—"}</p>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#22c55e]/60 to-[#22c55e]/20 border border-[#22c55e]/30 transition-all"
                    style={{ height: `${barHeight}%` }}
                  />
                  <p className="text-[9px] text-[#64748b] text-center">{b.label}</p>
                  <p className="text-[8px] text-[#475569]">{b.count}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[#64748b] mt-2">Each bar shows the avg return and trade count for winning trades that peaked within that holding period.</p>
        </div>

        {/* Quick Percentile Row */}
        <div className="grid grid-cols-3 gap-0 divide-x divide-[#1e2a3a] border-t border-[#1e2a3a]">
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Reached +5%</p>
            <p className="text-lg font-black font-mono text-[#22c55e]">{stats.above5Rate === "—" ? "—" : `${stats.above5Rate}%`}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Reached +10%</p>
            <p className="text-lg font-black font-mono text-[#3b82f6]">{stats.above10Rate === "—" ? "—" : `${stats.above10Rate}%`}</p>
          </div>
          <div className="px-5 py-3 text-center">
            <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Reached +15%</p>
            <p className="text-lg font-black font-mono text-[#a78bfa]">{stats.above15Rate === "—" ? "—" : `${stats.above15Rate}%`}</p>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <select value={selectedSector} onChange={e => { setSelectedSector(e.target.value); setSelectedSubsector("All"); }}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={selectedSubsector} onChange={e => setSelectedSubsector(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">All Subsectors</option>
          {subsectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedMonth("All"); }}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]">
          <option value="All">All Months</option>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="bg-[#1a2030] border border-[#1e2a3a] text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6]"
          title="Filter by exact date" />

        <div className="relative">
          <input type="text" placeholder="Search Ticker..." value={searchTicker}
            onChange={e => setSearchTicker(e.target.value)}
            className="bg-[#1a2030] border border-[#1e2a3a] text-white pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#3b82f6] w-full md:w-40" />
          <svg className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>

        {hasActiveFilter && (
          <button onClick={resetFilters}
            className="px-4 py-2.5 rounded-xl text-sm border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">
            Reset
          </button>
        )}
      </div>

      {/* ── Sector Heatmap ───────────────────────────────────────────────── */}
      {heatmap.length > 0 && (
        <div className="mb-12">
          <h3 className="text-xl font-bold text-white mb-6">Sector Profitability Heatmap</h3>
          <div className="flex overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-3 lg:grid-cols-6 gap-4 no-scrollbar">
            {heatmap.map(s => (
              <button key={s.name}
                onClick={() => setSelectedSector(s.name === selectedSector ? "All" : s.name)}
                className={`rounded-xl border p-4 ${heatColor(s.avgReturn)} flex flex-col gap-2 transition-all hover:scale-105 shadow-xl text-left min-w-[160px] md:min-w-0 ${s.name === selectedSector ? "ring-2 ring-white" : ""}`}>
                <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest truncate w-full" title={s.name}>{s.name}</p>
                <div className="flex items-end justify-between w-full">
                  <div>
                    <p className={`text-xl font-black font-mono ${s.avgReturn >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {s.avgReturn >= 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest mt-1">Avg Return</p>
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
            <div className="flex items-center gap-2">
              <p className="text-xs text-[#94a3b8]">Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} trades</p>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] font-bold">−3.5% SL Applied</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e2a3a] text-[#94a3b8] border border-[#2d3a4b] hover:border-[#3b82f6] hover:text-white transition-all flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              CSV
            </button>
            <button onClick={handleExportExcel}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e2a3a] text-[#94a3b8] border border-[#2d3a4b] hover:border-[#22c55e] hover:text-white transition-all flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Excel (XLS)
            </button>
            <button onClick={handleExportPDF} disabled={pdfExporting}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e2a3a] text-[#94a3b8] border border-[#2d3a4b] hover:border-[#ef4444] hover:text-white transition-all flex items-center gap-2 disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              {pdfExporting ? "Exporting..." : "PDF"}
            </button>
          </div>
        </div>

        {/* ── Mobile Card View ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {visibleTrades.map((t, i) => {
            const effRet = effectiveReturn(t);
            const effRes = effectiveResult(t);
            const resultCls = RESULT_COLORS[effRes] ?? "text-[#94a3b8]";
            const pnl = pnlFromReturn(effRet);
            const slHit = slTriggered(t);
            return (
              <div key={i} className={`glass-card p-4 border-l-4 ${slHit ? "border-l-[#ef4444]" : "border-l-[#3b82f6]"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Link href={`/stock/${t.ticker}`} className="text-xl font-black text-[#3b82f6] hover:underline">{t.ticker}</Link>
                    <p className="text-[10px] text-[#64748b] mt-0.5">{t.date} · {t.sector}</p>
                    {t.subsector && t.subsector !== t.sector && (
                      <p className="text-[9px] text-[#475569]">{t.subsector}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${resultCls}`}>{effRes}</span>
                    {slHit && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444]">SL HIT</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-[#1e2a3a]/40 pt-3 text-sm">
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Entry</p>
                    <p className="font-mono font-bold text-white">${fmt(t.entry)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Peak / SL</p>
                    <p className="font-mono text-white">{slHit ? `$${fmt(t.entry * (1 + SL_PCT/100))}` : (t.max_price != null ? `$${fmt(t.max_price)}` : "—")}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Days</p>
                    <p className="font-mono text-[#94a3b8]">{t.days != null ? `${t.days}d` : "—"}</p>
                  </div>
                  <div className="col-span-3 border-t border-[#1e2a3a]/40 pt-2 flex justify-between">
                    <div>
                      <p className="text-[9px] text-[#64748b] uppercase mb-0.5">Return (SL adj.)</p>
                      <p className={`font-mono font-black text-sm ${retColor(effRet)}`}>
                        {effRet != null ? `${effRet >= 0 ? "+" : ""}${fmt(effRet, 2)}%` : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-[#64748b] uppercase mb-0.5">PnL/$1000</p>
                      <p className={`font-mono font-black ${retColor(pnl)}`}>
                        {pnl != null ? `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(0)}` : "—"}
                      </p>
                    </div>
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
                <col className="w-[110px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[80px]" />
                <col className="w-[100px]" />
                <col className="w-[55px]" />
                <col className="w-[150px]" />
                <col className="w-[140px]" />
                <col className="w-[75px]" />
              </colgroup>
              <thead>
                <tr className="bg-[#1a2030] border-b border-[#1e2a3a] text-[#64748b]">
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('date')}>Date <SortIcon column="date" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('ticker')}>Symbol <SortIcon column="ticker" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right text-[#22c55e] cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('return_pct')}>Return (SL adj.) <SortIcon column="return_pct" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('entry')}>Entry <SortIcon column="entry" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('max_price')}>Peak Price <SortIcon column="max_price" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('days')}>Days <SortIcon column="days" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right text-[#3b82f6] cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('return_pct')}>PnL/$1000 <SortIcon column="return_pct" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center text-[#f59e0b]">SL</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('sector')}>Sector <SortIcon column="sector" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('subsector')}>Subsector <SortIcon column="subsector" /></th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center cursor-pointer hover:bg-[#1e2a3a]" onClick={() => handleSort('result')}>Result <SortIcon column="result" /></th>
                </tr>
              </thead>
              <tbody className="text-white font-mono divide-y divide-[#1e2a3a]">
                {visibleTrades.map((t, i) => {
                  const effRet = effectiveReturn(t);
                  const effRes = effectiveResult(t);
                  const resultCls = RESULT_COLORS[effRes] ?? "text-[#94a3b8]";
                  const pnl = pnlFromReturn(effRet);
                  const slHit = slTriggered(t);
                  return (
                    <tr key={i} className={`hover:bg-[#1a2030]/50 transition-colors ${slHit ? "bg-[#ef4444]/5" : ""}`}>
                      <td className="px-4 py-3 text-[#94a3b8]">{t.date}</td>
                      <td className="px-4 py-3">
                        <Link href={`/stock/${t.ticker}`} className="font-bold text-[#3b82f6] hover:underline">{t.ticker}</Link>
                        {t.company && t.company !== t.ticker && (
                          <p className="text-[9px] text-[#475569] truncate">{t.company}</p>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-black text-sm ${retColor(effRet)}`}>
                        {effRet != null ? `${effRet >= 0 ? "+" : ""}${fmt(effRet, 2)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">${fmt(t.entry)}</td>
                      <td className="px-4 py-3 text-right">
                        {slHit ? (
                          <span className="text-[#ef4444]">${fmt(t.entry * (1 + SL_PCT/100))}<span className="block text-[9px] text-[#ef4444]/60">SL price</span></span>
                        ) : t.max_price != null ? (
                          <span>${fmt(t.max_price)}{t.peak_date && <span className="block text-[9px] text-[#475569]">{t.peak_date}</span>}</span>
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
                      <td className="px-4 py-3 text-center">
                        {slHit && <span className="text-[9px] font-black text-[#ef4444]">●</span>}
                      </td>
                      <td className="px-4 py-3 text-[#94a3b8] text-[10px] uppercase">{t.sector || "—"}</td>
                      <td className="px-4 py-3 text-[#64748b] text-[10px]">
                        <span className="truncate block" title={t.subsector}>{t.subsector || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${resultCls}`}>{effRes}</span>
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

        {visibleCount < filtered.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-8 py-3 rounded-xl bg-[#1e2a3a] border border-[#2d3a4b] text-sm font-bold text-[#94a3b8] hover:border-[#3b82f6] hover:text-white transition-all">
              Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
              <span className="ml-2 text-[#64748b]">({filtered.length - visibleCount} remaining)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
