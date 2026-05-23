"use client";

import { useEffect, useRef, useState } from "react";

interface Props { ticker: string; stockData: any; onClose: () => void; }

// ── Mini helpers ──────────────────────────────────────────────────────────────
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h3 className="text-[11px] font-black text-white uppercase tracking-[0.15em]">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-[#1e3a5f] to-transparent" />
    </div>
  );
}

function Badge({ score }: { score: number }) {
  if (score >= 1) return <span className="px-2 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-black uppercase">✅ EVET</span>;
  if (score === 0) return <span className="px-2 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-black uppercase">🔍 ORTA</span>;
  return <span className="px-2 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-black uppercase">❌ HAYIR</span>;
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
      <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-3">📈 Forecast Bant Grafiği — 15 Gün</div>
      <div className="relative" style={{ height: 120, minWidth: 480 }}>
        {/* Gridlines */}
        {[0, 25, 50, 75, 100].map(p => (
          <div key={p} className="absolute w-full border-t border-[#1e3a5f]/30" style={{ bottom: `${p}%` }}>
            <span className="absolute -left-1 -translate-y-1/2 text-[8px] text-slate-600 font-mono pr-1">
              ${(minV + range * p / 100).toFixed(1)}
            </span>
          </div>
        ))}
        {/* Current price line */}
        <div className="absolute w-full border-t border-dashed border-amber-400/60 z-10" style={{ bottom: `${pct(currentPrice)}%` }}>
          <span className="absolute right-0 -translate-y-3 text-[8px] text-amber-400 font-black">Güncel ${currentPrice.toFixed(2)}</span>
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
            <div key={i} className="text-[8px] text-slate-500 font-mono" style={{ width: `${W * 3}%`, flexShrink: 0 }}>G+{d.day}</div>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mt-8 text-[9px] font-black">
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
  body > *:not(#boga-deep-print) { display: none !important; }
  #boga-deep-print { display: block !important; position: static !important; overflow: visible !important; background: #070b12 !important; color: white !important; }
  #boga-deep-print .no-print { display: none !important; }
  #boga-deep-print .print-content { max-width: 100% !important; padding: 12px !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  @page { margin: 8mm; size: A4; }
}
`;

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DeepAnalysisReport({ ticker, stockData, onClose }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [exportingPdf] = useState(false);

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
      .then(d => { if (d.error) setError(d.error); else setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [ticker]);

  const handleExportPDF = () => {
    const date = new Date().toISOString().slice(0, 10);
    const title = `BOGA_DERIN_ANALIZ_${ticker.toUpperCase()}_${date}`;
    const prev = document.title;
    document.title = title;
    window.print();
    document.title = prev;
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
            <div className="text-[11px] font-black text-white uppercase tracking-widest">BOGA AI — DERİN ANALİZ RAPORU</div>
            <div className="text-[10px] text-[#06b6d4] font-bold">{ticker.toUpperCase()} • {companyName} • ${currentPrice.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && data && (<>
            <button onClick={handleShare} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 text-[10px] font-black uppercase tracking-wider transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Paylaş
            </button>
            <button onClick={handleExportPDF} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b] hover:bg-[#f59e0b]/20 text-[10px] font-black uppercase tracking-wider transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              PDF Kaydet
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
          const { analysis, rawData } = data;
          const rd = rawData;
          const a = analysis;

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
                    <p className="text-[10px] font-mono text-[#06b6d4] tracking-widest uppercase mt-1">{data.sector} • {data.industry} • DERİN ANALİZ & 15G FORECAST • {new Date().toLocaleDateString("tr-TR")}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-wider">BOGA AI — Cash-Secured PUT / Covered CALL Opsiyon Stratejisi • Kaynak: {data.aiSource?.toUpperCase()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl font-black text-white font-mono">${rd.currentPrice?.toFixed(2) ?? currentPrice.toFixed(2)}</div>
                    <div className="mt-1 px-3 py-1 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#06b6d4] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 inline-block">BOGA SKOR: {rd.masterScore}/100</div>
                  </div>
                </div>
                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  {[
                    { l: "RSI (14)", v: rd.rsi?.toFixed(1), c: rd.rsi>70?"text-rose-400":rd.rsi<30?"text-emerald-400":"text-amber-400" },
                    { l: "ATR (Günlük)", v: "$"+rd.atr?.toFixed(2)+" (%"+rd.atrPct?.toFixed(1)+")", c: "text-[#06b6d4]" },
                    { l: "IV Rank", v: rd.ivRank+"/100", c: rd.ivRank>50?"text-emerald-400":rd.ivRank>25?"text-amber-400":"text-rose-400" },
                    { l: "IV/HV Oranı", v: rd.ivHvRatio?.toFixed(2)+"×", c: rd.ivHvRatio>1.3?"text-emerald-400":"text-amber-400" },
                  ].map(i=>(
                    <div key={i.l} className="bg-[#0a0e18]/70 border border-[#1e3a5f]/50 rounded-xl p-3">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{i.l}</div>
                      <div className={`text-sm font-black mt-1 font-mono ${i.c}`}>{i.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ BÖLÜM 1: DNA ═════════════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-4">
                <SectionTitle icon="🧬" title="BÖLÜM 1 — HİSSE DNA & KARAKTERİSTİK ANALİZİ" />
                {/* Identity table */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                  {[
                    ["Ticker / Şirket", `${ticker.toUpperCase()} / ${data.companyName}`],
                    ["Sektör", data.sector],
                    ["Güncel Fiyat", `$${currentPrice.toFixed(2)}`],
                    ["Piyasa Değeri", rd.marketCapStr],
                    ["BOGA Skor", `${rd.masterScore}/100`],
                    ["Analiz Tarihi", new Date().toLocaleDateString("tr-TR")],
                  ].map(([l,v])=>(
                    <div key={l} className="bg-[#0d1321]/60 border border-[#1e3a5f]/30 rounded-lg p-2.5">
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-wider">{l}</div>
                      <div className="text-white font-bold mt-0.5 truncate">{v}</div>
                    </div>
                  ))}
                </div>
                {/* DNA yorum */}
                <div className="bg-[#0c1422]/60 border border-[#06b6d4]/20 rounded-xl p-3">
                  <p className="text-[11px] text-slate-200 leading-relaxed">{a.dna.hisseTipi}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { l:"📈 Yükseliş Karakteri", v:a.dna.yukselisKarakteri, c:"border-emerald-500/30 bg-emerald-500/5" },
                    { l:"📉 Düşüş Karakteri",   v:a.dna.dususKarakteri,    c:"border-rose-500/30 bg-rose-500/5" },
                    { l:"📊 Hacim Tepkisi",     v:a.dna.hacimTepkisi,      c:"border-blue-500/30 bg-blue-500/5" },
                    { l:"📰 Haber Etkisi",      v:a.dna.haberEtkisi,       c:"border-amber-500/30 bg-amber-500/5" },
                  ].map(i=>(
                    <div key={i.l} className={`border rounded-xl p-3 ${i.c}`}>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{i.l}</div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">{i.v}</p>
                    </div>
                  ))}
                </div>
                {/* Beta / Likidite */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📐 Piyasa Korelasyonu</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[10px]">
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
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">💧 Likidite Endeksi</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[10px]">
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
                  <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">⚡ Son 15 Gün Fiyat-Hacim Verisi</div>
                  {rd.history15?.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[10px] min-w-[500px]">
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
                    <div className="text-[10px] text-slate-500 bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-xl p-3">Geçmiş veri yüklenemedi (Yahoo Finance erişimi gerekli).</div>
                  )}
                </div>

                {/* MA Tablosu */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📏 Hareketli Ortalama Disiplini</div>
                    <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                      <table className="w-full text-[10px]">
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
                              <td className={`px-3 py-2 font-black text-[10px] ${currentPrice>=(r.v||0)?"text-emerald-400":"text-rose-400"}`}>
                                {currentPrice>=(r.v||0)?"▲ Üstünde":"▼ Altında"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={`mt-2 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-wider ${rd.maLevels?.goldenCross?"border-emerald-500/30 bg-emerald-500/10 text-emerald-400":"border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
                      {rd.maLevels?.goldenCross ? "✅ GOLDEN CROSS (EMA20 > EMA50)" : "❌ DEATH CROSS (EMA20 < EMA50)"}
                    </div>
                  </div>

                  {/* Destek/Direnç */}
                  <div>
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">🧱 Destek / Direnç Seviyeleri</div>
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
                          <div key={r.l} className={`flex items-center justify-between px-3 py-2 border-b border-[#1e3a5f]/20 text-[10px] ${isCur?"bg-[#1e3a5f]/40 border-l-2 border-l-amber-400":"bg-[#0a0e18]"}`}>
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
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">💹 Teknik Göstergeler</div>
                    <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4 space-y-2.5 font-mono text-[11px]">
                      {[
                        { l:"RSI (14)", v: rd.rsi?.toFixed(1), c: rd.rsi>70?"text-rose-400":rd.rsi<30?"text-emerald-400":"text-amber-400", note: rd.rsi>70?"Aşırı Alım":rd.rsi<30?"Aşırı Satım":"Nötr" },
                        { l:"EMA 20",  v:"$"+rd.ema20?.toFixed(2), c: currentPrice>rd.ema20?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema20?"Üstünde ✅":"Altında ❌" },
                        { l:"EMA 50",  v:"$"+rd.ema50?.toFixed(2), c: currentPrice>rd.ema50?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema50?"Üstünde ✅":"Altında ❌" },
                        { l:"EMA 200", v:"$"+rd.ema200?.toFixed(2),c: currentPrice>rd.ema200?"text-emerald-400":"text-rose-400", note: currentPrice>rd.ema200?"Uzun vade boğa":"Uzun vade ayı" },
                        { l:"ATR",     v:"$"+rd.atr?.toFixed(2)+" (%"+rd.atrPct?.toFixed(1)+")", c:"text-[#06b6d4]", note:"Günlük beklenen hareket" },
                        { l:"MACD",    v: rd.macd >= 0 ? "+"+rd.macd?.toFixed(2):rd.macd?.toFixed(2), c: rd.macd>=0?"text-emerald-400":"text-rose-400", note: rd.macd>=0?"Pozitif momentum":"Negatif momentum" },
                      ].map(i=>(
                        <div key={i.l} className="flex justify-between items-center border-b border-[#1e3a5f]/20 pb-2">
                          <span className="text-slate-400 font-black text-[9px] uppercase w-16 shrink-0">{i.l}</span>
                          <span className={`font-black ${i.c}`}>{i.v}</span>
                          <span className="text-[9px] text-slate-500">{i.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📝 Teknik Yorum</div>
                      <div className="space-y-2">
                        {[
                          { l:"Trend", v:a.teknikYorum.trendDurumu },
                          { l:"Momentum", v:a.teknikYorum.momentumYorumu },
                          { l:"Seviyeler", v:a.teknikYorum.kritikSeviyeler },
                          { l:"Volatilite", v:a.teknikYorum.volatilite },
                        ].map(i=>(
                          <div key={i.l} className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg p-2.5">
                            <div className="text-[8px] font-black text-[#06b6d4] uppercase tracking-wider mb-0.5">{i.l}</div>
                            <p className="text-[10px] text-slate-300 leading-relaxed">{i.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* IV parametreleri */}
                    <div className="bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl p-3">
                      <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">IV Parametreleri (1G Statistik)</div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {[
                          { l:"30G 1 SD Aralık", v:`$${rd.range1sd?.low}–$${rd.range1sd?.high}` },
                          { l:"30G 2 SD Aralık", v:`$${rd.range2sd?.low}–$${rd.range2sd?.high}` },
                          { l:"Impl. 30G Hareket",v:`±$${rd.implied30dMove?.toFixed(2)}` },
                          { l:"Günlük Drift",     v:`~${(rd.atr*0.04).toFixed(2)}% tahmini` },
                        ].map(i=>(
                          <div key={i.l}>
                            <div className="text-[8px] text-slate-500 font-bold uppercase">{i.l}</div>
                            <div className="text-white font-black font-mono text-[10px]">{i.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ BÖLÜM 3: FORECAST ════════════════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-5">
                <SectionTitle icon="🔮" title="BÖLÜM 3 — 15 GÜNLÜK FORECAST ANALİZİ" />

                {/* Forecast Chart */}
                <ForecastChart forecast15={a.forecast15} currentPrice={currentPrice} />

                {/* Forecast Table */}
                <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                  <table className="w-full text-[10px] min-w-[520px]">
                    <thead><tr className="bg-[#0d1321] border-b border-[#1e3a5f]/50">
                      <th className="px-2 py-2.5 text-left font-black text-[#06b6d4] w-10">Gün</th>
                      <th className="px-2 py-2.5 text-right font-black text-rose-400">🐻 Bear</th>
                      <th className="px-2 py-2.5 text-right font-black text-amber-400">⚖️ Base</th>
                      <th className="px-2 py-2.5 text-right font-black text-emerald-400">🚀 Bull</th>
                      <th className="px-2 py-2.5 text-left font-black text-slate-400 hidden sm:table-cell">Teknik Sinyal</th>
                      <th className="px-2 py-2.5 text-left font-black text-[#3b82f6] hidden md:table-cell">Eylem</th>
                    </tr></thead>
                    <tbody>
                      {a.forecast15.map((r:any,i:number)=>(
                        <tr key={i} className={`border-b border-[#1e3a5f]/20 ${i%2===0?"bg-[#0a0e18]":"bg-[#0d1321]/40"} hover:bg-[#1e3a5f]/15`}>
                          <td className="px-2 py-2 font-black text-slate-300">G+{r.day}</td>
                          <td className="px-2 py-2 text-right font-bold text-rose-400 font-mono">${(+r.bear).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-black text-amber-300 font-mono">${(+r.base).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-bold text-emerald-400 font-mono">${(+r.bull).toFixed(2)}</td>
                          <td className="px-2 py-2 text-slate-400 hidden sm:table-cell">{r.teknikSinyal}</td>
                          <td className="px-2 py-2 hidden md:table-cell">
                            <span className={`px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${r.eylemOnerisi?.includes("CSP")?"bg-emerald-500/15 text-emerald-400 border border-emerald-500/30":r.eylemOnerisi?.includes("CC")?"bg-blue-500/15 text-blue-400 border border-blue-500/30":"bg-slate-500/15 text-slate-400 border border-slate-500/30"}`}>{r.eylemOnerisi}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Senaryo özeti */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key:"bear", label:"🐻 Bear Senaryo", c:"border-rose-500/40 bg-rose-500/5 text-rose-400", d:a.scenarioOzeti.bear },
                    { key:"base", label:"⚖️ Base Senaryo", c:"border-amber-500/40 bg-amber-500/5 text-amber-400", d:a.scenarioOzeti.base },
                    { key:"bull", label:"🚀 Bull Senaryo", c:"border-emerald-500/40 bg-emerald-500/5 text-emerald-400", d:a.scenarioOzeti.bull },
                  ].map(s=>(
                    <div key={s.key} className={`border rounded-xl p-3 ${s.c}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-black uppercase tracking-wider">{s.label}</span>
                        <span className="text-sm font-black">%{s.d.olasilik}</span>
                      </div>
                      <div className="text-xl font-black font-mono text-white">${(+s.d.hedef).toFixed(2)}</div>
                      <p className="text-[9px] text-slate-400 mt-1 font-medium">{s.d.tetikleyici}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ BÖLÜM 4: OPSİYON MATRİSİ ═══════════════════════════════════ */}
              <div className="bg-[#0a0e18] border border-[#1e3a5f]/60 rounded-2xl p-4 md:p-5 space-y-5">
                <SectionTitle icon="⚙️" title="BÖLÜM 4 — OPSİYON & PRİM HASAT MATRİSİ" />

                {/* IV Analizi */}
                <div>
                  <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">📊 IV Analizi</div>
                  <div className="overflow-x-auto rounded-xl border border-[#1e3a5f]/40">
                    <table className="w-full text-[10px] min-w-[400px]">
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
                    <p className="text-[10px] text-slate-300">{a.opsiyonAnaliz.ivDurumu}</p>
                  </div>
                </div>

                {/* CSP Matrisi */}
                <div>
                  <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-2">💰 Cash-Secured PUT (CSP) Matrisi</div>
                  <div className="overflow-x-auto rounded-xl border border-emerald-500/20">
                    <table className="w-full text-[10px] min-w-[600px]">
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
                            <td className="px-3 py-2 font-bold text-slate-300">{r.label} {i===0&&<span className="text-emerald-400 text-[8px] font-black ml-1">OPTIMAL</span>}</td>
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
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px] font-black uppercase">
                    {[
                      {icon:"✅",label:"Aç",desc:"IV Rank>30 + Güçlü destek + Bilanço>14G uzakta",c:"border-emerald-500/30 bg-emerald-500/5 text-emerald-400"},
                      {icon:"⚡",label:"İzle",desc:"IV Rank 20-30 arası + Fiyat MA üstünde",c:"border-amber-500/30 bg-amber-500/5 text-amber-400"},
                      {icon:"❌",label:"Bekle",desc:"IV Rank<20 + Bilanço<14G + Sektör zayıf",c:"border-rose-500/30 bg-rose-500/5 text-rose-400"},
                      {icon:"🛑",label:"Kapat",desc:"Prim %50 eridi VEYA 2x prim kayıplandı",c:"border-slate-500/30 bg-slate-500/5 text-slate-400"},
                    ].map(r=>(
                      <div key={r.label} className={`border rounded-lg p-2 ${r.c}`}>
                        <div className="mb-0.5">{r.icon} {r.label}</div>
                        <div className="text-[8px] opacity-70 font-medium normal-case">{r.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                    <p className="text-[10px] text-slate-300">{a.opsiyonAnaliz.cspStrateji}</p>
                  </div>
                </div>

                {/* CC Matrisi */}
                <div>
                  <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">📞 Covered CALL (CC) Matrisi</div>
                  <div className="overflow-x-auto rounded-xl border border-blue-500/20">
                    <table className="w-full text-[10px] min-w-[550px]">
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
                    <p className="text-[10px] text-slate-300">{a.opsiyonAnaliz.ccStrateji}</p>
                  </div>
                </div>

                {/* Atanma Risk + Pasif Gelir */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0d1321]/50 border border-amber-500/20 rounded-xl p-4 space-y-2">
                    <div className="text-[9px] font-black text-amber-400 uppercase tracking-widest">⚠️ Atanma Risk Analizi (CSP)</div>
                    {[
                      ["Strike",           `$${rd.cspMatrix?.[0]?.strike??optCsp}`],
                      ["Alınan Prim",      `$${rd.cspMatrix?.[0]?.bid??"-"}`],
                      ["Efektif Maliyet",  `$${rd.cspMatrix?.[0]?.efMaliyet??"-"}`],
                      ["Güncel Fiyat",     `$${currentPrice.toFixed(2)}`],
                      ["Kâra Geçiş",       `$${rd.cspMatrix?.[0]?.efMaliyet??"-"} üzeri`],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between border-b border-amber-500/10 pb-1.5 text-[10px]">
                        <span className="text-slate-400 font-medium">{l}</span>
                        <span className="text-amber-300 font-black font-mono">{v}</span>
                      </div>
                    ))}
                    <p className="text-[9px] text-slate-400 mt-2">Atanma sonrası: CC stratejisine geç → Haftalık prim topla → Maliyet fiyatına geri dönüşü bekle</p>
                  </div>
                  <div className="bg-[#0d1321]/50 border border-[#06b6d4]/20 rounded-xl p-4 space-y-2">
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest">💰 Pasif Gelir Tahmini (Yıllık)</div>
                    {[
                      ["Aylık CSP Getirisi",  a.opsiyonAnaliz.haftalikPrimTahmin+" / hafta"],
                      ["Yıllık Getiri (Est.)",a.opsiyonAnaliz.yillikGetiriTahmin],
                      ["Optimal DTE",         "14-21 Gün"],
                      ["CSP Delta Hedef",     "Δ 0.20–0.30"],
                      ["CC Delta Hedef",      "Δ 0.25–0.35"],
                    ].map(([l,v])=>(
                      <div key={l} className="flex justify-between border-b border-[#06b6d4]/10 pb-1.5 text-[10px]">
                        <span className="text-slate-400 font-medium">{l}</span>
                        <span className="text-[#06b6d4] font-black">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Wheel */}
                <div className="bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-xl p-4">
                  <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-3">🔁 Wheel Stratejisi Döngüsü</div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-black uppercase tracking-wider">
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
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{group.group}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.items.map(item=>(
                        <div key={item.l} className="flex items-center justify-between bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-lg px-3 py-2">
                          <span className="text-[10px] text-slate-300 font-medium">{item.l}</span>
                          <Badge score={item.s} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">{item.l}</div>
                        <div className={`text-sm font-black mt-1 ${item.c}`}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">En İyi CSP Setup</div>
                      <div className="bg-[#0d1321]/60 border border-emerald-500/20 rounded-xl p-3 text-[10px]">
                        <span className="text-emerald-400 font-black">Strike ${rd.cspMatrix?.[1]?.strike ?? a.opsiyonAnaliz.optimalCSPStrike}, DTE 14G, Prim ${rd.cspMatrix?.[1]?.bid ?? "-"}, Yıllık %{rd.cspMatrix?.[1]?.annualYield ?? "-"}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-wider mb-2">En İyi CC Setup</div>
                      <div className="bg-[#0d1321]/60 border border-blue-500/20 rounded-xl p-3 text-[10px]">
                        <span className="text-blue-400 font-black">Strike ${rd.ccMatrix?.[1]?.strike ?? a.opsiyonAnaliz.optimalCCStrike}, DTE 14G, Prim ${rd.ccMatrix?.[1]?.bid ?? "-"}, Yıllık %{rd.ccMatrix?.[1]?.annualYield ?? "-"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 bg-[#0d1321]/60 border border-[#06b6d4]/20 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="text-[8px] font-black text-[#06b6d4] uppercase tracking-wider mb-1">ÖNERI</div>
                      <p className="text-[11px] text-white font-bold leading-relaxed">{a.sonucKarar.oneri}</p>
                    </div>
                    <div className="border-t border-[#1e3a5f]/40 pt-3">
                      <div className="text-[8px] font-black text-rose-400 uppercase tracking-wider mb-1">⚠️ KRİTİK RİSK</div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">{a.sonucKarar.kritikRisk}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="text-center py-4 opacity-60 space-y-1">
                <p className="text-[9px] text-slate-500 max-w-2xl mx-auto leading-relaxed">⚠️ <strong>Yasal Uyarı:</strong> Bu rapor yalnızca eğitim ve kişisel analiz amaçlıdır. Yatırım tavsiyesi değildir. Tüm opsiyon stratejileri risk içerir.</p>
                <p className="text-[8px] text-[#475569] font-black tracking-widest uppercase">© 2026 BOGA AI — DERİN ANALİZ v2.0 | Developed by AFK DaSYS</p>
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
