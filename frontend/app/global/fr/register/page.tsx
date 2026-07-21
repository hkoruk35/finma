import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Créer un Compte — BOGA AI",
  description: "Rejoignez BOGA AI Premium et accédez au Suivi Top 100 avec signaux EMA/RSI.",
  alternates: { canonical: "https://bogastock.com/global/fr/register" },
};

export default function GlobalFrRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} globalLocale="fr" />
      <main className="flex-1">
        <RegisterForm locale="fr" />
      </main>
      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
