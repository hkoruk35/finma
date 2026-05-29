"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import TickerHoverChart from "@/components/TickerHoverChart";
import type { EnrichedTrade } from "@/lib/kriter-helpers";

interface Props {
  trades: EnrichedTrade[];
}

type SortKey = "date" | "ticker" | "return_pct" | "result" | "composite" | "rsi" | "adx" | "rvol";
type ResultFilter = "ALL" | "WIN" | "LOSS" | "PENDING";

function SystemBadge({ system, category }: { system: string; category: string }) {
  const isMomentum = category?.toLowerCase().includes("momentum");
  const isBreakout = category?.toLowerCase().includes("breakout");
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isMomentum ? "bg-blue-900/40 text-blue-300" : isBreakout ? "bg-purple-900/40 text-purple-300" : "bg-gray-800/60 text-gray-300"}`}>
      {system?.replace(/_/g, " ") ?? "—"}
    </span>
  );
}

function EMABadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">N/A</span>;
  const styles: Record<string, string> = {
    FULL: "text-green-400", MIXED: "text-yellow-400", BELOW: "text-red-400",
  };
  const icons: Record<string, string> = { FULL: "✅", MIXED: "⚠️", BELOW: "❌" };
  return <span className={`text-xs ${styles[status] ?? "text-gray-300"}`}>{icons[status] ?? ""} {status}</span>;
}

function RsiCell({ rsi }: { rsi: number | null }) {
  if (rsi === null) return <span className="text-gray-400 text-xs">N/A</span>;
  const color = rsi >= 60 ? "text-red-400" : rsi <= 40 ? "text-green-400" : "text-yellow-300";
  return <span className={`text-xs font-mono ${color}`}>{rsi.toFixed(0)}</span>;
}

function RvolCell({ rvol }: { rvol: number | null }) {
  if (rvol === null) return <span className="text-gray-400 text-xs">N/A</span>;
  const color = rvol >= 1.5 ? "text-green-400" : rvol < 0.8 ? "text-red-400" : "text-white";
  return <span className={`text-xs font-mono ${color}`}>{rvol.toFixed(1)}x</span>;
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    WIN: "bg-green-900/40 text-green-400 border-green-800/40",
    LOSS: "bg-red-900/40 text-red-400 border-red-800/40",
    PENDING: "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",
  };
  const icons: Record<string, string> = { WIN: "✅", LOSS: "❌", PENDING: "⏳" };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 border rounded ${styles[result] ?? "text-gray-300"}`}>
      {icons[result] ?? ""} {result}
    </span>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-white/5 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={color ?? "text-white"}>{value}</span>
    </div>
  );
}

function AccordionDetail({ trade }: { trade: EnrichedTrade }) {
  const [tab, setTab] = useState<"ozet" | "teknik" | "sinyaller" | "zones">("teknik");
  const s = trade.snapshot;
  const d = trade.derived;
  const resultColor = trade.result === "WIN" ? "text-green-400" : trade.result === "LOSS" ? "text-red-400" : "text-yellow-400";

  const TABS = [
    { id: "teknik" as const, label: "Teknik" },
    { id: "ozet" as const, label: "Özet" },
    { id: "sinyaller" as const, label: "Sinyaller" },
    { id: "zones" as const, label: "Zones" },
  ];

  return (
    <tr>
      <td colSpan={10} className="px-4 py-0">
        <div className="bg-[#080b12] border border-white/10 rounded-lg my-2 font-mono overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={(e) => { e.stopPropagation(); setTab(t.id); }}
                className={`px-4 py-2 text-[11px] transition-colors ${tab === t.id ? "text-green-400 border-b-2 border-green-400" : "text-gray-500 hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
            <div className="ml-auto px-4 py-2 text-[11px] text-gray-600">
              {trade.enrichmentStatus !== "OK" && <span className="text-yellow-500">⚠ {trade.enrichmentStatus}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            {tab === "ozet" && (
              <>
                <div className="space-y-1">
                  <Row label="Şirket" value={trade.company} />
                  <Row label="Sektör" value={trade.sector} />
                  <Row label="Alt Sektör" value={trade.subsector} />
                  <Row label="Giriş" value={`$${trade.entry}`} />
                </div>
                <div className="space-y-1">
                  <Row label="Max Fiyat" value={`$${trade.max_price}`} />
                  <Row label="Sonuç" value={trade.result} color={resultColor} />
                  <Row label="Getiri" value={`${trade.return_pct >= 0 ? "+" : ""}${trade.return_pct.toFixed(2)}%`} color={trade.return_pct > 0 ? "text-green-400" : trade.return_pct < 0 ? "text-red-400" : "text-gray-300"} />
                  <Row label="Gün" value={String(trade.days)} />
                </div>
                <div className="space-y-1">
                  <Row label="Stop-Loss %" value={`%${trade.sl_pct}`} />
                  {s && <Row label="Boga Skoru" value={String(s.score)} />}
                  {d && <Row label="EMA Stack" value={d.ema_stack_status} color={d.ema_stack_status === "FULL" ? "text-green-400" : d.ema_stack_status === "MIXED" ? "text-yellow-400" : "text-red-400"} />}
                </div>
                <div className="space-y-1">
                  {s && <Row label="Sistem" value={s.selected_system} />}
                  {s && <Row label="Kategori" value={s.system_category} />}
                  <Row label="Veri Kaynağı" value={trade.enrichmentStatus === "OK" ? "Arşiv" : "Canlı Veri"} color={trade.enrichmentStatus === "OK" ? "text-green-400" : "text-yellow-400"} />
                </div>
              </>
            )}

            {tab === "teknik" && (
              <>
                <div className="space-y-1">
                  <Row label="RSI 14" value={s ? String(s.trend_status?.rsi_14 ?? "—") : "N/A"} color={s && (s.trend_status?.rsi_14 ?? 50) >= 60 ? "text-red-400" : "text-white"} />
                  <Row label="ADX" value={s ? String(s.trend_status?.adx ?? "—") : "N/A"} color={s && (s.trend_status?.adx ?? 0) >= 25 ? "text-green-400" : "text-yellow-400"} />
                  <Row label="MACD Hist" value={s ? String(s.trend_status?.macd_hist ?? "—") : "N/A"} color={s && (s.trend_status?.macd_hist ?? 0) >= 0 ? "text-green-400" : "text-red-400"} />
                  <Row label="MFI" value={s ? String(s.trend_status?.mfi ?? "—") : "N/A"} />
                </div>
                <div className="space-y-1">
                  <Row label="CMF" value={s ? String(s.trend_status?.cmf ?? "—") : "N/A"} />
                  <Row label="RVOL" value={s ? `${s.trend_status?.rvol_today ?? "—"}x` : "N/A"} color={s && (s.trend_status?.rvol_today ?? 0) >= 1.5 ? "text-green-400" : "text-white"} />
                  <Row label="Trend" value={s?.trend_status?.trend ?? "N/A"} />
                </div>
                <div className="space-y-1">
                  <Row label="EMA 20" value={s ? `$${s.moving_averages?.ema_20?.toFixed(2)}` : "N/A"} />
                  <Row label="EMA 50" value={s ? `$${s.moving_averages?.ema_50?.toFixed(2)}` : "N/A"} />
                  <Row label="EMA 200" value={s ? `$${s.moving_averages?.ema_200?.toFixed(2)}` : "N/A"} />
                </div>
                <div className="space-y-1">
                  <Row label="RSI 1H" value={s ? String(s.hourly_analysis?.rsi_1h ?? "—") : "N/A"} />
                  <Row label="ADX 1H" value={s ? String(s.hourly_analysis?.adx_1h ?? "—") : "N/A"} />
                  <Row label="EMA Yapısı" value={s?.hourly_analysis?.ema_structure ?? "N/A"} />
                </div>
              </>
            )}

            {tab === "sinyaller" && (
              <>
                <div className="col-span-2 space-y-1">
                  <div className="text-[10px] text-gray-500 mb-2">Seçim Sinyalleri</div>
                  {(s?.selection_reasons ?? []).length > 0
                    ? s!.selection_reasons.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 border-b border-white/5">
                          <span className="text-green-400">{">"}</span>
                          <span className="text-white text-xs">{r}</span>
                        </div>
                      ))
                    : <div className="text-gray-500 text-xs">Sinyal bilgisi yok{trade.enrichmentStatus !== "OK" ? " (arşiv dışı hisse)" : ""}</div>
                  }
                </div>
                <div className="col-span-2 space-y-1">
                  <div className="text-[10px] text-gray-500 mb-2">Faktör Skorları</div>
                  {s?.factor_scores ? (
                    <>
                      <Row label="Trend" value={String(s.factor_scores.trend_score)} />
                      <Row label="Momentum" value={String(s.factor_scores.momentum_score)} />
                      <Row label="Volume" value={String(s.factor_scores.volume_score)} />
                      <Row label="Financial" value={String(s.factor_scores.financial_score)} />
                      <Row label="Composite" value={String(s.factor_scores.composite)} color="text-cyan-400" />
                    </>
                  ) : <div className="text-gray-500 text-xs">Veri yok</div>}
                </div>
              </>
            )}

            {tab === "zones" && s?.boga_zones && (
              <>
                <div className="space-y-1">
                  <Row label="Alım Zonu" value={s.boga_zones.buying_zone?.high > 0 ? `$${s.boga_zones.buying_zone.low?.toFixed(2)}–${s.boga_zones.buying_zone.high?.toFixed(2)}` : "N/A"} color="text-cyan-400" />
                  <Row label="Satış Zonu" value={s.boga_zones.sell_zone?.high > 0 ? `$${s.boga_zones.sell_zone.low?.toFixed(2)}–${s.boga_zones.sell_zone.high?.toFixed(2)}` : "N/A"} color="text-green-400" />
                  <Row label="Stop Zonu" value={s.boga_zones.stop_loss_zone?.high > 0 ? `$${s.boga_zones.stop_loss_zone.low?.toFixed(2)}–${s.boga_zones.stop_loss_zone.high?.toFixed(2)}` : "N/A"} color="text-red-400" />
                </div>
                <div className="space-y-1">
                  <Row label="Risk/Reward" value={s.boga_zones.risk_reward > 0 ? String(s.boga_zones.risk_reward?.toFixed(2)) : "N/A"} color={(s.boga_zones.risk_reward ?? 0) >= 2 ? "text-green-400" : "text-yellow-400"} />
                  <Row label="ATR 1D" value={`$${s.boga_zones.atr_1d?.toFixed(2)}`} />
                  <Row label="ATR %" value={`%${s.boga_zones.atr_pct?.toFixed(2)}`} />
                </div>
                <div className="space-y-1">
                  {s.boga_zones.support_1h > 0 && <Row label="Destek 1H" value={`$${s.boga_zones.support_1h?.toFixed(2)}`} />}
                  {s.boga_zones.resistance_1h > 0 && <Row label="Direnç 1H" value={`$${s.boga_zones.resistance_1h?.toFixed(2)}`} />}
                  {s.boga_zones.risk_usd > 0 && <Row label="Risk USD" value={`$${s.boga_zones.risk_usd?.toFixed(2)}`} color="text-red-400" />}
                  {s.boga_zones.reward_usd > 0 && <Row label="Reward USD" value={`$${s.boga_zones.reward_usd?.toFixed(2)}`} color="text-green-400" />}
                </div>
              </>
            )}

            {tab === "zones" && !s?.boga_zones && (
              <div className="col-span-4 text-gray-500 text-xs py-2">Zone verisi yok.</div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function TradeAnalysisTable({ trades }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
      className="text-left py-2 px-3 text-[10px] text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label} {sortKey === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded font-mono">
      {/* Filter bar */}
      <div className="flex items-center gap-2 p-3 border-b border-white/10">
        <span className="text-[10px] text-gray-400 mr-1">FİLTRE:</span>
        {(["ALL", "WIN", "LOSS", "PENDING"] as ResultFilter[]).map((f) => {
          const count = f === "ALL" ? trades.length : trades.filter((t) => t.result === f).length;
          const colors: Record<ResultFilter, string> = {
            ALL: "border-white/20 text-white",
            WIN: "border-green-800/40 text-green-400",
            LOSS: "border-red-800/40 text-red-400",
            PENDING: "border-yellow-800/40 text-yellow-300",
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
        <span className="ml-auto text-[10px] text-gray-400">{sorted.length} trade · satıra tıkla: detay</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr>
              <Th col="date" label="Tarih" />
              <Th col="ticker" label="Ticker" />
              <th className="text-left py-2 px-3 text-[10px] text-gray-400 uppercase tracking-wider">Sistem</th>
              <th className="text-left py-2 px-3 text-[10px] text-gray-400 uppercase tracking-wider">EMA Stack</th>
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
              const rowKey = `${trade.date}-${trade.ticker}`;
              const isExpanded = expandedRow === rowKey;

              return (
                <Fragment key={rowKey}>
                  <tr
                    className={`border-b border-white/5 cursor-pointer transition-colors ${isExpanded ? "bg-[#0f1a25] border-b-0" : "hover:bg-white/5"} ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                    onClick={() => setExpandedRow(isExpanded ? null : rowKey)}
                  >
                    <td className="py-2 px-3 text-gray-300 text-xs whitespace-nowrap">{trade.date}</td>
                    <td className="py-2 px-3">
                      <TickerHoverChart ticker={trade.ticker}>
                        <Link
                          href={`/stock/${trade.ticker}`}
                          className="font-bold text-white hover:text-[#3b82f6] transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {trade.ticker}
                        </Link>
                      </TickerHoverChart>
                      {trade.company && trade.company !== trade.ticker && (
                        <div className="text-[9px] text-gray-500 truncate max-w-[80px]">{trade.company}</div>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {s ? (
                        <SystemBadge system={s.selected_system} category={s.system_category} />
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <EMABadge status={trade.derived?.ema_stack_status ?? null} />
                    </td>
                    <td className="py-2 px-3">
                      <RsiCell rsi={s?.trend_status?.rsi_14 ?? null} />
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-200 font-mono">{s?.trend_status?.adx?.toFixed(0) ?? <span className="text-gray-400">N/A</span>}</td>
                    <td className="py-2 px-3">
                      <RvolCell rvol={s?.trend_status?.rvol_today ?? null} />
                    </td>
                    <td className="py-2 px-3 text-xs text-cyan-300 font-mono">{s?.factor_scores?.composite?.toFixed(1) ?? <span className="text-gray-400">N/A</span>}</td>
                    <td className="py-2 px-3">
                      <ResultBadge result={trade.result} />
                    </td>
                    <td className={`py-2 px-3 text-xs font-bold font-mono ${trade.return_pct > 0 ? "text-green-400" : trade.return_pct < 0 ? "text-red-400" : "text-gray-300"}`}>
                      {trade.return_pct > 0 ? "+" : ""}{trade.return_pct.toFixed(2)}%
                    </td>
                  </tr>
                  {isExpanded && <AccordionDetail trade={trade} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Bu filtre için trade bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}
