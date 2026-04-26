import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";

export const metadata: Metadata = {
  title: "Smart Tracker: Paper Trade & Hourly Signals",
  description: "Track BOGA AI picks and get hourly intraday signals for position management.",
};

export default function Page() {
  const content = {
    h1: "Smart Tracker Guide",
    intro: "Add a pick to Smart Tracker and get automatic PnL tracking plus hourly intraday signals.",
    sections: [
      { h2: "Paper Tracker", body: "Set entry, position size, track PnL and holding period" },
      { h2: "Hourly Signals", body: "Last 5 days picks get 9 signal types from inday313 bot every hour" },
      { h2: "Hourly Pulse Page", body: "See all picks with signals at /smart-tracker/hourly" },
    ],
    cta_text: "Start tracking picks",
    cta_btn: "View Picks",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <AcademyArticleClient articleKey="smart-tracker" content={content as any} breadcrumb={{ label: "Smart Tracker", href: "/academy/smart-tracker" }} relatedArticles={[]} />
      </main>
      <Footer />
    </div>
  );
}
