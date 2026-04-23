import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import SmartCartDashboard from "@/components/SmartCartDashboard";
import { getMasterData } from "@/lib/data";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Smart Cart – Paper Trade Basket | BOGA AI",
  description: "Track your swing trade picks in a paper trading basket. Monitor PnL, sector distribution, and portfolio statistics — no real money involved.",
  alternates: { canonical: "https://bogastock.com/smart-cart" },
};

export default async function SmartCartPage() {
  const master = await getMasterData();
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      {master && <TickerTape data={master} />}
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <SmartCartDashboard />
      </main>
      <Footer />
    </div>
  );
}
