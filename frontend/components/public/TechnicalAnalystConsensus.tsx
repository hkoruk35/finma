"use client";

import React, { useEffect, useState } from "react";
import { copy, type Locale } from "@/lib/i18n/copy";
import AnalystForecastChart from "./AnalystForecastChart";

interface Props {
  locale: Locale;
  ticker: string;
}

interface ConsensusResponse {
  ok: boolean;
  computedAt: string;
  priceAtComputation: number;
  technical: { oscPos: number; oscNeu: number; oscNeg: number; maPos: number; maNeu: number; maNeg: number; pos: number; neu: number; neg: number };
  analyst: {
    hasCoverage: boolean;
    strongBuy: number; buy: number; hold: number; sell: number; strongSell: number; count: number;
    targetMean: number | null; targetLow: number | null; targetHigh: number | null; targetMedian: number | null;
  };
  aiSummary: string;
  error?: string;
}

// Gauge SVG bileşeni — GERÇEK oranla çizilir, mock veri üretmez.
function Gauge({ ratio, label, color, type }: { ratio: number; label: string; color: string; type: "tech" | "analyst" }) {
  const radius = 60;
  const strokeWidth = 10;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - ratio);
  const gradientId = "gaugeGrad-" + type;
  const leftColor = "#ef4444";
  const midColor = "#94a3b8";
  const rightColor = type === "tech" ? "#22c55e" : "#3b82f6";

  return (
    <div className="relative flex flex-col items-center justify-center h-32 w-full mt-2">
      <svg width="180" height="90" viewBox="0 0 160 80" className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={leftColor} />
            <stop offset="50%" stopColor={midColor} />
            <stop offset="100%" stopColor={rightColor} />
          </linearGradient>
        </defs>
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="#1e293b" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path
          d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <g style={{ transform: `rotate(${-90 + ratio * 180}deg)`, transformOrigin: "80px 80px", transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)" }}>
          <line x1="80" y1="80" x2="80" y2="35" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="80" cy="80" r="4" fill="white" />
        </g>
      </svg>
      <div className="absolute bottom-0 translate-y-4 flex flex-col items-center">
        <span className="text-base font-medium tracking-wide uppercase" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

export default function TechnicalAnalystConsensus({ locale, ticker }: Props) {
  const t = copy[locale].top100.detail;
  const [data, setData] = useState<ConsensusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setData(null);
    fetch(`/api/technical-analyst-consensus?ticker=${encodeURIComponent(ticker)}&lang=${locale}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.ok) { setFailed(true); return; }
        setData(json);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker, locale]);

  if (loading) {
    return (
      <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5 shadow-lg">
        <div lang={locale} style={{ color: "#3b82f6" }} className="text-xs uppercase tracking-widest font-medium mb-3 pb-2 border-b border-[#58a6ff]/30">
          {t.technicalAnalystView}
        </div>
        <div className="text-xs text-slate-500 py-6 text-center">{t.loading}</div>
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5 shadow-lg">
        <div lang={locale} style={{ color: "#3b82f6" }} className="text-xs uppercase tracking-widest font-medium mb-3 pb-2 border-b border-[#58a6ff]/30">
          {t.technicalAnalystView}
        </div>
        <div className="text-xs text-slate-500 py-6 text-center">{t.error}</div>
      </div>
    );
  }

  const { technical: tech, analyst } = data;

  const techVerdict = tech.pos > 17 ? t.strongPositive : tech.pos > 10 ? t.positive : tech.neg > 17 ? t.strongNegative : tech.neg > 10 ? t.negative : t.neutral;
  const techColor = tech.pos > 10 ? "#22c55e" : tech.neg > 10 ? "#ef4444" : "#94a3b8";
  const techScoreRatio = (tech.pos + tech.neu * 0.5) / 26;

  const numAnalysts = analyst.count;
  const analystPos = analyst.strongBuy + analyst.buy;
  const analystNeg = analyst.sell + analyst.strongSell;
  const analystVerdict = numAnalysts === 0 ? "" : analystPos / numAnalysts > 0.6 ? t.strongBuy : analystPos / numAnalysts > 0.35 ? t.buy : analystNeg / numAnalysts > 0.6 ? t.strongSell : analystNeg / numAnalysts > 0.35 ? t.sell : t.hold;
  const analystColor = analystPos / Math.max(1, numAnalysts) > 0.35 ? "#3b82f6" : analystNeg / Math.max(1, numAnalysts) > 0.35 ? "#ef4444" : "#94a3b8";
  const analystScoreRatio = numAnalysts > 0 ? (analystPos + analyst.hold * 0.5) / numAnalysts : 0.5;

  const potentialPct = analyst.targetMean != null && data.priceAtComputation > 0 ? ((analyst.targetMean - data.priceAtComputation) / data.priceAtComputation) * 100 : null;

  return (
    <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5 shadow-lg">
      <div lang={locale} style={{ color: "#3b82f6" }} className="text-xs uppercase tracking-widest font-medium mb-3 pb-2 border-b border-[#58a6ff]/30">
        {t.technicalAnalystView}
      </div>

      {data.aiSummary && (
        <div className="mb-3 text-xs text-slate-400 leading-relaxed">{data.aiSummary}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sol Sütun: Teknik Görünüm */}
        <div className="flex flex-col bg-[#161f2e]/60 rounded-lg p-4 border border-[#253347]">
          <h3 className="text-sm font-medium text-white/80 text-center mb-1">{t.technicalView}</h3>
          <Gauge ratio={techScoreRatio} label={techVerdict} color={techColor} type="tech" />
          <div className="mt-8 text-center border-b border-white/[0.04] pb-3 mb-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t.generalTechnicalTrend}</div>
            <div className="flex justify-center gap-3 text-xs font-medium">
              <span className="text-[#22c55e]">{tech.pos} {t.positive}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">{tech.neu} {t.neutral}</span>
              <span className="text-slate-400">·</span>
              <span className="text-[#ef4444]">{tech.neg} {t.negative}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.oscillators}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: tech.oscPos > tech.oscNeg ? "#22c55e" : tech.oscNeg > tech.oscPos ? "#ef4444" : "#94a3b8" }} className="font-medium uppercase w-16 text-right">
                  {tech.oscPos > tech.oscNeg ? t.positive : tech.oscNeg > tech.oscPos ? t.negative : t.neutral}
                </span>
                <span className="text-white/50 bg-[#0a0e17] px-2 py-0.5 rounded border border-[#253347] font-mono text-[10px]">
                  {tech.oscPos} · {tech.oscNeu} · {tech.oscNeg}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.movingAverages}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: tech.maPos > tech.maNeg ? "#22c55e" : tech.maNeg > tech.maPos ? "#ef4444" : "#94a3b8" }} className="font-medium uppercase w-16 text-right">
                  {tech.maPos > tech.maNeg ? t.positive : tech.maNeg > tech.maPos ? t.negative : t.neutral}
                </span>
                <span className="text-white/50 bg-[#0a0e17] px-2 py-0.5 rounded border border-[#253347] font-mono text-[10px]">
                  {tech.maPos} · {tech.maNeu} · {tech.maNeg}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Sütun: Analist Görüşleri — kapsam yoksa GERÇEĞE UYGUN boş durum, asla sahte sayı yok */}
        <div className="flex flex-col bg-[#161f2e]/60 rounded-lg p-4 border border-[#253347]">
          <h3 className="text-sm font-medium text-white/80 text-center mb-1">{t.analystRatings}</h3>
          {!analyst.hasCoverage ? (
            <div className="flex-1 flex items-center justify-center py-8">
              <span className="text-xs text-slate-500">{t.noAnalystCoverage}</span>
            </div>
          ) : (
            <>
              <Gauge ratio={analystScoreRatio} label={analystVerdict} color={analystColor} type="analyst" />
              <div className="mt-8 text-center border-b border-white/[0.04] pb-3 mb-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t.avgAnalystView}</div>
                <div className="flex justify-center gap-3 text-xs font-medium">
                  <span className="text-[#3b82f6]">{analystPos} {t.buy}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{analyst.hold} {t.hold}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[#ef4444]">{analystNeg} {t.sell}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{t.analystCount}</span>
                  <span className="font-mono font-medium text-white/80">{numAnalysts}</span>
                </div>
                {analyst.targetMean != null && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{t.avgTargetPrice}</span>
                    <span className="font-mono font-medium text-[#3b82f6]">${analyst.targetMean.toFixed(2)}</span>
                  </div>
                )}
                {potentialPct != null && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">{t.potential}</span>
                    <span className={`font-mono font-medium ${potentialPct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                      {potentialPct >= 0 ? "+" : ""}{potentialPct.toFixed(2)}%
                    </span>
                  </div>
                )}
                {(analyst.targetLow != null && analyst.targetHigh != null) && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-white/[0.04]">
                    <span className="text-slate-500">{t.targetRange}</span>
                    <span className="font-mono text-[10px] text-white/50">
                      {t.low}: ${analyst.targetLow.toFixed(2)} / {t.high}: ${analyst.targetHigh.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <AnalystForecastChart 
        locale={locale} 
        ticker={ticker} 
        currentPrice={data.priceAtComputation}
        numAnalysts={numAnalysts}
        maxTarget={analyst.targetHigh ?? 0}
        avgTarget={analyst.targetMean ?? 0}
        minTarget={analyst.targetLow ?? 0}
      />
    </div>
  );
}
