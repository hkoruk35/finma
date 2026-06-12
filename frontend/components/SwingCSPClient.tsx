"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CSPNavigation from "@/components/CSPNavigation";

interface SwingPick {
  ticker: string;
  company: string;
  sector?: string;
  current_price: number;
  buy_zone?: { low: number; high: number };
  profit_zone?: { low: number; high: number };
  stop_zone?: { low: number; high: number };
  change_1d?: number;
  change_1w?: number;
  change_1m?: number;
  change_1y?: number;
  change_5y?: number;
  score?: number;
}

export default function SwingCSPClient() {
  const [picks, setPicks] = useState<SwingPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "list">("table");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetchSwingData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/swing_all_picks.json?v=" + Date.now(), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setPicks(data.picks ?? []);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("[SwingCSP] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSwingData();
  }, []);

  const formatPrice = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmt1 = (n: number | undefined) =>
    n !== undefined && isFinite(n) ? n.toFixed(1) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#6b7280] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b7280]">
            BOGA AI · CSP SWING
          </span>
        </div>
        <h1 className="text-2xl font-black uppercase text-white leading-tight">
          Swing Picks Watchlist
        </h1>
        <p className="text-[11px] text-white/50 uppercase tracking-widest mt-2">
          Günlük swing ticaret adayları — BOGA AI V117 Engine
        </p>
        {lastUpdated && (
          <div className="text-[11px] text-white/40 mt-3">
            Son güncelleme: {lastUpdated.toLocaleString("tr-TR")}
          </div>
        )}
      </div>

      {/* Navigation */}
      <CSPNavigation active="/csp/swing" />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["table", "list"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-black uppercase rounded-lg transition-all border ${
              activeTab === tab
                ? "bg-[#6b7280]/20 border-[#6b7280] text-[#6b7280]"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {tab === "table" ? "TABLO" : "LİSTE"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-[#6b7280]">
          <span className="animate-pulse">Yükleniyor...</span>
        </div>
      )}

      {/* Table View */}
      {!loading && activeTab === "table" && (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[#6b7280]">
                  TİCKER
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/50">
                  ŞIRKET
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/50">
                  SEKTÖR
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  FİYAT
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  ALIM
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  HEDEF
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  STOP
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  1D%
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  1W%
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  1M%
                </th>
              </tr>
            </thead>
            <tbody>
              {picks.map((pick, idx) => (
                <tr
                  key={pick.ticker}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedRow(expandedRow === pick.ticker ? null : pick.ticker)
                  }
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${pick.ticker}`}
                      className="text-[#6b7280] font-black hover:underline"
                    >
                      {pick.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {pick.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {pick.sector || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white">
                    ${formatPrice(pick.current_price)}
                  </td>
                  <td className="px-4 py-3 text-right text-white/70 text-xs">
                    {pick.buy_zone
                      ? `$${formatPrice(pick.buy_zone.low)}–${formatPrice(
                          pick.buy_zone.high
                        )}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#10b981] text-xs font-bold">
                    {pick.profit_zone
                      ? `$${formatPrice(pick.profit_zone.low)}–${formatPrice(
                          pick.profit_zone.high
                        )}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#ef4444] text-xs">
                    {pick.stop_zone
                      ? `$${formatPrice(pick.stop_zone.low)}–${formatPrice(
                          pick.stop_zone.high
                        )}`
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-xs font-bold ${
                      (pick.change_1d ?? 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}
                  >
                    {pick.change_1d ? (
                      `${pick.change_1d >= 0 ? "+" : ""}${fmt1(pick.change_1d)}%`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-xs font-bold ${
                      (pick.change_1w ?? 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}
                  >
                    {pick.change_1w ? (
                      `${pick.change_1w >= 0 ? "+" : ""}${fmt1(pick.change_1w)}%`
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right text-xs font-bold ${
                      (pick.change_1m ?? 0) >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}
                  >
                    {pick.change_1m ? (
                      `${pick.change_1m >= 0 ? "+" : ""}${fmt1(pick.change_1m)}%`
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* List View */}
      {!loading && activeTab === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {picks.map((pick) => (
            <div
              key={pick.ticker}
              className="border border-white/10 rounded-lg p-4 hover:border-[#6b7280]/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`/stock/${pick.ticker}`}
                  className="text-[#6b7280] font-black text-lg hover:underline"
                >
                  {pick.ticker}
                </Link>
              </div>
              <div className="text-white/50 text-xs mb-3">{pick.company}</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Fiyat:</span>
                  <span className="text-white font-bold">
                    ${formatPrice(pick.current_price)}
                  </span>
                </div>
                {pick.buy_zone && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Alım:</span>
                    <span className="text-white/70">
                      ${formatPrice(pick.buy_zone.low)}–${formatPrice(
                        pick.buy_zone.high
                      )}
                    </span>
                  </div>
                )}
                {pick.profit_zone && (
                  <div className="flex justify-between">
                    <span className="text-white/50">Hedef:</span>
                    <span className="text-[#10b981]">
                      ${formatPrice(pick.profit_zone.low)}–${formatPrice(
                        pick.profit_zone.high
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && picks.length === 0 && (
        <div className="text-center py-12 text-white/40">
          Veri bulunamadı.
        </div>
      )}
    </div>
  );
}
