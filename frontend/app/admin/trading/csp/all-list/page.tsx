import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AllListDetailClient from "@/components/AllListDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default function AllListPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <Suspense fallback={null}>
          <AllListDetailClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
