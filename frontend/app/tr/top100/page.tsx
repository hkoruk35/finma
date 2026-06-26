import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Tracker",
  description: "Gerçek zamanlı, saatlik güncellenen 100 hisselik takip tablosu — EMA/RSI sinyalleri ile BOGA AI.",
  alternates: { canonical: "https://bogastock.com/tr/top100" },
};

export default function TrTop100Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <Header />
      <main className="flex-1">
        <Top100Tracker locale="tr" />
      </main>
      <Footer />
    </div>
  );
}
