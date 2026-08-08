import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyIndexClient from "@/components/AcademyIndexClient";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description:
    "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  keywords: [
    "stock market academy",
    "learn stock trading",
    "beginner investing guide",
    "RSI indicator",
    "momentum trading",
    "AI stock analysis",
    "stock market education",
  ],
  alternates: { canonical: "https://bogastock.com/academy" },
  openGraph: {
    title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    description:
      "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
    url: "https://bogastock.com/academy",
    siteName: "BOGA AI – Blue One Global Analysis",
    type: "website",
  },
};

export default function AcademyPage() {
  return (
    <>
      {/* Schema.org structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            name: "BOGA AI Stock Market Academy",
            url: "https://bogastock.com/academy",
            description:
              "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
            teaches: [
              "Stock Market Fundamentals",
              "RSI Technical Analysis",
              "Momentum Trading",
              "AI Stock Picking",
            ],
          }),
        }}
      />
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <AcademyIndexClient />
        </main>
        <Footer />
      </div>
    </>
  );
}
