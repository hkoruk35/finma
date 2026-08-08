import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
  alternates: { canonical: "https://bogastock.com/global/fr/login" },
};

export default function GlobalFrLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="fr"
          redirectTo="/global/fr"
          registerHref="/global/fr/register"
        />
      </main>
      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
