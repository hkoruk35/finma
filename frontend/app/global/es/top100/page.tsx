import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import Top100NavBar from "@/components/global/Top100NavBar";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Rastreador",
  description: "Seguimiento en tiempo real, actualizado cada hora, de 100 acciones con señales EMA/RSI — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/global/es/top100" },
};

export default function EsTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <Top100NavBar locale="es" />

        <div className="relative z-10">
          <Top100Tracker locale="es" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
