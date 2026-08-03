import { Metadata } from "next";
import ListsNavigation from "@/components/global/ListsNavigation";
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
  title: "BOGASTOCK AI — Plateforme d'Analyse Boursière et de Décisions d'Investissement alimentée par l'IA",
  description: "Découvrez l'analyse technique alimentée par l'IA pour les actions américaines, les indices, les secteurs, les devises, les matières premières et les cryptomonnaies sur BOGASTOCK AI.",
  keywords: ["analyse des actions US", "BOGASTOCK AI", "analyse technique boursière", "analyse des indices", "analyse des devises", "analyse des matières premières", "IA bourse"],
  openGraph: {
    title: "BOGASTOCK AI — Plateforme d'Analyse Boursière et de Décisions d'Investissement alimentée par l'IA",
    description: "Découvrez l'analyse technique alimentée par l'IA pour les actions américaines, les indices, les secteurs, les devises, les matières premières et les cryptomonnaies sur BOGASTOCK AI.",
    url: "https://bogastock.com/global/fr/home",
    siteName: "BOGASTOCK Terminal",
    locale: "fr_FR",
    type: "website",
  },
  alternates: { canonical: "https://bogastock.com/global/fr/home" },
};

const INDEX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Technologie" },
  { ticker: "XLF", label: "Finance" },
  { ticker: "XLE", label: "Énergie" },
  { ticker: "XLV", label: "Santé" },
  { ticker: "XLY", label: "Consommation Discrétionnaire" },
  { ticker: "XLP", label: "Consommation de Base" },
  { ticker: "XLI", label: "Industrie" },
  { ticker: "XLB", label: "Matériaux" },
  { ticker: "XLRE", label: "Immobilier" },
  { ticker: "XLU", label: "Services Publics" },
  { ticker: "XLC", label: "Communication" },
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
  { ticker: "GOLD", label: "Or" },
  { ticker: "SILVER", label: "Argent" },
  { ticker: "USOIL", label: "Pétrole Brut" },
  { ticker: "NATGAS", label: "Gaz Naturel" },
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

export default async function FrHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  const marketGroups: MarketGroup[] = [
    { key: "indices", label: "Indices Américains", items: toMarketItems(INDEX_ITEMS, quotes) },
    { key: "fx", label: "Devises", items: toMarketItems(FX_ITEMS, quotes) },
    { key: "commodities", label: "Matières Premières", items: toMarketItems(COMMODITY_ITEMS, quotes) },
    { key: "crypto", label: "Crypto", items: toMarketItems(CRYPTO_ITEMS, quotes) },
  ];

  const sectorStocks = toSectorStocks(SECTOR_ITEMS, quotes);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="fr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="min-w-0">
            <HomeSearchBar locale="fr" />

            <div className="-mb-2">
              <ListsNavigation locale="fr" activePath="home" />
            </div>

            <div className="mt-2">
              <MarketOverviewTabs groups={marketGroups} locale="fr" />
              <HomeMoversGrid locale="fr" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <HomePersonalWatchlistCard locale="fr" initialVisible={5} />
            <HomeListCard title="Secteurs" accent="#38bdf8" stocks={sectorStocks} locale="fr" initialVisible={5} viewAllHref="/global/fr/sectors" />
          </div>
        </div>

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Dernière mise à jour : <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Les données sont analysées à partir de sources avec un délai de 15 minutes. Cette page est mise à jour toutes les heures les jours d'ouverture du marché.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
