"use client";

import { MasterData } from "@/lib/data";

export default function StatsBar({ data }: { data: MasterData }) {
  const time = new Date(data.generated_at).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
      {/* Active Scores */}
      <div className="glass-card p-4 text-center">
        <div className="text-3xl font-bold font-mono text-[#3b82f6]">
          {data.active_scores_count}
        </div>
        <div className="text-xs text-[#94a3b8] uppercase tracking-wider mt-1">
          Active Scores
        </div>
      </div>

      {/* Tickers Scanned */}
      <div className="glass-card p-4 text-center">
        <div className="text-3xl font-bold font-mono text-[#f1f5f9]">
          {data.total_tickers_scanned >= 500 ? `+${Math.floor(data.total_tickers_scanned / 100) * 100}` : data.total_tickers_scanned}
        </div>
        <div className="text-xs text-[#94a3b8] uppercase tracking-wider mt-1">
          Analyzed Today
        </div>
      </div>

      {/* Market Regime */}
      <div className="glass-card p-4 text-center">
        <div className={`text-3xl font-bold ${
          data.market_regime === "Bull" ? "text-[#22c55e]" :
          data.market_regime === "Bear" ? "text-[#ef4444]" : "text-[#f59e0b]"
        }`}>
          {data.market_regime === "Bull" ? "BULL" :
           data.market_regime === "Bear" ? "BEAR" : "NEUTRAL"}
        </div>
        <div className="text-xs text-[#94a3b8] uppercase tracking-wider mt-1">
          Market Regime
        </div>
      </div>

      {/* Last Updated */}
      <div className="glass-card p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] live-dot" />
          <span className="text-lg font-mono text-[#f1f5f9]">{time}</span>
        </div>
        <div className="text-xs text-[#94a3b8] uppercase tracking-wider mt-1">
          Last Updated (ET)
        </div>
      </div>
    </div>
  );
}
