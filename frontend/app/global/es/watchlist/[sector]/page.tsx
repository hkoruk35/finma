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
  if (!sectorName) return { title: "Sector No Encontrado | BOGA AI" };
  const label = (copy.es.top100.sectors as Record<string, string>)[sectorName] ?? sectorName;
  return {
    title: `Acciones de ${label} — BOGA AI`,
    description: `Todas las acciones del sector ${label} — precio, volumen, EMA, RSI, patrón y mapa de calor horario.`,
    alternates: { canonical: `https://bogastock.com/global/es/watchlist/${slug}` },
  };
}

export default async function EsSectorWatchlistPage({ params }: Props) {
  const { sector: slug } = await params;
  const sectorName = sectorFromSlug(slug);
  if (!sectorName) notFound();

  const label = (copy.es.top100.sectors as Record<string, string>)[sectorName] ?? sectorName;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{label}</span>
        </nav>

        <div className="relative z-10">
          <SectorWatchlistTracker locale="es" sector={sectorName} sectorLabel={label} />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
