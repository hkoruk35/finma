import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";
import { articleAI } from "@/lib/academy-i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "AI Stock Picking Explained: How Algorithms Find Winning Stocks | BOGA AI Academy",
  description:
    "Learn how AI stock analysis works, what an AI score of 70+ means, how BOGA AI scans 560 US stocks daily, and why algorithms consistently outperform human investors.",
  keywords: articleAI.meta.en.keywords,
  alternates: { canonical: "https://bogastock.com/academy/ai-stock-picking" },
  openGraph: {
    title: "AI Stock Picking Explained: Algorithms vs. Human Investors",
    description:
      "Understand how AI master scores work, the BOGA AI daily workflow, and why emotional-free analysis consistently wins over time.",
    url: "https://bogastock.com/academy/ai-stock-picking",
    type: "article",
  },
};

const RELATED = [
  { title: "RSI Indicator Explained", href: "/academy/rsi-indicator", tag: "Intermediate" },
  { title: "Momentum Trading Explained", href: "/academy/momentum-trading", tag: "Intermediate" },
  { title: "How to Start Investing in US Stocks", href: "/academy/how-to-start-investing", tag: "Beginner" },
];

export default function AIStockPickingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "AI Stock Picking Explained: How Algorithms Find Winning Stocks",
            description: "How AI stock scoring works, why 70+ matters, and the BOGA AI daily analysis workflow across 560 US stocks.",
            author: { "@type": "Organization", name: "BOGA AI" },
            publisher: { "@type": "Organization", name: "BOGA AI – Blue One Global Analysis", url: "https://bogastock.com" },
            mainEntityOfPage: "https://bogastock.com/academy/ai-stock-picking",
            datePublished: "2026-04-01",
            dateModified: new Date().toISOString().split("T")[0],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <AcademyArticleClient
            articleKey="ai-stock-picking"
            content={articleAI.content as any}
            breadcrumb={{ label: "AI Stock Picking Explained", href: "/academy/ai-stock-picking" }}
            relatedArticles={RELATED}
          />
        </main>
        <Footer />
      </div>
    </>
  );
}
