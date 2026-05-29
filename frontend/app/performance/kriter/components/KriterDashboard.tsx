"use client";

import { useState, useCallback } from "react";
import type { EnrichedTrade, AggregateStats, SignalMatrix, DailyStats } from "@/lib/kriter-helpers";
import type { KriterAnalysisResult, BotInsight } from "@/lib/kriter-cache";
import StatsBadges from "./StatsBadges";
import DailyTrendMiniChart from "./DailyTrendMiniChart";
import TerminalReport from "./TerminalReport";
import TradeAnalysisTable from "./TradeAnalysisTable";
import SignalReliabilityMatrix from "./SignalReliabilityMatrix";
import BotInsightsPanel from "./BotInsightsPanel";

interface Props {
  initialTrades: EnrichedTrade[];
  initialStats: AggregateStats;
  initialSignalMatrix: SignalMatrix[];
  initialDailyTrend: DailyStats[];
  reportDays: string[];
}

type Tab = "terminal" | "sinyaller" | "bot";

const TABS: { id: Tab; label: string }[] = [
  { id: "terminal", label: "Terminal Raporu" },
  { id: "sinyaller", label: "Sinyal Matrisi" },
  { id: "bot", label: "Bot Önerileri" },
];

export default function KriterDashboard({
  initialTrades,
  initialStats,
  initialSignalMatrix,
  initialDailyTrend,
  reportDays,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("terminal");
  const [aiReport, setAiReport] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [botInsights, setBotInsights] = useState<BotInsight[]>([]);
  const [enrichedTrades] = useState<EnrichedTrade[]>(initialTrades);
  const [stats] = useState<AggregateStats>(initialStats);
  const [signalMatrix] = useState<SignalMatrix[]>(initialSignalMatrix);
  const [dailyTrend] = useState<DailyStats[]>(initialDailyTrend);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/kriter-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days: 10, force_refresh: forceRefresh }),
        });
        if (!res.ok) throw new Error(`API hatası: ${res.status}`);
        const data: KriterAnalysisResult = await res.json();
        setAiReport(data.ai_report);
        setGeneratedAt(data.generated_at);
        setCacheHit(data.cache_hit);
        setBotInsights(data.bot_insights ?? []);
      } catch (e: any) {
        setError(e.message ?? "Bilinmeyen hata");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-white font-bold text-xl font-mono">
            {">"} KRITER ANALİZİ
          </h1>
          <p className="text-gray-500 text-xs font-mono mt-0.5">
            Son {reportDays.length} rapor günü · BOGA AI V117 · swing118 optimizasyonu
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-gray-600">{reportDays[0]} → {reportDays[reportDays.length - 1]}</span>
          <span className={`px-2 py-0.5 rounded border ${stats.enrichment_coverage >= 80 ? "text-green-400 border-green-800/40" : "text-yellow-400 border-yellow-800/40"}`}>
            Arşiv: %{stats.enrichment_coverage}
          </span>
        </div>
      </div>

      {/* Stats Badges */}
      <StatsBadges stats={stats} />

      {/* Daily Trend Sparkline */}
      <DailyTrendMiniChart dailyTrend={dailyTrend} />

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded p-3 text-red-400 text-sm font-mono">
          {">"} HATA: {error}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b border-white/10 font-mono">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs transition-colors ${
              activeTab === tab.id
                ? "text-green-400 border-b-2 border-green-400"
                : "text-gray-500 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "terminal" && (
        <TerminalReport
          aiReport={aiReport}
          generatedAt={generatedAt}
          cacheHit={cacheHit}
          onGenerate={() => handleGenerate(!!aiReport)}
          isLoading={isLoading}
        />
      )}

      {activeTab === "sinyaller" && (
        <SignalReliabilityMatrix signalMatrix={signalMatrix} />
      )}

      {activeTab === "bot" && (
        <BotInsightsPanel insights={botInsights} aiReport={aiReport} />
      )}

      {/* Trade Analysis Table */}
      <div>
        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">
          {">"} Trade Detay Tablosu — Satıra tıkla: detay görüntüle
        </div>
        <TradeAnalysisTable trades={enrichedTrades} />
      </div>

      {/* Footer */}
      <div className="text-[10px] text-gray-600 font-mono border-t border-white/5 pt-3 flex flex-wrap gap-4">
        <span>Toplam trade: {stats.total}</span>
        <span>Arşiv kapsamı: %{stats.enrichment_coverage}</span>
        <span>Full EMA Stack win rate: %{stats.full_ema_stack_win_rate} ({stats.full_ema_stack_win}/{stats.full_ema_stack_total})</span>
        <span>Yüksek RVOL win rate: %{stats.high_rvol_win_rate} ({stats.high_rvol_win}/{stats.high_rvol_total})</span>
      </div>
    </div>
  );
}
