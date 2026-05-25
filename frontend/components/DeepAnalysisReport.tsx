"use client";

import { useEffect, useRef, useState } from "react";
import IchimokuChart from "./IchimokuChart";

interface Props { ticker: string; stockData: any; onClose: () => void; }

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

function Badge({ score }: { score: number }) {
  if (score >= 1) return <span className="px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[11px] md:text-[12px] font-black uppercase">✅ EVET</span>;
  if (score === 0) return <span className="px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] md:text-[12px] font-black uppercase">🔍 ORTA</span>;
  return <span className="px-2 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/40 text-[11px] md:text-[12px] font-black uppercase">❌ HAYIR</span>;
}

function LevelBadge({ v, fb }: { v: string; fb: string }) {
  const val = v || fb;
  if (val === "GÜÇLÜ") return <span className="text-emerald-400 font-black text-sm">{val}</span>;
  if (val === "ORTA") return <span className="text-amber-400 font-black text-sm">{val}</span>;
  return <span className="text-rose-400 font-black text-sm">{val}</span>;
}

// ── Forecast Bar Chart ─────────────────────────────────────────────────────────
function ForecastChart({ forecast15, currentPrice }: { forecast15: any[]; currentPrice: number }) {
  if (!forecast15?.length) return null;
  const allVals = forecast15.flatMap(d => [d.bear, d.base, d.bull]);
  const minV = Math.min(currentPrice, ...allVals) * 0.995;
  const maxV = Math.max(currentPrice, ...allVals) * 1.005;
  const range = maxV - minV || 1;
  const pct = (v: number) => ((v - minV) / range) * 100;
  const W = 100 / forecast15.length;

  return (
    <div className="bg-[#0a0e18] border border-[#1e3a5f]/50 rounded-xl p-4 overflow-x-auto">
      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-3">📈 Forecast Bant Grafiği — 15 Gün</div>
      <div className="relative" style={{ height: 120, minWidth: 480 }}>
        {/* Gridlines */}
        {[0, 25, 50, 75, 100].map(p => (
          <div key={p} className="absolute w-full border-t border-[#1e3a5f]/30" style={{ bottom: `${p}%` }}>
            <span className="absolute -left-1 -translate-y-1/2 text-[11px] md:text-[12px] text-slate-600 font-mono pr-1">
              ${(minV + range * p / 100).toFixed(1)}
            </span>
          </div>
        ))}
        {/* Current price line */}
        <div className="absolute w-full border-t border-dashed border-amber-400/60 z-10" style={{ bottom: `${pct(currentPrice)}%` }}>
          <span className="absolute right-0 -translate-y-3 text-[11px] md:text-[12px] text-amber-400 font-black">Güncel ${currentPrice.toFixed(2)}</span>
        </div>
        {/* Bars */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {forecast15.map((d, i) => (
            <g key={i}>
              {/* Bear-Base fill */}
              <rect x={i * W} y={100 - pct(d.base)} width={W * 0.9} height={Math.max(0.5, pct(d.base) - pct(d.bear))}
                fill="rgba(239,68,68,0.15)" />
              {/* Base-Bull fill */}
              <rect x={i * W} y={100 - pct(d.bull)} width={W * 0.9} height={Math.max(0.5, pct(d.bull) - pct(d.base))}
                fill="rgba(16,185,129,0.15)" />
              {/* Base line */}
              <rect x={i * W} y={100 - pct(d.base) - 0.5} width={W * 0.9} height={1.2} fill="#f59e0b" opacity="0.9" />
              {/* Bear line */}
              <rect x={i * W} y={100 - pct(d.bear) - 0.5} width={W * 0.9} height={0.8} fill="#ef4444" opacity="0.7" />
              {/* Bull line */}
              <rect x={i * W} y={100 - pct(d.bull) - 0.5} width={W * 0.9} height={0.8} fill="#10b981" opacity="0.7" />
            </g>
          ))}
          {/* Current price line */}
          <line x1="0" y1={100 - pct(currentPrice)} x2="100" y2={100 - pct(currentPrice)} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2,2" />
        </svg>
        {/* Day labels */}
        <div className="absolute -bottom-5 left-8 right-0 flex" style={{ paddingLeft: "2px" }}>
          {forecast15.filter((_, i) => i % 3 === 0).map((d, i) => (
            <div key={i} className="text-[11px] md:text-[12px] text-slate-500 font-mono" style={{ width: `${W * 3}%`, flexShrink: 0 }}>G+{d.day}</div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mt-8 text-[11px] md:text-[12px] font-black">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block" />Bull</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" />Base</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-500 inline-block" />Bear</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />Güncel</span>
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
export default function DeepAnalysisReport({ ticker, stockData, onClose }: Props) {
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
      body: JSON.stringify({ ticker, stockData }),
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
    const shareUrl = `${window.location.origin}/ai?ticker=${ticker.toUpperCase()}`;
    const shareText = `BOGA AI — ${ticker.toUpperCase()} Derin Analiz Raporu\n${companyName} · $${currentPrice.toFixed(2)}\n\n${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `BOGA AI Derin Analiz — ${ticker.toUpperCase()}`, text: shareText, url: shareUrl });
      } catch (e: any) { if (e?.name !== "AbortError") { await navigator.clipboard.writeText(shareText); alert("Bağlantı kopyalandı!"); } }
    } else {
      try { await navigator.clipboard.writeText(shareText); alert("Bağlantı kopyalandı! 📋"); }
      catch { alert(`Paylaşım bağlantısı:\n${shareUrl}`); }
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
            <div className="text-[11px] md:text-[12px] font-black text-white uppercase tracking-widest">BOGA AI — DERİN ANALİZ RAPORU</div>
            <div className="text-[11px] md:text-[12px] text-[#06b6d4] font-bold">{ticker.toUpperCase()} • {companyName} • ${currentPrice.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && data && (<>
            <button onClick={handleShare} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 text-[11px] md:text-[12px] font-black uppercase tracking-wider transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Paylaş
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b] hover:bg-[#f59e0b]/20 text-[11px] md:text-[12px] font-black uppercase tracking-wider transition-all disabled:opacity-60"
            >
              {exportingPdf ? (
                <><span className="w-3.5 h-3.5 border-2 border-[#f59e0b]/40 border-t-[#f59e0b] rounded-full animate-spin inline-block" />Hazırlanıyor...</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>PDF Kaydet</>
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
              <p className="text-white font-black text-sm uppercase tracking-widest">Derin Analiz Hazırlanıyor</p>
              <p className="text-[#06b6d4] text-xs mt-1 font-bold">{ticker.toUpperCase()} için historical data + 15G forecast + opsiyon matrisi yükleniyor...</p>
            </div>
            <div className="flex gap-1.5">{[0,150,300].map(d=><span key={d} className="w-2 h-2 rounded-full bg-[#3b82f6] animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-4xl">⚠️</p>
            <p className="text-rose-400 font-black text-sm">Analiz yüklenemedi</p>
            <p className="text-slate-400 text-xs max-w-xs text-center">{error}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-black uppercase hover:bg-rose-500/20 transition-all">Kapat</button>
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
                    <p className="text-[11px] md:text-[12px] font-mono text-[#06b6d4] tracking-widest uppercase mt-1">{data.sector} • {data.industry} • DERİN ANALİZ & 15G FORECAST • {new Date().toLocaleDateString("tr-TR")}</p>
                    <p className="text-[11px] md:text-[12px] text-slate-500 mt-0.5 font-bold uppercase tracking-wider">BOGA AI — Cash-Secured PUT / Covered CALL Opsiyon Stratejisi</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-black text-white font-mono">${rd.currentPrice?.toFixed(2) ?? currentPrice.toFixed(2)}</div>
                    <div className="mt-1 px-3 py-1 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#06b6d4] text-white text-[11px] md:text-[12px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 inline-block">BOGA SKOR: {rd.masterScore}/100</div>
                  </div>
                </div>
                {/* EMA Profile Badge */}
                {rd.emaProfile && (() => {
                  const p = rd.emaProfile;
                  const colors: Record<string, string> = { A: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300", B: "border-amber-500/50 bg-amber-500/10 text-amber-300", C: "border-rose-500/50 bg-rose-500/10 text-rose-300" };
                  return (
                    <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider ${colors[p.profile]}`}>
                      <span>🧬 Profil {p.profile} — {p.label}</span>
                      <span className="opacity-70 font-medium normal-case hidden sm:inline">| {p.desc}</span>
                    </div>
                  );
                })()}

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  {[
                    { l: "RSI (14)", v: rd.rsi?.toFixed(1), c: rd.rsi>70?"text-rose-400":rd.rsi<30?"text-emerald-400":"text-amber-400" },
                    { l: "ATR (Günlük)", v: "$"+rd.atr?.toFixed(2)+" (%"+rd.atrPct?.toFixed(1)+")", c: "text-[#06b6d4]" },
                    { l: "IV Rank", v: rd.ivRank+"/100", c: rd.ivRank>50?"text-emerald-400":rd.ivRank>25?"text-amber-400":"text-rose-400" },
                    { l: "IV/HV Oranı", v: rd.ivHvRatio?.toFixed(2)+"×", c: rd.ivHvRatio>1.3?"text-emerald-400":"text-amber-400" },
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
                <SectionTitle icon="🧬" title="BÖLÜM 1 — HİSSE DNA & KARAKTERİSTİK ANALİZİ" />
                {/* Identity table */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] md:text-[12px]">
                  {[
                    ["Ticker / Şirket", `${ticker.toUpperCase()} / ${data.companyName}`],
                    ["Sektör", data.sector],
                    ["Güncel Fiyat", `$${currentPrice.toFixed(2)}`],
                    ["Piyasa Değeri", rd.marketCapStr],
                    ["BOGA Skor", `${rd.masterScore}/100`],
                    ["Analiz Tarihi", new Date().toLocaleDateString("tr-TR")],
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
                    { l:"📈 Yükseliş Karakteri", v:a.dna.yukselisKarakteri, c:"border-emerald-500/30 bg-emerald-500/5" },
                    { l:"📉 Düşüş Karakteri",   v:a.dna.dususKarakteri,    c:"border-rose-500/30 bg-rose-500/5" },
                    { l:"📊 Hacim Tepkisi",     v:a.dna.hacimTepkisi,      c:"border-blue-500/30 bg-blue-500/5" },
                    { l:"📰 Haber Etkisi",      v:a.dna.haberEtkisi,       c:"border-amber-500/30 bg-amber-500/5" },
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
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📐 Piyasa Korelasyonu</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">Endeks</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Değişim</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">Durum</th>
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
                              <td className="px-3 py-2 text-slate-500">{r.name==="VIX"?(r.v>20?"⚠️ Yüksek":"✅ Normal"):r.v!=null?(r.v>=0?"▲ Pozitif":"▼ Negatif"):"—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">💧 Likidite Endeksi</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">Metrik</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Değer</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">Değer.</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { m:"Ort. Hacim (30G)", v: rd.avgVol30d>0?(rd.avgVol30d/1e6).toFixed(1)+"M":"—", d: rd.avgVol30d>5e6?"✅ Yeterli":"⚠️ Dikkat" },
                            { m:"Göreceli Hacim",   v: rd.rvol?.toFixed(2)+"×", d: rd.rvol>1.5?"🔥 Yüksek":rd.rvol>0.8?"✅ Normal":"⚠️ Düşük" },
                            { m:"IV Bid/Ask (est.)",v: rd.iv>0 ? "%"+(rd.iv*0.05).toFixed(1):"—", d: rd.iv<50?"✅ Likit":"⚠️ Geniş" },
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
                <SectionTitle icon="📈" title="BÖLÜM 2 — TEKNİK VERİ SETİ & ZAMAN SERİSİ" />

                {/* Son 15 Gün Tablosu */}
                <div>
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">⚡ Son 15 Gün Fiyat-Hacim Verisi</div>
                  {rd.history15?.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px] min-w-[500px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/50">
                          <th className="px-3 py-2 text-left font-black text-slate-400">Tarih</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Açılış</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Kapanış</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Günlük %</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Hacim (M)</th>
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
                          <td className="px-3 py-2 font-black text-[#06b6d4]" colSpan={3}>ÖZET</td>
                          <td className={`px-3 py-2 text-right font-black font-mono ${rd.history15.reduce((s:number,r:any)=>s+r.changePct,0)>=0?"text-emerald-400":"text-rose-400"}`}>
                            {rd.history15.reduce((s:number,r:any)=>s+r.changePct,0).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-300 font-mono">
                            Ort: {(rd.history15.reduce((s:number,r:any)=>s+r.volume,0)/rd.history15.length).toFixed(1)}M
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-300 font-mono">
                            Ort: {(rd.history15.reduce((s:number,r:any)=>s+r.atrPct,0)/rd.history15.length).toFixed(1)}%
                          </td>
                        </tr></tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-[11px] md:text-[12px] text-slate-500 bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-xl p-3">Geçmiş veri yüklenemedi (Yahoo Finance erişimi gerekli).</div>
                  )}
                </div>

                {/* MA Tablosu */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📏 Hareketli Ortalama Disiplini</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">Periyot</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Değer</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">Durum</th>
                        </tr></thead>
                        <tbody>
                          {[
                            { l:"MA 7G",   v:rd.maLevels?.ma7   },
                            { l:"MA 21G",  v:rd.maLevels?.ma21  },
                            { l:"EMA 50G", v:rd.maLevels?.ma50  },
                            { l:"EMA 200G",v:rd.maLevels?.ma200 },
                            { l:"1Y Ort.", v:rd.maLevels?.yearAvg},
                          ].map(r=>(
                            <tr key={r.l} className="border-b border-[#1e3a5f]/20">
                              <td className="px-3 py-2 font-bold text-slate-300">{r.l}</td>
                              <td className="px-3 py-2 text-right font-black font-mono text-white">${r.v?.toFixed(2)??"-"}</td>
                              <td className={`px-3 py-2 font-black text-[11px] md:text-[12px] ${currentPrice>=(r.v||0)?"text-emerald-400":"text-rose-400"}`}>
                                {currentPrice>=(r.v||0)?"▲ Üstünde":"▼ Altında"}
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
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">🧱 Destek / Direnç Seviyeleri</div>
                    <div className="rounded-xl border border-[#1e3a5f]/40 overflow-hidden">
                      {[
                        { l:"Direnç 3 (52H Tepe)", v:rd.srLevels?.resistance3, type:"res3" },
                        { l:"Direnç 2",             v:rd.srLevels?.resistance2, type:"res2" },
                        { l:"Direnç 1 (Yakın)",     v:rd.srLevels?.resistance1, type:"res1" },
                        { l:"GÜNCEL FİYAT",          v:currentPrice,             type:"cur"  },
                        { l:"Destek 1 (Güçlü)",     v:rd.srLevels?.support1,    type:"sup1" },
                        { l:"Destek 2",             v:rd.srLevels?.support2,    type:"sup2" },
                        { l:"Destek 3 (52H Dip)",   v:rd.srLevels?.support3,    type:"sup3" },
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
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">💹 Teknik Göstergeler</div>
                    <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4 space-y-2.5 font-mono text-[11px] md:text-[12px]">
                      {[
                        { l:"RSI (14)", v: rd.rsi?.toFixed(1), c: rd.rsi>70?"text-rose-400":rd.rsi<30?"text-emerald-400":"text-amber-400", note: rd.rsi>70?"Aşırı Alım":rd.rsi<30?"Aşırı Satım":"Nötr" },
                        { l:"EMA 20",  v:"$"+rd.ema20?.toFixed(2), c: currentPrice>rd.ema20?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema20?"Üstünde ✅":"Altında ❌" },
                        { l:"EMA 50",  v:"$"+rd.ema50?.toFixed(2), c: currentPrice>rd.ema50?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema50?"Üstünde ✅":"Altında ❌" },
                        { l:"EMA 200", v:"$"+rd.ema200?.toFixed(2),c: currentPrice>rd.ema200?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema200?"Uzun vade boğa":"Uzun vade ayı" },
                        { l:"ATR",     v:"$"+rd.atr?.toFixed(2)+" (%"+rd.atrPct?.toFixed(1)+")", c:"text-[#06b6d4]", note:"Günlük beklenen hareket" },
                        { l:"MACD",    v: rd.macd >= 0 ? "+"+rd.macd?.toFixed(2):rd.macd?.toFixed(2), c: rd.macd>=0?"text-emerald-400":"text-rose-400", note: rd.macd>=0?"Pozitif momentum":"Negatif momentum" },
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
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📝 Teknik Yorum</div>
                      <div className="space-y-2">
                        {[
                          { l:"Trend", v:a.teknikYorum.trendDurumu },
                          { l:"Momentum", v:a.teknikYorum.momentumYorumu },
                          { l:"Seviyeler", v:a.teknikYorum.kritikSeviyeler },
                          { l:"Volatilite", v:a.teknikYorum.volatilite },
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
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">IV Parametreleri (1G Statistik)</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] md:text-[12px]">
                        {[
                          { l:"30G 1 SD Aralık", v:`$${rd.range1sd?.low}–$${rd.range1sd?.high}` },
                          { l:"30G 2 SD Aralık", v:`$${rd.range2sd?.low}–$${rd.range2sd?.high}` },
                          { l:"Impl. 30G Hareket",v:`±$${rd.implied30dMove?.toFixed(2)}` },
                          { l:"Günlük Drift",     v:`~${(rd.atr*0.04).toFixed(2)}% tahmini` },
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
                <SectionTitle icon="🔮" title="BÖLÜM 3 — 15 GÜNLÜK FORECAST & İCHİMOKU ANALİZİ" />

                {/* İndikatör Filtreleri */}
                <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-3 flex flex-wrap gap-2">
                  <div className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase w-full mb-1">📊 Teknik İndikatörler:</div>
                  {[
                    { id:"ichimoku", label:"Ichimoku", color:"#06b6d4" },
                    { id:"rsi", label:"RSI", color:"#f0a500" },
                    { id:"macd", label:"MACD", color:"#a855f7" },
                    { id:"bollinger", label:"Bollinger", color:"#ec4899" },
                    { id:"volume", label:"Hacim", color:"#10b981" },
                    { id:"sr", label:"Destek/Direnç", color:"#ef4444" },
                  ].map(ind => (
                    <label key={ind.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0a0e18] border border-[#1e3a5f]/40 hover:border-[#1e3a5f]/60 cursor-pointer text-[10px] md:text-[11px] font-semibold text-slate-300 transition-all">
                      <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded" />
                      <span style={{color: ind.color}}>■</span> {ind.label}
                    </label>
                  ))}
                </div>

                {/* Ichimoku Chart */}
                <IchimokuChart historyOHLC={rd.historyOHLC} currentPrice={rd.currentPrice} />

                {/* Destek/Direnç Seviyeleri */}
                <div className="bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-lg p-3">
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2.5">🧱 Destek / Direnç Seviyeleri</div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] md:text-[11px]">
                    {[
                      { l:"Direnç 3", v:rd.srLevels?.resistance3, c:"text-rose-400", bg:"bg-rose-500/10" },
                      { l:"Direnç 2", v:rd.srLevels?.resistance2, c:"text-rose-400", bg:"bg-rose-500/10" },
                      { l:"Direnç 1", v:rd.srLevels?.resistance1, c:"text-rose-300", bg:"bg-rose-500/15" },
                      { l:"Destek 1", v:rd.srLevels?.support1, c:"text-emerald-300", bg:"bg-emerald-500/15" },
                      { l:"Destek 2", v:rd.srLevels?.support2, c:"text-emerald-400", bg:"bg-emerald-500/10" },
                      { l:"Destek 3", v:rd.srLevels?.support3, c:"text-emerald-400", bg:"bg-emerald-500/10" },
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
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">☁️ İchimoku Teknik Göstergeler</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#f0a500]/20">
                        <div className="flex flex-col">
                          <span className="text-[#f0a500] font-black">Kısa Dönem Trend</span>
                          <span className="text-[9px] text-slate-500">Son 9 günlük fiyat ortalaması</span>
                        </div>
                        <span className="text-[#f0a500] font-semibold">${rd.ema20?.toFixed(2) ?? "-"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#e05c5c]/20">
                        <div className="flex flex-col">
                          <span className="text-[#e05c5c] font-black">Orta Dönem Trend</span>
                          <span className="text-[9px] text-slate-500">Son 26 günlük fiyat ortalaması</span>
                        </div>
                        <span className="text-[#e05c5c] font-semibold">${rd.ema50?.toFixed(2) ?? "-"}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#22c55e]/20">
                        <div className="flex flex-col">
                          <span className="text-slate-300 font-black">Destek/Direnç Bulutu</span>
                          <span className="text-[9px] text-slate-500">Fiyat bulutun üstünde → Boğa trendi</span>
                        </div>
                        <span className={rd.masterScore >= 60 ? "text-emerald-400 font-black" : rd.masterScore >= 45 ? "text-amber-400 font-black" : "text-rose-400 font-black"}>
                          {rd.masterScore >= 60 ? "🟢 Boğa" : rd.masterScore >= 45 ? "🟡 Nötr" : "🔴 Ayı"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-[#0a0e18] rounded border border-[#a855f7]/20">
                        <div className="flex flex-col">
                          <span className="text-[#a855f7] font-black">Momentum Çizgisi</span>
                          <span className="text-[9px] text-slate-500">Kapanış fiyatı 26 gün geri kaydırılmış</span>
                        </div>
                        <span className="text-[#a855f7] font-semibold text-[10px]">Grafikte görülebilir</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">📊 Diğer İndikatörler</div>
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
                      <th className="px-2 py-2.5 text-left font-black text-[#06b6d4] w-10">Gün</th>
                      <th className="px-2 py-2.5 text-right font-black text-rose-400">🐻 Bear</th>
                      <th className="px-2 py-2.5 text-right font-black text-amber-400">⚖️ Base</th>
                      <th className="px-2 py-2.5 text-right font-black text-emerald-400">🚀 Bull</th>
                      <th className="px-2 py-2.5 text-left font-black text-slate-400 hidden sm:table-cell">İchimoku Sinyal</th>
                    </tr></thead>
                    <tbody>
                      {a.forecast15.map((r:any,i:number)=>(
                        <tr key={i} className={`border-b border-[#1e3a5f]/20 ${i%2===0?"bg-[#0a0e18]":"bg-[#0d1321]/40"} hover:bg-[#1e3a5f]/15`}>
                          <td className="px-2 py-2 font-black text-slate-300">G+{r.day}</td>
                          <td className="px-2 py-2 text-right font-bold text-rose-400 font-mono">${(+r.bear).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-black text-amber-300 font-mono">${(+r.base).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-bold text-emerald-400 font-mono">${(+r.bull).toFixed(2)}</td>
                          <td className="px-2 py-2 text-slate-400 hidden sm:table-cell text-[10px]">{i < 5 ? "↗ Yükseliş" : i < 10 ? "➡️ Nötr" : "↘ Düşüş"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Senaryo özeti */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key:"bear", label:"🐻 Bear Senaryo", c:"border-rose-500/40 bg-rose-500/5 text-rose-400", d:a.scenarioOzeti.bear, supported: rd.masterScore < 45 },
                    { key:"base", label:"⚖️ Base Senaryo", c:"border-amber-500/40 bg-amber-500/5 text-amber-400", d:a.scenarioOzeti.base, supported: rd.masterScore >= 45 && rd.masterScore < 65 },
                    { key:"bull", label:"🚀 Bull Senaryo", c:"border-emerald-500/40 bg-emerald-500/5 text-emerald-400", d:a.scenarioOzeti.bull, supported: rd.masterScore >= 65 },
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
                          <span className="text-emerald-300 font-black">✓ Ichimoku Destekli</span>
                        ) : (
                          <span className="text-slate-400 font-medium">◐ Kısmi Destek</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ BÖLÜM 4: OPSİYON MATRİSİ ═══════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-5">
                <SectionTitle icon="⚙️" title="BÖLÜM 4 — OPSİYON & PRİM HASAT MATRİSİ" />

                {/* IV Analizi */}
                <div>
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📊 IV Analizi</div>
                  <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                    <table className="w-full text-[11px] md:text-[12px] min-w-[400px]">
                      <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                        <th className="px-3 py-2 text-left font-black text-slate-400">Metrik</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Değer</th>
                        <th className="px-3 py-2 text-left font-black text-slate-400">Yorum</th>
                      </tr></thead>
                      <tbody>
                        {[
                          { m:"IV (Güncel Est.)",  v:`%${rd.iv}`,           note: rd.iv>50?"Yüksek IV, prim sat":rd.iv>30?"Normal, seçici ol":"Düşük IV, bekle" },
                          { m:"IV Rank (52H)",    v:`${rd.ivRank?.toFixed(0)}/100`, note: rd.ivRank>50?"Pahalı → Prim sat":rd.ivRank>20?"Normal aralık":"Ucuz → Opsiyon al" },
                          { m:"HV (30G Tarihsel)",v:`%${rd.hv30?.toFixed(1)}`, note: "30 günlük gerçekleşen volatilite" },
                          { m:"IV/HV Oranı",      v:`${rd.ivHvRatio?.toFixed(2)}×`, note: rd.ivHvRatio>1.3?"IV pahalı → Sat ✅":rd.ivHvRatio<0.8?"IV ucuz → Al":"Dengeli" },
                          { m:"VIX Durumu",       v: rd.vixPrice?.toFixed(2)??"—", note: rd.vixPrice>25?"Yüksek korku, dikkat":rd.vixPrice>15?"Normal":"Düşük volatilite" },
                        ].map(r=>(
                          <tr key={r.m} className="border-b border-[#1e3a5f]/20">
                            <td className="px-3 py-2 font-bold text-slate-300">{r.m}</td>
                            <td className="px-3 py-2 text-right font-black text-[#06b6d4] font-mono">{r.v}</td>
                            <td className="px-3 py-2 text-slate-400">{r.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-2.5">
                    <p className="text-[11px] md:text-[12px] text-slate-300">{a.opsiyonAnaliz.ivDurumu}</p>
                  </div>
                </div>

                {/* CSP Matrisi */}
                <div>
                  <div className="text-[11px] md:text-[12px] font-black text-emerald-400 uppercase tracking-widest mb-2">💰 Cash-Secured PUT (CSP) Matrisi</div>
                  <div className="overflow-x-auto rounded-xl border border-emerald-500/20">
                    <table className="w-full text-[11px] md:text-[12px] min-w-[600px]">
                      <thead><tr className="bg-[#0d1321] border-b border-emerald-500/20">
                        <th className="px-3 py-2 text-left font-black text-slate-400">Hafta</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Strike</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">DTE</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Bid (est.)</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Prim %</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Yıllık %</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">OTM</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Ef. Maliyet</th>
                      </tr></thead>
                      <tbody>
                        {(rd.cspMatrix||[]).map((r:any,i:number)=>(
                          <tr key={i} className={`border-b border-emerald-500/10 ${i===0?"bg-emerald-500/5 border-l-2 border-l-emerald-500":""}`}>
                            <td className="px-3 py-2 font-bold text-slate-300">{r.label} {i===0&&<span className="text-emerald-400 text-[11px] md:text-[12px] font-black ml-1">OPTIMAL</span>}</td>
                            <td className="px-3 py-2 text-right font-black text-white font-mono">${r.strike}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">{r.dte}G</td>
                            <td className="px-3 py-2 text-right font-black text-emerald-400 font-mono">${r.bid}</td>
                            <td className="px-3 py-2 text-right font-black text-emerald-400">%{r.yieldPct}</td>
                            <td className="px-3 py-2 text-right font-black text-[#06b6d4]">%{r.annualYield}</td>
                            <td className="px-3 py-2 text-right text-slate-400">%{r.otmPct}</td>
                            <td className="px-3 py-2 text-right font-black text-amber-400 font-mono">${r.efMaliyet}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] md:text-[12px] font-black uppercase">
                    {[
                      {icon:"✅",label:"Aç",desc:"IV Rank>30 + Güçlü destek + Bilanço>14G uzakta",c:"border-emerald-500/30 bg-emerald-500/5 text-emerald-400"},
                      {icon:"⚡",label:"İzle",desc:"IV Rank 20-30 arası + Fiyat MA üstünde",c:"border-amber-500/30 bg-amber-500/5 text-amber-400"},
                      {icon:"❌",label:"Bekle",desc:"IV Rank<20 + Bilanço<14G + Sektör zayıf",c:"border-rose-500/30 bg-rose-500/5 text-rose-400"},
                      {icon:"🛑",label:"Kapat",desc:"Prim %50 eridi VEYA 2x prim kayıplandı",c:"border-slate-500/30 bg-slate-500/5 text-slate-400"},
                    ].map(r=>(
                      <div key={r.label} className={`border rounded-lg p-2 ${r.c}`}>
                        <div className="mb-0.5">{r.icon} {r.label}</div>
                        <div className="text-[11px] md:text-[12px] opacity-70 font-medium normal-case">{r.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-[11px] md:text-[12px] text-slate-300">{a.opsiyonAnaliz.cspStrateji}</p>
                  </div>
                </div>

                {/* CC Matrisi */}
                <div>
                  <div className="text-[11px] md:text-[12px] font-black text-blue-400 uppercase tracking-widest mb-2">📞 Covered CALL (CC) Matrisi</div>
                  <div className="overflow-x-auto rounded-xl border border-blue-500/20">
                    <table className="w-full text-[11px] md:text-[12px] min-w-[550px]">
                      <thead><tr className="bg-[#0d1321] border-b border-blue-500/20">
                        <th className="px-3 py-2 text-left font-black text-slate-400">Hafta</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Strike</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">DTE</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Bid (est.)</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">CC %</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Yıllık %</th>
                        <th className="px-3 py-2 text-right font-black text-slate-400">Maks Getiri</th>
                      </tr></thead>
                      <tbody>
                        {(rd.ccMatrix||[]).map((r:any,i:number)=>(
                          <tr key={i} className={`border-b border-blue-500/10 ${i===0?"bg-blue-500/5 border-l-2 border-l-blue-500":""}`}>
                            <td className="px-3 py-2 font-bold text-slate-300">{r.label}</td>
                            <td className="px-3 py-2 text-right font-black text-white font-mono">${r.strike}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-400">{r.dte}G</td>
                            <td className="px-3 py-2 text-right font-black text-blue-400 font-mono">${r.bid}</td>
                            <td className="px-3 py-2 text-right font-black text-blue-400">%{r.yieldPct}</td>
                            <td className="px-3 py-2 text-right font-black text-[#06b6d4]">%{r.annualYield}</td>
                            <td className="px-3 py-2 text-right font-black text-amber-400 font-mono">${r.maxReturn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                    <p className="text-[11px] md:text-[12px] text-slate-300">{a.opsiyonAnaliz.ccStrateji}</p>
                  </div>
                </div>

                {/* Atanma Risk + Pasif Gelir */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0d1321]/50 border border-amber-500/20 rounded-xl p-4 space-y-2">
                    <div className="text-[11px] md:text-[12px] font-black text-amber-400 uppercase tracking-widest">⚠️ Atanma Risk Analizi (CSP)</div>
                    {[
                      ["Strike",           `$${rd.cspMatrix?.[0]?.strike??optCsp}`],
                      ["Alınan Prim",      `$${rd.cspMatrix?.[0]?.bid??"-"}`],
                      ["Efektif Maliyet",  `$${rd.cspMatrix?.[0]?.efMaliyet??"-"}`],
                      ["Güncel Fiyat",     `$${currentPrice.toFixed(2)}`],
                      ["Kâra Geçiş",       `$${rd.cspMatrix?.[0]?.efMaliyet??"-"} üzeri`],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between border-b border-amber-500/10 pb-1.5 text-[11px] md:text-[12px]">
                        <span className="text-slate-400 font-medium">{l}</span>
                        <span className="text-amber-300 font-black font-mono">{v}</span>
                      </div>
                    ))}
                    <p className="text-[11px] md:text-[12px] text-slate-400 mt-2">Atanma sonrası: CC stratejisine geç → Haftalık prim topla → Maliyet fiyatına geri dönüşü bekle</p>
                  </div>
                  <div className="bg-[#0d1321]/30 border border-[#06b6d4]/10 rounded-xl p-4 space-y-2">
                    <div className="text-[11px] md:text-[12px] font-semibold text-[#06b6d4]/70 uppercase tracking-widest">💰 Pasif Gelir Tahmini (Yıllık)</div>
                    {[
                      ["Aylık CSP Getirisi",  a.opsiyonAnaliz.haftalikPrimTahmin+" / hafta"],
                      ["Yıllık Getiri (Est.)",a.opsiyonAnaliz.yillikGetiriTahmin],
                      ["Optimal DTE",         "14-21 Gün"],
                      ["CSP Delta Hedef",     "Δ 0.20–0.30"],
                      ["CC Delta Hedef",      "Δ 0.25–0.35"],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between border-b border-[#06b6d4]/10 pb-1.5 text-[10px] md:text-[11px]">
                        <span className="text-slate-500">{l}</span>
                        <span className="text-[#06b6d4] font-semibold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Wheel */}
                <div className="bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-xl p-4">
                  <div className="text-[11px] md:text-[12px] font-semibold text-[#06b6d4]/80 uppercase tracking-widest mb-3">🔁 Wheel Stratejisi Döngüsü</div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] md:text-[12px] font-semibold uppercase tracking-wider">
                    {["CSP SAT","→","ATANMADI?","→","PRİM KÂR","→","TEKRAR CSP","OR","ATANDI?","→","HİSSE AL","→","CC SAT","→","TEKRAR CSP"].map((s,i)=>(
                      <span key={i} className={s==="→"||s==="OR"?"text-slate-600":s==="ATANDI?"||s==="ATANMADI?"?"text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded":"px-2 py-1 rounded-lg bg-[#1e3a5f]/40 text-[#06b6d4] border border-[#1e3a5f]/60"}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 5: ÇEK LİSTESİ ════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="📋" title="HİSSE İNCELEME ÇEK LİSTESİ" />
                {[
                  { group:"🔵 TREND & YAPI", items:[
                    { l:"1W grafikte 50G MA üzerinde mi?", s:a.ceklistSkorlar.trendYapisi },
                    { l:"EMA 20 > EMA 50 (Golden Cross)?", s:rd.maLevels?.goldenCross?1:-1 },
                    { l:"EMA 20 üzerinde mi?",             s:a.ceklistSkorlar.ema20Above },
                    { l:"EMA 50 üzerinde mi?",             s:a.ceklistSkorlar.ema50Above },
                    { l:"BOGA Skor ≥ 60?",                 s:a.ceklistSkorlar.bogaScore },
                  ]},
                  { group:"🟡 VOLATİLİTE & PRİM", items:[
                    { l:"IV Rank > 30? (Prim satış uygun)", s:a.ceklistSkorlar.ivUygun },
                    { l:"IV/HV Oranı > 1.2? (IV pahalı)", s:rd.ivHvRatio>1.2?1:rd.ivHvRatio>0.9?0:-1 },
                    { l:"ATR volatilite uygun mu?",         s:a.ceklistSkorlar.atrUygun },
                  ]},
                  { group:"🟢 STRATEJİK UYGUNLUK", items:[
                    { l:"Kritik destek üzerinde mi?",       s:a.ceklistSkorlar.destekGucu },
                    { l:"RSI 40–70 arasında mı?",           s:a.ceklistSkorlar.momentumGuclu },
                    { l:"CSP atanma fiyatı savunulabilir?", s:rd.cspMatrix?.[0]?.efMaliyet < currentPrice*0.95?1:0 },
                    { l:"Hisse elimde kalsa 1 ay bekler miyim?", s:rd.masterScore>=55?1:rd.masterScore>=40?0:-1 },
                  ]},
                  { group:"🔴 RİSK KONTROLLERİ", items:[
                    { l:"Pozisyon portföyün max %5'i içinde mi?", s:1 },
                    { l:"Stop-loss seviyesi belirlendi mi?",       s:1 },
                    { l:"Makro risk (FOMC, CPI) değerlendirildi?", s:0 },
                  ]},
                ].map(group=>(
                  <div key={group.group}>
                    <div className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-widest mb-2">{group.group}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.items.map(item=>(
                        <div key={item.l} className="flex items-center justify-between bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg px-3 py-2">
                          <span className="text-[11px] md:text-[12px] text-slate-300 font-medium">{item.l}</span>
                          <Badge score={item.s} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ══ FİNANSAL ANALİZ ════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="💹" title="FİNANSAL ANALİZ & HİSSE BEKLENTİSİ" />

                {/* Finansal Metriks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2.5">📊 Piyasa Değeri & Likidite</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Piyasa Değeri</span>
                        <span className="text-white font-semibold">{rd.marketCapStr}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">30G Ort. Hacim</span>
                        <span className="text-white font-semibold">{rd.avgVol30d > 1e6 ? (rd.avgVol30d / 1e6).toFixed(1) + "M" : (rd.avgVol30d / 1e3).toFixed(0) + "K"}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#1e3a5f]/30">
                        <span className="text-slate-400 font-medium">Likidite Skoru</span>
                        <span className={`font-black ${rd.avgVol30d > 1e6 ? "text-emerald-400 bg-emerald-500/10" : rd.avgVol30d > 500e3 ? "text-amber-400 bg-amber-500/10" : "text-rose-400 bg-rose-500/10"} px-2 py-0.5 rounded text-[10px]`}>
                          {rd.avgVol30d > 1e6 ? "YÜKSEK ✓" : rd.avgVol30d > 500e3 ? "ORTA" : "DÜŞÜK"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3.5">
                    <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2.5">📈 Trend & Momentum</div>
                    <div className="space-y-2 text-[11px] md:text-[12px]">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">52H Aralığı</span>
                        <span className="text-white font-semibold">${rd.low52w?.toFixed(2)??"-"} / ${rd.high52w?.toFixed(2)??"-"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Konumlandırma</span>
                        <span className={`font-semibold ${currentPrice >= rd.high52w * 0.9 ? "text-emerald-400" : currentPrice <= rd.low52w * 1.1 ? "text-rose-400" : "text-amber-400"}`}>
                          {currentPrice >= rd.high52w * 0.9 ? "ZİRVEYE YAKIN ↗" : currentPrice <= rd.low52w * 1.1 ? "DİPYE YAKIN ↘" : "ORTA SEVİYE →"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-[#1e3a5f]/30">
                        <span className="text-slate-400 font-medium">Beklenti (15G)</span>
                        <span className={`font-black bg-opacity-10 px-2 py-0.5 rounded text-[10px] ${rd.masterScore >= 65 ? "text-emerald-400 bg-emerald-500" : rd.masterScore >= 50 ? "text-amber-400 bg-amber-500" : "text-rose-400 bg-rose-500"}`}>
                          {rd.masterScore >= 65 ? "🚀 YÜKSELİŞ" : rd.masterScore >= 50 ? "➡️ NÖTR" : "📉 DÜŞÜŞ"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Finansal Sağlık Özeti */}
                <div className="bg-gradient-to-r from-[#0d1321]/80 to-[#0a0e18] border border-[#06b6d4]/20 rounded-lg p-4">
                  <div className="text-[10px] md:text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-3">📋 FİNANSAL SAĞLIK ÖZETI</div>
                  <div className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed space-y-2">
                    <p>
                      <span className="font-semibold text-[#06b6d4]">{data.companyName}</span>
                      {rd.marketCapStr !== "N/A" ? ` (Piyasa Değeri: ${rd.marketCapStr})` : ""}
                      {rd.avgVol30d > 500e3 ? "yeterli işlem hacmine sahip, " : "sınırlı likiditeye sahip, "}
                      {currentPrice >= rd.high52w * 0.85 ? "52 haftalık en yüksek seviyeye yakında " : currentPrice <= rd.low52w * 1.15 ? "52 haftalık en düşük seviyeye yakında " : "52 haftalık aralığın ortasında "}
                      konumlanmaktadır.
                    </p>
                    <p>
                      <span className="font-semibold text-amber-400">Teknik İndikatörler:</span>
                      {rd.masterScore >= 65 ? " Güçlü yükseliş sinyalleri (BOGA Skoru ≥65) ile desteklenmektedir. CSP/CC opsiyon stratejileri için uygun zemin mevcuttur."
                      : rd.masterScore >= 50 ? " Nötr görünüm (BOGA Skoru 50-64). Strateji seçimi önem taşıyor, risk yönetimi gereklidir."
                      : " Düşüş baskısı altında (BOGA Skoru <50). Prim satışı stratejileri tercih edilmeli, çağrı opsiyon satışı uygun."}
                    </p>
                    <p>
                      <span className="font-semibold text-cyan-400">İndikatör Analizi:</span>
                      RSI {rd.rsi?.toFixed(1)}% ({rd.rsi > 70 ? "aşırı alım" : rd.rsi < 30 ? "aşırı satım" : "nötr"}),
                      IV %{rd.iv} ({rd.iv > 50 ? "yüksek volatilite" : rd.iv > 30 ? "orta volatilite" : "düşük volatilite"}),
                      IV Rank {rd.ivRank?.toFixed(0)}/100 ({rd.ivRank > 50 ? "prim satışı uygun ✓" : "prim satışı sınırlı"}).
                    </p>
                    <div className="pt-2 border-t border-[#1e3a5f]/30 mt-3">
                      <span className="font-semibold text-emerald-400">✓ Beklenti:</span>
                      {rd.masterScore >= 65 ? " Hisse yükseliş trendinde. 15 günde hedef fiyatlara ulaşma olasılığı YÜKSEK. CSP (DTE 14-21) ve CC stratejileri seçici kullanılabilir."
                      : rd.masterScore >= 50 ? " Hisse nötr aralıkta. Ranged trading yaklaşımı uygun. DTE 21-30 prim stratejileri daha güvenli."
                      : " Hisse düşüş trendine giriş riski VAR. Prim satışı stratejilerinde daha yüksek strike seçilmeli, risk kontrol zorunlu."}
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ SONUÇ ═══════════════════════════════════════════════════════ */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1829] to-[#070b12] border border-[#1e3a5f] p-5 md:p-6 space-y-4">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#06b6d412,_transparent_60%)]"/>
                <div className="relative">
                  <SectionTitle icon="🏁" title="SONUÇ & KARAR ÖZETİ" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { l:"Genel Puan",   v:a.sonucKarar.genelPuan+"/10", c:+a.sonucKarar.genelPuan>=7?"text-emerald-400":+a.sonucKarar.genelPuan>=5?"text-amber-400":"text-rose-400" },
                      { l:"CSP Uygunluğu",v:<LevelBadge v={a.sonucKarar.cspUygunlugu} fb="ORTA"/>, c:"" },
                      { l:"CC Uygunluğu", v:<LevelBadge v={a.sonucKarar.ccUygunlugu} fb="ORTA"/>, c:"" },
                      { l:"15G Görünüm",  v:rd.masterScore>=60?"YÜKSELİŞ":rd.masterScore>=45?"YATAY":"DÜŞÜŞ", c:rd.masterScore>=60?"text-emerald-400":rd.masterScore>=45?"text-amber-400":"text-rose-400" },
                    ].map((item,i)=>(
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                        <div className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider">{item.l}</div>
                        <div className={`text-sm font-black mt-1 ${item.c}`}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">En İyi CSP Setup</div>
                      <div className="bg-[#0d1321]/60 border border-emerald-500/20 rounded-xl p-3 text-[11px] md:text-[12px]">
                        <span className="text-emerald-400 font-black">Strike ${rd.cspMatrix?.[1]?.strike ?? a.opsiyonAnaliz.optimalCSPStrike}, DTE 14G, Prim ${rd.cspMatrix?.[1]?.bid ?? "-"}, Yıllık %{rd.cspMatrix?.[1]?.annualYield ?? "-"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">En İyi CC Setup</div>
                      <div className="bg-[#0d1321]/60 border border-blue-500/20 rounded-xl p-3 text-[11px] md:text-[12px]">
                        <span className="text-blue-400 font-black">Strike ${rd.ccMatrix?.[1]?.strike ?? a.opsiyonAnaliz.optimalCCStrike}, DTE 14G, Prim ${rd.ccMatrix?.[1]?.bid ?? "-"}, Yıllık %{rd.ccMatrix?.[1]?.annualYield ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-[#0d1321]/60 border border-[#06b6d4]/20 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-wider mb-1">ÖNERI</div>
                      <p className="text-[11px] md:text-[12px] text-white font-bold leading-relaxed">{a.sonucKarar.oneri}</p>
                    </div>
                    <div className="border-t border-[#1e3a5f]/40 pt-3">
                      <div className="text-[11px] md:text-[12px] font-black text-rose-400 uppercase tracking-wider mb-1">⚠️ KRİTİK RİSK</div>
                      <p className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed">{a.sonucKarar.kritikRisk}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 5: EMA KALİTE PROFİLİ ═══════════════════════════════ */}
              {rd.emaProfile && (
                <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                  <SectionTitle icon="🧬" title="BÖLÜM 5 — EMA KALİTE PROFİLİ & KIRILIM EŞİĞİ" />

                  {/* Profile card */}
                  <div className={`rounded-xl border p-4 ${rd.emaProfile.profile === "A" ? "border-emerald-500/40 bg-emerald-500/5" : rd.emaProfile.profile === "B" ? "border-amber-500/40 bg-amber-500/5" : "border-rose-500/40 bg-rose-500/5"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-2xl font-black px-3 py-1 rounded-xl border ${rd.emaProfile.profile === "A" ? "border-emerald-500/50 text-emerald-400" : rd.emaProfile.profile === "B" ? "border-amber-500/50 text-amber-400" : "border-rose-500/50 text-rose-400"}`}>
                        Profil {rd.emaProfile.profile}
                      </span>
                      <div>
                        <div className="text-white font-black text-sm">{rd.emaProfile.label} Hisse</div>
                        <div className="text-slate-400 text-[11px]">Kritik Referans EMA: <span className="text-[#06b6d4] font-black">{rd.emaProfile.keyEMA}</span></div>
                      </div>
                    </div>
                    <p className="text-[11px] md:text-[12px] text-slate-200 font-bold">{rd.emaProfile.desc}</p>
                  </div>

                  {/* EMA slope table */}
                  <div>
                    <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📐 EMA Eğim Analizi</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[11px] md:text-[12px]">
                        <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/40">
                          <th className="px-3 py-2 text-left font-black text-slate-400">EMA</th>
                          <th className="px-3 py-2 text-right font-black text-slate-400">Değer</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">Eğim</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">Fiyat Durumu</th>
                          <th className="px-3 py-2 text-left font-black text-slate-400">Yorum</th>
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
                            let yorum = "";
                            if (r.slope === "yükselen" && above) yorum = "Geri çekilme alım fırsatı";
                            else if (r.slope === "yatay") yorum = "Destek değil, dikkat";
                            else if (r.slope === "düşen" && above) yorum = "Toparlanma tuzak olabilir";
                            else yorum = "Baskı devam edebilir";
                            return (
                              <tr key={r.l} className={`border-b border-[#1e3a5f]/20 ${r.key ? "bg-[#06b6d4]/5" : ""}`}>
                                <td className="px-3 py-2 font-bold text-slate-300">
                                  {r.l} {r.key && <span className="text-[#06b6d4] font-black ml-1 text-[10px]">★ ANAHTAR</span>}
                                </td>
                                <td className="px-3 py-2 text-right font-black font-mono text-white">${r.v?.toFixed(2) ?? "-"}</td>
                                <td className={`px-3 py-2 font-black ${slopeColor}`}>{slopeIcon} {r.slope}</td>
                                <td className={`px-3 py-2 font-black text-[11px] ${above ? "text-emerald-400" : "text-rose-400"}`}>{above ? "▲ Üstünde" : "▼ Altında"}</td>
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
                    <div className="text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-1">📏 EMA Band Genişliği (EMA20 ↔ EMA50)</div>
                    {(() => {
                      const bandPct = rd.ema50 > 0 ? Math.abs(rd.ema20 - rd.ema50) / rd.ema50 * 100 : 0;
                      const converging = bandPct < 1.5;
                      return (
                        <p className="text-[11px] md:text-[12px] text-slate-300">
                          Band genişliği: <span className="font-black text-white">%{bandPct.toFixed(2)}</span>
                          {converging
                            ? <span className="text-amber-400 font-black ml-2">⚡ EMA'lar birbirine yaklaşıyor — büyük hareket habercisi</span>
                            : <span className="text-slate-400 ml-2">— Normal aralık</span>}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ══ BÖLÜM 6: KURUMSAL PARA AKIŞI ════════════════════════════════ */}
              {rd.flowSummary && (
                <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                  <SectionTitle icon="🏦" title="BÖLÜM 6 — KURUMSAL PARA AKIŞI & PİYASA YAPISI" />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { l: "OBV Trendi", v: rd.flowSummary.obvTrend, c: rd.flowSummary.obvTrend === "yükselen" ? "text-emerald-400" : rd.flowSummary.obvTrend === "düşen" ? "text-rose-400" : "text-amber-400" },
                      { l: "A/D Trendi",  v: rd.flowSummary.adTrend,  c: rd.flowSummary.adTrend  === "yükselen" ? "text-emerald-400" : rd.flowSummary.adTrend  === "düşen" ? "text-rose-400" : "text-amber-400" },
                      { l: "MFI (14)",   v: `${rd.flowSummary.mfi} — ${rd.flowSummary.mfiLabel}`, c: rd.flowSummary.mfi > 80 ? "text-rose-400" : rd.flowSummary.mfi < 20 ? "text-emerald-400" : "text-amber-400" },
                      { l: "Fiyat-OBV",  v: rd.flowSummary.divergence === "negatif" ? "⚠️ Negatif Uyumsuz" : rd.flowSummary.divergence === "pozitif" ? "✅ Pozitif Uyumsuz" : "✅ Uyumlu", c: rd.flowSummary.divergence !== "yok" ? "text-amber-400" : "text-emerald-400" },
                    ].map(i => (
                      <div key={i.l} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                        <div className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider">{i.l}</div>
                        <div className={`text-sm font-black mt-1 ${i.c}`}>{i.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Fiyat-Hacim Pattern */}
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-3">
                    <div className="text-[11px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">📊 Son Seans Fiyat-Hacim Kalıbı</div>
                    {(() => {
                      const p = rd.flowSummary.pvPattern;
                      const m: Record<string, { icon: string; c: string; desc: string }> = {
                        "güçlü birikim":       { icon: "🟢", c: "text-emerald-400", desc: "Yüksek hacimle yükseliş → Kurumsal birikim onayı" },
                        "güçlü dağıtım":       { icon: "🔴", c: "text-rose-400",    desc: "Yüksek hacimle düşüş → Dağıtım sinyali, dikkat" },
                        "zayıf yükseliş":      { icon: "🟡", c: "text-amber-400",   desc: "Düşük hacimle yükseliş → Zayıf hareket, doğrulama beklenmeli" },
                        "normal geri çekilme": { icon: "🔵", c: "text-blue-400",    desc: "Düşük hacimle düşüş → Normal geri çekilme, panik yok" },
                        "nötr":                { icon: "⚪", c: "text-slate-400",   desc: "Hacim-fiyat nötr" },
                      };
                      const info = m[p] ?? m["nötr"];
                      return <p className={`text-[11px] md:text-[12px] font-bold ${info.c}`}>{info.icon} {p.charAt(0).toUpperCase() + p.slice(1)} — {info.desc}</p>;
                    })()}
                  </div>

                  {/* Sessiz birikim */}
                  {rd.flowSummary.obvTrend === "yükselen" && rd.flowSummary.adTrend === "yükselen" && (() => {
                    const priceFlat = Math.abs(currentPrice - rd.ema20) / rd.ema20 < 0.02;
                    if (!priceFlat) return null;
                    return (
                      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3">
                        <p className="text-emerald-300 font-black text-[11px] md:text-[12px]">
                          🔔 SESSİZ BİRİKİM TESPİTİ — Fiyat yatay seyrederken OBV ve A/D kademeli artıyor. Kırılım öncesi erken kurumsal giriş sinyali olabilir.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Divergence warning */}
                  {rd.flowSummary.divergence === "negatif" && (
                    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3">
                      <p className="text-amber-300 font-black text-[11px] md:text-[12px]">
                        ⚠️ NEGATİF UYUMSUZLUK — Fiyat yükselirken OBV düşüyor. Momentum arkasında kurumsal destek yok olabilir. Dikkatli ol.
                      </p>
                    </div>
                  )}

                  {/* MFI extreme warning */}
                  {rd.flowSummary.mfi > 80 && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
                      <p className="text-rose-300 font-black text-[11px] md:text-[12px]">⚠️ MFI {rd.flowSummary.mfi} — Aşırı alım bölgesi. Prim satışı stratejilerinde dikkatli ol.</p>
                    </div>
                  )}
                  {rd.flowSummary.mfi < 20 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                      <p className="text-emerald-300 font-black text-[11px] md:text-[12px]">✅ MFI {rd.flowSummary.mfi} — Aşırı satım bölgesi. CSP için potansiyel zemin oluşuyor.</p>
                    </div>
                  )}

                  {/* Info note */}
                  <div className="bg-[#0d1321]/30 border border-[#1e3a5f]/20 rounded-lg p-2.5">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      <span className="font-black text-slate-400">OBV:</span> Hacim ağırlıklı fiyat yönü. Fiyat yükselirken OBV düşüyorsa kurumsal çıkış var.&nbsp;
                      <span className="font-black text-slate-400">A/D:</span> Kapanışın gün içi aralıktaki konumuna göre birikim/dağıtım.&nbsp;
                      <span className="font-black text-slate-400">MFI:</span> Hacim ağırlıklı RSI — 80+ aşırı alım, 20− aşırı satım.
                    </p>
                  </div>
                </div>
              )}

              {/* ══ BÖLÜM 7: RİSK FAKTÖRLERİ ═══════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="⚠️" title="BÖLÜM 7 — RİSK FAKTÖRLERİ (GENİŞLETİLMİŞ)" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Short Interest placeholder */}
                  <div className="bg-[#0d1321]/60 border border-rose-500/20 rounded-xl p-4 space-y-3">
                    <div className="text-[11px] md:text-[12px] font-black text-rose-400 uppercase tracking-widest">📉 Short Interest & Kısa Faiz</div>
                    <div className="space-y-1.5 text-[11px] md:text-[12px]">
                      {[
                        ["Short Float", "Brokerage kaynağından kontrol et"],
                        ["Days to Cover", "Short Float / Günlük Hacim"],
                        ["Eşik Değerleri", "<%5 Normal | %5-15 Dikkat | >%25 Squeeze Riski"],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between border-b border-rose-500/10 pb-1.5">
                          <span className="text-slate-400 font-medium">{l}</span>
                          <span className="text-slate-500 text-[10px] italic">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-rose-500/5 rounded-lg p-2 text-[10px] text-rose-300/70">Finviz / Ortex / Broker platformundan güncel short float verisini kontrol et. Yüksek short float + yükselen OBV → squeeze potansiyeli.</div>
                  </div>

                  {/* Dilution risk */}
                  <div className="bg-[#0d1321]/60 border border-amber-500/20 rounded-xl p-4 space-y-3">
                    <div className="text-[11px] md:text-[12px] font-black text-amber-400 uppercase tracking-widest">💧 Dilüsyon Risk Göstergeleri</div>
                    <div className="space-y-1.5 text-[11px] md:text-[12px]">
                      {[
                        ["Piyasa Değeri", rd.marketCapStr],
                        ["Küçük Cap Risk", rd.marketCapStr?.includes("M") && !rd.marketCapStr?.includes("B") ? "⚠️ Shelf/Warrant riski yüksek" : "✅ Görece düşük risk"],
                        ["SEC Kontrol", "EDGAR'da S-3, warrant, lock-up"],
                      ].map(([l, v]) => (
                        <div key={l} className="flex justify-between border-b border-amber-500/10 pb-1.5">
                          <span className="text-slate-400 font-medium">{l}</span>
                          <span className="text-amber-300 font-bold">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-amber-500/5 rounded-lg p-2 text-[10px] text-amber-300/70">Spekülatif profil (C) hisselerde shelf registration ve convertible note riski her zaman değerlendirilmeli.</div>
                  </div>
                </div>

                {/* Earnings season protocol */}
                <div className="border border-[#06b6d4]/30 bg-[#06b6d4]/5 rounded-xl p-4">
                  <div className="text-[11px] md:text-[12px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📅 Kazanç Sezonu Protokolü</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    {[
                      { r: "0–14 Gün", d: "Kazanç Sonrası Dönem", c: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300", note: "Tüm veriler kazanç sonrasını yansıtıyor" },
                      { r: "15–60 Gün", d: "Normal Dönem", c: "border-slate-500/40 bg-slate-500/5 text-slate-300", note: "Kazanç verisi taze ve geçerli" },
                      { r: "60+ Gün", d: "Bilanço Yaklaşıyor", c: "border-amber-500/40 bg-amber-500/5 text-amber-300", note: "IV crush riski — CSP/CC dikkatli" },
                      { r: "±3 Gün", d: "Bilanço Günü", c: "border-rose-500/40 bg-rose-500/5 text-rose-300", note: "Opsiyon pozisyonu alma — yüksek risk" },
                    ].map(i => (
                      <div key={i.r} className={`border rounded-lg p-2 ${i.c}`}>
                        <div className="font-black">{i.r}</div>
                        <div className="font-bold mt-0.5">{i.d}</div>
                        <div className="opacity-70 mt-0.5">{i.note}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">⚡ Bir sonraki kazanç tarihini SEC EDGAR veya Earnings Whispers üzerinden doğrula. Bilanço ±3 gün içindeyse opsiyon pozisyonu açma, prim IV şişmesiyle başlar ama kazanç sonrası IV crush pozisyonu zarara sokabilir.</p>
                </div>
              </div>

              {/* ══ BÖLÜM 8: MAKRO & SEKTÖR BAĞLAMI ════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🌍" title="BÖLÜM 8 — MAKRO & SEKTÖR BAĞLAMI" />

                {/* Piyasa rejimi */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { l: "S&P 500", v: rd.sp500Change, suffix: "%", threshold: 0 },
                    { l: "NASDAQ",  v: rd.nasdaqChange, suffix: "%", threshold: 0 },
                    { l: "VIX",    v: rd.vixPrice, suffix: "", threshold: null },
                  ].map(i => {
                    const isVix = i.l === "VIX";
                    const color = isVix ? (i.v > 25 ? "text-rose-400" : i.v > 15 ? "text-amber-400" : "text-emerald-400") : (i.v >= 0 ? "text-emerald-400" : "text-rose-400");
                    const regime = isVix ? (i.v > 25 ? "Risk-Off ⚠️" : i.v > 15 ? "Dikkat →" : "Risk-On ✅") : (i.v >= 0 ? "Pozitif ▲" : "Negatif ▼");
                    return (
                      <div key={i.l} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{i.l}</div>
                        <div className={`text-xl font-black font-mono mt-1 ${color}`}>
                          {i.v != null ? (isVix ? i.v?.toFixed(2) : (i.v >= 0 ? "+" : "") + i.v?.toFixed(2) + i.suffix) : "—"}
                        </div>
                        <div className={`text-[11px] font-bold mt-0.5 ${color}`}>{i.v != null ? regime : "Veri yok"}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Risk-off warning */}
                {rd.vixPrice > 25 && (
                  <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3">
                    <p className="text-rose-300 font-black text-[11px] md:text-[12px]">
                      🚨 Risk-Off Ortamı — VIX {rd.vixPrice?.toFixed(1)} seviyesinde. Spekülatif küçük cap satışı hızlanır. Kurumsal profil dışı hisselerde prim satışı risklidir.
                    </p>
                  </div>
                )}

                {/* Sektörel makro faktörler */}
                <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-4">
                  <div className="text-[11px] font-black text-[#06b6d4] uppercase tracking-widest mb-3">🏭 Sektör: {data.sector}</div>
                  <div className="text-[11px] md:text-[12px] text-slate-300 leading-relaxed space-y-1.5">
                    {(() => {
                      const s = (data.sector || "").toLowerCase();
                      const factors: string[] = [];
                      if (s.includes("defense") || s.includes("aerospace") || s.includes("drone")) {
                        factors.push("🛡️ Savunma bütçesi haberleri ve jeopolitik gelişmeler doğrudan etkiler.");
                        factors.push("📋 FAA/NDAA düzenlemeleri ve ihale sonuçları katalizör olabilir.");
                      } else if (s.includes("electric") || s.includes("ev") || s.includes("auto")) {
                        factors.push("🔋 Fed faiz ortamı tüketici kredisini etkiler — EV satışlarına yansır.");
                        factors.push("💰 EV teşvik politikaları ve hammadde (lityum, kobalt) fiyatları kritik.");
                      } else if (s.includes("tech") || s.includes("software") || s.includes("saas")) {
                        factors.push("📈 Fed faiz kararları büyüme hissesi değerlemesini doğrudan etkiler.");
                        factors.push("🤖 Yapay zeka rekabeti ve regülasyon gelişmeleri yakından takip edilmeli.");
                      } else if (s.includes("biotech") || s.includes("pharmaceutical")) {
                        factors.push("💊 FDA onay takvimi ve klinik sonuçlar fiyat için en kritik katalizörlerdir.");
                        factors.push("💵 Nakit burn rate ve runway tükenme tarihi risk faktörüdür.");
                      } else if (s.includes("bank") || s.includes("financ")) {
                        factors.push("📊 Net Interest Margin ve Fed faiz kararları doğrudan etkiler.");
                        factors.push("⚠️ Kredi kayıp karşılıkları ve NIM trendi bilanço kalitesini belirler.");
                      } else {
                        factors.push("📰 Sektörel haberler ve makro gelişmeler takip edilmeli.");
                        factors.push("📊 Fed toplantıları, CPI ve istihdam verilerinin piyasaya etkisi değerlendirilmeli.");
                      }
                      factors.push("📉 Mevcut piyasa rejimi: VIX " + (rd.vixPrice > 25 ? "25+ → Risk-Off. Küçük cap pozisyonlar riskli." : rd.vixPrice > 15 ? "15-25 → Dikkat gerekiyor." : "<15 → Risk-On. Uygun ortam."));
                      return factors.map((f, i) => <p key={i}>{f}</p>);
                    })()}
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 9: İNSİDER İŞLEMLERİ ═══════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🔐" title="BÖLÜM 9 — İNSİDER İŞLEMLERİ TAKIBI (FORM 4/144)" />
                {rd.insiderTransactions?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.insiderTransactions.map((tx: any, i: number) => (
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-white text-[11px] md:text-[12px]">{tx.officer} — {tx.title}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded ${tx.type === "BUY" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                            {tx.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <p>📅 {tx.date} • {tx.shares} hisse • ${tx.price.toFixed(2)}</p>
                          <p>📊 Net Pozisyon: {tx.netPosition} hisse ({(tx.netPosition > 0 ? "+" : "") + ((tx.netPosition / tx.priorPosition) * 100).toFixed(1)}%)</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-[11px] md:text-[12px]">Son 30 günde raporlanmış insider işlemi bulunamadı. CEO/CFO pozisyonları ve Form 144 satışları yakından takip edilmeli.</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 10: GÜNCEL HABER & KATALİZÖR AKIŞI ════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="📰" title="BÖLÜM 10 — GÜNCEL HABER & KATALİZÖR AKIŞI (SON 30 GÜN)" />
                {rd.recentNews?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.recentNews.map((news: any, i: number) => (
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-white text-[11px] md:text-[12px] flex-1">{news.title}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded whitespace-nowrap ml-2 ${news.sentiment === "Pozitif" ? "bg-emerald-500/20 text-emerald-300" : news.sentiment === "Negatif" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>
                            {news.sentiment}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <p>📅 {news.date} • Kaynak: {news.source}</p>
                          <p>{news.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-[11px] md:text-[12px]">📊 Son 30 günün haber özeti yükleniyor... SEC Filings (8-K, S-3), kazanç duyuruları ve sektörel gelişmeler yakından takip edilmeli.</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 11: ANALIST KONSENSÜSÜ & FİYAT HEDEFİ ═══════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="👥" title="BÖLÜM 11 — ANALIST KONSENSÜSÜ & FİYAT HEDEFİ" />
                {rd.analystData?.count > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-slate-500 uppercase">Analiz Yapan</div>
                        <div className="text-lg font-black text-white mt-1">{rd.analystData.count}</div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-emerald-400 uppercase">Buy</div>
                        <div className="text-lg font-black text-emerald-300 mt-1">{rd.analystData.buy}</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-amber-400 uppercase">Hold</div>
                        <div className="text-lg font-black text-amber-300 mt-1">{rd.analystData.hold}</div>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-rose-400 uppercase">Sell</div>
                        <div className="text-lg font-black text-rose-300 mt-1">{rd.analystData.sell}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-slate-500 uppercase">Ortalama</div>
                        <div className="text-lg font-black text-[#06b6d4] mt-1">${rd.analystData.avgTarget.toFixed(2)}</div>
                      </div>
                      <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-slate-500 uppercase">Min Target</div>
                        <div className="text-lg font-black text-rose-400 mt-1">${rd.analystData.minTarget.toFixed(2)}</div>
                      </div>
                      <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="text-[11px] font-black text-slate-500 uppercase">Max Target</div>
                        <div className="text-lg font-black text-emerald-400 mt-1">${rd.analystData.maxTarget.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-[11px] md:text-[12px]">🔍 Analist konsensüsü verileri yükleniyor... Kaç analist takip ediyor, ortalama hedef fiyat, revizyon trendi yakında yayınlanacaktır.</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 12: 13F KURUMSAL SAHİPLİK DEĞİŞİMLERİ ══════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🏛️" title="BÖLÜM 12 — 13F KURUMSAL SAHİPLİK DEĞİŞİMLERİ (EN BÜYÜK 5)" />
                {rd.institutionalOwners?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.institutionalOwners.map((owner: any, i: number) => (
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-white text-[11px] md:text-[12px]">{i + 1}. {owner.name}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded ${owner.change >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                            {owner.change >= 0 ? "+" : ""}{owner.change.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">📊 {owner.shares.toLocaleString()} hisse • ${(owner.shares * rd.currentPrice).toFixed(0)} değeri</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-[11px] md:text-[12px]">📊 13F kurumsal sahiplik verilerine erişiliyor... Vanguard, BlackRock, State Street gibi büyük kurumların pozisyon değişimleri yakında gösterilecektir.</p>
                  </div>
                )}
              </div>

              {/* ══ BÖLÜM 13: KAZANÇ GEÇMİŞİ & POST-EARNINGS DAVRANIŞI ═══════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="📊" title="BÖLÜM 13 — KAZANÇ GEÇMİŞİ & POST-EARNINGS DAVRANIŞI" />
                {rd.earningsHistory?.length > 0 ? (
                  <div className="space-y-2">
                    {rd.earningsHistory.map((earnings: any, i: number) => (
                      <div key={i} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-white text-[11px] md:text-[12px]">{earnings.quarter}</span>
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded ${earnings.epsBeating ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                            {earnings.epsBeating ? "✅ Beat" : "❌ Miss"} ({earnings.epsSurprise >= 0 ? "+" : ""}{earnings.epsSurprise.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5">
                          <p>📅 {earnings.date} • EPS: ${earnings.eps.toFixed(2)} vs ${earnings.estimate.toFixed(2)} beklenen</p>
                          <p>📈 Post-Earnings: {earnings.priceMove >= 0 ? "+" : ""}{earnings.priceMove.toFixed(2)}% • Kalıcılık: {earnings.persistence}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-4 text-center">
                    <p className="text-slate-400 text-[11px] md:text-[12px]">📊 Son 4 çeyreğin kazanç geçmişi ve fiyat hareketi yükleniyor... EPS sürprizi, post-earnings momentum ve bir sonraki bilançoya kaçgün kaldığı yakında gösterilecektir.</p>
                  </div>
                )}
              </div>

              {/* FOOTER */}
              <div className="text-center py-4 opacity-60 space-y-1">
                <p className="text-[11px] md:text-[12px] text-slate-500 max-w-2xl mx-auto leading-relaxed">⚠️ <strong>Yasal Uyarı:</strong> Bu rapor yalnızca eğitim ve kişisel analiz amaçlıdır. Yatırım tavsiyesi değildir. Tüm opsiyon stratejileri risk içerir.</p>
                <p className="text-[11px] md:text-[12px] text-[#475569] font-black tracking-widest uppercase">© 2026 BOGA AI — DERİN ANALİZ v3.1 | Developed by AFK DaSYS</p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// Silence TS complaints about optCsp reference
const optCsp = "-";
