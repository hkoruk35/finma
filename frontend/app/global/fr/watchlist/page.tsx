import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import WatchlistTracker from "@/components/public/WatchlistTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "WATCHLIST Actions — BOGA AI",
  description: "Liste de surveillance des WATCHLIST actions sélectionnées par BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/fr/watchlist" },
};

export default function FrTop7Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/fr/home" className="hover:text-[#3b82f6] transition-colors">Tableau de bord</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">WATCHLIST</span>
        </nav>

        <ListsNavigation locale="fr" activePath="watchlist" />

        <div className="relative z-10">
          <WatchlistTracker locale="fr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
