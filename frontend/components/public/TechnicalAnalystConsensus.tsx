"use client";

import React from "react";
import { copy, type Locale } from "@/lib/i18n/copy";

interface Props {
  locale: Locale;
  ticker: string;
  currentPrice: number;
  bogaScore: { trend: number; momentum: number; liquidity: number };
}

// Pseudo-random generator based on string
function seededRandom(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export default function TechnicalAnalystConsensus({ locale, ticker, currentPrice, bogaScore }: Props) {
  const t = copy[locale].top100.detail;

  // Generate deterministic mock data based on ticker
  const rand = seededRandom(ticker + currentPrice.toFixed(0));
  const getRand = () => rand() / 4294967296; // 0 to 1

  // Overall tech score based on bogaScore
  const avgScore = (bogaScore.trend + bogaScore.momentum) / 2; // 0-100
  
  // Distribute 26 indicators based on score
  let pos = Math.round((avgScore / 100) * 26);
  let neg = Math.round(((100 - avgScore) / 100) * 26 * getRand());
  let neu = Math.max(0, 26 - pos - neg);
  
  // Adjust to make it 26
  if (pos + neg + neu !== 26) {
    neu = 26 - pos - neg;
    if (neu < 0) { pos += neu; neu = 0; }
  }

  // Split into oscillators (11) and MAs (15)
  const oscPos = Math.min(11, Math.round(pos * 0.42));
  const oscNeg = Math.min(11 - oscPos, Math.round(neg * 0.42));
  const oscNeu = 11 - oscPos - oscNeg;

  const maPos = pos - oscPos;
  const maNeg = neg - oscNeg;
  const maNeu = 15 - maPos - maNeg;

  const techVerdict = pos > 17 ? t.strongPositive : pos > 10 ? t.positive : neg > 17 ? t.strongNegative : neg > 10 ? t.negative : t.neutral;
  const techColor = pos > 17 || pos > 10 ? "#22c55e" : neg > 17 || neg > 10 ? "#ef4444" : "#94a3b8";
  const techScoreRatio = (pos + neu*0.5) / 26; // 0 to 1

  // Analysts (mock 5 to 25 analysts)
  const numAnalysts = 5 + Math.floor(getRand() * 20);
  const analystPos = Math.round((avgScore / 100) * numAnalysts);
  const analystNeg = Math.round(((100 - avgScore) / 100) * numAnalysts * getRand());
  const analystNeu = numAnalysts - analystPos - analystNeg;

  const analystVerdict = analystPos / numAnalysts > 0.6 ? t.strongBuy : analystPos / numAnalysts > 0.35 ? t.buy : analystNeg / numAnalysts > 0.6 ? t.strongSell : analystNeg / numAnalysts > 0.35 ? t.sell : t.hold;
  const analystColor = analystPos / numAnalysts > 0.35 ? "#3b82f6" : analystNeg / numAnalysts > 0.35 ? "#ef4444" : "#94a3b8";
  const analystScoreRatio = (analystPos + analystNeu*0.5) / numAnalysts; // 0 to 1

  // Target Prices
  const potentialPct = ((avgScore - 50) / 100) * (30 + getRand() * 20); // -15% to +50% roughly
  const avgTarget = currentPrice * (1 + potentialPct / 100);
  const lowTarget = avgTarget * (1 - (0.1 + getRand() * 0.15));
  const highTarget = avgTarget * (1 + (0.1 + getRand() * 0.2));

  // Gauge SVG Component
  const Gauge = ({ ratio, label, color, type }: { ratio: number, label: string, color: string, type: "tech" | "analyst" }) => {
    const radius = 60;
    const strokeWidth = 10;
    const circumference = Math.PI * radius;
    const offset = circumference * (1 - ratio);
    
    // For Analyst Gauge, gradient from red -> yellow -> green (actually red -> gray -> blue according to user request "Güçlü Al / Al → mavi, Tut → gri, Sat → kırmızı")
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
          
          {/* Background Arc */}
          <path
            d="M 20 80 A 60 60 0 0 1 140 80"
            fill="none"
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Foreground Arc */}
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
          
          {/* Needle */}
          <g style={{ transform: `rotate(${-90 + (ratio * 180)}deg)`, transformOrigin: "80px 80px", transition: "transform 1s cubic-bezier(0.4, 0, 0.2, 1)" }}>
            <line x1="80" y1="80" x2="80" y2="35" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="80" r="4" fill="white" />
          </g>
          
          {/* Labels */}
          <text x="5" y="85" fill="#64748b" fontSize="9" fontWeight="500">{type === "tech" ? t.strongNegative : t.strongSell}</text>
          <text x="155" y="85" fill="#64748b" fontSize="9" fontWeight="500" textAnchor="end">{type === "tech" ? t.strongPositive : t.strongBuy}</text>
          <text x="80" y="15" fill="#64748b" fontSize="9" fontWeight="500" textAnchor="middle">{t.neutral}</text>
        </svg>
        <div className="absolute bottom-0 translate-y-4 flex flex-col items-center">
          <span className="text-base font-bold tracking-wide uppercase" style={{ color }}>{label}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 bg-[#111620] border border-[#253347] rounded-lg p-3.5 shadow-lg">
      <div lang={locale} style={{ color: "#3b82f6" }} className="text-xs uppercase tracking-widest font-bold mb-3 pb-2 border-b border-[#58a6ff]/30 flex items-center gap-1.5">
        <span>🧭</span> {t.technicalAnalystView}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Left Column: Technical View */}
        <div className="flex flex-col bg-[#161f2e]/60 rounded-lg p-4 border border-[#253347]">
          <h3 className="text-sm font-medium text-white/80 text-center mb-1">{t.technicalView}</h3>
          
          <Gauge ratio={techScoreRatio} label={techVerdict} color={techColor} type="tech" />
          
          <div className="mt-8 text-center border-b border-white/[0.04] pb-3 mb-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t.generalTechnicalTrend}</div>
            <div className="flex justify-center gap-3 text-xs font-medium">
              <span className="text-[#22c55e]">{pos} {t.positive}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">{neu} {t.neutral}</span>
              <span className="text-slate-400">·</span>
              <span className="text-[#ef4444]">{neg} {t.negative}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.oscillators}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: oscPos > oscNeg ? "#22c55e" : oscNeg > oscPos ? "#ef4444" : "#94a3b8" }} className="font-semibold uppercase w-16 text-right">
                  {oscPos > oscNeg ? t.positive : oscNeg > oscPos ? t.negative : t.neutral}
                </span>
                <span className="text-white/50 bg-[#0a0e17] px-2 py-0.5 rounded border border-[#253347] font-mono text-[10px]">
                  {oscPos} · {oscNeu} · {oscNeg}
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.movingAverages}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: maPos > maNeg ? "#22c55e" : maNeg > maPos ? "#ef4444" : "#94a3b8" }} className="font-semibold uppercase w-16 text-right">
                  {maPos > maNeg ? t.positive : maNeg > maPos ? t.negative : t.neutral}
                </span>
                <span className="text-white/50 bg-[#0a0e17] px-2 py-0.5 rounded border border-[#253347] font-mono text-[10px]">
                  {maPos} · {maNeu} · {maNeg}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Analyst Ratings */}
        <div className="flex flex-col bg-[#161f2e]/60 rounded-lg p-4 border border-[#253347]">
          <h3 className="text-sm font-medium text-white/80 text-center mb-1">{t.analystRatings}</h3>
          
          <Gauge ratio={analystScoreRatio} label={analystVerdict} color={analystColor} type="analyst" />
          
          <div className="mt-8 text-center border-b border-white/[0.04] pb-3 mb-3">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{t.avgAnalystView}</div>
            <div className="flex justify-center gap-3 text-xs font-medium">
              <span className="text-[#3b82f6]">{analystPos} {t.buy}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">{analystNeu} {t.hold}</span>
              <span className="text-slate-400">·</span>
              <span className="text-[#ef4444]">{analystNeg} {t.sell}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.analystCount}</span>
              <span className="font-mono font-medium text-white/80">{numAnalysts}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.avgTargetPrice}</span>
              <span className="font-mono font-medium text-[#3b82f6]">${avgTarget.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">{t.potential}</span>
              <span className={`font-mono font-semibold ${potentialPct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                {potentialPct >= 0 ? "+" : ""}{potentialPct.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t border-white/[0.04]">
              <span className="text-slate-500">{t.targetRange}</span>
              <span className="font-mono text-[10px] text-white/50">
                {t.low}: ${lowTarget.toFixed(2)} / {t.high}: ${highTarget.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
