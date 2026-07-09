import { Metadata } from "next";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import Footer from "@/components/Footer";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  return {
    title: `${t} — BOGA AI Hisse Analizi`,
    description: `${t} için gerçek zamanlı teknik analiz: EMA/RSI/MACD, BOGA Score, alış/stop/hedef seviyeleri.`,
    alternates: { canonical: `https://bogastock.com/tr/hisse/${t}` },
  };
}

export default async function TrHissePage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <div className="flex-1">
        <TickerDetailPanel ticker={ticker.toUpperCase()} locale="tr" fullPage />
      </div>
      <Footer hidePlatform locale="tr" />
    </div>
  );
}
