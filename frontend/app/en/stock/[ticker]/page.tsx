import { Metadata } from "next";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  return {
    title: `${t} — BOGA AI Stock Analysis`,
    description: `Real-time technical analysis for ${t}: EMA/RSI/MACD, BOGA Score, entry/stop/target levels.`,
    alternates: { canonical: `https://bogastock.com/en/stock/${t}` },
  };
}

export default async function EnStockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <TickerDetailPanel ticker={ticker.toUpperCase()} locale="en" fullPage />
    </div>
  );
}
