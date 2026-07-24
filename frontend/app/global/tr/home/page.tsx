import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import { getTopSwingByVolume, getTopWatchlistByVolume, getTopTop100ByVolume, getLastUpdated, getLiveIndices, overlayHeatMapChangePct } from "@/lib/homeFeed";
import { getSwingPerformance, getMasterData, getAllTickers, getSwingPicks, getOptionsData, getOptionsOutcomes, StockQuickView } from "@/lib/data";
import { getMemberAccess } from "@/lib/apiAuth";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";
import HomeWatchlistSlot from "@/components/global/HomeWatchlistSlot";
import TickerTape from "@/components/TickerTape";
import SectorHeatMap from "@/components/SectorHeatMap";
import { MARKET_THEMES } from "@/lib/themeData";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Trend hisse adayları, trend hisseleri ve top 100 tracker'ın hızlı özeti.",
  alternates: { canonical: "https://bogastock.com/global/tr/home" },
};

export default async function TrHomePage() {
  const [swingByVolume, watchlistByVolume, top100ByVolume, lastUpdated, indices, swingStats, master, allTickers, swingPicks, optionsData, optionsOutcomes, memberAccess] = await Promise.all([
    getTopSwingByVolume(5),
    getTopWatchlistByVolume(5),
    getTopTop100ByVolume(5),
    getLastUpdated(),
    getLiveIndices(),
    getSwingPerformance(),
    getMasterData(),
    getAllTickers(),
    getSwingPicks(),
    getOptionsData("latest"),
    getOptionsOutcomes(),
    getMemberAccess()
  ]);

  // Tüm geçmiş kullanılır — -%7 SL cap, duplicate ve PENDING hariç.
  // "Son 100 işlem" kesimi KALDIRILDI: son 100 kayıtta 65 PENDING olduğundan
  // yalnızca 31 tamamlanmış işlem kalmakta ve bu küçük örnekten hesaplanan
  // oran (%93.5) yanıltıcıdır. Tam geçmiş (736 tamamlanmış) daha doğru sonuç verir.
  const SL_CAP = -7;
  const bannerStats = (() => {
    const fullHistory: any[] = swingStats?.history ?? [];
    if (fullHistory.length === 0) return swingStats?.stats ?? null;
    const effRet = (t: any): number => Math.max(t.return_pct ?? 0, SL_CAP);
    const active = fullHistory.filter((t: any) => !t.is_duplicate && t.result !== "PENDING" && t.return_pct != null);
    if (active.length === 0) return swingStats?.stats ?? null;
    const wins = active.filter((t: any) => effRet(t) > 0).length;
    const sumRet = active.reduce((s: number, t: any) => s + effRet(t), 0);
    const above10 = active.filter((t: any) => effRet(t) >= 10).length;
    return {
      win_rate: (wins / active.length * 100).toFixed(1),
      avg_return_pct: (sumRet / active.length).toFixed(1),
      above_10pct_rate: (above10 / active.length * 100).toFixed(1),
      total_picks: active.length,
      period_days: swingStats?.stats?.period_days,
    };
  })();

  // Helper to map different sector naming conventions to GICS standard sector names
  const normalizeGicsSector = (sec: string | undefined): string => {
    if (!sec) return "Other";
    const s = sec.trim();
    if (s === "Basic Materials") return "Materials";
    if (s === "Consumer Defensive") return "Consumer Staples";
    if (s === "Consumer Cyclical") return "Consumer Discretionary";
    if (s === "Financial Services") return "Financials";
    return s;
  };

  // Compile comprehensive map of all tickers from 6 sources
  const tickerMap = new Map<string, { sector: string; company: string; change_pct: number; score: number; volume: number }>();

  // 1. Load from MARKET_THEMES
  MARKET_THEMES.forEach(theme => {
    const rawSector = theme.sector === "Sectors" ? theme.name : theme.sector;
    const sectorName = normalizeGicsSector(rawSector);
    theme.tickers.forEach(t => {
      if (!t) return;
      const key = t.toUpperCase();
      tickerMap.set(key, {
        sector: sectorName,
        company: t,
        change_pct: 0,
        score: 50,
        volume: 0
      });
    });
  });

  // 2. Load from allTickers
  if (allTickers && Array.isArray(allTickers)) {
    allTickers.forEach(t => {
      if (!t.ticker) return;
      const key = t.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(t.sector) || existing?.sector || "Other",
        company: t.company || existing?.company || t.ticker,
        change_pct: t.change_pct ?? existing?.change_pct ?? 0,
        score: t.master_score ?? existing?.score ?? 50,
        volume: t.volume ?? existing?.volume ?? 0
      });
    });
  }

  // 3. Load from swingPicks
  if (swingPicks && Array.isArray(swingPicks.picks)) {
    swingPicks.picks.forEach((p: any) => {
      if (!p.ticker) return;
      const key = p.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(p.sector) || existing?.sector || "Other",
        company: p.company || existing?.company || p.ticker,
        change_pct: p.change_1d ?? p.change_pct ?? existing?.change_pct ?? 0,
        score: p.score ?? existing?.score ?? 50,
        volume: p.volume ?? existing?.volume ?? 0
      });
    });
  }

  // 4. Load from swingStats history
  if (swingStats && Array.isArray(swingStats.history)) {
    swingStats.history.forEach((h: any) => {
      if (!h.ticker) return;
      const key = h.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      const changeVal = existing?.change_pct !== 0 ? existing?.change_pct : (h.return_pct ?? 0);
      tickerMap.set(key, {
        sector: normalizeGicsSector(h.sector) || existing?.sector || "Other",
        company: h.company || existing?.company || h.ticker,
        change_pct: changeVal ?? 0,
        score: existing?.score ?? 50,
        volume: existing?.volume ?? 0
      });
    });
  }

  // 5. Load from optionsData
  if (optionsData && Array.isArray(optionsData.picks)) {
    optionsData.picks.forEach((p: any) => {
      if (!p.ticker) return;
      const key = p.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(p.sector_info?.sector || p.sector) || existing?.sector || "Other",
        company: existing?.company || p.ticker,
        change_pct: p.change_pct ?? existing?.change_pct ?? 0,
        score: p.score ?? existing?.score ?? 50,
        volume: p.volume ?? existing?.volume ?? 0
      });
    });
  }

  // 6. Load from optionsOutcomes
  if (optionsOutcomes && Array.isArray(optionsOutcomes.positions)) {
    optionsOutcomes.positions.forEach((pos: any) => {
      if (!pos.ticker) return;
      const key = pos.ticker.toUpperCase();
      const existing = tickerMap.get(key);
      tickerMap.set(key, {
        sector: normalizeGicsSector(pos.sector) || existing?.sector || "Other",
        company: existing?.company || pos.ticker,
        change_pct: pos.pnl_pct ?? existing?.change_pct ?? 0,
        score: pos.score ?? existing?.score ?? 50,
        volume: existing?.volume ?? 0
      });
    });
  }

  // Create StockQuickView array from tickerMap
  const comprehensiveTickersList: StockQuickView[] = Array.from(tickerMap.entries()).map(([ticker, val]) => {
    const swingPick = swingPicks?.picks?.find((p: any) => p.ticker?.toUpperCase() === ticker);
    const setupName = swingPick?.setup || "";
    return {
      ticker,
      company: val.company,
      sector: val.sector,
      master_score: val.score,
      score_type: "NEUTRAL_STAY",
      price: 0,
      change_pct: val.change_pct,
      entry_range_low: 0,
      entry_range_high: 0,
      volume: val.volume,
      ai_short_summary: ""
    };
  });

  const heatMapTickers = await overlayHeatMapChangePct(comprehensiveTickersList);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="tr" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <div className="-mb-2">
          <ListsNavigation locale="tr" activePath="home" />
        </div>
        {/* Üç sütun grid - Swing omurga (2 kolon) + Trend/Top100 destekleyici (1 kolon) */}
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 gap-4 md:gap-6 pb-6 md:pb-0">
          <HomeWatchlistSlot
            locale="tr"
            defaultStocks={watchlistByVolume}
            defaultViewAllHref="/global/tr/top7"
            defaultSortLabel="Hacim sırasına göre"
          />

          <HomeSimpleCard
            title="Trend Hisseleri"
            accent="#3b82f6"
            stocks={swingByVolume}
            viewAllHref="/global/tr/swing"
            locale="tr"
            sortLabel="Trend skoruna göre sıralandı"
            requirePremium
          />

          <HomeSimpleCard
            title="Top 100"
            accent="#10b981"
            stocks={top100ByVolume}
            viewAllHref="/global/tr/top100"
            locale="tr"
            sortLabel="Hacim sırasına göre"
            requirePremium
          />
        </div>

        {/* Mobile Swipe Hint */}
        <div className="flex md:hidden items-center justify-center gap-2 mt-4 mb-6 text-white/50 text-[10px] uppercase font-bold tracking-widest">
          <svg className="w-3 h-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Kaydirarak kesfet</span>
          <svg className="w-3 h-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>

        {/* Sector Heat Map */}
        {master && (
          <section className="mb-16 mt-12">
            <SectorHeatMap data={master} allTickers={heatMapTickers} locale="tr" />
          </section>
        )}

        {/* Güncelleme bilgisi */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Son güncelleme: <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Veriler 15 dakika gecikmeli kaynaklardan analiz edilir. Sayfa, borsanın açık olduğu günlerde saat başı güncellenir.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
