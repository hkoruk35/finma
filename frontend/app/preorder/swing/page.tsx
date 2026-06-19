import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PreOrderListClient from "@/components/PreOrderListClient";

export const metadata: Metadata = {
  title: "Pre-Order Swing Listesi — BOGA AI",
  description: "Onaylanan swing pozisyonları ve anlık performans takibi",
};

export default function PreOrderSwingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 w-full">
        <PreOrderListClient type="swing" />
      </main>
      <Footer />
    </div>
  );
}
