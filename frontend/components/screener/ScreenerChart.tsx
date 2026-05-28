"use client";

import React, { useEffect, useRef, useState } from "react";

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  ticker: string;
}

const TF_CONFIG = {
  "1h": { interval: "60m", range: "7d"  },
  "1d": { interval: "1d",  range: "6mo" },
  "1w": { interval: "1wk", range: "2y"  },
} as const;

type TF = keyof typeof TF_CONFIG;

function calcEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = Array(data.length).fill(null);
  if (data.length < period) return result;
  const k = 2 / (period + 1);
  let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = val;
  for (let i = period; i < data.length; i++) {
    val = data[i] * k + val * (1 - k);
    result[i] = val;
  }
  return result;
}

export default function ScreenerChart({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const [tf, setTf]  = useState<TF>("1d");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!containerRef.current) return;
      setStatus("loading");

      // Fetch via server-side proxy (no CORS issues)
      const { interval, range } = TF_CONFIG[tf];
      const res = await fetch(`/api/chart-data?ticker=${encodeURIComponent(ticker)}&interval=${interval}&range=${range}`);
      if (cancelled) return;

      const json = await res.json();
      const bars: Bar[] = json.bars || [];
      if (bars.length === 0) { setStatus("error"); return; }

      // Dynamic import to avoid SSR issues
      const lc: any = await import("lightweight-charts");
      if (cancelled) return;

      // Destroy previous chart
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

      const container = containerRef.current;
      if (!container) return;

      const chart: any = lc.createChart(container, {
        layout: { background: { type: lc.ColorType.Solid, color: "#0a0c10" }, textColor: "#b0bec5" },
        width:  container.clientWidth,
        height: isFullscreen ? window.innerHeight - 80 : 420,
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#253347" },
        rightPriceScale: { borderColor: "#253347" },
        grid: { horzLines: { color: "#1a2234" }, vertLines: { color: "#1a2234" } },
        crosshair: { mode: 1 },
      });
      chartRef.current = chart;

      // Candlestick
      const candle = chart.addCandlestickSeries({
        upColor: "#4ade80", downColor: "#f87171",
        borderUpColor: "#4ade80", borderDownColor: "#f87171",
        wickUpColor: "#4ade80", wickDownColor: "#f87171",
      });
      candle.setData(bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));

      // Volume
      const vol = chart.addHistogramSeries({
        priceScaleId: "vol",
        priceFormat: { type: "volume" },
      });
      vol.setData(bars.map(b => ({
        time:  b.time,
        value: b.volume,
        color: b.close >= b.open ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)",
      })));
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      // EMAs
      const closes = bars.map(b => b.close);
      const ema8   = calcEMA(closes, 8);
      const ema20  = calcEMA(closes, 20);
      const ema50  = calcEMA(closes, 50);

      const addEMA = (values: (number | null)[], color: string, title: string) => {
        const s = chart.addLineSeries({ color, lineWidth: 1, title, priceLineVisible: false, lastValueVisible: false });
        s.setData(bars.map((b, i) => ({ time: b.time, value: values[i] })).filter((d: any) => d.value !== null));
      };

      addEMA(ema8,  "#60a5fa", "EMA8");
      addEMA(ema20, "#fbbf24", "EMA20");
      addEMA(ema50, "#a78bfa", "EMA50");

      chart.timeScale().fitContent();

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (chartRef.current && container) {
          chartRef.current.applyOptions({ width: container.clientWidth });
        }
      });
      ro.observe(container);

      setStatus("ok");
    };

    init().catch(() => setStatus("error"));
    return () => { cancelled = true; };
  }, [ticker, tf, isFullscreen]);

  // Fullscreen escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const height = isFullscreen ? window.innerHeight - 80 : 420;

  return (
    <>
      {isFullscreen && (
        <div
          onClick={() => setIsFullscreen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9998 }}
        />
      )}

      <div style={{
        background: "#0d1117",
        border: "1px solid #253347",
        borderRadius: 6,
        marginTop: 12,
        overflow: "hidden",
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? "20px" : undefined,
        zIndex: isFullscreen ? 9999 : 1,
      }}>
        {/* Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #1e2a3a" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase" }}>
            {ticker} · Grafik
          </span>

          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {(["1h", "1d", "1w"] as TF[]).map(t => (
              <button key={t} onClick={() => setTf(t)} style={{
                padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: "pointer",
                border: tf === t ? "1px solid #4ade80" : "1px solid #253347",
                background: tf === t ? "rgba(74,222,128,0.1)" : "transparent",
                color: tf === t ? "#4ade80" : "#7c8fa6",
                transition: "all .15s",
              }}>{t.toUpperCase()}</button>
            ))}
            <div style={{ width: 1, height: 16, background: "#253347" }} />
            <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Kapat (Esc)" : "Tam ekran"} style={{
              padding: "3px 8px", borderRadius: 3, fontSize: 14, cursor: "pointer",
              border: "1px solid #253347", background: "transparent", color: "#7c8fa6",
            }}>
              {isFullscreen ? "✕" : "⛶"}
            </button>
          </div>
        </div>

        {/* Chart area — always rendered so ref is available */}
        <div style={{ position: "relative", height }}>
          {status === "loading" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#7c8fa6", fontSize: 12, zIndex: 2 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, border: "2px solid #253347", borderTop: "2px solid #4ade80", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span>Grafik yükleniyor</span>
              </div>
            </div>
          )}
          {status === "error" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", fontSize: 12, zIndex: 2 }}>
              Veri alınamadı
            </div>
          )}
          <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, padding: "6px 12px", borderTop: "1px solid #1e2a3a", fontSize: 9, color: "#7c8fa6" }}>
          {[["#60a5fa","EMA 8"],["#fbbf24","EMA 20"],["#a78bfa","EMA 50"],["#4ade80","Hacim"]].map(([c,l]) => (
            <span key={l}><span style={{ color: c, fontWeight: 700 }}>━</span> {l}</span>
          ))}
        </div>
      </div>
    </>
  );
}
