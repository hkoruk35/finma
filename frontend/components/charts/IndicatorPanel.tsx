"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type UTCTimestamp,
  type Time,
} from "lightweight-charts";

interface DataPoint { time: UTCTimestamp; value: number | null }

interface IndicatorPanelProps {
  label: string;
  data: DataPoint[];
  data2?: DataPoint[]; // second series (e.g. MACD signal line)
  color: string;
  color2?: string;
  height?: number;
  isHistogram?: boolean;
  overBoughtLine?: number;   // e.g. 70 for RSI
  overSoldLine?: number;     // e.g. 30 for RSI
  mainChart?: IChartApi | null;
}

export default function IndicatorPanel({
  label,
  data,
  data2,
  color,
  color2 = "#f97316",
  height = 90,
  isHistogram = false,
  overBoughtLine,
  overSoldLine,
  mainChart,
}: IndicatorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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
      leftPriceScale: {
        // Keep left price scale width for alignment with main chart.
        alignLabels: true,
      },
      rightPriceScale: {
        borderColor: "#1e2a3a",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        // Align the price labels across multiple chart instances so RSI/MACD panels line up with the main chart.
        alignLabels: true,
      },
      timeScale: {
        borderColor: "#1e2a3a",
        timeVisible: false,
        visible: false,
      },
      crosshair: { vertLine: { visible: true }, horzLine: { visible: true } },
      autoSize: true,
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;

    if (isHistogram) {
      const series = chart.addSeries(HistogramSeries, {
        color,
        priceLineVisible: false,
      });
      const filtered = data.filter((d) => d.value != null) as { time: UTCTimestamp; value: number }[];
      series.setData(filtered);
    } else {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
      });
      const filtered = data.filter((d) => d.value != null) as { time: UTCTimestamp; value: number }[];
      series.setData(filtered);

      if (data2) {
        const series2 = chart.addSeries(LineSeries, {
          color: color2,
          lineWidth: 1,
          priceLineVisible: false,
        });
        const filtered2 = data2.filter((d) => d.value != null) as { time: UTCTimestamp; value: number }[];
        series2.setData(filtered2);
      }

      // Overbought / Oversold reference lines (RSI 70/30)
      if (overBoughtLine != null && data.length > 0) {
        const firstTime = data.find((d) => d.value != null)?.time;
        const lastTime = [...data].reverse().find((d) => d.value != null)?.time;
        if (firstTime && lastTime) {
          // drawn as a second series so it always stretches the full width
          const obSeries = chart.addSeries(LineSeries, {
            color: "#ef444460",
            lineWidth: 1,
            lineStyle: 2, // dashed
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          obSeries.setData([
            { time: firstTime, value: overBoughtLine },
            { time: lastTime, value: overBoughtLine },
          ]);
          const osSeries = chart.addSeries(LineSeries, {
            color: "#22c55e60",
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          osSeries.setData([
            { time: firstTime, value: overSoldLine ?? 30 },
            { time: lastTime, value: overSoldLine ?? 30 },
          ]);
        }
      }
    }

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when it changes without recreating the chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const panes = chart.panes();
    if (!panes[0]) return;
    const series = panes[0].getSeries();
    if (!series[0]) return;
    const filtered = data.filter((d) => d.value != null) as { time: UTCTimestamp; value: number }[];
    if (filtered.length > 0) (series[0] as any).setData(filtered);
    if (data2 && series[1]) {
      const filtered2 = data2.filter((d) => d.value != null) as { time: UTCTimestamp; value: number }[];
      if (filtered2.length > 0) (series[1] as any).setData(filtered2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, data2]);

  // Synchronize time scale with main chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !mainChart) return;

    const syncTimeScale = () => {
      const logicalRange = mainChart.timeScale().getVisibleLogicalRange();
      if (logicalRange) {
        chart.timeScale().setVisibleLogicalRange(logicalRange);
      }
    };

    // Initial sync
    syncTimeScale();

    // Subscribe to changes
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncTimeScale);

    return () => {
      mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncTimeScale);
    };
  }, [mainChart]);

  return (
    <div className="w-full border-t border-[#1e2a3a] relative" style={{ height }}>
      <span className="absolute top-1 left-2 text-[10px] font-semibold text-slate-400 z-10 pointer-events-none select-none">
        {label}
      </span>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
