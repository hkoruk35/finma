import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import MoverPageTracker from "@/components/public/MoverPageTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Mostactive",
  alternates: { canonical: "https://bogastock.com/global/en/mostactive", languages: {
      en: "https://bogastock.com/global/en/mostactive",
      es: "https://bogastock.com/global/es/mostactive",
      fr: "https://bogastock.com/global/fr/mostactive",
      id: "https://bogastock.com/global/id/mostactive",
      pt: "https://bogastock.com/global/pt/mostactive",
      tr: "https://bogastock.com/global/tr/mostactive",
      "x-default": "https://bogastock.com/global/en/mostactive",
    } }
};


export default function EnMostActivePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/en/home" className="hover:text-[#3b82f6] transition-colors">Dashboard</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Most Active</span>
        </nav>

        <ListsNavigation locale="en" activePath="mostactive" />

        <div className="relative z-10">
          <MoverPageTracker mode="mostActive" locale="en" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
