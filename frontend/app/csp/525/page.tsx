import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CSPDetailClient from "@/components/CSPDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "525 CSP Watchlist | BOGA AI",
  description: "Cash Secured Put candidates in the $5–$25 price range.",
};

export default function CSP525Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <CSPDetailClient slug="525" />
      </main>
      <Footer />
    </div>
  );
}
