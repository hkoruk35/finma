import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Register",
  alternates: { canonical: "https://bogastock.com/global/pt/register", languages: {
      en: "https://bogastock.com/global/en/register",
      es: "https://bogastock.com/global/es/register",
      fr: "https://bogastock.com/global/fr/register",
      id: "https://bogastock.com/global/id/register",
      pt: "https://bogastock.com/global/pt/register",
      tr: "https://bogastock.com/global/tr/kayit",
      "x-default": "https://bogastock.com/global/en/register",
    } }
};


export default function GlobalPtRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <MemberHeader locale="pt" />
      <main className="flex-1">
        <RegisterForm locale="pt" />
      </main>
      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
