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
        <div className="mb-6 flex justify-between items-center bg-[#161b22] border border-[#30363d] p-4 rounded-xl">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Hourly Intraday Pulse</h2>
            <p className="text-sm text-gray-400 mt-1">Real-time status tracking of the 25-stock focus pool.</p>
          </div>
          <a href="/smart-tracker/hourly" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-900/20 transition-all">
            View Live Status →
          </a>
        </div>
        <SmartTrackerDashboard />
      </main>
      <Footer />
    </div>
  );
}
