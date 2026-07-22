import { Metadata } from "next";
import Link from "next/link";
import SwingTracker from "@/components/public/SwingTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Günlük Trend ve İnteraktif Grafik Analizi",
  description: "Günlük teknik trend takibi ve gelişmiş interaktif teknik grafik analizi.",
  alternates: { canonical: "https://bogastock.com/global/tr/swing" },
};

export default function TrSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Günlük Trend Hisseleri Adayları</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/tr/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TREND</Link>
          <Link href="/global/tr/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">WATCHLIST</Link>
          <Link href="/global/tr/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TOP 100</Link>
          <Link href="/global/tr/my-watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">MY WATCHLIST</Link>
        </div>

        <div className="relative z-10">
          <SwingTracker locale="tr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
