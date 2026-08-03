import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import HomeListCard, { type HomeListStock } from "@/components/global/HomeListCard";
import SectorHeatmaps from "@/components/global/SectorHeatmaps";
import SectorAnalysisSummary from "@/components/global/SectorAnalysisSummary";
import { getMultiQuote } from "@/lib/homeFeed";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "BOGASTOCK | Sector Heat Map & Analysis",
  description: "Hourly and daily sector performance heat maps with AI-assisted sector analysis.",
  alternates: { canonical: "https://bogastock.com/global/en/sectors" },
};

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Technology" },
  { ticker: "XLF", label: "Financials" },
  { ticker: "XLE", label: "Energy" },
  { ticker: "XLV", label: "Health Care" },
  { ticker: "XLY", label: "Consumer Discretionary" },
  { ticker: "XLP", label: "Consumer Staples" },
  { ticker: "XLI", label: "Industrials" },
  { ticker: "XLB", label: "Materials" },
  { ticker: "XLRE", label: "Real Estate" },
  { ticker: "XLU", label: "Utilities" },
  { ticker: "XLC", label: "Communication Services" },
];

function toSectorStocks(quotes: Record<string, { value: number; change_pct: number; recent_closes: number[] }>): HomeListStock[] {
  return SECTOR_ITEMS.map((it) => {
    const q = quotes[it.ticker];
    return { ticker: it.ticker, sector: it.label, price: q?.value ?? 0, change_pct: q?.change_pct ?? 0, sparkline: q?.recent_closes ?? [] };
  });
}

export default async function EnSectorsPage() {
  const quotes = await getMultiQuote(SECTOR_ITEMS.map((i) => i.ticker));
  const sectorStocks = toSectorStocks(quotes);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Sectors</span>
        </nav>

        <ListsNavigation locale="en" activePath="sectors" />

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 mt-2 items-start">
          <HomeListCard title="Sectors" accent="#38bdf8" stocks={sectorStocks} locale="en" />

          <div className="min-w-0 flex flex-col gap-4">
            <SectorHeatmaps locale="en" items={SECTOR_ITEMS} dailyQuotes={quotes} />
            <SectorAnalysisSummary locale="en" items={SECTOR_ITEMS} quotes={quotes} />
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
