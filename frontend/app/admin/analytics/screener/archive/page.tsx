import { Metadata } from "next";
import Header from "@/components/Header";
import ScreenerArchiveClient from "@/components/ScreenerArchiveClient";

export const metadata: Metadata = {
  title: "Screener Arşivi | BOGA Screener",
  description: "Tüm screener taramaların zaman damgalı arşivi. Geçmiş tarama sonuçlarını görüntüle.",
  alternates: { canonical: "https://bogastock.com/screener/archive" },
};

export default function ScreenerArchivePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10]">
      <Header />
      <main className="flex-1 overflow-hidden">
        <ScreenerArchiveClient />
      </main>
    </div>
  );
}
