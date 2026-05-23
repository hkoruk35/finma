"use client";

import { useRef, useState } from "react";

interface DeepAnalysisReportProps {
  ticker: string;
  stockData: any;
  onClose: () => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 1 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : score === 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-rose-500/20 text-rose-300 border-rose-500/40";
  const label = score >= 1 ? "✅ EVET" : score === 0 ? "🔍 ORTA" : "❌ HAYIR";
  return <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${color}`}>{label}</span>;
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xl">{icon}</span>
      <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
      <div className="flex-1 h-px bg-gradient-to-r from-[#3b82f6]/40 to-transparent" />
    </div>
  );
}

export default function DeepAnalysisReport({ ticker, stockData, onClose }: DeepAnalysisReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [fetchStarted, setFetchStarted] = useState(false);

  // Start fetch on first render
  if (!fetchStarted) {
    setFetchStarted(true);
    fetch("/api/deep-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, stockData }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#070b12",
        logging: false,
        windowWidth: 900,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`BOGA_DERIN_ANALIZ_${ticker.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `BOGA AI Derin Analiz — ${ticker.toUpperCase()}`,
        text: `${ticker.toUpperCase()} için BOGA AI Derin Analiz & Forecast raporu hazırlandı.`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert("Bağlantı kopyalandı!");
      });
    }
  };

  const s = stockData || {};
  const pr = s.price || {};
  const currentPrice = pr.current || 0;
  const companyName = s.company || ticker;
  const sector = s.sector || "N/A";

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#070b12] border-b border-[#1e3a5f] shadow-xl shadow-blue-500/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#06b6d4] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-black text-white uppercase tracking-widest">BOGA AI — DERİN ANALİZ RAPORU</div>
            <div className="text-[10px] text-[#06b6d4] font-bold tracking-wider">{ticker.toUpperCase()} • {companyName} • ${currentPrice.toFixed(2)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && data && (
            <>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 text-[11px] font-black uppercase tracking-wider transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Paylaş
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#f59e0b] hover:bg-[#f59e0b]/20 text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {exportingPdf ? (
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                PDF Kaydet
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-[#1e2a3a] hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#070b12]">
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#06b6d4] flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-black text-sm uppercase tracking-widest">Derin Analiz Hazırlanıyor</p>
              <p className="text-[#06b6d4] text-xs mt-1 font-bold">BOGA AI — {ticker.toUpperCase()} için 15 günlük forecast ve opsiyon matrisi üretiliyor...</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-[#3b82f6] animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-4xl">⚠️</div>
            <p className="text-rose-400 font-black text-sm">Analiz yüklenemedi</p>
            <p className="text-slate-400 text-xs">{error}</p>
            <button onClick={onClose} className="mt-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-rose-500/20 transition-all">Kapat</button>
          </div>
        )}

        {!loading && !error && data && (
          <div ref={reportRef} className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">

            {/* REPORT HEADER */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d1b2e] via-[#0a1628] to-[#070b12] border border-[#1e3a5f] p-6 md:p-8 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1d4ed820_0%,_transparent_60%)]" />
              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">{ticker.toUpperCase()}</h1>
                      <span className="text-lg text-[#64748b] font-bold">{companyName}</span>
                    </div>
                    <p className="text-xs font-mono text-[#06b6d4] tracking-widest uppercase mt-2">{sector} • DERİN ANALİZ & 15G FORECAST • {new Date().toLocaleDateString("tr-TR")}</p>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">BOGA AI — Cash-Secured PUT / Covered CALL Opsiyon Stratejisi</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="text-3xl font-black text-white font-mono">${currentPrice.toFixed(2)}</div>
                    <div className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#06b6d4] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
                      BOGA SKOR: {data.rawData.masterScore}/100
                    </div>
                  </div>
                </div>

                {/* Quick stats bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  {[
                    { label: "RSI (14)", value: data.rawData.rsi.toFixed(1), color: data.rawData.rsi > 70 ? "text-rose-400" : data.rawData.rsi < 30 ? "text-emerald-400" : "text-amber-400" },
                    { label: "ATR (Günlük)", value: "$" + data.rawData.atr.toFixed(2), color: "text-[#06b6d4]" },
                    { label: "EMA 20", value: "$" + data.rawData.ema20.toFixed(2), color: currentPrice > data.rawData.ema20 ? "text-emerald-400" : "text-rose-400" },
                    { label: "IV Rank (est.)", value: data.analysis.opsiyonAnaliz.ivRank + "/100", color: data.analysis.opsiyonAnaliz.ivRank > 50 ? "text-emerald-400" : data.analysis.opsiyonAnaliz.ivRank > 25 ? "text-amber-400" : "text-rose-400" },
                  ].map(item => (
                    <div key={item.label} className="bg-[#0d1321]/80 border border-[#1e3a5f]/60 rounded-xl p-3">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{item.label}</div>
                      <div className={`text-base font-black mt-1 font-mono ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 1: DNA */}
            <div className="bg-[#0a0f1a] border border-[#1e3a5f]/70 rounded-2xl p-5 md:p-6 space-y-4">
              <SectionTitle icon="🧬" title="HİSSE DNA & KARAKTERİSTİK ANALİZİ" />
              <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4">
                <p className="text-sm text-[#e2e8f0] leading-relaxed font-medium">{data.analysis.dna.hisseTipi}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "📈 Yükseliş Karakteri", value: data.analysis.dna.yukselisKarakteri, color: "border-emerald-500/30 bg-emerald-500/5" },
                  { label: "📉 Düşüş Karakteri", value: data.analysis.dna.dususKarakteri, color: "border-rose-500/30 bg-rose-500/5" },
                  { label: "📊 Hacim Tepkisi", value: data.analysis.dna.hacimTepkisi, color: "border-blue-500/30 bg-blue-500/5" },
                  { label: "📰 Haber Etkisi", value: data.analysis.dna.haberEtkisi, color: "border-amber-500/30 bg-amber-500/5" },
                ].map(item => (
                  <div key={item.label} className={`border rounded-xl p-3 ${item.color}`}>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{item.label}</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2: TECHNICAL */}
            <div className="bg-[#0a0f1a] border border-[#1e3a5f]/70 rounded-2xl p-5 md:p-6 space-y-4">
              <SectionTitle icon="📏" title="TEKNİK YAPI & MOMENTUM ANALİZİ" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4">
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">Trend Durumu</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{data.analysis.teknikYorum.trendDurumu}</p>
                  </div>
                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4">
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">Momentum & RSI</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{data.analysis.teknikYorum.momentumYorumu}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4">
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">Kritik Seviyeler</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{data.analysis.teknikYorum.kritikSeviyeler}</p>
                  </div>
                  <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4">
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-widest mb-2">Volatilite</div>
                    <p className="text-xs text-slate-200 leading-relaxed">{data.analysis.teknikYorum.volatilite}</p>
                  </div>
                </div>
              </div>

              {/* EMA stack */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "EMA 20", val: data.rawData.ema20, above: currentPrice > data.rawData.ema20 },
                  { label: "EMA 50", val: data.rawData.ema50, above: currentPrice > data.rawData.ema50 },
                  { label: "EMA 200", val: data.rawData.ema200, above: currentPrice > data.rawData.ema200 },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border p-3 flex flex-col gap-1 ${item.above ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{item.label}</div>
                    <div className="text-sm font-black font-mono text-white">${item.val.toFixed(2)}</div>
                    <div className={`text-[9px] font-black uppercase tracking-wider ${item.above ? "text-emerald-400" : "text-rose-400"}`}>
                      {item.above ? "▲ Üstünde" : "▼ Altında"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Support / Resistance */}
              <div className="relative h-12 bg-[#0d1321] border border-[#1e3a5f]/40 rounded-xl overflow-hidden flex items-center px-4">
                <div className="absolute left-4 text-[10px] font-black text-rose-400">Destek ${data.rawData.support1.toFixed(2)}</div>
                <div className="absolute right-4 text-[10px] font-black text-emerald-400">Direnç ${data.rawData.resistance1.toFixed(2)}</div>
                <div className="absolute inset-y-0 w-1 bg-[#f59e0b] rounded-full"
                  style={{ left: `${Math.min(90, Math.max(10, ((currentPrice - data.rawData.support1) / (data.rawData.resistance1 - data.rawData.support1)) * 100))}%` }}
                />
              </div>
            </div>

            {/* SECTION 3: 15-DAY FORECAST */}
            <div className="bg-[#0a0f1a] border border-[#1e3a5f]/70 rounded-2xl p-5 md:p-6 space-y-4">
              <SectionTitle icon="🔮" title="15 GÜNLÜK FORECAST TABLOSU" />
              <div className="overflow-x-auto rounded-xl">
                <table className="w-full text-[11px] border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-[#0d1321] border-b border-[#1e3a5f]/60">
                      <th className="px-3 py-2.5 text-left font-black text-[#06b6d4] uppercase tracking-wider w-10">Gün</th>
                      <th className="px-3 py-2.5 text-right font-black text-rose-400 uppercase tracking-wider">🐻 Bear</th>
                      <th className="px-3 py-2.5 text-right font-black text-amber-400 uppercase tracking-wider">⚖️ Base</th>
                      <th className="px-3 py-2.5 text-right font-black text-emerald-400 uppercase tracking-wider">🚀 Bull</th>
                      <th className="px-3 py-2.5 text-left font-black text-slate-400 uppercase tracking-wider hidden sm:table-cell">Sinyal</th>
                      <th className="px-3 py-2.5 text-left font-black text-[#3b82f6] uppercase tracking-wider hidden md:table-cell">Eylem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.analysis.forecast15.map((row: any, i: number) => (
                      <tr key={i} className={`border-b border-[#1e3a5f]/20 transition-colors ${i % 2 === 0 ? "bg-[#0a0f1a]" : "bg-[#0d1321]/40"} hover:bg-[#1e3a5f]/20`}>
                        <td className="px-3 py-2.5 font-black text-slate-300">G+{row.gun}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-rose-400 font-mono">${(+row.bear).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-black text-amber-300 font-mono">${(+row.base).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-400 font-mono">${(+row.bull).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">{row.teknikSinyal}</td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                            row.eylemOnerisi?.includes("CSP") ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                            row.eylemOnerisi?.includes("CC") ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                            "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                          }`}>{row.eylemOnerisi}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Scenario summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                {[
                  { key: "bear", label: "🐻 Bear Senaryo", color: "border-rose-500/40 bg-rose-500/5 text-rose-400", pct: data.analysis.scenarioOzeti.bear.olasilik, target: data.analysis.scenarioOzeti.bear.hedef, trigger: data.analysis.scenarioOzeti.bear.tetikleyici },
                  { key: "base", label: "⚖️ Base Senaryo", color: "border-amber-500/40 bg-amber-500/5 text-amber-400", pct: data.analysis.scenarioOzeti.base.olasilik, target: data.analysis.scenarioOzeti.base.hedef, trigger: data.analysis.scenarioOzeti.base.tetikleyici },
                  { key: "bull", label: "🚀 Bull Senaryo", color: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400", pct: data.analysis.scenarioOzeti.bull.olasilik, target: data.analysis.scenarioOzeti.bull.hedef, trigger: data.analysis.scenarioOzeti.bull.tetikleyici },
                ].map(item => (
                  <div key={item.key} className={`border rounded-xl p-3 ${item.color}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                      <span className="text-sm font-black">%{item.pct}</span>
                    </div>
                    <div className="text-lg font-black font-mono text-white">${(+item.target).toFixed(2)}</div>
                    <p className="text-[9px] text-slate-400 mt-1 font-medium">{item.trigger}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 4: OPTIONS MATRIX */}
            <div className="bg-[#0a0f1a] border border-[#1e3a5f]/70 rounded-2xl p-5 md:p-6 space-y-4">
              <SectionTitle icon="⚙️" title="OPSİYON & PRİM HASAT MATRİSİ" />

              {/* IV Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "IV (Est.)", value: data.rawData.iv + "%", color: "text-[#06b6d4]" },
                  { label: "IV Rank", value: data.analysis.opsiyonAnaliz.ivRank + "/100", color: +data.analysis.opsiyonAnaliz.ivRank > 50 ? "text-emerald-400" : +data.analysis.opsiyonAnaliz.ivRank > 25 ? "text-amber-400" : "text-rose-400" },
                  { label: "CSP Strike (Opt.)", value: "$" + data.analysis.opsiyonAnaliz.optimalCSPStrike, color: "text-emerald-400" },
                  { label: "CC Strike (Opt.)", value: "$" + data.analysis.opsiyonAnaliz.optimalCCStrike, color: "text-blue-400" },
                ].map(item => (
                  <div key={item.label} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{item.label}</div>
                    <div className={`text-lg font-black font-mono mt-1 ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* CSP Strategy */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🟢</span>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Cash-Secured PUT (CSP)</div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{data.analysis.opsiyonAnaliz.cspStrateji}</p>
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-emerald-500/15">
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Optimal Strike</div>
                      <div className="text-sm font-black text-emerald-400 font-mono">${data.analysis.opsiyonAnaliz.optimalCSPStrike}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">DTE Önerisi</div>
                      <div className="text-sm font-black text-emerald-400">14-21 Gün</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Delta Hedef</div>
                      <div className="text-sm font-black text-emerald-400">Δ 0.20–0.30</div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-500/5 border border-blue-500/25 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔵</span>
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Covered CALL (CC)</div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{data.analysis.opsiyonAnaliz.ccStrateji}</p>
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-blue-500/15">
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Optimal Strike</div>
                      <div className="text-sm font-black text-blue-400 font-mono">${data.analysis.opsiyonAnaliz.optimalCCStrike}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">DTE Önerisi</div>
                      <div className="text-sm font-black text-blue-400">14-21 Gün</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Delta Hedef</div>
                      <div className="text-sm font-black text-blue-400">Δ 0.25–0.35</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Getiri tahminleri */}
              <div className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-4">
                <div className="text-[10px] font-black text-[#06b6d4] uppercase tracking-wider mb-3">Pasif Gelir Tahmini</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Haftalık Prim</div>
                    <div className="text-base font-black text-[#06b6d4]">{data.analysis.opsiyonAnaliz.haftalikPrimTahmin}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Yıllık Getiri (Est.)</div>
                    <div className="text-base font-black text-emerald-400">{data.analysis.opsiyonAnaliz.yillikGetiriTahmin}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase">IV Durumu</div>
                    <div className="text-sm font-black text-amber-400 leading-tight">{data.analysis.opsiyonAnaliz.ivDurumu}</div>
                  </div>
                </div>
              </div>

              {/* Wheel Strategy */}
              <div className="bg-[#0d1321]/40 border border-[#1e3a5f]/30 rounded-xl p-4">
                <div className="text-[10px] font-black text-[#06b6d4] uppercase tracking-wider mb-3">🔁 Wheel Stratejisi Döngüsü</div>
                <div className="flex items-center gap-2 flex-wrap text-[10px] font-black uppercase tracking-wider">
                  {["CSP SAT", "→", "ATANMADI?", "→", "PRİM KÂR / TEKRAR CSP", "→", "ATANDI?", "→", "CC SAT", "→", "TEKRAR CSP"].map((step, i) => (
                    <span key={i} className={step === "→" ? "text-slate-600" : "px-2 py-1 rounded-lg bg-[#1e3a5f]/40 text-[#06b6d4] border border-[#1e3a5f]/60"}>{step}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 5: CHECKLIST */}
            <div className="bg-[#0a0f1a] border border-[#1e3a5f]/70 rounded-2xl p-5 md:p-6 space-y-3">
              <SectionTitle icon="📋" title="STRATEJİK UYGUNLUK ÇEK LİSTESİ" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "Trend yapısı güçlü mü?", score: data.analysis.ceklistSkorlar.trendYapisi },
                  { label: "IV Rank > 30 (prim satış uygun)?", score: data.analysis.ceklistSkorlar.ivUygun },
                  { label: "Kritik destek üzerinde mi?", score: data.analysis.ceklistSkorlar.destekGucu },
                  { label: "RSI 40-70 arasında mı?", score: data.analysis.ceklistSkorlar.momentumGuclu },
                  { label: "EMA 20 üzerinde mi?", score: currentPrice > data.rawData.ema20 ? 1 : -1 },
                  { label: "EMA 50 üzerinde mi?", score: currentPrice > data.rawData.ema50 ? 1 : 0 },
                  { label: "BOGA Skor ≥ 60?", score: data.rawData.masterScore >= 60 ? 1 : data.rawData.masterScore >= 45 ? 0 : -1 },
                  { label: "ATR volatilite uygun mu?", score: data.rawData.atr / currentPrice < 0.05 ? 1 : data.rawData.atr / currentPrice < 0.08 ? 0 : -1 },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#0d1321]/50 border border-[#1e3a5f]/30 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-slate-300 font-medium">{item.label}</span>
                    <ScoreBadge score={item.score} />
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 6: CONCLUSION */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1b2e] to-[#070b12] border border-[#1e3a5f] p-5 md:p-6 space-y-4">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#06b6d415_0%,_transparent_60%)]" />
              <div className="relative">
                <SectionTitle icon="🏁" title="SONUÇ & KARAR ÖZETİ" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Genel Puan", value: data.analysis.sonucKarar.genelPuan + "/10", color: +data.analysis.sonucKarar.genelPuan >= 7 ? "text-emerald-400" : +data.analysis.sonucKarar.genelPuan >= 5 ? "text-amber-400" : "text-rose-400" },
                    { label: "CSP Uygunluğu", value: data.analysis.sonucKarar.cspUygunlugu, color: data.analysis.sonucKarar.cspUygunlugu === "GÜÇLÜ" ? "text-emerald-400" : data.analysis.sonucKarar.cspUygunlugu === "ORTA" ? "text-amber-400" : "text-rose-400" },
                    { label: "CC Uygunluğu", value: data.analysis.sonucKarar.ccUygunlugu, color: data.analysis.sonucKarar.ccUygunlugu === "GÜÇLÜ" ? "text-emerald-400" : data.analysis.sonucKarar.ccUygunlugu === "ORTA" ? "text-amber-400" : "text-rose-400" },
                    { label: "15G Görünüm", value: data.rawData.masterScore >= 60 ? "YUKSELIŞ" : data.rawData.masterScore >= 45 ? "YATAY" : "DÜŞÜŞ", color: data.rawData.masterScore >= 60 ? "text-emerald-400" : data.rawData.masterScore >= 45 ? "text-amber-400" : "text-rose-400" },
                  ].map(item => (
                    <div key={item.label} className="bg-[#0d1321]/60 border border-[#1e3a5f]/40 rounded-xl p-3">
                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{item.label}</div>
                      <div className={`text-sm font-black mt-1 ${item.color}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0d1321]/60 border border-[#06b6d4]/20 rounded-xl p-4 space-y-3">
                  <div>
                    <div className="text-[9px] font-black text-[#06b6d4] uppercase tracking-wider mb-1">Öneri</div>
                    <p className="text-sm text-white font-bold leading-relaxed">{data.analysis.sonucKarar.oneri}</p>
                  </div>
                  <div className="border-t border-[#1e3a5f]/40 pt-3">
                    <div className="text-[9px] font-black text-rose-400 uppercase tracking-wider mb-1">⚠️ Kritik Risk</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{data.analysis.sonucKarar.kritikRisk}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="text-center py-4 space-y-1 opacity-60">
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
                ⚠️ <strong>Yasal Uyarı:</strong> Bu rapor yalnızca eğitim ve kişisel analiz amaçlıdır. Yatırım tavsiyesi değildir. Tüm opsiyon stratejileri risk içerir.
              </p>
              <p className="text-[9px] text-[#475569] font-black tracking-widest uppercase">© 2026 BOGA AI — DERİN ANALİZ v1.0 | Developed by AFK DaSYS</p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
