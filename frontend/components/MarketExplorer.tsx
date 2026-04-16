"use client";

import { useState } from "react";
import ThemeShowcase from "./ThemeShowcase";
import CategoryTabs from "./CategoryTabs";
import { MasterData, StockQuickView } from "@/lib/data";

interface Props {
  master: MasterData;
  allTickers: StockQuickView[];
}

export default function MarketExplorer({ master, allTickers }: Props) {
  const [themeFilter, setThemeFilter] = useState<string[] | null>(null);

  // Use ALL scanned tickers for Active Market Themes
  const activeTickers = allTickers.map(t => t.ticker);

  const handleThemeSelect = (tickers: string[]) => {
    // If clicking same theme, clear filter. Else set it.
    if (themeFilter && themeFilter.join(',') === tickers.join(',')) {
      setThemeFilter(null);
    } else {
      setThemeFilter(tickers);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <ThemeShowcase 
        activeTickers={activeTickers} 
        onThemeSelect={handleThemeSelect}
        selectedTickers={themeFilter || undefined}
      />
      
      <CategoryTabs 
        master={master} 
        allTickers={allTickers} 
        customFilter={themeFilter || undefined}
        onClear={() => setThemeFilter(null)}
      />
    </div>
  );
}
