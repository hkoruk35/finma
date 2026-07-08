import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Top100NavBar from "@/components/global/Top100NavBar";

export const metadata: Metadata = {
  title: "BOGA AI Rastreador Top 100",
  description: "Acompanhamento em tempo real, atualizado a cada hora, de 100 ações com sinais EMA/RSI — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/pt/top100" },
};

export default function PtTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <Top100NavBar locale="pt" />

        <div className="relative z-10">
          <Top100Tracker locale="pt" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
