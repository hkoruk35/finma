import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyIndexClient from "@/components/AcademyIndexClient";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Stock Market Academy | Learn AI Stock Analysis & Investing Strategies – BOGA AI",
  description:
    "Free stock market education: beginner guides, technical indicators (RSI, momentum), and AI stock analysis tutorials. Learn how to pick winning stocks with data.",
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
    title: "BOGA AI Stock Market Academy – Free AI Investing Guides",
    description:
      "From beginner basics to advanced AI-powered stock picking. Free guides trusted by thousands of US equity investors.",
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
              "Free stock market education platform — beginner to advanced AI investing strategies.",
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
