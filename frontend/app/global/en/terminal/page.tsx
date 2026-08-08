import { Metadata } from 'next';
import GlobalLandingPage from '@/components/global/GlobalLandingPage';
import { fetchLiveQuotes } from '@/lib/homeFeed';
import { TrendStatus } from '@/lib/homeFeed';

export const revalidate = 120;

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: `https://bogastock.com/global/en/terminal` },
};

export default async function LandingPage() {
  // Default tickers for Watchlist (Top 7)
  const defaultTickers = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA'];
  const live = await fetchLiveQuotes(defaultTickers);

  const defaultWatchlist = defaultTickers.map(ticker => {
    const l = live[ticker];
    return {
      ticker,
      sector: l?.sector ?? 'Technology',
      status: (l?.tracker_1h?.signal === 'STRONG' ? 'BULLISH' : l?.tracker_1h?.signal === 'WEAK' ? 'BEARISH' : 'NEUTRAL') as TrendStatus,
      price: l?.price?.current ?? 0,
      change_pct: l?.tracker_1h?.change_pct_1d ?? l?.price?.change_pct ?? 0,
      sparkline: l?.sparkline ?? [],
    };
  });

  return <GlobalLandingPage locale={'en'} defaultWatchlist={defaultWatchlist} />;
}
