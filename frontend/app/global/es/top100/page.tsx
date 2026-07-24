import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Análisis Gráfico Interactivo de las 100 Principales Acciones",
  description: "Análisis gráfico interactivo avanzado y seguimiento técnico en vivo de las 100 principales acciones.",
  alternates: { canonical: "https://bogastock.com/global/es/top100" },
};

export default function EsTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Top 100 Acciones</span>
        </nav>

        <ListsNavigation locale="es" activePath="top100" />

        <Top100Tracker locale="es" />
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
