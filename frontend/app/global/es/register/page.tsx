import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Crear Cuenta — BOGA AI",
  description: "Únete a BOGA AI Premium y accede al Rastreador Top 100 con señales EMA/RSI.",
  alternates: { canonical: "https://bogastock.com/global/es/register" },
};

export default function GlobalEsRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <MemberHeader locale="es" />
      <main className="flex-1">
        <RegisterForm locale="es" />
      </main>
      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
