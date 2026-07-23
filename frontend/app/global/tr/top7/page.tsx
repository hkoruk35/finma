import { Metadata } from "next";
import Link from "next/link";
import Top7Tracker from "@/components/public/Top7Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TOP 7 Hisseleri — BOGA AI",
  description: "BOGA AI tarafından seçilen güncel TOP 7 hisse takip listesi.",
  alternates: { canonical: "https://bogastock.com/global/tr/top7" },
};

export default function TrTop7Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">TOP 7</span>
        </nav>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Link href="/global/tr/swing" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top7' === 'swing' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TREND</Link>
          <Link href="/global/tr/watchlist" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top7' === 'watchlist' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>WATCHLIST</Link>
          <Link href="/global/tr/top7" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top7' === 'top7' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TOP 7</Link>
          <Link href="/global/tr/top100" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top7' === 'top100' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TOP 100</Link>
          <Link href="/global/tr/my-watchlist" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top7' === 'my-watchlist' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>MY WATCHLIST</Link>
        </div>

        <div className="relative z-10">
          <Top7Tracker locale="tr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
