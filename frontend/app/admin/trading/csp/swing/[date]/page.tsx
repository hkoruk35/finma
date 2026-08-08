import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SwingArchiveClient from "@/components/SwingArchiveClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Swing Picks Archive | BOGA AI",
  description: "Swing ticaret adayları arşivi — tarihli veriler ve performans analizi.",
};

export default async function SwingArchivePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <SwingArchiveClient date={date} />
      </main>
      <Footer />
    </div>
  );
}
