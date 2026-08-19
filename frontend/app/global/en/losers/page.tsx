import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import MoverPageTracker from "@/components/public/MoverPageTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Losers",
  alternates: { canonical: "https://bogastock.com/global/en/losers", languages: {
      en: "https://bogastock.com/global/en/losers",
      es: "https://bogastock.com/global/es/losers",
      fr: "https://bogastock.com/global/fr/losers",
      id: "https://bogastock.com/global/id/losers",
      pt: "https://bogastock.com/global/pt/losers",
      tr: "https://bogastock.com/global/tr/losers",
      "x-default": "https://bogastock.com/global/en/losers",
    } }
};


export default function EnLosersPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top Losers</span>
        </nav>

        <ListsNavigation locale="en" activePath="losers" />

        <div className="relative z-10">
          <MoverPageTracker mode="losers" locale="en" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
