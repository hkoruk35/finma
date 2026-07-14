import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import SectorWatchlistTracker from "@/components/public/SectorWatchlistTracker";
import { sectorFromSlug, SECTOR_ORDER, slugifySector } from "@/lib/sectorHeatMap";
import { copy } from "@/lib/i18n/copy";

interface Props {
  params: Promise<{ sector: string }>;
}

export function generateStaticParams() {
  return SECTOR_ORDER.map((s) => ({ sector: slugifySector(s) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sector: slug } = await params;
  const sectorName = sectorFromSlug(slug);
  if (!sectorName) return { title: "Sector Not Found | BOGA AI" };
  const label = (copy.en.top100.sectors as Record<string, string>)[sectorName] ?? sectorName;
  return {
    title: `${label} Stocks — BOGA AI`,
    description: `All ${label} sector stocks — price, volume, EMA, RSI, pattern, and hourly heatmap.`,
    alternates: { canonical: `https://bogastock.com/global/en/watchlist/${slug}` },
  };
}

export default async function EnSectorWatchlistPage({ params }: Props) {
  const { sector: slug } = await params;
  const sectorName = sectorFromSlug(slug);
  if (!sectorName) notFound();

  const label = (copy.en.top100.sectors as Record<string, string>)[sectorName] ?? sectorName;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{label}</span>
        </nav>

        <div className="relative z-10">
          <SectorWatchlistTracker locale="en" sector={sectorName} sectorLabel={label} />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
