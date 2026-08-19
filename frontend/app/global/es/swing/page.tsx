import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import SwingTracker from "@/components/public/SwingTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Swing",
  alternates: { canonical: "https://bogastock.com/global/es/swing", languages: {
      en: "https://bogastock.com/global/en/swing",
      es: "https://bogastock.com/global/es/swing",
      fr: "https://bogastock.com/global/fr/swing",
      id: "https://bogastock.com/global/id/swing",
      pt: "https://bogastock.com/global/pt/swing",
      tr: "https://bogastock.com/global/tr/swing",
      "x-default": "https://bogastock.com/global/en/swing",
    } }
};


export default function EsSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Candidatos Diarios de Acciones en Tendencia</span>
        </nav>

        <ListsNavigation locale="es" activePath="swing" />

        <div className="relative z-10">
          <SwingTracker locale="es" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
