import { Metadata } from 'next';
import { getMemberAccess } from '@/lib/apiAuth';
import GlobalLandingPage from '@/components/global/GlobalLandingPage';
import { fetchLiveQuotes } from '@/lib/homeFeed';
import { TrendStatus } from '@/lib/homeFeed';

export const revalidate = 120;

export const metadata: Metadata = {
  title: 'BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.',
  description: 'BOGASTOCK Terminal | Analyze U.S. stocks with interactive charts and market insights.',
  alternates: { canonical: `https://bogastock.com/global/en` },
};

export default async function LandingPage() {
  const memberAccess = await getMemberAccess();
  
  // Default tickers for Watchlist
  const defaultTickers = ['AAPL', 'GOOG', 'MSFT', 'NVDA', 'META', 'TSLA'];
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

  return <GlobalLandingPage locale={'en'} defaultWatchlist={defaultWatchlist} />;
}
