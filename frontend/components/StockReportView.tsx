"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Header from "./Header";
import MemberHeader from "./public/MemberHeader";
import dynamic from "next/dynamic";

const DeepAnalysisReport = dynamic(() => import("./DeepAnalysisReport"), { ssr: false });

interface StockReportViewProps {
  ticker: string;
  stockData: any;
  masterData?: any;
  lang?: "tr" | "en";
  autoOpenDeepAnalysis?: boolean;
  /** When set (from a /global/{locale}/ai page), "go home" actions navigate here
   *  instead of just toggling local state — confines the user to the /global area. */
  homeHref?: string;
}

export default function StockReportView({ ticker, stockData, lang = "tr", autoOpenDeepAnalysis = false, homeHref }: StockReportViewProps) {
  // Inline TR/EN translation helper — L("Türkçe", "English") returns the string for the active lang
  const L = (tr: string, en: string) => (lang === "en" ? en : tr);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [showChart, setShowChart] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(autoOpenDeepAnalysis);

  const handleExportPDF = () => {
    setExportingPdf(true);
    const prev = document.title;
    document.title = `BOGA_AI_${ticker.toUpperCase()}_${L("Raporu","Report")}`;

    // Replace <canvas> elements with static <img> snapshots for print
    const canvases = Array.from(
      document.querySelectorAll<HTMLCanvasElement>("#boga-stock-print canvas")
    );
    const replacements: Array<{ canvas: HTMLCanvasElement; img: HTMLImageElement }> = [];
    canvases.forEach((canvas) => {
      const w = canvas.offsetWidth || canvas.width;
      const h = canvas.offsetHeight || canvas.height;
      if (w < 10 || h < 10) return;
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const img = document.createElement("img");
        img.src = dataUrl;
        img.style.cssText = `width:${w}px;height:${h}px;display:block;max-width:100%;border-radius:8px;page-break-inside:avoid;`;
        canvas.parentElement?.insertBefore(img, canvas);
        canvas.style.display = "none";
        replacements.push({ canvas, img });
      } catch { /* tainted canvas — skip */ }
    });

    setTimeout(() => {
      window.print();
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

  const SYSTEM_THEME_CATEGORIES = [
    "Mega-cap Platform & Cloud",
    "Semiconductors & Hardware",
    "Software & Cloud Applications",
    "Cybersecurity",
    "AI & Data",
    "Infrastructure & Networking",
    "Hardware & Devices",
    "Social & Search",
    "Streaming & Entertainment",
    "Automotive & EV",
    "Travel & Leisure"
  ];

  const [isFullScreen, setIsFullScreen] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Cache anlık kontrol
    try {
      const raw = localStorage.getItem("t_wl");
      if (raw) setInWatchlist(JSON.parse(raw).includes(ticker.toUpperCase()));
    } catch {}
    // API = gerçek kaynak
    fetch("/api/store/watchlist")
      .then(r => r.json())
      .then(({ value }) => {
        if (Array.isArray(value)) setInWatchlist(value.includes(ticker.toUpperCase()));
      }).catch(() => {});
  }, [ticker]);

  // Automatically add to local overrides theme based on industry / sector
  useEffect(() => {
    if (!ticker || !stockData) return;
    const s = stockData;
    const sectorLower = (s.sector || "").toLowerCase();
    const industryLower = (s.industry || "").toLowerCase();
    const t = ticker.toUpperCase();

    let targetTheme = "";
    if (["AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA"].includes(t)) {
      targetTheme = "Mega-cap Platform & Cloud";
    } else if (industryLower.includes("semiconductor")) {
      targetTheme = "Semiconductors & Hardware";
    } else if (industryLower.includes("software") || industryLower.includes("application")) {
      targetTheme = "Software & Cloud Applications";
    } else if (industryLower.includes("cybersecurity") || industryLower.includes("security")) {
      targetTheme = "Cybersecurity";
    } else if (industryLower.includes("data") || industryLower.includes("artificial") || industryLower.includes("ai")) {
      targetTheme = "AI & Data";
    } else if (industryLower.includes("networking") || industryLower.includes("infrastructure")) {
      targetTheme = "Infrastructure & Networking";
    } else if (industryLower.includes("hardware") || industryLower.includes("device") || industryLower.includes("electronics")) {
      targetTheme = "Hardware & Devices";
    } else if (industryLower.includes("social") || industryLower.includes("search") || industryLower.includes("internet")) {
      targetTheme = "Social & Search";
    } else if (industryLower.includes("streaming") || industryLower.includes("entertainment") || industryLower.includes("movie")) {
      targetTheme = "Streaming & Entertainment";
    } else if (industryLower.includes("auto") || industryLower.includes("ev") || industryLower.includes("vehicle")) {
      targetTheme = "Automotive & EV";
    } else if (industryLower.includes("travel") || industryLower.includes("leisure") || industryLower.includes("hotel") || industryLower.includes("airline")) {
      targetTheme = "Travel & Leisure";
    }

    if (targetTheme) {
      (async () => {
        try {
          const res = await fetch("/api/store/theme_overrides");
          const { value } = await res.json();
          const overrides: Record<string, string[]> = value ?? {};
          if (!overrides[targetTheme]) overrides[targetTheme] = [];
          if (!overrides[targetTheme].includes(t)) {
            overrides[targetTheme].push(t);
            try { localStorage.setItem("t_theme_overrides", JSON.stringify(overrides)); } catch {}
            fetch("/api/store/theme_overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: overrides }) }).catch(() => {});
          }
        } catch {}
      })();
    }
  }, [ticker, stockData]);

  const toggleWatchlist = () => {
    let wl: string[] = [];
    try { const raw = localStorage.getItem("t_wl"); if (raw) wl = JSON.parse(raw); } catch {}
    const t = ticker.toUpperCase();
    wl = wl.includes(t) ? wl.filter(x => x !== t) : [...wl, t];
    setInWatchlist(wl.includes(t));
    try { localStorage.setItem("t_wl", JSON.stringify(wl)); } catch {}
    fetch("/api/store/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: wl }) }).catch(() => {});
  };




  // Extract variables safely
  const s = stockData || {};
  const pr = s.price || {};
  const sc = s.scores || {};
  const tech = s.technical || {};
  const fund = s.fundamental || {};
  const sd = s.scores_detail || s.strategy || {};
  
  const mo = s.market_overview || {};
  const sp500ChangeVal = mo.sp500Change;
  const nasdaqChangeVal = mo.nasdaqChange;
  const vixPriceVal = mo.vixPrice;
  const sectorEtfVal = mo.sectorEtf || "N/A";
  const sectorChangeVal = mo.sectorChange;

  const companyName = s.company || `${ticker} Corp.`;
  const sector = s.sector || "General Market";
  const industry = s.industry || "N/A";
  
  const currentPrice = pr.current || 0;
  const prevClose = pr.prev_close || 0;
  const changePct = pr.change_pct || 0;
  const priceDiff = currentPrice - prevClose;

  const low52w = tech["52w_low"] || currentPrice * 0.7;
  const high52w = tech["52w_high"] || currentPrice * 1.3;
  const range52wPercent = Math.min(
    100,
    Math.max(0, ((currentPrice - low52w) / (high52w - low52w)) * 100)
  );

  const masterScore = sc.master_score || 50;
  const signalType = sc.signal_type || "NEUTRAL_STAY";

  // Technical Indicators
  const ema20 = tech.ema_20 || currentPrice * 0.98;
  const ema50 = tech.ema_50 || currentPrice * 0.97;
  const ema200 = tech.ema_200 || currentPrice * 0.95;
  const rsi = tech.rsi_14 || 50;
  const rvol = tech.rvol || 1.0;
  const volume = pr.volume ? (pr.volume / 1e6).toFixed(2) + "M" : "N/A";
  const avgVolume = pr.avg_volume_30d ? (pr.avg_volume_30d / 1e6).toFixed(2) + "M" : "N/A";

  // Support & Resistance
  const support1 = sd.stop_loss || tech.support_level || currentPrice * 0.96;
  const support2 = tech["52w_low"] || currentPrice * 0.90;
  const resistance1 = sd.target_price || tech.resistance_level || currentPrice * 1.08;
  const resistance2 = tech["52w_high"] || currentPrice * 1.15;

  // Plan
  const entryLow = sd.entry_range_low || currentPrice * 0.98;
  const entryHigh = sd.entry_range_high || currentPrice * 1.01;
  const targetLow = sd.target_range_low || currentPrice * 1.10;
  const targetHigh = sd.target_range_high || currentPrice * 1.18;
  const stopLoss = sd.stop_loss || currentPrice * 0.95;
  const riskReward = sd.risk_reward_ratio || 2.5;

  // Safe formatting helpers
  const formatNum = (v: any, dec = 2) => typeof v === "number" ? v.toFixed(dec) : "N/A";
  const formatPct = (v: any) => typeof v === "number" ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : "N/A";

  // TradingView Widget Loader
  useEffect(() => {
    if (!chartContainerRef.current) return;
    chartContainerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker.toUpperCase() === "BOGA" ? "SPY" : ticker.toUpperCase(),
      interval: "W",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "tr",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com"
    });
    chartContainerRef.current.appendChild(script);
  }, [ticker, showChart, isFullScreen, mounted]);

  // Determine alert level & color styling based on BOGA score & technicals
  const isBullish = masterScore >= 65;
  const isBearish = masterScore <= 45;
  
  const scoreRingColor = isBullish 
    ? "stroke-emerald-500" 
    : isBearish 
      ? "stroke-red-500" 
      : "stroke-amber-500";

  const signalBadgeColor = isBullish
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : isBearish
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : "bg-amber-500/10 text-amber-400 border-amber-500/30";

  const reportContent = (
    <div ref={reportRef} id="boga-stock-print" className={`w-full max-w-4xl mx-auto bg-[#0a0e17] rounded-3xl border border-[#1e2a3a]/60 shadow-2xl p-6 md:p-8 space-y-8 text-white select-none relative ${isFullScreen ? "my-4" : ""}`}>
      
      {/* 1. HEADER BLOCK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#1e2a3a]/40 pb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{ticker.toUpperCase()}</h1>
            <span className="text-lg text-slate-400 font-bold">— {companyName}</span>
          </div>
          <p className="text-xs text-[#3b82f6] font-mono tracking-widest uppercase mt-1">
            {L("Swing Trade Analizi","Swing Trade Analysis")} • {L("1G Grafik","1D Chart")} • {sector} — {industry} • {L("Analiz Zamanı","Analysis Time")}: {new Date(s.generated_at || Date.now()).toLocaleString(lang === "en" ? "en-US" : "tr-TR")}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button 
              onClick={toggleWatchlist}
              className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                inWatchlist 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                  : "bg-[#141924] text-slate-300 border-[#1e2a3a] hover:bg-[#1e2a3a] hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" fill={inWatchlist ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.233.582 1.83l-3.97 2.9c-.83.605-1.17 1.693-.833 2.677l1.518 4.674c.3.922-.755 1.688-1.538 1.11l-3.969-2.9a1 1 0 00-1.17 0l-3.97 2.9c-.783.57-1.838-.197-1.538-1.11l1.518-4.674a1 1 0 00-.833-2.677l-3.97-2.9c-.779-.597-.38-1.83.582-1.83h4.907a1 1 0 00.95-.69l1.519-4.674z" />
              </svg>
              {inWatchlist ? L("Takip Listesinde","In Watchlist") : L("Takip Listesine Ekle","Add to Watchlist")}
            </button>

            <button 
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-[#141924] text-slate-300 border-[#1e2a3a] hover:bg-[#1e2a3a] hover:text-white disabled:opacity-50"
            >
              {exportingPdf ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {L("PDF Hazırlanıyor...","Preparing PDF...")}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {L("PDF Kaydet","Save PDF")}
                </>
              )}
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-[#141924] text-slate-300 border-[#1e2a3a] hover:bg-[#1e2a3a] hover:text-white"
            >
              {isFullScreen ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {L("Normal Görünüm","Normal View")}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                  {L("Tam Ekran","Full Screen")}
                </>
              )}
            </button>

            <button
              onClick={() => setShowDeepAnalysis(true)}
              className="flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-gradient-to-r from-[#1d4ed8]/20 to-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]/40 hover:from-[#1d4ed8]/40 hover:to-[#06b6d4]/40 hover:border-[#06b6d4]/70 hover:text-white shadow-lg shadow-cyan-500/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              🔬 {L("Derin Analiz","Deep Analysis")}
            </button>

          </div>
        </div>

        {/* Score & Signal Ring */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" className="stroke-slate-800 fill-none" strokeWidth="4" />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                className={`${scoreRingColor} fill-none transition-all duration-1000`} 
                strokeWidth="4" 
                strokeDasharray={175} 
                strokeDashoffset={175 - (175 * masterScore) / 100} 
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-base font-black tracking-tighter text-white">{(masterScore / 10).toFixed(1)}</span>
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{L("Skor","Score")}</span>
            </div>
          </div>

          <div className={`px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-wider ${signalBadgeColor}`}>
            {signalType.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* MULTI-TIMEFRAME ANALYSIS OVERLAY BARS (15m ve 1h Göstergesi) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0d1321]/80 border border-[#1e2a3a]/40 rounded-2xl p-4 shadow-inner">
        {/* 15m Micro Direction */}
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-lg font-black border ${
            sc.micro_15m?.is_valid === false 
              ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
              : sc.micro_15m?.score_bonus > 1 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse" 
                : "bg-slate-800/80 text-slate-400 border-slate-700"
          }`}>
            {sc.micro_15m?.is_valid === false ? "🚨" : sc.micro_15m?.score_bonus > 1 ? "🔥" : "⚖️"}
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              {L("15 Dakika (15M) Mikro Yönü","15-Minute (15M) Micro Direction")}
              {sc.micro_15m?.is_valid === false && <span className="bg-rose-500/20 text-rose-400 text-[8px] px-1 py-0.5 rounded font-black">{L("DAĞITIM","DISTRIBUTION")}</span>}
              {sc.micro_15m?.score_bonus > 1 && <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1 py-0.5 rounded font-black">{L("GÜÇLÜ ONAY","STRONG CONFIRM")}</span>}
            </div>
            <div className={`text-xs font-black mt-0.5 ${
              sc.micro_15m?.is_valid === false
                ? "text-rose-400"
                : sc.micro_15m?.score_bonus > 1
                  ? "text-emerald-400"
                  : "text-slate-300"
            }`}>
              {sc.micro_15m?.msg || L("⚖️ 15m Yatay / Sıkışma: Gürültü yok","⚖️ 15m Flat / Compression: No noise")}
            </div>
          </div>
        </div>

        {/* 1H Pivot Entry Timing */}
        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-[#1e2a3a]/30 pt-3 md:pt-0 md:pl-4">
          <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 shrink-0 flex items-center justify-center text-lg font-black">
            🎯
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
              {L("1 Saat (1H) Giriş Timing Durumu","1-Hour (1H) Entry Timing Status")}
            </div>
            <div className="text-xs font-black text-blue-400 uppercase mt-0.5 flex items-center gap-2">
              <span>{sd.entry_engine?.type || "WAITING_FOR_VOLUME"}</span>
              <span className="bg-blue-500/20 text-blue-300 text-[8px] px-1.5 py-0.5 rounded font-bold">
                %{sd.entry_engine?.confidence || 75} {L("Güven","Confidence")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CANLI PİYASA & SEKTÖR MATRİSİ */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
          <span>📊</span> {L("CANLI PİYASA & SEKTÖREL DURUM MATRİSİ","LIVE MARKET & SECTOR STATUS MATRIX")}
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* S&P 500 Card */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{L("S&P 500 Endeksi","S&P 500 Index")}</span>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {sp500ChangeVal != null ? (sp500ChangeVal >= 0 ? "+" : "") + sp500ChangeVal.toFixed(2) + "%" : L("Yükleniyor...","Loading...")}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${sp500ChangeVal != null && sp500ChangeVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {sp500ChangeVal != null ? (sp500ChangeVal >= 0 ? `▲ ${L("POZİTİF","POSITIVE")}` : `▼ ${L("DÜŞÜŞTE","DOWN")}`) : L("Canlı Veri","Live Data")}
              </span>
            </div>
          </div>

          {/* NASDAQ Card */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{L("NASDAQ Endeksi","NASDAQ Index")}</span>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {nasdaqChangeVal != null ? (nasdaqChangeVal >= 0 ? "+" : "") + nasdaqChangeVal.toFixed(2) + "%" : L("Yükleniyor...","Loading...")}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${nasdaqChangeVal != null && nasdaqChangeVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {nasdaqChangeVal != null ? (nasdaqChangeVal >= 0 ? `▲ ${L("POZİTİF","POSITIVE")}` : `▼ ${L("DÜŞÜŞTE","DOWN")}`) : L("Canlı Veri","Live Data")}
              </span>
            </div>
          </div>

          {/* VIX Korku Endeksi */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{L("VIX Korku Endeksi","VIX Fear Index")}</span>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {vixPriceVal != null ? vixPriceVal.toFixed(2) : L("Yükleniyor...","Loading...")}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${vixPriceVal != null && vixPriceVal > 20 ? "text-rose-400" : "text-emerald-400"}`}>
                {vixPriceVal != null ? (vixPriceVal > 20 ? `⚠️ ${L("YÜKSEK VOLATİLİTE","HIGH VOLATILITY")}` : `✓ ${L("DÜŞÜK RİSK","LOW RISK")}`) : L("Canlı Veri","Live Data")}
              </span>
            </div>
          </div>

          {/* Sektör Değişim Oranı */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{sector} ({sectorEtfVal})</span>
            </div>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {sectorChangeVal != null ? (sectorChangeVal >= 0 ? "+" : "") + sectorChangeVal.toFixed(2) + "%" : L("Yükleniyor...","Loading...")}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${sectorChangeVal != null && sectorChangeVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {sectorChangeVal != null ? (sectorChangeVal >= 0 ? `▲ ${L("POZİTİF","POSITIVE")}` : `▼ ${L("DÜŞÜŞTE","DOWN")}`) : L("Canlı Veri","Live Data")}
              </span>
            </div>
          </div>
        </div>

        {/* Dinamik Uyarı Banner'ı */}
        {(() => {
          const isIndicesDown = (sp500ChangeVal != null && sp500ChangeVal < 0) || (nasdaqChangeVal != null && nasdaqChangeVal < 0);
          const isSectorDown = sectorChangeVal != null && sectorChangeVal < 0;

          if (isIndicesDown || isSectorDown) {
            return (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-start gap-3 mt-2">
                <span className="text-xl">⚠️</span>
                <div>
                  <div className="text-xs font-black text-rose-400 uppercase tracking-wider">{L("TEMKİNLİ YAKLAŞIM VE DİKKATLİ ALIM ÖNERİSİ","CAUTIOUS APPROACH & CAREFUL ENTRY ADVISED")}</div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed mt-0.5">
                    {L("Genel endeksler (S&P 500 / NASDAQ) veya sektörel trendler düşüş eğilimindedir. Piyasa risk iştahı zayıf olduğundan, alımlarda acele edilmemeli, daha dikkatli alım yapılmalı ve kademeli temkinli yaklaşım benimsenmelidir.", "Broad indices (S&P 500 / NASDAQ) or sector trends are leaning lower. With market risk appetite weak, avoid rushing entries — use careful, scaled-in positioning instead.")}
                  </p>
                </div>
              </div>
            );
          } else {
            return (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 mt-2">
                <span className="text-xl">✓</span>
                <div>
                  <div className="text-xs font-black text-emerald-400 uppercase tracking-wider">{L("PİYASA VE SEKTÖR KOŞULLARI DENGELİ","MARKET & SECTOR CONDITIONS BALANCED")}</div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed mt-0.5">
                    {L("Endeksler ve sektörel ivme stabil veya pozitif seyrediyor. Belirlenen ana swing planına ve kademe seviyelerine sadık kalınarak işleme devam edilebilir.", "Indices and sector momentum are stable or positive. You can proceed per the defined swing plan and staged levels.")}
                  </p>
                </div>
              </div>
            );
          }
        })()}
      </div>

      {/* BOGA AI MULTI-HORIZON SUITABILITY RADAR */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
          <span>🎯</span> {L("BOGA AI ÇOKLU VADELİ ANALİZ RADARI (MULTI-HORIZON ANALYSIS RADAR)","BOGA AI MULTI-HORIZON ANALYSIS RADAR")}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Swing Trade Suitability */}
          {(() => {
            const swingLevel = masterScore >= 65 ? "HIGH" : masterScore >= 50 ? "MODERATE" : "LOW";
            const swingText = swingLevel === "HIGH" ? L("GÜÇLÜ SWING FIRSATI","STRONG SWING OPPORTUNITY") : swingLevel === "MODERATE" ? L("İZLEME / DENGELİ","WATCH / BALANCED") : L("DÜŞÜK İVME / RİSKLİ","LOW MOMENTUM / RISKY");
            const swingColor = swingLevel === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/5" : swingLevel === "MODERATE" ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/5" : "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-rose-500/5";
            return (
              <div className={`p-4 rounded-2xl border ${swingColor} shadow-md flex flex-col justify-between space-y-2`}>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-70">1. {L("SWING TRADE PROFİLİ","SWING TRADE PROFILE")}</span>
                  <span className="text-xs">⚡</span>
                </div>
                <div>
                  <div className="text-base font-black tracking-tight">{swingText}</div>
                  <p className="text-[9px] font-bold mt-1 opacity-80">{L("BOGA Skoru","BOGA Score")} {masterScore}/100 • {L("Trend Uyumlu Giriş","Trend-Aligned Entry")}</p>
                </div>
              </div>
            );
          })()}

          {/* Card 2: Long-Term Investment Suitability */}
          {(() => {
            const netMarginVal = fund.net_margin || 0;
            const revGrowthVal = fund.revenue_growth_ttm || 0;
            const isRec = netMarginVal > 0.08 && revGrowthVal > 0.05;
            const isHold = netMarginVal > 0 || revGrowthVal > 0;
            const ltLevel = isRec ? "RECOMMENDED" : isHold ? "HOLD" : "AVOID";
            const ltText = ltLevel === "RECOMMENDED" ? L("🟢 GÜÇLÜ BİRİKTİR (+1 / +5 Yıl)","🟢 STRONG ACCUMULATE (+1 / +5 Yr)") : ltLevel === "HOLD" ? L("🟡 TUT / DENGELİ VADE","🟡 HOLD / BALANCED TERM") : L("🔴 YÜKSEK RİSK / KAÇIN","🔴 HIGH RISK / AVOID");
            const ltDesc = ltLevel === "RECOMMENDED" ? L("+1 ve +5 yıl vade için mükemmel finansal temel.","Excellent financial foundation for +1 and +5 year horizons.") : ltLevel === "HOLD" ? L("Orta/uzun vadeli stabil birikim profili.","Stable mid/long-term accumulation profile.") : L("Finansallar zayıf, uzun vade biriktirme riskli.","Weak financials, long-term accumulation is risky.");
            return (
              <div className="p-4 rounded-2xl border border-[#1e2a3a]/40 bg-[#0d1321] text-slate-300 flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">2. {L("UZUN VADE YATIRIM (+1 / +5 YIL)","LONG-TERM INVESTMENT (+1 / +5 YR)")}</span>
                  <span className="text-xs">💎</span>
                </div>
                <div>
                  <div className="text-xs font-black text-white">{ltText}</div>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">{ltDesc}</p>
                </div>
              </div>
            );
          })()}

          {/* Card 3: Dividend Payer Status */}
          {(() => {
            const divRate = fund.dividend_rate || 0;
            const divYield = fund.dividend_yield || 0;
            const paysDiv = divYield > 0;
            const divText = paysDiv ? `🟢 ${L("TEMETTÜ HİSSESİ","DIVIDEND STOCK")} (%${(divYield * 100).toFixed(2)})` : `⚪ ${L("BÜYÜME ODAKLI (Yatırımsız)","GROWTH FOCUSED (No Dividend)")}`;
            const divDesc = paysDiv ? `${L("Yıllık Hisse Başı","Annual Per Share")}: $${divRate.toFixed(2)} • ${L("Dönem","Period")}: ${L("Çeyreklik","Quarterly")}` : L("Tüm serbest nakit akışını büyümeye harcar.","Spends all free cash flow on growth.");
            return (
              <div className="p-4 rounded-2xl border border-[#1e2a3a]/40 bg-[#0d1321] text-slate-300 flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">3. {L("PASİF GELİR / TEMETTÜ","PASSIVE INCOME / DIVIDEND")}</span>
                  <span className="text-xs">💰</span>
                </div>
                <div>
                  <div className="text-xs font-black text-white">{divText}</div>
                  <p className="text-[9px] font-bold text-slate-400 mt-1">{divDesc}</p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 2. DYNAMIC METRICS CARDS GRID (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Price */}
        <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-28">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{L("Güncel Fiyat","Current Price")}</span>
          <div>
            <div className="text-2xl font-black text-white">${formatNum(currentPrice)}</div>
            <div className={`text-xs font-bold flex items-center gap-1.5 mt-0.5 ${changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              <span>{changePct >= 0 ? "▲" : "▼"}</span>
              <span>${Math.abs(priceDiff).toFixed(2)} ({formatPct(changePct)})</span>
            </div>
          </div>
        </div>

        {/* Card 2: 52-Week Range */}
        <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-28">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{L("52 Hafta Aralığı","52-Week Range")}</span>
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
              <span>${formatNum(low52w, 1)}</span>
              <span>${formatNum(high52w, 1)}</span>
            </div>
            {/* Slider track */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full relative">
              <div 
                className="absolute top-0 bottom-0 bg-[#3b82f6] rounded-full" 
                style={{ left: "0%", width: `${range52wPercent}%` }}
              />
              <div 
                className="absolute w-3.5 h-3.5 bg-white border-2 border-[#3b82f6] rounded-full -top-1 shadow" 
                style={{ left: `calc(${range52wPercent}% - 7px)` }}
              />
            </div>
            <div className="text-[9px] text-slate-400 text-center mt-1.5 font-bold">
              {L("Zirveye uzaklık","Distance to high")}: %{Math.max(0, 100 - range52wPercent).toFixed(0)}
            </div>
          </div>
        </div>

        {/* Card 3: Analysis Context */}
        <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-28">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{L("Analiz Konsensüsü","Analysis Consensus")}</span>
          <div>
            <div className="text-base font-black text-white uppercase tracking-tight flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isBullish ? "bg-emerald-500 animate-pulse" : isBearish ? "bg-rose-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
              {isBullish ? L("Güçlü Boğa Sinyali","Strong Bullish Signal") : isBearish ? L("Ayı Baskısı Baskın","Bearish Pressure Dominant") : L("Nötr Beklemede","Neutral / Waiting")}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-bold">
              {L("Teknik Güç","Technical Strength")}: %{formatNum(sc.technical_score, 0)} • {L("Temel Güç","Fundamental Strength")}: %{formatNum(sc.fundamental_score, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* 3. CORE TECHNICALS GRID (2 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Column 1: TEKNİK GÖSTERGELER */}
        <div className="bg-[#0d1321] border border-[#1e2a3a]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2 mb-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("TEKNİK GÖSTERGELER (1G)","TECHNICAL INDICATORS (1D)")}</h3>
          </div>

          <div className="space-y-3 font-mono text-xs text-slate-300">
            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA 20</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${formatNum(ema20)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${currentPrice >= ema20 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {currentPrice >= ema20 ? `${L("Fiyat Üstünde","Price Above")} ✓` : `${L("Fiyat Altında","Price Below")} ✗`}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA 50</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${formatNum(ema50)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${currentPrice >= ema50 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {currentPrice >= ema50 ? `${L("Fiyat Üstünde","Price Above")} ✓` : `${L("Fiyat Altında","Price Below")} ✗`}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA 200</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${formatNum(ema200)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${currentPrice >= ema200 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {currentPrice >= ema200 ? `${L("Fiyat Üstünde","Price Above")} ✓` : `${L("Fiyat Altında","Price Below")} ✗`}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">RSI (14)</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatNum(rsi, 1)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${rsi >= 70 ? "bg-rose-500/10 text-rose-400" : rsi <= 30 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-300"}`}>
                  {rsi >= 70 ? L("Aşırı Alım (Riskli)","Overbought (Risky)") : rsi <= 30 ? L("Aşırı Satım (Ucuz)","Oversold (Cheap)") : L("Nötr / Dengeli","Neutral / Balanced")}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">{L("Göreceli Hacim (RVOL)","Relative Volume (RVOL)")}</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatNum(rvol, 2)}x</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${rvol >= 1.5 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-300"}`}>
                  {rvol >= 1.5 ? `${L("Yüksek Hacim","High Volume")} ▲` : L("Normal Hacim","Normal Volume")}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">{L("EMA Dağılımı","EMA Stack")}</span>
              <span className="font-sans font-black text-slate-200">{tech.ema_stack_bullish ? `🟢 ${L("Boğa (Uyumlu)","Bullish (Aligned)")}` : `🟡 ${L("Ayı / Karışık","Bearish / Mixed")}`}</span>
            </div>
          </div>
        </div>

        {/* Column 2: SWING SİNYAL HARİTASI */}
        <div className="bg-[#0d1321] border border-[#1e2a3a]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2 mb-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("SWING SİNYAL HARİTASI","SWING SIGNAL MAP")}</h3>
          </div>

          <div className="space-y-3.5">
            {/* Trend Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>{L("Ana Trend Gücü","Main Trend Strength")}</span>
                <span>%{formatNum(sc.technical_score, 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${sc.technical_score || 50}%` }} />
              </div>
            </div>

            {/* Momentum Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>{L("Hisse Momentumu","Stock Momentum")}</span>
                <span>%{formatNum(sc.momentum_score || sc.momentum_cat_score || 50, 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${sc.momentum_score || sc.momentum_cat_score || 50}%` }} />
              </div>
            </div>

            {/* Volume Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>{L("Hacim Sıkışması","Volume Compression")}</span>
                <span>%{formatNum(Math.min(100, rvol * 50), 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, rvol * 50)}%` }} />
              </div>
            </div>

            {/* Fundamental Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>{L("Temel/Mali Güç","Fundamental Strength")}</span>
                <span>%{formatNum(sc.fundamental_score, 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sc.fundamental_score || 40}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 4. DUAL COLUMN INFO GRID (Support/Resistance vs. Fundamental Specs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Support/Resistance */}
        <div className="bg-[#0d1321] border border-[#1e2a3a]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2 mb-2">
            <div className="w-1 h-4 bg-rose-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("DESTEK / DİRENÇ SEVİYELERİ","SUPPORT / RESISTANCE LEVELS")}</h3>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-rose-400">{L("Güçlü Direnç","Strong Resistance")}</span>
              <span className="font-bold">${formatNum(resistance2)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-orange-400">{L("Hafif Direnç","Light Resistance")}</span>
              <span className="font-bold">${formatNum(resistance1)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10 bg-slate-800/10 px-1 rounded">
              <span className="font-sans font-black text-slate-200">{L("Mevcut Bölge","Current Zone")}</span>
              <span className="font-black text-white">${formatNum(currentPrice)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-emerald-400">{L("İlk Destek","First Support")}</span>
              <span className="font-bold">${formatNum(support1)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-teal-400">{L("EMA 200 Destek","EMA 200 Support")}</span>
              <span className="font-bold">${formatNum(ema200)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-sans font-bold text-[#3b82f6]">{L("Güçlü Destek","Strong Support")}</span>
              <span className="font-bold">${formatNum(support2)}</span>
            </div>
          </div>
        </div>

        {/* Fundamental metrics */}
        <div className="bg-[#0d1321] border border-[#1e2a3a]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2 mb-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("TEMEL MARJLAR & DEĞERLEME","FUNDAMENTAL MARGINS & VALUATION")}</h3>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">{L("Piyasa Değeri","Market Cap")}</span>
              <span className="font-bold text-slate-200">{fund.market_cap ? (fund.market_cap / 1e9).toFixed(1) + "B" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">{L("F/K Oranı (P/E)","P/E Ratio")}</span>
              <span className="font-bold text-slate-200">{(fund.pe_ratio && fund.pe_ratio > 0) ? fund.pe_ratio.toFixed(1) + "x" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">{L("Gelir Büyümesi","Revenue Growth")}</span>
              <span className="font-bold text-slate-200">{fund.revenue_growth_ttm ? (fund.revenue_growth_ttm * 100).toFixed(1) + "%" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">{L("Brüt Kar Marjı","Gross Margin")}</span>
              <span className="font-bold text-slate-200">{fund.gross_margin ? (fund.gross_margin * 100).toFixed(1) + "%" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-sans font-bold text-slate-400">{L("Serbest Nakit Akışı Verimi","Free Cash Flow Yield")}</span>
              <span className="font-bold text-slate-200">{fund.fcf_yield ? (fund.fcf_yield * 100).toFixed(1) + "%" : "N/A"}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 5. CONDITION BASED WARNING CALLOUT (Orange) */}
      <div className="bg-amber-500/10 border-l-4 border-amber-500 rounded-r-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {L("DİKKAT: RİSK & UYARI MATRİSİ","CAUTION: RISK & WARNING MATRIX")}
        </div>
        <p className="text-xs text-amber-100/90 leading-relaxed font-sans font-semibold">
          {currentPrice < ema20
            ? L(`Fiyat kısa vadeli hareketli ortalama olan EMA20 ($${formatNum(ema20)}) seviyesinin altına sarkmış durumda. RSI(14) ${formatNum(rsi, 1)} ile momentumun zayıfladığına işaret ediyor. Güvenli giriş için ilk desteğin onaylanması beklenmelidir.`, `Price has dropped below the short-term EMA20 ($${formatNum(ema20)}) moving average. RSI(14) at ${formatNum(rsi, 1)} signals weakening momentum. Confirmation of the first support level should be awaited for a safer entry.`)
            : L(`Fiyat EMA20 ($${formatNum(ema20)}) ve EMA50 ($${formatNum(ema50)}) seviyelerinin üzerinde tutunuyor. Hacim ivmesi dengeli. Trend yapısı güçlü boğa sinyalini destekliyor. Belirlenen destek seviyeleri stop olarak takip edilebilir.`, `Price is holding above EMA20 ($${formatNum(ema20)}) and EMA50 ($${formatNum(ema50)}). Volume momentum is balanced. The trend structure supports a strong bullish signal. Defined support levels can be tracked as stop levels.`)}
        </p>
      </div>

      {/* SWİNG SENARYOLARI */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2">
          <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("SWİNG SENARYOLARI","SWING SCENARIOS")}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BOĞA SENARYOSU */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4.5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              🟢 {L("BOĞA SENARYOSU","BULL SCENARIO")}
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed font-sans">
              {L(`Fiyatın $${formatNum(support1)} - $${formatNum(ema200)} bölgesinde destek bulması ve onaylanması durumunda, MACD pozitif geçişi ve hacim ivmesi ile yukarı yönelim beklenir.`, `If price finds and confirms support in the $${formatNum(support1)} - $${formatNum(ema200)} zone, an upward move is expected with a positive MACD crossover and volume momentum.`)}
            </p>
            <div className="text-[11px] font-mono text-emerald-400/90 pt-1">
              {L("Direnç Hedefleri","Resistance Targets")}: <span className="font-bold">${formatNum(resistance1)}</span> → <span className="font-bold">${formatNum(resistance2)}</span>
            </div>
          </div>

          {/* AYI SENARYOSU */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-black text-xs uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-rose-400 animate-ping" />
              🔴 {L("AYI SENARYOSU","BEAR SCENARIO")}
            </div>
            <p className="text-xs text-rose-100/80 leading-relaxed font-sans">
              {L(`Destek bölgesi olan $${formatNum(support1)} seviyesinin kırılması durumunda, satış baskısı artarak $${formatNum(ema200)} (EMA200) veya $${formatNum(support2)} seviyelerine kadar geri çekilme tetiklenebilir.`, `If the $${formatNum(support1)} support level breaks, increasing selling pressure could trigger a pullback toward $${formatNum(ema200)} (EMA200) or $${formatNum(support2)}.`)}
            </p>
            <div className="text-[11px] font-mono text-rose-400/90 pt-1">
              {L("Geri Çekilme Hedefleri","Pullback Targets")}: <span className="font-bold">${formatNum(ema200)}</span> → <span className="font-bold">${formatNum(support2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SWİNG TRADE PLANI */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2">
          <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("SWİNG TRADE PLANI","SWING TRADE PLAN")}</h3>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#1e2a3a]/35 bg-[#070c14]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#0f1624] text-slate-400 font-sans border-b border-[#1e2a3a]/30">
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">{L("STRATEJİ","STRATEGY")}</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">{L("GİRİŞ BÖLGESİ","ENTRY ZONE")}</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">{L("HEDEF SEVİYE","TARGET LEVEL")}</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">STOP LOSS</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">{L("R/R ORANI","R/R RATIO")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3a]/20">
              <tr>
                <td className="p-3.5 font-sans font-bold text-emerald-400">{L("Dip Alımı (Pullback)","Dip Buy (Pullback)")}</td>
                <td className="p-3.5 font-bold">${formatNum(support1)}</td>
                <td className="p-3.5 font-bold">${formatNum(resistance1)}</td>
                <td className="p-3.5 font-bold text-rose-400">${formatNum(support1 * 0.95)}</td>
                <td className="p-3.5 font-bold text-slate-300">
                  {(() => {
                    const ent = support1;
                    const tgt = resistance1;
                    const stp = support1 * 0.95;
                    const r = ent - stp;
                    const w = tgt - ent;
                    return r > 0 && w > 0 ? `1:${(w / r).toFixed(1)}` : "1:2.0";
                  })()}
                </td>
              </tr>
              <tr>
                <td className="p-3.5 font-sans font-bold text-[#3b82f6]">EMA200 Bounce</td>
                <td className="p-3.5 font-bold">${formatNum(ema200 * 1.005)}</td>
                <td className="p-3.5 font-bold">${formatNum(resistance1)}</td>
                <td className="p-3.5 font-bold text-rose-400">${formatNum(ema200 * 0.96)}</td>
                <td className="p-3.5 font-bold text-slate-300">
                  {(() => {
                    const ent = ema200 * 1.005;
                    const tgt = resistance1;
                    const stp = ema200 * 0.96;
                    const r = ent - stp;
                    const w = tgt - ent;
                    return r > 0 && w > 0 ? `1:${(w / r).toFixed(1)}` : "1:2.5";
                  })()}
                </td>
              </tr>
              <tr>
                <td className="p-3.5 font-sans font-bold text-purple-400">{L("Kırılım Girişi (Breakout)","Breakout Entry")}</td>
                <td className="p-3.5 font-bold">${formatNum(resistance1 * 1.018)}</td>
                <td className="p-3.5 font-bold">${formatNum(resistance2)}</td>
                <td className="p-3.5 font-bold text-rose-400">${formatNum(resistance1 * 0.96)}</td>
                <td className="p-3.5 font-bold text-slate-300">
                  {(() => {
                    const ent = resistance1 * 1.018;
                    const tgt = resistance2;
                    const stp = resistance1 * 0.96;
                    const r = ent - stp;
                    const w = tgt - ent;
                    return r > 0 && w > 0 ? `1:${(w / r).toFixed(1)}` : "1:2.0";
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6b. BOGA AI FORECAST & SIMULATION ENGINE */}
      <div className="bg-[#0d1321]/90 border border-[#1e2a3a]/40 rounded-2xl p-5 space-y-5 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1e2a3a]/30 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔮</span>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">🔮 {L("BOGA AI 28 GÜNLÜK SIMÜLASYON MOTORU","BOGA AI 28-DAY SIMULATION ENGINE")}</h3>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">{L("Monte Carlo & Teknik Drift Projeksiyonu (1,000 Senaryo)","Monte Carlo & Technical Drift Projection (1,000 Scenarios)")}</p>
            </div>
          </div>
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] px-2 py-1 rounded font-black uppercase tracking-wider">
            {L("AKTİF MİKRO-TRENDLER","ACTIVE MICRO-TRENDS")}
          </span>
        </div>

        {s.forecast ? (
          <div className="space-y-6">
            {/* Daily grid for the first 7 days */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span>📅</span> {L("İLK 7 GÜNLÜK DETAYLI GÜNLÜK TAHMİN AKIŞI","FIRST 7-DAY DETAILED DAILY FORECAST FLOW")}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {s.forecast.daily.map((day: any) => {
                  const isUp = day.base >= currentPrice;
                  return (
                    <div key={day.day} className="bg-[#070c14] border border-[#1e2a3a]/30 rounded-xl p-3 flex flex-col justify-between items-center text-center space-y-2 hover:border-[#3b82f6]/40 transition-all">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{L("Gün","Day")} {day.day}</span>
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {isUp ? "▲" : "▼"} ${day.base.toFixed(2)}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 mt-0.5">{day.date.split("-").slice(1).reverse().join("/")}</span>
                      </div>
                      <div className="w-full space-y-0.5">
                        <div className="text-[8px] font-black text-slate-400">{L("Kâr İhtimali","Profit Odds")}</div>
                        <div className="text-[9px] font-black text-emerald-400">%{day.probabilityOfProfit}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly milestones (14d, 21d, 28d) */}
            {/* Weekly and Long-Term Milestones (Swing + Investment) */}
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span>📅</span> {L("KISA VADELİ HEDEFLER (SWING MILESTONES)","SHORT-TERM TARGETS (SWING MILESTONES)")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: L("14 Günlük Hedef (W2)","14-Day Target (W2)"), key: "14d" },
                    { label: L("21 Günlük Hedef (W3)","21-Day Target (W3)"), key: "21d" },
                    { label: L("28 Günlük Hedef (W4)","28-Day Target (W4)"), key: "28d" },
                  ].map((item) => {
                    const msData = s.forecast.milestones[item.key];
                    if (!msData) return null;
                    const isUp = msData.base >= currentPrice;
                    return (
                      <div key={item.key} className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-blue-500/20 transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full pointer-events-none" />
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.label}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {isUp ? L("BOĞA EĞİLİMİ","BULLISH BIAS") : L("AYI DÜZELTMESİ","BEARISH CORRECTION")}
                          </span>
                        </div>

                        <div>
                          <div className="text-xl font-mono font-black text-white">${msData.base.toFixed(2)}</div>
                          <div className="text-[9px] text-slate-400 font-bold mt-1">
                            {L("Tahmin Koridoru","Forecast Range")}: <span className="text-rose-400 font-black">${msData.bearish.toFixed(2)}</span> - <span className="text-emerald-400 font-black">${msData.bullish.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            <span>{L("Güven Skoru (Kâr Olasılığı)","Confidence Score (Profit Odds)")}</span>
                            <span className="text-emerald-400">%{msData.probabilityOfProfit}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${msData.probabilityOfProfit}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span>🚀</span> {L("UZUN VADELİ HEDEFLER (INVESTMENT MILESTONES)","LONG-TERM TARGETS (INVESTMENT MILESTONES)")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    (() => {
                      const growth = (fund.revenue_growth_ttm > 0 ? Math.min(0.20, fund.revenue_growth_ttm * 0.25) : 0.03) + (masterScore / 100) * 0.05;
                      const base = currentPrice * (1 + growth);
                      return { label: L("3 Aylık Hedef","3-Month Target"), base, bearish: base * 0.90, bullish: base * 1.10, prob: Math.round(60 + (masterScore / 100) * 30) };
                    })(),
                    (() => {
                      const growth = (fund.revenue_growth_ttm > 0 ? Math.min(0.35, fund.revenue_growth_ttm) : 0.12) + (fund.fcf_yield > 0 ? Math.min(0.12, fund.fcf_yield) : 0.04);
                      const base = currentPrice * (1 + growth);
                      return { label: L("1 Yıllık Hedef (+1 Yıl Tut)","1-Year Target (+1 Yr Hold)"), base, bearish: base * 0.80, bullish: base * 1.20, prob: Math.round(55 + (masterScore / 100) * 35) };
                    })(),
                    (() => {
                      const cagr = Math.max(0.08, Math.min(0.30, (fund.revenue_growth_ttm || 0.15)));
                      const base = currentPrice * Math.pow(1 + cagr, 5);
                      return { label: L("5 Yıllık Hedef (+5 Yıl Tut)","5-Year Target (+5 Yr Hold)"), base, bearish: base * 0.70, bullish: base * 1.40, prob: Math.round(50 + (masterScore / 100) * 40) };
                    })()
                  ].map((item, idx) => {
                    const isUp = item.base >= currentPrice;
                    return (
                      <div key={idx} className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full pointer-events-none" />
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.label}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {isUp ? L("YÜKSEK POTANSİYEL","HIGH POTENTIAL") : L("DENGELİ BÜYÜME","BALANCED GROWTH")}
                          </span>
                        </div>

                        <div>
                          <div className="text-xl font-mono font-black text-white">${item.base.toFixed(2)}</div>
                          <div className="text-[9px] text-slate-400 font-bold mt-1">
                            {L("Tahmin Koridoru","Forecast Range")}: <span className="text-rose-400 font-black">${item.bearish.toFixed(2)}</span> - <span className="text-emerald-400 font-black">${item.bullish.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            <span>{L("Büyüme İtimadı (Güven Oranı)","Growth Confidence (Confidence Rate)")}</span>
                            <span className="text-emerald-400">%{item.prob}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-400 rounded-full transition-all duration-1000" style={{ width: `${item.prob}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            {L("Tahmin verileri hesaplanamadı veya yükleniyor...","Forecast data could not be computed or is loading...")}
          </div>
        )}
      </div>

      {/* 7. TRADINGVIEW INTEGRATION CONTAINER */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-gradient-to-b from-emerald-400 to-blue-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{L("BOGA AI Canlı İnteraktif Grafik","BOGA AI Live Interactive Chart")}</h3>
          </div>
          <button
            onClick={() => setShowChart(!showChart)}
            className="px-3 py-1 bg-[#1e2a3a]/40 hover:bg-[#1e2a3a]/80 text-[10px] font-black uppercase tracking-wider border border-[#1e2a3a]/60 rounded-lg transition-colors"
          >
            {showChart ? L("Gizle","Hide") : L("Göster","Show")}
          </button>
        </div>

        {showChart && (
          <div className="w-full relative shadow-2xl transition-all duration-300">
            <div ref={chartContainerRef} className="w-full" style={{ height: "360px" }} />
          </div>
        )}
      </div>

      {/* 8. SUMMARY TEXT PARAGRAPHS */}
      <div className="space-y-5 border-t border-[#1e2a3a]/40 pt-6">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">⚡ {ticker.toUpperCase()} {L("SWING TRADE ÖZETİ","SWING TRADE SUMMARY")}</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {L(`Teknik görünümde, kısa vadeli momentum ${rsi < 50 ? "satış baskısının arttığını" : "boğaların lehine olduğunu"} gösteriyor. EMA20 ($${formatNum(ema20)}) pivot seviyesi olup, bu seviyenin ${currentPrice >= ema20 ? "üzerindeki tutunma yukarı yönlü ivmeyi tetikleyebilir." : "altındaki hareketler aşağı yönlü baskıyı artırabilir."} Hisse senedi hacim bazlı kırılımlar için yakın takip edilmelidir.`, `Technically, short-term momentum shows ${rsi < 50 ? "increasing selling pressure" : "bulls in control"}. EMA20 ($${formatNum(ema20)}) is the pivot level — holding ${currentPrice >= ema20 ? "above it could trigger upward momentum." : "below it could increase downward pressure."} The stock should be closely monitored for volume-based breakouts.`)}
          </p>
        </div>

        {(() => {
          const initialLots = Math.max(1, Math.round(2000 / currentPrice));
          const dcaLots = Math.max(1, Math.round(250 / currentPrice));
          const isHealthy = (fund.net_margin || 0) > 0.08;
          return (
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">💎 {L("UZUN VADELİ YATIRIM & DİNAMİK LOT ÖNERİSİ","LONG-TERM INVESTMENT & DYNAMIC LOT SUGGESTION")}</h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {L(`Şirketin finansal yapısı ve gelir büyümesi göz önüne alındığında, uzun vadeli (+1 ile +5 Yıl) birikim için ${isHealthy ? "oldukça uygun ve stabil bir profil çizmektedir." : "yüksek volatilite barındırmakta olup dikkatli biriktirilmelidir."} BOGA AI Algoritmik Modeli, bu hisse senedi için portföy yapısına göre şu dinamik lot büyüklüklerini önermektedir:`, `Given the company's financial structure and revenue growth, for long-term (+1 to +5 year) accumulation it ${isHealthy ? "presents a fairly suitable and stable profile." : "carries high volatility and should be accumulated cautiously."} The BOGA AI Algorithmic Model recommends the following dynamic lot sizes for this stock based on portfolio structure:`)}
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0d1321] border border-[#1e2a3a]/40 rounded-xl p-3.5 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">🏢 {L("BAŞLANGIÇ / ÇEKİRDEK PORTFÖY","INITIAL / CORE PORTFOLIO")}</span>
                  <span className="text-white font-mono font-black text-sm">{initialLots} {L("Lot","Lots")}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{L("(Yaklaşık $2,000 hedefli çekirdek pozisyon girişi)","(Targets ~$2,000 core position entry)")}</span>
                </div>
                <div className="border-t sm:border-t-0 sm:border-l border-[#1e2a3a]/40 pt-2 sm:pt-0 sm:pl-3">
                  <span className="text-slate-400 font-bold block mb-1">📅 {L("DÜZENLİ AYLIK BİRİKİM (DCA)","REGULAR MONTHLY ACCUMULATION (DCA)")}</span>
                  <span className="text-emerald-400 font-mono font-black text-sm">+{dcaLots} {L("Lot","Lots")} / {L("Ay","Month")}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{L("(Dolar Maliyet Ortalaması ile her ay disiplinli ekleme)","(Disciplined monthly add via Dollar Cost Averaging)")}</span>
                </div>
              </div>
            </div>
          );
        })()}

        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">💎 {L("TEMEL HİKAYE & KATALİZÖRLER","FUNDAMENTAL STORY & CATALYSTS")}</h4>
          <ul className="space-y-2 text-xs text-slate-300 font-sans list-disc list-inside">
            <li>
              <strong>{L("Piyasa Payı & Değerleme:","Market Share & Valuation:")}</strong> {L(`Sektör medyan değerleriyle karşılaştırıldığında, F/K rasyosu`, `Compared to sector median values, the P/E ratio of`)} <strong>{formatNum(fund.pe_ratio, 1)}x</strong> {fund.pe_ratio < 25 ? L("ile oldukça cazip seviyelerde.","is quite attractive.") : L("ile primli ama stabil bir büyümeyi yansıtıyor.","reflects a premium but stable growth.")}
            </li>
            <li>
              <strong>{L("Nakit Akışı İvmesi:","Cash Flow Momentum:")}</strong> {L("Serbest nakit akışı verimi","Free cash flow yield of")} <strong>%{(fund.fcf_yield * 100).toFixed(1)}</strong> {L("ile şirketin operasyonel nakit üretme gücünün stabil olduğunu gösteriyor.","shows the company's operational cash-generating power is stable.")}
            </li>
            <li>
              <strong>{L("Kurumsal Değerlendirme:","Institutional Assessment:")}</strong> {L(`Son dönemde artan hacim girişleri ve ${fund.institutional_ownership_pct ? `%${(fund.institutional_ownership_pct * 100).toFixed(0)}` : "stabil"} kurumsal sahiplik oranı kurumsal yatırımcıların hisseye duyduğu güveni doğruluyor.`, `Recently increasing volume inflows and a ${fund.institutional_ownership_pct ? `${(fund.institutional_ownership_pct * 100).toFixed(0)}%` : "stable"} institutional ownership ratio confirm institutional investors' confidence in the stock.`)}
            </li>
          </ul>
        </div>

        {/* Execution table strategy */}
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-3">📋 {L("SWING TRADE STRATEJİ MATRİSİ","SWING TRADE STRATEGY MATRIX")}</h4>
          <div className="overflow-x-auto rounded-xl border border-[#1e2a3a]/40 bg-[#070c14] mb-4">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#0f1624] text-slate-400 font-sans">
                  <th className="p-3 font-bold uppercase">{L("Senaryo","Scenario")}</th>
                  <th className="p-3 font-bold uppercase">{L("Seviye","Level")}</th>
                  <th className="p-3 font-bold uppercase">{L("Aksiyon Koşulu","Action Condition")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]/20">
                <tr>
                  <td className="p-3 font-bold text-emerald-400">{L("Giriş (Entry)","Entry")}</td>
                  <td className="p-3 font-bold">${formatNum(entryLow)} - ${formatNum(entryHigh)}</td>
                  <td className="p-3 text-slate-300 font-sans">{L("Hacimli toparlanma teyidi ile alım.","Buy on volume-confirmed recovery.")}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#3b82f6]">{L("Hedef (Target)","Target")}</td>
                  <td className="p-3 font-bold">${formatNum(targetLow)} - ${formatNum(targetHigh)}</td>
                  <td className="p-3 text-slate-300 font-sans">{L("Belirlenen dirençlerde kademeli kâr alımı.","Scaled profit-taking at defined resistance levels.")}</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-rose-400">{L("Zarar Kes (Stop)","Stop Loss")}</td>
                  <td className="p-3 font-bold">${formatNum(stopLoss)}</td>
                  <td className="p-3 text-slate-300 font-sans">{L("Belirtilen seviyenin altındaki günlük kapanış.","Daily close below the specified level.")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Long-term Investment Strategy Table */}
        {(() => {
          const initialLots = Math.max(1, Math.round(2000 / currentPrice));
          const dcaLots = Math.max(1, Math.round(250 / currentPrice));
          const paysDiv = (fund.dividend_yield || 0) > 0;
          return (
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-3">💼 {L("BOGA AI UZUN VADELİ YATIRIM (INVESTMENT) MATRİSİ","BOGA AI LONG-TERM INVESTMENT MATRIX")}</h4>
              <div className="overflow-x-auto rounded-xl border border-[#1e2a3a]/40 bg-[#070c14]">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-[#0f1624] text-slate-400 font-sans">
                      <th className="p-3 font-bold uppercase">{L("Vade / Strateji","Term / Strategy")}</th>
                      <th className="p-3 font-bold uppercase">{L("Lot & Giriş Stratejisi","Lot & Entry Strategy")}</th>
                      <th className="p-3 font-bold uppercase">{L("Kâr Realizasyonu / Çıkış","Profit Realization / Exit")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2a3a]/20">
                    <tr>
                      <td className="p-3 font-bold text-emerald-400">{L("+1 Yıl Vadeli Büyüme (DCA)","+1 Yr Growth (DCA)")}</td>
                      <td className="p-3 text-slate-300 font-sans">
                        {L("Aylık","Monthly")} <strong>{dcaLots} {L("Lot","Lots")}</strong> {L("disiplinli DCA alımı ve EMA200 pullback'lerinde ekleme.","disciplined DCA buys, adding on EMA200 pullbacks.")}
                      </td>
                      <td className="p-3 text-slate-300 font-sans">
                        {L("Büyüme hikayesi veya pazar payı kaybı gözlenmedikçe tut, F/K rasyosu 45x üzerine çıkarsa kademeli azalt.","Hold unless the growth story weakens or market share is lost; trim gradually if P/E exceeds 45x.")}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#3b82f6]">{L("+5 Yıl Vadeli Değer & Pasif Gelir","+5 Yr Value & Passive Income")}</td>
                      <td className="p-3 text-slate-300 font-sans">
                        {L("Çekirdek","Core")} <strong>{initialLots} {L("Lot","Lots")}</strong> {L("başlangıç","initial")} + {paysDiv ? L("ödenen temettüler ile otomatik hisse geri alımı (DRIP).","automatic share reinvestment of paid dividends (DRIP).") : L("aylık birikimlerle düzenli ekleme.","regular additions via monthly accumulation.")}
                      </td>
                      <td className="p-3 text-slate-300 font-sans">
                        {L("Kalıcı emeklilik ve pasif gelir hedefli süresiz birikim. Sadece majör yapısal bozulmalarda gözden geçir.","Indefinite accumulation aimed at retirement and passive income. Review only on major structural deterioration.")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* 9. NEWS & MARKET ANALYSIS SECTION */}
        {(() => {
          const newsList = s.news || [];
          return (
            <div className="space-y-3 pt-4 border-t border-[#1e2a3a]/40">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                <h4 className="text-sm font-black text-white uppercase tracking-widest">📰 {L("GÜNCEL HABERLER & SEKTÖR ANALİZLERİ","LATEST NEWS & SECTOR ANALYSIS")}</h4>
              </div>
              {newsList && newsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-2">
                  {newsList.slice(0, 4).map((item: any, idx: number) => {
                    const pubDate = item.providerPublishTime
                      ? new Date(item.providerPublishTime * 1000).toLocaleDateString(lang === "en" ? "en-US" : "tr-TR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })
                      : L("Son Gelişme","Latest Update");
                    return (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={item.uuid || idx}
                        className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#1e2a3a]/40 hover:border-[#3b82f6]/40 hover:bg-[#0d1321] transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">
                            <span>{item.publisher || L("Finansal Haber","Financial News")}</span>
                            <span>{pubDate}</span>
                          </div>
                          <h5 className="text-xs font-black text-white group-hover:text-[#3b82f6] transition-colors leading-snug">
                            {item.title}
                          </h5>
                        </div>
                        <div className="text-[10px] font-bold text-[#3b82f6] mt-3 flex items-center gap-1">
                          {L("Haberi Oku","Read News")}
                          <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {L("Bu şirket veya sektöre ait son 24 saatte yayınlanmış aktif bir haber/analiz bulunmamaktadır.","No active news/analysis has been published for this company or sector in the last 24 hours.")}
                </p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );

  if (isFullScreen) {
    const fullscreenContent = (
      <div id="boga-stock-fullscreen" className="fixed inset-0 z-[9999] bg-[#080c14] flex flex-col h-screen overflow-hidden">
        {homeHref ? (
          <MemberHeader locale={lang} />
        ) : (
          <Header
            hideMenus={true}
            onLogoClick={() => window.dispatchEvent(new Event("start_new_query"))}
            onNewQueryClick={() => window.dispatchEvent(new Event("start_new_query"))}
          />
        )}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-[#1e2a3a]">
          <div className="max-w-4xl mx-auto w-full">
            {reportContent}
          </div>
        </div>
      </div>
    );

    if (typeof window !== "undefined") {
      return (
        <>
          {createPortal(fullscreenContent, document.body)}
          {showDeepAnalysis && createPortal(
            <DeepAnalysisReport
              ticker={ticker}
              stockData={stockData}
              lang={lang}
              onClose={() => (homeHref ? (window.location.href = homeHref) : setShowDeepAnalysis(false))}
            />,
            document.body
          )}
        </>
      );
    }
  }

  return (
    <>
      <style>{`
        @media print {
          /* Hide everything except the report (works both in normal and fullscreen mode) */
          body > *:not(#boga-stock-fullscreen):not(#boga-stock-print) { display: none !important; }
          #boga-stock-fullscreen {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            display: block !important;
          }
          #boga-stock-fullscreen > * { overflow: visible !important; height: auto !important; }
          #boga-stock-print {
            display: block !important;
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #0a0e17 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #boga-stock-print * {
            overflow: visible !important;
            max-height: none !important;
          }
          #boga-stock-print button { display: none !important; }
          #boga-stock-print iframe { display: none !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>
      {reportContent}
      {showDeepAnalysis && typeof window !== "undefined" && createPortal(
        <DeepAnalysisReport
          ticker={ticker}
          stockData={stockData}
          lang={lang}
          onClose={() => (homeHref ? (window.location.href = homeHref) : setShowDeepAnalysis(false))}
        />,
        document.body
      )}
    </>
  );
}

