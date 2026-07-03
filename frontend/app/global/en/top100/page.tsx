import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Top100NavBar from "@/components/global/Top100NavBar";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Tracker",
  description: "Real-time, hourly-refreshed tracking of 100 stocks with EMA/RSI signals — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/en/top100" },
};

export default function EnTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <Top100NavBar locale="en" />

        <div className="relative z-10">
          <Top100Tracker locale="en" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
