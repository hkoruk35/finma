import { Metadata } from "next";
import Link from "next/link";
import TrendTracker from "@/components/public/TrendTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Acciones en Tendencia 2026 — BOGA AI",
  description: "Acciones que siguen las tendencias del mercado 2026 con fuerte impulso y liderazgo sectorial.",
  alternates: { canonical: "https://bogastock.com/global/es/trend" },
};

export default function EsTrendPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Acciones en Tendencia 2026</span>
        </nav>

        <div className="flex gap-2 mb-4">
          <Link href="/global/es/top100" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">TOP 100</Link>
          <Link href="/global/es/swing" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">SWING</Link>
          <Link href="/global/es/trend" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]">TENDENCIA</Link>
        </div>

        <div className="relative z-10">
          <TrendTracker locale="es" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
