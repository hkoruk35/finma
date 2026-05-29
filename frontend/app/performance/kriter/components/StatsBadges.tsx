"use client";

import type { AggregateStats } from "@/lib/kriter-helpers";

interface Props {
  stats: AggregateStats;
}

function Badge({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "green" | "red" | "yellow" | "cyan" | "white";
}) {
  const colors = {
    green: "text-green-400 border-green-900/40",
    red: "text-red-400 border-red-900/40",
    yellow: "text-yellow-400 border-yellow-900/40",
    cyan: "text-cyan-400 border-cyan-900/40",
    white: "text-white border-white/10",
  };

  return (
    <div className={`bg-[#0d1117] border ${colors[color]} rounded p-3 font-mono`}>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold ${colors[color].split(" ")[0]}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function StatsBadges({ stats }: Props) {
  const completedTotal = stats.win + stats.loss;
  const winRateStr = completedTotal > 0 ? `%${stats.win_rate}` : "N/A";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Badge
        label="Toplam Trade"
        value={String(stats.total)}
        sub={`${stats.date_range.from} → ${stats.date_range.to}`}
        color="white"
      />
      <Badge
        label="WIN / LOSS / BEKLEYEN"
        value={`${stats.win} / ${stats.loss} / ${stats.pending}`}
        sub={`Win rate: ${winRateStr}`}
        color={stats.win_rate >= 50 ? "green" : "red"}
      />
      <Badge
        label="Ort. Kazanç (WIN)"
        value={stats.avg_return_win > 0 ? `+%${stats.avg_return_win}` : "%0"}
        sub={`Tüm ortalama: ${stats.avg_return_all >= 0 ? "+" : ""}%${stats.avg_return_all}`}
        color="cyan"
      />
      <Badge
        label="Momentum Sistemi"
        value={`%${stats.momentum_win_rate}`}
        sub={`${stats.momentum_win}/${stats.momentum_total} tamamlandı`}
        color={stats.momentum_win_rate >= 50 ? "green" : "yellow"}
      />
      <Badge
        label="Breakout Sistemi"
        value={`%${stats.breakout_win_rate}`}
        sub={`${stats.breakout_win}/${stats.breakout_total} tamamlandı`}
        color={stats.breakout_win_rate >= 50 ? "green" : "yellow"}
      />
    </div>
  );
}
