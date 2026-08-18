"use client";

import { useEffect, useRef, useState } from "react";
import type { AssetClass, AssetSnapshot, TrendStructure } from "@/lib/v4/types";
import { minutesToClose } from "@/lib/v4/options";
import {
  Badge,
  EmptyState,
  INSET,
  Panel,
  Row,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Tabs,
  fmt,
  signed,
  titleCase,
  toneClass,
} from "@/components/admin/supertrade/ui";

import { ClientTime } from "@/components/global/ClientTime";

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

/** Yapı (trend) rengi: yükseliş yeşil, düşüş kırmızı, yatay nötr */
function trendClass(val: TrendStructure): string {
  if (val === "UPTREND") return "text-[#22c55e]";
  if (val === "DOWNTREND") return "text-[#ef4444]";
  return "text-slate-400";
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

  // Gece yarısını geçip (NY saatiyle) hâlâ yeni seansın gerçek verisi
  // gelmemişse görünüm otomatik olarak "Tahmin" sekmesine döner — kullanıcı
  // isterse "Canlı / Bugün" sekmesine geri dönüp son kapanışı görebilir, bu
  // yüzden geçiş SADECE bir kere (geçiş anında) zorlanır.
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    if (view?.rollover.isNextDay && !autoSwitchedRef.current) {
      setMode("forecast");
      autoSwitchedRef.current = true;
    }
  }, [view?.rollover.isNextDay]);

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

  const { decision, levels, structure, factors, context, rollover, forecast } = view;
  const frame = view.frames[view.frames.length - 1];
  const dirTone = directionTone(decision.direction);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
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
          Son Güncelleme: <ClientTime timestamp={view.asOf} lang="tr-TR" />
        </span>
        {rollover.isNextDay ? (
          <Badge tone="brand" className="ml-auto">
            {`Sonraki seans: ${rollover.nextTradingDate}`}
          </Badge>
        ) : rollover.prepReady ? (
          <Badge tone="neutral" className="ml-auto" title={`${rollover.nextTradingDate} için hazır`}>
            Yarın için hazır
          </Badge>
        ) : null}
      </div>

      {mode === "forecast" ? (
        <V4SuperTradeForecast snapshot={view} precomputed={forecast} />
      ) : (
        <>
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
                <div className="text-[10px] font-medium tracking-wider text-slate-500">
                  {`Sistem Kararı (${asset})`}
                </div>
                <div className="mt-1 text-[18px] font-medium tracking-tight text-white">
                  {decision.action}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={dirTone}>{titleCase(frame.state.replace(/_/g, " "))}</Badge>
                <div className="text-[10px] text-slate-500">
                  Net Skor:{" "}
                  <span className={`font-semibold ${toneClass(frame.netScore)}`}>{signed(frame.netScore, 1)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Row label="Teyit Beklentisi" value={decision.confirmation} />
              <Row label="İptal Koşulu (Stop)" value={decision.invalidation} />
            </div>
          </div>

          {/* Piyasa Bağlamı — tam genişlik; 5 kartlık grid'in daralması engellenir */}
          <V4ContextEnginePanel context={context} liveState={frame.state} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
            {/* Sol Kolon - Grafik ve Analiz */}
            <div className="flex flex-col gap-4 min-w-0">
              {/* Grafik — gerçek BogaStock grafik motoru, tamamen interaktif */}
              <V4SuperTradeLiveChart
                asset={asset}
                levels={{
                  vwap: frame.vwap,
                  onh: levels.futures.onh,
                  onl: levels.futures.onl,
                  orh: levels.spot.orh,
                  orl: levels.spot.orl,
                  pdc: levels.futures.pdc,
                }}
                loading={loading}
              />

              {/* Yapı ve Skor Tablosu */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Panel title="Piyasa Yapısı" className="col-span-1 lg:col-span-2" padding="p-0">
                  <Table bordered={false}>
                    <THead>
                      <tr>
                        <Th align="center">Vadeli 15dk</Th>
                        <Th align="center">Vadeli 5dk</Th>
                        <Th align="center">Vadeli 1dk</Th>
                        <Th align="center">Spot 5dk</Th>
                        <Th align="center">Spot 1dk</Th>
                      </tr>
                    </THead>
                    <TBody>
                      <Tr>
                        <Td align="center" valueClass={`font-medium ${trendClass(structure.futures15m)}`}>
                          {titleCase(structure.futures15m)}
                        </Td>
                        <Td align="center" valueClass={`font-medium ${trendClass(structure.futures5m)}`}>
                          {titleCase(structure.futures5m)}
                        </Td>
                        <Td align="center" valueClass={`font-medium ${trendClass(structure.futures1m)}`}>
                          {titleCase(structure.futures1m)}
                        </Td>
                        <Td align="center" valueClass={`font-medium ${trendClass(structure.spot5m)}`}>
                          {titleCase(structure.spot5m)}
                        </Td>
                        <Td align="center" valueClass={`font-medium ${trendClass(structure.spot1m)}`}>
                          {titleCase(structure.spot1m)}
                        </Td>
                      </Tr>
                    </TBody>
                  </Table>
                </Panel>
                <Panel title="Skor Özeti">
                  <div className="flex h-full flex-col justify-center gap-3">
                    <Row label="Long Faktörleri" value={`+${fmt(frame.longScore, 1)}`} valueClass="font-semibold text-[#22c55e]" />
                    <Row label="Short Faktörleri" value={`-${fmt(frame.shortScore, 1)}`} valueClass="font-semibold text-[#ef4444]" />
                    <div className="my-1 h-px bg-[#1c2635]" />
                    <Row
                      label="Net Yön Skoru"
                      value={signed(frame.netScore, 1)}
                      valueClass={`font-semibold ${toneClass(frame.netScore)}`}
                    />
                  </div>
                </Panel>
              </div>

              {/* Faktör dökümü */}
              <Panel title="Skor Gerekçeleri" hint="ölçülen 11 faktör" padding={factors.length ? "p-0" : "p-4"}>
                {factors.length ? (
                  <Table bordered={false}>
                    <THead>
                      <tr>
                        <Th>Faktör</Th>
                        <Th align="right">Ölçüm</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {factors.map((f, i) => (
                        <Tr key={`${f.label}-${i}`}>
                          <Td valueClass="text-slate-400">{f.label}</Td>
                          <Td
                            align="right"
                            valueClass={f.weight > 0 ? "text-[#22c55e]" : f.weight < 0 ? "text-[#ef4444]" : "text-slate-400"}
                          >
                            {f.detail}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <EmptyState>Piyasa açılana kadar skor faktörleri hesaplanmaz.</EmptyState>
                )}
              </Panel>

              <V4StrategyLab
                spotPrice={view.spotPrice}
                state={frame.state}
                vix={view.vixPrice}
                minutesLeft={
                  view.isLiveSession
                    ? minutesToClose(
                        Number(frame.timeLabel.split(":")[0]) * 60 + Number(frame.timeLabel.split(":")[1])
                      )
                    : 390
                }
                isLive={view.isLiveSession}
              />
            </div>

            {/* Sağ Kolon - Kritik Seviyeler */}
            <div className="flex w-full flex-col gap-4">
              <Panel title="Kritik Seviyeler" padding="p-0">
                <Table bordered={false}>
                  <TBody>
                    <Tr>
                      <Td valueClass="text-slate-500">Açılış ORH</Td>
                      <Td align="right">{levels.spot.isOrDefined ? fmt(levels.spot.orh) : "—"}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">Açılış ORL</Td>
                      <Td align="right">{levels.spot.isOrDefined ? fmt(levels.spot.orl) : "—"}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">OR genişliği</Td>
                      <Td align="right">{levels.spot.isOrDefined ? `${fmt(levels.spot.orSize)} puan` : "—"}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">Seans VWAP</Td>
                      <Td align="right" valueClass="text-[#3b82f6]">{fmt(frame.vwap)}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">Gece ONH</Td>
                      <Td align="right">{fmt(levels.futures.onh)}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">Gece ONL</Td>
                      <Td align="right">{fmt(levels.futures.onl)}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">ON orta nokta</Td>
                      <Td align="right">{fmt(levels.futures.onMid)}</Td>
                    </Tr>
                    <Tr>
                      <Td valueClass="text-slate-500">Önceki gün kapanışı</Td>
                      <Td align="right">{fmt(levels.futures.pdc)}</Td>
                    </Tr>
                  </TBody>
                </Table>
              </Panel>
              <Panel title="Son Değişimler" padding={view.changes.length ? "p-0" : "p-4"}>
                {view.changes.length ? (
                  <Table bordered={false}>
                    <TBody>
                      {view.changes.map((c, i) => (
                        <Tr key={`${c.label}-${i}`}>
                          <Td valueClass="text-slate-500">{c.label}</Td>
                          <Td
                            align="right"
                            valueClass={c.tone === "UP" ? "text-[#22c55e]" : c.tone === "DOWN" ? "text-[#ef4444]" : "text-slate-300"}
                          >
                            {c.from} → {c.to}
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                ) : (
                  <EmptyState>Son 5 dakikada anlamlı değişim yok.</EmptyState>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        Bu görünüm araştırma ve karar desteği amaçlıdır. Opsiyon primleri teorik modellerdir, otomatik
        emre dönüşmez ve yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
