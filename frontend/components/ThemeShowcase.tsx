"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MARKET_THEMES } from "@/lib/themeData";

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

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
    
    // Determine font size based on activeCount and name length for a "word cloud" effect
    // We want a mix of small, medium, large, and extra large
    const getFontSize = () => {
      const base = theme.activeCount;
      if (base > 8) return "text-xl md:text-2xl";
      if (base > 5) return "text-lg md:text-xl";
      if (base > 3) return "text-base md:text-lg";
      return "text-xs md:text-sm";
    };

    const getOpacity = () => {
      if (theme.activeCount > 8) return "opacity-100";
      if (theme.activeCount > 5) return "opacity-90";
      if (theme.activeCount > 3) return "opacity-80";
      return "opacity-70";
    };

    return (
      <Link
        key={theme.name}
        href={`/theme/${slugify(theme.name)}`}
        className={`px-3 py-1.5 md:px-5 md:py-2.5 rounded-full border font-black transition-all flex items-center gap-2 group whitespace-nowrap shadow-xl ${getFontSize()} ${getOpacity()} ${
          isSelected 
            ? "bg-[#3366ff] border-[#3366ff] text-white ring-2 ring-blue-500/50 scale-105" 
            : "bg-[#141924]/40 backdrop-blur-md border-[#ffffff]/10 text-white hover:border-[#3b82f6]/50 hover:text-white hover:scale-105 hover:bg-[#1a2030]"
        }`}
      >
        <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)] ${
          theme.sector === "Technology" ? "bg-blue-400" :
          theme.sector === "Healthcare" ? "bg-emerald-400" :
          theme.sector === "Financials" ? "bg-amber-400" :
          theme.sector === "Energy" ? "bg-orange-400" :
          "bg-[#cbd5e1]"
        }`} />
        <span className="tracking-tight">{theme.name}</span>
        <span className="text-[10px] font-black opacity-40 px-1.5 py-0.5 rounded-md bg-white/5 group-hover:opacity-100 transition-opacity">
          {theme.activeCount}
        </span>
      </Link>
    );
  };

  const MarqueeRow = ({ items, direction }: { items: typeof activeThemes, direction: "left" | "right" }) => (
    <div className="relative flex overflow-x-auto md:overflow-hidden py-2 w-full active:cursor-grabbing scrollbar-hide touch-pan-x select-none">
      <div className={`flex items-center gap-3 pr-3 ${direction === "left" ? "animate-marquee-left" : "animate-marquee-right"} min-w-full md:min-w-max hover:animation-pause`}>
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
        <p className="text-[10px] text-[#00d2ff] font-bold uppercase">Based on today's analysis</p>
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
