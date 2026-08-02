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

function withQuotes(
  items: { ticker: string; label: string }[],
  quotes: Record<string, { value: number; change_pct: number }>
): AssetClassItem[] {
  return items.map((it) => ({ ...it, quote: quotes[it.ticker] }));
}

export default async function FrHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="fr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="-mb-2">
          <ListsNavigation locale="fr" activePath="home" />
        </div>
        {/* Themes Banner */}
        <ThemesBanner locale="fr" />

        <HomeAssetClassSection title="Indices Américains" items={withQuotes(INDEX_ITEMS, quotes)} locale="fr" />
        <HomeAssetClassSection title="Secteurs Américains" items={withQuotes(SECTOR_ITEMS, quotes)} locale="fr" />
        <HomeAssetClassSection title="Devises" items={withQuotes(FX_ITEMS, quotes)} locale="fr" />
        <HomeAssetClassSection title="Matières Premières" items={withQuotes(COMMODITY_ITEMS, quotes)} locale="fr" />
        <HomeAssetClassSection title="Crypto" items={withQuotes(CRYPTO_ITEMS, quotes)} locale="fr" />

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
