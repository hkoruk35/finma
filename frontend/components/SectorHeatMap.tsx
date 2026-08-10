"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MasterData, StockQuickView } from "@/lib/data";
import { SECTOR_ORDER, TOP_PER_SECTOR, groupBySector, slugifySector } from "@/lib/sectorHeatMap";
// import Link from "next/link"  // Removed navigation link as per request
import { copy, type Locale } from "@/lib/i18n/copy";
import ShareButton from "@/components/ShareButton";
import { formatNumber } from "@/lib/formatNumber";

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
  const router = useRouter();
  // Extract locale from pathname if not provided (e.g., /global/en/home → en)
  const currentLocale = locale || pathname?.split('/')[2] || 'en';
  const resolvedLocale: Locale = (currentLocale in copy ? currentLocale : 'en') as Locale;
  const t = copy[resolvedLocale].sectorHeatMap;
  const sectorNames = copy[resolvedLocale].top100.sectors as Record<string, string>;
  const sectorLabel = (sector: string) => sectorNames[sector] ?? sector;

  // Use ALL tickers, sorted by volume for display order within each sector
  const sectorGroups = groupBySector(allTickers);
  const activeSectors = SECTOR_ORDER.filter(s => sectorGroups[s]?.length > 0);

  // Auto‑refresh every 15 minutes while the market is open (09:00‑16:00 local time)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 9 && hour <= 16) {
        router.refresh();
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-[#3b82f6] rounded-full shadow-[0_0_12px_#3b82f6]"></div>
          <div>
            <h2 className="text-2xl font-medium text-white tracking-tighter uppercase italic">{t.title}</h2>
            <p className="text-xs text-white font-medium tracking-widest uppercase">{t.subtitle.replace('{n}', String(activeSectors.length))}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-4 text-[10px] font-medium text-[#00d2ff]">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-green-500"></div> {t.bullish}</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-red-500"></div> {t.bearish}</div>
          </div>
          <ShareButton locale={resolvedLocale} shareText={`${t.title} — BOGA AI`} url={`https://bogastock.com/global/${currentLocale}/home`} />
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-hide pb-4">
        <div className="grid auto-cols-max grid-flow-col gap-2 md:gap-3">
          {activeSectors.map(sector => {
            const stocks = sectorGroups[sector].slice(0, TOP_PER_SECTOR);
            const avgChange = stocks.reduce((acc, s) => acc + s.change_pct, 0) / stocks.length;
            const sectorStyles = getPerformanceColor(avgChange);
            return (
              <div key={sector} className="glass-card overflow-hidden flex flex-col border border-[#1e2a3b] hover:border-[#3b82f6]/30 transition-all duration-300 group">
                <div className={`flex items-center gap-2 p-2.5 border-b border-[#1e2a3a] ${sectorStyles.bg} transition-all group-hover:brightness-125 whitespace-nowrap`}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-medium text-white uppercase tracking-tighter leading-none truncate">{sectorLabel(sector)}</span>
                    <span className="text-[8px] font-medium text-white/70 tracking-wider">{SECTOR_ETF[sector] || "SEC"}</span>
                  </div>
                  <div className="text-right ml-1 flex-shrink-0">
                    <span className="text-sm font-mono font-medium text-white">{avgChange >= 0 ? "+" : ""}{formatNumber(avgChange, 2)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
