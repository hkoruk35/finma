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
    return MARKET_THEMES.map((theme) => {
      // Find which tickers from this theme are actually in our active list
      const activeFromTheme = theme.tickers.filter((t) => activeTickers.includes(t));
      return { ...theme, currentTickers: activeFromTheme, activeCount: activeFromTheme.length };
    })
    .filter(theme => theme.activeCount > 0)
    .sort((a, b) => b.activeCount - a.activeCount);
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

      <div className="flex flex-wrap gap-3">
        {activeThemes.map((theme) => {
          const isSelected = selectedTickers && theme.currentTickers.every(t => selectedTickers.includes(t)) && theme.currentTickers.length === selectedTickers.length;
          
          return (
            <button
              key={theme.name}
              onClick={() => onThemeSelect?.(theme.currentTickers)}
              className={`px-4 py-2 rounded-full border text-[14px] font-bold transition-all flex items-center gap-2.5 group ${
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
