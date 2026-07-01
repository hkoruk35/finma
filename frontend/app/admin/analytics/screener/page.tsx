import { Metadata } from "next";
import Header from "@/components/Header";
import ScreenerCockpit from "@/components/ScreenerCockpit";

export const metadata: Metadata = {
  title: "BOGA Screener | Trade Setup Motor — ABD Hisse Tarayıcı",
  description:
    "Finviz'den farklı: Checkbox değil SETUP seç. Swing Continuation, Day Trade Momentum, Options Sniper ve daha fazlası. 8000+ ABD hissesinde gerçek zamanlı BOGA Score analizi.",
  keywords: [
    "stock screener", "hisse tarayıcı", "swing trade", "day trade", "options screener",
    "EMA crossover", "BOGA score", "ABD hisseleri", "technical analysis", "momentum stocks"
  ],
  alternates: { canonical: "https://bogastock.com/screener" },
  openGraph: {
    title: "BOGA Screener | Trade Setup Motor",
    description: "8000+ ABD hissesinde BOGA Score ile anlık setup avcılığı. Swing · Day · Options · Gamma Squeeze presetleri.",
    url: "https://bogastock.com/screener",
    type: "website",
  },
};

export default function ScreenerPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0c10]">
      <Header />
      <main className="flex-1 overflow-hidden">
        <ScreenerCockpit />
      </main>
    </div>
  );
}
