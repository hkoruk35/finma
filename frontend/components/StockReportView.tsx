"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Header from "./Header";

interface StockReportViewProps {
  ticker: string;
  stockData: any;
  masterData?: any;
}

export default function StockReportView({ ticker, stockData }: StockReportViewProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [showChart, setShowChart] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [mounted, setMounted] = useState(false);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0a0e17",
        logging: false
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`BOGA_AI_${ticker.toUpperCase()}_Raporu.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
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
    const watchlistStr = localStorage.getItem("watchlist");
    const wl = watchlistStr ? JSON.parse(watchlistStr) : ["AAPL", "NVDA", "TSLA", "PLTR", "SOFI", "META"];
    setInWatchlist(wl.includes(ticker.toUpperCase()));
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
      try {
        const overridesStr = localStorage.getItem("theme_overrides");
        const overrides = overridesStr ? JSON.parse(overridesStr) : {};
        if (!overrides[targetTheme]) {
          overrides[targetTheme] = [];
        }
        if (!overrides[targetTheme].includes(t)) {
          overrides[targetTheme].push(t);
          localStorage.setItem("theme_overrides", JSON.stringify(overrides));
          console.log(`[BOGA AI] Automatically added ${t} to theme: ${targetTheme}`);
        }
      } catch (err) {}
    }
  }, [ticker, stockData]);

  const toggleWatchlist = () => {
    const watchlistStr = localStorage.getItem("watchlist");
    let wl = watchlistStr ? JSON.parse(watchlistStr) : ["AAPL", "NVDA", "TSLA", "PLTR", "SOFI", "META"];
    if (wl.includes(ticker.toUpperCase())) {
      wl = wl.filter((t: string) => t !== ticker.toUpperCase());
      setInWatchlist(false);
    } else {
      wl.push(ticker.toUpperCase());
      setInWatchlist(true);
    }
    localStorage.setItem("watchlist", JSON.stringify(wl));
    // Dispatch event to notify other components (like TerminalClient)
    window.dispatchEvent(new Event("watchlist_update"));
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
      interval: "D",
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
    <div ref={reportRef} className={`w-full max-w-4xl mx-auto bg-[#0a0e17] rounded-3xl border border-[#1e2a3a]/60 shadow-2xl p-6 md:p-8 space-y-8 text-white select-none relative ${isFullScreen ? "my-4" : ""}`}>
      
      {/* 1. HEADER BLOCK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#1e2a3a]/40 pb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{ticker.toUpperCase()}</h1>
            <span className="text-lg text-slate-400 font-bold">— {companyName}</span>
          </div>
          <p className="text-xs text-[#3b82f6] font-mono tracking-widest uppercase mt-1">
            Swing Trade Analizi • 1G Grafik • {sector} — {industry} • Analiz Zamanı: {new Date(s.generated_at || Date.now()).toLocaleString("tr-TR")}
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
              {inWatchlist ? "Takip Listesinde" : "Takip Listesine Ekle"}
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
                  PDF Hazırlanıyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PDF Kaydet
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
                  Normal Görünüm
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                  Tam Ekran
                </>
              )}
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
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Skor</span>
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
              15 Dakika (15M) Mikro Yönü 
              {sc.micro_15m?.is_valid === false && <span className="bg-rose-500/20 text-rose-400 text-[8px] px-1 py-0.5 rounded font-black">DAĞITIM</span>}
              {sc.micro_15m?.score_bonus > 1 && <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1 py-0.5 rounded font-black">GÜÇLÜ ONAY</span>}
            </div>
            <div className={`text-xs font-black mt-0.5 ${
              sc.micro_15m?.is_valid === false 
                ? "text-rose-400" 
                : sc.micro_15m?.score_bonus > 1 
                  ? "text-emerald-400" 
                  : "text-slate-300"
            }`}>
              {sc.micro_15m?.msg || "⚖️ 15m Yatay / Sıkışma: Gürültü yok"}
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
              1 Saat (1H) Giriş Timing Durumu
            </div>
            <div className="text-xs font-black text-blue-400 uppercase mt-0.5 flex items-center gap-2">
              <span>{sd.entry_engine?.type || "WAITING_FOR_VOLUME"}</span>
              <span className="bg-blue-500/20 text-blue-300 text-[8px] px-1.5 py-0.5 rounded font-bold">
                %{sd.entry_engine?.confidence || 75} Güven
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* CANLI PİYASA & SEKTÖR MATRİSİ */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
          <span>📊</span> CANLI PİYASA & SEKTÖREL DURUM MATRİSİ
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* S&P 500 Card */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">S&P 500 Endeksi</span>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {sp500ChangeVal != null ? (sp500ChangeVal >= 0 ? "+" : "") + sp500ChangeVal.toFixed(2) + "%" : "Yükleniyor..."}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${sp500ChangeVal != null && sp500ChangeVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {sp500ChangeVal != null ? (sp500ChangeVal >= 0 ? "▲ POZİTİF" : "▼ DÜŞÜŞTE") : "Canlı Veri"}
              </span>
            </div>
          </div>

          {/* NASDAQ Card */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">NASDAQ Endeksi</span>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {nasdaqChangeVal != null ? (nasdaqChangeVal >= 0 ? "+" : "") + nasdaqChangeVal.toFixed(2) + "%" : "Yükleniyor..."}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${nasdaqChangeVal != null && nasdaqChangeVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {nasdaqChangeVal != null ? (nasdaqChangeVal >= 0 ? "▲ POZİTİF" : "▼ DÜŞÜŞTE") : "Canlı Veri"}
              </span>
            </div>
          </div>

          {/* VIX Korku Endeksi */}
          <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-24 hover:border-blue-500/20 transition-all">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">VIX Korku Endeksi</span>
            <div>
              <div className="text-lg font-black text-white font-mono">
                {vixPriceVal != null ? vixPriceVal.toFixed(2) : "Yükleniyor..."}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${vixPriceVal != null && vixPriceVal > 20 ? "text-rose-400" : "text-emerald-400"}`}>
                {vixPriceVal != null ? (vixPriceVal > 20 ? "⚠️ YÜKSEK VOLATİLİTE" : "✓ DÜŞÜK RİSK") : "Canlı Veri"}
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
                {sectorChangeVal != null ? (sectorChangeVal >= 0 ? "+" : "") + sectorChangeVal.toFixed(2) + "%" : "Yükleniyor..."}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider ${sectorChangeVal != null && sectorChangeVal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {sectorChangeVal != null ? (sectorChangeVal >= 0 ? "▲ POZİTİF" : "▼ DÜŞÜŞTE") : "Canlı Veri"}
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
                  <div className="text-xs font-black text-rose-400 uppercase tracking-wider">TEMKİNLİ YAKLAŞIM VE DİKKATLİ ALIM ÖNERİSİ</div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed mt-0.5">
                    Genel endeksler (S&P 500 / NASDAQ) veya sektörel trendler düşüş eğilimindedir. Piyasa risk iştahı zayıf olduğundan, alımlarda acele edilmemeli, daha dikkatli alım yapılmalı ve kademeli temkinli yaklaşım benimsenmelidir.
                  </p>
                </div>
              </div>
            );
          } else {
            return (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 mt-2">
                <span className="text-xl">✓</span>
                <div>
                  <div className="text-xs font-black text-emerald-400 uppercase tracking-wider">PİYASA VE SEKTÖR KOŞULLARI DENGELİ</div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed mt-0.5">
                    Endeksler ve sektörel ivme stabil veya pozitif seyrediyor. Belirlenen ana swing planına ve kademe seviyelerine sadık kalınarak işleme devam edilebilir.
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
          <span>🎯</span> BOGA AI ÇOKLU VADELİ ANALİZ RADARI (MULTI-HORIZON ANALYSIS RADAR)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Swing Trade Suitability */}
          {(() => {
            const swingLevel = masterScore >= 65 ? "HIGH" : masterScore >= 50 ? "MODERATE" : "LOW";
            const swingText = swingLevel === "HIGH" ? "GÜÇLÜ SWING FIRSATI" : swingLevel === "MODERATE" ? "İZLEME / DENGELİ" : "DÜŞÜK İVME / RİSKLİ";
            const swingColor = swingLevel === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/5" : swingLevel === "MODERATE" ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/5" : "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-rose-500/5";
            return (
              <div className={`p-4 rounded-2xl border ${swingColor} shadow-md flex flex-col justify-between space-y-2`}>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-wider opacity-70">1. SWING TRADE PROFİLİ</span>
                  <span className="text-xs">⚡</span>
                </div>
                <div>
                  <div className="text-base font-black tracking-tight">{swingText}</div>
                  <p className="text-[9px] font-bold mt-1 opacity-80">BOGA Skoru {masterScore}/100 • Trend Uyumlu Giriş</p>
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
            const ltText = ltLevel === "RECOMMENDED" ? "🟢 GÜÇLÜ BİRİKTİR (+1 / +5 Yıl)" : ltLevel === "HOLD" ? "🟡 TUT / DENGELİ VADE" : "🔴 YÜKSEK RİSK / KAÇIN";
            const ltDesc = ltLevel === "RECOMMENDED" ? "+1 ve +5 yıl vade için mükemmel finansal temel." : ltLevel === "HOLD" ? "Orta/uzun vadeli stabil birikim profili." : "Finansallar zayıf, uzun vade biriktirme riskli.";
            return (
              <div className="p-4 rounded-2xl border border-[#1e2a3a]/40 bg-[#0d1321] text-slate-300 flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">2. UZUN VADE YATIRIM (+1 / +5 YIL)</span>
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
            const divText = paysDiv ? `🟢 TEMETTÜ HİSSESİ (%${(divYield * 100).toFixed(2)})` : "⚪ BÜYÜME ODAKLI (Yatırımsız)";
            const divDesc = paysDiv ? `Yıllık Hisse Başı: $${divRate.toFixed(2)} • Dönem: Çeyreklik` : "Tüm serbest nakit akışını büyümeye harcar.";
            return (
              <div className="p-4 rounded-2xl border border-[#1e2a3a]/40 bg-[#0d1321] text-slate-300 flex flex-col justify-between space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">3. PASİF GELİR / TEMETTÜ</span>
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
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Güncel Fiyat</span>
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
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">52 Hafta Aralığı</span>
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
              Zirveye uzaklık: %{Math.max(0, 100 - range52wPercent).toFixed(0)}
            </div>
          </div>
        </div>

        {/* Card 3: Analysis Context */}
        <div className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between h-28">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Analiz Konsensüsü</span>
          <div>
            <div className="text-base font-black text-white uppercase tracking-tight flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isBullish ? "bg-emerald-500 animate-pulse" : isBearish ? "bg-rose-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
              {isBullish ? "Güçlü Boğa Sinyali" : isBearish ? "Ayı Baskısı Baskın" : "Nötr Beklemede"}
            </div>
            <p className="text-xs text-slate-400 mt-1 font-bold">
              Teknik Güç: %{formatNum(sc.technical_score, 0)} • Temel Güç: %{formatNum(sc.fundamental_score, 0)}
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
            <h3 className="text-sm font-black text-white uppercase tracking-wider">TEKNİK GÖSTERGELER (1G)</h3>
          </div>
          
          <div className="space-y-3 font-mono text-xs text-slate-300">
            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA 20</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${formatNum(ema20)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${currentPrice >= ema20 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {currentPrice >= ema20 ? "Fiyat Üstünde ✓" : "Fiyat Altında ✗"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA 50</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${formatNum(ema50)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${currentPrice >= ema50 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {currentPrice >= ema50 ? "Fiyat Üstünde ✓" : "Fiyat Altında ✗"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA 200</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">${formatNum(ema200)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${currentPrice >= ema200 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {currentPrice >= ema200 ? "Fiyat Üstünde ✓" : "Fiyat Altında ✗"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">RSI (14)</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatNum(rsi, 1)}</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${rsi >= 70 ? "bg-rose-500/10 text-rose-400" : rsi <= 30 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-300"}`}>
                  {rsi >= 70 ? "Aşırı Alım (Riskli)" : rsi <= 30 ? "Aşırı Satım (Ucuz)" : "Nötr / Dengeli"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">Göreceli Hacim (RVOL)</span>
              <div className="flex items-center gap-2">
                <span className="font-bold">{formatNum(rvol, 2)}x</span>
                <span className={`font-sans font-bold px-1.5 py-0.5 rounded text-[10px] ${rvol >= 1.5 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-300"}`}>
                  {rvol >= 1.5 ? "Yüksek Hacim ▲" : "Normal Hacim"}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="font-sans font-bold text-slate-400">EMA Dağılımı</span>
              <span className="font-sans font-black text-slate-200">{tech.ema_stack_bullish ? "🟢 Boğa (Uyumlu)" : "🟡 Ayı / Karışık"}</span>
            </div>
          </div>
        </div>

        {/* Column 2: SWING SİNYAL HARİTASI */}
        <div className="bg-[#0d1321] border border-[#1e2a3a]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2 mb-2">
            <div className="w-1 h-4 bg-emerald-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">SWING SİNYAL HARİTASI</h3>
          </div>

          <div className="space-y-3.5">
            {/* Trend Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Ana Trend Gücü</span>
                <span>%{formatNum(sc.technical_score, 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${sc.technical_score || 50}%` }} />
              </div>
            </div>

            {/* Momentum Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Hisse Momentumu</span>
                <span>%{formatNum(sc.momentum_score || sc.momentum_cat_score || 50, 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${sc.momentum_score || sc.momentum_cat_score || 50}%` }} />
              </div>
            </div>

            {/* Volume Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Hacim Sıkışması</span>
                <span>%{formatNum(Math.min(100, rvol * 50), 0)}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, rvol * 50)}%` }} />
              </div>
            </div>

            {/* Fundamental Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Temel/Mali Güç</span>
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
            <h3 className="text-sm font-black text-white uppercase tracking-wider">DESTEK / DİRENÇ SEVİYELERİ</h3>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-rose-400">Güçlü Direnç</span>
              <span className="font-bold">${formatNum(resistance2)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-orange-400">Hafif Direnç</span>
              <span className="font-bold">${formatNum(resistance1)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10 bg-slate-800/10 px-1 rounded">
              <span className="font-sans font-black text-slate-200">Mevcut Bölge</span>
              <span className="font-black text-white">${formatNum(currentPrice)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-emerald-400">İlk Destek</span>
              <span className="font-bold">${formatNum(support1)}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-teal-400">EMA 200 Destek</span>
              <span className="font-bold">${formatNum(ema200)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-sans font-bold text-[#3b82f6]">Güçlü Destek</span>
              <span className="font-bold">${formatNum(support2)}</span>
            </div>
          </div>
        </div>

        {/* Fundamental metrics */}
        <div className="bg-[#0d1321] border border-[#1e2a3a]/30 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2 mb-2">
            <div className="w-1 h-4 bg-amber-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">TEMEL MARJLAR & DEĞERLEME</h3>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">Piyasa Değeri</span>
              <span className="font-bold text-slate-200">{fund.market_cap ? (fund.market_cap / 1e9).toFixed(1) + "B" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">F/K Oranı (P/E)</span>
              <span className="font-bold text-slate-200">{(fund.pe_ratio && fund.pe_ratio > 0) ? fund.pe_ratio.toFixed(1) + "x" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">Gelir Büyümesi</span>
              <span className="font-bold text-slate-200">{fund.revenue_growth_ttm ? (fund.revenue_growth_ttm * 100).toFixed(1) + "%" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-[#1e2a3a]/10">
              <span className="font-sans font-bold text-slate-400">Brüt Kar Marjı</span>
              <span className="font-bold text-slate-200">{fund.gross_margin ? (fund.gross_margin * 100).toFixed(1) + "%" : "N/A"}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="font-sans font-bold text-slate-400">Serbest Nakit Akışı Verimi</span>
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
          DİKKAT: RİSK & UYARI MATRİSİ
        </div>
        <p className="text-xs text-amber-100/90 leading-relaxed font-sans font-semibold">
          {currentPrice < ema20 
            ? `Fiyat kısa vadeli hareketli ortalama olan EMA20 ($${formatNum(ema20)}) seviyesinin altına sarkmış durumda. RSI(14) ${formatNum(rsi, 1)} ile momentumun zayıfladığına işaret ediyor. Güvenli giriş için ilk desteğin onaylanması beklenmelidir.` 
            : `Fiyat EMA20 ($${formatNum(ema20)}) ve EMA50 ($${formatNum(ema50)}) seviyelerinin üzerinde tutunuyor. Hacim ivmesi dengeli. Trend yapısı güçlü boğa sinyalini destekliyor. Belirlenen destek seviyeleri stop olarak takip edilebilir.`}
        </p>
      </div>

      {/* SWİNG SENARYOLARI */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2">
          <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">SWİNG SENARYOLARI</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BOĞA SENARYOSU */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4.5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              🟢 BOĞA SENARYOSU
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed font-sans">
              Fiyatın ${formatNum(support1)} - ${formatNum(ema200)} bölgesinde destek bulması ve onaylanması durumunda, MACD pozitif geçişi ve hacim ivmesi ile yukarı yönelim beklenir.
            </p>
            <div className="text-[11px] font-mono text-emerald-400/90 pt-1">
              Direnç Hedefleri: <span className="font-bold">${formatNum(resistance1)}</span> → <span className="font-bold">${formatNum(resistance2)}</span>
            </div>
          </div>

          {/* AYI SENARYOSU */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-black text-xs uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-rose-400 animate-ping" />
              🔴 AYI SENARYOSU
            </div>
            <p className="text-xs text-rose-100/80 leading-relaxed font-sans">
              Destek bölgesi olan ${formatNum(support1)} seviyesinin kırılması durumunda, satış baskısı artarak ${formatNum(ema200)} (EMA200) veya ${formatNum(support2)} seviyelerine kadar geri çekilme tetiklenebilir.
            </p>
            <div className="text-[11px] font-mono text-rose-400/90 pt-1">
              Geri Çekilme Hedefleri: <span className="font-bold">${formatNum(ema200)}</span> → <span className="font-bold">${formatNum(support2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SWİNG TRADE PLANI */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-[#1e2a3a]/30 pb-2">
          <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
          <h3 className="text-sm font-black text-white uppercase tracking-wider">SWİNG TRADE PLANI</h3>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[#1e2a3a]/35 bg-[#070c14]">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#0f1624] text-slate-400 font-sans border-b border-[#1e2a3a]/30">
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">STRATEJİ</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">GİRİŞ BÖLGESİ</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">HEDEF SEVİYE</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">STOP LOSS</th>
                <th className="p-3.5 font-black uppercase tracking-wider text-[10px]">R/R ORANI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2a3a]/20">
              <tr>
                <td className="p-3.5 font-sans font-bold text-emerald-400">Dip Alımı (Pullback)</td>
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
                <td className="p-3.5 font-sans font-bold text-purple-400">Kırılım Girişi (Breakout)</td>
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
              <h3 className="text-sm font-black text-white uppercase tracking-wider">🔮 BOGA AI 28 GÜNLÜK SIMÜLASYON MOTORU</h3>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">Monte Carlo & Teknik Drift Projeksiyonu (1,000 Senaryo)</p>
            </div>
          </div>
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] px-2 py-1 rounded font-black uppercase tracking-wider">
            AKTİF MİKRO-TRENTS
          </span>
        </div>

        {s.forecast ? (
          <div className="space-y-6">
            {/* Daily grid for the first 7 days */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span>📅</span> İLK 7 GÜNLÜK DETAYLI GÜNLÜK TAHMİN AKIŞI
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                {s.forecast.daily.map((day: any) => {
                  const isUp = day.base >= currentPrice;
                  return (
                    <div key={day.day} className="bg-[#070c14] border border-[#1e2a3a]/30 rounded-xl p-3 flex flex-col justify-between items-center text-center space-y-2 hover:border-[#3b82f6]/40 transition-all">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Gün {day.day}</span>
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                          {isUp ? "▲" : "▼"} ${day.base.toFixed(2)}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 mt-0.5">{day.date.split("-").slice(1).reverse().join("/")}</span>
                      </div>
                      <div className="w-full space-y-0.5">
                        <div className="text-[8px] font-black text-slate-400">Kâr İhtimali</div>
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
                  <span>📅</span> KISA VADELİ HEDEFLER (SWING MILESTONES)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "14 Günlük Hedef (W2)", key: "14d" },
                    { label: "21 Günlük Hedef (W3)", key: "21d" },
                    { label: "28 Günlük Hedef (W4)", key: "28d" },
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
                            {isUp ? "BOĞA EĞİLİMİ" : "AYI DÜZELTMESİ"}
                          </span>
                        </div>
                        
                        <div>
                          <div className="text-xl font-mono font-black text-white">${msData.base.toFixed(2)}</div>
                          <div className="text-[9px] text-slate-400 font-bold mt-1">
                            Tahmin Koridoru: <span className="text-rose-400 font-black">${msData.bearish.toFixed(2)}</span> - <span className="text-emerald-400 font-black">${msData.bullish.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            <span>Güven Skoru (Kâr Olasılığı)</span>
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
                  <span>🚀</span> UZUN VADELİ HEDEFLER (INVESTMENT MILESTONES)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    (() => {
                      const growth = (fund.revenue_growth_ttm > 0 ? Math.min(0.20, fund.revenue_growth_ttm * 0.25) : 0.03) + (masterScore / 100) * 0.05;
                      const base = currentPrice * (1 + growth);
                      return { label: "3 Aylık Hedef", base, bearish: base * 0.90, bullish: base * 1.10, prob: Math.round(60 + (masterScore / 100) * 30) };
                    })(),
                    (() => {
                      const growth = (fund.revenue_growth_ttm > 0 ? Math.min(0.35, fund.revenue_growth_ttm) : 0.12) + (fund.fcf_yield > 0 ? Math.min(0.12, fund.fcf_yield) : 0.04);
                      const base = currentPrice * (1 + growth);
                      return { label: "1 Yıllık Hedef (+1 Yıl Tut)", base, bearish: base * 0.80, bullish: base * 1.20, prob: Math.round(55 + (masterScore / 100) * 35) };
                    })(),
                    (() => {
                      const cagr = Math.max(0.08, Math.min(0.30, (fund.revenue_growth_ttm || 0.15)));
                      const base = currentPrice * Math.pow(1 + cagr, 5);
                      return { label: "5 Yıllık Hedef (+5 Yıl Tut)", base, bearish: base * 0.70, bullish: base * 1.40, prob: Math.round(50 + (masterScore / 100) * 40) };
                    })()
                  ].map((item, idx) => {
                    const isUp = item.base >= currentPrice;
                    return (
                      <div key={idx} className="bg-[#0f1624] border border-[#1e2a3a]/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-emerald-500/20 transition-all">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full pointer-events-none" />
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{item.label}</span>
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${isUp ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            {isUp ? "YÜKSEK POTANSİYEL" : "DENGELİ BÜYÜME"}
                          </span>
                        </div>
                        
                        <div>
                          <div className="text-xl font-mono font-black text-white">${item.base.toFixed(2)}</div>
                          <div className="text-[9px] text-slate-400 font-bold mt-1">
                            Tahmin Koridoru: <span className="text-rose-400 font-black">${item.bearish.toFixed(2)}</span> - <span className="text-emerald-400 font-black">${item.bullish.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-wider">
                            <span>Büyüme İtimadı (Güven Oranı)</span>
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
            Tahmin verileri hesaplanamadı veya yükleniyor...
          </div>
        )}
      </div>

      {/* 7. TRADINGVIEW INTEGRATION CONTAINER */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 bg-gradient-to-b from-emerald-400 to-blue-500 rounded-full" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">TradingView Canlı İnteraktif Grafiği</h3>
          </div>
          <button 
            onClick={() => setShowChart(!showChart)} 
            className="px-3 py-1 bg-[#1e2a3a]/40 hover:bg-[#1e2a3a]/80 text-[10px] font-black uppercase tracking-wider border border-[#1e2a3a]/60 rounded-lg transition-colors"
          >
            {showChart ? "Gizle" : "Göster"}
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
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">⚡ {ticker.toUpperCase()} SWING TRADE ÖZETİ</h4>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Teknik görünümde, kısa vadeli momentum {rsi < 50 ? "satış baskısının arttığını" : "boğaların lehine olduğunu"} gösteriyor. 
            EMA20 ($${formatNum(ema20)}) pivot seviyesi olup, bu seviyenin {currentPrice >= ema20 ? "üzerindeki tutunma yukarı yönlü ivmeyi tetikleyebilir." : "altındaki hareketler aşağı yönlü baskıyı artırabilir."}
            Hisse senedi hacim bazlı kırılımlar için yakın takip edilmelidir.
          </p>
        </div>

        {(() => {
          const initialLots = Math.max(1, Math.round(2000 / currentPrice));
          const dcaLots = Math.max(1, Math.round(250 / currentPrice));
          const isHealthy = (fund.net_margin || 0) > 0.08;
          return (
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">💎 UZUN VADELİ YATIRIM & DİNAMİK LOT ÖNERİSİ</h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Şirketin finansal yapısı ve gelir büyümesi göz önüne alındığında, uzun vadeli (+1 ile +5 Yıl) birikim için 
                {isHealthy ? " oldukça uygun ve stabil bir profil çizmektedir." : " yüksek volatilite barındırmakta olup dikkatli biriktirilmelidir."} 
                BOGA AI Algoritmik Modeli, bu hisse senedi için portföy yapısına göre şu dinamik lot büyüklüklerini önermektedir:
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#0d1321] border border-[#1e2a3a]/40 rounded-xl p-3.5 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">🏢 BAŞLANGIÇ / ÇEKİRDEK PORTFÖY</span>
                  <span className="text-white font-mono font-black text-sm">{initialLots} Lot</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">(Yaklaşık $2,000 hedefli çekirdek pozisyon girişi)</span>
                </div>
                <div className="border-t sm:border-t-0 sm:border-l border-[#1e2a3a]/40 pt-2 sm:pt-0 sm:pl-3">
                  <span className="text-slate-400 font-bold block mb-1">📅 DÜZENLİ AYLIK BİRİKİM (DCA)</span>
                  <span className="text-emerald-400 font-mono font-black text-sm">+{dcaLots} Lot / Ay</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">(Dolar Maliyet Ortalaması ile her ay disiplinli ekleme)</span>
                </div>
              </div>
            </div>
          );
        })()}

        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-2">💎 TEMEL HİKAYE & KATALİZÖRLER</h4>
          <ul className="space-y-2 text-xs text-slate-300 font-sans list-disc list-inside">
            <li>
              <strong>Piyasa Payı & Değerleme:</strong> Sektör medyan değerleriyle karşılaştırıldığında, F/K rasyosu <strong>{formatNum(fund.pe_ratio, 1)}x</strong> ile {fund.pe_ratio < 25 ? "oldukça cazip seviyelerde." : "primli ama stabil bir büyümeyi yansıtıyor."}
            </li>
            <li>
              <strong>Nakit Akışı İvmesi:</strong> Serbest nakit akışı verimi <strong>%{(fund.fcf_yield * 100).toFixed(1)}</strong> ile şirketin operasyonel nakit üretme gücünün stabil olduğunu gösteriyor.
            </li>
            <li>
              <strong>Kurumsal Değerlendirme:</strong> Son dönemde artan hacim girişleri ve {fund.institutional_ownership_pct ? `%${(fund.institutional_ownership_pct * 100).toFixed(0)}` : "stabil"} kurumsal sahiplik oranı kurumsal yatırımcıların hisseye duyduğu güveni doğruluyor.
            </li>
          </ul>
        </div>

        {/* Execution table strategy */}
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-3">📋 SWING TRADE STRATEJİ MATRİSİ</h4>
          <div className="overflow-x-auto rounded-xl border border-[#1e2a3a]/40 bg-[#070c14] mb-4">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#0f1624] text-slate-400 font-sans">
                  <th className="p-3 font-bold uppercase">Senaryo</th>
                  <th className="p-3 font-bold uppercase">Seviye</th>
                  <th className="p-3 font-bold uppercase">Aksiyon Koşulu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]/20">
                <tr>
                  <td className="p-3 font-bold text-emerald-400">Giriş (Entry)</td>
                  <td className="p-3 font-bold">${formatNum(entryLow)} - ${formatNum(entryHigh)}</td>
                  <td className="p-3 text-slate-300 font-sans">Hacimli toparlanma teyidi ile alım.</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-[#3b82f6]">Hedef (Target)</td>
                  <td className="p-3 font-bold">${formatNum(targetLow)} - ${formatNum(targetHigh)}</td>
                  <td className="p-3 text-slate-300 font-sans">Belirlenen dirençlerde kademeli kâr alımı.</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-rose-400">Zarar Kes (Stop)</td>
                  <td className="p-3 font-bold">${formatNum(stopLoss)}</td>
                  <td className="p-3 text-slate-300 font-sans">Belirtilen seviyenin altındaki günlük kapanış.</td>
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
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-3">💼 BOGA AI UZUN VADELİ YATIRIM (INVESTMENT) MATRİSİ</h4>
              <div className="overflow-x-auto rounded-xl border border-[#1e2a3a]/40 bg-[#070c14]">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-[#0f1624] text-slate-400 font-sans">
                      <th className="p-3 font-bold uppercase">Vade / Strateji</th>
                      <th className="p-3 font-bold uppercase">Lot & Giriş Stratejisi</th>
                      <th className="p-3 font-bold uppercase">Kâr Realizasyonu / Çıkış</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2a3a]/20">
                    <tr>
                      <td className="p-3 font-bold text-emerald-400">+1 Yıl Vadeli Büyüme (DCA)</td>
                      <td className="p-3 text-slate-300 font-sans">
                        Aylık <strong>{dcaLots} Lot</strong> disiplinli DCA alımı ve EMA200 pullback'lerinde ekleme.
                      </td>
                      <td className="p-3 text-slate-300 font-sans">
                        Büyüme hikayesi veya pazar payı kaybı gözlenmedikçe tut, F/K rasyosu 45x üzerine çıkarsa kademeli azalt.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-[#3b82f6]">+5 Yıl Vadeli Değer & Pasif Gelir</td>
                      <td className="p-3 text-slate-300 font-sans">
                        Çekirdek <strong>{initialLots} Lot</strong> başlangıç + {paysDiv ? "ödenen temettüler ile otomatik hisse geri alımı (DRIP)." : "aylık birikimlerle düzenli ekleme."}
                      </td>
                      <td className="p-3 text-slate-300 font-sans">
                        Kalıcı emeklilik ve pasif gelir hedefli süresiz birikim. Sadece majör yapısal bozulmalarda gözden geçir.
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
                <h4 className="text-sm font-black text-white uppercase tracking-widest">📰 GÜNCEL HABERLER & SEKTÖR ANALİZLERİ</h4>
              </div>
              {newsList && newsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-2">
                  {newsList.slice(0, 4).map((item: any, idx: number) => {
                    const pubDate = item.providerPublishTime
                      ? new Date(item.providerPublishTime * 1000).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })
                      : "Son Gelişme";
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
                            <span>{item.publisher || "Yahoo Finance"}</span>
                            <span>{pubDate}</span>
                          </div>
                          <h5 className="text-xs font-black text-white group-hover:text-[#3b82f6] transition-colors leading-snug">
                            {item.title}
                          </h5>
                        </div>
                        <div className="text-[10px] font-bold text-[#3b82f6] mt-3 flex items-center gap-1">
                          Haberi Oku
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
                  Bu şirket veya sektöre ait son 24 saatte yayınlanmış aktif bir haber/analiz bulunmamaktadır.
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
      <div className="fixed inset-0 z-[9999] bg-[#080c14] flex flex-col h-screen overflow-hidden">
        <Header 
          hideMenus={true} 
          onLogoClick={() => window.dispatchEvent(new Event("start_new_query"))} 
          onNewQueryClick={() => window.dispatchEvent(new Event("start_new_query"))} 
        />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-[#1e2a3a]">
          <div className="max-w-4xl mx-auto w-full">
            {reportContent}
          </div>
        </div>
      </div>
    );

    if (mounted && typeof window !== "undefined") {
      return createPortal(fullscreenContent, document.body);
    }
  }

  return reportContent;
}

