import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Üye Ol — BOGA AI",
  description: "Ücretsiz üye olun ve BOGA AI Top 100 Tracker'a EMA/RSI sinyalleriyle erişin.",
  alternates: { canonical: "https://bogastock.com/tr/kayit" },
};

export default function TrKayitPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} />
      <main className="flex-1">
        <RegisterForm locale="tr" />
      </main>
      <Footer />
    </div>
  );
}
