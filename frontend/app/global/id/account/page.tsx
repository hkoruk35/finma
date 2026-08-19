import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Akun Saya",
  alternates: { canonical: "https://bogastock.com/global/id/account", languages: {
      en: "https://bogastock.com/global/en/account",
      es: "https://bogastock.com/global/es/account",
      fr: "https://bogastock.com/global/fr/account",
      id: "https://bogastock.com/global/id/account",
      pt: "https://bogastock.com/global/pt/account",
      tr: "https://bogastock.com/global/tr/hesabim",
      "x-default": "https://bogastock.com/global/en/account",
    } }
};


export default function GlobalIdAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="id" />
      <main className="flex-1">
        <AccountView locale="id" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
