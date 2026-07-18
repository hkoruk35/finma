"use client";

import React from "react";
import { useRouter } from "next/navigation";

export interface StockCardProps {
  ticker: string;
  companyName: string;
  trend: "Bullish" | "Bearish" | "Neutral";
  bogaScore: number;
  riskLevel: string;
  support: number;
  resistance: number;
  target: number;
  summary: string;
}

export function StockCard({ data }: { data: StockCardProps }) {
  const router = useRouter();

  const isBullish = data.trend === "Bullish";
  const trendColor = isBullish ? "text-green-400" : data.trend === "Bearish" ? "text-red-400" : "text-yellow-400";
  const trendBg = isBullish ? "bg-green-500/10 border-green-500/20" : data.trend === "Bearish" ? "bg-red-500/10 border-red-500/20" : "bg-yellow-500/10 border-yellow-500/20";

  return (
    <div className="w-full bg-[#0a0e17] rounded-xl border border-[#388bfd33] overflow-hidden shadow-xl shadow-blue-500/5 my-3 relative">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-start justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-bold text-white">{data.ticker}</h4>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${trendBg} ${trendColor}`}>
              {data.trend}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{data.companyName}</p>
        </div>
        <div className="relative z-10 flex flex-col items-end">
          <span className="text-[10px] text-gray-500 font-mono">BOGA SCORE</span>
          <div className="text-lg font-bold text-white flex items-center gap-1">
            {data.bogaScore}
            <span className="text-xs text-gray-500">/100</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-300 leading-relaxed">
          {data.summary}
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#161b22] p-2.5 rounded-lg border border-white/5 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 font-mono mb-1">DESTEK</span>
            <span className="text-sm font-semibold text-white">${data.support.toFixed(2)}</span>
          </div>
          <div className="bg-[#161b22] p-2.5 rounded-lg border border-white/5 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 font-mono mb-1">DİRENÇ</span>
            <span className="text-sm font-semibold text-white">${data.resistance.toFixed(2)}</span>
          </div>
          <div className="bg-[#161b22] p-2.5 rounded-lg border border-white/5 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 font-mono mb-1">HEDEF</span>
            <span className="text-sm font-semibold text-blue-400">${data.target.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-gray-400">Risk Profili:</span>
          <span className="text-white font-medium">{data.riskLevel}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 bg-[#161b22] border-t border-white/5 grid grid-cols-2 gap-2">
        <button 
          onClick={() => router.push(`/global/tr/graphic/${data.ticker}`)}
          className="py-2 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
          Grafiği Aç
        </button>
        <button 
          className="py-2 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium rounded-lg border border-white/10 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Portföye Ekle
        </button>
      </div>
    </div>
  );
}
