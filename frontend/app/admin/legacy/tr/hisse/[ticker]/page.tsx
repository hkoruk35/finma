import { Metadata } from "next";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";

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
    <div className="min-h-screen bg-[#000036]">
      <TickerDetailPanel ticker={ticker.toUpperCase()} locale="tr" fullPage />
    </div>
  );
}
