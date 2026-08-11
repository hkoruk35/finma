import { Metadata } from "next";
import HisseDetailGate from "@/components/public/HisseDetailGate";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  return {
    title: `${t} - Analisis Grafik Teknikal Interaktif Lanjutan dan Level | BOGASTOCK`,
    description: `Analisis grafik teknikal interaktif real-time untuk ${t}: EMA, RSI, MACD, dan level teknikal.`,
    alternates: { canonical: `https://bogastock.com/global/id/hisse/${t}` },
  };
}

export default async function GlobalIdHissePage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="id" />
      <div className="flex-1">
        <HisseDetailGate ticker={ticker.toUpperCase()} locale="id" />
      </div>
      <Footer hidePlatform locale="id" />
    </div>
  );
}
