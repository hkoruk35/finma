import { Metadata } from "next";
import Link from "next/link";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Interactive Chart Analysis of Top 100 Stocks",
  description: "Advanced interactive chart analysis and live technical tracking of the Top 100 stocks.",
  alternates: { canonical: "https://bogastock.com/global/en/top100" },
};

export default function EnTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top 100 Stocks</span>
        </nav>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Link href="/global/en/swing" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top100' === 'swing' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TREND</Link>
          <Link href="/global/en/watchlist" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top100' === 'watchlist' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>WATCHLIST</Link>
          <Link href="/global/en/top7" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top100' === 'top7' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TOP 7</Link>
          <Link href="/global/en/top100" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top100' === 'top100' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TOP 100</Link>
          <Link href="/global/en/my-watchlist" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'top100' === 'my-watchlist' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>MY WATCHLIST</Link>
        </div>

        <Top100Tracker locale="en" />
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
