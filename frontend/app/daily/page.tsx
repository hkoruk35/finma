import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DailyTrackerClient from "@/components/DailyTrackerClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Intraday Tracker | BOGA AI",
  description: "Sabah ilk taramadan gün sonuna kadar tüm intraday sinyallerin canlı takibi. Isı haritası ve gün sonu arşivi.",
  keywords: ["intraday", "daily tracker", "boga ai", "hisse takip", "stock scanner"],
};

export default function DailyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6">
        <DailyTrackerClient />
      </main>
      <Footer />
    </div>
  );
}
