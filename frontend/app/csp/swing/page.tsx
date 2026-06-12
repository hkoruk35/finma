import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SwingCSPClient from "@/components/SwingCSPClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swing Picks Watchlist | BOGA AI",
  description: "Günlük swing ticaret adayları. BOGA AI tarafından tespit edilen günlük setuplar ve fırsat analizi.",
};

export default function CSPSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <SwingCSPClient />
      </main>
      <Footer />
    </div>
  );
}
