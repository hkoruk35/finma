import { Metadata } from "next";
import Header from "@/components/Header";
import ScreenerCockpit from "@/components/ScreenerCockpit";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description:
    "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  keywords: [
    "stock screener", "hisse tarayıcı", "swing trade", "day trade", "options screener",
    "EMA crossover", "BOGA score", "ABD hisseleri", "technical analysis", "momentum stocks"
  ],
  alternates: { canonical: "https://bogastock.com/screener" },
  openGraph: {
    title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
    url: "https://bogastock.com/screener",
    type: "website",
  },
};

export default function ScreenerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10]">
      <Header />
      <main className="flex-1 overflow-hidden">
        <ScreenerCockpit />
      </main>
    </div>
  );
}
