import { Metadata } from "next";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import Footer from "@/components/Footer";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  const lower = ticker.toLowerCase();
  return {
    title: `${t} — BOGA AI Hisse Analizi`,
    description: `${t} için gerçek zamanlı teknik analiz: EMA/RSI/MACD, BOGA Skoru, giriş/stop/hedef seviyeleri.`,
    alternates: { 
      canonical: `https://bogastock.com/tr/analiz/${lower}`,
      languages: {
        'en': `https://bogastock.com/en/analysis/${lower}`,
        'tr': `https://bogastock.com/tr/analiz/${lower}`,
        'es': `https://bogastock.com/es/analisis/${lower}`,
        'pt': `https://bogastock.com/pt/analise/${lower}`,
        'fr': `https://bogastock.com/fr/analyse/${lower}`,
        'id': `https://bogastock.com/id/analisis/${lower}`,
        'x-default': `https://bogastock.com/en/analysis/${lower}`,
      }
    },
  };
}

export default async function TrStockPage({ params }: { params: Promise<{ ticker: string }> }) {
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
