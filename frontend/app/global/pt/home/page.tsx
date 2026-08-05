import { Metadata } from "next";
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

const FUTURES_ITEMS: { ticker: string; label: string }[] = [
  { ticker: "YM_F", label: "Dow Futuros" },
  { ticker: "ES_F", label: "S&P Futuros" },
  { ticker: "NQ_F", label: "Nasdaq Futuros" },
  { ticker: "GC_F", label: "Ouro Futuros" },
  { ticker: "CL_F", label: "Petróleo Futuros" },
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

const SECTOR_LABELS: Record<string, string> = {
  XLK: "Tecnologia",
  XLF: "Financeiro",
  XLE: "Energia",
  XLV: "Saúde",
  XLY: "Consumo Discricionário",
  XLP: "Consumo Básico",
  XLI: "Industrial",
  XLB: "Materiais",
  XLRE: "Imóveis",
  XLU: "Utilidades",
  XLC: "Comunicação",
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

export default async function PtHomePage() {
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

  const [lastUpdated, indices, quotes] = await Promise.all([
    getLastUpdated(),
    getLiveIndices(),
    getMultiQuote(allTickers),
  ]);

  const marketGroups: MarketGroup[] = [
    { key: "us", label: "US", items: toMarketItems(INDEX_ITEMS, quotes) },
    { key: "europe", label: "EUROPA", items: toMarketItems(EUROPE_ITEMS, quotes) },
    { key: "asia", label: "ÁSIA", items: toMarketItems(ASIA_ITEMS, quotes) },
    { key: "latam", label: "AMÉRICA LATINA", items: toMarketItems(LATAM_ITEMS, quotes) },
    { key: "fx", label: "CÂMBIO", items: toMarketItems(FX_ITEMS, quotes) },
    { key: "commodities", label: "COMMODITIES", items: toMarketItems(COMMODITY_ITEMS, quotes) },
    { key: "crypto", label: "CRIPTO", items: toMarketItems(CRYPTO_ITEMS, quotes) },
    { key: "futures", label: "FUTUROS", items: toMarketItems(FUTURES_ITEMS, quotes) },
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
      <MemberHeader locale="pt" />
      <TickerTape indices={sectorIndices} labels={SECTOR_LABELS} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="min-w-0">
            <HomeSearchBar locale="pt" />

            <div className="mt-4">
              <MarketOverviewTabs groups={marketGroups} locale="pt" />
            </div>

            <div className="mt-4">
              <HomeMoversGrid locale="pt" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <HomePersonalWatchlistCard locale="pt" initialVisible={5} />
            <HomeListCard title="Setores" accent="#3b82f6" stocks={sectorStocks} locale="pt" initialVisible={5} viewAllHref="/global/pt/sectors" />
          </div>
        </div>

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[10px] font-normal text-white/40">
              Última atualização: <span className="font-mono text-white/60">{lastUpdated}</span> (NY)
            </p>
          )}
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
