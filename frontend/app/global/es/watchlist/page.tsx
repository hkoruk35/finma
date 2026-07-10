import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import GlobalWatchlistClient from "@/components/GlobalWatchlistClient";

export const metadata: Metadata = {
  title: "Watchlist | BOGA AI",
  description: "Todas las acciones en todos los sectores - 900+ acciones, seguimiento y análisis detallado.",
  alternates: { canonical: "https://bogastock.com/global/es/watchlist" },
};

export default function EsWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <GlobalWatchlistClient />
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
