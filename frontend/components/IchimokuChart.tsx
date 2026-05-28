"use client";

import { useEffect, useRef, useState } from "react";

interface OHLC {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface IchimokuBar extends OHLC {
  tenkan: number | null;
  kijun: number | null;
  spanA: number | null;
  spanB: number | null;
  spanAFut: number | null;
  spanBFut: number | null;
  chikou: number | null;
}

interface IchimokuChartProps {
  historyOHLC: any[];
  currentPrice: number;
  forecast15?: { day?: number; bear: number; base: number; bull: number; date?: string }[];
}

export default function IchimokuChart({ historyOHLC, currentPrice, forecast15 }: IchimokuChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showTenkan, setShowTenkan] = useState(true);
  const [showKijun, setShowKijun] = useState(true);
  const [showChikou, setShowChikou] = useState(true);
  const [showKumo, setShowKumo] = useState(true);
  const [metrics, setMetrics] = useState({
    close: "—",
    tenkan: "—",
    kijun: "—",
    kumo: "—",
    signal: "—",
    signalColor: "#f0a500",
  });

  const calculateIchimoku = (data: OHLC[]): IchimokuBar[] => {
    const T = 9, K = 26, S = 52, D = 26;

    const highestHigh = (arr: OHLC[], from: number, period: number) => {
      let h = -Infinity;
      for (let i = from; i < Math.min(from + period, arr.length); i++) {
        if (arr[i]) h = Math.max(h, arr[i].high);
      }
      return h === -Infinity ? null : h;
    };

    const lowestLow = (arr: OHLC[], from: number, period: number) => {
      let l = Infinity;
      for (let i = from; i < Math.min(from + period, arr.length); i++) {
        if (arr[i]) l = Math.min(l, arr[i].low);
      }
      return l === Infinity ? null : l;
    };

    const out: IchimokuBar[] = data.map((bar, i) => {
      const tenkanHigh = highestHigh(data, Math.max(0, i - T + 1), T);
      const tenkanLow = lowestLow(data, Math.max(0, i - T + 1), T);
      const tenkan = i >= T - 1 && tenkanHigh !== null && tenkanLow !== null ? (tenkanHigh + tenkanLow) / 2 : null;

      const kijunHigh = highestHigh(data, Math.max(0, i - K + 1), K);
      const kijunLow = lowestLow(data, Math.max(0, i - K + 1), K);
      const kijun = i >= K - 1 && kijunHigh !== null && kijunLow !== null ? (kijunHigh + kijunLow) / 2 : null;

      const spanA = i >= K - 1 && tenkan !== null && kijun !== null ? (tenkan + kijun) / 2 : null;

      const spanBHigh = highestHigh(data, Math.max(0, i - S + 1), S);
      const spanBLow = lowestLow(data, Math.max(0, i - S + 1), S);
      const spanB = i >= S - 1 && spanBHigh !== null && spanBLow !== null ? (spanBHigh + spanBLow) / 2 : null;

      return { ...bar, tenkan, kijun, spanA, spanB, spanAFut: null, spanBFut: null, chikou: null };
    });

    out.forEach((bar, i) => {
      bar.spanAFut = i + D < out.length && out[i + D].spanA !== null ? out[i + D].spanA : null;
      bar.spanBFut = i + D < out.length && out[i + D].spanB !== null ? out[i + D].spanB : null;
      bar.chikou = i >= D ? data[i - D].close : null;
    });

    return out;
  };

  useEffect(() => {
    if (!canvasRef.current || !historyOHLC || historyOHLC.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Convert raw data to OHLC format
    const ohlcData: OHLC[] = historyOHLC.map((row: any) => ({
      date: typeof row.date === "string" ? new Date(row.date) : row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    const histLen = ohlcData.length;

    // Build future dates for forecast bars (next N business days after last historical bar)
    const forecastBars: Array<{ date: Date; bear: number; base: number; bull: number }> = [];
    if (forecast15?.length) {
      const lastDate = ohlcData.length > 0 ? new Date(ohlcData[ohlcData.length - 1].date) : new Date();
      let cursor = new Date(lastDate);
      forecast15.forEach((f) => {
        // advance cursor to next business day
        do { cursor = new Date(cursor.getTime() + 86400000); } while (cursor.getDay() === 0 || cursor.getDay() === 6);
        forecastBars.push({ date: new Date(cursor), bear: f.bear, base: f.base, bull: f.bull });
        // Also push a synthetic OHLC bar so Ichimoku lines extend into forecast zone
        ohlcData.push({ date: new Date(cursor), open: f.base, high: f.bull, low: f.bear, close: f.base });
      });
    }

    const ichiData = calculateIchimoku(ohlcData);
    const sliceData = ichiData;

    if (sliceData.length === 0) return;

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const colors = {
      bg: isDark ? "#1a1a1a" : "#ffffff",
      grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
      text: isDark ? "#aaa" : "#666",
      candle_up: "#22c55e",
      candle_dn: "#e05c5c",
      tenkan: "#f0a500",
      kijun: "#e05c5c",
      chikou: "#a855f7",
      kumo_bull_fill: isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.12)",
      kumo_bear_fill: isDark ? "rgba(224,92,92,0.15)" : "rgba(224,92,92,0.12)",
      kumo_bull_stroke: "rgba(34,197,94,0.5)",
      kumo_bear_stroke: "rgba(224,92,92,0.5)",
    };

    const padL = 10, padR = 68, padT = 18, padB = 28;
    const plotW = w - padL - padR;
    const barW = plotW / sliceData.length;
    const candleW = Math.max(1, barW * 0.55);

    const allPrices: number[] = [];
    sliceData.forEach(d => {
      allPrices.push(d.high, d.low);
      if (d.spanAFut) allPrices.push(d.spanAFut);
      if (d.spanBFut) allPrices.push(d.spanBFut);
    });

    const rawMin = Math.min(...allPrices, currentPrice);
    const rawMax = Math.max(...allPrices, currentPrice);
    const pad = (rawMax - rawMin) * 0.07;
    const minP = rawMin - pad;
    const maxP = rawMax + pad;

    const priceToY = (price: number) => padT + (1 - (price - minP) / (maxP - minP || 1)) * (h - padT - padB);
    const xPos = (i: number) => padL + i * barW + barW / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    for (let g = 0; g <= 5; g++) {
      const yg = padT + g * (h - padT - padB) / 5;
      ctx.beginPath();
      ctx.moveTo(padL, yg);
      ctx.lineTo(w - padR, yg);
      ctx.stroke();
      const pval = maxP - g * (maxP - minP) / 5;
      ctx.fillStyle = colors.text;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(pval.toFixed(pval > 1000 ? 0 : 2), w - padR + 4, yg + 3);
    }

    // fStart: forecast begins right after the last real historical bar
    const fStart = forecast15?.length ? histLen : Math.max(0, sliceData.length - 26);

    // Kumo
    if (showKumo) {
      for (let i = 0; i < sliceData.length - 1; i++) {
        const d0 = sliceData[i];
        const d1 = sliceData[i + 1];
        if (d0.spanAFut == null || d0.spanBFut == null) continue;

        const isForecast = i >= fStart;
        const bull = d0.spanAFut >= d0.spanBFut;
        ctx.beginPath();
        ctx.moveTo(xPos(i), priceToY(d0.spanAFut));
        ctx.lineTo(xPos(i + 1), priceToY(d1.spanAFut ?? d0.spanAFut));
        ctx.lineTo(xPos(i + 1), priceToY(d1.spanBFut ?? d0.spanBFut));
        ctx.lineTo(xPos(i), priceToY(d0.spanBFut));
        ctx.closePath();
        ctx.fillStyle = bull ? colors.kumo_bull_fill : colors.kumo_bear_fill;
        ctx.fill();
      }

      ["spanAFut", "spanBFut"].forEach((key, ki) => {
        ctx.beginPath();
        let started = false;
        sliceData.forEach((d, i) => {
          const val = d[key as keyof IchimokuBar] as number | null;
          if (val == null) return;
          if (!started) {
            ctx.moveTo(xPos(i), priceToY(val));
            started = true;
          } else {
            ctx.lineTo(xPos(i), priceToY(val));
          }
        });
        ctx.strokeStyle = ki === 0 ? colors.kumo_bull_stroke : colors.kumo_bear_stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      if (fStart > 0 && fStart < sliceData.length) {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(xPos(fStart), padT);
        ctx.lineTo(xPos(fStart), h - padB);
        ctx.strokeStyle = isDark ? "rgba(255,200,0,0.4)" : "rgba(180,130,0,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = isDark ? "rgba(255,200,0,0.7)" : "rgba(150,100,0,0.7)";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("FORECAST", xPos(fStart), padT - 4);
      }
    }

    // Chikou
    if (showChikou) {
      ctx.beginPath();
      let started = false;
      sliceData.forEach((d, i) => {
        if (d.chikou == null) return;
        if (!started) {
          ctx.moveTo(xPos(i), priceToY(d.chikou));
          started = true;
        } else {
          ctx.lineTo(xPos(i), priceToY(d.chikou));
        }
      });
      ctx.strokeStyle = colors.chikou;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Candlesticks — historical only
    sliceData.forEach((d, i) => {
      if (i >= histLen) return; // skip forecast synthetic bars
      const cx = xPos(i);
      const isUp = d.close >= d.open;
      const clr = isUp ? colors.candle_up : colors.candle_dn;
      ctx.strokeStyle = clr;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, priceToY(d.high));
      ctx.lineTo(cx, priceToY(d.low));
      ctx.stroke();
      const top = priceToY(Math.max(d.open, d.close));
      const bot = priceToY(Math.min(d.open, d.close));
      const bodyH = Math.max(1, bot - top);
      ctx.fillStyle = clr;
      ctx.fillRect(cx - candleW / 2, top, candleW, bodyH);
      if (!isUp) {
        ctx.strokeStyle = clr;
        ctx.strokeRect(cx - candleW / 2, top, candleW, bodyH);
      }
    });

    // Forecast bands — bear/base/bull range visualization
    if (forecastBars.length > 0) {
      forecastBars.forEach((fb, fi) => {
        const i = histLen + fi;
        const cx = xPos(i);
        const bw = Math.max(2, candleW * 1.2);

        // Bull-base fill (green)
        const bullY = priceToY(fb.bull);
        const baseY = priceToY(fb.base);
        const bearY = priceToY(fb.bear);

        ctx.fillStyle = "rgba(34,197,94,0.18)";
        ctx.fillRect(cx - bw / 2, bullY, bw, Math.max(1, baseY - bullY));

        // Bear-base fill (red)
        ctx.fillStyle = "rgba(224,92,92,0.18)";
        ctx.fillRect(cx - bw / 2, baseY, bw, Math.max(1, bearY - baseY));

        // Base line (white)
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - bw / 2, baseY);
        ctx.lineTo(cx + bw / 2, baseY);
        ctx.stroke();

        // Vertical range line
        ctx.strokeStyle = "rgba(200,200,200,0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(cx, bullY);
        ctx.lineTo(cx, bearY);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Tenkan
    if (showTenkan) {
      ctx.beginPath();
      let started = false;
      sliceData.forEach((d, i) => {
        if (d.tenkan == null) return;
        if (!started) {
          ctx.moveTo(xPos(i), priceToY(d.tenkan));
          started = true;
        } else {
          ctx.lineTo(xPos(i), priceToY(d.tenkan));
        }
      });
      ctx.strokeStyle = colors.tenkan;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Kijun
    if (showKijun) {
      ctx.beginPath();
      let started = false;
      sliceData.forEach((d, i) => {
        if (d.kijun == null) return;
        if (!started) {
          ctx.moveTo(xPos(i), priceToY(d.kijun));
          started = true;
        } else {
          ctx.lineTo(xPos(i), priceToY(d.kijun));
        }
      });
      ctx.strokeStyle = colors.kijun;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Date labels
    const step = Math.max(1, Math.floor(sliceData.length / 8));
    ctx.fillStyle = colors.text;
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    sliceData.forEach((d, i) => {
      if (i % step === 0) {
        const label = `${String(d.date.getMonth() + 1).padStart(2, "0")}/${String(d.date.getDate()).padStart(2, "0")}`;
        ctx.fillText(label, xPos(i), h - 6);
      }
    });

    // Hover tooltip
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - padL;
      const idx = Math.round(mx / barW);
      if (idx < 0 || idx >= sliceData.length) {
        if (tooltipRef.current) tooltipRef.current.style.display = "none";
        return;
      }
      const d = sliceData[idx];
      const isForecast = idx >= fStart;
      if (tooltipRef.current) {
        tooltipRef.current.style.display = "block";
        tooltipRef.current.style.left = e.clientX - rect.left + 10 + "px";
        tooltipRef.current.style.top = e.clientY - rect.top - 10 + "px";
        const fmt = (v: number | null) => v != null ? v.toFixed(v > 1000 ? 1 : 2) : "—";
        const dateStr = d.date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "2-digit" });
        if (isForecast && forecastBars[idx - histLen]) {
          const fb = forecastBars[idx - histLen];
          tooltipRef.current.innerHTML = `
            <div style="font-size:11px;color:#f0a500;margin-bottom:4px;font-weight:bold;">📅 ${dateStr} — FORECAST G+${idx - histLen + 1}</div>
            <div style="color:#22c55e;">🐂 Boğa: $${fmt(fb.bull)}</div>
            <div style="color:#aaa;">📊 Baz: $${fmt(fb.base)}</div>
            <div style="color:#e05c5c;">🐻 Ayı: $${fmt(fb.bear)}</div>
            <div style="margin-top:4px;color:#f0a500;">Tenkan: ${fmt(d.tenkan)}</div>
            <div style="color:#e05c5c;">Kijun: ${fmt(d.kijun)}</div>
          `;
        } else {
          tooltipRef.current.innerHTML = `
            <div style="font-size:11px;color:#999;margin-bottom:4px;">${dateStr}</div>
            <div style="color:#22c55e;">A/K: ${fmt(d.open)} / ${fmt(d.close)}</div>
            <div>Y/D: ${fmt(d.high)} / ${fmt(d.low)}</div>
            <div style="color:#f0a500;">Tenkan: ${fmt(d.tenkan)}</div>
            <div style="color:#e05c5c;">Kijun: ${fmt(d.kijun)}</div>
            <div>SpanA: ${fmt(d.spanAFut)}</div>
            <div>SpanB: ${fmt(d.spanBFut)}</div>
          `;
        }
      }
    };

    canvas.onmouseleave = () => {
      if (tooltipRef.current) tooltipRef.current.style.display = "none";
    };

    // Update metrics
    // last = most recent historical bar (before forecast zone)
    const last = sliceData[Math.max(0, fStart - 1)];
    const fmt = (v: number | null) => v != null ? v.toFixed(v > 1000 ? 1 : 2) : "—";

    // Kumo: cloud at current bar = spanAFut/spanBFut of bar at (current - 0)
    // Since spanAFut[i] is drawn at position i, the cloud currently visible at
    // the last historical bar is last.spanAFut & last.spanBFut
    const cloudA = last.spanAFut;
    const cloudB = last.spanBFut;
    let kumoColor = "—";
    if (cloudA != null && cloudB != null) {
      const cloudTop = Math.max(cloudA, cloudB);
      const cloudBot = Math.min(cloudA, cloudB);
      if (last.close > cloudTop) kumoColor = "Yeşil (Boğa)";
      else if (last.close < cloudBot) kumoColor = "Kırmızı (Ayı)";
      else kumoColor = "Nötr (İçinde)";
    } else {
      // Fallback: use spanA/spanB of bar ~26 bars earlier (cloud at current position)
      const refBar = sliceData[Math.max(0, fStart - 27)];
      if (refBar?.spanA != null && refBar?.spanB != null) {
        const cloudTop = Math.max(refBar.spanA, refBar.spanB);
        const cloudBot = Math.min(refBar.spanA, refBar.spanB);
        if (last.close > cloudTop) kumoColor = "Yeşil (Boğa)";
        else if (last.close < cloudBot) kumoColor = "Kırmızı (Ayı)";
        else kumoColor = "Nötr (İçinde)";
      }
    }

    let signals: string[] = [];
    if (cloudA != null && cloudB != null) {
      const cloudTop = Math.max(cloudA, cloudB);
      const cloudBot = Math.min(cloudA, cloudB);
      if (last.close > cloudTop) signals.push("Fiyat bulut üstünde");
      else if (last.close < cloudBot) signals.push("Fiyat bulut altında");
      else signals.push("Fiyat bulut içinde");
    }
    if (last.tenkan && last.kijun) {
      if (last.tenkan > last.kijun) signals.push("Tenkan > Kijun (Yükseliş)");
      else signals.push("Tenkan < Kijun (Düşüş)");
    }
    const isBull = signals.some(s => s.includes("üstünde") || s.includes("Yükseliş"));
    const signalText = isBull ? "BOĞA" : signals.some(s => s.includes("altında")) ? "AYI" : "NÖTR";
    const signalColor = isBull ? "#22c55e" : signals.some(s => s.includes("altında")) ? "#e05c5c" : "#f0a500";

    setMetrics({
      close: fmt(last.close),
      tenkan: fmt(last.tenkan),
      kijun: fmt(last.kijun),
      kumo: kumoColor,
      signal: signalText,
      signalColor,
    });
  }, [historyOHLC, currentPrice, forecast15, showTenkan, showKijun, showChikou, showKumo]);

  return (
    <div className="space-y-3">
      {/* Kontrol */}
      <div className="space-y-2">
        <div className="text-[10px] text-slate-400 px-1">Grafik katmanları (açmak/kapatmak için tıkla)</div>
        <div className="flex flex-wrap gap-2 py-2 bg-[#0d1321]/50 rounded-lg border border-[#1e3a5f]/30 px-3">
          {[
            { state: showTenkan, setState: setShowTenkan, label: "Kısa Trend", sublabel:"9 günlük", color: "#f0a500" },
            { state: showKijun, setState: setShowKijun, label: "Orta Trend", sublabel:"26 günlük", color: "#e05c5c" },
            { state: showChikou, setState: setShowChikou, label: "Momentum", sublabel:"26G geri", color: "#a855f7" },
            { state: showKumo, setState: setShowKumo, label: "Destek/Direnç Bulutu", sublabel:"", color: "#22c55e" },
          ].map(({ state, setState, label, sublabel, color }) => (
            <label key={label} className="flex items-center gap-1.5 text-[10px] md:text-[11px] font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={state}
                onChange={(e) => setState(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
              />
              <span style={{ color }}>■</span>
              <span>{label}</span>
              {sublabel && <span className="text-[9px] text-slate-500">({sublabel})</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative bg-[#0a0e18] border border-[#1e3a5f]/40 rounded-lg overflow-hidden" style={{ height: "320px" }}>
        <canvas ref={canvasRef} className="w-full h-full" />
        <div
          ref={tooltipRef}
          style={{
            display: "none",
            position: "absolute",
            background: "#0d1321",
            border: "1px solid #1e3a5f",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "12px",
            color: "#aaa",
            pointerEvents: "none",
            zIndex: 10,
            minWidth: "160px",
          }}
        />
      </div>

      {/* Metrikler */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] md:text-[11px]">
        <div className="bg-[#0d1321]/50 rounded-lg p-2 border border-[#1e3a5f]/30">
          <div className="text-slate-500 mb-0.5 text-[9px] uppercase tracking-wide">Son Kapanış</div>
          <div className="text-white font-black text-sm">${metrics.close}</div>
        </div>
        <div className="bg-[#0d1321]/50 rounded-lg p-2 border border-[#f0a500]/20">
          <div className="text-[9px] uppercase tracking-wide mb-0.5" style={{color:"#f0a500"}}>Kısa Trend</div>
          <div className="text-[9px] text-slate-500 mb-0.5">(9 günlük)</div>
          <div style={{ color: "#f0a500" }} className="font-black">${metrics.tenkan}</div>
        </div>
        <div className="bg-[#0d1321]/50 rounded-lg p-2 border border-[#e05c5c]/20">
          <div className="text-[9px] uppercase tracking-wide mb-0.5" style={{color:"#e05c5c"}}>Orta Trend</div>
          <div className="text-[9px] text-slate-500 mb-0.5">(26 günlük)</div>
          <div style={{ color: "#e05c5c" }} className="font-black">${metrics.kijun}</div>
        </div>
        <div className="bg-[#0d1321]/50 rounded-lg p-2 border border-[#22c55e]/20">
          <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">D/D Bulutu</div>
          <div className="font-black text-[10px]" style={{ color: metrics.kumo.includes("Yeşil") ? "#22c55e" : metrics.kumo.includes("Kırmızı") ? "#e05c5c" : "#94a3b8" }}>
            {metrics.kumo.includes("Yeşil") ? "🟢 Boğa" : metrics.kumo.includes("Kırmızı") ? "🔴 Ayı" : "⚪ —"}
          </div>
        </div>
        <div className="bg-[#0d1321]/50 rounded-lg p-2 border border-[#1e3a5f]/30">
          <div className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5">Genel Sinyal</div>
          <div className="font-black text-[11px]" style={{ color: metrics.signalColor }}>
            {metrics.signal === "BOĞA" ? "↗ BOĞA" : metrics.signal === "AYI" ? "↘ AYI" : "→ NÖTR"}
          </div>
        </div>
      </div>
    </div>
  );
}
