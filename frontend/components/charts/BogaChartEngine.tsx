"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

type Locale = "en" | "tr" | "es" | "fr";

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    liveChart: "Live Chart", expand: "EXPAND", collapse: "COLLAPSE",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bands", vwap: "VWAP", sr: "Support/Resistance",
  },
  tr: {
    liveChart: "Canlı Grafik", expand: "GENİŞLET", collapse: "DARALT",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bantları", vwap: "VWAP", sr: "Destek/Direnç",
  },
  es: {
    liveChart: "Gráfico en Vivo", expand: "EXPANDIR", collapse: "CONTRAER",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandas de Bollinger", vwap: "VWAP", sr: "Soporte/Resistencia",
  },
  fr: {
    liveChart: "Graphique en Direct", expand: "AGRANDIR", collapse: "RÉDUIRE",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandes de Bollinger", vwap: "VWAP", sr: "Support/Résistance",
  },
};

const INTERVALS: { label: string; value: string }[] = [
  { label: "15M", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

const INDICATOR_KEYS = ["ema9", "ema20", "ema50", "ema200", "rsi", "macd", "bb", "vwap", "sr"] as const;
type IndicatorKey = (typeof INDICATOR_KEYS)[number];

const UP_COLOR = "#22c55e";
const DOWN_COLOR = "#ef4444";
const NAVY = "#030073";

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartResponse {
  bars: Bar[];
  indicators?: Record<string, unknown>;
  sr?: { price: number; time_range: [number, number]; type: "support" | "resistance" }[];
}

interface Props {
  symbol: string; // Yahoo ticker, e.g. "AAPL", "EURUSD=X", "BTC-USD", "GC=F"
  interval?: string; // TV-style, controlled by caller when showToolbar=false
  height?: number | null; // null = fill parent
  compact?: boolean; // grid-tile mode: minimal chrome, fixed indicator set
  lang?: Locale;
  showToolbar?: boolean; // internal interval + indicator toggle UI (default true)
  onIntervalChange?: (interval: string) => void;
  indicators?: IndicatorKey[]; // when provided, overrides internal toggle state (controlled mode)
}

const EMA_COLORS: Record<string, string> = {
  ema9: "#facc15",
  ema20: "#38bdf8",
  ema50: "#a78bfa",
  ema200: "#f472b6",
};

export default function BogaChartEngine({
  symbol,
  interval: intervalProp,
  height = null,
  compact = false,
  lang = "en",
  showToolbar = true,
  onIntervalChange,
  indicators: indicatorsProp,
}: Props) {
  const t = LABELS[lang] || LABELS.en;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineSeriesRefs = useRef<Partial<Record<IndicatorKey, ISeriesApi<"Line">[]>>>({});
  const priceLinesRef = useRef<any[]>([]);
  const barsRef = useRef<Bar[]>([]);

  const [interval, setInterval_] = useState(intervalProp || "240");
  const [internalActive, setInternalActive] = useState<Set<IndicatorKey>>(
    () => new Set(compact ? (["ema20", "ema50"] as IndicatorKey[]) : (["ema20", "ema50", "sr"] as IndicatorKey[]))
  );
  const active = indicatorsProp ? new Set(indicatorsProp) : internalActive;
  const setActive = setInternalActive;

  useEffect(() => {
    if (intervalProp && intervalProp !== interval) setInterval_(intervalProp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalProp]);

  // ── Chart lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b949e",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1e2a3a" },
        horzLines: { color: "#1e2a3a" },
      },
      rightPriceScale: { borderColor: "#1e2a3a" },
      timeScale: { borderColor: "#1e2a3a", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderVisible: false,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceScaleId: "" },
      1
    );
    chart.panes()[1]?.setHeight(90);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver(() => chart.applyOptions({}));
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesRefs.current = {};
      priceLinesRef.current = [];
    };
  }, []);

  // ── Data fetch ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const wanted = Array.from(active).filter((k) => k !== "sr").join(",");
    const indicatorsParam = [wanted, active.has("sr") ? "sr" : ""].filter(Boolean).join(",");
    const params = new URLSearchParams({ ticker: symbol, timeframe: interval });
    if (indicatorsParam) params.set("indicators", indicatorsParam);

    try {
      const res = await fetch(`/api/chart-data?${params.toString()}`);
      const data: ChartResponse = await res.json();
      applyData(data);
    } catch {
      // silent — network hiccup, next poll/refetch will retry
    }
  }, [symbol, interval, active]);

  const applyData = (data: ChartResponse) => {
    const bars = data.bars || [];
    barsRef.current = bars;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;
    if (!candleSeries || !volumeSeries || !chart) return;

    candleSeries.setData(
      bars.map((b) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close }))
    );
    volumeSeries.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? `${UP_COLOR}80` : `${DOWN_COLOR}80`,
      }))
    );

    // Clear previous overlays
    for (const key of Object.keys(lineSeriesRefs.current) as IndicatorKey[]) {
      for (const series of lineSeriesRefs.current[key] || []) chart.removeSeries(series);
    }
    lineSeriesRefs.current = {};
    for (const pl of priceLinesRef.current) candleSeries.removePriceLine(pl);
    priceLinesRef.current = [];

    const ind = data.indicators || {};
    const toPoints = (arr: unknown) =>
      (arr as (number | null)[] | undefined)?.map((v, i) => ({ time: bars[i].time as UTCTimestamp, value: v })).filter((p) => p.value != null) as
        | { time: UTCTimestamp; value: number }[]
        | undefined;

    for (const key of ["ema9", "ema20", "ema50", "ema200"] as const) {
      if (active.has(key) && ind[key]) {
        const series = chart.addSeries(LineSeries, { color: EMA_COLORS[key], lineWidth: 2, priceLineVisible: false });
        series.setData(toPoints(ind[key]) || []);
        lineSeriesRefs.current[key] = [series];
      }
    }

    if (active.has("bb") && ind.bb) {
      const bb = ind.bb as { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] };
      const series: ISeriesApi<"Line">[] = [];
      for (const [band, color] of [["upper", "#64748b"], ["middle", "#94a3b8"], ["lower", "#64748b"]] as const) {
        const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false });
        s.setData(toPoints(bb[band]) || []);
        series.push(s);
      }
      lineSeriesRefs.current.bb = series;
    }

    if (active.has("vwap") && ind.vwap) {
      const series = chart.addSeries(LineSeries, { color: "#eab308", lineWidth: 2, priceLineVisible: false });
      series.setData(toPoints(ind.vwap) || []);
      lineSeriesRefs.current.vwap = [series];
    }

    if (active.has("rsi") && ind.rsi) {
      const series = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2 }, 2);
      series.setData(toPoints(ind.rsi) || []);
      chart.panes()[2]?.setHeight(90);
      lineSeriesRefs.current.rsi = [series];
    }

    if (active.has("macd") && ind.macd) {
      const m = ind.macd as { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
      const paneIdx = active.has("rsi") ? 3 : 2;
      const macdLine = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 1 }, paneIdx);
      macdLine.setData(toPoints(m.macd) || []);
      const signalLine = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1 }, paneIdx);
      signalLine.setData(toPoints(m.signal) || []);
      chart.panes()[paneIdx]?.setHeight(90);
      lineSeriesRefs.current.macd = [macdLine, signalLine];
    }

    if (active.has("sr") && data.sr) {
      // Keep only the levels nearest the last close — otherwise months of
      // pivot history clutters the chart with dozens of R/S lines.
      const lastClose = bars[bars.length - 1]?.close ?? 0;
      const nearest = [...data.sr]
        .sort((a, b) => Math.abs(a.price - lastClose) - Math.abs(b.price - lastClose))
        .slice(0, 6);
      for (const level of nearest) {
        const pl = candleSeries.createPriceLine({
          price: level.price,
          color: level.type === "resistance" ? DOWN_COLOR : UP_COLOR,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: level.type === "resistance" ? "R" : "S",
        });
        priceLinesRef.current.push(pl);
      }
    }

    // Default zoom window per interval (spec: 4H interval opens to a 1W view).
    const DEFAULT_WINDOW_SECONDS: Record<string, number> = {
      "1": 86400, "5": 86400, "15": 86400,
      "60": 5 * 86400, "240": 7 * 86400,
      D: 90 * 86400, W: 730 * 86400,
    };
    const windowSeconds = DEFAULT_WINDOW_SECONDS[interval] ?? 7 * 86400;
    const lastBar = bars[bars.length - 1];
    if (lastBar && bars.length > 1) {
      chart.timeScale().setVisibleRange({
        from: Math.max(bars[0].time, lastBar.time - windowSeconds) as UTCTimestamp,
        to: lastBar.time as UTCTimestamp,
      });
    } else {
      chart.timeScale().fitContent();
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Polling for the latest bar (Yahoo data is ~15min delayed, so this
  // just keeps the last visible candle current rather than simulating ticks) ──
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.hidden) return;
      fetchData();
    }, 60_000);
    return () => window.clearInterval(poll);
  }, [fetchData]);

  const toggle = (key: IndicatorKey) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const changeInterval = (value: string) => {
    setInterval_(value);
    onIntervalChange?.(value);
  };

  const availableIndicators: IndicatorKey[] = compact
    ? ["ema20", "ema50"]
    : [...INDICATOR_KEYS];

  return (
    <div className="flex flex-col w-full h-full" style={{ background: `${NAVY}0d` }}>
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a]">
          <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                onClick={() => changeInterval(iv.value)}
                className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${
                  interval === iv.value ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                }`}
              >
                {iv.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {availableIndicators.map((key) => (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                  active.has(key)
                    ? "bg-[#3b82f6]/20 border-[#3b82f6]/50 text-[#3b82f6]"
                    : "border-[#1e2a3a] text-[#64748b] hover:text-white"
                }`}
              >
                {t[key]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: "100%", height: height ?? "100%", minHeight: height ?? 300, flex: height ? undefined : 1 }}
      />
    </div>
  );
}
