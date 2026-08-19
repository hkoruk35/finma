import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Top100",
  alternates: { canonical: "https://bogastock.com/global/tr/top100", languages: {
      en: "https://bogastock.com/global/en/top100",
      es: "https://bogastock.com/global/es/top100",
      fr: "https://bogastock.com/global/fr/top100",
      id: "https://bogastock.com/global/id/top100",
      pt: "https://bogastock.com/global/pt/top100",
      tr: "https://bogastock.com/global/tr/top100",
      "x-default": "https://bogastock.com/global/en/top100",
    } }
};


export default function TrTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top 100 Hisse</span>
        </nav>

        <ListsNavigation locale="tr" activePath="top100" />

        <Top100Tracker locale="tr" />
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
