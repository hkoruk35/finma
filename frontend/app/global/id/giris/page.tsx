import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Giris",
  alternates: { canonical: "https://bogastock.com/global/tr/giris" }
};


export default function GlobalTrGirisPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="tr"
          redirectTo="/global/tr"
          registerHref="/global/tr/kayit"
        />
      </main>
      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
