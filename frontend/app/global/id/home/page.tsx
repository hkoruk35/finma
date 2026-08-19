import { Metadata } from "next";
import Link from "next/link";
import MarketOverviewTabs, { type MarketGroup, type MarketQuoteItem } from "@/components/global/MarketOverviewTabs";
import HomeMoversGrid from "@/components/global/HomeMoversGrid";
import HomeLatestAnalysis from "@/components/global/HomeLatestAnalysis";
import HomeRecentEarnings from "@/components/global/HomeRecentEarnings";
import HomePersonalWatchlistCard from "@/components/global/HomePersonalWatchlistCard";
import HomeListCard, { type HomeListStock } from "@/components/global/HomeListCard";
import HomeSearchBar from "@/components/public/HomeSearchBar";
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
  alternates: { canonical: "https://bogastock.com/global/id/home" }, openGraph: { url: "https://bogastock.com/global/id/home" }
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
  { ticker: "GOLD", label: "Emas" },
  { ticker: "SILVER", label: "Perak" },
  { ticker: "USOIL", label: "Minyak Mentah" },
  { ticker: "NATGAS", label: "Gas Alam" },
];

const CRYPTO_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "BTCUSD", label: "Bitcoin" },
  { ticker: "ETHUSD", label: "Ethereum" },
  { ticker: "SOLUSD", label: "Solana" },
  { ticker: "XRPUSD", label: "XRP" },
];

const FUTURES_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "YM_F", label: "Futures Dow" },
  { ticker: "ES_F", label: "Futures S&P" },
  { ticker: "NQ_F", label: "Futures Nasdaq" },
  { ticker: "GC_F", label: "Futures Emas" },
  { ticker: "CL_F", label: "Futures Minyak" },
];

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Teknologi" },
  { ticker: "XLF", label: "Keuangan" },
  { ticker: "XLE", label: "Energi" },
  { ticker: "XLV", label: "Kesehatan" },
  { ticker: "XLY", label: "Konsumen Siklikal" },
  { ticker: "XLP", label: "Konsumen Primer" },
  { ticker: "XLI", label: "Industri" },
  { ticker: "XLB", label: "Material" },
  { ticker: "XLRE", label: "Properti" },
  { ticker: "XLU", label: "Utilitas" },
  { ticker: "XLC", label: "Komunikasi" },
];

const SECTOR_LABELS: Record<string, string> = {
  XLK: "Teknologi",
  XLF: "Keuangan",
  XLE: "Energi",
  XLV: "Kesehatan",
  XLY: "Konsumen Siklikal",
  XLP: "Konsumen Primer",
  XLI: "Industri",
  XLB: "Material",
  XLRE: "Properti",
  XLU: "Utilitas",
  XLC: "Komunikasi",
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

export default async function IdHomePage() {
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
    { key: "europe", label: "EROPA", items: toMarketItems(EUROPE_ITEMS, quotes) },
    { key: "asia", label: "ASIA", items: toMarketItems(ASIA_ITEMS, quotes) },
    { key: "latam", label: "AMERIKA LATIN", items: toMarketItems(LATAM_ITEMS, quotes) },
    { key: "fx", label: "VALUTA ASING", items: toMarketItems(FX_ITEMS, quotes) },
    { key: "commodities", label: "KOMODITAS", items: toMarketItems(COMMODITY_ITEMS, quotes) },
    { key: "crypto", label: "KRIPTO", items: toMarketItems(CRYPTO_ITEMS, quotes) },
    { key: "futures", label: "FUTURES", items: toMarketItems(FUTURES_ITEMS, quotes) },
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
      <MemberHeader locale="id" />
      <TickerTape indices={sectorIndices} labels={SECTOR_LABELS} />
      <CookieConsent locale="id" />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="min-w-0">
            <HomeSearchBar locale="id" />
            <DailyOnePickCard locale="id" />

            {/* Tab Pasar — Tepat Di Bawah Kolom Pencarian */}
            <div className="mt-4">
              <MarketOverviewTabs groups={marketGroups} locale="id" />
            </div>

            <div className="mt-4">
              <HomeScheduleBanner locale="id" />
            </div>

            <div className="mt-4">
              <HomeLatestAnalysis locale="id" />
            </div>

            <div className="mt-4">
              <HomeRecentEarnings locale="id" />
            </div>

            <div className="mt-4">
              <HomeMoversGrid locale="id" initialData={homeMoversData} initialTrendStocks={trendStocksData} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <HomePersonalWatchlistCard locale="id" initialVisible={5} />
            <HomeListCard title="Sektor" accent="#3b82f6" stocks={sectorStocks} locale="id" initialVisible={5} viewAllHref="/global/id/sectors" />
          </div>
        </div>

        {/* Info pembaruan */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[10px] font-normal text-white/40">
              Terakhir diperbarui: <span className="font-mono text-white/60">{lastUpdated}</span> (NY)
            </p>
          )}
        </div>
      </main>

      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
