import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CSPListClient from "@/components/CSPListClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "2550 CSP Watchlist | BOGA AI",
  description: "Cash Secured Put candidates in the $25–$50 price range.",
};

export default function CSP2550Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <CSPListClient slug="2550" />
      </main>
      <Footer />
    </div>
  );
}
