"use client";

import { MasterData } from "@/lib/data";

const INDEX_LABELS: Record<string, string> = {
  SP500: "S&P 500",
  NASDAQ: "NASDAQ",
  DOW: "DOW",
  RUSSELL: "RUSSELL 2000",
  VIX: "VIX",
};

export default function TickerTape({ data }: { data: MasterData }) {
  const indices = data.market_indices;
  const items = Object.entries(indices).map(([key, val]) => ({
    label: INDEX_LABELS[key] || key,
    value: val.value,
    change: val.change_pct,
  }));

  // Duplicate for continuous scroll
  const doubled = [...items, ...items, ...items];

  return (
    <div className="w-full bg-[#0f1420] border-b border-[#1e2a3a] overflow-hidden">
      <div className="ticker-tape flex items-center gap-8 py-2 px-4 whitespace-nowrap">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-[#94a3b8] font-bold uppercase tracking-wider text-[10px]">{item.label}</span>
            <span
              className={`font-mono font-black text-base ${
                item.change >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
              }`}
            >
              {item.change >= 0 ? "+" : ""}
              {item.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
