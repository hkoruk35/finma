import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import ThemesBanner, { THEMES_BANNER_LABELS } from "@/components/global/ThemesBanner";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";
import MarketOverviewTabs, { type MarketGroup, type MarketQuoteItem } from "@/components/global/MarketOverviewTabs";
import HomeMoversGrid from "@/components/global/HomeMoversGrid";
import HomePersonalWatchlistCard from "@/components/global/HomePersonalWatchlistCard";
import HomeListCard, { type HomeListStock } from "@/components/global/HomeListCard";
import HomeSearchBar from "@/components/public/HomeSearchBar";
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

type QuoteMap = Record<string, { value: number; change_pct: number; recent_closes: number[] }>;

function toMarketItems(items: { ticker: string; label: string }[], quotes: QuoteMap): MarketQuoteItem[] {
  return items.map((it) => ({ ticker: it.ticker, label: it.label, quote: quotes[it.ticker] }));
}

function toSectorStocks(items: { ticker: string; label: string }[], quotes: QuoteMap): HomeListStock[] {
  return items.map((it) => {
    const q = quotes[it.ticker];
    return {
      ticker: it.ticker,
      sector: it.label,
      price: q?.value ?? 0,
      change_pct: q?.change_pct ?? 0,
      sparkline: q?.recent_closes ?? [],
    };
  });
}

export default async function PtHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  const marketGroups: MarketGroup[] = [
    { key: "indices", label: "Índices dos EUA", items: toMarketItems(INDEX_ITEMS, quotes) },
    { key: "fx", label: "Câmbio", items: toMarketItems(FX_ITEMS, quotes) },
    { key: "commodities", label: "Commodities", items: toMarketItems(COMMODITY_ITEMS, quotes) },
    { key: "crypto", label: "Cripto", items: toMarketItems(CRYPTO_ITEMS, quotes) },
  ];

  const sectorStocks = toSectorStocks(SECTOR_ITEMS, quotes);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="pt" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <HomeSearchBar locale="pt" />

        <div className="-mb-2">
          <ListsNavigation
            locale="pt"
            activePath="home"
            trailingAction={
              <Link
                href={`/global/pt/themes/${HOT_THEMES_2026[0].slug}`}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1117] border border-[#58a6ff] text-[#58a6ff] font-medium text-[10px] rounded hover:bg-[#58a6ff]/10 transition-colors whitespace-nowrap"
              >
                {THEMES_BANNER_LABELS.pt.browseAll}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            }
          />
        </div>
        <ThemesBanner locale="pt" showBrowseAll={false} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 mt-2 items-start">
          <div className="min-w-0">
            <MarketOverviewTabs groups={marketGroups} locale="pt" />
            <HomeMoversGrid locale="pt" />
          </div>

          <div className="flex flex-col gap-4">
            <HomePersonalWatchlistCard locale="pt" />
            <HomeListCard title="Setores" accent="#38bdf8" stocks={sectorStocks} locale="pt" />
          </div>
        </div>

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
