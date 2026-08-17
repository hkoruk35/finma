"use client";

/**
 * SPX SuperTrade — Bağlam ve Rejim Paneli
 * Altı katmanın tamamı gerçek piyasa verisinden türetilir; sabit değer yoktur.
 */

import React, { useState } from "react";
import type { ContextSnapshot, SignalState } from "@/lib/spx/types";
import { Badge, INSET, Panel, num, toneClass } from "./supertrade/ui";

const AGREEMENT_META = {
  CONFIRMED: { label: "Canlı yapı teyit ediyor", tone: "up" as const },
  CONTRADICTED: { label: "Canlı yapı çelişiyor", tone: "down" as const },
  PENDING: { label: "Teyit bekleniyor", tone: "neutral" as const },
};

function Card({
  index,
  title,
  headline,
  headlineClass = "text-slate-200",
  detail,
  footLabel,
  footValue,
  footClass = "text-slate-300",
}: {
  index: number;
  title: string;
  headline: string;
  headlineClass?: string;
  detail: string;
  footLabel: string;
  footValue: string;
  footClass?: string;
}) {
  return (
    <div className={`${INSET} flex flex-col justify-between p-3`}>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-[#3b82f6]">
          {index}. {title}
        </div>
        <div className={`mt-1.5 text-[13px] font-medium leading-snug ${headlineClass}`}>{headline}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{detail}</p>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between border-t border-[#1c2635] pt-1.5 text-[10px]">
        <span className="text-slate-500">{footLabel}</span>
        <span className={`font-medium tabular-nums ${footClass}`}>{footValue}</span>
      </div>
    </div>
  );
}

export default function ContextEnginePanel({
  context,
  liveState,
}: {
  context: ContextSnapshot;
  liveState: SignalState;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const { seasonality, volatility, previousSession, overnight, analog } = context;
  const agreement = AGREEMENT_META[context.liveAgreement];

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
          Canlı durum: <span className="text-slate-300">{liveState.replace(/_/g, " ")}</span>
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

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card
          index={1}
          title="Mevsimsellik"
          headline={`${seasonality.month} · ${seasonality.weekday}`}
          detail={seasonality.summary}
          footLabel="Ay evresi"
          footValue={
            seasonality.monthPhase === "EARLY"
              ? "Ay başı"
              : seasonality.monthPhase === "LATE"
              ? "Ay sonu"
              : "Ay ortası"
          }
        />

        <Card
          index={2}
          title="Volatilite (VIX)"
          headline={`VIX ${num(volatility.vix)}`}
          headlineClass={toneClass(-volatility.vix5dChange)}
          detail={volatility.label}
          footLabel="5 günlük değişim"
          footValue={`${volatility.vix5dChange >= 0 ? "+" : ""}${volatility.vix5dChange.toFixed(2)}`}
          footClass={toneClass(-volatility.vix5dChange)}
        />

        <Card
          index={3}
          title="Önceki Seans"
          headline={previousSession.structureType}
          headlineClass={toneClass(previousSession.changePct)}
          detail={`${previousSession.date} · ${previousSession.label}`}
          footLabel="Kapanış konumu"
          footValue={`%${previousSession.closePositionPct} (${previousSession.changePct >= 0 ? "+" : ""}${previousSession.changePct.toFixed(2)}%)`}
          footClass={toneClass(previousSession.changePct)}
        />

        <Card
          index={4}
          title="Gece Seansı (Globex)"
          headline={overnight.gapType}
          headlineClass={toneClass(overnight.gapPts)}
          detail={`Gece aralığı ${num(overnight.onRangePts)} puan · ON orta noktasının ${overnight.vsOnMid === "ABOVE" ? "üstünde" : "altında"} · NQ ${overnight.nqAlignment === "ALIGNED" ? "uyumlu" : "ayrışıyor"}`}
          footLabel="Açılış boşluğu"
          footValue={`${overnight.gapPts >= 0 ? "+" : ""}${overnight.gapPts.toFixed(2)} puan`}
          footClass={toneClass(overnight.gapPts)}
        />

        <Card
          index={5}
          title="Tarihsel Benzerlik"
          headline={
            analog.sampleSize
              ? `${analog.sampleSize} benzer seans · %${analog.bullishPct} yukarı`
              : "Yeterli örnek yok"
          }
          headlineClass={
            analog.bias === "BULLISH"
              ? "text-[#22c55e]"
              : analog.bias === "BEARISH"
              ? "text-[#ef4444]"
              : "text-slate-300"
          }
          detail={
            analog.sampleSize
              ? `Medyan gün içi hareket ${analog.medianMovePts >= 0 ? "+" : ""}${analog.medianMovePts.toFixed(1)} puan · en iyi ${analog.medianMfePts.toFixed(1)} / en kötü ${analog.medianMaePts.toFixed(1)} puan`
              : "Tarihsel karşılaştırma yapılamadı"
          }
          footLabel="En yakın gün"
          footValue={analog.sampleSize ? `${analog.nearestDate} (%${analog.nearestSimilarity})` : "—"}
        />
      </div>
    </Panel>
  );
}
