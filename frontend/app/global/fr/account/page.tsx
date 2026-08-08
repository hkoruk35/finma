import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Account",
  alternates: { canonical: "https://bogastock.com/global/fr/account" }
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
