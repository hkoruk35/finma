import { Metadata } from "next";
import Link from "next/link";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume, getLastUpdated, getLiveIndices } from "@/lib/homeFeed";
import { getSwingPerformance, getMasterData, getAllTickers, getSwingPicks, getOptionsData, getOptionsOutcomes, StockQuickView } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import HomeSimpleCard from "@/components/global/HomeGridCard";
import TickerTape from "@/components/TickerTape";
import SectorHeatMap from "@/components/SectorHeatMap";
import { MARKET_THEMES } from "@/lib/themeData";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "BOGA AI",
  description: "Painel com candidatos de swing trade, ações em tendência e rastreador Top 100.",
  alternates: { canonical: "https://bogastock.com/global/pt/home" },
};

export default async function PtHomePage() {
  const [swingByVolume, trendByVolume, top100ByVolume, lastUpdated, indices, swingStats, master, allTickers, swingPicks, optionsData, optionsOutcomes] = await Promise.all([
    getTopSwingByVolume(5),
    getTopTrendByVolume(5),
    getTopTop100ByVolume(5),
    getLastUpdated(),
    getLiveIndices(),
    getSwingPerformance(),
    getMasterData(),
    getAllTickers(),
    getSwingPicks(),
    getOptionsData("latest"),
    getOptionsOutcomes()
  ]);

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

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="pt" />
      <TickerTape indices={indices} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Performance Banner Link */}
        {bannerStats && (
          <Link href="/global/pt/performance" className="block group w-full mb-8">
            <div className="bg-gradient-to-r from-[#1a2030] to-[#1e293b] border border-[#3b82f6]/30 group-hover:border-[#3b82f6]/80 transition-colors rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3b82f6] blur-[80px] opacity-20 rounded-full group-hover:opacity-40 transition-opacity"></div>

              <div className="flex-1 z-10 text-center md:text-left">
                 <div className="flex items-center gap-3 mb-3 justify-center md:justify-start">
                    <h3 className="text-[#3b82f6] font-black uppercase tracking-[0.2em] text-sm md:text-base">DESEMPENHO COMPROVADO</h3>
                    <span className="px-3 py-1 rounded-full bg-[#3b82f6]/10 text-[10px] md:text-xs font-bold text-[#3b82f6] border border-[#3b82f6]/20 group-hover:bg-[#3b82f6] group-hover:text-white transition-colors">VER REGISTROS DETALHADOS →</span>
                 </div>
                 <p className="text-white text-xl md:text-2xl font-bold">
                   Motor Swing BOGA AI: <span className="text-[#10b981]">{bannerStats.win_rate}% Taxa de Acerto</span>{bannerStats.period_days ? ` em ${bannerStats.period_days} Dias` : ""}
                 </p>
                 <p className="text-white text-sm mt-2">
                   Baseado em {bannerStats.total_picks} operações de alta convicção geradas exclusivamente por critérios algorítmicos.
                 </p>
              </div>

              <div className="flex justify-center gap-6 z-10">
                <div className="text-center">
                   <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{bannerStats.avg_return_pct}%</div>
                   <div className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1">Retorno Máx. Médio</div>
                </div>
                <div className="w-px bg-white/10 hidden md:block"></div>
                <div className="text-center">
                   <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{bannerStats.above_10pct_rate}%</div>
                   <div className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1">Ganhos +10%</div>
                </div>
                <div className="w-px bg-white/10 hidden md:block"></div>
                <div className="text-center">
                   <div className="text-3xl font-black text-white group-hover:text-[#3b82f6] transition-colors">{bannerStats.total_picks}</div>
                   <div className="text-[10px] text-[#00d2ff] font-bold uppercase tracking-wider mt-1">Total de Sinais</div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Three column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <HomeSimpleCard
            title="Swing Trade"
            accent="#3b82f6"
            stocks={swingByVolume}
            viewAllHref="/global/pt/swing"
            locale="pt"
            sortLabel="Ordenado por pontuação de swing"
            requirePremium
          />

          <HomeSimpleCard
            title="Ações em Tendência"
            accent="#a78bfa"
            stocks={trendByVolume}
            viewAllHref="/global/pt/trend"
            locale="pt"
            sortLabel="Ordenado por volume"
            requirePremium
          />

          <HomeSimpleCard
            title="Top 100"
            accent="#f59e0b"
            stocks={top100ByVolume}
            viewAllHref="/global/pt/top100"
            locale="pt"
            sortLabel="Ações com maior atividade"
          />
        </div>

        {/* Sector Heat Map */}
        {master && (
          <section className="mb-16 mt-12">
            <SectorHeatMap data={master} allTickers={comprehensiveTickersList} />
          </section>
        )}

        {/* Update info */}
        <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
          {lastUpdated && (
            <p className="text-[11px] text-white/40">
              Última atualização: <span className="font-mono text-white/60">{lastUpdated}</span> (NY / ET)
            </p>
          )}
          <p className="text-[10px] text-white/25 max-w-xl">
            Os dados são analisados a partir de fontes com atraso de 15 minutos. Esta página é atualizada a cada hora nos dias em que o mercado está aberto.
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
