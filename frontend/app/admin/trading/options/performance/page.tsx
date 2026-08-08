import { getMasterData, getOptionsOutcomes } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import OptionsPerformanceClient from "@/components/OptionsPerformanceClient";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default async function OptionsPerformancePage() {
  const [master, outcomes] = await Promise.all([
    getMasterData(),
    getOptionsOutcomes(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      {master && <TickerTape data={master} />}
      <Header />

      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/admin/trading/options" className="hover:text-white transition-colors">Options</Link>
          <span>/</span>
          <span className="text-slate-300">Performance</span>
        </nav>

        <OptionsPerformanceClient outcomes={outcomes} />

      </main>

      <Footer />
    </div>
  );
}
