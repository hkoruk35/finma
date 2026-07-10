import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import AllListDetailClient from "@/components/AllListDetailClient";

export const metadata: Metadata = {
  title: "Watchlist | BOGA AI",
  description: "All stocks across all sectors - 900+ stocks, detailed tracking and analysis.",
  alternates: { canonical: "https://bogastock.com/global/en/watchlist" },
};

export default function EnWatchlistPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />

      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <AllListDetailClient />
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
