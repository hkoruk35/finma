"use client";

import BogaChartEngine from "@/components/charts/BogaChartEngine";

interface Props {
  symbol: string;
  height?: string;
}

export default function MiniChart({ symbol, height = "180" }: Props) {
  return (
    <div style={{ width: "100%", height: Number(height) }}>
      <BogaChartEngine symbol={symbol} interval="W" height={Number(height)} compact showToolbar={false} indicators={["ema9"]} />
    </div>
  );
}
