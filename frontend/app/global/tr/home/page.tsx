import { Metadata } from "next";
import { getMasterData, getSwingAllPicks, getAllTickers } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import MarketIndicesTicker from "@/components/global/MarketIndicesTicker";
import HomeGridCard from "@/components/global/HomeGridCard";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "BOGA AI Gösterge Paneli",
  description: "Swing trade adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

interface StockRow {
  ticker: string;
  company: string;
  sector: string;
  price: string;
  change: string;
  changeNum: number;
  signal: string;
}

export default async function TrHomePage() {
  const [masterData, swingPicks, allTickers] = await Promise.all([
    getMasterData(),
    getSwingAllPicks(),
    getAllTickers(),
  ]);

  // Swing trade adaylarını çıkar (ilk 5)
  const swingRows: StockRow[] = (swingPicks?.picks ?? []).slice(0, 5).map((pick: any) => ({
    ticker: pick.ticker,
    company: pick.company || pick.ticker,
    sector: pick.sector || "—",
    price: (pick.price || 0).toFixed(2),
    change: `${pick.change_pct >= 0 ? "+" : ""}${(pick.change_pct || 0).toFixed(2)}%`,
    changeNum: pick.change_pct || 0,
    signal: pick.signal || "İZLE",
  }));

  // Trend hisseleri - trend tema türüne göre filtrele (ilk 5)
  const trendRows: StockRow[] = (allTickers || [])
    .filter((t: any) => t.score_type === "TREND" || t.score_type?.includes("TREND"))
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      sector: t.sector || "—",
      price: (t.price || 0).toFixed(2),
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      signal: t.score_type || "İZLE",
    }));

  // Top 100 hisselerini çıkar (ilk 5)
  const top100Rows: StockRow[] = (allTickers || [])
    .slice(0, 5)
    .map((t: any) => ({
      ticker: t.ticker,
      company: t.company,
      sector: t.sector || "—",
      price: (t.price || 0).toFixed(2),
      change: `${t.change_pct >= 0 ? "+" : ""}${(t.change_pct || 0).toFixed(2)}%`,
      changeNum: t.change_pct || 0,
      signal: t.score_type || "İZLE",
    }));

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />

      {/* Market Indices Ticker */}
      {masterData?.market_indices && (
        <MarketIndicesTicker indices={masterData.market_indices} locale="tr" />
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Sayfa başlığı */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white mb-2">Gösterge Paneli</h1>
          <p className="text-base text-white/60">Swing adayları, trend hisseleri ve en iyi performans gösterenler</p>
        </div>

        {/* Üç sütun grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Swing Trade Adayları */}
          <HomeGridCard
            title="Swing Trade"
            description="Günlük alım satım fırsatları"
            stocks={swingRows}
            viewAllHref="/global/tr/swing"
            viewAllLabel="Tüm Swing Hisseler"
            locale="tr"
            icon="🚀"
          />

          {/* Trend Hisseleri */}
          <HomeGridCard
            title="Trend Hisseleri"
            description="Uzun vadeli trend takibi"
            stocks={trendRows}
            viewAllHref="/global/tr/trend"
            viewAllLabel="Tüm Trend Hisseleri"
            locale="tr"
            icon="📈"
          />

          {/* Top 100 */}
          <HomeGridCard
            title="Top 100"
            description="Günü en çok hareket eden"
            stocks={top100Rows}
            viewAllHref="/global/tr/top100"
            viewAllLabel="Tüm Top 100"
            locale="tr"
            icon="⭐"
          />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
