"use client";

import type { DailyStats } from "@/lib/kriter-helpers";

interface Props {
  dailyTrend: DailyStats[];
}

export default function DailyTrendMiniChart({ dailyTrend }: Props) {
  const maxTotal = Math.max(...dailyTrend.map((d) => d.total), 1);

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded p-4 font-mono">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">
        10 Günlük Trend — Günlük Win Rate
      </div>
      <div className="flex items-end gap-1 h-20">
        {dailyTrend.map((day) => {
          const heightPct = day.total > 0 ? (day.total / maxTotal) * 100 : 5;
          const wr = day.win + day.loss > 0 ? day.win_rate : -1;
          const barColor =
            wr < 0 ? "bg-gray-700" : wr >= 60 ? "bg-green-500" : wr >= 40 ? "bg-yellow-500" : "bg-red-500";

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex items-end justify-center" style={{ height: "60px" }}>
                <div
                  className={`w-full rounded-t transition-all ${barColor} opacity-80 group-hover:opacity-100`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <div className="text-[8px] text-gray-600 rotate-45 origin-left whitespace-nowrap">
                {day.date.slice(5)}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1f2e] border border-white/20 rounded p-2 text-[10px] whitespace-nowrap hidden group-hover:block z-10 pointer-events-none">
                <div className="text-white font-bold">{day.date}</div>
                <div className="text-green-400">WIN: {day.win}</div>
                <div className="text-red-400">LOSS: {day.loss}</div>
                <div className="text-yellow-400">BEKLEYEN: {day.pending}</div>
                {wr >= 0 && <div className="text-cyan-400">Win rate: %{wr}</div>}
                <div className="text-gray-400">{day.dominant_system}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-[9px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500 inline-block" /> ≥%60</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500 inline-block" /> %40-60</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500 inline-block" /> &lt;%40</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-gray-700 inline-block" /> Tamamlanmadı</span>
      </div>
    </div>
  );
}
