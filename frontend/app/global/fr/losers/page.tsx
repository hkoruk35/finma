import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import MoverPageTracker from "@/components/public/MoverPageTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Plus Fortes Baisses",
  description: "Les plus fortes baisses du Top 100 aujourd'hui.",
  alternates: { canonical: "https://bogastock.com/global/fr/losers" },
};

export default function FrLosersPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/fr/home" className="hover:text-[#3b82f6] transition-colors">Tableau de Bord</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Plus Fortes Baisses</span>
        </nav>

        <ListsNavigation locale="fr" activePath="losers" />

        <div className="relative z-10">
          <MoverPageTracker mode="losers" locale="fr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
