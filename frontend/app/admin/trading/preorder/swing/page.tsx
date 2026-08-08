import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PreOrderListClient from "@/components/PreOrderListClient";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default function PreOrderSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 w-full">
        <PreOrderListClient type="swing" />
      </main>
      <Footer />
    </div>
  );
}
