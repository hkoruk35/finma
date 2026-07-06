import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Crear Cuenta — BOGA AI",
  description: "Regístrate gratis y accede al Rastreador Top 100 de BOGA AI con señales EMA/RSI.",
  alternates: { canonical: "https://bogastock.com/global/es/register" },
};

export default function GlobalEsRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} globalLocale="es" />
      <main className="flex-1">
        <RegisterForm locale="es" />
      </main>
      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
