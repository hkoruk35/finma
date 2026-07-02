import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PreOrderListClient from "@/components/PreOrderListClient";

export const metadata: Metadata = {
  title: "Pre-Order Long Term Listesi — BOGA AI",
  description: "Onaylanan long term pozisyonları ve anlık performans takibi",
};

export default function PreOrderLongTermPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <Header />
      <main className="flex-1 w-full">
        <PreOrderListClient type="longterm" />
      </main>
      <Footer />
    </div>
  );
}
