import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DailyArchiveClient from "@/components/DailyArchiveClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default async function DailyArchivePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <DailyArchiveClient date={date} />
      </main>
      <Footer />
    </div>
  );
}
