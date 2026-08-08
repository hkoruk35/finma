import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/en/register" },
};

export default function EnRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} />
      <main className="flex-1">
        <RegisterForm locale="en" />
      </main>
      <Footer />
    </div>
  );
}
