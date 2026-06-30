import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Log In — BOGA AI",
  description: "Sign in to your free BOGA AI account to access the Top 100 Tracker and stock analysis.",
  alternates: { canonical: "https://bogastock.com/global/en/login" },
};

export default function GlobalEnLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header hideMenus={true} globalLocale="en" />
      <main className="flex-1 flex flex-col">
        <LoginForm
          locale="en"
          redirectTo="/global/en/home"
          registerHref="/global/en/register"
        />
      </main>
      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
