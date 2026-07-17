import { Metadata } from "next";
import Link from "next/link";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Les 100 Meilleures Actions - BOGA AI",
  description: "Suivi en direct des 100 meilleures actions.",
  alternates: { canonical: "https://bogastock.com/global/fr/top100" },
};

export default function FrTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/fr/home" className="hover:text-[#3b82f6] transition-colors">Tableau de Bord</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top 100 Actions</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/fr/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">SWING</Link>
          <Link href="/global/fr/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">WATCHLIST</Link>
          <Link href="/global/fr/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TOP 100</Link>
        </div>

        <Top100Tracker locale="fr" />
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
