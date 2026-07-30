import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import Top7Tracker from "@/components/public/Top7Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "TOP 7 Ações — BOGA AI",
  description: "Lista de observação das TOP 7 ações selecionadas pela BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/pt/top7" },
};

export default function PtTop7Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">TOP 7</span>
        </nav>

        <ListsNavigation locale="pt" activePath="top7" />

        <div className="relative z-10">
          <Top7Tracker locale="pt" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
