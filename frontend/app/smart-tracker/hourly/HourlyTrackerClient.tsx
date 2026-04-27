"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSmartTracker } from "@/components/SmartTrackerContext";

type Signal = {
  ticker: string;
  company: string;
  sector: string;
  swing_pick_date: string;
  days_since_pick: number;
  current_price: number;
  buy_zone: { low: number; high: number };
  stop_zone: { low: number; high: number };
  profit_zone: { low: number; high: number };
  status: string;
  status_detail: string;
  alert_level: string;
  intraday: {
    rsi_1h: number;
    adx_1h: number;
    volume_ratio: number;
    change_1h: number;
    change_24h: number;
    trend_1h: string;
    setup: string;
    rs_score: number;
    natr: number;
  };
  notes: string[];
};

type IntraData = {
  generated_at: string;
  hour_slot: string;
  market_regime: string;
  vix_level: number;
  total_scanned: number;
  signals: Signal[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ENTRY_NOW:      { label: "Entry Now",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", dot: "bg-emerald-400" },
  ENTRY_WATCH:    { label: "Watch",          color: "text-blue-400 bg-blue-400/10 border-blue-400/30",         dot: "bg-blue-400" },
  HOLD:           { label: "Hold",           color: "text-teal-400 bg-teal-400/10 border-teal-400/30",         dot: "bg-teal-400" },
  TIGHTEN_STOP:   { label: "Tighten Stop",   color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",         dot: "bg-cyan-400" },
  PARTIAL_PROFIT: { label: "Partial Profit", color: "text-amber-400 bg-amber-400/10 border-amber-400/30",      dot: "bg-amber-400" },
  TAKE_PROFIT:    { label: "Take Profit",    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",   dot: "bg-purple-400" },
  WAIT:           { label: "Wait",           color: "text-slate-400 bg-slate-400/10 border-slate-400/30",      dot: "bg-slate-400" },
  STOP_ALERT:     { label: "Stop Alert",     color: "text-red-400 bg-red-400/10 border-red-400/30",            dot: "bg-red-400" },
  STOP_HIT:       { label: "Stop Hit",       color: "text-red-600 bg-red-600/10 border-red-600/30",            dot: "bg-red-600" },
  POSITION_OK:    { label: "Position OK",    color: "text-teal-400 bg-teal-400/10 border-teal-400/30",         dot: "bg-teal-400" },
  PARTIAL_EXIT:   { label: "Partial Exit",   color: "text-amber-400 bg-amber-400/10 border-amber-400/30",      dot: "bg-amber-400" },
  FULL_EXIT:      { label: "Exit",           color: "text-purple-400 bg-purple-400/10 border-purple-400/30",   dot: "bg-purple-400" },
  INVALIDATED:    { label: "Invalidated",    color: "text-gray-500 bg-gray-500/10 border-gray-500/30",         dot: "bg-gray-500" },
};

function fmt(n: number | undefined, dec = 2) {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(dec);
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.ENTRY_WATCH;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function HourlyTrackerClient({ initialData }: { initialData: IntraData | null }) {
  const [data, setData] = useState<IntraData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [filter, setFilter] = useState<"all" | "tracker" | "entry" | "alert">("all");
  const [manualRefresh, setManualRefresh] = useState(false);

  const { activeTracker } = useSmartTracker();
  const trackedTickers = useMemo(
    () => new Set(activeTracker?.positions.filter(p => p.status !== "closed").map(p => p.ticker) ?? []),
    [activeTracker]
  );

  const fetchData = async () => {
    try {
      const res = await fetch(`/intraday_signals.json?v=${Date.now()}`);
      if (res.ok) setData(await res.json());
    } catch { /* keep existing data */ }
    finally { setLoading(false); setManualRefresh(false); }
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, []);

  const signals = useMemo(() => {
    const all = data?.signals ?? [];
    if (filter === "tracker") return all.filter(s => trackedTickers.has(s.ticker));
    if (filter === "entry")   return all.filter(s => s.status === "ENTRY_NOW");
    if (filter === "alert")   return all.filter(s => s.status === "STOP_ALERT");
    return all;
  }, [data, filter, trackedTickers]);

  const counts = useMemo(() => {
    const all = data?.signals ?? [];
    return {
      all:     all.length,
      tracker: all.filter(s => trackedTickers.has(s.ticker)).length,
      entry:   all.filter(s => s.status === "ENTRY_NOW").length,
      alert:   all.filter(s => s.status === "STOP_ALERT").length,
    };
  }, [data, trackedTickers]);

  const lastUpdated = useMemo(() => {
    if (!data?.generated_at) return null;
    try {
      return new Date(data.generated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" }) + " NY";
    } catch { return data.generated_at; }
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!data || !data.signals?.length) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-10 text-center">
        <p className="text-2xl mb-2">⏳</p>
        <h2 className="text-xl text-white font-bold mb-2">Waiting for hourly scan</h2>
        <p className="text-gray-400 text-sm">inday313.py runs during market hours (10:00–16:00 NY).</p>
      </div>
    );
  }

  const TABS = [
    { key: "all",     label: "All",          count: counts.all },
    { key: "tracker", label: "Smart Tracker", count: counts.tracker },
    { key: "entry",   label: "Entry Now",    count: counts.entry },
    { key: "alert",   label: "Stop Alert",   count: counts.alert },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#161b22] border border-[#30363d] p-5 rounded-2xl">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            Hourly Intraday Pulse
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Scanning {data.total_scanned} swing picks from last 30 days, updated hourly
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs font-medium">
            <span className="text-gray-500">Regime: </span>
            <span className={data.market_regime === "BULLISH" ? "text-emerald-400" : data.market_regime === "BEARISH" ? "text-red-400" : "text-amber-400"}>
              {data.market_regime}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs font-medium">
            <span className="text-gray-500">VIX: </span>
            <span className="text-white">{fmt(data.vix_level, 1)}</span>
          </div>
          {lastUpdated && (
            <div className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-xs font-mono text-gray-400">
              {lastUpdated}
            </div>
          )}
          <button
            onClick={() => {
              setManualRefresh(true);
              fetchData();
            }}
            disabled={manualRefresh}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 border border-blue-500/50 text-xs font-medium text-white transition-colors"
          >
            {manualRefresh ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              filter === tab.key
                ? "bg-blue-600 text-white"
                : "bg-[#161b22] border border-[#30363d] text-gray-400 hover:text-white hover:border-[#484f58]"
            }`}
          >
            {tab.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${filter === tab.key ? "bg-white/20 text-white" : "bg-[#30363d] text-gray-400"}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {signals.length === 0 ? (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8 text-center text-gray-500 text-sm">
          No signals for this filter.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[#00d2ff] text-[11px] uppercase tracking-wider bg-[#0d1117]/60">
                    <th className="px-4 py-3 text-left">Ticker</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Buy Zone</th>
                    <th className="px-4 py-3 text-left">Stop Zone</th>
                    <th className="px-4 py-3 text-left">Target</th>
                    <th className="px-4 py-3 text-left">RSI/Vol</th>
                    <th className="px-4 py-3 text-left">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s) => {
                    const inTracker = trackedTickers.has(s.ticker);
                    const chg = s.intraday.change_24h;
                    return (
                      <tr
                        key={s.ticker}
                        className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${inTracker ? "bg-blue-900/10" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <Link href={`/stock/${s.ticker}`} className="group flex items-center gap-2">
                            {inTracker && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" title="In Smart Tracker" />
                            )}
                            <div>
                              <div className="font-black text-white text-[15px] group-hover:text-blue-400 transition-colors">{s.ticker}</div>
                              <div className="text-[11px] text-gray-500">{s.sector}</div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-mono font-bold text-white">${fmt(s.current_price)}</div>
                          <div className={`text-[11px] font-mono ${chg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {chg >= 0 ? "+" : ""}{fmt(chg)}%
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-gray-300">
                          {s.buy_zone?.low ? `$${fmt(s.buy_zone.low)}–${fmt(s.buy_zone.high)}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-red-400">
                          {s.stop_zone?.high ? `$${fmt(s.stop_zone.high)}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[12px] text-emerald-400">
                          {s.profit_zone?.high ? `$${fmt(s.profit_zone.high)}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[11px] text-gray-400 space-y-0.5">
                            <div>RSI <span className={s.intraday.rsi_1h > 70 ? "text-red-400" : s.intraday.rsi_1h < 35 ? "text-emerald-400" : "text-white"}>{fmt(s.intraday.rsi_1h, 0)}</span></div>
                            <div>Vol <span className={s.intraday.volume_ratio >= 1.5 ? "text-emerald-400" : "text-white"}>{fmt(s.intraday.volume_ratio, 1)}x</span></div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[11px] text-gray-500 leading-relaxed max-w-[220px] line-clamp-2">
                            {s.status_detail}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {signals.map((s) => {
              const inTracker = trackedTickers.has(s.ticker);
              const chg = s.intraday.change_24h;
              return (
                <div
                  key={s.ticker}
                  className={`bg-[#161b22] border rounded-xl p-4 space-y-3 ${inTracker ? "border-blue-500/40" : "border-[#30363d]"}`}
                >
                  <div className="flex items-start justify-between">
                    <Link href={`/stock/${s.ticker}`} className="flex items-center gap-2">
                      {inTracker && <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 flex-shrink-0" />}
                      <div>
                        <div className="font-black text-white text-lg">{s.ticker}</div>
                        <div className="text-xs text-gray-500">{s.sector}</div>
                      </div>
                    </Link>
                    <div className="text-right">
                      <div className="font-mono font-bold text-white">${fmt(s.current_price)}</div>
                      <div className={`text-xs font-mono ${chg >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {chg >= 0 ? "+" : ""}{fmt(chg)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <StatusBadge status={s.status} />
                    <span className="text-[11px] text-gray-600">{s.days_since_pick}d ago</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="bg-[#0d1117] rounded-lg p-2">
                      <div className="text-gray-500 mb-0.5">Buy Zone</div>
                      <div className="text-white font-mono">{s.buy_zone?.low ? `$${fmt(s.buy_zone.low)}` : "—"}</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg p-2">
                      <div className="text-gray-500 mb-0.5">Stop</div>
                      <div className="text-red-400 font-mono">{s.stop_zone?.high ? `$${fmt(s.stop_zone.high)}` : "—"}</div>
                    </div>
                    <div className="bg-[#0d1117] rounded-lg p-2">
                      <div className="text-gray-500 mb-0.5">Target</div>
                      <div className="text-emerald-400 font-mono">{s.profit_zone?.high ? `$${fmt(s.profit_zone.high)}` : "—"}</div>
                    </div>
                  </div>

                  {s.status_detail && (
                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{s.status_detail}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
