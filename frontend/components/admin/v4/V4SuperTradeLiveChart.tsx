"use client";

/**
 * SPX SuperTrade — Anlık Grafik Motoru (native canvas, harici kütüphane yok)
 * Veri API'den gelen gerçek mumlardır; bileşen içinde rastgele üretim yoktur.
 * Yeniden oynatma modunda `cutoffTime` ile mumlar zaman içinde açılır.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CompactBar } from "@/lib/v4/types";
import { INSET, Panel, Tabs, num } from "./supertrade/ui";

export interface ChartLevels {
  vwap: number;
  onh: number;
  onl: number;
  orh: number;
  orl: number;
  pdc: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  label: string;
}

type Symbol = "ES" | "SPX";
type Timeframe = "1" | "5" | "15";

const TF_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: "1", label: "1 dk" },
  { value: "5", label: "5 dk" },
  { value: "15", label: "15 dk" },
];

const COLOR = {
  up: "#22c55e",
  down: "#ef4444",
  brand: "#3b82f6",
  grid: "rgba(255,255,255,0.04)",
  axis: "#64748b",
  level: "#64748b",
  bg: "#0a0e17",
};

// Biçimlendirici modül düzeyinde bir kez kurulur. Her mum için yeniden
// oluşturmak (384 mum × her render) ölçülebilir bir maliyet yaratıyordu.
const ET_TIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const labelCache = new Map<number, string>();

function timeLabel(unixSec: number): string {
  const hit = labelCache.get(unixSec);
  if (hit) return hit;
  const value = ET_TIME.format(new Date(unixSec * 1000));
  if (labelCache.size > 5000) labelCache.clear();
  labelCache.set(unixSec, value);
  return value;
}

export default function V4SuperTradeLiveChart({
  esBars,
  spxBars,
  levels,
  vwapStartTime,
  cutoffTime,
  isReplay = false,
  loading = false,
}: {
  esBars: CompactBar[];
  spxBars: CompactBar[];
  levels: ChartLevels;
  vwapStartTime: number;
  cutoffTime?: number;
  isReplay?: boolean;
  loading?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState<Symbol>("ES");
  const [timeframe, setTimeframe] = useState<Timeframe>("5");
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ width: 640, height: 340 });

  const source = symbol === "ES" ? esBars : spxBars;

  const candles = useMemo<Candle[]>(() => {
    const factor = Number(timeframe);
    const rows = cutoffTime ? source.filter((b) => b[0] <= cutoffTime) : source;
    if (!rows.length) return [];

    // Zaman dilimine topla
    const grouped: Omit<Candle, "vwap" | "label">[] = [];
    for (let i = 0; i < rows.length; i += factor) {
      const slice = rows.slice(i, i + factor);
      if (!slice.length) continue;
      grouped.push({
        time: slice[0][0],
        open: slice[0][1],
        high: Math.max(...slice.map((b) => b[2])),
        low: Math.min(...slice.map((b) => b[3])),
        close: slice[slice.length - 1][4],
        volume: slice.reduce((s, b) => s + b[5], 0),
      });
    }

    // Seans başlangıcından itibaren kümülatif VWAP
    let tpv = 0;
    let vol = 0;
    let simpleSum = 0;
    let simpleCount = 0;

    return grouped.map((c) => {
      const typical = (c.high + c.low + c.close) / 3;
      if (c.time >= vwapStartTime) {
        tpv += typical * c.volume;
        vol += c.volume;
        simpleSum += typical;
        simpleCount += 1;
      }
      const vwap = vol > 0 ? tpv / vol : simpleCount > 0 ? simpleSum / simpleCount : typical;
      return { ...c, vwap, label: timeLabel(c.time) };
    });
  }, [source, timeframe, cutoffTime, vwapStartTime]);

  const last = candles[candles.length - 1];
  const display = hover && candles[hover.index] ? candles[hover.index] : last;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = size;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, width, height);
    if (!candles.length) return;

    const padL = 8;
    const padR = 68;
    const padT = 14;
    const padB = 26;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const volH = Math.round(plotH * 0.18);
    const priceH = plotH - volH - 10;

    const forecastBars = 24; // Gelecek tahmin aralığı (boşluk)

    const relevant = [levels.vwap, levels.onh, levels.onl, levels.orh, levels.orl].filter(
      (v) => v > 0
    );
    let min = Math.min(...candles.map((c) => c.low), ...relevant);
    let max = Math.max(...candles.map((c) => c.high), ...relevant);
    
    let stdDev = 1;
    if (candles.length > 0) {
      const lookback = Math.min(20, candles.length);
      let sumClose = 0;
      for (let i = candles.length - lookback; i < candles.length; i++) sumClose += candles[i].close;
      const avgClose = sumClose / lookback;
      let sqSum = 0;
      for (let i = candles.length - lookback; i < candles.length; i++) sqSum += Math.pow(candles[i].close - avgClose, 2);
      stdDev = Math.max(Math.sqrt(sqSum / lookback), 1);
      
      const lastClose = candles[candles.length - 1].close;
      const maxVal = lastClose + stdDev * Math.sqrt(forecastBars) * 1.5;
      const minVal = lastClose - stdDev * Math.sqrt(forecastBars) * 1.5;
      max = Math.max(max, maxVal);
      min = Math.min(min, minVal);
    }
    
    const span = max - min || 1;
    min -= span * 0.04;
    max += span * 0.04;

    const priceY = (p: number) => padT + priceH - ((p - min) / (max - min)) * priceH;
    const maxVol = Math.max(...candles.map((c) => c.volume), 1);
    const volY = (v: number) => height - padB - (v / maxVol) * volH;

    // Izgara ve fiyat ekseni
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 5; i++) {
      const p = min + (i / 5) * (max - min);
      const y = priceY(p);
      ctx.strokeStyle = COLOR.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      ctx.fillStyle = COLOR.axis;
      ctx.textAlign = "left";
      ctx.fillText(p.toFixed(2), width - padR + 6, y);
    }

    const n = candles.length + forecastBars;
    const step = plotW / n;
    const barW = Math.max(1.5, Math.min(14, step * 0.62));

    // Açılış aralığı bandı
    if (levels.orh > 0 && levels.orl > 0) {
      const yTop = priceY(levels.orh);
      const yBottom = priceY(levels.orl);
      ctx.fillStyle = "rgba(59,130,246,0.06)";
      ctx.fillRect(padL, yTop, plotW, Math.max(1, yBottom - yTop));
    }

    const drawLevel = (price: number, label: string, dash: number[], color: string) => {
      if (!price) return;
      const y = priceY(price);
      if (y < padT - 2 || y > padT + priceH + 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = color;
      ctx.font = "9px ui-sans-serif, system-ui";
      ctx.textAlign = "right";
      ctx.fillText(label, width - padR - 4, y - 6);
    };

    drawLevel(levels.onh, `ONH ${levels.onh.toFixed(2)}`, [2, 4], COLOR.level);
    drawLevel(levels.onl, `ONL ${levels.onl.toFixed(2)}`, [2, 4], COLOR.level);
    drawLevel(levels.pdc, `PDC ${levels.pdc.toFixed(2)}`, [1, 5], "#475569");
    drawLevel(levels.orh, `ORH ${levels.orh.toFixed(2)}`, [5, 3], "#94a3b8");
    drawLevel(levels.orl, `ORL ${levels.orl.toFixed(2)}`, [5, 3], "#94a3b8");

    // Hacim
    candles.forEach((c, i) => {
      const x = padL + i * step + step / 2;
      const y = volY(c.volume);
      ctx.fillStyle = c.close >= c.open ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.28)";
      ctx.fillRect(x - barW / 2, y, barW, height - padB - y);
    });

    // VWAP
    ctx.save();
    ctx.strokeStyle = COLOR.brand;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    candles.forEach((c, i) => {
      if (c.time < vwapStartTime) return;
      const x = padL + i * step + step / 2;
      const y = priceY(c.vwap);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Mumlar
    candles.forEach((c, i) => {
      const x = padL + i * step + step / 2;
      const color = c.close >= c.open ? COLOR.up : COLOR.down;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, priceY(c.high));
      ctx.lineTo(x, priceY(c.low));
      ctx.stroke();

      const yo = priceY(c.open);
      const yc = priceY(c.close);
      ctx.fillStyle = color;
      ctx.fillRect(x - barW / 2, Math.min(yo, yc), barW, Math.max(1, Math.abs(yo - yc)));
    });

    // Zaman ekseni
    const labelEvery = Math.max(1, Math.ceil(candles.length / 8));
    ctx.fillStyle = COLOR.axis;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    candles.forEach((c, i) => {
      if (i % labelEvery) return;
      ctx.fillText(c.label, padL + i * step + step / 2, height - padB + 12);
    });

    // Forecast Cone
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const startX = padL + (candles.length - 1) * step + step / 2;
      const startY = priceY(lastCandle.close);

      ctx.save();
      // Max line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let i = 1; i <= forecastBars; i++) {
        const fx = startX + i * step;
        const fy = priceY(lastCandle.close + stdDev * Math.sqrt(i) * 1.5);
        ctx.lineTo(fx, fy);
      }
      ctx.strokeStyle = "#10b981";
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Min line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      for (let i = 1; i <= forecastBars; i++) {
        const fx = startX + i * step;
        const fy = priceY(lastCandle.close - stdDev * Math.sqrt(i) * 1.5);
        ctx.lineTo(fx, fy);
      }
      ctx.strokeStyle = "#047857";
      ctx.stroke();

      // Avg line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(startX + forecastBars * step, startY);
      ctx.strokeStyle = "#059669";
      ctx.stroke();
      ctx.restore();

      const maxVal = lastCandle.close + stdDev * Math.sqrt(forecastBars) * 1.5;
      const minVal = lastCandle.close - stdDev * Math.sqrt(forecastBars) * 1.5;
      
      ctx.fillStyle = "#10b981";
      ctx.font = "9px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`Max ${maxVal.toFixed(2)}`, width - padR + 4, priceY(maxVal));
      ctx.fillStyle = "#059669";
      ctx.fillText(`Avg ${lastCandle.close.toFixed(2)}`, width - padR + 4, priceY(lastCandle.close));
      ctx.fillStyle = "#047857";
      ctx.fillText(`Min ${minVal.toFixed(2)}`, width - padR + 4, priceY(minVal));
    }

    // Son fiyat etiketi
    const endCandle = candles[candles.length - 1];
    const lastY = priceY(endCandle.close);
    const lastColor = endCandle.close >= endCandle.open ? COLOR.up : COLOR.down;
    ctx.fillStyle = lastColor;
    ctx.fillRect(width - padR + 2, lastY - 8, padR - 6, 16);
    ctx.fillStyle = "#0a0e17";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(endCandle.close.toFixed(2), width - padR + 2 + (padR - 6) / 2, lastY);

    // İmleç
    if (hover && candles[hover.index]) {
      const x = padL + hover.index * step + step / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(148,163,184,0.45)";
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, height - padB);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padL, hover.y);
      ctx.lineTo(width - padR, hover.y);
      ctx.stroke();
      ctx.restore();
    }
  }, [candles, levels, size, hover, vwapStartTime]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      setSize({ width: Math.max(320, rect.width), height: 340 });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !candles.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const padL = 8;
    const padR = 68;
    const forecastBars = 24;
    const step = (rect.width - padL - padR) / (candles.length + forecastBars);
    const index = Math.floor((x - padL) / step);
    if (index >= 0 && index < candles.length) setHover({ index, x, y });
    else setHover(null);
  };

  const changePct =
    candles.length > 1 ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100 : 0;

  return (
    <Panel
      title={symbol === "ES" ? "ES Vadeli — CME Globex" : "SPX Endeksi — CBOE"}
      hint={isReplay ? "yeniden oynatma" : "canlı akış"}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            size="sm"
            value={symbol}
            onChange={(v) => setSymbol(v)}
            options={[
              { value: "ES", label: "ES" },
              { value: "SPX", label: "SPX" },
            ]}
          />
          <Tabs size="sm" value={timeframe} onChange={(v) => setTimeframe(v)} options={TF_OPTIONS} />
        </div>
      }
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums">
        {display ? (
          <>
            <span className="text-slate-500">
              {display.label} <span className="text-slate-600">ET</span>
            </span>
            <span className="text-slate-500">
              A <span className="text-slate-300">{num(display.open)}</span>
            </span>
            <span className="text-slate-500">
              Y <span className="text-slate-300">{num(display.high)}</span>
            </span>
            <span className="text-slate-500">
              D <span className="text-slate-300">{num(display.low)}</span>
            </span>
            <span className="text-slate-500">
              K{" "}
              <span className={display.close >= display.open ? "text-[#22c55e]" : "text-[#ef4444]"}>
                {num(display.close)}
              </span>
            </span>
            <span className="text-slate-500">
              VWAP <span className="text-[#3b82f6]">{num(display.vwap)}</span>
            </span>
            <span className="text-slate-500">
              Seans{" "}
              <span className={changePct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}>
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </span>
          </>
        ) : (
          <span className="text-slate-500">{loading ? "Veri yükleniyor…" : "Mum verisi yok"}</span>
        )}
      </div>

      <div ref={containerRef} className={`${INSET} relative overflow-hidden`} style={{ height: 340 }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
          className="block cursor-crosshair"
        />
        {!candles.length && (
          <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-500">
            {loading ? "Veri yükleniyor…" : "Bu seans için mum verisi bulunamadı"}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 bg-[#3b82f6]" /> VWAP
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dashed border-slate-400" /> ORH / ORL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dotted border-slate-500" /> Gece ONH / ONL
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#22c55e]" /> artan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#ef4444]" /> azalan
        </span>
        <span className="ml-auto">{candles.length} mum</span>
      </div>
    </Panel>
  );
}
