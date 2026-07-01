import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";
import { articleMomentum } from "@/lib/academy-i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Momentum Trading Explained: How Stocks Start Moving Fast | BOGA AI Academy",
  description:
    "Master momentum trading strategy. Learn how to identify fast-moving stocks, why momentum works academically, key entry signals, and how AI detects momentum before it peaks.",
  keywords: articleMomentum.meta.en.keywords,
  alternates: { canonical: "https://bogastock.com/academy/momentum-trading" },
  openGraph: {
    title: "Momentum Trading Explained: Catch the Move Before Everyone Else",
    description:
      "Why momentum works, how to spot it early using RSI, volume, and EMAs, and how BOGA AI flags momentum before it becomes obvious.",
    url: "https://bogastock.com/academy/momentum-trading",
    type: "article",
  },
};

const RELATED = [
  { title: "RSI Indicator Explained", href: "/academy/rsi-indicator", tag: "Intermediate" },
  { title: "How to Start Investing in US Stocks", href: "/academy/how-to-start-investing", tag: "Beginner" },
  { title: "AI Stock Picking Explained", href: "/academy/ai-stock-picking", tag: "BOGA AI Edge" },
];

export default function MomentumTradingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "Momentum Trading Explained: How Stocks Start Moving Fast",
            description: "Master the momentum trading strategy with data-driven entry signals and AI-powered early detection.",
            author: { "@type": "Organization", name: "BOGA AI" },
            publisher: { "@type": "Organization", name: "BOGA AI – Blue One Global Analysis", url: "https://bogastock.com" },
            mainEntityOfPage: "https://bogastock.com/academy/momentum-trading",
            datePublished: "2026-04-01",
            dateModified: new Date().toISOString().split("T")[0],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <AcademyArticleClient
            articleKey="momentum-trading"
            content={articleMomentum.content as any}
            breadcrumb={{ label: "Momentum Trading Explained", href: "/academy/momentum-trading" }}
            relatedArticles={RELATED}
          />
        </main>
        <Footer />
      </div>
    </>
  );
}
