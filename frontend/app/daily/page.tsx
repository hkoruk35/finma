import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DailyTrackerClient from "@/components/DailyTrackerClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  keywords: ["intraday", "daily tracker", "boga ai", "hisse takip", "stock scanner"],
};

export default function DailyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6">
        <DailyTrackerClient />
      </main>
      <Footer />
    </div>
  );
}
