import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Hesabim",
  alternates: { canonical: "https://bogastock.com/global/tr/hesabim" }
};


export default function GlobalTrHesabimPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <main className="flex-1">
        <AccountView locale="tr" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
