import Header from "@/components/Header";
import Footer from "@/components/Footer";
import DailyArchiveClient from "@/components/DailyArchiveClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Intraday Archive | BOGA AI",
  description: "Günlük intraday hisse takip arşivi — tarihli veriler ve durum analizi.",
};

export default async function DailyArchivePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        <DailyArchiveClient date={date} />
      </main>
      <Footer />
    </div>
  );
}
