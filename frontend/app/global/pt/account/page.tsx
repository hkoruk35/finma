import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Account",
  alternates: { canonical: "https://bogastock.com/global/pt/account" }
};


export default function GlobalPtAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />
      <main className="flex-1">
        <AccountView locale="pt" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
