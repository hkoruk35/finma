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
  title: "BOGASTOCK AI — AI-Powered Stock Market Analysis & Investment Decision Platform",
  description: "Discover AI-powered technical chart analysis for U.S. stocks, indices, sectors, forex, commodities, and crypto assets on BOGASTOCK AI.",
  keywords: ["US stock analysis", "BOGASTOCK AI", "stock technical analysis", "index analysis", "forex analysis", "commodity analysis", "crypto analysis", "AI stock market"],
  openGraph: {
    title: "BOGASTOCK AI — AI-Powered Stock Market Analysis & Investment Decision Platform",
    description: "Discover AI-powered technical chart analysis for U.S. stocks, indices, sectors, forex, commodities, and crypto assets on BOGASTOCK AI.",
    url: "https://bogastock.com/global/en/home",
    siteName: "BOGASTOCK Terminal",
    locale: "en_US",
    type: "website",
  },
  alternates: { canonical: "https://bogastock.com/global/en/home" },
};

const INDEX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Technology" },
  { ticker: "XLF", label: "Financials" },
  { ticker: "XLE", label: "Energy" },
  { ticker: "XLV", label: "Health Care" },
  { ticker: "XLY", label: "Consumer Discretionary" },
  { ticker: "XLP", label: "Consumer Staples" },
  { ticker: "XLI", label: "Industrials" },
  { ticker: "XLB", label: "Materials" },
  { ticker: "XLRE", label: "Real Estate" },
  { ticker: "XLU", label: "Utilities" },
  { ticker: "XLC", label: "Communication Services" },
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
  { ticker: "GOLD", label: "Gold" },
  { ticker: "SILVER", label: "Silver" },
  { ticker: "USOIL", label: "Crude Oil" },
  { ticker: "NATGAS", label: "Natural Gas" },
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

export default async function EnHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="en" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="-mb-2">
          <ListsNavigation locale="en" activePath="home" />
        </div>
        {/* Themes Banner */}
        <ThemesBanner locale="en" />

        <HomeAssetClassSection title="US Indices" items={withQuotes(INDEX_ITEMS, quotes)} locale="en" />
        <HomeAssetClassSection title="US Sectors" items={withQuotes(SECTOR_ITEMS, quotes)} locale="en" />
        <HomeAssetClassSection title="Forex" items={withQuotes(FX_ITEMS, quotes)} locale="en" />
        <HomeAssetClassSection title="Commodities" items={withQuotes(COMMODITY_ITEMS, quotes)} locale="en" />
        <HomeAssetClassSection title="Crypto" items={withQuotes(CRYPTO_ITEMS, quotes)} locale="en" />

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Last updated: <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Data is analyzed from sources delayed by 15 minutes. This page updates hourly on days the market is open.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
