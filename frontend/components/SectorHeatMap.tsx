"use client";

import { usePathname } from "next/navigation";
import { MasterData, StockQuickView } from "@/lib/data";
import { SECTOR_ORDER, TOP_PER_SECTOR, groupBySector, slugifySector } from "@/lib/sectorHeatMap";
import Link from "next/link";
import TickerHoverChart from "@/components/TickerHoverChart";
import { copy, type Locale } from "@/lib/i18n/copy";

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

interface Props {
  data: MasterData;
  allTickers: StockQuickView[];
  locale?: string;
}

export default function SectorHeatMap({ data, allTickers, locale }: Props) {
  const pathname = usePathname();
  // Extract locale from pathname if not provided (e.g., /global/en/home → en)
  const currentLocale = locale || pathname?.split('/')[2] || 'en';
  const resolvedLocale: Locale = (currentLocale in copy ? currentLocale : 'en') as Locale;
  const t = copy[resolvedLocale].sectorHeatMap;
  const sectorNames = copy[resolvedLocale].top100.sectors as Record<string, string>;
  const sectorLabel = (sector: string) => sectorNames[sector] ?? sector;

  // Use ALL tickers, sorted by volume for display order within each sector
  const sectorGroups = groupBySector(allTickers);
  const activeSectors = SECTOR_ORDER.filter(s => sectorGroups[s]?.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-[#3b82f6] rounded-full shadow-[0_0_12px_#3b82f6]"></div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">
              {t.title}
            </h2>
            <p className="text-xs text-white font-bold tracking-widest uppercase">
              {t.subtitle.replace('{n}', String(activeSectors.length))}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex gap-4 text-[10px] font-bold text-[#00d2ff]">
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded bg-green-500"></div> {t.bullish}
           </div>
           <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded bg-red-500"></div> {t.bearish}
           </div>
        </div>
      </div>

      <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide md:overflow-x-visible">
        <div className="flex flex-row md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:min-w-0">
          {activeSectors.map(sector => {
            const stocks = sectorGroups[sector].slice(0, TOP_PER_SECTOR); // Show top N per sector for map
            const avgChange = stocks.reduce((acc, s) => acc + s.change_pct, 0) / stocks.length;
            const sectorStyles = getPerformanceColor(avgChange);

            return (
              <div
                key={sector}
                className="glass-card overflow-hidden flex flex-col border border-[#1e2a3a] hover:border-[#3b82f6]/30 transition-all duration-300 group flex-shrink-0 w-[calc(100vw-40px)] snap-center md:flex-shrink md:w-auto md:snap-align-none"
              >
              {/* Sector Header */}
              <Link
                href={`/global/${currentLocale}/watchlist/${slugifySector(sector)}`}
                className={`flex items-center justify-between p-3 border-b border-[#1e2a3a] ${sectorStyles.bg} transition-all group-hover:brightness-125`}
              >
                <div className="flex flex-col">
                   <span className="text-sm font-black text-white uppercase tracking-tighter leading-tight">
                      {sectorLabel(sector)}
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
              <div className="grid grid-cols-4 md:grid-cols-6 gap-[2px] p-2 bg-[#0a0e17]">
                {stocks.map(stock => {
                  const s = getPerformanceColor(stock.change_pct);
                  return (
                    <TickerHoverChart key={stock.ticker} ticker={stock.ticker}>
                      <Link
                        href={`/global/${currentLocale}/graphic/${stock.ticker}`}
                        className={`relative flex flex-col items-center justify-center py-3 rounded-sm transition-all duration-200 hover:brightness-110 hover:z-10 hover:shadow-xl ${s.bg} border ${s.border}`}
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
                    </TickerHoverChart>
                  );
                })}
              </div>
              
              {/* Footer / More link */}
              <Link
                href={`/global/${currentLocale}/watchlist/${slugifySector(sector)}`}
                className="py-1.5 px-3 bg-[#141924]/50 hover:bg-[#141924] text-center transition-colors border-t border-[#1e2a3a]"
              >
                 <span className="text-[9px] font-black text-white uppercase tracking-[0.15em] group-hover:text-[#3b82f6] transition-colors">
                    {t.exploreAll.replace('{n}', String(sectorGroups[sector].length))}
                 </span>
              </Link>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
