"use client";

/**
 * SPX SuperTrade — Anlık Grafik
 * Artık site genelinde kullanılan gerçek BogaStock grafik motorunu
 * (BogaChartEngine, lightweight-charts tabanlı) kullanır: tamamen
 * interaktif — yakınlaştırma, kaydırma, mum tipi, gösterge seçimi, tam
 * ekran, paylaşım. SuperTrade'e özgü VWAP/ONH/ONL/ORH/ORL/Önceki Kapanış
 * seviyeleri `customLevels` ile grafiğin üzerine ekstra yatay çizgi
 * olarak eklenir.
 */

import { useMemo, useState } from "react";
import BogaChartEngine from "@/components/charts/BogaChartEngine";
import type { AssetClass } from "@/lib/v4/types";
import { ASSET_MAP } from "@/lib/v4/types";
import { Tabs } from "../supertrade/ui";

export interface ChartLevels {
  vwap: number;
  onh: number;
  onl: number;
  orh: number;
  orl: number;
  pdc: number;
}

type ChartView = "FUTURES" | "SPOT";

const LEVEL_META: Record<keyof ChartLevels, { label: string; color: string }> = {
  vwap: { label: "VWAP", color: "#eab308" },
  onh: { label: "Gece ONH", color: "#ef4444" },
  onl: { label: "Gece ONL", color: "#22c55e" },
  orh: { label: "Açılış ORH", color: "#3b82f6" },
  orl: { label: "Açılış ORL", color: "#3b82f6" },
  pdc: { label: "Önceki Kapanış", color: "#94a3b8" },
};

export default function V4SuperTradeLiveChart({
  asset,
  levels,
  loading,
}: {
  asset: AssetClass;
  levels: ChartLevels;
  loading?: boolean;
}) {
  const info = ASSET_MAP[asset];
  const scale = info.scale || 1;
  const [view, setView] = useState<ChartView>("FUTURES");

  // `levels` verili varlığın DOĞAL ölçeğinde gelir: vwap/onh/onl/pdc her
  // zaman vadeli (ES/NQ) ölçeğinde, orh/orl her zaman spot (SPX/QQQ/…)
  // ölçeğindedir (bkz. MultiAssetDetail). Aktif görünüme göre HER İKİSİNİ de
  // o görünümün ölçeğine çeviriyoruz — aksi halde küçük ölçekli varlıklarda
  // (QQQ 0.025, XND 0.01) fiyat ekseni çöker ve grafik anlamsız görünür.
  const displayLevels = useMemo<ChartLevels>(() => {
    if (view === "FUTURES") {
      return {
        vwap: levels.vwap,
        onh: levels.onh,
        onl: levels.onl,
        pdc: levels.pdc,
        orh: scale ? levels.orh / scale : levels.orh,
        orl: scale ? levels.orl / scale : levels.orl,
      };
    }
    return {
      vwap: levels.vwap * scale,
      onh: levels.onh * scale,
      onl: levels.onl * scale,
      pdc: levels.pdc * scale,
      orh: levels.orh,
      orl: levels.orl,
    };
  }, [view, levels, scale]);

  const customLevels = useMemo(
    () =>
      (Object.keys(LEVEL_META) as (keyof ChartLevels)[]).map((key) => ({
        label: LEVEL_META[key].label,
        price: displayLevels[key],
        color: LEVEL_META[key].color,
      })),
    [displayLevels]
  );

  const symbol = view === "FUTURES" ? info.futures : info.spot;
  const futuresLabel = info.futures.replace("=F", "");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "FUTURES", label: `Vadeli (${futuresLabel})` },
            { value: "SPOT", label: `Spot (${asset})` },
          ]}
        />
        {loading && <span className="text-[11px] text-slate-500">Güncelleniyor…</span>}
      </div>
      <div className="overflow-hidden rounded-lg border border-[#1c2635] bg-[#0a0e17]">
        <BogaChartEngine
          symbol={symbol}
          height={440}
          lang="tr"
          detailMode
          showToolbar
          extendedHours={view === "FUTURES"}
          defaultTimeframe="15"
          defaultIndicators={["volume"]}
          customLevels={customLevels}
        />
      </div>
    </div>
  );
}
