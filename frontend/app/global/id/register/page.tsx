import { Metadata } from "next";
import RegisterForm from "@/components/public/RegisterForm";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Daftar",
  alternates: { canonical: "https://bogastock.com/global/id/register" }
};


export default function GlobalIdRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#010409]">
      <MemberHeader locale="id" />
      <main className="flex-1">
        <RegisterForm locale="id" />
      </main>
      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
