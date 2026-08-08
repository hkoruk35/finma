import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";
import { articleMomentum } from "@/lib/academy-i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description:
    "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  keywords: articleMomentum.meta.en.keywords,
  alternates: { canonical: "https://bogastock.com/academy/momentum-trading" },
  openGraph: {
    title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    description:
      "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
    url: "https://bogastock.com/academy/momentum-trading",
    type: "article",
  },
};

const RELATED = [
  { title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi", href: "/academy/rsi-indicator", tag: "Intermediate" },
  { title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi", href: "/academy/how-to-start-investing", tag: "Beginner" },
  { title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi", href: "/academy/ai-stock-picking", tag: "BOGA AI Edge" },
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
            description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
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
