"use client";

import { MasterData } from "@/lib/data";
import { formatNumber } from "@/lib/formatNumber";

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
  labels?: Record<string, string>;
}

export default function TickerTape({ data, indices, labels }: Props) {
  const source = indices ?? data?.market_indices ?? {};
  const labelMap = labels ?? INDEX_LABELS;
  const items = Object.entries(source).map(([key, val]) => ({
    label: labelMap[key] || key,
    value: val.value,
    change: val.change_pct,
  }));

  if (items.length === 0) return null;

  // Duplicate for continuous scroll — 2nd/3rd copies are visual filler only,
  // marked aria-hidden so screen readers and crawlers don't see repeated text.
  const renderRow = (hidden: boolean, keyPrefix: string) =>
    items.map((item, i) => (
      <div key={`${keyPrefix}-${i}`} className="flex items-center gap-1.5 shrink-0" aria-hidden={hidden || undefined}>
        <span className="text-boga-text-secondary font-normal tracking-normal text-[11px]">{item.label}</span>
        <span className="font-mono text-boga-text-primary/80 text-[11px]">{formatNumber(item.value, 2)}</span>
        <span
          className="font-mono font-normal text-[11px]"
          style={{ color: item.change >= 0 ? "var(--color-boga-gain)" : "var(--color-boga-loss)", opacity: 0.9 }}
        >
          {item.change >= 0 ? "+" : ""}
          {formatNumber(item.change, 2)}%
        </span>
        {i < items.length - 1 && <span className="text-boga-border text-[10px] select-none">·</span>}
      </div>
    ));

  return (
    <div className="w-full bg-boga-bg-alt/70 border-b border-boga-border/60 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="ticker-tape-slow flex items-center gap-5 py-1 px-4 whitespace-nowrap min-w-max">
        {renderRow(false, "a")}
        {renderRow(true, "b")}
        {renderRow(true, "c")}
      </div>
    </div>
  );
}
