import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LongTermDetailClient from "@/components/LongTermDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Long-Term Oyunlar | BOGA AI",
  description: "Uzun vadeli hisse seçimleri ve portföy yönetimi. Makro trendler, değer oyunları ve büyüme hisseleri.",
};

export default function LongTermPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <LongTermDetailClient />
      </main>
      <Footer />
    </div>
  );
}
