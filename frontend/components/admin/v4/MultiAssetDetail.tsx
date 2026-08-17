"use client";

import { useMemo, useState } from "react";
import type { AssetClass, AssetSnapshot } from "@/lib/v4/types";
import { buildChain, minutesToClose, simulateRunners } from "@/lib/v4/options";
import { directionTone } from "@/lib/v4/scoring";
import {
  Badge,
  EmptyState,
  INSET,
  Panel,
  Row,
  Tabs,
  signed,
  toneClass,
} from "@/components/admin/supertrade/ui";

import V4ContextEnginePanel from "./V4ContextEnginePanel";
import V4StrategyLab from "./V4StrategyLab";
import V4SuperTradeForecast from "./V4SuperTradeForecast";
import V4SuperTradeLiveChart from "./V4SuperTradeLiveChart";

// Basit yardmc fonksiyon (sayfa formatlamas iin)
function formatTime(d: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR");
}

export default function MultiAssetDetail({
  asset,
  snapshot,
  loading,
  error,
}: {
  asset: AssetClass;
  snapshot: AssetSnapshot | null;
  loading: boolean;
  error: string | null;
}) {
  const [mode, setMode] = useState<"live" | "forecast">("live");
  const [chainView, setChainView] = useState<"auto" | "call" | "put">("auto");

  // V3'teki gibi "view" mekanizmas (u an sadece canl)
  const view = snapshot;

  const runners = useMemo(() => {
    if (!view) return null;
    return view.runners;
  }, [view]);

  const chain = useMemo(() => {
    if (!view) return [];
    return view.chain;
  }, [view]);

  const chainType = chain[0]?.type ?? "CALL";

  if (!view) {
    return (
      <div className="mt-4">
        {error ? (
          <Panel title="Veri alnamad">
            <p className="text-[12px] leading-relaxed text-slate-300">{error}</p>
          </Panel>
        ) : (
          <EmptyState>{loading ? "Ykleniyor..." : "Grntlenecek veri yok"}</EmptyState>
        )}
      </div>
    );
  }

  const { frame, decision, levels, structure, factors, context } = view;
  const dirTone = directionTone(decision.direction);
  
  const supporting = factors.filter((f) =>
    frame.netScore >= 0 ? f.weight > 0 : f.weight < 0
  );
  const conflicting = factors.filter((f) =>
    frame.netScore >= 0 ? f.weight < 0 : f.weight > 0
  );
  const neutralFactors = factors.filter((f) => f.weight === 0);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Tabs
          size="sm"
          value={mode}
          onChange={(m) => setMode(m as any)}
          options={[
            { value: "live", label: "Canl / Bugn" },
            { value: "forecast", label: "Tahmin (Yarn)" },
          ]}
        />
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${view.isLiveSession ? "bg-[#22c55e]" : "bg-slate-500"}`} />
          Son Gncelleme: {new Date(view.generatedAt).toLocaleTimeString("tr-TR")}
        </span>
      </div>

      {mode === "forecast" ? (
        <V4SuperTradeForecast snapshot={snapshot} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* Sol Kolon - Grafikler ve Analiz */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Karar Masas */}
            <div className={`rounded-lg border p-4 ${INSET} ${
                decision.tone === "POSITIVE"
                  ? "border-[#22c55e]/20"
                  : decision.tone === "NEGATIVE"
                  ? "border-[#ef4444]/20"
                  : "border-[#1c2635]"
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Sistem Karar ({asset})
                  </div>
                  <div className="mt-1 text-[18px] font-medium tracking-tight text-white">
                    {decision.action}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={dirTone}>{frame.state.replace(/_/g, " ")}</Badge>
                  <div className="text-[10px] text-slate-500">
                    Net Skor: <span className={toneClass(frame.netScore)}>{signed(frame.netScore, 1)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Row label="Teyit Beklentisi" value={decision.confirmation} />
                <Row label="ptal Koulu (Stop)" value={decision.invalidation} />
              </div>
            </div>

            {/* Grafikler */}
            <V4SuperTradeLiveChart
              bars={view.bars}
              levels={view.levels}
              spotPrice={view.spotPrice}
              futuresPrice={view.futuresPrice}
              vixPrice={view.vixPrice}
              frame={frame}
            />

            {/* Yap ve Skor Tablosu */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Piyasa Yaps" className="col-span-1 lg:col-span-2">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <StructureBox label="VADEL 15M" val={structure.futures15m} />
                  <StructureBox label="VADEL 5M" val={structure.futures5m} />
                  <StructureBox label="VADEL 1M" val={structure.futures1m} />
                  <StructureBox label="SPOT 5M" val={structure.spot5m} />
                  <StructureBox label="SPOT 1M" val={structure.spot1m} />
                </div>
              </Panel>
              <Panel title="Skor zeti">
                <div className="flex h-full flex-col justify-center gap-3">
                  <Row label="Long Faktrleri" value={`+${frame.longScore.toFixed(1)}`} valueClass="text-[#22c55e]" />
                  <Row label="Short Faktrleri" value={`${frame.shortScore.toFixed(1)}`} valueClass="text-[#ef4444]" />
                  <div className="my-1 h-px bg-[#1c2635]" />
                  <Row
                    label="Net Yn Skoru"
                    value={signed(frame.netScore, 1)}
                    valueClass={`font-medium ${toneClass(frame.netScore)}`}
                  />
                </div>
              </Panel>
            </div>
            
            <V4StrategyLab
                chain={chain}
                chainView={chainView}
                setChainView={setChainView}
                runners={runners}
                targetPrice={0} // v3 mantna gre basitletirilebilir
                vix={view.vixPrice}
                minutesLeft={minutesToClose(Number(frame.timeLabel.split(":")[0]) * 60 + Number(frame.timeLabel.split(":")[1]))}
                decisionTone={decision.tone}
            />
          </div>

          {/* Sa Kolon - Detaylar */}
          <div className="flex w-full flex-col gap-4">
             <V4ContextEnginePanel context={context} />
          </div>
        </div>
      )}
    </div>
  );
}

function StructureBox({ label, val }: { label: string; val: string }) {
  const t =
    val === "UPTREND" ? "text-[#22c55e]" : val === "DOWNTREND" ? "text-[#ef4444]" : "text-slate-400";
  const icon = val === "UPTREND" ? "" : val === "DOWNTREND" ? "" : "";
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded bg-[#0f141d] p-2 text-center">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`flex items-center gap-1 text-[11px] font-medium ${t}`}>
        <span>{icon}</span> {val}
      </div>
    </div>
  );
}
