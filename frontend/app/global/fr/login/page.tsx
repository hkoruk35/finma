import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Se Connecter — BOGA AI",
  description: "Connectez-vous à votre compte BOGA AI gratuit pour accéder au Suivi Top 100 et à l'analyse boursière.",
  alternates: { canonical: "https://bogastock.com/global/fr/login" },
};

export default function GlobalFrLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} globalLocale="fr" />
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
