import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/global/pt/top100" },
};

export default function PtTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top 100 Ações</span>
        </nav>

        <ListsNavigation locale="pt" activePath="top100" />

        <Top100Tracker locale="pt" />
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
