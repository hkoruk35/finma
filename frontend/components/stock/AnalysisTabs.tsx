"use client";

import { useState } from "react";
import { StockDetail } from "@/lib/data";

interface Props {
  stock: StockDetail;
}

type LangTab = "en" | "tr" | "es" | "pt" | "fr" | "id";

const LANG_LABELS: { id: LangTab; flag: string; name: string }[] = [
  { id: "en", flag: "🇺🇸", name: "English" },
  { id: "tr", flag: "🇹🇷", name: "Türkçe" },
  { id: "es", flag: "🇪🇸", name: "Español" },
  { id: "pt", flag: "🇧🇷", name: "Português" },
  { id: "fr", flag: "🇫🇷", name: "Français" },
  { id: "id", flag: "🇮🇩", name: "Bahasa" },
];

// Resolve AI content
function getAIContent(
  ai: any,
  type: "detail" | "tech_ins" | "quant_ins",
  lang: LangTab
): string {
  if (!ai || typeof ai === "string") {
    if (type === "detail") return ai || "";
    return "";
  }
  if (typeof ai !== "object") return "";
  if (ai[type]?.[lang]) return ai[type][lang];

  const altMap: Record<string, string> = {
    detail: "detail_summary",
    tech_ins: "tech_insight",
    quant_ins: "fundamental_insight",
  };
  const altKey = altMap[type];
  if (altKey && ai[altKey]?.[lang]) return ai[altKey][lang];

  if (lang !== "en") return getAIContent(ai, type, "en");
  return "";
}

function getHomePageSummary(ai: any, lang: LangTab): string {
  if (!ai || typeof ai !== "object") return "";
  if (ai.homepage?.[lang]) return ai.homepage[lang];
  if (ai.homepage_summary?.[lang]) return ai.homepage_summary[lang];
  if (lang !== "en") return getHomePageSummary(ai, "en");
  return "";
}

export default function AnalysisTabs({ stock }: Props) {
  const [activeLang, setActiveLang] = useState<LangTab>("en");

  const ai = (stock as any).ai_summary;
  const homeSummary = getHomePageSummary(ai, activeLang);
  const detailContent = getAIContent(ai, "detail", activeLang);
  const hasAI = !!(detailContent && detailContent.length > 20);

  return (
    <div className="flex flex-col gap-6">
      {/* Premium Language Selector */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-black text-[#64748b] uppercase tracking-[0.2em] ml-1">Analysis Language</span>
        <div className="flex items-center gap-2 flex-wrap">
          {LANG_LABELS.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLang(l.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-sm ${
                activeLang === l.id
                  ? "bg-[#3b82f6] border-[#3b82f6] text-white shadow-blue-500/20 scale-105"
                  : "bg-[#0d1117] border-[#1e2a3a] text-[#64748b] hover:text-white hover:border-[#3b82f6]/40"
              }`}
            >
              <span className="text-sm">{l.flag}</span>
              <span className="uppercase tracking-widest">{l.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SINGLE BOGA AI BRIEFING BLOCK ── */}
      <div className="glass-card overflow-hidden border-t-4 border-t-[#3b82f6] shadow-2xl">
        {/* Panel header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e2a3a] bg-[#0d1117]/80">
          <div className="p-2 rounded-lg bg-[#3b82f6]/10">
            <span className="text-lg">🦅</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black text-white uppercase tracking-widest">
              BOGA AI Analysis Briefing
            </span>
            <span className="text-[9px] text-[#64748b] font-bold uppercase tracking-widest">Autonomous Intelligence Output</span>
          </div>
        </div>

        <div className="p-6 md:p-10 bg-gradient-to-b from-[#0d1117]/40 to-transparent">
          {hasAI ? (
            <div className="space-y-8">
              {/* Quick summary box */}
              {homeSummary && (
                <div className="relative overflow-hidden bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3b82f6]" />
                  <p className="text-base md:text-lg font-bold text-white leading-relaxed italic">
                    "{homeSummary}"
                  </p>
                </div>
              )}
              {/* Main Text Content */}
              <div className="text-[#94a3b8] leading-[1.8] text-base md:text-xl font-medium whitespace-pre-wrap selection:bg-blue-500/30">
                {detailContent}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#3b82f6]/10 flex items-center justify-center animate-pulse">
                <span className="text-3xl">🦅</span>
              </div>
              <div>
                <p className="text-lg font-black text-white mb-1">Generating Insights...</p>
                <p className="text-sm text-[#64748b]">BOGA AI is processing latest market data for {stock.ticker}.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer for the AI block */}
        <div className="px-6 py-4 bg-[#0d1117]/80 border-t border-[#1e2a3a] flex items-center justify-between">
           <span className="text-[9px] font-black text-[#475569] uppercase tracking-widest">Analysis Engine v5.5</span>
           <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest">Live Sync Connected</span>
           </div>
        </div>
      </div>
    </div>
  );
}
