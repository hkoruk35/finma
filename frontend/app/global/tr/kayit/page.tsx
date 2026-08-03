import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Üye Ol — BOGA AI",
  description: "BOGA AI Premium üyeliğine katılın ve Top 100 Tracker'a EMA/RSI sinyalleriyle erişin.",
  alternates: { canonical: "https://bogastock.com/global/tr/kayit" },
};

export default function GlobalTrKayitPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <MemberHeader locale="tr" />
      <main className="flex-1">
        <RegisterForm locale="tr" />
      </main>
      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
