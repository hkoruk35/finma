import { Metadata } from "next";
import Link from "next/link";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Tracker",
  description: "Real-time, hourly-refreshed tracking of 100 stocks with EMA/RSI signals — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/en/top100" },
};

export default function EnTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <div className="flex gap-2 mb-4">
          <Link href="/global/en/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TOP 100</Link>
          <Link href="/global/en/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">SWING</Link>
          <Link href="/global/en/trend" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TREND</Link>
        </div>

        <div className="relative z-10">
          <Top100Tracker locale="en" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
