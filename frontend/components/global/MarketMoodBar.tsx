"use client";

import React, { useEffect, useState } from "react";

interface MoodData {
  regime: string; // e.g. "Bull", "Bear", "Neutral"
  sp500: string;
  nasdaq: string;
  vix: string;
  leader: string;
}

export default function MarketMoodBar() {
  const [mood, setMood] = useState<MoodData | null>(null);

  useEffect(() => {
    // In a real scenario, this would fetch from a specific endpoint or use a global store
    // For now, we simulate fetching the latest summary
    const fetchMood = async () => {
      try {
        // Normally you'd fetch from /api/data/latest/master.json
        setMood({
          regime: "Bull",
          sp500: "+0.8%",
          nasdaq: "Güçlü",
          vix: "14.2",
          leader: "Semiconductor",
        });
      } catch (e) {
        console.error(e);
      }
    };
    fetchMood();
  }, []);

  if (!mood) return null;

  const isRiskOn = mood.regime.toLowerCase().includes("bull") || parseFloat(mood.vix) < 20;

  return (
    <div className="w-full bg-[#0a0e17] border-b border-white/5 py-1.5 px-4 flex items-center justify-center sm:justify-between text-[10px] sm:text-xs font-mono font-medium tracking-wide z-40 relative">
      <div className="flex items-center gap-4 sm:gap-6 w-full max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
        
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRiskOn ? "bg-green-400" : "bg-red-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isRiskOn ? "bg-green-500" : "bg-red-500"}`}></span>
          </span>
          <span className={isRiskOn ? "text-green-400" : "text-red-400"}>
            {isRiskOn ? "RISK-ON" : "RISK-OFF"}
          </span>
        </div>

        {/* Separator */}
        <div className="h-3 w-px bg-white/10 shrink-0"></div>

        {/* Tickers/Info */}
        <div className="flex items-center gap-4 sm:gap-6 whitespace-nowrap text-gray-400">
          <div className="flex items-center gap-1.5">
            <span>S&P 500</span>
            <span className={mood.sp500.startsWith("+") ? "text-green-400" : "text-red-400"}>{mood.sp500}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <span>NASDAQ</span>
            <span className="text-white">{mood.nasdaq}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span>VIX</span>
            <span className={parseFloat(mood.vix) < 15 ? "text-green-400" : "text-yellow-400"}>{mood.vix}</span>
          </div>

          <div className="h-3 w-px bg-white/10 shrink-0 hidden sm:block"></div>

          <div className="flex items-center gap-1.5 hidden sm:flex">
            <span>Lider Sektör:</span>
            <span className="text-blue-400">{mood.leader}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
