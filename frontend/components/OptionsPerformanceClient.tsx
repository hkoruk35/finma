"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { OptionsOutcomes, OptionPosition } from "@/lib/data";
import TickerHoverChart from "./TickerHoverChart";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtD(n: number | null | undefined, d = 2) {
  return n == null ? "—" : n.toFixed(d);
}
function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}
function dollar(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return "$" + n.toFixed(d);
}
function pnlCls(n: number | null | undefined) {
  if (n == null) return "text-slate-500";
  return n > 0 ? "text-emerald-400 font-black" : n < 0 ? "text-red-400 font-black" : "text-slate-300";
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:      { label: "OPEN",      cls: "text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20" },
  tp_hit:    { label: "TP HIT",    cls: "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" },
  sl_hit:    { label: "SL HIT",    cls: "text-red-400 bg-red-400/10 border border-red-400/20" },
  time_stop: { label: "T-STOP",    cls: "text-amber-400 bg-amber-400/10 border border-amber-400/20" },
  expired:   { label: "EXPIRED",   cls: "text-slate-400 bg-slate-400/10 border border-slate-400/20" },
  manual:    { label: "MANUAL",    cls: "text-purple-400 bg-purple-400/10 border border-purple-400/20" },
};

const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
  <th className={`px-2 py-2 text-[10px] font-black text-slate-500 uppercase tracking-tight whitespace-nowrap border-b border-white/10 ${right ? "text-right" : center ? "text-center" : "text-left"}`}>
    {children}
  </th>
);

const TD = ({ children, center, right, cls, title }: { children: React.ReactNode; center?: boolean; right?: boolean; cls?: string; title?: string }) => (
  <td title={title} className={`px-2 py-1.5 text-[11px] font-medium whitespace-nowrap border-b border-white/[0.03] ${center ? "text-center" : right ? "text-right" : "text-left"} ${cls || "text-slate-300"}`}>
    {children}
  </td>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function OptionsPerformanceClient({ outcomes }: { outcomes: OptionsOutcomes | null }) {
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [stratFilter, setStratFilter] = useState<string>("ALL");

  const positions: OptionPosition[] = outcomes?.positions ?? [];
  const summary = outcomes?.summary;
  const updatedAt = outcomes?.updated_at;

  // ── Unique scan dates from positions ──
  const uniqueDates = useMemo(() => {
    const dates = positions.map((p) => p.scan_date).filter(Boolean);
    return Array.from(new Set(dates)).sort().reverse();
  }, [positions]);

  // ── Filtered positions ──
  const filtered = useMemo(() => {
    return positions.filter((p) => {
      if (selectedDate !== "ALL" && p.scan_date !== selectedDate) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (stratFilter !== "ALL" && p.strategy !== stratFilter) return false;
      return true;
    });
  }, [positions, selectedDate, statusFilter, stratFilter]);

  // ── Stats for filtered view ──
  const filteredStats = useMemo(() => {
    const closed = filtered.filter((p) => p.status !== "open");
    const open = filtered.filter((p) => p.status === "open");
    const pnls = closed.map((p) => p.pnl_pct).filter((v) => v != null) as number[];
    const winners = pnls.filter((v) => v > 0);
    const losers = pnls.filter((v) => v <= 0);
    const tp = closed.filter((p) => p.status === "tp_hit").length;
    return {
      total: filtered.length,
      open: open.length,
      closed: closed.length,
      tp,
      sl: closed.filter((p) => p.status === "sl_hit").length,
      tstop: closed.filter((p) => p.status === "time_stop").length,
      win_rate: closed.length ? Math.round((tp / closed.length) * 100 * 10) / 10 : null,
      avg_pnl: pnls.length ? Math.round(pnls.reduce((a, b) => a + b, 0) / pnls.length * 10) / 10 : null,
      avg_winner: winners.length ? Math.round(winners.reduce((a, b) => a + b, 0) / winners.length * 10) / 10 : null,
      avg_loser: losers.length ? Math.round(losers.reduce((a, b) => a + b, 0) / losers.length * 10) / 10 : null,
      unrealized: open.map((p) => p.unrealized_pnl_pct).filter((v) => v != null) as number[],
    };
  }, [filtered]);

  const avgUnrealized = filteredStats.unrealized.length
    ? Math.round(filteredStats.unrealized.reduce((a, b) => a + b, 0) / filteredStats.unrealized.length * 10) / 10
    : null;

  // ── CSV Export ──
  const handleCopyList = () => {
    const header = "DATE\tTICKER\tSTRATEGY\tSTRIKE\tEXPIRATION\tENTRY\tCURRENT\tTP\tSL\tSTATUS\tPNL%\tUNRLZD%\tDAYS_HELD";
    const rows = filtered.map((p) => [
      p.scan_date, p.ticker, p.strategy,
      p.strike ? `$${p.strike} C` : "—",
      p.expiration || "—",
      p.entry_premium?.toFixed(2) ?? "—",
      p.current_premium?.toFixed(2) ?? "—",
      p.tp_target?.toFixed(2) ?? "—",
      p.sl_target?.toFixed(2) ?? "—",
      p.status,
      p.pnl_pct?.toFixed(1) ?? "—",
      p.unrealized_pnl_pct?.toFixed(1) ?? "—",
      p.days_held ?? "—",
    ].join("\t")).join("\n");
    navigator.clipboard.writeText(header + "\n" + rows);
    alert("Kopyalandı! (" + filtered.length + " pozisyon)");
  };

  const handleDownloadCSV = () => {
    const header = "DATE,TICKER,STRATEGY,STRIKE,EXPIRATION,ENTRY,CURRENT,TP,SL,STATUS,PNL%,UNRLZD%,DAYS_HELD,EXIT_DATE,EXIT_REASON\n";
    const rows = filtered.map((p) => [
      p.scan_date, p.ticker, p.strategy,
      p.strike ? p.strike + " C" : "",
      p.expiration || "",
      p.entry_premium?.toFixed(2) ?? "",
      p.current_premium?.toFixed(2) ?? "",
      p.tp_target?.toFixed(2) ?? "",
      p.sl_target?.toFixed(2) ?? "",
      p.status,
      p.pnl_pct?.toFixed(1) ?? "",
      p.unrealized_pnl_pct?.toFixed(1) ?? "",
      p.days_held ?? "",
      p.exit_date ?? "",
      (p.exit_reason || "").replace(/,/g, ";"),
    ].map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boga_options_perf_${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadXLS = () => {
    const header = "DATE\tTICKER\tSTRATEGY\tSTRIKE\tEXPIRATION\tENTRY\tCURRENT\tTP\tSL\tSTATUS\tPNL%\tUNRLZD%\tDAYS_HELD\tEXIT_DATE\tEXIT_REASON\n";
    const rows = filtered.map((p) => [
      p.scan_date, p.ticker, p.strategy,
      p.strike ? p.strike + " C" : "",
      p.expiration || "",
      p.entry_premium?.toFixed(2) ?? "",
      p.current_premium?.toFixed(2) ?? "",
      p.tp_target?.toFixed(2) ?? "",
      p.sl_target?.toFixed(2) ?? "",
      p.status,
      p.pnl_pct?.toFixed(1) ?? "",
      p.unrealized_pnl_pct?.toFixed(1) ?? "",
      p.days_held ?? "",
      p.exit_date ?? "",
      p.exit_reason ?? "",
    ].join("\t")).join("\n");
    const blob = new Blob([header + rows], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boga_options_perf_${selectedDate}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatUpdatedAt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) + " ET";
    } catch { return iso; }
  };

  return (
    <>
      {/* ── Header Bar (matches options table style) ──────────────────── */}
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-black text-white tracking-tighter uppercase italic">
            BOGA <span className="text-[#3b82f6]">OPTIONS</span> P&amp;L
          </span>
          <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest font-medium">
            Performance Terminal
          </span>
          <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Filter */}
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#0c121d] border border-white/10 text-[10px] font-medium text-white px-2 py-1 outline-none uppercase tracking-wider"
          >
            <option value="ALL">All Dates</option>
            {uniqueDates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0c121d] border border-white/10 text-[10px] font-medium text-white px-2 py-1 outline-none uppercase tracking-wider"
          >
            <option value="ALL">All Status</option>
            <option value="open">Open</option>
            <option value="tp_hit">TP Hit</option>
            <option value="sl_hit">SL Hit</option>
            <option value="time_stop">Time Stop</option>
            <option value="expired">Expired</option>
          </select>
          {/* Strategy Filter */}
          <select
            value={stratFilter}
            onChange={(e) => setStratFilter(e.target.value)}
            className="bg-[#0c121d] border border-white/10 text-[10px] font-medium text-white px-2 py-1 outline-none uppercase tracking-wider"
          >
            <option value="ALL">All Strategies</option>
            <option value="institutional">Institutional</option>
            <option value="asymmetric">Asymmetric</option>
          </select>
          <button onClick={handleCopyList} className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white px-2 py-1 uppercase tracking-wider transition-colors">
            Copy
          </button>
          <button onClick={handleDownloadCSV} className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white px-2 py-1 uppercase tracking-wider transition-colors">
            CSV
          </button>
          <button onClick={handleDownloadXLS} className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white px-2 py-1 uppercase tracking-wider transition-colors">
            XLS
          </button>
          {updatedAt && (
            <span className="text-[10px] text-slate-500 font-mono ml-2">
              UPDATED: <span className="text-[#3b82f6]">{formatUpdatedAt(updatedAt)}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Stats Bar ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2 mb-4">
        {[
          { label: "TOTAL", val: filteredStats.total, cls: "text-white" },
          { label: "OPEN",  val: filteredStats.open,  cls: "text-[#3b82f6]" },
          { label: "CLOSED", val: filteredStats.closed, cls: "text-slate-300" },
          { label: "TP HIT", val: filteredStats.tp,   cls: "text-emerald-400" },
          { label: "SL HIT", val: filteredStats.sl,   cls: "text-red-400" },
          { label: "T-STOP", val: filteredStats.tstop, cls: "text-amber-400" },
          { label: "WIN %",  val: filteredStats.win_rate != null ? filteredStats.win_rate + "%" : "—", cls: filteredStats.win_rate != null && filteredStats.win_rate >= 50 ? "text-emerald-400" : "text-red-400" },
          { label: "AVG P&L", val: fmtPct(filteredStats.avg_pnl), cls: pnlCls(filteredStats.avg_pnl) },
          { label: "AVG WIN", val: fmtPct(filteredStats.avg_winner), cls: "text-emerald-400" },
          { label: "UNRLZD", val: fmtPct(avgUnrealized), cls: pnlCls(avgUnrealized) },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-[#0d1420] border border-white/10 p-2 text-center rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`font-black text-sm ${cls}`}>{String(val)}</div>
          </div>
        ))}
      </div>

      {/* ── Main Table ────────────────────────────────────────────────────── */}
      <div className="bg-[#080c14] border border-white/10 rounded overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse leading-none">
            <thead className="bg-[#0c121d]">
              <tr>
                <TH>DATE</TH>
                <TH>TICKER</TH>
                <TH center>TYPE</TH>
                <TH>CONTRACT</TH>
                <TH>EXP</TH>
                <TH right>ENTRY</TH>
                <TH right>CURRENT</TH>
                <TH right>UNRLZD P&L</TH>
                <TH right>TP</TH>
                <TH right>SL</TH>
                <TH right>DAYS</TH>
                <TH center>STATUS</TH>
                <TH right>P&L %</TH>
                <TH>EXIT REASON</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-20 text-center text-slate-500 uppercase tracking-widest font-black">
                    [ NO POSITIONS FOUND ]
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const sm = STATUS_LABEL[p.status] ?? { label: p.status, cls: "text-slate-400" };
                  const isOpen = p.status === "open";
                  const daysLeft = p.time_stop_days != null && p.days_held != null
                    ? p.time_stop_days - p.days_held : null;
                  return (
                    <tr key={p.id} className={`hover:bg-white/[0.04] transition-colors ${isOpen ? "" : "opacity-80"}`}>
                      <TD cls="text-slate-500">{p.scan_date}</TD>
                      <TD cls="text-white font-black">
                        <TickerHoverChart ticker={p.ticker}>
                          <Link href={`/stock/${p.ticker}`} className="hover:text-[#3b82f6] transition-colors">
                            {p.ticker}
                          </Link>
                        </TickerHoverChart>
                      </TD>
                      <TD center cls={p.strategy === "institutional" ? "text-purple-400 font-medium text-[10px]" : "text-amber-400 font-medium text-[10px]"}>
                        {p.strategy === "institutional" ? "INST." : "ASYM."}
                      </TD>
                      <TD cls="text-white font-medium">
                        {p.strike ? `$${p.strike} C` : "—"}
                      </TD>
                      <TD cls={`font-mono text-[10px] ${daysLeft != null && daysLeft <= 3 ? "text-amber-400" : "text-slate-400"}`}>
                        {p.expiration || "—"}
                        {daysLeft != null && isOpen && (
                          <span className={`ml-1 text-[9px] ${daysLeft <= 3 ? "text-amber-400" : "text-slate-600"}`}>
                            ({daysLeft}d)
                          </span>
                        )}
                      </TD>
                      <TD right cls="text-white font-mono">{dollar(p.entry_premium)}</TD>
                      <TD right cls={`font-mono ${p.current_premium != null ? "text-white" : "text-slate-600"}`}>
                        {dollar(p.current_premium)}
                      </TD>
                      <TD right cls={`font-mono ${pnlCls(p.unrealized_pnl_pct)}`}>
                        {isOpen ? fmtPct(p.unrealized_pnl_pct) : "—"}
                      </TD>
                      <TD right cls="text-emerald-500 font-mono text-[10px]">{dollar(p.tp_target)}</TD>
                      <TD right cls="text-red-500 font-mono text-[10px]">{dollar(p.sl_target)}</TD>
                      <TD right cls="text-slate-400 text-[10px]">
                        {p.days_held != null ? `${p.days_held}d` : "—"}
                      </TD>
                      <TD center>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${sm.cls}`}>
                          {sm.label}
                        </span>
                      </TD>
                      <TD right cls={`font-mono font-black ${pnlCls(isOpen ? p.unrealized_pnl_pct : p.pnl_pct)}`}>
                        {isOpen ? "—" : fmtPct(p.pnl_pct)}
                      </TD>
                      <TD cls="text-slate-500 text-[10px] font-mono max-w-[180px] truncate" title={p.exit_reason || ""}>
                        {p.exit_reason || (isOpen ? "Holding…" : "—")}
                      </TD>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Overall Stats Footer ─────────────────────────────────────────── */}
      {summary && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Overall Win Rate</div>
            <div className={`text-xl font-black ${(summary.win_rate ?? 0) >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              {summary.win_rate != null ? summary.win_rate + "%" : "—"}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{summary.tp_hit} TP / {summary.closed} closed</div>
          </div>
          <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Best / Worst Trade</div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-black">{fmtPct(summary.best_trade_pct)}</span>
              <span className="text-slate-600">/</span>
              <span className="text-red-400 font-black">{fmtPct(summary.worst_trade_pct)}</span>
            </div>
          </div>
          <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Avg Winner / Loser</div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-black">{fmtPct(summary.avg_winner_pct)}</span>
              <span className="text-slate-600">/</span>
              <span className="text-red-400 font-black">{fmtPct(summary.avg_loser_pct)}</span>
            </div>
          </div>
          <div className="bg-[#0d1420] border border-white/10 p-3 rounded">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Expectancy</div>
            <div className={`text-xl font-black ${pnlCls(summary.expectancy)}`}>
              {fmtPct(summary.expectancy)}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">per trade avg</div>
          </div>
        </div>
      )}
    </>
  );
}
