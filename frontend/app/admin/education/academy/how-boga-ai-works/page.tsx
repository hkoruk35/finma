import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";

export const metadata: Metadata = {
  title: "How BOGA AI Works: 3-Layer Swing Trading System",
  description: "Learn how swing113 scans 7,000+ stocks daily, picks 5 candidates, and inday313 monitors them hourly.",
};

export default function Page() {
  const enContent = {
    h1: "How BOGA AI Works: A 3-Layer System for Swing Trade Intelligence",
    intro: "BOGA AI is built around one goal: finding the highest-conviction swing trade opportunities every day and helping you manage them in real time.",
    sections: [
      {
        h2: "Layer 1 — Daily Scan: 7,000+ Stocks, 5 Picks Every Morning",
        body: "Every trading morning, swing113 scans 7,000+ US stocks and filters to 5 highest-conviction picks.",
        link: { label: "View today's picks →", href: "/swing" },
      },
      {
        h2: "Layer 2 — Performance Tracking: 180 Days of History",
        body: "Every pick is tracked from selection to resolution showing wins, losses, and sector performance.",
        link: { label: "View performance →", href: "/performance" },
      },
      {
        h2: "Layer 3 — Hourly Intelligence: inday313 Monitors Your Picks",
        body: "Every hour 10-16 NY, inday313 generates 9 signal types for last 5 days' picks using 1H + 15M timeframes.",
        link: { label: "View Hourly Pulse →", href: "/smart-tracker/hourly" },
      },
    ],
    cta_text: "Ready to see the system in action?",
    cta_btn: "View Today's 5 Picks",
  };

  const content = {
    en: enContent,
    es: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    pt: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    fr: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    tr: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    id: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
  };

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <AcademyArticleClient
            articleKey="how-boga-ai-works"
            content={content}
            breadcrumb={{ label: "How BOGA AI Works", href: "/academy/how-boga-ai-works" }}
            relatedArticles={[
              { title: "Swing Picks Explained", href: "/academy/swing-picks-explained", tag: "BOGA AI Edge" },
              { title: "Smart Tracker Guide", href: "/academy/smart-tracker", tag: "BOGA AI Edge" },
              { title: "Performance Dashboard", href: "/academy/performance-dashboard", tag: "BOGA AI Edge" },
            ]}
          />
        </main>
        <Footer />
      </div>
    </>
  );
}
