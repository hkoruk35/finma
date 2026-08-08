import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Login",
  alternates: { canonical: "https://bogastock.com/global/en/login" }
};


export default function GlobalEnLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="en"
          redirectTo="/global/en"
          registerHref="/global/en/register"
        />
      </main>
      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
