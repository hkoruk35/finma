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
  title: "BOGASTOCK | Mapa de Calor Sectorial y Análisis",
  description: "Mapas de calor de rendimiento sectorial por hora y diarios, con análisis sectorial asistido por IA.",
  alternates: { canonical: "https://bogastock.com/global/es/sectors" },
};

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Tecnología" },
  { ticker: "XLF", label: "Financiero" },
  { ticker: "XLE", label: "Energía" },
  { ticker: "XLV", label: "Salud" },
  { ticker: "XLY", label: "Consumo Discrecional" },
  { ticker: "XLP", label: "Consumo Básico" },
  { ticker: "XLI", label: "Industrial" },
  { ticker: "XLB", label: "Materiales" },
  { ticker: "XLRE", label: "Bienes Raíces" },
  { ticker: "XLU", label: "Servicios Públicos" },
  { ticker: "XLC", label: "Comunicaciones" },
];

function toSectorStocks(quotes: Record<string, { value: number; change_pct: number; recent_closes: number[] }>): HomeListStock[] {
  return SECTOR_ITEMS.map((it) => {
    const q = quotes[it.ticker];
    return { ticker: it.ticker, sector: it.label, price: q?.value ?? 0, change_pct: q?.change_pct ?? 0, sparkline: q?.recent_closes ?? [] };
  });
}

export default async function EsSectorsPage() {
  const quotes = await getMultiQuote(SECTOR_ITEMS.map((i) => i.ticker));
  const sectorStocks = toSectorStocks(quotes);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Sectores</span>
        </nav>

        <ListsNavigation locale="es" activePath="sectors" />

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 mt-2 items-start">
          <HomeListCard title="Sectores" accent="#3b82f6" stocks={sectorStocks} locale="es" />

          <div className="min-w-0 flex flex-col gap-4">
            <SectorHeatmaps locale="es" items={SECTOR_ITEMS} dailyQuotes={quotes} />
            <SectorAnalysisSummary locale="es" items={SECTOR_ITEMS} quotes={quotes} />
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
