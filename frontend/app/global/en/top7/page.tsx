import { Metadata } from "next";
import Link from "next/link";
import WatchlistTracker from "@/components/public/WatchlistTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TOP 7 Stocks — BOGA AI",
  description: "Featured TOP 7 stocks watchlist selected by BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/en/top7" },
};

export default function EnTop7Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">TOP 7</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/en/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TREND</Link>
          <Link href="/global/en/top7" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TOP 7</Link>
          <Link href="/global/en/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TOP 100</Link>
          <Link href="/global/en/my-watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">MY WATCHLIST</Link>
        </div>

        <div className="relative z-10">
          <WatchlistTracker locale="en" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
