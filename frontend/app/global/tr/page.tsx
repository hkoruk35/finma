import { Metadata } from 'next';
import { getMemberAccess } from '@/lib/apiAuth';
import GlobalLandingPage from '@/components/global/GlobalLandingPage';
import { fetchLiveQuotes } from '@/lib/homeFeed';
import { TrendStatus } from '@/lib/homeFeed';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'BOGASTOCK | ABD Hisseleri, Altın, Döviz ve Kripto Gelişmiş İnteraktif Grafik Analizi',
  description: 'ABD hisseleri, altın, döviz ve kripto varlıkların gelişmiş interaktif teknik grafik analizi.',
  alternates: { canonical: `https://bogastock.com/global/tr` },
};

export default async function LandingPage() {
  const memberAccess = await getMemberAccess();
  
  // Default tickers for Watchlist
  const defaultTickers = ['AAPL', 'GOOG', 'MSFT', 'AMZN', 'NVDA', 'META', 'TSLA'];
  const live = await fetchLiveQuotes(defaultTickers);

  const defaultWatchlist = defaultTickers.map(ticker => {
    const l = live[ticker];
    return {
      ticker,
      sector: l?.sector ?? 'Technology',
      status: (l?.tracker_1h?.signal === 'BUY' ? 'BULLISH' : l?.tracker_1h?.signal === 'SELL' ? 'BEARISH' : 'NEUTRAL') as TrendStatus,
      price: l?.price?.current ?? 0,
      change_pct: l?.tracker_1h?.change_pct_1d ?? l?.price?.change_pct ?? 0,
      sparkline: l?.sparkline ?? [],
    };
  });

  return <GlobalLandingPage locale={'tr'} defaultWatchlist={defaultWatchlist} />;
}
