import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import CustomWatchlistTracker from "@/components/public/CustomWatchlistTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 0; // Dynamic route

export const metadata: Metadata = {
  title: "My Watchlist",
  alternates: { canonical: "https://bogastock.com/global/pt/my-watchlist", languages: {
      en: "https://bogastock.com/global/en/my-watchlist",
      es: "https://bogastock.com/global/es/my-watchlist",
      fr: "https://bogastock.com/global/fr/my-watchlist",
      id: "https://bogastock.com/global/id/my-watchlist",
      pt: "https://bogastock.com/global/pt/my-watchlist",
      tr: "https://bogastock.com/global/tr/my-watchlist",
      "x-default": "https://bogastock.com/global/en/my-watchlist",
    } }
};


export default function PtMyWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Minha Lista</span>
        </nav>

        <ListsNavigation locale="pt" activePath="my-watchlist" />

        <div className="relative z-10">
          <CustomWatchlistTracker locale="pt" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
