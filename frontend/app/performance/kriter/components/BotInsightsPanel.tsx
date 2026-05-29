"use client";

import type { BotInsight } from "@/lib/kriter-cache";

interface Props {
  insights: BotInsight[];
  aiReport: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  FILTER_ADD: "Filtre Ekle",
  THRESHOLD_CHANGE: "Eşik Değiştir",
  SECTOR_RULE: "Sektör Kuralı",
  TIMING_RULE: "Zamanlama Kuralı",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "text-red-400 border-red-800/40",
  MEDIUM: "text-yellow-400 border-yellow-800/40",
  LOW: "text-gray-400 border-gray-800/40",
};

function InsightCard({ insight }: { insight: BotInsight }) {
  return (
    <div className={`border rounded p-3 space-y-1.5 ${PRIORITY_COLORS[insight.priority]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider opacity-70">
          {CATEGORY_LABELS[insight.category] ?? insight.category}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 border rounded ${PRIORITY_COLORS[insight.priority]}`}>
          {insight.priority}
        </span>
      </div>
      <div className="text-xs text-gray-300">
        <span className="text-gray-500">MEVCUT: </span>{insight.current_behavior}
      </div>
      <div className="text-xs">
        <span className="text-gray-500">ÖNERİ: </span>
        <span className="text-white">{insight.suggested_change}</span>
      </div>
      {insight.expected_impact && (
        <div className="text-[11px] text-gray-500">
          Beklenen etki: {insight.expected_impact}
        </div>
      )}
      <div className="text-[10px] text-gray-600 mt-1">
        {insight.confidence === "DATA_BACKED" ? "✓ Veri destekli" : "~ Hipotez"}
      </div>
    </div>
  );
}

export default function BotInsightsPanel({ insights, aiReport }: Props) {
  // AI raporundan BOT OPTİMİZASYONU bölümünü çıkar
  const optSection = aiReport.match(/\[BOT OPTİMİZASYONU\]([\s\S]*?)(?=\[SONUÇ ÖZETİ\]|$)/i)?.[1]?.trim() ?? "";

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded p-4 font-mono space-y-4">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
        Bot Optimizasyon Önerileri — swing118
      </div>

      {insights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} />
          ))}
        </div>
      ) : optSection ? (
        /* Yapısal parse başarısız olduysa ham AI metnini göster */
        <div className="text-sm text-gray-300 space-y-1 border border-white/10 rounded p-3">
          {optSection.split("\n").map((line, i) => (
            <div key={i} className={line.trim().startsWith("-") ? "text-yellow-200 pl-2" : line.includes("→") ? "text-green-300 pl-2" : "text-gray-400"}>
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-sm py-4 text-center">
          AI analizi üretilmeden önce bot önerileri görüntülenemez.
          <br />
          Terminal Raporu sekmesinden analizi başlat.
        </div>
      )}

      {/* Export butonu */}
      {(insights.length > 0 || optSection) && (
        <div className="pt-3 border-t border-white/10">
          <button
            onClick={() => {
              const exportData = {
                version: "swing118",
                generated_from: "kriter_analysis",
                date: new Date().toISOString().slice(0, 10),
                parameter_changes: insights,
                raw_optimization_notes: optSection,
              };
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `swing118_params_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[11px] text-green-400 border border-green-800/40 px-3 py-1.5 rounded hover:bg-green-400/10 transition-colors"
          >
            {">"} swing118 Parametrelerini Dışa Aktar (JSON)
          </button>
        </div>
      )}
    </div>
  );
}
