import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase();

  const imageUrl = `https://bogastock.com/api/og/ticker/${tickerUpper}`;

  return {
    title: `${tickerUpper} - Technical Analysis Chart | Boga AI`,
    description: `View real-time technical analysis and interactive charts for ${tickerUpper}. Analyze price movements, indicators, and trading signals on Boga AI.`,
    openGraph: {
      title: `${tickerUpper} - Technical Analysis`,
      description: `Interactive chart and technical analysis for ${tickerUpper} on Boga AI`,
      url: `https://bogastock.com/global/en/graphic/${tickerUpper}`,
      siteName: "Boga AI",
      images: [{ url: imageUrl, width: 1200, height: 760, alt: `${tickerUpper} chart` }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${tickerUpper} - Technical Analysis`,
      description: `Interactive chart and technical analysis for ${tickerUpper}`,
      images: [imageUrl],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
