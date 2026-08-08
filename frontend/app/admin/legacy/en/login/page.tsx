import { Metadata } from "next";
import LoginForm from "@/components/public/LoginForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Log in — BOGA AI",
  description: "Sign in to your BOGA AI account to access the Top 100 Tracker.",
  alternates: { canonical: "https://bogastock.com/en/login" },
};

export default function EnLoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} />
      <main className="flex-1">
        <LoginForm locale="en" />
      </main>
      <Footer />
    </div>
  );
}
