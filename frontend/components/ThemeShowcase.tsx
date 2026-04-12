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

  // Split into rows
  // Desktop: 3 rows, Mobile: 2 rows
  // We'll prepare 3 chunks. For mobile, we'll merge chunk 3 into chunk 1/2 or hide it.
  const chunk1 = activeThemes.filter((_, i) => i % 3 === 0);
  const chunk2 = activeThemes.filter((_, i) => i % 3 === 1);
  const chunk3 = activeThemes.filter((_, i) => i % 3 === 2);

  const ThemeButton = ({ theme }: { theme: typeof activeThemes[0] }) => {
    const isSelected = selectedTickers && theme.currentTickers.every(t => selectedTickers.includes(t)) && theme.currentTickers.length === selectedTickers.length;
    
    // Vary font size based on theme name length or index for visual variety
    const fontSizes = ["text-[10px]", "text-[12px]", "text-[14px]", "text-[16px]", "text-[18px]"];
    const fontSize = fontSizes[theme.name.length % fontSizes.length];

    return (
      <button
        key={theme.name}
        onClick={() => onThemeSelect?.(theme.currentTickers)}
        className={`px-4 py-2 rounded-full border font-black transition-all flex items-center gap-2 group whitespace-nowrap ${fontSize} ${
          isSelected 
            ? "bg-[#3b82f6] border-[#3b82f6] text-white shadow-lg shadow-blue-500/20" 
            : "bg-[#141924]/60 backdrop-blur-sm border-[#1e2a3a] text-[#94a3b8] hover:border-[#3b82f6]/50 hover:text-white"
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
        <span className="text-[9px] opacity-60 font-bold px-1.5 py-0.5 rounded-md bg-black/20 group-hover:bg-white/10 transition-colors">
          {theme.activeCount}
        </span>
      </button>
    );
  };

  const MarqueeRow = ({ items, direction }: { items: typeof activeThemes, direction: "left" | "right" }) => (
    <div className="relative flex overflow-hidden py-1 w-full">
      <div className={`flex items-center gap-3 pr-3 ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"} min-w-full`}>
        {items.concat(items).map((item, i) => (
          <ThemeButton key={`${item.name}-${i}`} theme={item} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse"></span>
          Active Market Themes
        </h3>
        <p className="text-[10px] text-[#64748b] font-bold uppercase">Based on today's analysis</p>
      </div>

      <div className="flex flex-col gap-2 pause-on-hover">
        {/* Row 1: Desktop & Mobile */}
        <MarqueeRow items={chunk1} direction="left" />
        
        {/* Row 2: Desktop & Mobile */}
        <MarqueeRow items={chunk2} direction="right" />
        
        {/* Row 3: Desktop Only (Merged into 1/2 on mobile? Or hidden) */}
        <div className="hidden md:block">
          <MarqueeRow items={chunk3} direction="left" />
        </div>
      </div>
    </div>
  );
}
