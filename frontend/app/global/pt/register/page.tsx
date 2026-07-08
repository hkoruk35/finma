import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Criar Conta — BOGA AI",
  description: "Cadastre-se gratuitamente e acesse o Rastreador Top 100 da BOGA AI com sinais EMA/RSI.",
  alternates: { canonical: "https://bogastock.com/global/pt/register" },
};

export default function GlobalPtRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} globalLocale="pt" />
      <main className="flex-1">
        <RegisterForm locale="pt" />
      </main>
      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
