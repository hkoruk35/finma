import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase();

  return {
    title: `${tickerUpper} - Technical Analysis Chart | Boga AI`,
    description: `View real-time technical analysis and interactive charts for ${tickerUpper}. Analyze price movements, indicators, and trading signals on Boga AI.`,
    openGraph: {
      title: `${tickerUpper} - Technical Analysis`,
      description: `Interactive chart and technical analysis for ${tickerUpper} on Boga AI`,
      url: `https://bogastock.com/global/en/graphic/${tickerUpper}`,
      siteName: "Boga AI",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${tickerUpper} - Technical Analysis`,
      description: `Interactive chart and technical analysis for ${tickerUpper}`,
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
