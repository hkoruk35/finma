import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Kayit",
  alternates: { canonical: "https://bogastock.com/global/tr/kayit", languages: {
      en: "https://bogastock.com/global/en/register",
      es: "https://bogastock.com/global/es/register",
      fr: "https://bogastock.com/global/fr/register",
      id: "https://bogastock.com/global/id/register",
      pt: "https://bogastock.com/global/pt/register",
      tr: "https://bogastock.com/global/tr/kayit",
      "x-default": "https://bogastock.com/global/en/register",
    } }
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
