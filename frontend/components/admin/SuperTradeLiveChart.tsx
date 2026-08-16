"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

export interface CandleData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
}

interface SuperTradeLiveChartProps {
  symbol?: "ES" | "SPX";
  timeframe?: "1m" | "5m";
  currentPrice: number;
  vwapPrice: number;
  onh: number;
  onl: number;
  onMid: number;
  orh: number;
  orl: number;
  replayTime?: number; // 0 to 150 minutes from 09:30
  isReplayMode?: boolean;
}

export default function SuperTradeLiveChart({
  symbol: initialSymbol = "ES",
  timeframe: initialTimeframe = "5m",
  currentPrice = 7805.0,
  vwapPrice = 7811.17,
  onh = 7817.5,
  onl = 7796.5,
  onMid = 7807.0,
  orh = 7807.71,
  orl = 7801.46,
  replayTime = 150,
  isReplayMode = false,
}: SuperTradeLiveChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [activeSymbol, setActiveSymbol] = useState<"ES" | "SPX">(initialSymbol);
  const [activeTimeframe, setActiveTimeframe] = useState<"1m" | "5m">(initialTimeframe);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);

  // Generate realistic intraday candle series from 09:30 ET
  const allCandles = useMemo(() => {
    const list: CandleData[] = [];
    const baseDate = new Date();
    // Normalize to 09:30 ET today
    const startTimestamp = Math.floor(
      new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 9, 30, 0).getTime() / 1000
    ) as UTCTimestamp;

    const intervalMinutes = activeTimeframe === "1m" ? 1 : 5;
    const totalBars = activeTimeframe === "1m" ? 150 : 30;

    let currentOpen = activeSymbol === "ES" ? 7802.5 : 7784.0;
    let runningVwapSum = 0;
    let runningVolSum = 0;

    for (let i = 0; i < totalBars; i++) {
      const time = (startTimestamp + i * intervalMinutes * 60) as UTCTimestamp;
      const progress = i / totalBars;

      // Realistic price wave: slight dip in first 20m, strong rally afterwards
      const wave =
        i < (activeTimeframe === "1m" ? 30 : 6)
          ? -10 * Math.sin((i / (activeTimeframe === "1m" ? 30 : 6)) * Math.PI)
          : (progress - 0.2) * (activeSymbol === "ES" ? 22 : 20);

      const open = Number((currentOpen + (Math.random() - 0.48) * 1.5).toFixed(2));
      const drift = wave * 0.1 + (Math.random() - 0.45) * 2.5;
      const close = Number((open + drift).toFixed(2));
      const high = Number((Math.max(open, close) + Math.random() * 2.2).toFixed(2));
      const low = Number((Math.min(open, close) - Math.random() * 2.0).toFixed(2));

      // Higher volume at open and breakouts
      const baseVol = i < 4 ? 12500 : 4500;
      const volume = Math.floor(baseVol + Math.random() * 4000);

      const typicalPrice = (high + low + close) / 3;
      runningVwapSum += typicalPrice * volume;
      runningVolSum += volume;
      const vwap = Number((runningVwapSum / runningVolSum).toFixed(2));

      list.push({
        time,
        open,
        high,
        low,
        close,
        volume,
        vwap,
      });

      currentOpen = close;
    }

    return list;
  }, [activeSymbol, activeTimeframe]);

  // Filter candles based on replay time (if in replay mode)
  const visibleCandles = useMemo(() => {
    if (!isReplayMode) return allCandles;
    const intervalMinutes = activeTimeframe === "1m" ? 1 : 5;
    const maxIndex = Math.max(1, Math.floor(replayTime / intervalMinutes));
    return allCandles.slice(0, Math.min(allCandles.length, maxIndex));
  }, [allCandles, replayTime, isReplayMode, activeTimeframe]);

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#070a11" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(0, 210, 255, 0.4)", width: 1, style: 2 },
        horzLine: { color: "rgba(0, 210, 255, 0.4)", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // 1. Candlestick Series (Mum Grafiği)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });

    // 2. Volume Series (Hacim Çubukları)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#00d2ff",
      priceFormat: { type: "volume" },
      priceScaleId: "", // Overlay on main pane with dedicated margins
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // volume bars stay at bottom 20%
        bottom: 0,
      },
    });

    // 3. VWAP Line Series
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#00d2ff",
      lineWidth: 2,
      lineStyle: 2, // Dashed
      title: "VWAP",
      priceLineVisible: true,
    });

    // Static horizontal price lines for Key Levels
    candleSeries.createPriceLine({
      price: onh,
      color: "#34d399",
      lineWidth: 1,
      lineStyle: 0, // Solid
      axisLabelVisible: true,
      title: "ONH",
    });

    candleSeries.createPriceLine({
      price: vwapPrice,
      color: "#00d2ff",
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: "VWAP",
    });

    candleSeries.createPriceLine({
      price: orh,
      color: "#c084fc",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ORH",
    });

    candleSeries.createPriceLine({
      price: orl,
      color: "#fb7185",
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ORL",
    });

    candleSeries.createPriceLine({
      price: onl,
      color: "#f87171",
      lineWidth: 1,
      lineStyle: 0,
      axisLabelVisible: true,
      title: "ONL",
    });

    // Crosshair hover callback for OHLCV inspection
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.get(candleSeries)) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as any;
      if (data) {
        setHoveredCandle({
          time: param.time as UTCTimestamp,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: (param.seriesData.get(volumeSeries) as any)?.value || 0,
          vwap: (param.seriesData.get(vwapSeries) as any)?.value || vwapPrice,
        });
      }
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    vwapSeriesRef.current = vwapSeries;

    // Resize observer
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 320,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [onh, onl, onMid, orh, orl, vwapPrice]);

  // Update data series when visible candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !vwapSeriesRef.current) return;

    candleSeriesRef.current.setData(
      visibleCandles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeSeriesRef.current.setData(
      visibleCandles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)",
      }))
    );

    vwapSeriesRef.current.setData(
      visibleCandles.map((c) => ({
        time: c.time,
        value: c.vwap,
      }))
    );

    chartRef.current?.timeScale().fitContent();
  }, [visibleCandles]);

  const latest = visibleCandles[visibleCandles.length - 1] || {
    open: currentPrice,
    high: currentPrice,
    low: currentPrice,
    close: currentPrice,
    volume: 8500,
    vwap: vwapPrice,
  };

  const display = hoveredCandle || latest;
  const isUp = display.close >= display.open;

  return (
    <div className="flex flex-col justify-between bg-[#0b0f17] border border-white/[0.08] rounded-xl p-4 shadow-lg">
      {/* ── Üst Başlık & Zaman Dilimi / Enstrüman Seçici ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-sm font-bold text-white tracking-wide">
              {activeSymbol === "ES" ? "ES Vadeli (CME Globex)" : "SPX Spot Endeksi (CBOE)"}
            </span>
          </div>

          <div className="flex bg-[#070a11] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setActiveSymbol("ES")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                activeSymbol === "ES" ? "bg-[#00d2ff] text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
              }`}
            >
              ES
            </button>
            <button
              onClick={() => setActiveSymbol("SPX")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                activeSymbol === "SPX" ? "bg-[#00d2ff] text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
              }`}
            >
              SPX
            </button>
          </div>

          <div className="flex bg-[#070a11] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTimeframe("1m")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                activeTimeframe === "1m" ? "bg-purple-400 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
              }`}
            >
              1m
            </button>
            <button
              onClick={() => setActiveTimeframe("5m")}
              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                activeTimeframe === "5m" ? "bg-purple-400 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
              }`}
            >
              5m
            </button>
          </div>
        </div>

        {/* OHLCV Canlı Bilgi Şeridi */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-500 text-[10px] mr-1">O:</span>
            <span className="text-white font-semibold">{display.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">H:</span>
            <span className="text-emerald-400 font-semibold">{display.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">L:</span>
            <span className="text-rose-400 font-semibold">{display.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">C:</span>
            <span className={`font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
              {display.close.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Vol:</span>
            <span className="text-cyan-400 font-semibold">{display.volume.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Seviye Etiketleri */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <div className="bg-[#070a11] p-2 rounded-md border border-white/[0.06] text-center">
          <span className="text-slate-500 text-[10px] block">Seans VWAP</span>
          <span className="font-bold text-[#00d2ff] text-xs">{vwapPrice.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2 rounded-md border border-white/[0.06] text-center">
          <span className="text-slate-500 text-[10px] block">Globex ONH</span>
          <span className="font-bold text-[#34d399] text-xs">{onh.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2 rounded-md border border-white/[0.06] text-center">
          <span className="text-slate-500 text-[10px] block">Globex ONL</span>
          <span className="font-bold text-[#f87171] text-xs">{onl.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2 rounded-md border border-white/[0.06] text-center">
          <span className="text-slate-500 text-[10px] block">ORH / ORL</span>
          <span className="font-bold text-purple-300 text-xs">
            {orh.toFixed(2)} / {orl.toFixed(2)}
          </span>
        </div>
        <div className="bg-[#070a11] p-2 rounded-md border border-white/[0.06] text-center col-span-2 sm:col-span-1">
          <span className="text-slate-500 text-[10px] block">ON Midpoint</span>
          <span className="font-bold text-amber-300 text-xs">{onMid.toFixed(2)}</span>
        </div>
      </div>

      {/* ── TradingView Lightweight Chart Container ── */}
      <div
        ref={chartContainerRef}
        className="w-full h-[320px] rounded-lg overflow-hidden border border-white/[0.06] relative"
      />

      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          Canlı Mum &amp; Hacim Motoru (Lightweight-Charts v5.2)
        </span>
        <span className="font-mono text-slate-400">
          Seviye Çizgileri: ONH (Yeşil) | VWAP (Cyan) | ORH/ORL (Mor/Rose) | ONL (Kırmızı)
        </span>
      </div>
    </div>
  );
}
