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
  title: "BOGASTOCK | Mapa de Calor Setorial e Análise",
  description: "Mapas de calor de desempenho setorial por hora e diários, com análise setorial assistida por IA.",
  alternates: { canonical: "https://bogastock.com/global/pt/sectors" },
};

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Tecnologia" },
  { ticker: "XLF", label: "Financeiro" },
  { ticker: "XLE", label: "Energia" },
  { ticker: "XLV", label: "Saúde" },
  { ticker: "XLY", label: "Consumo Discricionário" },
  { ticker: "XLP", label: "Consumo Básico" },
  { ticker: "XLI", label: "Industrial" },
  { ticker: "XLB", label: "Materiais" },
  { ticker: "XLRE", label: "Imóveis" },
  { ticker: "XLU", label: "Utilidades" },
  { ticker: "XLC", label: "Comunicação" },
];

function toSectorStocks(quotes: Record<string, { value: number; change_pct: number; recent_closes: number[] }>): HomeListStock[] {
  return SECTOR_ITEMS.map((it) => {
    const q = quotes[it.ticker];
    return { ticker: it.ticker, sector: it.label, price: q?.value ?? 0, change_pct: q?.change_pct ?? 0, sparkline: q?.recent_closes ?? [] };
  });
}

export default async function PtSectorsPage() {
  const quotes = await getMultiQuote(SECTOR_ITEMS.map((i) => i.ticker));
  const sectorStocks = toSectorStocks(quotes);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Setores</span>
        </nav>

        <ListsNavigation locale="pt" activePath="sectors" />

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 mt-2 items-start">
          <HomeListCard title="Setores" accent="#38bdf8" stocks={sectorStocks} locale="pt" />

          <div className="min-w-0 flex flex-col gap-4">
            <SectorHeatmaps locale="pt" items={SECTOR_ITEMS} dailyQuotes={quotes} />
            <SectorAnalysisSummary locale="pt" items={SECTOR_ITEMS} quotes={quotes} />
          </div>
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
