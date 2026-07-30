import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | En Çok Takip Edilen 100 Hissenin İnteraktif Grafik Analizi",
  description: "En çok takip edilen 100 hissenin gelişmiş interaktif grafik analizi ve teknik canlı takibi.",
  alternates: { canonical: "https://bogastock.com/global/tr/top100" },
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
