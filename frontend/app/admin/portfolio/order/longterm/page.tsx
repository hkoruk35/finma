import { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PortfolioClient from "@/components/PortfolioClient";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default function OrderLongTermPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 w-full">
        <Suspense fallback={<div style={{ padding: 60, color: "#8b949e", textAlign: "center" }}>Yükleniyor…</div>}>
          <PortfolioClient type="longterm" />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
