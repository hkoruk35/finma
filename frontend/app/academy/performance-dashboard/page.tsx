import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";

export const metadata: Metadata = {
  title: "Performance Dashboard: 180-Day Track Record",
  description: "Learn to interpret win rates, returns, and sector performance of BOGA AI picks.",
};

export default function Page() {
  const content = {
    h1: "How to Read the Performance Dashboard",
    intro: "The Performance Dashboard shows every swing pick from the last 180 days with full transparency.",
    sections: [
      { h2: "Status Types", body: "Won, Lost, Partial, Active - no curated data, just results" },
      { h2: "Key Metrics", body: "Win Rate, Average Return, Average Hold Days" },
      { h2: "Sector Breakdown", body: "See which sectors perform best to adjust position sizing" },
    ],
    cta_text: "View track record",
    cta_btn: "View Dashboard",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <AcademyArticleClient articleKey="performance" content={content as any} breadcrumb={{ label: "Performance Dashboard", href: "/academy/performance-dashboard" }} relatedArticles={[]} />
      </main>
      <Footer />
    </div>
  );
}
