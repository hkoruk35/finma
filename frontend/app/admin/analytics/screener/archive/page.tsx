import { Metadata } from "next";
import Header from "@/components/Header";
import ScreenerArchiveClient from "@/components/ScreenerArchiveClient";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/screener/archive" },
};

export default function ScreenerArchivePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10]">
      <Header />
      <main className="flex-1 overflow-hidden">
        <ScreenerArchiveClient />
      </main>
    </div>
  );
}
