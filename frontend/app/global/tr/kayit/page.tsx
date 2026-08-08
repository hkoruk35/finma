import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/global/tr/kayit" },
};

export default function GlobalTrKayitPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <MemberHeader locale="tr" />
      <main className="flex-1">
        <RegisterForm locale="tr" />
      </main>
      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
