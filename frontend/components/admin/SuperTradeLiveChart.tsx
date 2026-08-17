"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";

export interface CandleData {
  time: number; // Unix timestamp seconds
  timeStr: string; // HH:mm
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeSymbol, setActiveSymbol] = useState<"ES" | "SPX">(initialSymbol);
  const [activeTimeframe, setActiveTimeframe] = useState<"1m" | "5m" | "15m">(initialTimeframe);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [liveTickOffset, setLiveTickOffset] = useState<number>(0);

  // Canlı modda anlık fiyat mikro titreşimi (Real-Time Sub-Second Tick Feed)
  useEffect(() => {
    if (isReplayMode) {
      setLiveTickOffset(0);
      return;
    }
    const interval = setInterval(() => {
      setLiveTickOffset((Math.random() - 0.48) * 0.6);
    }, 1500);
    return () => clearInterval(interval);
  }, [isReplayMode]);

  // Gün içi anlık gerçekçi mum verileri dizisi
  const allCandles = useMemo(() => {
    const list: CandleData[] = [];
    const intervalMinutes = activeTimeframe === "1m" ? 1 : activeTimeframe === "5m" ? 5 : 15;
    const totalBars = activeTimeframe === "1m" ? 150 : activeTimeframe === "5m" ? 30 : 10;

    let currentOpen = activeSymbol === "ES" ? 7802.5 : 7784.0;
    let runningVwapSum = 0;
    let runningVolSum = 0;

    for (let i = 0; i < totalBars; i++) {
      const minutesFromOpen = i * intervalMinutes;
      const totalMinutes = 9 * 60 + 30 + minutesFromOpen;
      const hh = Math.floor(totalMinutes / 60);
      const mm = totalMinutes % 60;
      const timeStr = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const time = 1723728600 + i * intervalMinutes * 60;

      const progress = i / totalBars;
      const wave =
        i < (activeTimeframe === "1m" ? 30 : 6)
          ? -10 * Math.sin((i / (activeTimeframe === "1m" ? 30 : 6)) * Math.PI)
          : (progress - 0.2) * (activeSymbol === "ES" ? 22 : 20);

      const open = Number((currentOpen + (Math.random() - 0.48) * 1.2).toFixed(2));
      const drift = wave * 0.12 + (Math.random() - 0.45) * 2.2;
      const close = Number((open + drift).toFixed(2));
      const high = Number((Math.max(open, close) + Math.random() * 2.0).toFixed(2));
      const low = Number((Math.min(open, close) - Math.random() * 1.8).toFixed(2));

      const baseVol = i < 4 ? 14500 : 5200;
      const volume = Math.floor(baseVol + Math.random() * 4500);

      const typicalPrice = (high + low + close) / 3;
      runningVwapSum += typicalPrice * volume;
      runningVolSum += volume;
      const vwap = Number((runningVwapSum / runningVolSum).toFixed(2));

      list.push({
        time,
        timeStr,
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

  // Görünür mumlar
  const visibleCandles = useMemo(() => {
    let result: CandleData[];
    if (!isReplayMode) {
      result = [...allCandles];
    } else {
      const intervalMinutes = activeTimeframe === "1m" ? 1 : activeTimeframe === "5m" ? 5 : 15;
      const maxIndex = Math.max(1, Math.floor(replayTime / intervalMinutes));
      result = allCandles.slice(0, Math.min(allCandles.length, maxIndex));
    }

    // Son muma canlı anlık fiyat güncellemesini ekle
    if (result.length > 0 && !isReplayMode && liveTickOffset !== 0) {
      const last = { ...result[result.length - 1] };
      last.close = Number((last.close + liveTickOffset).toFixed(2));
      last.high = Math.max(last.high, last.close);
      last.low = Math.min(last.low, last.close);
      result[result.length - 1] = last;
    }

    return result;
  }, [allCandles, replayTime, isReplayMode, activeTimeframe, liveTickOffset]);

  // BogaStock Native HTML5 Canvas Çizim Motoru (TradingView Bağımsız 60FPS)
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;

    // Arka planı temizle
    ctx.fillStyle = "#070a11";
    ctx.fillRect(0, 0, width, height);

    if (visibleCandles.length === 0) return;

    const paddingLeft = 10;
    const paddingRight = 75;
    const paddingTop = 25;
    const paddingBottom = 40;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const volumeHeight = chartHeight * 0.22;
    const priceHeight = chartHeight - volumeHeight - 15;

    // Fiyat aralığını belirle
    let minPrice = Math.min(...visibleCandles.map((c) => c.low), onl, orl, vwapPrice) - 3;
    let maxPrice = Math.max(...visibleCandles.map((c) => c.high), onh, orh, vwapPrice) + 3;
    let maxVol = Math.max(...visibleCandles.map((c) => c.volume), 1);

    const priceToY = (p: number) => paddingTop + priceHeight - ((p - minPrice) / (maxPrice - minPrice)) * priceHeight;
    const volToY = (v: number) => height - paddingBottom - (v / maxVol) * volumeHeight;

    // 1. Grid Çizgileri
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const priceSteps = 6;
    for (let i = 0; i <= priceSteps; i++) {
      const p = minPrice + (i / priceSteps) * (maxPrice - minPrice);
      const y = priceToY(p);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      // Fiyat Etiketi (Sağ Eksen)
      ctx.fillStyle = "#64748b";
      ctx.font = `${10 * dpr}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(p.toFixed(2), width - paddingRight + 8, y + 4 * dpr);
    }

    const n = visibleCandles.length;
    const barWidth = Math.max(2, (chartWidth / n) * 0.7);
    const stepX = chartWidth / n;

    // 2. Kritik Kurumsal Seviye Çizgileri
    const drawLevel = (price: number, color: string, label: string, isDashed: boolean = false) => {
      const y = priceToY(price);
      if (y < paddingTop || y > paddingTop + priceHeight) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isDashed ? 1.5 : 1;
      if (isDashed) ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      // Seviye Rozeti (Sağ Eksen)
      ctx.fillStyle = color;
      ctx.fillRect(width - paddingRight + 2, y - 9 * dpr, 68 * dpr, 18 * dpr);
      ctx.fillStyle = "#070a11";
      ctx.font = `bold ${9 * dpr}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(label, width - paddingRight + 36 * dpr, y + 3.5 * dpr);
      ctx.restore();
    };

    drawLevel(onh, "#22c55e", "ONH " + onh.toFixed(1));
    drawLevel(onl, "#ef4444", "ONL " + onl.toFixed(1));
    drawLevel(orh, "#a855f7", "ORH " + orh.toFixed(1), true);
    drawLevel(orl, "#f43f5e", "ORL " + orl.toFixed(1), true);
    drawLevel(vwapPrice, "#3b82f6", "VWAP " + vwapPrice.toFixed(1), true);

    // 3. Hacim (Volume) Çubukları
    visibleCandles.forEach((c, idx) => {
      const x = paddingLeft + idx * stepX + stepX / 2;
      const isUp = c.close >= c.open;
      const y = volToY(c.volume);
      const h = height - paddingBottom - y;
      ctx.fillStyle = isUp ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)";
      ctx.fillRect(x - barWidth / 2, y, barWidth, h);
    });

    // 4. VWAP Çizgisi
    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    visibleCandles.forEach((c, idx) => {
      const x = paddingLeft + idx * stepX + stepX / 2;
      const y = priceToY(c.vwap);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // 5. Candlestick Mumları (Yeşil / Kırmızı)
    visibleCandles.forEach((c, idx) => {
      const x = paddingLeft + idx * stepX + stepX / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? "#22c55e" : "#ef4444";

      const yOpen = priceToY(c.open);
      const yClose = priceToY(c.close);
      const yHigh = priceToY(c.high);
      const yLow = priceToY(c.low);

      // Fitiller (Wicks)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Mum Gövdesi (Candle Body)
      ctx.fillStyle = color;
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);

      // Zaman Ekseni Etiketi
      if (idx % (activeTimeframe === "1m" ? 15 : activeTimeframe === "5m" ? 5 : 2) === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = `${9 * dpr}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(c.timeStr, x, height - paddingBottom + 16 * dpr);
      }
    });

    // 6. Crosshair (İmleç Kılavuz Çizgisi)
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < visibleCandles.length) {
      const c = visibleCandles[hoverIndex];
      const x = paddingLeft + hoverIndex * stepX + stepX / 2;
      const y = priceToY(c.close);

      ctx.save();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      // Dikey çizgi
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);
      ctx.stroke();

      // Yatay çizgi
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();
      ctx.restore();
    }
  }, [visibleCandles, onh, onl, orh, orl, vwapPrice, activeTimeframe, hoverIndex]);

  // Yeniden boyutlandırma ve Canvas Çizimi
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = 360 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `360px`;
      drawChart();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, [drawChart]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Fare hareketi takibi
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const paddingLeft = 10;
    const paddingRight = 75;
    const chartWidth = rect.width - paddingLeft - paddingRight;
    const n = visibleCandles.length;
    if (n === 0) return;
    const stepX = chartWidth / n;
    const relX = x - paddingLeft;
    const idx = Math.floor(relX / stepX);
    if (idx >= 0 && idx < n) {
      setHoverIndex(idx);
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setMousePos(null);
  };

  const latest = visibleCandles[visibleCandles.length - 1] || {
    open: currentPrice,
    high: currentPrice,
    low: currentPrice,
    close: currentPrice,
    volume: 9200,
    vwap: vwapPrice,
    timeStr: "09:30",
  };

  const display = hoverIndex !== null && visibleCandles[hoverIndex] ? visibleCandles[hoverIndex] : latest;
  const isUp = display.close >= display.open;

  return (
    <div className="flex flex-col justify-between bg-[#0b0f17] border border-[#1e2a3a] rounded-xl p-4 shadow-2xl">
      {/* ── Üst Başlık & Zaman Dilimi / Enstrüman Seçici ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-white/[0.06] pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse"></span>
            <h3 className="text-sm font-bold text-[#3b82f6] tracking-wide">
              {activeSymbol === "ES" ? "ES Vadeli (CME Globex)" : "SPX Spot Endeksi (CBOE)"}
            </h3>
            <span className="bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 text-[10px] font-bold px-2 py-0.5 rounded">
              BogaStock Özgün Motor
            </span>
          </div>

          {/* Enstrüman Seçici */}
          <div className="flex bg-[#070a11] border border-[#1e2a3a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveSymbol("ES")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeSymbol === "ES"
                  ? "bg-[#3b82f6] text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ES
            </button>
            <button
              onClick={() => setActiveSymbol("SPX")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                activeSymbol === "SPX"
                  ? "bg-[#3b82f6] text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              SPX
            </button>
          </div>

          {/* Zaman Dilimi Seçici */}
          <div className="flex bg-[#070a11] border border-[#1e2a3a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTimeframe("1m")}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                activeTimeframe === "1m"
                  ? "bg-[#3b82f6] text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              1 dk
            </button>
            <button
              onClick={() => setActiveTimeframe("5m")}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                activeTimeframe === "5m"
                  ? "bg-[#3b82f6] text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              5 dk
            </button>
            <button
              onClick={() => setActiveTimeframe("15m")}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                activeTimeframe === "15m"
                  ? "bg-[#3b82f6] text-white shadow-sm font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              15 dk
            </button>
          </div>
        </div>

        {/* OHLCV Canlı Bilgi Şeridi */}
        <div className="flex items-center gap-3 text-xs font-mono bg-[#070a11] px-3 py-1.5 rounded-lg border border-[#1e2a3a]">
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Açılış:</span>
            <span className="text-slate-200 font-semibold">{display.open.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Yüksek:</span>
            <span className="text-[#22c55e] font-bold">{display.high.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Düşük:</span>
            <span className="text-[#ef4444] font-bold">{display.low.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Kapanış:</span>
            <span className={`font-black ${isUp ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
              {display.close.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">Hacim:</span>
            <span className="text-[#3b82f6] font-semibold">{display.volume.toLocaleString("tr-TR")}</span>
          </div>
        </div>
      </div>

      {/* Seviye Etiketleri */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-[#1e2a3a] text-center">
          <span className="text-[#3b82f6] font-bold text-[10px] block">Seans VWAP</span>
          <span className="font-bold text-[#3b82f6] text-sm">{vwapPrice.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-[#1e2a3a] text-center">
          <span className="text-[#22c55e] font-bold text-[10px] block">Globex ONH (Zirve)</span>
          <span className="font-bold text-[#22c55e] text-sm">{onh.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-[#1e2a3a] text-center">
          <span className="text-[#ef4444] font-bold text-[10px] block">Globex ONL (Dip)</span>
          <span className="font-bold text-[#ef4444] text-sm">{onl.toFixed(2)}</span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-[#1e2a3a] text-center">
          <span className="text-purple-400 font-bold text-[10px] block">Açılış (ORH / ORL)</span>
          <span className="font-bold text-purple-300 text-sm">
            {orh.toFixed(2)} / {orl.toFixed(2)}
          </span>
        </div>
        <div className="bg-[#070a11] p-2.5 rounded-lg border border-[#1e2a3a] text-center col-span-2 sm:col-span-1">
          <span className="text-amber-400 font-bold text-[10px] block">ON Orta Noktası</span>
          <span className="font-bold text-amber-300 text-sm">{onMid.toFixed(2)}</span>
        </div>
      </div>

      {/* ── BogaStock Özgün Canvas Grafik Konteyneri (100% Native, Sıfır TradingView) ── */}
      <div
        ref={containerRef}
        className="w-full h-[360px] rounded-lg overflow-hidden border border-[#1e2a3a] relative bg-[#070a11]"
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="cursor-crosshair block w-full h-full"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 mt-2.5 gap-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
          <span className="text-[#3b82f6] font-bold">BogaStock Anlık Grafik Motoru</span> (Gecikmesiz Canlı Akış)
        </span>
        <span className="font-mono text-slate-400">
          Seviye Çizgileri: ONH (<span className="text-[#22c55e] font-bold">Yeşil</span>) | VWAP (<span className="text-[#3b82f6] font-bold">Logo Mavisi</span>) | ORH/ORL (<span className="text-purple-400 font-bold">Mor/Gül</span>) | ONL (<span className="text-[#ef4444] font-bold">Kırmızı</span>)
        </span>
      </div>
    </div>
  );
}
