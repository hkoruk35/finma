import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CSPDetailClient from "@/components/CSPDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Intraday Watchlist | BOGA AI",
  description: "Günlük intraday takip hisseleri. Saatlik performans ve durum güncellemeleri ile gerçek zamanlı takip.",
};

export default function CSPDailyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <CSPDetailClient slug="daily" />
      </main>
      <Footer />
    </div>
  );
}
