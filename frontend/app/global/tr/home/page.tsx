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

function withQuotes(
  items: { ticker: string; label: string }[],
  quotes: Record<string, { value: number; change_pct: number }>
): AssetClassItem[] {
  return items.map((it) => ({ ...it, quote: quotes[it.ticker] }));
}

export default async function TrHomePage() {
  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS, ...FX_ITEMS, ...COMMODITY_ITEMS, ...CRYPTO_ITEMS].map((i) => i.ticker);

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="tr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="-mb-2">
          <ListsNavigation locale="tr" activePath="home" />
        </div>
        {/* Themes Banner */}
        <ThemesBanner locale="tr" />

        <HomeAssetClassSection title="US Endeksleri" items={withQuotes(INDEX_ITEMS, quotes)} locale="tr" />
        <HomeAssetClassSection title="US Sektörleri" items={withQuotes(SECTOR_ITEMS, quotes)} locale="tr" />
        <HomeAssetClassSection title="Döviz" items={withQuotes(FX_ITEMS, quotes)} locale="tr" />
        <HomeAssetClassSection title="Emtia" items={withQuotes(COMMODITY_ITEMS, quotes)} locale="tr" />
        <HomeAssetClassSection title="Kripto" items={withQuotes(CRYPTO_ITEMS, quotes)} locale="tr" />

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
