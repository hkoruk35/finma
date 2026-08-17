"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { createChart, ColorType, CrosshairMode, LineStyle, IChartApi, ISeriesApi, Time, LineSeries } from "lightweight-charts";
import { copy, type Locale } from "@/lib/i18n/copy";

interface Props {
  locale: Locale;
  ticker: string;
  currentPrice: number;
  numAnalysts: number;
  maxTarget: number;
  avgTarget: number;
  minTarget: number;
}

export default function AnalystForecastChart({ locale, ticker, currentPrice, numAnalysts, maxTarget, avgTarget, minTarget }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);
  const t = copy[locale].top100.detail; // we added forecast strings here

  const maxPct = ((maxTarget - currentPrice) / currentPrice) * 100;
  const avgPct = ((avgTarget - currentPrice) / currentPrice) * 100;
  const minPct = ((minTarget - currentPrice) / currentPrice) * 100;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748b",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.5)" },
        horzLines: { color: "rgba(30, 41, 59, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { labelBackgroundColor: "#1e293b", color: "#475569" },
        horzLine: { labelBackgroundColor: "#1e293b", color: "#475569" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 40, // Space for 1Y forecast visually
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: false },
    });
    chartRef.current = chart;

    const histSeries = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      crosshairMarkerRadius: 4,
    });

    const maxSeries = chart.addSeries(LineSeries, {
      color: "#10b981", // Emerald 500
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
    });

    const avgSeries = chart.addSeries(LineSeries, {
      color: "#059669", // Emerald 600
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
    });

    const minSeries = chart.addSeries(LineSeries, {
      color: "#047857", // Emerald 700
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
    });

    // Fetch historical data
    let isMounted = true;
    fetch(`/api/chart-data?ticker=${ticker}&timeframe=D`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        setLoading(false);
        if (data && data.bars && data.bars.length > 0) {
          // Keep only last ~252 bars (1 year)
          const bars = data.bars.slice(-252).map((b: any) => ({
            time: b.time,
            value: b.close
          }));
          
          histSeries.setData(bars);

          const lastBar = bars[bars.length - 1];
          const lastTime = lastBar.time;
          
          // Estimate 1 year in the future (+31536000 seconds)
          const futureTime = (lastTime + 31536000) as Time;

          // Add Forecast Cones
          maxSeries.setData([
            { time: lastTime, value: currentPrice },
            { time: futureTime, value: maxTarget }
          ]);
          avgSeries.setData([
            { time: lastTime, value: currentPrice },
            { time: futureTime, value: avgTarget }
          ]);
          minSeries.setData([
            { time: lastTime, value: currentPrice },
            { time: futureTime, value: minTarget }
          ]);

          // Set Price Lines for targets
          maxSeries.createPriceLine({
            price: maxTarget,
            color: "#10b981",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `Max ${maxPct >= 0 ? "+" : ""}${maxPct.toFixed(2)}%`,
          });
          avgSeries.createPriceLine({
            price: avgTarget,
            color: "#059669",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `Avg ${avgPct >= 0 ? "+" : ""}${avgPct.toFixed(2)}%`,
          });
          minSeries.createPriceLine({
            price: minTarget,
            color: "#047857",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `Min ${minPct >= 0 ? "+" : ""}${minPct.toFixed(2)}%`,
          });

          // Current Price Line
          histSeries.createPriceLine({
            price: currentPrice,
            color: "#3b82f6",
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: "Current",
          });

          chart.timeScale().fitContent();
        }
      })
      .catch(console.error);

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [ticker, currentPrice, maxTarget, avgTarget, minTarget, maxPct, avgPct, minPct]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Link copied!");
    } catch (e) {
      console.error(e);
    }
  };

  const descText = (t as any).forecastDesc?.replace("{n}", numAnalysts.toString()).replace("{max}", maxTarget.toFixed(2)).replace("{min}", minTarget.toFixed(2)) || `The ${numAnalysts} analysts offering 1-year price forecasts have a max estimate of ${maxTarget.toFixed(2)} and a min estimate of ${minTarget.toFixed(2)}.`;

  return (
    <div className="mt-4 bg-[#05080e] border border-[#253347] rounded-lg p-5 shadow-lg flex flex-col relative overflow-hidden group">
      {/* Header Overlay */}
      <div className="flex justify-between items-start relative z-10 pointer-events-none mb-4">
        <div>
          <h2 className="text-sm font-bold text-white/90 mb-1">{(t as any).priceTarget || "Price target"}</h2>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-white">{avgTarget.toFixed(2)}</span>
            <span className="text-xs text-slate-400">USD</span>
            <span className={`text-sm font-medium ${avgPct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {avgPct >= 0 ? "+" : ""}{(avgTarget - currentPrice).toFixed(2)} {avgPct >= 0 ? "+" : ""}{avgPct.toFixed(2)}%
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            {descText}
          </p>
        </div>
        
        {/* Share Button */}
        <button 
          onClick={handleShare}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#161f2e] border border-[#253347] hover:border-[#58a6ff]/50 rounded-md text-xs font-medium text-slate-300 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
          {(t as any).shareTarget || "Share"}
        </button>
      </div>

      {/* Chart Container */}
      <div className="w-full h-[320px] relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full h-full" />
        
        {/* Watermark / Tags */}
        <div className="absolute bottom-4 left-4 pointer-events-none opacity-50 flex items-center gap-2">
          <span className="font-bold text-xl tracking-tighter text-white" style={{fontFamily: "Inter, sans-serif", letterSpacing: "-1px"}}>
             BOGASTOCK
          </span>
        </div>
        <div className="absolute bottom-4 left-[30%] pointer-events-none px-3 py-1 bg-[#161f2e] rounded-full border border-[#253347]">
          <span className="text-[10px] font-bold text-slate-400">{(t as any).past1Y || "PAST 1Y"}</span>
        </div>
        <div className="absolute bottom-4 right-[25%] pointer-events-none px-3 py-1 bg-[#161f2e] rounded-full border border-[#253347]">
          <span className="text-[10px] font-bold text-slate-400">{(t as any).forecast1Y || "1Y FORECAST"}</span>
        </div>
      </div>
    </div>
  );
}
