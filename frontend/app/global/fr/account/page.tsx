import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Account",
  alternates: { canonical: "https://bogastock.com/global/fr/account", languages: {
      en: "https://bogastock.com/global/en/account",
      es: "https://bogastock.com/global/es/account",
      fr: "https://bogastock.com/global/fr/account",
      id: "https://bogastock.com/global/id/account",
      pt: "https://bogastock.com/global/pt/account",
      tr: "https://bogastock.com/global/tr/hesabim",
      "x-default": "https://bogastock.com/global/en/account",
    } }
};


export default function GlobalFrAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />
      <main className="flex-1">
        <AccountView locale="fr" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
