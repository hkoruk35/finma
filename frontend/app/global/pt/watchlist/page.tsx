import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import GlobalWatchlistClient from "@/components/GlobalWatchlistClient";

export const metadata: Metadata = {
  title: "Watchlist | BOGA AI",
  description: "Todas as ações em todos os setores - 900+ ações, rastreamento e análise detalhados.",
  alternates: { canonical: "https://bogastock.com/global/pt/watchlist" },
};

export default function PtWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />

      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <GlobalWatchlistClient />
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
