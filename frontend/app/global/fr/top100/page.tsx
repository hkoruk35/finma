import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Top100NavBar from "@/components/global/Top100NavBar";

export const metadata: Metadata = {
  title: "Suivi Top 100 BOGA AI",
  description: "Suivi en temps réel, actualisé toutes les heures, de 100 actions avec signaux EMA/RSI — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/fr/top100" },
};

export default function FrTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <Top100NavBar locale="fr" />

        <div className="relative z-10">
          <Top100Tracker locale="fr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
