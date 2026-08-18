"use client";

/**
 * SPX SuperTrade — Bağlam ve Rejim Paneli
 * Beş katmanın tamamı gerçek piyasa verisinden türetilir; sabit değer yoktur.
 */

import { useState } from "react";
import type { ContextSnapshot, SignalState } from "@/lib/v4/types";
import { Badge, INSET, Panel, Table, TBody, Td, Th, THead, Tr, fmt, num, signed, titleCase, toneClass } from "../supertrade/ui";

const AGREEMENT_META = {
  CONFIRMED: { label: "Canlı yapı teyit ediyor", tone: "up" as const },
  CONTRADICTED: { label: "Canlı yapı çelişiyor", tone: "down" as const },
  PENDING: { label: "Teyit bekleniyor", tone: "neutral" as const },
};

export default function V4ContextEnginePanel({
  context,
  liveState,
}: {
  context: ContextSnapshot;
  liveState: SignalState;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const { seasonality, volatility, previousSession, overnight, analog } = context;
  const agreement = AGREEMENT_META[context.liveAgreement];

  const rows = [
    {
      title: "Mevsimsellik",
      headline: `${seasonality.month} · ${seasonality.weekday}`,
      headlineClass: "text-slate-200",
      detail: seasonality.summary,
      footLabel: "Ay evresi",
      footValue:
        seasonality.monthPhase === "EARLY" ? "Ay başı" : seasonality.monthPhase === "LATE" ? "Ay sonu" : "Ay ortası",
      footClass: "text-slate-300",
    },
    {
      title: "Volatilite (VIX)",
      headline: `VIX ${num(volatility.vix)}`,
      headlineClass: toneClass(-volatility.vix5dChange),
      detail: volatility.label,
      footLabel: "5 günlük değişim",
      footValue: signed(volatility.vix5dChange, 2),
      footClass: toneClass(-volatility.vix5dChange),
    },
    {
      title: "Önceki Seans",
      headline: previousSession.structureType,
      headlineClass: toneClass(previousSession.changePct),
      detail: `${previousSession.date} · ${previousSession.label}`,
      footLabel: "Kapanış konumu",
      footValue: `%${previousSession.closePositionPct} (${signed(previousSession.changePct, 2)}%)`,
      footClass: toneClass(previousSession.changePct),
    },
    {
      title: "Gece Seansı (Globex)",
      headline: overnight.gapType,
      headlineClass: toneClass(overnight.gapPts),
      detail: `Gece aralığı ${num(overnight.onRangePts)} puan · ON orta noktasının ${overnight.vsOnMid === "ABOVE" ? "üstünde" : "altında"} · ${overnight.crossLabel} ${overnight.nqAlignment === "ALIGNED" ? "uyumlu" : "ayrışıyor"}`,
      footLabel: "Açılış boşluğu",
      footValue: `${signed(overnight.gapPts, 2)} puan`,
      footClass: toneClass(overnight.gapPts),
    },
    {
      title: "Tarihsel Benzerlik",
      headline: analog.sampleSize
        ? `${analog.sampleSize} benzer seans · %${analog.bullishPct} yukarı`
        : "Yeterli örnek yok",
      headlineClass:
        analog.bias === "BULLISH" ? "text-[#22c55e]" : analog.bias === "BEARISH" ? "text-[#ef4444]" : "text-slate-300",
      detail: analog.sampleSize
        ? `Medyan gün içi hareket ${signed(analog.medianMovePts, 1)} puan · en iyi ${fmt(analog.medianMfePts, 1)} / en kötü ${fmt(analog.medianMaePts, 1)} puan`
        : "Tarihsel karşılaştırma yapılamadı",
      footLabel: "En yakın gün",
      footValue: analog.sampleSize ? `${analog.nearestDate} (%${analog.nearestSimilarity})` : "—",
      footClass: "text-slate-300",
    },
  ];

  return (
    <Panel
      title="Piyasa Bağlamı ve Rejim Motoru"
      hint="mevsimsellik · volatilite · önceki seans · gece seansı · tarihsel benzerlik"
      right={
        <div className="flex items-center gap-2">
          <code
            className="hidden max-w-[360px] truncate rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-1 text-[10px] text-slate-400 lg:block"
            title={context.fingerprint}
          >
            {context.fingerprint}
          </code>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="rounded border border-[#1c2635] px-2 py-1 text-[10px] text-slate-400 transition-colors hover:text-slate-200"
          >
            {showDetail ? "Detayı gizle" : "Detayı göster"}
          </button>
        </div>
      }
    >
      {/* Tarihsel eğilim ile canlı yapının uyumu */}
      <div className={`${INSET} mb-3 flex flex-col gap-1.5 p-3 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={agreement.tone}>{agreement.label}</Badge>
          <span className="text-[12px] leading-relaxed text-slate-300">{context.liveAgreementText}</span>
        </div>
        <span className="shrink-0 text-[11px] text-slate-500">
          Canlı durum: <span className="text-slate-300">{titleCase(liveState.replace(/_/g, " "))}</span>
        </span>
      </div>

      {showDetail && (
        <div className={`${INSET} mb-3 p-3 text-[11px] leading-relaxed text-slate-400`}>
          <p>
            Net skor, on bir ölçülebilir faktörün ağırlıklı toplamıdır. Bağlam katmanı skoru doğrudan
            değiştirmez; tarihsel eğilimin canlı yapıyı destekleyip desteklemediğini gösterir. Çelişki
            durumunda canlı yapı önceliklidir.
          </p>
          <p className="mt-2">
            Tarihsel eşleşme kriteri: <span className="text-slate-300">{analog.criteria}</span>
          </p>
        </div>
      )}

      <Table bordered={false}>
        <THead>
          <tr>
            <Th>Katman</Th>
            <Th>Özet</Th>
            <Th className="hidden md:table-cell">Detay</Th>
            <Th align="right">Ölçüm</Th>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <Tr key={r.title}>
              <Td valueClass="text-slate-400">{r.title}</Td>
              <Td valueClass={`font-medium ${r.headlineClass}`}>{r.headline}</Td>
              <Td className="hidden md:table-cell" valueClass="text-slate-500 font-normal">
                {r.detail}
              </Td>
              <Td align="right" valueClass={r.footClass}>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-500">{r.footLabel}</span>
                  <span className={`font-medium ${r.footClass}`}>{r.footValue}</span>
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Panel>
  );
}
