// Fixed Range Volume Profile — a lightweight-charts v5 primitive
// (attachPrimitive/ISeriesPrimitive), adapted from TradingView's own
// plugin-examples pattern. Renders a horizontal histogram of volume-by-price
// near the right edge of the chart, with the POC (point of control — the
// price level with the most volume) highlighted in a distinct color.
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  AutoscaleInfo,
  Coordinate,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  Logical,
  SeriesType,
  Time,
} from "lightweight-charts";

export interface VPRow {
  price: number;
  volume: number;
}

function positionsBox(pos1: number, pos2: number, pixelRatio: number) {
  const p1 = Math.round(pixelRatio * pos1);
  const p2 = Math.round(pixelRatio * pos2);
  return { position: Math.min(p1, p2), length: Math.abs(p2 - p1) + 1 };
}

interface RowItem {
  y: Coordinate | null;
  width: number;
  isPoc: boolean;
}

interface RendererData {
  x: Coordinate | null;
  rowHeight: number;
  items: RowItem[];
}

class VolumeProfileRenderer implements IPrimitivePaneRenderer {
  constructor(private data: RendererData) {}

  draw(target: CanvasRenderingTarget2D) {
    target.useBitmapCoordinateSpace((scope) => {
      if (this.data.x === null) return;
      const ctx = scope.context;
      for (const row of this.data.items) {
        if (row.y === null) return;
        const yPos = positionsBox(row.y, row.y - this.data.rowHeight, scope.verticalPixelRatio);
        const xPos = positionsBox(this.data.x!, this.data.x! + row.width, scope.horizontalPixelRatio);
        ctx.fillStyle = row.isPoc ? "rgba(234,179,8,0.85)" : "rgba(59,130,246,0.35)";
        ctx.fillRect(xPos.position, yPos.position, xPos.length, Math.max(1, yPos.length - 1));
      }
    });
  }
}

class VolumeProfilePaneView implements IPrimitivePaneView {
  private _x: Coordinate | null = null;
  private _rowHeight = 0;
  private _items: RowItem[] = [];

  constructor(private source: BogaVolumeProfile) {}

  update() {
    const { rows, anchorTime, widthBars, series, chart } = this.source;
    if (rows.length === 0) {
      this._items = [];
      return;
    }
    const timeScale = chart.timeScale();
    this._x = timeScale.timeToCoordinate(anchorTime);
    const maxWidth = timeScale.options().barSpacing * widthBars;

    const step = rows.length > 1 ? Math.abs(rows[0].price - rows[1].price) : 1;
    const y1 = series.priceToCoordinate(rows[0].price + step / 2) ?? (0 as Coordinate);
    const y2 = series.priceToCoordinate(rows[0].price - step / 2) ?? (0 as Coordinate);
    this._rowHeight = Math.max(1, Math.abs(y2 - y1));

    const maxVol = Math.max(...rows.map((r) => r.volume), 1);
    this._items = rows.map((r) => ({
      y: series.priceToCoordinate(r.price),
      width: this._x !== null ? (maxWidth * r.volume) / maxVol : 0,
      isPoc: r.volume === maxVol,
    }));
  }

  renderer() {
    return new VolumeProfileRenderer({ x: this._x, rowHeight: this._rowHeight, items: this._items });
  }
}

export class BogaVolumeProfile implements ISeriesPrimitive<Time> {
  private _paneViews: VolumeProfilePaneView[];
  private _minPrice = Infinity;
  private _maxPrice = -Infinity;

  constructor(
    public chart: IChartApi,
    public series: ISeriesApi<SeriesType>,
    public rows: VPRow[],
    public anchorTime: Time,
    public widthBars: number
  ) {
    this._recalcRange();
    this._paneViews = [new VolumeProfilePaneView(this)];
  }

  private _recalcRange() {
    this._minPrice = Infinity;
    this._maxPrice = -Infinity;
    for (const r of this.rows) {
      if (r.price < this._minPrice) this._minPrice = r.price;
      if (r.price > this._maxPrice) this._maxPrice = r.price;
    }
  }

  updateData(rows: VPRow[], anchorTime: Time, widthBars: number) {
    this.rows = rows;
    this.anchorTime = anchorTime;
    this.widthBars = widthBars;
    this._recalcRange();
  }

  updateAllViews() {
    this._paneViews.forEach((v) => v.update());
  }

  paneViews() {
    return this._paneViews;
  }

  autoscaleInfo(_start: Logical, _end: Logical): AutoscaleInfo | null {
    if (this.rows.length === 0) return null;
    return { priceRange: { minValue: this._minPrice, maxValue: this._maxPrice } };
  }
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
  return rows.reverse(); // highest price first, so priceToCoordinate ordering matches top-to-bottom rendering
}
