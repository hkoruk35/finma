import { Metadata } from "next";
import ListsNavigation from "@/components/global/ListsNavigation";
import ThemesBanner from "@/components/global/ThemesBanner";
import HomeAssetClassSection, { type AssetClassItem } from "@/components/global/HomeAssetClassSection";
import { getLastUpdated, getLiveIndices, getMultiQuote } from "@/lib/homeFeed";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "BOGASTOCK AI — Plataforma de Análise de Ações e Decisões de Investimento com IA",
  description: "Descubra análises técnicas com IA para ações dos EUA, índices, setores, câmbio, commodities e criptomoedas no BOGASTOCK AI.",
  keywords: ["análise de ações dos EUA", "BOGASTOCK AI", "análise técnica de ações", "análise de índices", "análise de câmbio", "análise de commodities", "IA para bolsa de valores"],
  openGraph: {
    title: "BOGASTOCK AI — Plataforma de Análise de Ações e Decisões de Investimento com IA",
    description: "Descubra análises técnicas com IA para ações dos EUA, índices, setores, câmbio, commodities e criptomoedas no BOGASTOCK AI.",
    url: "https://bogastock.com/global/pt/home",
    siteName: "BOGASTOCK Terminal",
    locale: "pt_BR",
    type: "website",
  },
  alternates: { canonical: "https://bogastock.com/global/pt/home" },
};

const INDEX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

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

const FX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "EURUSD", label: "EUR/USD" },
  { ticker: "GBPUSD", label: "GBP/USD" },
  { ticker: "USDJPY", label: "USD/JPY" },
  { ticker: "USDCHF", label: "USD/CHF" },
  { ticker: "AUDUSD", label: "AUD/USD" },
  { ticker: "USDCAD", label: "USD/CAD" },
  { ticker: "NZDUSD", label: "NZD/USD" },
];

const COMMODITY_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "GOLD", label: "Ouro" },
  { ticker: "SILVER", label: "Prata" },
  { ticker: "USOIL", label: "Petróleo Bruto" },
  { ticker: "NATGAS", label: "Gás Natural" },
];

const CRYPTO_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "BTCUSD", label: "Bitcoin" },
  { ticker: "ETHUSD", label: "Ethereum" },
  { ticker: "SOLUSD", label: "Solana" },
  { ticker: "XRPUSD", label: "XRP" },
];

function withQuotes(
  items: { ticker: string; label: string }[],
  quotes: Record<string, { value: number; change_pct: number }>
): AssetClassItem[] {
  return items.map((it) => ({ ...it, quote: quotes[it.ticker] }));
}

export default async function PtHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="pt" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="-mb-2">
          <ListsNavigation locale="pt" activePath="home" />
        </div>
        {/* Themes Banner */}
        <ThemesBanner locale="pt" />

        <HomeAssetClassSection title="Índices dos EUA" items={withQuotes(INDEX_ITEMS, quotes)} locale="pt" />
        <HomeAssetClassSection title="Setores dos EUA" items={withQuotes(SECTOR_ITEMS, quotes)} locale="pt" />
        <HomeAssetClassSection title="Câmbio" items={withQuotes(FX_ITEMS, quotes)} locale="pt" />
        <HomeAssetClassSection title="Commodities" items={withQuotes(COMMODITY_ITEMS, quotes)} locale="pt" />
        <HomeAssetClassSection title="Cripto" items={withQuotes(CRYPTO_ITEMS, quotes)} locale="pt" />

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Última atualização: <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Os dados são analisados a partir de fontes com atraso de 15 minutos. Esta página é atualizada de hora em hora nos dias em que o mercado está aberto.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
