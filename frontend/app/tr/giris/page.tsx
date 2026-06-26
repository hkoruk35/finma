import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Giriş Yap — BOGA AI",
  description: "BOGA AI hesabınıza giriş yaparak Top 100 Tracker'a erişin.",
  alternates: { canonical: "https://bogastock.com/tr/giris" },
};

export default function TrGirisPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} />
      <main className="flex-1">
        <LoginForm locale="tr" />
      </main>
      <Footer />
    </div>
  );
}
