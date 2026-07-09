import { Metadata } from "next";
import HisseDetailGate from "@/components/public/HisseDetailGate";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  return {
    title: `${t} — BOGA AI Hisse Analizi`,
    description: `${t} için gerçek zamanlı teknik analiz: EMA/RSI/MACD, BOGA Score, alış/stop/hedef seviyeleri.`,
    alternates: { canonical: `https://bogastock.com/global/tr/hisse/${t}` },
  };
}

export default async function GlobalTrHissePage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <div className="flex-1">
        <HisseDetailGate ticker={ticker.toUpperCase()} locale="tr" />
      </div>
      <Footer hidePlatform locale="tr" />
    </div>
  );
}
