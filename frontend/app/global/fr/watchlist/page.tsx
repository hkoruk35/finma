import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import GlobalWatchlistClient from "@/components/GlobalWatchlistClient";

export const metadata: Metadata = {
  title: "Watchlist | BOGA AI",
  description: "Toutes les actions de tous les secteurs - 900+ actions, suivi et analyse détaillés.",
  alternates: { canonical: "https://bogastock.com/global/fr/watchlist" },
};

export default function FrWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="fr" />

      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <GlobalWatchlistClient />
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
