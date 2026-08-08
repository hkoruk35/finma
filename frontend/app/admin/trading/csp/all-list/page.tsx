import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AllListDetailClient from "@/components/AllListDetailClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ALL LIST Watchlist | BOGA AI",
  description: "Complete market universe with 900+ stocks - detailed tracking and analysis.",
};

export default function AllListPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-full mx-auto px-0 py-8">
        <Suspense fallback={null}>
          <AllListDetailClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
