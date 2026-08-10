"use client";

import React, { useEffect, useState } from "react";
import { getMasterData, type MasterData } from "@/lib/data";
import { formatNumber } from "@/lib/formatNumber";

interface MoodData {
  regime: string;
  sp500Change: number | null;
  nasdaqChange: number | null;
  vix: number | null;
  leaderSector: string | null;
}

const REFRESH_MS = 5 * 60 * 1000; // veri kaynağı saat başı güncelleniyor, 5dk yeterli

function deriveMood(data: MasterData): MoodData {
  const indices = data.market_indices || {};
  const sp500 = indices.SP500 || indices["S&P500"] || indices["SPX"];
  const nasdaq = indices.NASDAQ || indices["IXIC"];
  const vixEntry = indices.VIX;

  let leaderSector: string | null = null;
  let bestScore = -Infinity;
  for (const [name, s] of Object.entries(data.sector_summary || {})) {
    if (s && typeof s.avg_score === "number" && s.avg_score > bestScore) {
      bestScore = s.avg_score;
      leaderSector = name;
    }
  }

  return {
    regime: data.market_regime || "Neutral",
    sp500Change: sp500?.change_pct ?? null,
    nasdaqChange: nasdaq?.change_pct ?? null,
    vix: vixEntry?.value ?? null,
    leaderSector,
  };
}

export default function MarketMoodBar() {
  const [mood, setMood] = useState<MoodData | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await getMasterData();
      if (!cancelled && data && !data.is_mock) {
        setMood(deriveMood(data));
      }
    };

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Gerçek veri gelene kadar (veya hiç gelmezse) hiçbir şey gösterme —
  // sahte/placeholder piyasa verisi asla render edilmez.
  if (!mood) return null;

  const regimeLower = mood.regime.toLowerCase();
  const isRiskOn =
    regimeLower.includes("bull") ||
    regimeLower.includes("trend") ||
    (mood.vix !== null && mood.vix < 20 && !regimeLower.includes("bear") && !regimeLower.includes("choppy"));

  const fmtPct = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${formatNumber(v, 2)}%`);

  return (
    <div className="w-full bg-[#0a0e17] border-b border-white/5 py-1.5 px-4 flex items-center justify-center sm:justify-between text-[10px] sm:text-xs font-mono font-medium tracking-wide z-40 relative">
      <div className="flex items-center gap-4 sm:gap-6 w-full max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRiskOn ? "bg-green-400" : "bg-red-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isRiskOn ? "bg-green-500" : "bg-red-500"}`}></span>
          </span>
          <span className={isRiskOn ? "text-green-400" : "text-red-400"}>
            {isRiskOn ? "RISK-ON" : "RISK-OFF"}
          </span>
        </div>

        <div className="h-3 w-px bg-white/10 shrink-0"></div>

        <div className="flex items-center gap-4 sm:gap-6 whitespace-nowrap text-gray-400">
          {mood.sp500Change !== null && (
            <div className="flex items-center gap-1.5">
              <span>S&P 500</span>
              <span className={mood.sp500Change >= 0 ? "text-green-400" : "text-red-400"}>{fmtPct(mood.sp500Change)}</span>
            </div>
          )}

          {mood.nasdaqChange !== null && (
            <div className="flex items-center gap-1.5">
              <span>NASDAQ</span>
              <span className={mood.nasdaqChange >= 0 ? "text-green-400" : "text-red-400"}>{fmtPct(mood.nasdaqChange)}</span>
            </div>
          )}

          {mood.vix !== null && (
            <div className="flex items-center gap-1.5">
              <span>VIX</span>
              <span className={mood.vix < 15 ? "text-green-400" : mood.vix < 25 ? "text-yellow-400" : "text-red-400"}>{formatNumber(mood.vix, 1)}</span>
            </div>
          )}

          {mood.leaderSector && (
            <>
              <div className="h-3 w-px bg-white/10 shrink-0 hidden sm:block"></div>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <span>Lider Sektör:</span>
                <span className="text-blue-400">{mood.leaderSector}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
