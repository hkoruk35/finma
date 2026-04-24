"use client";

import { useState, useCallback, useRef } from "react";
import { StockDetail } from "@/lib/data";
import Link from "next/link";
import { LANG_CONFIG, LangCode } from "@/lib/analysis-langs";
import AIReportFormatter from "./AIReportFormatter";
import AddToTrackerButton from "@/components/AddToTrackerButton";

interface Props {
  stock: StockDetail;
}

const ALL_LANGS: { id: LangCode; flag: string; name: string }[] = [
  { id: "en", flag: "🇺🇸", name: "English" },
  { id: "tr", flag: "🇹🇷", name: "Türkçe" },
  { id: "es", flag: "🇪🇸", name: "Español" },
  { id: "pt", flag: "🇧🇷", name: "Português" },
  { id: "fr", flag: "🇫🇷", name: "Français" },
  { id: "id", flag: "🇮🇩", name: "Bahasa" },
  { id: "de", flag: "🇩🇪", name: "Deutsch" },
  { id: "it", flag: "🇮🇹", name: "Italiano" },
  { id: "ru", flag: "🇷🇺", name: "Русский" },
  { id: "ar", flag: "🇸🇦", name: "العربية" },
  { id: "ja", flag: "🇯🇵", name: "日本語" },
  { id: "ko", flag: "🇰🇷", name: "한국어" },
];

// Resolve AI content from existing JSON data
function getAIContent(ai: any, type: "detail" | "tech_ins" | "quant_ins", lang: LangCode): string {
  if (!ai) return "";
  let parsedAi = ai;
  if (typeof ai === "string" && ai.trim().startsWith("{")) {
    try { parsedAi = JSON.parse(ai); } catch (e) { }
  }
  if (!parsedAi || typeof parsedAi === "string") {
    return type === "detail" ? parsedAi || "" : "";
  }
  if (typeof parsedAi !== "object") return "";

  const altMap: Record<string, string> = {
    detail: "detail_summary",
    tech_ins: "tech_insight",
    quant_ins: "fundamental_insight",
  };
  const keysToTry = [type, altMap[type]].filter(Boolean);
  for (const key of keysToTry) {
    if (parsedAi[key!]?.[lang]) return parsedAi[key!][lang];
  }
  if (lang !== "en") return getAIContent(parsedAi, type, "en");
  return "";
}

function getHomePageSummary(ai: any, lang: LangCode): string {
  if (!ai) return "";
  let p = ai;
  if (typeof ai === "string" && ai.trim().startsWith("{")) {
    try { p = JSON.parse(ai); } catch (e) { }
  }
  if (!p || typeof p !== "object") return "";
  const obj = p.homepage_summary || p.homepage || {};
  if (obj[lang]) return obj[lang];
  if (lang !== "en") return getHomePageSummary(p, "en");
  return "";
}

// Build a compact tracker pick from stock detail
function buildTrackerPick(stock: StockDetail) {
  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    current_price: stock.price.current,
    buy_zone: {
      low: stock.scores_detail.entry_range_low,
      high: stock.scores_detail.entry_range_high,
    },
    profit_zone: {
      low: stock.scores_detail.target_range_low,
      high: stock.scores_detail.target_range_high,
    },
    stop_zone: {
      low: stock.scores_detail.stop_range_low,
      high: stock.scores_detail.stop_range_high,
    },
    holding_period: (stock as any)._swing?.holding_period || "60-120 days",
    score: stock.scores.master_score,
  };
}

export default function AnalysisTabs({ stock }: Props) {
  const [activeLang, setActiveLang] = useState<LangCode>("en");
  const [aiGenerated, setAiGenerated] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const generatedRef = useRef<Set<string>>(new Set());

  const ai = (stock as any).ai_summary;
  const homeSummary = getHomePageSummary(ai, activeLang);
  const existingDetail = getAIContent(ai, "detail", activeLang);
  
  // Priority: live generated > existing JSON > empty
  const displayContent = aiGenerated[activeLang] || existingDetail;
  const hasContent = !!(displayContent && displayContent.length > 20);

  const generateForLang = useCallback(async (lang: LangCode) => {
    // Don't re-generate if already done
    if (generatedRef.current.has(lang) && aiGenerated[lang]) return;
    // Don't generate if existing JSON has good content for this lang
    const existingLangContent = getAIContent(ai, "detail", lang);
    if (existingLangContent && existingLangContent.length > 50) {
      generatedRef.current.add(lang);
      return;
    }

    setGenerating(true);
    setGenError(null);
    try {
      const swingData = (stock as any)._swing;
      const pickData = swingData || {
        ticker: stock.ticker,
        company: stock.company,
        sector: stock.sector,
        current_price: stock.price.current,
        score: stock.scores.master_score,
        market_regime: swingData?.market_regime || "Bullish",
        buy_zone: { low: stock.scores_detail.entry_range_low, high: stock.scores_detail.entry_range_high },
        profit_zone: { low: stock.scores_detail.target_range_low, high: stock.scores_detail.target_range_high },
        stop_zone: { low: stock.scores_detail.stop_range_low, high: stock.scores_detail.stop_range_high },
        holding_period: swingData?.holding_period || "60-120 days",
        entry_mode: swingData?.entry_mode || "EMA200 Breakout",
        ema200_breakout: swingData?.ema200_breakout || false,
        golden_cross: swingData?.golden_cross || false,
        technical: stock.technical,
        fundamental: stock.fundamental,
      };

      const res = await fetch("/api/ai-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick: pickData, lang }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.analysis) {
        setAiGenerated(prev => ({ ...prev, [lang]: data.analysis }));
        generatedRef.current.add(lang);
      }
    } catch (e: any) {
      setGenError("Analysis generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [stock, ai, aiGenerated]);

  const handleLangClick = (lang: LangCode) => {
    setActiveLang(lang);
    generateForLang(lang);
  };

  const trackerPick = buildTrackerPick(stock);

  return (
    <div className="flex flex-col gap-6">
      {/* Language Selector */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-black text-[#00d2ff] uppercase tracking-[0.2em]">Analysis Language</span>
          <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Powered by Gemini AI — Daily Briefing</span>
        </div>
        {/* Scrollable lang bar on mobile */}
        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide snap-x">
          {ALL_LANGS.map((l) => (
            <Link
              key={l.id}
              href={`/${l.id}/${LANG_CONFIG[l.id].slug}/${stock.ticker.toLowerCase()}`}
              onClick={(e) => {
                e.preventDefault();
                handleLangClick(l.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all border shrink-0 snap-center ${
                activeLang === l.id
                  ? "bg-[#3b82f6] border-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                  : "bg-[#0d1117] border-[#1e2a3a] text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40"
              }`}
            >
              <span className="text-sm">{l.flag}</span>
              <span className="uppercase tracking-widest whitespace-nowrap">{l.id}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── BOGA AI BRIEFING BLOCK ── */}
      <div className="glass-card overflow-hidden border-t-4 border-t-[#3b82f6] shadow-2xl">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2a3a] bg-[#0d1117]/80 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#3b82f6]/10">
              <span className="text-lg">🦅</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                BOGA AI Analysis Briefing
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 lowercase font-bold">v5.5.2</span>
              </span>
              <span className="text-[9px] text-[#00d2ff] font-bold uppercase tracking-widest">
                {ALL_LANGS.find(l => l.id === activeLang)?.flag} {ALL_LANGS.find(l => l.id === activeLang)?.name} · Autonomous Intelligence Output
              </span>
            </div>
          </div>
          
          {/* ADD SMART TRACKER button */}
          <AddToTrackerButton pick={trackerPick} compact={false} />
        </div>

        <div className="p-6 md:p-10 bg-gradient-to-b from-[#0d1117]/40 to-transparent">
          {generating ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-[#3b82f6]/20 animate-pulse" />
                <div className="absolute inset-2 rounded-full border-2 border-t-[#3b82f6] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🦅</span>
                </div>
              </div>
              <div>
                <p className="text-lg font-black text-white mb-1">Generating AI Briefing...</p>
                <p className="text-sm text-[#00d2ff]">
                  BOGA AI is analyzing {stock.ticker} data in {ALL_LANGS.find(l => l.id === activeLang)?.name}
                </p>
              </div>
            </div>
          ) : genError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <span className="text-3xl">⚠️</span>
              <p className="text-sm text-[#ef4444] font-bold">{genError}</p>
              <button
                onClick={() => { generatedRef.current.delete(activeLang); generateForLang(activeLang); }}
                className="px-4 py-2 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"
              >
                Retry
              </button>
            </div>
          ) : hasContent ? (
            <div className="space-y-8">
              {/* Quick summary quote */}
              {homeSummary && (
                <div className="relative overflow-hidden bg-white/[0.03] border border-white/10 rounded-2xl p-6">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3b82f6]" />
                  <p className="text-base md:text-lg font-bold text-white leading-relaxed italic">
                    "{homeSummary}"
                  </p>
                </div>
              )}

              {/* Main analysis content */}
              <AIReportFormatter content={displayContent} />

              {/* Multi-language SEO links */}
              <div className="mt-10 pt-8 border-t border-white/5">
                <p className="text-[10px] font-black text-[#00d2ff] uppercase tracking-[0.2em] mb-4">
                  Read {stock.ticker} Analysis in Other Languages
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {ALL_LANGS.map(l => (
                    <Link
                      key={l.id}
                      href={`/${l.id}/${LANG_CONFIG[l.id].slug}/${stock.ticker.toLowerCase()}`}
                      className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group text-center"
                    >
                      <div className="text-base mb-0.5">{l.flag}</div>
                      <p className="text-[9px] text-[#00d2ff] group-hover:text-blue-400 font-black uppercase tracking-wider">
                        {l.id}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#3b82f6]/10 flex items-center justify-center animate-pulse">
                <span className="text-3xl">🦅</span>
              </div>
              <div>
                <p className="text-lg font-black text-white mb-1">Generating Insights...</p>
                <p className="text-sm text-[#00d2ff]">BOGA AI is processing latest market data for {stock.ticker}.</p>
              </div>
              <button
                onClick={() => generateForLang(activeLang)}
                className="px-5 py-2.5 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"
              >
                Generate Analysis Now
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0d1117]/80 border-t border-[#1e2a3a] flex items-center justify-between">
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Analysis Engine v5.5 · Gemini AI</span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest">Daily Briefing Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
