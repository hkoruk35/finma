import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Create Account — BOGA AI",
  description: "Join BOGA AI Premium and access the Top 100 Tracker with EMA/RSI signals.",
  alternates: { canonical: "https://bogastock.com/global/en/register" },
};

export default function GlobalEnRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <Header hideMenus={true} globalLocale="en" />
      <main className="flex-1">
        <RegisterForm locale="en" />
      </main>
      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
