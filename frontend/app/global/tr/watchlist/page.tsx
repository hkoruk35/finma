import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import WatchlistTracker from "@/components/public/WatchlistTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Watchlist",
  alternates: { canonical: "https://bogastock.com/global/tr/watchlist", languages: {
      en: "https://bogastock.com/global/en/watchlist",
      es: "https://bogastock.com/global/es/watchlist",
      fr: "https://bogastock.com/global/fr/watchlist",
      id: "https://bogastock.com/global/id/watchlist",
      pt: "https://bogastock.com/global/pt/watchlist",
      tr: "https://bogastock.com/global/tr/watchlist",
      "x-default": "https://bogastock.com/global/en/watchlist",
    } }
};


export default function TRWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">WATCHLIST</span>
        </nav>

        <ListsNavigation locale="tr" activePath="watchlist" />

        <div className="relative z-10">
          <WatchlistTracker locale="tr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
