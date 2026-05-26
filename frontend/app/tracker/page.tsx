import { Metadata } from "next";
import { TrackerPageClient } from "@/components/TrackerPageClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Tracker — BOGA AI",
  description: "Real-time 1H stock monitoring with technical indicators, signals, and entry/exit analysis",
  alternates: { canonical: "https://bogastock.com/tracker" },
};

export default function TrackerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <TrackerPageClient />
      </main>
      <Footer />
    </div>
  );
}
