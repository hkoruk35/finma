import { Metadata } from "next";
import AccountView from "@/components/public/AccountView";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Account",
  alternates: { canonical: "https://bogastock.com/global/es/account" }
};


export default function GlobalEsAccountPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />
      <main className="flex-1">
        <AccountView locale="es" isGlobal={true} />
      </main>
      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
