import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Iniciar Sesión — BOGA AI",
  description: "Inicia sesión en tu cuenta gratuita de BOGA AI para acceder al Rastreador Top 100 y al análisis de acciones.",
  alternates: { canonical: "https://bogastock.com/global/es/login" },
};

export default function GlobalEsLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} globalLocale="es" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="es"
          redirectTo="/global/es/home"
          registerHref="/global/es/register"
        />
      </main>
      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
