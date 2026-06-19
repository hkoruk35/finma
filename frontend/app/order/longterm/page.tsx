import { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PortfolioClient from "@/components/PortfolioClient";

export const metadata: Metadata = {
  title: "Long Term Portföy — BOGA AI",
  description: "Canlı long term portföy takibi — günlük, haftalık, aylık ve yıllık PnL istatistikleri",
};

export default function OrderLongTermPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 w-full">
        <Suspense fallback={<div style={{ padding: 60, color: "#8b949e", textAlign: "center" }}>Yükleniyor…</div>}>
          <PortfolioClient type="longterm" />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
