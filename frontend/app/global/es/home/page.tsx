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
  title: "BOGASTOCK AI — Plataforma de Análisis Bursátil y Decisiones de Inversión con IA",
  description: "Descubra análisis técnico impulsado por IA para acciones de EE. UU., índices, sectores, divisas, materias primas y criptoactivos en BOGASTOCK AI.",
  keywords: ["análisis de acciones de EE. UU.", "BOGASTOCK AI", "análisis técnico de acciones", "análisis de índices", "análisis de divisas", "análisis de materias primas", "IA para bolsa"],
  openGraph: {
    title: "BOGASTOCK AI — Plataforma de Análisis Bursátil y Decisiones de Inversión con IA",
    description: "Descubra análisis técnico impulsado por IA para acciones de EE. UU., índices, sectores, divisas, materias primas y criptoactivos en BOGASTOCK AI.",
    url: "https://bogastock.com/global/es/home",
    siteName: "BOGASTOCK Terminal",
    locale: "es_ES",
    type: "website",
  },
  alternates: { canonical: "https://bogastock.com/global/es/home" },
};

const INDEX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

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
  { ticker: "GOLD", label: "Oro" },
  { ticker: "SILVER", label: "Plata" },
  { ticker: "USOIL", label: "Petróleo Crudo" },
  { ticker: "NATGAS", label: "Gas Natural" },
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

export default async function EsHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="es" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="-mb-2">
          <ListsNavigation locale="es" activePath="home" />
        </div>
        {/* Themes Banner */}
        <ThemesBanner locale="es" />

        <HomeAssetClassSection title="Índices de EE. UU." items={withQuotes(INDEX_ITEMS, quotes)} locale="es" />
        <HomeAssetClassSection title="Sectores de EE. UU." items={withQuotes(SECTOR_ITEMS, quotes)} locale="es" />
        <HomeAssetClassSection title="Divisas" items={withQuotes(FX_ITEMS, quotes)} locale="es" />
        <HomeAssetClassSection title="Materias Primas" items={withQuotes(COMMODITY_ITEMS, quotes)} locale="es" />
        <HomeAssetClassSection title="Cripto" items={withQuotes(CRYPTO_ITEMS, quotes)} locale="es" />

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Última actualización: <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Los datos se analizan a partir de fuentes con un retraso de 15 minutos. Esta página se actualiza cada hora los días en que el mercado está abierto.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
