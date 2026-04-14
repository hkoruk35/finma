"use client";

import { useState } from "react";
import { StockDetail, formatPrice } from "@/lib/data";

interface Props {
  stock: StockDetail;
}

type TabType = "ai" | "technical" | "fundamental";
type LangTab = "en" | "tr" | "es" | "pt" | "fr" | "id";

export default function AnalysisTabs({ stock }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");
  const [activeLang, setActiveLang] = useState<LangTab>("en");

  const languages: { id: LangTab; label: string; name: string }[] = [
    { id: "en", label: "🇺🇸 EN", name: "English" },
    { id: "tr", label: "🇹🇷 TR", name: "Türkçe" },
    { id: "es", label: "🇪🇸 ES", name: "Español" },
    { id: "pt", label: "🇧🇷 PT", name: "Português" },
    { id: "fr", label: "🇫🇷 FR", name: "Français" },
    { id: "id", label: "🇮🇩 ID", name: "Bahasa" },
  ];

  const getSummary = (lang: LangTab) => {
    const ai = (stock as any).ai_summary;
    if (ai && ai.detail_summary && ai.detail_summary[lang]) {
      return ai.detail_summary[lang];
    }
    // Fallback logic
    if (lang === "en") return stock.ai_summary || "Detail analysis is being processed...";
    return `[${lang.toUpperCase()}] Analysis content is synchronizing...`;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Strategic Toggle Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#0d1117]/80 backdrop-blur-md p-1.5 rounded-2xl border border-[#1e2a3a]">
        {[
          { id: "ai", label: "BOGA AI BRIEFING", icon: "🦅" },
          { id: "technical", label: "TECHNICAL MATRIX", icon: "🔭" },
          { id: "fundamental", label: "QUANT DATA HUB", icon: "📊" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`py-3 px-4 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
              activeTab === tab.id
                ? "bg-[#3b82f6] text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                : "text-[#64748b] hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Canvas */}
      <div className="min-h-[450px] animate-fade-in transition-all duration-500">
        {activeTab === "ai" && (
          <div className="glass-card p-6 md:p-10 border-l-4 border-l-[#3b82f6] relative overflow-hidden group">
            {/* Background Branding Accent */}
            <div className="absolute top-0 right-0 p-8 opacity-5 font-black text-8xl pointer-events-none select-none italic">BOGA AI</div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8 border-b border-[#1e2a3a] pb-6">
                <h3 className="text-xl md:text-2xl font-black text-white italic tracking-tight">
                  <span className="text-[#3b82f6]">Alpha Commander</span> v5.5 Tactical Report
                </h3>
                {/* Lang Select */}
                <div className="flex flex-wrap gap-1.5">
                  {languages.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveLang(l.id)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${
                        activeLang === l.id
                          ? "bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]"
                          : "border-[#1e2a3a] text-[#64748b] hover:border-[#64748b]"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <p className="text-[#cbd5e1] leading-[1.8] text-lg md:text-xl font-medium whitespace-pre-wrap drop-shadow-sm">
                  {getSummary(activeLang)}
                </p>
              </div>
              
              <div className="mt-10 pt-8 border-t border-[#1e2a3a] grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 bg-[#1e293b]/30 p-4 rounded-xl border border-[#1e2a3a]">
                  <div className="w-10 h-10 rounded-full bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">✅</div>
                  <div>
                    <p className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Protocol Status</p>
                    <p className="text-sm font-bold text-[#10b981]">Deep Analysis Verified</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-[#1e293b]/30 p-4 rounded-xl border border-[#1e2a3a]">
                   <div className="w-10 h-10 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">🤖</div>
                   <div>
                    <p className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">AI Confidence Level</p>
                    <p className="text-sm font-bold text-white">{(stock.scores.confidence * 100).toFixed(0)}% Reliable</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "technical" && (
          <div className="glass-card p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
               <h4 className="flex items-center gap-2 text-sm font-black text-[#3b82f6] uppercase tracking-[0.2em] border-b border-[#3b82f6]/20 pb-3">
                 <span>📈</span> Momentum Signals
               </h4>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "RSI Momentum", value: stock.technical.rsi_14 },
                    { label: "Trend Strength (ADX)", value: stock.technical.adx },
                    { label: "Price Flow (MACD Hist)", value: stock.technical.macd_histogram },
                    { label: "Money Flow Index (MFI)", value: stock.technical.mfi },
                  ].map(m => (
                    <div key={m.label} className="bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">{m.label}</span>
                       <span className="font-mono font-black text-white text-xl">{m.value?.toFixed(2) || 'N/A'}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="space-y-6">
               <h4 className="flex items-center gap-2 text-sm font-black text-[#8b5cf6] uppercase tracking-[0.2em] border-b border-[#8b5cf6]/20 pb-3">
                 <span>🏎️</span> Exponential Averages
               </h4>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "Short Term (EMA 20)", value: stock.technical.ema_20, color: "text-[#3b82f6]" },
                    { label: "Medium Term (EMA 50)", value: stock.technical.ema_50, color: "text-[#8b5cf6]" },
                    { label: "Long Term (EMA 200)", value: stock.technical.ema_200, color: "text-[#cbd5e1]" },
                  ].map(e => (
                    <div key={e.label} className="bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">{e.label}</span>
                       <span className={`font-mono font-black text-xl ${e.color}`}>${formatPrice(e.value)}</span>
                    </div>
                  ))}
               </div>
               <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/20">
                 <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-relaxed">
                   *EMA values are used to determine trend orientation. Price above EMA200 indicates a macro bullish bias.
                 </p>
               </div>
            </div>
          </div>
        )}

        {activeTab === "fundamental" && (
          <div className="glass-card p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
               <h4 className="flex items-center gap-2 text-sm font-black text-[#10b981] uppercase tracking-[0.2em] border-b border-[#10b981]/20 pb-3">
                 <span>🪙</span> Profitability & Margins
               </h4>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "Gross Profit Margin", value: stock.fundamental.gross_margin },
                    { label: "Operational Margin", value: stock.fundamental.operating_margin },
                    { label: "Net Profit Margin", value: stock.fundamental.net_margin },
                    { label: "Annual Revenue Growth", value: stock.fundamental.revenue_growth_ttm },
                  ].map(m => (
                    <div key={m.label} className="bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">{m.label}</span>
                       <span className={`font-mono font-black text-xl ${m.value >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                         {m.value ? `${(m.value * 100).toFixed(2)}%` : 'N/A'}
                       </span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="space-y-6">
               <h4 className="flex items-center gap-2 text-sm font-black text-[#f59e0b] uppercase tracking-[0.2em] border-b border-[#f59e0b]/20 pb-3">
                 <span>🧬</span> Valuation Matrix
               </h4>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "Price/Earnings (P/E)", value: stock.fundamental.pe_ratio, format: 'val' },
                    { label: "Price/Book (P/B)", value: stock.fundamental.pb_ratio, format: 'val' },
                    { label: "Free Cash Flow Yield", value: stock.fundamental.fcf_yield, format: 'pct' },
                    { label: "Market Capitalization", value: stock.fundamental.market_cap, format: 'curr' },
                  ].map(m => (
                    <div key={m.label} className="bg-[#141924] p-4 rounded-xl border border-[#1e2a3a] flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider">{m.label}</span>
                       <span className="font-mono font-black text-white text-xl">
                         {m.format === 'curr' ? `$${(m.value / 1e9).toFixed(2)}B` : 
                          m.format === 'pct' ? `${(m.value * 100).toFixed(2)}%` :
                          m.value || 'N/A'}
                       </span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
