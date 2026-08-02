import { Metadata } from "next";
import ListsNavigation from "@/components/global/ListsNavigation";
import ThemesBanner from "@/components/global/ThemesBanner";
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
  title: "BogaStock AI — Yapay Zekâ Destekli Borsa, Hisse Analiz ve Yatırım Karar Platformu",
  description: "BogaStock AI ile ABD hisseleri, endeksler, sektörler, döviz, emtia ve kripto varlıkların canlı grafik ve yapay zekâ destekli gelişmiş teknik analizlerini keşfedin.",
  keywords: ["ABD hisse analizi", "BogaStock AI", "hisse senedi teknik analiz", "endeks analizi", "döviz analizi", "emtia analizi", "kripto analizi", "yapay zeka borsa", "borsa grafik analiz"],
  openGraph: {
    title: "BogaStock AI — Yapay Zekâ Destekli Borsa, Hisse Analiz ve Yatırım Karar Platformu",
    description: "BogaStock AI ile ABD hisseleri, endeksler, sektörler, döviz, emtia ve kripto varlıkların canlı grafik ve yapay zekâ destekli gelişmiş teknik analizlerini keşfedin.",
    url: "https://bogastock.com/global/tr/home",
    siteName: "BogaStock Terminal",
    locale: "tr_TR",
    type: "website",
  },
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

const INDEX_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

const SECTOR_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "XLK", label: "Teknoloji" },
  { ticker: "XLF", label: "Finans" },
  { ticker: "XLE", label: "Enerji" },
  { ticker: "XLV", label: "Sağlık" },
  { ticker: "XLY", label: "Tüketici (İsteğe Bağlı)" },
  { ticker: "XLP", label: "Tüketici (Temel)" },
  { ticker: "XLI", label: "Sanayi" },
  { ticker: "XLB", label: "Malzeme" },
  { ticker: "XLRE", label: "Gayrimenkul" },
  { ticker: "XLU", label: "Kamu Hizmetleri" },
  { ticker: "XLC", label: "İletişim" },
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
  { ticker: "GOLD", label: "Altın" },
  { ticker: "SILVER", label: "Gümüş" },
  { ticker: "USOIL", label: "Ham Petrol" },
  { ticker: "NATGAS", label: "Doğalgaz" },
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

export default async function TrHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  const marketGroups: MarketGroup[] = [
    { key: "indices", label: "US Endeksleri", items: toMarketItems(INDEX_ITEMS, quotes) },
    { key: "fx", label: "Döviz", items: toMarketItems(FX_ITEMS, quotes) },
    { key: "commodities", label: "Emtia", items: toMarketItems(COMMODITY_ITEMS, quotes) },
    { key: "crypto", label: "Kripto", items: toMarketItems(CRYPTO_ITEMS, quotes) },
  ];

  const sectorStocks = toSectorStocks(SECTOR_ITEMS, quotes);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="tr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <HomeSearchBar locale="tr" />

        <div className="-mb-2">
          <ListsNavigation locale="tr" activePath="home" />
        </div>
        <ThemesBanner locale="tr" />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 mt-2 items-start">
          <div className="min-w-0">
            <MarketOverviewTabs groups={marketGroups} locale="tr" />
            <HomeMoversGrid locale="tr" />
          </div>

          <div className="flex flex-col gap-4">
            <HomePersonalWatchlistCard locale="tr" />
            <HomeListCard title="Sektörler" accent="#38bdf8" stocks={sectorStocks} locale="tr" />
          </div>
        </div>

        {/* Güncelleme bilgisi */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Son güncelleme: <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Veriler 15 dakika gecikmeli kaynaklardan analiz edilir. Sayfa, borsanın açık olduğu günlerde saat başı güncellenir.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
