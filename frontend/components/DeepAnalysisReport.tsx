"use client";

import { useEffect, useRef, useState } from "react";
import IchimokuChart from "./IchimokuChart";

interface Props { ticker: string; stockData: any; onClose: () => void; lang?: "tr" | "en"; }

// ── Mini helpers ──────────────────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h3 className="text-[11px] md:text-[12px] font-black text-white uppercase tracking-[0.15em]">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-[#1e3a5f] to-transparent" />
    </div>
  );
}

function Badge({ score, lang = "tr" }: { score: number; lang?: "tr" | "en" }) {
  const t = (tr: string, en: string) => (lang === "en" ? en : tr);
  if (score >= 1) return <span className="px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px] md:text-[12px] font-black uppercase">✅ {t("EVET", "YES")}</span>;
  if (score === 0) return <span className="px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] md:text-[12px] font-black uppercase">🔍 {t("ORTA", "MID")}</span>;
  return <span className="px-2 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/40 text-[11px] md:text-[12px] font-black uppercase">❌ {t("HAYIR", "NO")}</span>;
}

// ── Combined Historical + Forecast Chart ───────────────────────────────────────
function ForecastChart({
  historyOHLC,
  forecast15,
  currentPrice,
  lang = "tr",
}: {
  historyOHLC?: any[];
  forecast15: any[];
  currentPrice: number;
  lang?: "tr" | "en";
}) {
  const t = (tr: string, en: string) => (lang === "en" ? en : tr);
  if (!forecast15?.length) return null;

  // Get last 30 days of history (or fewer if not available)
  const history = (historyOHLC || []).slice(-30);
  const historyCloses = history.map((h: any) => h.close || h.price || 0);

  // Combine all values for min/max calc
  const forecastVals = forecast15.flatMap((d: any) => [d.bear, d.base, d.bull]);
  const allVals = [...historyCloses, ...forecastVals, currentPrice];
  const minV = Math.min(...allVals) * 0.995;
  const maxV = Math.max(...allVals) * 1.005;
  const range = maxV - minV || 1;
  const pct = (v: number) => ((v - minV) / range) * 100;

  // Total chart width: history + forecast
  const totalBars = history.length + forecast15.length;
  const W = 100 / totalBars; // Width per bar

  return (
    <div className="bg-[#0a0e18] border border-[#1e3a5f]/50 rounded-xl p-4 overflow-x-auto">
      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-3">
        📈 {t("Son 30 Gün + 15 Gün Forecast Grafiği", "Last 30 Days + 15-Day Forecast Chart")}
      </div>
      <div className="relative" style={{ height: 140, minWidth: Math.max(600, totalBars * 15) }}>
        {/* Gridlines */}
        {[0, 25, 50, 75, 100].map((p) => (
          <div
            key={p}
            className="absolute w-full border-t border-[#1e3a5f]/30"
            style={{ bottom: `${p}%` }}
          >
            <span className="absolute -left-1 -translate-y-1/2 text-[10px] md:text-[11px] text-slate-600 font-mono pr-1">
              ${(minV + (range * p) / 100).toFixed(1)}
            </span>
          </div>
        ))}

        {/* Separator line between history and forecast */}
        {history.length > 0 && (
          <div
            className="absolute h-full border-r border-dashed border-[#1e3a5f]/60 z-5"
            style={{ left: `${(history.length * W).toFixed(1)}%` }}
          />
        )}

        {/* Current price line */}
        <div
          className="absolute w-full border-t border-dashed border-amber-400/60 z-10"
          style={{ bottom: `${pct(currentPrice)}%` }}
        >
          <span className="absolute right-0 -translate-y-3 text-[10px] md:text-[11px] text-amber-400 font-black">
            {t("Güncel", "Current")} ${currentPrice.toFixed(2)}
          </span>
        </div>

        {/* SVG for chart */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 100 100`}
          preserveAspectRatio="none"
        >
          {/* Historical closes as line chart */}
          {history.length > 0 && (
            <polyline
              points={historyCloses
                .map((close: number, i: number) => {
                  const x = (i * W + W / 2);
                  const y = 100 - pct(close);
                  return `${x},${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.2"
              opacity="0.8"
            />
          )}

          {/* Historical closes as dots */}
          {history.length > 0 &&
            historyCloses.map((close: number, i: number) => {
              const x = i * W + W / 2;
              const y = 100 - pct(close);
              return (
                <circle
                  key={`hist-${i}`}
                  cx={x}
                  cy={y}
                  r="0.8"
                  fill="#06b6d4"
                  opacity="0.6"
                />
              );
            })}

          {/* Forecast bands */}
          {forecast15.map((d: any, i: number) => {
            const x = (history.length + i) * W;
            return (
              <g key={`forecast-${i}`}>
                {/* Bear-Base fill */}
                <rect
                  x={x}
                  y={100 - pct(d.base)}
                  width={W * 0.85}
                  height={Math.max(0.3, pct(d.base) - pct(d.bear))}
                  fill="rgba(239,68,68,0.12)"
                />
                {/* Base-Bull fill */}
                <rect
                  x={x}
                  y={100 - pct(d.bull)}
                  width={W * 0.85}
                  height={Math.max(0.3, pct(d.bull) - pct(d.base))}
                  fill="rgba(16,185,129,0.12)"
                />
                {/* Bull line */}
                <line
                  x1={x + W * 0.425}
                  y1={100 - pct(d.bull)}
                  x2={x + W * 0.425}
                  y2={100 - pct(d.bear)}
                  stroke="#10b981"
                  strokeWidth="0.6"
                  opacity="0.7"
                />
                {/* Base line */}
                <rect
                  x={x}
                  y={100 - pct(d.base) - 0.4}
                  width={W * 0.85}
                  height={0.8}
                  fill="#f59e0b"
                  opacity="0.85"
                />
                {/* Bear line */}
                <line
                  x1={x + W * 0.425}
                  y1={100 - pct(d.bear)}
                  x2={x + W * 0.425}
                  y2={100 - pct(d.bear)}
                  stroke="#ef4444"
                  strokeWidth="0.6"
                  opacity="0.7"
                />
              </g>
            );
          })}

          {/* Current price reference line */}
          <line
            x1="0"
            y1={100 - pct(currentPrice)}
            x2="100"
            y2={100 - pct(currentPrice)}
            stroke="#f59e0b"
            strokeWidth="0.4"
            strokeDasharray="2,2"
            opacity="0.5"
          />
        </svg>

        {/* X-axis labels */}
        <div
          className="absolute -bottom-6 left-0 right-0 flex"
          style={{ paddingLeft: `${(W / 2).toFixed(1)}%` }}
        >
          {/* History labels (every 10 days) */}
          {history.length > 0 &&
            history
              .map((h: any, i: number) => {
                if (i % Math.max(1, Math.floor(history.length / 3)) !== 0) return null;
                const dayAgo = history.length - i;
                return (
                  <div
                    key={`hist-label-${i}`}
                    className="text-[9px] md:text-[10px] text-slate-500 font-mono"
                    style={{ width: `${W}%`, flexShrink: 0, textAlign: "center" }}
                  >
                    -{dayAgo}{t("G", "D")}
                  </div>
                );
              })
              .filter(Boolean)}

          {/* Forecast labels (every 3 days) */}
          {forecast15
            .map((d: any, i: number) => {
              if (i % 3 !== 0) return null;
              return (
                <div
                  key={`forecast-label-${i}`}
                  className="text-[9px] md:text-[10px] text-slate-500 font-mono"
                  style={{ width: `${W * 3}%`, flexShrink: 0, textAlign: "center" }}
                >
                  {t("G", "D")}+{d.day}
                </div>
              );
            })
            .filter(Boolean)}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-10 text-[10px] md:text-[11px] font-black">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#06b6d4] inline-block" />
          {t("Geçmiş Kapanış", "Historical Close")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
          {t("Bull Senaryo", "Bull Scenario")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-400 inline-block" />
          {t("Base Senaryo", "Base Scenario")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-rose-500 inline-block" />
          {t("Bear Senaryo", "Bear Scenario")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />
          {t("Güncel Fiyat", "Current Price")}
        </span>
      </div>
    </div>
  );
}

// ── Print styles injected once ─────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  /* Hide everything except our report */
  body > *:not(#boga-deep-print) { display: none !important; }

  /* Report wrapper: static, full, scrollable content visible */
  #boga-deep-print {
    display: block !important;
    position: static !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    width: 100% !important;
    background: #070b12 !important;
    color: white !important;
    backdrop-filter: none !important;
  }

  /* Hide navigation/buttons */
  #boga-deep-print .no-print { display: none !important; }

  /* Inner scroll container must be fully expanded */
  #boga-deep-print .print-content {
    overflow: visible !important;
    overflow-y: visible !important;
    height: auto !important;
    max-height: none !important;
    flex: none !important;
    display: block !important;
    padding: 8px 12px !important;
  }

  /* All nested overflow containers must be expanded */
  #boga-deep-print div {
    overflow: visible !important;
    max-height: none !important;
  }

  /* Preserve horizontal scroll for tables (print as-is) */
  #boga-deep-print .overflow-x-auto {
    overflow-x: visible !important;
  }

  /* Color accuracy */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  @page { margin: 8mm; size: A4 portrait; }
}
`;

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DeepAnalysisReport({ ticker, stockData, onClose, lang = "tr" }: Props) {
  // Inline TR/EN translation helper — L("Türkçe", "English") returns the string for the active lang
  const L = (tr: string, en: string) => (lang === "en" ? en : tr);
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "boga-print-style";
    style.textContent = PRINT_STYLE;
    if (!document.getElementById("boga-print-style")) document.head.appendChild(style);
    return () => { document.getElementById("boga-print-style")?.remove(); };
  }, []);

  useEffect(() => {
    fetch("/api/deep-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, stockData, lang }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return; }
        setData(d);
        setLoading(false);
        // Auto-archive silently
        fetch("/api/deep-analysis-archive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, reportData: d }),
        }).catch(() => {});
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [ticker]);

  const handleExportPDF = () => {
    if (exportingPdf) return;
    setExportingPdf(true);

    const now = new Date();
    const istOffset = 3 * 60;
    const local = new Date(now.getTime() + istOffset * 60 * 1000);
    const date  = local.toISOString().slice(0, 10);
    const time  = local.toISOString().slice(11, 16).replace(":", "");
    const title = `BOGA_DERIN_ANALIZ_${ticker.toUpperCase()}_${date}_${time}`;
    const prev = document.title;
    document.title = title;

    // 1. Scroll print-content to top
    const printContent = document.querySelector<HTMLElement>("#boga-deep-print .print-content");
    if (printContent) printContent.scrollTop = 0;

    // 2. Convert canvas elements to <img> for print (canvas doesn't print in all browsers)
    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>("#boga-deep-print canvas"));
    const replacements: Array<{ canvas: HTMLCanvasElement; img: HTMLImageElement }> = [];
    canvases.forEach(canvas => {
      try {
        const w = canvas.offsetWidth || canvas.width;
        const h = canvas.offsetHeight || canvas.height;
        if (w < 10 || h < 10) return;
        const dataUrl = canvas.toDataURL("image/png");
        const img = document.createElement("img");
        img.src = dataUrl;
        img.style.cssText = `width:${w}px;height:${h}px;display:block;max-width:100%;border-radius:8px;page-break-inside:avoid;`;
        img.className = "print-canvas-snapshot";
        canvas.parentElement?.insertBefore(img, canvas);
        canvas.style.display = "none";
        replacements.push({ canvas, img });
      } catch { /* tainted canvas – skip */ }
    });

    // 3. Trigger print after a frame to let browser paint img elements
    setTimeout(() => {
      window.print();
      // 4. Restore everything after print dialog
      setTimeout(() => {
        replacements.forEach(({ canvas, img }) => {
          canvas.style.display = "";
          img.remove();
        });
        document.title = prev;
        setExportingPdf(false);
      }, 1000);
    }, 300);
  };

  const handleShare = async () => {
    const basePath = window.location.pathname.includes("/global/") ? window.location.pathname.split("?")[0] : "/ai";
    const shareUrl = `${window.location.origin}${basePath}?ticker=${ticker.toUpperCase()}&deep=1`;
    const shareTitle = L(`BOGA AI Derin Analiz — ${ticker.toUpperCase()}`, `BOGA AI Deep Analysis — ${ticker.toUpperCase()}`);
    const shareText = `${shareTitle}\n${companyName} · $${currentPrice.toFixed(2)}\n\n${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      } catch (e: any) { if (e?.name !== "AbortError") { await navigator.clipboard.writeText(shareText); alert(L("Bağlantı kopyalandı!", "Link copied!")); } }
    } else {
      try { await navigator.clipboard.writeText(shareText); alert(L("Bağlantı kopyalandı! 📋", "Link copied! 📋")); }
      catch { alert(L(`Paylaşım bağlantısı:\n${shareUrl}`, `Share link:\n${shareUrl}`)); }
    }
  };

  const currentPrice = stockData?.price?.current || 0;
  const companyName = stockData?.company || ticker;

  return (
    <div id="boga-deep-print" className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <div className="no-print shrink-0 flex items-center justify-between px-4 py-2.5 bg-[#060a12] border-b border-[#1e3a5f] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#06b6d4] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <div className="text-[11px] md:text-[12px] font-black text-white uppercase tracking-widest">{L("BOGA AI — DERİN ANALİZ RAPORU", "BOGA AI — DEEP ANALYSIS REPORT")}</div>
            <div className="text-[11px] md:text-[12px] text-[#06b6d4] font-bold">{ticker.toUpperCase()} • {companyName} • ${currentPrice.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && data && (<>
            <button onClick={handleShare} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 text-[11px] md:text-[12px] font-black uppercase tracking-wider transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              {L("Paylaş", "Share")}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b] hover:bg-[#f59e0b]/20 text-[11px] md:text-[12px] font-black uppercase tracking-wider transition-all disabled:opacity-60"
            >
              {exportingPdf ? (
                <><span className="w-3.5 h-3.5 border-2 border-[#f59e0b]/40 border-t-[#f59e0b] rounded-full animate-spin inline-block" />{L("Hazırlanıyor...", "Preparing...")}</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>{L("PDF Kaydet", "Save PDF")}</>
              )}
            </button>
          </>)}
          <button onClick={onClose} className="p-2 rounded-lg border border-[#1e2a3a] hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="print-content flex-1 overflow-y-auto bg-[#070b12]">
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#06b6d4] flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div className="text-center">
              <p className="text-white font-black text-sm uppercase tracking-widest">{L("Derin Analiz Hazırlanıyor", "Preparing Deep Analysis")}</p>
              <p className="text-[#06b6d4] text-xs mt-1 font-bold">{L(`${ticker.toUpperCase()} için historical data + 15G forecast yükleniyor...`, `Loading historical data + 15-day forecast for ${ticker.toUpperCase()}...`)}</p>
            </div>
            <div className="flex gap-1.5">{[0,150,300].map(d=><span key={d} className="w-2 h-2 rounded-full bg-[#3b82f6] animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-4xl">⚠️</p>
            <p className="text-rose-400 font-black text-sm">{L("Analiz yüklenemedi", "Failed to load analysis")}</p>
            <p className="text-slate-400 text-xs max-w-xs text-center">{error}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-black uppercase hover:bg-rose-500/20 transition-all">{L("Kapat", "Close")}</button>
          </div>
        )}

        {!loading && !error && data && (() => {
          const { analysis, rawData, currentPrice: apiCurrentPrice } = data;
          const rd = rawData;
          const a = analysis;
          const currentPrice = apiCurrentPrice || stockData?.price?.current || 0;

          return (
            <div ref={reportRef} className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

              {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1829] via-[#0a1220] to-[#070b12] border border-[#1e3a5f] p-5 md:p-7">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1d4ed818,_transparent_60%)]" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{ticker.toUpperCase()}</h1>
                      <span className="text-slate-400 font-bold text-lg">{data.companyName}</span>
                    </div>
                    <p className="text-[11px] md:text-[12px] font-mono text-[#06b6d4] tracking-widest uppercase mt-1">{data.sector} • {data.industry} • {L("DERİN ANALİZ & 15G FORECAST", "DEEP ANALYSIS & 15-DAY FORECAST")} • {new Date().toLocaleDateString(lang === "en" ? "en-US" : "tr-TR")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-black text-white font-mono">${rd.currentPrice?.toFixed(2) ?? currentPrice.toFixed(2)}</div>
                    <div className="mt-1 px-3 py-1 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#06b6d4] text-white text-[11px] md:text-[12px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 inline-block">{L("BOGA SKOR", "BOGA SCORE")}: {rd.masterScore}/100</div>
                  </div>
                </div>
                {/* EMA Profile Badge */}
                {rd.emaProfile && (() => {
                  const p = rd.emaProfile;
                  const colors: Record<string, string> = { A: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300", B: "border-amber-500/50 bg-amber-500/10 text-amber-300", C: "border-rose-500/50 bg-rose-500/10 text-rose-300" };
                  return (
                    <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider ${colors[p.profile]}`}>
                      <span>🧬 {L("Profil", "Profile")} {p.profile} — {p.label}</span>
                      <span className="opacity-70 font-medium normal-case hidden sm:inline">| {p.desc}</span>
                    </div>
                  );
                })()}

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  {[
                    { l: "RSI (14)", v: rd.rsi?.toFixed(1), c: rd.rsi>70?"text-rose-400":rd.rsi<30?"text-emerald-400":"text-amber-400" },
                    { l: L("ATR (Günlük)", "ATR (Daily)"), v: "$"+rd.atr?.toFixed(2)+" (%"+rd.atrPct?.toFixed(1)+")", c: "text-[#06b6d4]" },
                    { l: "IV Rank", v: rd.ivRank+"/100", c: rd.ivRank>50?"text-emerald-400":rd.ivRank>25?"text-amber-400":"text-rose-400" },
                    { l: L("IV/HV Oranı", "IV/HV Ratio"), v: rd.ivHvRatio?.toFixed(2)+"×", c: rd.ivHvRatio>1.3?"text-emerald-400":"text-amber-400" },
                  ].map(i=>(
                    <div key={i.l} className="bg-[#0a0e18]/70 border border-[#1e3a5f]/50 rounded-xl p-3">
                      <div className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider">{i.l}</div>
                      <div className={`text-sm font-black mt-1 font-mono ${i.c}`}>{i.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ BÖLÜM 1: DNA ═════════════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🧬" title={L("BÖLÜM 1 — HİSSE DNA & KARAKTERİSTİK ANALİZİ", "SECTION 1 — STOCK DNA & CHARACTERISTIC ANALYSIS")} />
                {/* Identity table */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] md:text-[12px]">
                  {[
                    [L("Ticker / Şirket", "Ticker / Company"), `${ticker.toUpperCase()} / ${data.companyName}`],
                    [L("Sektör", "Sector"), data.sector],
                    [L("Güncel Fiyat", "Current Price"), `$${currentPrice.toFixed(2)}`],
                    [L("Piyasa Değeri", "Market Cap"), rd.marketCapStr],
                    [L("BOGA Skor", "BOGA Score"), `${rd.masterScore}/100`],
                    [L("Analiz Tarihi", "Analysis Date"), new Date().toLocaleDateString(lang === "en" ? "en-US" : "tr-TR")],
                  ].map(([l,v])=>(
                    <div key={l} className="bg-[#0d1321]/60 border border-[#1e3a5f]/30 rounded-lg p-2.5">
                      <div className="text-[11px] md:text-[12px] text-slate-500 font-black uppercase tracking-wider">{l}</div>
                      <div className="text-white font-bold mt-0.5 truncate">{v}</div>
                    </div>
                  ))}
                </div>
                {/* DNA yorum */}
                <div className="bg-[#0c1422]/60 border border-[#06b6d4]/20 rounded-xl p-3">
                  <p className="text-[11px] md:text-[12px] text-slate-200 leading-relaxed">{a.dna.hisseTipi}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { l:`📈 ${L("Yükseliş Karakteri", "Uptrend Character")}`, v:a.dna.yukselisKarakteri, c:"border-emerald-500/30 bg-emerald-500/5" },
                    { l:`📉 ${L("Düşüş Karakteri", "Downtrend Character")}`,   v:a.dna.dususKarakteri,    c:"border-rose-500/30 bg-rose-500/5" },
                    { l:`📊 ${L("Hacim Tepkisi", "Volume Reaction")}`,     v:a.dna.hacimTepkisi,      c:"border-blue-500/30 bg-blue-500/5" },
                    { l:`📰 ${L("Haber Etkisi", "News Impact")}`,      v:a.dna.haberEtkisi,       c:"border-amber-500/30 bg-amber-500/5" },
                  ].map(i=>(
                    <div key={i.l} className={`border rounded-xl p-3 ${i.c}`}>
                      <div className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-wider mb-1">{i.l}</div>
                      <p className="text-[11px] md:text-[12px] text-slate-200 leading-relaxed">{i.v}</p>
                    </div>
                  ))}
                </div>
                {/* Beta / Likidite */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📐 {L("Piyasa Korelasyonu", "Market Correlation")}</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Endeks", "Index")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Değişim", "Change")}</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Durum", "Status")}</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { name:"S&P 500", v:rd.sp500Change, suffix:"%" },
                            { name:"NASDAQ",  v:rd.nasdaqChange, suffix:"%" },
                            { name:"VIX",     v:rd.vixPrice, suffix:"" },
                          ].map(r=>(
                            <tr key={r.name} className="border-b border-[#1e3a5f]/20">
                              <td className="px-3 py-2 font-bold text-slate-300">{r.name}</td>
                              <td className={`px-3 py-2 text-right font-black font-mono ${r.v != null && r.v >= 0 ? "text-emerald-400":"text-rose-400"}`}>
                                {r.v != null ? (r.name==="VIX"?r.v.toFixed(2):(r.v>=0?"+":"")+r.v.toFixed(2)+r.suffix) : "—"}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{r.name==="VIX"?(r.v>20?`⚠️ ${L("Yüksek","High")}`:`✅ ${L("Normal","Normal")}`):r.v!=null?(r.v>=0?`▲ ${L("Pozitif","Positive")}`:`▼ ${L("Negatif","Negative")}`):"—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">💧 {L("Likidite Endeksi", "Liquidity Index")}</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Metrik", "Metric")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Değer", "Value")}</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Yorum", "Note")}</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { m:L("Ort. Hacim (30G)", "Avg. Volume (30D)"), v: rd.avgVol30d>0?(rd.avgVol30d/1e6).toFixed(1)+"M":"—", d: rd.avgVol30d>5e6?`✅ ${L("Yeterli","Sufficient")}`:`⚠️ ${L("Dikkat","Caution")}` },
                            { m:L("Göreceli Hacim", "Relative Volume"),   v: rd.rvol?.toFixed(2)+"×", d: rd.rvol>1.5?`🔥 ${L("Yüksek","High")}`:rd.rvol>0.8?`✅ ${L("Normal","Normal")}`:`⚠️ ${L("Düşük","Low")}` },
                            { m:L("IV Bid/Ask (est.)", "IV Bid/Ask (est.)"),v: rd.iv>0 ? "%"+(rd.iv*0.05).toFixed(1):"—", d: rd.iv<50?`✅ ${L("Likit","Liquid")}`:`⚠️ ${L("Geniş","Wide")}` },
                          ].map(r=>(
                            <tr key={r.m} className="border-b border-[#1e3a5f]/20">
                              <td className="px-3 py-2 text-slate-300 font-medium">{r.m}</td>
                              <td className="px-3 py-2 text-right font-black text-[#06b6d4] font-mono">{r.v}</td>
                              <td className="px-3 py-2 text-slate-400">{r.d}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 2: TEKNİK VERİ ════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-5">
                <SectionTitle icon="📈" title={L("BÖLÜM 2 — TEKNİK VERİ SETİ & ZAMAN SERİSİ", "SECTION 2 — TECHNICAL DATA SET & TIME SERIES")} />

                {/* Son 15 Gün Tablosu */}
                <div>
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">⚡ {L("Son 15 Gün Fiyat-Hacim Verisi", "Last 15 Days Price-Volume Data")}</div>
                  {rd.history15?.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px] min-w-[500px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/50">
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Tarih", "Date")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Açılış", "Open")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Kapanış", "Close")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Günlük %", "Daily %")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Hacim (M)", "Volume (M)")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">ATR %</th>
                        </tr></thead>
                        <tbody>
                          {rd.history15.map((r: any, i: number) => (
                            <tr key={i} className={`border-b border-[#1e3a5f]/20 ${i%2===0?"bg-[#0a0e18]":"bg-[#0d1321]/40"} hover:bg-[#1e3a5f]/15`}>
                              <td className="px-3 py-2 font-bold text-slate-300 font-mono">{r.date}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-300">${r.open}</td>
                              <td className="px-3 py-2 text-right font-black font-mono text-white">${r.close}</td>
                              <td className={`px-3 py-2 text-right font-black font-mono ${r.changePct>=0?"text-emerald-400":"text-rose-400"}`}>
                                {r.changePct>=0?"+":""}{r.changePct}%
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-slate-400">{r.volume}M</td>
                              <td className={`px-3 py-2 text-right font-mono ${r.atrPct>120?"text-rose-400":r.atrPct>80?"text-amber-400":"text-slate-400"}`}>{r.atrPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr className="bg-[#0d1321] border-t border-[#1e3a5f]/60">
                          <td className="px-3 py-2 font-black text-[#06b6d4]" colSpan={3}>{L("ÖZET", "SUMMARY")}</td>
                          <td className={`px-3 py-2 text-right font-black font-mono ${rd.history15.reduce((s:number,r:any)=>s+r.changePct,0)>=0?"text-emerald-400":"text-rose-400"}`}>
                            {rd.history15.reduce((s:number,r:any)=>s+r.changePct,0).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-300 font-mono">
                            {L("Ort", "Avg")}: {(rd.history15.reduce((s:number,r:any)=>s+r.volume,0)/rd.history15.length).toFixed(1)}M
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-300 font-mono">
                            {L("Ort", "Avg")}: {(rd.history15.reduce((s:number,r:any)=>s+r.atrPct,0)/rd.history15.length).toFixed(1)}%
                          </td>
                        </tr></tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-[11px] md:text-[12px] text-slate-500 bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-xl p-3">{L("Geçmiş veri yüklenemedi.", "Historical data could not be loaded.")}</div>
                  )}
                </div>

                {/* MA Tablosu */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📏 {L("Hareketli Ortalama Disiplini", "Moving Average Discipline")}</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Periyot", "Period")}</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Değer", "Value")}</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Durum", "Status")}</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { l:L("MA 7G", "MA 7D"),   v:rd.maLevels?.ma7   },
                            { l:L("MA 21G", "MA 21D"),  v:rd.maLevels?.ma21  },
                            { l:L("EMA 50G", "EMA 50D"), v:rd.maLevels?.ma50  },
                            { l:L("EMA 200G", "EMA 200D"),v:rd.maLevels?.ma200 },
                            { l:L("1Y Ort.", "1Y Avg."), v:rd.maLevels?.yearAvg},
                          ].map(r=>(
                            <tr key={r.l} className="border-b border-[#1e3a5f]/20">
                              <td className="px-3 py-2 font-bold text-slate-300">{r.l}</td>
                              <td className="px-3 py-2 text-right font-black font-mono text-white">${r.v?.toFixed(2)??"-"}</td>
                              <td className={`px-3 py-2 font-black text-[11px] md:text-[12px] ${currentPrice>=(r.v||0)?"text-emerald-400":"text-rose-400"}`}>
                                {currentPrice>=(r.v||0)?`▲ ${L("Üstünde","Above")}`:`▼ ${L("Altında","Below")}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={`mt-2 px-3 py-2 rounded-lg border text-[11px] md:text-[12px] font-black uppercase tracking-wider ${rd.maLevels?.goldenCross?"border-emerald-500/30 bg-emerald-500/10 text-emerald-400":"border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
                      {rd.maLevels?.goldenCross ? "✅ GOLDEN CROSS (EMA20 > EMA50)" : "❌ DEATH CROSS (EMA20 < EMA50)"}
                    </div>
                  </div>

                  {/* Destek/Direnç */}
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">🧱 {L("Destek / Direnç Seviyeleri", "Support / Resistance Levels")}</div>
                    <div className="rounded-xl border border-[#1e3a5f]/40 overflow-hidden">
                      {[
                        { l:L("Direnç 3 (52H Tepe)", "Resistance 3 (52W High)"), v:rd.srLevels?.resistance3, type:"res3" },
                        { l:L("Direnç 2", "Resistance 2"),             v:rd.srLevels?.resistance2, type:"res2" },
                        { l:L("Direnç 1 (Yakın)", "Resistance 1 (Near)"),     v:rd.srLevels?.resistance1, type:"res1" },
                        { l:L("GÜNCEL FİYAT", "CURRENT PRICE"),          v:currentPrice,             type:"cur"  },
                        { l:L("Destek 1 (Güçlü)", "Support 1 (Strong)"),     v:rd.srLevels?.support1,    type:"sup1" },
                        { l:L("Destek 2", "Support 2"),             v:rd.srLevels?.support2,    type:"sup2" },
                        { l:L("Destek 3 (52H Dip)", "Support 3 (52W Low)"),   v:rd.srLevels?.support3,    type:"sup3" },
                      ].map(r=>{
                        const isCur = r.type==="cur";
                        const isRes = r.type.startsWith("res");
                        const isSup = r.type.startsWith("sup");
                        return (
                          <div key={r.l} className={`flex items-center justify-between px-3 py-2 border-b border-[#1e3a5f]/20 text-[11px] md:text-[12px] ${isCur?"bg-[#1e3a5f]/40 border-l-2 border-l-amber-400":"bg-[#0a0e18]"}`}>
                            <span className={`font-bold ${isCur?"text-amber-400 font-black":isRes?"text-rose-300":isSup?"text-emerald-300":"text-slate-400"}`}>{r.l}</span>
                            <span className={`font-black font-mono ${isCur?"text-amber-400":isRes?"text-rose-400":isSup?"text-emerald-400":"text-white"}`}>${r.v?.toFixed(2)??"-"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Fiyat/Hacim & Teknik Göstergeler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">💹 {L("Teknik Göstergeler", "Technical Indicators")}</div>
                    <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4 space-y-2.5 font-mono text-[11px] md:text-[12px]">
                      {[
                        { l:"RSI (14)", v: rd.rsi?.toFixed(1), c: rd.rsi>70?"text-rose-400":rd.rsi<30?"text-emerald-400":"text-amber-400", note: rd.rsi>70?L("Aşırı Alım","Overbought"):rd.rsi<30?L("Aşırı Satım","Oversold"):L("Nötr","Neutral") },
                        { l:"EMA 20",  v:"$"+rd.ema20?.toFixed(2), c: currentPrice>rd.ema20?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema20?`${L("Üstünde","Above")} ✅`:`${L("Altında","Below")} ❌` },
                        { l:"EMA 50",  v:"$"+rd.ema50?.toFixed(2), c: currentPrice>rd.ema50?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema50?`${L("Üstünde","Above")} ✅`:`${L("Altında","Below")} ❌` },
                        { l:"EMA 200", v:"$"+rd.ema200?.toFixed(2),c: currentPrice>rd.ema200?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema200?L("Uzun vade boğa","Long-term bullish"):L("Uzun vade ayı","Long-term bearish") },
                        { l:"ATR",     v:"$"+rd.atr?.toFixed(2)+" (%"+rd.atrPct?.toFixed(1)+")", c:"text-[#06b6d4]", note:L("Günlük beklenen hareket","Expected daily move") },
                        { l:"MACD",    v: rd.macd >= 0 ? "+"+rd.macd?.toFixed(2):rd.macd?.toFixed(2), c: rd.macd>=0?"text-emerald-400":"text-rose-400", note: rd.macd>=0?L("Pozitif momentum","Positive momentum"):L("Negatif momentum","Negative momentum") },
                      ].map(i=>(
                        <div key={i.l} className="flex justify-between items-center border-b border-[#1e3a5f]/20 pb-2">
                          <span className="text-slate-400 font-black text-[11px] md:text-[12px] uppercase w-16 shrink-0">{i.l}</span>
                          <span className={`font-black ${i.c}`}>{i.v}</span>
                          <span className="text-[11px] md:text-[12px] text-slate-500">{i.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📝 {L("Teknik Yorum", "Technical Commentary")}</div>
                      <div className="space-y-2">
                        {[
                          { l:L("Trend", "Trend"), v:a.teknikYorum.trendDurumu },
                          { l:L("Momentum", "Momentum"), v:a.teknikYorum.momentumYorumu },
                          { l:L("Seviyeler", "Levels"), v:a.teknikYorum.kritikSeviyeler },
                          { l:L("Volatilite", "Volatility"), v:a.teknikYorum.volatilite },
                        ].map(i=>(
                          <div key={i.l} className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-2.5">
                            <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-wider mb-0.5">{i.l}</div>
                            <p className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed">{i.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* IV parametreleri */}
                    <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-3">
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">{L("IV Parametreleri (1G Statistik)", "IV Parameters (1D Statistics)")}</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] md:text-[12px]">
                        {[
                          { l:L("30G 1 SD Aralık", "30D 1 SD Range"), v:`$${rd.range1sd?.low}–$${rd.range1sd?.high}` },
                          { l:L("30G 2 SD Aralık", "30D 2 SD Range"), v:`$${rd.range2sd?.low}–$${rd.range2sd?.high}` },
                          { l:L("Impl. 30G Hareket", "Impl. 30D Move"),v:`±$${rd.implied30dMove?.toFixed(2)}` },
                          { l:L("Günlük Drift", "Daily Drift"),     v:`~${(rd.atr*0.04).toFixed(2)}% ${L("tahmini","est.")}` },
                        ].map(i=>(
                          <div key={i.l}>
                            <div className="text-[11px] md:text-[12px] text-slate-500 font-bold uppercase">{i.l}</div>
                            <div className="text-white font-black font-mono text-[11px] md:text-[12px]">{i.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 3: FORECAST & TEKNİK ANALİZ ═════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-5">
                <SectionTitle icon="🔮" title={L("BÖLÜM 3 — 15 GÜNLÜK FORECAST & İCHİMOKU ANALİZİ", "SECTION 3 — 15-DAY FORECAST & ICHIMOKU ANALYSIS")} />

                {/* İndikatör Filtreleri */}
                <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-3 flex flex-wrap gap-2">
                  <div className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase w-full mb-1">📊 {L("Teknik İndikatörler:", "Technical Indicators:")}</div>
                  {[
                    { id:"ichimoku", label:"Ichimoku", color:"#06b6d4" },
                    { id:"rsi", label:"RSI", color:"#f0a500" },
                    { id:"macd", label:"MACD", color:"#a855f7" },
                    { id:"bollinger", label:"Bollinger", color:"#ec4899" },
                    { id:"volume", label:L("Hacim", "Volume"), color:"#10b981" },
                    { id:"sr", label:L("Destek/Direnç", "Support/Resistance"), color:"#ef4444" },
                  ].map(ind => (
                    <label key={ind.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0a0e18] border border-[#1e3a5f]/40 hover:border-[#1e3a5f]/60 cursor-pointer text-[10px] md:text-[11px] font-semibold text-slate-300 transition-all">
                      <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" />
                      <span style={{color: ind.color}}>■</span> {ind.label}
                    </label>
                  ))}
                </div>

                {/* Ichimoku Chart */}
                <IchimokuChart historyOHLC={rd.historyOHLC} currentPrice={rd.currentPrice} forecast15={rd.forecast15 ?? a.forecast15} />

                {/* Combined Historical + Forecast Chart */}
                <ForecastChart
                  historyOHLC={rd.historyOHLC}
                  forecast15={a.forecast15}
                  currentPrice={currentPrice}
                  lang={lang}
                />

                {/* Destek/Direnç Seviyeleri */}
                <div className="bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-lg p-3">
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2.5">🧱 {L("Destek / Direnç Seviyeleri", "Support / Resistance Levels")}</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] md:text-[11px]">
                    {[
                      { l:L("Direnç 3", "Resist. 3"), v:rd.srLevels?.resistance3, c:"text-rose-400", bg:"bg-rose-500/10" },
                      { l:L("Direnç 2", "Resist. 2"), v:rd.srLevels?.resistance2, c:"text-rose-400", bg:"bg-rose-500/10" },
                      { l:L("Direnç 1", "Resist. 1"), v:rd.srLevels?.resistance1, c:"text-rose-300", bg:"bg-rose-500/15" },
                      { l:L("Destek 1", "Support 1"), v:rd.srLevels?.support1, c:"text-emerald-300", bg:"bg-emerald-500/15" },
                      { l:L("Destek 2", "Support 2"), v:rd.srLevels?.support2, c:"text-emerald-400", bg:"bg-emerald-500/10" },
                      { l:L("Destek 3", "Support 3"), v:rd.srLevels?.support3, c:"text-emerald-400", bg:"bg-emerald-500/10" },
                    ].map((s, i) => (
                      <div key={i} className={`${s.bg} border border-[#1e3a5f]/40 rounded px-2 py-1.5 text-center`}>
                        <div className="text-slate-500 font-semibold mb-0.5">{s.l}</div>
                        <div className={`font-black font-mono ${s.c}`}>${(+s.v)?.toFixed(2) ?? "-"}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* İchimoku + Diğer İndikatörler */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">☁️ {L("İchimoku Teknik Göstergeler", "Ichimoku Technical Indicators")}</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#f0a500]/20">
                        <div className="flex flex-col">
                          <span className="text-[#f0a500] font-black">{L("Kısa Dönem Trend", "Short-Term Trend")}</span>
                          <span className="text-[9px] text-slate-500">{L("Son 9 günlük fiyat ortalaması", "Last 9-day price average")}</span>
                        </div>
                        <span className="text-[#f0a500] font-semibold">${rd.ema20?.toFixed(2) ?? "-"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#e05c5c]/20">
                        <div className="flex flex-col">
                          <span className="text-[#e05c5c] font-black">{L("Orta Dönem Trend", "Mid-Term Trend")}</span>
                          <span className="text-[9px] text-slate-500">{L("Son 26 günlük fiyat ortalaması", "Last 26-day price average")}</span>
                        </div>
                        <span className="text-[#e05c5c] font-semibold">${rd.ema50?.toFixed(2) ?? "-"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#22c55e]/20">
                        <div className="flex flex-col">
                          <span className="text-slate-300 font-black">{L("Destek/Direnç Bulutu", "Support/Resistance Cloud")}</span>
                          <span className="text-[9px] text-slate-500">{L("Fiyat bulutun üstünde → Boğa trendi", "Price above cloud → Bullish trend")}</span>
                        </div>
                        <span className={rd.masterScore >= 60 ? "text-emerald-400 font-black" : rd.masterScore >= 45 ? "text-amber-400 font-black" : "text-rose-400 font-black"}>
                          {rd.masterScore >= 60 ? `🟢 ${L("Boğa","Bull")}` : rd.masterScore >= 45 ? `🟡 ${L("Nötr","Neutral")}` : `🔴 ${L("Ayı","Bear")}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#a855f7]/20">
                        <div className="flex flex-col">
                          <span className="text-[#a855f7] font-black">{L("Momentum Çizgisi", "Momentum Line")}</span>
                          <span className="text-[9px] text-slate-500">{L("Kapanış fiyatı 26 gün geri kaydırılmış", "Closing price shifted back 26 days")}</span>
                        </div>
                        <span className="text-[#a855f7] font-semibold text-[10px]">{L("Grafikte görülebilir", "Visible on chart")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">📊 {L("Diğer İndikatörler", "Other Indicators")}</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#1e3a5f]/30">
                        <span className="text-slate-400">RSI (14)</span>
                        <span className={rd.rsi > 70 ? "text-rose-400 font-black" : rd.rsi < 30 ? "text-emerald-400 font-black" : "text-amber-400 font-black"}>
                          {rd.rsi?.toFixed(1) ?? "-"} {rd.rsi > 70 ? "⚠️" : rd.rsi < 30 ? "⚠️" : "→"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#1e3a5f]/30">
                        <span className="text-slate-400">IV Rank</span>
                        <span className={rd.ivRank > 50 ? "text-rose-400 font-black" : rd.ivRank > 25 ? "text-amber-400 font-black" : "text-blue-400 font-black"}>
                          {rd.ivRank?.toFixed(0) ?? "-"}/100
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#1e3a5f]/30">
                        <span className="text-slate-400">ATR</span>
                        <span className="text-[#06b6d4] font-semibold">${rd.atr?.toFixed(2) ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Forecast Table */}
                <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                  <table className="w-full text-[11px] md:text-[12px] min-w-[520px]">
                    <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/50">
                      <th className="px-2 py-2.5 text-left font-black text-[#06b6d4] w-10">{L("Gün", "Day")}</th>
                      <th className="px-2 py-2.5 text-right font-black text-rose-400">🐻 Bear</th>
                      <th className="px-2 py-2.5 text-right font-black text-amber-400">⚖️ Base</th>
                      <th className="px-2 py-2.5 text-right font-black text-emerald-400">🚀 Bull</th>
                      <th className="px-2 py-2.5 text-left font-black text-slate-400 hidden sm:table-cell">{L("İchimoku Sinyal", "Ichimoku Signal")}</th>
                    </tr></thead>
                    <tbody>
                      {a.forecast15.map((r:any,i:number)=>(
                        <tr key={i} className={`border-b border-[#1e3a5f]/20 ${i%2===0?"bg-[#0a0e18]":"bg-[#0d1321]/40"} hover:bg-[#1e3a5f]/15`}>
                          <td className="px-2 py-2 font-black text-slate-300">{L("G","D")}+{r.day}</td>
                          <td className="px-2 py-2 text-right font-bold text-rose-400 font-mono">${(+r.bear).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-black text-amber-300 font-mono">${(+r.base).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-bold text-emerald-400 font-mono">${(+r.bull).toFixed(2)}</td>
                          <td className="px-2 py-2 text-slate-400 hidden sm:table-cell text-[10px]">{i < 5 ? `↗ ${L("Yükseliş","Bullish")}` : i < 10 ? `➡️ ${L("Nötr","Neutral")}` : `↘ ${L("Düşüş","Bearish")}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Senaryo özeti */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key:"bear", label:`🐻 ${L("Bear Senaryo","Bear Scenario")}`, c:"border-rose-500/40 bg-rose-500/5 text-rose-400", d:a.scenarioOzeti.bear, supported: rd.masterScore < 45 },
                    { key:"base", label:`⚖️ ${L("Base Senaryo","Base Scenario")}`, c:"border-amber-500/40 bg-amber-500/5 text-amber-400", d:a.scenarioOzeti.base, supported: rd.masterScore >= 45 && rd.masterScore < 65 },
                    { key:"bull", label:`🚀 ${L("Bull Senaryo","Bull Scenario")}`, c:"border-emerald-500/40 bg-emerald-500/5 text-emerald-400", d:a.scenarioOzeti.bull, supported: rd.masterScore >= 65 },
                  ].map(s=>(
                    <div key={s.key} className={`border rounded-xl p-3 ${s.c}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] md:text-[12px] font-black uppercase tracking-wider">{s.label}</span>
                        <span className="text-sm font-black">%{s.d.olasilik}</span>
                      </div>
                      <div className="text-xl font-black font-mono text-white">${(+s.d.hedef).toFixed(2)}</div>
                      <p className="text-[11px] md:text-[12px] text-slate-400 mt-1 font-medium">{s.d.tetikleyici}</p>
                      <div className="mt-2 pt-2 border-t border-current border-opacity-20 text-[10px]">
                        {s.supported ? (
                          <span className="text-emerald-300 font-black">✓ {L("Ichimoku Destekli", "Ichimoku Supported")}</span>
                        ) : (
                          <span className="text-slate-400 font-medium">◐ {L("Kısmi Destek", "Partial Support")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ ÇEK LİSTESİ ════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="📋" title={L("HİSSE İNCELEME ÇEK LİSTESİ", "STOCK REVIEW CHECKLIST")} />
                {[
                  { group:`🔵 ${L("TREND & YAPI", "TREND & STRUCTURE")}`, items:[
                    { l:L("1W grafikte 50G MA üzerinde mi?", "Above 50D MA on 1W chart?"), s:a.ceklistSkorlar.trendYapisi },
                    { l:"EMA 20 > EMA 50 (Golden Cross)?", s:rd.maLevels?.goldenCross?1:-1 },
                    { l:L("EMA 20 üzerinde mi?", "Above EMA 20?"),             s:a.ceklistSkorlar.ema20Above },
                    { l:L("EMA 50 üzerinde mi?", "Above EMA 50?"),             s:a.ceklistSkorlar.ema50Above },
                    { l:L("BOGA Skor ≥ 60?", "BOGA Score ≥ 60?"),                 s:a.ceklistSkorlar.bogaScore },
                  ]},
                  { group:`🟡 ${L("VOLATİLİTE", "VOLATILITY")}`, items:[
                    { l:L("IV Rank > 30?", "IV Rank > 30?"), s:a.ceklistSkorlar.ivUygun },
                    { l:L("IV/HV Oranı > 1.2? (IV pahalı)", "IV/HV Ratio > 1.2? (IV expensive)"), s:rd.ivHvRatio>1.2?1:rd.ivHvRatio>0.9?0:-1 },
                    { l:L("ATR volatilite uygun mu?", "Is ATR volatility favorable?"),         s:a.ceklistSkorlar.atrUygun },
                  ]},
                  { group:`🟢 ${L("STRATEJİK UYGUNLUK", "STRATEGIC FIT")}`, items:[
                    { l:L("Kritik destek üzerinde mi?", "Above key support?"),       s:a.ceklistSkorlar.destekGucu },
                    { l:L("RSI 40–70 arasında mı?", "RSI between 40–70?"),           s:a.ceklistSkorlar.momentumGuclu },
                    { l:L("Hisse elimde kalsa 1 ay bekler miyim?", "Would I hold this stock for a month?"), s:rd.masterScore>=55?1:rd.masterScore>=40?0:-1 },
                  ]},
                  { group:`🔴 ${L("RİSK KONTROLLERİ", "RISK CHECKS")}`, items:[
                    { l:L("Pozisyon portföyün max %5'i içinde mi?", "Is position within max 5% of portfolio?"), s:1 },
                    { l:L("Stop-loss seviyesi belirlendi mi?", "Stop-loss level defined?"),       s:1 },
                    { l:L("Makro risk (FOMC, CPI) değerlendirildi?", "Macro risk (FOMC, CPI) assessed?"), s:0 },
                  ]},
                ].map(group=>(
                  <div key={group.group}>
                    <div className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">{group.group}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.items.map(item=>(
                        <div key={item.l} className="flex items-center justify-between bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg px-3 py-2">
                          <span className="text-[11px] md:text-[12px] text-slate-300 font-medium">{item.l}</span>
                          <Badge score={item.s} lang={lang} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ══ FİNANSAL ANALİZ ════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="💹" title={L("FİNANSAL ANALİZ & HİSSE BEKLENTİSİ", "FINANCIAL ANALYSIS & STOCK OUTLOOK")} />

                {/* Finansal Metriks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2.5">📊 {L("Piyasa Değeri & Likidite", "Market Cap & Liquidity")}</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{L("Piyasa Değeri", "Market Cap")}</span>
                        <span className="text-white font-semibold">{rd.marketCapStr}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{L("30G Ort. Hacim", "30D Avg. Volume")}</span>
                        <span className="text-white font-semibold">{rd.avgVol30d > 1e6 ? (rd.avgVol30d / 1e6).toFixed(1) + "M" : (rd.avgVol30d / 1e3).toFixed(0) + "K"}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#1e3a5f]/30">
                        <span className="text-slate-400 font-medium">{L("Likidite Skoru", "Liquidity Score")}</span>
                        <span className={`font-black ${rd.avgVol30d > 1e6 ? "text-emerald-400 bg-emerald-500/10" : rd.avgVol30d > 500e3 ? "text-amber-400 bg-amber-500/10" : "text-rose-400 bg-rose-500/10"} px-2 py-0.5 rounded text-[10px]`}>
                          {rd.avgVol30d > 1e6 ? `${L("YÜKSEK","HIGH")} ✓` : rd.avgVol30d > 500e3 ? L("ORTA","MID") : L("DÜŞÜK","LOW")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2.5">📈 {L("Trend & Momentum", "Trend & Momentum")}</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{L("52H Aralığı", "52W Range")}</span>
                        <span className="text-white font-semibold">${rd.low52w?.toFixed(2)??"-"} / ${rd.high52w?.toFixed(2)??"-"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">{L("Konumlandırma", "Positioning")}</span>
                        <span className={`font-semibold ${currentPrice >= rd.high52w * 0.9 ? "text-emerald-400" : currentPrice <= rd.low52w * 1.1 ? "text-rose-400" : "text-amber-400"}`}>
                          {currentPrice >= rd.high52w * 0.9 ? `${L("ZİRVEYE YAKIN","NEAR HIGH")} ↗` : currentPrice <= rd.low52w * 1.1 ? `${L("DİBE YAKIN","NEAR LOW")} ↘` : `${L("ORTA SEVİYE","MID RANGE")} →`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#1e3a5f]/30">
                        <span className="text-slate-400 font-medium">{L("Beklenti (15G)", "Outlook (15D)")}</span>
                        <span className={`font-black bg-opacity-10 px-2 py-0.5 rounded text-[10px] ${rd.masterScore >= 65 ? "text-emerald-400 bg-emerald-500" : rd.masterScore >= 50 ? "text-amber-400 bg-amber-500" : "text-rose-400 bg-rose-500"}`}>
                          {rd.masterScore >= 65 ? `🚀 ${L("YÜKSELİŞ","BULLISH")}` : rd.masterScore >= 50 ? `➡️ ${L("NÖTR","NEUTRAL")}` : `📉 ${L("DÜŞÜŞ","BEARISH")}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Finansal Sağlık Özeti */}
                <div className="bg-gradient-to-r from-[#0d1321]/80 to-[#0a0e18] border border-[#06b6d4]/20 rounded-lg p-4">
                  <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-3">📋 {L("FİNANSAL SAĞLIK ÖZETİ", "FINANCIAL HEALTH SUMMARY")}</div>
                  <div className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed space-y-2">
                    <p>
                      <span className="font-semibold text-[#06b6d4]">{data.companyName}</span>
                      {rd.marketCapStr !== "N/A" ? ` (${L("Piyasa Değeri","Market Cap")}: ${rd.marketCapStr})` : ""}
                      {" "}{rd.avgVol30d > 500e3 ? L("yeterli işlem hacmine sahip, ", "has sufficient trading volume, ") : L("sınırlı likiditeye sahip, ", "has limited liquidity, ")}
                      {currentPrice >= rd.high52w * 0.85 ? L("52 haftalık en yüksek seviyeye yakında ", "trading near its 52-week high ") : currentPrice <= rd.low52w * 1.15 ? L("52 haftalık en düşük seviyeye yakında ", "trading near its 52-week low ") : L("52 haftalık aralığın ortasında ", "trading in the middle of its 52-week range ")}
                      {L("konumlanmaktadır.", "")}
                    </p>
                    <p>
                      <span className="font-semibold text-amber-400">{L("Teknik İndikatörler:", "Technical Indicators:")}</span>
                      {rd.masterScore >= 65 ? L(" Güçlü yükseliş sinyalleri (BOGA Skoru ≥65) ile desteklenmektedir.", " Supported by strong bullish signals (BOGA Score ≥65).")
                      : rd.masterScore >= 50 ? L(" Nötr görünüm (BOGA Skoru 50-64). Pozisyon seçimi önem taşıyor, risk yönetimi gereklidir.", " Neutral outlook (BOGA Score 50-64). Position selection matters, risk management required.")
                      : L(" Düşüş baskısı altında (BOGA Skoru <50). Temkinli yaklaşım önerilir.", " Under downward pressure (BOGA Score <50). A cautious approach is recommended.")}
                    </p>
                    <p>
                      <span className="font-semibold text-cyan-400">{L("İndikatör Analizi:", "Indicator Analysis:")}</span>
                      {" "}RSI {rd.rsi?.toFixed(1)}% ({rd.rsi > 70 ? L("aşırı alım","overbought") : rd.rsi < 30 ? L("aşırı satım","oversold") : L("nötr","neutral")}),
                      {" "}{L("Volatilite (IV)","Volatility (IV)")} %{rd.iv} ({rd.iv > 50 ? L("yüksek","high") : rd.iv > 30 ? L("orta","mid") : L("düşük","low")}).
                    </p>
                    <div className="pt-2 border-t border-[#1e3a5f]/30 mt-3">
                      <span className="font-semibold text-emerald-400">✓ {L("Beklenti:", "Outlook:")}</span>
                      {rd.masterScore >= 65 ? L(" Hisse yükseliş trendinde. 15 günde hedef fiyatlara ulaşma olasılığı YÜKSEK.", " Stock is in an uptrend. Probability of reaching target prices within 15 days is HIGH.")
                      : rd.masterScore >= 50 ? L(" Hisse nötr aralıkta. Ranged trading yaklaşımı uygun.", " Stock is in a neutral range. A ranged trading approach is suitable.")
                      : L(" Hisse düşüş trendine giriş riski VAR. Temkinli ve risk kontrollü yaklaşım gerekli.", " Stock carries risk of entering a downtrend. A cautious, risk-controlled approach is required.")}
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ SONUÇ ═══════════════════════════════════════════════════════ */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1829] to-[#070b12] border border-[#1e3a5f] p-5 md:p-6 space-y-4">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#06b6d412,_transparent_60%)]"/>
                <div className="relative">
                  <SectionTitle icon="🏁" title={L("SONUÇ & KARAR ÖZETİ", "CONCLUSION & DECISION SUMMARY")} />
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { l:L("Genel Puan","Overall Score"),   v:a.sonucKarar.genelPuan+"/10", c:+a.sonucKarar.genelPuan>=7?"text-emerald-400":+a.sonucKarar.genelPuan>=5?"text-amber-400":"text-rose-400" },
                      { l:L("15G Görünüm","15D Outlook"),  v:rd.masterScore>=60?L("YÜKSELİŞ","BULLISH"):rd.masterScore>=45?L("YATAY","SIDEWAYS"):L("DÜŞÜŞ","BEARISH"), c:rd.masterScore>=60?"text-emerald-400":rd.masterScore>=45?"text-amber-400":"text-rose-400" },
                    ].map((item,i)=>(
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                        <div className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider">{item.l}</div>
                        <div className={`text-sm font-black mt-1 ${item.c}`}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 bg-[#0d1321]/60 border border-[#06b6d4]/20 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-wider mb-1">{L("ÖNERİ","RECOMMENDATION")}</div>
                      <p className="text-[11px] md:text-[12px] text-white font-bold leading-relaxed">{a.sonucKarar.oneri}</p>
                    </div>
                    <div className="border-t border-[#1e3a5f]/40 pt-3">
                      <div className="text-[11px] md:text-[12px] font-black text-rose-400 uppercase tracking-wider mb-1">⚠️ {L("KRİTİK RİSK","CRITICAL RISK")}</div>
                      <p className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed">{a.sonucKarar.kritikRisk}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 4: EMA KALİTE PROFİLİ ═══════════════════════════════ */}
              {rd.emaProfile && (
                <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                  <SectionTitle icon="🧬" title={L("BÖLÜM 4 — EMA KALİTE PROFİLİ & KIRILIM EŞİĞİ", "SECTION 4 — EMA QUALITY PROFILE & BREAKOUT THRESHOLD")} />

                  {/* Profile card */}
                  <div className={`rounded-xl border p-4 ${rd.emaProfile.profile === "A" ? "border-emerald-500/40 bg-emerald-500/5" : rd.emaProfile.profile === "B" ? "border-amber-500/40 bg-amber-500/5" : "border-rose-500/40 bg-rose-500/5"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-2xl font-black px-3 py-1 rounded-xl border ${rd.emaProfile.profile === "A" ? "border-emerald-500/50 text-emerald-400" : rd.emaProfile.profile === "B" ? "border-amber-500/50 text-amber-400" : "border-rose-500/50 text-rose-400"}`}>
                        {L("Profil","Profile")} {rd.emaProfile.profile}
                      </span>
                      <div>
                        <div className="text-white font-black text-sm">{rd.emaProfile.label} {L("Hisse","Stock")}</div>
                        <div className="text-slate-400 text-[11px]">{L("Kritik Referans EMA","Key Reference EMA")}: <span className="text-[#06b6d4] font-black">{rd.emaProfile.keyEMA}</span></div>
                      </div>
                    </div>
                    <p className="text-[11px] md:text-[12px] text-slate-200 font-bold">{rd.emaProfile.desc}</p>
                  </div>

                  {/* EMA slope table */}
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📐 {L("EMA Eğim Analizi", "EMA Slope Analysis")}</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">EMA</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">{L("Değer", "Value")}</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Eğim", "Slope")}</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Fiyat Durumu", "Price Status")}</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">{L("Yorum", "Note")}</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { l: "EMA 20", v: rd.ema20, slope: rd.emaSlope20, key: rd.emaProfile.keyEMA === "EMA20" },
                            { l: "EMA 50", v: rd.ema50, slope: rd.emaSlope50, key: rd.emaProfile.keyEMA === "EMA50" },
                            { l: "EMA 200",v: rd.ema200, slope: rd.emaSlope200, key: rd.emaProfile.keyEMA === "EMA200" },
                          ].map(r => {
                            const above = currentPrice >= r.v;
                            const slopeIcon = r.slope === "yükselen" ? "↗" : r.slope === "düşen" ? "↘" : "→";
                            const slopeColor = r.slope === "yükselen" ? "text-emerald-400" : r.slope === "düşen" ? "text-rose-400" : "text-amber-400";
                            const slopeLabel = r.slope === "yükselen" ? L("yükselen","rising") : r.slope === "düşen" ? L("düşen","falling") : L("yatay","flat");
                            let yorum = "";
                            if (r.slope === "yükselen" && above) yorum = L("Geri çekilme alım fırsatı","Pullback is a buying opportunity");
                            else if (r.slope === "yatay") yorum = L("Destek değil, dikkat","Not support, be cautious");
                            else if (r.slope === "düşen" && above) yorum = L("Toparlanma tuzak olabilir","Recovery may be a trap");
                            else yorum = L("Baskı devam edebilir","Pressure may continue");
                            return (
                              <tr key={r.l} className={`border-b border-[#1e3a5f]/20 ${r.key ? "bg-[#06b6d4]/5" : ""}`}>
                                <td className="px-3 py-2 font-bold text-slate-300">
                                  {r.l} {r.key && <span className="text-[#06b6d4] font-black ml-1 text-[10px]">★ {L("ANAHTAR","KEY")}</span>}
                                </td>
                                <td className="px-3 py-2 text-right font-black font-mono text-white">${r.v?.toFixed(2) ?? "-"}</td>
                                <td className={`px-3 py-2 font-black ${slopeColor}`}>{slopeIcon} {slopeLabel}</td>
                                <td className={`px-3 py-2 font-black text-[11px] ${above ? "text-emerald-400" : "text-rose-400"}`}>{above ? `▲ ${L("Üstünde","Above")}` : `▼ ${L("Altında","Below")}`}</td>
                                <td className="px-3 py-2 text-slate-400 text-[11px]">{yorum}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* EMA20-EMA50 band */}
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-3">
                    <div className="text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-1">📏 {L("EMA Band Genişliği (EMA20 ↔ EMA50)", "EMA Band Width (EMA20 ↔ EMA50)")}</div>
                    {(() => {
                      const bandPct = rd.ema50 > 0 ? Math.abs(rd.ema20 - rd.ema50) / rd.ema50 * 100 : 0;
                      const converging = bandPct < 1.5;
                      return (
                        <p className="text-[11px] md:text-[12px] text-slate-300">
                          {L("Band genişliği","Band width")}: <span className="font-black text-white">%{bandPct.toFixed(2)}</span>
                          {converging
                            ? <span className="text-amber-400 font-black ml-2">⚡ {L("EMA'lar birbirine yaklaşıyor — büyük hareket habercisi", "EMAs are converging — signals a major move ahead")}</span>
                            : <span className="text-slate-400 ml-2">— {L("Normal aralık","Normal range")}</span>}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ══ BÖLÜM 5: KURUMSAL PARA AKIŞI ════════════════════════════════ */}
              {rd.flowSummary && (
                <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                  <SectionTitle icon="🏦" title={L("BÖLÜM 5 — KURUMSAL PARA AKIŞI & PİYASA YAPISI", "SECTION 5 — INSTITUTIONAL MONEY FLOW & MARKET STRUCTURE")} />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { l: L("OBV Trendi","OBV Trend"), v: rd.flowSummary.obvTrend === "yükselen" ? L("yükselen","rising") : rd.flowSummary.obvTrend === "düşen" ? L("düşen","falling") : L("yatay","flat"), c: rd.flowSummary.obvTrend === "yükselen" ? "text-emerald-400" : rd.flowSummary.obvTrend === "düşen" ? "text-rose-400" : "text-amber-400" },
                      { l: L("A/D Trendi","A/D Trend"),  v: rd.flowSummary.adTrend === "yükselen" ? L("yükselen","rising") : rd.flowSummary.adTrend === "düşen" ? L("düşen","falling") : L("yatay","flat"),  c: rd.flowSummary.adTrend  === "yükselen" ? "text-emerald-400" : rd.flowSummary.adTrend  === "düşen" ? "text-rose-400" : "text-amber-400" },
                      { l: "MFI (14)",   v: `${rd.flowSummary.mfi} — ${rd.flowSummary.mfiLabel}`, c: rd.flowSummary.mfi > 80 ? "text-rose-400" : rd.flowSummary.mfi < 20 ? "text-emerald-400" : "text-amber-400" },
                      { l: L("Fiyat-OBV","Price-OBV"),  v: rd.flowSummary.divergence === "negatif" ? `⚠️ ${L("Negatif Uyumsuz","Negative Divergence")}` : rd.flowSummary.divergence === "pozitif" ? `✅ ${L("Pozitif Uyumsuz","Positive Divergence")}` : `✅ ${L("Uyumlu","Aligned")}`, c: rd.flowSummary.divergence !== "yok" ? "text-amber-400" : "text-emerald-400" },
                    ].map(i => (
                      <div key={i.l} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                        <div className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider">{i.l}</div>
                        <div className={`text-sm font-black mt-1 ${i.c}`}>{i.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fiyat-Hacim Pattern */}
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-3">
                    <div className="text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">📊 {L("Son Seans Fiyat-Hacim Kalıbı", "Last Session Price-Volume Pattern")}</div>
                    {(() => {
                      const p = rd.flowSummary.pvPattern;
                      const m: Record<string, { icon: string; c: string; label: string; desc: string }> = {
                        "güçlü birikim":       { icon: "🟢", c: "text-emerald-400", label: L("Güçlü birikim","Strong accumulation"), desc: L("Yüksek hacimle yükseliş → Kurumsal birikim onayı","High-volume rally → Confirms institutional accumulation") },
                        "güçlü dağıtım":       { icon: "🔴", c: "text-rose-400",    label: L("Güçlü dağıtım","Strong distribution"), desc: L("Yüksek hacimle düşüş → Dağıtım sinyali, dikkat","High-volume decline → Distribution signal, be cautious") },
                        "zayıf yükseliş":      { icon: "🟡", c: "text-amber-400",   label: L("Zayıf yükseliş","Weak rally"), desc: L("Düşük hacimle yükseliş → Zayıf hareket, doğrulama beklenmeli","Low-volume rally → Weak move, confirmation needed") },
                        "normal geri çekilme": { icon: "🔵", c: "text-blue-400",    label: L("Normal geri çekilme","Normal pullback"), desc: L("Düşük hacimle düşüş → Normal geri çekilme, panik yok","Low-volume decline → Normal pullback, no panic") },
                        "nötr":                { icon: "⚪", c: "text-slate-400",   label: L("Nötr","Neutral"), desc: L("Hacim-fiyat nötr","Volume-price neutral") },
                      };
                      const info = m[p] ?? m["nötr"];
                      return <p className={`text-[11px] md:text-[12px] font-bold ${info.c}`}>{info.icon} {info.label} — {info.desc}</p>;
                    })()}
                  </div>

                  {/* Sessiz birikim */}
                  {rd.flowSummary.obvTrend === "yükselen" && rd.flowSummary.adTrend === "yükselen" && (() => {
                    const priceFlat = Math.abs(currentPrice - rd.ema20) / rd.ema20 < 0.02;
                    if (!priceFlat) return null;
                    return (
                      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3">
                        <p className="text-emerald-300 font-black text-[11px] md:text-[12px]">
                          🔔 {L("SESSİZ BİRİKİM TESPİTİ — Fiyat yatay seyrederken OBV ve A/D kademeli artıyor. Kırılım öncesi erken kurumsal giriş sinyali olabilir.", "QUIET ACCUMULATION DETECTED — While price stays flat, OBV and A/D are gradually rising. May signal early institutional entry ahead of a breakout.")}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Divergence warning */}
                  {rd.flowSummary.divergence === "negatif" && (
                    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3">
                      <p className="text-amber-300 font-black text-[11px] md:text-[12px]">
                        ⚠️ {L("NEGATİF UYUMSUZLUK — Fiyat yükselirken OBV düşüyor. Momentum arkasında kurumsal destek yok olabilir. Dikkatli ol.", "NEGATIVE DIVERGENCE — Price is rising while OBV is falling. Institutional support behind the momentum may be missing. Be cautious.")}
                      </p>
                    </div>
                  )}

                  {/* MFI extreme warning */}
                  {rd.flowSummary.mfi > 80 && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
                      <p className="text-rose-300 font-black text-[11px] md:text-[12px]">⚠️ MFI {rd.flowSummary.mfi} — {L("Aşırı alım bölgesi. Yeni pozisyon açmadan önce dikkatli ol.", "Overbought zone. Be cautious before opening a new position.")}</p>
                    </div>
                  )}
                  {rd.flowSummary.mfi < 20 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                      <p className="text-emerald-300 font-black text-[11px] md:text-[12px]">✅ MFI {rd.flowSummary.mfi} — {L("Aşırı satım bölgesi. Potansiyel bir taban oluşuyor olabilir.", "Oversold zone. A potential base may be forming.")}</p>
                    </div>
                  )}

                  {/* Info note */}
                  <div className="bg-[#0d1321]/30 border border-[#1e3a5f]/20 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      <span className="font-black text-slate-400">OBV:</span> {L("Hacim ağırlıklı fiyat yönü. Fiyat yükselirken OBV düşüyorsa kurumsal çıkış var.", "Volume-weighted price direction. If OBV falls while price rises, institutional exit is occurring.")}&nbsp;
                      <span className="font-black text-slate-400">A/D:</span> {L("Kapanışın gün içi aralıktaki konumuna göre birikim/dağıtım.", "Accumulation/distribution based on the close's position within the day's range.")}&nbsp;
                      <span className="font-black text-slate-400">MFI:</span> {L("Hacim ağırlıklı RSI — 80+ aşırı alım, 20− aşırı satım.", "Volume-weighted RSI — 80+ overbought, 20− oversold.")}
                    </p>
                  </div>
                </div>
              )}

              {/* ══ BÖLÜM 6: RİSK FAKTÖRLERİ ═══════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="⚠️" title={L("BÖLÜM 6 — RİSK FAKTÖRLERİ (GENİŞLETİLMİŞ)", "SECTION 6 — RISK FACTORS (EXPANDED)")} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Short Interest placeholder */}
                  <div className="bg-[#0d1321]/60 border border-rose-500/20 rounded-xl p-4 space-y-3">
                    <div className="text-[11px] md:text-[12px] font-black text-rose-400 uppercase tracking-widest">📉 {L("Short Interest & Kısa Faiz", "Short Interest")}</div>
                    <div className="space-y-1.5 text-[11px] md:text-[12px]">
                      {[
                        ["Short Float", L("Brokerage kaynağından kontrol et", "Check from brokerage source")],
                        ["Days to Cover", L("Short Float / Günlük Hacim", "Short Float / Daily Volume")],
                        [L("Eşik Değerleri", "Threshold Values"), L("<%5 Normal | %5-15 Dikkat | >%25 Squeeze Riski", "<5% Normal | 5-15% Caution | >25% Squeeze Risk")],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between border-b border-rose-500/10 pb-1.5">
                          <span className="text-slate-400 font-medium">{l}</span>
                          <span className="text-slate-500 text-[10px] italic">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-rose-500/5 rounded-lg p-2 text-[10px] text-rose-300/70">{L("Finviz / Ortex / Broker platformundan güncel short float verisini kontrol et. Yüksek short float + yükselen OBV → squeeze potansiyeli.", "Check current short float data from Finviz / Ortex / your broker platform. High short float + rising OBV → squeeze potential.")}</div>
                  </div>

                  {/* Dilution risk */}
                  <div className="bg-[#0d1321]/60 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    <div className="text-[11px] md:text-[12px] font-black text-amber-400 uppercase tracking-widest">💧 {L("Dilüsyon Risk Göstergeleri", "Dilution Risk Indicators")}</div>
                    <div className="space-y-1.5 text-[11px] md:text-[12px]">
                      {[
                        [L("Piyasa Değeri", "Market Cap"), rd.marketCapStr],
                        [L("Küçük Cap Risk", "Small Cap Risk"), rd.marketCapStr?.includes("M") && !rd.marketCapStr?.includes("B") ? `⚠️ ${L("Shelf/Warrant riski yüksek","High shelf/warrant risk")}` : `✅ ${L("Görece düşük risk","Relatively low risk")}`],
                        [L("SEC Kontrol", "SEC Check"), L("EDGAR'da S-3, warrant, lock-up", "S-3, warrant, lock-up on EDGAR")],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between border-b border-amber-500/10 pb-1.5">
                          <span className="text-slate-400 font-medium">{l}</span>
                          <span className="text-amber-300 font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-amber-500/5 rounded-lg p-2 text-[10px] text-amber-300/70">{L("Spekülatif profil (C) hisselerde shelf registration ve convertible note riski her zaman değerlendirilmeli.", "For speculative profile (C) stocks, shelf registration and convertible note risk should always be assessed.")}</div>
                  </div>
                </div>

                {/* Earnings season protocol */}
                <div className="border border-[#06b6d4]/30 bg-[#06b6d4]/5 rounded-xl p-4">
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📅 {L("Kazanç Sezonu Protokolü", "Earnings Season Protocol")}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    {[
                      { r: L("0–14 Gün","0–14 Days"), d: L("Kazanç Sonrası Dönem","Post-Earnings Period"), c: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300", note: L("Tüm veriler kazanç sonrasını yansıtıyor","All data reflects post-earnings") },
                      { r: L("15–60 Gün","15–60 Days"), d: L("Normal Dönem","Normal Period"), c: "border-slate-500/40 bg-slate-500/5 text-slate-300", note: L("Kazanç verisi taze ve geçerli","Earnings data is fresh and valid") },
                      { r: L("60+ Gün","60+ Days"), d: L("Bilanço Yaklaşıyor","Earnings Approaching"), c: "border-amber-500/40 bg-amber-500/5 text-amber-300", note: L("Volatilite artış riski — pozisyonlara dikkat","Volatility increase risk — watch positions") },
                      { r: L("±3 Gün","±3 Days"), d: L("Bilanço Günü","Earnings Day"), c: "border-rose-500/40 bg-rose-500/5 text-rose-300", note: L("Yeni pozisyon açmak yüksek risk taşır","Opening new positions carries high risk") },
                    ].map(i => (
                      <div key={i.r} className={`border rounded-lg p-2 ${i.c}`}>
                        <div className="font-black">{i.r}</div>
                        <div className="font-bold mt-0.5">{i.d}</div>
                        <div className="opacity-70 mt-0.5">{i.note}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">⚡ {L("Bir sonraki kazanç tarihini SEC EDGAR veya Earnings Whispers üzerinden doğrula. Bilanço ±3 gün içindeyse volatilite önemli ölçüde artabilir, pozisyon büyüklüğünü buna göre ayarla.", "Verify the next earnings date via SEC EDGAR or Earnings Whispers. If earnings fall within ±3 days, volatility can rise significantly — size positions accordingly.")}</p>
                </div>
              </div>

              {/* ══ BÖLÜM 7: MAKRO & SEKTÖR BAĞLAMI ════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🌍" title={L("BÖLÜM 7 — MAKRO & SEKTÖR BAĞLAMI", "SECTION 7 — MACRO & SECTOR CONTEXT")} />

                {/* Piyasa rejimi */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { l: "S&P 500", v: rd.sp500Change, suffix: "%", threshold: 0 },
                    { l: "NASDAQ",  v: rd.nasdaqChange, suffix: "%", threshold: 0 },
                    { l: "VIX",    v: rd.vixPrice, suffix: "", threshold: null },
                  ].map(i => {
                    const isVix = i.l === "VIX";
                    const color = isVix ? (i.v > 25 ? "text-rose-400" : i.v > 15 ? "text-amber-400" : "text-emerald-400") : (i.v >= 0 ? "text-emerald-400" : "text-rose-400");
                    const regime = isVix ? (i.v > 25 ? `Risk-Off ⚠️` : i.v > 15 ? `${L("Dikkat","Caution")} →` : `Risk-On ✅`) : (i.v >= 0 ? `${L("Pozitif","Positive")} ▲` : `${L("Negatif","Negative")} ▼`);
                    return (
                      <div key={i.l} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{i.l}</div>
                        <div className={`text-xl font-black font-mono mt-1 ${color}`}>
                          {i.v != null ? (isVix ? i.v?.toFixed(2) : (i.v >= 0 ? "+" : "") + i.v?.toFixed(2) + i.suffix) : "—"}
                        </div>
                        <div className={`text-[11px] font-bold mt-0.5 ${color}`}>{i.v != null ? regime : L("Veri yok","No data")}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Risk-off warning */}
                {rd.vixPrice > 25 && (
                  <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3">
                    <p className="text-rose-300 font-black text-[11px] md:text-[12px]">
                      🚨 {L(`Risk-Off Ortamı — VIX ${rd.vixPrice?.toFixed(1)} seviyesinde. Spekülatif küçük cap satışı hızlanır. Kurumsal profil dışı hisselerde volatilite riski yüksektir.`, `Risk-Off Environment — VIX at ${rd.vixPrice?.toFixed(1)}. Speculative small-cap selling accelerates. Volatility risk is high for non-institutional-grade stocks.`)}
                    </p>
                  </div>
                )}

                {/* Sektörel makro faktörler */}
                <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-4">
                  <div className="text-[11px] font-black text-[#06b6d4] uppercase tracking-widest mb-3">🏭 {L("Sektör","Sector")}: {data.sector}</div>
                  <div className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed space-y-1.5">
                    {(() => {
                      const s = (data.sector || "").toLowerCase();
                      const factors: string[] = [];
                      if (s.includes("defense") || s.includes("aerospace") || s.includes("drone")) {
                        factors.push(L("🛡️ Savunma bütçesi haberleri ve jeopolitik gelişmeler doğrudan etkiler.", "🛡️ Defense budget news and geopolitical developments have a direct impact."));
                        factors.push(L("📋 FAA/NDAA düzenlemeleri ve ihale sonuçları katalizör olabilir.", "📋 FAA/NDAA regulations and contract award results can be catalysts."));
                      } else if (s.includes("electric") || s.includes("ev") || s.includes("auto")) {
                        factors.push(L("🔋 Fed faiz ortamı tüketici kredisini etkiler — EV satışlarına yansır.", "🔋 The Fed rate environment affects consumer credit — impacts EV sales."));
                        factors.push(L("💰 EV teşvik politikaları ve hammadde (lityum, kobalt) fiyatları kritik.", "💰 EV incentive policies and raw material (lithium, cobalt) prices are critical."));
                      } else if (s.includes("tech") || s.includes("software") || s.includes("saas")) {
                        factors.push(L("📈 Fed faiz kararları büyüme hissesi değerlemesini doğrudan etkiler.", "📈 Fed rate decisions directly affect growth stock valuations."));
                        factors.push(L("🤖 Yapay zeka rekabeti ve regülasyon gelişmeleri yakından takip edilmeli.", "🤖 AI competition and regulatory developments should be closely monitored."));
                      } else if (s.includes("biotech") || s.includes("pharmaceutical")) {
                        factors.push(L("💊 FDA onay takvimi ve klinik sonuçlar fiyat için en kritik katalizörlerdir.", "💊 FDA approval calendar and clinical trial results are the most critical price catalysts."));
                        factors.push(L("💵 Nakit burn rate ve runway tükenme tarihi risk faktörüdür.", "💵 Cash burn rate and runway depletion date are risk factors."));
                      } else if (s.includes("bank") || s.includes("financ")) {
                        factors.push(L("📊 Net Interest Margin ve Fed faiz kararları doğrudan etkiler.", "📊 Net Interest Margin and Fed rate decisions have a direct impact."));
                        factors.push(L("⚠️ Kredi kayıp karşılıkları ve NIM trendi bilanço kalitesini belirler.", "⚠️ Loan loss provisions and NIM trend determine balance sheet quality."));
                      } else {
                        factors.push(L("📰 Sektörel haberler ve makro gelişmeler takip edilmeli.", "📰 Sector news and macro developments should be monitored."));
                        factors.push(L("📊 Fed toplantıları, CPI ve istihdam verilerinin piyasaya etkisi değerlendirilmeli.", "📊 The market impact of Fed meetings, CPI, and employment data should be assessed."));
                      }
                      factors.push(L("📉 Mevcut piyasa rejimi: VIX ", "📉 Current market regime: VIX ") + (rd.vixPrice > 25 ? L("25+ → Risk-Off. Küçük cap pozisyonlar riskli.", "25+ → Risk-Off. Small-cap positions are risky.") : rd.vixPrice > 15 ? L("15-25 → Dikkat gerekiyor.", "15-25 → Caution warranted.") : L("<15 → Risk-On. Uygun ortam.", "<15 → Risk-On. Favorable environment.")));
                      return factors.map((f, i) => <p key={i}>{f}</p>);
                    })()}
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 8: İNSİDER İŞLEMLERİ ═══════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🔐" title={L("BÖLÜM 8 — İNSİDER İŞLEMLERİ TAKIBI (FORM 4/144)", "SECTION 8 — INSIDER TRANSACTION TRACKING (FORM 4/144)")} />
                {rd.insiderTransactions?.length > 0 ? (
                  <>
                    {/* Özet — net alım/satım akışı */}
                    {rd.insiderSummary && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2.5 text-center">
                          <div className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">📈 {L("Alım","Buys")}</div>
                          <div className="text-lg font-black text-white font-mono">{rd.insiderSummary.buyCount}</div>
                        </div>
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-2.5 text-center">
                          <div className="text-[10px] text-rose-400 font-black uppercase tracking-wider">📉 {L("Satım","Sells")}</div>
                          <div className="text-lg font-black text-white font-mono">{rd.insiderSummary.sellCount}</div>
                        </div>
                        <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{L("Net Akış","Net Flow")}</div>
                          <div className={`text-sm font-black font-mono ${rd.insiderSummary.netValue >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {rd.insiderSummary.netValue >= 0 ? "+" : "-"}${Math.abs(rd.insiderSummary.netValue) >= 1e6 ? (Math.abs(rd.insiderSummary.netValue) / 1e6).toFixed(1) + "M" : (Math.abs(rd.insiderSummary.netValue) / 1e3).toFixed(0) + "K"}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {rd.insiderTransactions.map((tx: any, i: number) => {
                        const typeStyle =
                          tx.type === "BUY"  ? { box: "bg-emerald-500/5 border-emerald-500/20", badge: "bg-emerald-500/20 text-emerald-300", label: `📈 ${L("ALIM","BUY")}` } :
                          tx.type === "SELL" ? { box: "bg-rose-500/5 border-rose-500/20",    badge: "bg-rose-500/20 text-rose-300",    label: `📉 ${L("SATIM","SELL")}` } :
                                                { box: "bg-slate-500/5 border-slate-500/20",  badge: "bg-slate-500/20 text-slate-300",  label: `🔄 ${L("DİĞER","OTHER")}` };
                        return (
                          <div key={i} className={`border rounded-lg p-3 ${typeStyle.box}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div>
                                <span className="font-black text-white text-[11px] md:text-[12px]">{tx.officer}</span>
                                <span className="text-slate-500 text-[11px] ml-2">— {tx.title}</span>
                              </div>
                              <span className={`text-[11px] font-black px-2 py-0.5 rounded ${typeStyle.badge}`}>{typeStyle.label}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 space-y-0.5">
                              <p>
                                📅 {tx.date} &nbsp;•&nbsp; <span className="text-white font-black">{tx.shares}</span> {L("hisse","shares")}
                                {tx.price != null && <>&nbsp;•&nbsp; <span className="text-[#06b6d4] font-black">${tx.price.toFixed(2)}</span>/{L("hisse","share")}</>}
                                {tx.value != null && <>&nbsp;•&nbsp; <span className="text-amber-400 font-black">${tx.value >= 1e6 ? (tx.value / 1e6).toFixed(2) + "M" : (tx.value / 1e3).toFixed(0) + "K"}</span> {L("toplam","total")}</>}
                              </p>
                              {tx.transactionDesc && <p className="text-slate-500 italic text-[10px]">{tx.transactionDesc}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-[11px] md:text-[12px]">{L("Son 6 ayda raporlanmış insider işlemi bulunamadı.", "No reported insider transactions in the last 6 months.")}<br/>{L("CEO/CFO pozisyonları ve Form 144 satışları SEC Edgar üzerinden takip edilebilir.", "CEO/CFO positions and Form 144 sales can be tracked via SEC EDGAR.")}</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 9: GÜNCEL HABER & KATALİZÖR AKIŞI ════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="📰" title={L("BÖLÜM 9 — GÜNCEL HABER & KATALİZÖR AKIŞI", "SECTION 9 — LATEST NEWS & CATALYST FLOW")} />
                {rd.recentNews?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.recentNews.map((news: any, i: number) => (
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3 hover:border-[#1e3a5f] transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          {news.url
                            ? <a href={news.url} target="_blank" rel="noopener noreferrer" className="font-black text-white text-[11px] md:text-[12px] flex-1 hover:text-[#06b6d4] transition-colors leading-tight">{news.title}</a>
                            : <span className="font-black text-white text-[11px] md:text-[12px] flex-1 leading-tight">{news.title}</span>
                          }
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${news.sentiment === "Pozitif" ? "bg-emerald-500/20 text-emerald-300" : news.sentiment === "Negatif" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                            {news.sentiment === "Pozitif" ? `▲ ${L("Pozitif","Positive")}` : news.sentiment === "Negatif" ? `▼ ${L("Negatif","Negative")}` : `→ ${L("Nötr","Neutral")}`}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">📅 {news.date} &nbsp;•&nbsp; {news.source}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-[11px] md:text-[12px]">{L("Güncel haber verisi alınamadı.", "Latest news data could not be retrieved.")}</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 10: ANALIST KONSENSÜSÜ & FİYAT HEDEFİ ═══════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="👥" title={L("BÖLÜM 10 — ANALIST KONSENSÜSÜ & FİYAT HEDEFİ", "SECTION 10 — ANALYST CONSENSUS & PRICE TARGET")} />
                {rd.analystData?.count > 0 ? (
                  <div className="space-y-4">
                    {/* Konsensüs dağılımı */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: L("Analiz Yapan","Analysts"), value: rd.analystData.count, cls: "text-white", border: "border-[#1e3a5f]/40" },
                        { label: "Buy",          value: rd.analystData.buy,   cls: "text-emerald-300", border: "border-emerald-500/40 bg-emerald-500/5" },
                        { label: "Hold",         value: rd.analystData.hold,  cls: "text-amber-300",   border: "border-amber-500/40 bg-amber-500/5" },
                        { label: "Sell",         value: rd.analystData.sell,  cls: "text-rose-300",    border: "border-rose-500/40 bg-rose-500/5" },
                      ].map(c => (
                        <div key={c.label} className={`border ${c.border} rounded-lg p-3 bg-[#0d1321]/60`}>
                          <div className="text-[10px] font-black text-slate-500 uppercase">{c.label}</div>
                          <div className={`text-xl font-black mt-1 ${c.cls}`}>{c.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Buy/Hold/Sell görsel bar */}
                    {(() => {
                      const total = rd.analystData.buy + rd.analystData.hold + rd.analystData.sell || 1;
                      const buyPct  = Math.round((rd.analystData.buy  / total) * 100);
                      const holdPct = Math.round((rd.analystData.hold / total) * 100);
                      const sellPct = 100 - buyPct - holdPct;
                      return (
                        <div>
                          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                            {buyPct  > 0 && <div className="bg-emerald-500/70" style={{ width: `${buyPct}%` }} />}
                            {holdPct > 0 && <div className="bg-amber-500/70"   style={{ width: `${holdPct}%` }} />}
                            {sellPct > 0 && <div className="bg-rose-500/70"    style={{ width: `${sellPct}%` }} />}
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                            <span>Buy {buyPct}%</span><span>Hold {holdPct}%</span><span>Sell {sellPct}%</span>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Fiyat hedefleri */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-[#0d1321]/60 border border-rose-500/20 rounded-lg p-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase">{L("Min Hedef","Min Target")}</div>
                        <div className="text-base font-black text-rose-400 mt-1">${rd.analystData.minTarget?.toFixed(2)}</div>
                      </div>
                      <div className="bg-[#0d1321]/60 border border-[#06b6d4]/30 rounded-lg p-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase">{L("Ort. Hedef","Avg Target")}</div>
                        <div className="text-base font-black text-[#06b6d4] mt-1">${rd.analystData.avgTarget?.toFixed(2)}</div>
                        <div className={`text-[10px] font-black mt-0.5 ${rd.analystData.avgTarget > rd.currentPrice ? "text-emerald-400" : "text-rose-400"}`}>
                          {rd.analystData.avgTarget > rd.currentPrice ? "▲ " : "▼ "}
                          {Math.abs(((rd.analystData.avgTarget - rd.currentPrice) / rd.currentPrice) * 100).toFixed(1)}% {L("potansiyel","potential")}
                        </div>
                      </div>
                      <div className="bg-[#0d1321]/60 border border-emerald-500/20 rounded-lg p-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase">{L("Max Hedef","Max Target")}</div>
                        <div className="text-base font-black text-emerald-400 mt-1">${rd.analystData.maxTarget?.toFixed(2)}</div>
                      </div>
                    </div>
                    {/* Son revizyonlar */}
                    {rd.analystData.recentUpgrades?.length > 0 && (
                      <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-3">
                        <div className="text-[10px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📋 {L("Son 30 Günde Revizyon","Revisions in Last 30 Days")}</div>
                        <div className="space-y-1.5">
                          {rd.analystData.recentUpgrades.map((u: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                              <span className="text-white font-black">{u.firm}</span>
                              <span className="text-slate-400">{u.from && u.to ? `${u.from} → ${u.to}` : u.to || u.action}</span>
                              <span className="text-slate-500 text-[10px]">{u.date}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-[11px] md:text-[12px]">{L("Bu hisse için analist konsensüsü verisi mevcut değil.", "Analyst consensus data is not available for this stock.")}</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 11: 13F KURUMSAL SAHİPLİK DEĞİŞİMLERİ ══════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🏛️" title={L("BÖLÜM 11 — 13F KURUMSAL SAHİPLİK DEĞİŞİMLERİ (EN BÜYÜK 5)", "SECTION 11 — 13F INSTITUTIONAL OWNERSHIP CHANGES (TOP 5)")} />
                {rd.institutionalOwners?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.institutionalOwners.map((owner: any, i: number) => {
                      const posValue = owner.shares * rd.currentPrice;
                      const posStr = posValue > 1e9 ? `$${(posValue/1e9).toFixed(2)}B` : posValue > 1e6 ? `$${(posValue/1e6).toFixed(0)}M` : `$${posValue.toFixed(0)}`;
                      return (
                        <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-white text-[11px] md:text-[12px]">{i + 1}. {owner.name}</span>
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded ${owner.change > 0 ? "bg-emerald-500/20 text-emerald-300" : owner.change < 0 ? "bg-rose-500/20 text-rose-300" : "bg-slate-700 text-slate-400"}`}>
                              {owner.change > 0 ? "▲ +" : owner.change < 0 ? "▼ " : "→ "}{owner.change.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            📊 {owner.shares.toLocaleString()} {L("hisse","shares")} &nbsp;•&nbsp; <span className="text-[#06b6d4] font-black">{posStr}</span>
                            {owner.reportDate && <span className="ml-2 text-slate-600">{L("Rapor","Report")}: {owner.reportDate}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-[11px] md:text-[12px]">{L("Bu hisse için kurumsal sahiplik verisi mevcut değil.", "Institutional ownership data is not available for this stock.")}</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 12: KAZANÇ GEÇMİŞİ & POST-EARNINGS DAVRANIŞI ═══════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="📊" title={L("BÖLÜM 12 — KAZANÇ GEÇMİŞİ & POST-EARNINGS DAVRANIŞI", "SECTION 12 — EARNINGS HISTORY & POST-EARNINGS BEHAVIOR")} />
                {rd.earningsHistory?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.earningsHistory.map((e: any, i: number) => (
                      <div key={i} className={`border rounded-lg p-3 ${e.epsBeating ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-black text-white text-[11px] md:text-[12px]">{e.quarter} {e.date && `• ${e.date}`}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded ${e.epsBeating ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                            {e.epsBeating ? "✅ Beat" : "❌ Miss"}&nbsp;
                            {e.epsSurprise >= 0 ? "+" : ""}{e.epsSurprise.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {L("EPS Gerçekleşen","Actual EPS")}: <span className={`font-black ${e.epsBeating ? "text-emerald-300" : "text-rose-300"}`}>${e.eps.toFixed(2)}</span>
                          &nbsp;/&nbsp; {L("Tahmin","Estimate")}: <span className="text-slate-300">${e.estimate.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-3">
                      <div className="text-[10px] font-black text-[#06b6d4] uppercase tracking-widest mb-1">📊 {L("Bilanço Performansı Özeti","Earnings Performance Summary")}</div>
                      {(() => {
                        const beatCount = rd.earningsHistory.filter((e: any) => e.epsBeating).length;
                        const total = rd.earningsHistory.length;
                        const beatRate = Math.round((beatCount / total) * 100);
                        return (
                          <p className="text-[11px] text-slate-300">
                            {L(`Son ${total} çeyrekte`, `In the last ${total} quarters`)} <span className="font-black text-white">{beatCount}/{total}</span> Beat (%{beatRate}).
                            {beatRate >= 75 ? L(" 🟢 Güçlü beat geçmişi — süpriz potansiyeli yüksek.", " 🟢 Strong beat history — high surprise potential.") :
                             beatRate >= 50 ? L(" 🟡 Karışık bilanço performansı — dikkatli takip gerekiyor.", " 🟡 Mixed earnings performance — close monitoring needed.") :
                             L(" 🔴 Zayıf beat geçmişi — bilanço öncesi pozisyon risklidir.", " 🔴 Weak beat history — pre-earnings positioning is risky.")}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-500 text-[11px] md:text-[12px]">{L("Bu hisse için kazanç geçmişi verisi mevcut değil.", "Earnings history data is not available for this stock.")}</p>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className="text-center py-4 opacity-60 space-y-1">
                <p className="text-[11px] md:text-[12px] text-slate-500 max-w-2xl mx-auto leading-relaxed">⚠️ <strong>{L("Yasal Uyarı:","Disclaimer:")}</strong> {L("Bu rapor yalnızca eğitim ve kişisel analiz amaçlıdır. Yatırım tavsiyesi değildir. Tüm yatırım kararları risk içerir.", "This report is for educational and personal analysis purposes only. It is not investment advice. All investment decisions carry risk.")}</p>
                <p className="text-[11px] md:text-[12px] text-[#475569] font-black tracking-widest uppercase">© 2026 BOGA AI — {L("DERİN ANALİZ","DEEP ANALYSIS")} v3.1 | Developed by AFK DaSYS</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

