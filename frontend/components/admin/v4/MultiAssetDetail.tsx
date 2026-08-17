"use client";

import { useState } from "react";
import type { AssetClass, AssetSnapshot } from "@/lib/v4/types";
import { minutesToClose } from "@/lib/v4/options";
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

/** Yön göstergesi rengi — v3 konsolundaki ile aynı mantık */
function directionTone(direction: string): "up" | "down" | "neutral" {
  if (direction === "LONG") return "up";
  if (direction === "SHORT") return "down";
  return "neutral";
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

  const view = snapshot;

  if (!view) {
    return (
      <div className="mt-4">
        {error ? (
          <Panel title="Veri alınamadı">
            <p className="text-[12px] leading-relaxed text-slate-300">{error}</p>
          </Panel>
        ) : (
          <EmptyState>{loading ? "Yükleniyor..." : "Görüntülenecek veri yok"}</EmptyState>
        )}
      </div>
    );
  }

  const { decision, levels, structure, factors, context } = view;
  const frame = view.frames[view.frames.length - 1];
  const dirTone = directionTone(decision.direction);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Tabs
          size="sm"
          value={mode}
          onChange={(m) => setMode(m)}
          options={[
            { value: "live", label: "Canlı / Bugün" },
            { value: "forecast", label: "Tahmin (Yarın)" },
          ]}
        />
        <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${view.isLiveSession ? "bg-[#22c55e]" : "bg-slate-500"}`} />
          Son Güncelleme: {new Date(view.generatedAt).toLocaleTimeString("tr-TR")}
        </span>
      </div>

      {mode === "forecast" ? (
        <V4SuperTradeForecast snapshot={view} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          {/* Sol Kolon - Grafikler ve Analiz */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Karar Masası */}
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
                    Sistem Kararı ({asset})
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
                <Row label="İptal Koşulu (Stop)" value={decision.invalidation} />
              </div>
            </div>

            {/* Grafik */}
            <V4SuperTradeLiveChart
              asset={asset}
              esBars={view.bars.futures}
              spxBars={view.bars.spot}
              levels={{
                vwap: frame.vwap,
                onh: levels.futures.onh,
                onl: levels.futures.onl,
                orh: levels.spot.orh,
                orl: levels.spot.orl,
                pdc: levels.futures.pdc,
              }}
              vwapStartTime={view.frames[0]?.time ?? 0}
              loading={loading}
            />

            {/* Yapı ve Skor Tablosu */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="Piyasa Yapısı" className="col-span-1 lg:col-span-2">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  <StructureBox label="VADELİ 15M" val={structure.futures15m} />
                  <StructureBox label="VADELİ 5M" val={structure.futures5m} />
                  <StructureBox label="VADELİ 1M" val={structure.futures1m} />
                  <StructureBox label="SPOT 5M" val={structure.spot5m} />
                  <StructureBox label="SPOT 1M" val={structure.spot1m} />
                </div>
              </Panel>
              <Panel title="Skor Özeti">
                <div className="flex h-full flex-col justify-center gap-3">
                  <Row label="Long Faktörleri" value={`+${frame.longScore.toFixed(1)}`} valueClass="text-[#22c55e]" />
                  <Row label="Short Faktörleri" value={`${frame.shortScore.toFixed(1)}`} valueClass="text-[#ef4444]" />
                  <div className="my-1 h-px bg-[#1c2635]" />
                  <Row
                    label="Net Yön Skoru"
                    value={signed(frame.netScore, 1)}
                    valueClass={`font-medium ${toneClass(frame.netScore)}`}
                  />
                </div>
              </Panel>
            </div>

            {/* Faktör dökümü */}
            <Panel title="Skor Gerekçeleri" hint="ölçülen 11 faktör">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {factors.map((f, i) => (
                  <Row
                    key={`${f.label}-${i}`}
                    label={f.label}
                    value={f.detail}
                    valueClass={f.weight > 0 ? "text-[#22c55e]" : f.weight < 0 ? "text-[#ef4444]" : "text-slate-400"}
                  />
                ))}
              </div>
            </Panel>

            <V4StrategyLab
              spotPrice={view.spotPrice}
              state={frame.state}
              vix={view.vixPrice}
              minutesLeft={minutesToClose(
                Number(frame.timeLabel.split(":")[0]) * 60 + Number(frame.timeLabel.split(":")[1])
              )}
            />
          </div>

          {/* Sağ Kolon - Detaylar */}
          <div className="flex w-full flex-col gap-4">
            <V4ContextEnginePanel context={context} liveState={frame.state} />
          </div>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Bu görünüm araştırma ve karar desteği amaçlıdır. Opsiyon primleri teorik modellerdir, otomatik
        emre dönüşmez ve yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

function StructureBox({ label, val }: { label: string; val: string }) {
  const t =
    val === "UPTREND" ? "text-[#22c55e]" : val === "DOWNTREND" ? "text-[#ef4444]" : "text-slate-400";
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded bg-[#0f141d] p-2 text-center">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`flex items-center gap-1 text-[11px] font-medium ${t}`}>{val}</div>
    </div>
  );
}
