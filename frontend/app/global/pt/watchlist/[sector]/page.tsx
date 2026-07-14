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
  if (!sectorName) return { title: "Setor Não Encontrado | BOGA AI" };
  const label = (copy.pt.top100.sectors as Record<string, string>)[sectorName] ?? sectorName;
  return {
    title: `Ações de ${label} — BOGA AI`,
    description: `Todas as ações do setor ${label} — preço, volume, EMA, RSI, padrão e mapa de calor horário.`,
    alternates: { canonical: `https://bogastock.com/global/pt/watchlist/${slug}` },
  };
}

export default async function PtSectorWatchlistPage({ params }: Props) {
  const { sector: slug } = await params;
  const sectorName = sectorFromSlug(slug);
  if (!sectorName) notFound();

  const label = (copy.pt.top100.sectors as Record<string, string>)[sectorName] ?? sectorName;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{label}</span>
        </nav>

        <div className="relative z-10">
          <SectorWatchlistTracker locale="pt" sector={sectorName} sectorLabel={label} />
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
