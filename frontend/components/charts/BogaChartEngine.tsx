"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  BarSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { heikinAshi } from "@/lib/indicators";

type Locale = "en" | "tr" | "es" | "fr";

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    liveChart: "Live Chart", expand: "EXPAND", collapse: "COLLAPSE",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bands", vwap: "VWAP", sr: "Support/Resistance",
    candle: "Candle", "heikin-ashi": "Heikin Ashi", line: "Line", ohlc: "OHLC", hollow: "Hollow Candle",
    share: "Share", copyLink: "Copy link", linkCopied: "Link copied!",
    vol: "Vol",
  },
  tr: {
    liveChart: "Canlı Grafik", expand: "GENİŞLET", collapse: "DARALT",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bollinger Bantları", vwap: "VWAP", sr: "Destek/Direnç",
    candle: "Mum", "heikin-ashi": "Heikin Ashi", line: "Çizgi", ohlc: "OHLC", hollow: "İçi Boş Mum",
    share: "Paylaş", copyLink: "Linki kopyala", linkCopied: "Link kopyalandı!",
    vol: "Hac",
  },
  es: {
    liveChart: "Gráfico en Vivo", expand: "EXPANDIR", collapse: "CONTRAER",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandas de Bollinger", vwap: "VWAP", sr: "Soporte/Resistencia",
    candle: "Velas", "heikin-ashi": "Heikin Ashi", line: "Línea", ohlc: "OHLC", hollow: "Vela Hueca",
    share: "Compartir", copyLink: "Copiar enlace", linkCopied: "¡Enlace copiado!",
    vol: "Vol",
  },
  fr: {
    liveChart: "Graphique en Direct", expand: "AGRANDIR", collapse: "RÉDUIRE",
    ema9: "EMA 9", ema20: "EMA 20", ema50: "EMA 50", ema200: "EMA 200",
    rsi: "RSI (14)", macd: "MACD", bb: "Bandes de Bollinger", vwap: "VWAP", sr: "Support/Résistance",
    candle: "Bougie", "heikin-ashi": "Heikin Ashi", line: "Ligne", ohlc: "OHLC", hollow: "Bougie Creuse",
    share: "Partager", copyLink: "Copier le lien", linkCopied: "Lien copié !",
    vol: "Vol",
  },
};

const INTERVALS: { label: string; value: string }[] = [
  { label: "15M", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
  { label: "1W", value: "W" },
];

const RANGE_KEYS = ["1D", "1W", "1M", "3M", "1Y", "5Y"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];
const RANGE_WINDOW_SECONDS: Record<RangeKey, number> = {
  "1D": 86400, "1W": 7 * 86400, "1M": 30 * 86400,
  "3M": 90 * 86400, "1Y": 365 * 86400, "5Y": 5 * 365 * 86400,
};

const CANDLE_TYPES = ["candle", "heikin-ashi", "line", "ohlc", "hollow"] as const;
type CandleType = (typeof CANDLE_TYPES)[number];

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
  detailMode?: boolean; // unlocks the full toolbar: candle type, range, OHLCV readout, share, fullscreen
  defaultIndicators?: IndicatorKey[]; // initial active set (uncontrolled mode only)
  defaultTimeframe?: string; // initial interval value
}

const EMA_COLORS: Record<string, string> = {
  ema9: "#facc15",
  ema20: "#38bdf8",
  ema50: "#a78bfa",
  ema200: "#f472b6",
};

function seriesCategory(candleType: CandleType): "line" | "bar" | "candlestick" {
  if (candleType === "line") return "line";
  if (candleType === "ohlc") return "bar";
  return "candlestick";
}

function createMainSeries(chart: IChartApi, candleType: CandleType) {
  const category = seriesCategory(candleType);
  if (category === "line") {
    return chart.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 2, priceLineVisible: true });
  }
  if (category === "bar") {
    return chart.addSeries(BarSeries, { upColor: UP_COLOR, downColor: DOWN_COLOR });
  }
  const hollow = candleType === "hollow";
  return chart.addSeries(CandlestickSeries, {
    upColor: hollow ? "rgba(0,0,0,0)" : UP_COLOR,
    downColor: DOWN_COLOR,
    borderVisible: hollow,
    borderUpColor: UP_COLOR,
    borderDownColor: DOWN_COLOR,
    wickUpColor: UP_COLOR,
    wickDownColor: DOWN_COLOR,
  });
}

function toMainSeriesData(bars: Bar[], candleType: CandleType) {
  const srcBars = candleType === "heikin-ashi" ? heikinAshi(bars) : bars;
  if (seriesCategory(candleType) === "line") {
    return srcBars.map((b) => ({ time: b.time as UTCTimestamp, value: b.close }));
  }
  return srcBars.map((b) => ({ time: b.time as UTCTimestamp, open: b.open, high: b.high, low: b.low, close: b.close }));
}

export default function BogaChartEngine({
  symbol,
  interval: intervalProp,
  height = null,
  compact = false,
  lang = "en",
  showToolbar = true,
  onIntervalChange,
  indicators: indicatorsProp,
  detailMode = false,
  defaultIndicators,
  defaultTimeframe,
}: Props) {
  const t = LABELS[lang] || LABELS.en;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lineSeriesRefs = useRef<Partial<Record<IndicatorKey, ISeriesApi<"Line">[]>>>({});
  const priceLinesRef = useRef<any[]>([]);
  const barsRef = useRef<Bar[]>([]);
  const lastDataRef = useRef<ChartResponse | null>(null);

  const [interval, setInterval_] = useState(intervalProp || defaultTimeframe || "240");
  const [internalActive, setInternalActive] = useState<Set<IndicatorKey>>(
    () =>
      new Set(
        defaultIndicators ?? (compact ? (["ema20", "ema50"] as IndicatorKey[]) : (["ema20", "ema50", "sr"] as IndicatorKey[]))
      )
  );
  const active = indicatorsProp ? new Set(indicatorsProp) : internalActive;
  const setActive = setInternalActive;

  const [candleType, setCandleType] = useState<CandleType>(detailMode ? "heikin-ashi" : "candle");
  const [range, setRange] = useState<RangeKey>("3M");
  const [hoverBar, setHoverBar] = useState<Bar | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Native Fullscreen API — reliably escapes any ancestor CSS (e.g.
  // backdrop-filter/overflow-hidden on a parent .glass-card), which a
  // plain CSS `position:fixed` trick does not: an ancestor with
  // backdrop-filter creates a new containing block for fixed descendants,
  // silently clipping them instead of covering the viewport.
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceScaleId: "" },
      1
    );
    chart.panes()[1]?.setHeight(90);

    chartRef.current = chart;
    volumeSeriesRef.current = volumeSeries;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoverBar(barsRef.current[barsRef.current.length - 1] ?? null);
        return;
      }
      const bar = barsRef.current.find((b) => b.time === param.time);
      if (bar) setHoverBar(bar);
    });

    const resizeObserver = new ResizeObserver(() => chart.applyOptions({}));
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
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
      lastDataRef.current = data;
      renderAll(data);
    } catch {
      // silent — network hiccup, next poll/refetch will retry
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, active]);

  const renderAll = (data: ChartResponse) => {
    const bars = data.bars || [];
    barsRef.current = bars;
    const chart = chartRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !volumeSeries || bars.length === 0) return;

    if (!mainSeriesRef.current) mainSeriesRef.current = createMainSeries(chart, candleType);
    const mainSeries = mainSeriesRef.current;

    mainSeries.setData(toMainSeriesData(bars, candleType));
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
    for (const pl of priceLinesRef.current) mainSeries.removePriceLine(pl);
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
        const pl = mainSeries.createPriceLine({
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

    applyVisibleRange(bars);
    setHoverBar(bars[bars.length - 1] ?? null);
  };

  const applyVisibleRange = (bars: Bar[]) => {
    const chart = chartRef.current;
    if (!chart) return;
    const lastBar = bars[bars.length - 1];
    if (!lastBar || bars.length <= 1) {
      chart.timeScale().fitContent();
      return;
    }
    // Detail mode: independent "Görünüm" (range/zoom) row, user-selectable.
    // Otherwise: auto-pick a sensible window per interval (spec: 4H opens to 1W).
    const windowSeconds = detailMode
      ? RANGE_WINDOW_SECONDS[range]
      : ({ "1": 86400, "5": 86400, "15": 86400, "60": 5 * 86400, "240": 7 * 86400, D: 90 * 86400, W: 730 * 86400 }[
          interval
        ] ?? 7 * 86400);
    chart.timeScale().setVisibleRange({
      from: Math.max(bars[0].time, lastBar.time - windowSeconds) as UTCTimestamp,
      to: lastBar.time as UTCTimestamp,
    });
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Candle type change: re-create the main series and redraw from cached
  // data — no network refetch needed, same bars, different presentation.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
    }
    mainSeriesRef.current = createMainSeries(chart, candleType);
    if (lastDataRef.current) renderAll(lastDataRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candleType]);

  // Range (view window) change: rezoom only, no refetch.
  useEffect(() => {
    if (barsRef.current.length) applyVisibleRange(barsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

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

  const availableIndicators: IndicatorKey[] = compact ? ["ema20", "ema50"] : [...INDICATOR_KEYS];

  const latestValue = (key: string): number | null => {
    const arr = lastDataRef.current?.indicators?.[key] as (number | null)[] | undefined;
    if (!arr) return null;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i] as number;
    return null;
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${symbol} chart — BOGA AI`;
  const shareLinks = {
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
  };
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silently ignore
    }
  };

  const fmt = (n: number | undefined | null, d = 2) => (n == null ? "—" : n.toFixed(d));
  const fmtVol = (n: number | undefined | null) => {
    if (n == null) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  };

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col w-full h-full"
      style={{ background: isFullscreen ? "#0a0e17" : `${NAVY}0d` }}
    >
      <div className="contents">
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
            {!detailMode && (
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
            )}
            {detailMode && (
              <div className="flex items-center gap-1.5 ml-auto">
                <div className="relative">
                  <button
                    onClick={() => setShareOpen((v) => !v)}
                    className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all"
                  >
                    {t.share}
                  </button>
                  {shareOpen && (
                    <div className="absolute right-0 mt-1 w-40 rounded-lg bg-[#141924] border border-[#1e2a3a] shadow-2xl overflow-hidden z-30">
                      <a href={shareLinks.x} target="_blank" rel="noopener noreferrer"
                         className="block px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
                        X (Twitter)
                      </a>
                      <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer"
                         className="block px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
                        WhatsApp
                      </a>
                      <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer"
                         className="block px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-[#1e2a3a] hover:text-white">
                        Telegram
                      </a>
                      <button
                        onClick={handleCopyLink}
                        className="block w-full text-left px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-[#1e2a3a] hover:text-white"
                      >
                        {copied ? t.linkCopied : t.copyLink}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="px-2.5 py-1 rounded bg-[#141924] border border-[#1e2a3a] text-[10px] font-black text-[#00d2ff] hover:text-white transition-all"
                >
                  {isFullscreen ? "✕" : "⛶"}
                </button>
              </div>
            )}
          </div>
        )}

        {detailMode && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-[#1e2a3a]">
              <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
                {RANGE_KEYS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${
                      range === r ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex items-center bg-[#141924] rounded-lg p-0.5 border border-[#1e2a3a]">
                {CANDLE_TYPES.map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setCandleType(ct)}
                    className={`px-2.5 py-1 rounded text-[10px] font-black transition-all ${
                      candleType === ct ? "bg-[#3b82f6] text-white" : "text-[#00d2ff] hover:text-white"
                    }`}
                  >
                    {t[ct]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-[#1e2a3a]">
              {availableIndicators.map((key) => {
                const val = ["ema9", "ema20", "ema50", "ema200", "vwap"].includes(key) ? latestValue(key) : null;
                return (
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
                    {val != null ? ` ${fmt(val)}` : ""}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="relative flex-1" style={{ minHeight: height ?? 300 }}>
          <div ref={containerRef} style={{ width: "100%", height: height ?? "100%", minHeight: height ?? 300 }} />

          {/* BOGA watermark — always on, every instance, small/large.
              Centered and low-opacity so it reads as a watermark, not a
              corner tag, without interfering with reading the candles. */}
          <div
            className={`absolute inset-x-0 ${compact ? "top-2" : "top-9"} flex justify-center pointer-events-none select-none z-10`}
          >
            <span className={`font-black tracking-[0.3em] text-white/[0.08] ${compact ? "text-xs" : "text-2xl md:text-3xl"}`}>
              BOGA
            </span>
          </div>

          {detailMode && (
            <div className="absolute top-2 left-2 z-10 flex flex-wrap items-center gap-x-2 gap-y-0.5 px-2 py-1 rounded bg-[#0a0e17]/70 text-[10px] font-bold pointer-events-none">
              <span className="text-slate-400">O <span className="text-white">{fmt(hoverBar?.open)}</span></span>
              <span className="text-slate-400">H <span className="text-white">{fmt(hoverBar?.high)}</span></span>
              <span className="text-slate-400">L <span className="text-white">{fmt(hoverBar?.low)}</span></span>
              <span className="text-slate-400">C <span className="text-white">{fmt(hoverBar?.close)}</span></span>
              <span className="text-slate-400">{t.vol} <span className="text-white">{fmtVol(hoverBar?.volume)}</span></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
