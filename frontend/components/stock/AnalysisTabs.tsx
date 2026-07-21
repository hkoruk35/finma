"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

// Resolve AI content from existing stock JSON
function getStoredContent(ai: any, lang: LangCode): string {
  if (!ai) return "";
  let parsed = ai;
  if (typeof ai === "string" && ai.trim().startsWith("{")) {
    try { parsed = JSON.parse(ai); } catch { }
  }
  if (!parsed || typeof parsed !== "object") {
    return typeof parsed === "string" ? parsed : "";
  }
  // Try all known key names
  const candidates = ["detail_summary", "detail", "tech_insight", "fundamental_insight"];
  for (const key of candidates) {
    if (parsed[key]?.[lang]) return parsed[key][lang];
  }
  // We do NOT fallback to English here. If the specific language is missing, 
  // we want it to return empty so the component knows to generate it.
  return "";
}

function getStoredSummary(ai: any, lang: LangCode): string {
  if (!ai) return "";
  let parsed = ai;
  if (typeof ai === "string" && ai.trim().startsWith("{")) {
    try { parsed = JSON.parse(ai); } catch { }
  }
  if (!parsed || typeof parsed !== "object") return "";
  const obj = parsed.homepage_summary || parsed.homepage || {};
  if (obj[lang]) return obj[lang];
  if (lang !== "en" && obj.en) return obj.en;
  return "";
}

function buildPickData(stock: StockDetail) {
  const swing = (stock as any)._swing;
  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    current_price: stock.price.current,
    score: stock.scores.master_score,
    market_regime: swing?.market_regime || (stock as any).market_regime || "Bullish",
    buy_zone: {
      low: swing?.buy_zone?.low ?? stock.scores_detail.entry_range_low,
      high: swing?.buy_zone?.high ?? stock.scores_detail.entry_range_high,
    },
    profit_zone: {
      low: swing?.profit_zone?.low ?? stock.scores_detail.target_range_low,
      high: swing?.profit_zone?.high ?? stock.scores_detail.target_range_high,
    },
    stop_zone: {
      low: swing?.stop_zone?.low ?? stock.scores_detail.stop_range_low,
      high: swing?.stop_zone?.high ?? stock.scores_detail.stop_range_high,
    },
    holding_period: swing?.holding_period || "60-120 days",
    entry_mode: swing?.entry_mode || "EMA200 Breakout",
    ema200_breakout: swing?.ema200_breakout ?? false,
    golden_cross: swing?.golden_cross ?? false,
    technical: (stock as any).technical || swing?.technical || {},
    fundamental: (stock as any).fundamental || swing?.fundamental || {},
  };
}

function buildTrackerPick(stock: StockDetail) {
  return {
    ticker: stock.ticker,
    company: stock.company,
    sector: stock.sector,
    current_price: stock.price.current,
    buy_zone: { low: stock.scores_detail.entry_range_low, high: stock.scores_detail.entry_range_high },
    profit_zone: { low: stock.scores_detail.target_range_low, high: stock.scores_detail.target_range_high },
    stop_zone: { low: stock.scores_detail.stop_range_low, high: stock.scores_detail.stop_range_high },
    holding_period: (stock as any)._swing?.holding_period || "60-120 days",
    score: stock.scores.master_score,
  };
}

// Animated dots loader — mirrors the /ai page experience
function AnalysisLoader({ ticker, lang }: { ticker: string; lang: string }) {
  const langName = ALL_LANGS.find(l => l.id === lang)?.name || lang.toUpperCase();
  const langFlag = ALL_LANGS.find(l => l.id === lang)?.flag || "";
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-[#3b82f6]/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full border-2 border-t-[#3b82f6] border-r-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">🦅</span>
        </div>
      </div>
      <div>
        <p className="text-base font-black text-white mb-1">
          Generating {langFlag} {langName} Analysis…
        </p>
        <p className="text-sm text-[#00d2ff]">
          BOGA AI is interpreting {ticker} market data
        </p>
        <div className="flex gap-1.5 items-center justify-center mt-3">
          <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default function AnalysisTabs({ stock }: Props) {
  const [activeLang, setActiveLang] = useState<LangCode>("en");
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const generatedSet = useRef<Set<string>>(new Set());
  const pickData = useRef(buildPickData(stock));
  const ai = (stock as any).ai_summary;

  const generateForLang = useCallback(async (lang: LangCode, force = false) => {
    if (!force && generatedSet.current.has(lang)) return;

    // If good stored content exists, use it without calling API
    const stored = getStoredContent(ai, lang);
    if (!force && stored && stored.length > 80) {
      generatedSet.current.add(lang);
      return;
    }

    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch("/api/ai-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pick: pickData.current, lang }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.analysis && data.analysis.length > 50) {
        setGenerated(prev => ({ ...prev, [lang]: data.analysis }));
        generatedSet.current.add(lang);
      } else {
        throw new Error("Empty response");
      }
    } catch (e: any) {
      console.error("[AnalysisTabs] generation error:", e?.message);
      setGenError("Analysis generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [ai]);

  // Auto-generate English on mount
  useEffect(() => {
    generateForLang("en");
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleLangClick = (lang: LangCode) => {
    setActiveLang(lang);
    setGenError(null);
    generateForLang(lang);
  };

  // Content priority: freshly generated > stored JSON
  const storedContent = getStoredContent(ai, activeLang);
  const displayContent = generated[activeLang] || storedContent;
  const storedSummary = getStoredSummary(ai, activeLang);
  const hasContent = !!(displayContent && displayContent.length > 20);
  const isRtl = activeLang === "ar";
  const trackerPick = buildTrackerPick(stock);

  return (
    <div className="flex flex-col gap-4">

      {/* ── Language Bar ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-black text-[#00d2ff] uppercase tracking-[0.2em]">
            Analysis Language
          </span>
          <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
            BOGA AI · Daily Briefing
          </span>
        </div>
        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide snap-x">
          {ALL_LANGS.map((l) => {
            const isActive = activeLang === l.id;
            const isDone = generatedSet.current.has(l.id) || !!(getStoredContent(ai, l.id)?.length > 80);
            return (
              <button
                key={l.id}
                onClick={() => handleLangClick(l.id)}
                disabled={generating && !isActive}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all border shrink-0 snap-center relative ${
                  isActive
                    ? "bg-[#3b82f6] border-[#3b82f6] text-white shadow-lg shadow-blue-500/20"
                    : "bg-[#0d1117] border-[#1e2a3a] text-[#00d2ff] hover:text-white hover:border-[#3b82f6]/40 disabled:opacity-40"
                }`}
              >
                <span className="text-sm">{l.flag}</span>
                <span className="uppercase tracking-widest whitespace-nowrap">{l.id}</span>
                {isDone && !isActive && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#22c55e] border border-[#0d1117]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BOGA AI Briefing Panel ── */}
      <div className="glass-card overflow-hidden border-t-4 border-t-[#3b82f6] shadow-2xl">

        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2a3a] bg-[#0d1117]/80 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#3b82f6]/10 shrink-0">
              <span className="text-lg">🦅</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                BOGA AI Analysis Briefing
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 lowercase font-bold">
                  v5.5.2
                </span>
              </span>
              <span className="text-[9px] text-[#00d2ff] font-bold uppercase tracking-widest">
                {ALL_LANGS.find(l => l.id === activeLang)?.flag}{" "}
                {ALL_LANGS.find(l => l.id === activeLang)?.name} · AI-Powered · Daily
              </span>
            </div>
          </div>

          {/* Add to Smart Tracker */}
          <AddToTrackerButton pick={trackerPick} compact={false} />
        </div>

        {/* Panel Body */}
        <div className={`p-5 md:p-8 bg-gradient-to-b from-[#0d1117]/40 to-transparent ${isRtl ? "text-right" : ""}`} dir={isRtl ? "rtl" : "ltr"}>
          {generating ? (
            <AnalysisLoader ticker={stock.ticker} lang={activeLang} />
          ) : genError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <span className="text-4xl">⚠️</span>
              <div>
                <p className="text-sm text-[#ef4444] font-bold mb-1">{genError}</p>
                <p className="text-xs text-white/40">The Gemini AI service may be temporarily unavailable.</p>
              </div>
              <button
                onClick={() => {
                  generatedSet.current.delete(activeLang);
                  generateForLang(activeLang, true);
                }}
                className="px-5 py-2.5 bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#3b82f6]/20 transition-all"
              >
                ↺ Retry Analysis
              </button>
            </div>
          ) : hasContent ? (
            <div className="space-y-7">
              {/* Quote summary */}
              {storedSummary && (
                <div className="relative overflow-hidden bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                  <div className={`absolute ${isRtl ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#3b82f6]`} />
                  <p className="text-base font-bold text-white leading-relaxed italic px-2">
                    "{storedSummary}"
                  </p>
                </div>
              )}

              {/* Main AI content */}
              <AIReportFormatter content={displayContent} />

              {/* Other languages grid */}
              <div className="pt-6 border-t border-white/5">
                <p className="text-[10px] font-black text-[#00d2ff] uppercase tracking-[0.2em] mb-3">
                  Read {stock.ticker} Analysis in Other Languages
                </p>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
                  {ALL_LANGS.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handleLangClick(l.id)}
                      className={`p-2 rounded-xl border transition-all text-center ${
                        l.id === activeLang
                          ? "bg-[#3b82f6]/20 border-[#3b82f6]/50 text-white"
                          : "bg-white/[0.02] border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5"
                      }`}
                    >
                      <div className="text-base leading-none">{l.flag}</div>
                      <p className="text-[8px] text-[#00d2ff] font-black uppercase tracking-wider mt-0.5">
                        {l.id}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* First-load empty state with auto-trigger */
            <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
                <span className="text-2xl">🦅</span>
              </div>
              <div>
                <p className="text-base font-black text-white mb-1">Preparing Daily Briefing</p>
                <p className="text-sm text-[#00d2ff]">
                  BOGA AI is processing the latest trend data for {stock.ticker}.
                </p>
              </div>
              <button
                onClick={() => generateForLang(activeLang, true)}
                className="px-5 py-2.5 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
              >
                Generate Analysis Now
              </button>
            </div>
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-5 py-3 bg-[#0d1117]/80 border-t border-[#1e2a3a] flex items-center justify-between">
          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
            Analysis Engine v5.5 · BOGA AI
          </span>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-[9px] font-black text-[#22c55e] uppercase tracking-widest">
              {generatedSet.current.size}/12 Languages Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
