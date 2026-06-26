"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { copy, type Locale } from "@/lib/i18n/copy";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import type { Top100Row } from "@/app/api/top100/route";

const REFRESH_MS = 5 * 60 * 1000;

const SIGNAL_STYLE: Record<string, string> = {
  AL: "bg-green-500/15 border-green-500/50 text-green-400",
  SAT: "bg-red-500/15 border-red-500/50 text-red-400",
  İzle: "bg-amber-500/15 border-amber-500/50 text-amber-400",
  Bekle: "bg-white/5 border-white/15 text-white/40",
};

function fmtVol(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

function fmt2(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(2);
}

function heatBg(pct: number | null) {
  if (pct === null) return { bg: "#111111", text: "#333333" };
  if (pct >= 2.0) return { bg: "#0d4a0d", text: "#56d364" };
  if (pct >= 1.0) return { bg: "#0d3a0d", text: "#3fb950" };
  if (pct >= 0.3) return { bg: "#0d2a0d", text: "#3fb950" };
  if (pct > -0.3) return { bg: "#1a1a1a", text: "#8b949e" };
  if (pct > -1.0) return { bg: "#2a0d0d", text: "#f85149" };
  if (pct > -2.0) return { bg: "#3a0d0d", text: "#f85149" };
  return { bg: "#4a0d0d", text: "#ff7b72" };
}

function emaArrow(ema20: number | null, ema50: number | null, ema200: number | null): string {
  if (ema20 == null || ema50 == null || ema200 == null) return "";
  if (ema20 > ema50 && ema50 > ema200) return "↑";
  if (ema20 < ema50 && ema50 < ema200) return "↓";
  return "→";
}

export default function Top100Tracker({ locale }: { locale: Locale }) {
  const t = copy[locale].top100;
  const [rows, setRows] = useState<Top100Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "investment" | "swing" | "sector">("all");
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const load = () => {
    fetch("/api/top100")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(t.error);
          return;
        }
        setRows(d.rows ?? []);
        setLastUpdated(d.lastUpdated ?? null);
        setError("");
      })
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedRows = useMemo(() => {
    const swingDaily = rows.filter((r) => r.source === "swing_daily");
    const fixed = rows.filter((r) => r.source === "fixed");
    return [...swingDaily, ...fixed];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "all" || filter === "sector") return sortedRows;
    return sortedRows.filter((r) => r.character === filter);
  }, [sortedRows, filter]);

  const sectorGroups = useMemo(() => {
    const groups: Record<string, Top100Row[]> = {};
    for (const r of sortedRows) {
      const s = r.sector || "Other";
      if (!groups[s]) groups[s] = [];
      groups[s].push(r);
    }
    return groups;
  }, [sortedRows]);

  const toggleExpand = (ticker: string) => setExpandedTicker((cur) => (cur === ticker ? null : ticker));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-white tracking-tighter">{t.title}</h1>
        <p className="text-white/40 text-sm mt-1">{t.subtitle}</p>
        {lastUpdated && (
          <p className="text-white/30 text-[11px] mt-1">
            {t.lastUpdated}: {new Date(lastUpdated).toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "investment", "swing", "sector"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all border ${
              filter === f ? "bg-blue-500/20 border-blue-500/60 text-blue-400" : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {f === "all" ? t.filterAll : f === "investment" ? t.filterInvestment : f === "swing" ? t.filterSwing : t.filterSector}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-white/40 text-sm">{t.loading}</div>}
      {!loading && error && <div className="text-center py-16 text-red-400 text-sm">{error}</div>}
      {!loading && !error && rows.length === 0 && <div className="text-center py-16 text-white/40 text-sm">{t.empty}</div>}

      {!loading && !error && rows.length > 0 && filter !== "sector" && (
        <div className="overflow-x-auto rounded-lg border border-[#1e2a3a]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#111620] text-white/40 uppercase text-[10px] tracking-wider">
                <th className="px-3 py-2.5">{t.colTicker}</th>
                <th className="px-3 py-2.5 hidden sm:table-cell">{t.colCompany}</th>
                <th className="px-3 py-2.5 text-right">{t.colPrice}</th>
                <th className="px-3 py-2.5 text-right hidden md:table-cell">{t.colVolume}</th>
                <th className="px-3 py-2.5 text-right">{t.colChange}</th>
                <th className="px-3 py-2.5 text-right hidden lg:table-cell">{t.colEma}</th>
                <th className="px-3 py-2.5 text-right hidden xl:table-cell">RSI</th>
                <th className="px-3 py-2.5 text-right hidden xl:table-cell">MACD</th>
                <th className="px-3 py-2.5 text-right hidden xl:table-cell">ADX</th>
                <th className="px-3 py-2.5 hidden lg:table-cell">{t.colPattern}</th>
                <th className="px-3 py-2.5 text-center">{t.colSignal}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const isSwingDaily = r.source === "swing_daily";
                const isExpanded = expandedTicker === r.ticker;
                return (
                  <Fragment key={r.ticker}>
                    <tr
                      onClick={() => toggleExpand(r.ticker)}
                      className={`border-t border-[#1e2a3a] cursor-pointer hover:bg-white/[0.03] transition-colors ${
                        isSwingDaily ? "bg-blue-500/[0.06]" : "bg-[#0d1117]"
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <span className={`font-black ${isSwingDaily ? "text-blue-400" : "text-white"}`}>{r.ticker}</span>
                        {isSwingDaily && (
                          <span className="ml-2 text-[8px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-bold align-middle">
                            {t.swingDailyBadge}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-white/50 hidden sm:table-cell">{r.company || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/90">{r.price != null ? `$${r.price.toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/50 hidden md:table-cell">{fmtVol(r.volume)}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-semibold ${(r.change_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {r.change_pct != null ? `${r.change_pct >= 0 ? "+" : ""}${r.change_pct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/50 hidden lg:table-cell">
                        {r.ema20 != null ? `${r.ema20.toFixed(1)}/${r.ema50?.toFixed(1)}/${r.ema200?.toFixed(1)} ${emaArrow(r.ema20, r.ema50, r.ema200)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/70 hidden xl:table-cell">{r.rsi != null ? r.rsi.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/70 hidden xl:table-cell">{r.macd != null ? r.macd.toFixed(3) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white/70 hidden xl:table-cell">{r.adx != null ? r.adx.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2.5 text-white/50 hidden lg:table-cell">{r.pattern || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${SIGNAL_STYLE[r.signal ?? ""] ?? SIGNAL_STYLE.Bekle}`}>
                          {r.signal || "—"}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#0a0e17]">
                        <td colSpan={11} className="p-0">
                          <TickerDetailPanel ticker={r.ticker} locale={locale} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && rows.length > 0 && filter === "sector" && (
        <div className="space-y-5">
          {Object.entries(sectorGroups).map(([sector, stocks]) => (
            <div key={sector} className="border border-[#1e2a3a] rounded-lg overflow-hidden">
              <div className="bg-[#111620] px-3 py-2 text-xs font-bold text-white/70 uppercase tracking-wide">
                {sector} <span className="text-white/30 font-normal">· {stocks.length}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-1 p-2 bg-[#0a0e17]">
                {stocks.map((s) => (
                  <button
                    key={s.ticker}
                    onClick={() => toggleExpand(s.ticker)}
                    className={`flex flex-col items-center py-2 rounded text-center transition-colors ${
                      (s.change_pct ?? 0) >= 0 ? "bg-green-900/20 hover:bg-green-900/35" : "bg-red-900/20 hover:bg-red-900/35"
                    }`}
                  >
                    <span className="text-[10px] font-black text-white">{s.ticker}</span>
                    <span className={`text-[8px] font-mono ${(s.change_pct ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {s.change_pct != null ? `${s.change_pct >= 0 ? "+" : ""}${s.change_pct.toFixed(1)}%` : "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {expandedTicker && (
            <div className="border border-[#1e2a3a] rounded-lg bg-[#0a0e17]">
              <TickerDetailPanel ticker={expandedTicker} locale={locale} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
