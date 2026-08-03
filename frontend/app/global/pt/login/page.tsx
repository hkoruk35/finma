import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Entrar — BOGA AI",
  description: "Entre na sua conta gratuita da BOGA AI para acessar o Rastreador Top 100 e a análise de ações.",
  alternates: { canonical: "https://bogastock.com/global/pt/login" },
};

export default function GlobalPtLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="pt"
          redirectTo="/global/pt"
          registerHref="/global/pt/register"
        />
      </main>
      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
