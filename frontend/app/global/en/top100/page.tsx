import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
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
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top 100 Stocks</span>
        </nav>

        <ListsNavigation locale="en" activePath="top100" />

        <Top100Tracker locale="en" />
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
