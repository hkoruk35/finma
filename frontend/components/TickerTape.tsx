"use client";

import { MasterData } from "@/lib/data";

const INDEX_LABELS: Record<string, string> = {
  SP500: "SP500",
  NASDAQ: "NASDAQ",
  DOW: "DOW",
  RUSSELL: "RUSSELL",
  VIX: "VIX",
};

type Indices = Record<string, { value: number; change_pct: number }>;

interface Props {
  data?: MasterData;
  indices?: Indices;
}

export default function TickerTape({ data, indices }: Props) {
  const source = indices ?? data?.market_indices ?? {};
  const items = Object.entries(source).map(([key, val]) => ({
    label: INDEX_LABELS[key] || key,
    value: val.value,
    change: val.change_pct,
  }));

  if (items.length === 0) return null;

  // Duplicate for continuous scroll
  const doubled = [...items, ...items, ...items];

  return (
    <div className="w-full bg-[#000000] border-b border-[#1e2a3a] overflow-x-auto no-scrollbar scroll-smooth">
      <div className="ticker-tape flex items-center gap-8 py-2 px-4 whitespace-nowrap min-w-max">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs shrink-0">
            <span className="text-white font-medium uppercase tracking-wider text-[9px]">{item.label}</span>
            <span className="font-mono text-white/70 text-[11px]">{item.value.toFixed(2)}</span>
            <span
              className="font-mono font-medium text-[11px]"
              style={{ color: item.change >= 0 ? "#22c55e" : "#ef4444" }}
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
