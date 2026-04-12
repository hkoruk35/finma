"use client";

import { useState } from "react";
import { StockDetail, formatPrice } from "@/lib/data";

interface Props {
  stock: StockDetail;
}

type TabType = "ai" | "technical" | "fundamental";
type LangTab = "en" | "es" | "pt" | "fr" | "tr" | "id";

export default function AnalysisTabs({ stock }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");
  const [activeLang, setActiveLang] = useState<LangTab>("en");

  const languages = [
    { id: "en", label: "EN" },
    { id: "tr", label: "TR" },
    { id: "es", label: "ES" },
    { id: "pt", label: "PT" },
    { id: "fr", label: "FR" },
    { id: "id", label: "ID" },
  ];

  const getTranslatedText = (lang: LangTab) => {
    if (lang === "en") return stock.ai_summary;

    const translations: Record<string, string> = (stock as any).translations || {};
    if (translations[lang]) return translations[lang];

    // Quick mock translations for demo
    const placeholders: Record<string, string> = {
      tr: `[Yapay Zeka Özeti] ${stock.ticker} için teknik veriler yükseliş trendini destekliyor. Momentum göstergeleri pozitif bölgede.`,
      es: `[Resumen de IA] El análisis para ${stock.ticker} muestra una tendencia alcista sólida con indicadores de impulso positivos.`,
      pt: `[Resumo de IA] A análise de ${stock.ticker} indica uma tendência de alta robusta com momentum favorável.`,
      fr: `[Résumé IA] L'analyse de ${stock.ticker} révèle une tendance haussière forte avec des indicateurs de momentum au vert.`,
      id: `[Ringkasan AI] Analisis untuk ${stock.ticker} menunjukkan tren bullish yang kuat dengan indikator momentum positif.`
    };
    return placeholders[lang] || "Translation is being generated...";
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 3 Strategic Headings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#0d1117] p-1 rounded-xl border border-[#1e2a3a]">
        {[
          { id: "ai", label: "BOGA AI SUMMARY ANALYSIS" },
          { id: "technical", label: "TECHNICAL INDICATORS" },
          { id: "fundamental", label: "FUNDAMENTALS & MARGINS" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`py-3 px-4 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? "bg-[#3b82f6] text-white shadow-lg"
                : "text-[#64748b] hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px] animate-fade-in">
        {activeTab === "ai" && (
          <div className="glass-card p-6 md:p-8 border-l-4 border-l-[#3b82f6] bg-gradient-to-br from-[#3b82f6]/5 to-transparent">
            {/* Language Selection Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 border-b border-[#1e2a3a] pb-4">
              {languages.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => setActiveLang(lang.id as LangTab)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all border ${
                    activeLang === lang.id
                      ? "bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]"
                      : "border-transparent text-[#64748b] hover:text-white"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="text-white leading-relaxed text-lg md:text-xl font-medium italic whitespace-pre-wrap">
                "{getTranslatedText(activeLang)}"
              </p>
            </div>
            
            <div className="mt-8 pt-6 border-t border-[#1e2a3a] flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></div>
                  <span className="text-[10px] font-black text-[#64748b] uppercase tracking-[0.2em]">Verified AI Insight</span>
               </div>
               <span className="text-[10px] font-black text-[#3b82f6] uppercase">Confidence: {(stock.scores.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {activeTab === "technical" && (
          <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <h4 className="text-sm font-black text-[#3b82f6] uppercase tracking-widest border-b border-[#3b82f6]/20 pb-2">Trend Status</h4>
               <div className="space-y-4">
                  {[
                    { label: "RSI (14)", value: stock.technical.rsi_14, type: 'rsi' },
                    { label: "ADX", value: stock.technical.adx, type: 'val' },
                    { label: "MACD Hist", value: stock.technical.macd_histogram, type: 'val' },
                    { label: "MFI", value: stock.technical.mfi, type: 'rsi' },
                  ].map(m => (
                    <div key={m.label} className="flex justify-between items-center group">
                       <span className="text-xs font-bold text-[#94a3b8]">{m.label}</span>
                       <span className="font-mono font-black text-white text-lg">{m.value?.toFixed(2) || 'N/A'}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="space-y-6">
               <h4 className="text-sm font-black text-[#3b82f6] uppercase tracking-widest border-b border-[#3b82f6]/20 pb-2">Moving Averages</h4>
               <div className="space-y-4">
                  {[
                    { label: "EMA 20", value: stock.technical.ema_20 },
                    { label: "EMA 50", value: stock.technical.ema_50 },
                    { label: "EMA 200", value: stock.technical.ema_200 },
                  ].map(e => (
                    <div key={e.label} className="flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8]">{e.label}</span>
                       <span className="font-mono font-black text-white">${formatPrice(e.value)}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === "fundamental" && (
          <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
               <h4 className="text-sm font-black text-purple-400 uppercase tracking-widest border-b border-purple-400/20 pb-2">Margins & Growth</h4>
               <div className="space-y-4">
                  {[
                    { label: "Gross Margin", value: stock.fundamental.gross_margin, type: 'pct' },
                    { label: "Operating Margin", value: stock.fundamental.operating_margin, type: 'pct' },
                    { label: "Net Margin", value: stock.fundamental.net_margin, type: 'pct' },
                    { label: "Revenue Growth", value: stock.fundamental.revenue_growth_ttm, type: 'pct' },
                  ].map(m => (
                    <div key={m.label} className="flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8]">{m.label}</span>
                       <span className={`font-mono font-black ${m.value >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                         {m.value ? `${(m.value * 100).toFixed(2)}%` : 'N/A'}
                       </span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="space-y-6">
               <h4 className="text-sm font-black text-purple-400 uppercase tracking-widest border-b border-purple-400/20 pb-2">Valuation Metrics</h4>
               <div className="space-y-4">
                  {[
                    { label: "P/E Ratio", value: stock.fundamental.pe_ratio, type: 'num' },
                    { label: "P/B Ratio", value: stock.fundamental.pb_ratio, type: 'num' },
                    { label: "FCF Yield", value: stock.fundamental.fcf_yield, type: 'pct' },
                    { label: "Market Cap", value: stock.fundamental.market_cap, type: 'curr' },
                  ].map(m => (
                    <div key={m.label} className="flex justify-between items-center">
                       <span className="text-xs font-bold text-[#94a3b8]">{m.label}</span>
                       <span className="font-mono font-black text-white">
                         {m.type === 'curr' ? `$${(m.value / 1e9).toFixed(2)}B` : 
                          m.type === 'pct' ? `${(m.value * 100).toFixed(2)}%` :
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
