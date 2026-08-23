import { Metadata } from "next";
import Link from "next/link";
import MarketOverviewTabs, { type MarketGroup, type MarketQuoteItem } from "@/components/global/MarketOverviewTabs";
import HomeMoversGrid from "@/components/global/HomeMoversGrid";
import HomeLatestAnalysis from "@/components/global/HomeLatestAnalysis";
import HomeRecentEarnings from "@/components/global/HomeRecentEarnings";
import HomePersonalWatchlistCard from "@/components/global/HomePersonalWatchlistCard";
import HomeListCard, { type HomeListStock } from "@/components/global/HomeListCard";
import HomeSearchBar from "@/components/public/HomeSearchBar";
import HomeIndexHighlights from "@/components/global/HomeIndexHighlights";
import HomeIndexTextFeed from "@/components/global/HomeIndexTextFeed";
import TrendPicksSlot from "@/components/global/TrendPicksSlot";
import DailyOnePickCard from "@/components/global/DailyOnePickCard";
import HomeScheduleBanner from "@/components/global/HomeScheduleBanner";
import { getLastUpdated, getLiveIndices, getMultiQuote } from "@/lib/homeFeed";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import CookieConsent from "@/components/global/CookieConsent";

export const revalidate = 900; // 15 dk — canli veri bagimliligini gevseterek yuku azaltir

export const metadata: Metadata = {
  title: "Home",
  alternates: { canonical: "https://bogastock.com/global/es/home" }, openGraph: { url: "https://bogastock.com/global/es/home" }
};


const INDEX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

const EUROPE_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "DAX", label: "DAX" },
  { ticker: "FTSE100", label: "FTSE 100" },
  { ticker: "CAC40", label: "CAC 40" },
  { ticker: "IBEX35", label: "IBEX 35" },
  { ticker: "STOXX50", label: "STOXX 50" },
];

const ASIA_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "N225", label: "Nikkei 225" },
  { ticker: "SSE", label: "SSE" },
  { ticker: "HSI", label: "HSI" },
  { ticker: "SENSEX", label: "SENSEX" },
  { ticker: "NIFTY50", label: "NIFTY 50" },
  { ticker: "IHSG", label: "IHSG" },
];

const LATAM_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPLATA40", label: "S&P Latam 40" },
  { ticker: "SPLATA_BMI", label: "S&P Latam BMI" },
  { ticker: "IBOVESPA", label: "IBOVESPA" },
  { ticker: "IGCX", label: "IGCX" },
  { ticker: "IBXX", label: "IBXX" },
];

const FX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "EURUSD", label: "EUR/USD" },
  { ticker: "GBPUSD", label: "GBP/USD" },
  { ticker: "USDJPY", label: "USD/JPY" },
  { ticker: "USDTRY", label: "USD/TRY" },
  { ticker: "USDCHF", label: "USD/CHF" },
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

const FUTURES_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "YM_F", label: "Futuros Dow" },
  { ticker: "ES_F", label: "Futuros S&P" },
  { ticker: "NQ_F", label: "Futuros Nasdaq" },
  { ticker: "GC_F", label: "Futuros Oro" },
  { ticker: "CL_F", label: "Futuros Petróleo" },
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

const SECTOR_LABELS: Record<string, string> = {
  XLK: "Tecnología",
  XLF: "Financiero",
  XLE: "Energía",
  XLV: "Salud",
  XLY: "Consumo Discrecional",
  XLP: "Consumo Básico",
  XLI: "Industrial",
  XLB: "Materiales",
  XLRE: "Bienes Raíces",
  XLU: "Servicios Públicos",
  XLC: "Comunicaciones",
};

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

import { getHomeMoversServerData } from "@/app/api/home-movers/route";
import { getTrendStocksServerData } from "@/lib/homeFeed";

export default async function EsHomePage() {
  const allTickers = [
    ...INDEX_ITEMS,
    ...EUROPE_ITEMS,
    ...ASIA_ITEMS,
    ...LATAM_ITEMS,
    ...FX_ITEMS,
    ...COMMODITY_ITEMS,
    ...CRYPTO_ITEMS,
    ...FUTURES_ITEMS,
    ...SECTOR_ITEMS,
  ].map((i) => i.ticker);

  const [lastUpdated, indices, quotes, homeMoversData, trendStocksData] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
    getHomeMoversServerData(7),
    getTrendStocksServerData(),
  ]);

  const marketGroups: MarketGroup[] = [
    { key: "us", label: "US", items: toMarketItems(INDEX_ITEMS, quotes) },
    { key: "europe", label: "Europa", items: toMarketItems(EUROPE_ITEMS, quotes) },
    { key: "asia", label: "Asia", items: toMarketItems(ASIA_ITEMS, quotes) },
    { key: "latam", label: "América Latina", items: toMarketItems(LATAM_ITEMS, quotes) },
    { key: "fx", label: "Divisas", items: toMarketItems(FX_ITEMS, quotes) },
    { key: "commodities", label: "Materias Primas", items: toMarketItems(COMMODITY_ITEMS, quotes) },
    { key: "crypto", label: "Cripto", items: toMarketItems(CRYPTO_ITEMS, quotes) },
    { key: "futures", label: "Futuros", items: toMarketItems(FUTURES_ITEMS, quotes) },
  ];

  const sectorStocks = toSectorStocks(SECTOR_ITEMS, quotes);

  const sectorIndices = Object.fromEntries(
    SECTOR_ITEMS.map(item => [
      item.ticker,
      { value: quotes[item.ticker]?.value ?? 0, change_pct: quotes[item.ticker]?.change_pct ?? 0 }
    ])
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="es" />
      <TickerTape indices={sectorIndices} labels={SECTOR_LABELS} />
      <CookieConsent locale="es" />

      {/* sm:pl-20 — fixed left "Feedback" tab clearance, see tr/home/page.tsx */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:pl-20 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          <div className="min-w-0">
            <HomeSearchBar locale="es" />
            {/* Genel endeks tickerlari — arama cubugunun hemen altinda */}
            <div className="mt-4">
              <MarketOverviewTabs groups={marketGroups} locale="es" />
            </div>

            <HomeIndexHighlights locale="es" />
            <DailyOnePickCard locale="es" />

            <div className="mt-4">
              <HomeScheduleBanner locale="es" />
            </div>

            <div className="mt-4">
              <HomeLatestAnalysis locale="es" />
            </div>

            <div className="mt-4">
              <HomeRecentEarnings locale="es" />
            </div>

            <div className="mt-4">
              <HomeMoversGrid locale="es" initialData={homeMoversData} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <TrendPicksSlot locale="es" compactMode initialStocks={trendStocksData} />
            <HomePersonalWatchlistCard locale="es" initialVisible={5} />
            <HomeListCard title="Sectores" accent="#3b82f6" stocks={sectorStocks} locale="es" initialVisible={5} viewAllHref="/global/es/sectors" />
            <HomeIndexTextFeed locale="es" />
          </div>
        </div>

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[10px] font-normal text-white/40">
              Última actualización: <span className="font-mono text-white/60">{lastUpdated}</span> (NY)
            </p>
          )}
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
