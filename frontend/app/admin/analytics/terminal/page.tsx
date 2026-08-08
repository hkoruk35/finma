import { Metadata } from "next";
import Header from "@/components/Header";
import TerminalClient from "@/components/TerminalClient";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description:
    "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/terminal" },
};

export default function TerminalPage() {
  return (
    <div className="h-screen flex flex-col bg-[#060a12] overflow-hidden">
      <Header />
      <div className="flex-1 overflow-hidden">
        <TerminalClient />
      </div>
    </div>
  );
}
