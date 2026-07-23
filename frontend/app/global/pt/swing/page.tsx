import { Metadata } from "next";
import Link from "next/link";
import SwingTracker from "@/components/public/SwingTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGASTOCK | Análise Gráfica Interativa Diária e Tendências Técnicas",
  description: "Análise gráfica técnica interativa diária com níveis de suporte, resistência e estrutura.",
  alternates: { canonical: "https://bogastock.com/global/pt/swing" },
};

export default function PtSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/pt/home" className="hover:text-[#3b82f6] transition-colors">Painel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Candidatos Diários de Ações em Tendência</span>
        </nav>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <Link href="/global/pt/swing" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'swing' === 'swing' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TREND</Link>
          <Link href="/global/pt/watchlist" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'swing' === 'watchlist' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>WATCHLIST</Link>
          <Link href="/global/pt/top7" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'swing' === 'top7' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TOP 7</Link>
          <Link href="/global/pt/top100" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'swing' === 'top100' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>TOP 100</Link>
          <Link href="/global/pt/my-watchlist" className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-colors ${'swing' === 'my-watchlist' ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]' : 'border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6]'}`}>MY WATCHLIST</Link>
        </div>

        <div className="relative z-10">
          <SwingTracker locale="pt" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
