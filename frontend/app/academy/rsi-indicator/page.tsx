import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";
import { articleRsi } from "@/lib/academy-i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "RSI Indicator Explained: Overbought & Oversold Stocks | BOGA Academy",
  description:
    "Learn what the RSI (Relative Strength Index) is, how to read overbought and oversold signals, RSI divergence, and how AI monitors RSI across 560 stocks automatically.",
  keywords: articleRsi.meta.en.keywords,
  alternates: { canonical: "https://bogastock.com/academy/rsi-indicator" },
  openGraph: {
    title: "RSI Indicator Explained: How to Spot Overbought and Oversold Stocks",
    description:
      "Master the RSI indicator with easy examples. Learn when to enter, avoid peaks, and let AI track RSI across 560 stocks automatically.",
    url: "https://bogastock.com/academy/rsi-indicator",
    type: "article",
  },
};

const RELATED = [
  { title: "How to Start Investing in US Stocks", href: "/academy/how-to-start-investing", tag: "Beginner" },
  { title: "Momentum Trading Explained", href: "/academy/momentum-trading", tag: "Intermediate" },
  { title: "AI Stock Picking Explained", href: "/academy/ai-stock-picking", tag: "BOGA Edge" },
];

export default function RsiIndicatorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "RSI Indicator Explained: How to Spot Overbought and Oversold Stocks",
            description: "Master RSI: spot overbought & oversold levels and time better entries.",
            author: { "@type": "Organization", name: "BOGA AI" },
            publisher: { "@type": "Organization", name: "BOGA – Blue One Global Analysis", url: "https://bogastock.com" },
            mainEntityOfPage: "https://bogastock.com/academy/rsi-indicator",
            datePublished: "2026-04-01",
            dateModified: new Date().toISOString().split("T")[0],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <AcademyArticleClient
            articleKey="rsi-indicator"
            content={articleRsi.content as any}
            breadcrumb={{ label: "RSI Indicator Explained", href: "/academy/rsi-indicator" }}
            relatedArticles={RELATED}
          />
        </main>
        <Footer />
      </div>
    </>
  );
}
