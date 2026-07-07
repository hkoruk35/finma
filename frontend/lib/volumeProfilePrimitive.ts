// Fixed Range Volume Profile — bucketing logic only. Rendered as an
// absolutely-positioned DOM overlay in BogaChartEngine (not a
// lightweight-charts canvas primitive) — the primitives API's paint
// lifecycle (paneViews/renderer/draw) proved unreliable to invoke
// consistently in this setup, while a plain React-state-driven overlay
// using the same priceToCoordinate/logicalToCoordinate APIs is something
// this codebase already relies on elsewhere (BOGA watermark, OHLCV
// readout) and is trivial to keep correct.
export interface VPRow {
  price: number;
  volume: number;
}

// Buckets volume by price across the given bars — the "fixed range" is
// whatever bars are currently loaded (the chart's visible data window).
// Each bar's volume is spread evenly across the buckets its high-low range
// touches, matching how real volume-profile tools apportion intrabar volume.
export function computeVolumeProfile(
  bars: { high: number; low: number; volume: number }[],
  buckets = 24
): VPRow[] {
  if (bars.length === 0) return [];
  const lo = Math.min(...bars.map((b) => b.low));
  const hi = Math.max(...bars.map((b) => b.high));
  if (hi <= lo) return [];
  const step = (hi - lo) / buckets;
  const rows: VPRow[] = Array.from({ length: buckets }, (_, i) => ({ price: lo + step * (i + 0.5), volume: 0 }));
  for (const b of bars) {
    const startIdx = Math.max(0, Math.min(buckets - 1, Math.floor((b.low - lo) / step)));
    const endIdx = Math.max(0, Math.min(buckets - 1, Math.floor((b.high - lo) / step)));
    const span = endIdx - startIdx + 1;
    for (let i = startIdx; i <= endIdx; i++) rows[i].volume += b.volume / span;
  }
  return rows;
}
