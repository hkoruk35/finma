import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Giriş Yap — BOGA AI",
  description: "Ücretsiz BOGA AI hesabınıza giriş yaparak Top 100 Tracker ve hisse analizlerine erişin.",
  alternates: { canonical: "https://bogastock.com/global/tr/giris" },
};

export default function GlobalTrGirisPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} globalLocale="tr" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="tr"
          redirectTo="/global/tr/home"
          registerHref="/global/tr/kayit"
        />
      </main>
      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
