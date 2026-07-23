import { Metadata } from "next";
import Link from "next/link";
import WatchlistTracker from "@/components/public/WatchlistTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TOP 7 Actions — BOGA AI",
  description: "Liste de surveillance des TOP 7 actions sélectionnées par BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/fr/top7" },
};

export default function FrTop7Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/fr/home" className="hover:text-[#3b82f6] transition-colors">Tableau de bord</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">TOP 7</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/fr/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TENDANCE</Link>
          <Link href="/global/fr/top7" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TOP 7</Link>
          <Link href="/global/fr/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TOP 100</Link>
          <Link href="/global/fr/my-watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">MA LISTE</Link>
        </div>

        <div className="relative z-10">
          <WatchlistTracker locale="fr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
