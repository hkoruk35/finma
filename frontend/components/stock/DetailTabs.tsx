"use client";

import { useState, useEffect } from "react";
import AnalysisTabs from "./AnalysisTabs";

interface DetailTabsProps {
  stock: any;
}

const mapStatusToAction = (status: string): string => {
  const statusMap: Record<string, string> = {
    ENTRY_NOW: "🟢 ENTRY NOW",
    ENTRY_WATCH: "🟡 WATCH",
    HOLD: "🟢 HOLD",
    TIGHTEN_STOP: "🟠 TIGHTEN STOP",
    PARTIAL_PROFIT: "🟡 PARTIAL PROFIT",
    TAKE_PROFIT: "🔴 TAKE PROFIT",
    WAIT: "⏳ WAIT",
    STOP_ALERT: "🔴 STOP ALERT",
    STOP_HIT: "🔴 STOP HIT",
  };
  return statusMap[status] || "⏳ TRACKING";
};

export default function DetailTabs({ stock }: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"tracker" | "analysis">("tracker");
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    const fetchHourlyData = async () => {
      try {
        const res = await fetch(`/intraday_signals.json?t=${new Date().getTime()}`);
        if (res.ok) {
          const json = await res.json();
          setLastUpdated(json.generated_at || "");
          const found = json.signals?.find((item: any) => item.ticker === stock.ticker);
          if (found) {
            // Transform intraday_signals data to match expected format
            const transformed = {
              price: found.current_price,
              change_24h: found.intraday.change_24h,
              hourly_action: mapStatusToAction(found.status),
              directive_msg: found.status_detail,
              entry_zone: found.buy_zone ? `${found.buy_zone.low.toFixed(2)} - ${found.buy_zone.high.toFixed(2)}` : 'N/A',
              take_profit: found.profit_zone?.high || 'N/A',
            };
            setHourlyData(transformed);

            // ── DOM SYNC FOR LIVE OVERRIDE (Top Right Price ONLY) ──
            setTimeout(() => {
              const priceEl = document.getElementById("stock-price-current");
              if (priceEl && found.current_price) priceEl.innerText = "$" + found.current_price.toFixed(2);

              const changeEl = document.getElementById("stock-price-change");
              if (changeEl && found.intraday.change_24h !== undefined) {
                const sign = found.intraday.change_24h >= 0 ? "+" : "";
                changeEl.innerText = sign + found.intraday.change_24h.toFixed(2) + "%";
                changeEl.className = `text-xl font-mono font-black leading-none ${found.intraday.change_24h >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`;
              }

              const returns1dEl = document.getElementById("stock-returns-1d");
              if (returns1dEl && found.intraday.change_24h !== undefined) {
                const sign = found.intraday.change_24h >= 0 ? "+" : "";
                returns1dEl.innerText = sign + found.intraday.change_24h.toFixed(2) + "%";
                returns1dEl.className = `text-base md:text-lg font-mono font-black ${found.intraday.change_24h >= 0 ? "text-[#10b981]" : "text-[#ef4444]"}`;
              }
            }, 50);

          } else {
            setHourlyData("not_found");
          }
        } else {
          setHourlyData("error");
        }
      } catch (e) {
        setHourlyData("error");
      } finally {
        setLoading(false);
      }
    };

    fetchHourlyData();
    const interval = setInterval(fetchHourlyData, 60000);
    return () => clearInterval(interval);
  }, [stock.ticker]);

  const getStatusColor = (status: string) => {
    if (status.includes("🔴")) return "text-red-400 bg-red-400/10 border-red-400/20";
    if (status.includes("🟢")) return "text-green-400 bg-green-400/10 border-green-400/20";
    if (status.includes("⚠️")) return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    if (status.includes("⏳")) return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    return "text-gray-400 bg-gray-400/10 border-gray-400/20";
  };

  return (
    <div className="mb-6">
      {/* Tab Nav */}
      <div className="flex items-center gap-2 mb-4 bg-[#141924] p-1.5 rounded-xl border border-[#1e2a3a] w-fit">
        <button
          onClick={() => setActiveTab("tracker")}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
            activeTab === "tracker"
              ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Smart Tracker Hourly
        </button>
        <button
          onClick={() => setActiveTab("analysis")}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest transition-all ${
            activeTab === "analysis"
              ? "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Smart Analysis
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === "analysis" ? (
          <AnalysisTabs stock={stock} />
        ) : (
          <div className="glass-card p-6 md:p-8 border-t-4 border-t-[#3b82f6]">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              </div>
            ) : hourlyData === "not_found" ? (
              <div className="text-center py-16">
                <p className="text-gray-400 font-medium">No hourly data available. Stock will appear during market hours (10:00–16:00 NY).</p>
              </div>
            ) : hourlyData === "error" ? (
              <div className="text-center py-16">
                <p className="text-red-400 font-medium">Failed to load hourly data.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2a3a] pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      Live Hourly Pulse
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Real-time direction and status for {stock.ticker}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#000036] border border-[#30363d]">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Last Update:</span>
                    <span className="text-sm text-[#00d2ff] font-mono font-bold">{lastUpdated}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status Panel */}
                  <div className={`p-6 rounded-2xl border ${getStatusColor(hourlyData.hourly_action)} flex flex-col justify-center items-center text-center h-full`}>
                    <div className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4">
                      {hourlyData.hourly_action}
                    </div>
                    <p className="text-sm md:text-base font-medium opacity-90">
                      {hourlyData.directive_msg}
                    </p>
                  </div>

                  {/* Metrics Panel */}
                  <div className="bg-[#141924] border border-[#1e2a3a] rounded-2xl p-6 grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[10px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Current Price</p>
                      <p className="text-2xl font-mono font-black text-white">${hourlyData.price}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">24H Change</p>
                      <p className={`text-2xl font-mono font-black ${hourlyData.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {hourlyData.change_24h >= 0 ? "+" : ""}{hourlyData.change_24h?.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Entry Zone</p>
                      <p className="text-lg font-mono font-bold text-white">{hourlyData.entry_zone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#00d2ff] uppercase tracking-widest mb-1">Target</p>
                      <p className="text-lg font-mono font-bold text-[#22c55e]">${hourlyData.take_profit || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
