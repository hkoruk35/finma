"use client";

import { MasterData, StockQuickView } from "@/lib/data";
import Link from "next/link";

/* ── Slug helper ────────────────────────────────────────────── */
function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

/* ── Refined Performance Colors ──────────────────────────────── */
function getPerformanceColor(pct: number) {
  if (pct >= 2.5) return { bg: "bg-green-600/90", border: "border-green-400/50", text: "text-green-50" };
  if (pct >= 0.8) return { bg: "bg-green-700/60", border: "border-green-600/30", text: "text-green-100" };
  if (pct >= 0)   return { bg: "bg-green-900/40", border: "border-green-800/20", text: "text-green-200" };
  if (pct >= -0.8) return { bg: "bg-red-900/40", border: "border-red-800/20", text: "text-red-200" };
  if (pct >= -2.5) return { bg: "bg-red-700/60", border: "border-red-600/30", text: "text-red-100" };
  return { bg: "bg-red-600/90", border: "border-red-400/50", text: "text-red-50" };
}

const SECTOR_ETF: Record<string, string> = {
  Technology: "XLK", Financials: "XLF", Healthcare: "XLV",
  "Consumer Discretionary": "XLY", Industrials: "XLI",
  "Communication Services": "XLC", "Consumer Staples": "XLP",
  Energy: "XLE", "Real Estate": "XLRE", Utilities: "XLU",
  Materials: "XLB", "High-Growth": "QQQ"
};

const SECTOR_ORDER = [
  "Technology", "Financials", "Healthcare", "Consumer Discretionary", 
  "Communication Services", "Industrials", "Energy", "Consumer Staples",
  "Real Estate", "Materials", "Utilities"
];

interface Props {
  data: MasterData;
  allTickers: StockQuickView[];
}

export default function SectorHeatMap({ data, allTickers }: Props) {
  // Filter to top 100 by daily volume (fallback: master_score) for heatmap display
  const top100 = [...allTickers]
    .sort((a, b) => (b.volume ?? b.avg_volume_30d ?? b.master_score) - (a.volume ?? a.avg_volume_30d ?? a.master_score))
    .slice(0, 100);

  // Grouping
  const sectorGroups: Record<string, StockQuickView[]> = {};
  top100.forEach(t => {
    const s = t.sector || "Other";
    if (!sectorGroups[s]) sectorGroups[s] = [];
    sectorGroups[s].push(t);
  });

  const activeSectors = SECTOR_ORDER.filter(s => sectorGroups[s]?.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-[#3b82f6] rounded-full shadow-[0_0_12px_#3b82f6]"></div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">
              Sector Heat Map
            </h2>
            <p className="text-xs text-[#94a3b8] font-bold tracking-widest uppercase">
              Real-time Market Distribution &middot; Top 100 by Volume
            </p>
          </div>
        </div>
        
        <div className="hidden sm:flex gap-4 text-[10px] font-bold text-[#64748b]">
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded bg-green-500"></div> BULLISH
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded bg-red-500"></div> BEARISH
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activeSectors.map(sector => {
          const stocks = sectorGroups[sector].slice(0, 12); // Show top 12 per sector for map
          const avgChange = stocks.reduce((acc, s) => acc + s.change_pct, 0) / stocks.length;
          const sectorStyles = getPerformanceColor(avgChange);

          return (
            <div 
              key={sector} 
              className="glass-card overflow-hidden flex flex-col border border-[#1e2a3a] hover:border-[#3b82f6]/30 transition-all duration-300 group"
            >
              {/* Sector Header */}
              <Link 
                href={`/sector/${slugify(sector)}`}
                className={`flex items-center justify-between p-3 border-b border-[#1e2a3a] ${sectorStyles.bg} transition-all group-hover:brightness-125`}
              >
                <div className="flex flex-col">
                   <span className="text-sm font-black text-white uppercase tracking-tighter leading-tight">
                      {sector}
                   </span>
                   <span className="text-[10px] font-bold text-white/70 tracking-widest">{SECTOR_ETF[sector] || "SEC"}</span>
                </div>
                <div className="text-right">
                   <span className="text-base font-mono font-black text-white">
                      {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
                   </span>
                </div>
              </Link>

              {/* Grid of Stocks */}
              <div className="grid grid-cols-4 gap-[2px] p-2 bg-[#0a0e17]">
                {stocks.map(stock => {
                  const s = getPerformanceColor(stock.change_pct);
                  return (
                    <Link
                      key={stock.ticker}
                      href={`/stock/${stock.ticker}`}
                      className={`relative flex flex-col items-center justify-center py-3 rounded-sm transition-all duration-200 hover:scale-[1.05] hover:z-10 hover:shadow-xl ${s.bg} border ${s.border}`}
                      title={`${stock.ticker}: ${stock.change_pct}%`}
                    >
                      <span className={`text-xs font-black tracking-tighter ${s.text}`}>
                        {stock.ticker}
                      </span>
                      <span className={`text-[8px] font-mono font-bold opacity-90 ${s.text}`}>
                        {stock.change_pct >= 0 ? "+" : ""}{stock.change_pct.toFixed(1)}%
                      </span>
                      
                      {/* Interaction Glow */}
                      <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </Link>
                  );
                })}
              </div>
              
              {/* Footer / More link */}
              <Link
                href={`/sector/${slugify(sector)}`}
                className="py-1.5 px-3 bg-[#141924]/50 hover:bg-[#141924] text-center transition-colors border-t border-[#1e2a3a]"
              >
                 <span className="text-[9px] font-black text-[#94a3b8] uppercase tracking-[0.15em] group-hover:text-[#3b82f6] transition-colors">
                    Explore All {sectorGroups[sector].length} Tickers →
                 </span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
