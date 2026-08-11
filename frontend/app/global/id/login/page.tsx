import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Masuk",
  alternates: { canonical: "https://bogastock.com/global/id/login" }
};


export default function GlobalIdLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="id" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="id"
          redirectTo="/global/id"
          registerHref="/global/id/register"
        />
      </main>
      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
