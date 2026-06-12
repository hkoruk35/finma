"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CSPNavigation from "@/components/CSPNavigation";

interface DailyTicker {
  ticker: string;
  company: string;
  sector: string;
  current_price: number;
  current_status: string;
  alert_level: string;
  pnl_pct: number;
  buy_zone?: { low?: number; high?: number };
  stop_zone?: { low?: number; high?: number };
  profit_zone?: { low?: number; high?: number };
  intraday?: {
    rsi_1h?: number;
    volume_ratio?: number;
    change_1h?: number;
  };
}

export default function DailyCSPClient() {
  const [tickers, setTickers] = useState<DailyTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"table" | "list">("table");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/daily?date=today&v=" + Date.now(), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setTickers(data.tickers ?? []);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("[DailyCSP] fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyData();
  }, []);

  const formatPrice = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmt2 = (n: number | undefined) =>
    n !== undefined && isFinite(n) ? n.toFixed(2) : "—";

  const fmt1 = (n: number | undefined) =>
    n !== undefined && isFinite(n) ? n.toFixed(1) : "—";

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      ENTRY_NOW: "text-[#56d364]",
      ENTRY_WATCH: "text-[#e3b341]",
      HOLD: "text-[#58a6ff]",
      TAKE_PROFIT: "text-[#d2a8ff]",
      STOP_HIT: "text-[#f85149]",
    };
    return map[status] || "text-white/50";
  };

  const getAlertColor = (level: string) => {
    const map: Record<string, string> = {
      HIGH: "text-[#56d364]",
      MEDIUM: "text-[#e3b341]",
      LOW: "text-white/50",
    };
    return map[level] || "text-white/50";
  };

  const filtered = filterStatus
    ? tickers.filter((t) => t.current_status === filterStatus)
    : tickers;

  const statuses = Array.from(new Set(tickers.map((t) => t.current_status)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f59e0b]">
            BOGA AI · CSP DAILY
          </span>
        </div>
        <h1 className="text-2xl font-black uppercase text-white leading-tight">
          Daily Intraday Watchlist
        </h1>
        <p className="text-[11px] text-white/50 uppercase tracking-widest mt-2">
          Günlük intraday takip hisseleri — Saatlik güncellemeler
        </p>
        {lastUpdated && (
          <div className="text-[11px] text-white/40 mt-3">
            Son güncelleme: {lastUpdated.toLocaleString("tr-TR")}
          </div>
        )}
      </div>

      {/* Navigation */}
      <CSPNavigation active="/csp/daily" />

      {/* Filters & Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterStatus("")}
          className={`px-4 py-2 text-sm font-black uppercase rounded-lg transition-all border ${
            filterStatus === ""
              ? "bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]"
              : "border-white/10 text-white/40 hover:text-white/70"
          }`}
        >
          TÜM DURUM ({tickers.length})
        </button>
        {statuses.map((status) => {
          const count = tickers.filter((t) => t.current_status === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 text-sm font-black uppercase rounded-lg transition-all border ${
                filterStatus === status
                  ? `${getStatusColor(status)} bg-white/5 border-current`
                  : "border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              {status} ({count})
            </button>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["table", "list"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-black uppercase rounded-lg transition-all border ${
              activeTab === tab
                ? "bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {tab === "table" ? "TABLO" : "LİSTE"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-[#f59e0b]">
          <span className="animate-pulse">Yükleniyor...</span>
        </div>
      )}

      {/* Table View */}
      {!loading && activeTab === "table" && (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[#f59e0b]">
                  DURUM
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/50">
                  TİCKER
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/50">
                  ŞIRKET
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  FİYAT
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  1H%
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  RSI
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  VOL
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-wider text-white/50">
                  ALERT
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticker) => (
                <tr
                  key={ticker.ticker}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() =>
                    setExpandedRow(
                      expandedRow === ticker.ticker ? null : ticker.ticker
                    )
                  }
                >
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-black uppercase ${getStatusColor(
                        ticker.current_status
                      )}`}
                    >
                      {ticker.current_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${ticker.ticker}`}
                      className="text-[#f59e0b] font-black hover:underline"
                    >
                      {ticker.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">
                    {ticker.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white">
                    ${formatPrice(ticker.current_price)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold text-xs ${
                      (ticker.intraday?.change_1h ?? 0) >= 0
                        ? "text-[#10b981]"
                        : "text-[#ef4444]"
                    }`}
                  >
                    {ticker.intraday?.change_1h
                      ? `${ticker.intraday.change_1h >= 0 ? "+" : ""}${fmt2(
                          ticker.intraday.change_1h
                        )}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-white/50">
                    {fmt1(ticker.intraday?.rsi_1h)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-white/50">
                    {ticker.intraday?.volume_ratio
                      ? `${fmt2(ticker.intraday.volume_ratio)}x`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-[10px] font-black uppercase ${getAlertColor(
                        ticker.alert_level
                      )}`}
                    >
                      {ticker.alert_level}
                    </span>
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
          {filtered.map((ticker) => (
            <div
              key={ticker.ticker}
              className="border border-white/10 rounded-lg p-4 hover:border-[#f59e0b]/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`/stock/${ticker.ticker}`}
                  className="text-[#f59e0b] font-black text-lg hover:underline"
                >
                  {ticker.ticker}
                </Link>
                <span
                  className={`text-[10px] font-black uppercase ${getStatusColor(
                    ticker.current_status
                  )}`}
                >
                  {ticker.current_status}
                </span>
              </div>
              <div className="text-white/50 text-xs mb-3">{ticker.company}</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/50">Fiyat:</span>
                  <span className="text-white font-bold">
                    ${formatPrice(ticker.current_price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">1H:</span>
                  <span
                    className={
                      (ticker.intraday?.change_1h ?? 0) >= 0
                        ? "text-[#10b981]"
                        : "text-[#ef4444]"
                    }
                  >
                    {ticker.intraday?.change_1h
                      ? `${ticker.intraday.change_1h >= 0 ? "+" : ""}${fmt2(
                          ticker.intraday.change_1h
                        )}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-white/40">
          {filterStatus ? "Bu duruma ait hisse yok." : "Veri bulunamadı."}
        </div>
      )}
    </div>
  );
}
