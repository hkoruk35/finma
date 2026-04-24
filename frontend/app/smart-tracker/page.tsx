import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import SmartTrackerDashboard from "@/components/SmartTrackerDashboard";
import { getMasterData } from "@/lib/data";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Tracker – Paper Trade Portfolio | BOGA AI",
  description: "Track your swing trade picks in a paper trading portfolio. Monitor PnL, sector distribution, and portfolio statistics — no real money involved.",
  alternates: { canonical: "https://bogastock.com/smart-tracker" },
};

export default async function SmartTrackerPage() {
  const master = await getMasterData();
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <SmartTrackerDashboard />
      </main>
      <Footer />
    </div>
  );
}
