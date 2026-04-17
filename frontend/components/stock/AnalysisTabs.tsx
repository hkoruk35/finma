"use client";

import { useState } from "react";
import { StockDetail, formatPrice } from "@/lib/data";

interface Props {
  stock: StockDetail;
}

type TabType = "ai" | "technical" | "fundamental";
type LangTab = "en" | "tr" | "es" | "pt" | "fr" | "id";

const LANG_LABELS: { id: LangTab; flag: string; name: string }[] = [
  { id: "en", flag: "🇺🇸", name: "English" },
  { id: "tr", flag: "🇹🇷", name: "Türkçe" },
  { id: "es", flag: "🇪🇸", name: "Español" },
  { id: "pt", flag: "🇧🇷", name: "Português" },
  { id: "fr", flag: "🇫🇷", name: "Français" },
  { id: "id", flag: "🇮🇩", name: "Bahasa" },
];

// Resolve AI content from multiple possible key formats
function getAIContent(
  ai: any,
  type: "detail" | "tech_ins" | "quant_ins",
  lang: LangTab
): string {
  if (!ai || typeof ai === "string") {
    // Plain string from old bot — only English
    if (type === "detail") return ai || "";
    return "";
  }

  if (typeof ai !== "object") return "";

  // Format A: {detail: {en, tr, ...}} — from update_summaries_now.py
  if (ai[type]?.[lang]) return ai[type][lang];

  // Format B: {detail_summary: {en, tr, ...}} — from swing picks bot
  const altMap: Record<string, string> = {
    detail: "detail_summary",
    tech_ins: "tech_insight",
    quant_ins: "fundamental_insight",
  };
  const altKey = altMap[type];
  if (altKey && ai[altKey]?.[lang]) return ai[altKey][lang];

  // Fallback to English if requested lang is missing
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

// Human-readable labels for technical indicators
function rsiLabel(v: number): { text: string; color: string } {
  if (v >= 70) return { text: "Overbought — cautious", color: "text-[#f59e0b]" };
  if (v >= 60) return { text: "Strong momentum", color: "text-[#22c55e]" };
  if (v >= 45) return { text: "Neutral zone", color: "text-[#94a3b8]" };
  if (v >= 30) return { text: "Weak — watch for reversal", color: "text-[#f59e0b]" };
  return { text: "Oversold — potential bounce", color: "text-[#ef4444]" };
}

function adxLabel(v: number): { text: string; color: string } {
  if (v >= 40) return { text: "Very strong trend", color: "text-[#22c55e]" };
  if (v >= 25) return { text: "Confirmed trend", color: "text-[#22c55e]" };
  if (v >= 15) return { text: "Weak trend forming", color: "text-[#f59e0b]" };
  return { text: "No clear trend", color: "text-[#94a3b8]" };
}

function macdLabel(v: number): { text: string; color: string } {
  if (v > 0.5) return { text: "Bullish momentum building", color: "text-[#22c55e]" };
  if (v > 0) return { text: "Mildly bullish", color: "text-[#22c55e]" };
  if (v > -0.5) return { text: "Mildly bearish", color: "text-[#ef4444]" };
  return { text: "Bearish pressure", color: "text-[#ef4444]" };
}

function marginColor(v: number): string {
  if (v >= 0.3) return "text-[#22c55e]";
  if (v >= 0.1) return "text-[#f59e0b]";
  return "text-[#ef4444]";
}

export default function AnalysisTabs({ stock }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("ai");
  const [activeLang, setActiveLang] = useState<LangTab>("en");

  const ai = (stock as any).ai_summary;
  const swing = (stock as any)._swing;
  const tech = stock.technical || {};
  const fund = stock.fundamental || {};

  const homeSummary = getHomePageSummary(ai, activeLang);
  const detailContent = getAIContent(ai, "detail", activeLang);
  const techInsight = getAIContent(ai, "tech_ins", activeLang);
  const quantInsight = getAIContent(ai, "quant_ins", activeLang);

  const hasAI = !!(detailContent && detailContent.length > 20);

  // Technical values
  const rsi = swing?.trend_status?.rsi_14 ?? tech.rsi_14 ?? 50;
  const adx = swing?.trend_status?.adx ?? tech.adx ?? 20;
  const macdHist = swing?.trend_status?.macd_hist ?? tech.macd_histogram ?? 0;
  const mfi = swing?.trend_status?.mfi ?? tech.mfi ?? 50;
  const rvol = swing?.trend_status?.rvol_today ?? tech.rvol ?? 1;
  const ema20 = swing?.moving_averages?.ema_20 ?? tech.ema_20;
  const ema50 = swing?.moving_averages?.ema_50 ?? tech.ema_50;
  const ema200 = swing?.moving_averages?.ema_200 ?? tech.ema_200;
  const pctVsEma20 = swing?.moving_averages?.price_vs_ema20;
  const pctVsEma50 = swing?.moving_averages?.price_vs_ema50;
  const pctVsEma200 = swing?.moving_averages?.price_vs_ema200;
  const trendLabel = swing?.trend_status?.trend ?? (tech.ema_stack_bullish ? "Bullish" : "Mixed");

  // Fundamental values
  const grossMargin = fund.gross_margin ?? swing?.fundamentals?.gross_margin ?? 0;
  const opMargin = fund.operating_margin ?? swing?.fundamentals?.operating_margin ?? 0;
  const netMargin = fund.net_margin ?? swing?.fundamentals?.net_margin ?? 0;
  const revenueGrowth = fund.revenue_growth_ttm ?? swing?.fundamentals?.revenue_growth ?? 0;
  const pe = fund.pe_ratio ?? swing?.fundamentals?.pe_ratio ?? 0;
  const pb = fund.pb_ratio ?? swing?.fundamentals?.pb_ratio ?? 0;
  const fcfYield = fund.fcf_yield ?? swing?.fundamentals?.fcf_yield ?? 0;
  const marketCap = fund.market_cap ?? swing?.fundamentals?.market_cap ?? 0;

  const tabs = [
    { id: "ai" as TabType, label: "BOGA AI BRIEFING", icon: "🦅" },
    { id: "technical" as TabType, label: "TECHNICAL", icon: "📈" },
    { id: "fundamental" as TabType, label: "FUNDAMENTALS", icon: "🧬" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Language selector — always visible, above tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {LANG_LABELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveLang(l.id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 border ${
              activeLang === l.id
                ? "bg-[#3b82f6] border-[#3b82f6] text-white"
                : "border-[#1e2a3a] text-[#64748b] hover:text-white hover:border-[#3b82f6]/40 hover:bg-white/5"
            }`}
          >
            <span className="leading-none">{l.flag}</span>
            <span className="uppercase tracking-wide">{l.id.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* Tab selector */}
      <div className="grid grid-cols-3 gap-1.5 bg-[#0d1117] p-1.5 rounded-xl border border-[#1e2a3a]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-2.5 px-2 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-[#3b82f6] text-white shadow-[0_0_16px_rgba(59,130,246,0.25)]"
                : "text-[#64748b] hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── AI BRIEFING TAB ── */}
      {activeTab === "ai" && (
        <div className="glass-card overflow-hidden border-t-2 border-t-[#3b82f6]">
          {/* Panel header */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#1e2a3a] bg-[#0d1117]/60">
            <div className="w-1.5 h-5 bg-[#3b82f6] rounded-full" />
            <span className="text-xs font-black text-white uppercase tracking-widest">
              BOGA AI Analysis Engine
            </span>
          </div>

          <div className="p-5 md:p-8">
            {hasAI ? (
              <div className="space-y-6">
                {/* Quick summary pill */}
                {homeSummary && (
                  <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/25 rounded-xl p-4">
                    <p className="text-sm font-bold text-[#93c5fd] leading-relaxed">
                      {homeSummary}
                    </p>
                  </div>
                )}
                {/* Full analysis */}
                <div className="text-[#cbd5e1] leading-[1.85] text-base md:text-lg whitespace-pre-wrap">
                  {detailContent}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-[#3b82f6]/10 flex items-center justify-center">
                  <span className="text-2xl">🦅</span>
                </div>
                <p className="text-sm font-bold text-[#64748b]">
                  AI analysis is being generated for this stock.
                </p>
                <p className="text-xs text-[#475569]">Check back shortly.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TECHNICAL TAB ── */}
      {activeTab === "technical" && (
        <div className="flex flex-col gap-4">
          <div className="glass-card p-5 md:p-6">
            {/* Trend overview */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#1e2a3a]">
              <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                trendLabel?.toLowerCase().includes("bull") || trendLabel?.toLowerCase().includes("makro")
                  ? "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30"
                  : trendLabel?.toLowerCase().includes("bear")
                  ? "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30"
                  : "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30"
              }`}>
                {trendLabel || "Mixed"}
              </div>
              <span className="text-xs text-[#64748b]">Daily Trend</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Momentum Signals */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#3b82f6] uppercase tracking-[0.2em] mb-4">
                  📊 Momentum Signals
                </h4>
                {[
                  {
                    name: "RSI (14)",
                    value: rsi?.toFixed(1),
                    context: rsiLabel(rsi),
                  },
                  {
                    name: "ADX — Trend Strength",
                    value: adx?.toFixed(1),
                    context: adxLabel(adx),
                  },
                  {
                    name: "MACD Histogram",
                    value: macdHist?.toFixed(3),
                    context: macdLabel(macdHist),
                  },
                  {
                    name: "Money Flow (MFI)",
                    value: mfi?.toFixed(1),
                    context: mfi > 60
                      ? { text: "Strong institutional inflow", color: "text-[#22c55e]" }
                      : mfi < 40
                      ? { text: "Outflow pressure", color: "text-[#ef4444]" }
                      : { text: "Neutral flow", color: "text-[#94a3b8]" },
                  },
                  {
                    name: "Relative Volume",
                    value: `${rvol?.toFixed(2)}x`,
                    context: rvol > 1.5
                      ? { text: "High activity vs average", color: "text-[#22c55e]" }
                      : rvol < 0.7
                      ? { text: "Below-average volume", color: "text-[#94a3b8]" }
                      : { text: "Normal volume", color: "text-[#94a3b8]" },
                  },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-0.5">
                        {row.name}
                      </p>
                      <p className={`text-[11px] font-medium ${row.context.color}`}>
                        {row.context.text}
                      </p>
                    </div>
                    <span className="font-mono font-black text-white text-lg shrink-0">
                      {row.value ?? "—"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Moving Averages */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#8b5cf6] uppercase tracking-[0.2em] mb-4">
                  📉 Moving Averages
                </h4>
                {[
                  { label: "EMA 20 — Short Term", value: ema20, pct: pctVsEma20 },
                  { label: "EMA 50 — Medium Term", value: ema50, pct: pctVsEma50 },
                  { label: "EMA 200 — Long Term", value: ema200, pct: pctVsEma200 },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-0.5">
                        {row.label}
                      </p>
                      {row.pct !== undefined && (
                        <p className={`text-[11px] font-medium ${row.pct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                          Price is {row.pct >= 0 ? "+" : ""}{(row.pct * 100)?.toFixed(1)}% vs this level
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-black text-white text-lg shrink-0">
                      {row.value ? `$${formatPrice(row.value)}` : "—"}
                    </span>
                  </div>
                ))}

                {/* Factor scores if available */}
                {swing?.factor_scores && (
                  <div className="mt-4 pt-4 border-t border-[#1e2a3a]">
                    <h4 className="text-[10px] font-black text-[#f59e0b] uppercase tracking-[0.2em] mb-3">
                      🏅 BOGA Factor Scores
                    </h4>
                    {Object.entries(swing.factor_scores as Record<string, number>).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] text-[#64748b] uppercase tracking-wider w-28 shrink-0">
                          {key.replace("_score", "").replace("_", " ")}
                        </span>
                        <div className="flex-1 h-1.5 bg-[#1e2a3a] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3b82f6] rounded-full"
                            style={{ width: `${Math.min(val, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono font-black text-white w-8 text-right">
                          {typeof val === "number" ? val.toFixed(0) : val}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI technical insight box */}
          {techInsight && (
            <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-xl p-5 flex gap-4 items-start">
              <span className="text-2xl shrink-0">🤖</span>
              <div>
                <p className="text-[10px] font-black text-[#3b82f6] uppercase tracking-widest mb-2">
                  AI Technical Insight
                </p>
                <p className="text-sm text-[#cbd5e1] leading-relaxed">{techInsight}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FUNDAMENTALS TAB ── */}
      {activeTab === "fundamental" && (
        <div className="flex flex-col gap-4">
          <div className="glass-card p-5 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profitability */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em] mb-4">
                  💰 Profitability
                </h4>
                {[
                  {
                    label: "Gross Margin",
                    desc: "Revenue kept after production costs",
                    value: grossMargin,
                    fmt: "pct",
                  },
                  {
                    label: "Operating Margin",
                    desc: "Efficiency of core operations",
                    value: opMargin,
                    fmt: "pct",
                  },
                  {
                    label: "Net Profit Margin",
                    desc: "Actual profit per $100 of sales",
                    value: netMargin,
                    fmt: "pct",
                  },
                  {
                    label: "Revenue Growth (YoY)",
                    desc: "Annual top-line expansion",
                    value: revenueGrowth,
                    fmt: "pct",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-0.5">
                        {row.label}
                      </p>
                      <p className="text-[10px] text-[#475569]">{row.desc}</p>
                    </div>
                    <span className={`font-mono font-black text-lg shrink-0 ${marginColor(row.value)}`}>
                      {row.value ? `${(row.value * 100).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Valuation */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-[#f59e0b] uppercase tracking-[0.2em] mb-4">
                  🧮 Valuation
                </h4>
                {[
                  {
                    label: "P/E Ratio",
                    desc: "Price paid per $1 of earnings",
                    raw: pe,
                    fmt: "x",
                  },
                  {
                    label: "P/B Ratio",
                    desc: "Price vs book value of assets",
                    raw: pb,
                    fmt: "x",
                  },
                  {
                    label: "FCF Yield",
                    desc: "Free cash flow relative to market cap",
                    raw: fcfYield,
                    fmt: "pct",
                  },
                  {
                    label: "Market Cap",
                    desc: "Total company market value",
                    raw: marketCap,
                    fmt: "cap",
                  },
                ].map((row) => {
                  let display = "—";
                  if (row.raw) {
                    if (row.fmt === "x") display = `${Number(row.raw).toFixed(2)}x`;
                    else if (row.fmt === "pct") display = `${(Number(row.raw) * 100).toFixed(2)}%`;
                    else if (row.fmt === "cap")
                      display =
                        row.raw >= 1e12
                          ? `$${(row.raw / 1e12).toFixed(2)}T`
                          : `$${(row.raw / 1e9).toFixed(2)}B`;
                  }
                  return (
                    <div
                      key={row.label}
                      className="bg-[#141924] rounded-xl p-3 border border-[#1e2a3a] flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-0.5">
                          {row.label}
                        </p>
                        <p className="text-[10px] text-[#475569]">{row.desc}</p>
                      </div>
                      <span className="font-mono font-black text-white text-lg shrink-0">
                        {display}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI fundamental insight */}
          {quantInsight && (
            <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-xl p-5 flex gap-4 items-start">
              <span className="text-2xl shrink-0">🤖</span>
              <div>
                <p className="text-[10px] font-black text-[#10b981] uppercase tracking-widest mb-2">
                  AI Fundamental Insight
                </p>
                <p className="text-sm text-[#cbd5e1] leading-relaxed">{quantInsight}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
