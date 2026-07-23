import { Metadata } from "next";
import Link from "next/link";
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

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Link href="/global/es/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border transition-colors border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]">TREND</Link>
          <Link href="/global/es/watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border transition-colors border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]">WATCHLIST</Link>
          <Link href="/global/es/top7" className="text-[10px] font-bold px-3 py-1.5 rounded border transition-colors border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]">TOP 7</Link>
          <Link href="/global/es/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border transition-colors border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TOP 100</Link>
          <Link href="/global/es/my-watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border transition-colors border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]">MY WATCHLIST</Link>
        </div>

        <Top100Tracker locale="es" />
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
