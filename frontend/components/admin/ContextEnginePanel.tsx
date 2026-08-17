"use client";

import React, { useState } from "react";
import { SPXContextSnapshot } from "@/lib/contextEngine";

export default function ContextEnginePanel({
  context,
  liveState,
}: {
  context: SPXContextSnapshot;
  liveState: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    seasonality,
    macro,
    volatility,
    previousSession,
    overnight,
    analog,
    fingerprint,
    liveOverrideStatus,
    liveOverrideExplanation,
    layerWeights,
  } = context;

  const isConfirmed = liveOverrideStatus === "CONFIRMED_BY_LIVE_STRUCTURE";
  const isContradicted = liveOverrideStatus === "CONTRADICTED_BY_LIVE_STRUCTURE";

  const overrideBadgeColor = isConfirmed
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
    : isContradicted
    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
    : "bg-amber-400/20 text-amber-300 border-amber-400/30";

  const overrideTitle = isConfirmed
    ? "CANLI YAPI İLE TEYİTLİ (ONAYLANDI)"
    : isContradicted
    ? "CANLI YAPI İLE ÇELİŞKİLİ (CANLI GEÇERSİZ KILMA AKTİF)"
    : "HENÜZ TEYİT EDİLMEDİ (BEKLEMEDE)";

  return (
    <div className="mb-6 rounded-xl border border-white/[0.08] bg-[#0b0f17] p-5 shadow-lg relative overflow-hidden">
      {/* Üst Başlık & Context Fingerprint */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06] pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏛️</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#00d2ff] uppercase tracking-wider">
                Piyasa Bağlamı ve Rejim Motoru (Context &amp; Regime Engine)
              </h3>
              <span className="bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/20 text-[10px] font-bold px-2 py-0.5 rounded">
                Çok Katmanlı Analiz
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Takvim Mevsimselliği + Makro Olay Hafızası + Volatilite Rejimi + Tarihsel Benzerlik Eşleşmesi
            </p>
          </div>
        </div>

        {/* Fingerprint ve Ağırlık Dağılımı Toggle */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div
            className="bg-[#050811] border border-white/[0.06] px-2.5 py-1 rounded font-mono text-[10px] text-[#00d2ff] max-w-[320px] truncate"
            title={`Bağlam İmzası:\n${fingerprint}`}
          >
            🔑 {fingerprint}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-slate-300 hover:text-white px-2.5 py-1 rounded bg-white/[0.06] border border-white/[0.1] transition-colors"
          >
            {isExpanded ? "Ağırlıkları Gizle ▲" : "Ağırlıkları Göster ▼"}
          </button>
        </div>
      </div>

      {/* Ağırlık Dağılım Paneli (Açılır/Kapanır) */}
      {isExpanded && (
        <div className="mb-4 bg-[#050811] p-3 rounded-lg border border-white/[0.06] text-xs text-slate-300 grid grid-cols-2 md:grid-cols-7 gap-2 text-center">
          <div>
            <span className="text-[#00d2ff] font-semibold block text-[10px]">Canlı Yapı</span>
            <span className="font-bold text-[#00d2ff]">%{Math.round((layerWeights?.liveStructure ?? 0.35) * 100)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Gece / Vadeli</span>
            <span className="font-bold text-slate-200">%{Math.round((layerWeights?.overnightFutures ?? 0.20) * 100)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Önceki Seans</span>
            <span className="font-bold text-slate-200">%{Math.round((layerWeights?.previousSession ?? 0.15) * 100)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Makro Bağlam</span>
            <span className="font-bold text-slate-200">%{Math.round((layerWeights?.macroContext ?? 0.10) * 100)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Volatilite Rejimi</span>
            <span className="font-bold text-slate-200">%{Math.round((layerWeights?.volatilityRegime ?? 0.10) * 100)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Mevsimsellik</span>
            <span className="font-bold text-slate-200">%{Math.round((layerWeights?.seasonality ?? 0.07) * 100)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Günlük Eğilim</span>
            <span className="font-bold text-slate-200">%{Math.round((layerWeights?.weekdayTendency ?? 0.03) * 100)}</span>
          </div>
        </div>
      )}

      {/* Canlı Yapı Teyit / Çelişki Şeridi */}
      <div className={`p-3 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-4 ${overrideBadgeColor}`}>
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs">{overrideTitle}</span>
          <span className="text-[11px] opacity-90 hidden sm:inline">|</span>
          <span className="text-xs">{liveOverrideExplanation}</span>
        </div>
        <div className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-black/30 w-fit">
          Mevcut Durum: {liveState.replace(/_/g, " ")}
        </div>
      </div>

      {/* 6 Katmanlı Bağlam Kartları Izgarası */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* 1. Mevsimsellik */}
        <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.04] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#00d2ff] font-bold uppercase mb-1">1. Mevsimsellik</div>
            <div className="font-bold text-slate-200">{seasonality.month} ({seasonality.monthPhase})</div>
            <div className="text-[11px] text-slate-400 mt-1">{seasonality.humanSummary}</div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-white/[0.04]">
            Gün: <span className="text-[#00d2ff] font-bold">{seasonality.weekday}</span>
          </div>
        </div>

        {/* 2. Makro Olay */}
        <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.04] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#00d2ff] font-bold uppercase mb-1">2. Makro Olay</div>
            <div className="font-bold text-amber-300">{macro.label}</div>
            <div className="text-[11px] text-slate-400 mt-1">{macro.eventMemory?.eventName || macro.tag}</div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-white/[0.04]">
            Kırılım Başarısı: <span className="text-emerald-400 font-bold">%{macro.eventMemory?.orBreakoutSuccessRate || 75}</span>
          </div>
        </div>

        {/* 3. Volatilite Rejimi */}
        <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.04] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#00d2ff] font-bold uppercase mb-1">3. Volatilite (VIX)</div>
            <div className="font-bold text-purple-300">{volatility.regimeTag}</div>
            <div className="text-[11px] text-slate-400 mt-1">VIX: {volatility.vixValue.toFixed(1)} ({volatility.vix5dChange >= 0 ? `+${volatility.vix5dChange}` : volatility.vix5dChange})</div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-white/[0.04]">
            Seviye: <span className="text-slate-300 font-medium">{volatility.level}</span>
          </div>
        </div>

        {/* 4. Önceki Seans Yapısı */}
        <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.04] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#00d2ff] font-bold uppercase mb-1">4. Önceki Seans</div>
            <div className="font-bold text-slate-200">{previousSession.structureType}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Kapanış: <span className={previousSession.closeVsHighLowPct >= 70 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>%{previousSession.closeVsHighLowPct}</span> ({previousSession.label})
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-white/[0.04]">
            Momentum: <span className="text-slate-300 font-medium">{previousSession.last30mMomentum}</span>
          </div>
        </div>

        {/* 5. Gece Seansı (Overnight Globex) */}
        <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.04] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#00d2ff] font-bold uppercase mb-1">5. Gece Globex</div>
            <div className="font-bold text-slate-200">{overnight.gapType}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Gap: <span className={overnight.gapPts >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{overnight.gapPts >= 0 ? `+${overnight.gapPts}` : overnight.gapPts} Puan</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-white/[0.04]">
            Aralık: <span className="text-amber-400 font-medium">{overnight.overnightRangePts} Puan</span>
          </div>
        </div>

        {/* 6. Tarihsel Benzerlik (Analog Match) */}
        <div className="bg-[#050811] p-3 rounded-lg border border-white/[0.04] flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#00d2ff] font-bold uppercase mb-1">6. Tarihsel Eşleşme</div>
            <div className="font-bold text-[#00d2ff]">{analog.nearestAnalogDate}</div>
            <div className="text-[11px] text-slate-400 mt-1">{analog.historicalBias}</div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 pt-1 border-t border-white/[0.04]">
            Benzerlik Oranı: <span className="text-emerald-400 font-bold">%{analog.nearestAnalogSimilarity}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
