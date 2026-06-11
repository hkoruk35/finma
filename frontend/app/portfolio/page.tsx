import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PortfolioDetailClient from "@/components/PortfolioDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portföy | BOGA AI",
  description: "Kişisel portföy yönetimi ve takip. Sahip olduğunuz hisseleri takip edin, giriş fiyatlarını kaydedin.",
};

export default function PortfolioPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <PortfolioDetailClient />
      </main>
      <Footer />
    </div>
  );
}
