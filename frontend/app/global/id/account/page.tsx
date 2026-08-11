import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Akun Saya",
  alternates: { canonical: "https://bogastock.com/global/id/account" }
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
