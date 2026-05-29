"use client";

import { useState, useMemo } from "react";
import type { EnrichedTrade } from "@/lib/kriter-helpers";
import TradeDetailModal from "./TradeDetailModal";

interface Props {
  trades: EnrichedTrade[];
}

type SortKey = "date" | "ticker" | "return_pct" | "result" | "composite" | "rsi" | "adx" | "rvol";
type ResultFilter = "ALL" | "WIN" | "LOSS" | "PENDING";

function SystemBadge({ system, category }: { system: string; category: string }) {
  const isMomentum = category?.toLowerCase().includes("momentum");
  const isBreakout = category?.toLowerCase().includes("breakout");
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isMomentum ? "bg-blue-900/40 text-blue-300" : isBreakout ? "bg-purple-900/40 text-purple-300" : "bg-gray-900/40 text-gray-400"}`}>
      {system?.replace("_", " ") ?? "—"}
    </span>
  );
}

function EMABadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-600 text-xs">—</span>;
  const styles: Record<string, string> = {
    FULL: "text-green-400",
    MIXED: "text-yellow-400",
    BELOW: "text-red-400",
  };
  const icons: Record<string, string> = { FULL: "✅", MIXED: "⚠️", BELOW: "❌" };
  return <span className={`text-xs ${styles[status] ?? "text-gray-400"}`}>{icons[status] ?? ""} {status}</span>;
}

function RsiCell({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-gray-600">—</span>;
  const color = rsi >= 60 ? "text-red-400" : rsi <= 40 ? "text-green-400" : "text-yellow-400";
  return <span className={`text-xs ${color}`}>{rsi.toFixed(0)}</span>;
}

function RvolCell({ rvol }: { rvol: number | null }) {
  if (rvol === null) return <span className="text-gray-600">—</span>;
  const color = rvol >= 1.5 ? "text-green-400" : rvol < 0.8 ? "text-red-400" : "text-white";
  return <span className={`text-xs ${color}`}>{rvol.toFixed(1)}x</span>;
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    WIN: "bg-green-900/40 text-green-400 border-green-800/30",
    LOSS: "bg-red-900/40 text-red-400 border-red-800/30",
    PENDING: "bg-yellow-900/40 text-yellow-400 border-yellow-800/30",
  };
  const icons: Record<string, string> = { WIN: "✅", LOSS: "❌", PENDING: "⏳" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 border rounded ${styles[result] ?? "text-gray-400"}`}>
      {icons[result] ?? ""} {result}
    </span>
  );
}

export default function TradeAnalysisTable({ trades }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>("ALL");
  const [selectedTrade, setSelectedTrade] = useState<EnrichedTrade | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = useMemo(() => {
    return trades.filter((t) => filter === "ALL" || t.result === filter);
  }, [trades, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      switch (sortKey) {
        case "date": av = a.date; bv = b.date; break;
        case "ticker": av = a.ticker; bv = b.ticker; break;
        case "return_pct": av = a.return_pct; bv = b.return_pct; break;
        case "result": av = a.result; bv = b.result; break;
        case "composite": av = a.snapshot?.factor_scores?.composite ?? -1; bv = b.snapshot?.factor_scores?.composite ?? -1; break;
        case "rsi": av = a.snapshot?.trend_status?.rsi_14 ?? -1; bv = b.snapshot?.trend_status?.rsi_14 ?? -1; break;
        case "adx": av = a.snapshot?.trend_status?.adx ?? -1; bv = b.snapshot?.trend_status?.adx ?? -1; break;
        case "rvol": av = a.snapshot?.trend_status?.rvol_today ?? -1; bv = b.snapshot?.trend_status?.rvol_today ?? -1; break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortAsc]);

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th
      className="text-left py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <>
      {selectedTrade && (
        <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}

      <div className="bg-[#0d1117] border border-white/10 rounded font-mono">
        {/* Filter bar */}
        <div className="flex items-center gap-2 p-3 border-b border-white/10">
          <span className="text-[10px] text-gray-600 mr-1">FİLTRE:</span>
          {(["ALL", "WIN", "LOSS", "PENDING"] as ResultFilter[]).map((f) => {
            const count = f === "ALL" ? trades.length : trades.filter((t) => t.result === f).length;
            const colors: Record<ResultFilter, string> = {
              ALL: "border-white/20 text-white",
              WIN: "border-green-800/40 text-green-400",
              LOSS: "border-red-800/40 text-red-400",
              PENDING: "border-yellow-800/40 text-yellow-400",
            };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2.5 py-1 border rounded transition-colors ${colors[f]} ${filter === f ? "bg-white/10" : "hover:bg-white/5"}`}
              >
                {f} ({count})
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-gray-600">{sorted.length} trade</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr>
                <Th col="date" label="Tarih" />
                <Th col="ticker" label="Ticker" />
                <th className="text-left py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wider">Sistem</th>
                <th className="text-left py-2 px-3 text-[10px] text-gray-500 uppercase tracking-wider">EMA Stack</th>
                <Th col="rsi" label="RSI" />
                <Th col="adx" label="ADX" />
                <Th col="rvol" label="RVOL" />
                <Th col="composite" label="Score" />
                <Th col="result" label="Sonuç" />
                <Th col="return_pct" label="Return%" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((trade, i) => {
                const s = trade.snapshot;
                return (
                  <tr
                    key={`${trade.date}-${trade.ticker}`}
                    className={`border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                    onClick={() => setSelectedTrade(trade)}
                  >
                    <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">{trade.date}</td>
                    <td className="py-2 px-3 font-bold text-white">{trade.ticker}</td>
                    <td className="py-2 px-3">
                      {s ? (
                        <SystemBadge system={s.selected_system} category={s.system_category} />
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <EMABadge status={trade.derived?.ema_stack_status ?? null} />
                    </td>
                    <td className="py-2 px-3">
                      <RsiCell rsi={s?.trend_status?.rsi_14 ?? null} />
                    </td>
                    <td className="py-2 px-3 text-xs text-white">{s?.trend_status?.adx?.toFixed(0) ?? "—"}</td>
                    <td className="py-2 px-3">
                      <RvolCell rvol={s?.trend_status?.rvol_today ?? null} />
                    </td>
                    <td className="py-2 px-3 text-xs text-cyan-400">{s?.factor_scores?.composite?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 px-3">
                      <ResultBadge result={trade.result} />
                    </td>
                    <td className={`py-2 px-3 text-xs font-bold ${trade.return_pct > 0 ? "text-green-400" : trade.return_pct < 0 ? "text-red-400" : "text-gray-400"}`}>
                      {trade.return_pct > 0 ? "+" : ""}{trade.return_pct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Bu filtre için trade bulunamadı.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
