import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import MoverPageTracker from "@/components/public/MoverPageTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Ações Mais Negociadas",
  description: "As ações com maior volume do Top 100 hoje.",
  alternates: { canonical: "https://bogastock.com/global/pt/mostactive" },
};

export default function PtMostActivePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Mais Negociadas</span>
        </nav>

        <ListsNavigation locale="pt" activePath="mostactive" />

        <div className="relative z-10">
          <MoverPageTracker mode="mostActive" locale="pt" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
