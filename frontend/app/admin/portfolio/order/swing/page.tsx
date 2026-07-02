import { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PortfolioClient from "@/components/PortfolioClient";

export const metadata: Metadata = {
  title: "Swing Portföy — BOGA AI",
  description: "Canlı swing portföy takibi — günlük, haftalık, aylık ve yıllık PnL istatistikleri",
};

export default function OrderSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <Header />
      <main className="flex-1 w-full">
        <Suspense fallback={<div style={{ padding: 60, color: "#8b949e", textAlign: "center" }}>Yükleniyor…</div>}>
          <PortfolioClient type="swing" />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
