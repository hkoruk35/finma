import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CSPDetailClient from "@/components/CSPDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Long-Term Oyunlar | BOGA AI",
  description: "Uzun vadeli hisse seçimleri ve makro trendler.",
};

export default function LongTermPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <CSPDetailClient slug="long_term" />
      </main>
      <Footer />
    </div>
  );
}
