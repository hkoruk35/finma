import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Tracker",
  description: "Real-time, hourly-refreshed tracking of 100 stocks with EMA/RSI signals — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/en/top100" },
};

export default function EnTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header />
      <main className="flex-1">
        <Top100Tracker locale="en" />
      </main>
      <Footer />
    </div>
  );
}
