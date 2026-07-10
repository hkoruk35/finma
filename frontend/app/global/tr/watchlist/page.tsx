import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import GlobalWatchlistClient from "@/components/GlobalWatchlistClient";

export const metadata: Metadata = {
  title: "Watchlist | BOGA AI",
  description: "Tüm sektörlerde hisse senetleri - 900+ hisse, detaylı takip ve analiz.",
  alternates: { canonical: "https://bogastock.com/global/tr/watchlist" },
};

export default function TrWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <GlobalWatchlistClient />
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
