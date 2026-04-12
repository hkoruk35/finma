"use client";

import { useMemo } from "react";
import { MARKET_THEMES } from "@/lib/themeData";

interface ThemeShowcaseProps {
  activeTickers: string[];
  onThemeSelect?: (tickers: string[]) => void;
  selectedTickers?: string[];
}

export default function ThemeShowcase({ activeTickers, onThemeSelect, selectedTickers }: ThemeShowcaseProps) {
  // Find themes that have at least one active ticker from the provided list
  const activeThemes = useMemo(() => {
    return MARKET_THEMES.filter((theme) =>
      theme.tickers.some((ticker) => activeTickers.includes(ticker))
    ).map((theme) => {
      // Count how many tickers from this theme are active
      const count = theme.tickers.filter((t) => activeTickers.includes(t)).length;
      return { ...theme, activeCount: count };
    }).sort((a, b) => b.activeCount - a.activeCount);
  }, [activeTickers]);

  if (activeThemes.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse"></span>
          Active Market Themes
        </h3>
        <p className="text-[10px] text-[#64748b] font-bold uppercase">Based on today's bot analysis</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeThemes.map((theme) => {
          const isSelected = selectedTickers && theme.tickers.every(t => selectedTickers.includes(t)) && theme.tickers.length === selectedTickers.length;
          
          return (
            <button
              key={theme.name}
              onClick={() => onThemeSelect?.(theme.tickers)}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all flex items-center gap-2 group ${
                isSelected 
                  ? "bg-[#3b82f6] border-[#3b82f6] text-white shadow-lg shadow-blue-500/20" 
                  : "bg-[#141924] border-[#1e2a3a] text-[#94a3b8] hover:border-[#3b82f6]/50 hover:text-white"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                theme.sector === "Technology" ? "bg-blue-400" :
                theme.sector === "Healthcare" ? "bg-emerald-400" :
                theme.sector === "Financials" ? "bg-amber-400" :
                theme.sector === "Energy" ? "bg-orange-400" :
                "bg-[#64748b]"
              }`} />
              {theme.name}
              <span className="text-[9px] opacity-60 px-1.5 py-0.5 rounded-md bg-black/20 group-hover:bg-white/10">
                {theme.activeCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
