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
  timeframe?: "1m" | "5m" | "15m";
  currentPrice: number;
  vwapPrice: number;
  onh: number;
  onl: number;
  onMid: number;
  orh: number;
  orl: number;
  replayTime?: number; // 0 - 150 dakika (09:30 ET başlangıçlı)
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
  const [activeTimeframe, setActiveTimeframe] = useState<"1m" | "5m" | "15m">(initialTimeframe);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [liveTickPrice, setLiveTickPrice] = useState<number>(currentPrice);
  const [liveTickDelta, setLiveTickDelta] = useState<number>(0);

  // Anlık fiyat akışı simülasyonu (Canlı modda milisaniyelik anlık değişimler)
  useEffect(() => {
    if (isReplayMode) {
      setLiveTickPrice(currentPrice);
      return;
    }
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.48) * 0.5;
      setLiveTickPrice((prev) => {
        const next = Number((prev + delta).toFixed(2));
        setLiveTickDelta(delta);
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isReplayMode, currentPrice]);

  // Gün içi anlık gerçekçi mum verileri dizisi
  const allCandles = useMemo(() => {
    const list: CandleData[] = [];
    const baseDate = new Date();
    // 09:30 ET başlangıç zaman damgası
    const startTimestamp = Math.floor(
      new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 9, 30, 0).getTime() / 1000
    ) as UTCTimestamp;

    const intervalMinutes = activeTimeframe === "1m" ? 1 : activeTimeframe === "5m" ? 5 : 15;
    const totalBars = activeTimeframe === "1m" ? 150 : activeTimeframe === "5m" ? 30 : 10;

    let currentOpen = activeSymbol === "ES" ? 7802.5 : 7784.0;
    let runningVwapSum = 0;
    let runningVolSum = 0;

    for (let i = 0; i < totalBars; i++) {
      const time = (startTimestamp + i * intervalMinutes * 60) as UTCTimestamp;
      const progress = i / totalBars;

      const wave =
        i < (activeTimeframe === "1m" ? 30 : 6)
          ? -10 * Math.sin((i / (activeTimeframe === "1m" ? 30 : 6)) * Math.PI)
          : (progress - 0.2) * (activeSymbol === "ES" ? 22 : 20);

      const open = Number((currentOpen + (Math.random() - 0.48) * 1.5).toFixed(2));
      const drift = wave * 0.1 + (Math.random() - 0.45) * 2.5;
      const close = Number((open + drift).toFixed(2));
      const high = Number((Math.max(open, close) + Math.random() * 2.2).toFixed(2));
      const low = Number((Math.min(open, close) - Math.random() * 2.0).toFixed(2));

      const baseVol = i < 4 ? 14500 : 5200;
      const volume = Math.floor(baseVol + Math.random() * 4500);

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

  // Yeniden oynatma moduna göre görünen mumları filtrele
  const visibleCandles = useMemo(() => {
    if (!isReplayMode) return allCandles;
    const intervalMinutes = activeTimeframe === "1m" ? 1 : activeTimeframe === "5m" ? 5 : 15;
    const maxIndex = Math.max(1, Math.floor(replayTime / intervalMinutes));
    return allCandles.slice(0, Math.min(allCandles.length, maxIndex));
  }, [allCandles, replayTime, isReplayMode, activeTimeframe]);

  // BogaStock Özgün Grafik Motorunu Başlat
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#080c14" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(0, 210, 255, 0.5)", width: 1, style: 2 },
        horzLine: { color: "rgba(0, 210, 255, 0.5)", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // 1. Candlestick (Mum Grafiği - Artan Canlı Yeşil #22c55e, Azalan Canlı Kırmızı #ef4444)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // 2. Hacim Çubukları (Volume)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#00d2ff",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 3. VWAP Çizgisi (Boga Logo Mavisi #00d2ff Kesikli Çizgi)
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#00d2ff",
      lineWidth: 2,
      lineStyle: 2,
      title: "VWAP",
      priceLineVisible: true,
    });

    // Kritik Kurumsal Fiyat Seviyeleri
    candleSeries.createPriceLine({
      price: onh,
      color: "#22c55e",
      lineWidth: 1.5,
      lineStyle: 0,
      axisLabelVisible: true,
      title: "ONH (Gece Zirvesi)",
    });

    candleSeries.createPriceLine({
      price: vwapPrice,
      color: "#00d2ff",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "VWAP (Ağırlıklı Ortalama)",
    });

    candleSeries.createPriceLine({
      price: orh,
      color: "#a855f7",
      lineWidth: 1.5,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ORH (Açılış Zirvesi)",
    });

    candleSeries.createPriceLine({
      price: orl,
      color: "#f43f5e",
      lineWidth: 1.5,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "ORL (Açılış Dibi)",
    });

    candleSeries.createPriceLine({
      price: onl,
      color: "#ef4444",
      lineWidth: 1.5,
      lineStyle: 0,
      axisLabelVisible: true,
      title: "ONL (Gece Dibi)",
    });

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

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: 340,
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
        color: c.close >= c.open ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.45)",
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
    volume: 9200,
    vwap: vwapPrice,
  };

  const display = hoveredCandle || latest;
  const isUp = display.close >= display.open;

  return (
    <div className="flex flex-col justify-between bg-[#0b0f17] border border-white/[0.08] rounded-xl p-4 shadow-xl">
      {/* ── Üst Başlık & Zaman Dilimi / Enstrüman Seçici ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-white/[0.06] pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h3 className="text-sm font-bold text-[#00d2ff] tracking-wide">
              {activeSymbol === "ES" ? "ES Vadeli (CME Globex)" : "SPX Spot Endeksi (CBOE)"}
            </h3>
            <span className="bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/30 text-[10px] font-bold px-2 py-0.5 rounded">
              BogaStock Özgün Anlık Motor
            </span>
          </div>

          {/* Enstrüman Değiştirici */}
          <div className="flex bg-[#070a11] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setActiveSymbol("ES")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                activeSymbol === "ES" ? "bg-[#00d2ff] text-slate-950 font-extrabold shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              ES
            </button>
            <button
              onClick={() => setActiveSymbol("SPX")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                activeSymbol === "SPX" ? "bg-[#00d2ff] text-slate-950 font-extrabold shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              SPX
            </button>
          </div>

          {/* Zaman Dilimi Seçici */}
          <div className="flex bg-[#070a11] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTimeframe("1m")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                activeTimeframe === "1m" ? "bg-[#00d2ff] text-slate-950 font-extrabold shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              1 dk
            </button>
            <button
              onClick={() => setActiveTimeframe("5m")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                activeTimeframe === "5m" ? "bg-[#00d2ff] text-slate-950 font-extrabold shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              5 dk
            </button>
            <button
              onClick={() => setActiveTimeframe("15m")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all ${
                activeTimeframe === "15m" ? "bg-[#00d2ff] text-slate-950 font-extrabold shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              15 dk
            </button>
          </div>
        </div>

        {/* OHLCV Canlı Bilgi Şeridi */}
        <div className="flex items-center gap-3 text-xs font-mono bg-[#070a11] px-3 py-1.5 rounded-lg border border-white/[0.06]">
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Açılış:</span>
            <span className="text-slate-200 font-semibold">{display.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">En Yüksek:</span>
            <span className="text-emerald-400 font-bold">{display.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">En Düşük:</span>
            <span className="text-rose-500 font-bold">{display.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Kapanış:</span>
            <span className={`font-black ${isUp ? "text-emerald-400" : "text-rose-500"}`}>
              {display.close.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Hacim:</span>
            <span className="text-[#00d2ff] font-semibold">{display.volume.toLocaleString("tr-TR")}</span>
          </div>
        </div>
      </div>

      {/* Seviye Etiketleri */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-white/[0.06] text-center">
          <span className="text-[#00d2ff] font-semibold text-[10px] block">Seans VWAP</span>
          <span className="font-bold text-[#00d2ff] text-sm">{vwapPrice.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-white/[0.06] text-center">
          <span className="text-emerald-400 font-semibold text-[10px] block">Globex ONH (Zirve)</span>
          <span className="font-bold text-emerald-400 text-sm">{onh.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-white/[0.06] text-center">
          <span className="text-rose-500 font-semibold text-[10px] block">Globex ONL (Dip)</span>
          <span className="font-bold text-rose-500 text-sm">{onl.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-white/[0.06] text-center">
          <span className="text-purple-400 font-semibold text-[10px] block">Açılış (ORH / ORL)</span>
          <span className="font-bold text-purple-300 text-sm">
            {orh.toFixed(2)} / {orl.toFixed(2)}
          </span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-white/[0.06] text-center col-span-2 sm:col-span-1">
          <span className="text-amber-400 font-semibold text-[10px] block">ON Orta Noktası</span>
          <span className="font-bold text-amber-300 text-sm">{onMid.toFixed(2)}</span>
        </div>
      </div>

      {/* ── BogaStock Özgün Grafik Motoru Konteyneri ── */}
      <div
        ref={chartContainerRef}
        className="w-full h-[340px] rounded-lg overflow-hidden border border-white/[0.08] relative"
      />

      <div className="flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 mt-2.5 gap-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-[#00d2ff] font-bold">BogaStock Anlık Canlı Grafik Motoru</span> (Gecikmesiz Canlı Akış)
        </span>
        <span className="font-mono text-slate-400">
          Seviye Çizgileri: ONH (<span className="text-emerald-400 font-bold">Yeşil</span>) | VWAP (<span className="text-[#00d2ff] font-bold">Logo Mavisi</span>) | ORH/ORL (<span className="text-purple-400 font-bold">Mor/Gül</span>) | ONL (<span className="text-rose-500 font-bold">Kırmızı</span>)
        </span>
      </div>
    </div>
  );
}
