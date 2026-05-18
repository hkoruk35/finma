"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface StockReportViewProps {
  ticker: string;
  stockData: any;
  masterData?: any;
}

export default function StockReportView({ ticker, stockData }: StockReportViewProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [showChart, setShowChart] = useState(true);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("");
  const [themeSuccess, setThemeSuccess] = useState(false);
  const [mounted, setMounted] = useState(false);

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
  };

  const handleAddTheme = (themeName: string) => {
    if (!themeName) return;
    const overridesStr = localStorage.getItem("theme_overrides");
    const overrides = overridesStr ? JSON.parse(overridesStr) : {};
    if (!overrides[themeName]) {
      overrides[themeName] = [];
    }
    if (!overrides[themeName].includes(ticker.toUpperCase())) {
      overrides[themeName].push(ticker.toUpperCase());
    }
    localStorage.setItem("theme_overrides", JSON.stringify(overrides));
    setThemeSuccess(true);
    setTimeout(() => setThemeSuccess(false), 2000);
    setSelectedTheme("");
  };


  // Extract variables safely
  const s = stockData || {};
  const pr = s.price || {};
  const sc = s.scores || {};
  const tech = s.technical || {};
  const fund = s.fundamental || {};
  const sd = s.scores_detail || s.strategy || {};

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
  }, [ticker, showChart]);

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
    <div className={`w-full max-w-4xl mx-auto bg-[#0a0e17] rounded-3xl border border-[#1e2a3a]/60 shadow-2xl p-6 md:p-8 space-y-8 text-white select-none relative ${isFullScreen ? "my-4" : ""}`}>
      
      {/* 1. HEADER BLOCK */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#1e2a3a]/40 pb-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">{ticker.toUpperCase()}</h1>
            <span className="text-lg text-slate-400 font-bold">— {companyName}</span>
          </div>
          <p className="text-xs text-[#3b82f6] font-mono tracking-widest uppercase mt-1">
            Swing Trade Analizi • 1G Grafik • {sector} — {industry}
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

            <div className="relative flex items-center">
              <select
                value={selectedTheme}
                onChange={(e) => handleAddTheme(e.target.value)}
                className="bg-[#141924] text-slate-300 border border-[#1e2a3a] rounded-xl text-xs font-black uppercase tracking-wider p-2 outline-none cursor-pointer hover:bg-[#1e2a3a] hover:text-white transition-all appearance-none pr-8 pl-3"
              >
                <option value="" className="text-slate-500 font-bold bg-[#0d1117]">Temaya Ekle...</option>
                {SYSTEM_THEME_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="text-slate-300 bg-[#0d1117] font-semibold">{cat}</option>
                ))}
              </select>
              <div className="absolute right-3 pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {themeSuccess && (
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg animate-pulse">
                Temaya Eklendi! ✓
              </span>
            )}
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
              <span className="font-bold text-slate-200">{formatNum(fund.pe_ratio, 1)}x</span>
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

      {/* 6. STRATEGY CALLOUT (Blue) */}
      <div className="bg-[#1d4ed8]/10 border-l-4 border-[#3b82f6] rounded-r-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-[#3b82f6] font-black text-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2H7" />
          </svg>
          OLASI SWING SCENARIO STRATEJİSİ
        </div>
        <p className="text-xs text-blue-100/90 leading-relaxed font-sans font-semibold">
          🎯 **Giriş Bölgesi:** ${formatNum(entryLow)} - ${formatNum(entryHigh)} aralığında hacimli toparlanma mumları. <br className="mt-1" />
          🏆 **Kâr Alma Hedefleri:** $${formatNum(targetLow)} ve $${formatNum(targetHigh)} direnç bölgeleri. <br className="mt-1" />
          🛑 **Zarar Kes (Stop Loss):** $${formatNum(stopLoss)} altı günlük kapanış. Risk/Ödül Oranı (R:R): **1:${formatNum(riskReward, 1)}**
        </p>
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
          <div className="overflow-x-auto rounded-xl border border-[#1e2a3a]/40 bg-[#070c14]">
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
      </div>
    </div>
  );

  if (isFullScreen) {
    const fullscreenContent = (
      <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/95 backdrop-blur-md flex items-start justify-center p-4 md:p-8">
        {reportContent}
      </div>
    );

    if (mounted && typeof window !== "undefined") {
      return createPortal(fullscreenContent, document.body);
    }
  }

  return reportContent;
}

