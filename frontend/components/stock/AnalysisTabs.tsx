"use client";

import { useState } from "react";
import { StockDetail, formatPrice, getChangeColor } from "@/lib/data";

interface Props {
  stock: StockDetail;
}

type MainTab = "ai" | "technicals" | "fundamentals";
type LangTab = "en" | "es" | "pt" | "fr" | "tr" | "id";

export default function AnalysisTabs({ stock }: Props) {
  const [activeTab, setActiveTab] = useState<MainTab>("ai");
  const [activeLang, setActiveLang] = useState<LangTab>("en");

  const languages = [
    { id: "en", label: "English" },
    { id: "tr", label: "Türkçe" },
    { id: "es", label: "Español" },
    { id: "pt", label: "Português" },
    { id: "fr", label: "Français" },
    { id: "id", label: "Indonesia" },
  ];

  // Helper for mock translations (simulated for now, would ideally come from API)
  const getAiSummary = (lang: LangTab) => {
    const base = stock.ai_summary;
    if (lang === "en") return base;
    
    // In a real app, these would be pre-generated in the JSON. 
    // For this redesign demo, we use a placeholder notice if the specific translation isn't in JSON.
    const translations = (stock as any).translations || {};
    if (translations[lang]) return translations[lang];

    const placeholders: Record<string, string> = {
      tr: "BOGA AI analizi, mevcut fiyat hareketleri ve hacim formasyonlarına dayanarak yükseliş beklentisi öngörüyor. Kurumsal alımların dengeli olduğu görülüyor ve teknik göstergeler trendin devamı için uygun.",
      es: "El análisis de BOGA AI sugiere una perspectiva alcista basada en la acción del precio actual y los patrones de volumen. La acumulación institucional parece estable.",
      pt: "A análise da BOGA AI sugere uma perspectiva de alta com base na ação atual do preço e nos padrões de volume. A acumulação institucional parece estável.",
      fr: "L'analyse BOGA AI suggère une perspective haussière basée sur l'action actuelle des prix et les modèles de volume. L'accumulation institutionnelle semble stable.",
      id: "Analisis BOGA AI menyarankan pandangan bullish berdasarkan aksi harga saat ini dan pola volume. Akumulasi institusional tampak stabil."
    };

    return placeholders[lang as string] || base;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Primary Tabs */}
      <div className="flex overflow-x-auto pb-2 scrollbar-hide border-b border-[#1e2a3a]">
        <div className="flex gap-4 md:gap-8">
          {[
            { id: "ai", label: "BOGA AI SUMMARY ANALYSIS" },
            { id: "technicals", label: "TECHNICAL INDICATORS" },
            { id: "fundamentals", label: "FUNDAMENTALS & MARGINS" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MainTab)}
              className={`pb-4 text-xs md:text-sm font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all relative ${
                activeTab === tab.id 
                ? "text-[#3b82f6]" 
                : "text-[#64748b] hover:text-white"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px] animate-fade-in" key={activeTab}>
        {activeTab === "ai" && (
          <div className="glass-card p-4 md:p-8 border-l-4 border-l-[#3b82f6] bg-gradient-to-r from-[#3b82f6]/5 to-transparent flex flex-col gap-6">
            {/* Language Sub-tabs */}
            <div className="flex flex-wrap gap-2 pt-2">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setActiveLang(lang.id as LangTab)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border ${
                    activeLang === lang.id
                      ? "bg-[#3b82f6] text-white border-[#3b82f6] shadow-lg shadow-blue-500/20"
                      : "bg-[#0d1117]/50 text-[#64748b] border-[#1e2a3a] hover:border-[#3b82f6]/40"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="relative mt-4">
              <svg className="absolute -left-2 -top-4 w-10 h-10 text-[#1e2a3a]/40" fill="currentColor" viewBox="0 0 32 32">
                <path d="M10 8v8H6c0-4.4 3.6-8 8-8zM24 8v8h-4c0-4.4 3.6-8 8-8z" />
              </svg>
              <div className="pl-8">
                <p className="text-white leading-relaxed text-lg md:text-2xl font-medium italic">
                  {getAiSummary(activeLang)}
                </p>
                <div className="mt-8 flex flex-col md:flex-row gap-8">
                  <div className="flex flex-col">
                    <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1 text-center md:text-left">AI Confidence Score</p>
                    <div className="flex items-center gap-3">
                      <div className="w-24 md:w-40 h-2 rounded-full bg-[#1e2a3a] overflow-hidden">
                        <div 
                          className="h-full bg-[#3b82f6]" 
                          style={{ width: `${stock.scores.confidence * 100}%` }}
                        ></div>
                      </div>
                      <p className="font-mono font-black text-white text-lg">{(stock.scores.confidence * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:border-l border-[#1e2a3a] md:pl-8">
                    <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-1 text-center md:text-left">Market Sentiment</p>
                    <p className="font-mono font-black text-[#22c55e] flex items-center gap-2 text-lg">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse"></span>
                      Bullish Bias
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "technicals" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "RSI (14)", value: stock.technical.rsi_14, status: stock.technical.rsi_14 > 70 ? "OVERBOUGHT" : stock.technical.rsi_14 < 30 ? "OVERSOLD" : "NEUTRAL", color: stock.technical.rsi_14 > 70 ? "text-[#ef4444]" : stock.technical.rsi_14 < 30 ? "text-[#22c55e]" : "text-[#3b82f6]" },
              { label: "MACD Hist", value: stock.technical.macd_histogram?.toFixed(3) || "0.000", status: stock.technical.macd_crossover.toUpperCase(), color: "text-[#3b82f6]" },
              { label: "RVOL", value: stock.technical.rvol + "x", status: stock.technical.rvol > 1.2 ? "HIGH" : "NORMAL", color: stock.technical.rvol > 1.2 ? "text-[#22c55e]" : "text-[#94a3b8]" },
              { label: "OBV Trend", value: stock.technical.obv_trend, status: "UP", color: "text-[#22c55e]" },
              { label: "EMA Stack", value: stock.technical.ema_stack_bullish ? "BULLISH" : "BEARISH", status: "STABLE", color: stock.technical.ema_stack_bullish ? "text-[#22c55e]" : "text-[#ef4444]" },
              { label: "ATR (Volat)", value: stock.technical.atr_pct ? (stock.technical.atr_pct * 100).toFixed(2) + "%" : "LOW", status: "MONITOR", color: "text-[#f59e0b]" },
              { label: "52W High Prox", value: ((stock.technical as any).w52_high_proximity_pct * 100)?.toFixed(1) + "%" || "N/A", status: "NEAR TOP", color: "text-[#3b82f6]" },
              { label: "Green Days (10D)", value: stock.technical.green_days_10d || 0, status: (stock.technical.green_days_10d || 0) >= 6 ? "STRONG" : "MIXED", color: (stock.technical.green_days_10d || 0) >= 6 ? "text-[#22c55e]" : "text-[#94a3b8]" },
              { label: "ADX (Strength)", value: stock.technical.adx || "N/A", status: (stock.technical.adx || 0) > 25 ? "TRENDING" : "RANGING", color: (stock.technical.adx || 0) > 25 ? "text-[#8b5cf6]" : "text-[#64748b]" }
            ].map((item, i) => (
              <div key={i} className="bg-[#0d1117] p-5 rounded-2xl border border-[#1e2a3a] hover:border-[#3b82f6]/60 transition-all group shadow-sm">
                <p className="text-[10px] text-[#64748b] uppercase font-bold tracking-widest mb-2 group-hover:text-[#3b82f6] transition-colors">{item.label}</p>
                <p className="text-xl font-mono font-black text-white mb-1">{item.value}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`}></div>
                  <p className={`text-[10px] font-black uppercase tracking-tighter ${item.color}`}>{item.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "fundamentals" && (
          <div className="glass-card p-4 md:p-8 bg-gradient-to-br from-[#141924] to-[#0d1117]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
              {[
                { label: "Market Capitalization", value: `$${(stock.fundamental.market_cap / 1e9).toFixed(2)}B` },
                { label: "Price / Earnings (P/E)", value: stock.fundamental.pe_ratio || "N/A", sub: `Sector Median: ${stock.fundamental.sector_pe_median}` },
                { label: "Market Cap / Book Value", value: stock.fundamental.pb_ratio || "N/A" },
                { label: "Debt / Equity Ratio", value: stock.fundamental.de_ratio || "N/A" },
                { label: "Free Cash Flow Yield", value: stock.fundamental.fcf_yield ? (stock.fundamental.fcf_yield * 100).toFixed(2) + "%" : "N/A" },
                { label: "Dividend Yield", value: stock.fundamental.dividend_yield ? (stock.fundamental.dividend_yield * 100).toFixed(2) + "%" : "0.00%" },
                { label: "EPS Growth (5yr)", value: stock.fundamental.eps_growth_5y ? (stock.fundamental.eps_growth_5y * 100).toFixed(1) + "%" : "N/A" },
                { label: "Net Profit Margin", value: stock.fundamental.net_margin ? (stock.fundamental.net_margin * 100).toFixed(1) + "%" : "N/A" },
                { label: "Operating Margin", value: stock.fundamental.operating_margin ? (stock.fundamental.operating_margin * 100).toFixed(1) + "%" : "N/A" },
                { label: "Institutional Ownership", value: stock.fundamental.institutional_ownership_pct ? (stock.fundamental.institutional_ownership_pct * 100).toFixed(1) + "%" : "N/A" }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center py-4 border-b border-[#1e2a3a]/60 last:border-0 group">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider group-hover:text-white transition-colors">{item.label}</span>
                    {item.sub && <span className="text-[10px] text-[#3b82f6] font-bold mt-0.5">{item.sub}</span>}
                  </div>
                  <span className="font-mono font-black text-white text-lg">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
